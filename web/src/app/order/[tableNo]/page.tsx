import type { Metadata } from "next";

import { db } from "@/lib/db";
import OrderClient from "./order-client";

/**
 * Menu digital per meja. Pelanggan memindai QR di meja, jadi tanpa login.
 *
 * Menu diambil di server. Sebelumnya seluruh isi database ikut ke bundel
 * halaman ini hanya untuk menampilkan daftar menu satu toko.
 */

export const metadata: Metadata = {
  title: "Pesan dari Meja",
  robots: { index: false, follow: false },
};

export default async function QrOrderPage({
  params,
}: {
  params: Promise<{ tableNo: string }>;
}) {
  const { tableNo } = await params;

  const business = await db.getBusiness();
  const businessId = business?.id;

  const [categories, menuItems] = businessId
    ? await Promise.all([
        db.getCategories(businessId),
        db.getMenuItems(businessId),
      ])
    : [[], []];

  return (
    <OrderClient
      tableNo={decodeURIComponent(tableNo)}
      business={business}
      categories={categories}
      // Menu yang sedang habis tidak perlu sampai ke pelanggan.
      menuItems={menuItems.filter((m) => m.is_available)}
    />
  );
}
