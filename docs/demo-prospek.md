# Demo yang dipersonalisasi per calon pembeli

Cara menawarkan KAEL: sebelum mendatangi sebuah usaha, siapkan satu tenant
berisi nama, menu, harga, dan staf usaha itu sendiri. Yang ditunjukkan ke
pemiliknya adalah aplikasi yang sesungguhnya, sudah berisi barang dagangannya.

Bedanya dengan daftar fitur: pemilik UMKM tidak perlu membayangkan apa pun, dan
pertanyaan "berapa lama setupnya" hilang dengan sendirinya karena jawabannya
sudah ada di layar.

---

## Alur singkat

```text
1. Sebelum datang    seed-prospect.mjs      tenant demo atas nama mereka
2. Saat demo         tunjukkan aplikasinya  bukan slide, bukan tangkapan layar
3a. Kalau beli       promote-demo.mjs       tanda demo dilepas, modul diperpanjang
3b. Kalau tidak      cleanup-demos.mjs      hilang sendiri setelah masa berlakunya
```

Semua perintah dijalankan dari folder `web/`.

---

## 1. Menyiapkan tenant demo

Salin `scripts/prospects/contoh.json`, isi dengan data usaha yang dituju.

```bash
cp scripts/prospects/contoh.json scripts/prospects/nagura.json
```

Periksa dulu sebelum menyentuh basis data:

```bash
node scripts/seed-prospect.mjs scripts/prospects/nagura.json --periksa
```

Kalau sudah bersih, jalankan tanpa `--periksa`:

```bash
node scripts/seed-prospect.mjs scripts/prospects/nagura.json
```

Keluarannya memuat kode toko, kata sandi pemilik, dan tanggal kedaluwarsa.
Kata sandi hanya tampil sekali; yang tersimpan cuma hash-nya.

Berkas prospek berisi nama, alamat, dan nomor usaha yang **belum** jadi
pelanggan, jadi `scripts/prospects/*.json` sudah masuk `.gitignore`. Hanya
`contoh.json` yang ikut ke repositori.

### Isi berkas prospek

| Bagian | Wajib | Catatan |
| --- | --- | --- |
| `slug` | ya | Penentu identitas tenant. Menjalankan ulang dengan slug sama memperbarui tenant yang sama, tidak membuat tenant kedua. |
| `business.business_type` | ya | `kuliner`, `jasa`, atau `retail`. Menentukan modul mana yang ditawarkan di dasbor. |
| `business.store_code` | ya | 3-10 huruf/angka. Dipakai staf untuk masuk, dan muncul di URL menu QR. |
| `business.brand_color` | tidak | Hex. Dipakai di kotak identitas toko pada dasbor, layar login, menu QR, struk, dan kartu member. |
| `business.logo_url` | tidak | Harus https. Kalau kosong, dipakai inisial nama tokonya. Bisa diubah belakangan lewat panel admin. |
| `business.google_place_id` | tidak | Isi kalau modul `review` aktif. Lihat catatan di bawah. |
| `modules` | ya | Yang tersedia: `review`, `pos`, `loyalty`, `finance`. |
| `menu` | tidak | Hanya berguna kalau modul `pos` aktif. Ditulis ulang tiap kali skrip dijalankan. |
| `staff` | tidak | PIN 4-6 angka. Staf yang hilang dari berkas ikut hilang dari tenant. |
| `demo_days` | tidak | Bawaan 14 hari. |

### Yang tidak dibuat, dan itu disengaja

Skrip ini **tidak** membuat riwayat penjualan karangan. Layar laporan yang penuh
angka rekaan terbaca oleh pemilik usaha sebagai janji pendapatan, dan itu janji
yang tidak pernah dibuat siapa pun. Transaksi pertama sebaiknya dibuat di depan
orangnya, memakai kasirnya.

---

## 2. Yang paling berpengaruh saat demo

**Rating Google asli mereka.** Isi `google_place_id`, lalu di layar Review
ownernya bisa membuka halaman ulasan miliknya sendiri dari HP-nya dan
memverifikasi saat itu juga. Biayanya lima menit, dan efeknya lebih besar
daripada seluruh demo kasir.

**Menu dengan ejaan mereka sendiri.** "Es Kopi Susu Gula Aren" jangan dirapikan
jadi "Kopi Susu Aren".

