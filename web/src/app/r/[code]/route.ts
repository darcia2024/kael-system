import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { normalizeCardCode } from "@/lib/card-code";

/**
 * KAEL System · NFC/QR Card Redirect Endpoint (Fondasi Bersama 1.5 & KAEL Review 3.1)
 * 
 * Endpoint: GET r.kael.id/{card_code} / /r/[code]
 * Target Latensi: < 500 ms
 * Kode HTTP: 302 (Temporary Redirect) - BUKAN 301 agar URL dapat diperbarui kapan saja oleh owner.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ code: string }> }
) {
  const { code } = await params;
  const rawCode = normalizeCardCode(code);
  const searchParams = request.nextUrl.searchParams;
  const source = searchParams.get("src") === "qr" ? "qr" : "nfc";
  const userAgent = request.headers.get("user-agent") || "";
  const forwardedFor = request.headers.get("x-forwarded-for") || "127.0.0.1";
  const clientIp = forwardedFor.split(",")[0].trim();

  // 1. Cari kartu di database
  const card = db.getCardByCode(rawCode);

  // Kasus A: Kartu tidak ditemukan
  if (!card) {
    const statusUrl = new URL(`/r/status?type=not_found&code=${encodeURIComponent(rawCode)}`, request.url);
    return NextResponse.redirect(statusUrl, 302);
  }

  // Kasus B: Kartu belum diaktivasi -> Arahkan ke alur aktivasi
  if (card.status === "unactivated") {
    const activateUrl = new URL(`/activate/${encodeURIComponent(card.card_code)}`, request.url);
    return NextResponse.redirect(activateUrl, 302);
  }

  // Kasus C: Kartu disuspend / dinonaktifkan
  if (card.status === "suspended") {
    const statusUrl = new URL(`/r/status?type=suspended`, request.url);
    return NextResponse.redirect(statusUrl, 302);
  }

  // Kasus D: Kartu Aktif
  // Catat tap secara asinkron (non-blocking agar redirect di bawah 500ms)
  db.recordCardTap(card.id, source, clientIp, userAgent).catch((err) => {
    console.error("[KAEL Tap Logging Error]", err);
  });

  // Tipe: KAEL Review
  if (card.type === "review") {
    const destination = card.destination_url || "https://google.com";
    return NextResponse.redirect(destination, 302);
  }

  // Tipe: KAEL Loyalty
  if (card.type === "loyalty") {
    const loyaltyUrl = new URL(`/demo/loyalty?card=${encodeURIComponent(card.card_code)}`, request.url);
    return NextResponse.redirect(loyaltyUrl, 302);
  }

  // Tipe: HR / Attendance
  const fallbackUrl = new URL(`/app?ref=card_${encodeURIComponent(card.card_code)}`, request.url);
  return NextResponse.redirect(fallbackUrl, 302);
}
