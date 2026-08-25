# 03 · KAEL Loyalty

**Rp 399.000** sekali bayar, termasuk 1 tahun. Perpanjangan **Rp 149.000/tahun**.

Modul ketiga. Modul pertama yang menyimpan data pribadi orang lain, dan modul
pertama yang punya layar untuk staf. Dua hal itu yang bikin dia lebih berat
daripada dua modul sebelumnya, bukan jumlah fiturnya.

---

## 1. Janji yang sudah tercetak di halaman harga

- 1x KAEL NFC Member Card / Standee + QR membership
- Registrasi pelanggan via nomor WhatsApp dan customer database
- Sistem poin, sistem stamp, dan reward/voucher digital
- Point history, reward history, dan customer progress page
- Dashboard kasir: cari customer via No WA, tambah poin, dan redeem
- Bonus: setup loyalty program dan desain member poster

PRD bagian 10 menambah: membership tiers, point expiry opsional, birthday
reward. Tiga itu tidak ada di halaman harga. Lihat bagian 8.

---

## 2. Pengguna

| Peran | Yang dilakukan |
| --- | --- |
| Pelanggan | Daftar via nomor WA, tap kartu member, lihat progres poin, tukar reward |
| Staff (kasir) | Cari pelanggan, tambah poin, proses penukaran reward |
| Owner | Atur aturan poin dan reward, lihat daftar pelanggan, lihat laporan |

Kasir adalah pengguna dengan frekuensi tertinggi di modul ini. Dia memakainya
puluhan kali sehari, sambil antre, sambil pegang uang. Layarnya harus bisa
diselesaikan dalam **tiga ketukan atau kurang**, dan tidak boleh punya tombol
yang merusak apa pun kalau salah pencet.

---

## 3. Alur inti

### 3.1 Pelanggan mendaftar

```
Tap kartu member / scan QR di meja
   -> halaman pendaftaran
   -> isi nomor WhatsApp dan nama
   -> centang persetujuan penyimpanan data
   -> kartu terhubung ke pelanggan
   -> halaman progres poin terbuka
```

Minta sedikit mungkin. Nomor WhatsApp dan nama sudah cukup. Tanggal lahir
opsional, dan hanya kalau reward ulang tahun aktif.

### 3.2 Kasir menambah poin

```
Transaksi selesai
   -> kasir buka dashboard, ketik 4 digit terakhir nomor WA
   -> pilih pelanggan dari hasil
   -> masukkan nominal belanja
   -> poin bertambah, layar konfirmasi
```

Pencarian pakai 4 digit terakhir, bukan nomor lengkap. Pelanggan menyebut
"delapan tujuh tiga dua" jauh lebih cepat daripada mendikte 12 digit di depan
antrean.

### 3.3 Pelanggan menukar reward

```
Pelanggan tunjukkan halaman progres, atau tap kartu
   -> kasir lihat reward yang tersedia
   -> kasir pilih tukar
   -> sistem minta konfirmasi sekali
   -> poin terpotong, kode penukaran tercatat
```

Konfirmasi wajib ada. Penukaran memotong poin yang tidak bisa dikembalikan
tanpa koreksi manual, dan kasir bekerja cepat.

---

## 4. Model data

Pakai `customers` dari [fondasi bersama](00-fondasi-bersama.md). Jangan bikin
tabel pelanggan sendiri. KAEL POS akan membaca tabel yang sama.

### `loyalty_programs`

Satu program per bisnis untuk v1.

| Kolom | Tipe | Catatan |
| --- | --- | --- |
| `business_id` | uuid | |
| `mode` | text | `point` atau `stamp` |
| `earn_rate` | int | Mode poin: rupiah per 1 poin. Misal 10000 |
| `stamp_per_visit` | int | Mode stamp: stamp per kunjungan, biasanya 1 |
| `point_expiry_months` | int | Null berarti tidak kedaluwarsa |

Poin dan stamp adalah dua model yang berbeda, bukan dua fitur yang berjalan
bersamaan. Poin cocok untuk nilai belanja yang bervariasi (resto, retail).
Stamp cocok untuk barang seharga sama (kopi, cukur). Biarkan owner memilih
satu. Menjalankan keduanya sekaligus membingungkan pelanggan dan kasir.

### `point_ledger`

**Tambah-saja. Tidak pernah diubah, tidak pernah dihapus.**

| Kolom | Tipe | Catatan |
| --- | --- | --- |
| `id` | uuid | |
| `business_id` | uuid | |
| `customer_id` | uuid | |
| `delta` | int | Positif untuk perolehan, negatif untuk penukaran |
| `reason` | text | `purchase`, `redeem`, `birthday`, `manual`, `correction`, `expiry` |
| `note` | text | |
| `amount_spent` | bigint | Nominal belanja, kalau `reason = purchase` |
| `created_by` | uuid | `users.id` kasir. **Wajib** |
| `created_at` | timestamptz | |

