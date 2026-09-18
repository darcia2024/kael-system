import { NextRequest, NextResponse } from "next/server";

import { db } from "@/lib/db";
import { tautanWaFaktur } from "@/lib/faktur-wa";

/**
 * Tujuan QR faktur WhatsApp.
 *
 * Yang membukanya HP kasir yang baru saja memindai layar kasir — tanpa sesi
 * KAEL, karena HP itu cuma dipakai untuk WhatsApp toko. Rute ini merakit
 * fakturnya dari database lalu mengalihkan ke wa.me, dan WhatsApp terbuka
 * dengan nomor dan isinya sudah terisi. Menekan kirim tetap tangan manusia.
 *
 * Selalu 302. Tautannya berumur pendek dan isinya bisa berubah (item dibatalkan
 * sesudah QR tampil), jadi tidak ada yang boleh menyimpan jawabannya.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params;

  // Token dibuat generateCustomerToken: huruf dan angka saja. Bentuk lain
  // tidak perlu sampai ke database.
  if (!/^[A-Za-z0-9]{10,40}$/.test(token)) {
    return NextResponse.redirect(new URL("/r/status?type=invoice_expired", request.url), 302);
  }

  const tautan = await db.resolveInvoiceLink(token);
  if (!tautan) {
    return NextResponse.redirect(new URL("/r/status?type=invoice_expired", request.url), 302);
  }

  const res = NextResponse.redirect(tautanWaFaktur(tautan.nomor, tautan.faktur), 302);
  res.headers.set("Cache-Control", "no-store");
  return res;
}
