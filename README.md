# Toko Frozen Food

Toko online makanan & frozen food. Front end statis + back end Netlify Functions + Firebase + Midtrans.

```
public/                 → front end (index.html = toko, admin.html = admin)
netlify/functions/      → back end (checkout, webhook Midtrans, lacak pesanan, upload foto)
netlify/lib/common.js   → helper bersama
firestore.rules         → aturan keamanan Firestore
.github/workflows/      → deploy otomatis ke GitHub Pages (tahap pratinjau)
```

> Repo ini **aman dibuat Public**: tidak ada rahasia di dalamnya. Server Key Midtrans dan kunci Firebase Admin
> hanya disimpan sebagai *Environment Variable* di Netlify. **Jangan commit file JSON service account.**

## Alur kerja: GitHub dulu → migrasi ke Netlify

| | GitHub Pages (pratinjau) | Netlify (produksi) |
|---|---|---|
| Katalog produk | ✅ | ✅ |
| Login & kelola produk/pengaturan di admin | ✅ | ✅ |
| Checkout Midtrans, lacak pesanan | ❌ (butuh back end) | ✅ |
| Upload foto produk, batalkan pesanan | ❌ | ✅ |

GitHub Pages hanya bisa menayangkan file statis, jadi bagian back end baru aktif setelah dipasang di Netlify.

## Persiapan Firebase (sekali saja, paket Spark gratis)
1. Firebase Console → **Authentication → Email/Password → Enable**.
2. **Firestore Database → Create** (lokasi `asia-southeast2`), tab **Rules** → tempel isi `firestore.rules` → Publish.
3. **Project settings → Your apps → `</>`** → salin `firebaseConfig` ke `public/js/firebase-config.js`
   (config web ini memang publik, aman ada di repo). Isi juga Client Key Midtrans (Sandbox).

## Tahap 1 — Taruh di GitHub + pratinjau di GitHub Pages
1. github.com → **New repository** → nama `toko-frozen` → Public → Create.
2. Upload semua isi folder ini (termasuk folder tersembunyi `.github`).
   - Lewat komputer: `git init && git add . && git commit -m "toko frozen" && git branch -M main && git remote add origin https://github.com/USERNAME/toko-frozen.git && git push -u origin main`
   - Lewat browser: **Add file → Upload files** (di HP pakai "Desktop site"; pastikan `.github/workflows/pages.yml` ikut terunggah).
3. Repo → **Settings → Pages → Source: GitHub Actions**. Tunggu tab **Actions** hijau.
4. Buka `https://USERNAME.github.io/toko-frozen/` (toko) dan `/admin.html` (admin).
5. Buat admin pertama:
   - Firebase → Authentication → **Add user**.
   - Login di `/admin.html` → muncul pesan berisi **UID**.
   - Firestore → koleksi `admins` → Document ID = UID tadi (isi field apa saja, mis. `role` = `owner`) → login lagi.
6. Di admin: tab **Pengaturan** (isi area ongkir) dan tab **Produk** (tambah produk / "Isi contoh produk").
   Foto belum bisa diunggah di tahap ini.

## Tahap 2 — Migrasi ke Netlify (saat sudah siap)
1. Firebase → Project settings → **Service accounts → Generate new private key** (file JSON; simpan di tempat aman, jangan di repo).
2. app.netlify.com → **Add new site → Import an existing project → GitHub** → pilih repo `toko-frozen`.
   Build command kosong, publish directory `public` (sudah ada di `netlify.toml`).
3. Isi **Environment variables**:

   | Nama | Isi |
   |---|---|
   | `FIREBASE_PROJECT_ID` | `project_id` dari file JSON |
   | `FIREBASE_CLIENT_EMAIL` | `client_email` dari file JSON |
   | `FIREBASE_PRIVATE_KEY` | `private_key` dari file JSON (utuh, dari `-----BEGIN` sampai `END PRIVATE KEY-----`) |
   | `MIDTRANS_SERVER_KEY` | Server Key Midtrans (Sandbox dulu) |
   | `MIDTRANS_PRODUCTION` | `false` |

4. **Deploy**. Situs Netlify sekarang menjalankan toko lengkap (front end + back end di alamat yang sama,
   jadi `API_BASE` di `firebase-config.js` tetap kosong).
5. Midtrans → Settings → Payment → **Payment Notification URL**: `https://NAMA-SITUS.netlify.app/api/midtrans-webhook`
6. Tes checkout dengan simulator Sandbox. Pesanan harus tampil **Lunas** di admin.

### Opsi: front end tetap di GitHub Pages sementara back end sudah di Netlify
Berguna untuk uji coba bertahap. Di `public/js/firebase-config.js` isi `API_BASE = 'https://NAMA-SITUS.netlify.app'`,
dan di Netlify tambah env `ALLOWED_ORIGINS` = `https://USERNAME.github.io`. Setelah yakin, pakai alamat Netlify
sebagai alamat toko, kembalikan `API_BASE = ''`.

### Menutup tahap GitHub Pages
Hapus `.github/workflows/pages.yml` dan matikan Pages di Settings → Pages. Netlify otomatis deploy tiap `git push`.

## Go live
- `firebase-config.js` → Client Key production + `production: true`
- Netlify env: `MIDTRANS_SERVER_KEY` (production) + `MIDTRANS_PRODUCTION=true` → deploy ulang
- Daftarkan Notification URL yang sama di environment Production Midtrans.

## Catatan paket gratis Netlify
Boleh untuk usaha. Jatah **300 kredit/bulan** (deploy production ±15 kredit, bandwidth ±20 kredit/GB, plus pemakaian function).
Kredit habis = situs dijeda sampai bulan berikutnya. Karena itu migrasi ke Netlify dilakukan saat sudah selesai, dan
hindari deploy berlebihan. Pantau di Netlify → Usage.

## Endpoint back end
`POST /api/create-order` · `POST /api/track-order` · `POST /api/midtrans-webhook` · `POST /api/admin-cancel` · `POST /api/upload` · `GET /img/<file>`

Refund pesanan yang sudah dibayar dilakukan manual di dashboard Midtrans. Pesanan bertanda "Perlu dicek" = pembayaran
masuk setelah stok sempat dikembalikan (kasus langka).