Saldo poin adalah `SUM(delta)`, bukan kolom tersimpan.

Ini keputusan terpenting di modul ini. Kalau saldo disimpan sebagai satu angka
yang diperbarui terus, maka saat pelanggan bilang "poin saya harusnya 340 bukan
180", tidak ada cara menelusurinya. Dengan ledger, tiap perubahan punya waktu,
alasan, dan nama kasir yang melakukan.

Kalau `SUM` mulai lambat, tambahkan tabel ringkasan yang diperbarui lewat
trigger. Tapi ledger tetap jadi sumber kebenarannya, dan ringkasan harus bisa
dihitung ulang dari nol kapan saja.

### `rewards`

| Kolom | Tipe | Catatan |
| --- | --- | --- |
| `id` | uuid | |
| `business_id` | uuid | |
| `name` | text | "Kopi gratis 1 gelas" |
| `point_cost` | int | |
| `stock` | int | Null berarti tak terbatas |
| `is_active` | bool | |

### `redemptions`

| Kolom | Tipe | Catatan |
| --- | --- | --- |
| `id` | uuid | |
| `customer_id` | uuid | |
| `reward_id` | uuid | |
| `code` | text | Kode pendek untuk ditunjukkan ke kasir |
| `status` | text | `issued`, `used`, `expired` |
| `redeemed_by` | uuid | Kasir yang memproses |
| `created_at` | timestamptz | |

---

## 5. Layar

| Layar | Untuk | Catatan |
| --- | --- | --- |
| Pendaftaran | Pelanggan | Publik, tanpa login. Dari tap kartu atau QR |
| Progres poin | Pelanggan | Saldo, progres ke reward berikutnya, riwayat |
| Dashboard kasir | Staff | Cari, tambah poin, tukar. Tiga tombol besar |
| Daftar pelanggan | Owner | Cari, urutkan, ekspor |
| Detail pelanggan | Owner | Ledger lengkap, riwayat penukaran |
| Atur program | Owner | Mode, kurs poin, daftar reward |
| Laporan | Owner | Member baru, poin terbit, poin ditukar, pelanggan aktif |

### 5.1 Halaman pelanggan tanpa login

Halaman progres poin harus terbuka tanpa login. Meminta pelanggan bikin akun
untuk melihat poin kopinya akan membunuh angka pemakaian.

Jangan pernah memakai `customer_id` di URL. Itu bisa ditebak, dan siapa pun
bisa membaca data pelanggan lain.

Pakai token acak per pelanggan:

```
m.kael.id/{token}     token = 22 karakter acak, unik, tidak bisa ditebak
```

Token disimpan di chip kartu member. Kalau kartu hilang, owner menerbitkan
token baru dan yang lama mati.

Halaman itu hanya menampilkan: nama depan, saldo poin, progres reward, dan
riwayat. **Jangan tampilkan nomor telepon lengkap.** Kalau kartu hilang dan
ditemukan orang lain, jangan sampai kartu itu jadi sumber data pribadi.

---

## 6. Aturan bisnis dan kasus tepi

### 6.1 Kasir bisa curang, dan sistem harus mengasumsikan itu

Kasir yang bisa menambah poin bisa menambahkan poin ke nomornya sendiri. Ini
bukan tuduhan, ini pola yang selalu muncul di program loyalty mana pun.

Yang perlu ada:

- Setiap baris ledger mencatat `created_by`. Tidak ada pengecualian
- Laporan owner: poin yang diterbitkan per kasir per minggu
- Batas wajar per transaksi. Poin dari belanja Rp 10 juta di warung kopi perlu
  konfirmasi tambahan
- Penambahan poin manual tanpa nominal belanja ditandai terpisah dan
  ditampilkan menonjol di laporan

Ini tidak menghentikan kecurangan, tapi membuatnya terlihat. Itu sudah cukup.

### 6.2 Kedaluwarsa poin

Kalau `point_expiry_months` diisi, poin yang lewat masa berlaku jadi baris
ledger baru dengan `delta` negatif dan `reason = expiry`. Jangan pernah
menghapus baris lama.

Kirim pengingat ke pelanggan 30 hari sebelum poin hangus. Poin yang hangus
diam-diam adalah cara tercepat membuat pelanggan berhenti percaya program.

Untuk v1, sarankan owner membiarkannya kosong. Kedaluwarsa poin menguntungkan
bisnis besar dengan jutaan pelanggan pasif. Untuk warung dengan 200 pelanggan,
dia cuma bikin marah orang.

### 6.3 Nomor WhatsApp

Simpan dalam satu format: `62` diikuti nomor tanpa nol depan. Orang akan
mengetik `0813...`, `+62813...`, `62813...`, dan `0813-1150-6025`. Normalkan
saat menyimpan, bukan saat mencari.

