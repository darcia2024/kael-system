/**
 * KAEL System · Formatting Helpers (Fondasi Bersama Bagian 4)
 * 
 * - Uang disimpan sebagai integer rupiah (bigint/number), diformat tanpa sen.
 * - Tanggal disimpan UTC, ditampilkan sesuai businesses.timezone (default: Asia/Jakarta).
 * - Nomor telepon format Indonesia (62... / 08...).
 */

/**
 * Format integer rupiah ke format mata uang Indonesia (misal: Rp 149.000)
 */
export function formatRupiah(amount: number | bigint | string | null | undefined): string {
  if (amount === null || amount === undefined || isNaN(Number(amount))) {
    return "Rp 0";
  }
  const intVal = Math.round(Number(amount));
  return `Rp ${intVal.toLocaleString("id-ID")}`;
}

/**
 * Format timestamp UTC ke string tanggal & waktu lokal bisnis (WIB / WITA / WIT)
 */
export function formatBusinessDateTime(
  dateInput: string | Date | null | undefined,
  timezone = "Asia/Jakarta",
  options?: Intl.DateTimeFormatOptions
): string {
  if (!dateInput) return "-";
  const date = new Date(dateInput);
  if (isNaN(date.getTime())) return "-";

  const defaultOptions: Intl.DateTimeFormatOptions = {
    timeZone: timezone,
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    ...options,
  };

  try {
    return new Intl.DateTimeFormat("id-ID", defaultOptions).format(date);
  } catch {
    return date.toLocaleString("id-ID");
  }
}

/**
 * Format tanggal sederhana (misal: 26 Agu 2026)
 */
export function formatBusinessDate(
  dateInput: string | Date | null | undefined,
  timezone = "Asia/Jakarta"
): string {
  return formatBusinessDateTime(dateInput, timezone, {
    hour: undefined,
    minute: undefined,
    second: undefined,
  });
}

/**
 * Format nomor WhatsApp / Telepon standar Indonesia (62... / 08...)
 */
export function formatPhoneNumber(phone: string | null | undefined): string {
  if (!phone) return "-";
  let clean = phone.replace(/[^0-9]/g, "");
  if (clean.startsWith("0")) {
    clean = "62" + clean.slice(1);
  }
  if (!clean.startsWith("62")) {
    clean = "62" + clean;
  }
  // Format: +62 813-1150-6025
  const part1 = clean.slice(0, 2); // 62
  const part2 = clean.slice(2, 5); // 813
  const part3 = clean.slice(5, 9); // 1150
  const part4 = clean.slice(9);    // 6025
  return `+${part1} ${part2}-${part3}${part4 ? `-${part4}` : ""}`;
}
