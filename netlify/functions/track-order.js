import { db, HttpError, clean, normPhone, wrap, readJson } from '../lib/common.js';

export default wrap(async (req) => {
  const body = await readJson(req);
  const orderId = clean(body.orderId, 40).toUpperCase();
  const phone = normPhone(body.phone);
  const snap = orderId && !orderId.includes('/') ? await db.collection('orders').doc(orderId).get() : null;
  if (!snap || !snap.exists || snap.data().customer.phone !== phone) {
    throw new HttpError(404, 'Pesanan tidak ditemukan. Cek nomor pesanan dan nomor HP.');
  }
  const o = snap.data();
  return {
    orderId: o.orderId,
    items: o.items,
    subtotal: o.subtotal,
    shipping: o.shipping,
    total: o.total,
    area: o.customer.area,
    paymentStatus: o.paymentStatus,
    fulfillment: o.fulfillment,
    createdAt: o.createdAt ? o.createdAt.toMillis() : null,
    snapToken: o.paymentStatus === 'pending' && !o.stockRestored ? o.snapToken || null : null,
  };
});

export const config = { path: '/api/track-order' };
