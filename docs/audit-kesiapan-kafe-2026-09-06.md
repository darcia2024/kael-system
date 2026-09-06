# Audit kesiapan demo kafe KAEL - 6 September 2026

Tenant demo yang dipakai audit ini: **KAEL Cafe Demo (`KAELCAFE`)**.

Versi pertama audit ini menunjuk `BAKSOMIN` (Bakso & Mie Ayam Pak Min). Tenant itu ternyata hanya punya 1 menu dan nol resep, member, reward, serta kartu, jadi tidak bisa dipakai mendemokan apa pun selain halaman kosong. Seluruh dokumen dialihkan ke `KAELCAFE`, satu-satunya tenant yang datanya sudah cukup. `BAKSOMIN` dibiarkan apa adanya di database.

## Keputusan

Bisa dipresentasikan untuk penjajakan dan calon pilot dengan keterbatasan dijelaskan. Belum siap dijanjikan sebagai paket operasional lengkap.

Ketiga blocker P1 dari audit awal sudah hilang: dashboard owner tidak lagi error, poin dan stok sudah idempoten saat dicoba ulang, dan data demo kafe sudah terisi. Lima dari enam layanan kafe sudah bisa ditunjukkan hari ini.

Yang keenam tidak bisa: **penyaringan rating pada kartu NFC belum dibangun sama sekali**, dan sebagiannya memang tidak boleh dibangun seperti yang diminta. Ini bukan bug dan bukan pekerjaan setengah jadi; kodenya tidak ada. Jangan dijanjikan.

Audit ini membaca kode, memeriksa database produksi, mencoba halaman produksi kaels.site, serta menjalankan npm run check. Tidak mengirim WA/review Google dan tidak menguji printer fisik.

## Yang berubah sejak audit awal

| Temuan awal | Keadaan 6 September 2026 |
| --- | --- |
| Dashboard owner error 42803 | Diperbaiki. Query jam sekarang `GROUP BY 1`. Dijalankan ulang terhadap ke-10 usaha di database, tidak ada yang error lagi. Tampilan halamannya belum diklik satu per satu lewat UI. |
| Link pendaftaran member tanpa kode toko | Pakai `?toko=KAELCAFE`. Halaman terbuka di produksi dan sudah menampilkan logo serta warna toko. |
| Data demo kuliner kosong | `KAELCAFE` terisi: 3 menu, 3 resep, 3 bahan, 2 member, 1 reward, 2 transaksi lunas, 2 shift, 1 kartu. |
| Tampilan sama untuk semua tenant | Logo dan warna merek per usaha sudah tampil. Diverifikasi langsung di produksi pada `/order/KAELCAFE/1` dan `/loyalty/register?toko=KAELCAFE`. |
| Poin bisa hilang atau dobel saat retry | Diperbaiki. `earnPointsFromPurchase` sekarang menulis poin di dalam satu transaksi yang mengunci order (`FOR UPDATE`) dan berhenti kalau `loyalty_applied_at` sudah terisi. Percobaan ulang tidak menambah poin dua kali. |
| Stok parsial tidak bisa dipulihkan | Diperbaiki. `consumeInventoryForPaidOrder` memeriksa movement **per bahan**, bukan per order. Setelah bahan yang kurang direstock, percobaan ulang memproses bahan itu saja tanpa memotong ulang bahan yang sudah dipotong. |
| Kegagalan sinkronisasi tidak terlihat | Order yang belum sinkron muncul di dashboard owner beserta tombol proses ulang (`retryOrderSyncAction`). |
| Migrasi database | 30 dari 30 migrasi tercatat sudah diterapkan. |

## Temuan prioritas

