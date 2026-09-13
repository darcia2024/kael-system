import { db } from "@/lib/db";
import { guardOwnerPage } from "@/lib/licensing";
import { mochiThemeClass } from "@/lib/mochi-theme";
import OrderingClient from "./ordering-client";

export default async function OrderingPage() {
  const session = await guardOwnerPage("/app/pos/ordering");
  const [business, settings] = await Promise.all([
    db.getBusiness(session.businessId),
    db.getOrderingSettings(session.businessId),
  ]);
  return <OrderingClient initial={settings as never} themeClassName={mochiThemeClass(business)} />;
}
