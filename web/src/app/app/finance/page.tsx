import type { Metadata } from "next";

import { db } from "@/lib/db";
import { guardModulePage } from "@/lib/licensing";
import { mochiThemeClass } from "@/lib/mochi-theme";
import FinanceClient from "./finance-client";

export const metadata: Metadata = {
  title: "KAEL Finance & HPP",
  robots: { index: false, follow: false },
};

export default async function FinancePage() {
  const { session } = await guardModulePage("finance", "/app/finance");

  const [business, recipes, ingredients, calculatorPresets, menuItems, categories] =
    await Promise.all([
      db.getBusiness(session.businessId),
      db.getRecipes(session.businessId),
      db.getIngredients(session.businessId),
      db.getFinanceCalculatorPresets(session.businessId),
      /**
       * Menu POS ikut dimuat supaya katalog resep tidak mulai dari halaman
       * kosong. Nama, kategori, dan harga jualnya sudah ada di sistem — memaksa
       * owner mengetik ulang 169 menu satu per satu cuma memindahkan pekerjaan
       * yang sebenarnya sudah selesai.
       */
      db.getMenuItems(session.businessId),
      db.getCategories(session.businessId),
    ]);

  const namaKategori = new Map(categories.map((c) => [c.id, c.name]));

  return (
    <FinanceClient
      business={business}
      initialRecipes={recipes}
      initialIngredients={ingredients}
      initialCalculatorPresets={calculatorPresets}
      menuItems={menuItems.map((m) => ({
        id: m.id,
        name: m.name,
        price: Number(m.price),
        category: m.category_id ? (namaKategori.get(m.category_id) ?? null) : null,
        recipe_id: m.recipe_id ?? null,
        cost_price: Number(m.cost_price ?? 0),
      }))}
      themeClassName={mochiThemeClass(business)}
    />
  );
}
