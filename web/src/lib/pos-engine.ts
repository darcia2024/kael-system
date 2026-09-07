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
  /** Tipe layanan. Dulu kolom channel, yang juga menjawab siapa pembuat pesanan. */
  serviceType: "dine_in" | "takeaway" | "delivery";
  cashierName: string;
  createdAt: string;
  items: { name: string; qty: number; price: number; note?: string }[];
  subtotal: number;
  discount: number;
  tax: number;
  serviceCharge: number;
  deliveryFee?: number;
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
  lines.push(row(`No: ${params.orderNo}`, serviceTypeLabel(params.serviceType, params.tableNo)));
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
  if (params.deliveryFee && params.deliveryFee > 0) {
    lines.push(row("Ongkir", `Rp ${params.deliveryFee.toLocaleString("id-ID")}`));
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
 * Ringkasan struk untuk WhatsApp. Berbeda dengan cetak thermal, pesan ini
 * dioptimalkan untuk dibaca di layar chat: total dan tautan struk berada di
 * bagian akhir, sementara rincian transaksi tetap utuh di atasnya.
 */
export function generateWhatsAppReceiptMessage(params: {
  businessName: string;
  orderNo: string;
  createdAtLabel: string;
  serviceLabel: string;
  cashierName?: string | null;
  items: { name: string; qty: number; price: number; note?: string | null }[];
  subtotal: number;
  discount: number;
  tax: number;
  serviceCharge: number;
  deliveryFee?: number;
  total: number;
  paymentMethod: string;
  cashGiven?: number | null;
  cashChange?: number | null;
  receiptUrl: string;
  memberCardUrl?: string | null;
}): string {
  const money = (value: number) => `Rp ${Math.round(value).toLocaleString("id-ID")}`;
  const clean = (value: string) => value.replace(/[\\*_~`]/g, "").trim();
  const paymentLabel: Record<string, string> = {
    cash: "Tunai",
    qris: "QRIS",
    transfer: "Transfer bank",
    card: "Kartu",
  };
  const lines = [
    `*${clean(params.businessName)}*`,
    "Struk digital",
    "",
    `No. pesanan: *${clean(params.orderNo)}*`,
    `Waktu: ${clean(params.createdAtLabel)}`,
    `Layanan: ${clean(params.serviceLabel)}`,
  ];

  if (params.cashierName) lines.push(`Kasir: ${clean(params.cashierName)}`);

  lines.push("", "*Rincian pesanan*");
  for (const item of params.items) {
    lines.push(`- ${Math.max(1, item.qty)}x ${clean(item.name)}  ${money(item.price * item.qty)}`);
    if (item.note?.trim()) lines.push(`  Catatan: ${clean(item.note)}`);
  }

  lines.push("", `Subtotal: ${money(params.subtotal)}`);
  if (params.discount > 0) lines.push(`Diskon: -${money(params.discount)}`);
  if (params.serviceCharge > 0) lines.push(`Biaya layanan: ${money(params.serviceCharge)}`);
  if (params.tax > 0) lines.push(`Pajak: ${money(params.tax)}`);
  if (params.deliveryFee && params.deliveryFee > 0) lines.push(`Ongkir: ${money(params.deliveryFee)}`);

  lines.push(`*TOTAL DIBAYAR: ${money(params.total)}*`);
  lines.push(`Pembayaran: ${paymentLabel[params.paymentMethod] ?? clean(params.paymentMethod)}`);
  if (params.paymentMethod === "cash" && params.cashGiven) {
    lines.push(`Tunai diterima: ${money(params.cashGiven)}`);
    lines.push(`Kembalian: ${money(params.cashChange ?? 0)}`);
  }

  lines.push("", "Struk lengkap:", params.receiptUrl);
  if (params.memberCardUrl) lines.push("", "Kartu member Anda:", params.memberCardUrl);
  lines.push("", "Terima kasih sudah berkunjung.");
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

// ===========================================================================
// Label tipe layanan
// ===========================================================================

/**
 * Satu tempat untuk menamai tipe layanan.
 *
 * Sebelumnya tiap layar menyimpulkannya sendiri dari kolom channel, dan
 * hasilnya berbeda-beda: struk menulis "Takeaway / Kasir", laporan menulis
 * "Takeaway", dan keduanya menganggap apa pun yang bukan dine-in adalah
 * takeaway — sehingga pesanan antar tidak pernah punya nama.
 */
export const SERVICE_TYPES = [
  { key: "dine_in" as const, label: "Dine-In", hint: "Makan di tempat" },
  { key: "takeaway" as const, label: "Takeaway", hint: "Dibawa pulang" },
  { key: "delivery" as const, label: "Delivery", hint: "Diantar ke alamat" },
];

export type ServiceType = (typeof SERVICE_TYPES)[number]["key"];

export function serviceTypeLabel(type: ServiceType, tableNo?: string | null): string {
  if (type === "dine_in") return tableNo ? `Dine-In · Meja ${tableNo}` : "Dine-In";
  return type === "delivery" ? "Delivery" : "Takeaway";
}

/** Label status pembayaran untuk layar kasir. */
export const PAYMENT_STATUS_LABEL: Record<string, string> = {
  pending: "Menunggu pembayaran",
  paid: "Lunas",
  failed: "Gagal bayar",
  expired: "Hangus",
  cancelled: "Dibatalkan",
};

/** Urutan kerja dapur setelah pembayaran dipastikan masuk. */
export const FULFILLMENT_FLOW = [
  { key: "accepted" as const, label: "Diterima" },
  { key: "preparing" as const, label: "Disiapkan" },
  { key: "ready" as const, label: "Siap" },
  { key: "completed" as const, label: "Selesai" },
];
