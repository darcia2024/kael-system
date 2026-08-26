import { 
  calculateCartTotals, 
  calculateCashChange, 
  calculateShiftReconciliation, 
  generateEscPosReceiptText 
} from "./src/lib/pos-engine.ts";

console.log("=== KAEL POS & ORDERING ENGINE UNIT TESTS ===");

// 1. Cart Totals Calculation
// Items: 2x Latte @ 28.000 = 56.000, 1x Croissant @ 24.000 = 24.000 -> Subtotal = 80.000
// Diskon = 5.000 -> Taxable = 75.000
// Service Charge (5%) = 3.750
// PB1 Tax (10%) = 10% * (75.000 + 3.750) = 7.875
// Total = 75.000 + 3.750 + 7.875 = 86.625
const cart = calculateCartTotals(
  [
    { price: 28000, qty: 2 },
    { price: 24000, qty: 1 }
  ],
  5000, // Diskon 5rb
  10,   // PB1 10%
  5     // Service Charge 5%
);

if (cart.subtotal !== 80000) throw new Error(`Expected subtotal 80000, got ${cart.subtotal}`);
if (cart.discount !== 5000) throw new Error(`Expected discount 5000, got ${cart.discount}`);
if (cart.serviceCharge !== 3750) throw new Error(`Expected service charge 3750, got ${cart.serviceCharge}`);
if (cart.tax !== 7875) throw new Error(`Expected tax 7875, got ${cart.tax}`);
if (cart.total !== 86625) throw new Error(`Expected total 86625, got ${cart.total}`);
console.log("✓ TEST 1 PASSED: Perhitungan subtotal, diskon, service charge, dan pajak kasir.");

// 2. Cash Change Calculation
const change1 = calculateCashChange(86625, 100000);
if (change1.cashChange !== 13375 || !change1.isSufficient) throw new Error("Cash change calc failed");

const change2 = calculateCashChange(86625, 50000);
if (change2.isSufficient) throw new Error("Should flag insufficient cash");
console.log("✓ TEST 2 PASSED: Kalkulator kembalian uang tunai kasir.");

// 3. Shift Cash Reconciliation (Variance)
// Modal awal 100.000, penjualan cash 350.000 -> expected = 450.000
// Uang fisik 450.000 -> variance = 0 (balanced)
const shift1 = calculateShiftReconciliation(100000, 350000, 450000);
if (shift1.expectedCash !== 450000 || shift1.variance !== 0 || shift1.status !== "balanced") {
  throw new Error("Shift balanced test failed");
}

// Uang fisik 440.000 -> variance = -10.000 (shortage)
const shift2 = calculateShiftReconciliation(100000, 350000, 440000);
if (shift2.variance !== -10000 || shift2.status !== "shortage") {
  throw new Error("Shift shortage test failed");
}
console.log("✓ TEST 3 PASSED: Rekonsiliasi selisih kas laci shift (variance).");

// 4. 58mm Monospace Receipt Formatter
const receiptText = generateEscPosReceiptText({
  businessName: "Senja Coffee",
  businessAddress: "Jl. Riau 42",
  businessPhone: "081311506025",
  orderNo: "A-001",
  tableNo: "04",
  channel: "qr_dinein",
  cashierName: "Budi",
  createdAt: new Date().toISOString(),
  items: [
    { name: "Iced Spanish Latte", qty: 1, price: 28000, note: "Less sugar" },
    { name: "Artisan Butter Croissant", qty: 1, price: 24000 }
  ],
  subtotal: 52000,
  discount: 0,
  tax: 0,
  serviceCharge: 0,
  total: 52000,
  paymentMethod: "cash",
  cashGiven: 100000,
  cashChange: 48000,
  customerName: "Rian Pratama"
});

if (!receiptText.includes("SENJA COFFEE") || !receiptText.includes("A-001") || !receiptText.includes("Kembalian")) {
  throw new Error("Receipt text format incomplete");
}
console.log("✓ TEST 4 PASSED: Format struk cetak 58mm monospace ESC/POS standar.");

console.log("\n=== ALL KAEL POS TESTS PASSED (4/4) ===\n");
