import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { db } from "@/lib/db";
import { guardModulePage } from "@/lib/licensing";
import { mochiThemeClass } from "@/lib/mochi-theme";
import ReportsClient from "./reports-client";

/**
 * Laporan penjualan. Khusus owner: kasir tidak boleh melihat omzet, laba, atau
 * memproses refund.
 */

export const metadata: Metadata = {
  title: "Laporan Penjualan",
  robots: { index: false, follow: false },
};

export default async function PosReportsPage() {
  const { session } = await guardModulePage("pos", "/app/pos/reports");
  // Laporan laba dan rekap shift tetap hanya untuk pemilik, walaupun
  // kasir punya izin POS. Angka margin bukan urusan yang mencatatnya.
  if (session.role !== "owner") redirect("/app/pos");

  const [business, reports, orders, shifts, feedbackSummary, recentFeedback] = await Promise.all([
    db.getBusiness(session.businessId),
    db.getPosReports(session.businessId),
    db.getOrders(session.businessId, 100),
    db.getShifts(session.businessId),
    db.getFeedbackSummary(session.businessId),
    db.getRecentFeedback(session.businessId),
  ]);

  return (
    <ReportsClient
      business={business}
      reports={reports}
      orders={orders}
      shifts={shifts}
      feedbackSummary={feedbackSummary}
      recentFeedback={recentFeedback}
      themeClassName={mochiThemeClass(business)}
    />
  );
}
