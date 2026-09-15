import { notFound } from "next/navigation";

import { db } from "@/lib/db";
import { buildGoogleReviewUrl } from "@/lib/google-places";
import { guardOwnerPage } from "@/lib/licensing";
import { mochiThemeClass } from "@/lib/mochi-theme";
import SmartTouchClient from "./smart-touch-client";

export default async function SmartTouchEditorPage({ params }: { params: Promise<{ cardId: string }> }) {
  const session = await guardOwnerPage("/app/review");
  const { cardId } = await params;
  const [card, business, profile] = await Promise.all([db.getCards(session.businessId).then(cards => cards.find(card => card.id === cardId && card.type === "smart_touch") ?? null), db.getBusiness(session.businessId), db.getSmartTouch(cardId, session.businessId)]);
  if (!card || !business) notFound();
  return (
    <div className={mochiThemeClass(business)}>
      <SmartTouchClient cardCode={card.card_code} cardId={card.id} businessName={business.name} googleReviewUrl={business.google_place_id ? buildGoogleReviewUrl(business.google_place_id) : null} profile={profile} />
    </div>
  );
}
