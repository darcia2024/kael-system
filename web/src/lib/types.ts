/**
 * Bentuk data KAEL, dipakai bersama oleh lapisan server dan komponen client.
 *
 * Sengaja dipisah dari db.ts: db.ts adalah modul server-only karena memegang
 * kredensial database, sementara tipe di sini aman di-import dari mana saja.
 * Tanpa pemisahan ini, satu import tipe dari komponen client akan menggagalkan
 * build.
 *
 * Konvensi uang: bigint rupiah bulat, tanpa desimal.
 * Konvensi waktu: string ISO dalam UTC, ditampilkan memakai businesses.timezone.
 */

import type { RecipeIngredientItem, RecipePackagingItem } from "./finance-engine";

/**
 * Modul yang bisa diberikan owner ke karyawannya.
 *
 * Sengaja hanya tiga. Finance, laporan laba, refund, dan pengelolaan staf
 * tidak ada di daftar ini dan tidak akan pernah bisa diberikan ke staf:
 * batasnya ditegakkan requireOwner di kode, bukan lewat kolom yang bisa
 * diubah dari layar.
 */
export type StaffPermission = "pos" | "loyalty" | "review";

export const STAFF_PERMISSIONS: {
  key: StaffPermission;
  label: string;
  hint: string;
}[] = [
  { key: "pos", label: "Kasir & Pesanan", hint: "Menerima transaksi, buka dan tutup shift" },
  { key: "loyalty", label: "Poin Pelanggan", hint: "Tambah poin dan tukar reward" },
  { key: "review", label: "Kartu Ulasan", hint: "Lihat jumlah tap kartu Google Review" },
];

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
  /** Modul yang boleh dibuka staf. Diabaikan untuk owner dan kael_admin. */
  permissions?: StaffPermission[];
  /** Hash scrypt kata sandi owner/kael_admin. Staf memakai pin_hash. */
  password_hash?: string | null;
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
  /** Nullable di database; resep tidak wajib punya kategori. */
  category: string | null;
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
