import type { Metadata } from "next";
import { db } from "@/lib/db";
import { guardModulePage } from "@/lib/licensing";
import { mochiThemeClass } from "@/lib/mochi-theme";
import FinanceOperationsClient from "./operations-client";

export const metadata: Metadata = { title: "Keuangan Usaha | KAEL", robots: { index: false, follow: false } };

export default async function FinanceOperationsPage() {
  const { session } = await guardModulePage("finance", "/app/finance/operations");
  const [business, pockets, transactions, assets, inventory, summary] = await Promise.all([
    db.getBusiness(session.businessId), db.getFinancePockets(session.businessId),
    db.getFinanceTransactions(session.businessId), db.getFinanceAssets(session.businessId),
    db.getInventoryItems(session.businessId), db.getFinanceSummary(session.businessId),
  ]);
  return <FinanceOperationsClient business={business} pockets={pockets} transactions={transactions} assets={assets} inventory={inventory} summary={summary} themeClassName={mochiThemeClass(business)} />;
}
