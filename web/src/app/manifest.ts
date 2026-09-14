import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "KAEL System - Smart POS & Resto",
    short_name: "KAEL POS",
    description: "Sistem Kasir POS, Kitchen Display, dan Manajemen Resto",
    start_url: "/app/pos",
    scope: "/",
    display: "standalone",
    background_color: "#0f172a",
    theme_color: "#164A39",
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
