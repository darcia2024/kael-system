import { Plus_Jakarta_Sans } from "next/font/google";

import { isMochiBusiness } from "@/lib/mochi-brand";

export const mochiFont = Plus_Jakarta_Sans({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-plus-jakarta-sans",
  weight: ["300", "400", "500", "600", "700", "800"],
});

export function mochiThemeClass(
  business: { store_code?: string | null; name?: string | null } | null | undefined
) {
  return isMochiBusiness(business) ? `${mochiFont.className} ${mochiFont.variable} mochi-ui font-jakarta` : "";
}
