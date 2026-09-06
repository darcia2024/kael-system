import { db } from "@/lib/db";
import { guardOwnerPage } from "@/lib/licensing";
import BookingClient from "./booking-client";

export default async function BookingPage() {
  const session = await guardOwnerPage("/app/booking");
  const data = await db.getBookingDashboard(session.businessId);
  return <BookingClient data={data as never} />;
}
