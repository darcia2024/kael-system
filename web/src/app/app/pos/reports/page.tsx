import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { db } from "@/lib/db";
import { getSession } from "@/lib/auth";
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
  const session = await getSession();
  if (!session) redirect("/app/login?next=/app/pos/reports");
  if (session.role !== "owner") redirect("/app/pos");
  if (!session.businessId) redirect("/app/login");

  const [business, reports, orders, shifts] = await Promise.all([
    db.getBusiness(session.businessId),
    db.getPosReports(session.businessId),
    db.getOrders(session.businessId, 100),
    db.getShifts(session.businessId),
  ]);

  return (
    <ReportsClient business={business} reports={reports} orders={orders} shifts={shifts} />
  );
}
