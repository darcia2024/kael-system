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
import type { MemberSegment } from "./member-segments";

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
  /** Label bebas yang diketik manusia, mis. "Coffee Shop & Bakery". */
  category: string;
  /**
   * Kunci jenis usaha: kuliner | jasa | retail.
   *
   * Terpisah dari `category` karena category berupa teks bebas dan tidak bisa
   * dipakai memetakan modul mana yang masuk akal ditawarkan.
   */
  business_type: "kuliner" | "jasa" | "retail";
  phone: string;
  address: string;
  google_place_id: string;
  /** NULL berarti belum ada logo, dan yang tampil inisial nama tokonya. */
  logo_url: string | null;
  brand_color: string;
  timezone: string;
  /** Kode yang diketik karyawan saat masuk. Unik, tanpa memandang huruf besar/kecil. */
  store_code: string | null;
  /**
   * Payload QRIS statis milik merchant. NULL berarti belum diunggah, dan kasir
   * jatuh kembali ke QRIS cetak yang nominalnya diketik pelanggan sendiri.
   */
  qris_payload: string | null;
  qris_merchant_name: string | null;
  qris_merchant_city: string | null;
  qris_nmid: string | null;
  qris_uploaded_at: string | null;
  /** Tarif POS milik toko; dihitung ulang server pada saat checkout. */
  pos_tax_rate: number;
  pos_service_charge_rate: number;
  /**
   * Tenant peragaan yang disiapkan tim KAEL atas nama calon pembeli, bukan
   * pelanggan yang membayar. Hanya baris seperti ini yang boleh disentuh
   * skrip pembersih.
   */
  is_demo: boolean;
  /** Tanggal tenant demo boleh dihapus. Null untuk pelanggan sungguhan. */
  demo_expires_at: string | null;
  /** Nama publik yang boleh berbeda dari nama legal tenant. */
  public_name?: string | null;
  /** Domain milik tenant, baru aktif setelah DNS diverifikasi tim KAEL. */
  custom_domain?: string | null;
  locale?: string;
  currency_code?: string;
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

/**
 * Pengguna TANPA kredensial. Bentuk inilah yang boleh menyeberang ke browser.
 *
 * Alasannya konkret. Halaman struk publik dulu menerima objek User utuh hanya
 * untuk memakai satu bidang, `name`. Objek itu ikut terserialisasi ke dalam
 * HTML halaman, sehingga `pin_hash` lengkap dengan salt-nya bisa dibaca siapa
 * pun yang memegang tautan struk — tautan yang memang diberikan ke pelanggan.
 * PIN kasir hanya 4 sampai 6 angka, jadi hash yang bocor bisa ditebak habis
 * secara luring dalam hitungan detik.
 *
 * Menghapusnya di satu halaman tidak menutup jenis kesalahan ini; halaman
 * berikutnya akan mengulanginya. Karena itu db.getUsers tidak lagi MENGAMBIL
 * kolom kredensialnya sama sekali: yang tidak pernah dibaca tidak bisa bocor.
 * Verifikasi PIN dan kata sandi memakai kuerinya sendiri yang tidak pernah
 * mengembalikan barisnya ke pemanggil.
 */
export type SafeUser = Omit<User, "pin_hash" | "password_hash"> & {
  /** Staf sudah menyetel PIN. Nilainya sendiri tidak pernah ikut. */
  has_pin: boolean;
  /** Owner sudah menyetel kata sandi. Nilainya sendiri tidak pernah ikut. */
  has_password: boolean;
};

export interface Customer {
  id: string;
  business_id: string;
  phone: string;
  name: string | null;
  birthday: string | null;
  token: string;
  consent_at: string;
  marketing_opt_in: boolean;
  marketing_opt_in_at: string | null;
  /** Member yang mengajaknya daftar. NULL kalau daftar tanpa kode referral. */
  referred_by: string | null;
  /** Terisi begitu bonus referral cair di belanja pertamanya. NULL berarti masih menunggu. */
  referral_rewarded_at: string | null;
  created_at: string;
}

/** Ringkasan perilaku member yang dihitung dari ledger, bukan disimpan ganda. */
export interface CustomerProfileSummary extends Customer {
  balance: number;
  lifetime_spend: number | string;
  purchase_count: number;
  points_earned: number;
  last_activity_at: string | null;
}

