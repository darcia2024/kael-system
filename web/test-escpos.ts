/**
 * Uji perakit ESC/POS.
 *
 * Ada karena kesalahan di lapisan ini TIDAK terlihat di layar mana pun: header
 * raster yang keliru satu byte bikin printer menyembur karakter acak sepanjang
 * gulungan kertas, dan yang pertama tahu adalah kasir di depan antrean pembeli.
 *
 *     npx tsx test-escpos.ts
 */
import { raster, qrKeRaster, gabung, teks, barisKosong, INIT, POTONG } from "./src/lib/escpos";

let lulus = 0;
let gagal = 0;

function cek(nama: string, syarat: boolean, keterangan = "") {
  if (syarat) {
    lulus++;
    console.log(`  LULUS  ${nama}`);
  } else {
    gagal++;
    console.log(`  GAGAL  ${nama}${keterangan ? " — " + keterangan : ""}`);
  }
}

console.log("\n1. Header perintah raster GS v 0");
{
  // 16 titik lebar = 2 byte, 3 baris tinggi.
  const hasil = raster(16, 3, new Array(48).fill(false));
  cek("diawali GS v 0", hasil[0] === 0x1d && hasil[1] === 0x76 && hasil[2] === 0x30);
  cek("mode 0 (normal)", hasil[3] === 0x00);
  cek("lebar ditulis dalam BYTE, bukan titik", hasil[4] === 2 && hasil[5] === 0, `xL=${hasil[4]}`);
  cek("tinggi ditulis dalam titik", hasil[6] === 3 && hasil[7] === 0, `yL=${hasil[6]}`);
  cek("panjang data = lebarByte × tinggi", hasil.length === 8 + 2 * 3, `panjang=${hasil.length}`);
}

console.log("\n2. Urutan bit dalam byte");
{
  // Titik paling kiri harus jadi bit paling berarti (0x80).
  const titik = new Array(8).fill(false);
  titik[0] = true;
  const hasil = raster(8, 1, titik);
  cek("titik paling kiri = bit 0x80", hasil[8] === 0x80, `byte=0x${hasil[8].toString(16)}`);

  const titik2 = new Array(8).fill(false);
  titik2[7] = true;
  const hasil2 = raster(8, 1, titik2);
  cek("titik paling kanan = bit 0x01", hasil2[8] === 0x01, `byte=0x${hasil2[8].toString(16)}`);

  const semua = new Array(8).fill(true);
  cek("delapan titik hitam = 0xFF", raster(8, 1, semua)[8] === 0xff);
}

console.log("\n3. Lebar yang bukan kelipatan 8");
{
  // 12 titik harus dibulatkan jadi 2 byte, dan sisa bitnya kosong.
  const hasil = raster(12, 1, new Array(12).fill(true));
  cek("12 titik memakai 2 byte", hasil[4] === 2);
  cek("byte pertama penuh", hasil[8] === 0xff, `0x${hasil[8].toString(16)}`);
  cek("byte kedua cuma 4 bit teratas", hasil[9] === 0xf0, `0x${hasil[9].toString(16)}`);
}

console.log("\n4. Kode QR");
{
  const qr = qrKeRaster("https://kaels.site/m/contoh-token", 6);
  cek("QR berhasil dibuat", qr !== null);
  if (qr) {
    cek("diawali perintah raster", qr[0] === 0x1d && qr[1] === 0x76 && qr[2] === 0x30);

    const lebarByte = qr[4] + (qr[5] << 8);
    const tinggi = qr[6] + (qr[7] << 8);
    cek("panjang data cocok dengan headernya", qr.length === 8 + lebarByte * tinggi,
      `header bilang ${lebarByte}×${tinggi}, data ${qr.length - 8}`);

    // QR terkecil 21 modul + zona sunyi 2 di tiap sisi = 25 modul × 6 titik = 150.
    cek("ukurannya masuk akal untuk kertas 58mm (<= 384 titik)", lebarByte * 8 <= 384,
      `lebar ${lebarByte * 8} titik`);
    cek("QR berbentuk persegi", Math.abs(lebarByte * 8 - tinggi) < 8, `${lebarByte * 8} vs ${tinggi}`);

    // Isi yang lebih panjang harus menghasilkan QR yang lebih besar, bukan gagal.
    const panjang = qrKeRaster("https://kaels.site/loyalty/register?toko=MOCHIKAFE&ref=struk", 6);
    cek("isi lebih panjang tetap berhasil", panjang !== null);
  }
}

console.log("\n5. Perakitan struk utuh");
{
  const qr = qrKeRaster("https://kaels.site/m/abc", 6)!;
  const struk = gabung(INIT, teks("MOCHI CAFE\n"), qr, barisKosong(3), POTONG);

  cek("diawali ESC @ (init printer)", struk[0] === 0x1b && struk[1] === 0x40);
  cek("diakhiri GS V 0 (potong kertas)",
    struk[struk.length - 3] === 0x1d && struk[struk.length - 2] === 0x56 && struk[struk.length - 1] === 0x00);

  const total = INIT.length + teks("MOCHI CAFE\n").length + qr.length + 3 + POTONG.length;
  cek("tidak ada byte yang hilang saat digabung", struk.length === total, `${struk.length} vs ${total}`);
}

console.log(`\n=== ${lulus} LULUS, ${gagal} GAGAL ===\n`);
process.exit(gagal > 0 ? 1 : 0);
