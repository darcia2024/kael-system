import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { db } from "@/lib/db";
import { guardModulePage } from "@/lib/licensing";
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

  const [profile, program, rewards, ledger, redemptions] = await Promise.all([
    db.getCustomerProfileSummary(customerId, session.businessId),
    db.getLoyaltyProgram(session.businessId),
    db.getRewards(session.businessId),
    db.getCustomerLedger(customerId),
    db.getRedemptions(customerId),
  ]);

  if (!profile || !program) notFound();

  const tiers = program.tiers_is_active ? await db.getLoyaltyTiers(session.businessId) : [];

  return (
    <MemberProfileClient
      profile={profile}
      program={program}
      rewards={rewards}
      ledger={ledger}
      redemptions={redemptions}
      tiers={tiers}
    />
  );
}
