import type { Metadata } from "next";

import { db, DEFAULT_BUSINESS_ID } from "@/lib/db";
import LoginClient from "./login-client";

/**
 * Halaman masuk.
 *
 * Daftar staf diambil di server supaya kasir bisa memilih namanya sebelum
 * memasukkan PIN. Hanya id dan nama yang diteruskan; pin_hash tidak pernah
 * ikut ke browser.
 */

export const metadata: Metadata = {
  title: "Masuk",
  robots: { index: false, follow: false },
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next } = await searchParams;
  const users = await db.getUsers(DEFAULT_BUSINESS_ID);

  const staffList = users
    .filter((u) => u.role === "staff" && u.is_active)
    .map((u) => ({ id: u.id, name: u.name }));

  // Hanya menerima jalur internal, supaya ?next= tidak bisa dipakai
  // mengarahkan orang ke situs lain setelah login.
  const safeNext = next && next.startsWith("/") && !next.startsWith("//") ? next : "/app";

  return (
    <LoginClient
      businessId={DEFAULT_BUSINESS_ID}
      staffList={staffList}
      nextPath={safeNext}
    />
  );
}
