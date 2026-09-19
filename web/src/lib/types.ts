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
   * Pembatas pengembalian dana oleh STAF. 0 berarti tanpa batas.
   *
   * Ada karena rekonsiliasi laci tidak pernah menangkap penipuan refund: uang
   * pelanggan masuk, dicatat keluar, dan lacinya tetap cocok. Batas ini tidak
   * mencegahnya, tapi memagari seberapa jauh kerugiannya sebelum polanya
   * terbaca. Owner tidak dibatasi — yang melewati batas berpindah tangan
   * kepadanya, bukan berhenti.
   */
  refund_max_per_transaction: number;
  refund_daily_limit_per_cashier: number;
  /**
   * Cara toko ini memakai menu digitalnya.
   *
   *   pesan_bayar    tamu memesan dan membayar sendiri dari HP
   *   lihat_panggil  menu cuma untuk dilihat; tamu menekan tombol panggil,
   *                  pelayan datang memastikan menunya tersedia, lalu
   *                  menginputnya di kasir. Semua pembayaran di akhir.
   *
   * Dua-duanya didukung karena KAEL punya banyak penyewa: yang cocok untuk
   * gerai cepat saji justru memperlambat kafe, dan sebaliknya.
   */
  qr_menu_mode: "pesan_bayar" | "lihat_panggil";
  /**
   * Kapan uangnya diterima kasir.
   *
   *   di_depan  uang diterima saat pesanan dicatat
   *   di_akhir  pesanan dicatat belum lunas, dan seluruh tagihan meja
   *             diselesaikan sekali saat tamunya pulang
   *
   * Cuma berlaku untuk makan di tempat. Bungkus dan antar selalu dibayar saat
   * itu juga — tidak ada meja yang menahan tamunya sampai selesai.
   */
  pos_payment_timing: "di_depan" | "di_akhir";
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

/**
 * Layanan yang dilayani satu kartu. Satu kartu, satu layanan — tidak ada
 * yang punya jalur cadangan ke layanan lain.
 */
export type CardService = "review" | "loyalty" | "attendance" | "link" | "smart_touch";

export const CARD_SERVICE_LABEL: Record<CardService, string> = {
  review: "Penilaian & Ulasan Google",
  link: "Tautan Tunggal",
  smart_touch: "Smart Touch (banyak tombol)",
  loyalty: "Kartu Member",
  attendance: "Absensi Staf",
};

/**
 * Layanan yang memakai `destination_url`, dan APA arti alamat itu baginya.
 * Layanan di luar daftar ini tidak pernah membaca kolomnya — jadi layarnya
 * tidak boleh menawarkan pengisiannya, supaya tidak ada alamat tersimpan
 * yang kelihatan berarti padahal tidak pernah dipakai.
 */
export const CARD_SERVICE_DESTINATION: Partial<Record<CardService, string>> = {
  review: "Alamat ulasan Google, dipakai setelah pelanggan memberi bintang tinggi.",
  link: "Alamat yang dibuka begitu kartu di-tap.",
};

