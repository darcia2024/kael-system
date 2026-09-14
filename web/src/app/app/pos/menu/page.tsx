import type { Metadata } from "next";

import { db } from "@/lib/db";
import { guardOwnerPage } from "@/lib/licensing";
import { mochiThemeClass } from "@/lib/mochi-theme";
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
};

export default async function MenuPage() {
  const session = await guardOwnerPage("/app/pos/menu");

  const [business, categories, menuItems, recipes] = await Promise.all([
    db.getBusiness(session.businessId),
    db.getCategories(session.businessId),
    db.getMenuItems(session.businessId),
    // Menautkan menu ke resep membuat HPP dan potongan stok ikut jalan. Boleh
    // dilewati: menu tanpa resep tetap bisa dijual, cuma tidak punya angka HPP.
    db.getRecipes(session.businessId),
  ]);

  return (
    <MenuClient
      business={business}
      categories={categories}
      menuItems={menuItems}
      recipes={recipes.map((r) => ({ id: r.id, name: r.name }))}
      themeClassName={mochiThemeClass(business)}
    />
  );
}
