# Tutorial Operasional KAEL

Panduan ini mencakup master admin KAEL, owner tenant, dan staf. Gunakan hanya
akun sesuai perannya; akses owner dan staf tidak dapat menggantikan hak master
admin.

## Peta Akses

| Peran | URL masuk | Dipakai untuk |
| --- | --- | --- |
| Master admin KAEL | `/admin` | Tenant, owner, lisensi, kartu, health, audit, demo |
| Owner tenant | `/app/login` | Seluruh pengaturan dan operasi bisnisnya sendiri |
| Staf tenant | `/app/login` | POS, Loyalty, Review, atau absensi sesuai izin |

## Kredensial Master Admin

| Peran | Email | Kata sandi | URL |
| --- | --- | --- | --- |
| Master admin KAEL | `admin@kaels.id` | `KaelAdmin!2026` | `/admin` |

Setelah login pertama, ganti kata sandi master dan jangan membagikan akun ini
ke owner atau staf tenant. Aksi reset password owner serta perubahan status
demo selalu tercatat pada audit log.

## Kredensial Demo

Gunakan data ini hanya untuk tenant demo KAEL.

| Tenant | Kode toko | Login owner | Kata sandi | Fokus uji |
| --- | --- | --- | --- | --- |
| KAEL Cafe Demo | `KAELCAFE` | `owner@kaelcafe.invalid` | `KaelCafeDemo!2026` | POS, Ordering, Finance, Loyalty, Review |
| Barber Bro Heritage | `BARBER` | `owner@barberbro.id` | `KaelDemo!2026` | Booking, HR, POS, Loyalty, Review |
| Bakso & Mie Ayam Pak Min | `BAKSOMIN` | `owner@baksopakmin.id` | `KaelDemo!2026` | Tenant kosong, hanya untuk uji teknis |

Untuk demo kuliner pakai `KAELCAFE`. Isinya lengkap: 3 menu dengan resep,
member, reward, dan transaksi. `BAKSOMIN` cuma punya 1 menu tanpa resep,
member, atau reward, jadi layarnya akan kosong saat dipresentasikan.

Login staf: buka `/app/login`, masukkan kode toko, pilih nama staf, lalu pakai
PIN `246810`. Tenant demo berlaku 30 hari dan dapat dibuat ulang memakai
`node scripts/seed-demo-stores.mjs` dari folder `web`.

## 1. Mulai dari Beranda

1. Buka `/app/login`.
2. Masuk sebagai owner dengan email dan kata sandi.
3. Di Beranda, buka modul yang ingin dipakai.
4. Bila modul bertanda `Perlu disiapkan`, tekan `Siapkan` dan selesaikan data
   minimum yang diminta sebelum dipakai pelanggan atau staf.

## 2. Master Admin KAEL

### Menambah tenant baru

1. Masuk ke `/admin` memakai akun master admin.
2. Buka `Pelanggan KAEL` lalu tekan `Tambah Pelanggan`.
3. Isi nama usaha, kode toko, jenis usaha, kategori, kontak, dan alamat.
4. Isi nama owner, email owner, serta kata sandi awal owner.
5. Pilih modul yang dibeli dan tanggal jatuh tempo masing-masing modul.
6. Simpan. Owner masuk melalui `/app/login`; staf memakai kode toko yang
   baru dibuat.

### Mengatur tenant yang sudah ada

1. Dari `Pelanggan KAEL`, cari nama usaha.
2. Gunakan pengaturan modul untuk mengaktifkan, menangguhkan, memperpanjang,
   atau mengakhiri modul.
3. Gunakan `Pasang logo & warna` untuk menyiapkan identitas awal tenant.
4. Jika tenant belum memiliki akun owner, tekan pengaturan akun owner lalu
   buat email dan kata sandi awal.
5. Buka `Kartu` untuk menerbitkan, menonaktifkan, atau mereset kartu fisik.

### Memantau operasi tenant

1. Dari `Pelanggan KAEL`, tekan `Control` untuk membuka `/admin/control`.
2. Cari tenant melalui kolom pencarian.
3. Baca status stok minimum, order pending, DP booking pending, Google sync,
   WhatsApp, jumlah modul, dan staf.
4. Gunakan `Jadi demo` untuk membuat tenant uji dengan masa aktif 30 hari.
5. Gunakan `Promosi` untuk mengubah demo menjadi pelanggan tanpa membuat
   tenant baru.
