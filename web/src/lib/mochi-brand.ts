import type { Business } from "@/lib/types";

export function isMochiBusiness(business: { store_code?: string | null; name?: string | null } | null | undefined) {
  if (!business) return false;
  const storeCode = business.store_code?.toUpperCase();

  // KAEL Cafe Demo is configured as the live demo counterpart for Mochi Cafe.
  if (storeCode === "MOCHIKAFE" || storeCode === "KAELCAFE") return true;
  const name = business.name?.toLowerCase() || "";
  return name.includes("mochi");
}
