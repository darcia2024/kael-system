import { db } from "@/lib/db";
import { guardOwnerPage } from "@/lib/licensing";
import { mochiThemeClass } from "@/lib/mochi-theme";
import BrandClient from "./brand-client";

export default async function BrandSettingsPage() {
  const session = await guardOwnerPage("/app/settings/brand");
  const [business, brand, channel] = await Promise.all([db.getBusiness(session.businessId), db.getBrandSettings(session.businessId), db.getMessagingChannel(session.businessId)]);
  return <BrandClient themeClassName={mochiThemeClass(business)} business={business ? { name: business.name, brandColor: business.brand_color, customDomain: business.custom_domain ?? null } : null} brand={brand} channel={channel} />;
}
