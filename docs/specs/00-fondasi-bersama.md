# 00 · Fondasi Bersama

Bagian yang dipakai semua modul. Dibangun sekali, sebelum modul pertama.

Ukurannya kecil. Yang bikin dia penting bukan jumlah kodenya, tapi fakta bahwa
mengubahnya setelah tiga modul jalan berarti migrasi data di semua bisnis yang
sudah pakai.

---

## 1. Keputusan arsitektur

### 1.1 Satu database, banyak aplikasi

Modul dibangun sebagai aplikasi terpisah, tapi menulis ke **satu database yang
sama**. Bukan satu database per modul.

```
kael-review    ─┐
kael-finance   ─┤
kael-loyalty   ─┼──>  satu Postgres (Supabase)  <──  kael-account
kael-pos       ─┘
```

Alasannya ada di README: pelanggan, bisnis, dan kartu dipakai lintas modul.
Kalau databasenya terpisah, POS tidak bisa menambah poin ke pelanggan Loyalty
tanpa API antar-layanan, dan itu kerumitan yang tidak sepadan untuk skala UMKM.

Rekomendasi: **Supabase**. Postgres terkelola, auth bawaan, row level security
yang cocok untuk multi-tenant, dan gratis di tier awal. PRD bilang landing page
tidak butuh Supabase, dan itu benar. Modul aplikasi butuh.

### 1.2 Multi-tenant lewat `business_id`

Satu bisnis = satu tenant. **Setiap tabel yang menyimpan data milik bisnis
wajib punya kolom `business_id`,** tanpa kecuali, termasuk tabel yang hari ini
kelihatannya tidak perlu.

Aktifkan Row Level Security di semua tabel tersebut. Policy dasarnya: sebuah
baris hanya terlihat kalau `business_id` cocok dengan bisnis yang sedang aktif
di sesi pengguna. Ini bukan optimisasi, ini yang mencegah data toko A bocor ke
toko B karena satu query yang lupa filter.

### 1.3 Topologi domain

```
kael.id                 landing page (yang sekarang sudah live)
app.kael.id             login, pilih bisnis, pilih modul
app.kael.id/review      modul Review
app.kael.id/finance     modul Finance
app.kael.id/loyalty     modul Loyalty
app.kael.id/pos         modul POS
r.kael.id/{cardCode}    endpoint redirect kartu NFC (lihat 1.5)
m.kael.id/{token}       halaman pelanggan Loyalty
```

Kenapa satu domain aplikasi, bukan subdomain per modul: sesi login jadi satu.
Kalau `review.kael.id` dan `pos.kael.id` terpisah, owner harus login dua kali,
dan cookie tidak bisa dibagi tanpa konfigurasi lintas-subdomain yang merepotkan.

Endpoint redirect kartu sengaja dipisah ke domain pendek `r.kael.id` karena URL
itu dicetak di kartu fisik. Semakin pendek semakin kecil QR-nya dan semakin
rapi kalau perlu diketik manual.

### 1.4 Peran pengguna

Tiga peran, dan bedanya nyata:

| Peran | Siapa | Akses |
| --- | --- | --- |
| `owner` | Pemilik usaha | Semua modul yang aktif, semua laporan, pengaturan, kelola staf |
| `staff` | Kasir, barista, karyawan | Hanya layar operasional. Tidak bisa lihat laporan laba, tidak bisa ubah harga, tidak bisa hapus transaksi |
| `kael_admin` | Tim KAEL | Aktivasi kartu, bantu setup, lihat status. **Tidak** bisa lihat data penjualan dan data pelanggan |

Peran `staff` penting dan sering dilupakan. Untuk POS, Loyalty, dan nanti HR,
pengguna hariannya bukan owner, tapi karyawan yang gonta-ganti. Mereka butuh
layar yang sempit, tidak bisa merusak apa-apa, dan gampang dicabut aksesnya
saat resign.

**Login staf pakai PIN 6 digit, bukan email dan password.** Kasir tidak punya
email kantor, sering berbagi satu tablet, dan harus bisa ganti shift dalam lima
detik. Owner yang membuat akun staf dan menentukan PIN awal. Setiap tindakan
staf tetap tercatat atas nama akun staf itu, bukan atas nama "kasir".

Batasi PIN: 5 kali salah, kunci 15 menit. PIN disimpan sebagai hash, bukan
teks biasa.

### 1.5 Layanan kartu NFC dan QR

Dipakai Review (kartu ulasan), Loyalty (kartu member), dan nanti HR (absensi).
Dibangun sekali.

Satu kartu fisik punya satu `card_code` pendek yang tercetak di kartu dan
tertulis di chip NFC sebagai URL `https://r.kael.id/{card_code}`.

Aturan `card_code`:

- 8 karakter, huruf dan angka
- Buang karakter yang gampang tertukar: `0`, `O`, `1`, `I`, `l`
- Acak, bukan berurutan. Kode berurutan bikin orang bisa menebak kartu bisnis
  lain dan menghitung berapa kartu yang sudah lo jual
- Tercetak juga dalam bentuk teks di kartu, supaya kalau chip rusak, tim
  support masih bisa mengidentifikasi kartunya