1. **P1 - Penyaringan rating di kartu NFC belum ada.** Yang dijual sebagai "bintang 5 ke Google, bintang 1 ke WhatsApp" belum dibangun. Yang ada dua hal terpisah: kartu NFC membuka halaman Smart Touch berisi daftar tombol, dan formulir rating bintang ada di halaman struk `/receipt/[id]` yang baru muncul setelah pelanggan bertransaksi di kasir. Tidak ada percabangan berdasarkan bintang pada jalur kartu, dan tidak ada satu baris kode pun yang mengirim WhatsApp sendiri. Lihat bagian "Penyaringan rating" di bawah.
2. **P1 - Kartu demo `D9BLDK7H` cuma punya dua tombol.** Kartunya hidup: tap mendarat di `/touch/D9BLDK7H` berisi "Pesan dari meja 1" dan "Daftar member". Tombol Google Review tidak ada karena `google_place_id` tenant ini kosong, dan tombol WhatsApp juga tidak ada. Kalau kartunya mau ditunjukkan sebagai contoh kartu ulasan, isi dulu tombol Review lewat `/app/review` -> Smart Touch.
3. **P2 - Pemulihan sinkronisasi masih manual.** Pembayaran tetap disimpan lebih dulu, lalu `syncPaidOrder` menambahkan poin dan memotong stok terpisah. Bagian yang berbahaya sudah ditutup: keduanya idempoten dan kegagalannya tercatat di `sync_error` serta muncul di dashboard owner. Yang belum ada adalah worker terjadwal, jadi kalau owner tidak pernah menekan tombol proses ulang, order itu diam saja tanpa poin dan tanpa potongan stok.
4. **P2 - Refund tidak mengembalikan stok.** Ini keputusan yang disengaja: minuman yang sudah dibuat tidak otomatis bisa dijual lagi. Konsekuensinya koreksi stok setelah refund harus dilakukan manual berdasarkan barang yang benar-benar kembali.
5. **P2 - Resep demo belum realistis.** Ketiga resep punya `operational_cost` 0 dan satu bahan tunggal berlabel "Bahan contoh". Angka HPP-nya benar secara hitungan tetapi tidak menyerupai resep kafe sungguhan. Cukup untuk memperlihatkan cara kerjanya, kurang meyakinkan kalau pemilik usaha menanyakan detail.
6. **P2 - Member demo tidak punya nomor telepon asli.** Keduanya bernama "Pelanggan simulasi" dengan telepon `DEMO-<uuid>`. Pencarian member lewat nomor telepon di kasir tidak bisa didemokan dengan data ini; kartu membernya tetap bisa dibuka lewat token.
7. **P2 - Keluhan tidak memberi tahu siapa pun.** Rating dan komentar dari halaman struk tersimpan di `member_feedback` dan muncul di `/app/pos/reports`. Tidak ada notifikasi ke mana pun: tidak WA, tidak email, tidak push. Owner baru tahu ada bintang 1 kalau dia membuka laporan sendiri.
8. **Keterbatasan - printer.** Tersedia lewat browser print dan jalur Web Bluetooth untuk profil tertentu. Belum diuji pada printer fisik. Jangan menjanjikan semua printer Bluetooth/USB atau semua ponsel kompatibel.
9. **Keterbatasan - masa berlaku demo.** `KAELCAFE` dan keempat modulnya sama-sama kedaluwarsa **6 Oktober 2026**. Setelah tanggal itu demo berhenti bekerja tanpa peringatan di layar.

## Penyaringan rating

Fitur yang diminta: pelanggan tap kartu NFC, pilih bintang. Bintang 5 langsung ke Google Maps, bintang 1 diarahkan mengisi alasan lalu terkirim otomatis ke WhatsApp pemilik.

### Apa yang benar-benar ada

Dua hal terpisah, dan tidak satu pun menyambung jadi alur di atas.

**Kartu NFC** membuka `/touch/[code]`, sebuah halaman berisi daftar tombol: Google Review, WhatsApp, Menu, Jadi Member, Lokasi, Booking. Pelanggan memilih tombol. Tidak ada bintang, tidak ada percabangan.

**Formulir bintang** ada di halaman struk `/receipt/[id]`, yang butuh `orderId` — artinya baru muncul setelah pelanggan bertransaksi lewat kasir. Di situ bintang 1-3 memunculkan pilihan alasan dan kolom komentar. Hasilnya masuk ke tabel `member_feedback` dan tampil di `/app/pos/reports`.

### Apa yang tidak ada

- Tidak ada percabangan rating pada jalur kartu. Diperiksa: tidak ada kata "rating" di `src/app/r/` maupun `src/app/touch/`.
- **Tidak ada pengiriman WhatsApp otomatis, di mana pun di seluruh aplikasi.** Setiap `wa.me` di kode ini adalah tautan yang membuka aplikasi WhatsApp dengan teks yang sudah terisi. Manusia tetap harus menekan tombol Kirim.
- Halaman `/app/settings/brand` memang punya formulir Meta WhatsApp Cloud API (provider, Phone Number ID, nama secret). Formulir itu menyimpan pengaturan yang **tidak dibaca kode mana pun untuk mengirim**. Menyetel channel bukan bukti pesan terkirim.
- Bintang 1 tidak memberi tahu siapa pun. Owner baru tahu kalau membuka laporan sendiri.

### Bagian yang memang tidak boleh dibangun

Mengarahkan hanya bintang 4-5 ke Google dan menyaring sisanya adalah *selectively soliciting positive reviews*, yang dilarang kebijakan Google:
https://support.google.com/contributionpolicy/answer/7400114?hl=en

