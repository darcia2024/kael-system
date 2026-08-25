# 02 · KAEL Finance

**Rp 249.000** sekali bayar, termasuk 1 tahun. Perpanjangan **Rp 99.000/tahun**.

Nama internal di PRD: KAEL HPP & Finance. Nama publik: KAEL Finance.

Modul kedua. Tidak menyentuh data pelanggan sama sekali, jadi tidak ada beban
perlindungan data. Kerumitannya murni di perhitungan.

---

## 1. Janji yang sudah tercetak di halaman harga

- Kalkulator HPP per produk (bahan baku, qty, unit gr/ml/pcs)
- Packaging cost, biaya operasional, dan jumlah hasil produksi
- HPP per unit, harga jual, profit per unit, margin dan markup
- Target profit simulation dan rekomendasi harga jual
- Kalkulasi resep olahan sendiri dan produk kulakan/reseller
- Bonus: tim KAEL bantu input maks 10 produk pertama

Catat baris terakhir. Itu tenaga manusia, sekitar satu sampai dua jam per
pembeli. Semakin gampang layar input massalnya, semakin murah janji itu.

PRD bagian 11 juga menyebut **Basic Finance**: pemasukan, pengeluaran,
kategori, laba harian, laba bulanan, target omzet, laporan keuangan. Itu
**tidak** ada di daftar janji halaman harga. Lihat bagian 7.

---

## 2. Pengguna

| Peran | Yang dilakukan |
| --- | --- |
| Owner | Semua. Ini modul milik owner sepenuhnya |
| Staff | Tidak punya akses. Harga modal dan margin bukan urusan kasir |
| Tim KAEL | Input 10 produk pertama saat onboarding |

Modul ini satu-satunya yang tidak punya layar untuk staf. Justru bagus:
membatasi siapa yang bisa melihat margin adalah fitur, bukan kekurangan.

---

## 3. Alur inti

### 3.1 Hitung HPP satu produk

```
Buat produk  ->  isi bahan baku  ->  isi kemasan  ->  isi biaya operasional
   ->  isi jumlah hasil produksi
   ->  sistem hitung HPP per unit
   ->  owner isi harga jual
   ->  sistem tampilkan profit, margin, markup
```

### 3.2 Cari harga jual dari target laba

```
Owner isi target profit per unit atau target margin
   ->  sistem hitung rekomendasi harga jual
   ->  owner bandingkan dengan harga pasar
   ->  simpan
```

### 3.3 Harga bahan naik

```
Owner ubah harga satu bahan di daftar bahan
   ->  semua resep yang memakai bahan itu ikut berubah
   ->  sistem tandai produk yang marginnya jadi di bawah target
```

Alur ketiga ini yang bikin modul ini bernilai berulang, bukan sekali pakai.
Tanpa itu, KAEL Finance cuma kalkulator sekali hitung yang tidak layak
diperpanjang Rp 99.000 tiap tahun. Lihat bagian 9.

---

## 4. Model data

### `ingredients`

Bahan baku, dipakai bersama lintas resep. **Ini yang membedakan produk asli
dari demo:** di demo, bahan diketik ulang di setiap resep.

| Kolom | Tipe | Catatan |
| --- | --- | --- |
| `id` | uuid | |
| `business_id` | uuid | |
| `name` | text | "Biji kopi house blend" |
| `pack_price` | bigint | Harga beli per kemasan, rupiah bulat |
| `pack_size` | numeric | Isi per kemasan |
| `base_unit` | text | `gr`, `ml`, `pcs` |
| `updated_at` | timestamptz | Kapan harga terakhir diubah |

### `ingredient_price_history`

| Kolom | Tipe | Catatan |
| --- | --- | --- |
| `ingredient_id` | uuid | |
| `pack_price` | bigint | |
| `changed_at` | timestamptz | |

Kecil, murah, dan menjawab pertanyaan yang pasti muncul: "kenapa HPP saya
naik?" Tanpa ini, tidak ada jawabannya.

### `recipes`

| Kolom | Tipe | Catatan |
| --- | --- | --- |
| `id` | uuid | |
| `business_id` | uuid | |
| `name` | text | |
| `type` | text | `olahan` (punya resep) atau `kulakan` (barang jadi) |
| `output_qty` | numeric | Sekali produksi jadi berapa porsi |
| `operational_cost` | bigint | Gas, listrik, tenaga, per sekali produksi |
| `selling_price` | bigint | |
| `target_margin_pct` | numeric | Opsional, untuk penanda margin turun |

