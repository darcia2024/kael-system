/**
 * KAEL System · Unified Database & Repository Layer
 * 
 * Fondasi Bersama (00), KAEL Review (01), KAEL Finance (02), KAEL Loyalty (03), KAEL POS & Ordering (04)
 * Mendukung Supabase Postgres + Embedded Reactive In-Memory Repository
 * dengan pre-seeded sample data untuk demo & local execution.
 */

import { generateCardCode, generateActivationPin } from "./card-code";
import { hashSha256Sync, hashClientIp, checkStaffLockout, calculateLockoutExpiry } from "./auth-security";
import { buildGoogleReviewUrl } from "./google-places";
import { 
  IngredientItem, 
  RecipeIngredientItem, 
  RecipePackagingItem, 
  calculateRecipeHpp, 
  RecipeHppResult 
} from "./finance-engine";
import { 
  normalizePhoneNumber, 
  generateCustomerToken, 
  generateRedemptionCode, 
  calculateEarnedPoints 
} from "./loyalty-engine";
import { 
  generateDailyOrderNo, 
  calculateCartTotals, 
  calculateShiftReconciliation 
} from "./pos-engine";
import { formatRupiah } from "./formatters";

export interface Business {
  id: string;
  name: string;
  category: string;
  phone: string;
  address: string;
  google_place_id: string;
  logo_url: string;
  brand_color: string;
  timezone: string;
  created_at: string;
}

export interface BusinessModule {
  id: string;
  business_id: string;
  module: "review" | "finance" | "loyalty" | "pos" | "hr" | "booking";
  status: "active" | "expired" | "suspended";
  activated_at: string;
  expires_at: string;
}

export interface User {
  id: string;
  business_id: string | null;
  role: "owner" | "staff" | "kael_admin";
  name: string;
  email: string | null;
  pin_hash: string | null;
  failed_pin_attempts: number;
  locked_until: string | null;
  is_active: boolean;
  created_at: string;
}

export interface Customer {
  id: string;
  business_id: string;
  phone: string;
  name: string | null;
  birthday: string | null;
  token: string;
  consent_at: string;
  created_at: string;
}

export interface Card {
  id: string;
  card_code: string;
  business_id: string | null;
  type: "review" | "loyalty" | "attendance";
  status: "unactivated" | "active" | "suspended";
  activation_pin_hash: string | null;
  destination_url: string | null;
  label: string | null;
  customer_id: string | null;
  tap_count: number;
  last_tapped_at: string | null;
  created_at: string;
}

export interface CardTap {
  id: string;
  card_id: string;
  tapped_at: string;
  source: "nfc" | "qr";
  ip_hash?: string;
  user_agent?: string;
}

// -----------------------------------------------------------------------------
// 02 · KAEL FINANCE DATA STRUCTURES
// -----------------------------------------------------------------------------

export interface Ingredient {
  id: string;
  business_id: string;
  name: string;
  pack_price: number;
  pack_size: number;
  base_unit: "gr" | "ml" | "pcs";
  updated_at: string;
}

export interface IngredientPriceHistory {
  id: string;
  ingredient_id: string;
  pack_price: number;
  changed_at: string;
}

export interface Recipe {
  id: string;
  business_id: string;
  name: string;
  category: string;
  type: "olahan" | "kulakan";
  output_qty: number;
  operational_cost: number;
  selling_price: number;
  target_margin_pct: number;
  ingredients: RecipeIngredientItem[];
  packaging: RecipePackagingItem[];
  created_at: string;
  updated_at: string;
}

// -----------------------------------------------------------------------------
// 03 · KAEL LOYALTY DATA STRUCTURES
// -----------------------------------------------------------------------------

export interface LoyaltyProgram {
  id: string;
  business_id: string;
  mode: "point" | "stamp";
  earn_rate: number;
  stamp_per_visit: number;
  point_expiry_months: number | null;
  updated_at: string;
}

export interface PointLedger {
  id: string;
  business_id: string;
  customer_id: string;
  delta: number;
  reason: "purchase" | "redeem" | "birthday" | "manual" | "correction" | "expiry";
  note: string;
  amount_spent: number | null;
  created_by: string;
  created_at: string;
}

export interface Reward {
  id: string;
  business_id: string;
  name: string;
  point_cost: number;
  market_value: number;
  stock: number | null;
  is_active: boolean;
  created_at: string;
}

export interface Redemption {
  id: string;
  customer_id: string;
  reward_id: string;
  code: string;
  status: "issued" | "used" | "expired";
  redeemed_by: string | null;
  created_at: string;
  used_at: string | null;
}

// -----------------------------------------------------------------------------
// 04 · KAEL POS & ORDERING DATA STRUCTURES
// -----------------------------------------------------------------------------

export interface Category {
  id: string;
  business_id: string;
  name: string;
  sort_order: number;
}

export interface MenuItem {
  id: string;
  business_id: string;
  category_id: string;
  name: string;
  price: number;
  photo_url?: string;
  is_available: boolean;
  recipe_id?: string | null; // Tersambung ke KAEL Finance
  sort_order: number;
}

export interface Shift {
  id: string;
  business_id: string;
  opened_by: string;
  opened_at: string;
  opening_cash: number;
  closed_at: string | null;
  closing_cash: number | null;
  expected_cash: number | null;
  variance: number | null;
  notes: string | null;
}

export interface OrderItem {
  id: string;
  order_id: string;
  menu_item_id: string;
  name_snapshot: string;
  price_snapshot: number;
  qty: number;
  subtotal: number;
  note?: string;
}

export interface Order {
  id: string;
  business_id: string;
  order_no: string;
  channel: "cashier" | "qr_dinein" | "qr_takeaway";
  table_no: string | null;
  status: "open" | "paid" | "cancelled" | "refunded";
  subtotal: number;
  discount: number;
  tax: number;
  service_charge: number;
  total: number;
  payment_method: "cash" | "qris" | "transfer";
  cash_given?: number | null;
  cash_change?: number | null;
  customer_id: string | null;
  shift_id: string | null;
  created_by: string;
  created_at: string;
}

export interface Refund {
  id: string;
  order_id: string;
  amount: number;
  reason: string;
  approved_by: string;
  created_at: string;
}

// -----------------------------------------------------------------------------
// INITIAL SEED DATA
// -----------------------------------------------------------------------------

const DEFAULT_BUSINESS_ID = "b0000000-0000-0000-0000-000000000001";

let seededBusinesses: Business[] = [
  {
    id: DEFAULT_BUSINESS_ID,
    name: "Senja Coffee & Roastery",
    category: "Coffee Shop & Bakery",
    phone: "6281311506025",
    address: "Jl. Riau No. 42, Citarum, Bandung",
    google_place_id: "ChIJb_e9q17vaS4RH958L031Q2A",
    logo_url: "",
    brand_color: "#7958d8",
    timezone: "Asia/Jakarta",
    created_at: "2026-01-15T08:00:00.000Z",
  },
];

