import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { db } from "@/lib/db";
import { getSession } from "@/lib/auth";
import FinanceClient from "./finance-client";

export const metadata: Metadata = {
  title: "KAEL Finance & HPP",
  robots: { index: false, follow: false },
};

export default async function FinancePage() {
  const session = await getSession();
  if (!session) redirect("/app/login?next=/app/finance");
  if (!session.businessId) redirect("/app/login");
  if (session.role !== "owner" && session.role !== "kael_admin") redirect("/app");

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
