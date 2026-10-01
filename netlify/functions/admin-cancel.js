import { db, HttpError, clean, wrap, readJson, requireAdmin, restoreStock } from '../lib/common.js';

export default wrap(async (req) => {
  await requireAdmin(req);
  const body = await readJson(req);
  const orderId = clean(body.orderId, 40);
  if (!orderId || orderId.includes('/')) throw new HttpError(400, 'Nomor pesanan tidak valid.');
  const snap = await db.collection('orders').doc(orderId).get();
  if (!snap.exists) throw new HttpError(404, 'Pesanan tidak ditemukan.');
  const o = snap.data();
  // Pesanan yang sudah dibayar: status bayar tetap "paid" (refund manual di dashboard Midtrans)
  await restoreStock(orderId, o.paymentStatus === 'paid' ? null : 'cancelled', true);
  return { ok: true };
});

export const config = { path: '/api/admin-cancel' };
