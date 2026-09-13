import type { Metadata } from "next";

import { db } from "@/lib/db";
import { guardModulePage } from "@/lib/licensing";
import { mochiThemeClass } from "@/lib/mochi-theme";
import { isMochiBusiness } from "@/lib/mochi-brand";
import OrderStationClient from "./station-client";

export const metadata: Metadata = { title: "KAEL Pos Kasir Tetap", robots: { index: false, follow: false } };

export default async function OrderStationPage() {
  const { session } = await guardModulePage("pos", "/app/pos/station");
  const [business, orders] = await Promise.all([
    db.getBusiness(session.businessId),
    db.getOrderStationOrders(session.businessId),
  ]);
  const isMochi = isMochiBusiness(business);
  return (
    <OrderStationClient
      businessName={business?.name ?? "Usaha Anda"}
      initialOrders={orders}
      currentUserId={session.userId}
      mode="cashier"
      themeClassName={mochiThemeClass(business)}
      isMochi={isMochi}
    />
  );
}
