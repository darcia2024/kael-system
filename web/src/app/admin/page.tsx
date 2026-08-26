import type { Metadata } from "next";
import { redirect } from "next/navigation";

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

  // Sudah masuk sebagai tim KAEL, langsung ke panel pelanggan.
  if (session?.role === "kael_admin") redirect("/admin/businesses");
  // Sudah masuk sebagai pemilik atau staf, tidak ada urusan di sini.
  if (session) redirect("/app");

  return <LoginClient nextPath="/admin/businesses" adminMode />;
}
