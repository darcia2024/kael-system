import { Plus_Jakarta_Sans } from "next/font/google";

import type { Business } from "@/lib/types";
import { isMochiBusiness } from "@/lib/mochi-brand";

export const mochiFont = Plus_Jakarta_Sans({
  subsets: ["latin"],
  display: "swap",
});

export function mochiThemeClass(business: Pick<Business, "store_code"> | null | undefined) {
  return isMochiBusiness(business) ? `${mochiFont.className} mochi-ui` : "";
}
