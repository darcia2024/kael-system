/**
 * Katalog modul KAEL.
 *
 * Satu sumber untuk halaman harga publik DAN kartu terkunci di dashboard.
 * Sebelumnya harga hanya ada di components/packages.tsx. Kalau angkanya
 * berbeda di dua tempat, calon pembeli melihat harga A di landing lalu harga B
 * setelah masuk ke dashboard-nya, tepat saat dia sedang mempertimbangkan
 * membeli. Itu merusak kepercayaan lebih cepat daripada harga yang mahal.
 *
 * Berkas ini sengaja TIDAK memakai "server-only" supaya komponen klien bisa
 * memakainya. Tidak ada rahasia di sini; semua angkanya sudah tampil di
 * halaman publik.
 */

export type ModuleKey = "review" | "finance" | "loyalty" | "pos" | "hr" | "booking";

/** Jenis usaha. Sama persis dengan CHECK di kolom businesses.business_type. */
export type BusinessType = "kuliner" | "jasa" | "retail";

export const BUSINESS_TYPES: { key: BusinessType; label: string; hint: string }[] = [
  { key: "kuliner", label: "Kuliner", hint: "Kafe, restoran, warung, bakery, katering" },
  { key: "jasa", label: "Jasa", hint: "Barbershop, salon, laundry, servis, klinik" },
  { key: "retail", label: "Retail", hint: "Toko kelontong, minimarket, butik, apotek" },
];

export interface ModuleCatalogEntry {
  key: ModuleKey;
  name: string;
  /** Satu kalimat pendek. Dipakai di kartu terkunci, bukan salinan iklan. */
  tagline: string;
  /** Harga beli tahun pertama. */
  price: number;
  /** Perpanjangan tahun berikutnya. */
  renewal: number;
  /**
   * Jenis usaha yang masuk akal memakai modul ini.
   *
   * Barbershop tidak punya resep, jadi kalkulator HPP berbasis resep tidak
   * berlaku untuknya. Menawarkannya sebagai kartu terkunci bukan cuma sia-sia,
   * tapi bikin pemiliknya merasa produk ini tidak dibuat untuk usahanya.
   */
  fits: BusinessType[];
  /** Modul yang belum jadi tidak pernah ditawarkan. Menjual janji itu utang. */
  available: boolean;
  /** Jalur halaman di dalam aplikasi. Null untuk modul yang belum ada. */
  href: string | null;
}

export const MODULE_CATALOG: ModuleCatalogEntry[] = [
  {
    key: "review",
    name: "KAEL Review",
    tagline: "Kartu NFC yang membawa pelanggan langsung ke halaman ulasan Google toko kamu.",
    price: 149_000,
    renewal: 49_000,
    fits: ["kuliner", "jasa", "retail"],
    available: true,
    href: "/app/review",
  },
  {
    key: "pos",
    name: "KAEL POS & Ordering",
    tagline: "Kasir layar sentuh, pesanan meja lewat QR, struk thermal, dan tutup shift harian.",
    price: 549_000,
    renewal: 199_000,
    fits: ["kuliner", "jasa", "retail"],
    available: true,
    href: "/app/pos",
  },
  {
    key: "loyalty",
    name: "KAEL Loyalty",
    tagline: "Poin dan stempel digital supaya pelanggan lama punya alasan kembali.",
    price: 399_000,
    renewal: 149_000,
    fits: ["kuliner", "jasa", "retail"],
    available: true,
    href: "/app/loyalty",
  },
  {
    key: "finance",
    name: "KAEL Finance",
    tagline: "Hitung HPP per resep dan lihat untung bersih tiap menu, bukan cuma omzet.",
    price: 249_000,
    renewal: 99_000,
    // Berbasis resep dan takaran bahan, jadi hanya masuk akal untuk kuliner.
    fits: ["kuliner"],
    available: true,
    href: "/app/finance",
  },
  {
    key: "booking",
    name: "KAEL Booking",
    tagline: "Jadwal janji temu dan antrean pelanggan.",
    price: 0,
    renewal: 0,
    fits: ["jasa"],
    available: false,
    href: null,
  },
  {
    key: "hr",
    name: "KAEL HR",
    tagline: "Absensi staf, jadwal shift, dan hitung gaji.",
    price: 0,
    renewal: 0,
    fits: ["kuliner", "jasa", "retail"],
    available: false,
    href: null,
  },
];

export const MODULE_BY_KEY: Record<string, ModuleCatalogEntry> = Object.fromEntries(
  MODULE_CATALOG.map((m) => [m.key, m]),
);

/** Modul yang sudah jadi dan masuk akal untuk jenis usaha ini. */
export function modulesForBusinessType(type: BusinessType): ModuleCatalogEntry[] {
  return MODULE_CATALOG.filter((m) => m.available && m.fits.includes(type));
}

export const rupiah = (value: number) => `Rp ${value.toLocaleString("id-ID")}`;