Risikonya jatuh ke pemilik kafe, bukan ke KAEL: ulasan bisa dihapus dan profil bisnisnya bisa kena tindakan. Menjualnya sebagai fitur berarti menjual sesuatu yang bisa merugikan pelanggan sendiri. Aplikasi ini dulu sempat begitu dan sudah sengaja diubah: sekarang tautan Google muncul untuk semua rating.

### Yang boleh dijanjikan

Versi yang sah dan tetap menjawab kekhawatiran pemilik kafe: **semua** pelanggan diberi dua pilihan sekaligus, "Tulis di Google" dan "Sampaikan ke kami saja". Yang kecewa hampir selalu memilih yang kedua karena lebih cepat dan tidak perlu akun. Efeknya mirip yang diinginkan tanpa menyaring siapa pun.

Untuk WhatsApp otomatis, sebut apa adanya: perlu integrasi provider (Meta Cloud API atau gateway), nomor bisnis terverifikasi, template pesan disetujui, dan biaya per percakapan. Sampai itu ada dan diuji, yang bisa dijanjikan cuma notifikasi di dalam aplikasi.

## Status per layanan

| Layanan | Bukti saat audit | Batas kesiapan |
| --- | --- | --- |
| POS | Halaman produksi terbuka. 3 menu terisi: Kopi Susu Rp25.000, Croissant Rp28.000, Americano Rp20.000. Ada 2 transaksi lunas dan 2 shift di database. Tes hitungan lulus. Refund parsial/penuh dan rekonsiliasi shift lulus di `scripts/test-cafe-integration.ts`. | Semua itu lewat skrip, belum lewat UI di perangkat sungguhan |
| Dashboard penjualan | Query jam sudah diperbaiki dan berjalan bersih terhadap ke-10 usaha. Refresh 60 detik. | Angka di layar belum dicocokkan dengan transaksi baru sesudah perbaikan |
| HPP | Finance produksi terbuka. 3 bahan dan 3 resep terpaut ke ketiga menu. Tes engine bahan, kemasan, margin, pembulatan lulus. | Resepnya masih "bahan contoh" tunggal dengan biaya operasional 0 |
| Ordering | `/order/KAELCAFE/1` terbuka dengan menu, logo, dan warna toko | Link tanpa nomor meja tidak membuka menu; checkout dan pelunasan belum diuji live |
| Membership | `/loyalty/register?toko=KAELCAFE` terbuka. Kurs Rp10.000 = 1 Poin. 2 member, 1 reward "Minuman gratis (demo)" seharga 10 poin, 2 baris point ledger. | Member demo tanpa nomor telepon asli; earn/redeem/refund belum diuji ujung ke ujung |
| NFC Smart Touch | Kartu `D9BLDK7H` aktif. `/r/D9BLDK7H` dites di produksi: mendarat di `/touch/D9BLDK7H` berisi nama toko, logo, warna, dan 2 tombol. Tap tercatat. | Belum ada tombol Google Review maupun WhatsApp di kartu demo ini |
| Penyaringan rating NFC | Tidak ada. Tidak ditemukan satu pun percabangan rating di `src/app/r/` maupun `src/app/touch/`, dan tidak ada satu pun pemanggilan API pengirim WhatsApp di seluruh `src/`. | **Belum dibangun.** Lihat bagian "Penyaringan rating" |
| Tampilan per usaha | Logo dan warna `#7b3f2e` tampil di halaman pesan dan halaman daftar member produksi | Logo demo masih gambar contoh, belum logo kafe sungguhan |

## Kredensial untuk pengujian

Login owner: https://kaels.site/app/login - pilih Owner.

- Email: `owner@kaelcafe.invalid`
- Password: `KaelCafeDemo!2026`
- Toko: `KAELCAFE`, KAEL Cafe Demo.
- Password dicocokkan langsung dengan hash di database: cocok.
- Demo dan seluruh modul (Finance, Loyalty, POS, Review) berlaku sampai **6 Oktober 2026**.

Kasir: halaman login yang sama - pilih Staf / PIN, isi `KAELCAFE`, pilih **Kasir Demo**.

- PIN: `246810`
- Aktif; PIN cocok dengan hash database. Login staf lewat UI belum diuji.

Master admin, hanya untuk tim internal: https://kaels.site/admin

- Email: `admin@kaels.id`
- Password: `KaelAdmin!2026`
- Akun aktif dan password cocok dengan hash database; login admin UI belum diuji.
- Jangan bagikan akun master ke calon pelanggan.

## Tautan cepat saat presentasi

