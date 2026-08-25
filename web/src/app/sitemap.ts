import type { MetadataRoute } from "next";

import { site } from "@/lib/site";

/**
 * Only the homepage exists today. Per-product routes (/review, /loyalty, ...)
 * get added here as they ship, driven by src/lib/products.ts.
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
