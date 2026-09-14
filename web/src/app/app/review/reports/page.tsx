import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { guardOwnerPage } from "@/lib/licensing";
import { mochiThemeClass } from "@/lib/mochi-theme";
import ReviewReportsClient from "./review-reports-client";

export const metadata: Metadata = {
  title: "Laporan Review & Keluhan Pelanggan | KAEL",
  robots: { index: false, follow: false },
};

export const revalidate = 0;

export default async function ReviewReportsPage() {
  const session = await guardOwnerPage("/app/review/reports");
  if (session.role !== "owner") {
    redirect("/app/pos");
  }

  const [business, feedbacks, feedbackSummary] = await Promise.all([
    db.getBusiness(session.businessId),
    db.getAllFeedback(session.businessId, 1000),
    db.getFeedbackSummary(session.businessId),
  ]);

  return (
    <ReviewReportsClient
      business={business}
      initialFeedbacks={feedbacks}
      initialSummary={feedbackSummary}
      themeClassName={mochiThemeClass(business)}
    />
  );
}
