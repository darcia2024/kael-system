import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { db } from "@/lib/db";
import { getSession } from "@/lib/auth";
import LoyaltyClient from "./loyalty-client";

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
  const session = await getSession();
  if (!session) redirect("/app/login?next=/app/loyalty");
  if (!session.businessId) redirect("/app/login");

  const [business, program, customers, rewards, users, staffAudit] = await Promise.all([
    db.getBusiness(session.businessId),
    db.getLoyaltyProgram(session.businessId),
    db.getCustomersWithBalance(session.businessId),
    db.getRewards(session.businessId),
    db.getUsers(session.businessId),
    // Audit poin per kasir hanya berguna bagi owner.
    session.role === "owner" ? db.getStaffPointsAudit(session.businessId) : Promise.resolve([]),
  ]);

  if (!program) {
    throw new Error("Program loyalty belum dibuat untuk bisnis ini.");
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
