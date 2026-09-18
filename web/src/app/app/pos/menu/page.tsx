import type { Metadata } from "next";

import { db } from "@/lib/db";
import { guardOwnerPage } from "@/lib/licensing";
import { mochiThemeClass } from "@/lib/mochi-theme";
import { ownerAppMetadata } from "@/lib/owner-app";
import MenuClient from "./menu-client";

/**
 * Pengelolaan daftar menu.
 *
 * Khusus pemilik. Menyusun apa yang dijual dan berapa harganya bukan wewenang
 * kasir — kasir hanya menandai menu yang habis, lewat layar kasirnya sendiri.
 *
 * Sebelum halaman ini ada, menu cuma bisa lahir dari skrip seed: pemilik usaha
 * yang baru berlangganan tidak punya cara memasukkan satu pun menunya sendiri.
 */

export const metadata: Metadata = {
  title: "Kelola Menu",
  robots: { index: false, follow: false },
  // Halaman ini menampilkan banner pasang aplikasi; yang dipasang harus KAEL Owner.
  ...ownerAppMetadata,
};

export default async function MenuPage() {
  const session = await guardOwnerPage("/app/pos/menu");

  const [business, categories, menuItems, recipeCalcs] = await Promise.all([
    db.getBusiness(session.businessId),
    db.getCategories(session.businessId),
    db.getMenuItems(session.businessId),
    // Menautkan menu ke resep membuat HPP dan potongan stok ikut jalan. Boleh
    // dilewati: menu tanpa resep tetap bisa dijual dengan input modal manual.
    db.getAllRecipesWithCalculations(session.businessId),
  ]);

  return (
    <MenuClient
      business={business}
      categories={categories}
      menuItems={menuItems}
      recipes={recipeCalcs.map((c) => ({
        id: c.recipe.id,
        name: c.recipe.name,
        hpp: c.calc.hpp_per_unit || 0,
      }))}
      themeClassName={mochiThemeClass(business)}
    />
  );
}
