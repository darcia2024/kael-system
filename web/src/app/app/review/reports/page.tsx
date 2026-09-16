import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { guardModulePage } from "@/lib/licensing";
import { mochiThemeClass } from "@/lib/mochi-theme";
import ReviewReportsClient from "./review-reports-client";

export const metadata: Metadata = {
  title: "Laporan Review & Keluhan Pelanggan | KAEL",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function ReviewReportsPage() {
  const { session } = await guardModulePage("review", "/app/review/reports");

  const [business, rawFeedbacks, feedbackSummary] = await Promise.all([
    db.getBusiness(session.businessId),
    db.getAllFeedback(session.businessId, 1000).catch(() => []),
    db.getFeedbackSummary(session.businessId).catch(() => ({ total: 0, avgRating: 0, lowCount: 0, byReason: [] })),
  ]);

  const feedbacks = (rawFeedbacks || []).map((f) => ({
    ...f,
    rating: Number(f.rating) || 0,
    created_at: f.created_at
      ? typeof f.created_at === "string"
        ? f.created_at
        : new Date(f.created_at).toISOString()
      : new Date().toISOString(),
  }));

  return (
    <ReviewReportsClient
      business={business}
      initialFeedbacks={feedbacks}
      initialSummary={feedbackSummary || { total: 0, avgRating: 0, lowCount: 0, byReason: [] }}
      themeClassName={mochiThemeClass(business)}
    />
  );
}
