import crypto from 'node:crypto';
import { db, FieldValue, restoreStock } from '../lib/common.js';

// Midtrans memanggil endpoint ini setiap status pembayaran berubah.
export default async (req) => {
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 });
  try {
    const n = await req.json().catch(() => ({}));
    const { order_id, status_code, gross_amount, signature_key, transaction_status, fraud_status } = n;
    if (!order_id || !signature_key) return new Response('bad request', { status: 400 });

    const expected = crypto.createHash('sha512')
      .update(`${order_id}${status_code}${gross_amount}${process.env.MIDTRANS_SERVER_KEY}`)
      .digest('hex');
    if (expected !== signature_key) return new Response('invalid signature', { status: 403 });

    const ref = db.collection('orders').doc(String(order_id));
    const snap = await ref.get();
    if (!snap.exists) return new Response('ignored', { status: 200 }); // mis. tombol "test notification"
    const o = snap.data();
    if (Math.round(Number(gross_amount)) !== o.total) return new Response('amount mismatch', { status: 400 });

    const ts = transaction_status;
    if (ts === 'settlement' || (ts === 'capture' && fraud_status === 'accept')) {
      if (o.paymentStatus !== 'paid') {
        await ref.update({
          paymentStatus: 'paid',
          paymentType: n.payment_type || null,
          paidAt: FieldValue.serverTimestamp(),
          updatedAt: FieldValue.serverTimestamp(),
          ...(o.stockRestored ? { needsReview: true } : {}), // dibayar setelah stok dikembalikan (langka)
        });
      }
    } else if (ts === 'pending') {
      await ref.update({ paymentType: n.payment_type || null, updatedAt: FieldValue.serverTimestamp() });
    } else if (['deny', 'cancel', 'expire', 'failure'].includes(ts)) {
      await restoreStock(String(order_id), ts === 'expire' ? 'expired' : 'failed');
    }
    return new Response('ok', { status: 200 });
  } catch (e) {
    console.error('webhook error', e);
    return new Response('error', { status: 500 });
  }
};

export const config = { path: '/api/midtrans-webhook' };