export interface Card {
  id: string;
  card_code: string;
  business_id: string | null;
  business_name?: string | null;
  /**
   * Jenis kartu, dan inilah yang menentukan ke mana tap-nya berujung.
   *
   * `link` mengarah ke tautan bebas milik pemiliknya, bukan ke Google.
   * Perilakunya sama dengan `review` di rute pengalihan; yang berbeda cuma
   * cara mengisinya saat aktivasi dan cara menamainya di layar.
   */
  type: "review" | "loyalty" | "attendance" | "link";
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

/** Data minimum untuk direktori staf. Nomor lengkap dan token tidak ikut dikirim. */
export interface CustomerDirectoryEntry {
  id: string;
  name: string | null;
  phone_masked: string;
  phone_last4: string;
  balance: number;
  created_at: string;
}

export interface FinancePocket { id: string; business_id: string; name: string; allocation_pct: number; created_at: string; }
export interface FinanceTransaction { id: string; business_id: string; type: "income" | "expense"; category: string; amount: number; occurred_on: string; note: string | null; pocket_id: string | null; source: "manual" | "pos" | "inventory" | "asset"; created_at: string; }
export interface FinanceAsset { id: string; business_id: string; name: string; category: string; acquired_on: string; purchase_cost: number; salvage_value: number; useful_life_months: number; is_active: boolean; created_at: string; }
export interface InventoryItem { id: string; business_id: string; sku: string | null; name: string; unit: string; stock_qty: number; average_cost: number; reorder_level: number; created_at: string; updated_at: string; }
export interface FinanceSummary { income: number; expenses: number; operatingExpenses: number; posRevenue: number; estimatedCogs: number; hppCoverageRevenue: number; grossProfit: number; depreciation: number; netProfit: number; fixedCosts: number; breakEvenRevenue: number; }

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
  /** Mati secara default. Referral menulis poin sungguhan, jadi tidak boleh menyala tanpa owner mengatur nilainya. */
  referral_is_active: boolean;
  referral_referrer_points: number;
  referral_referee_points: number;
  /** Batas wajar bonus pengajak per bulan, supaya satu nomor tidak bisa memanen poin tanpa batas. */
  referral_monthly_cap: number;
  /** Mati secara default. Ulang tahun bisa membawa bonus poin sungguhan, jadi butuh saklar sendiri. */
  birthday_is_active: boolean;
  birthday_bonus_points: number;
  /** Dipakai bareng untuk jendela deteksi ulang tahun maupun anniversary. */
  birthday_window_days: number;
  /** Mati secara default. Lihat catatan di spec 03-kael-loyalty §7: cuma bernilai kalau member sudah cukup banyak. */
  tiers_is_active: boolean;
  /** Nama bebas per tenant, mis. Poin, Stamp, atau Kopi. */
  unit_name?: string;
  minimum_purchase?: number;
  max_earn_per_transaction?: number | null;
  rounding_mode?: "floor" | "round";
  updated_at: string;
}

/** Level member (Basic/Silver/Gold). Dihitung dari lifetime_spend, tidak pernah disimpan di baris customers. */
export interface LoyaltyTier {
  id: string;
  business_id: string;
  name: string;
  min_lifetime_spend: number;
  earn_multiplier: number;
  benefit_note: string | null;
  sort_order: number;
  created_at: string;
}

/** Satu baris "member dengan tanggal tahunan yang jatuh dalam jendela". Dipakai untuk ulang tahun dan anniversary. */
export interface AnnualDateCandidate {
  customer_id: string;
  name: string | null;
  days_until: number;
  occurs_on: string;
}

export interface LoyaltyCode {
  id: string;
  business_id: string;
  code: string;
  source: "referral" | "birthday" | "campaign" | "manual";
  owner_customer_id: string | null;
  reward_points: number;
  max_uses: number | null;
  valid_until: string | null;
  is_active: boolean;
  created_at: string;
}

export interface ReferralReportRow {
  customer_id: string;
  name: string | null;
  phone: string;
  code: string | null;
  referred_count: number;
  rewarded_count: number;
  points_earned: number;
}

export interface PointLedger {
  id: string;
  business_id: string;
  customer_id: string;
  delta: number;
  /**
   * Harus sejalan dengan CHECK di point_ledger (migrasi terakhir yang
   * menyentuhnya: 20260902000004_campaign_codes.sql). Kalau database menerima
   * alasan baru tapi union ini tertinggal, layar dan analitik yang menyaring
   * per-alasan akan diam-diam melewatkan barisnya.
   */
  reason: "purchase" | "redeem" | "birthday" | "manual" | "correction" | "expiry" | "referral" | "campaign";
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
  used_by: string | null;
  created_at: string;
  used_at: string | null;
}

export type LoyaltyCampaignStatus = "pending" | "opened" | "sent" | "skipped";

/**
 * Segmen campaign: empat berbasis perilaku belanja (MemberSegment), dua
 * berbasis tanggal tahunan, satu berbasis kedaluwarsa poin. Union terpisah
 * dari MemberSegment karena ulang tahun, anniversary, dan poin hampir hangus
 * bukan hasil getMemberSegment — sumbu yang berbeda sepenuhnya, bukan nilai
 * tambahan di sumbu yang sama.
 */
export type LoyaltyCampaignSegment = MemberSegment | "birthday" | "anniversary" | "expiring_points";

