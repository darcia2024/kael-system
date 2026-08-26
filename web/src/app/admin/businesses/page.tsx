import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { db } from "@/lib/db";
import { getSession } from "@/lib/auth";
import BusinessesClient from "./businesses-client";

/**
 * Panel pelanggan untuk tim KAEL.
 *
 * Di sinilah UMKM baru didaftarkan dan modul yang dibelinya ditentukan.
 * Sebelum halaman ini ada, menambah pelanggan berarti menjalankan skrip di
 * terminal, jadi tiap penjualan baru menyita waktu orang.
 *
 * Penjaga peran ada di sini DAN di dalam createBusinessAction serta
 * setBusinessModuleAction, karena Server Action bisa dipanggil lewat POST
 * langsung tanpa pernah membuka halaman ini.
 */

export const metadata: Metadata = {
  title: "Pelanggan KAEL",
  robots: { index: false, follow: false },
};

export default async function AdminBusinessesPage() {
  const session = await getSession();
  if (!session) redirect("/admin");
  if (session.role !== "kael_admin") redirect("/app");

  const businesses = await db.getAdminBusinessOverview();
  return <BusinessesClient initial={businesses} />;
}
