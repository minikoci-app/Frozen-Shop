import { db, FieldValue, HttpError, rupiah, clean, normPhone, newOrderId, snapEndpoint, wrap, readJson, restoreStock } from '../lib/common.js';

export default wrap(async (req) => {
  const { items, customer } = await readJson(req);

  if (!Array.isArray(items) || !items.length || items.length > 50) throw new HttpError(400, 'Keranjang kosong.');
  const c = {
    name: clean(customer?.name, 80),
    phone: normPhone(customer?.phone),
    email: clean(customer?.email, 120),
    area: clean(customer?.area, 80),
    address: clean(customer?.address, 300),
    note: clean(customer?.note, 300),
  };
  if (!c.name || !c.address || !c.area) throw new HttpError(400, 'Nama, area, dan alamat wajib diisi.');
  if (c.phone.length < 10 || c.phone.length > 15) throw new HttpError(400, 'Nomor HP tidak valid.');

  const qtyById = new Map();
  for (const it of items) {
    const id = clean(it?.id, 100);
    const q = Math.floor(Number(it?.qty));
    if (!id || id.includes('/') || !(q >= 1 && q <= 99)) throw new HttpError(400, 'Data keranjang tidak valid.');
    qtyById.set(id, (qtyById.get(id) || 0) + q);
  }

  const orderId = newOrderId();
  const orderRef = db.collection('orders').doc(orderId);

  const order = await db.runTransaction(async (tx) => {
    const settingsSnap = await tx.get(db.doc('settings/store'));
    const s = settingsSnap.exists ? settingsSnap.data() : {};
    const ids = [...qtyById.keys()];
    const snaps = await tx.getAll(...ids.map((id) => db.collection('products').doc(id)));

    let subtotal = 0;
    const lines = [];
    snaps.forEach((snap) => {
      const q = qtyById.get(snap.id);
      if (!snap.exists || snap.data().active !== true) throw new HttpError(409, 'Ada produk yang sudah tidak tersedia. Muat ulang halaman.');
      const p = snap.data();
      const price = Math.round(Number(p.price) || 0);
      if (price <= 0) throw new HttpError(409, `Harga ${p.name} belum diatur.`);
      if ((p.stock || 0) < q) throw new HttpError(409, `Stok ${p.name} tinggal ${p.stock || 0}.`);
      subtotal += price * q;
      lines.push({ id: snap.id, name: p.name, price, qty: q, unit: p.unit || '' });
    });

    const minOrder = Number(s.minOrder) || 0;
    if (subtotal < minOrder) throw new HttpError(409, `Minimal belanja ${rupiah(minOrder)}.`);
    const areas = Array.isArray(s.shippingAreas) ? s.shippingAreas : [];
    const area = areas.find((a) => a.name === c.area);
    if (!area) throw new HttpError(400, 'Area pengiriman tidak tersedia.');
    const freeMin = Number(s.freeShippingMin) || 0;
    const shipping = freeMin > 0 && subtotal >= freeMin ? 0 : Math.round(Number(area.fee) || 0);
    const total = subtotal + shipping;

    snaps.forEach((snap) => tx.update(snap.ref, { stock: FieldValue.increment(-qtyById.get(snap.id)) }));

    const data = {
      orderId, items: lines, subtotal, shipping, total, customer: c,
      paymentStatus: 'pending', // pending | paid | expired | failed | cancelled
      fulfillment: 'baru',      // baru | diproses | dikirim | selesai | batal
      stockRestored: false,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    };
    tx.set(orderRef, data);
    return data;
  });

  // --- Minta Snap token ke Midtrans ---
  const itemDetails = order.items.map((l) => ({ id: l.id.slice(0, 50), price: l.price, quantity: l.qty, name: l.name.slice(0, 50) }));
  if (order.shipping > 0) itemDetails.push({ id: 'ONGKIR', price: order.shipping, quantity: 1, name: `Ongkir ${c.area}`.slice(0, 50) });

  const body = {
    transaction_details: { order_id: orderId, gross_amount: order.total },
    item_details: itemDetails,
    customer_details: {
      first_name: c.name.slice(0, 50),
      phone: c.phone,
      ...(c.email ? { email: c.email } : {}),
      shipping_address: { first_name: c.name.slice(0, 50), phone: c.phone, address: c.address.slice(0, 200), city: c.area.slice(0, 50), country_code: 'IDN' },
    },
    expiry: { unit: 'hours', duration: 24 },
  };

  let snapRes;
  try {
    const res = await fetch(snapEndpoint(), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        Authorization: 'Basic ' + Buffer.from(process.env.MIDTRANS_SERVER_KEY + ':').toString('base64'),
      },
      body: JSON.stringify(body),
    });
    snapRes = await res.json();
    if (!res.ok || !snapRes.token) throw new Error(JSON.stringify(snapRes));
  } catch (e) {
    console.error('Midtrans error', e);
    await restoreStock(orderId, 'failed');
    throw new HttpError(502, 'Gagal membuat pembayaran. Silakan coba lagi.');
  }

  await orderRef.update({ snapToken: snapRes.token, snapRedirectUrl: snapRes.redirect_url || null });
  return { orderId, token: snapRes.token, total: order.total };
});

export const config = { path: '/api/create-order' };
