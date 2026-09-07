import { redirect } from "next/navigation";

import { getSession } from "@/lib/auth";
import AttendanceClient from "./attendance-client";

export default async function AttendancePage({ searchParams }: { searchParams: Promise<{ site?: string; method?: string }> }) {
  const session = await getSession();
  if (!session?.businessId || !["owner", "staff"].includes(session.role)) redirect("/app/login?next=/app/hr/attendance");
  const { site, method } = await searchParams;
  return <AttendanceClient staffName={session.name} siteToken={site ?? null} method={method === "nfc" ? "nfc" : site ? "qr" : "self"} />;
}
