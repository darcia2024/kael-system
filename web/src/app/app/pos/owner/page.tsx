import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { db } from "@/lib/db";
import { guardModulePage } from "@/lib/licensing";
import { mochiThemeClass } from "@/lib/mochi-theme";
import { ownerAppMetadata } from "@/lib/owner-app";
import OwnerDashboardClient from "./owner-dashboard-client";

export const metadata: Metadata = {
  title: "Dashboard Owner POS",
  robots: { index: false, follow: false },
  ...ownerAppMetadata,
};

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function PosOwnerDashboardPage() {
  const { session } = await guardModulePage("pos", "/app/pos/owner");
  if (session.role !== "owner" && session.role !== "kael_admin") redirect("/app/pos");
  const [business, dashboard, pendingSync, feedbackSummary, recentFeedback, loyaltySummary, unpaid] = await Promise.all([
    db.getBusiness(session.businessId),
    db.getPosOwnerDashboard(session.businessId),
    db.getPendingOrderSync(session.businessId),
    db.getFeedbackSummary(session.businessId),
    db.getRecentFeedback(session.businessId, 20),
    db.getMemberGrowthSummary(session.businessId),
    // Tagihan belum dibayar dihitung PER MEJA, satuan yang sama dengan denah
    // kasir. Angka per nota di dashboard dulu terbaca "6" sementara kasir
    // melihat "4 meja" — keduanya benar, hanya satuannya yang berbeda.
    db.getUnpaidTables(session.businessId),
  ]);

  return (
    <OwnerDashboardClient
      business={business}
      dashboard={dashboard}
      pendingSync={pendingSync}
      feedbackSummary={feedbackSummary}
      recentFeedback={recentFeedback}
      loyaltySummary={loyaltySummary}
      unpaid={unpaid}
      // Kapan data ini dirakit server. Dipakai layar untuk menunjukkan umur
      // datanya: HTML lama dari cache HP tidak bisa lagi menyamar sebagai
      // keadaan terkini, karena jam ini ikut tua bersamanya.
      dibuatPada={new Date().toISOString()}
      themeClassName={mochiThemeClass(business)}
    />
  );
}
