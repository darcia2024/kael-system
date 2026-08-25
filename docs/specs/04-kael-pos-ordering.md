# 04 · KAEL POS & Ordering

**Rp 549.000** sekali bayar, termasuk 1 tahun. Perpanjangan **Rp 199.000/tahun**.

Modul terakhir dan paling berat. Dia menyentuh uang, dipakai saat toko ramai,
dan setiap kesalahannya jadi telepon darurat, bukan tiket support.

Dua masalah di modul ini harus diputuskan **sebelum menulis kode**: pencetakan
struk (bagian 3) dan mode luring (bagian 4). Keduanya menentukan bentuk
aplikasinya, bukan sekadar isi fiturnya.

---

## 1. Janji yang sudah tercetak di halaman harga

- Kasir berbasis web: buka di laptop, tablet, dan HP
- Menu digital QR: dine-in / takeaway dan nomor meja
- Cart, catatan pesanan, cash / QRIS / transfer, diskon dan tax
- Digital receipt, order status, dan transaction history
- Laporan harian dan bulanan, produk terlaris, daily revenue
- Support printer thermal kompatibel melalui browser/device
- Bonus: tim KAEL bantu input maks 30 menu/produk

PRD bagian 13 menambah: service charge, refund, dan shift. Tiga itu tidak ada
di halaman harga, tapi dua di antaranya tetap wajib. Lihat bagian 7.

---

## 2. Pengguna

| Peran | Yang dilakukan |
| --- | --- |
| Pelanggan | Scan QR di meja, lihat menu, pesan, lihat status pesanan |
| Staff (kasir) | Terima pesanan, catat transaksi, terima bayaran, cetak struk |
| Owner | Kelola menu dan harga, lihat laporan, buka/tutup shift, proses refund |

Pemisahan staf dan owner di modul ini bukan formalitas. Kasir tidak boleh
mengubah harga, tidak boleh menghapus transaksi, dan tidak boleh melihat laba.
Kalau bisa, tiap sengketa uang di warung berakhir tanpa jejak.

---

## 3. Masalah pencetakan struk

**Ini harus diselesaikan sebelum menjual printer lagi.**

Lo menjual add-on **Printer Thermal Bluetooth 58mm Rp 349.000**, dan menjanjikan
POS "support printer thermal melalui browser/device". Lo juga menjanjikan kasir
"buka di laptop, tablet, dan HP".

Mencetak ke printer Bluetooth dari halaman web memerlukan **Web Bluetooth**.
Dukungannya begini:

| Perangkat | Web Bluetooth |
| --- | --- |
| Android + Chrome | Ya |
| Windows / macOS / ChromeOS + Chrome atau Edge | Ya |
| **iPhone / iPad, peramban apa pun** | **Tidak** |
| Firefox | Tidak, secara bawaan |

Semua peramban di iOS memakai mesin yang sama, jadi memasang Chrome di iPhone
tidak menolong. Artinya pembeli yang kasirnya memakai iPad, perangkat yang
sangat lazim di kafe, tidak akan bisa mencetak sama sekali walaupun sudah
membeli printernya seharga Rp 349.000.

Pilihan, dan salah satunya harus dipilih:

**A. Nyatakan Android dan desktop saja untuk pencetakan.** Paling jujur dan
tanpa biaya pembangunan. Tulis di halaman produk dan di deskripsi add-on
printer: "Pencetakan struk memerlukan perangkat Android atau komputer.
Perangkat iOS tetap bisa memakai kasir dan struk digital, tapi tidak bisa
mencetak lewat Bluetooth." Kasir tetap jalan penuh di iPad, hanya cetaknya yang
tidak.

**B. Bungkus jadi aplikasi Android.** Capacitor atau sejenisnya, dengan plugin
Bluetooth. Menyelesaikan Android dengan lebih rapi, tetap tidak menyelesaikan
iOS, dan menambah jalur rilis baru yang harus dirawat.

**C. Printer jaringan, bukan Bluetooth.** Printer thermal dengan WiFi menerima
perintah ESC/POS lewat jaringan. Peramban tidak bisa membuka soket mentah, jadi
tetap butuh perantara. Menaikkan harga perangkat keras dan menambah kerumitan
pengaturan jaringan di tempat pembeli.

**Rekomendasi: A untuk sekarang, B kalau permintaan iOS terbukti nyata.**
Pilihan A bisa dikerjakan hari ini dan cuma butuh mengubah beberapa kalimat.
Yang tidak boleh adalah membiarkan janji seperti sekarang lalu berhadapan
dengan pembeli iPad yang printernya tidak bisa dipakai.

Struk digital tetap jalan di semua perangkat: tampilkan sebagai halaman yang
bisa dibagikan lewat WhatsApp. Untuk sebagian besar UMKM ini malah lebih
berguna daripada kertas.

---

## 4. Masalah mode luring

Warung kehilangan koneksi. Itu bukan kemungkinan, itu kepastian. Kasir berbasis
web yang berhenti bekerja saat WiFi putus tidak bisa dipakai, dan pembeli akan
kembali ke buku tulis dalam seminggu.