let seededModules: BusinessModule[] = [
  { id: "bm-01", business_id: DEFAULT_BUSINESS_ID, module: "review", status: "active", activated_at: "2026-01-15", expires_at: "2027-01-15" },
  { id: "bm-02", business_id: DEFAULT_BUSINESS_ID, module: "pos", status: "active", activated_at: "2026-02-01", expires_at: "2027-02-01" },
  { id: "bm-03", business_id: DEFAULT_BUSINESS_ID, module: "finance", status: "active", activated_at: "2026-02-01", expires_at: "2027-02-01" },
  { id: "bm-04", business_id: DEFAULT_BUSINESS_ID, module: "loyalty", status: "active", activated_at: "2026-02-10", expires_at: "2027-02-10" },
];

let seededUsers: User[] = [
  {
    id: "usr-owner-01",
    business_id: DEFAULT_BUSINESS_ID,
    role: "owner",
    name: "Rian Pratama (Owner)",
    email: "owner@senjacoffee.id",
    pin_hash: null,
    failed_pin_attempts: 0,
    locked_until: null,
    is_active: true,
    created_at: "2026-01-15T08:00:00.000Z",
  },
  {
    id: "usr-staff-01",
    business_id: DEFAULT_BUSINESS_ID,
    role: "staff",
    name: "Budi (Barista Shift Pagi)",
    email: null,
    pin_hash: hashSha256Sync("123456"),
    failed_pin_attempts: 0,
    locked_until: null,
    is_active: true,
    created_at: "2026-01-20T08:00:00.000Z",
  },
  {
    id: "usr-staff-02",
    business_id: DEFAULT_BUSINESS_ID,
    role: "staff",
    name: "Siti (Kasir Shift Sore)",
    email: null,
    pin_hash: hashSha256Sync("654321"),
    failed_pin_attempts: 0,
    locked_until: null,
    is_active: true,
    created_at: "2026-01-20T08:00:00.000Z",
  },
  {
    id: "usr-admin-01",
    business_id: null,
    role: "kael_admin",
    name: "Tim Operasional KAEL",
    email: "admin@kael.id",
    pin_hash: null,
    failed_pin_attempts: 0,
    locked_until: null,
    is_active: true,
    created_at: "2026-01-01T08:00:00.000Z",
  },
];

let seededCards: Card[] = [
  {
    id: "c-001",
    card_code: "SNJA8823",
    business_id: DEFAULT_BUSINESS_ID,
    type: "review",
    status: "active",
    activation_pin_hash: hashSha256Sync("882341"),
    destination_url: buildGoogleReviewUrl("ChIJb_e9q17vaS4RH958L031Q2A"),
    label: "Meja Kasir Utama",
    customer_id: null,
    tap_count: 142,
    last_tapped_at: new Date(Date.now() - 15 * 60 * 1000).toISOString(),
    created_at: "2026-01-16T10:00:00.000Z",
  },
  {
    id: "c-002",
    card_code: "SNJA4491",
    business_id: DEFAULT_BUSINESS_ID,
    type: "review",
    status: "active",
    activation_pin_hash: hashSha256Sync("449120"),
    destination_url: buildGoogleReviewUrl("ChIJb_e9q17vaS4RH958L031Q2A"),
    label: "Standee Meja 04 (Indoor)",
    customer_id: null,
    tap_count: 89,
    last_tapped_at: new Date(Date.now() - 45 * 60 * 1000).toISOString(),
    created_at: "2026-01-16T10:00:00.000Z",
  },
];

let seededTaps: CardTap[] = [
  ...Array.from({ length: 45 }).map((_, i) => ({
    id: `tap-001-${i}`,
    card_id: "c-001",
    tapped_at: new Date(Date.now() - (i * 14 + 5) * 3600 * 1000).toISOString(),
    source: i % 4 === 0 ? ("qr" as const) : ("nfc" as const),
    ip_hash: `ip_hash_${(i % 12) + 1}`,
    user_agent: "Mozilla/5.0 iPhone",
  })),
];

// -----------------------------------------------------------------------------
// SEED DATA: 02 FINANCE (Ingredients & Recipes)
// -----------------------------------------------------------------------------

let seededIngredients: Ingredient[] = [
  { id: "ing-01", business_id: DEFAULT_BUSINESS_ID, name: "Biji Kopi House Blend (Espresso)", pack_price: 130000, pack_size: 1000, base_unit: "gr", updated_at: "2026-01-15T08:00:00.000Z" },
  { id: "ing-02", business_id: DEFAULT_BUSINESS_ID, name: "Fresh Milk Pasteurisasi", pack_price: 24000, pack_size: 1000, base_unit: "ml", updated_at: "2026-01-15T08:00:00.000Z" },
  { id: "ing-03", business_id: DEFAULT_BUSINESS_ID, name: "Condensed Milk / SKM Kental", pack_price: 16000, pack_size: 500, base_unit: "gr", updated_at: "2026-01-15T08:00:00.000Z" },
  { id: "ing-04", business_id: DEFAULT_BUSINESS_ID, name: "Sirup Salted Caramel Premium", pack_price: 95000, pack_size: 750, base_unit: "ml", updated_at: "2026-01-15T08:00:00.000Z" },
  { id: "ing-05", business_id: DEFAULT_BUSINESS_ID, name: "Tepung Terigu Protein Tinggi", pack_price: 14000, pack_size: 1000, base_unit: "gr", updated_at: "2026-01-15T08:00:00.000Z" },
  { id: "ing-06", business_id: DEFAULT_BUSINESS_ID, name: "French Butter Sheet 82% Fat", pack_price: 95000, pack_size: 500, base_unit: "gr", updated_at: "2026-01-15T08:00:00.000Z" },
  { id: "ing-07", business_id: DEFAULT_BUSINESS_ID, name: "Matcha Uji Ceremonial Powder", pack_price: 180000, pack_size: 500, base_unit: "gr", updated_at: "2026-01-15T08:00:00.000Z" },
  { id: "ing-08", business_id: DEFAULT_BUSINESS_ID, name: "Australian Oat Milk Barista", pack_price: 42000, pack_size: 1000, base_unit: "ml", updated_at: "2026-01-15T08:00:00.000Z" },
];

let seededPriceHistory: IngredientPriceHistory[] = [
  { id: "h-01", ingredient_id: "ing-01", pack_price: 120000, changed_at: "2025-12-01T08:00:00.000Z" },
  { id: "h-02", ingredient_id: "ing-01", pack_price: 130000, changed_at: "2026-01-15T08:00:00.000Z" },
  { id: "h-03", ingredient_id: "ing-02", pack_price: 22000, changed_at: "2025-11-20T08:00:00.000Z" },
  { id: "h-04", ingredient_id: "ing-02", pack_price: 24000, changed_at: "2026-01-15T08:00:00.000Z" },
];

