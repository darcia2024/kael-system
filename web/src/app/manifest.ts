import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    /**
     * Ditulis tegas karena sekarang ada dua aplikasi di domain yang sama:
     * KAEL POS ini untuk tablet kasir, dan KAEL Owner (lib/owner-app.ts) untuk
     * HP pemilik. Nilainya sama dengan bawaan (start_url), jadi aplikasi yang
     * sudah terpasang tidak berubah identitas.
     */
    id: "/app/pos",
    name: "KAEL System - Smart POS & Resto",
    short_name: "KAEL POS",
    description: "Sistem Kasir POS, Kitchen Display, dan Manajemen Resto",
    start_url: "/app/pos",
    scope: "/",
    display: "standalone",
    background_color: "#08060f",
    theme_color: "#0b3d2e",
    orientation: "any",
    categories: ["business", "productivity", "food"],
    icons: [
      {
        src: "/icon-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icon-maskable-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
