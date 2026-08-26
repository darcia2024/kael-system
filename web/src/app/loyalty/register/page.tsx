import type { Metadata } from "next";

import { db } from "@/lib/db";
import RegisterClient from "./register-client";

/**
 * Pendaftaran member. Dibuka pelanggan setelah tap kartu meja, jadi tanpa
 * login. Yang dikirim ke browser hanya identitas bisnis dan aturan program;
 * pendaftarannya sendiri lewat server action.
 */

/**
 * Dicache 5 menit, bukan dibekukan saat build.
 *
 * Tanpa ini Next memprerender halaman ini sekali saja, sehingga perubahan nama
 * bisnis atau kurs poin tidak pernah muncul sampai deploy berikutnya. Perubahan
 * program juga memanggil revalidatePath untuk jalur ini, jadi umumnya langsung
 * terlihat; angka 300 detik hanya jaring pengaman.
 */
export const revalidate = 300;

export const metadata: Metadata = {
  title: "Daftar Member",
  robots: { index: false, follow: false },
};

export default async function RegisterPage() {
  const business = await db.getBusiness();
  const program = business ? await db.getLoyaltyProgram(business.id) : null;

  return <RegisterClient business={business} program={program} />;
}
