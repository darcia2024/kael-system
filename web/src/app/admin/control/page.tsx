import { redirect } from "next/navigation";

import { getSession } from "@/lib/auth";
import { db } from "@/lib/db";
import ControlClient from "./control-client";
import Link from 'next/link';

export default async function AdminControlPage() {
  const session = await getSession();
  if (!session) redirect("/admin");
  if (session.role !== "kael_admin") redirect("/app");
  return <><nav className="bg-white p-4"><Link className="inline-flex min-h-11 items-center rounded-lg border px-4 font-bold" href="/admin/demo">Buat demo kafe</Link></nav><ControlClient data={await db.getAdminControlCenter() as never} /></>;
}