Nomor yang sama boleh ada di dua bisnis berbeda. Itu dua pelanggan berbeda yang
tidak saling melihat. Jangan tergoda menyatukannya jadi "akun KAEL global"
sekarang, karena itu keputusan besar yang mengubah kepemilikan data.

### 6.4 Satu kartu, banyak pelanggan

Kartu member yang ditaruh di meja kasir akan di-tap banyak orang berbeda. Jadi
kartu tidak boleh terikat permanen ke satu `customer_id`.

Bedakan dua jenis:

- **Kartu meja** (`customer_id` kosong): tap membuka pendaftaran atau halaman
  cari, bukan halaman pelanggan tertentu
- **Kartu pribadi** (`customer_id` terisi): diberikan ke pelanggan, tap membuka
  halaman miliknya

Paket yang lo jual berisi "1x NFC Member Card / Standee", yaitu kartu meja.
Kartu pribadi masuk ke add-on ekstra kartu.

### 6.5 Koreksi

Kasir akan salah memasukkan nominal. Sediakan koreksi, bukan penghapusan:
tambah baris baru dengan `delta` berlawanan dan `reason = correction`, menunjuk
ke baris aslinya. Batasi hanya owner yang boleh, atau kasir dalam 5 menit
setelah transaksi.

---

## 7. Batas v1

**Masuk:** semua yang ada di daftar janji halaman harga. Mode poin dan stamp,
pendaftaran via WA, halaman pelanggan bertoken, dashboard kasir, ledger, reward
dan penukaran, laporan dasar.

**Ditunda:** membership tiers, reward ulang tahun, kedaluwarsa poin, notifikasi
WhatsApp otomatis.

Tiga yang pertama ada di PRD tapi tidak dijanjikan di halaman harga, jadi tidak
ada kewajiban. Tiers khususnya: untuk bisnis dengan 200 pelanggan, tiers cuma
menambah kerumitan tanpa menambah kunjungan.

**Notifikasi WhatsApp perlu perhatian khusus.** Mengirim pesan otomatis butuh
WhatsApp Business API resmi, yang berbayar per percakapan dan butuh verifikasi
bisnis. Memakai cara tidak resmi berisiko nomor pemblokiran. Kalau ini mau
dijual, hitung biayanya dulu, jangan janjikan sebelum itu.

---

## 8. Ketergantungan

Butuh dari fondasi: `businesses`, `users`, `customers`, `cards`, `card_taps`,
auth owner dan PIN staf.

Yang membutuhkannya nanti: **KAEL POS**. Saat transaksi selesai, POS memanggil
penambahan poin, sehingga kasir tidak perlu memasukkan nominal dua kali. Ini
sambungan integrasi paling bernilai di seluruh ekosistem, dan alasan kuat kenapa
`customers` harus satu tabel sejak awal.

Rancang penambahan poin sebagai satu fungsi yang dipanggil, bukan logika yang
tertanam di dalam layar kasir Loyalty. POS akan memanggil fungsi yang sama.

---

## 9. Risiko

**Data pribadi.** Ini modul pertama yang menyimpan nama dan nomor telepon orang
yang tidak punya hubungan apa pun dengan KAEL. UU PDP berlaku. Persetujuan saat
pendaftaran, cara menghapus, dan batas akses tim KAEL harus ada sejak hari
pertama, bukan ditambal saat ada yang bertanya. Detailnya di
[fondasi bersama](00-fondasi-bersama.md) bagian 3.

**Program yang dirancang buruk bikin owner rugi.** Owner akan menetapkan "tiap
Rp 10.000 dapat 1 poin, 10 poin gratis kopi Rp 25.000". Itu artinya memberi
diskon 25 persen, jauh di atas marginnya. Bantuan yang murah dan berdampak
besar: tampilkan estimasi biaya program saat owner mengatur reward, misalnya
"reward ini setara diskon 25% dari nilai belanja". Satu kalimat itu mencegah
banyak penyesalan.

**Adopsi kasir menentukan segalanya.** Kalau kasir malas menambah poin saat
antre panjang, seluruh modul mati. Ini bukan masalah fitur, ini masalah
kecepatan layar. Ukur waktu dari selesai transaksi sampai poin masuk, dan
targetkan di bawah 10 detik. Kalau lebih dari itu, sederhanakan sampai tercapai.

**Nilai perpanjangan lebih kuat daripada dua modul sebelumnya.** Data pelanggan
menumpuk, dan berhenti berlangganan berarti kehilangan akses ke daftar
pelanggan sendiri. Justru karena itu, aturan di fondasi bagian 2.1 penting:
setelah masa tenggang, kunci ke mode baca-saja dan tetap izinkan ekspor. Menahan
data pelanggan sebagai sandera akan menghasilkan cerita buruk yang menyebar
cepat di komunitas UMKM.
