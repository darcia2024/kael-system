import { NextResponse } from "next/server";

import { db } from "@/lib/db";
import { getGoogleReviewSnapshot } from "@/lib/google-places";

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return new NextResponse("Unauthorized", { status: 401 });
  }
  const businesses = await db.getBusinessesWithGooglePlace();
  let synced = 0;
  for (const business of businesses) {
    const snapshot = await getGoogleReviewSnapshot(business.google_place_id);
    if (!snapshot) continue;
    await db.createGoogleReviewSnapshot(business.id, { googlePlaceId: business.google_place_id, ...snapshot });
    synced += 1;
  }
  return NextResponse.json({ synced, scanned: businesses.length });
}
