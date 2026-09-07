import { NextRequest, NextResponse, after } from "next/server";

import { db } from "@/lib/db";
import { normalizeCardCode } from "@/lib/card-code";

/**
 * Endpoint redirect kartu NFC dan QR.
 *
 * Sasaran waktu dari tap sampai tujuan terbuka: di bawah 500 ms. Pencatatan
 * tap dijadwalkan lewat `after()` supaya berjalan SETELAH respons terkirim.
 * Versi sebelumnya memakai promise tanpa await, yang di serverless bisa
 * terpotong saat fungsi dibekukan begitu respons selesai, sehingga sebagian
 * tap hilang diam-diam.
 *
 * Selalu 302, tidak pernah 301: owner harus bisa mengganti tujuan kapan saja,
 * dan 301 akan disimpan permanen oleh peramban serta operator seluler.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ code: string }> },
) {
  const { code } = await params;
  const cardCode = normalizeCardCode(code);

  const card = await db.getCardByCode(cardCode);

  if (!card) {
    return NextResponse.redirect(new URL("/r/status?type=not_found", request.url), 302);
  }

  if (card.status === "unactivated") {
    return NextResponse.redirect(
      new URL(`/activate/${encodeURIComponent(card.card_code)}`, request.url),
      302,
    );
  }

  // Halaman suspend sengaja tidak menyebut nama bisnis: kartu yang hilang bisa
  // ada di tangan siapa saja.
  if (card.status === "suspended") {
    return NextResponse.redirect(new URL("/r/status?type=suspended", request.url), 302);
  }

  const source = request.nextUrl.searchParams.get("src") === "qr" ? "qr" : "nfc";
  const ip = (request.headers.get("x-forwarded-for") ?? "").split(",")[0].trim();
  const userAgent = request.headers.get("user-agent") ?? "";

  after(async () => {
    try {
      await db.recordCardTap(card.id, source, ip, userAgent);
    } catch (err) {
      console.error("[KAEL] gagal mencatat tap", err);
    }
  });

  /**
   * Kartu ulasan mendarat di halaman penilaian KAEL, bukan langsung ke Google.
   *
   * Versi sebelumnya melempar setiap tap ke halaman ulasan Google apa adanya.
   * Yang puas menulis di sana, dan yang kecewa juga — pemilik kafe baru tahu
   * ada yang salah setelah bintang satunya terlanjur terbit dan permanen.
   * Sekarang bintangnya ditanya lebih dulu di halaman sendiri, jadi keluhan
   * punya tempat mendarat yang bisa dibalas, dan pujian tetap sampai ke Google.
   *
   * Kartu tanpa alamat Google tetap dibuka: penilaiannya masih tercatat, cuma
   * langkah terakhirnya yang tidak ada. Itu urusan pemilik kartu, bukan alasan
   * memperlihatkan layar galat ke pelanggan yang sedang memegang ponselnya.
   */
  if (card.type === "review") {
    return NextResponse.redirect(new URL(`/nilai/${card.card_code}`, request.url), 302);
  }

  /**
   * Kartu tautan bebas: SATU alamat, titik.
   *
   * Dulu di sini ada cabang "kalau kartunya punya Smart Touch, ke sana saja"
   * yang menang lebih dulu. Artinya tautan yang sudah diisi pemiliknya bisa
   * berhenti dipakai diam-diam begitu dia menambah tombol Smart Touch, dan
   * tidak ada satu pun layar yang memberitahukannya. Smart Touch sekarang
   * jenis kartunya sendiri; kartu `link` tidak lagi punya jalur cadangan.
   */
  if (card.type === "link") {
    if (!card.destination_url) {
      return NextResponse.redirect(new URL("/r/status?type=no_destination", request.url), 302);
    }
    return NextResponse.redirect(card.destination_url, 302);
  }

  /**
   * Kartu Smart Touch selalu mendarat di halaman tombolnya, dan TIDAK pernah
   * jatuh ke destination_url — kartu ini memang tidak memakainya.
   */
  if (card.type === "smart_touch") {
    if (!(await db.getSmartTouchByCode(card.card_code))) {
      return NextResponse.redirect(new URL("/r/status?type=no_destination", request.url), 302);
    }
    return NextResponse.redirect(new URL(`/touch/${card.card_code}`, request.url), 302);
  }

  if (card.type === "loyalty") {
    // Kartu member pribadi mengarah ke halaman pemiliknya. Kartu meja belum
    // terikat ke siapa pun, jadi diarahkan ke pendaftaran.
    if (card.customer_id) {
      const customer = await db.getCustomerById(card.customer_id, card.business_id!);
      if (customer?.token) {
        return NextResponse.redirect(new URL(`/m/${customer.token}`, request.url), 302);
      }
    }
    return NextResponse.redirect(
      new URL(`/loyalty/register?card=${encodeURIComponent(card.card_code)}`, request.url),
      302,
    );
  }

  if (card.type === "attendance") {
    return NextResponse.redirect(
      new URL(`/app/hr/attendance?card=${encodeURIComponent(card.card_code)}`, request.url),
      302,
    );
  }

  return NextResponse.redirect(new URL("/r/status?type=not_configured", request.url), 302);
}
