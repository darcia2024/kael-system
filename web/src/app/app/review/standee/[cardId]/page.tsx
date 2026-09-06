import { notFound } from "next/navigation";

import { db } from "@/lib/db";
import { guardOwnerPage } from "@/lib/licensing";
import StandeeClient from "./standee-client";

export default async function ReviewStandeePage({ params }: { params: Promise<{ cardId: string }> }) {
  const session = await guardOwnerPage("/app/review");
  const { cardId } = await params;
  const [card, business, saved] = await Promise.all([
    db.getCards(session.businessId).then((cards) => cards.find((item) => item.id === cardId && item.type === "review") ?? null),
    db.getBusiness(session.businessId),
    db.getReviewStandee(cardId, session.businessId),
  ]);
  if (!card || !business) notFound();

  return <StandeeClient card={card} business={business} saved={saved as { headline?: string; body?: string; print_size?: "A6" | "A5" | "A4" } | null} />;
}