let seededRecipes: Recipe[] = [
  {
    id: "rec-01",
    business_id: DEFAULT_BUSINESS_ID,
    name: "Iced Spanish Latte (16oz)",
    category: "Minuman Kopi",
    type: "olahan",
    output_qty: 1,
    operational_cost: 600,
    selling_price: 28000,
    target_margin_pct: 65,
    ingredients: [
      { ingredient_id: "ing-01", qty: 18 },
      { ingredient_id: "ing-02", qty: 120 },
      { ingredient_id: "ing-03", qty: 30 },
    ],
    packaging: [
      { id: "p1", name: "Cup Injection 16oz + Strawless Lid", cost: 1200 },
      { id: "p2", name: "Stiker Brand & Sedotan", cost: 350 },
    ],
    created_at: "2026-01-20T10:00:00.000Z",
    updated_at: "2026-01-20T10:00:00.000Z",
  },
  {
    id: "rec-02",
    business_id: DEFAULT_BUSINESS_ID,
    name: "Artisan Butter Croissant",
    category: "Pastry & Bakery",
    type: "olahan",
    output_qty: 12,
    operational_cost: 12000,
    selling_price: 24000,
    target_margin_pct: 60,
    ingredients: [
      { ingredient_id: "ing-05", qty: 600 },
      { ingredient_id: "ing-06", qty: 350 },
    ],
    packaging: [
      { id: "p1", name: "Pastry Box Kraft Window", cost: 1200 },
      { id: "p2", name: "Wax Paper & Stiker Segel", cost: 250 },
    ],
    created_at: "2026-01-20T10:00:00.000Z",
    updated_at: "2026-01-20T10:00:00.000Z",
  },
  {
    id: "rec-03",
    business_id: DEFAULT_BUSINESS_ID,
    name: "Iced Uji Matcha Oat Latte",
    category: "Minuman Non-Kopi",
    type: "olahan",
    output_qty: 1,
    operational_cost: 600,
    selling_price: 35000,
    target_margin_pct: 65,
    ingredients: [
      { ingredient_id: "ing-07", qty: 12 },
      { ingredient_id: "ing-08", qty: 150 },
    ],
    packaging: [
      { id: "p1", name: "Cup Injection 16oz + Strawless Lid", cost: 1200 },
      { id: "p2", name: "Stiker Brand", cost: 250 },
    ],
    created_at: "2026-01-22T10:00:00.000Z",
    updated_at: "2026-01-22T10:00:00.000Z",
  },
  {
    id: "rec-04",
    business_id: DEFAULT_BUSINESS_ID,
    name: "Truffle Potato Chips (Grosir)",
    category: "Snack Kulakan",
    type: "kulakan",
    output_qty: 1,
    operational_cost: 0,
    selling_price: 18000,
    target_margin_pct: 50,
    ingredients: [],
    packaging: [
      { id: "p1", name: "Modal Beli Grosir / pcs", cost: 9500 },
      { id: "p2", name: "Beban Ongkir & Label", cost: 1000 },
    ],
    created_at: "2026-01-25T10:00:00.000Z",
    updated_at: "2026-01-25T10:00:00.000Z",
  },
];

// -----------------------------------------------------------------------------
// SEED DATA: 03 LOYALTY (Customers, Programs, Ledger, Rewards)
// -----------------------------------------------------------------------------

let seededCustomers: Customer[] = [
  { id: "cust-01", business_id: DEFAULT_BUSINESS_ID, phone: "6281298327812", name: "Rian Pratama", birthday: "1994-05-12", token: "k7xN29LmQp84VwZ1029482", consent_at: "2026-01-20T11:00:00.000Z", created_at: "2026-01-20T11:00:00.000Z" },
  { id: "cust-02", business_id: DEFAULT_BUSINESS_ID, phone: "6285711223344", name: "Siti Rahmawati", birthday: "1998-11-04", token: "m9Lq20PkXw74NvA8839201", consent_at: "2026-01-22T14:30:00.000Z", created_at: "2026-01-22T14:30:00.000Z" },
  { id: "cust-03", business_id: DEFAULT_BUSINESS_ID, phone: "6281399887766", name: "Kevin Sanjaya", birthday: "1992-08-18", token: "w2Nz94LkPm61VxQ7740192", consent_at: "2026-01-25T16:00:00.000Z", created_at: "2026-01-25T16:00:00.000Z" },
  { id: "cust-04", business_id: DEFAULT_BUSINESS_ID, phone: "6282144556677", name: "Nadia Utami", birthday: "2000-02-14", token: "p5Qx81LmVk39NwZ2219483", consent_at: "2026-02-01T09:15:00.000Z", created_at: "2026-02-01T09:15:00.000Z" },
];

let seededLoyaltyProgram: LoyaltyProgram = {
  id: "lp-01",
  business_id: DEFAULT_BUSINESS_ID,
  mode: "point",
  earn_rate: 10000,
  stamp_per_visit: 1,
  point_expiry_months: null,
  updated_at: "2026-01-15T08:00:00.000Z",
};

let seededPointLedger: PointLedger[] = [
  { id: "pl-01", business_id: DEFAULT_BUSINESS_ID, customer_id: "cust-01", delta: 12, reason: "purchase", note: "Order ORD-9012 (Rp 120.000)", amount_spent: 120000, created_by: "usr-staff-01", created_at: "2026-02-10T14:00:00.000Z" },
  { id: "pl-02", business_id: DEFAULT_BUSINESS_ID, customer_id: "cust-01", delta: 6, reason: "purchase", note: "Order ORD-9344 (Rp 65.000)", amount_spent: 65000, created_by: "usr-staff-02", created_at: "2026-02-18T16:30:00.000Z" },
  { id: "pl-03", business_id: DEFAULT_BUSINESS_ID, customer_id: "cust-02", delta: 8, reason: "purchase", note: "Order ORD-8921 (Rp 80.000)", amount_spent: 80000, created_by: "usr-staff-01", created_at: "2026-02-15T11:20:00.000Z" },
  { id: "pl-04", business_id: DEFAULT_BUSINESS_ID, customer_id: "cust-03", delta: 25, reason: "purchase", note: "Order ORD-7712 (Rp 250.000)", amount_spent: 250000, created_by: "usr-staff-01", created_at: "2026-02-05T19:00:00.000Z" },
];

let seededRewards: Reward[] = [
  { id: "rw-01", business_id: DEFAULT_BUSINESS_ID, name: "Gratis 1x Iced Spanish Latte (16oz)", point_cost: 10, market_value: 28000, stock: null, is_active: true, created_at: "2026-01-15T08:00:00.000Z" },
  { id: "rw-02", business_id: DEFAULT_BUSINESS_ID, name: "Gratis 1x Artisan Butter Croissant", point_cost: 8, market_value: 24000, stock: null, is_active: true, created_at: "2026-01-15T08:00:00.000Z" },
  { id: "rw-03", business_id: DEFAULT_BUSINESS_ID, name: "Diskon Potongan Langsung Rp 50.000", point_cost: 20, market_value: 50000, stock: 50, is_active: true, created_at: "2026-01-15T08:00:00.000Z" },
];

