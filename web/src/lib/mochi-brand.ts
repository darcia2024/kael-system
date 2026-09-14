export const MOCHI_LOGO_URL = "/logo-mochi.png";

export function isMochiBusiness(business: { store_code?: string | null; name?: string | null } | null | undefined) {
  if (!business) return false;
  const storeCode = business.store_code?.toUpperCase();

  // KAEL Cafe Demo is configured as the live demo counterpart for Mochi Cafe.
  if (storeCode === "MOCHIKAFE" || storeCode === "KAELCAFE") return true;
  const name = business.name?.toLowerCase() || "";
  return name.includes("mochi");
}

export function getMochiLogoUrl(business?: { store_code?: string | null; name?: string | null; logo_url?: string | null } | null): string | null {
  if (isMochiBusiness(business)) return MOCHI_LOGO_URL;
  return business?.logo_url || null;
}
