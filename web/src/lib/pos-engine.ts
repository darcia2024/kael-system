/**
 * KAEL System · POS & Ordering Calculation Engine (04 · KAEL POS & Ordering)
 * 
 * - Perhitungan Kasir: Subtotal, Diskon, Pajak, Service Charge, Grand Total & Kembalian
 * - Rekonsiliasi Shift Kasir & Selisih Laci Uang (Variance)
 * - Generator Format Struk Thermal 58mm (ESC/POS Monospace 32-karakter)
 * - Generator Nomor Antrean Harian (A-001)
 */

export interface CartItemInput {
  menu_item_id: string;
  name: string;
  price: number;
  qty: number;
  note?: string;
  recipe_id?: string | null;
}

export interface CartTotalsResult {
  subtotal: number;
  discount: number;
  tax: number;
  serviceCharge: number;
  total: number;
}

/**
 * Hitung subtotal, diskon, pajak, service charge, dan grand total
 */
export function calculateCartTotals(
  items: { price: number; qty: number }[],
  discountNominal = 0,
  taxRatePct = 0,
  serviceChargeRatePct = 0
): CartTotalsResult {
  const subtotal = items.reduce((acc, item) => acc + Math.max(0, item.price) * Math.max(1, item.qty), 0);
  const discount = Math.min(subtotal, Math.max(0, discountNominal));
  const taxableAmount = Math.max(0, subtotal - discount);

  const serviceCharge = serviceChargeRatePct > 0 
    ? Math.round(taxableAmount * (serviceChargeRatePct / 100)) 
    : 0;

  const tax = taxRatePct > 0 
    ? Math.round((taxableAmount + serviceCharge) * (taxRatePct / 100)) 
    : 0;

  const total = Math.max(0, taxableAmount + serviceCharge + tax);

  return {
    subtotal,
    discount,
    tax,
    serviceCharge,
    total,
  };
}

/**
 * Hitung kembalian tunai kasir
 */
export function calculateCashChange(total: number, cashGiven: number): {
  cashChange: number;
  isSufficient: boolean;
} {
  const diff = cashGiven - total;
  return {
    cashChange: Math.max(0, diff),
    isSufficient: diff >= 0,
  };
}

/**
 * Hitung rekonsiliasi uang fisik laci shift kasir
 */
export function calculateShiftReconciliation(
  openingCash: number,
  cashSalesTotal: number,
  physicalClosingCash: number
): {
  expectedCash: number;
  variance: number;
  status: "balanced" | "surplus" | "shortage";
} {
  const expectedCash = Math.max(0, openingCash) + Math.max(0, cashSalesTotal);
  const variance = physicalClosingCash - expectedCash;

  let status: "balanced" | "surplus" | "shortage" = "balanced";
  if (variance > 0) status = "surplus";
  if (variance < 0) status = "shortage";

  return {
    expectedCash,
    variance,
    status,
  };
}

/**
 * Format string struk cetak 58mm monospace (lebar 32 karakter standar printer thermal)
 */
export function generateEscPosReceiptText(params: {
  businessName: string;
  businessAddress: string;
  businessPhone: string;
  orderNo: string;
  tableNo?: string | null;
  channel: string;
  cashierName: string;
  createdAt: string;
  items: { name: string; qty: number; price: number; note?: string }[];
  subtotal: number;
  discount: number;
  tax: number;
  serviceCharge: number;
  total: number;
  paymentMethod: string;
  cashGiven?: number;
  cashChange?: number;
  customerName?: string | null;
}): string {
  const W = 32; // Standard 58mm printer width in characters
  const center = (str: string) => {
    const space = Math.max(0, Math.floor((W - str.length) / 2));
    return " ".repeat(space) + str;
  };
  const row = (left: string, right: string) => {
    const space = Math.max(1, W - left.length - right.length);
    return left + " ".repeat(space) + right;
  };
  const divider = "-".repeat(W);
  const doubleDivider = "=".repeat(W);

  const lines: string[] = [];

  // Header Toko
  lines.push(center(params.businessName.toUpperCase()));
  if (params.businessAddress) lines.push(center(params.businessAddress.slice(0, 32)));
  if (params.businessPhone) lines.push(center(params.businessPhone));
  lines.push(doubleDivider);

  // Metadata Transaksi
  lines.push(row(`No: ${params.orderNo}`, params.channel === "qr_dinein" ? `Meja ${params.tableNo || '-'}` : "Takeaway"));
  lines.push(row(`Kasir: ${params.cashierName.slice(0, 12)}`, params.paymentMethod.toUpperCase()));
  if (params.customerName) {
    lines.push(row(`Member: ${params.customerName.slice(0, 14)}`, "LOYALTY ✓"));
  }
  lines.push(divider);

  // Daftar Item
  params.items.forEach((item) => {
    const itemTotal = (item.price * item.qty).toLocaleString("id-ID");
    lines.push(item.name.slice(0, 32));
    lines.push(row(`  ${item.qty}x @${item.price.toLocaleString("id-ID")}`, `Rp ${itemTotal}`));
    if (item.note) {
      lines.push(`  * ${item.note.slice(0, 28)}`);
    }
  });

  lines.push(divider);

  // Totals
  lines.push(row("Subtotal", `Rp ${params.subtotal.toLocaleString("id-ID")}`));
  if (params.discount > 0) {
    lines.push(row("Diskon", `-Rp ${params.discount.toLocaleString("id-ID")}`));
  }
  if (params.serviceCharge > 0) {
    lines.push(row("Service Chg", `Rp ${params.serviceCharge.toLocaleString("id-ID")}`));
  }
  if (params.tax > 0) {
    lines.push(row("PB1 / Pajak", `Rp ${params.tax.toLocaleString("id-ID")}`));
  }

  lines.push(doubleDivider);
  lines.push(row("TOTAL BAYAR", `Rp ${params.total.toLocaleString("id-ID")}`));

  if (params.paymentMethod === "cash" && params.cashGiven) {
    lines.push(row("Tunai Diterima", `Rp ${params.cashGiven.toLocaleString("id-ID")}`));
    lines.push(row("Kembalian", `Rp ${(params.cashChange || 0).toLocaleString("id-ID")}`));
  }

  lines.push(doubleDivider);
  lines.push(center("Terima Kasih Atas Kunjungan Anda!"));
  lines.push(center("Struk Digital Resmi KAEL POS"));
  lines.push("\n\n"); // Feed for paper tear

  return lines.join("\n");
}

/**
 * Generator nomor order harian misal A-001, A-014
 */
export function generateDailyOrderNo(orderCountToday = 1): string {
  const prefix = "A";
  const num = String(orderCountToday).padStart(3, "0");
  return `${prefix}-${num}`;
}
