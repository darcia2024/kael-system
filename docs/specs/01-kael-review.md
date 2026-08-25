# 01 · KAEL Review

**Rp 149.000** sekali bayar, termasuk 1 tahun. Perpanjangan **Rp 49.000/tahun**.

Modul pertama. Paling sederhana, dan sebagian besar mesinnya sudah dibangun di
[fondasi bersama](00-fondasi-bersama.md) bagian 1.5.

---

## 1. Janji yang sudah tercetak di halaman harga

Ini yang dibayar pembeli. Semuanya harus ada.

- 1x KAEL NFC Review Card / Standee + QR Code backup
- Direct link permanen ter-lock langsung ke Google Review
- Card ID, activation system, tap/scan counter
- Setup link Google Review dan desain kartu basic
- Dashboard monitoring basic
- Garansi fisik kartu 6 bulan untuk kerusakan produksi

Dua di antaranya bukan pekerjaan software: **desain kartu** dan **garansi
fisik**. Keduanya butuh proses manual dan stok. Hitung itu sebagai biaya per
penjualan, bukan sebagai fitur.

---

## 2. Pengguna

| Peran | Yang dilakukan |
| --- | --- |
| Pelanggan akhir | Tap kartu. Tidak login, tidak instal apa pun |
| Owner | Aktivasi kartu, ganti tujuan, lihat jumlah tap, suspend kartu hilang |
| Tim KAEL | Terbitkan kartu, cetak, bantu setup URL Google Review |

Pelanggan akhir adalah pengguna terpenting dan satu-satunya yang tidak punya
akun. Seluruh pengalamannya berlangsung kurang dari dua detik dan tidak boleh
menampilkan apa pun milik KAEL. Tap, lalu Google terbuka. Selesai.

---

## 3. Alur inti

### 3.1 Pelanggan memberi ulasan

```
Tap kartu di meja kasir
   -> r.kael.id/{card_code}
   -> catat tap
   -> 302 ke URL Google Review bisnis
   -> form ulasan Google terbuka di browser HP
```

Target waktu dari tap sampai Google terbuka: **di bawah 500 ms**. Endpoint
redirect tidak boleh menunggu proses pencatatan tap. Catat tap secara asinkron,
redirect duluan.

### 3.2 Owner mengaktifkan kartu

```
Kartu tiba -> tap -> halaman aktivasi -> masukkan PIN dari kemasan
   -> tempel URL Google Review, atau cari nama bisnis
   -> pratinjau: "Tujuan: Senja Coffee, Jl. Riau 42"
   -> konfirmasi -> kartu aktif
```

Bagian tersulit di sini bukan teknis, tapi **menemukan URL Google Review yang
benar**. Pemilik warung tidak tahu apa itu Place ID, dan URL yang mereka salin
dari aplikasi Maps biasanya link share biasa yang membuka halaman profil, bukan
form ulasan. Lihat bagian 6.1.

---

## 4. Model data

Selain `cards` dan `card_taps` di fondasi, modul ini butuh sedikit tambahan.

### Tambahan di `cards`

| Kolom | Tipe | Catatan |
| --- | --- | --- |
| `destination_url` | text | URL form ulasan Google, sudah tervalidasi |
| `label` | text | Nama yang diberi owner, misal "Meja kasir", "Meja 4" |

`label` penting begitu sebuah bisnis punya lebih dari satu kartu. Add-on
"Ekstra Kartu NFC Rp 69.000/pcs" berarti satu bisnis bisa punya sepuluh kartu,
dan dashboard yang menampilkan sepuluh baris tanpa nama tidak ada gunanya.

### `review_snapshots` (opsional, v1.1)

| Kolom | Tipe | Catatan |
| --- | --- | --- |
| `business_id` | uuid | |
| `captured_at` | date | |
| `rating` | numeric | Rating rata-rata saat itu |
| `review_count` | int | Jumlah ulasan saat itu |

Kalau ini ada, owner bisa melihat "ulasan naik dari 34 ke 61 sejak pasang
KAEL", dan itu satu-satunya angka yang membuat perpanjangan Rp 49.000 terasa
masuk akal. Tanpa ini, tahun kedua owner bertanya "saya bayar untuk apa?" dan
tidak ada jawabannya.

