import type { Metadata } from "next";

import { db } from "@/lib/db";
import { guardModulePage } from "@/lib/licensing";
import LoyaltyClient from "./loyalty-client";
import LoyaltySetup from "./loyalty-setup";

/**
 * Dashboard KAEL Loyalty.
 *
 * Terbuka untuk owner dan kasir; pengaturan program serta penghapusan data
 * pelanggan dibatasi ke owner di dalam masing-masing server action.
 */

export const metadata: Metadata = {
  title: "KAEL Loyalty",
  robots: { index: false, follow: false },
};

export default async function LoyaltyPage() {
  const { session } = await guardModulePage("loyalty", "/app/loyalty");

  const [business, program, customers, rewards, users, staffAudit] = await Promise.all([
    db.getBusiness(session.businessId),
    db.getLoyaltyProgram(session.businessId),
    db.getCustomersWithBalance(session.businessId),
    db.getRewards(session.businessId),
    db.getUsers(session.businessId),
    // Audit poin per kasir hanya berguna bagi owner.
    session.role === "owner" ? db.getStaffPointsAudit(session.businessId) : Promise.resolve([]),
  ]);

  /**
   * Belum ada programnya: tampilkan layar penyiapan, bukan melempar galat.
   *
   * Galat di sini naik ke app/error.tsx dan pesannya disensor Next di produksi,
   * sehingga pemilik usaha yang modulnya sudah dibayar cuma melihat layar galat
   * tanpa penjelasan. Kasir tidak akan pernah sampai ke titik ini —
   * guardModulePage sudah memulangkannya lebih dulu.
   */
  if (!program) {
    return <LoyaltySetup businessName={business?.name ?? "Usahamu"} />;
  }

  return (
    <LoyaltyClient
      business={business}
      initialProgram={program}
      customers={customers}
      rewards={rewards}
      staffList={users
        .filter((u) => u.role === "staff" && u.is_active)
        .map((u) => ({ id: u.id, name: u.name }))}
      staffAudit={staffAudit}
      sessionRole={session.role}
    />
  );
}
