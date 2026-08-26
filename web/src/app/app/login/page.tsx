import type { Metadata } from "next";

import { db, DEFAULT_BUSINESS_ID } from "@/lib/db";
import LoginClient from "./login-client";

export const metadata: Metadata = {
  title: "Login Portal KAEL",
  robots: { index: false, follow: false },
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; store?: string }>;
}) {
  const { next, store } = await searchParams;
  
  const [businesses, initialBusiness, users] = await Promise.all([
    db.getBusinesses(),
    db.getBusiness(store || DEFAULT_BUSINESS_ID),
    db.getUsers(store || DEFAULT_BUSINESS_ID),
  ]);

  const staffList = users
    .filter((u) => u.role === "staff" && u.is_active)
    .map((u) => ({ id: u.id, name: u.name }));

  const availableStores = businesses.map((b) => ({
    id: b.id,
    name: b.name,
    category: b.category,
    brand_color: b.brand_color,
  }));

  const safeNext = next && next.startsWith("/") && !next.startsWith("//") ? next : "/app";

  return (
    <LoginClient
      initialBusiness={initialBusiness}
      availableStores={availableStores}
      initialStaffList={staffList}
      nextPath={safeNext}
    />
  );
}
