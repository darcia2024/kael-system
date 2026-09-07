import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import PublicBookingClient from "./public-booking-client";

export const dynamic = "force-dynamic";

export default async function PublicBookingPage({ params }: { params: Promise<{ storeCode: string }> }) {
  const { storeCode } = await params;
  const context = await db.getPublicBookingContext(decodeURIComponent(storeCode));
  if (!context) notFound();
  return <PublicBookingClient context={context as never} />;
}
