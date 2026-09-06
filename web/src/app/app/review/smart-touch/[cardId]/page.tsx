import { notFound } from "next/navigation";

import { db } from "@/lib/db";
import { guardOwnerPage } from "@/lib/licensing";
import SmartTouchClient from "./smart-touch-client";

export default async function SmartTouchEditorPage({ params }: { params: Promise<{ cardId: string }> }) {
  const session = await guardOwnerPage("/app/review");
  const { cardId } = await params;
  const [card, business, profile] = await Promise.all([db.getCards(session.businessId).then(cards => cards.find(card => card.id === cardId && card.type === "link") ?? null), db.getBusiness(session.businessId), db.getSmartTouch(cardId, session.businessId)]);
  if (!card || !business) notFound();
  return <SmartTouchClient cardCode={card.card_code} cardId={card.id} businessName={business.name} profile={profile} />;
}