6. Gunakan ikon kunci hanya saat owner benar-benar meminta reset password.
   Buat kata sandi sementara minimal 10 karakter dan sampaikan lewat kanal
   terpisah.
7. Periksa bagian `Audit terbaru` untuk memastikan perubahan dilakukan oleh
   admin atau sistem yang benar.

## 3. Pengaturan Tenant dan White Label

1. Buka `Pengaturan Usaha` dari Beranda.
2. Atur QRIS dan tarif pajak/service POS bila digunakan.
3. Buka `Brand, White Label & WhatsApp` lalu tekan `Atur Brand`.
4. Isi nama aplikasi publik, warna utama, dan domain milik tenant.
5. Simpan. Status domain menjadi `pending_dns` sampai DNS tenant diarahkan ke
   konfigurasi domain KAEL dan diverifikasi.
6. Untuk WhatsApp, pilih `Meta WhatsApp Cloud API` jika tenant mempunyai nomor
   sendiri. Isi nomor pengirim, Phone Number ID, dan nama secret token.
7. Simpan lalu aktifkan channel setelah secret sudah tersedia di environment
   produksi. Jangan memasukkan access token ke form atau database.

## 4. KAEL Review

1. Aktifkan kartu review dan isi tujuan Google Review pada kartu tersebut.
2. Buka `KAEL Review`.
3. Tekan `Sync Google` untuk menyimpan rating dan jumlah ulasan saat ini.
4. Lihat pertumbuhan 7 dan 30 hari pada panel snapshot Google.
5. Pada kartu review, tekan `Cetak`, isi judul dan pesan singkat, lalu pilih
   ukuran A6, A5, atau A4.
6. Tekan `Simpan`, lalu `Cetak`. QR di standee selalu mengarah ke kartu yang
   dipilih sehingga sumber tap tetap tercatat.
7. Periksa panel `Monitor Tap`. Lonjakan dari sumber yang sama akan ditandai
   untuk diperiksa, bukan dihitung sebagai bukti review Google.

## 5. KAEL POS dan Ordering

1. Buka `KAEL POS` dan pastikan kategori serta menu sudah tersedia.
2. Buka shift dengan modal awal sebelum menerima tunai.
3. Tambahkan menu ke keranjang, pilih layanan, pelanggan member bila ada, lalu
   pilih metode pembayaran.
4. Untuk QRIS/transfer, pesanan tetap pending sampai kasir mengonfirmasi uang
   masuk. Untuk tunai, sistem langsung menyimpan kembalian dan shift.
5. Selesaikan pesanan dapur dari antrean, lalu tutup shift dan masukkan uang
   fisik untuk melihat selisih kas.
6. Owner membuka `POS > Ordering` untuk mengatur buka/tutup pemesanan, minimum
   order, pickup, delivery, dan area berdasarkan kode pos.
7. Aturan minimum dan jam diperiksa di server ketika pelanggan mengirim
   pesanan QR, bukan hanya di layar.

## 6. KAEL Loyalty

1. Buka `KAEL Loyalty` dan buat program poin atau stamp.
2. Tentukan kurs poin, masa berlaku, referral, ulang tahun, tier, reward, dan
   voucher sesuai kebutuhan toko.
3. Gunakan nama unit yang mudah dipahami pelanggan, misalnya `Poin`, `Stamp`,
   atau `Kopi`.
4. Tentukan minimum belanja, metode pembulatan, dan batas unit per transaksi
   bila ingin mengendalikan biaya reward.
5. Daftarkan pelanggan dengan nomor WhatsApp mereka sendiri.
6. Saat transaksi POS lunas dan pelanggan dipilih, poin masuk otomatis.
7. Kasir dapat mencari member, memberi poin manual bila berizin, dan memakai
   kode reward. Owner memeriksa ledger, referral, tier, dan campaign.

## 7. KAEL Finance

1. Isi bahan dan resep untuk bisnis kuliner. Hubungkan menu POS ke resep.
2. Untuk retail atau jasa tanpa resep, hubungkan menu langsung ke item stok dan
   masukkan jumlah stok per penjualan atau biaya unit.
3. Catat pembelian stok. Sistem menyimpan rata-rata biaya dan stok berjalan.
4. Saat order lunas, stok menu yang sudah dipetakan berkurang otomatis.
5. Tambahkan supplier, lalu catat tagihan supplier dan pembayaran agar hutang
   usaha dapat dilihat.
