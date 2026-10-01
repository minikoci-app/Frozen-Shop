import crypto from 'node:crypto';
import { getStore } from '@netlify/blobs';
import { HttpError, wrap, requireAdmin } from '../lib/common.js';

// Upload foto produk ke Netlify Blobs. Body = biner JPEG (sudah dikecilkan di browser).
export default wrap(async (req) => {
  await requireAdmin(req);
  const buf = Buffer.from(await req.arrayBuffer());
  if (!buf.length) throw new HttpError(400, 'File kosong.');
  if (buf.length > 2 * 1024 * 1024) throw new HttpError(413, 'Ukuran foto maksimal 2 MB.');
  if (!(buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff)) throw new HttpError(400, 'Format harus JPEG.');
  const key = `${Date.now()}-${crypto.randomBytes(3).toString('hex')}.jpg`;
  await getStore('product-images').set(key, buf, { metadata: { contentType: 'image/jpeg' } });
  return { url: `/img/${key}` };
});

export const config = { path: '/api/upload' };
