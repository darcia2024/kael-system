import type { Metadata } from "next";

import { db } from "@/lib/db";
import { guardModulePage } from "@/lib/licensing";
import { mochiThemeClass } from "@/lib/mochi-theme";
import { isMochiBusiness } from "@/lib/mochi-brand";
import OrderStationClient from "../station/station-client";

export const metadata: Metadata = { title: "KAEL Layar Dapur", robots: { index: false, follow: false } };

export default async function KitchenPage() {
  const { session } = await guardModulePage("pos", "/app/pos/kitchen");
  const [business, orders] = await Promise.all([
    db.getBusiness(session.businessId),
    db.getOrderStationOrders(session.businessId),
  ]);
  const isMochi = isMochiBusiness(business);
  return (
    <OrderStationClient
      businessName={business?.name ?? "Usaha Anda"}
      timezone={business?.timezone ?? "Asia/Jakarta"}
      initialOrders={orders}
      currentUserId={session.userId}
      mode="kitchen"
      themeClassName={mochiThemeClass(business)}
      isMochi={isMochi}
    />
  );
}