6. Lakukan stock opname, submit hasil hitung, dan setujui sebagai owner. Hanya
   approval yang mengubah stok sistem.
7. Buka `Finance > Reports` untuk melihat laba-rugi, arus kas, neraca ringkas,
   serta hutang supplier periode 30 hari.
8. Tambahkan kategori pajak pada transaksi finance bila pencatatan pajak
   formal diperlukan.

## 8. KAEL Booking

1. Buka `KAEL Booking`.
2. Tambahkan layanan: nama, durasi, harga, DP, dan kapasitas.
3. Masukkan jadwal staf pada KAEL HR sebelum membuka slot agar owner dapat
   menilai kapasitas layanan dengan benar.
4. Booking baru akan muncul di kalender owner dengan status `pending_deposit`
   atau `confirmed`.
5. Setelah DP diterima, owner mengonfirmasi booking. Setelah layanan selesai,
   ubah ke `completed`. Tandai `no_show` jika pelanggan tidak hadir.
6. Reminder dibuat ke antrean WhatsApp 24 jam sebelum jadwal. Pastikan channel
   WhatsApp tenant sudah aktif sebelum mengandalkan pengiriman otomatis.

## 9. KAEL HR

1. Buat atau aktifkan akun staf dari pengelolaan staf owner.
2. Buka `KAEL HR`, pilih staf, isi jam mulai/selesai, peran, dan centang
   `Boleh buka shift POS` jika staf itu memang kasir pada jadwal tersebut.
3. Aktifkan aturan jadwal POS pada tenant jika semua pembukaan shift harus
   mengikuti jadwal.
4. Staf membuka `/app/hr/attendance`, mengambil selfie, mengambil lokasi, lalu
   menekan `Masuk` atau `Pulang`.
5. Kartu attendance dapat mengarahkan staf ke halaman absensi yang sama.
6. Owner memeriksa absensi dan jadwal dari dashboard HR.
7. Izin, cuti, lembur, payroll, approval, serta laporan kehadiran harus
   diaktifkan hanya setelah kebijakan internal usaha ditetapkan, agar nominal
   gaji dan aturan approval tidak dibuat tanpa dasar.

## 10. Urutan Setup Tenant Baru

1. Buat tenant dan owner.
2. Aktifkan modul yang dibeli.
3. Atur brand, QRIS, pajak, dan channel WhatsApp.
4. Isi menu, stok/resep, atau layanan booking.
5. Buat staf dan jadwal kerja.
6. Uji satu transaksi POS, satu pendaftaran member, satu tap review, dan satu
   absensi sebelum tenant digunakan pelanggan sebenarnya.

## 11. Skenario Uji Cepat dengan Akun Demo

### KAEL Cafe Demo

1. Masuk sebagai `owner@kaelcafe.invalid`.
2. Buka POS, pilih `Kopi Susu` (Rp25.000), buka shift, lalu buat satu transaksi
   tunai. Menu lain: `Americano` Rp20.000 dan `Croissant` Rp28.000.
3. Buka Loyalty, daftarkan satu member uji lewat
   `/loyalty/register?toko=KAELCAFE`, kemudian buat transaksi POS lagi dengan
   member tersebut untuk memeriksa poin otomatis. Kurs Rp10.000 = 1 poin, dan
   sudah ada reward `Minuman gratis (demo)` seharga 10 poin untuk dicoba tukar.
4. Buka Finance. Ketiga menu sudah punya resep, tetapi bahannya masih
   `Bahan contoh` dengan biaya operasional 0. Ganti dengan bahan sungguhan
   kalau HPP-nya mau ditunjukkan ke pemilik usaha.
5. Buka `/order/KAELCAFE/1` dari ponsel untuk mencoba pesan dari meja, lalu
   POS > Ordering untuk minimum order dan area delivery.

### Barber Bro Heritage

1. Masuk sebagai `owner@barberbro.id`.
2. Buka Booking dan periksa layanan `Potong Rambut`.
3. Buka HR dan periksa jadwal staf demo yang diberi hak buka shift POS.
4. Login staf memakai kode `BARBER`, pilih `Joko (Capster Senior)`, lalu PIN
   `246810`.
5. Buka `/app/hr/attendance`, ambil selfie serta lokasi, lalu catat masuk.
6. Kembali ke POS dan buka shift pada jadwal yang sedang aktif.
