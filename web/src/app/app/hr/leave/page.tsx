import { redirect } from "next/navigation";
import { requireStaff } from "@/lib/auth";
import { db } from "@/lib/db";
import { mochiThemeClass } from "@/lib/mochi-theme";
import LeaveClient from "./leave-client";

export default async function LeavePage() {
  try {
    const session = await requireStaff();
    const [requests, business] = await Promise.all([
      db.getLeaveRequestsForUser(session.businessId, session.userId),
      db.getBusiness(session.businessId),
    ]);
    return (
      <div className={mochiThemeClass(business)}>
        <LeaveClient
          staffName={session.name}
          business={business}
          themeClassName={mochiThemeClass(business)}
          requests={
            requests as unknown as {
              id: string;
              leave_type: string;
              starts_at: string;
              ends_at: string;
              reason: string;
              status: string;
            }[]
          }
        />
      </div>
    );
  } catch {
    redirect("/app/login?next=/app/hr/leave");
  }
}
