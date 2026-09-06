/**
 * KAEL System · Loyalty Code Engine
 *
 * Kode yang dipakai bersama oleh referral, ulang tahun, dan campaign promo —
 * satu mesin, tiga sumber (lihat migrasi loyalty_codes). Charset sama dengan
 * card-code.ts: tanpa 0, O, 1, I, l, supaya kode yang didiktekan lewat telepon
 * atau dibaca dari layar retak tidak salah tulis.
 */

export const LOYALTY_CODE_CHARSET = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ";

/** Kode 6 karakter: cukup pendek untuk diketik ulang, cukup panjang untuk jarang tabrakan. */
export function generateLoyaltyCode(length = 6): string {
  let result = "";
  const charsetLength = LOYALTY_CODE_CHARSET.length;

  if (typeof crypto !== "undefined" && crypto.getRandomValues) {
    const bytes = new Uint8Array(length);
    crypto.getRandomValues(bytes);
    for (let i = 0; i < length; i++) {
      result += LOYALTY_CODE_CHARSET[bytes[i] % charsetLength];
    }
  } else {
    for (let i = 0; i < length; i++) {
      result += LOYALTY_CODE_CHARSET[Math.floor(Math.random() * charsetLength)];
    }
  }
  return result;
}

/** Normalisasi input kode (uppercase, buang spasi dan pemisah umum). */
export function normalizeLoyaltyCode(input: string): string {
  if (!input) return "";
  return input.toUpperCase().replace(/[\s\-_.]/g, "").slice(0, 12);
}
