import {
  CalendarCheck,
  Calculator,
  ClipboardList,
  Gift,
  Puzzle,
  Receipt,
  Star,
  Users,
  type LucideIcon,
} from "lucide-react";

/**
 * Single source of truth for the KAEL product ecosystem.
 *
 * Everything downstream reads from here: the ecosystem grid, the status chips,
 * the sitemap, and (later) the per-product routes at /{slug}. Adding a product
 * or flipping a status is a one-line change in this file.
 *
 * Status vocabulary is deliberately three values in use. The PRD originally had
 * both "available-soon" and "coming-soon"; customers cannot tell those apart, so
 * they collapse to `soon` (next to ship) and `roadmap` (planned, not started).
 * `available` is reserved for when KAEL Review actually goes live.
 */
export type ProductStatus = "available" | "soon" | "roadmap" | "by-request";

export type Product = {
  name: string;
  slug: string;
  /** Card copy. Kept to one short line, matching PRD section 20. */
  blurb: string;
  /** Longer line used on the ecosystem grid's featured cell. */
  detail?: string;
  status: ProductStatus;
  icon: LucideIcon;
  /** Marks the product the homepage leads with. Exactly one is true. */
  featured?: boolean;
};

export const STATUS_LABEL: Record<ProductStatus, string> = {
  available: "Tersedia",
  soon: "Segera hadir",
  roadmap: "Dalam roadmap",
  "by-request": "Sesuai permintaan",
};

export const products: Product[] = [
  {
    name: "KAEL Review",
    slug: "review",
    blurb: "Google Review dengan NFC dan QR.",
    detail:
      "Pelanggan tap kartu, halaman Google Review bisnis langsung terbuka. Tidak perlu install aplikasi apa pun.",
    status: "soon",
    icon: Star,
    featured: true,
  },
  {
    name: "KAEL Loyalty",
    slug: "loyalty",
    blurb: "Poin dan reward pelanggan.",
    status: "roadmap",
    icon: Gift,
  },
  {
    name: "KAEL Finance",
    slug: "finance",
    blurb: "HPP, profit, dan keuangan bisnis.",
    status: "roadmap",
    icon: Calculator,
  },
  {
    name: "KAEL Ordering",
    slug: "ordering",
    blurb: "Menu dan pemesanan digital.",
    status: "roadmap",
    icon: ClipboardList,
  },
  {
    name: "KAEL POS",
    slug: "pos",
    blurb: "Kasir dan laporan penjualan.",
    status: "roadmap",
    icon: Receipt,
  },
  {
    name: "KAEL Booking",
    slug: "booking",
    blurb: "Booking dan jadwal pelanggan.",
    status: "roadmap",
    icon: CalendarCheck,
  },
  {
    name: "KAEL HR",
    slug: "hr",
    blurb: "Karyawan, absensi, dan payroll.",
    status: "roadmap",
    icon: Users,
  },
  {
    name: "KAEL Custom",
    slug: "custom",
    blurb: "Sistem bisnis sesuai kebutuhan.",
    status: "by-request",
    icon: Puzzle,
  },
];

export const featuredProduct = products.find((p) => p.featured) ?? products[0];