let seededRedemptions: Redemption[] = [];

// -----------------------------------------------------------------------------
// SEED DATA: 04 KAEL POS & ORDERING (Categories, Menu Items, Shifts, Orders)
// -----------------------------------------------------------------------------

let seededCategories: Category[] = [
  { id: "cat-01", business_id: DEFAULT_BUSINESS_ID, name: "Kopi Favorit", sort_order: 1 },
  { id: "cat-02", business_id: DEFAULT_BUSINESS_ID, name: "Non-Kopi", sort_order: 2 },
  { id: "cat-03", business_id: DEFAULT_BUSINESS_ID, name: "Pastry & Toast", sort_order: 3 },
  { id: "cat-04", business_id: DEFAULT_BUSINESS_ID, name: "Snack & Lainnya", sort_order: 4 },
];

let seededMenuItems: MenuItem[] = [
  { id: "m-01", business_id: DEFAULT_BUSINESS_ID, category_id: "cat-01", name: "Iced Spanish Latte", price: 28000, is_available: true, recipe_id: "rec-01", sort_order: 1 },
  { id: "m-02", business_id: DEFAULT_BUSINESS_ID, category_id: "cat-01", name: "Americano Classic", price: 22000, is_available: true, recipe_id: null, sort_order: 2 },
  { id: "m-03", business_id: DEFAULT_BUSINESS_ID, category_id: "cat-01", name: "Caramel Macchiato", price: 32000, is_available: true, recipe_id: null, sort_order: 3 },
  { id: "m-04", business_id: DEFAULT_BUSINESS_ID, category_id: "cat-02", name: "Iced Uji Matcha Oat Latte", price: 35000, is_available: true, recipe_id: "rec-03", sort_order: 4 },
  { id: "m-05", business_id: DEFAULT_BUSINESS_ID, category_id: "cat-02", name: "Earl Grey Milk Tea", price: 26000, is_available: true, recipe_id: null, sort_order: 5 },
  { id: "m-06", business_id: DEFAULT_BUSINESS_ID, category_id: "cat-03", name: "Artisan Butter Croissant", price: 24000, is_available: true, recipe_id: "rec-02", sort_order: 6 },
  { id: "m-07", business_id: DEFAULT_BUSINESS_ID, category_id: "cat-03", name: "Pain au Chocolat", price: 28000, is_available: true, recipe_id: null, sort_order: 7 },
  { id: "m-08", business_id: DEFAULT_BUSINESS_ID, category_id: "cat-04", name: "Truffle Potato Chips", price: 18000, is_available: true, recipe_id: "rec-04", sort_order: 8 },
];

let seededShifts: Shift[] = [
  {
    id: "shift-01",
    business_id: DEFAULT_BUSINESS_ID,
    opened_by: "usr-staff-01",
    opened_at: new Date(Date.now() - 6 * 3600 * 1000).toISOString(),
    opening_cash: 150000, // Rp 150.000 modal kembalian
    closed_at: null,
    closing_cash: null,
    expected_cash: null,
    variance: null,
    notes: "Shift Pagi Barista Budi",
  },
];

let seededOrders: Order[] = [
  {
    id: "ord-001",
    business_id: DEFAULT_BUSINESS_ID,
    order_no: "A-001",
    channel: "cashier",
    table_no: null,
    status: "paid",
    subtotal: 52000,
    discount: 0,
    tax: 0,
    service_charge: 0,
    total: 52000,
    payment_method: "cash",
    cash_given: 100000,
    cash_change: 48000,
    customer_id: "cust-01",
    shift_id: "shift-01",
    created_by: "usr-staff-01",
    created_at: new Date(Date.now() - 4 * 3600 * 1000).toISOString(),
  },
  {
    id: "ord-002",
    business_id: DEFAULT_BUSINESS_ID,
    order_no: "A-002",
    channel: "qr_dinein",
    table_no: "04",
    status: "paid",
    subtotal: 59000,
    discount: 0,
    tax: 0,
    service_charge: 0,
    total: 59000,
    payment_method: "qris",
    cash_given: null,
    cash_change: null,
    customer_id: null,
    shift_id: "shift-01",
    created_by: "usr-staff-01",
    created_at: new Date(Date.now() - 2 * 3600 * 1000).toISOString(),
  },
];

let seededOrderItems: OrderItem[] = [
  { id: "oi-01", order_id: "ord-001", menu_item_id: "m-01", name_snapshot: "Iced Spanish Latte", price_snapshot: 28000, qty: 1, subtotal: 28000, note: "Less sugar" },
  { id: "oi-02", order_id: "ord-001", menu_item_id: "m-06", name_snapshot: "Artisan Butter Croissant", price_snapshot: 24000, qty: 1, subtotal: 24000, note: "Hangatkan" },
  { id: "oi-03", order_id: "ord-002", menu_item_id: "m-04", name_snapshot: "Iced Uji Matcha Oat Latte", price_snapshot: 35000, qty: 1, subtotal: 35000, note: "Normal ice" },
  { id: "oi-04", order_id: "ord-002", menu_item_id: "m-06", name_snapshot: "Artisan Butter Croissant", price_snapshot: 24000, qty: 1, subtotal: 24000, note: "" },
];

let seededRefunds: Refund[] = [];

// -----------------------------------------------------------------------------
// REPOSITORY METHODS
// -----------------------------------------------------------------------------

