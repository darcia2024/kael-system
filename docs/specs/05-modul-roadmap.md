# 05 · Modul Roadmap

Booking, HR, dan Custom. Ada di [PRD](../PRD.md), **tidak ada di halaman
harga**, dan tidak dijual. Jadi tidak ada janji yang harus dipenuhi dan tidak
ada alasan membangunnya sekarang.

File ini sengaja pendek. Isinya cukup untuk memutuskan kapan sebuah modul layak
naik jadi spec penuh, bukan untuk mulai membangun.

Aturan mainnya diambil dari PRD bagian 34: bangun karena bisnis membutuhkannya,
bukan karena fiturnya menarik. Terjemahan praktisnya di bawah.

---

## Kapan sebuah modul naik jadi spec penuh

Satu syarat, dan syaratnya tinggi:

> **Sepuluh pemilik bisnis berbeda menanyakannya tanpa dipancing, dalam kurun
> tiga bulan, dan setidaknya tiga di antaranya bersedia membayar di muka.**

Pertanyaan dari calon pembeli yang sudah lo tawari duluan tidak dihitung. Yang
dihitung adalah yang muncul sendiri di percakapan WhatsApp.

Untuk itu perlu satu hal yang sekarang belum ada: **catatan permintaan**. Tiap
kali ada yang bertanya "bisa sekalian booking nggak?", catat tanggal, jenis
usaha, dan kalimat persisnya. Tanpa catatan ini, keputusan modul berikutnya
akan diambil berdasarkan ingatan, dan ingatan condong ke permintaan yang paling
terakhir terdengar, bukan yang paling sering.

Satu spreadsheet sudah cukup. Kolomnya: tanggal, nama usaha, jenis usaha, yang
diminta, bersedia bayar di muka atau tidak.

---

## KAEL Booking

**Target:** barbershop, salon, klinik, konsultan, fotografi, rental.

**Kenapa mungkin naik duluan:** dari daftar jenis usaha yang lo sasar, empat di
antaranya adalah usaha berbasis janji temu. Barbershop dan salon sudah masuk
target utama sejak PRD, dan keduanya tidak butuh POS tapi butuh jadwal. Kalau
permintaan datang, kemungkinan besar dari sini.

**Kaitan dengan modul lain:** paling erat dengan Loyalty. Bisnis jasa mengenali
pelanggan tetap, dan tabel `customers` di fondasi sudah menyediakan dasarnya.
Booking pada dasarnya adalah jadwal yang menempel ke pelanggan yang sudah
dikenal.

**Yang bikin berat:** ketersediaan slot per staf. Satu barbershop dengan tiga
tukang cukur berarti tiga kalender yang berjalan bersamaan, dengan durasi
layanan yang berbeda-beda. Itu bukan CRUD, itu masalah penjadwalan, dan lebih
rumit daripada kelihatannya.

**Yang paling sering diminta tapi paling berisiko:** pengingat otomatis lewat
WhatsApp. Sama seperti di Loyalty, ini butuh WhatsApp Business API resmi yang
berbayar per percakapan. Hitung biayanya sebelum menjanjikan.

---

## KAEL HR

**Isi menurut PRD:** database karyawan, absensi NFC dan QR, shift, jadwal, cuti,
lembur, keterlambatan, gaji, bonus, potongan, payroll, slip gaji.

**Kenapa gue sarankan ditahan paling lama:** payroll menyentuh gaji orang.
Salah hitung berarti karyawan pembeli lo dibayar kurang, dan itu jenis kesalahan
yang tidak bisa ditebus dengan permintaan maaf. Selain itu ada lapisan aturan
ketenagakerjaan: perhitungan lembur, upah minimum, potongan BPJS, dan PPh 21.
Semuanya berubah dari waktu ke waktu dan berbeda per daerah.

**Jalan tengah kalau permintaan muncul:** pecah dua. Bangun bagian **absensi**
saja lebih dulu, yaitu tap NFC untuk masuk dan pulang, rekap jam kerja, dan
catatan keterlambatan. Itu memakai layanan kartu yang sudah ada di fondasi,
risikonya rendah, dan sudah menyelesaikan keluhan paling umum. Payroll
ditunda sampai benar-benar diminta, dan kalau dibangun, mulai dari perhitungan
jam kerja saja, bukan potongan pajak.

**Kaitan dengan fondasi:** `cards` dengan `type = attendance` sudah disiapkan.
Tabel `users` dengan peran `staff` juga sudah ada. Absensi hampir tidak
memerlukan tabel baru selain catatan masuk dan pulang.

---

## KAEL Custom

Ini **bukan produk**, ini jasa. Perlakukan berbeda dari empat modul lain.

PRD menyebut kemungkinan: inventory, CRM, reseller, rental, manajemen proyek,
sekolah, LMS, sistem persetujuan, portal pelanggan, franchise, multi cabang,
tiket, dashboard khusus, otomasi alur kerja.

**Yang perlu disadari:** ini pekerjaan agensi yang duduk di dalam merek produk.
Di tahap awal, kemungkinan besar ini sumber pemasukan terbesar lo, karena satu
proyek custom bisa bernilai berkali lipat penjualan modul. Itu wajar dan tidak
salah. Yang berbahaya adalah kalau dia diam-diam menghabiskan seluruh waktu
sehingga empat modul produknya tidak pernah selesai.

**Aturan yang gue sarankan:**

- Custom tidak punya harga tetap di halaman. Sekarang sudah benar, dia
  mengarah ke konsultasi WhatsApp
- Setiap proyek custom yang polanya berulang adalah kandidat modul produk.
  Kalau tiga pembeli meminta manajemen stok, itu bukan tiga proyek custom, itu
  satu KAEL Inventory yang belum lo sadari
- Batasi porsi waktu untuk custom. Kalau lebih dari separuh waktu habis di
  sana, roadmap produknya berhenti bergerak

**Yang paling mungkin jadi modul produk berikutnya dari jalur ini:**
inventory. Dia diminta hampir semua usaha retail dan F&B, dan menempel langsung
ke POS yang sudah direncanakan.

---

## Ringkasan urutan

```
Sudah dijual, harus dibangun:
  Review  ->  Finance  ->  Loyalty  ->  POS & Ordering

Menunggu bukti permintaan:
  Booking          (kandidat terkuat, karena target usaha jasa)
  HR / absensi     (mulai dari absensi saja, bukan payroll)
  Inventory        (belum ada di PRD, tapi paling sering diminta di kelasnya)

Ditahan lama:
  Payroll          (risiko hukum dan risiko salah hitung gaji)
```

Jangan menaikkan satu pun dari daftar tengah ke daftar atas sebelum keempat
modul yang sudah dijual benar-benar terkirim. Menjual sesuatu lalu membangun
hal lain adalah cara tercepat kehilangan pembeli pertama, dan pembeli pertama
adalah yang paling mahal didapat.