Dua pilihan:

**A. Wajib daring, dinyatakan terang-terangan.** Murah dibangun. Tulis di
halaman produk bahwa POS memerlukan koneksi internet. Terima bahwa ini akan
jadi keluhan support nomor satu.

**B. Utamakan lokal.** Simpan menu dan transaksi di IndexedDB, tulis ke lokal
lebih dulu, lalu sinkronkan ke server saat koneksi kembali. Kasir tidak pernah
menunggu jaringan.

Untuk v1, **A dapat diterima asal dinyatakan jujur di halaman produk sebelum
orang membayar.** Tapi rancang basis datanya untuk B sejak sekarang, karena
menambahkannya belakangan berarti menulis ulang seluruh lapisan data.

Yang perlu disiapkan supaya B mungkin nanti:

- ID transaksi dibuat di sisi klien sebagai UUID, bukan nomor urut dari server.
  Nomor urut memerlukan server dan membuat mode luring mustahil
- Setiap transaksi punya `created_at` dari perangkat dan `synced_at` dari server
- Menu disimpan di klien dan hanya diambil ulang saat berubah

Kalau pilih A, minimum yang tetap harus ada: **peringatan koneksi terputus yang
jelas**, supaya kasir tahu transaksinya belum tersimpan dan tidak mengira sudah.

---

## 5. Model data

### `menu_items`

| Kolom | Tipe | Catatan |
| --- | --- | --- |
| `id` | uuid | |
| `business_id` | uuid | |
| `category_id` | uuid | |
| `name` | text | |
| `price` | bigint | Rupiah bulat |
| `photo_url` | text | Opsional |
| `is_available` | bool | Untuk "habis hari ini", tanpa menghapus item |
| `recipe_id` | uuid | Menyambung ke KAEL Finance. Null kalau tidak dipakai |
| `sort_order` | int | |

`is_available` dipakai jauh lebih sering daripada perkiraan. Menu habis adalah
kejadian harian, dan menghapus item bukan jalan keluarnya karena riwayat
transaksi menunjuk ke sana.

### `orders`

| Kolom | Tipe | Catatan |
| --- | --- | --- |
| `id` | uuid | Dibuat di klien |
| `business_id` | uuid | |
| `order_no` | text | Nomor tampilan harian, misal `A-014` |
| `channel` | text | `cashier`, `qr_dinein`, `qr_takeaway` |
| `table_no` | text | Untuk dine-in |
| `status` | text | `open`, `paid`, `cancelled`, `refunded` |
| `subtotal` | bigint | |
| `discount` | bigint | |
| `tax` | bigint | |
| `service_charge` | bigint | |
| `total` | bigint | |
| `payment_method` | text | `cash`, `qris`, `transfer` |
| `customer_id` | uuid | Untuk poin loyalty. Null kalau bukan member |
| `shift_id` | uuid | |
| `created_by` | uuid | Kasir |
| `created_at` | timestamptz | |

Simpan `subtotal`, `discount`, `tax`, dan `total` sebagai nilai jadi, bukan
dihitung ulang saat ditampilkan. Kalau tarif pajak berubah bulan depan, struk
bulan lalu harus tetap menunjukkan angka yang dulu benar-benar dibayar.

### `order_items`

| Kolom | Tipe | Catatan |
| --- | --- | --- |
| `order_id` | uuid | |
| `menu_item_id` | uuid | |
| `name_snapshot` | text | Nama saat transaksi terjadi |
| `price_snapshot` | bigint | Harga saat transaksi terjadi |
| `qty` | int | |
| `note` | text | "Es sedikit", "tanpa bawang" |

Kolom `_snapshot` bukan duplikasi berlebihan. Menu berganti nama dan harga naik.
Tanpa salinan, laporan tahun lalu berubah sendiri saat owner mengubah menu.

### `shifts`

| Kolom | Tipe | Catatan |
| --- | --- | --- |
| `id` | uuid | |
| `business_id` | uuid | |
| `opened_by` | uuid | |
| `opened_at` | timestamptz | |
| `opening_cash` | bigint | Modal awal laci |
| `closed_at` | timestamptz | |
| `closing_cash` | bigint | Uang fisik saat tutup |
| `expected_cash` | bigint | Dihitung sistem |
| `variance` | bigint | Selisih |

### `refunds`

| Kolom | Tipe | Catatan |
| --- | --- | --- |
| `order_id` | uuid | |
| `amount` | bigint | |
| `reason` | text | |
| `approved_by` | uuid | Owner. **Bukan** kasir |
| `created_at` | timestamptz | |

Transaksi tidak pernah dihapus. Pembatalan dan pengembalian dana adalah baris
baru yang menunjuk ke transaksi asli.

---

## 6. Layar

