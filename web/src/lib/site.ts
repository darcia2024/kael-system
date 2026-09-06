/**
 * Site-wide configuration.
 *
 * `whatsapp` is stored in wa.me format: country code, no "+", no leading zero,
 * no spaces. 081311506025 becomes 6281311506025. Can be overridden at build
 * time with NEXT_PUBLIC_KAEL_WHATSAPP.
 */
export const site = {
  name: "KAEL",
  tagline: "Kemudahan Akses, Efisiensi, Layanan",
  description:
    "KAEL adalah ekosistem solusi digital untuk UMKM. Kelola pelanggan, transaksi, keuangan, dan operasional bisnis dengan sistem yang bisa dipilih sesuai kebutuhan.",
  /**
   * Dipakai untuk canonical, Open Graph, dan sitemap.
   *
   * Diisi domain yang BENAR-BENAR melayani situs. Menunjuk canonical ke
   * domain yang tidak hidup sama saja menyuruh Google mengindeks alamat yang
   * tidak ada.
   *
   * Saat pindah ke domain sendiri, isi NEXT_PUBLIC_SITE_URL di pengaturan
   * Vercel lalu deploy ulang. Nilai di sini cuma jaring pengaman kalau
   * variabelnya belum diisi.
   */
  url: process.env.NEXT_PUBLIC_SITE_URL ?? "https://kaels.site",
  locale: "id_ID",
  whatsapp: process.env.NEXT_PUBLIC_KAEL_WHATSAPP ?? "6281311506025",
  email: "daru.fahma@gmail.com",
} as const;

/**
 * Host situs tanpa protokol, misalnya `kaels.site`.
 *
 * Dipakai di layar yang sempit, tempat menampilkan alamat lengkap beserta
 * https:// cuma memakan ruang tanpa menambah keterangan.
 */
export const siteHost = new URL(site.url).host;

/**
 * Host lama yang masih menempel di barang fisik yang sudah beredar.
 *
 * Alamat yang tertulis di kartu NFC tidak bisa ditarik kembali setelah
 * kartunya ada di meja toko orang, jadi host lama harus tetap dilayani
 * selamanya. proxy.ts yang mengalihkannya ke `site.url`.
 *
 * Daftar ini SENGAJA berisi host produksi yang persis, bukan pola
 * `*.vercel.app`. Deploy pratinjau juga berakhiran itu, dan mengalihkannya
 * berarti tidak ada lagi cara menguji perubahan sebelum tayang.
 */
export const legacyHosts: readonly string[] = ["kael-system.vercel.app"];

/** Builds a wa.me deep link with a prefilled message. */
export function waLink(message: string): string {
  return `https://wa.me/${site.whatsapp}?text=${encodeURIComponent(message)}`;
}

/**
 * One label per intent, used everywhere on the page.
 * Contact intent is always "Konsultasi Gratis"; ordering KAEL Review is the
 * only other outbound intent.
 */
export const cta = {
  consult: {
    label: "Konsultasi Gratis",
    href: waLink(
      "Halo KAEL, saya mau konsultasi soal solusi digital untuk bisnis saya.",
    ),
  },
  orderReview: {
    label: "Pesan KAEL Review",
    href: waLink("Halo KAEL, saya tertarik dengan KAEL Review. Boleh info lebih lanjut?"),
  },
} as const;

export const nav = [
  { label: "Solusi", href: "#solusi" },
  { label: "Cara Kerja", href: "#cara-kerja" },
  { label: "Untuk Bisnis", href: "#untuk-bisnis" },
  { label: "FAQ", href: "#faq" },
] as const;
