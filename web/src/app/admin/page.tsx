import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { db, DEFAULT_BUSINESS_ID } from "@/lib/db";
import { getSession } from "@/lib/auth";
import LoginClient from "@/app/app/login/login-client";

/**
 * Pintu masuk tim KAEL.
 *
 * Tab admin sudah dicabut dari layar login publik, jadi satu-satunya jalan ke
 * sini adalah mengetik /admin. Itu menyembunyikan, bukan mengamankan: yang
 * benar-benar menahan tetap kata sandi, penguncian lima percobaan, dan
 * pemeriksaan peran di setiap halaman serta setiap server action.
 */

export const metadata: Metadata = {
  title: "Masuk Tim KAEL",
  robots: { index: false, follow: false },
};

export default async function AdminEntryPage() {
  const session = await getSession();

  // Sudah masuk sebagai tim KAEL, langsung ke panel kartu.
  if (session?.role === "kael_admin") redirect("/admin/cards");
  // Sudah masuk sebagai pemilik atau staf, tidak ada urusan di sini.
  if (session) redirect("/app");

  // Pemilih toko dan daftar staf tidak dipakai di mode admin, tapi propsnya
  // tetap wajib diisi.
  const business = await db.getBusiness(DEFAULT_BUSINESS_ID);

  return (
    <LoginClient
      initialBusiness={business}
      availableStores={[]}
      initialStaffList={[]}
      nextPath="/admin/cards"
      adminMode
    />
  );
}
