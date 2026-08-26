import type { Metadata } from "next";

import { db, DEFAULT_BUSINESS_ID } from "@/lib/db";
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

  const [business, categories, menuItems] = await Promise.all([
    db.getBusiness(DEFAULT_BUSINESS_ID),
    db.getCategories(DEFAULT_BUSINESS_ID),
    db.getMenuItems(DEFAULT_BUSINESS_ID),
  ]);

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
