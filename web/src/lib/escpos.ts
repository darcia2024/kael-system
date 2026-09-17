/**
 * Perakit perintah ESC/POS untuk printer thermal.
 *
 * Sebelum ini struk dikirim sebagai teks polos: satu string, satu TextEncoder,
 * selesai. Itu cukup untuk huruf, tapi logo dan kode QR bukan huruf — keduanya
 * gambar, dan printer thermal menerimanya sebagai rentetan titik hitam-putih
 * lewat perintah raster GS v 0.
 *
 * Jadi struk sekarang dirakit sebagai POTONGAN BYTE, bukan satu string. Teks
 * tetap teks, gambar jadi raster, dan urutannya disusun di satu tempat.
 *
 * Lebar kertas 58mm = 384 titik pada font standar (32 karakter). Itu ukuran
 * yang dipakai di seluruh berkas ini.
 */

/** Lebar cetak dalam titik untuk kertas 58mm. */
import qrcode from "qrcode-generator";

export const LEBAR_TITIK_58MM = 384;

const ESC = 0x1b;
const GS = 0x1d;

/** Menyiapkan printer ke keadaan awal. Selalu perintah pertama. */
export const INIT = new Uint8Array([ESC, 0x40]);

/** Rata kiri, tengah, kanan. */
export const rataKiri = () => new Uint8Array([ESC, 0x61, 0]);
export const rataTengah = () => new Uint8Array([ESC, 0x61, 1]);

/** Memotong kertas. */
export const POTONG = new Uint8Array([GS, 0x56, 0x00]);

/** Teks biasa menjadi byte. */
export function teks(isi: string): Uint8Array {
  return new TextEncoder().encode(isi);
}

/** Baris kosong sebanyak n. */
export function barisKosong(n: number): Uint8Array {
  return new Uint8Array(new Array(n).fill(0x0a));
}

/** Menyambung banyak potongan byte jadi satu kiriman. */
export function gabung(...bagian: Uint8Array[]): Uint8Array {
  const total = bagian.reduce((n, b) => n + b.length, 0);
  const hasil = new Uint8Array(total);
  let posisi = 0;
  for (const b of bagian) {
    hasil.set(b, posisi);
    posisi += b.length;
  }
  return hasil;
}

/**
 * Gambar hitam-putih menjadi perintah raster GS v 0.
 *
 * `titikHitam` panjangnya lebar × tinggi, satu nilai per titik: true berarti
 * dicetak hitam. Lebarnya dibulatkan ke atas ke kelipatan 8, karena printer
 * membaca datanya per byte — delapan titik sekaligus, bit paling kiri duluan.
 */
export function raster(lebar: number, tinggi: number, titikHitam: boolean[]): Uint8Array {
  const lebarByte = Math.ceil(lebar / 8);
  const data = new Uint8Array(lebarByte * tinggi);

  for (let y = 0; y < tinggi; y++) {
    for (let x = 0; x < lebar; x++) {
      if (!titikHitam[y * lebar + x]) continue;
      const indeks = y * lebarByte + (x >> 3);
      data[indeks] |= 0x80 >> (x & 7);
    }
  }

  const kepala = new Uint8Array([
    GS, 0x76, 0x30, 0x00,
    lebarByte & 0xff, (lebarByte >> 8) & 0xff,
    tinggi & 0xff, (tinggi >> 8) & 0xff,
  ]);
  return gabung(kepala, data);
}

/**
 * Logo toko menjadi raster, siap dicetak di kepala struk.
 *
 * Berjalan di peramban karena butuh canvas untuk membaca titik gambarnya.
 * Logo KAEL disimpan satu domain dengan aplikasinya (`/logo-mochi.png`), jadi
 * pembacaan titiknya tidak terhalang aturan lintas-domain. Logo dari domain
 * lain tetap dicoba dengan crossOrigin, dan kalau ditolak fungsinya menyerah
 * dengan tenang.
 *
 * Mengembalikan null kalau gagal — logo itu hiasan, dan hiasan tidak boleh
 * menggagalkan struk yang sedang ditunggu pembeli.
 */
