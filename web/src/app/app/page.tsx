import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { db } from "@/lib/db";
import { getSession } from "@/lib/auth";
import PortalClient from "./portal-client";

/**
 * Beranda aplikasi setelah masuk.
 *
 * Penjagaan peran ada di sini, bukan hanya di proxy.ts. Proxy hanya memeriksa
 * keberadaan cookie tanpa memverifikasinya, dan dokumentasi Next menyatakan
 * proxy bukan tempat untuk otorisasi.
 */

export const metadata: Metadata = {
  title: "Beranda Bisnis",
  robots: { index: false, follow: false },
};

export default async function AppPortalPage() {
  const session = await getSession();
  if (!session) redirect("/app/login?next=/app");
  if (session.role === "kael_admin") redirect("/admin/cards");
  if (!session.businessId) redirect("/app/login");

  const [business, modules, users] = await Promise.all([
    db.getBusiness(session.businessId),
    db.getModules(session.businessId),
    // Kasir tidak perlu melihat daftar akun; hanya owner yang mengelolanya.
    session.role === "owner" ? db.getUsers(session.businessId) : Promise.resolve([]),
  ]);

  return (
    <PortalClient
      business={business}
      modules={modules}
      users={users}
      sessionName={session.name}
      sessionRole={session.role}
      sessionPermissions={session.permissions ?? []}
    />
  );
}