export const db = {
  // Business
  getBusiness(id = DEFAULT_BUSINESS_ID): Business | null {
    return seededBusinesses.find((b) => b.id === id) || seededBusinesses[0] || null;
  },

  updateBusiness(id: string, updates: Partial<Business>): Business | null {
    const idx = seededBusinesses.findIndex((b) => b.id === id);
    if (idx === -1) return null;
    seededBusinesses[idx] = { ...seededBusinesses[idx], ...updates };
    return seededBusinesses[idx];
  },

  // Modules
  getModules(businessId = DEFAULT_BUSINESS_ID): BusinessModule[] {
    return seededModules.filter((m) => m.business_id === businessId);
  },

  // Users & Staff
  getUsers(businessId = DEFAULT_BUSINESS_ID): User[] {
    return seededUsers.filter((u) => u.business_id === businessId || u.role === "kael_admin");
  },

  getUserByEmail(email: string): User | null {
    return seededUsers.find((u) => u.email?.toLowerCase() === email.toLowerCase()) || null;
  },

  authenticateStaffPin(businessId: string, pin: string) {
    const staffList = seededUsers.filter((u) => u.business_id === businessId && u.role === "staff" && u.is_active);
    const pinHash = hashSha256Sync(pin);

    const matched = staffList.find((s) => s.pin_hash === pinHash || s.pin_hash === pin);

    if (matched) {
      const lockout = checkStaffLockout(matched.failed_pin_attempts, matched.locked_until);
      if (lockout.isLocked) {
        return {
          success: false,
          error: `Akun terkunci karena 5x salah PIN. Tunggu ${lockout.remainingMinutes} menit lagi.`,
          lockout,
        };
      }

      matched.failed_pin_attempts = 0;
      matched.locked_until = null;
      return { success: true, user: matched };
    }

    const candidate = staffList[0];
    if (candidate) {
      candidate.failed_pin_attempts = (candidate.failed_pin_attempts || 0) + 1;
      if (candidate.failed_pin_attempts >= 5) {
        candidate.locked_until = calculateLockoutExpiry().toISOString();
      }
      const lockout = checkStaffLockout(candidate.failed_pin_attempts, candidate.locked_until);
      return {
        success: false,
        error: lockout.isLocked
          ? "PIN salah 5 kali! Akun dikunci 15 menit."
          : `PIN salah. Sisa kesempatan: ${lockout.attemptsRemaining} kali.`,
        lockout,
      };
    }

    return { success: false, error: "Staf tidak ditemukan untuk bisnis ini." };
  },

  createStaff(businessId: string, name: string, pin: string): User {
    const newUser: User = {
      id: `usr-staff-${Date.now()}`,
      business_id: businessId,
      role: "staff",
      name,
      email: null,
      pin_hash: hashSha256Sync(pin),
      failed_pin_attempts: 0,
      locked_until: null,
      is_active: true,
      created_at: new Date().toISOString(),
    };
    seededUsers.push(newUser);
    return newUser;
  },

  // Cards
  getCardByCode(code: string): Card | null {
    if (!code) return null;
    const clean = code.trim().toUpperCase();
    return seededCards.find((c) => c.card_code === clean) || null;
  },

  getCards(businessId = DEFAULT_BUSINESS_ID): Card[] {
    return seededCards.filter((c) => c.business_id === businessId);
  },

  getAllCards(): Card[] {
    return [...seededCards];
  },

  createBatchCards(count: number, type: "review" | "loyalty" | "attendance" = "review") {
    const created: Card[] = [];
    const plainPins: string[] = [];

    for (let i = 0; i < count; i++) {
      let code = generateCardCode();
      while (seededCards.some((c) => c.card_code === code)) {
        code = generateCardCode();
      }

      const pin = generateActivationPin();
      plainPins.push(pin);

      const newCard: Card = {
        id: `c-${Date.now()}-${i}`,
        card_code: code,
        business_id: null,
        type,
        status: "unactivated",
        activation_pin_hash: hashSha256Sync(pin),
        destination_url: null,
        label: null,
        customer_id: null,
        tap_count: 0,
        last_tapped_at: null,
        created_at: new Date().toISOString(),
      };
      seededCards.push(newCard);
      created.push(newCard);
    }

    return { cards: created, plainPins };
  },

  activateCard(code: string, pin: string, businessId: string, destinationUrl: string, label = "Meja Kasir") {
    const card = this.getCardByCode(code);
    if (!card) return { success: false, error: "Kartu tidak ditemukan." };
    if (card.status === "active") return { success: false, error: "Kartu sudah pernah aktif." };

    card.business_id = businessId;
    card.status = "active";
    card.destination_url = destinationUrl;
    card.label = label;
    return { success: true, card };
  },

  updateCard(cardId: string, updates: Partial<Card>): Card | null {
    const idx = seededCards.findIndex((c) => c.id === cardId);
    if (idx === -1) return null;
    seededCards[idx] = { ...seededCards[idx], ...updates };
    return seededCards[idx];
  },

  async recordCardTap(cardId: string, source: "nfc" | "qr" = "nfc", clientIp = "127.0.0.1", userAgent = "") {
    const ipHash = await hashClientIp(clientIp);
    const now = new Date().toISOString();

    const newTap: CardTap = {
      id: `tap-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      card_id: cardId,
      tapped_at: now,
      source,
      ip_hash: ipHash,
      user_agent: userAgent,
    };
    seededTaps.push(newTap);

    const card = seededCards.find((c) => c.id === cardId);
    if (card) {
      card.tap_count = (card.tap_count || 0) + 1;
      card.last_tapped_at = now;
    }
    return newTap;
  },

  getCardTaps(cardId?: string, businessId = DEFAULT_BUSINESS_ID): CardTap[] {
    if (cardId) return seededTaps.filter((t) => t.card_id === cardId);
    const businessCardIds = new Set(seededCards.filter((c) => c.business_id === businessId).map((c) => c.id));
    return seededTaps.filter((t) => businessCardIds.has(t.card_id));
  },

  // ---------------------------------------------------------------------------
  // 03 · LOYALTY REPOSITORY
  // ---------------------------------------------------------------------------

  getLoyaltyProgram(businessId = DEFAULT_BUSINESS_ID): LoyaltyProgram {
    return seededLoyaltyProgram;
  },

  updateLoyaltyProgram(businessId = DEFAULT_BUSINESS_ID, updates: Partial<LoyaltyProgram>): LoyaltyProgram {
    seededLoyaltyProgram = { ...seededLoyaltyProgram, ...updates, updated_at: new Date().toISOString() };
    return seededLoyaltyProgram;
  },

  getCustomers(businessId = DEFAULT_BUSINESS_ID): Customer[] {
    return seededCustomers.filter((c) => c.business_id === businessId);
  },

  getCustomerById(id: string): Customer | null {
    return seededCustomers.find((c) => c.id === id) || null;
  },

  getCustomerByToken(token: string): Customer | null {
    if (!token) return null;
    return seededCustomers.find((c) => c.token === token) || null;
  },

  searchCustomers(businessId = DEFAULT_BUSINESS_ID, query: string): (Customer & { balance: number })[] {
    if (!query) {
      return seededCustomers
        .filter((c) => c.business_id === businessId)
        .map((c) => ({ ...c, balance: this.getCustomerPointBalance(c.id) }));
    }

    const cleanQ = query.trim().toLowerCase();
    const cleanNumbers = query.replace(/[^0-9]/g, "");

    const matched = seededCustomers.filter((c) => {
      if (c.business_id !== businessId) return false;
      const nameMatch = c.name?.toLowerCase().includes(cleanQ);
      const phoneMatch = c.phone.includes(cleanNumbers);
      const last4Match = cleanNumbers.length >= 2 && c.phone.endsWith(cleanNumbers);
      return nameMatch || phoneMatch || last4Match;
    });

    return matched.map((c) => ({ ...c, balance: this.getCustomerPointBalance(c.id) }));
  },

  registerCustomer(businessId = DEFAULT_BUSINESS_ID, name: string, rawPhone: string, birthday?: string) {
    const normalizedPhone = normalizePhoneNumber(rawPhone);
    if (!normalizedPhone || normalizedPhone.length < 9) {
      return { success: false, error: "Nomor WhatsApp tidak valid." };
    }

    const existing = seededCustomers.find((c) => c.business_id === businessId && c.phone === normalizedPhone);
    if (existing) return { success: true, customer: existing };

    const newCustomer: Customer = {
      id: `cust-${Date.now()}`,
      business_id: businessId,
      phone: normalizedPhone,
      name: name.trim() || "Member KAEL",
      birthday: birthday || null,
      token: generateCustomerToken(22),
      consent_at: new Date().toISOString(),
      created_at: new Date().toISOString(),
    };
    seededCustomers.push(newCustomer);
    return { success: true, customer: newCustomer };
  },

  getCustomerPointBalance(customerId: string): number {
    const transactions = seededPointLedger.filter((pl) => pl.customer_id === customerId);
    return transactions.reduce((acc, t) => acc + t.delta, 0);
  },

  addPointTransaction(businessId = DEFAULT_BUSINESS_ID, customerId: string, delta: number, reason: PointLedger["reason"], note: string, amountSpent: number | null, staffUserId: string): PointLedger {
    const newEntry: PointLedger = {
      id: `pl-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      business_id: businessId,
      customer_id: customerId,
      delta,
      reason,
      note,
      amount_spent: amountSpent,
      created_by: staffUserId || "usr-staff-01",
      created_at: new Date().toISOString(),
    };
    seededPointLedger.push(newEntry);
    return newEntry;
  },

  getCustomerLedger(customerId: string): PointLedger[] {
    return seededPointLedger
      .filter((pl) => pl.customer_id === customerId)
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  },

  getRewards(businessId = DEFAULT_BUSINESS_ID): Reward[] {
    return seededRewards.filter((r) => r.business_id === businessId);
  },

  saveReward(businessId = DEFAULT_BUSINESS_ID, data: Omit<Reward, "id" | "business_id" | "created_at"> & { id?: string }): Reward {
    if (data.id) {
      const idx = seededRewards.findIndex((r) => r.id === data.id);
      if (idx !== -1) {
        seededRewards[idx] = {
          ...seededRewards[idx],
          name: data.name,
          point_cost: Math.max(1, data.point_cost),
          market_value: Math.max(0, data.market_value),
          stock: data.stock,
          is_active: data.is_active,
        };
        return seededRewards[idx];
      }
    }

    const newReward: Reward = {
      id: `rw-${Date.now()}`,
      business_id: businessId,
      name: data.name,
      point_cost: Math.max(1, data.point_cost),
      market_value: Math.max(0, data.market_value),
      stock: data.stock,
      is_active: data.is_active,
      created_at: new Date().toISOString(),
    };
    seededRewards.push(newReward);
    return newReward;
  },

  deleteReward(id: string): boolean {
    const idx = seededRewards.findIndex((r) => r.id === id);
    if (idx === -1) return false;
    seededRewards.splice(idx, 1);
    return true;
  },

  issueRedemption(customerId: string, rewardId: string, staffUserId: string) {
    const customer = this.getCustomerById(customerId);
    const reward = seededRewards.find((r) => r.id === rewardId);

    if (!customer || !reward) return { success: false, error: "Pelanggan atau Hadiah tidak ditemukan." };

    const balance = this.getCustomerPointBalance(customerId);
    if (balance < reward.point_cost) {
      return { success: false, error: `Poin tidak mencukupi (${balance}/${reward.point_cost} Pts).` };
    }

    this.addPointTransaction(customer.business_id, customerId, -reward.point_cost, "redeem", `Tukar Reward: ${reward.name}`, null, staffUserId);

    const newRedemption: Redemption = {
      id: `rdm-${Date.now()}`,
      customer_id: customerId,
      reward_id: rewardId,
      code: generateRedemptionCode(),
      status: "used",
      redeemed_by: staffUserId,
      created_at: new Date().toISOString(),
      used_at: new Date().toISOString(),
    };
    seededRedemptions.push(newRedemption);
    return { success: true, redemption: newRedemption };
  },

  getRedemptions(customerId?: string): Redemption[] {
    if (customerId) return seededRedemptions.filter((r) => r.customer_id === customerId);
    return [...seededRedemptions];
  },

  anonymizeCustomer(customerId: string): boolean {
    const cust = seededCustomers.find((c) => c.id === customerId);
    if (!cust) return false;
    cust.name = "Pelanggan Anonim (Dihapus)";
    cust.phone = `62999${Math.floor(1000000 + Math.random() * 9000000)}`;
    cust.birthday = null;
    cust.token = generateCustomerToken(22);
    return true;
  },

  getStaffPointsAudit(businessId = DEFAULT_BUSINESS_ID) {
    const businessStaff = seededUsers.filter((u) => u.business_id === businessId && u.role === "staff");
    return businessStaff.map((st) => ({
      staffId: st.id,
      name: st.name,
      totalPointsIssued: seededPointLedger.filter((pl) => pl.created_by === st.id && pl.delta > 0).reduce((sum, t) => sum + t.delta, 0),
      manualPointsCount: seededPointLedger.filter((pl) => pl.created_by === st.id && pl.reason === "manual").reduce((sum, t) => sum + t.delta, 0),
      transactionCount: seededPointLedger.filter((pl) => pl.created_by === st.id).length,
    }));
  },

  // ---------------------------------------------------------------------------
  // 04 · KAEL POS & ORDERING REPOSITORY
  // ---------------------------------------------------------------------------

  getCategories(businessId = DEFAULT_BUSINESS_ID): Category[] {
    return seededCategories.filter((c) => c.business_id === businessId);
  },

  getMenuItems(businessId = DEFAULT_BUSINESS_ID): MenuItem[] {
    return seededMenuItems.filter((m) => m.business_id === businessId);
  },

  updateMenuItemAvailability(id: string, isAvailable: boolean): boolean {
    const item = seededMenuItems.find((m) => m.id === id);
    if (!item) return false;
    item.is_available = isAvailable;
    return true;
  },

  createMenuItem(businessId = DEFAULT_BUSINESS_ID, data: Omit<MenuItem, "id" | "business_id">): MenuItem {
    const newItem: MenuItem = {
      id: `m-${Date.now()}`,
      business_id: businessId,
      ...data,
    };
    seededMenuItems.push(newItem);
    return newItem;
  },

  getActiveShift(businessId = DEFAULT_BUSINESS_ID): Shift | null {
    return seededShifts.find((s) => s.business_id === businessId && s.closed_at === null) || null;
  },

  openShift(businessId = DEFAULT_BUSINESS_ID, staffUserId: string, openingCash: number, notes?: string): Shift {
    const active = this.getActiveShift(businessId);
    if (active) return active;

    const newShift: Shift = {
      id: `shift-${Date.now()}`,
      business_id: businessId,
      opened_by: staffUserId,
      opened_at: new Date().toISOString(),
      opening_cash: Math.max(0, openingCash),
      closed_at: null,
      closing_cash: null,
      expected_cash: null,
      variance: null,
      notes: notes || null,
    };
    seededShifts.push(newShift);
    return newShift;
  },

  closeShift(shiftId: string, physicalClosingCash: number, notes?: string): Shift | null {
    const shift = seededShifts.find((s) => s.id === shiftId);
    if (!shift || shift.closed_at !== null) return null;

    // Total cash sales in this shift
    const shiftCashOrders = seededOrders.filter((o) => o.shift_id === shiftId && o.status === "paid" && o.payment_method === "cash");
    const totalCashSales = shiftCashOrders.reduce((sum, o) => sum + o.total, 0);

    const recon = calculateShiftReconciliation(shift.opening_cash, totalCashSales, physicalClosingCash);

    shift.closed_at = new Date().toISOString();
    shift.closing_cash = physicalClosingCash;
    shift.expected_cash = recon.expectedCash;
    shift.variance = recon.variance;
    if (notes) shift.notes = notes;

    return shift;
  },

  getShifts(businessId = DEFAULT_BUSINESS_ID): Shift[] {
    return seededShifts.filter((s) => s.business_id === businessId).sort((a, b) => new Date(b.opened_at).getTime() - new Date(a.opened_at).getTime());
  },

  createOrder(
    businessId = DEFAULT_BUSINESS_ID,
    orderData: {
      channel: Order["channel"];
      table_no?: string | null;
      status?: Order["status"];
      discount?: number;
      tax?: number;
      service_charge?: number;
      payment_method: Order["payment_method"];
      cash_given?: number | null;
      customer_id?: string | null;
      shift_id?: string | null;
      created_by: string;
    },
    itemsData: {
      menu_item_id: string;
      name: string;
      price: number;
      qty: number;
      note?: string;
    }[]
  ): { order: Order; items: OrderItem[] } {
    const orderId = `ord-${Date.now()}`;
    const orderCountToday = seededOrders.length + 1;
    const orderNo = generateDailyOrderNo(orderCountToday);

    const calc = calculateCartTotals(itemsData, orderData.discount || 0, orderData.tax || 0, orderData.service_charge || 0);

    const cashGiven = orderData.payment_method === "cash" ? Number(orderData.cash_given || calc.total) : null;
    const cashChange = orderData.payment_method === "cash" && cashGiven ? Math.max(0, cashGiven - calc.total) : null;

    const newOrder: Order = {
      id: orderId,
      business_id: businessId,
      order_no: orderNo,
      channel: orderData.channel,
      table_no: orderData.table_no || null,
      status: orderData.status || "paid",
      subtotal: calc.subtotal,
      discount: calc.discount,
      tax: calc.tax,
      service_charge: calc.serviceCharge,
      total: calc.total,
      payment_method: orderData.payment_method,
      cash_given: cashGiven,
      cash_change: cashChange,
      customer_id: orderData.customer_id || null,
      shift_id: orderData.shift_id || null,
      created_by: orderData.created_by,
      created_at: new Date().toISOString(),
    };

    const createdItems: OrderItem[] = itemsData.map((it, idx) => ({
      id: `oi-${Date.now()}-${idx}`,
      order_id: orderId,
      menu_item_id: it.menu_item_id,
      name_snapshot: it.name,
      price_snapshot: it.price,
      qty: it.qty,
      subtotal: it.price * it.qty,
      note: it.note,
    }));

    seededOrders.unshift(newOrder);
    seededOrderItems.push(...createdItems);

    // Integrasi KAEL Loyalty: jika customer_id terisi & order lunas, otomatis beri poin!
    if (newOrder.status === "paid" && newOrder.customer_id) {
      const loyaltyProg = this.getLoyaltyProgram(businessId);
      const earned = loyaltyProg.mode === "stamp" ? loyaltyProg.stamp_per_visit : calculateEarnedPoints(newOrder.total, loyaltyProg.earn_rate);
      if (earned > 0) {
        this.addPointTransaction(businessId, newOrder.customer_id, earned, "purchase", `Transaksi POS ${newOrder.order_no} (${formatRupiah(newOrder.total)})`, newOrder.total, newOrder.created_by);
      }
    }

    return { order: newOrder, items: createdItems };
  },

  getOrderById(id: string): { order: Order; items: OrderItem[]; customer?: Customer | null; business?: Business | null } | null {
    const order = seededOrders.find((o) => o.id === id);
    if (!order) return null;
    const items = seededOrderItems.filter((oi) => oi.order_id === id);
    const customer = order.customer_id ? this.getCustomerById(order.customer_id) : null;
    const business = this.getBusiness(order.business_id);
    return { order, items, customer, business };
  },

  getOrders(businessId = DEFAULT_BUSINESS_ID, limit = 50): Order[] {
    return seededOrders.filter((o) => o.business_id === businessId).slice(0, limit);
  },

  getOrderItems(orderId: string): OrderItem[] {
    return seededOrderItems.filter((oi) => oi.order_id === orderId);
  },

  getPendingQrOrders(businessId = DEFAULT_BUSINESS_ID): (Order & { items: OrderItem[] })[] {
    const qrOrders = seededOrders.filter((o) => o.business_id === businessId && o.channel.startsWith("qr_") && o.status === "open");
    return qrOrders.map((o) => ({
      ...o,
      items: seededOrderItems.filter((oi) => oi.order_id === o.id),
    }));
  },

  updateOrderStatus(orderId: string, status: Order["status"]): Order | null {
    const order = seededOrders.find((o) => o.id === orderId);
    if (!order) return null;
    order.status = status;
    return order;
  },

  refundOrder(orderId: string, amount: number, reason: string, ownerUserId: string): { success: boolean; refund?: Refund; error?: string } {
    const order = seededOrders.find((o) => o.id === orderId);
    if (!order) return { success: false, error: "Order tidak ditemukan." };
    if (order.status === "refunded") return { success: false, error: "Order sudah pernah di-refund." };

    order.status = "refunded";

    const newRefund: Refund = {
      id: `ref-${Date.now()}`,
      order_id: orderId,
      amount,
      reason,
      approved_by: ownerUserId,
      created_at: new Date().toISOString(),
    };
    seededRefunds.push(newRefund);

    return { success: true, refund: newRefund };
  },

  getPosReports(businessId = DEFAULT_BUSINESS_ID) {
    const businessOrders = seededOrders.filter((o) => o.business_id === businessId && o.status === "paid");
    const totalGrossRevenue = businessOrders.reduce((sum, o) => sum + o.subtotal, 0);
    const totalNetRevenue = businessOrders.reduce((sum, o) => sum + o.total, 0);
    const totalTransactions = businessOrders.length;

    // Payment methods breakdown
    const paymentBreakdown = {
      cash: businessOrders.filter((o) => o.payment_method === "cash").reduce((s, o) => s + o.total, 0),
      qris: businessOrders.filter((o) => o.payment_method === "qris").reduce((s, o) => s + o.total, 0),
      transfer: businessOrders.filter((o) => o.payment_method === "transfer").reduce((s, o) => s + o.total, 0),
    };

    // Item popularity & gross profit calculation linked with KAEL Finance HPP
    const recipesWithCalc = this.getAllRecipesWithCalculations(businessId);
    const recipeHppMap = new Map<string, number>();
    recipesWithCalc.forEach((r) => recipeHppMap.set(r.recipe.id, r.calculation.hpp_per_unit));

    const menuItems = this.getMenuItems(businessId);
    const itemSalesCount = new Map<string, { name: string; qty: number; revenue: number; hpp: number; grossProfit: number }>();

    seededOrderItems.forEach((oi) => {
      const order = seededOrders.find((o) => o.id === oi.order_id);
      if (!order || order.status !== "paid") return;

      const menuItem = menuItems.find((m) => m.id === oi.menu_item_id);
      const hppPerUnit = menuItem?.recipe_id ? (recipeHppMap.get(menuItem.recipe_id) || 0) : 0;
      const totalHpp = hppPerUnit * oi.qty;
      const totalRev = oi.price_snapshot * oi.qty;
      const totalProfit = totalRev - totalHpp;

      const existing = itemSalesCount.get(oi.name_snapshot) || {
        name: oi.name_snapshot,
        qty: 0,
        revenue: 0,
        hpp: 0,
        grossProfit: 0,
      };

      existing.qty += oi.qty;
      existing.revenue += totalRev;
      existing.hpp += totalHpp;
      existing.grossProfit += totalProfit;

      itemSalesCount.set(oi.name_snapshot, existing);
    });

    const topSellingItems = Array.from(itemSalesCount.values()).sort((a, b) => b.qty - a.qty);
    const totalEstimatedHpp = topSellingItems.reduce((s, i) => s + i.hpp, 0);
    const totalEstimatedGrossProfit = totalNetRevenue - totalEstimatedHpp;

    return {
      totalGrossRevenue,
      totalNetRevenue,
      totalTransactions,
      paymentBreakdown,
      topSellingItems,
      totalEstimatedHpp,
      totalEstimatedGrossProfit,
    };
  },

  // ---------------------------------------------------------------------------
  // 02 · KAEL FINANCE REPOSITORY
  // ---------------------------------------------------------------------------

  getIngredients(businessId = DEFAULT_BUSINESS_ID): Ingredient[] {
    return seededIngredients.filter((i) => i.business_id === businessId);
  },

  getIngredientsMap(businessId = DEFAULT_BUSINESS_ID): Map<string, IngredientItem> {
    const map = new Map<string, IngredientItem>();
    seededIngredients.filter((i) => i.business_id === businessId).forEach((i) => {
      map.set(i.id, { id: i.id, name: i.name, pack_price: i.pack_price, pack_size: i.pack_size, base_unit: i.base_unit });
    });
    return map;
  },

  createIngredient(businessId = DEFAULT_BUSINESS_ID, name: string, packPrice: number, packSize: number, baseUnit: "gr" | "ml" | "pcs") {
    const newIng: Ingredient = { id: `ing-${Date.now()}`, business_id: businessId, name, pack_price: Math.max(0, packPrice), pack_size: Math.max(1, packSize), base_unit: baseUnit, updated_at: new Date().toISOString() };
    seededIngredients.push(newIng);
    return newIng;
  },

  updateIngredientPrice(id: string, newPackPrice: number) {
    const ing = seededIngredients.find((i) => i.id === id);
    if (!ing) return { ingredient: null, affectedRecipesCount: 0 };
    if (ing.pack_price !== newPackPrice) {
      seededPriceHistory.push({ id: `h-${Date.now()}`, ingredient_id: id, pack_price: newPackPrice, changed_at: new Date().toISOString() });
      ing.pack_price = Math.max(0, newPackPrice);
      ing.updated_at = new Date().toISOString();
    }
    const affected = seededRecipes.filter((r) => r.ingredients.some((ri) => ri.ingredient_id === id));
    return { ingredient: ing, affectedRecipesCount: affected.length };
  },

  getIngredientPriceHistory(ingredientId: string): IngredientPriceHistory[] {
    return seededPriceHistory.filter((h) => h.ingredient_id === ingredientId).sort((a, b) => new Date(b.changed_at).getTime() - new Date(a.changed_at).getTime());
  },

  getRecipes(businessId = DEFAULT_BUSINESS_ID): Recipe[] {
    return seededRecipes.filter((r) => r.business_id === businessId);
  },

  getAllRecipesWithCalculations(businessId = DEFAULT_BUSINESS_ID) {
    const ingMap = this.getIngredientsMap(businessId);
    const recipes = this.getRecipes(businessId);
    return recipes.map((recipe) => ({
      recipe,
      calculation: calculateRecipeHpp({ type: recipe.type, output_qty: recipe.output_qty, operational_cost: recipe.operational_cost, selling_price: recipe.selling_price, target_margin_pct: recipe.target_margin_pct, ingredients: recipe.ingredients, packaging: recipe.packaging }, ingMap),
    }));
  },

  saveRecipe(businessId = DEFAULT_BUSINESS_ID, data: Omit<Recipe, "id" | "business_id" | "created_at" | "updated_at"> & { id?: string }) {
    const now = new Date().toISOString();
    if (data.id) {
      const idx = seededRecipes.findIndex((r) => r.id === data.id);
      if (idx !== -1) {
        seededRecipes[idx] = { ...seededRecipes[idx], name: data.name, category: data.category, type: data.type, output_qty: Math.max(1, data.output_qty), operational_cost: Math.max(0, data.operational_cost), selling_price: Math.max(0, data.selling_price), target_margin_pct: data.target_margin_pct, ingredients: data.ingredients, packaging: data.packaging, updated_at: now };
        return seededRecipes[idx];
      }
    }
    const newRec: Recipe = { id: `rec-${Date.now()}`, business_id: businessId, name: data.name, category: data.category || "Menu", type: data.type || "olahan", output_qty: Math.max(1, data.output_qty || 1), operational_cost: Math.max(0, data.operational_cost || 0), selling_price: Math.max(0, data.selling_price || 0), target_margin_pct: data.target_margin_pct || 60, ingredients: data.ingredients || [], packaging: data.packaging || [], created_at: now, updated_at: now };
    seededRecipes.push(newRec);
    return newRec;
  },

  deleteRecipe(id: string): boolean {
    const idx = seededRecipes.findIndex((r) => r.id === id);
    if (idx === -1) return false;
    seededRecipes.splice(idx, 1);
    return true;
  },
};
