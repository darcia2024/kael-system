import type { Metadata } from "next";

import { db } from "@/lib/db";
import { guardModulePage } from "@/lib/licensing";
import { mochiThemeClass } from "@/lib/mochi-theme";
import { isMochiBusiness } from "@/lib/mochi-brand";
import PosClient from "./pos-client";

export const metadata: Metadata = {
  title: "KAEL POS & Kasir",
  robots: { index: false, follow: false },
};

export default async function PosPage() {
  const { session } = await guardModulePage("pos", "/app/pos");

  const [business, categories, menuItems, activeShift, pendingQrOrders, users, loyaltyProgram, rewards] = await Promise.all([
    db.getBusiness(session.businessId),
    db.getCategories(session.businessId),
    db.getMenuItems(session.businessId),
    db.getActiveShift(session.businessId),
    db.getPendingQrOrders(session.businessId),
    db.getUsers(session.businessId),
    // Dibutuhkan supaya perkiraan poin di layar kasir memakai kurs yang
    // sebenarnya, bukan angka tetap. NULL kalau toko ini belum menyiapkan
    // program loyalty — layarnya lalu tidak menjanjikan poin apa pun.
    db.getLoyaltyProgram(session.businessId),
    db.getRewards(session.businessId),
  ]);

  const isMochi = isMochiBusiness(business);

  return (
    <PosClient
      business={business}
      categories={categories}
      menuItems={menuItems}
      activeShift={activeShift}
      pendingQrOrders={pendingQrOrders}
      staffList={users
        .filter((u) => u.is_active && u.role !== "owner" && !u.name.toLowerCase().includes("owner"))
        .map((u) => ({ id: u.id, name: u.name }))}
      currentUserId={session.userId}
      userRole={session.role === "owner" ? "owner" : "staff"}
      loyaltyProgram={loyaltyProgram}
      rewards={rewards}
      taxRatePct={Number(business?.pos_tax_rate ?? 0)}
      serviceChargePct={Number(business?.pos_service_charge_rate ?? 0)}
      themeClassName={mochiThemeClass(business)}
      isMochi={isMochi}
    />
  );
}
