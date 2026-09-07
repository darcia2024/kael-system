import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import PublicBookingManageClient from "./public-booking-manage-client";

export const dynamic = "force-dynamic";

export default async function BookingManagePage({ params }: { params: Promise<{ storeCode: string; token: string }> }) {
  const { storeCode, token } = await params;
  const appointment = await db.getPublicAppointment(token);
  if (!appointment || String((appointment as { store_code?: string }).store_code).toUpperCase() !== decodeURIComponent(storeCode).toUpperCase()) notFound();
  return <PublicBookingManageClient appointment={appointment as never} />;
}
