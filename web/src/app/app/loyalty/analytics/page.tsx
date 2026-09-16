import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { db } from "@/lib/db";
import { guardModulePage } from "@/lib/licensing";
import AnalyticsClient from "./analytics-client";

/**
 * Analitik pertumbuhan member. Halaman terpisah, bukan tab kedelapan di
 * loyalty-client.tsx — berkas itu sudah 1.500+ baris dan tujuh tab, dan
 * angka pertumbuhan butuh ruangnya sendiri, bukan disisipkan.
 *
 * Owner saja, sama seperti laporan POS: ini angka strategi toko, bukan
 * sesuatu yang kasir butuhkan sambil melayani antrean.
 */

export const metadata: Metadata = {
  title: "Analitik Member | KAEL Loyalty",
  robots: { index: false, follow: false },
};

export default async function LoyaltyAnalyticsPage() {
  const { session } = await guardModulePage("loyalty", "/app/loyalty/analytics");
  if (session.role !== "owner") redirect("/app/loyalty");

  const [
    business,
    program,
    trend,
    summary,
    overall,
    memberInsights,
    tiers,
    rewards,
    recentLedger,
    campaigns,
    referralReport,
  ] = await Promise.all([
    db.getBusiness(session.businessId),
    db.getLoyaltyProgram(session.businessId),
    db.getMemberGrowthTrend(session.businessId, 12),
    db.getMemberGrowthSummary(session.businessId),
    db.getLoyaltyOverallStats(session.businessId),
    db.getCustomerMemberInsights(session.businessId),
    db.getLoyaltyTiers(session.businessId),
    db.getRewards(session.businessId),
    db.getRecentBusinessPointLedger(session.businessId, 30),
    db.getLoyaltyCampaignSummaries(session.businessId),
    db.getReferralReport(session.businessId),
  ]);

  return (
    <AnalyticsClient
      business={business}
      program={program}
      trend={trend}
      summary={summary}
      overall={overall}
      memberInsights={memberInsights}
      tiers={tiers}
      rewards={rewards}
      recentLedger={recentLedger}
      campaigns={campaigns}
      referralReport={referralReport}
    />
  );
}

