/**
 * KAEL System · Identitas visual per tenant.
 *
 * Kolom `logo_url` dan `brand_color` sudah ada di tabel businesses sejak
 * migrasi fondasi, tapi sampai sekarang tidak pernah dipakai merender apa pun:
 * `logo_url` nol pemakaian di seluruh UI, dan `brand_color` cuma menumpang
 * sebagai tipe di layar login tanpa pernah menjadi warna. Akibatnya tiap toko
 * melihat kotak "K" hijau KAEL di kepala aplikasinya sendiri.
 *
 * Itu jadi masalah nyata saat demo dipersonalisasi: pemilik kafe yang melihat
 * menunya sendiri di layar akan langsung menanyakan logonya, dan pertanyaan itu
 * datang tepat pada saat dia sedang menimbang membeli.
 *
 * Berkas ini sengaja TIDAK memakai "server-only". Semua kepala halaman yang
 * memakainya adalah komponen klien, dan tidak ada rahasia di sini: warna dan
 * URL logo memang tampil di layar.
 */

/**
 * Warna bawaan kolom brand_color di migrasi fondasi. Dipakai sebagai jaring
 * pengaman supaya nilai kosong atau rusak tidak pernah menghasilkan latar
 * transparan yang membuat tulisan di atasnya hilang.
 */
export const DEFAULT_BRAND_COLOR = "#7958d8";

/** Tinta dan kertas KAEL, dua pilihan teks yang boleh berdiri di atas warna toko. */
const INK = "#232331";
const PAPER = "#ffffff";

/**
 * Membaca hex menjadi tiga kanal 0-255.
 *
 * Menerima bentuk yang biasa diketik manusia: dengan atau tanpa pagar, tiga
 * digit maupun enam. Bentuk lain ditolak, bukan ditambal, supaya nilai sampah
 * jatuh ke warna bawaan alih-alih menghasilkan warna acak.
 */
