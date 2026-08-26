import { 
  normalizePhoneNumber, 
  maskPhoneNumber, 
  generateCustomerToken, 
  generateRedemptionCode, 
  calculateEarnedPoints, 
  calculateRewardDiscountRate 
} from "./src/lib/loyalty-engine.ts";

console.log("=== KAEL LOYALTY ENGINE UNIT TESTS ===");

// 1. Phone Number Normalization
const p1 = normalizePhoneNumber("0813-1150-6025");
const p2 = normalizePhoneNumber("+62 813 1150 6025");
const p3 = normalizePhoneNumber("6281311506025");

if (p1 !== "6281311506025") throw new Error(`Expected 6281311506025, got ${p1}`);
if (p2 !== "6281311506025") throw new Error(`Expected 6281311506025, got ${p2}`);
if (p3 !== "6281311506025") throw new Error(`Expected 6281311506025, got ${p3}`);

const masked = maskPhoneNumber("6281311506025");
if (!masked.includes("****")) throw new Error(`Masked phone should hide middle digits, got ${masked}`);
console.log("✓ TEST 1 PASSED: Normalisasi nomor WhatsApp ke standar 62... dan masking privasi UU PDP.");

// 2. Token Generator Security
const token = generateCustomerToken(22);
if (token.length !== 22) throw new Error(`Expected 22 chars token, got ${token.length}`);
console.log(`✓ TEST 2 PASSED: 22-char unguessable customer token generated: ${token}`);

// 3. Points Earn Math
const points = calculateEarnedPoints(85000, 10000);
if (points !== 8) throw new Error(`Expected 8 points, got ${points}`);
console.log("✓ TEST 3 PASSED: Perhitungan kurs poin belanja (Rp 85.000 @ 10rb = 8 Poin).");

// 4. Reward Cost Protection Analyzer
const discountAnalysis = calculateRewardDiscountRate(10, 10000, 25000); // 10 Pts @ 10rb (100rb spend) for 25rb reward
if (discountAnalysis.discountRatePct !== 25) throw new Error(`Expected 25% discount rate, got ${discountAnalysis.discountRatePct}`);
if (!discountAnalysis.isHighDiscount) throw new Error("Should flag as high discount (>20%)");
console.log("✓ TEST 4 PASSED: Proteksi biaya reward owner (mencegah owner merugi akibat diskon berlebih).");

// 5. Redemption Verification Code
const code = generateRedemptionCode();
if (!code.startsWith("RW-")) throw new Error(`Redemption code should start with RW-, got ${code}`);
console.log(`✓ TEST 5 PASSED: 6-char verification code generated: ${code}`);

console.log("\n=== ALL KAEL LOYALTY TESTS PASSED (5/5) ===\n");
