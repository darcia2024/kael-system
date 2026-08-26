import type { Metadata } from "next";

import { db, DEFAULT_BUSINESS_ID } from "@/lib/db";
import RegisterClient from "./register-client";

/**
 * Pendaftaran member. Dibuka pelanggan setelah tap kartu meja, jadi tanpa
 * login. Yang dikirim ke browser hanya identitas bisnis dan aturan program;
 * pendaftarannya sendiri lewat server action.
 */

export const metadata: Metadata = {
  title: "Daftar Member",
  robots: { index: false, follow: false },
};

export default async function RegisterPage() {
  const [business, program] = await Promise.all([
    db.getBusiness(DEFAULT_BUSINESS_ID),
    db.getLoyaltyProgram(DEFAULT_BUSINESS_ID),
  ]);

  return <RegisterClient business={business} program={program} />;
}
