import type { Metadata } from "next";

import { db } from "@/lib/db";
import { guardModulePage } from "@/lib/licensing";
import PosClient from "./pos-client";

export const metadata: Metadata = {
  title: "KAEL POS & Kasir",
  robots: { index: false, follow: false },
};

export default async function PosPage() {
  const { session } = await guardModulePage("pos", "/app/pos");

  const [business, categories, menuItems, activeShift, pendingQrOrders, users, orders] = await Promise.all([
    db.getBusiness(session.businessId),
    db.getCategories(session.businessId),
    db.getMenuItems(session.businessId),
    db.getActiveShift(session.businessId),
    db.getPendingQrOrders(session.businessId),
    db.getUsers(session.businessId),
    db.getOrders(session.businessId, 100),
  ]);

  return (
    <PosClient
      business={business}
      categories={categories}
      menuItems={menuItems}
      activeShift={activeShift}
      pendingQrOrders={pendingQrOrders}
      staffList={users
        .filter((u) => u.role === "staff" && u.is_active)
        .map((u) => ({ id: u.id, name: u.name }))}
      currentUserId={session.userId}
      orderCountToday={orders.length}
    />
  );
}
