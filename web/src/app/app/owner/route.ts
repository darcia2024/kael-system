import { NextResponse, type NextRequest } from "next/server";

import { getSession } from "@/lib/auth";
import { getModuleView, homeFor } from "@/lib/licensing";
import { OWNER_APP } from "@/lib/owner-app";

/**
 * Pintu masuk aplikasi KAEL Owner — `start_url` di /owner.webmanifest.
 *
 * Satu alamat tetap untuk semua toko, karena manifest tidak bisa tahu siapa
 * yang memasangnya. Ke mana owner dibawa diputuskan di sini, setiap kali
 * aplikasinya dibuka:
 *
 * - Toko yang memakai KAEL POS mendarat di dasbor owner, layar yang memang
 *   dibuka owner tiap hari.
 * - Toko tanpa POS — cukup loyalty atau review — mendarat di beranda bisnis.
 *   Kalau start_url langsung ke dasbor owner, toko seperti itu disambut
 *   "modul itu belum aktif" setiap kali membuka aplikasinya sendiri.
 * - Kasir yang terlanjur memasangnya dibawa ke berandanya sendiri.
 */
export async function GET(request: NextRequest) {
  const session = await getSession();

  if (!session) {
    // proxy.ts sudah menangani yang tidak punya cookie sama sekali. Yang
    // sampai di sini cookie-nya ada tapi tidak sah lagi, misalnya kedaluwarsa.
    const login = new URL("/app/login", request.url);
    login.searchParams.set("next", OWNER_APP.startUrl);
    return tanpaCache(NextResponse.redirect(login));
  }

  let tujuan = homeFor(session.role);
  if ((session.role === "owner" || session.role === "kael_admin") && session.businessId) {
    const pos = await getModuleView(session.businessId, "pos");
    if (pos.canRead) tujuan = "/app/pos/owner";
  }

  return tanpaCache(NextResponse.redirect(new URL(tujuan, request.url)));
}

/** Tujuannya bergantung pada sesi, jadi tidak boleh disimpan cache mana pun. */
function tanpaCache(res: NextResponse) {
  res.headers.set("Cache-Control", "private, no-store");
  return res;
}
