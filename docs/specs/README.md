# Spesifikasi Modul KAEL

Dokumen ini memecah KAEL jadi modul yang bisa dibangun terpisah satu per satu.
Sumbernya dua: [PRD](../PRD.md) untuk arah produk, dan halaman harga yang sudah
live di `kael-system.vercel.app` untuk apa yang **sudah terlanjur dijanjikan ke
pembeli**. Kalau keduanya berbeda, yang menang adalah halaman harga, karena itu
yang dibaca dan dibayar orang.

## Urutan baca

| File | Isi |
| --- | --- |
| [00-fondasi-bersama.md](00-fondasi-bersama.md) | Keputusan yang harus diambil **sebelum** modul pertama ditulis |
| [01-kael-review.md](01-kael-review.md) | Rp 149.000 · renewal Rp 49.000/th |
| [02-kael-finance.md](02-kael-finance.md) | Rp 249.000 · renewal Rp 99.000/th |
| [03-kael-loyalty.md](03-kael-loyalty.md) | Rp 399.000 · renewal Rp 149.000/th |
| [04-kael-pos-ordering.md](04-kael-pos-ordering.md) | Rp 549.000 · renewal Rp 199.000/th |
| [05-modul-roadmap.md](05-modul-roadmap.md) | Booking, HR, Custom. Belum dijual, belum perlu dibangun |

## Baca ini dulu sebelum mulai

### 1. "Terpisah" bukan berarti "berdiri sendiri"

Empat modul yang dijual itu berbagi tiga hal yang sama: **identitas bisnis**,
**identitas pelanggan**, dan **sistem kartu NFC**. Kalau tiap modul bikin versi
sendiri-sendiri, integrasi di Phase 5 PRD bukan pekerjaan menyambung, tapi
pekerjaan menulis ulang tiga dari empat aplikasi.

Contoh konkretnya: KAEL Loyalty mendaftarkan pelanggan lewat nomor WhatsApp.
KAEL POS perlu mencari pelanggan itu saat kasir menambah poin di akhir
transaksi. Kalau Loyalty punya tabel `customers` sendiri dan POS punya tabel
`customers` sendiri, satu pelanggan jadi dua baris di dua database, dan
tidak ada cara menyatukannya tanpa migrasi manual per bisnis.

Hal yang sama berlaku untuk kartu NFC. Review pakai kartu NFC, Loyalty pakai
kartu NFC, dan HR nanti pakai kartu NFC untuk absensi. Ketiganya butuh: ID
kartu, PIN aktivasi, status aktif/suspend, penghitung tap, dan tujuan
redirect. Itu satu layanan, bukan tiga.

**Maka: kerjakan [00-fondasi-bersama.md](00-fondasi-bersama.md) lebih dulu.**
Isinya kecil, mungkin dua sampai tiga hari kerja, dan itu yang menentukan
apakah modul kelima nanti butuh seminggu atau sebulan.

### 2. Urutan build yang disarankan

```
Fondasi bersama
      |
      v
KAEL Review  ->  KAEL Finance  ->  KAEL Loyalty  ->  KAEL POS & Ordering
   (paling      (tanpa data       (mulai pegang      (paling berat,
    sederhana)   pelanggan)        data pribadi)      paling banyak
                                                      support)
```

Urutan ini naik sesuai kerumitan dan sesuai risiko. Review hampir tidak punya
state. Finance punya perhitungan rumit tapi datanya milik satu owner dan tidak
menyentuh pelanggan. Loyalty mulai menyimpan nomor telepon orang lain, jadi
kena kewajiban perlindungan data. POS menyentuh uang dan berjalan saat toko
ramai, jadi setiap bug jadi telepon darurat.

Urutan ini juga cocok dengan paket yang lo jual: Growth butuh Review + Finance
+ Loyalty, Ultimate menambah POS. Jadi menyelesaikan tiga modul pertama sudah
memenuhi dua dari tiga paket.

### 3. Risiko pengiriman yang perlu diputuskan sekarang

Halaman harga lo tidak punya penanda ketersediaan sama sekali. Tidak ada
"segera hadir", tidak ada "pre-order", tidak ada tanggal. Artinya secara
tampilan, keempat modul dijual sebagai barang siap pakai hari ini, termasuk
KAEL POS seharga Rp 549.000 dan paket Ultimate seharga Rp 999.000.

Kalau hari ini ada yang beli Ultimate, lo terikat mengirim POS yang belum ada.

Tiga pilihan, dan salah satunya harus dipilih sebelum promosi jalan:

1. **Tandai ketersediaan per modul di halaman harga.** Paling jujur, paling
   cepat, dan paling kecil kemungkinannya bikin komplain. Modul yang belum
   siap ditulis apa adanya.
2. **Jual sebagai pre-order dengan tanggal.** Boleh, asal tanggalnya nyata dan
   pembeli tahu sebelum bayar.
3. **Sementara jual Review dan Finance saja**, sisanya diturunkan dari halaman
   sampai siap.

Yang tidak boleh: membiarkan halaman apa adanya dan berharap tidak ada yang
beli POS duluan.

### 4. Satu masalah teknis yang harus diselesaikan sebelum jual printer lagi

Lo menjual add-on **Printer Thermal Bluetooth 58mm seharga Rp 349.000**, dan
KAEL POS dijanjikan "support printer thermal kompatibel melalui browser/device".

Mencetak ke printer Bluetooth dari browser memerlukan Web Bluetooth. Web
Bluetooth **tidak tersedia di Safari iOS maupun Chrome di iOS**. Artinya
pembeli yang kasirnya pakai iPhone atau iPad tidak akan bisa mencetak struk
sama sekali, padahal mereka sudah membeli printernya.

Detail dan jalan keluarnya ada di
[04-kael-pos-ordering.md](04-kael-pos-ordering.md), tapi keputusannya perlu
diambil sekarang karena menyangkut barang fisik yang sudah dipasang harganya.

## Format tiap spec

Tiap file modul isinya sama urutannya:

1. Status komersial, harga, dan daftar janji yang sudah tercetak di halaman
2. Pengguna dan peran
3. Alur inti
4. Model data
5. Layar yang dibutuhkan
6. Aturan bisnis dan kasus tepi
7. Batas v1, dan yang sengaja ditunda
8. Ketergantungan ke modul lain
9. Risiko

Bagian "janji yang sudah tercetak" penting. Itu bukan wishlist, itu daftar yang
kalau tidak ada di produk jadi selisih antara yang dibayar dan yang diterima.
