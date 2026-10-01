// Salin dari Firebase Console > Project settings > Your apps > Web app
export const firebaseConfig = {
  apiKey: "ISI_API_KEY",
  authDomain: "ISI_PROJECT_ID.firebaseapp.com",
  projectId: "ISI_PROJECT_ID",
  messagingSenderId: "ISI",
  appId: "ISI"
};

// Client Key dari Midtrans Dashboard > Settings > Access Keys
// (Server Key JANGAN ditaruh di sini — disimpan sebagai Environment Variable di Vercel)
// Alamat back end (Netlify Functions).
// - Kosongkan ('') bila front end & back end di situs Netlify yang sama (kondisi akhir/produksi).
// - Selama masih di GitHub Pages, isi mis. 'https://NAMA-SITUS.netlify.app' agar checkout tersambung,
//   atau biarkan kosong bila back end belum dipasang (katalog & admin produk tetap jalan).
export const API_BASE = '';

export const MIDTRANS = {
  clientKey: "SB-Mid-client-ISI",
  production: false // ganti true saat live (dan set env MIDTRANS_PRODUCTION=true di Vercel)
};