| Yang ditunjukkan | Tautan |
| --- | --- |
| Pesan dari meja | https://kaels.site/order/KAELCAFE/1 |
| Daftar member | https://kaels.site/loyalty/register?toko=KAELCAFE |
| Login owner / kasir | https://kaels.site/app/login |
| Dashboard penjualan | https://kaels.site/app/pos/owner |
| HPP | https://kaels.site/app/finance |

## Urutan tes manual sebelum presentasi

Gunakan data uji dan nomor WA milik sendiri. Jangan mengirim ulasan uji ke Google atau pesan ke nomor contoh pada tenant.

1. Buka `/app/review` -> Smart Touch kartu `D9BLDK7H`. Tambahkan tombol Google Review dan WhatsApp kalau kartunya mau ditunjukkan sebagai kartu ulasan; sekarang isinya cuma tombol pesan dan daftar member. Tap sekali untuk memastikan tampilannya benar.
2. Login owner. Buka https://kaels.site/app/finance. Buka salah satu dari tiga resep yang sudah ada, ganti "Bahan contoh" dengan bahan sungguhan, tambahkan biaya operasional dan kemasan. Simpan, buka ulang, pastikan angkanya tetap.
3. Periksa ketiga menu POS sudah terpaut ke resepnya; di database ketiganya sudah. Tambah satu reward kedua kalau ingin mendemokan pilihan penukaran.
4. Buka https://kaels.site/loyalty/register?toko=KAELCAFE di ponsel pelanggan. Daftarkan member uji dengan nomor telepon sungguhan milik sendiri; ini sekaligus menutup kekurangan pada temuan P2 nomor 5. Pastikan muncul di dashboard dan kartu membernya bisa dibuka. Jangan bagikan token kartu pribadi.
5. Login kasir di perangkat lain. Buka shift dengan modal Rp100.000. Tambah Kopi Susu Rp25.000, pilih member uji, bayar tunai Rp50.000 tanpa diskon/pajak/service. Kembalian seharusnya Rp25.000. Dengan kurs Rp10.000, poin bertambah 2.
6. Buka https://kaels.site/app/pos/owner. Database sudah berisi 2 transaksi Rp25.000, jadi setelah langkah 5 omzet seharusnya Rp75.000 dengan 3 transaksi. Refresh otomatis 60 detik; pakai refresh manual saat demo.
7. Buka https://kaels.site/order/KAELCAFE/1 dari ponsel pelanggan. Pesan satu menu. Pastikan masuk ke kasir sebagai belum dibayar, konfirmasi setelah pembayaran uji, lalu ubah status sampai selesai. Jangan memakai pembayaran sungguhan untuk tes.
8. Tukar reward "Minuman gratis (demo)", refresh halaman, pastikan penukaran tidak terjadi dua kali. Uji refund dan periksa dampaknya pada kas, omzet, poin, serta stok. Catat selisihnya, jangan menganggap semuanya otomatis benar.
9. Cetak struk pada printer yang akan dibawa. Periksa lebar 58/80mm, nama menu, total, kembalian, potongan kertas, dan cetak ulang. Uji jalur browser print bila Bluetooth tidak cocok.
10. Tutup shift. Untuk hanya transaksi tunai pada langkah 5, kas fisik yang diharapkan Rp125.000. Sesuaikan bila ada transaksi atau refund lain.
11. Ganti logo demo dengan logo kafe calon pelanggan lewat panel admin sebelum berangkat. Logonya sekarang masih gambar contoh.

## Hasil pemeriksaan otomatis

`npm run check` lulus: lint src/lib, TypeScript, 4 tes Finance, 5 tes Loyalty, 4 tes POS, 5 tes sesi, dan production build.

Ini tidak membuktikan semua query database, alur UI, atau perangkat fisik berfungsi. Error dashboard pada audit awal tetap lolos build. Perbaikannya dibuktikan terpisah dengan menjalankan query yang sama terhadap ke-10 usaha di database, bukan dengan build yang lulus.

## Prioritas sebelum menerima penggunaan operasional

Lengkapi tombol kartu Smart Touch; ganti resep contoh dengan resep sungguhan; jalankan transaksi sampai refund dan tutup shift; uji printer serta NFC yang akan dipakai; siapkan worker retry terjadwal supaya pemulihan sinkronisasi tidak bergantung pada owner menekan tombol. Tawarkan pilot terkontrol setelah alur tersebut lulus.

Jangan menjanjikan mode offline, QRIS otomatis terverifikasi, WA otomatis, atau penyaringan review sebelum implementasi dan pengujiannya tersedia.
