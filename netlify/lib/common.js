// Helper bersama untuk semua function (di luar folder functions, jadi tidak dijadikan endpoint)
import admin from 'firebase-admin';
import crypto from 'node:crypto';

// Merapikan private key dari environment variable. Menoleransi: tanda kutip di sekitar nilai,
// "\n" berupa teks, baris baru yang berubah jadi spasi, atau semua tertempel dalam satu baris.
export function normalizePrivateKey(raw) {
  let k = String(raw || '').trim().replace(/^["']+|["']+$/g, '');
  k = k.replace(/\\n/g, '\n').replace(/\r/g, '');
  const m = /-----BEGIN ([A-Z ]+)-----([\s\S]*?)-----END \1-----/.exec(k);
  if (!m) return k;
  const body = m[2].replace(/[^A-Za-z0-9+/=]/g, '');
  const lines = body.match(/.{1,64}/g) || [];
  return `-----BEGIN ${m[1]}-----\n${lines.join('\n')}\n-----END ${m[1]}-----\n`;
}

if (!admin.apps.length) {
  // Cara 1 (disarankan di Netlify, batas env var kecil): 3 variabel terpisah.
  // Cara 2: satu variabel FIREBASE_SERVICE_ACCOUNT berisi seluruh JSON.
  const sa = process.env.FIREBASE_SERVICE_ACCOUNT
    ? JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT)
    : {
        project_id: process.env.FIREBASE_PROJECT_ID,
        client_email: process.env.FIREBASE_CLIENT_EMAIL,
        private_key: process.env.FIREBASE_PRIVATE_KEY,
      };
  sa.private_key = normalizePrivateKey(sa.private_key);
  try {
    crypto.createPrivateKey(sa.private_key);
  } catch (e) {
    throw new Error(
      'FIREBASE_PRIVATE_KEY tidak valid. Salin ulang nilai "private_key" dari file JSON service account: ' +
      'harus diawali -----BEGIN PRIVATE KEY----- dan diakhiri -----END PRIVATE KEY-----, tanpa tanda kutip.'
    );
  }
  admin.initializeApp({ credential: admin.credential.cert(sa) });
}
export const db = admin.firestore();
export const FieldValue = admin.firestore.FieldValue;

export class HttpError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}

export const rupiah = (n) => 'Rp' + Math.round(n).toLocaleString('id-ID');
export const clean = (v, max) => String(v ?? '').trim().slice(0, max);

export function normPhone(raw) {
  let d = String(raw || '').replace(/\D/g, '');
  if (d.startsWith('0')) d = '62' + d.slice(1);
  else if (d.startsWith('8')) d = '62' + d;
  return d;
}

export function newOrderId() {
  const wib = new Date(Date.now() + 7 * 3600 * 1000);
  const ymd = wib.toISOString().slice(2, 10).replace(/-/g, '');
  return `FF${ymd}-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;
}

export const snapEndpoint = () =>
  process.env.MIDTRANS_PRODUCTION === 'true'
    ? 'https://app.midtrans.com/snap/v1/transactions'
    : 'https://app.sandbox.midtrans.com/snap/v1/transactions';

// CORS: hanya untuk origin yang didaftarkan di env ALLOWED_ORIGINS (pisahkan dengan koma),
// mis. https://namaanda.github.io  — dipakai selama front end masih di GitHub Pages.
export function corsHeaders(req) {
  const origin = req.headers.get('origin');
  const allowed = (process.env.ALLOWED_ORIGINS || '').split(',').map((s) => s.trim()).filter(Boolean);
  if (!origin || !allowed.includes(origin)) return {};
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Headers': 'Authorization, Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    Vary: 'Origin',
  };
}

export const json = (data, status = 200, extra = {}) =>
  new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json', ...extra } });

export const readJson = (req) => req.json().catch(() => ({}));

/** Bungkus handler: hanya POST, balasan JSON, error rapi. */
export const wrap = (fn) => async (req) => {
  const cors = corsHeaders(req);
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405, cors);
  try {
    return json(await fn(req), 200, cors);
  } catch (e) {
    if (e instanceof HttpError) return json({ error: e.message }, e.status, cors);
    console.error(e);
    return json({ error: 'Terjadi kesalahan di server. Coba lagi.' }, 500, cors);
  }
};

/** Pastikan pemanggil adalah admin (ID token Firebase + dokumen admins/<uid>). */
export async function requireAdmin(req) {
  const m = /^Bearer (.+)$/.exec(req.headers.get('authorization') || '');
  if (!m) throw new HttpError(401, 'Login dulu.');
  let decoded;
  try { decoded = await admin.auth().verifyIdToken(m[1]); }
  catch { throw new HttpError(401, 'Sesi login habis. Login ulang.'); }
  const snap = await db.doc(`admins/${decoded.uid}`).get();
  if (!snap.exists) throw new HttpError(403, 'Bukan admin.');
  return decoded;
}

/** Kembalikan stok sebuah order (sekali saja). */
export async function restoreStock(orderId, paymentStatus, force = false) {
  const ref = db.collection('orders').doc(orderId);
  await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists) return;
    const o = snap.data();
    if (o.stockRestored) return;
    if (o.paymentStatus === 'paid' && !force) return;
    const prodSnaps = await tx.getAll(...o.items.map((l) => db.collection('products').doc(l.id)));
    prodSnaps.forEach((ps, i) => {
      if (ps.exists) tx.update(ps.ref, { stock: FieldValue.increment(o.items[i].qty) });
    });
    tx.update(ref, {
      stockRestored: true,
      fulfillment: 'batal',
      ...(paymentStatus ? { paymentStatus } : {}),
      updatedAt: FieldValue.serverTimestamp(),
    });
  });
}
