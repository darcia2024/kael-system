import type { Metadata } from "next";

import { db } from "@/lib/db";
import { guardModulePage } from "@/lib/licensing";
import { mochiThemeClass } from "@/lib/mochi-theme";
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

  const [business, program, customers, memberInsights, rewards, users, staffAudit, campaigns, weeklySignups, referralReport, tiers] = await Promise.all([
    db.getBusiness(session.businessId),
    db.getLoyaltyProgram(session.businessId),
    db.getCustomersWithBalance(session.businessId),
    db.getCustomerMemberInsights(session.businessId),
    db.getRewards(session.businessId),
    db.getUsers(session.businessId),
    // Audit poin per kasir hanya berguna bagi owner.
    session.role === "owner" ? db.getStaffPointsAudit(session.businessId) : Promise.resolve([]),
    session.role === "owner" ? db.getLoyaltyCampaignSummaries(session.businessId) : Promise.resolve([]),
    db.getWeeklySignups(session.businessId),
    session.role === "owner" ? db.getReferralReport(session.businessId) : Promise.resolve([]),
    db.getLoyaltyTiers(session.businessId),
  ]);
  const [latestCampaignRecipients, expiryDue, expirySoon, birthdayCandidates, anniversaryCandidates] = await Promise.all([
    campaigns[0] ? db.getLoyaltyCampaignRecipients(campaigns[0].id, session.businessId) : Promise.resolve([]),
    session.role === "owner" && program?.point_expiry_months
      ? db.getPointExpiryCandidates(session.businessId, program.point_expiry_months, new Date())
      : Promise.resolve([]),
    session.role === "owner" && program?.point_expiry_months
      ? db.getPointExpiryCandidates(session.businessId, program.point_expiry_months, new Date(Date.now() + 30 * 24 * 60 * 60 * 1000))
      : Promise.resolve([]),
    // Ulang tahun butuh saklar aktif — dia bisa membawa bonus poin sungguhan.
    session.role === "owner" && program?.birthday_is_active
      ? db.getBirthdayCandidates(session.businessId, program.birthday_window_days)
      : Promise.resolve([]),
    // Anniversary cuma pesan ucapan, tidak ada bonus poin, jadi selalu tersedia.
    session.role === "owner"
      ? db.getAnniversaryCandidates(session.businessId, program?.birthday_window_days ?? 7)
      : Promise.resolve([]),
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
    <div className={mochiThemeClass(business)}>
      <LoyaltyClient
        business={business}
        initialProgram={program}
        customers={customers}
        memberInsights={memberInsights}
        rewards={rewards}
        staffList={users
          .filter((u) => u.role === "staff" && u.is_active)
          .map((u) => ({ id: u.id, name: u.name }))}
        staffAudit={staffAudit}
        initialCampaigns={campaigns}
        initialCampaignRecipients={latestCampaignRecipients}
        expiryDue={expiryDue}
        expirySoon={expirySoon}
        weeklySignups={weeklySignups}
        referralReport={referralReport}
        birthdayCandidates={birthdayCandidates}
        anniversaryCandidates={anniversaryCandidates}
        tiers={tiers}
        sessionRole={session.role}
      />
    </div>
  );
}
