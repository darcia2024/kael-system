import type { Metadata } from "next";

import { db } from "@/lib/db";
import { guardModulePage } from "@/lib/licensing";
import { mochiThemeClass } from "@/lib/mochi-theme";
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

  const [business, cards, rawTaps, googleReport, suspiciousTaps, rawFeedbacks, feedbackSummary] = await Promise.all([
    db.getBusiness(session.businessId),
    db.getCards(session.businessId),
    db.getCardTaps(session.businessId),
    db.getGoogleReviewReport(session.businessId),
    db.getSuspiciousCardTaps(session.businessId),
    db.getAllFeedback(session.businessId, 50),
    db.getFeedbackSummary(session.businessId),
  ]);

  const feedbacks = (rawFeedbacks || []).map((f) => ({
    ...f,
    created_at: f.created_at
      ? typeof f.created_at === "string"
        ? f.created_at
        : new Date(f.created_at).toISOString()
      : new Date().toISOString(),
  }));

  return (
    <div className={mochiThemeClass(business)}>
      <ReviewClient
        business={business}
        cards={cards}
        rawTaps={rawTaps}
        googleReport={googleReport}
        suspiciousTapCount={suspiciousTaps.length}
        feedbacks={feedbacks}
        feedbackSummary={feedbackSummary || { total: 0, avgRating: 0, lowCount: 0, byReason: [] }}
        sessionRole={session.role === "owner" ? "owner" : "staff"}
        themeClassName={mochiThemeClass(business)}
      />
    </div>
  );
}