Datanya dari Google Places API. Ada biaya per panggilan, jadi ambil sekali
sehari per bisnis, bukan setiap kali dashboard dibuka.

---

## 5. Layar

| Layar | Untuk | Isi |
| --- | --- | --- |
| Redirect | Pelanggan | Tidak ada. Ini endpoint, bukan halaman |
| Aktivasi | Owner | Input PIN, input tujuan, pratinjau, konfirmasi |
| Kartu tidak aktif | Siapa pun | Pesan netral, tanpa detail bisnis |
| Dashboard | Owner | Daftar kartu, tap per kartu, total tap, grafik 30 hari |
| Detail kartu | Owner | Ganti tujuan, ganti label, suspend, riwayat tap |
| Panel admin | Tim KAEL | Terbitkan batch, cetak PIN, lihat status semua kartu |

Dashboard sengaja tipis. Yang dijual namanya "dashboard monitoring **basic**",
dan menambah grafik yang tidak dipakai hanya menambah permukaan yang bisa rusak.

---

## 6. Aturan bisnis dan kasus tepi

### 6.1 URL Google Review harus dibentuk, bukan disalin

Bentuk yang benar memakai endpoint `writereview` milik Google dengan parameter
`placeid`. Yang biasanya ditempel owner justru salah semua untuk keperluan ini:
link share dari aplikasi Maps, URL halaman profil, dan tautan `g.page`. Ketiganya
membuka halaman profil, bukan form ulasan.

Karena itu **jangan menerima URL mentah dari owner.** Sediakan pencarian nama
bisnis, panggil Google Places API untuk mendapat Place ID, susun URL-nya
sendiri, lalu tampilkan pratinjau nama dan alamat supaya owner bisa memastikan
bisnis yang benar yang terpilih.

Ini juga yang membuat janji "setup link Google Review" di halaman harga bisa
dikerjakan otomatis, bukan manual satu per satu oleh tim.

Simpan `google_place_id` di tabel `businesses`, bukan hanya URL jadinya. Kalau
format URL Google berubah, lo bisa menyusun ulang semuanya tanpa menghubungi
pembeli satu per satu.

### 6.2 Semua pelanggan diarahkan ke tempat yang sama

Kartu selalu mengarah langsung ke form ulasan Google, tanpa layar perantara yang
menanyakan penilaian lebih dulu.

Ini bukan sekadar pilihan desain. Menyaring pelanggan berdasarkan penilaian
sebelum mengarahkan mereka melanggar kebijakan Google, dan sanksinya jatuh ke
listing bisnis pembeli lo, bukan ke KAEL: ulasan bisa dihapus massal dan
profilnya bisa kena penalti. Lo akan merusak aset yang justru lo janjikan untuk
memperbaiki.

Halaman demo di `/demo/review` menampilkan pemilihan bintang sebagai ilustrasi
tampilan. Pastikan itu tetap jadi simulasi dan tidak pernah jadi perantara di
produk asli.

Kalau owner ingin menangkap masukan sebelum jadi ulasan buruk, jalan yang aman
adalah kartu terpisah bertuliskan "ada masukan?" yang mengarah ke form internal,
dipajang berdampingan, dan pelanggan memilih sendiri mau tap yang mana.

### 6.3 Jumlah tap bukan jumlah ulasan

Ini harus jelas di dashboard, karena kalau tidak, owner akan menghitung 200 tap
lalu bertanya kenapa ulasannya cuma nambah 12.

Yang bisa lo hitung: berapa kali kartu di-tap. Yang tidak bisa lo hitung: apakah
orangnya benar-benar mengirim ulasan, karena itu terjadi di dalam Google dan
tidak mengirim sinyal balik.

Beri label yang jujur di dashboard: **"Tap"**, bukan "Ulasan". Kalau
`review_snapshots` aktif, tampilkan jumlah ulasan Google sebagai angka
terpisah, bukan digabung.

### 6.4 Angka tap perlu dibersihkan

