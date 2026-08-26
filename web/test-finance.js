import { 
  calculateRecipeHpp, 
  roundUpTo500, 
  calculatePriceFromTargetProfit 
} from "./src/lib/finance-engine.ts";

console.log("=== KAEL FINANCE & HPP ENGINE UNIT TESTS ===");

// 1. Test Separate Packaging vs Output Qty
// Resep: Croissant batch 10 pcs
// Bahan: Rp 50.000, Operasional: Rp 10.000 -> Modal Batch: Rp 60.000
// Modal per porsi: 60.000 / 10 = Rp 6.000
// Kemasan: Paper bag Rp 1.500 (per pcs)
// Total HPP per unit harus: 6.000 + 1.500 = Rp 7.500 (BUKAN (60.000 + 1.500)/10 = 6.150)
const mockIngMap = new Map([
  ["ing-1", { id: "ing-1", name: "Butter", pack_price: 100000, pack_size: 1000, base_unit: "gr" }],
  ["ing-2", { id: "ing-2", name: "Tepung", pack_price: 15000, pack_size: 1000, base_unit: "gr" }]
]);

const croissantTest = calculateRecipeHpp({
  type: "olahan",
  output_qty: 10,
  operational_cost: 10000,
  selling_price: 25000,
  target_margin_pct: 65,
  ingredients: [
    { ingredient_id: "ing-1", qty: 450 }, // 450 gr Butter = Rp 45.000
    { ingredient_id: "ing-2", qty: 500 }, // 500 gr Tepung = Rp 7.500
  ], // Total bahan: 52.500
  packaging: [
    { name: "Paper Bag", cost: 1500 } // Rp 1.500 per unit jadi
  ]
}, mockIngMap);

// Batch modal = 52.500 + 10.000 = 62.500
// Per porsi bahan+op = 6.250
// HPP per unit = 6.250 + 1.500 = Rp 7.750
if (croissantTest.hpp_per_unit !== 7750) {
  throw new Error(`Expected HPP 7750, got ${croissantTest.hpp_per_unit}`);
}
console.log("✓ TEST 1 PASSED: Biaya kemasan melekat per unit jadi di luar pembagian output batch.");

// 2. Test Margin vs Markup
// Modal: Rp 10.000, Jual: Rp 15.000 -> Laba: Rp 5.000
// Markup: 5.000 / 10.000 = 50%
// Margin: 5.000 / 15.000 = 33.333%
const marginTest = calculateRecipeHpp({
  type: "kulakan",
  output_qty: 1,
  operational_cost: 0,
  selling_price: 15000,
  target_margin_pct: 50,
  ingredients: [{ ingredient_id: "ing-1", qty: 100 }], // 100 gr = Rp 10.000
  packaging: []
}, mockIngMap);

if (Math.round(marginTest.markup_pct) !== 50) throw new Error("Markup calculation failed");
if (Math.round(marginTest.margin_pct) !== 33) throw new Error("Margin calculation failed");
console.log("✓ TEST 2 PASSED: Margin (33.3%) vs Markup (50.0%) diverifikasi berdampingan.");

// 3. Test Rounding to Rp 500
if (roundUpTo500(18347) !== 18500) throw new Error(`Expected 18500, got ${roundUpTo500(18347)}`);
if (roundUpTo500(20000) !== 20000) throw new Error(`Expected 20000, got ${roundUpTo500(20000)}`);
if (roundUpTo500(20001) !== 20500) throw new Error(`Expected 20500, got ${roundUpTo500(20001)}`);
console.log("✓ TEST 3 PASSED: Rekomendasi harga jual dibulatkan ke atas ke kelipatan Rp 500.");

// 4. Test Under-Target Alert
if (!marginTest.is_under_target) throw new Error("Should flag as under target margin (33% < 50%)");
console.log("✓ TEST 4 PASSED: Deteksi margin di bawah target berhasil terpicu.");

console.log("\n=== ALL KAEL FINANCE TESTS PASSED (4/4) ===\n");