function parseHex(input: string): [number, number, number] | null {
  const hex = input.trim().replace(/^#/, "");

  if (/^[0-9a-fA-F]{3}$/.test(hex)) {
    const [r, g, b] = hex.split("");
    return [parseInt(r + r, 16), parseInt(g + g, 16), parseInt(b + b, 16)];
  }

  if (/^[0-9a-fA-F]{6}$/.test(hex)) {
    return [
      parseInt(hex.slice(0, 2), 16),
      parseInt(hex.slice(2, 4), 16),
      parseInt(hex.slice(4, 6), 16),
    ];
  }

  return null;
}

/**
 * Warna toko dalam bentuk `#rrggbb` yang dijamin sah.
 *
 * Nilainya berasal dari kolom teks bebas yang diisi lewat panel admin dan skrip
 * seed, jadi tidak ada jaminan isinya hex yang benar. Menyerahkan nilai mentah
 * ke atribut style berarti satu salah ketik membuat kotak identitas toko
 * kehilangan latar sepenuhnya.
 */
export function normalizeBrandColor(input: string | null | undefined): string {
  return parseBrandColor(input) ?? DEFAULT_BRAND_COLOR;
}

/**
 * Bentuk KETAT: null kalau bukan hex yang sah.
 *
 * Dipakai di tempat yang manusianya sedang MENGETIK warna, yaitu panel
 * admin. Di sana jatuh diam-diam ke warna bawaan adalah jawaban yang salah:
 * orangnya mengetik "#gggggg", menekan simpan, melihat ungu, dan tidak
 * pernah diberi tahu bahwa yang diketiknya ditolak. Yang merender tetap
 * memakai normalizeBrandColor, karena di sana yang penting kotaknya jangan
 * sampai kehilangan latar.
 */
export function parseBrandColor(input: string | null | undefined): string | null {
  const rgb = parseHex(input ?? "");
  if (!rgb) return null;
  return `#${rgb.map((c) => c.toString(16).padStart(2, "0")).join("")}`;
}

/** Luminansi relatif WCAG 2.1. */
function relativeLuminance([r, g, b]: [number, number, number]): number {
  const channel = (value: number) => {
    const s = value / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

/** Rasio kontras WCAG 2.1 antara dua warna hex. */
export function contrastRatio(a: string, b: string): number {
  const ra = parseHex(a);
  const rb = parseHex(b);
  if (!ra || !rb) return 1;

  const la = relativeLuminance(ra);
  const lb = relativeLuminance(rb);
  const [hi, lo] = la >= lb ? [la, lb] : [lb, la];
  return (hi + 0.05) / (lo + 0.05);
}

/**
 * Warna teks yang masih terbaca di atas warna toko.
 *
 * Tanpa perhitungan ini, satu warna merek yang terang (kuning, krem, hijau
 * muda, dan itu warna yang lumrah dipakai kafe) membuat inisial putih di
 * atasnya lenyap. Memilih tinta atau kertas berdasarkan rasio kontras yang
 * lebih tinggi menjamin kotak identitas selalu terbaca, warna apa pun yang
 * diisi pemilik usaha.
 */
export function readableInkOn(brandColor: string): string {
  const bg = normalizeBrandColor(brandColor);
  return contrastRatio(bg, INK) >= contrastRatio(bg, PAPER) ? INK : PAPER;
}

/**
 * Kata yang tidak membedakan satu usaha dari usaha lain.
 *
 * "Kedai Kopi Nagura" dan "Kedai Kopi Senja" sama-sama menghasilkan "KK" kalau
 * dua kata pertama diambil apa adanya, padahal inisial ini justru dipakai
 * membedakan toko. Awalan yang dibuang di sini adalah yang paling sering
 * dipakai UMKM Indonesia sebagai penanda jenis usaha, bukan sebagai nama.
 */
const GENERIC_PREFIXES = new Set([
  "toko",
  "warung",
  "warmindo",
  "kedai",
  // Ejaan Minang untuk kedai; "Kadai Uwak" di data nyata memakai bentuk ini.
  "kadai",
  "kios",
  "cafe",
  "kafe",
  "coffee",
  "resto",
  "restoran",
  "rumah",
  "depot",
  "gerai",
  "the",
  "cv",
  "pt",
  "ud",
]);

/**
 * Inisial toko, maksimal dua huruf.
 *
 * Dipakai saat toko belum mengunggah logo. Ini bukan pengganti logo, cuma
 * penahan supaya kepala halaman tidak menampilkan huruf "K" milik KAEL di
 * aplikasi yang seharusnya terasa milik tokonya sendiri.
 *
 * Mengembalikan string kosong kalau nama tidak menyisakan huruf sama sekali;
 * pemanggil yang memutuskan apa yang tampil sebagai gantinya.
 */
export function businessInitials(name: string | null | undefined): string {
  const words = (name ?? "")
    .split(/[\s._/-]+/)
    // Membuang tanda baca murni seperti "&" dan sisa simbol di dalam kata.
    .map((w) => w.replace(/[^0-9a-zA-ZÀ-ɏ]/g, ""))
    .filter(Boolean);

  if (!words.length) return "";

  // Awalan generik hanya dibuang kalau masih ada kata lain yang tersisa.
  const meaningful = words.filter((w) => !GENERIC_PREFIXES.has(w.toLowerCase()));
  const source = meaningful.length ? meaningful : words;

  if (source.length === 1) {
    return source[0].slice(0, 2).toUpperCase();
  }

  return (source[0][0] + source[1][0]).toUpperCase();
}

/**
 * Latar dan teks kotak identitas toko, siap dipasang ke atribut style.
 *
 * Satu tempat perhitungan supaya tiap kepala halaman tidak menghitung
 * kontrasnya sendiri-sendiri dan berbeda-beda hasilnya.
 */
export function brandSurface(brandColor: string | null | undefined): {
  backgroundColor: string;
  color: string;
} {
  const backgroundColor = normalizeBrandColor(brandColor);
  return { backgroundColor, color: readableInkOn(backgroundColor) };
}