Tanpa pembersihan, angka tap mengembang dan kehilangan arti. Penyebabnya:
peramban yang memuat URL lebih dulu tanpa ada manusia yang menekan, satu orang
yang tap berkali-kali karena penasaran, dan kunjungan otomatis ke URL pendek.

Aturan minimum untuk angka yang **ditampilkan**:

- Tap berulang dari perangkat yang sama dalam 10 menit dihitung satu kali
- Kunjungan yang jelas otomatis tidak ikut dihitung
- Permintaan `HEAD` tidak ikut dihitung

Perlakuan redirect tetap sama untuk semua pengunjung. Yang dibersihkan hanya
angka di dashboard, bukan perilaku endpoint-nya.

Tetap simpan semua barisnya di `card_taps`. Kalau nanti aturan pembersihan
berubah, lo masih punya data mentahnya untuk dihitung ulang.

### 6.5 Kartu hilang atau dicuri

Owner bisa suspend dari dashboard. Kartu yang disuspend menampilkan halaman
netral, tanpa menyebut nama bisnis, karena kartu yang hilang bisa ada di tangan
siapa saja.

Kartu pengganti adalah `card_code` baru. Jangan pernah memakai ulang kode lama:
kartu fisik lamanya masih beredar di luar sana.

### 6.6 Bisnis pindah atau tutup

Owner ganti tujuan lewat dashboard, kartu fisiknya tetap sama. Ini justru
kelebihan utama dibanding QR statis yang dicetak permanen, dan layak jadi bahan
jualan. Pastikan redirect tetap 302 supaya perubahan langsung berlaku.

---

## 7. Batas v1

**Masuk:** redirect, aktivasi PIN, ganti tujuan, ganti label, suspend, hitung
tap dengan pembersihan, dashboard sederhana, panel admin penerbitan kartu,
pencarian bisnis via Places API.

**Ditunda:** `review_snapshots` dan grafik pertumbuhan ulasan (v1.1, tapi
kerjakan sebelum musim perpanjangan pertama), notifikasi WhatsApp saat ada
ulasan baru, dukungan platform selain Google.

**Tidak akan dibangun:** layar perantara yang menyaring pelanggan berdasarkan
penilaian, dalam bentuk apa pun. Lihat 6.2.

---

## 8. Ketergantungan

Butuh dari fondasi: `businesses`, `users`, `cards`, `card_taps`, endpoint
`r.kael.id`, auth owner.

Tidak butuh modul lain. Ini yang membuatnya cocok jadi yang pertama.

Yang nanti membutuhkannya: tidak ada. Review berdiri sendiri selamanya, dan itu
tidak apa-apa.

---

## 9. Risiko

**Nilai perpanjangan tipis.** Rp 49.000/tahun untuk sebuah redirect akan terasa
seperti biaya tanpa manfaat di tahun kedua. `review_snapshots` adalah jawaban
paling murah untuk ini: kalau owner bisa melihat ulasannya naik dari 34 ke 61,
Rp 49.000 jadi tidak ada artinya. Kerjakan sebelum pembeli pertama masuk tahun
kedua, bukan sesudah.

**Ketergantungan pada Google Places API.** Ada kuota dan ada biaya. Kalau
kuotanya habis, pencarian bisnis saat aktivasi berhenti bekerja. Sediakan jalan
mundur: kolom input Place ID manual, plus dokumentasi singkat cara
menemukannya.

**Persaingan harga.** Kartu NFC ulasan dijual di marketplace mulai puluhan ribu
rupiah. Yang lo jual seharga Rp 149.000 harus punya pembeda yang terlihat, dan
pembedanya adalah tujuan yang bisa diganti, penghitung tap, dan ada orang yang
bisa dihubungi. Pastikan tiga hal itu kelihatan di halaman produk, bukan cuma
ada di dalam sistem.

**Bagian fisik.** Stok kartu, pencetakan, pengiriman, dan garansi 6 bulan
adalah operasi barang, bukan software. Ini yang paling mungkin jadi hambatan
saat pesanan mulai banyak, dan tidak ada kode yang bisa memperbaikinya.
