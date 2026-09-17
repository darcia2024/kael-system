import type { Metadata } from "next";

import { db } from "@/lib/db";
import { guardModulePage } from "@/lib/licensing";
import { mochiThemeClass } from "@/lib/mochi-theme";
import { isMochiBusiness } from "@/lib/mochi-brand";
import RiwayatClient from "./riwayat-client";

/**
 * Riwayat penjualan untuk KASIR.
 *
 * Kasir sekarang boleh memproses pengembalian dana — tapi satu-satunya layar
 * yang menampilkan transaksi lama adalah laporan owner, dan layar itu menolak
 * staf. Akibatnya kasir cuma bisa merefund pesanan yang masih di antrean;
 * transaksi yang sudah selesai — persis kasus "sudah dibayar lalu dibatalkan" —
 * tidak bisa dijangkau sama sekali.
 *
 * Halaman ini menutup jarak itu TANPA membuka laporan laba. Tidak ada HPP,
 * tidak ada margin, tidak ada omzet kumulatif: kasir perlu menemukan
 * transaksinya, bukan tahu berapa untung tokonya.
 */
export const metadata: Metadata = {
  title: "Riwayat Penjualan",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function RiwayatPenjualanPage() {
  const { session } = await guardModulePage("pos", "/app/pos/riwayat");

  const [business, riwayat, menuItems] = await Promise.all([
    db.getBusiness(session.businessId),
    db.getCashierSalesHistory(session.businessId, { hari: 7 }),
    db.getMenuItems(session.businessId),
  ]);

  return (
    <RiwayatClient
      business={business}
      riwayat={JSON.parse(JSON.stringify(riwayat))}
      menuItems={menuItems}
      themeClassName={mochiThemeClass(business)}
      isMochi={isMochiBusiness(business)}
    />
  );
}
