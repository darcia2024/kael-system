import type { MetadataRoute } from "next";

import { site } from "@/lib/site";

/**
 * Hanya beranda yang boleh diindeks hari ini.
 *
 * Seluruh jalur lain berupa area privat (dashboard, kartu member, struk) atau
 * halaman yang dibagikan lewat tautan, bukan lewat pencarian — semuanya sudah
 * ditolak di robots.ts. Kalau nanti ada halaman produk publik per modul, sumber
 * kebenarannya adalah src/lib/modules-catalog.ts, satu-satunya daftar modul
 * yang benar-benar dipakai aplikasi.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  return [
    {
      url: site.url,
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 1,
    },
  ];
}
