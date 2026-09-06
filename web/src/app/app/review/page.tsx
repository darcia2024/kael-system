import type { Metadata } from "next";

import { db } from "@/lib/db";
import { guardModulePage } from "@/lib/licensing";
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
  const { session } = await guardModulePage("review", "/app/review");

  const [business, cards, rawTaps, googleReport, suspiciousTaps] = await Promise.all([
    db.getBusiness(session.businessId),
    db.getCards(session.businessId),
    db.getCardTaps(session.businessId),
    db.getGoogleReviewReport(session.businessId),
    db.getSuspiciousCardTaps(session.businessId),
  ]);

  return (
    <ReviewClient
      business={business}
      cards={cards}
      rawTaps={rawTaps}
      googleReport={googleReport}
      suspiciousTapCount={suspiciousTaps.length}
      sessionRole={session.role === "owner" ? "owner" : "staff"}
    />
  );
}
