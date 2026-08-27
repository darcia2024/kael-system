/**
 * Mesin QRIS: mengubah QRIS statis milik merchant menjadi QRIS dinamis yang
 * sudah membawa nominal belanja.
 *
 * KAEL tidak pernah menyentuh uangnya. Yang dilakukan berkas ini hanya
 * menggambar ulang QRIS milik merchant sendiri dengan satu tag tambahan berisi
 * nominal. Dana tetap mengalir langsung dari pelanggan ke rekening merchant
 * lewat penyelenggara yang menerbitkan QRIS itu. Karena KAEL tidak berada di
 * jalur dana, tidak ada kewajiban lisensi PJP Bank Indonesia di sini — dan
 * posisi itu harus dijaga: jangan pernah menambahkan tag yang mengubah tujuan
 * pembayaran.
 *
 * Formatnya EMVCo Merchant Presented Mode: rangkaian TLV (Tag-Length-Value),
 * masing-masing 2 digit tag, 2 digit panjang, lalu nilainya.
 *
 *   00 02 01          -> Payload Format Indicator
 *   01 02 11          -> Point of Initiation: 11 statis, 12 dinamis
 *   ...
 *   53 03 360         -> Mata uang, 360 = IDR
 *   54 05 47000       -> Nominal transaksi  <- yang kita sisipkan
 *   58 02 ID          -> Kode negara
 *   59 xx <nama>      -> Nama merchant
 *   60 xx <kota>      -> Kota merchant
 *   63 04 A1B2        -> CRC, WAJIB elemen terakhir
 *
 * Sengaja tanpa "server-only": nominal dihitung dan QR digambar di layar kasir,
 * jadi komponen klien harus bisa memakainya. Tidak ada rahasia di sini — isi
 * QRIS statis memang dicetak dan ditempel di meja untuk dilihat umum.
 */

// ===========================================================================
// CRC
// ===========================================================================

/**
 * CRC-16/CCITT-FALSE: polinomial 0x1021, nilai awal 0xFFFF, tanpa refleksi dan
 * tanpa XOR akhir. Ini varian yang ditetapkan spesifikasi EMVCo, dan varian
 * CRC-16 lain akan menghasilkan angka berbeda yang membuat QR ditolak aplikasi
 * pembayaran tanpa pesan yang jelas.
 */
export function crc16(input: string): string {
  let crc = 0xffff;
  for (let i = 0; i < input.length; i++) {
    crc ^= input.charCodeAt(i) << 8;
    for (let bit = 0; bit < 8; bit++) {
      crc = crc & 0x8000 ? ((crc << 1) ^ 0x1021) & 0xffff : (crc << 1) & 0xffff;
    }
  }
  return crc.toString(16).toUpperCase().padStart(4, "0");
}

// ===========================================================================
// Pembacaan TLV
// ===========================================================================

export interface TlvNode {
  tag: string;
  value: string;
}

/**
 * Memecah payload menjadi daftar TLV tingkat atas.
 *
 * Mengembalikan null kalau strukturnya rusak, bukan melempar: masukannya
 * berasal dari hasil pindai gambar yang diunggah manusia, jadi rusak itu
 * keadaan yang wajar dan harus bisa dijawab dengan kalimat, bukan layar galat.
 */
export function parseTlv(payload: string): TlvNode[] | null {
  const nodes: TlvNode[] = [];
  let i = 0;

  while (i < payload.length) {
    // Butuh minimal 4 karakter untuk tag + panjang.
    if (i + 4 > payload.length) return null;

    const tag = payload.slice(i, i + 2);
    const lenRaw = payload.slice(i + 2, i + 4);
    if (!/^\d{2}$/.test(tag) || !/^\d{2}$/.test(lenRaw)) return null;

    const len = parseInt(lenRaw, 10);
    const start = i + 4;
    const end = start + len;
    if (end > payload.length) return null;

    nodes.push({ tag, value: payload.slice(start, end) });
    i = end;
  }

  return nodes.length ? nodes : null;
}

