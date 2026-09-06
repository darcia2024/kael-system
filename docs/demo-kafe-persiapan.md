# Demo kafe dan perbaikan 6 September 2026

## Membuat demo untuk calon pelanggan

1. Login master admin di /admin. Buka /admin/control lalu Buat demo kafe.
2. Isi nama kafe, kode toko unik 3-10 karakter, email login owner demo, password minimal 10 karakter, dan PIN kasir enam digit.
3. Isi URL HTTPS logo dan warna kafe. Alamat dan WhatsApp boleh dikosongkan jika belum dikonfirmasi pemilik.
4. Isi menu, harga jual, dan biaya bahan contoh per porsi. Ganti bahan contoh dengan resep sebenarnya di Finance sebelum menjanjikan hasil HPP kepada pemilik.
5. Klik Buat demo kafe. Satu transaksi database membuat tenant, empat modul, owner, kasir, menu dan resep, program poin, reward, serta kartu Smart Touch aktif.
6. Login owner untuk demo. Link order meja dan daftar member tersedia pada hasil pembuatan. Smart Touch bisa diatur di Review; Google Maps dan WhatsApp tidak ditebak atau diisi dengan nomor pihak lain.
7. Isi link review/WhatsApp yang disetujui pemilik melalui editor Smart Touch. Program poin/stempel dan reward bisa diubah melalui Loyalty. Pengaturan order melalui POS Ordering. Branding lanjutan melalui admin bisnis.

## Perbaikan yang dikerjakan

- Query dashboard per jam memakai GROUP BY ekspresi yang sama; kegagalan PostgreSQL 42803 teratasi.
- Link daftar member menyertakan kode toko di seluruh tombol dashboard Loyalty.
- Poin pembelian order baru memiliki referensi order unik dan status selesai. Retry tidak menambah poin dua kali.
- Pengurangan stok memeriksa movement per bahan. Bahan kurang bisa diproses setelah restock tanpa memotong bahan lain lagi.
- Dashboard owner menampilkan transaksi yang belum sinkron dan tombol proses ulang. Belum ada worker retry otomatis terjadwal.
- Koreksi poin purchase saat refund memakai total refund kumulatif. Berlaku bagi order baru dengan ledger tertaut; order lama tidak ditebak referensinya.
- Hitungan tutup shift menggunakan agregat penjualan dan refund terpisah, termasuk refund transaksi shift sebelumnya yang dikeluarkan dari shift saat ini.
- Nomor order diserialkan dengan kunci tenant ketika dibuat.
- Google Review tidak lagi dibatasi rating >=4 pada form feedback struk.
- Logo tenant ditampilkan pada pendaftaran member. Portal dan halaman order memberi label demo.

## Pengujian

npm run check lulus: lint library, TypeScript, engine tests, sesi, dan build.
scripts/test-cafe-integration.ts lulus terhadap tenant khusus KAELCAFE: provisioning, dashboard query, transaksi, retry poin/stok, restock bahan kurang, refund parsial/penuh, koreksi poin dan rekonsiliasi shift.

Menjalankan tes integrasi menulis data simulasi dan menutup shift pada tenant KAELCAFE. Jangan jalankan ketika tenant tersebut sedang dipakai demonstrasi.

## Batas yang tetap perlu diketahui

- Pembayaran tersimpan sebelum sinkronisasi selesai; recovery tersedia lewat dashboard. Status lama sebelum migrasi dianggap sudah diproses untuk menghindari pemberian poin historis dua kali. Riwayat lama perlu rekonsiliasi terpisah bila pernah gagal.
- Refund nominal tidak otomatis mengembalikan bahan ke stok: makanan/minuman yang sudah dibuat tidak otomatis bisa dijual kembali. Koreksi stok harus berdasarkan barang yang benar-benar kembali.
- HPP demo adalah biaya bahan estimasi. Resep rinci, kemasan, operasional, foto menu, logo asli dan link Google kafe tetap membutuhkan data pemilik.
- Printer fisik dan chip NFC belum diuji pada perangkat pengguna.
- WhatsApp otomatis belum tersambung ke provider. Konfigurasi channel saja belum membuktikan pengiriman. Tidak ada pesan sungguhan dikirim dalam pekerjaan ini.
- Semua rating tetap boleh menuju Google; jangan menjual penyaringan hanya rating positif.
