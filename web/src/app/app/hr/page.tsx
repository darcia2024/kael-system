import { db } from "@/lib/db";
import { guardOwnerPage } from "@/lib/licensing";
import { mochiThemeClass } from "@/lib/mochi-theme";
import HrClient from "./hr-client";

export default async function HrPage() {
  const session = await guardOwnerPage("/app/hr");
  const [data, business] = await Promise.all([
    db.getHrDashboard(session.businessId),
    db.getBusiness(session.businessId),
  ]);
  return (
    <div className={mochiThemeClass(business)}>
      <HrClient
        data={data as never}
        business={business}
        themeClassName={mochiThemeClass(business)}
      />
    </div>
  );
}
