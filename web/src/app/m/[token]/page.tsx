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

  return (
    <MemberClient
      customer={customer}
      business={business}
      program={program}
      rewards={rewards.filter((r) => r.is_active)}
      balance={balance}
      ledger={ledger}
      redemptions={redemptions}
    />
  );
}
