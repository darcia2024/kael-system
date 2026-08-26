/**
 * KAEL System · Card Code Engine (Fondasi Bersama 1.5)
 * 
 * Aturan card_code:
 * - 8 karakter alfanumerik acak
 * - Membuang karakter ambigu: 0, O, 1, I, l
 * - Alphabet (32 karakter): 23456789ABCDEFGHJKLMNPQRSTUVWXYZ
 * - Random cryptographically secure, bukan sequential
 */

export const UNAMBIGUOUS_CHARSET = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ";

/**
 * Menghasilkan card_code acak 8 karakter yang aman dan mudah dibaca
 */
export function generateCardCode(length = 8): string {
  let result = "";
  const charsetLength = UNAMBIGUOUS_CHARSET.length;
  
  if (typeof crypto !== "undefined" && crypto.getRandomValues) {
    const randomBytes = new Uint8Array(length);
    crypto.getRandomValues(randomBytes);
    for (let i = 0; i < length; i++) {
      result += UNAMBIGUOUS_CHARSET[randomBytes[i] % charsetLength];
    }
  } else {
    for (let i = 0; i < length; i++) {
      const randomIndex = Math.floor(Math.random() * charsetLength);
      result += UNAMBIGUOUS_CHARSET[randomIndex];
    }
  }
  return result;
}

/**
 * Menghasilkan PIN aktivasi 6 digit numerik acak untuk kartu baru
 */
export function generateActivationPin(): string {
  let pin = "";
  if (typeof crypto !== "undefined" && crypto.getRandomValues) {
    const bytes = new Uint8Array(6);
    crypto.getRandomValues(bytes);
    for (let i = 0; i < 6; i++) {
      pin += (bytes[i] % 10).toString();
    }
  } else {
    for (let i = 0; i < 6; i++) {
      pin += Math.floor(Math.random() * 10).toString();
    }
  }
  return pin;
}

/**
 * Normalisasi card_code input (uppercase, buang spasi dan karakter pemisah)
 */
export function normalizeCardCode(input: string): string {
  if (!input) return "";
  /**
   * Hanya membuang pemisah yang biasa diketik orang: spasi, tanda hubung,
   * garis bawah, titik.
   *
   * Versi sebelumnya membuang SEMUA karakter di luar alfabet anti-ambigu,
   * termasuk angka 0 dan 1. Akibatnya kode yang mengandung karakter itu diam
   * diam berubah menjadi kode lain yang lebih pendek, lalu gagal dicari tanpa
   * petunjuk apa pun. Lebih baik pencariannya yang gagal secara jujur daripada
   * kodenya yang diubah tanpa sepengetahuan siapa pun.
   */
  return input
    .toUpperCase()
    .replace(/[\s\-_.]/g, "")
    .slice(0, 8);
}

/**
 * Validasi apakah kode memenuhi spesifikasi card_code KAEL
 */
export function isValidCardCode(code: string): boolean {
  if (!code || code.length !== 8) return false;
  const regex = /^[23456789ABCDEFGHJKLMNPQRSTUVWXYZ]{8}$/;
  return regex.test(code.toUpperCase());
}

/**
 * Format card_code untuk tampilan rapi (misal: "KAEL-ABCD-EFGH" atau "ABCD EFGH")
 */
export function formatCardCodeDisplay(code: string, prefix = false): string {
  const clean = normalizeCardCode(code);
  if (clean.length !== 8) return code;
  const formatted = `${clean.slice(0, 4)} ${clean.slice(4)}`;
  return prefix ? `KAEL-${clean.slice(0, 4)}-${clean.slice(4)}` : formatted;
}