function serializeTlv(nodes: TlvNode[]): string {
  return nodes
    .map((n) => `${n.tag}${String(n.value.length).padStart(2, "0")}${n.value}`)
    .join("");
}

/** Mencari nilai satu tag di dalam TLV bersarang, misal NMID di 51 sub-02. */
function findNested(nodes: TlvNode[], tag: string, subTag: string): string | null {
  const parent = nodes.find((n) => n.tag === tag);
  if (!parent) return null;
  const children = parseTlv(parent.value);
  return children?.find((c) => c.tag === subTag)?.value ?? null;
}

// ===========================================================================
// Pemeriksaan QRIS
// ===========================================================================

export interface QrisInfo {
  /** Payload asli, sudah dibersihkan dari spasi dan baris baru. */
  payload: string;
  merchantName: string;
  merchantCity: string;
  /** National Merchant ID. Ini yang dicocokkan merchant untuk memastikan QR-nya benar miliknya. */
  nmid: string | null;
  /** True kalau QRIS-nya statis (tag 01 = 11), yaitu jenis yang bisa diberi nominal. */
  isStatic: boolean;
  /** Nominal yang sudah tertanam, kalau ada. QRIS statis normalnya tidak punya ini. */
  existingAmount: string | null;
}

export type QrisReadResult =
  | { ok: true; info: QrisInfo }
  | { ok: false; error: string };

/**
 * Membersihkan artefak salin-tempel dari sebuah payload QRIS.
 *
 * Yang dibuang hanya baris baru, tab, dan karakter tak terlihat. Spasi di
 * TENGAH payload sengaja dipertahankan: nama merchant di tag 59 hampir selalu
 * lebih dari satu kata ("Kopi Dua Senyawa", "Jakarta Selatan"), dan membuang
 * spasinya memendekkan nilai tag sehingga panjang yang tertulis di TLV tidak
 * lagi cocok. Akibatnya seluruh payload setelah tag itu terbaca melenceng dan
 * CRC gagal — kelihatan seperti "QR-nya rusak" padahal kodenya baik-baik saja.
 *
 * Spasi tanpa-pemisah dari salinan HTML dikembalikan menjadi spasi biasa,
 * karena secara isi keduanya adalah karakter yang sama.
 */
export function normalizeQrisPayload(raw: string): string {
  return (raw || "")
    .replace(/ /g, " ")
    .replace(/[\r\n\t\f\v​-‍﻿]/g, "")
    .trim();
}

/**
 * Membaca dan MEMERIKSA sebuah payload QRIS.
 *
 * Pemeriksaan CRC dilakukan lebih dulu dan tidak bisa dilewati. Gambar QR yang
 * buram atau terpotong bisa terbaca sebagai string yang bentuknya masuk akal
 * tapi isinya salah satu dua karakter. Tanpa CRC, merchant akan menyimpan QRIS
 * rusak, dan yang menemukannya adalah pelanggan pertama yang gagal bayar di
 * depan kasir.
 */