Satu endpoint melayani semua jenis kartu:

```
GET r.kael.id/{card_code}
  ├─ kartu tidak ada         -> halaman "kartu tidak dikenali"
  ├─ kartu belum diaktivasi  -> halaman aktivasi (minta PIN)
  ├─ kartu disuspend         -> halaman "kartu tidak aktif"
  ├─ type = review           -> catat tap, 302 ke URL Google Review
  ├─ type = loyalty          -> catat tap, 302 ke halaman member
  └─ type = attendance       -> catat tap, proses absensi
```

Redirect harus **302 (sementara)**, bukan 301. Kalau 301, browser dan operator
seluler akan menyimpan tujuannya secara permanen, dan saat bisnis pindah lokasi
lalu mengganti URL Google Review-nya, pelanggan lama tetap diarahkan ke tujuan
lama. Ini kesalahan yang tidak bisa diperbaiki dari sisi lo.

### 1.6 Aktivasi kartu

Kartu dikirim dalam keadaan belum aktif. Pembeli mengaktifkan sendiri dengan
PIN yang disertakan di kemasan.

```
Tap kartu baru
   -> halaman aktivasi
   -> masukkan PIN aktivasi (6 digit, tercetak di kartu/kemasan)
   -> masukkan tujuan (URL Google Review, atau pilih bisnis untuk kartu member)
   -> kartu aktif
```

Kenapa perlu PIN: kartu dikirim lewat ekspedisi. Tanpa PIN, siapa pun yang
memegang paket di jalan bisa mengaktifkan dan mengarahkan kartu itu ke mana
saja. PIN dicetak di bagian yang hanya terlihat setelah kemasan dibuka.

---

## 2. Model data inti

Hanya tabel yang dipakai lintas modul. Tabel khusus modul ada di spec
masing-masing.

### `businesses`

| Kolom | Tipe | Catatan |
| --- | --- | --- |
| `id` | uuid | |
| `name` | text | Nama usaha |
| `category` | text | Coffee shop, barbershop, laundry, dst |
| `phone` | text | WhatsApp owner |
| `address` | text | |
| `google_place_id` | text | Dipakai Review untuk menyusun URL ulasan |
| `logo_url` | text | Dipakai di struk, kartu member, halaman menu |
| `brand_color` | text | Personalisasi yang sudah dijanjikan di paket Growth dan Ultimate |
| `timezone` | text | Default `Asia/Jakarta`. Menentukan batas "hari" di laporan |
| `created_at` | timestamptz | |

### `business_modules`

Menentukan modul mana yang aktif untuk sebuah bisnis. Inilah yang membuat
"Review ON, Loyalty ON, POS OFF" di PRD bagian 33 jadi nyata.

| Kolom | Tipe | Catatan |
| --- | --- | --- |
| `business_id` | uuid | |
| `module` | text | `review`, `finance`, `loyalty`, `pos` |
| `status` | text | `active`, `expired`, `suspended` |
| `activated_at` | date | |
| `expires_at` | date | Tanggal renewal. Lihat 2.1 |

### `users`

| Kolom | Tipe | Catatan |
| --- | --- | --- |
| `id` | uuid | |
| `business_id` | uuid | |
| `role` | text | `owner`, `staff`, `kael_admin` |
| `name` | text | |
| `email` | text | Diisi untuk owner. Kosong untuk staff |
| `pin_hash` | text | Diisi untuk staff. Kosong untuk owner |
| `is_active` | bool | Dimatikan saat karyawan resign, jangan dihapus |

Jangan hapus baris staf yang resign. Transaksi lama menunjuk ke `user_id`
mereka, dan menghapusnya membuat riwayat kehilangan jejak siapa yang melayani.

### `customers`

**Satu tabel untuk semua modul.** Loyalty yang mengisinya, POS yang membacanya.

| Kolom | Tipe | Catatan |
| --- | --- | --- |
| `id` | uuid | |
| `business_id` | uuid | |
| `phone` | text | Nomor WhatsApp, format `62...`. Kunci identitas |
| `name` | text | |
| `birthday` | date | Opsional. Dipakai reward ulang tahun |
| `consent_at` | timestamptz | Kapan pelanggan setuju datanya disimpan. Lihat bagian 3 |
| `created_at` | timestamptz | |

Unik pada `(business_id, phone)`. Pelanggan milik satu bisnis, bukan milik
KAEL. Dua bisnis boleh punya pelanggan dengan nomor yang sama, dan itu dua
baris berbeda yang tidak saling melihat.

### `cards`

| Kolom | Tipe | Catatan |
| --- | --- | --- |
| `id` | uuid | |
| `card_code` | text | Unik global. Tercetak di kartu |
| `business_id` | uuid | Null sampai kartu diaktivasi |
| `type` | text | `review`, `loyalty`, `attendance` |
| `status` | text | `unactivated`, `active`, `suspended` |
| `activation_pin_hash` | text | |
| `destination_url` | text | Untuk kartu review |
| `customer_id` | uuid | Untuk kartu member |
| `tap_count` | int | Dihitung dari `card_taps`, disimpan untuk tampilan cepat |
| `last_tapped_at` | timestamptz | |