export interface Card {
  id: string;
  card_code: string;
  business_id: string | null;
  business_name?: string | null;
  /**
   * Layanan kartu ini. SATU kartu melayani TEPAT satu hal.
   *
   *   review       halaman penilaian bintang, lalu lanjut ke Google
   *   link         satu tautan tunggal milik pemiliknya
   *   smart_touch  daftar tombol pilihan di satu halaman
   *   loyalty      kartu member
   *   attendance   absensi staf
   *
   * Tidak ada jenis yang punya jalur cadangan ke jenis lain. Dulu `link`
   * melayani dua hal sekaligus — tautan tunggal DAN Smart Touch — dan yang
   * menang ditentukan urutan pemeriksaan di rute, bukan pilihan pemiliknya.
   * Akibatnya tautan yang sudah diisi bisa berhenti dipakai tanpa keterangan
   * apa pun begitu tombol Smart Touch ditambahkan.
   */
  type: CardService;
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
  category?: "bahan_baku" | "kemasan" | "barang_kulakan" | "lainnya" | null;
  brand?: string | null;
  supplier_name?: string | null;
  notes?: string | null;
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

export interface FinanceCalculatorPreset {
  id: string;
  business_id: string;
  name: string;
  mode: "kuliner" | "retail" | "jasa";
  direct_cost: number;
  supporting_cost: number;
  operational_cost: number;
  selling_price: number;
  discount_pct: number;
  payment_fee_pct: number;
  channel_fee_pct: number;
  tax_reserve_pct: number;
  target_margin_pct: number;
  monthly_fixed_cost: number;
  monthly_profit_target: number;
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

/**
 * Isi kartu member yang dikarang pemilik usaha.
 *
 * Logo dan warna TIDAK ada di sini dan itu disengaja: keduanya kolom
 * `businesses` yang dipegang tim KAEL saat menyiapkan tenant, bukan sesuatu
 * yang harus dipikirkan pemilik warung. Yang di sini isinya — hal-hal yang
 * cuma dia yang tahu.
 */
/**
 * Faktur WhatsApp satu pesanan, dirakit server dari database.
 *
 * Bentuk ini yang menyeberang ke layar kasir. Nomor penerimanya hanya ada di
 * sini, untuk satu pesanan, dan hanya saat kasir memilih mengirim — tidak
 * pernah di hasil pencarian member.
 */
export interface FakturPesanan {
  orderId: string;
  namaToko: string;
  orderNo: string;
  items: { nama: string; qty: number; harga: number }[];
  subtotal: number;
  diskon: number;
  pajak: number;
  serviceCharge: number;
  ongkir: number;
  total: number;
  caraBayar: string;
  penerima: {
    nomor: string | null;
    nama: string | null;
    /** Hanya untuk pesanan antar. */
    alamat: string | null;
  };
}

/**
 * Satu pembayaran hari ini, seperti yang tercetak di struknya.
 *
 * Meja yang memesan tiga kali lalu membayar sekali di kasir adalah SATU
 * pembayaran, bukan tiga: tunai diterima dan kembaliannya milik kunjungan itu
 * (table_sessions), bukan milik salah satu notanya.
 */
export interface PembayaranHariIni {
  kunci: string;
  metode: "cash" | "qris" | "transfer";
  /** Jumlah nota sebelum refund — sama dengan TOTAL BAYAR di struk. */
  total: number;
  refund: number;
  nota: string[];
  meja: string | null;
  jenisLayanan: "dine_in" | "takeaway" | "delivery";
  /** Dilunasi sekaligus semeja lewat denah meja. */
  lewatMeja: boolean;
  /**
   * Kosong untuk non-tunai, dan untuk tunai yang dikonfirmasi dari antrean
   * pesanan: tombol "Pembayaran sudah masuk" tidak menanyakan uangnya.
   */
  tunaiDiterima: number | null;
  kembalian: number | null;
  dibayarPada: string;
  /** Yang menerima uangnya. */
  kasir: string | null;
}

export interface MemberCardSettings {
  business_id: string;
  headline: string | null;
  welcome_text: string | null;
  opening_hours: string | null;
  instagram: string | null;
  /** Nomor yang benar-benar dijawab orang, untuk tombol simpan ke WhatsApp. */
  whatsapp: string | null;
  announcement: string | null;
  show_menu: boolean;
  updated_at: string;
}

/** Progres kartu stempel yang dilihat pelanggan. */
export interface StampProgress {
  totalKunjungan: number;
  kunjunganTerakhir: string | null;
  stempelTerpakai: number;
}

export interface Reward {
  id: string;
  business_id: string;
  name: string;
  point_cost: number;
  market_value: number;
  stock: number | null;
  is_active: boolean;
  /** Foto hadiah (https). NULL berarti kartunya memakai inisial nama hadiah. */
  image_url: string | null;
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

/**
 * Gambar yang tampil untuk menu yang belum punya foto.
 *
 * Aset statis di public/, bukan baris di uploaded_images: berkasnya milik
 * aplikasi dan sama untuk semua toko, jadi menyalinnya ke database sekali per
 * tenant cuma menggandakan hal yang sama berulang kali.
 *
 * Ada gunanya menampilkan sesuatu alih-alih membiarkan kosong. Daftar menu
 * dengan sebagian bergambar dan sebagian tidak terlihat seperti halaman yang
 * gagal dimuat, bukan seperti menu yang memang belum difoto.
 */
export const PLACEHOLDER_MENU = "/placeholder-menu.webp";

export interface MenuItem {
  id: string;
  business_id: string;
  /** NULL kalau menunya belum dimasukkan ke kategori mana pun. */
  category_id: string | null;
  name: string;
  price: number;
  /** Modal pokok atau HPP per unit/porsi menu (Rp). Digunakan untuk menghitung estimasi laba kotor. */
  cost_price?: number;
  /** Penjelasan singkat di halaman pesan. NULL kalau menunya tidak butuh. */
  description?: string | null;
  photo_url?: string | null;
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
  /**
   * HPP satu unit, DIKUNCI saat transaksi dicatat.
   *
   * Sebelum ada kolom ini laporan laba menghitung ulang modal dari harga bahan
   * hari ini, jadi menaikkan harga satu bahan ikut mengubah laba bulan lalu.
   *
   * null berarti waktu itu menunya memang belum punya resep maupun modal pokok.
   * Itu ditandai "belum lengkap" di laporan, bukan dihitung nol lalu dilaporkan
   * sebagai laba penuh.
   */
  cost_snapshot: number | null;
  qty: number;
  subtotal: number;
  note?: string;
  /**
   * Menu yang dibatalkan tamu sebelum notanya dibayar.
   *
   * Barisnya sengaja tidak dihapus. Kasir yang bisa menghapus baris dari nota
   * belum lunas bisa memakainya menyembunyikan uang yang sudah diterima, dan
   * lacinya tetap akan cocok. Yang dibatalkan hilang dari tagihan, struk,
   * tiket dapur, stok, dan laporan penjualan — tapi jejaknya tetap ada.
   */
  cancelled_at?: string | null;
  cancelled_by?: string | null;
  cancel_reason?: string | null;
  /** Nasib makanannya: yang sempat dibuat memakan bahan, yang belum tidak. */
  cancel_disposition?:
    | "belum_dibuat"
    | "sudah_dibuat_dibuang"
    | "sudah_dibuat_disajikan"
    | null;
}

/** Bagaimana selisih harga diselesaikan saat item pesanan diganti. */
export type ItemChangeSettlement = "none" | "collect" | "refund" | "waive";

export const ITEM_CHANGE_SETTLEMENT_LABEL: Record<ItemChangeSettlement, string> = {
  none: "Tidak ada selisih",
  collect: "Pelanggan menambah bayar",
  refund: "Selisih dikembalikan",
  waive: "Selisih ditanggung toko",
};

/**
 * Satu penggantian item. Barisnya permanen: `order_items` boleh berubah
 * mengikuti apa yang benar-benar disajikan, riwayat pesanan aslinya di sini.
 */
export interface OrderItemChange {
  id: string;
  business_id: string;
  order_id: string;
  order_item_id: string | null;
  old_menu_item_id: string | null;
  old_name: string;
  old_price: number;
  new_menu_item_id: string | null;
  new_name: string;
  new_price: number;
  qty: number;
  price_diff: number;
  settlement: ItemChangeSettlement;
  reason: string | null;
  changed_by: string | null;
  created_at: string;
}

/**
 * Satu shift beserta konteks yang dibutuhkan pemilik untuk membacanya.
 *
 * `total_sales` dan `cash_sales` sudah BERSIH dari refund yang uangnya keluar
 * pada shift itu. `cash_sales` yang dipakai membandingkan dengan hitungan laci;
 * `total_sales` termasuk QRIS dan transfer, yang tidak pernah masuk laci.
 */
export interface ShiftReport extends Shift {
  staff_name: string;
  orders_count: number;
  cash_sales: number;
  total_sales: number;
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
  /**
   * Kenapa diskonnya diberikan. Wajib ada begitu `discount` > 0.
   *
   * Kasir sudah memilih alasan ini di layar sejak dulu, tapi jawabannya tidak
   * pernah dikirim ke server. Diskon tanpa alasan bukan diskon — itu selisih
   * kas yang tidak bisa dipertanggungjawabkan siapa pun saat tutup shift.
   */
  discount_reason: string | null;
  tax: number;
  service_charge: number;
  total: number;
  /** Pengikat tagihan awal dan tambahan dalam satu kunjungan tamu. */
  table_session_id: string | null;
  payment_method: "cash" | "qris" | "transfer";
  cash_given?: number | null;
  cash_change?: number | null;
  customer_id: string | null;
  /**
   * Nama yang diketik pemesan di menu digital. Dipakai kasir dan dapur untuk
   * memanggil orangnya. Berbeda dari delivery_name, yang berarti penerima
   * kiriman — satu pesanan bisa punya keduanya.
   */
  customer_name: string | null;
  /** Transaksi latihan. HANYA baris bertanda ini yang boleh disapu pembersihan massal. */
  is_test: boolean;
  shift_id: string | null;
  created_by: string;
  created_at: string;
  /** Staf yang mengambil tanggung jawab pesanan dari antrean kasir tetap. */
  claimed_by?: string | null;
  claimed_at?: string | null;
  claimed_by_name?: string | null;
  /** Akumulasi refund pada order ini, diisi oleh query laporan bila diperlukan. */
  refund_total?: number;
  /**
   * Kapan bahan bakunya dipotong dari stok. NULL berarti belum pernah, jadi
   * tidak ada yang perlu dikembalikan kalau itemnya diganti atau dibatalkan.
   */
  inventory_applied_at?: string | null;
  loyalty_applied_at?: string | null;
  sync_error?: string | null;
  /** Daftar item pesanan jika diambil bersamaan */
  items?: OrderItem[];
}

/** Alasan refund sebagai daftar tertutup, supaya bisa diringkas jadi laporan. */
export const REFUND_REASONS = [
  { key: "lama_datang", label: "Keterlambatan penyajian" },
  { key: "stok_habis", label: "Bahan atau menu habis" },
  { key: "salah_input", label: "Salah input kasir" },
  { key: "keringanan_owner", label: "Keringanan owner" },
  { key: "komplain_rasa", label: "Komplain rasa atau kualitas" },
  { key: "lainnya", label: "Alasan lainnya" },
] as const;

export type RefundReasonCode = (typeof REFUND_REASONS)[number]["key"];

export interface Refund {
  id: string;
  order_id: string;
  amount: number;
  reason: string;
  /**
   * Uangnya keluar lewat mana. Dulu dijejalkan ke dalam kalimat alasan sebagai
   * "(Metode: CASH)" — terbaca manusia, tidak bisa dijumlahkan mesin. Padahal
   * "berapa yang keluar dari laci hari ini" justru itu yang dicocokkan kasir
   * tiap tutup shift.
   */
  method: "cash" | "qris" | "transfer";
  reason_code: RefundReasonCode | null;
  /** NULL berarti refund seluruh pesanan; terisi berarti satu item saja. */
  order_item_id: string | null;
  approved_by: string;
  shift_id: string | null;
  created_at: string;
}

// -----------------------------------------------------------------------------
// SESI MEJA
// -----------------------------------------------------------------------------

/**
 * Satu kunjungan tamu di satu meja.
 *
 * Meja terisi atau tidak adalah pertanyaan tersendiri, bukan kesimpulan dari
 * status dapur. Sebelum ada ini, mejanya terbaca kosong begitu makanan
 * terakhir keluar — padahal tamunya masih duduk di situ.
 */
export interface TableSession {
  id: string;
  business_id: string;
  table_no: string;
  table_key: string;
  status: "open" | "closed";
  guest_count: number | null;
  opened_at: string;
  opened_by: string | null;
  closed_at: string | null;
  closed_by: string | null;
  note: string | null;
  /**
   * Pembayaran satu kunjungan, bukan per nota.
   *
   * Satu meja bisa memesan empat kali lalu membayar sekali saat pulang, jadi
   * uang yang diterima memang milik kunjungannya. Kolom ini untuk struk dan
   * penelusuran — rekonsiliasi laci tetap menjumlahkan `orders.total`.
   */
  dibayar_dengan: "cash" | "qris" | "transfer" | null;
  tunai_diterima: number | null;
  kembalian: number | null;
  dibayar_pada: string | null;
  dibayar_oleh: string | null;
}

/** Sesi meja beserta ringkasan tagihannya, untuk denah meja kasir. */
export interface TableSessionSummary extends TableSession {
  order_count: number;
  item_count: number;
  total_bill: number;
  /** Masih ada tagihan yang belum lunas di kunjungan ini. */
  has_unpaid: boolean;
  /** Masih ada yang dikerjakan dapur. */
  is_cooking: boolean;
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

/**
 * Kalimat siap pakai untuk rating tinggi.
 *
 * Bukan untuk mengarang ulasan atas nama orang: yang dipilih di sini disalin
 * ke papan klip supaya pelanggan menempelkannya sendiri di kotak ulasan Google,
 * dan dia tetap bisa mengubah atau menghapusnya di sana. Alasannya praktis —
 * orang yang puas hampir selalu berhenti di halaman Google karena tidak tahu
 * mau menulis apa, bukan karena tidak mau menulis.
 */
export const PRAISE_TEMPLATES: { key: string; label: string; text: string }[] = [
  { key: "rasa", label: "Rasanya enak", text: "Rasanya enak dan konsisten." },
  { key: "tempat", label: "Tempatnya nyaman", text: "Tempatnya nyaman buat duduk lama." },
  { key: "pelayanan", label: "Pelayanan ramah", text: "Pelayanannya ramah dan cepat." },
  { key: "harga", label: "Harga masuk akal", text: "Harganya masuk akal untuk porsinya." },
  { key: "bersih", label: "Bersih", text: "Tempatnya bersih dan terawat." },
  { key: "ulang", label: "Bakal balik lagi", text: "Bakal balik lagi." },
];

/** Ambang yang memisahkan "ajak ke Google" dari "dengarkan sendiri". */
export const RATING_TINGGI = 4;

export interface MemberFeedback {
  id: string;
  business_id: string;
  customer_id: string | null;
  /** NULL kalau feedback datang dari tap kartu, bukan dari halaman struk. */
  order_id: string | null;
  /** NULL kalau feedback datang dari halaman struk, bukan dari tap kartu. */
  card_id: string | null;
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
  customer_phone?: string | null;
  /** NULL untuk feedback dari tap kartu: tidak ada pesanan yang bisa disebut. */
  order_no: string | null;
  /** Label kartu asal, supaya owner tahu meja atau titik mana yang mengeluh. */
  card_label: string | null;
}

export interface MemberGrowthSummary {
  activeMembers: number;
  activeMembersPrior: number;
  repeatCustomers: number;
  returningMembers: number;
  revenue: number;
  revenuePrior: number;
}

export interface LoyaltyOverallStats {
  totalMembers: number;
  newMembers30d: number;
  newMembers7d: number;
  totalPointsEarned: number;
  totalPointsRedeemed: number;
  totalPointsBalance: number;
  totalMemberRevenue: number;
  totalMemberTransactions: number;
  activeMembers30d: number;
  repeatMembersCount: number;
  atRiskMembersCount: number;
}

export interface BusinessPointLedgerRow extends PointLedger {
  customer_name: string | null;
  customer_phone: string;
  customer_token: string;
  staff_name: string | null;
}

export interface DeletableOrder {
  id: string;
  order_no: string;
  channel: string;
  table_no: string | null;
  status: string;
  total: number;
  payment_method: string;
  customer_name: string | null;
  item_count: number;
  created_at: string;
}

export interface DeletableFeedback {
  id: string;
  order_id: string | null;
  order_no: string | null;
  rating: number;
  reason_code: string | null;
  comment: string | null;
  customer_name: string | null;
  created_at: string;
}

export interface DeletableShift {
  id: string;
  opened_by_name: string;
  opened_at: string;
  closed_at: string | null;
  opening_cash: number;
  closing_cash: number | null;
  expected_cash: number | null;
  variance: number | null;
  order_count: number;
}

export interface DeletableTestData {
  orders: DeletableOrder[];
  feedbacks: DeletableFeedback[];
  shifts: DeletableShift[];
}

// -----------------------------------------------------------------------------
// INITIAL SEED DATA
// -----------------------------------------------------------------------------
