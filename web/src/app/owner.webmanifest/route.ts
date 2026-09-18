import type { MetadataRoute } from "next";

import { OWNER_APP } from "@/lib/owner-app";

/**
 * Manifest aplikasi KAEL Owner. Kenapa ada dua aplikasi dan kenapa berkas ini
 * di luar /app ditulis di lib/owner-app.ts.
 */
export const dynamic = "force-static";

export function GET() {
  const manifest: MetadataRoute.Manifest = {
    id: OWNER_APP.id,
    name: OWNER_APP.nama,
    short_name: OWNER_APP.nama,
    description: "Omzet hari ini, menu laris, review, member, dan kas toko — langsung dari layar utama HP.",
    start_url: OWNER_APP.startUrl,
    /**
     * "/app", bukan "/app/". Beranda bisnis ada di /app persis, dan jalur itu
     * tidak diawali "/app/": tombol kembali di dasbor owner akan membuka
     * beranda di luar aplikasi, lengkap dengan bilah alamat peramban.
     */
    scope: "/app",
    display: "standalone",
    // Latar layar pembuka sama dengan latar beranda, supaya tidak berkedip.
    background_color: "#f7f6fc",
    theme_color: "#ffffff",
    lang: "id",
    dir: "ltr",
    categories: ["business", "productivity"],
    icons: [
      { src: "/owner/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/owner/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/owner/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    // Muncul saat ikon aplikasi ditekan lama di Android.
    shortcuts: [
      { name: "Laporan penjualan", short_name: "Laporan", url: "/app/pos/reports" },
      { name: "Review pelanggan", short_name: "Review", url: "/app/review/reports" },
      { name: "Buka kasir", short_name: "Kasir", url: "/app/pos" },
    ],
  };

  return Response.json(manifest, {
    headers: { "Content-Type": "application/manifest+json; charset=utf-8" },
  });
}