### `card_taps`

| Kolom | Tipe | Catatan |
| --- | --- | --- |
| `id` | uuid | |
| `card_id` | uuid | |
| `tapped_at` | timestamptz | |
| `source` | text | `nfc` atau `qr`. Bedakan lewat query param di QR |
| `ip_hash` | text | Hash, bukan IP mentah. Untuk deteksi duplikat |
| `user_agent` | text | Untuk menyaring bot |

### 2.1 Renewal

`business_modules.expires_at` diisi satu tahun sejak aktivasi, sesuai yang
tertulis di halaman harga: "Sekali bayar, sudah termasuk 1 tahun cloud &
support", lalu perpanjangan per tahun.

Yang perlu dibangun sejak awal, walaupun baru terpakai tahun depan:

- Pengingat otomatis ke owner pada H-30, H-7, dan H-0
- Masa tenggang 14 hari setelah `expires_at`, sistem tetap jalan penuh
- Setelah tenggang habis: **jangan matikan datanya.** Untuk Review, kartu tetap
  redirect (ini janji ke pelanggan akhir, bukan ke owner). Untuk modul lain,
  kunci ke mode baca-saja: owner masih bisa lihat dan ekspor datanya, tapi
  tidak bisa menambah data baru sampai memperpanjang.

Mematikan total sistem kasir sebuah warung karena telat bayar Rp 199.000 adalah
cara tercepat kehilangan pelanggan sekaligus reputasi.

---

## 3. Kewajiban perlindungan data

Begitu KAEL Loyalty jalan, lo menyimpan nomor telepon dan nama orang yang bukan
pelanggan lo, melainkan pelanggan dari pelanggan lo. Di Indonesia ini diatur
UU No. 27 Tahun 2022 tentang Pelindungan Data Pribadi.

Yang perlu ada, dan lebih murah dibangun sekarang daripada ditambal nanti:

- **Persetujuan saat pendaftaran.** Satu kalimat di layar daftar member, plus
  kolom `consent_at` yang terisi. Bukan checkbox yang sudah tercentang.
- **Cara menghapus.** Pelanggan bisa minta datanya dihapus lewat owner. Butuh
  tombolnya, dan butuh keputusan apa yang terjadi ke riwayat poin (saran: nama
  dan nomor dihapus, baris transaksi tinggal sebagai anonim supaya laporan
  tidak berubah).
- **Batas akses tim KAEL.** Peran `kael_admin` tidak boleh melihat daftar
  pelanggan sebuah bisnis. Ini juga melindungi lo sendiri kalau ada sengketa.
- **Kebijakan privasi di kael.id.** Sekarang belum ada. Perlu ada sebelum modul
  Loyalty dijual, karena di situ lo menjelaskan data apa yang disimpan dan
  berapa lama.

Kalau lo hanya sempat mengerjakan satu, kerjakan yang persetujuan. Itu yang
paling sulit diperbaiki surut, karena tidak bisa meminta persetujuan untuk data
yang sudah terlanjur dikumpulkan tanpa persetujuan.

---

## 4. Hal teknis yang berulang di semua modul

**Uang disimpan sebagai integer rupiah, bukan desimal.** Rupiah tidak punya
sen. `bigint` berisi 149000, bukan `numeric` berisi 149000.00. Ini menghindari
seluruh kelas bug pembulatan di laporan.

**Semua waktu disimpan UTC, ditampilkan pakai `businesses.timezone`.** Laporan
harian sebuah warung berakhir jam 23:59 WIB, bukan jam 23:59 UTC. Salah di sini
bikin laporan penjualan tidak cocok dengan uang di laci, dan itu jenis keluhan
yang menghabiskan waktu support paling banyak.

**Tabel yang mencatat kejadian bersifat tambah-saja.** Poin, transaksi, dan tap
tidak pernah diperbarui atau dihapus. Kalau salah, buat baris koreksi. Alasannya
di [03-kael-loyalty.md](03-kael-loyalty.md), tapi berlaku umum.

**Setiap tindakan yang mengubah uang atau poin mencatat `user_id` pelakunya.**
Tanpa ini, sengketa antara owner dan kasir tidak bisa diselesaikan.

---

## 5. Yang perlu dibangun di fondasi ini

Daftar kerja konkret, sebelum modul pertama:

1. Proyek Supabase, skema untuk enam tabel di bagian 2
2. Row Level Security per `business_id` di semua tabel
3. Auth owner lewat email, auth staf lewat PIN
4. Halaman `app.kael.id` yang isinya: login, pilih bisnis, daftar modul aktif
5. Layanan kartu: generator `card_code`, endpoint `r.kael.id/{code}`, alur
   aktivasi, pencatat tap
6. Panel `kael_admin` sederhana untuk menerbitkan batch kartu dan melihat
   statusnya

Nomor 5 dan 6 sekaligus jadi setengah dari KAEL Review. Setelah fondasi ini
selesai, modul Review tinggal menambahkan dashboard untuk owner.