export async function logoKeRaster(
  url: string,
  lebarMaksimal = 192,
  ambangTerang = 160,
): Promise<Uint8Array | null> {
  try {
    const gambar = await muatGambar(url);

    // Lebar dibulatkan ke kelipatan 8 supaya pas satu byte penuh.
    const skala = Math.min(1, lebarMaksimal / gambar.width);
    const lebar = Math.max(8, Math.floor((gambar.width * skala) / 8) * 8);
    const tinggi = Math.max(1, Math.round(gambar.height * (lebar / gambar.width)));

    const canvas = document.createElement("canvas");
    canvas.width = lebar;
    canvas.height = tinggi;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;

    // Latar putih dulu: logo PNG transparan kalau tidak dialasi akan terbaca
    // hitam pekat seluruhnya oleh ambang di bawah.
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, lebar, tinggi);
    ctx.drawImage(gambar, 0, 0, lebar, tinggi);

    const piksel = ctx.getImageData(0, 0, lebar, tinggi).data;
    const titikHitam: boolean[] = new Array(lebar * tinggi);
    for (let i = 0; i < lebar * tinggi; i++) {
      const r = piksel[i * 4];
      const g = piksel[i * 4 + 1];
      const b = piksel[i * 4 + 2];
      const a = piksel[i * 4 + 3];
      // Kecerahan menurut mata manusia, bukan rata-rata biasa.
      const terang = 0.299 * r + 0.587 * g + 0.114 * b;
      titikHitam[i] = a > 128 && terang < ambangTerang;
    }

    return raster(lebar, tinggi, titikHitam);
  } catch (error) {
    console.warn("[KAEL] logo tidak bisa dicetak, struk dilanjutkan tanpa logo", error);
    return null;
  }
}

function muatGambar(url: string): Promise<HTMLImageElement> {
  return new Promise((selesai, gagal) => {
    const gambar = new Image();
    gambar.crossOrigin = "anonymous";
    gambar.onload = () => selesai(gambar);
    gambar.onerror = () => gagal(new Error("Gambar tidak bisa dimuat: " + url));
    gambar.src = url;
  });
}

/**
 * Kode QR menjadi raster.
 *
 * Sengaja digambar sendiri, bukan memakai perintah QR bawaan printer (GS ( k).
 * Perintah bawaan lebih ringkas, tapi dukungannya berbeda-beda antar merek
 * printer murah — dan QR yang tidak tercetak di struk pelanggan tidak ada yang
 * mengabari, karena yang menyadarinya cuma pelanggan yang sudah pulang.
 * Raster dimengerti semua printer yang bisa mencetak gambar.
 */
export function qrKeRaster(isi: string, ukuranModul = 6): Uint8Array | null {
  try {
    // Tipe 0 berarti biarkan pustakanya memilih ukuran terkecil yang muat.
    // Koreksi "M" masih terbaca walau strukya terlipat atau sedikit luntur.
    const qr = qrcode(0, "M");
    qr.addData(isi);
    qr.make();

    const jumlahModul = qr.getModuleCount();
    const tepi = 2; // zona sunyi, tanpa ini pemindai sering gagal membaca
    const modulTotal = jumlahModul + tepi * 2;

    const lebarMentah = modulTotal * ukuranModul;
    const lebar = Math.ceil(lebarMentah / 8) * 8;
    const tinggi = lebarMentah;

    const titikHitam: boolean[] = new Array(lebar * tinggi).fill(false);
    for (let baris = 0; baris < jumlahModul; baris++) {
      for (let kolom = 0; kolom < jumlahModul; kolom++) {
        if (!qr.isDark(baris, kolom)) continue;
        const x0 = (kolom + tepi) * ukuranModul;
        const y0 = (baris + tepi) * ukuranModul;
        for (let dy = 0; dy < ukuranModul; dy++) {
          for (let dx = 0; dx < ukuranModul; dx++) {
            titikHitam[(y0 + dy) * lebar + (x0 + dx)] = true;
          }
        }
      }
    }

    return raster(lebar, tinggi, titikHitam);
  } catch (error) {
    console.warn("[KAEL] kode QR tidak bisa dicetak", error);
    return null;
  }
}