export interface LoyaltyCampaignSummary {
  id: string;
  business_id: string;
  name: string;
  segment: LoyaltyCampaignSegment;
  message_template: string;
  /** Diisi hanya untuk campaign yang dibuat lewat pemilih tujuan. Null untuk campaign segmen lama dan ulang tahun/anniversary. */
  goal: string | null;
  created_by: string;
  created_at: string;
  recipient_count: number;
  opened_count: number;
  sent_count: number;
  returned_count: number;
  /** Kode promo campaign ini, kalau ada. Null untuk campaign tanpa kode (segmen lama, ulang tahun, anniversary). */
  code: string | null;
  /** Berapa kali kode itu benar-benar dipakai di kasir — bukti nyata, beda dari returned_count yang cuma sinyal. */
  code_used_count: number;
}

export interface LoyaltyCampaignRecipient {
  id: string;
  campaign_id: string;
  customer_id: string;
  status: LoyaltyCampaignStatus;
  opened_at: string | null;
  sent_at: string | null;
  created_at: string;
  name: string | null;
  phone: string;
  balance: number;
  purchase_count: number;
}

export interface PointExpiryCandidate {
  customer_id: string;
  name: string | null;
  points: number;
  expires_at: string;
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
  /** Retail tidak selalu memakai resep; stok dan HPP bisa ditautkan langsung. */
  inventory_item_id?: string | null;
  inventory_qty_per_sale?: number | null;
  unit_cost_override?: number | null;
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
  /** SIAPA yang membuat pesanan. Terpisah dari cara penyajiannya. */
  channel: "cashier" | "qr";
  /**
   * BAGAIMANA pesanan disajikan.
   *
   * Dulu bercampur dengan channel, sehingga tidak ada cara menyatakan
   * pelanggan yang duduk di meja tapi memesan di kasir — keadaan paling biasa
   * di warung. "Takeaway" dan "bungkus" yang dulu berdiri sendiri-sendiri
   * memang hal yang sama, jadi menjadi satu.
   */
  service_type: "dine_in" | "takeaway" | "delivery";
  table_no: string | null;
  /** Sumbu laporan. Tetap ada karena laporan, shift, dan refund memakainya. */
  status: "open" | "paid" | "cancelled" | "refunded";
  /**
   * Sumbu uang, terpisah dari `status`.
   *
   * QRIS dan transfer mulai dari "pending": QR yang muncul di layar belum
   * berarti uangnya masuk, dan menandainya lunas saat itu juga berarti kasir
   * menutup transaksi atas sesuatu yang belum dia lihat.
   */
  payment_status: "pending" | "paid" | "failed" | "expired" | "cancelled";
  /** Siapa yang menyatakan uangnya diterima. Tanpa ini konfirmasi manual tidak bisa ditelusuri. */
  paid_confirmed_by: string | null;
  paid_confirmed_at: string | null;
  /** Kemajuan dapur. */
  fulfillment_status:
    | "pending"
    | "accepted"
    | "preparing"
    | "ready"
    | "completed"
    | "cancelled";
  delivery_name: string | null;
  delivery_phone: string | null;
  delivery_address: string | null;
  /** Ongkir dalam rupiah. Ikut dijumlahkan ke total. */
  delivery_fee: number;
  delivery_note: string | null;
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
  /** Akumulasi refund pada order ini, diisi oleh query laporan bila diperlukan. */
  refund_total?: number;
}

export interface Refund {
  id: string;
  order_id: string;
  amount: number;
  reason: string;
  approved_by: string;
  shift_id: string | null;
  created_at: string;
}

// -----------------------------------------------------------------------------
// FEEDBACK PASCATRANSAKSI
// -----------------------------------------------------------------------------

/** Cuma diisi kalau rating ≤3 — daftar tertutup supaya bisa diringkas jadi "masalah yang sering muncul". */
export type FeedbackReasonCode = "rasa" | "harga" | "antrean" | "pelayanan" | "kebersihan" | "lainnya";

export const FEEDBACK_REASONS: { key: FeedbackReasonCode; label: string }[] = [
  { key: "rasa", label: "Rasa / kualitas" },
  { key: "harga", label: "Harga" },
  { key: "antrean", label: "Antrean lama" },
  { key: "pelayanan", label: "Pelayanan" },
  { key: "kebersihan", label: "Kebersihan" },
  { key: "lainnya", label: "Lainnya" },
];

export interface MemberFeedback {
  id: string;
  business_id: string;
  customer_id: string | null;
  order_id: string;
  rating: number;
  reason_code: FeedbackReasonCode | null;
  comment: string | null;
  created_at: string;
}

export interface FeedbackSummary {
  total: number;
  avgRating: number;
  lowCount: number;
  byReason: { reason_code: FeedbackReasonCode; count: number }[];
}

export interface FeedbackRow extends MemberFeedback {
  customer_name: string | null;
  order_no: string;
}

// -----------------------------------------------------------------------------
// INITIAL SEED DATA
// -----------------------------------------------------------------------------
