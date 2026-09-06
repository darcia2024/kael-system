import { db } from "@/lib/db";
import { guardOwnerPage } from "@/lib/licensing";
import HrClient from "./hr-client";

export default async function HrPage() {
  const session = await guardOwnerPage("/app/hr");
  const data = await db.getHrDashboard(session.businessId);
  return <HrClient data={data as never} />;
}
