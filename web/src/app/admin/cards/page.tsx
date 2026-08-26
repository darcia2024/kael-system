import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { db } from "@/lib/db";
import { getSession } from "@/lib/auth";
import CardsClient from "./cards-client";

/**
 * Panel penerbitan kartu untuk tim KAEL.
 *
 * Sebelumnya halaman ini terbuka untuk siapa saja yang tahu URL-nya. Penjaga
 * peran sekarang ada di sini, dan sekali lagi di dalam issueCardsAction, karena
 * Server Action bisa dipanggil langsung lewat POST tanpa membuka halaman ini.
 */

export const metadata: Metadata = {
  title: "Penerbitan Kartu",
  robots: { index: false, follow: false },
};

export default async function AdminCardsPage() {
  const session = await getSession();
  if (!session) redirect("/app/login?next=/admin/cards");
  if (session.role !== "kael_admin") redirect("/app");

  const cards = await db.getAllCards();
  return <CardsClient initialCards={cards} />;
}
