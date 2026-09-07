import { redirect } from "next/navigation";
import { requireStaff } from "@/lib/auth";
import { db } from "@/lib/db";
import LeaveClient from "./leave-client";

export default async function LeavePage() {
  try {
    const session = await requireStaff();
    const requests = await db.getLeaveRequestsForUser(session.businessId, session.userId);
    return <LeaveClient staffName={session.name} requests={requests as unknown as { id: string; leave_type: string; starts_at: string; ends_at: string; reason: string; status: string }[]} />;
  } catch { redirect("/app/login?next=/app/hr/leave"); }
}
