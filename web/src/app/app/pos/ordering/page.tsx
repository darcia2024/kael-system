import { db } from "@/lib/db";
import { guardOwnerPage } from "@/lib/licensing";
import OrderingClient from "./ordering-client";

export default async function OrderingPage() {
  const session = await guardOwnerPage("/app/pos/ordering");
  return <OrderingClient initial={await db.getOrderingSettings(session.businessId) as never} />;
}
