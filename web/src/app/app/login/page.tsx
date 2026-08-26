import type { Metadata } from "next";

import LoginClient from "./login-client";

/**
 * Layar masuk publik.
 *
 * TIDAK mengambil data apa pun dari database.
 *
 * Versi sebelumnya memanggil getBusinesses() dan menyalurkan seluruh daftar
 * bisnis ke halaman ini, sehingga siapa pun yang membukanya bisa membaca nama
 * setiap UMKM yang memakai KAEL, lengkap dengan nama stafnya. Itu membocorkan
 * daftar pelanggan KAEL ke internet, dan membuat tiap UMKM tahu pesaingnya
 * memakai sistem yang sama.
 *
 * Sekarang: owner masuk lewat email, dan bisnisnya diambil dari akunnya. Staf
 * memasukkan kode toko sekali, lalu perangkat kasir mengingatnya.
 */

export const metadata: Metadata = {
  title: "Login Portal KAEL",
  robots: { index: false, follow: false },
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; toko?: string }>;
}) {
  const { next, toko } = await searchParams;

  // Hanya menerima jalur internal, supaya ?next= tidak bisa dipakai
  // mengarahkan orang ke situs lain setelah login.
  const safeNext = next && next.startsWith("/") && !next.startsWith("//") ? next : "/app";

  return <LoginClient nextPath={safeNext} presetStoreCode={toko ?? null} />;
}