export function readQris(raw: string): QrisReadResult {
  const payload = normalizeQrisPayload(raw);

  if (payload.length < 20) {
    return { ok: false, error: "Isi QRIS terlalu pendek. Pastikan seluruh kode ikut terbaca." };
  }

  const crcIndex = payload.lastIndexOf("6304");
  if (crcIndex === -1 || crcIndex + 8 !== payload.length) {
    return {
      ok: false,
      error: "Ini sepertinya bukan kode QRIS. Pastikan yang dipindai QRIS pembayaran, bukan QR biasa.",
    };
  }

  const expected = crc16(payload.slice(0, crcIndex + 4));
  const actual = payload.slice(crcIndex + 4).toUpperCase();
  if (expected !== actual) {
    return {
      ok: false,
      error: "Kode QRIS terbaca tapi rusak. Coba foto ulang dengan cahaya lebih terang dan QR terlihat penuh.",
    };
  }

  const nodes = parseTlv(payload);
  if (!nodes) {
    return { ok: false, error: "Struktur kode QRIS tidak dikenali." };
  }

  const get = (tag: string) => nodes.find((n) => n.tag === tag)?.value ?? null;

  const currency = get("53");
  if (currency && currency !== "360") {
    return { ok: false, error: "QRIS ini bukan dalam mata uang Rupiah." };
  }

  const initiation = get("01");

  return {
    ok: true,
    info: {
      payload,
      merchantName: (get("59") ?? "").trim(),
      merchantCity: (get("60") ?? "").trim(),
      // NMID ada di dalam Merchant Account Information. Penerbit berbeda
      // memakai tag 51 atau 26, jadi keduanya dicoba.
      nmid: findNested(nodes, "51", "02") ?? findNested(nodes, "26", "02"),
      isStatic: initiation !== "12",
      existingAmount: get("54"),
    },
  };
}

// ===========================================================================
// Penyisipan nominal
// ===========================================================================

/** Batas nominal satu transaksi QRIS. Tag 54 hanya menampung 13 karakter. */
export const QRIS_MAX_AMOUNT = 9_999_999_999_999;

export type QrisBuildResult =
  | { ok: true; payload: string }
  | { ok: false; error: string };

/**
 * Menghasilkan QRIS dinamis dari QRIS statis merchant plus nominal.
 *
 * Tiga hal yang harus benar, dan ketiganya sering terlewat:
 *
 *   1. Tag 54 disisipkan SESUAI URUTAN NOMOR, bukan ditempel di belakang.
 *      Sebagian aplikasi pembayaran membaca berurutan dan berhenti begitu
 *      menemukan tag yang lebih besar dari yang dicari.
 *   2. Tag 01 berubah dari 11 menjadi 12. QR dinamis sekali pakai; kalau tetap
 *      ditandai statis, ada aplikasi yang mengabaikan nominalnya dan pelanggan
 *      kembali mengetik angka sendiri.
 *   3. CRC dihitung ULANG di akhir, atas seluruh string sampai "6304".
 *      Melewatkan ini membuat QR ditolak tanpa pesan yang bisa dimengerti.
 */
export function buildDynamicQris(staticPayload: string, amount: number): QrisBuildResult {
  if (!Number.isFinite(amount) || !Number.isInteger(amount) || amount <= 0) {
    return { ok: false, error: "Nominal harus bilangan bulat lebih dari nol." };
  }
  if (amount > QRIS_MAX_AMOUNT) {
    return { ok: false, error: "Nominal melebihi batas satu transaksi QRIS." };
  }

  const read = readQris(staticPayload);
  if (!read.ok) return { ok: false, error: read.error };

  const nodes = parseTlv(read.info.payload);
  if (!nodes) return { ok: false, error: "Struktur kode QRIS tidak dikenali." };

  // Buang CRC lama; akan dihitung ulang dan ditempel kembali di akhir.
  const body = nodes.filter((n) => n.tag !== "63");

  const rebuilt: TlvNode[] = body.map((n) =>
    n.tag === "01" ? { tag: "01", value: "12" } : n,
  );

  const amountNode: TlvNode = { tag: "54", value: String(amount) };

  const existing = rebuilt.findIndex((n) => n.tag === "54");
  if (existing !== -1) {
    rebuilt[existing] = amountNode;
  } else {
    // Sisipkan tepat sebelum tag pertama yang nomornya lebih besar dari 54.
    const at = rebuilt.findIndex((n) => Number(n.tag) > 54);
    if (at === -1) rebuilt.push(amountNode);
    else rebuilt.splice(at, 0, amountNode);
  }

  const withoutCrc = `${serializeTlv(rebuilt)}6304`;
  return { ok: true, payload: withoutCrc + crc16(withoutCrc) };
}
