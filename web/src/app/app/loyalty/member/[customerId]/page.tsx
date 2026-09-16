import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { db } from "@/lib/db";
import { guardModulePage } from "@/lib/licensing";
import { mochiThemeClass } from "@/lib/mochi-theme";
import MemberProfileClient from "./member-profile-client";

export const metadata: Metadata = {
  title: "Profil Member | KAEL Loyalty",
  robots: { index: false, follow: false },
};

export default async function MemberProfilePage({
  params,
}: {
  params: Promise<{ customerId: string }>;
}) {
  const { customerId } = await params;
  const { session } = await guardModulePage("loyalty", `/app/loyalty/member/${customerId}`);

  const [business, profile, program, rewards, ledger, redemptions] = await Promise.all([
    db.getBusiness(session.businessId),
    db.getCustomerProfileSummary(customerId, session.businessId),
    db.getLoyaltyProgram(session.businessId),
    db.getRewards(session.businessId),
    db.getCustomerLedger(customerId),
    db.getRedemptions(customerId),
  ]);

  if (!profile || !program) notFound();

  const tiers = program.tiers_is_active ? await db.getLoyaltyTiers(session.businessId) : [];

  const safeProfile = {
    ...profile,
    birthday: profile.birthday ? String(profile.birthday).slice(0, 10) : null,
    created_at: profile.created_at ? String(profile.created_at) : new Date().toISOString(),
    last_activity_at: profile.last_activity_at ? String(profile.last_activity_at) : null,
    lifetime_spend: Number(profile.lifetime_spend || 0),
    balance: Number(profile.balance || 0),
    purchase_count: Number(profile.purchase_count || 0),
    points_earned: Number(profile.points_earned || 0),
    phone: String(profile.phone || ""),
  };

  return (
    <MemberProfileClient
      business={business}
      themeClassName={mochiThemeClass(business)}
      profile={safeProfile}
      program={program}
      rewards={Array.isArray(rewards) ? rewards : []}
      ledger={Array.isArray(ledger) ? ledger : []}
      redemptions={Array.isArray(redemptions) ? redemptions : []}
      tiers={Array.isArray(tiers) ? tiers : []}
    />
  );
}
