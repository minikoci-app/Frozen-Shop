// For Firebase JS SDK v7.20.0 and later, measurementId is optional
export const firebaseConfig = {
  apiKey: "AIzaSyBtlGcAJrPvW9bUo0UgnzymZ0nEdZ79gcM",
  authDomain: "frozen-shop.firebaseapp.com",
  projectId: "frozen-shop",
  storageBucket: "frozen-shop.firebasestorage.app",
  messagingSenderId: "378405228910",
  appId: "1:378405228910:web:260ebf42e60c9477b0717f",
  measurementId: "G-X6510SVGY5"
};

// Client Key dari Midtrans Dashboard > Settings > Access Keys
// (Server Key JANGAN ditaruh di sini — disimpan sebagai Environment Variable di Vercel)
// Alamat back end (Netlify Functions).
// - Kosongkan ('') bila front end & back end di situs Netlify yang sama (kondisi akhir/produksi).
// - Selama masih di GitHub Pages, isi mis. 'https://NAMA-SITUS.netlify.app' agar checkout tersambung,
//   atau biarkan kosong bila back end belum dipasang (katalog & admin produk tetap jalan).
export const API_BASE = '';

export const MIDTRANS = {
  clientKey: "Mid-client-8hG8EmOwoIIol1GO",
  production: false // ganti true saat live (dan set env MIDTRANS_PRODUCTION=true di Vercel)
};

