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
  url: "https://kael.id",
  locale: "id_ID",
  whatsapp: process.env.NEXT_PUBLIC_KAEL_WHATSAPP ?? "6281311506025",
  email: "daru.fahma@gmail.com",
} as const;

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