### `recipe_ingredients`

| Kolom | Tipe | Catatan |
| --- | --- | --- |
| `recipe_id` | uuid | |
| `ingredient_id` | uuid | |
| `qty` | numeric | Jumlah terpakai, dalam `base_unit` bahan |

### `recipe_packaging`

| Kolom | Tipe | Catatan |
| --- | --- | --- |
| `recipe_id` | uuid | |
| `name` | text | "Gelas plastik 16oz + tutup" |
| `cost` | bigint | Per unit jadi, bukan per produksi |

Kemasan dipisah dari bahan karena hitungannya beda: bahan dibagi
`output_qty`, kemasan tidak. Satu resep menghasilkan 10 gelas berarti 10
kemasan, bukan 1 kemasan dibagi 10.

---

## 5. Mesin perhitungan

Ini inti modulnya. Tulis sebagai fungsi murni yang terpisah dari UI, dan beri
unit test. Semua nilai jual produk pembeli lo bergantung ke angka ini.

```
biaya_bahan     = SUM( (pack_price / pack_size) * qty )   untuk tiap bahan
biaya_kemasan   = SUM( cost )                              per unit jadi
total_modal     = biaya_bahan + operational_cost
hpp_per_unit    = (total_modal / output_qty) + biaya_kemasan

profit_per_unit = selling_price - hpp_per_unit
margin_pct      = (profit_per_unit / selling_price) * 100
markup_pct      = (profit_per_unit / hpp_per_unit) * 100

harga_dari_target_margin = hpp_per_unit / (1 - target_margin/100)
harga_dari_target_profit = hpp_per_unit + target_profit
```

Perhatikan posisi `biaya_kemasan`: **di luar pembagian `output_qty`**. Kemasan
melekat pada unit jadi, bukan pada batch produksi. Demo saat ini
menggabungkannya sebelum pembagian, dan itu membuat HPP terlalu rendah untuk
resep dengan output banyak.

### 5.1 Margin dan markup bukan hal yang sama

Owner akan menyamakan keduanya, lalu salah menetapkan harga. Modal Rp 10.000
dijual Rp 15.000 berarti markup 50 persen tapi margin 33 persen.

Tampilkan keduanya berdampingan dengan label yang jelas. Kalau harus memilih
satu untuk ditonjolkan, pilih margin, karena itu yang menghubungkan ke omzet.

### 5.2 Satuan

Demo punya kolom `unit` berisi gr, ml, pcs, kg, liter, tapi perhitungannya
tidak pernah mengonversi apa pun. Rumusnya cuma `pack_price / pack_size * qty`,
jadi satuannya sekadar label. Selama owner mengisi `pack_size` 1000 untuk 1 kg,
hasilnya kebetulan benar.

Begitu ada yang mengisi `pack_size` 1 dengan satuan `kg` lalu memakai 150
`gr`, hasilnya meleset 1000 kali lipat, dan tidak ada yang memberi peringatan.

Dua pilihan, pilih satu:

**A. Satuan dasar saja (disarankan untuk v1).** Hanya izinkan `gr`, `ml`, dan
`pcs`. Di layar input, tulis jelas "isi dalam gram" dengan contoh: "1 kg = 1000
gr". Sederhana, tidak bisa salah, dan cukup untuk semua kasus F&B.

**B. Konversi sungguhan.** Simpan faktor konversi per satuan, izinkan input
dalam kg atau liter, konversi ke satuan dasar saat menyimpan. Lebih ramah tapi
menambah kelas bug baru.

Jangan pilih C, yaitu keadaan sekarang: menampilkan pilihan satuan yang
sebenarnya tidak berpengaruh apa-apa. Itu lebih berbahaya daripada tidak ada
pilihan satuan sama sekali.

### 5.3 Pembulatan

Hitung dengan presisi penuh, bulatkan hanya saat ditampilkan. HPP per unit
ditampilkan ke rupiah terdekat. Jangan menyimpan hasil yang sudah dibulatkan
lalu memakainya untuk hitungan berikutnya.

