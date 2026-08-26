/**
 * KAEL System · Loyalty & Reward Engine (03 · KAEL Loyalty)
 * 
 * - Normalisasi Nomor WhatsApp (62...) & Pencarian 4-Digit Cepat untuk Kasir
 * - Generator Token Pelanggan 22-Karakter Unguessable untuk m.kael.id/{token}
 * - Kalkulator Perolehan Poin / Stamp
 * - Kalkulator Proteksi Biaya Program (Estimasi % Diskon Efektif Reward)
 * - Privasi Nomor Telepon Pelanggan (UU PDP No. 27/2022)
 */

export const TOKEN_CHARSET = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";

/**
 * Normalisasi nomor WhatsApp ke format standar 62...
 * Menerima input: "0813-1150-6025", "+62 813 1150 6025", "6281311506025" -> "6281311506025"
 */
export function normalizePhoneNumber(input: string): string {
  if (!input) return "";
  let clean = input.replace(/[^0-9]/g, "");
  if (clean.startsWith("0")) {
    clean = "62" + clean.slice(1);
  }
  if (!clean.startsWith("62")) {
    clean = "62" + clean;
  }
  return clean;
}

/**
 * Format nomor telepon dengan sensor privasi untuk tampilan publik m.kael.id
 * Misal: 6281311506025 -> +62 813-****-6025
 */
export function maskPhoneNumber(phone: string): string {
  const norm = normalizePhoneNumber(phone);
  if (norm.length < 8) return phone;
  const prefix = norm.slice(0, 5); // 62813
  const suffix = norm.slice(-4);   // 6025
  return `+${prefix.slice(0, 2)} ${prefix.slice(2)}-****-${suffix}`;
}

/**
 * Generator token unik 22-karakter untuk URL kartu member aman (m.kael.id/{token})
 */
export function generateCustomerToken(length = 22): string {
  let result = "";
  const charsetLength = TOKEN_CHARSET.length;
  
  if (typeof crypto !== "undefined" && crypto.getRandomValues) {
    const bytes = new Uint8Array(length);
    crypto.getRandomValues(bytes);
    for (let i = 0; i < length; i++) {
      result += TOKEN_CHARSET[bytes[i] % charsetLength];
    }
  } else {
    for (let i = 0; i < length; i++) {
      result += TOKEN_CHARSET[Math.floor(Math.random() * charsetLength)];
    }
  }
  return result;
}

/**
 * Generator kode verifikasi penukaran voucher 6-karakter untuk ditunjukkan ke kasir
 * Contoh: "KL-892X" atau "RW892X"
 */
export function generateRedemptionCode(): string {
  const chars = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ";
  let code = "";
  for (let i = 0; i < 6; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return `RW-${code.slice(0, 3)}-${code.slice(3)}`;
}

/**
 * Hitung poin perolehan dari nominal belanja (mode Poin)
 * Misal: Belanja Rp 85.000 dengan earn_rate Rp 10.000 -> 8 Poin
 */
export function calculateEarnedPoints(amountSpent: number, earnRate = 10000): number {
  if (amountSpent <= 0 || earnRate <= 0) return 0;
  return Math.floor(amountSpent / earnRate);
}

/**
 * Hitung persentase diskon efektif yang diberikan sebuah reward (Proteksi Biaya Owner)
 * Formula: (Nilai Hadiah / (Biaya Poin * Kurs Poin)) * 100
 * Contoh: Kopi Rp 25.000 ditukar 10 Poin (@ Rp 10.000 = Belanja Rp 100.000) -> Diskon Efektif 25%
 */
export function calculateRewardDiscountRate(
  pointCost: number,
  earnRate: number,
  rewardMarketValue: number
): {
  requiredSpend: number;
  discountRatePct: number;
  isHighDiscount: boolean; // Flag jika > 20% diskon (berpotensi menggerus margin UMKM)
} {
  const requiredSpend = Math.max(1, pointCost * earnRate);
  const discountRatePct = (rewardMarketValue / requiredSpend) * 100;
  const isHighDiscount = discountRatePct > 20;

  return {
    requiredSpend,
    discountRatePct,
    isHighDiscount,
  };
}
