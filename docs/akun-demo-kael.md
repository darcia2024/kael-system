# Akun Demo KAEL

Untuk menawarkan ke calon pelanggan, **pakai `KAELCAFE`**. Itu satu-satunya
tenant yang datanya sudah lengkap. Tenant lain di halaman ini ada untuk
menguji sistem, bukan untuk dipresentasikan.

## Demo Kafe - 6 September 2026 (pakai yang ini)

- Login: https://kaels.site/app/login (pilih Owner)
- Email: `owner@kaelcafe.invalid`
- Password: `KaelCafeDemo!2026`
- Kode toko: `KAELCAFE`
- Kasir: `Kasir Demo`, PIN `246810`
- Menu: Kopi Susu, Americano, Croissant; resep dan biaya bahan adalah estimasi demo.
- Order meja 1: https://kaels.site/order/KAELCAFE/1
- Daftar member: https://kaels.site/loyalty/register?toko=KAELCAFE
- Dashboard owner: https://kaels.site/app/pos/owner
- Buat demo personalisasi baru: https://kaels.site/admin/demo (master admin)
- Data transaksi/refund dan pelanggan simulasi dari tes integrasi sengaja dipertahankan. Tidak ada pembayaran atau pengiriman WhatsApp sungguhan.
- Domain email `.invalid` hanya identitas login uji, bukan alamat penerima email.

Tenant demo hanya untuk pengujian. Jangan gunakan kredensial ini untuk tenant
pelanggan dan jangan masukkan data pribadi nyata.

## Master Admin KAEL

- Email: `admin@kaels.id`
- Kata sandi: `KaelAdmin!2026`
- Masuk melalui: `/admin`
- Gunakan untuk tenant, modul, kartu, control center, dan audit. Jangan
  membagikan akun ini ke owner atau staf.

## Owner Kuliner (jangan dipakai presentasi)

- Tenant: `Bakso & Mie Ayam Pak Min`
- Kode toko: `BAKSOMIN`
- Email: `owner@baksopakmin.id`
- Kata sandi: `KaelDemo!2026`
- Modul yang aktif memang POS, Ordering, Finance, Loyalty, Review, tetapi
  isinya cuma 1 menu: nol resep, member, reward, dan kartu. Layarnya akan
  kosong saat didemokan. Untuk kuliner pakai `KAELCAFE` di atas.

## Owner Jasa

- Tenant: `Barber Bro Heritage`
- Kode toko: `BARBER`
- Email: `owner@barberbro.id`
- Kata sandi: `KaelDemo!2026`
- Cocok untuk: Booking, HR, Loyalty, Review, POS.

## Staf Demo

- PIN semua staf: `246810`
- Login staf: buka `/app/login`, masukkan kode toko, pilih nama staf, lalu
  masukkan PIN.

Tenant demo akan ditandai `is_demo` dan memiliki masa aktif 30 hari. Jalankan
`node scripts/seed-demo-stores.mjs` dari folder `web` untuk membuat atau
menyegarkan data ini dengan aman.
