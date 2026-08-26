import type { Metadata } from "next";

import { db } from "@/lib/db";
import { guardModulePage } from "@/lib/licensing";
import FinanceClient from "./finance-client";

export const metadata: Metadata = {
  title: "KAEL Finance & HPP",
  robots: { index: false, follow: false },
};

export default async function FinancePage() {
  const { session } = await guardModulePage("finance", "/app/finance");

  const [business, recipes, ingredients] = await Promise.all([
    db.getBusiness(session.businessId),
    db.getRecipes(session.businessId),
    db.getIngredients(session.businessId),
  ]);

  return (
    <FinanceClient
      business={business}
      initialRecipes={recipes}
      initialIngredients={ingredients}
    />
  );
}