**QR meja yang sudah dicetak.** Bawa kartu QR fisik atas nama mereka, taruh di
meja, minta ownernya memindai, pesanan masuk ke kasir di laptop, struk keluar.
Alurnya 60 detik dan tidak bisa ditandingi presentasi apa pun.

Periksa cepat sebelum berangkat: buka `/order/<KODETOKO>/1` dan pastikan menu
serta nama tokonya benar.

---

## 3a. Kalau jadi membeli

```bash
node scripts/promote-demo.mjs --kode=NAGURA
```

Melepas tanda demo dan memperpanjang semua modulnya satu tahun. Tambahkan
`--sampai=YYYY-MM-DD` untuk tanggal lain.

**Wajib dijalankan.** Tenant yang masih bertanda demo akan terjaring perkakas
pembersih, dan yang hilang adalah data pelanggan yang sudah membayar.

Setelah dipromosikan, `seed-prospect.mjs` menolak menimpa tenant itu.

## 3b. Kalau tidak jadi

Tidak perlu melakukan apa pun. Setelah masa berlakunya lewat, tenant terjaring
pembersih:

```bash
node scripts/cleanup-demos.mjs            # lihat saja, tidak menghapus
node scripts/cleanup-demos.mjs --hapus    # benar-benar menghapus
```

Tanpa `--hapus` tidak ada yang ditulis. Sasarannya selalu dibatasi
`is_demo = TRUE` di kuerinya, jadi pelanggan sungguhan tidak pernah ikut
terambil.

Pilihan lain:

```bash
node scripts/cleanup-demos.mjs --semua          # termasuk yang belum lewat
node scripts/cleanup-demos.mjs --kode=NAGURA    # satu tenant, meski belum lewat
```

Kartu NFC fisik tidak ikut dihapus. Kartu adalah inventaris KAEL, jadi kartu
yang sempat dipasang ke tenant demo dikembalikan ke stok dalam keadaan bersih:
status kembali `unactivated`, tujuan pengalihan dikosongkan, dan hitungan
tap-nya dinolkan.

---

## Membedakan demo dari pelanggan

Panel `/admin/businesses` menandai tenant demo dengan label
`demo · s/d <tanggal>` di sebelah namanya.

Di basis data, dua kolom di `businesses` yang menentukan:

- `is_demo` — satu-satunya penanda yang dipercaya perkakas pembersih.
- `demo_expires_at` — tanggal tenant boleh dihapus.

Keduanya diikat CHECK: demo **wajib** punya tanggal, pelanggan sungguhan
**wajib** tidak punya. Arah pertama menutup demo abadi, yang justru paling
mungkin dilupakan. Arah kedua menutup salah sasaran.

---

## Mengatur logo dan warna

Diatur tim KAEL, bukan pemilik usaha. Penyiapan tenant memang dikerjakan tim
KAEL sejak awal, mulai dari menu, staf, modul, sampai kode toko, dan identitas
visual bagian dari penyiapan yang sama. Pemilik usaha memakainya, tidak
mengaturnya.

Ada dua jalan, dan keduanya menulis ke kolom yang sama:

| Jalan | Kapan |
| --- | --- |
| Berkas prospek (`business.logo_url`, `business.brand_color`) | Saat menyiapkan demo sebelum berkunjung. |
| Panel `/admin/businesses` → **Pasang logo & warna** | Kapan saja setelahnya, termasuk untuk pelanggan yang didaftarkan langsung lewat panel. |

Formulir di panel admin menampilkan pratinjau memakai komponen yang sama dengan
halaman aslinya, jadi yang terlihat di situ persis yang akan dilihat pemilik
usaha dan pelanggannya.

### Batasnya

**Tautan logo harus https.** Peramban memblokir gambar http di halaman https
tanpa memberi tahu siapa pun, jadi logo http akan tampak tersimpan tapi tidak
pernah muncul di layar. Formulirnya menolak sejak awal.

**Belum ada tempat mengunggah berkas.** Logonya harus sudah online di suatu
tempat; isi dengan tautan gambar yang bisa diakses publik.

**Warna teks tidak bisa diatur.** Dipilih sistem antara tinta gelap dan putih
berdasarkan rasio kontras WCAG terhadap warna merek, jadi warna seterang apa pun
tetap terbaca.
