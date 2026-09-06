import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { db } from "@/lib/db";
import { guardModulePage } from "@/lib/licensing";
import OwnerDashboardClient from "./owner-dashboard-client";

export const metadata: Metadata = {
  title: "Dashboard Owner POS",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function PosOwnerDashboardPage() {
  const { session } = await guardModulePage("pos", "/app/pos/owner");
  if (session.role !== "owner") redirect("/app/pos");
  const [business, dashboard, pendingSync] = await Promise.all([
    db.getBusiness(session.businessId),
    db.getPosOwnerDashboard(session.businessId),
    db.getPendingOrderSync(session.businessId),
  ]);

  return <OwnerDashboardClient business={business} dashboard={dashboard} pendingSync={pendingSync} />;
}
