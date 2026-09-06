# KAEL System

KAEL adalah aplikasi operasional multi-tenant untuk UMKM. Satu tenant dapat
menjalankan kartu digital, kasir dan ordering, loyalty, serta finance dengan
akun owner dan staf yang berizin terbatas.

## Modul

- `Review & Kartu`: aktivasi kartu NFC/QR, redirect tujuan, dan analitik tap.
- `POS & Ordering`: menu, pesanan meja, QRIS, kasir, shift, refund, struk,
  laporan, dan dashboard owner.
- `Loyalty`: pendaftaran member, poin/stempel, reward, voucher, referral,
  tier, campaign, dan privasi data pelanggan.
- `Finance`: HPP resep, bahan baku, stok, kantong kas, transaksi, dan aset.
- `Platform`: lisensi modul, role owner/staf/KAEL admin, branding, dan tenant
  demo/prospect.

## Menjalankan Lokal

```bash
npm install
npm run migrate
npm run dev
```

Aplikasi lokal tersedia di `http://localhost:3000`.

## Quality Gate

```bash
npm run lint
npm run typecheck
npm run test:engines
npm run build
npm run check
```

`lint` memeriksa layer server bersama yang menjadi batas keamanan lintas modul.
`lint:full` disediakan untuk membersihkan backlog UI bertahap, terutama label
form dan interaksi keyboard. GitHub Actions menjalankan `npm run check` pada
push ke `main` dan setiap pull request.

## Environment

Salin `.env.example` menjadi `.env.local`, lalu isi:

- `DATABASE_URL`: koneksi Postgres/Supabase.
- `KAEL_AUTH_SALT`: secret acak minimal 16 karakter untuk cookie sesi.
- `NEXT_PUBLIC_SITE_URL`: domain produksi, saat ini `https://kaels.site`.
- `NEXT_PUBLIC_KAEL_WHATSAPP`: nomor WhatsApp tujuan CTA.
- `GOOGLE_PLACES_API_KEY`: opsional, untuk pencarian lokasi Google saat
  aktivasi kartu.

## Data dan Keamanan

- Semua data operasional dibatasi `business_id`.
- Aplikasi memakai koneksi Postgres server-side; RLS Supabase merupakan
  lapisan tambahan, bukan pengganti pembatasan query aplikasi.
- Cookie sesi ditandatangani dan diverifikasi terhadap status akun terkini pada
  setiap request. Menonaktifkan staf atau memindahkan tenant langsung
  membatalkan aksesnya.
- Kartu member publik memakai token acak, nomor telepon di dashboard staf
  tersamarkan, dan voucher dicatat secara atomik.

## Migrasi dan Deploy

```bash
npm run migrate
vercel --prod --yes --scope darcia2024s-projects
```

Root project Vercel adalah folder `web`. Jangan mengubah atau menghapus migrasi
yang sudah pernah diterapkan. Tambahkan file migrasi baru dengan nama unik dan
urut waktu yang jelas.

## Struktur Penting

```text
src/app/        Halaman publik dan operasional
src/lib/        Auth, lisensi, repository Postgres, serta domain engine
supabase/       Skema dan migrasi database
scripts/        Migrasi dan utilitas tenant demo/prospect
.github/        Quality gate CI
```