Untuk rekomendasi harga jual, bulatkan **ke atas** ke Rp 500 terdekat. Tidak
ada warung yang menjual kopi Rp 18.347.

---

## 6. Layar

| Layar | Isi |
| --- | --- |
| Daftar produk | Nama, HPP, harga jual, margin. Tandai yang marginnya di bawah target |
| Editor resep | Bahan, kemasan, biaya operasional, output. Hasil hitung tampil langsung |
| Simulasi harga | Geser target margin atau target profit, lihat harga yang disarankan |
| Daftar bahan | Semua bahan, harga per satuan dasar, kapan terakhir diubah |
| Ubah harga bahan | Ubah satu harga, tampilkan resep mana saja yang terdampak |
| Impor massal | Untuk tim KAEL saat onboarding 10 produk |

Editor resep harus menghitung ulang setiap ketikan tanpa tombol simpan. Momen
yang menjual modul ini adalah saat owner mengubah satu angka dan melihat
marginnya bergerak.

---

## 7. Batas v1

**Masuk:** semua yang ada di daftar janji halaman harga, ditambah bahan
bersama, riwayat harga bahan, dan penanda margin turun.

**Ditunda:** Basic Finance dari PRD bagian 11, yaitu pemasukan, pengeluaran,
kategori, laba harian dan bulanan, target omzet, laporan keuangan.

Alasannya: pencatatan pemasukan dan pengeluaran harian hanya berguna kalau
diisi tiap hari, dan input manual tiap hari hampir pasti ditinggalkan dalam dua
minggu. Data itu jauh lebih baik datang otomatis dari **KAEL POS**. Membangunnya
sekarang sebagai input manual berarti membangun sesuatu yang akan dibuang saat
POS jadi.

Kalau tetap ingin ada di v1, batasi pada pencatatan pengeluaran saja, karena
pemasukan nanti datang dari POS.

**Tidak dibangun:** pajak, pembukuan berpasangan, integrasi akuntansi. Ini alat
penetapan harga, bukan software akuntansi. Batas itu perlu dijaga, kalau tidak
modulnya membengkak tanpa batas.

---

## 8. Ketergantungan

Butuh dari fondasi: `businesses`, `users`, auth owner. Itu saja.

Modul paling mandiri setelah Review. Bahkan bisa jalan tanpa koneksi terus
menerus, karena semua perhitungan terjadi di sisi klien.

Yang nanti membutuhkannya: **KAEL POS**, untuk menampilkan margin per penjualan
dan laba kotor harian. Sambungannya lewat pemetaan `recipes.id` ke item menu
POS. Rancang tabel resep dengan asumsi itu akan terjadi, tapi jangan bangun
pemetaannya sekarang.

---

## 9. Risiko

**Ini alat sekali pakai kalau tidak dirancang benar.** Owner menghitung 15
produknya di minggu pertama, lalu tidak membuka lagi. Tahun kedua dia tidak
memperpanjang Rp 99.000 karena merasa sudah selesai memakainya.

Satu-satunya penawar: bikin harga bahan jadi hal yang hidup. Harga bahan di
Indonesia berubah terus, dan tiap perubahan menggeser margin di banyak produk
sekaligus. Kalau modul ini memberi tahu "harga telur naik, 6 produkmu sekarang
di bawah target margin", dia jadi alasan untuk dibuka tiap bulan. Kalau tidak,
dia cuma spreadsheet yang lebih mahal.

Bangun penanda margin turun di v1, bukan v2. Itu bukan fitur tambahan, itu yang
menentukan modul ini punya nilai berulang atau tidak.

**Owner tidak tahu biaya operasionalnya.** Ditanya "biaya operasional per
produksi berapa?", jawabannya "nggak tahu". Sediakan bantuan berupa contoh
angka per kategori usaha, dan izinkan diisi nol dengan peringatan bahwa HPP jadi
terlalu rendah. Kolom kosong yang bikin macet lebih buruk daripada perkiraan
kasar yang bisa diperbaiki.

**Angka yang salah lebih berbahaya daripada tidak ada angka.** Kalau owner
menetapkan harga jual berdasarkan HPP yang keliru karena bug satuan, dia rugi
tiap kali menjual, dan menyalahkan KAEL. Mesin perhitungan di bagian 5 wajib
punya unit test. Ini satu-satunya modul yang bugnya langsung bikin pembeli
kehilangan uang.
