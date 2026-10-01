import { getStore } from '@netlify/blobs';

// Menyajikan foto produk dari Netlify Blobs (publik, di-cache lama oleh CDN).
export default async (req) => {
  const key = decodeURIComponent(new URL(req.url).pathname.replace(/^\/img\//, ''));
  if (!/^[\w.-]+$/.test(key)) return new Response('Not found', { status: 404 });
  const data = await getStore('product-images').get(key, { type: 'arrayBuffer' });
  if (!data) return new Response('Not found', { status: 404 });
  const cache = 'public, max-age=31536000, immutable';
  return new Response(data, { headers: { 'Content-Type': 'image/jpeg', 'Cache-Control': cache, 'Netlify-CDN-Cache-Control': cache } });
};

export const config = { path: '/img/*' };
