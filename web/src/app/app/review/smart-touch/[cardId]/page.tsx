import { notFound } from "next/navigation";

import { db } from "@/lib/db";
import { buildGoogleReviewUrl } from "@/lib/google-places";
import { guardOwnerPage } from "@/lib/licensing";
import SmartTouchClient from "./smart-touch-client";

export default async function SmartTouchEditorPage({ params }: { params: Promise<{ cardId: string }> }) {
  const session = await guardOwnerPage("/app/review");
  const { cardId } = await params;
  // Editor ini hanya untuk kartu yang layanannya memang Smart Touch. Dulu
  // filternya `link`, dan itulah pintu yang bikin kartu tautan diam-diam
  // menumbuhkan tombol Smart Touch lalu berhenti membuka tautannya sendiri.
  const [card, business, profile] = await Promise.all([db.getCards(session.businessId).then(cards => cards.find(card => card.id === cardId && card.type === "smart_touch") ?? null), db.getBusiness(session.businessId), db.getSmartTouch(cardId, session.businessId)]);
  if (!card || !business) notFound();
  return <SmartTouchClient cardCode={card.card_code} cardId={card.id} businessName={business.name} googleReviewUrl={business.google_place_id ? buildGoogleReviewUrl(business.google_place_id) : null} profile={profile} />;
}
