import type { Metadata } from "next";

import { db } from "@/lib/db";
import MemberClient from "./member-client";

/**
 * Halaman progres poin pelanggan.
 *
 * Terbuka tanpa login, dijaga hanya oleh token yang tidak bisa ditebak. Karena
 * itu pengambilan datanya terjadi di server dan hanya hasilnya yang dikirim ke
 * browser. Token tidak pernah ikut ke dalam props.
 */

export const metadata: Metadata = {
  title: "Kartu Member",
  // Halaman ini berisi data pribadi dan tidak boleh muncul di hasil pencarian.
  robots: { index: false, follow: false },
};

export default async function MemberPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const customer = await db.getCustomerByToken(token);

  if (!customer) {
    return (
      <MemberClient
        customer={null}
        business={null}
        program={null}
        rewards={[]}
        balance={0}
        ledger={[]}
        redemptions={[]}
        referralCode={null}
        tiers={[]}
        lifetimeSpend={0}
      />
    );
  }

  const [business, program, rewards, balance, ledger, redemptions] = await Promise.all([
    db.getBusiness(customer.business_id),
    db.getLoyaltyProgram(customer.business_id),
    db.getRewards(customer.business_id),
    db.getCustomerPointBalance(customer.id),
    db.getCustomerLedger(customer.id),
    db.getRedemptions(customer.id),
  ]);

  /**
   * Kode dicetak malas, hanya kalau program referral menyala. Bisnis yang
   * tidak pernah mengaktifkan referral tidak perlu satu baris pun di
   * loyalty_codes untuk tiap membernya.
   */
  const referralCode = program?.referral_is_active
    ? await db.getOrCreateReferralCode(customer.business_id, customer.id)
    : null;

  // Level dihitung di klien dari lifetime_spend — sama seperti alasan progress
  // reward juga dihitung di klien, bukan di server: cuma perbandingan angka.
  const [tiers, lifetimeSpend] = program?.tiers_is_active
    ? await Promise.all([
        db.getLoyaltyTiers(customer.business_id),
        db.getCustomerLifetimeSpend(customer.business_id, customer.id),
      ])
    : [[], 0];

  return (
    <MemberClient
      customer={customer}
      business={business}
      program={program}
      rewards={rewards.filter((r) => r.is_active)}
      balance={balance}
      ledger={ledger}
      redemptions={redemptions}
      referralCode={referralCode}
      tiers={tiers}
      lifetimeSpend={lifetimeSpend}
    />
  );
}
