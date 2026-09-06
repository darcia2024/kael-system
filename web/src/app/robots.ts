import type { MetadataRoute } from "next";

import { site } from "@/lib/site";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      /**
       * Area privat. Halaman-halaman ini sudah memasang noindex sendiri, ini
       * lapis kedua supaya perayap tidak menyentuhnya sama sekali.
       *
       * /m dan /receipt dijaga oleh tautan yang tidak bisa ditebak, bukan oleh
       * login, jadi justru itu yang paling penting tidak sampai terindeks.
       *
       * /order melayani pemesanan meja lewat QR, dan /penawaran1 adalah
       * penawaran yang disusun untuk satu calon pembeli tertentu. Keduanya
       * dibagikan lewat tautan, bukan lewat pencarian.
       */
      disallow: [
        "/app/", "/admin/", "/m/", "/receipt/", "/activate/", "/r/",
        "/order/", "/loyalty/register", "/penawaran1",
      ],
    },
    sitemap: `${site.url}/sitemap.xml`,
  };
}