| Layar | Untuk | Catatan |
| --- | --- | --- |
| Kasir | Staff | Layar utama. Grid menu, keranjang, bayar |
| Menu QR | Pelanggan | Publik, per nomor meja |
| Status pesanan | Pelanggan | Setelah memesan lewat QR |
| Daftar pesanan | Staff | Pesanan masuk dari QR, tandai selesai |
| Struk digital | Pelanggan | Halaman yang bisa dibagikan lewat WhatsApp |
| Kelola menu | Owner | Kategori, harga, ketersediaan, foto |
| Laporan | Owner | Harian, bulanan, terlaris, per metode bayar |
| Shift | Staff dan owner | Buka, tutup, hitung laci |
| Impor massal | Tim KAEL | Untuk janji "bantu input 30 menu" |

### 6.1 Layar kasir

Ini layar yang dipakai ratusan kali sehari sambil berdiri. Aturannya:

- Sasaran sentuh minimal 44 piksel. Kasir memencet cepat, kadang sambil
  memegang barang
- Menu tampil sebagai grid, bukan daftar dengan pencarian. Kasir hafal posisi
- Keranjang selalu terlihat, tidak pernah tersembunyi di balik tab
- Tombol bayar tidak boleh bersebelahan dengan tombol hapus
- Satu langkah pembatalan untuk item terakhir, tanpa dialog

Jangan bangun pencarian sebagai cara utama memilih menu. Warung dengan 30 item
tidak butuh pencarian, butuh tombol besar.

---

## 7. Batas v1

**Masuk:** semua yang ada di daftar janji halaman harga, **ditambah shift dan
refund**.

Shift dan refund tidak ada di daftar janji, tapi keduanya wajib. Tanpa shift,
tidak ada cara mencocokkan uang di laci dengan catatan sistem, dan itu fungsi
paling dasar dari sebuah kasir. Tanpa refund, satu-satunya cara membatalkan
transaksi adalah menghapusnya, dan itu membuka lubang penyalahgunaan yang
persis ingin dicegah oleh sistem kasir.

**Ditunda:** kitchen display, integrasi pembayaran otomatis, manajemen stok,
multi cabang.

**QRIS harus dijelaskan apa adanya.** Yang lo jual sebagai add-on Rp 30.000
adalah **jasa pendampingan pendaftaran QRIS**, dan hasilnya QRIS statis: kode
dicetak, pelanggan memindai dan membayar, lalu kasir menandai transaksi sebagai
lunas secara manual. Sistem tidak tahu pembayarannya berhasil.

Itu wajar dan umum untuk UMKM, tapi harus tertulis. Kalau tidak, pembeli
mengira transaksi tercocokkan otomatis, lalu mengeluh saat menemukan kasir bisa
menandai lunas tanpa uang masuk.

---

## 8. Ketergantungan

Butuh dari fondasi: `businesses`, `users`, `customers`, auth owner dan PIN staf.

**Butuh KAEL Loyalty**, kalau modulnya aktif: saat pembayaran, kasir bisa
menempelkan pelanggan ke transaksi dan poin masuk otomatis. Panggil fungsi
penambahan poin yang sama dengan yang dipakai dashboard Loyalty, jangan tulis
ulang logikanya.

**Butuh KAEL Finance**, kalau modulnya aktif: `menu_items.recipe_id`
menyambungkan item menu ke resep, sehingga laporan bisa menampilkan laba kotor,
bukan cuma omzet. Ini sambungan yang mengubah laporan dari "hari ini masuk Rp 3
juta" jadi "hari ini untung Rp 1,1 juta", dan itu perbedaan yang dirasakan
owner.

Keduanya opsional. POS harus tetap jalan penuh walau dua modul itu mati.

---

## 9. Risiko

**Beban support tidak sebanding dengan harga perpanjangan.** Rp 199.000 per
tahun setara sekitar Rp 17.000 per bulan. Satu panggilan support 20 menit dalam
sebulan sudah menghabiskan seluruh marginnya, dan POS adalah modul yang paling
sering ditelepon karena rusaknya terjadi saat toko ramai.

Ini bukan alasan menaikkan harga sekarang, tapi alasan untuk **menguji ke 10
pembeli pertama sebelum mematok harga permanen**. Catat berapa jam support yang
terpakai per pembeli di tiga bulan pertama. Kalau lebih dari dua jam, harga
perpanjangannya tidak berkelanjutan.

**Modul ini menyentuh uang.** Bug di Review bikin angka tap salah. Bug di POS
bikin uang di laci tidak cocok dengan sistem, dan itu berubah jadi tuduhan ke
karyawan. Perhitungan total, diskon, pajak, dan kembalian wajib punya unit test.

**Jangan berlomba fitur dengan Majoo, Qasir, Olsera, dan Pawoon.** Mereka punya
tim, integrasi pembayaran, dan dukungan perangkat keras. Keunggulan KAEL bukan
kelengkapan, tapi sederhana, murah, dan tersambung ke tiga modul lain yang sudah
dipakai. Setiap fitur yang ditambahkan untuk menyamai mereka menggerus alasan
orang memilih lo.

**Ini modul yang paling mungkin tidak selesai.** Kalau harus berhenti di tiga
modul, itu bukan kegagalan. Review, Finance, dan Loyalty sudah memenuhi paket
Starter dan Growth. Yang tidak boleh adalah terus menjual Ultimate seharga
Rp 999.000 sementara POS-nya belum ada. Lihat
[README](README.md) bagian 3.
