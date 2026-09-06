import { redirect } from "next/navigation";

import { getSession } from "@/lib/auth";
import AttendanceClient from "./attendance-client";

export default async function AttendancePage({ searchParams }: { searchParams: Promise<{ card?: string }> }) {
  const session = await getSession();
  if (!session?.businessId || !["owner", "staff"].includes(session.role)) redirect("/app/login?next=/app/hr/attendance");
  const { card } = await searchParams;
  return <AttendanceClient staffName={session.name} cardCode={card ?? null} />;
}
