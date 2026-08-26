import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { db } from "@/lib/db";
import { getSession } from "@/lib/auth";
import ReviewClient from "./review-client";

/**
 * Dashboard KAEL Review untuk owner.
 *
 * Angka tap dikirim mentah lalu dibersihkan di klien sebelum ditampilkan, jadi
 * data aslinya tetap utuh di card_taps dan aturan pembersihan bisa diubah
 * kapan saja tanpa kehilangan riwayat.
 */

export const metadata: Metadata = {
  title: "KAEL Review",
  robots: { index: false, follow: false },
};

export default async function ReviewDashboardPage() {
  const session = await getSession();
  if (!session) redirect("/app/login?next=/app/review");
  if (!session.businessId) redirect("/app/login");
  /**
   * Karyawan hanya boleh membuka modul yang diberikan owner. Cek yang sama
   * diulang di dalam server action, karena action bisa dipanggil lewat POST
   * tanpa membuka halaman ini.
   */
  if (session.role === "staff" && !session.permissions?.includes("review")) {
    redirect("/app?ditolak=review");
  }

  const [business, cards, rawTaps] = await Promise.all([
    db.getBusiness(session.businessId),
    db.getCards(session.businessId),
    db.getCardTaps(session.businessId),
  ]);

  return <ReviewClient business={business} cards={cards} rawTaps={rawTaps} />;
}
