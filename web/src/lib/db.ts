import "server-only";
import { seedCafeDemo, type CafeDemoSetup } from "./cafe-demo";
import { sql } from "./postgres";
import { hashPin, verifyPin, isLegacyPinHash } from "./auth";
import { generateCardCode, generateActivationPin } from "./card-code";
import {
  hashClientIp,
  checkStaffLockout,
  calculateLockoutExpiry,
} from "./auth-security";
import {
  calculateRecipeHpp,
  type IngredientItem,
  type RecipeHppResult,
} from "./finance-engine";
import { buildGoogleReviewUrl } from "./google-places";
import {
  getPointExpiryCandidates,
  type PointExpiryLedgerRow,
} from "./point-expiry";
import {
  normalizePhoneNumber,
  generateCustomerToken,
  generateRedemptionCode,
  calculateEarnedPoints,
  matchAnnualDate,
  resolveTier,
} from "./loyalty-engine";
import { generateLoyaltyCode } from "./loyalty-code";
import { normalizeTableKey } from "./table-key";
import {
  generateDailyOrderNo,
  calculateCartTotals,
  calculateShiftReconciliation,
} from "./pos-engine";
import type {
  Business,
  BusinessModule,
  User,
  Customer,
  CustomerProfileSummary,
  Card,
  CardService,
  CardTap,
  TableSession,
  TableSessionSummary,
  ItemChangeSettlement,
  Ingredient,
  IngredientPriceHistory,
  Recipe,
  FinanceCalculatorPreset,
  FinancePocket,
  FinanceTransaction,
  FinanceAsset,
  InventoryItem,
  FinanceSummary,
  LoyaltyProgram,
  PointLedger,
  Reward,
  Redemption,
  LoyaltyCampaignSummary,
  LoyaltyCampaignRecipient,
  LoyaltyCampaignStatus,
  PointExpiryCandidate,
  LoyaltyOverallStats,
  BusinessPointLedgerRow,
  Category,
  MenuItem,
  Shift,
  ShiftReport,
  Order,
  OrderItem,
  Refund,
  SafeUser,
  MemberCardSettings, FakturPesanan, PembayaranHariIni,
  DeletableTestData,
  DeletableOrder,
  DeletableFeedback,
  DeletableShift,
} from "./types";

export * from "./types";

/**
 * Repository KAEL di atas Postgres (Supabase).
 *
 * ISOLASI ANTAR BISNIS
 * Koneksi memakai role `postgres`, yang melewati Row Level Security. Artinya
 * policy di migrasi berperan sebagai jaring pengaman kalau nanti PostgREST
 * dipakai, BUKAN sebagai penjaga pada jalur ini. Isolasi tenant di sini
 * ditegakkan oleh kode: setiap query wajib menyaring business_id.
 *
 * Satu `where business_id` yang lupa ditulis akan membocorkan data toko lain.
 * Kalau menambah method baru, ikuti pola yang sudah ada.
 */

const one = <T>(rows: readonly unknown[]): T | null =>
  rows.length ? (rows[0] as T) : null;

/** Uang selalu bigint di Postgres; driver mengembalikannya sebagai string. */
const num = (v: unknown): number =>
  v === null || v === undefined ? 0 : typeof v === "number" ? v : Number(v);

/** Rupiah untuk pesan galat yang dibaca kasir di layar, bukan untuk laporan. */
const rupiahRingkas = (value: number) => `Rp ${Math.round(value).toLocaleString("id-ID")}`;

/**
 * Tipe koneksi di dalam sql.begin(). Dibutuhkan fungsi pembantu yang menerima
 * transaksi dari pemanggilnya, supaya semua perubahannya ikut dibatalkan
 * bersama kalau salah satu langkah gagal.
 */
type TransaksiSql = Parameters<Parameters<typeof sql.begin>[1]>[0];

/**
 * Membuang sesi meja yang pesanannya sudah tidak ada lagi.
 *
 * Denah meja sengaja menampilkan meja bersesi terbuka sebagai "Disajikan"
 * walaupun belum ada pesanan sama sekali — tamu yang baru duduk memang harus
 * terlihat, supaya mejanya tidak ditawarkan ke tamu berikutnya.
 *
 * Tapi begitu riwayat pesanannya dihapus, sesi itu tidak lagi mewakili siapa
 * pun. Mejanya menyala "Disajikan" selamanya, dan owner yang baru
 * membersihkan data latihan mengira pembersihannya gagal — padahal yang
 * tertinggal cuma satu baris sesi tanpa induk.
 *
 * Yang dibuang HANYA sesi yang tadi dipakai oleh pesanan yang barusan dihapus,
 * dan hanya kalau sesudahnya benar-benar tidak menyisakan pesanan. Sesi meja
 * yang tamunya baru duduk dan belum memesan tidak ikut tersentuh.
 */
async function bersihkanSesiMejaYatim(
  tx: TransaksiSql,
  businessId: string,
  sessionIds: string[],
): Promise<number> {
  const unik = Array.from(new Set(sessionIds));
  if (!unik.length) return 0;

  const res = await tx`
    DELETE FROM table_sessions
    WHERE business_id = ${businessId}
      AND id IN ${tx(unik)}
      AND NOT EXISTS (
        SELECT 1 FROM orders o WHERE o.table_session_id = table_sessions.id
      )
    RETURNING id
  `;
  return res.length;
}

export const db = {
  // =========================================================================
  // Bisnis, modul, pengguna
  // =========================================================================

  /**
   * Satu bisnis menurut id-nya. Id WAJIB.
   *
   * Versi sebelumnya boleh dipanggil tanpa argumen dan menjawab dengan bisnis
   * TERTUA di tabel. Bentuk itu tidak pernah salah selama pelanggannya baru
   * satu, lalu mulai menjawab dengan usaha yang keliru begitu pelanggan kedua
   * mendaftar — tanpa galat, tanpa peringatan. Dua halaman publik memakainya,
   * dan keduanya menampilkan nama serta menu toko yang salah kepada pelanggan.
   *
   * Sekarang pemanggil harus menyebutkan bisnis mana yang dimaksud, dan yang
   * tidak tahu harus mencarinya lebih dulu lewat getBusinessByStoreCode() atau
   * dari kartu yang di-tap pelanggan.
   */
  async getBusiness(id: string): Promise<Business | null> {
    if (!id) return null;
    return one<Business>(await sql`SELECT * FROM businesses WHERE id = ${id}`);
  },

  /**
   * Seluruh bisnis. HANYA untuk panel tim KAEL, dan wajib dipanggil di balik
   * requireKaelAdmin().
   *
   * Namanya sengaja panjang. Versi sebelumnya bernama getBusinesses() dan
   * dipanggil dari halaman login publik, sehingga daftar seluruh pelanggan KAEL
   * terbaca oleh siapa pun tanpa login. Untuk membuka satu toko, pakai
   * getBusinessByStoreCode().
   */
  /**
   * Ringkasan seluruh bisnis untuk panel tim KAEL.
   *
   * Hanya dipanggil dari halaman yang dijaga requireKaelAdmin. Tidak ada jalur
   * lain di aplikasi ini yang mengembalikan daftar seluruh pelanggan KAEL:
   * membocorkannya berarti tiap UMKM tahu siapa saja pesaingnya yang memakai
   * sistem yang sama.
   */
  async getAdminBusinessOverview(): Promise<
    (Business & {
      owner_name: string | null;
      owner_email: string | null;
      staff_count: number;
      modules: BusinessModule[];
    })[]
  > {
    const [businesses, owners, staffCounts, modules] = await Promise.all([
      sql`SELECT * FROM businesses ORDER BY name ASC`,
      sql`
        SELECT DISTINCT ON (business_id) business_id, name, email
          FROM users WHERE role = 'owner' AND business_id IS NOT NULL
         ORDER BY business_id, created_at ASC
      `,
      sql`
        SELECT business_id, COUNT(*)::int AS n
          FROM users WHERE role = 'staff' AND is_active = TRUE
         GROUP BY business_id
      `,
      sql`SELECT * FROM business_modules ORDER BY module`,
    ]);

    const ownerBy = new Map(
      (
        owners as unknown as {
          business_id: string;
          name: string;
          email: string;
        }[]
      ).map((o) => [o.business_id, o]),
    );
    const staffBy = new Map(
      (staffCounts as unknown as { business_id: string; n: number }[]).map(
        (s) => [s.business_id, s.n],
      ),
    );
    const modsBy = new Map<string, BusinessModule[]>();
    for (const m of modules as unknown as BusinessModule[]) {
      const list = modsBy.get(m.business_id) ?? [];
      list.push(m);
      modsBy.set(m.business_id, list);
    }

    return (businesses as unknown as Business[]).map((b) => ({
      ...b,
      owner_name: ownerBy.get(b.id)?.name ?? null,
      owner_email: ownerBy.get(b.id)?.email ?? null,
      staff_count: staffBy.get(b.id) ?? 0,
      modules: modsBy.get(b.id) ?? [],
    }));
  },

  /**
   * Membuat bisnis baru beserta akun pemiliknya dan modul yang dibelinya.
   *
   * Satu transaksi. Sebelum ini, menambah pelanggan berarti menjalankan skrip
   * secara manual, yang berarti setiap penjualan baru menyita waktu orang.
   *
   * Kata sandi owner di-hash dengan scrypt lewat hashPin, sama seperti PIN
   * staf: kata sandi mentah tidak pernah masuk ke database.
   */
  async createBusinessWithOwner(input: {
    name: string;
    businessType: "kuliner" | "jasa" | "retail";
    category: string;
    phone: string;
    address: string;
    timezone: string;
    storeCode: string;
    ownerName: string;
    ownerEmail: string;
    ownerPassword: string;
    googlePlaceId?: string;
    modules: { module: string; expiresAt: string }[];
    cafeDemo?: CafeDemoSetup;
  }): Promise<
    { success: true; business: Business } | { success: false; error: string }
  > {
    const storeCode = input.storeCode.trim().toUpperCase();
    const email = input.ownerEmail.trim().toLowerCase();

    const codeTaken = await sql`
      SELECT 1 FROM businesses WHERE upper(store_code) = ${storeCode} LIMIT 1
    `;
    if (codeTaken.length) {
      return {
        success: false,
        error: `Kode toko ${storeCode} sudah dipakai usaha lain.`,
      };
    }

    const emailTaken =
      await sql`SELECT 1 FROM users WHERE lower(email) = ${email} LIMIT 1`;
    if (emailTaken.length) {
      return { success: false, error: `Email ${email} sudah terdaftar.` };
    }

    try {
      const business = await sql.begin(async (tx) => {
        const rows = await tx`
          INSERT INTO businesses ${tx({
            name: input.name.trim(),
            business_type: input.businessType,
            category: input.category.trim(),
            phone: input.phone.trim(),
            address: input.address.trim(),
            timezone: input.timezone,
            store_code: storeCode,
            google_place_id: input.googlePlaceId
              ? input.googlePlaceId.trim()
              : "",
          })} RETURNING *
        `;
        const created = rows[0] as unknown as Business;

        await tx`
          INSERT INTO users ${tx({
            business_id: created.id,
            role: "owner",
            name: input.ownerName.trim(),
            email,
            password_hash: hashPin(input.ownerPassword),
            is_active: true,
          })}
        `;

        for (const m of input.modules) {
          await tx`
            INSERT INTO business_modules ${tx({
              business_id: created.id,
              module: m.module,
              status: "active",
              activated_at: new Date().toISOString().slice(0, 10),
              expires_at: m.expiresAt,
            })}
          `;
        }

        if (input.cafeDemo) {
          await seedCafeDemo(tx, created.id, input.cafeDemo);
          return one<Business>(
            await tx`SELECT * FROM businesses WHERE id = ${created.id}`,
          )!;
        }
        return created;
      });

      return { success: true, business: business as Business };
    } catch (e) {
      return { success: false, error: (e as Error).message };
    }
  },

  /**
   * Membuat akun pemilik untuk bisnis yang sudah ada tapi belum punya.
   *
   * Bisnis yang lahir dari aktivasi kartu lewat createBusinessFromPlace hanya
   * punya baris businesses dan satu modul Review. Tidak ada satu pun akun yang
   * bisa dipakai masuk, jadi kartunya menyala tapi pemiliknya tidak pernah bisa
   * mengganti tautan tujuan atau melihat berapa kali kartunya di-tap. Dia
   * memegang produk yang tidak bisa dia buka.
   *
   * Menolak kalau bisnisnya SUDAH punya owner. Satu bisnis satu akun pemilik:
   * owner kedua yang muncul diam-diam lewat panel admin adalah pintu masuk yang
   * tidak pernah diminta pemilik pertama, dan dia tidak punya cara melihatnya.
   */
  async createOwnerForBusiness(
    businessId: string,
    input: { name: string; email: string; password: string },
  ): Promise<
    { success: true; user: User } | { success: false; error: string }
  > {
    const email = input.email.trim().toLowerCase();

    const bizRows =
      await sql`SELECT id, name FROM businesses WHERE id = ${businessId} LIMIT 1`;
    if (!bizRows.length)
      return { success: false, error: "Usaha tidak ditemukan." };
    const bizName = (bizRows[0] as unknown as { name: string }).name;

    const existingOwner = await sql`
      SELECT 1 FROM users WHERE business_id = ${businessId} AND role = 'owner' LIMIT 1
    `;
    if (existingOwner.length) {
      return { success: false, error: `${bizName} sudah punya akun pemilik.` };
    }

    // Kolom email UNIQUE lintas seluruh tabel, bukan per bisnis. Diperiksa
    // lebih dulu supaya pesannya menyebut emailnya, bukan galat constraint.
    const emailTaken =
      await sql`SELECT 1 FROM users WHERE lower(email) = ${email} LIMIT 1`;
    if (emailTaken.length) {
      return { success: false, error: `Email ${email} sudah terdaftar.` };
    }

    try {
      const rows = await sql`
        INSERT INTO users ${sql({
          business_id: businessId,
          role: "owner",
          name: input.name.trim(),
          email,
          password_hash: hashPin(input.password),
          is_active: true,
        })} RETURNING *
      `;
      return { success: true, user: rows[0] as unknown as User };
    } catch (e) {
      return { success: false, error: (e as Error).message };
    }
  },

  /**
   * Menyimpan QRIS statis milik sebuah usaha.
   *
   * Payload disimpan APA ADANYA. Nominal tidak pernah ikut tersimpan: yang
   * masuk ke sini adalah kode statis merchant, dan versi bernominal dirakit
   * ulang tiap transaksi lalu dibuang. Menyimpan versi bernominal berarti
   * menyimpan QR sekali-pakai yang sudah basi begitu transaksinya selesai.
   */
  async saveQris(
    businessId: string,
    data: {
      payload: string;
      merchantName: string;
      merchantCity: string;
      nmid: string | null;
    },
  ): Promise<boolean> {
    const rows = await sql`
      UPDATE businesses SET
        qris_payload = ${data.payload},
        qris_merchant_name = ${data.merchantName},
        qris_merchant_city = ${data.merchantCity},
        qris_nmid = ${data.nmid},
        qris_uploaded_at = NOW()
      WHERE id = ${businessId}
      RETURNING id
    `;
    return rows.length > 0;
  },

  /** Melepas QRIS tersimpan. Kasir kembali ke QRIS cetak. */
  async clearQris(businessId: string): Promise<boolean> {
    const rows = await sql`
      UPDATE businesses SET
        qris_payload = NULL,
        qris_merchant_name = NULL,
        qris_merchant_city = NULL,
        qris_nmid = NULL,
        qris_uploaded_at = NULL
      WHERE id = ${businessId}
      RETURNING id
    `;
    return rows.length > 0;
  },

  /**
   * Menyalakan, memperpanjang, menangguhkan, atau mencabut satu modul.
   *
   * status "none" MENGHAPUS barisnya, dan itu berbeda dari "expired": modul
   * yang dihapus dianggap tidak pernah dibeli, jadi layarnya tidak bisa dibuka
   * sama sekali. Modul yang kedaluwarsa tetap bisa dibaca dan diekspor.
   */
  async setBusinessModule(
    businessId: string,
    module: string,
    status: "active" | "suspended" | "expired" | "none",
    expiresAt: string | null,
  ): Promise<void> {
    if (status === "none") {
      await sql`
        DELETE FROM business_modules
         WHERE business_id = ${businessId} AND module = ${module}
      `;
      return;
    }

    const today = new Date().toISOString().slice(0, 10);
    await sql`
      INSERT INTO business_modules ${sql({
        business_id: businessId,
        module,
        status,
        activated_at: today,
        expires_at: expiresAt ?? today,
      })}
      ON CONFLICT (business_id, module) DO UPDATE
        SET status = EXCLUDED.status,
            expires_at = EXCLUDED.expires_at
    `;
  },

  async getAllBusinessesForAdmin(): Promise<Business[]> {
    return (await sql`SELECT * FROM businesses ORDER BY name ASC`) as unknown as Business[];
  },

  /**
   * Mencari bisnis lewat kode toko. Tidak ada method yang mengembalikan daftar
   * seluruh bisnis ke jalur publik: itu membocorkan daftar pelanggan KAEL.
   */
  async getBusinessByStoreCode(code: string): Promise<Business | null> {
    return one<Business>(
      await sql`
      SELECT * FROM businesses WHERE upper(store_code) = upper(${code}) LIMIT 1
    `,
    );
  },

  async updateBusiness(
    id: string,
    updates: Partial<Business>,
  ): Promise<Business | null> {
    const allowed = [
      "name",
      "category",
      "phone",
      "address",
      "google_place_id",
      "logo_url",
      "brand_color",
      "timezone",
      "pos_tax_rate",
      "pos_service_charge_rate",
      "refund_max_per_transaction",
      "refund_daily_limit_per_cashier",
    ] as const;
    const patch = Object.fromEntries(
      Object.entries(updates).filter(([k]) =>
        (allowed as readonly string[]).includes(k),
      ),
    );
    if (!Object.keys(patch).length) return this.getBusiness(id);
    return one<Business>(
      await sql`UPDATE businesses SET ${sql(patch)} WHERE id = ${id} RETURNING *`,
    );
  },

  async getModules(businessId: string): Promise<BusinessModule[]> {
    return (await sql`
      SELECT * FROM business_modules WHERE business_id = ${businessId} ORDER BY module
    `) as unknown as BusinessModule[];
  },

  /**
   * Modul dianggap masih melayani selama belum lewat masa tenggang 14 hari.
   * Sesuai fondasi bagian 2.1: lewat tenggang, sistem masuk mode baca-saja,
   * tidak dimatikan. Mematikan kasir sebuah warung karena telat bayar adalah
   * cara tercepat kehilangan pelanggan.
   */
  async getModuleAccess(businessId: string) {
    const mods = await this.getModules(businessId);
    const today = new Date();
    return mods.map((m) => {
      const expires = new Date(m.expires_at);
      const graceEnd = new Date(expires.getTime() + 14 * 24 * 60 * 60 * 1000);
      const active = m.status === "active" && today <= expires;
      return {
        ...m,
        canRead: m.status !== "suspended",
        canWrite: active || (m.status === "active" && today <= graceEnd),
        inGrace: today > expires && today <= graceEnd,
      };
    });
  },

  /**
   * Angka nyata milik satu usaha, dipakai untuk kartu modul yang belum dibeli.
   *
   * Kartu terkunci yang cuma menampilkan gembok terbaca "aplikasi ini belum
   * jadi" oleh pemilik warung, bukan "beli lagi dong". Angka dari tokonya
   * sendiri jauh lebih kuat: dia sudah tahu Kopi Susu-nya laku, yang belum dia
   * tahu adalah untung bersihnya.
   *
   * Hanya dipanggil kalau memang ada modul terkunci yang relevan, supaya
   * beranda usaha yang sudah membeli semuanya tidak membayar biaya kueri ini.
   */
  async getUpsellSignals(businessId: string): Promise<{
    paidOrders30d: number;
    customers: number;
    taps30d: number;
    topItem: { name: string; qty: number } | null;
  }> {
    const [counts, top] = await Promise.all([
      sql`
        SELECT
          (SELECT COUNT(*) FROM orders
             WHERE business_id = ${businessId} AND status = 'paid'
               AND created_at >= now() - interval '30 days')::int AS paid_orders,
          (SELECT COUNT(*) FROM customers
             WHERE business_id = ${businessId})::int AS customers,
          (SELECT COUNT(*) FROM card_taps t
             JOIN cards c ON c.id = t.card_id
             WHERE c.business_id = ${businessId}
               AND t.tapped_at >= now() - interval '30 days')::int AS taps
      `,
      sql`
        SELECT oi.name_snapshot AS name, SUM(oi.qty)::int AS qty
          FROM order_items oi
          JOIN orders o ON o.id = oi.order_id
         WHERE o.business_id = ${businessId} AND oi.cancelled_at IS NULL AND o.status = 'paid'
           AND o.created_at >= now() - interval '30 days'
         GROUP BY oi.name_snapshot
         ORDER BY qty DESC
         LIMIT 1
      `,
    ]);

    const row = counts[0] as {
      paid_orders: number;
      customers: number;
      taps: number;
    };
    const best = top[0] as { name: string; qty: number } | undefined;

    return {
      paidOrders30d: row?.paid_orders ?? 0,
      customers: row?.customers ?? 0,
      taps30d: row?.taps ?? 0,
      topItem: best ? { name: best.name, qty: best.qty } : null,
    };
  },

  /**
   * Daftar pengguna sebuah usaha, TANPA kolom kredensial.
   *
   * Kolomnya ditulis satu per satu dengan sengaja, bukan SELECT *. Hasil fungsi
   * ini beberapa kali diteruskan utuh ke komponen klien, dan `SELECT *` berarti
   * pin_hash serta password_hash ikut terserialisasi ke HTML yang dikirim ke
   * browser. Itu sudah pernah terjadi di halaman struk yang bisa dibuka tanpa
   * login sama sekali.
   *
   * Tidak ada satu pun pemanggil yang membutuhkan hash-nya: verifikasi PIN dan
   * kata sandi punya kuerinya sendiri (authenticateStaffPin, authenticateOwner)
   * yang tidak pernah mengembalikan barisnya keluar.
   */
  async getUsers(businessId: string): Promise<SafeUser[]> {
    return (await sql`
      SELECT id, business_id, role, name, email, permissions,
             failed_pin_attempts, locked_until, is_active, created_at,
             (pin_hash IS NOT NULL) AS has_pin,
             (password_hash IS NOT NULL) AS has_password
        FROM users WHERE business_id = ${businessId} ORDER BY role, name
    `) as unknown as SafeUser[];
  },

  async getUserByEmail(email: string): Promise<User | null> {
    return one<User>(
      await sql`SELECT * FROM users WHERE email = ${email} LIMIT 1`,
    );
  },

  async getUserById(id: string): Promise<User | null> {
    return one<User>(await sql`SELECT * FROM users WHERE id = ${id}`);
  },

  /**
   * Login staf.
   *
   * Berbeda dari versi lama yang menerima PIN saja lalu, saat gagal, menaikkan
   * penghitung kegagalan milik staf PERTAMA di daftar. Akibatnya orang yang
   * tidak melakukan apa-apa bisa terkunci. Sekarang staf memilih namanya dulu,
   * sehingga kegagalan tercatat pada akun yang benar.
   */
  async authenticateStaffPin(businessId: string, userId: string, pin: string) {
    const user = one<User>(
      await sql`
      SELECT * FROM users
      WHERE id = ${userId} AND business_id = ${businessId}
        AND role = 'staff' AND is_active = TRUE
    `,
    );
    if (!user)
      return { success: false as const, error: "Staf tidak ditemukan." };

    const lockout = checkStaffLockout(
      user.failed_pin_attempts,
      user.locked_until,
    );
    if (lockout.isLocked) {
      return {
        success: false as const,
        error: `Akun terkunci karena 5x salah PIN. Tunggu ${lockout.remainingMinutes} menit lagi.`,
        lockout,
      };
    }

    if (isLegacyPinHash(user.pin_hash)) {
      return {
        success: false as const,
        error:
          "PIN perlu diatur ulang oleh pemilik usaha (format lama sudah tidak dipakai).",
      };
    }

    if (verifyPin(pin, user.pin_hash)) {
      await sql`
        UPDATE users SET failed_pin_attempts = 0, locked_until = NULL WHERE id = ${user.id}
      `;
      return { success: true as const, user };
    }

    const attempts = (user.failed_pin_attempts ?? 0) + 1;
    const lockedUntil =
      attempts >= 5 ? calculateLockoutExpiry().toISOString() : null;
    await sql`
      UPDATE users SET failed_pin_attempts = ${attempts}, locked_until = ${lockedUntil}
      WHERE id = ${user.id}
    `;
    const after = checkStaffLockout(attempts, lockedUntil);
    return {
      success: false as const,
      error: after.isLocked
        ? "PIN salah 5 kali. Akun dikunci 15 menit."
        : `PIN salah. Sisa kesempatan: ${after.attemptsRemaining} kali.`,
      lockout: after,
    };
  },

  /**
   * Login owner dan tim KAEL. Email saja tidak cukup: sebelumnya siapa pun
   * yang tahu alamat email pemilik usaha bisa masuk dan membuka seluruh
   * laporan serta pengaturannya.
   */
  async authenticateOwner(email: string, password: string) {
    const user = await this.getUserByEmail(email.trim().toLowerCase());
    if (!user || !user.is_active) {
      return { success: false as const, error: "Email atau kata sandi salah." };
    }
    if (user.role !== "owner" && user.role !== "kael_admin") {
      return {
        success: false as const,
        error: "Akun ini bukan akun pemilik usaha.",
      };
    }
    if (!user.password_hash) {
      return {
        success: false as const,
        error:
          "Akun ini belum menyetel kata sandi. Hubungi tim KAEL untuk mengaturnya.",
      };
    }

    /**
     * Penguncian setelah 5 percobaan, memakai kolom yang sama dengan PIN staf.
     *
     * Ini bukan pelengkap. Kata sandi owner boleh berupa angka pendek, dan
     * angka pendek tanpa pembatas percobaan bisa ditebak habis oleh skrip dalam
     * hitungan menit. Yang menahan bukan panjangnya, tapi batas percobaannya.
     */
    const lockout = checkStaffLockout(
      user.failed_pin_attempts,
      user.locked_until,
    );
    if (lockout.isLocked) {
      return {
        success: false as const,
        error: `Terlalu banyak percobaan. Coba lagi dalam ${lockout.remainingMinutes} menit.`,
      };
    }

    if (!verifyPin(password, user.password_hash)) {
      const attempts = (user.failed_pin_attempts ?? 0) + 1;
      const lockedUntil =
        attempts >= 5 ? calculateLockoutExpiry().toISOString() : null;
      await sql`
        UPDATE users SET failed_pin_attempts = ${attempts}, locked_until = ${lockedUntil}
        WHERE id = ${user.id}
      `;
      // Pesan sengaja sama dengan kasus email tidak ada, supaya tidak
      // membocorkan email mana yang terdaftar.
      return {
        success: false as const,
        error: lockedUntil
          ? "Terlalu banyak percobaan. Akun dikunci 15 menit."
          : "Email atau kata sandi salah.",
      };
    }

    if (user.failed_pin_attempts) {
      await sql`
        UPDATE users SET failed_pin_attempts = 0, locked_until = NULL WHERE id = ${user.id}
      `;
    }
    return { success: true as const, user };
  },

  async setOwnerPassword(userId: string, password: string): Promise<boolean> {
    const rows = await sql`
      UPDATE users SET password_hash = ${hashPin(password)}
      WHERE id = ${userId} AND role IN ('owner', 'kael_admin')
      RETURNING id
    `;
    return rows.length > 0;
  },

  async createStaff(
    businessId: string,
    name: string,
    pin: string,
    permissions: string[] = ["pos"],
  ): Promise<User> {
    return one<User>(
      await sql`
      INSERT INTO users ${sql({
        business_id: businessId,
        role: "staff",
        name,
        pin_hash: hashPin(pin),
        failed_pin_attempts: 0,
        is_active: true,
        permissions,
      })} RETURNING *
    `,
    )!;
  },

  async setStaffPin(
    userId: string,
    businessId: string,
    pin: string,
  ): Promise<boolean> {
    const rows = await sql`
      UPDATE users SET pin_hash = ${hashPin(pin)}, failed_pin_attempts = 0, locked_until = NULL
      WHERE id = ${userId} AND business_id = ${businessId} AND role = 'staff'
      RETURNING id
    `;
    return rows.length > 0;
  },

  async setStaffPermissions(
    userId: string,
    businessId: string,
    permissions: string[],
  ): Promise<boolean> {
    const rows = await sql`
      UPDATE users SET permissions = ${permissions as unknown as string[]}
      WHERE id = ${userId} AND business_id = ${businessId} AND role = 'staff'
      RETURNING id
    `;
    return rows.length > 0;
  },

  async deactivateStaff(userId: string, businessId: string): Promise<boolean> {
    // Tidak dihapus: transaksi lama menunjuk ke user_id ini, dan menghapusnya
    // membuat riwayat kehilangan jejak siapa yang melayani.
    const rows = await sql`
      UPDATE users SET is_active = FALSE
      WHERE id = ${userId} AND business_id = ${businessId} AND role = 'staff'
      RETURNING id
    `;
    return rows.length > 0;
  },

  async setStaffActive(
    userId: string,
    businessId: string,
    isActive: boolean,
  ): Promise<boolean> {
    const rows = await sql`
      UPDATE users SET is_active = ${isActive}, failed_pin_attempts = 0, locked_until = NULL
      WHERE id = ${userId} AND business_id = ${businessId} AND role = 'staff'
      RETURNING id
    `;
    return rows.length > 0;
  },

  // =========================================================================
  // Kartu dan tap (KAEL Review)
  // =========================================================================

  async getCardByCode(code: string): Promise<Card | null> {
    return one<Card>(await sql`SELECT * FROM cards WHERE card_code = ${code}`);
  },

  async getCards(businessId: string): Promise<Card[]> {
    return (await sql`
      SELECT * FROM cards WHERE business_id = ${businessId} ORDER BY created_at
    `) as unknown as Card[];
  },

  /** Mencari bisnis berdasarkan Google Place ID */
  async getBusinessByGooglePlaceId(placeId: string): Promise<Business | null> {
    if (!placeId) return null;
    return one<Business>(
      await sql`SELECT * FROM businesses WHERE google_place_id = ${placeId} LIMIT 1`,
    );
  },

  /** Membuat bisnis baru otomatis dari pilihan Google Places saat aktivasi kartu */
  async createBusinessFromPlace(data: {
    name: string;
    address: string;
    googlePlaceId: string;
  }): Promise<Business> {
    let storeCode = data.name
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, "")
      .slice(0, 8);
    if (storeCode.length < 3)
      storeCode = "TOKO" + Math.floor(100 + Math.random() * 900);

    const clash =
      await sql`SELECT 1 FROM businesses WHERE upper(store_code) = ${storeCode} LIMIT 1`;
    if (clash.length) {
      storeCode = storeCode.slice(0, 5) + Math.floor(100 + Math.random() * 900);
    }

    const rows = await sql`
      INSERT INTO businesses ${sql({
        name: data.name,
        business_type: "kuliner",
        category: "Bisnis Lokal / UMKM",
        phone: "",
        address: data.address,
        google_place_id: data.googlePlaceId,
        timezone: "Asia/Jakarta",
        store_code: storeCode,
      })}
      RETURNING *
    `;
    const biz = rows[0] as unknown as Business;

    const setahunLagi = new Date();
    setahunLagi.setFullYear(setahunLagi.getFullYear() + 1);
    await sql`
      INSERT INTO business_modules ${sql({
        business_id: biz.id,
        module: "review",
        status: "active",
        activated_at: new Date().toISOString(),
        expires_at: setahunLagi.toISOString().slice(0, 10),
      })}
      ON CONFLICT DO NOTHING
    `;

    return biz;
  },

  /** Hanya untuk panel tim KAEL. Panggil di balik requireKaelAdmin(). */
  async getAllCards(): Promise<Card[]> {
    return (await sql`
      SELECT c.*, b.name AS business_name
      FROM cards c
      LEFT JOIN businesses b ON b.id = c.business_id
      ORDER BY c.created_at DESC
    `) as unknown as Card[];
  },

  /**
   * Menerbitkan sebatch kartu kosong. PIN dikembalikan sebagai teks satu kali
   * di sini supaya bisa dicetak dan dimasukkan ke kemasan; yang tersimpan di
   * database hanya hash-nya.
   */
  async createBatchCards(
    count: number,
    type:
      | "review"
      | "loyalty"
      | "attendance"
      | "link"
      | "smart_touch" = "review",
  ) {
    const issued: { card_code: string; activation_pin: string }[] = [];
    for (let i = 0; i < count; i++) {
      const pin = generateActivationPin();
      let code = generateCardCode();
      for (let attempt = 0; attempt < 5; attempt++) {
        const clash =
          await sql`SELECT 1 FROM cards WHERE card_code = ${code} LIMIT 1`;
        if (!clash.length) break;
        code = generateCardCode();
      }
      await sql`
        INSERT INTO cards ${sql({
          card_code: code,
          type,
          status: "unactivated",
          activation_pin_hash: hashPin(pin),
          tap_count: 0,
        })}
      `;
      issued.push({ card_code: code, activation_pin: pin });
    }
    return issued;
  },

  async activateCard(
    code: string,
    pin: string,
    businessId: string,
    /** null untuk layanan yang memang tidak memakai alamat tujuan. */
    destinationUrl: string | null,
    label = "Meja Kasir",
  ): Promise<{ success: boolean; error?: string; card?: Card }> {
    const card = await this.getCardByCode(code);
    if (!card) return { success: false, error: "Kartu tidak dikenali." };
    if (card.status === "suspended")
      return { success: false, error: "Kartu ini tidak aktif." };
    if (card.status === "active")
      return { success: false, error: "Kartu sudah pernah diaktivasi." };
    if (!verifyPin(pin, card.activation_pin_hash)) {
      return {
        success: false,
        error: "PIN aktivasi salah. Cek kertas di dalam kemasan.",
      };
    }

    const updated = one<Card>(
      await sql`
      UPDATE cards SET
        business_id = ${businessId},
        status = 'active',
        destination_url = ${destinationUrl},
        label = ${label}
      WHERE id = ${card.id}
      RETURNING *
    `,
    );
    return { success: true, card: updated! };
  },

  async updateCard(
    cardId: string,
    businessId: string,
    updates: Partial<Card>,
  ): Promise<Card | null> {
    const allowed = ["destination_url", "label", "status"] as const;
    const patch = Object.fromEntries(
      Object.entries(updates).filter(([k]) =>
        (allowed as readonly string[]).includes(k),
      ),
    );
    if (!Object.keys(patch).length) return null;
    return one<Card>(
      await sql`
      UPDATE cards SET ${sql(patch)}
      WHERE id = ${cardId} AND business_id = ${businessId}
      RETURNING *
    `,
    );
  },

  /**
   * Memindahkan sebuah kartu ke layanan lain — satu kartu tetap satu layanan.
   *
   * Perpindahan diizinkan karena orang salah aktivasi dan berubah pikiran, dan
   * kartu yang terkunci selamanya sama saja dengan kartu mati. Tapi hanya kalau
   * layanan lamanya sudah benar-benar kosong: menghapus tombol Smart Touch atau
   * memutus ikatan member diam-diam berarti ada yang hilang tanpa pemiliknya
   * pernah diberi tahu.
   *
   * destination_url selalu dikosongkan. Alamat itu milik layanan yang lama;
   * mewariskannya bikin kartu menunjuk ke tempat yang tidak pernah dimaksudkan.
   */
  async setCardService(
    cardId: string,
    businessId: string,
    service: CardService,
  ): Promise<{ ok: boolean; error?: string; card?: Card }> {
    const card = one<Card>(
      await sql`
      SELECT * FROM cards WHERE id = ${cardId} AND business_id = ${businessId} LIMIT 1
    `,
    );
    if (!card)
      return { ok: false, error: "Kartu tidak ditemukan pada bisnis ini." };
    if (card.type === service) return { ok: true, card };

    if (card.type === "smart_touch") {
      const profile =
        await sql`SELECT 1 FROM smart_touch_profiles WHERE card_id = ${cardId} LIMIT 1`;
      if (profile.length) {
        return {
          ok: false,
          error:
            "Kartu ini masih punya halaman Smart Touch beserta tombolnya. Hapus dulu halaman itu, baru layanannya bisa dipindah.",
        };
      }
    }

    if (card.type === "loyalty" && card.customer_id) {
      return {
        ok: false,
        error:
          "Kartu ini sudah dipegang seorang member. Lepaskan dulu dari membernya sebelum dipakai untuk layanan lain.",
      };
    }

    if (card.type === "attendance") {
      const site =
        await sql`SELECT 1 FROM attendance_sites WHERE nfc_card_id = ${cardId} LIMIT 1`;
      if (site.length) {
        return {
          ok: false,
          error:
            "Kartu ini masih terpasang di sebuah titik absensi. Lepaskan dulu dari titik absensinya.",
        };
      }
    }

    const updated = one<Card>(
      await sql`
      UPDATE cards SET type = ${service}, destination_url = NULL
      WHERE id = ${cardId} AND business_id = ${businessId}
      RETURNING *
    `,
    );
    return { ok: true, card: updated! };
  },

  /**
   * Memindahkan Smart Touch tanpa membuang konfigurasi pemilik. Profil dan
   * tombol disalin ke arsip dalam transaksi yang sama, lalu barulah kartu
   * berganti layanan. Tidak ada keadaan setengah jadi saat browser terputus.
   */
  async archiveSmartTouchAndSetCardService(
    cardId: string,
    businessId: string,
    actorUserId: string,
    service: Exclude<CardService, "smart_touch">,
  ): Promise<{ ok: boolean; error?: string; card?: Card }> {
    return sql.begin(async (tx) => {
      const card = one<Card>(
        await tx`
        SELECT * FROM cards
        WHERE id = ${cardId} AND business_id = ${businessId} AND type = 'smart_touch'
        LIMIT 1
      `,
      );
      if (!card)
        return {
          ok: false,
          error: "Kartu Smart Touch tidak ditemukan pada bisnis ini.",
        };

      const profile = one<Record<string, unknown>>(
        await tx`
        SELECT title, subtitle, updated_at FROM smart_touch_profiles
        WHERE card_id = ${cardId} AND business_id = ${businessId} LIMIT 1
      `,
      );
      if (!profile)
        return {
          ok: false,
          error: "Halaman Smart Touch tidak ditemukan untuk diarsipkan.",
        };

      const buttons = await tx`
        SELECT action_key, label, target_url, sort_order, is_enabled
        FROM smart_touch_buttons
        WHERE card_id = ${cardId} AND business_id = ${businessId}
        ORDER BY sort_order
      `;
      await tx`
        INSERT INTO smart_touch_archives (card_id, business_id, profile, buttons, archived_by)
        VALUES (${cardId}, ${businessId}, ${JSON.stringify(profile)}::jsonb, ${JSON.stringify(buttons)}::jsonb, ${actorUserId})
        ON CONFLICT (card_id) DO UPDATE SET
          profile = EXCLUDED.profile,
          buttons = EXCLUDED.buttons,
          archived_at = NOW(),
          archived_by = EXCLUDED.archived_by
      `;
      await tx`DELETE FROM smart_touch_profiles WHERE card_id = ${cardId} AND business_id = ${businessId}`;
      const updated = one<Card>(
        await tx`
        UPDATE cards SET type = ${service}, destination_url = NULL
        WHERE id = ${cardId} AND business_id = ${businessId}
        RETURNING *
      `,
      );
      return { ok: true, card: updated! };
    });
  },

  /** Mencabut akses kartu dan mengembalikannya ke status unactivated (belum aktif) */
  async adminResetCard(cardId: string): Promise<Card | null> {
    return one<Card>(
      await sql`
      UPDATE cards SET
        business_id = NULL,
        status = 'unactivated',
        destination_url = NULL,
        label = NULL,
        customer_id = NULL
      WHERE id = ${cardId}
      RETURNING *
    `,
    );
  },

  /** Mengubah status kartu (active <-> suspended) oleh tim admin */
  async adminSetCardStatus(
    cardId: string,
    status: "active" | "suspended",
  ): Promise<Card | null> {
    return one<Card>(
      await sql`
      UPDATE cards SET status = ${status}
      WHERE id = ${cardId}
      RETURNING *
    `,
    );
  },

  /** Menghapus kartu permanen dari master database */
  async adminDeleteCard(cardId: string): Promise<boolean> {
    await sql`DELETE FROM card_taps WHERE card_id = ${cardId}`;
    const res = await sql`DELETE FROM cards WHERE id = ${cardId} RETURNING id`;
    return res.length > 0;
  },

  /**
   * Dipanggil tanpa await oleh endpoint redirect supaya pengalihan tidak
   * menunggu database. Trigger Postgres yang menaikkan cards.tap_count.
   */
  async recordCardTap(
    cardId: string,
    source: "nfc" | "qr",
    ip: string,
    userAgent: string,
  ) {
    await sql`
      INSERT INTO card_taps ${sql({
        card_id: cardId,
        source,
        ip_hash: await hashClientIp(ip),
        user_agent: userAgent.slice(0, 500),
      })}
    `;
  },

  async getCardTaps(businessId: string, cardId?: string): Promise<CardTap[]> {
    if (cardId) {
      return (await sql`
        SELECT t.* FROM card_taps t
        JOIN cards c ON c.id = t.card_id
        WHERE t.card_id = ${cardId} AND c.business_id = ${businessId}
        ORDER BY t.tapped_at DESC LIMIT 500
      `) as unknown as CardTap[];
    }
    return (await sql`
      SELECT t.* FROM card_taps t
      JOIN cards c ON c.id = t.card_id
      WHERE c.business_id = ${businessId}
      ORDER BY t.tapped_at DESC LIMIT 500
    `) as unknown as CardTap[];
  },

  // =========================================================================
  // Platform tenant, branding, and KAEL Review operations
  // =========================================================================

  async getBrandSettings(businessId: string) {
    return one<{
      business_id: string;
      app_name: string;
      accent_color: string;
      support_email: string | null;
      public_footer_text: string | null;
      custom_domain_status:
        | "not_requested"
        | "pending_dns"
        | "verified"
        | "rejected";
    }>(
      await sql`SELECT * FROM business_brand_settings WHERE business_id = ${businessId}`,
    );
  },

  async saveBrandSettings(
    businessId: string,
    data: {
      app_name: string;
      accent_color: string;
      support_email?: string | null;
      public_footer_text?: string | null;
      custom_domain?: string | null;
    },
  ) {
    return sql.begin(async (tx) => {
      await tx`
        INSERT INTO business_brand_settings ${tx({
          business_id: businessId,
          app_name: data.app_name,
          accent_color: data.accent_color,
          support_email: data.support_email ?? null,
          public_footer_text: data.public_footer_text ?? null,
          custom_domain_status: data.custom_domain
            ? "pending_dns"
            : "not_requested",
        })}
        ON CONFLICT (business_id) DO UPDATE SET
          app_name = EXCLUDED.app_name,
          accent_color = EXCLUDED.accent_color,
          support_email = EXCLUDED.support_email,
          public_footer_text = EXCLUDED.public_footer_text,
          custom_domain_status = CASE
            WHEN ${data.custom_domain ?? null} IS NULL THEN 'not_requested'
            ELSE 'pending_dns'
          END,
          updated_at = NOW()
      `;
      return one<Business>(
        await tx`
        UPDATE businesses SET custom_domain = ${data.custom_domain ?? null}, public_name = ${data.app_name}
        WHERE id = ${businessId} RETURNING *
      `,
      );
    });
  },

  async getMessagingChannel(businessId: string) {
    return one<{
      id: string;
      provider: "manual" | "meta_cloud" | "gateway";
      sender_phone: string | null;
      owner_notify_phone: string | null;
      /** Nama template Meta. Kosong = coba teks bebas (cuma jalan di jendela 24 jam). */
      template_notifikasi: string | null;
      template_tautan_member: string | null;
      template_bahasa: string | null;
      phone_number_id: string | null;
      business_account_id: string | null;
      secret_ref: string | null;
      is_enabled: boolean;
      verified_at: string | null;
    }>(
      await sql`SELECT * FROM business_messaging_channels WHERE business_id = ${businessId}`,
    );
  },

  async saveMessagingChannel(
    businessId: string,
    data: {
      provider: "manual" | "meta_cloud" | "gateway";
      sender_phone?: string | null;
      /** Nomor yang MENERIMA kabar operasional, bukan yang mengirim. */
      owner_notify_phone?: string | null;
      template_notifikasi?: string | null;
      template_tautan_member?: string | null;
      template_bahasa?: string | null;
      phone_number_id?: string | null;
      business_account_id?: string | null;
      secret_ref?: string | null;
      is_enabled: boolean;
    },
  ) {
    return one(
      await sql`
      INSERT INTO business_messaging_channels ${sql({ business_id: businessId, ...data })}
      ON CONFLICT (business_id) DO UPDATE SET
        provider = EXCLUDED.provider, sender_phone = EXCLUDED.sender_phone,
        owner_notify_phone = EXCLUDED.owner_notify_phone,
        template_notifikasi = EXCLUDED.template_notifikasi,
        template_tautan_member = EXCLUDED.template_tautan_member,
        template_bahasa = EXCLUDED.template_bahasa,
        phone_number_id = EXCLUDED.phone_number_id, business_account_id = EXCLUDED.business_account_id,
        secret_ref = EXCLUDED.secret_ref, is_enabled = EXCLUDED.is_enabled, updated_at = NOW()
      RETURNING *
    `,
    );
  },

  async recordAuditEvent(data: {
    businessId?: string | null;
    actorUserId?: string | null;
    action: string;
    entityType: string;
    entityId?: string | null;
    metadata?: Record<string, unknown>;
  }) {
    await sql`INSERT INTO audit_events ${sql({
      business_id: data.businessId ?? null,
      actor_user_id: data.actorUserId ?? null,
      action: data.action,
      entity_type: data.entityType,
      entity_id: data.entityId ?? null,
      metadata: JSON.stringify(data.metadata ?? {}),
    })}`;
  },

  async createGoogleReviewSnapshot(
    businessId: string,
    data: {
      googlePlaceId: string;
      rating: number;
      reviewCount: number;
      source?: "google_places" | "manual";
    },
  ) {
    return one(
      await sql`INSERT INTO google_review_snapshots ${sql({
        business_id: businessId,
        google_place_id: data.googlePlaceId,
        rating: data.rating,
        review_count: data.reviewCount,
        source: data.source ?? "google_places",
      })} RETURNING *`,
    );
  },

  async getGoogleReviewReport(businessId: string) {
    const rows = await sql`
      SELECT * FROM google_review_snapshots WHERE business_id = ${businessId}
      ORDER BY captured_at DESC LIMIT 180
    `;
    const snapshots = rows as unknown as {
      rating: number;
      review_count: number;
      captured_at: string;
    }[];
    const latest = snapshots[0] ?? null;
    const olderThan = (days: number) =>
      snapshots.find(
        (s) => Date.parse(s.captured_at) <= Date.now() - days * 86_400_000,
      ) ??
      snapshots[snapshots.length - 1] ??
      null;
    const week = olderThan(7);
    const month = olderThan(30);
    return {
      latest: latest && {
        rating: Number(latest.rating),
        reviewCount: num(latest.review_count),
        capturedAt: latest.captured_at,
      },
      growth7d:
        latest && week ? num(latest.review_count) - num(week.review_count) : 0,
      growth30d:
        latest && month
          ? num(latest.review_count) - num(month.review_count)
          : 0,
      snapshots: snapshots
        .reverse()
        .map((s) => ({
          rating: Number(s.rating),
          reviewCount: num(s.review_count),
          capturedAt: s.captured_at,
        })),
    };
  },

  /** Dipakai job server internal, bukan jalur yang dapat dipanggil browser. */
  async getBusinessesWithGooglePlace() {
    return (await sql`
      SELECT id, google_place_id FROM businesses
      WHERE google_place_id IS NOT NULL AND google_place_id <> ''
    `) as unknown as { id: string; google_place_id: string }[];
  },

  async saveReviewStandee(
    cardId: string,
    businessId: string,
    data: { headline: string; body: string; printSize: "A6" | "A5" | "A4" },
  ) {
    const card = one<Card>(
      await sql`SELECT * FROM cards WHERE id = ${cardId} AND business_id = ${businessId} AND type = 'review'`,
    );
    if (!card) return null;
    return one(
      await sql`
      INSERT INTO review_standee_configs ${sql({
        card_id: cardId,
        business_id: businessId,
        headline: data.headline,
        body: data.body,
        print_size: data.printSize,
      })}
      ON CONFLICT (card_id) DO UPDATE SET headline = EXCLUDED.headline, body = EXCLUDED.body,
        print_size = EXCLUDED.print_size, updated_at = NOW()
      RETURNING *
    `,
    );
  },

  async getReviewStandee(cardId: string, businessId: string) {
    return one(
      await sql`
      SELECT s.*, c.card_code, c.destination_url, c.label, b.name AS business_name, b.logo_url, b.brand_color
      FROM review_standee_configs s
      JOIN cards c ON c.id = s.card_id
      JOIN businesses b ON b.id = s.business_id
      WHERE s.card_id = ${cardId} AND s.business_id = ${businessId}
    `,
    );
  },

  async getSmartTouch(cardId: string, businessId?: string) {
    const profile = one<{
      card_id: string;
      business_id: string;
      title: string;
      subtitle: string | null;
      card_code: string;
      business_name: string;
      brand_color: string;
      logo_url: string | null;
      google_place_id: string;
      buttons: {
        action_key: string;
        label: string;
        target_url: string;
        sort_order: number;
        is_enabled: boolean;
      }[];
    }>(
      await sql`
      SELECT p.*, c.card_code, b.name AS business_name, b.brand_color, b.logo_url, b.google_place_id,
        COALESCE((SELECT json_agg(json_build_object('action_key', x.action_key, 'label', x.label, 'target_url', x.target_url, 'sort_order', x.sort_order, 'is_enabled', x.is_enabled) ORDER BY x.sort_order) FROM smart_touch_buttons x WHERE x.card_id = p.card_id), '[]'::json) AS buttons
      FROM smart_touch_profiles p JOIN cards c ON c.id = p.card_id JOIN businesses b ON b.id = p.business_id
      WHERE p.card_id = ${cardId} ${businessId ? sql`AND p.business_id = ${businessId}` : sql``}
    `,
    );
    if (!profile) return null;
    const reviewUrl = profile.google_place_id
      ? buildGoogleReviewUrl(profile.google_place_id)
      : null;
    return {
      ...profile,
      buttons: profile.buttons.map((button) =>
        button.action_key === "review" && reviewUrl
          ? { ...button, target_url: reviewUrl }
          : button,
      ),
    };
  },

  async getSmartTouchByCode(cardCode: string) {
    const profile = one<{
      card_id: string;
      business_id: string;
      title: string;
      subtitle: string | null;
      card_code: string;
      business_name: string;
      brand_color: string;
      logo_url: string | null;
      google_place_id: string;
      buttons: {
        action_key: string;
        label: string;
        target_url: string;
        sort_order: number;
        is_enabled: boolean;
      }[];
    }>(
      await sql`
      SELECT p.*, c.card_code, b.name AS business_name, b.brand_color, b.logo_url, b.google_place_id,
        COALESCE((SELECT json_agg(json_build_object('action_key', x.action_key, 'label', x.label, 'target_url', x.target_url, 'sort_order', x.sort_order, 'is_enabled', x.is_enabled) ORDER BY x.sort_order) FROM smart_touch_buttons x WHERE x.card_id = p.card_id), '[]'::json) AS buttons
      FROM smart_touch_profiles p JOIN cards c ON c.id = p.card_id JOIN businesses b ON b.id = p.business_id
      WHERE c.card_code = ${cardCode} AND c.status = 'active' AND c.type = 'smart_touch'
    `,
    );
    if (!profile) return null;
    const reviewUrl = profile.google_place_id
      ? buildGoogleReviewUrl(profile.google_place_id)
      : null;
    return {
      ...profile,
      buttons: profile.buttons.map((button) =>
        button.action_key === "review" && reviewUrl
          ? { ...button, target_url: reviewUrl }
          : button,
      ),
    };
  },

  async saveSmartTouch(
    cardId: string,
    businessId: string,
    data: {
      title: string;
      subtitle?: string | null;
      buttons: {
        actionKey: string;
        label: string;
        targetUrl: string;
        enabled: boolean;
        sortOrder: number;
      }[];
    },
  ) {
    return sql.begin(async (tx) => {
      const card = one<Card>(
        await tx`SELECT * FROM cards WHERE id = ${cardId} AND business_id = ${businessId} AND type = 'smart_touch'`,
      );
      if (!card) return null;
      await tx`INSERT INTO smart_touch_profiles ${tx({ card_id: cardId, business_id: businessId, title: data.title, subtitle: data.subtitle ?? null })} ON CONFLICT (card_id) DO UPDATE SET title = EXCLUDED.title, subtitle = EXCLUDED.subtitle, updated_at = NOW()`;
      await tx`DELETE FROM smart_touch_buttons WHERE card_id = ${cardId}`;
      for (const button of data.buttons)
        await tx`INSERT INTO smart_touch_buttons ${tx({ card_id: cardId, business_id: businessId, action_key: button.actionKey, label: button.label, target_url: button.targetUrl, is_enabled: button.enabled, sort_order: button.sortOrder })}`;
      // Do not query through the root connection inside this transaction: the
      // profile is not visible there until this transaction commits.
      return { card_code: card.card_code };
    });
  },

  async getSuspiciousCardTaps(businessId: string) {
    return (await sql`
      WITH recent AS (
        SELECT t.*, c.card_code, c.label,
          COUNT(*) OVER (PARTITION BY t.card_id, t.ip_hash) AS same_ip_count,
          LAG(t.tapped_at) OVER (PARTITION BY t.card_id, t.ip_hash ORDER BY t.tapped_at) AS previous_tap
        FROM card_taps t JOIN cards c ON c.id = t.card_id
        WHERE c.business_id = ${businessId} AND t.tapped_at > NOW() - INTERVAL '24 hours'
      )
      SELECT card_code, label, tapped_at, same_ip_count,
        EXTRACT(EPOCH FROM (tapped_at - previous_tap))::int AS seconds_since_previous
      FROM recent
      WHERE same_ip_count >= 5
         OR (previous_tap IS NOT NULL AND tapped_at - previous_tap < INTERVAL '20 seconds')
      ORDER BY tapped_at DESC LIMIT 100
    `) as unknown as {
      card_code: string;
      label: string | null;
      tapped_at: string;
      same_ip_count: number;
      seconds_since_previous: number | null;
    }[];
  },

  // =========================================================================
  // Loyalty
  // =========================================================================

  async getLoyaltyProgram(businessId: string): Promise<LoyaltyProgram | null> {
    return one<LoyaltyProgram>(
      await sql`
      SELECT * FROM loyalty_programs WHERE business_id = ${businessId} LIMIT 1
    `,
    );
  },

  /**
   * Membuat program loyalty untuk usaha yang belum punya.
   *
   * Tanpa ini modul Loyalty punya jalan buntu yang tidak kelihatan: kolom
   * business_modules bisa berkata "aktif", tapi updateLoyaltyProgram hanya
   * berbentuk UPDATE, jadi usaha yang belum punya barisnya tidak akan pernah
   * bisa membuatnya lewat aplikasi. Halamannya melempar galat, pendaftaran
   * membernya ditolak, dan tidak ada satu pun layar yang menjelaskan kenapa.
   *
   * ON CONFLICT DO NOTHING supaya dua klik beruntun tidak membuat dua program.
   */
  async createLoyaltyProgram(
    businessId: string,
    input: { mode: "point" | "stamp"; earnRate: number; stampPerVisit: number },
  ): Promise<LoyaltyProgram | null> {
    await sql`
      INSERT INTO loyalty_programs ${sql({
        business_id: businessId,
        mode: input.mode,
        earn_rate: input.earnRate,
        stamp_per_visit: input.stampPerVisit,
      })}
      ON CONFLICT (business_id) DO NOTHING
    `;
    return this.getLoyaltyProgram(businessId);
  },

  /**
   * Apakah tiap modul sudah punya konfigurasi minimum untuk BENAR-BENAR dipakai.
   *
   * Terpisah dari lisensi dengan sengaja. Lisensi menjawab "sudah dibeli belum";
   * ini menjawab "sudah bisa dipakai belum". Sebuah modul bisa lunas terbayar
   * dan tetap tidak berguna, dan menampilkannya sebagai "Aktif" dalam keadaan
   * itu membuat pemilik usaha mengira produknya rusak — persis yang terjadi
   * pada Loyalty yang tampil Aktif tapi pendaftaran membernya selalu ditolak.
   *
   * Finance sengaja tidak diperiksa: dia kalkulator, dan kosong adalah keadaan
   * awal yang wajar. Pemilik usaha mengisinya justru dari dalam modulnya.
   */
  async getModuleReadiness(businessId: string): Promise<{
    loyalty: boolean;
    pos: boolean;
    review: boolean;
    finance: boolean;
    booking: boolean;
    hr: boolean;
  }> {
    const rows = await sql`
      SELECT
        (SELECT COUNT(*) FROM loyalty_programs WHERE business_id = ${businessId})::int AS program,
        (SELECT COUNT(*) FROM menu_items WHERE business_id = ${businessId})::int AS menu,
        (SELECT COUNT(*) FROM cards
          WHERE business_id = ${businessId}
            AND status = 'active'
            AND (destination_url IS NOT NULL OR EXISTS (SELECT 1 FROM smart_touch_profiles p WHERE p.card_id = cards.id)))::int AS kartu,
        (SELECT COUNT(*) FROM booking_services WHERE business_id = ${businessId} AND is_active = TRUE)::int AS layanan,
        (SELECT COUNT(*) FROM users WHERE business_id = ${businessId} AND role = 'staff' AND is_active = TRUE)::int AS staf
    `;
    const r = rows[0] as {
      program: number;
      menu: number;
      kartu: number;
      layanan: number;
      staf: number;
    };
    return {
      // Tanpa barisnya, kurs poin tidak ada dan pendaftaran member pasti gagal.
      loyalty: (r?.program ?? 0) > 0,
      // Kasir tidak bisa menjual apa pun kalau menunya belum diisi.
      pos: (r?.menu ?? 0) > 0,
      // Kartu yang belum diaktivasi tidak mengarah ke mana pun.
      review: (r?.kartu ?? 0) > 0,
      finance: true,
      booking: (r?.layanan ?? 0) > 0,
      hr: (r?.staf ?? 0) > 0,
    };
  },

  async updateLoyaltyProgram(
    businessId: string,
    updates: Partial<LoyaltyProgram>,
  ) {
    const allowed = [
      "mode",
      "earn_rate",
      "stamp_per_visit",
      "point_expiry_months",
      "referral_is_active",
      "referral_referrer_points",
      "referral_referee_points",
      "referral_monthly_cap",
      "birthday_is_active",
      "birthday_bonus_points",
      "birthday_window_days",
      "tiers_is_active",
      "unit_name",
      "minimum_purchase",
      "max_earn_per_transaction",
      "rounding_mode",
    ] as const;
    const patch = Object.fromEntries(
      Object.entries(updates).filter(([k]) =>
        (allowed as readonly string[]).includes(k),
      ),
    );
    if (!Object.keys(patch).length) return this.getLoyaltyProgram(businessId);
    const updated = one<LoyaltyProgram>(
      await sql`
      UPDATE loyalty_programs SET ${sql({ ...patch, updated_at: new Date().toISOString() })}
      WHERE business_id = ${businessId} RETURNING *
    `,
    );

    /**
     * Level pertama kali diaktifkan dan belum punya satu pun baris: isi
     * dengan tiga level contoh (Basic/Silver/Gold) supaya owner tidak
     * membuka layar kosong. Ini titik awal, bukan patokan — semua bisa
     * diubah atau dihapus lewat saveTier/deleteTier.
     */
    if (updates.tiers_is_active === true) {
      const existing =
        await sql`SELECT 1 FROM loyalty_tiers WHERE business_id = ${businessId} LIMIT 1`;
      if (!existing.length) {
        const defaults = [
          {
            name: "Basic",
            min_lifetime_spend: 0,
            earn_multiplier: "1.00",
            sort_order: 0,
          },
          {
            name: "Silver",
            min_lifetime_spend: 500_000,
            earn_multiplier: "1.25",
            sort_order: 1,
          },
          {
            name: "Gold",
            min_lifetime_spend: 2_000_000,
            earn_multiplier: "1.50",
            sort_order: 2,
          },
        ];
        for (const tier of defaults) {
          await sql`INSERT INTO loyalty_tiers ${sql({ business_id: businessId, ...tier })}`;
        }
      }
    }

    return updated;
  },

  async getLoyaltyTiers(
    businessId: string,
  ): Promise<import("./types").LoyaltyTier[]> {
    return (await sql`
      SELECT * FROM loyalty_tiers WHERE business_id = ${businessId} ORDER BY sort_order
    `) as unknown as import("./types").LoyaltyTier[];
  },

  /** Total belanja sepanjang riwayat, dipakai untuk menentukan level. Tidak pernah disimpan sebagai kolom. */
  async getCustomerLifetimeSpend(
    businessId: string,
    customerId: string,
  ): Promise<number> {
    const r = await sql`
      SELECT COALESCE(SUM(amount_spent), 0)::bigint AS spend
      FROM point_ledger WHERE business_id = ${businessId} AND customer_id = ${customerId} AND reason = 'purchase'
    `;
    return num(r[0]?.spend);
  },

  async saveTier(
    businessId: string,
    data: {
      id?: string;
      name: string;
      min_lifetime_spend: number;
      earn_multiplier: number;
      benefit_note: string | null;
      sort_order: number;
    },
  ): Promise<import("./types").LoyaltyTier> {
    const row = {
      name: data.name,
      min_lifetime_spend: data.min_lifetime_spend,
      earn_multiplier: data.earn_multiplier.toFixed(2),
      benefit_note: data.benefit_note,
      sort_order: data.sort_order,
    };
    if (data.id) {
      return one<import("./types").LoyaltyTier>(
        await sql`
        UPDATE loyalty_tiers SET ${sql(row)}
        WHERE id = ${data.id} AND business_id = ${businessId} RETURNING *
      `,
      )!;
    }
    return one<import("./types").LoyaltyTier>(
      await sql`
      INSERT INTO loyalty_tiers ${sql({ business_id: businessId, ...row })} RETURNING *
    `,
    )!;
  },

  async deleteTier(id: string, businessId: string): Promise<boolean> {
    const rows =
      await sql`DELETE FROM loyalty_tiers WHERE id = ${id} AND business_id = ${businessId} RETURNING id`;
    return rows.length > 0;
  },

  async getCustomers(businessId: string): Promise<Customer[]> {
    return (await sql`
      SELECT * FROM customers WHERE business_id = ${businessId} ORDER BY created_at DESC
    `) as unknown as Customer[];
  },

  /**
   * Pelanggan beserta saldo poinnya dalam satu query.
   *
   * Versi lama memanggil getCustomerPointBalance di dalam render, satu kali per
   * baris. Dengan database sungguhan itu berarti satu query per pelanggan tiap
   * kali halaman digambar ulang.
   */
  async getCustomersWithBalance(businessId: string) {
    return (await sql`
      SELECT c.id, c.name, c.created_at, RIGHT(c.phone, 4) AS phone_last4,
        CONCAT('+62 ***-***-', RIGHT(c.phone, 4)) AS phone_masked,
        COALESCE(SUM(l.delta), 0)::int AS balance
      FROM customers c
      LEFT JOIN point_ledger l ON l.customer_id = c.id
      WHERE c.business_id = ${businessId}
      GROUP BY c.id
      ORDER BY c.created_at DESC
    `) as unknown as import("./types").CustomerDirectoryEntry[];
  },

  async getCustomerExport(businessId: string) {
    return (await sql`
      SELECT c.name, c.phone, c.created_at, c.marketing_opt_in,
        COALESCE(SUM(l.delta), 0)::int AS point_balance
      FROM customers c
      LEFT JOIN point_ledger l ON l.customer_id = c.id
      WHERE c.business_id = ${businessId}
      GROUP BY c.id
      ORDER BY c.created_at DESC
    `) as {
      name: string | null;
      phone: string;
      created_at: string;
      marketing_opt_in: boolean;
      point_balance: number;
    }[];
  },

  /** Batas 5 pendaftaran publik per jam untuk satu jaringan dan satu toko. */
  async allowPublicLoyaltyRegistration(
    businessId: string,
    ipHash: string,
  ): Promise<boolean> {
    return sql.begin(async (tx) => {
      await tx`SELECT pg_advisory_xact_lock(hashtext(${businessId + ":" + ipHash}))`;
      await tx`DELETE FROM loyalty_registration_attempts WHERE created_at < NOW() - INTERVAL '2 days'`;
      const row = one<{ count: string | number }>(
        await tx`
        SELECT COUNT(*) AS count FROM loyalty_registration_attempts
        WHERE business_id = ${businessId} AND ip_hash = ${ipHash}
          AND created_at >= NOW() - INTERVAL '1 hour'
      `,
      );
      if (num(row?.count) >= 5) return false;
      await tx`INSERT INTO loyalty_registration_attempts ${tx({ business_id: businessId, ip_hash: ipHash })}`;
      return true;
    });
  },

  async getPointExpiryCandidates(
    businessId: string,
    expiryMonths: number,
    until: Date,
  ): Promise<PointExpiryCandidate[]> {
    const rows = await sql`
      SELECT l.customer_id, c.name, l.delta, l.created_at
      FROM point_ledger l
      JOIN customers c ON c.id = l.customer_id AND c.business_id = ${businessId}
      WHERE l.business_id = ${businessId}
      ORDER BY l.customer_id, l.created_at, l.id
    `;
    return getPointExpiryCandidates(
      rows as unknown as PointExpiryLedgerRow[],
      expiryMonths,
      until,
    );
  },

  async expireDuePoints(
    businessId: string,
    userId: string,
    expiryMonths: number,
  ): Promise<number> {
    return sql.begin(async (tx) => {
      const rows = await tx`
        SELECT l.customer_id, c.name, l.delta, l.created_at
        FROM point_ledger l
        JOIN customers c ON c.id = l.customer_id AND c.business_id = ${businessId}
        WHERE l.business_id = ${businessId}
        ORDER BY l.customer_id, l.created_at, l.id
      `;
      const due = getPointExpiryCandidates(
        rows as unknown as PointExpiryLedgerRow[],
        expiryMonths,
        new Date(),
      );
      for (const candidate of due) {
        await tx`
          INSERT INTO point_ledger ${tx({
            business_id: businessId,
            customer_id: candidate.customer_id,
            delta: -candidate.points,
            reason: "expiry",
            note: `Poin kedaluwarsa sesuai masa berlaku ${expiryMonths} bulan`,
            created_by: userId,
          })}
        `;
      }
      return due.reduce((total, candidate) => total + candidate.points, 0);
    });
  },

  /**
   * Ringkasan satu member untuk halaman profil internal.
   *
   * Nilai belanja, frekuensi kunjungan, dan saldo dibaca dari ledger. Dengan
   * begitu profil tidak punya angka turunan yang bisa tertinggal dari transaksi
   * sebenarnya.
   */
  async getCustomerProfileSummary(customerId: string, businessId: string) {
    return one<CustomerProfileSummary>(
      await sql`
      SELECT
        c.*,
        COALESCE(SUM(l.delta), 0)::int AS balance,
        COALESCE(SUM(l.amount_spent) FILTER (WHERE l.reason = 'purchase'), 0)::bigint AS lifetime_spend,
        COUNT(l.id) FILTER (WHERE l.reason = 'purchase')::int AS purchase_count,
        COALESCE(SUM(l.delta) FILTER (WHERE l.delta > 0), 0)::int AS points_earned,
        MAX(l.created_at) AS last_activity_at
      FROM customers c
      LEFT JOIN point_ledger l
        ON l.customer_id = c.id AND l.business_id = c.business_id
      WHERE c.id = ${customerId} AND c.business_id = ${businessId}
      GROUP BY c.id
    `,
    );
  },

  /** Seluruh member dengan data yang dibutuhkan aturan segmentasi. */
  async getCustomerMemberInsights(
    businessId: string,
  ): Promise<CustomerProfileSummary[]> {
    return (await sql`
      SELECT
        c.*,
        COALESCE(SUM(l.delta), 0)::int AS balance,
        COALESCE(SUM(l.amount_spent) FILTER (WHERE l.reason = 'purchase'), 0)::bigint AS lifetime_spend,
        COUNT(l.id) FILTER (WHERE l.reason = 'purchase')::int AS purchase_count,
        COALESCE(SUM(l.delta) FILTER (WHERE l.delta > 0), 0)::int AS points_earned,
        MAX(l.created_at) AS last_activity_at
      FROM customers c
      LEFT JOIN point_ledger l
        ON l.customer_id = c.id AND l.business_id = c.business_id
      WHERE c.business_id = ${businessId}
      GROUP BY c.id
      ORDER BY MAX(l.created_at) DESC NULLS LAST, c.created_at DESC
    `) as unknown as CustomerProfileSummary[];
  },

  /**
   * Pendaftaran member baru per minggu. Garis dasar pertumbuhan sebelum
   * referral, ulang tahun, dan campaign mulai jalan — tanpa angka ini,
   * tidak ada cara membuktikan fitur-fitur itu benar-benar menambah member.
   *
   * Batas minggu mengikuti businesses.timezone, sama seperti getPosReports:
   * pendaftaran jam 23 WIB tidak boleh terhitung ke minggu berikutnya hanya
   * karena servernya UTC.
   */
  async getWeeklySignups(
    businessId: string,
    weeks = 8,
  ): Promise<{ week_start: string; count: number }[]> {
    const biz = await this.getBusiness(businessId);
    const tz = biz?.timezone || "Asia/Jakarta";
    // generate_series mengisi minggu tanpa pendaftaran dengan 0, bukan
    // membiarkannya bolong. Tanpa ini grafik garis akan melompati minggu sepi
    // seolah waktu tidak berjalan.
    const rows = await sql`
      WITH weeks AS (
        SELECT generate_series(
          date_trunc('week', NOW() AT TIME ZONE ${tz}) - (${weeks - 1}::int * INTERVAL '1 week'),
          date_trunc('week', NOW() AT TIME ZONE ${tz}),
          INTERVAL '1 week'
        )::date AS week_start
      )
      SELECT w.week_start, COUNT(c.id)::int AS count
      FROM weeks w
      LEFT JOIN customers c
        ON c.business_id = ${businessId}
        AND date_trunc('week', c.created_at AT TIME ZONE ${tz})::date = w.week_start
      GROUP BY w.week_start
      ORDER BY w.week_start
    `;
    return rows.map((r) => ({
      week_start: String(r.week_start),
      count: num(r.count),
    }));
  },

  /**
   * Tren mingguan penuh untuk halaman analitik: pendaftaran baru, member
   * aktif (pembeli unik), dan nilai belanja — tiga sumbu berbeda dalam satu
   * baris per minggu. Sengaja agregat langsung dari SQL, BUKAN menarik semua
   * baris getCustomerMemberInsights lalu dihitung ulang di TS: fungsi itu
   * menarik SELURUH member tiap kali dipanggil, dan di sini kita hanya butuh
   * angka ringkasnya, bukan barisnya.
   */
  async getMemberGrowthTrend(
    businessId: string,
    weeks = 12,
  ): Promise<
    {
      week_start: string;
      new_signups: number;
      active_members: number;
      revenue: number;
    }[]
  > {
    const biz = await this.getBusiness(businessId);
    const tz = biz?.timezone || "Asia/Jakarta";
    const rows = await sql`
      WITH weeks AS (
        SELECT generate_series(
          date_trunc('week', NOW() AT TIME ZONE ${tz}) - (${weeks - 1}::int * INTERVAL '1 week'),
          date_trunc('week', NOW() AT TIME ZONE ${tz}),
          INTERVAL '1 week'
        )::date AS week_start
      ),
      signups AS (
        SELECT date_trunc('week', created_at AT TIME ZONE ${tz})::date AS week_start, COUNT(*)::int AS n
        FROM customers WHERE business_id = ${businessId}
        GROUP BY 1
      ),
      -- Poin bukan belanja: FILTER-nya wajib, kalau tidak bonus referral dan
      -- ulang tahun ikut terhitung sebagai omzet yang tidak pernah terjadi.
      purchases AS (
        SELECT date_trunc('week', created_at AT TIME ZONE ${tz})::date AS week_start,
          COUNT(DISTINCT customer_id) FILTER (WHERE reason = 'purchase')::int AS active_members,
          COALESCE(SUM(amount_spent) FILTER (WHERE reason = 'purchase'), 0)::bigint AS revenue
        FROM point_ledger WHERE business_id = ${businessId}
        GROUP BY 1
      )
      SELECT w.week_start,
        COALESCE(s.n, 0)::int AS new_signups,
        COALESCE(p.active_members, 0)::int AS active_members,
        COALESCE(p.revenue, 0)::bigint AS revenue
      FROM weeks w
      LEFT JOIN signups s ON s.week_start = w.week_start
      LEFT JOIN purchases p ON p.week_start = w.week_start
      ORDER BY w.week_start
    `;
    return rows.map((r) => ({
      week_start: String(r.week_start),
      new_signups: num(r.new_signups),
      active_members: num(r.active_members),
      revenue: num(r.revenue),
    }));
  },

  /**
   * Ringkasan 30 hari terakhir dibanding 30 hari sebelumnya. Satu kueri
   * agregat, bukan per-member — "member kembali" dan "repeat purchase"
   * dihitung dari SUM/COUNT di dalam SQL, bukan dari baris yang ditarik
   * lalu difilter di TS.
   */
  async getMemberGrowthSummary(businessId: string): Promise<{
    activeMembers: number;
    activeMembersPrior: number;
    repeatCustomers: number;
    returningMembers: number;
    revenue: number;
    revenuePrior: number;
  }> {
    const row = one<{
      active_members: number;
      active_members_prior: number;
      repeat_customers: number;
      returning_members: number;
      revenue: number;
      revenue_prior: number;
    }>(
      await sql`
      WITH recent AS (
        SELECT customer_id, COUNT(*)::int AS purchase_count, SUM(amount_spent) AS spend
        FROM point_ledger
        WHERE business_id = ${businessId} AND reason = 'purchase' AND created_at >= NOW() - INTERVAL '30 days'
        GROUP BY customer_id
      ),
      prior AS (
        SELECT customer_id, SUM(amount_spent) AS spend
        FROM point_ledger
        WHERE business_id = ${businessId} AND reason = 'purchase'
          AND created_at >= NOW() - INTERVAL '60 days' AND created_at < NOW() - INTERVAL '30 days'
        GROUP BY customer_id
      )
      SELECT
        (SELECT COUNT(*) FROM recent)::int AS active_members,
        (SELECT COUNT(*) FROM prior)::int AS active_members_prior,
        (SELECT COUNT(*) FROM recent WHERE purchase_count >= 2)::int AS repeat_customers,
        -- "Kembali" = belanja sekarang DAN pernah belanja sebelum jendela ini.
        -- Bukan sekadar "terdaftar lebih dari 30 hari lalu": member lama yang
        -- baru pertama kali belanja hari ini adalah member yang BARU aktif,
        -- bukan member yang kembali. Sengaja memakai riwayat penuh, bukan
        -- hanya jendela 30-60 hari — yang terakhir belanja empat bulan lalu
        -- lalu datang lagi tetap member yang kembali.
        (SELECT COUNT(*) FROM recent r
          WHERE EXISTS (
            SELECT 1 FROM point_ledger l
            WHERE l.customer_id = r.customer_id AND l.business_id = ${businessId}
              AND l.reason = 'purchase' AND l.created_at < NOW() - INTERVAL '30 days'
          ))::int AS returning_members,
        (SELECT COALESCE(SUM(spend), 0) FROM recent)::bigint AS revenue,
        (SELECT COALESCE(SUM(spend), 0) FROM prior)::bigint AS revenue_prior
    `,
    );
    return {
      activeMembers: num(row?.active_members),
      activeMembersPrior: num(row?.active_members_prior),
      repeatCustomers: num(row?.repeat_customers),
      returningMembers: num(row?.returning_members),
      revenue: num(row?.revenue),
      revenuePrior: num(row?.revenue_prior),
    };
  },

  /**
   * Ringkasan menyeluruh kesehatan loyalty & seluruh basis member untuk Owner.
   */
  async getLoyaltyOverallStats(businessId: string): Promise<LoyaltyOverallStats> {
    const row = one<{
      total_members: number;
      new_members_30d: number;
      new_members_7d: number;
      total_points_earned: number;
      total_points_redeemed: number;
      total_points_balance: number;
      total_member_revenue: number;
      total_member_transactions: number;
      active_members_30d: number;
      repeat_members_count: number;
      at_risk_members_count: number;
    }>(
      await sql`
      WITH member_stats AS (
        SELECT
          c.id,
          c.created_at,
          COALESCE(SUM(l.delta), 0)::int AS balance,
          COALESCE(SUM(l.delta) FILTER (WHERE l.delta > 0), 0)::int AS earned,
          COALESCE(ABS(SUM(l.delta) FILTER (WHERE l.delta < 0 AND l.reason = 'redeem')), 0)::int AS redeemed,
          COALESCE(SUM(l.amount_spent) FILTER (WHERE l.reason = 'purchase'), 0)::bigint AS spend,
          COUNT(l.id) FILTER (WHERE l.reason = 'purchase')::int AS tx_count,
          MAX(l.created_at) AS last_activity
        FROM customers c
        LEFT JOIN point_ledger l ON l.customer_id = c.id AND l.business_id = c.business_id
        WHERE c.business_id = ${businessId}
        GROUP BY c.id
      )
      SELECT
        COUNT(*)::int AS total_members,
        COUNT(*) FILTER (WHERE created_at >= NOW() - INTERVAL '30 days')::int AS new_members_30d,
        COUNT(*) FILTER (WHERE created_at >= NOW() - INTERVAL '7 days')::int AS new_members_7d,
        COALESCE(SUM(earned), 0)::bigint AS total_points_earned,
        COALESCE(SUM(redeemed), 0)::bigint AS total_points_redeemed,
        COALESCE(SUM(balance), 0)::bigint AS total_points_balance,
        COALESCE(SUM(spend), 0)::bigint AS total_member_revenue,
        COALESCE(SUM(tx_count), 0)::bigint AS total_member_transactions,
        COUNT(*) FILTER (WHERE last_activity >= NOW() - INTERVAL '30 days')::int AS active_members_30d,
        COUNT(*) FILTER (WHERE tx_count >= 2)::int AS repeat_members_count,
        COUNT(*) FILTER (WHERE last_activity IS NOT NULL AND last_activity < NOW() - INTERVAL '30 days')::int AS at_risk_members_count
      FROM member_stats
    `,
    );
    return {
      totalMembers: num(row?.total_members),
      newMembers30d: num(row?.new_members_30d),
      newMembers7d: num(row?.new_members_7d),
      totalPointsEarned: num(row?.total_points_earned),
      totalPointsRedeemed: num(row?.total_points_redeemed),
      totalPointsBalance: num(row?.total_points_balance),
      totalMemberRevenue: num(row?.total_member_revenue),
      totalMemberTransactions: num(row?.total_member_transactions),
      activeMembers30d: num(row?.active_members_30d),
      repeatMembersCount: num(row?.repeat_members_count),
      atRiskMembersCount: num(row?.at_risk_members_count),
    };
  },

  /**
   * Riwayat transaksi member terkini lintas pelanggan untuk owner.
   */
  async getRecentBusinessPointLedger(
    businessId: string,
    limit = 30,
  ): Promise<BusinessPointLedgerRow[]> {
    return (await sql`
      SELECT
        l.*,
        c.name AS customer_name,
        c.phone AS customer_phone,
        c.token AS customer_token,
        u.name AS staff_name
      FROM point_ledger l
      JOIN customers c ON c.id = l.customer_id AND c.business_id = ${businessId}
      LEFT JOIN users u ON u.id = l.created_by
      WHERE l.business_id = ${businessId}
      ORDER BY l.created_at DESC
      LIMIT ${limit}
    `) as unknown as BusinessPointLedgerRow[];
  },

  /** "Kembali" berarti ada transaksi sesudah campaign dibuat, bukan bukti penyebabnya. */
  async getLoyaltyCampaignSummaries(
    businessId: string,
  ): Promise<LoyaltyCampaignSummary[]> {
    return (await sql`
      SELECT c.*, COUNT(r.id)::int AS recipient_count,
        COUNT(r.id) FILTER (WHERE r.opened_at IS NOT NULL)::int AS opened_count,
        COUNT(r.id) FILTER (WHERE r.sent_at IS NOT NULL)::int AS sent_count,
        -- Sinyal lunak: ada belanja sesudah campaign dibuat. Bisa jadi sebab lain.
        COUNT(r.id) FILTER (WHERE EXISTS (
          SELECT 1 FROM point_ledger l WHERE l.customer_id = r.customer_id
            AND l.business_id = c.business_id AND l.reason = 'purchase' AND l.created_at >= c.created_at
        ))::int AS returned_count,
        lc.code,
        -- Bukti keras: kode campaign ini benar-benar diketik di kasir.
        COALESCE((SELECT COUNT(*) FROM loyalty_code_uses u WHERE u.code_id = lc.id), 0)::int AS code_used_count
      FROM loyalty_campaigns c
      LEFT JOIN loyalty_campaign_recipients r ON r.campaign_id = c.id
      LEFT JOIN loyalty_codes lc ON lc.campaign_id = c.id
      WHERE c.business_id = ${businessId}
      GROUP BY c.id, lc.id, lc.code
      ORDER BY c.created_at DESC
      LIMIT 20
    `) as unknown as LoyaltyCampaignSummary[];
  },

  async getLoyaltyCampaignRecipients(
    campaignId: string,
    businessId: string,
  ): Promise<LoyaltyCampaignRecipient[]> {
    return (await sql`
      SELECT r.*, c.name, c.phone,
        COALESCE((SELECT SUM(l2.delta) FROM point_ledger l2 WHERE l2.customer_id = c.id), 0)::int AS balance,
        COUNT(l.id) FILTER (WHERE l.reason = 'purchase')::int AS purchase_count
      FROM loyalty_campaign_recipients r
      JOIN loyalty_campaigns campaign ON campaign.id = r.campaign_id AND campaign.business_id = ${businessId}
      JOIN customers c ON c.id = r.customer_id AND c.business_id = ${businessId}
      LEFT JOIN point_ledger l ON l.customer_id = c.id AND l.business_id = ${businessId}
      WHERE r.campaign_id = ${campaignId}
      GROUP BY r.id, c.id
      ORDER BY c.name NULLS LAST, r.created_at
    `) as unknown as LoyaltyCampaignRecipient[];
  },

  async createLoyaltyCampaign(
    businessId: string,
    userId: string,
    input: {
      name: string;
      segment: LoyaltyCampaignSummary["segment"];
      messageTemplate: string;
      customerIds: string[];
      goal?: string;
      /**
       * Kalau diisi (termasuk 0), campaign ini mendapat kode promo — dicetak
       * di sini lewat mesin loyalty_codes yang sama dengan referral. Kalau
       * undefined, tidak ada kode sama sekali: dipakai apa adanya oleh alur
       * ulang tahun/anniversary lama yang sudah punya mekanisme bonusnya
       * sendiri, supaya tidak menciptakan dua jalur poin untuk hal yang sama.
       */
      codeRewardPoints?: number;
    },
  ): Promise<{
    campaign: LoyaltyCampaignSummary;
    recipients: LoyaltyCampaignRecipient[];
  } | null> {
    return sql.begin(async (tx) => {
      const approved = await tx`
        SELECT id FROM customers
        WHERE business_id = ${businessId} AND marketing_opt_in = TRUE AND id = ANY(${input.customerIds}::uuid[])
      `;
      const customerIds = approved.map((row) => String(row.id));
      if (!customerIds.length) return null;

      const campaign = one<LoyaltyCampaignSummary>(
        await tx`
        INSERT INTO loyalty_campaigns ${tx({
          business_id: businessId,
          name: input.name,
          segment: input.segment,
          message_template: input.messageTemplate,
          created_by: userId,
          goal: input.goal ?? null,
        })}
        RETURNING *, 0::int AS recipient_count, 0::int AS opened_count, 0::int AS sent_count, 0::int AS returned_count
      `,
      )!;
      if (!campaign) return null;

      let code: string | null = null;
      if (input.codeRewardPoints !== undefined) {
        // Cek-lalu-buat, coba ulang kalau tabrakan — sama seperti createBatchCards.
        code = generateLoyaltyCode();
        for (let attempt = 0; attempt < 5; attempt++) {
          const clash =
            await tx`SELECT 1 FROM loyalty_codes WHERE business_id = ${businessId} AND code = ${code} LIMIT 1`;
          if (!clash.length) break;
          code = generateLoyaltyCode();
        }
        await tx`
          INSERT INTO loyalty_codes ${tx({
            business_id: businessId,
            code,
            source: "campaign",
            campaign_id: campaign.id,
            reward_points: input.codeRewardPoints,
          })}
        `;
      }

      await tx`
        INSERT INTO loyalty_campaign_recipients (campaign_id, customer_id)
        SELECT ${campaign.id}::uuid, unnest(${customerIds}::uuid[])
      `;
      const recipients = (await tx`
        SELECT r.*, c.name, c.phone,
          COALESCE((SELECT SUM(l2.delta) FROM point_ledger l2 WHERE l2.customer_id = c.id), 0)::int AS balance,
          COUNT(l.id) FILTER (WHERE l.reason = 'purchase')::int AS purchase_count
        FROM loyalty_campaign_recipients r
        JOIN customers c ON c.id = r.customer_id AND c.business_id = ${businessId}
        LEFT JOIN point_ledger l ON l.customer_id = c.id AND l.business_id = ${businessId}
        WHERE r.campaign_id = ${campaign.id}
        GROUP BY r.id, c.id
        ORDER BY c.name NULLS LAST, r.created_at
      `) as unknown as LoyaltyCampaignRecipient[];
      return {
        campaign: {
          ...campaign,
          recipient_count: recipients.length,
          code,
          code_used_count: 0,
        },
        recipients,
      };
    });
  },

  async updateLoyaltyCampaignRecipientStatus(
    recipientId: string,
    businessId: string,
    status: LoyaltyCampaignStatus,
  ): Promise<
    | (LoyaltyCampaignRecipient & {
        campaign_segment: LoyaltyCampaignSummary["segment"];
      })
    | null
  > {
    // campaign_segment ikut dikembalikan supaya pemanggil tahu, tanpa kueri
    // kedua, apakah ini campaign ulang tahun yang perlu memicu bonus poin.
    return one<
      LoyaltyCampaignRecipient & {
        campaign_segment: LoyaltyCampaignSummary["segment"];
      }
    >(
      await sql`
      UPDATE loyalty_campaign_recipients r
      SET status = ${status},
        opened_at = CASE WHEN ${status} = 'opened' AND r.opened_at IS NULL THEN NOW() ELSE r.opened_at END,
        sent_at = CASE WHEN ${status} = 'sent' THEN NOW() ELSE r.sent_at END
      FROM loyalty_campaigns campaign
      WHERE r.id = ${recipientId} AND campaign.id = r.campaign_id AND campaign.business_id = ${businessId}
      RETURNING r.*, campaign.segment AS campaign_segment
    `,
    );
  },

  async getCustomerById(
    id: string,
    businessId: string,
  ): Promise<Customer | null> {
    return one<Customer>(
      await sql`
      SELECT * FROM customers WHERE id = ${id} AND business_id = ${businessId}
    `,
    );
  },

  /**
   * Halaman pelanggan terbuka tanpa login, dijaga hanya oleh token yang tidak
   * bisa ditebak. Karena itu token tidak boleh ikut ke bundel browser, dan
   * pemanggilnya wajib komponen server.
   */
  async getCustomerByToken(token: string): Promise<Customer | null> {
    return one<Customer>(
      await sql`SELECT * FROM customers WHERE token = ${token}`,
    );
  },

  /**
   * Nomornya dibakukan DI SINI, bukan dipercayakan ke pemanggil.
   *
   * Yang tersimpan selalu bentuk baku (6283848115843), sementara yang diketik
   * orang bisa 083848115843, +62 838-4811-5843, atau dengan spasi. Versi
   * sebelumnya mencocokkan apa adanya, jadi pencarian dengan nomor berawalan 0
   * — bentuk yang paling lazim diketik — selalu menjawab "tidak ada", dan
   * jawaban itu tidak bisa dibedakan dari member yang memang belum terdaftar.
   */
  async getCustomerByPhone(businessId: string, phone: string): Promise<Customer | null> {
    const nomor = normalizePhoneNumber(phone);
    if (!nomor) return null;
    return one<Customer>(
      await sql`SELECT * FROM customers WHERE business_id = ${businessId} AND phone = ${nomor}`,
    );
  },

  /**
   * Permintaan tautan kartu member yang BELUM bisa dikirim otomatis.
   *
   * Selama toko belum menyetel WhatsApp Cloud API, permintaan pelanggan cuma
   * jadi catatan. Tanpa layar yang menampilkannya, catatan itu tidak pernah
   * dibaca siapa pun dan pelanggannya menunggu pesan yang tidak akan datang.
   *
   * metadata disimpan sebagai jsonb lewat JSON.stringify, jadi kembali ke sini
   * berupa teks dan harus diurai lagi.
   */
  async getPendingMemberLinkRequests(businessId: string, limit = 20) {
    const baris = await sql`
      SELECT a.id, a.entity_id, a.metadata, a.created_at,
             c.name AS customer_name, c.phone AS customer_phone
      FROM audit_events a
      LEFT JOIN customers c ON c.id = a.entity_id
      WHERE a.business_id = ${businessId}
        AND a.action = 'loyalty.member_link_requested'
        AND a.created_at > NOW() - INTERVAL '7 days'
      ORDER BY a.created_at DESC
      LIMIT ${limit}
    `;

    return baris.map((r) => {
      let meta: { alasan?: string; tautanManual?: string } = {};
      try {
        meta = typeof r.metadata === "string" ? JSON.parse(r.metadata) : (r.metadata ?? {});
      } catch {
        /* catatan lama yang bentuknya tidak terduga tetap ditampilkan apa adanya */
      }
      return {
        id: r.id as string,
        customerName: (r.customer_name as string | null) ?? "Member",
        customerPhone: (r.customer_phone as string | null) ?? "",
        alasan: meta.alasan ?? "",
        tautanManual: meta.tautanManual ?? "",
        createdAt: r.created_at as string,
      };
    });
  },

  async searchCustomers(businessId: string, query: string) {
    const q = "%" + query.trim() + "%";
    return (await sql`
      SELECT c.id, c.name, c.created_at, RIGHT(c.phone, 4) AS phone_last4,
        CONCAT('+62 ***-***-', RIGHT(c.phone, 4)) AS phone_masked,
        COALESCE(SUM(l.delta), 0)::int AS balance
      FROM customers c
      LEFT JOIN point_ledger l ON l.customer_id = c.id
      WHERE c.business_id = ${businessId}
        AND (c.phone ILIKE ${q} OR c.name ILIKE ${q})
      GROUP BY c.id
      ORDER BY c.created_at DESC
      LIMIT 20
    `) as unknown as import("./types").CustomerDirectoryEntry[];
  },

  async registerCustomer(
    businessId: string,
    name: string,
    rawPhone: string,
    birthday?: string,
    marketingOptIn = false,
    referredByCustomerId?: string | null,
  ) {
    const phone = normalizePhoneNumber(rawPhone);
    if (!phone)
      return { success: false as const, error: "Nomor WhatsApp tidak valid." };

    const existing = one<Customer>(
      await sql`
      SELECT * FROM customers WHERE business_id = ${businessId} AND phone = ${phone}
    `,
    );
    if (existing)
      return {
        success: true as const,
        customer: existing,
        alreadyMember: true,
      };

    /**
     * referred_by hanya terpasang untuk pendaftaran baru. Member lama yang
     * kebetulan membuka tautan ajakan tidak akan sampai ke baris ini sama
     * sekali — `existing` di atas sudah memulangkannya lebih dulu. Jadi
     * mustahil seseorang mengajak dirinya sendiri lewat jalur ini: pemilik
     * kode harus sudah jadi member sebelum kodenya bisa dipakai.
     */
    const customer = one<Customer>(
      await sql`
      INSERT INTO customers ${sql({
        business_id: businessId,
        phone,
        name,
        birthday: birthday || null,
        token: generateCustomerToken(),
        consent_at: new Date().toISOString(),
        marketing_opt_in: marketingOptIn,
        marketing_opt_in_at: marketingOptIn ? new Date().toISOString() : null,
        referred_by: referredByCustomerId ?? null,
      })} RETURNING *
    `,
    )!;
    return { success: true as const, customer, alreadyMember: false };
  },

  /** Menerjemahkan kode referral yang diketik pelanggan ke pemiliknya. */
  async resolveReferralCode(
    businessId: string,
    code: string,
  ): Promise<{ customerId: string; name: string | null } | null> {
    if (!code) return null;
    const row = one<{ owner_customer_id: string; name: string | null }>(
      await sql`
      SELECT lc.owner_customer_id, c.name
      FROM loyalty_codes lc
      JOIN customers c ON c.id = lc.owner_customer_id
      WHERE lc.business_id = ${businessId} AND lc.source = 'referral'
        AND lc.code = ${code} AND lc.is_active = TRUE
    `,
    );
    return row ? { customerId: row.owner_customer_id, name: row.name } : null;
  },

  /** Kode referral dicetak malas: baru dibuat saat member pertama kali membuka kartunya. */
  /**
   * Kasir menukarkan kode promo campaign untuk pelanggan yang sedang dilayani.
   * Satu transaksi: validasi kode, catat pemakaian, tulis ledger — supaya
   * kasir yang tidak sengaja dobel klik tidak menghasilkan dua bonus.
   *
   * Penolakan dibedakan alasannya (tidak ditemukan / tidak aktif / kedaluwarsa
   * / sudah dipakai orang ini / sudah mencapai batas pemakaian), karena kasir
   * yang berdiri di depan pelanggan perlu tahu mana yang bisa dia bantu.
   */
  async redeemCode(
    businessId: string,
    code: string,
    customerId: string,
    staffUserId: string,
  ): Promise<
    | { success: true; pointsAwarded: number; campaignName: string }
    | { success: false; error: string }
  > {
    return sql.begin(async (tx) => {
      const codeRow = one<{
        id: string;
        reward_points: number;
        max_uses: number | null;
        valid_until: string | null;
        is_active: boolean;
        campaign_name: string | null;
      }>(
        await tx`
        SELECT lc.id, lc.reward_points, lc.max_uses, lc.valid_until, lc.is_active, camp.name AS campaign_name
        FROM loyalty_codes lc
        LEFT JOIN loyalty_campaigns camp ON camp.id = lc.campaign_id
        WHERE lc.business_id = ${businessId} AND lc.source = 'campaign' AND lc.code = ${code}
        FOR UPDATE OF lc
      `,
      );
      if (!codeRow)
        return { success: false as const, error: "Kode tidak ditemukan." };
      if (!codeRow.is_active)
        return {
          success: false as const,
          error: "Kode ini sudah tidak aktif.",
        };
      if (codeRow.valid_until && new Date(codeRow.valid_until) < new Date()) {
        return {
          success: false as const,
          error: "Kode ini sudah kedaluwarsa.",
        };
      }

      const alreadyUsed = await tx`
        SELECT 1 FROM loyalty_code_uses WHERE code_id = ${codeRow.id} AND customer_id = ${customerId} LIMIT 1
      `;
      if (alreadyUsed.length)
        return {
          success: false as const,
          error: "Pelanggan ini sudah pernah memakai kode ini.",
        };

      if (codeRow.max_uses !== null) {
        const usedCount =
          await tx`SELECT COUNT(*)::int AS n FROM loyalty_code_uses WHERE code_id = ${codeRow.id}`;
        if (num(usedCount[0]?.n) >= codeRow.max_uses) {
          return {
            success: false as const,
            error: "Kode ini sudah mencapai batas pemakaian.",
          };
        }
      }

      await tx`INSERT INTO loyalty_code_uses ${tx({ code_id: codeRow.id, business_id: businessId, customer_id: customerId })}`;

      if (codeRow.reward_points > 0) {
        await tx`
          INSERT INTO point_ledger ${tx({
            business_id: businessId,
            customer_id: customerId,
            delta: codeRow.reward_points,
            reason: "campaign",
            note: `Kode promo ${code}`,
            created_by: staffUserId,
          })}
        `;
      }

      return {
        success: true as const,
        pointsAwarded: codeRow.reward_points,
        campaignName: codeRow.campaign_name ?? "Promo",
      };
    });
  },

  async getOrCreateReferralCode(
    businessId: string,
    customerId: string,
  ): Promise<string> {
    const existing = one<{ code: string }>(
      await sql`
      SELECT code FROM loyalty_codes
      WHERE business_id = ${businessId} AND source = 'referral' AND owner_customer_id = ${customerId}
    `,
    );
    if (existing) return existing.code;

    // Sama seperti createBatchCards: cek-lalu-buat, coba ulang kalau tabrakan.
    let code = generateLoyaltyCode();
    for (let attempt = 0; attempt < 5; attempt++) {
      const clash =
        await sql`SELECT 1 FROM loyalty_codes WHERE business_id = ${businessId} AND code = ${code} LIMIT 1`;
      if (!clash.length) break;
      code = generateLoyaltyCode();
    }

    /**
     * ON CONFLICT menangani permintaan bersamaan: dua request yang sama-sama
     * lolos SELECT di atas hanya akan menghasilkan satu baris, dan yang kalah
     * mendapat nol baris balik. Uniknya ditegakkan indeks parsial
     * uq_loyalty_codes_referral_owner (migrasi 20260902000007) — tanpa itu,
     * ON CONFLICT ini tidak punya apa pun untuk dipegang.
     */
    const inserted = one<{ code: string }>(
      await sql`
      INSERT INTO loyalty_codes ${sql({
        business_id: businessId,
        code,
        source: "referral",
        owner_customer_id: customerId,
      })}
      ON CONFLICT (business_id, owner_customer_id) WHERE source = 'referral' AND owner_customer_id IS NOT NULL
      DO NOTHING
      RETURNING code
    `,
    );
    if (inserted) return inserted.code;

    // Kalah balapan: baris milik request lain sudah ada, pakai kode itu.
    return one<{ code: string }>(
      await sql`
      SELECT code FROM loyalty_codes
      WHERE business_id = ${businessId} AND source = 'referral' AND owner_customer_id = ${customerId}
    `,
    )!.code;
  },

  /**
   * Bonus referral, dicairkan di belanja PERTAMA milik teman yang diajak —
   * bukan saat dia mendaftar. Dipanggil dari dalam earnPointsFromPurchase,
   * satu-satunya titik yang berarti "transaksi belanja sungguhan baru saja
   * tercatat", supaya penambahan poin manual tanpa nominal tidak ikut memicu.
   *
   * Bonus pengajak dibatasi referral_monthly_cap per bulan kalender. Batas
   * ini HANYA memotong bagian pengajak; teman yang baru tetap dapat bonusnya
   * sendiri, dan referral_rewarded_at tetap ditandai supaya baris ini tidak
   * dicoba lagi di transaksi berikutnya.
   */
  async settleReferralOnFirstPurchase(
    businessId: string,
    customerId: string,
    staffUserId: string,
  ): Promise<void> {
    await sql.begin(async (tx) => {
      const referee = one<{
        referred_by: string | null;
        referral_rewarded_at: string | null;
        name: string | null;
      }>(
        await tx`
          SELECT referred_by, referral_rewarded_at, name FROM customers
          WHERE id = ${customerId} AND business_id = ${businessId}
          FOR UPDATE
        `,
      );
      if (!referee?.referred_by || referee.referral_rewarded_at) return;

      const program = one<{
        referral_is_active: boolean;
        referral_referrer_points: number;
        referral_referee_points: number;
        referral_monthly_cap: number;
      }>(
        await tx`
        SELECT referral_is_active, referral_referrer_points, referral_referee_points, referral_monthly_cap
        FROM loyalty_programs WHERE business_id = ${businessId}
      `,
      );
      // Program belum mengaktifkan referral: jangan tandai selesai, supaya
      // kalau owner mengaktifkannya nanti, belanja BERIKUTNYA masih bisa
      // memicu penyelesaian ini.
      if (!program?.referral_is_active) return;

      const referrer = one<{ name: string | null }>(
        await tx`SELECT name FROM customers WHERE id = ${referee.referred_by} AND business_id = ${businessId}`,
      );
      // Pengajak sudah dihapus/dianonimkan. Lewati diam-diam, jangan gagalkan
      // transaksi belanja yang sedang berjalan karena ini.
      if (!referrer) return;

      if (program.referral_referee_points > 0) {
        await tx`
          INSERT INTO point_ledger ${tx({
            business_id: businessId,
            customer_id: customerId,
            delta: program.referral_referee_points,
            reason: "referral",
            note: `Bonus diajak oleh ${referrer.name || "member lain"}`,
            created_by: staffUserId,
          })}
        `;
      }

      if (program.referral_referrer_points > 0) {
        const capRow = one<{ count: number }>(
          await tx`
          SELECT COUNT(*)::int AS count FROM customers
          WHERE business_id = ${businessId} AND referred_by = ${referee.referred_by}
            AND referral_rewarded_at IS NOT NULL
            AND referral_rewarded_at >= date_trunc('month', NOW())
        `,
        );
        if ((capRow?.count ?? 0) < program.referral_monthly_cap) {
          await tx`
            INSERT INTO point_ledger ${tx({
              business_id: businessId,
              customer_id: referee.referred_by,
              delta: program.referral_referrer_points,
              reason: "referral",
              note: `Bonus mengajak ${referee.name || "member baru"} sampai belanja pertama`,
              created_by: staffUserId,
            })}
          `;
        }
      }

      await tx`UPDATE customers SET referral_rewarded_at = NOW() WHERE id = ${customerId}`;
    });
  },

  /** Poin referral yang diterbitkan per pengajak. Sama semangatnya dengan getStaffPointsAudit: bukan mencegah kecurangan, cuma membuatnya terlihat. */
  async getReferralReport(
    businessId: string,
  ): Promise<import("./types").ReferralReportRow[]> {
    return (await sql`
      SELECT
        referrer.id AS customer_id,
        referrer.name,
        referrer.phone,
        lc.code,
        COUNT(referee.id)::int AS referred_count,
        COUNT(referee.id) FILTER (WHERE referee.referral_rewarded_at IS NOT NULL)::int AS rewarded_count,
        COALESCE((
          SELECT SUM(l.delta) FROM point_ledger l
          WHERE l.customer_id = referrer.id AND l.business_id = referrer.business_id AND l.reason = 'referral'
        ), 0)::int AS points_earned
      FROM customers referrer
      LEFT JOIN loyalty_codes lc
        ON lc.owner_customer_id = referrer.id AND lc.source = 'referral' AND lc.business_id = referrer.business_id
      LEFT JOIN customers referee
        ON referee.referred_by = referrer.id AND referee.business_id = referrer.business_id
      WHERE referrer.business_id = ${businessId}
      GROUP BY referrer.id, lc.code
      HAVING COUNT(referee.id) > 0
      ORDER BY referred_count DESC, rewarded_count DESC
      LIMIT 50
    `) as unknown as import("./types").ReferralReportRow[];
  },

  /**
   * Member berulang tahun dalam windowDays hari ke depan, yang sudah setuju
   * promo. Pencocokan bulan/tanggal dilakukan di TS (matchAnnualDate) —
   * bukan di SQL — sama seperti point-expiry.ts menghitung FIFO di TS.
   *
   * Penjaga sekali-per-tahun HANYA melihat status 'sent' — bukan 'opened'.
   * 'opened' cuma berarti owner menekan "Buka WA"; chat-nya bisa saja batal
   * dikirim. Kalau 'opened' ikut menandai sudah ditangani, satu klik yang
   * tidak jadi apa-apa akan menghilangkan member itu dari daftar sampai 300
   * hari berikutnya, dan ucapannya tidak pernah sampai.
   */
  async getBirthdayCandidates(
    businessId: string,
    windowDays: number,
  ): Promise<import("./types").AnnualDateCandidate[]> {
    const rows = await sql`
      SELECT c.id AS customer_id, c.name, c.birthday::text AS birthday
      FROM customers c
      WHERE c.business_id = ${businessId} AND c.birthday IS NOT NULL AND c.marketing_opt_in = TRUE
        AND NOT EXISTS (
          SELECT 1 FROM loyalty_campaign_recipients r
          JOIN loyalty_campaigns camp ON camp.id = r.campaign_id
          WHERE r.customer_id = c.id AND camp.segment = 'birthday'
            AND r.status = 'sent' AND r.created_at >= NOW() - INTERVAL '300 days'
        )
    `;
    const now = new Date();
    return rows
      .map((r) => {
        const match = matchAnnualDate(String(r.birthday), windowDays, now);
        return match
          ? {
              customer_id: String(r.customer_id),
              name: r.name as string | null,
              days_until: match.daysUntil,
              occurs_on: match.occursOn,
            }
          : null;
      })
      .filter((r): r is import("./types").AnnualDateCandidate => r !== null)
      .sort((a, b) => a.days_until - b.days_until);
  },

  /**
   * Anniversary jadi member (customers.created_at), windowDays hari ke depan.
   * Tidak punya bonus poin dan tidak dibatasi saklar aktif — cuma pesan
   * ucapan, jadi selalu tersedia. Member yang baru daftar kurang dari 300
   * hari dikecualikan: hari pendaftarannya sendiri bukan anniversary.
   */
  async getAnniversaryCandidates(
    businessId: string,
    windowDays: number,
  ): Promise<import("./types").AnnualDateCandidate[]> {
    const rows = await sql`
      SELECT c.id AS customer_id, c.name, c.created_at::date::text AS created_at
      FROM customers c
      WHERE c.business_id = ${businessId} AND c.marketing_opt_in = TRUE
        AND c.created_at <= NOW() - INTERVAL '300 days'
        AND NOT EXISTS (
          SELECT 1 FROM loyalty_campaign_recipients r
          JOIN loyalty_campaigns camp ON camp.id = r.campaign_id
          WHERE r.customer_id = c.id AND camp.segment = 'anniversary'
            AND r.status = 'sent' AND r.created_at >= NOW() - INTERVAL '300 days'
        )
    `;
    const now = new Date();
    return rows
      .map((r) => {
        const match = matchAnnualDate(String(r.created_at), windowDays, now);
        return match
          ? {
              customer_id: String(r.customer_id),
              name: r.name as string | null,
              days_until: match.daysUntil,
              occurs_on: match.occursOn,
            }
          : null;
      })
      .filter((r): r is import("./types").AnnualDateCandidate => r !== null)
      .sort((a, b) => a.days_until - b.days_until);
  },

  /**
   * Bonus ulang tahun, dicairkan persis saat owner menandai campaign-nya
   * 'sent' (lihat updateLoyaltyCampaignRecipientStatusAction) — bukan
   * otomatis, dan bukan saat tanggal lahirnya cuma didaftarkan.
   *
   * Penjaga sekali-per-tahun memakai point_ledger, bukan kolom terpisah:
   * kalau owner salah pencet "terkirim" dua kali, poinnya tidak ikut dobel.
   */
  async awardBirthdayBonusIfDue(
    businessId: string,
    customerId: string,
    ownerUserId: string,
  ): Promise<void> {
    const program = one<{
      birthday_is_active: boolean;
      birthday_bonus_points: number;
    }>(
      await sql`
      SELECT birthday_is_active, birthday_bonus_points FROM loyalty_programs WHERE business_id = ${businessId}
    `,
    );
    if (!program?.birthday_is_active || program.birthday_bonus_points <= 0)
      return;

    const recent = await sql`
      SELECT 1 FROM point_ledger
      WHERE business_id = ${businessId} AND customer_id = ${customerId}
        AND reason = 'birthday' AND created_at >= NOW() - INTERVAL '300 days'
      LIMIT 1
    `;
    if (recent.length) return;

    await this.addPointTransaction(
      businessId,
      customerId,
      program.birthday_bonus_points,
      "birthday",
      "Bonus ulang tahun",
      null,
      ownerUserId,
    );
  },

  /**
   * Pelanggan melengkapi tanggal lahirnya sendiri dari kartu member. Sekali
   * terisi tidak bisa ditimpa ulang lewat jalur ini — tanggal lahir adalah
   * fakta tetap, bukan sesuatu yang wajar berubah-ubah, dan mengunci
   * penulisan pertama juga menutup celah "atur ulang tanggal lahir tiap
   * minggu untuk terus muncul di daftar ulang tahun".
   */
  async updateCustomerBirthday(
    token: string,
    birthday: string,
  ): Promise<boolean> {
    const rows = await sql`
      UPDATE customers SET birthday = ${birthday}
      WHERE token = ${token} AND birthday IS NULL
      RETURNING id
    `;
    return rows.length > 0;
  },

  /** Member mengubah persetujuan promo dari kartu member pribadi mereka. */
  async updateCustomerMarketingPreference(
    token: string,
    marketingOptIn: boolean,
  ): Promise<boolean> {
    const rows = await sql`
      UPDATE customers
      SET marketing_opt_in = ${marketingOptIn},
          marketing_opt_in_at = ${marketingOptIn ? new Date().toISOString() : null}
      WHERE token = ${token}
      RETURNING id
    `;
    return rows.length > 0;
  },

  /** Saldo selalu dihitung dari ledger, tidak pernah disimpan sebagai kolom. */
  async getCustomerPointBalance(customerId: string): Promise<number> {
    const r = await sql`
      SELECT COALESCE(SUM(delta), 0)::int AS balance
      FROM point_ledger WHERE customer_id = ${customerId}
    `;
    return num(r[0]?.balance);
  },

  async getCustomerLedger(customerId: string): Promise<PointLedger[]> {
    return (await sql`
      SELECT * FROM point_ledger WHERE customer_id = ${customerId}
      ORDER BY created_at DESC LIMIT 200
    `) as unknown as PointLedger[];
  },

  /**
   * Ledger bersifat tambah-saja. Koreksi ditulis sebagai baris baru dengan
   * delta berlawanan, bukan dengan mengubah atau menghapus baris lama. Tanpa
   * itu, sengketa "poin saya harusnya 340" tidak bisa ditelusuri.
   */
  async addPointTransaction(
    businessId: string,
    customerId: string,
    delta: number,
    reason: PointLedger["reason"],
    note: string,
    amountSpent: number | null,
    staffUserId: string,
    /**
     * Baris ini mewakili satu kedatangan. Default false: koreksi manual,
     * bonus ulang tahun, dan bonus referral menambah saldo tanpa orangnya
     * datang ke toko, dan menghitungnya sebagai kunjungan membuat kartu
     * stempel penuh tanpa pelanggannya pernah belanja.
     */
    isVisit = false,
  ): Promise<PointLedger> {
    return one<PointLedger>(
      await sql`
      INSERT INTO point_ledger ${sql({
        business_id: businessId,
        customer_id: customerId,
        delta,
        reason,
        note,
        amount_spent: amountSpent,
        created_by: staffUserId,
        is_visit: isVisit,
      })} RETURNING *
    `,
    )!;
  },

  async earnPointsFromPurchase(
    businessId: string,
    customerId: string,
    amountSpent: number,
    staffUserId: string,
    orderId?: string,
  ) {
    const program = await this.getLoyaltyProgram(businessId);
    if (!program) return null;
    let earned =
      program.mode === "stamp"
        ? program.stamp_per_visit
        : calculateEarnedPoints(amountSpent, program.earn_rate);

    if (program.rounding_mode === "round" && program.mode === "point") {
      earned = Math.round(amountSpent / program.earn_rate);
    }
    if (amountSpent < num(program.minimum_purchase)) earned = 0;
    if (
      program.max_earn_per_transaction !== null &&
      program.max_earn_per_transaction !== undefined
    ) {
      earned = Math.min(earned, num(program.max_earn_per_transaction));
    }

    /**
     * Pengali level dihitung dari lifetime_spend SEBELUM transaksi ini —
     * level mencerminkan loyalitas yang sudah terbentuk, bukan belanja yang
     * baru saja terjadi. Menghitung dari SESUDAH transaksi ini akan membuat
     * satu belanja besar langsung "naik level dan dapat bonus level itu juga"
     * di transaksi yang sama, dua manfaat dari satu kejadian.
     */
    if (program.tiers_is_active && earned > 0) {
      const [tiers, priorSpend] = await Promise.all([
        this.getLoyaltyTiers(businessId),
        this.getCustomerLifetimeSpend(businessId, customerId),
      ]);
      const tier = resolveTier(priorSpend, tiers);
      if (tier && tier.earn_multiplier > 1) {
        earned = Math.round(earned * tier.earn_multiplier);
      }
    }

    /**
     * Satu kedatangan yang sah.
     *
     * Sengaja diukur dari minimum belanja, BUKAN dari `earned > 0`. Keduanya
     * hampir selalu sama, tapi tidak selalu: mode poin dengan kurs Rp10.000
     * memberi nol poin untuk belanja Rp8.000 walaupun orangnya benar-benar
     * datang. Yang dihitung di sini kedatangannya, bukan hadiahnya.
     */
    const layakKunjungan =
      amountSpent > 0 && amountSpent >= num(program.minimum_purchase);

    const entry = orderId
      ? await sql.begin(async (tx) => {
          const [order] =
            await tx`SELECT * FROM orders WHERE id = ${orderId} AND business_id = ${businessId} AND customer_id = ${customerId} AND payment_status = 'paid' FOR UPDATE`;
          if (!order || order.loyalty_applied_at) return null;
          const ledger =
            earned > 0
              ? one<PointLedger>(
                  await tx`INSERT INTO point_ledger ${tx({
                    business_id: businessId,
                    customer_id: customerId,
                    delta: earned,
                    reason: "purchase",
                    note: "Belanja " + order.order_no,
                    amount_spent: amountSpent,
                    created_by: staffUserId,
                    order_id: orderId,
                    is_visit: layakKunjungan,
                  })} RETURNING *`,
                )
              : null;
          await tx`UPDATE orders SET loyalty_applied_at = NOW() WHERE id = ${orderId}`;
          return ledger;
        })
      : earned > 0
        ? await this.addPointTransaction(
            businessId,
            customerId,
            earned,
            "purchase",
            "Belanja Rp " + amountSpent.toLocaleString("id-ID"),
            amountSpent,
            staffUserId,
            layakKunjungan,
          )
        : null;

    /**
     * Titik sambung referral. Ini SATU-SATUNYA jalur yang berarti "transaksi
     * belanja sungguhan baru saja tercatat" — dipakai bareng oleh POS
     * (createOrderAction) dan tombol tambah poin kasir (addPointsAction).
     * Berjalan terlepas dari `earned`: mode stamp dengan nominal kecil bisa
     * saja menghasilkan 0 poin, tapi tetap transaksi pertama yang sah.
     */
    await this.settleReferralOnFirstPurchase(
      businessId,
      customerId,
      staffUserId,
    );
    return entry;
  },

  // =========================================================================
  // Kartu member
  // =========================================================================

  async getMemberCardSettings(
    businessId: string,
  ): Promise<MemberCardSettings | null> {
    return one<MemberCardSettings>(
      await sql`
      SELECT * FROM member_card_settings WHERE business_id = ${businessId}
    `,
    );
  },

  async saveMemberCardSettings(
    businessId: string,
    data: Omit<MemberCardSettings, "business_id" | "updated_at">,
  ): Promise<MemberCardSettings> {
    return one<MemberCardSettings>(
      await sql`
      INSERT INTO member_card_settings ${sql({ business_id: businessId, ...data })}
      ON CONFLICT (business_id) DO UPDATE SET
        headline = EXCLUDED.headline,
        welcome_text = EXCLUDED.welcome_text,
        opening_hours = EXCLUDED.opening_hours,
        instagram = EXCLUDED.instagram,
        whatsapp = EXCLUDED.whatsapp,
        announcement = EXCLUDED.announcement,
        show_menu = EXCLUDED.show_menu,
        updated_at = NOW()
      RETURNING *
    `,
    )!;
  },

  /**
   * Progres stempel seorang member.
   *
   * `terpakai` dihitung dari penukaran yang sudah terjadi, bukan dari saldo
   * poin. Saldo bisa berubah karena koreksi manual owner atau bonus ulang
   * tahun, dan kalau kartu stempelnya ikut bergerak karena itu, pelanggan
   * melihat stempel bertambah tanpa pernah datang — persis hal yang membuat
   * orang berhenti percaya pada kartu stempel.
   */
  async getStampProgress(businessId: string, customerId: string) {
    const [kunjungan, ditukar] = await Promise.all([
      sql`
        SELECT COUNT(*)::int AS n, MAX(created_at) AS terakhir
        FROM point_ledger
        WHERE business_id = ${businessId} AND customer_id = ${customerId} AND is_visit
      `,
      sql`
        SELECT COALESCE(SUM(r.point_cost), 0)::int AS n
        FROM redemptions d JOIN rewards r ON r.id = d.reward_id
        WHERE d.customer_id = ${customerId} AND d.status <> 'cancelled'
      `,
    ]);
    return {
      totalKunjungan: num(kunjungan[0]?.n),
      kunjunganTerakhir: (kunjungan[0]?.terakhir as string | null) ?? null,
      stempelTerpakai: num(ditukar[0]?.n),
    };
  },

  /** Menu yang layak dipamerkan di kartu member: tersedia dan aktif. */
  async getMenuForMemberCard(businessId: string): Promise<MenuItem[]> {
    return (await sql`
      SELECT * FROM menu_items
      WHERE business_id = ${businessId} AND is_available = TRUE AND price >= 0
      ORDER BY sort_order, name
    `) as unknown as MenuItem[];
  },

  async getRewards(businessId: string): Promise<Reward[]> {
    return (await sql`
      SELECT * FROM rewards WHERE business_id = ${businessId} ORDER BY point_cost
    `) as unknown as Reward[];
  },

  async saveReward(
    businessId: string,
    data: Partial<Reward> & { id?: string },
  ): Promise<Reward> {
    const row = {
      name: data.name!,
      point_cost: data.point_cost!,
      market_value: data.market_value ?? 0,
      stock: data.stock ?? null,
      is_active: data.is_active ?? true,
      image_url: data.image_url ?? null,
    };
    if (data.id) {
      const updated = one<Reward>(
        await sql`
        UPDATE rewards SET ${sql(row)}
        WHERE id = ${data.id} AND business_id = ${businessId} RETURNING *
      `,
      );
      if (updated) return updated;
    }
    return one<Reward>(
      await sql`
      INSERT INTO rewards ${sql({ ...row, business_id: businessId })} RETURNING *
    `,
    )!;
  },

  async deleteReward(id: string, businessId: string): Promise<boolean> {
    const rows = await sql`
      DELETE FROM rewards WHERE id = ${id} AND business_id = ${businessId} RETURNING id
    `;
    return rows.length > 0;
  },

  /**
   * Penukaran memotong poin dan menerbitkan kode dalam satu transaksi, supaya
   * poin tidak pernah terpotong tanpa kode terbit, dan sebaliknya.
   */
  async issueRedemption(
    businessId: string,
    customerId: string,
    rewardId: string,
    staffUserId: string,
  ) {
    return sql.begin(async (tx) => {
      const customer = one<{ id: string }>(
        await tx`
        SELECT id FROM customers WHERE id = ${customerId} AND business_id = ${businessId} FOR UPDATE
      `,
      );
      if (!customer)
        return {
          success: false as const,
          error: "Pelanggan tidak ditemukan pada bisnis ini.",
        };
      const reward = one<Reward>(
        await tx`
        SELECT * FROM rewards WHERE id = ${rewardId} AND business_id = ${businessId} FOR UPDATE
      `,
      );
      if (!reward || !reward.is_active) {
        return { success: false as const, error: "Reward tidak tersedia." };
      }
      if (reward.stock !== null && reward.stock <= 0) {
        return { success: false as const, error: "Stok reward habis." };
      }

      const bal = await tx`
        SELECT COALESCE(SUM(delta), 0)::int AS balance
        FROM point_ledger WHERE customer_id = ${customerId} AND business_id = ${businessId}
      `;
      const balance = num(bal[0]?.balance);
      if (balance < reward.point_cost) {
        return {
          success: false as const,
          error:
            "Poin kurang. Saldo " +
            balance +
            ", butuh " +
            reward.point_cost +
            ".",
        };
      }

      await tx`
        INSERT INTO point_ledger ${tx({
          business_id: businessId,
          customer_id: customerId,
          delta: -reward.point_cost,
          reason: "redeem",
          note: "Tukar reward: " + reward.name,
          created_by: staffUserId,
        })}
      `;

      let redemption: Redemption | null = null;
      for (let attempt = 0; attempt < 5 && !redemption; attempt += 1) {
        redemption = one<Redemption>(
          await tx`
          INSERT INTO redemptions ${tx({
            customer_id: customerId,
            reward_id: rewardId,
            code: generateRedemptionCode(),
            status: "issued",
            redeemed_by: staffUserId,
          })} ON CONFLICT (code) DO NOTHING RETURNING *
        `,
        );
      }
      if (!redemption)
        return {
          success: false as const,
          error: "Kode voucher sedang bentrok. Coba lagi.",
        };

      if (reward.stock !== null) {
        await tx`UPDATE rewards SET stock = stock - 1 WHERE id = ${rewardId}`;
      }
      return { success: true as const, redemption, reward };
    });
  },

  async getRedemptions(customerId: string): Promise<Redemption[]> {
    return (await sql`
      SELECT * FROM redemptions WHERE customer_id = ${customerId} ORDER BY created_at DESC
    `) as unknown as Redemption[];
  },

  /**
   * Hak penghapusan data menurut UU PDP. Nama dan nomor dihapus, baris ledger
   * dibiarkan sebagai anonim supaya laporan lama tidak ikut berubah.
   */
  async anonymizeCustomer(
    customerId: string,
    businessId: string,
  ): Promise<boolean> {
    const rows = await sql`
      UPDATE customers SET
        name = 'Pelanggan dihapus',
        phone = ${"deleted-" + crypto.randomUUID().slice(0, 12)},
        birthday = NULL,
        token = ${generateCustomerToken()}
      WHERE id = ${customerId} AND business_id = ${businessId}
      RETURNING id
    `;
    return rows.length > 0;
  },

  /** Poin yang diterbitkan per kasir. Ini yang membuat kecurangan terlihat. */
  async getStaffPointsAudit(businessId: string) {
    return (await sql`
      SELECT u.id, u.name,
             COALESCE(SUM(CASE WHEN l.delta > 0 THEN l.delta ELSE 0 END), 0)::int AS points_issued,
             COUNT(*) FILTER (WHERE l.reason = 'manual')::int AS manual_count,
             COUNT(l.id)::int AS total_entries
      FROM users u
      LEFT JOIN point_ledger l
        ON l.created_by = u.id AND l.created_at > NOW() - INTERVAL '30 days'
      WHERE u.business_id = ${businessId} AND u.role IN ('staff', 'owner')
      GROUP BY u.id, u.name
      ORDER BY points_issued DESC
    `) as unknown as {
      id: string;
      name: string;
      points_issued: number;
      manual_count: number;
      total_entries: number;
    }[];
  },

  // =========================================================================
  // Finance
  // =========================================================================

  async getIngredients(businessId: string): Promise<Ingredient[]> {
    return (await sql`
      SELECT * FROM ingredients WHERE business_id = ${businessId} ORDER BY name
    `) as unknown as Ingredient[];
  },

  async getFinanceCalculatorPresets(
    businessId: string,
  ): Promise<FinanceCalculatorPreset[]> {
    const rows = await sql`
      SELECT * FROM finance_calculator_presets
      WHERE business_id = ${businessId}
      ORDER BY updated_at DESC, name ASC
    `;
    return rows.map((row) => ({
      ...row,
      direct_cost: num(row.direct_cost),
      supporting_cost: num(row.supporting_cost),
      operational_cost: num(row.operational_cost),
      selling_price: num(row.selling_price),
      discount_pct: num(row.discount_pct),
      payment_fee_pct: num(row.payment_fee_pct),
      channel_fee_pct: num(row.channel_fee_pct),
      tax_reserve_pct: num(row.tax_reserve_pct),
      target_margin_pct: num(row.target_margin_pct),
      monthly_fixed_cost: num(row.monthly_fixed_cost),
      monthly_profit_target: num(row.monthly_profit_target),
    })) as unknown as FinanceCalculatorPreset[];
  },

  async saveFinanceCalculatorPreset(
    businessId: string,
    data: Omit<
      FinanceCalculatorPreset,
      "id" | "business_id" | "created_at" | "updated_at"
    > & { id?: string },
  ): Promise<FinanceCalculatorPreset> {
    const row = {
      name: data.name,
      mode: data.mode,
      direct_cost: data.direct_cost,
      supporting_cost: data.supporting_cost,
      operational_cost: data.operational_cost,
      selling_price: data.selling_price,
      discount_pct: data.discount_pct,
      payment_fee_pct: data.payment_fee_pct,
      channel_fee_pct: data.channel_fee_pct,
      tax_reserve_pct: data.tax_reserve_pct,
      target_margin_pct: data.target_margin_pct,
      monthly_fixed_cost: data.monthly_fixed_cost,
      monthly_profit_target: data.monthly_profit_target,
      updated_at: new Date().toISOString(),
    };
    if (data.id) {
      const updated = one<FinanceCalculatorPreset>(
        await sql`
        UPDATE finance_calculator_presets SET ${sql(row)}
        WHERE id = ${data.id} AND business_id = ${businessId} RETURNING *
      `,
      );
      if (updated) return updated;
    }
    return one<FinanceCalculatorPreset>(
      await sql`
      INSERT INTO finance_calculator_presets ${sql({ ...row, business_id: businessId })} RETURNING *
    `,
    )!;
  },

  async deleteFinanceCalculatorPreset(
    id: string,
    businessId: string,
  ): Promise<boolean> {
    const rows = await sql`
      DELETE FROM finance_calculator_presets WHERE id = ${id} AND business_id = ${businessId} RETURNING id
    `;
    return rows.length > 0;
  },

  async getIngredientsMap(
    businessId: string,
  ): Promise<Map<string, IngredientItem>> {
    const rows = await this.getIngredients(businessId);
    return new Map(
      rows.map((i) => [
        i.id,
        {
          id: i.id,
          name: i.name,
          pack_price: num(i.pack_price),
          pack_size: num(i.pack_size),
          base_unit: i.base_unit,
        },
      ]),
    );
  },

  async createIngredient(
    businessId: string,
    name: string,
    packPrice: number,
    packSize: number,
    baseUnit: "gr" | "ml" | "pcs",
    metadata: Pick<
      Ingredient,
      "category" | "brand" | "supplier_name" | "notes"
    > = {},
  ): Promise<Ingredient> {
    return one<Ingredient>(
      await sql`
      INSERT INTO ingredients ${sql({
        business_id: businessId,
        name,
        pack_price: packPrice,
        pack_size: packSize,
        base_unit: baseUnit,
        ...metadata,
      })} RETURNING *
    `,
    )!;
  },

  /**
   * Mengubah harga bahan sekaligus menulis riwayatnya. Ini yang menjawab
   * "kenapa HPP saya naik?", dan yang membuat modul ini punya nilai berulang
   * alih-alih jadi kalkulator sekali pakai.
   */
  async updateIngredientPrice(
    id: string,
    businessId: string,
    newPackPrice: number,
  ) {
    return sql.begin(async (tx) => {
      const ing = one<Ingredient>(
        await tx`
        SELECT * FROM ingredients WHERE id = ${id} AND business_id = ${businessId} FOR UPDATE
      `,
      );
      if (!ing) return null;

      await tx`
        INSERT INTO ingredient_price_history ${tx({
          ingredient_id: id,
          pack_price: num(ing.pack_price),
        })}
      `;
      return one<Ingredient>(
        await tx`
        UPDATE ingredients SET pack_price = ${newPackPrice}, updated_at = NOW()
        WHERE id = ${id} RETURNING *
      `,
      );
    });
  },

  /**
   * Riwayat harga beli satu bahan.
   *
   * businessId WAJIB. Versi sebelumnya menyaring hanya dengan ingredient_id,
   * sehingga pemilik usaha mana pun yang tahu UUID sebuah bahan bisa membaca
   * riwayat harga beli usaha lain. Itu justru data paling sensitif untuk
   * pesaing: berapa mereka menebus bahan bakunya.
   */
  async getIngredientPriceHistory(
    ingredientId: string,
    businessId: string,
  ): Promise<IngredientPriceHistory[]> {
    return (await sql`
      SELECT h.* FROM ingredient_price_history h
      JOIN ingredients i ON i.id = h.ingredient_id
      WHERE h.ingredient_id = ${ingredientId} AND i.business_id = ${businessId}
      ORDER BY h.changed_at DESC LIMIT 50
    `) as unknown as IngredientPriceHistory[];
  },

  async getRecipes(businessId: string): Promise<Recipe[]> {
    const recipes = (await sql`
      SELECT * FROM recipes WHERE business_id = ${businessId} ORDER BY name
    `) as unknown as Recipe[];
    if (!recipes.length) return [];

    const ids = recipes.map((r) => r.id);
    const ing =
      await sql`SELECT * FROM recipe_ingredients WHERE recipe_id = ANY(${ids})`;
    const pack =
      await sql`SELECT * FROM recipe_packaging WHERE recipe_id = ANY(${ids})`;

    return recipes.map((r) => ({
      ...r,
      ingredients: ing
        .filter((x) => x.recipe_id === r.id)
        .map((x) => ({
          ingredient_id: x.ingredient_id as string,
          qty: num(x.qty),
        })),
      packaging: pack
        .filter((x) => x.recipe_id === r.id)
        .map((x) => ({ name: x.name as string, cost: num(x.cost) })),
    }));
  },

  async getAllRecipesWithCalculations(businessId: string) {
    const [recipes, map] = await Promise.all([
      this.getRecipes(businessId),
      this.getIngredientsMap(businessId),
    ]);
    return recipes.map((r) => ({
      recipe: r,
      calc: calculateRecipeHpp(
        {
          type: r.type,
          ingredients: r.ingredients ?? [],
          packaging: r.packaging ?? [],
          output_qty: num(r.output_qty),
          operational_cost: num(r.operational_cost),
          selling_price: num(r.selling_price),
          target_margin_pct: num(r.target_margin_pct),
        },
        map,
      ) as RecipeHppResult,
    }));
  },

  async deleteRecipe(id: string, businessId: string): Promise<boolean> {
    const rows = await sql`
      DELETE FROM recipes WHERE id = ${id} AND business_id = ${businessId} RETURNING id
    `;
    return rows.length > 0;
  },

  async lookupRedemptionByCode(businessId: string, code: string) {
    return one<{
      id: string;
      code: string;
      status: Redemption["status"];
      reward_name: string;
      customer_name: string | null;
      created_at: string;
      used_at: string | null;
      used_by_name: string | null;
    }>(
      await sql`
      SELECT r.id, r.code, r.status, r.created_at, r.used_at,
        rw.name AS reward_name, c.name AS customer_name, u.name AS used_by_name
      FROM redemptions r
      JOIN customers c ON c.id = r.customer_id AND c.business_id = ${businessId}
      JOIN rewards rw ON rw.id = r.reward_id AND rw.business_id = ${businessId}
      LEFT JOIN users u ON u.id = r.used_by
      WHERE r.code = ${code}
    `,
    );
  },

  /** Mengubah voucher issued menjadi used sambil mengunci barisnya. */
  async consumeRedemption(
    businessId: string,
    code: string,
    staffUserId: string,
  ) {
    return sql.begin(async (tx) => {
      const voucher = one<{
        id: string;
        status: Redemption["status"];
        reward_name: string;
        customer_name: string | null;
        used_at: string | null;
      }>(
        await tx`
        SELECT r.id, r.status, r.used_at, rw.name AS reward_name, c.name AS customer_name
        FROM redemptions r
        JOIN customers c ON c.id = r.customer_id AND c.business_id = ${businessId}
        JOIN rewards rw ON rw.id = r.reward_id AND rw.business_id = ${businessId}
        WHERE r.code = ${code}
        FOR UPDATE OF r
      `,
      );
      if (!voucher)
        return {
          success: false as const,
          error: "Voucher tidak ditemukan di toko ini.",
        };
      if (voucher.status !== "issued") {
        return {
          success: false as const,
          error:
            voucher.status === "used"
              ? "Voucher ini sudah dipakai."
              : "Voucher ini sudah tidak berlaku.",
        };
      }
      await tx`
        UPDATE redemptions SET status = 'used', used_at = NOW(), used_by = ${staffUserId}
        WHERE id = ${voucher.id} AND status = 'issued'
      `;
      return { success: true as const, voucher };
    });
  },

  // =========================================================================
  // Finance Operations: cash, pockets, assets, inventory
  // =========================================================================

  async getFinancePockets(businessId: string): Promise<FinancePocket[]> {
    return (await sql`SELECT * FROM finance_pockets WHERE business_id = ${businessId} ORDER BY created_at`) as unknown as FinancePocket[];
  },

  async saveFinancePocket(
    businessId: string,
    data: { id?: string; name: string; allocation_pct: number },
  ): Promise<FinancePocket | null> {
    const row = { name: data.name, allocation_pct: data.allocation_pct };
    if (data.id)
      return one<FinancePocket>(
        await sql`UPDATE finance_pockets SET ${sql(row)} WHERE id = ${data.id} AND business_id = ${businessId} RETURNING *`,
      );
    return one<FinancePocket>(
      await sql`INSERT INTO finance_pockets ${sql({ ...row, business_id: businessId })} RETURNING *`,
    );
  },

  async deleteFinancePocket(id: string, businessId: string): Promise<boolean> {
    return (
      (
        await sql`DELETE FROM finance_pockets WHERE id = ${id} AND business_id = ${businessId} RETURNING id`
      ).length > 0
    );
  },

  async getFinanceTransactions(
    businessId: string,
    limit = 100,
  ): Promise<FinanceTransaction[]> {
    return (await sql`SELECT * FROM finance_transactions WHERE business_id = ${businessId} ORDER BY occurred_on DESC, created_at DESC LIMIT ${limit}`) as unknown as FinanceTransaction[];
  },

  async createFinanceTransaction(
    businessId: string,
    userId: string,
    data: Omit<
      FinanceTransaction,
      "id" | "business_id" | "created_at" | "created_by" | "source"
    > & { source?: FinanceTransaction["source"] },
  ): Promise<FinanceTransaction> {
    return one<FinanceTransaction>(
      await sql`INSERT INTO finance_transactions ${sql({ ...data, business_id: businessId, created_by: userId, source: data.source ?? "manual" })} RETURNING *`,
    )!;
  },

  async getFinanceAssets(businessId: string): Promise<FinanceAsset[]> {
    return (await sql`SELECT * FROM finance_assets WHERE business_id = ${businessId} ORDER BY is_active DESC, acquired_on DESC`) as unknown as FinanceAsset[];
  },

  async saveFinanceAsset(
    businessId: string,
    data: Omit<FinanceAsset, "id" | "business_id" | "created_at"> & {
      id?: string;
    },
  ): Promise<FinanceAsset | null> {
    const row = {
      name: data.name,
      category: data.category,
      acquired_on: data.acquired_on,
      purchase_cost: data.purchase_cost,
      salvage_value: data.salvage_value,
      useful_life_months: data.useful_life_months,
      is_active: data.is_active,
    };
    if (data.id)
      return one<FinanceAsset>(
        await sql`UPDATE finance_assets SET ${sql(row)} WHERE id = ${data.id} AND business_id = ${businessId} RETURNING *`,
      );
    return one<FinanceAsset>(
      await sql`INSERT INTO finance_assets ${sql({ ...row, business_id: businessId })} RETURNING *`,
    );
  },

  async getInventoryItems(businessId: string): Promise<InventoryItem[]> {
    return (await sql`SELECT * FROM inventory_items WHERE business_id = ${businessId} ORDER BY name`) as unknown as InventoryItem[];
  },

  async saveInventoryItem(
    businessId: string,
    data: Omit<
      InventoryItem,
      | "id"
      | "business_id"
      | "created_at"
      | "updated_at"
      | "stock_qty"
      | "average_cost"
    > & { id?: string },
  ): Promise<InventoryItem | null> {
    const row = {
      sku: data.sku || null,
      name: data.name,
      unit: data.unit,
      reorder_level: data.reorder_level,
    };
    if (data.id)
      return one<InventoryItem>(
        await sql`UPDATE inventory_items SET ${sql({ ...row, updated_at: new Date().toISOString() })} WHERE id = ${data.id} AND business_id = ${businessId} RETURNING *`,
      );
    return one<InventoryItem>(
      await sql`INSERT INTO inventory_items ${sql({ ...row, business_id: businessId })} RETURNING *`,
    );
  },

  async recordInventoryPurchase(
    businessId: string,
    userId: string,
    data: {
      supplier_name?: string;
      purchased_on: string;
      note?: string;
      items: { inventory_item_id: string; qty: number; unit_cost: number }[];
    },
  ): Promise<boolean> {
    return sql.begin(async (tx) => {
      const ids = data.items.map((item) => item.inventory_item_id);
      const owned =
        await tx`SELECT id FROM inventory_items WHERE business_id = ${businessId} AND id = ANY(${ids}::uuid[]) FOR UPDATE`;
      if (owned.length !== ids.length) return false;
      const total = data.items.reduce(
        (sum, item) => sum + item.qty * item.unit_cost,
        0,
      );
      const purchase = one<{ id: string }>(
        await tx`INSERT INTO inventory_purchases ${tx({ business_id: businessId, supplier_name: data.supplier_name || null, purchased_on: data.purchased_on, note: data.note || null, total_amount: total, created_by: userId })} RETURNING id`,
      )!;
      if (!purchase) return false;
      for (const item of data.items) {
        await tx`INSERT INTO inventory_purchase_items ${tx({ purchase_id: purchase.id, inventory_item_id: item.inventory_item_id, qty: item.qty, unit_cost: item.unit_cost })}`;
        await tx`
          UPDATE inventory_items SET
            average_cost = CASE WHEN stock_qty + ${item.qty} = 0 THEN 0 ELSE ROUND(((stock_qty * average_cost) + (${item.qty} * ${item.unit_cost})) / (stock_qty + ${item.qty})) END,
            stock_qty = stock_qty + ${item.qty}, updated_at = NOW()
          WHERE id = ${item.inventory_item_id} AND business_id = ${businessId}
        `;
      }
      await tx`INSERT INTO finance_transactions ${tx({ business_id: businessId, type: "expense", category: "Belanja stok", amount: total, occurred_on: data.purchased_on, note: data.supplier_name ? `Belanja dari ${data.supplier_name}` : "Belanja stok", source: "inventory", created_by: userId })}`;
      return true;
    });
  },

  async adjustInventoryStock(
    businessId: string,
    userId: string,
    inventoryItemId: string,
    deltaQty: number,
    reason: string,
  ): Promise<boolean> {
    return sql.begin(async (tx) => {
      const item = one<{ stock_qty: number }>(
        await tx`SELECT stock_qty FROM inventory_items WHERE id = ${inventoryItemId} AND business_id = ${businessId} FOR UPDATE`,
      );
      if (!item || num(item.stock_qty) + deltaQty < 0) return false;
      await tx`UPDATE inventory_items SET stock_qty = stock_qty + ${deltaQty}, updated_at = NOW() WHERE id = ${inventoryItemId}`;
      await tx`INSERT INTO inventory_adjustments ${tx({ business_id: businessId, inventory_item_id: inventoryItemId, delta_qty: deltaQty, reason, created_by: userId })}`;
      return true;
    });
  },

  async getFinanceSummary(businessId: string): Promise<FinanceSummary> {
    const [cash, pos, assets, soldItems] = await Promise.all([
      sql`SELECT COALESCE(SUM(amount) FILTER (WHERE type = 'income'), 0)::bigint AS income, COALESCE(SUM(amount) FILTER (WHERE type = 'expense'), 0)::bigint AS expenses, COALESCE(SUM(amount) FILTER (WHERE type = 'expense' AND source <> 'inventory'), 0)::bigint AS operating_expenses, COALESCE(SUM(amount) FILTER (WHERE type = 'expense' AND category IN ('Sewa', 'Gaji', 'Internet', 'Listrik', 'Langganan')), 0)::bigint AS fixed_costs FROM finance_transactions WHERE business_id = ${businessId} AND date_trunc('month', occurred_on) = date_trunc('month', CURRENT_DATE)`,
      sql`WITH refunded AS (SELECT order_id, SUM(amount) AS total FROM refunds GROUP BY order_id) SELECT COALESCE(SUM(o.total - COALESCE(r.total, 0)), 0)::bigint AS revenue FROM orders o LEFT JOIN refunded r ON r.order_id = o.id WHERE o.business_id = ${businessId} AND o.status = 'paid' AND date_trunc('month', o.created_at) = date_trunc('month', NOW())`,
      sql`SELECT COALESCE(SUM((purchase_cost - salvage_value)::numeric / useful_life_months), 0)::bigint AS depreciation FROM finance_assets WHERE business_id = ${businessId} AND is_active = TRUE`,
      sql`WITH refunded AS (SELECT order_id, SUM(amount) AS total FROM refunds GROUP BY order_id) SELECT i.menu_item_id, COALESCE(SUM(i.qty * GREATEST(o.total - COALESCE(r.total, 0), 0)::numeric / NULLIF(o.total, 0)), 0) AS qty, COALESCE(SUM(i.subtotal * GREATEST(o.total - COALESCE(r.total, 0), 0)::numeric / NULLIF(o.total, 0)), 0) AS revenue FROM order_items i JOIN orders o ON o.id = i.order_id LEFT JOIN refunded r ON r.order_id = o.id WHERE o.business_id = ${businessId} AND i.cancelled_at IS NULL AND o.status = 'paid' AND date_trunc('month', o.created_at) = date_trunc('month', NOW()) GROUP BY i.menu_item_id`,
    ]);
    const menuItems = await this.getMenuItems(businessId);
    const recipeByMenu = new Map(
      menuItems
        .filter((item) => item.recipe_id)
        .map((item) => [item.id, item.recipe_id as string]),
    );
    const calcs = await this.getAllRecipesWithCalculations(businessId);
    const hppByRecipe = new Map(
      calcs.map((item) => [item.recipe.id, item.calc.hpp_per_unit]),
    );
    let estimatedCogs = 0;
    let hppCoverageRevenue = 0;
    for (const sold of soldItems) {
      const hpp =
        hppByRecipe.get(recipeByMenu.get(String(sold.menu_item_id)) ?? "") ?? 0;
      if (hpp > 0) {
        estimatedCogs += hpp * num(sold.qty);
        hppCoverageRevenue += num(sold.revenue);
      }
    }
    const income = num(cash[0]?.income);
    const expenses = num(cash[0]?.expenses);
    const operatingExpenses = num(cash[0]?.operating_expenses);
    const posRevenue = num(pos[0]?.revenue);
    const depreciation = num(assets[0]?.depreciation);
    const fixedCosts = num(cash[0]?.fixed_costs);
    const grossProfit = posRevenue - estimatedCogs;
    const netProfit = grossProfit + income - operatingExpenses - depreciation;
    return {
      income,
      expenses,
      operatingExpenses,
      posRevenue,
      estimatedCogs,
      hppCoverageRevenue,
      grossProfit,
      depreciation,
      netProfit,
      fixedCosts,
      breakEvenRevenue: fixedCosts + depreciation,
    };
  },

  async saveRecipe(
    businessId: string,
    data: Partial<Recipe> & {
      id?: string;
      ingredients?: { ingredient_id: string; qty: number }[];
      packaging?: { name: string; cost: number }[];
    },
  ): Promise<Recipe> {
    return sql.begin(async (tx) => {
      const row = {
        name: data.name!,
        type: data.type ?? "olahan",
        category: data.category ?? null,
        output_qty: data.output_qty ?? 1,
        operational_cost: data.operational_cost ?? 0,
        selling_price: data.selling_price ?? 0,
        target_margin_pct: data.target_margin_pct ?? 0,
        updated_at: new Date().toISOString(),
      };

      let recipe: Recipe | null = null;
      if (data.id) {
        recipe = one<Recipe>(
          await tx`
          UPDATE recipes SET ${tx(row)}
          WHERE id = ${data.id} AND business_id = ${businessId} RETURNING *
        `,
        );
      }
      if (!recipe) {
        recipe = one<Recipe>(
          await tx`
          INSERT INTO recipes ${tx({ ...row, business_id: businessId })} RETURNING *
        `,
        )!;
      }

      await tx`DELETE FROM recipe_ingredients WHERE recipe_id = ${recipe.id}`;
      await tx`DELETE FROM recipe_packaging WHERE recipe_id = ${recipe.id}`;

      for (const i of data.ingredients ?? []) {
        await tx`INSERT INTO recipe_ingredients ${tx({
          recipe_id: recipe.id,
          ingredient_id: i.ingredient_id,
          qty: i.qty,
        })}`;
      }
      for (const p of data.packaging ?? []) {
        await tx`INSERT INTO recipe_packaging ${tx({
          recipe_id: recipe.id,
          name: p.name,
          cost: p.cost,
        })}`;
      }
      return {
        ...recipe,
        ingredients: data.ingredients ?? [],
        packaging: data.packaging ?? [],
      };
    });
  },

  // =========================================================================
  // POS dan Ordering
  // =========================================================================

  async getCategories(businessId: string): Promise<Category[]> {
    return (await sql`
      SELECT * FROM categories WHERE business_id = ${businessId} ORDER BY sort_order, name
    `) as unknown as Category[];
  },

  async getMenuItems(businessId: string): Promise<MenuItem[]> {
    const rows = await sql`
      SELECT * FROM menu_items WHERE business_id = ${businessId} ORDER BY sort_order, name
    `;
    return rows.map((r: any) => ({
      ...r,
      price: Number(r.price) || 0,
      cost_price: Number(r.cost_price) || 0,
      sort_order: Number(r.sort_order) || 0,
    })) as unknown as MenuItem[];
  },

  async updateMenuItemAvailability(
    id: string,
    businessId: string,
    isAvailable: boolean,
  ) {
    const rows = await sql`
      UPDATE menu_items SET is_available = ${isAvailable}, updated_at = NOW()
      WHERE id = ${id} AND business_id = ${businessId} RETURNING id
    `;
    return rows.length > 0;
  },

  /**
   * Menyimpan satu menu, membuat baru atau memperbarui yang sudah ada.
   *
   * UPDATE-nya menyaring business_id, bukan cuma id. Tanpa itu, id menu milik
   * toko lain yang dikirim dari layar akan ikut terubah — dan id menu bukan
   * rahasia, dia muncul di halaman pesan yang terbuka untuk umum.
   */
  async saveMenuItem(
    businessId: string,
    data: Partial<MenuItem> & { id?: string },
  ): Promise<MenuItem | null> {
    const row = {
      category_id: data.category_id || null,
      name: data.name!,
      price: data.price ?? 0,
      cost_price: data.cost_price ?? 0,
      description: data.description ?? null,
      photo_url: data.photo_url ?? null,
      is_available: data.is_available ?? true,
      recipe_id: data.recipe_id || null,
      sort_order: data.sort_order ?? 0,
    };

    if (data.id) {
      return one<MenuItem>(
        await sql`
        UPDATE menu_items SET ${sql(row)}, updated_at = NOW()
        WHERE id = ${data.id} AND business_id = ${businessId} RETURNING *
      `,
      );
    }
    return one<MenuItem>(
      await sql`
      INSERT INTO menu_items ${sql({ ...row, business_id: businessId })} RETURNING *
    `,
    );
  },

  /**
   * Menu yang pernah terjual TIDAK dihapus, cuma disembunyikan.
   *
   * order_items menyimpan nama dan harga sebagai snapshot, jadi struk lama
   * tetap terbaca. Tapi menu_item_id-nya masih menunjuk ke sini, dan laporan
   * per menu ikut hilang begitu barisnya lenyap. Yang sudah punya riwayat
   * karena itu dinonaktifkan; yang belum pernah dipesan boleh benar-benar
   * hilang, supaya salah ketik tidak menumpuk selamanya di daftar.
   */
  async deleteMenuItem(
    id: string,
    businessId: string,
  ): Promise<"deleted" | "hidden" | "not_found"> {
    return sql.begin(async (tx) => {
      const menu = one<{ id: string }>(
        await tx`
        SELECT id FROM menu_items WHERE id = ${id} AND business_id = ${businessId}
      `,
      );
      if (!menu) return "not_found" as const;

      const terpakai =
        await tx`SELECT 1 FROM order_items WHERE menu_item_id = ${id} LIMIT 1`;
      if (terpakai.length) {
        await tx`UPDATE menu_items SET is_available = FALSE, updated_at = NOW() WHERE id = ${id}`;
        return "hidden" as const;
      }
      await tx`DELETE FROM menu_items WHERE id = ${id} AND business_id = ${businessId}`;
      return "deleted" as const;
    });
  },

  /**
   * Menyimpan satu gambar unggahan dan mengembalikan id-nya.
   *
   * Barisnya tidak pernah diperbarui. Mengganti gambar menu berarti menyimpan
   * baris baru dan menulis alamat baru ke menu_items — itulah yang membuat
   * /api/gambar/[id] boleh mengirim header cache "immutable" tanpa risiko
   * pelanggan melihat gambar lama selamanya.
   */
  async saveUploadedImage(
    businessId: string,
    data: {
      mime: string;
      bytes: Buffer;
      width: number | null;
      height: number | null;
    },
  ): Promise<string> {
    const row = one<{ id: string }>(
      await sql`
      INSERT INTO uploaded_images ${sql({
        business_id: businessId,
        mime: data.mime,
        bytes: data.bytes,
        byte_size: data.bytes.byteLength,
        width: data.width,
        height: data.height,
      })} RETURNING id
    `,
    );
    return row!.id;
  },

  /**
   * Satu gambar untuk disajikan. TIDAK menyaring business_id: gambar menu
   * tampil di halaman pesan yang memang terbuka untuk umum, dan id-nya UUID
   * acak yang tidak bisa ditebak berurutan.
   */
  async getUploadedImage(id: string) {
    return one<{ mime: string; bytes: Buffer }>(
      await sql`
      SELECT mime, bytes FROM uploaded_images WHERE id = ${id}
    `,
    );
  },

  async saveCategory(
    businessId: string,
    data: { id?: string; name: string; sort_order?: number },
  ): Promise<Category | null> {
    if (data.id) {
      return one<Category>(
        await sql`
        UPDATE categories SET name = ${data.name}, sort_order = ${data.sort_order ?? 0}
        WHERE id = ${data.id} AND business_id = ${businessId} RETURNING *
      `,
      );
    }
    return one<Category>(
      await sql`
      INSERT INTO categories ${sql({
        business_id: businessId,
        name: data.name,
        sort_order: data.sort_order ?? 0,
      })} RETURNING *
    `,
    );
  },

  /** Kategori yang masih dipakai menu tidak boleh hilang begitu saja. */
  async deleteCategory(id: string, businessId: string): Promise<boolean> {
    const dipakai = await sql`
      SELECT 1 FROM menu_items WHERE category_id = ${id} AND business_id = ${businessId} LIMIT 1
    `;
    if (dipakai.length) return false;
    const rows = await sql`
      DELETE FROM categories WHERE id = ${id} AND business_id = ${businessId} RETURNING id
    `;
    return rows.length > 0;
  },

  async getActiveShift(businessId: string): Promise<Shift | null> {
    return one<Shift>(
      await sql`
      SELECT * FROM shifts WHERE business_id = ${businessId} AND closed_at IS NULL
      ORDER BY opened_at DESC LIMIT 1
    `,
    );
  },

  /**
   * Riwayat shift beserta siapa yang menjaganya dan apa yang terjadi selama itu.
   *
   * Tabel shifts sendiri cuma menyimpan uang laci: modal awal, hitungan akhir,
   * dan selisihnya. Itu menjawab "cocok atau tidak", tapi tidak menjawab
   * "punya siapa" dan "seberapa sibuk" — dua pertanyaan pertama yang diajukan
   * pemilik ketika selisihnya tidak nol.
   *
   * Penjualan dijumlahkan per shift lewat orders.shift_id, dan refund
   * dikurangkan lewat refunds.shift_id. Refund SENGAJA dihitung dari shift
   * tempat uangnya benar-benar keluar dari laci, bukan dari shift tempat
   * pesanannya dibuat: yang harus cocok dengan hitungan laci sore ini adalah
   * uang yang keluar sore ini, termasuk kalau yang direfund pesanan kemarin.
   */
  async getShifts(businessId: string): Promise<ShiftReport[]> {
    return (await sql`
      SELECT s.*,
        COALESCE(NULLIF(TRIM(u.name), ''), 'Kasir') AS staff_name,
        COALESCE(o.orders_count, 0)::int AS orders_count,
        COALESCE(o.cash_sales, 0) - COALESCE(r.cash_refunds, 0) AS cash_sales,
        COALESCE(o.total_sales, 0) - COALESCE(r.total_refunds, 0) AS total_sales
      FROM shifts s
      LEFT JOIN users u ON u.id = s.opened_by
      LEFT JOIN (
        SELECT shift_id,
          COUNT(*)::int AS orders_count,
          SUM(total) FILTER (WHERE payment_method = 'cash') AS cash_sales,
          SUM(total) AS total_sales
        FROM orders WHERE business_id = ${businessId} AND status = 'paid' AND shift_id IS NOT NULL
        GROUP BY shift_id
      ) o ON o.shift_id = s.id
      LEFT JOIN (
        SELECT rf.shift_id,
          -- Yang menentukan uang keluar dari LACI adalah metode REFUND-nya,
          -- bukan cara pelanggan dulu membayar. Sebelum ini disaring dengan
          -- ord.payment_method, jadi pelanggan yang bayar QRIS lalu dikembalikan
          -- tunai tidak pernah terhitung — dan selisihnya baru muncul saat kasir
          -- menghitung laci, tanpa ada baris yang menjelaskannya.
          SUM(rf.amount) FILTER (WHERE rf.method = 'cash') AS cash_refunds,
          SUM(rf.amount) AS total_refunds
        FROM refunds rf JOIN orders ord ON ord.id = rf.order_id
        WHERE ord.business_id = ${businessId} AND rf.shift_id IS NOT NULL
        GROUP BY rf.shift_id
      ) r ON r.shift_id = s.id
      WHERE s.business_id = ${businessId}
      ORDER BY s.opened_at DESC LIMIT 60
    `) as unknown as ShiftReport[];
  },

  /** Jadwal POS bersifat opt-in agar tenant lama tidak mendadak terkunci. */
  async canOpenPosShift(businessId: string, userId: string): Promise<boolean> {
    const rows = await sql`
      SELECT b.pos_require_scheduled_shift, u.role,
        EXISTS (
          SELECT 1 FROM staff_work_schedules s
          WHERE s.business_id = b.id AND s.user_id = ${userId}
            AND s.pos_shift_allowed = TRUE AND s.status = 'scheduled'
            AND NOW() >= s.starts_at AND NOW() < s.ends_at
        ) AS has_assignment
      FROM businesses b JOIN users u ON u.id = ${userId} AND u.business_id = b.id
      WHERE b.id = ${businessId}
    `;
    const row = rows[0] as
      | {
          pos_require_scheduled_shift?: boolean;
          role?: string;
          has_assignment?: boolean;
        }
      | undefined;
    return Boolean(
      row &&
        (row.role === "owner" ||
          !row.pos_require_scheduled_shift ||
          row.has_assignment),
    );
  },

  async openShift(
    businessId: string,
    staffUserId: string,
    openingCash: number,
    notes?: string,
  ) {
    const active = await this.getActiveShift(businessId);
    if (active)
      return {
        success: false as const,
        error: "Masih ada shift yang belum ditutup.",
      };
    if (!(await this.canOpenPosShift(businessId, staffUserId))) {
      return {
        success: false as const,
        error: "Kamu belum dijadwalkan membuka shift pada jam ini.",
      };
    }
    const shift = one<Shift>(
      await sql`
      INSERT INTO shifts ${sql({
        business_id: businessId,
        opened_by: staffUserId,
        opening_cash: openingCash,
        notes: notes ?? null,
      })} RETURNING *
    `,
    )!;
    return { success: true as const, shift };
  },

  /**
   * Menutup shift menghitung selisih laci: uang fisik dibanding modal awal
   * ditambah seluruh penjualan tunai pada shift itu. Tanpa ini tidak ada cara
   * mencocokkan isi laci dengan catatan sistem.
   */
  async closeShift(
    shiftId: string,
    businessId: string,
    physicalClosingCash: number,
    notes?: string,
  ) {
    return sql.begin(async (tx) => {
      const shift = one<Shift>(
        await tx`
        SELECT * FROM shifts WHERE id = ${shiftId} AND business_id = ${businessId} FOR UPDATE
      `,
      );
      if (!shift || shift.closed_at) return null;

      const cash = await tx`
        SELECT
          COALESCE((SELECT SUM(o.total) FROM orders o WHERE o.business_id = ${businessId}
            AND o.shift_id = ${shiftId} AND o.payment_method = 'cash' AND o.status = 'paid'), 0) AS cash_sales,
          COALESCE((SELECT SUM(r.amount) FROM refunds r JOIN orders o ON o.id = r.order_id
            WHERE o.business_id = ${businessId} AND r.shift_id = ${shiftId} AND o.payment_method = 'cash'), 0) AS cash_refunds
      `;
      const recon = calculateShiftReconciliation(
        num(shift.opening_cash),
        num(cash[0]?.cash_sales) - num(cash[0]?.cash_refunds),
        physicalClosingCash,
      );

      return one<Shift>(
        await tx`
        UPDATE shifts SET
          closed_at = NOW(),
          closing_cash = ${physicalClosingCash},
          expected_cash = ${recon.expectedCash},
          variance = ${recon.variance},
          notes = ${notes ?? shift.notes ?? null}
        WHERE id = ${shiftId} RETURNING *
      `,
      );
    });
  },

  /**
   * Membuat transaksi. Semua nilai uang disimpan sebagai hasil jadi, bukan
   * dihitung ulang saat ditampilkan: kalau tarif pajak berubah bulan depan,
   * struk bulan lalu harus tetap menunjukkan angka yang dulu dibayar.
   *
   * Nama dan harga item ikut disalin ke order_items dengan alasan yang sama.
   */
  async createOrder(
    businessId: string,
    orderData: {
      channel: Order["channel"];
      service_type: Order["service_type"];
      table_no?: string | null;
      status?: Order["status"];
      payment_status?: Order["payment_status"];
      fulfillment_status?: Order["fulfillment_status"];
      delivery?: {
        name: string;
        phone: string;
        address: string;
        fee: number;
        note?: string;
      } | null;
      discount?: number;
      discount_reason?: string | null;
      tax?: number;
      service_charge?: number;
      payment_method: Order["payment_method"];
      cash_given?: number | null;
      customer_id?: string | null;
      /** Nama yang diketik pemesan di menu digital, dibaca kasir dan dapur. */
      customer_name?: string | null;
      shift_id?: string | null;
      table_session_id?: string | null;
      created_by: string;
    },
    itemsData: {
      menu_item_id: string;
      name: string;
      price: number;
      qty: number;
      note?: string;
    }[],
  ) {
    /**
     * Modal per menu dibaca SEBELUM transaksi dibuka, lalu ikut tersimpan di
     * tiap barisnya. Inilah yang bikin laporan laba berhenti berubah sendiri:
     * yang dipakai laporan adalah modal saat penjualan terjadi, bukan harga
     * bahan hari laporan itu dicetak.
     */
    const unitCosts = await this.getMenuUnitCosts(businessId);

    return sql.begin(async (tx) => {
      // Pajak dan service charge dikirim sudah dalam rupiah oleh pemanggil,
      // jadi engine dipakai hanya untuk subtotal dan pembatasan diskon.
      const totals = calculateCartTotals(
        itemsData.map((i) => ({ price: i.price, qty: i.qty })),
        orderData.discount ?? 0,
      );
      const subtotal = totals.subtotal;
      const discount = totals.discount;
      const tax = orderData.tax ?? 0;
      const service = orderData.service_charge ?? 0;
      /**
       * Ongkir ikut ke total, dan tersimpan juga di kolomnya sendiri.
       * Disimpan, bukan dihitung ulang saat laporan: tarifnya bisa berubah,
       * dan laporan bulan lalu harus tetap menjumlahkan angka yang benar-benar
       * ditagihkan waktu itu.
       */
      const ongkir = Math.max(0, Math.round(orderData.delivery?.fee ?? 0));
      const total = subtotal - discount + tax + service + ongkir;

      /**
       * Nomor urut harian mengikuti zona waktu bisnis, bukan UTC.
       *
       * Dengan CURRENT_DATE (UTC), transaksi jam 07:00 WIB dihitung sebagai
       * hari sebelumnya, sehingga penomoran mengulang dari 001 di tengah hari
       * kerja dan tidak cocok dengan laporan harian yang memang sudah memakai
       * AT TIME ZONE. Itu jenis selisih yang berakhir jadi tuduhan ke kasir.
       */
      const biz =
        await tx`SELECT timezone FROM businesses WHERE id = ${businessId} FOR UPDATE`;
      const tz = (biz[0]?.timezone as string) || "Asia/Jakarta";
      const seq = await tx`
        SELECT COUNT(*)::int AS n FROM orders
        WHERE business_id = ${businessId}
          AND (created_at AT TIME ZONE ${tz})::date = (NOW() AT TIME ZONE ${tz})::date
      `;
      const orderNo = generateDailyOrderNo(num(seq[0]?.n) + 1);

      const cashGiven = orderData.cash_given ?? null;
      const cashChange =
        orderData.payment_method === "cash" && cashGiven !== null
          ? Math.max(0, cashGiven - total)
          : null;

      const order = one<Order>(
        await tx`
        INSERT INTO orders ${tx({
          business_id: businessId,
          order_no: orderNo,
          channel: orderData.channel,
          service_type: orderData.service_type,
          table_no: orderData.table_no ?? null,
          status: orderData.status ?? "paid",
          payment_status: orderData.payment_status ?? "paid",
          fulfillment_status: orderData.fulfillment_status ?? "completed",
          delivery_name: orderData.delivery?.name ?? null,
          delivery_phone: orderData.delivery?.phone ?? null,
          delivery_address: orderData.delivery?.address ?? null,
          delivery_fee: ongkir,
          delivery_note: orderData.delivery?.note ?? null,
          subtotal,
          discount,
          // Alasan hanya bermakna kalau diskonnya benar-benar ada. Menyimpan
          // alasan pada diskon nol cuma bikin laporan penuh baris kosong.
          discount_reason: discount > 0 ? (orderData.discount_reason?.trim() || null) : null,
          tax,
          service_charge: service,
          total,
          payment_method: orderData.payment_method,
          cash_given: cashGiven,
          cash_change: cashChange,
          customer_id: orderData.customer_id ?? null,
          customer_name: orderData.customer_name?.trim() || null,
          shift_id: orderData.shift_id ?? null,
          table_session_id: orderData.table_session_id ?? null,
          created_by: orderData.created_by,
        })} RETURNING *
      `,
      )!;

      const items: OrderItem[] = [];
      for (const i of itemsData) {
        items.push(
          one<OrderItem>(
            await tx`
          INSERT INTO order_items ${tx({
            order_id: order.id,
            menu_item_id: i.menu_item_id,
            name_snapshot: i.name,
            price_snapshot: i.price,
            cost_snapshot: unitCosts.get(i.menu_item_id) ?? null,
            qty: i.qty,
            subtotal: i.price * i.qty,
            note: i.note ?? null,
          })} RETURNING *
        `,
          )!,
        );
      }
      return { order, items };
    });
  },

  // ---------------------------------------------------------------------------
  // SESI MEJA
  // ---------------------------------------------------------------------------

  /** Sesi yang sedang berjalan di sebuah meja, kalau ada. */
  async getOpenTableSession(businessId: string, tableNo: string): Promise<TableSession | null> {
    const key = normalizeTableKey(tableNo);
    if (!key) return null;
    return one<TableSession>(await sql`
      SELECT * FROM table_sessions
      WHERE business_id = ${businessId} AND table_key = ${key} AND status = 'open'
      LIMIT 1
    `);
  },

  /**
   * Membuka meja, atau mengembalikan sesi yang sudah terbuka di meja itu.
   *
   * Sengaja idempoten. Dua tablet kasir yang menekan tombol bersamaan, atau
   * pesanan QR yang masuk tepat saat kasir membuka mejanya, harus berakhir di
   * satu kunjungan yang sama — bukan dua tagihan yang terpisah di meja yang
   * sama. Indeks unik parsial di basis data yang menegakkannya; ON CONFLICT di
   * sini yang membuat lomba itu berakhir damai alih-alih jadi galat di layar.
   */
  async openTableSession(
    businessId: string,
    tableNo: string,
    userId: string | null,
    guestCount?: number | null,
  ): Promise<TableSession | null> {
    const key = normalizeTableKey(tableNo);
    if (!key) return null;

    const inserted = one<TableSession>(await sql`
      INSERT INTO table_sessions ${sql({
        business_id: businessId,
        table_no: tableNo.trim(),
        table_key: key,
        status: "open",
        guest_count: guestCount && guestCount > 0 ? Math.floor(guestCount) : null,
        opened_by: userId,
      })}
      ON CONFLICT (business_id, table_key) WHERE status = 'open' DO NOTHING
      RETURNING *
    `);
    if (inserted) return inserted;

    return this.getOpenTableSession(businessId, tableNo);
  },

  /**
   * Menutup meja setelah tamunya benar-benar pergi.
   *
   * Menolak selama masih ada tagihan yang belum lunas. Versi lama di layar
   * denah meja menyelesaikan ini dengan memanggil confirmPaymentAction untuk
   * tiap pesanan yang menggantung — artinya "kosongkan meja" diam-diam
   * menyatakan uang sudah diterima, untuk uang yang mungkin tidak pernah
   * diterima siapa pun. Selisihnya baru ketahuan saat tutup shift, dan yang
   * ditanya duluan selalu kasirnya.
   */
  /**
   * Menyelesaikan SELURUH tagihan satu meja dalam satu kali bayar.
   *
   * Inilah inti alur "bayar di akhir": tamu memesan berkali-kali sepanjang dua
   * jam, lalu membayar sekali saat pulang. Yang dikerjakan di sini karena itu
   * bukan satu nota, melainkan semua nota yang masih menggantung di kunjungan
   * itu — sekaligus, di dalam satu transaksi.
   *
   * Sekaligus, dan itu bukan soal kerapian: kalau nota pertama sempat tercatat
   * lunas lalu langkah berikutnya gagal, mejanya jadi setengah terbayar. Kasir
   * melihat sisa tagihan yang tidak dia mengerti, tamunya sudah pergi, dan
   * tidak ada yang bisa memastikan berapa yang sebenarnya diterima.
   */
  async settleTableSession(
    sessionId: string,
    businessId: string,
    userId: string,
    opsi: {
      method: "cash" | "qris" | "transfer";
      /** Uang yang disodorkan tamu. Wajib untuk tunai. */
      cashGiven?: number | null;
      /** Member yang dilekatkan saat membayar, kalau tamunya mendaftar. */
      customerId?: string | null;
    },
  ): Promise<{
    ok: boolean;
    error?: string;
    data?: {
      orderIds: string[];
      orderNos: string[];
      total: number;
      cashGiven: number | null;
      change: number | null;
    };
  }> {
    return sql.begin(async (tx) => {
      const session = one<TableSession>(await tx`
        SELECT * FROM table_sessions
        WHERE id = ${sessionId} AND business_id = ${businessId} FOR UPDATE
      `);
      if (!session) return { ok: false, error: "Sesi meja tidak ditemukan." };

      const notaBelumLunas = (await tx`
        SELECT id, order_no, total FROM orders
        WHERE table_session_id = ${sessionId}
          AND business_id = ${businessId}
          AND status <> 'cancelled'
          AND payment_status = 'pending'
        ORDER BY created_at
        FOR UPDATE
      `) as unknown as { id: string; order_no: string; total: string }[];

      if (!notaBelumLunas.length) {
        return { ok: false, error: "Tidak ada tagihan yang menunggu dibayar di meja ini." };
      }

      const total = notaBelumLunas.reduce((n, o) => n + Number(o.total), 0);

      /**
       * Tunai wajib punya shift yang terbuka.
       *
       * Uang tunai masuk ke laci fisik, dan laci yang tidak menempel pada shift
       * mana pun tidak bisa dicocokkan saat tutup — selisihnya tidak akan
       * pernah ketahuan milik siapa.
       */
      let shiftId: string | null = null;
      let cashGiven: number | null = null;
      let change: number | null = null;

      if (opsi.method === "cash") {
        const shift = one<Shift>(await tx`
          SELECT * FROM shifts WHERE business_id = ${businessId} AND closed_at IS NULL
          ORDER BY opened_at DESC LIMIT 1 FOR UPDATE
        `);
        if (!shift) {
          return { ok: false, error: "Buka shift kasir dulu sebelum menerima pembayaran tunai." };
        }
        shiftId = shift.id;

        cashGiven = Math.round(Number(opsi.cashGiven ?? 0));
        if (!Number.isFinite(cashGiven) || cashGiven < total) {
          return { ok: false, error: "Uang tunai yang diterima kurang dari total tagihan meja." };
        }
        change = cashGiven - total;
      }

      /**
       * Member dilekatkan ke SEMUA nota kunjungan ini, bukan cuma yang terakhir.
       *
       * Poinnya dihitung dari nilai tiap nota. Melekatkannya cuma ke satu nota
       * berarti tamu yang memesan empat kali cuma dapat poin dari pesanan
       * terakhirnya — dan dia tidak akan pernah tahu kenapa poinnya kurang.
       */
      const idNota = notaBelumLunas.map((o) => o.id);

      await tx`
        UPDATE orders SET
          payment_status = 'paid',
          status = 'paid',
          payment_method = ${opsi.method},
          paid_confirmed_by = ${userId},
          paid_confirmed_at = NOW(),
          shift_id = COALESCE(${shiftId}, shift_id),
          customer_id = COALESCE(${opsi.customerId ?? null}, customer_id),
          fulfillment_status = CASE
            WHEN fulfillment_status = 'pending' THEN 'accepted'
            ELSE fulfillment_status
          END
        WHERE id IN ${tx(idNota)} AND business_id = ${businessId}
      `;

      await tx`
        UPDATE table_sessions SET
          status = 'closed',
          closed_at = NOW(),
          closed_by = ${userId},
          dibayar_dengan = ${opsi.method},
          tunai_diterima = ${cashGiven},
          kembalian = ${change},
          dibayar_pada = NOW(),
          dibayar_oleh = ${userId}
        WHERE id = ${sessionId}
      `;

      return {
        ok: true,
        data: {
          orderIds: idNota,
          orderNos: notaBelumLunas.map((o) => o.order_no),
          total,
          cashGiven,
          change,
        },
      };
    });
  },

  async closeTableSession(
    sessionId: string,
    businessId: string,
    userId: string,
  ): Promise<{ ok: boolean; error?: string; session?: TableSession }> {
    return sql.begin(async (tx) => {
      const session = one<TableSession>(await tx`
        SELECT * FROM table_sessions
        WHERE id = ${sessionId} AND business_id = ${businessId} FOR UPDATE
      `);
      if (!session) return { ok: false, error: "Sesi meja tidak ditemukan." };
      if (session.status === "closed") return { ok: true, session };

      const belumLunas = await tx`
        SELECT order_no, total FROM orders
        WHERE table_session_id = ${sessionId}
          AND status <> 'cancelled'
          AND payment_status = 'pending'
      `;
      if (belumLunas.length) {
        const daftar = belumLunas.map((o) => o.order_no as string).join(", ");
        return {
          ok: false,
          error: `Masih ada tagihan yang belum dibayar di meja ini: ${daftar}. Selesaikan pembayarannya dulu, atau batalkan pesanannya kalau memang tidak jadi.`,
        };
      }

      const closed = one<TableSession>(await tx`
        UPDATE table_sessions
        SET status = 'closed', closed_at = NOW(), closed_by = ${userId}
        WHERE id = ${sessionId}
        RETURNING *
      `);
      return { ok: true, session: closed! };
    });
  },

  /**
   * Denah meja kasir. Yang menentukan sebuah meja terisi adalah ADA SESI
   * TERBUKA, bukan ada pesanan yang belum selesai dimasak.
   */
  async getTableSessionSummaries(businessId: string): Promise<TableSessionSummary[]> {
    return (await sql`
      SELECT s.*,
        COALESCE(a.order_count, 0)::int AS order_count,
        COALESCE(a.item_count, 0)::int AS item_count,
        COALESCE(a.total_bill, 0) AS total_bill,
        COALESCE(a.has_unpaid, FALSE) AS has_unpaid,
        COALESCE(a.is_cooking, FALSE) AS is_cooking
      FROM table_sessions s
      LEFT JOIN (
        SELECT o.table_session_id,
          COUNT(*)::int AS order_count,
          COALESCE(SUM((SELECT SUM(i.qty) FROM order_items i WHERE i.order_id = o.id AND i.cancelled_at IS NULL)), 0)::int AS item_count,
          COALESCE(SUM(o.total), 0) AS total_bill,
          BOOL_OR(o.payment_status = 'pending') AS has_unpaid,
          BOOL_OR(o.fulfillment_status IN ('pending', 'accepted', 'preparing')) AS is_cooking
        FROM orders o
        WHERE o.business_id = ${businessId} AND o.status <> 'cancelled'
        GROUP BY o.table_session_id
      ) a ON a.table_session_id = s.id
      WHERE s.business_id = ${businessId} AND s.status = 'open'
      ORDER BY s.opened_at ASC
    `) as unknown as TableSessionSummary[];
  },

  // =========================================================================
  // Panggilan meja
  // =========================================================================

  /**
   * Batas hidup satu panggilan, dalam menit.
   *
   * Panggilan yang tidak pernah ditutup akan menumpuk semalaman dan membuat
   * layar kasir esok paginya penuh panggilan dari tamu yang sudah lama pulang.
   * Yang lewat batas ini ditandai kedaluwarsa, BUKAN dilayani — karena memang
   * tidak ada yang mendatanginya, dan itu justru yang perlu terlihat.
   */
  PANGGILAN_MENIT: 45,

  /**
   * Jeda sebelum satu meja boleh memanggil lagi, dalam menit.
   *
   * Bukan untuk membatasi tamu, melainkan untuk menjaga bunyinya tetap berarti.
   * Kasir yang dibunyikan sepuluh kali oleh meja yang sama akan mulai
   * mengabaikan bunyinya — dan saat itu terjadi, meja LAIN yang benar-benar
   * menunggu ikut tidak terdengar.
   */
  PANGGILAN_JEDA_MENIT: 2,

  /**
   * Tamu menekan tombol panggil dari halaman menu digital.
   *
   * Tidak ada sesi, tidak ada login: yang memanggil adalah orang yang sedang
   * duduk di meja itu. Karena itu satu-satunya pengaman yang masuk akal di sini
   * bukan otentikasi, melainkan pembatasan jumlah — dan itu ditegakkan indeks
   * unik di basis data, bukan tombol yang dinonaktifkan di layar.
   */
  async createTableCall(
    businessId: string,
    tableNo: string,
    jenis: "siap_memesan" | "tambah_pesanan" | "minta_bill" | "bantuan" = "siap_memesan",
  ): Promise<{
    ok: boolean;
    sudahAda?: boolean;
    menungguSejak?: string;
    /** Detik tersisa sebelum meja ini boleh memanggil lagi. 0 berarti boleh. */
    jedaDetik?: number;
  }> {
    const tableKey = normalizeTableKey(tableNo);
    if (!tableKey) return { ok: false };

    await this.expireStaleTableCalls(businessId);

    const sudahAda = one<{ id: string; created_at: string; ping_terakhir: string }>(await sql`
      SELECT id, created_at, ping_terakhir FROM table_calls
      WHERE business_id = ${businessId} AND table_key = ${tableKey} AND status = 'menunggu'
      LIMIT 1
    `);

    if (sudahAda) {
      const jedaMs = this.PANGGILAN_JEDA_MENIT * 60_000;
      const sejakPingMs = Date.now() - new Date(sudahAda.ping_terakhir).getTime();
      const sisaDetik = Math.max(0, Math.ceil((jedaMs - sejakPingMs) / 1000));

      /**
       * Masih dalam jeda: panggilannya memang sudah tercatat, jadi ini BUKAN
       * kegagalan. Yang dikembalikan sisa waktunya, supaya layar tamu bisa
       * menghitung mundur alih-alih menampilkan galat kepada orang yang justru
       * sedang menunggu.
       */
      if (sisaDetik > 0) {
        return {
          ok: true,
          sudahAda: true,
          menungguSejak: sudahAda.created_at,
          jedaDetik: sisaDetik,
        };
      }

      /**
       * Jedanya sudah lewat: kasir dibunyikan lagi.
       *
       * created_at TIDAK ikut digeser. Itu yang menjaga "sudah menunggu berapa
       * lama" tetap terbaca apa adanya — kalau ikut bergeser, meja yang sudah
       * 20 menit diabaikan akan terlihat seperti baru memanggil.
       */
      await sql`
        UPDATE table_calls SET
          ping_terakhir = NOW(),
          jumlah_ping = jumlah_ping + 1
        WHERE id = ${sudahAda.id}
      `;
      return {
        ok: true,
        sudahAda: true,
        menungguSejak: sudahAda.created_at,
        jedaDetik: 0,
      };
    }

    const baris = one<{ created_at: string }>(await sql`
      INSERT INTO table_calls ${sql({
        business_id: businessId,
        table_no: tableNo.trim().slice(0, 40),
        table_key: tableKey,
        jenis,
      })}
      ON CONFLICT DO NOTHING
      RETURNING created_at
    `);

    return { ok: true, sudahAda: false, menungguSejak: baris?.created_at, jedaDetik: 0 };
  },

  /** Panggilan yang belum didatangi, terlama di atas — yang paling lama menunggu yang paling mendesak. */
  async getOpenTableCalls(businessId: string) {
    await this.expireStaleTableCalls(businessId);
    return (await sql`
      SELECT id, table_no, table_key, jenis, created_at, jumlah_ping
      FROM table_calls
      WHERE business_id = ${businessId} AND status = 'menunggu'
      ORDER BY created_at ASC
    `) as unknown as {
      id: string;
      table_no: string;
      table_key: string;
      jenis: string;
      created_at: string;
      jumlah_ping: number;
    }[];
  },

  /** Pelayan menyatakan mejanya sudah didatangi. */
  async resolveTableCall(callId: string, businessId: string, userId: string): Promise<boolean> {
    const rows = await sql`
      UPDATE table_calls
      SET status = 'dilayani', handled_at = NOW(), handled_by = ${userId}
      WHERE id = ${callId} AND business_id = ${businessId} AND status = 'menunggu'
      RETURNING id
    `;
    return rows.length > 0;
  },

  /** Menutup panggilan yang sudah terlalu lama menggantung. */
  async expireStaleTableCalls(businessId: string): Promise<number> {
    const rows = await sql`
      UPDATE table_calls SET status = 'kedaluwarsa', handled_at = NOW()
      WHERE business_id = ${businessId} AND status = 'menunggu'
        AND created_at < NOW() - (${this.PANGGILAN_MENIT} * INTERVAL '1 minute')
      RETURNING id
    `;
    return rows.length;
  },

  // =========================================================================
  // Kunjungan menu digital
  // =========================================================================

  /**
   * Mencatat satu kunjungan ke menu digital.
   *
   * Dipanggil dari halaman meja tanpa login, jadi tidak ada pengecekan izin
   * di sini — pengamannya ada di action pemanggilnya (memvalidasi bisnisnya
   * ada dan mejanya dikenali). Dedup "satu tamu, satu meja, satu hari" sudah
   * dilakukan di browser lewat localStorage sebelum sampai ke sini, supaya
   * tamu yang membuka-tutup layarnya berkali-kali tidak menggembungkan angka.
   */
  async recordMenuPageView(businessId: string, tableNo: string): Promise<void> {
    const tableKey = normalizeTableKey(tableNo);
    if (!tableKey) return;
    await sql`
      INSERT INTO menu_page_views ${sql({
        business_id: businessId,
        table_no: tableNo.trim().slice(0, 40),
        table_key: tableKey,
      })}
    `;
  },

  /**
   * Ringkasan kunjungan untuk layar laporan owner.
   *
   * Dipisah jadi hari ini dan 7 hari terakhir karena keduanya menjawab
   * pertanyaan yang berbeda: hari ini untuk "apakah QR meja hari ini
   * dipindai", 7 hari untuk melihat pola mingguan tanpa harus menunggu
   * sebulan data terkumpul.
   */
  async getMenuViewStats(businessId: string): Promise<{
    hariIni: number;
    tujuhHari: number;
    tigaPuluhHari: number;
    perMeja: { tableNo: string; jumlah: number }[];
  }> {
    const [ringkas, perMeja] = await Promise.all([
      sql`
        SELECT
          COUNT(*) FILTER (WHERE viewed_at >= date_trunc('day', NOW()))::int AS hari_ini,
          COUNT(*) FILTER (WHERE viewed_at >= NOW() - INTERVAL '7 days')::int AS tujuh_hari,
          COUNT(*) FILTER (WHERE viewed_at >= NOW() - INTERVAL '30 days')::int AS tiga_puluh_hari
        FROM menu_page_views
        WHERE business_id = ${businessId}
      `,
      sql`
        SELECT table_no, COUNT(*)::int AS jumlah
        FROM menu_page_views
        WHERE business_id = ${businessId} AND viewed_at >= NOW() - INTERVAL '7 days'
        GROUP BY table_no
        ORDER BY jumlah DESC
        LIMIT 10
      `,
    ]);

    return {
      hariIni: Number(ringkas[0]?.hari_ini ?? 0),
      tujuhHari: Number(ringkas[0]?.tujuh_hari ?? 0),
      tigaPuluhHari: Number(ringkas[0]?.tiga_puluh_hari ?? 0),
      perMeja: (perMeja as unknown as { table_no: string; jumlah: number }[]).map((r) => ({
        tableNo: r.table_no,
        jumlah: r.jumlah,
      })),
    };
  },

  /**
   * Modal (HPP) satu unit untuk tiap menu, menurut keadaan SEKARANG.
   *
   * Dipakai dua tempat dan sengaja cuma ada satu: saat penjualan dicatat
   * (hasilnya dikunci ke order_items.cost_snapshot) dan saat menandai menu mana
   * yang belum punya modal. Kalau kedua tempat itu punya rumusnya sendiri,
   * cepat atau lambat keduanya menjawab beda untuk menu yang sama.
   *
   * `null` berarti menunya BELUM punya modal yang bisa dipakai — bukan
   * modalnya nol. Bedanya penting: nol berarti seluruh harga jual adalah laba,
   * dan itu angka yang menyesatkan kalau dipakai mengambil keputusan.
   */
  async getMenuUnitCosts(businessId: string): Promise<Map<string, number | null>> {
    const menuItems = await this.getMenuItems(businessId);

    let hppByRecipe = new Map<string, number>();
    if (menuItems.some((m) => m.recipe_id)) {
      const calcs = await this.getAllRecipesWithCalculations(businessId);
      hppByRecipe = new Map(calcs.map((c) => [c.recipe.id, c.calc.hpp_per_unit ?? 0]));
    }

    const costs = new Map<string, number | null>();
    for (const item of menuItems) {
      const dariResep = item.recipe_id ? (hppByRecipe.get(item.recipe_id) ?? 0) : 0;
      if (dariResep > 0) {
        costs.set(item.id, Math.round(dariResep));
        continue;
      }
      // Modal pokok yang diketik owner, dipakai kalau menunya belum punya resep.
      const modalPokok = Number(item.cost_price) || 0;
      costs.set(item.id, modalPokok > 0 ? Math.round(modalPokok) : null);
    }
    return costs;
  },

  /**
   * Menu yang belum bisa dihitung labanya. Dipakai laporan untuk berkata
   * "belum lengkap" alih-alih diam-diam melaporkan laba 100%.
   */
  async getMenusWithoutCost(businessId: string): Promise<{ id: string; name: string }[]> {
    const costs = await this.getMenuUnitCosts(businessId);
    const menuItems = await this.getMenuItems(businessId);
    return menuItems
      .filter((m) => costs.get(m.id) == null)
      .map((m) => ({ id: m.id, name: m.name }));
  },

  async getOrders(businessId: string, limit = 50): Promise<Order[]> {
    return (await sql`
      SELECT o.*, COALESCE(r.refund_total, 0) AS refund_total
      FROM orders o
      LEFT JOIN (
        SELECT order_id, SUM(amount) AS refund_total FROM refunds GROUP BY order_id
      ) r ON r.order_id = o.id
      WHERE o.business_id = ${businessId}
      ORDER BY o.created_at DESC LIMIT ${limit}
    `) as unknown as Order[];
  },

  /**
   * Total pengembalian dana yang sudah dilakukan seseorang HARI INI.
   *
   * Dipakai membatasi kerugian sebelum polanya sempat terbaca. Harinya
   * mengikuti zona waktu toko, bukan UTC — kalau tidak, batas hariannya akan
   * mereset pukul tujuh pagi di tengah jam kerja.
   */
  async getRefundTotalToday(businessId: string, userId: string): Promise<number> {
    const biz = await this.getBusiness(businessId);
    const tz = biz?.timezone || "Asia/Jakarta";
    const [row] = await sql`
      SELECT COALESCE(SUM(rf.amount), 0)::bigint AS total
      FROM refunds rf JOIN orders o ON o.id = rf.order_id
      WHERE o.business_id = ${businessId}
        AND rf.approved_by = ${userId}
        AND (rf.created_at AT TIME ZONE ${tz})::date = (NOW() AT TIME ZONE ${tz})::date
    `;
    return num(row?.total);
  },

  /**
   * Seberapa sering tiap kasir mengembalikan uang, dibanding penjualannya.
   *
   * Angka satu refund tidak pernah mencurigakan dengan sendirinya — yang
   * berbicara adalah POLANYA. Kasir yang mengembalikan 12% penjualannya
   * sementara rekannya 0,4% adalah pertanyaan yang layak diajukan, dan
   * pertanyaan itu tidak akan pernah muncul kalau angkanya tidak pernah
   * diletakkan bersebelahan.
   */
  async getRefundRateByCashier(businessId: string, hari = 30) {
    const biz = await this.getBusiness(businessId);
    const tz = biz?.timezone || "Asia/Jakarta";
    const baris = await sql`
      WITH penjualan AS (
        SELECT o.created_by AS user_id,
               COUNT(*)::int AS jumlah_nota,
               COALESCE(SUM(o.total), 0)::bigint AS omzet
        FROM orders o
        WHERE o.business_id = ${businessId} AND o.status = 'paid'
          AND (o.created_at AT TIME ZONE ${tz})::date
              > ((NOW() AT TIME ZONE ${tz})::date - ${hari}::int)
        GROUP BY o.created_by
      ),
      pengembalian AS (
        SELECT rf.approved_by AS user_id,
               COUNT(*)::int AS jumlah_refund,
               COALESCE(SUM(rf.amount), 0)::bigint AS nilai_refund,
               COUNT(*) FILTER (WHERE rf.method = 'cash')::int AS refund_tunai
        FROM refunds rf JOIN orders o ON o.id = rf.order_id
        WHERE o.business_id = ${businessId}
          AND (rf.created_at AT TIME ZONE ${tz})::date
              > ((NOW() AT TIME ZONE ${tz})::date - ${hari}::int)
        GROUP BY rf.approved_by
      )
      SELECT u.id, u.name, u.role,
             COALESCE(p.jumlah_nota, 0) AS jumlah_nota,
             COALESCE(p.omzet, 0) AS omzet,
             COALESCE(r.jumlah_refund, 0) AS jumlah_refund,
             COALESCE(r.nilai_refund, 0) AS nilai_refund,
             COALESCE(r.refund_tunai, 0) AS refund_tunai
      FROM users u
      LEFT JOIN penjualan p ON p.user_id = u.id
      LEFT JOIN pengembalian r ON r.user_id = u.id
      WHERE u.business_id = ${businessId}
        AND (COALESCE(p.jumlah_nota, 0) > 0 OR COALESCE(r.jumlah_refund, 0) > 0)
      ORDER BY COALESCE(r.nilai_refund, 0) DESC
    `;

    return baris.map((r) => {
      const omzet = num(r.omzet);
      const nilaiRefund = num(r.nilai_refund);
      return {
        userId: r.id as string,
        nama: r.name as string,
        peran: r.role as string,
        jumlahNota: num(r.jumlah_nota),
        omzet,
        jumlahRefund: num(r.jumlah_refund),
        nilaiRefund,
        refundTunai: num(r.refund_tunai),
        /** Porsi omzetnya yang berakhir dikembalikan. */
        persenRefund: omzet > 0 ? (nilaiRefund / omzet) * 100 : 0,
      };
    });
  },

  /**
   * Riwayat penjualan untuk layar kasir.
   *
   * Sengaja TIDAK memuat satu pun angka laba: tidak ada HPP, tidak ada margin,
   * tidak ada omzet kumulatif. Kasir butuh menemukan transaksinya untuk
   * mencetak ulang struk atau memproses pengembalian dana — dan itu saja.
   * Berapa untung tokonya bukan urusan yang mencatatnya.
   *
   * Itu juga alasan fungsi ini ada terpisah dari laporan owner: kalau keduanya
   * memakai satu kueri, cepat atau lambat satu kolom laba ikut menyeberang ke
   * layar yang tidak seharusnya melihatnya.
   */
  async getCashierSalesHistory(
    businessId: string,
    opsi: { hari?: number; limit?: number } = {},
  ) {
    const hari = Math.min(Math.max(opsi.hari ?? 7, 1), 31);
    const limit = Math.min(Math.max(opsi.limit ?? 100, 1), 300);
    const biz = await this.getBusiness(businessId);
    const tz = biz?.timezone || "Asia/Jakarta";

    const orders = (await sql`
      SELECT o.id, o.order_no, o.created_at, o.table_no, o.service_type,
             o.status, o.payment_status, o.payment_method, o.total,
             o.discount, o.discount_reason, o.customer_name,
             COALESCE(r.refund_total, 0) AS refund_total,
             u.name AS cashier_name,
             c.name AS member_name
      FROM orders o
      LEFT JOIN (SELECT order_id, SUM(amount) AS refund_total FROM refunds GROUP BY order_id) r
        ON r.order_id = o.id
      LEFT JOIN users u ON u.id = o.created_by
      LEFT JOIN customers c ON c.id = o.customer_id
      WHERE o.business_id = ${businessId}
        AND (o.created_at AT TIME ZONE ${tz})::date
            > ((NOW() AT TIME ZONE ${tz})::date - ${hari}::int)
      ORDER BY o.created_at DESC
      LIMIT ${limit}
    `) as unknown as (Order & {
      refund_total: number;
      cashier_name: string | null;
      member_name: string | null;
    })[];

    return Promise.all(
      orders.map(async (o) => ({ ...o, items: await this.getOrderItems(o.id) })),
    );
  },

  /**
   * Isi sebuah nota. Menu yang DIBATALKAN tidak ikut, kecuali diminta.
   *
   * Penyaringannya ditaruh di sini, bukan di tiap pemanggil, supaya tidak ada
   * satu pun jalur yang ketinggalan: struk, tiket dapur, pemotongan stok,
   * bagi tagihan, dan laporan per menu semuanya lewat fungsi ini. Satu tempat
   * yang lupa menyaring berarti tamu menerima struk berisi menu yang dia
   * batalkan, atau stok terpotong untuk makanan yang tidak pernah dibuat.
   */
  async getOrderItems(
    orderId: string,
    opsi?: { termasukDibatalkan?: boolean },
  ): Promise<OrderItem[]> {
    if (opsi?.termasukDibatalkan) {
      return (await sql`
        SELECT * FROM order_items WHERE order_id = ${orderId} ORDER BY id
      `) as unknown as OrderItem[];
    }
    return (await sql`
      SELECT * FROM order_items
      WHERE order_id = ${orderId} AND cancelled_at IS NULL
      ORDER BY id
    `) as unknown as OrderItem[];
  },

  /**
   * Bahan faktur WhatsApp untuk satu pesanan.
   *
   * Beda dari getOrderById: yang ini MENYARING business_id. Struk publik
   * memang boleh dibuka siapa pun yang memegang tautannya, tapi faktur ini
   * dipanggil dari layar kasir dan mengembalikan nomor WhatsApp pelanggan —
   * tanpa saringan, kasir toko mana pun bisa menarik nomor pelanggan toko lain
   * cukup dengan menebak id pesanannya.
   *
   * Penerimanya diputuskan di sini, bukan di layar. Pesanan antar punya
   * penerima sendiri (delivery_phone) yang bisa berbeda dari membernya —
   * orang memesankan makanan untuk rumah ibunya. Selain itu, nomor member
   * yang menempel ke pesanan. Kalau keduanya tidak ada, penerimanya kosong
   * dan kasir mengetiknya sendiri.
   *
   * Item yang dibatalkan tidak ikut — getOrderItems sudah menyaringnya. Faktur
   * yang masih mencantumkan menu yang tidak jadi dibuat akan ditagih pelanggan
   * ke kasir, dan dia benar.
   */
  async getOrderInvoice(orderId: string, businessId: string): Promise<FakturPesanan | null> {
    const order = one<Order>(await sql`
      SELECT * FROM orders WHERE id = ${orderId} AND business_id = ${businessId}
    `);
    if (!order) return null;

    const [items, business, customer] = await Promise.all([
      this.getOrderItems(order.id),
      this.getBusiness(businessId),
      order.customer_id
        ? sql`
            SELECT name, phone FROM customers
            WHERE id = ${order.customer_id} AND business_id = ${businessId}
          `.then((rows) => one<{ name: string | null; phone: string }>(rows))
        : Promise.resolve(null),
    ]);

    const antar = order.service_type === "delivery";
    const nomorAntar = order.delivery_phone?.trim() || null;

    return {
      orderId: order.id,
      namaToko: business?.name ?? "",
      orderNo: order.order_no,
      items: items.map((i) => ({
        nama: i.name_snapshot,
        qty: num(i.qty),
        harga: num(i.price_snapshot),
      })),
      subtotal: num(order.subtotal),
      diskon: num(order.discount),
      pajak: num(order.tax),
      serviceCharge: num(order.service_charge),
      ongkir: num(order.delivery_fee),
      total: num(order.total),
      caraBayar: order.payment_method,
      penerima: {
        nomor: (antar && nomorAntar) || customer?.phone || nomorAntar || null,
        nama: (antar && order.delivery_name?.trim()) || customer?.name || null,
        alamat: antar ? order.delivery_address?.trim() || null : null,
      },
    };
  },

  /**
   * Kasir mengisi ongkir pesanan antar yang sudah masuk.
   *
   * Ongkir tidak bisa diketahui pelanggan saat memesan dari kartunya — tokonya
   * yang tahu jarak dan tarif kurirnya. Jadi pesanan antar masuk dengan ongkir
   * nol, dan kasir mengisinya sebelum mengirim faktur.
   *
   * Totalnya digeser dengan selisih, bukan dihitung ulang dari subtotal. Nota
   * bisa sudah berubah sejak masuk (item dibatalkan, diskon), dan yang paling
   * tahu total terkininya adalah kolom total itu sendiri. Postgres membaca
   * semua ekspresi SET dari baris LAMA, jadi `total - delivery_fee` di sini
   * memakai ongkir yang sebelumnya.
   *
   * Hanya selama belum dibayar. Mengubah ongkir pesanan yang sudah lunas
   * berarti mengubah angka yang sudah diterima kasir dan masuk laporan laci.
   */
  async setDeliveryFee(
    orderId: string, businessId: string, fee: number,
  ): Promise<{ total: number; deliveryFee: number } | null> {
    const row = one<{ total: number; delivery_fee: number }>(await sql`
      UPDATE orders
      SET total = total - delivery_fee + ${fee}, delivery_fee = ${fee}
      WHERE id = ${orderId} AND business_id = ${businessId}
        AND service_type = 'delivery' AND payment_status = 'pending'
      RETURNING total, delivery_fee
    `);
    return row ? { total: num(row.total), deliveryFee: num(row.delivery_fee) } : null;
  },

  /**
   * Pesanan antar member yang masih menunggu, untuk membatasi banjir pesanan.
   *
   * Kartu member terbuka tanpa login — yang menjaganya cuma token. Tanpa batas,
   * satu token yang bocor cukup untuk memenuhi antrean kasir dengan pesanan
   * palsu atas nama member itu.
   */
  async countPendingMemberDeliveries(businessId: string, customerId: string): Promise<number> {
    const [row] = await sql`
      SELECT count(*)::int AS n FROM orders
      WHERE business_id = ${businessId} AND customer_id = ${customerId}
        AND service_type = 'delivery' AND payment_status = 'pending'
        AND created_at > NOW() - INTERVAL '1 day'
    `;
    return num(row?.n);
  },

  /** Toko ini menerima pesanan antar? Tanpa baris setelan berarti ya. */
  async isDeliveryEnabled(businessId: string): Promise<boolean> {
    const [row] = await sql`SELECT delivery_enabled FROM ordering_settings WHERE business_id = ${businessId}`;
    return row ? Boolean(row.delivery_enabled) : true;
  },

  /** Berapa lama tautan QR faktur berlaku. Cukup untuk dipindai, tidak lebih. */
  INVOICE_LINK_MINUTES: 15,

  /**
   * Membuat tautan pendek untuk QR faktur.
   *
   * Pesanannya diperiksa milik toko ini sebelum tautan dibuat — tanpa itu,
   * kasir toko mana pun bisa membuat tautan yang, saat dibuka, merakit faktur
   * pesanan toko lain beserta isinya.
   *
   * Tautan kedaluwarsa dibersihkan di sini juga, bukan lewat cron: tabelnya
   * cuma bertambah saat kasir membuat faktur, jadi di situlah waktu yang tepat
   * untuk menyapunya.
   */
  async createInvoiceLink(
    businessId: string, orderId: string, nomor: string, userId: string,
  ): Promise<string | null> {
    return sql.begin(async (tx) => {
      const order = one<{ id: string }>(await tx`
        SELECT id FROM orders WHERE id = ${orderId} AND business_id = ${businessId}
      `);
      if (!order) return null;

      await tx`DELETE FROM invoice_links WHERE expires_at < NOW()`;

      const token = generateCustomerToken(12);
      // Kedaluwarsanya dihitung jam DATABASE, bukan jam server aplikasi. Yang
      // membandingkannya nanti juga NOW() di database, jadi keduanya tidak
      // pernah bisa selisih karena jam dua mesin berbeda.
      await tx`
        INSERT INTO invoice_links (token, business_id, order_id, nomor, created_by, expires_at)
        VALUES (
          ${token}, ${businessId}, ${orderId}, ${nomor}, ${userId},
          NOW() + (${this.INVOICE_LINK_MINUTES} * INTERVAL '1 minute')
        )
      `;
      return token;
    });
  },

  /**
   * Membuka tautan faktur: nomor tujuan dan fakturnya, atau null kalau sudah
   * kedaluwarsa. Yang membukanya HP kasir tanpa sesi KAEL, jadi pengamannya
   * adalah token acak yang berumur pendek — bukan login.
   */
  async resolveInvoiceLink(token: string): Promise<{ nomor: string; faktur: FakturPesanan } | null> {
    const link = one<{ business_id: string; order_id: string; nomor: string }>(await sql`
      SELECT business_id, order_id, nomor FROM invoice_links
      WHERE token = ${token} AND expires_at > NOW()
    `);
    if (!link) return null;
    const faktur = await this.getOrderInvoice(link.order_id, link.business_id);
    if (!faktur) return null;
    return { nomor: link.nomor, faktur };
  },

  /** Struk digital. Dibuka lewat tautan, jadi tidak menyaring business_id. */
  async getOrderById(id: string) {
    const order = one<Order>(await sql`SELECT * FROM orders WHERE id = ${id}`);
    if (!order) return null;
    const [items, customer, business] = await Promise.all([
      this.getOrderItems(order.id),
      order.customer_id
        ? this.getCustomerById(order.customer_id, order.business_id)
        : Promise.resolve(null),
      this.getBusiness(order.business_id),
    ]);
    return { order, items, customer, business };
  },

  /**
   * Feedback pascatransaksi. order_id wajib — setiap baris menunjuk
   * transaksi sungguhan, bukan kesan umum tanpa konteks.
   *
   * Hanya boleh diisi untuk pesanan yang benar-benar terjadi: 'paid' atau
   * 'refunded'. 'open' belum selesai, 'cancelled' tidak pernah terjadi.
   * uq_feedback_per_order menolak percobaan kedua pada pesanan yang sama —
   * ditangkap di sini dan diubah jadi pesan yang masuk akal buat pelanggan.
   */
  async submitFeedback(
    orderId: string,
    rating: number,
    reasonCode: string | null,
    comment: string | null,
  ): Promise<{ success: true } | { success: false; error: string }> {
    const order = one<{
      business_id: string;
      customer_id: string | null;
      status: string;
    }>(
      await sql`
      SELECT business_id, customer_id, status FROM orders WHERE id = ${orderId}
    `,
    );
    if (!order) return { success: false, error: "Pesanan tidak ditemukan." };
    if (!["paid", "refunded"].includes(order.status)) {
      return {
        success: false,
        error:
          "Feedback hanya bisa diberikan untuk pesanan yang sudah selesai.",
      };
    }
    try {
      await sql`
        INSERT INTO member_feedback ${sql({
          business_id: order.business_id,
          customer_id: order.customer_id,
          order_id: orderId,
          rating,
          reason_code: reasonCode,
          comment,
        })}
      `;
    } catch {
      return {
        success: false,
        error: "Feedback untuk pesanan ini sudah pernah dikirim.",
      };
    }
    return { success: true };
  },

  /**
   * Rating dari tap kartu.
   *
   * Berbeda dari jalur struk, di sini tidak ada pesanan yang bisa dipakai
   * sebagai kunci "satu orang satu kali". Kartu di meja ditap banyak orang
   * sepanjang hari, jadi membatasi per kartu justru membungkam pelanggan
   * kedua dan seterusnya. Yang membatasi pembanjiran adalah pembatas laju per
   * jaringan di `allowCardFeedback`, bukan constraint di tabel.
   */
  async submitCardFeedback(
    cardCode: string,
    rating: number,
  ): Promise<
    | {
        success: true;
        feedbackId: string;
        businessId: string;
        reviewUrl: string | null;
      }
    | { success: false; error: string }
  > {
    const card = one<{
      id: string;
      business_id: string | null;
      destination_url: string | null;
    }>(
      await sql`
      SELECT id, business_id, destination_url FROM cards
      WHERE card_code = ${cardCode} AND status = 'active'
    `,
    );
    if (!card || !card.business_id)
      return { success: false, error: "Kartu tidak dikenali." };

    const row = one<{ id: string }>(
      await sql`
      INSERT INTO member_feedback ${sql({
        business_id: card.business_id,
        customer_id: null,
        order_id: null,
        card_id: card.id,
        rating,
        reason_code: null,
        comment: null,
      })} RETURNING id
    `,
    );
    return {
      success: true,
      feedbackId: row!.id,
      businessId: card.business_id,
      reviewUrl: card.destination_url,
    };
  },

  /**
   * Melengkapi baris yang sudah ada dengan alasan dan komentarnya.
   *
   * Bintangnya disimpan begitu ditekan, sebelum orangnya sempat mengetik apa
   * pun — kalau menunggu tombol Kirim, pelanggan yang menekan bintang satu
   * lalu menutup ponselnya tidak akan pernah terhitung, padahal justru itu
   * yang paling perlu diketahui pemilik kafe.
   *
   * Syarat WHERE-nya yang menjaga: hanya baris dari kartu, hanya yang belum
   * pernah dilengkapi, dan hanya dalam setengah jam pertama. Tanpa itu, id
   * feedback yang bocor bisa dipakai menimpa keluhan orang lain kapan saja.
   */
  async attachCardFeedbackDetail(
    feedbackId: string,
    reasonCode: string | null,
    comment: string | null,
  ): Promise<boolean> {
    const rows = await sql`
      UPDATE member_feedback
      SET reason_code = ${reasonCode}, comment = ${comment}
      WHERE id = ${feedbackId}
        AND card_id IS NOT NULL
        AND reason_code IS NULL AND comment IS NULL
        AND created_at >= NOW() - INTERVAL '30 minutes'
      RETURNING id
    `;
    return rows.length > 0;
  },

  /**
   * Batas 10 rating per jam untuk satu jaringan dan satu toko.
   *
   * Lebih longgar dari pendaftaran member (5) karena satu kafe memang bisa
   * punya banyak pelanggan di balik satu WiFi, dan rating yang ditolak berarti
   * keluhan yang tidak pernah sampai ke pemiliknya. Cukup ketat untuk
   * menghentikan satu orang yang menekan bintang satu berulang kali.
   */
  async allowCardFeedback(
    businessId: string,
    ipHash: string,
  ): Promise<boolean> {
    return sql.begin(async (tx) => {
      await tx`SELECT pg_advisory_xact_lock(hashtext(${businessId + ":nilai:" + ipHash}))`;
      await tx`DELETE FROM feedback_attempts WHERE created_at < NOW() - INTERVAL '2 days'`;
      const row = one<{ count: string | number }>(
        await tx`
        SELECT COUNT(*) AS count FROM feedback_attempts
        WHERE business_id = ${businessId} AND ip_hash = ${ipHash}
          AND created_at >= NOW() - INTERVAL '1 hour'
      `,
      );
      if (num(row?.count) >= 10) return false;
      await tx`INSERT INTO feedback_attempts ${tx({ business_id: businessId, ip_hash: ipHash })}`;
      return true;
    });
  },

  /** Kartu beserta identitas tokonya, untuk halaman rating publik. */
  async getRatingCard(cardCode: string) {
    return one<{
      card_id: string;
      card_label: string | null;
      business_id: string;
      business_name: string;
      brand_color: string;
      logo_url: string | null;
      destination_url: string | null;
    }>(
      await sql`
      SELECT c.id AS card_id, c.label AS card_label, c.destination_url,
             b.id AS business_id, b.name AS business_name, b.brand_color, b.logo_url
      FROM cards c JOIN businesses b ON b.id = c.business_id
      WHERE c.card_code = ${cardCode} AND c.status = 'active' AND c.type = 'review'
    `,
    );
  },

  /**
   * Dipanggil di server component halaman struk. Kalau sudah ada, halaman
   * menampilkan ucapan terima kasih dan MENYEMBUNYIKAN formulirnya — bukan
   * menampilkan ulang rating atau komentarnya. Tautan struk bisa diteruskan
   * ke siapa saja, jadi isi feedback tidak boleh terbaca ulang dari sana.
   */
  async hasFeedback(orderId: string): Promise<boolean> {
    const rows =
      await sql`SELECT 1 FROM member_feedback WHERE order_id = ${orderId} LIMIT 1`;
    return rows.length > 0;
  },

  /** URL kartu ulasan Google aktif milik bisnis, untuk mengarahkan feedback rating tinggi. Null kalau belum ada. */
  async getReviewDestinationUrl(businessId: string): Promise<string | null> {
    const row = one<{ destination_url: string }>(
      await sql`
      SELECT destination_url FROM cards
      WHERE business_id = ${businessId} AND type = 'review' AND status = 'active' AND destination_url IS NOT NULL
      LIMIT 1
    `,
    );
    return row?.destination_url ?? null;
  },

  /** Angka ringkas untuk laporan POS: rata-rata rating dan alasan yang paling sering muncul. */
  async getFeedbackSummary(
    businessId: string,
  ): Promise<import("./types").FeedbackSummary> {
    const [totals, byReason] = await Promise.all([
      sql`
        SELECT COUNT(*)::int AS total, COALESCE(AVG(rating), 0)::numeric(10,2) AS avg_rating,
          COUNT(*) FILTER (WHERE rating <= 3)::int AS low_count
        FROM member_feedback WHERE business_id = ${businessId}
      `,
      sql`
        SELECT reason_code, COUNT(*)::int AS count
        FROM member_feedback WHERE business_id = ${businessId} AND reason_code IS NOT NULL
        GROUP BY reason_code ORDER BY count DESC
      `,
    ]);
    return {
      total: num(totals[0]?.total),
      avgRating: Number(totals[0]?.avg_rating ?? 0),
      lowCount: num(totals[0]?.low_count),
      byReason: byReason.map((r) => ({
        reason_code: r.reason_code as import("./types").FeedbackReasonCode,
        count: num(r.count),
      })),
    };
  },

  /** Feedback terbaru lengkap dengan komentarnya, untuk owner benar-benar membaca — bukan cuma menghitung. */
  async getRecentFeedback(
    businessId: string,
    limit = 20,
  ): Promise<import("./types").FeedbackRow[]> {
    /**
     * LEFT JOIN, bukan JOIN. Sejak rating bisa datang dari tap kartu, baris
     * tanpa pesanan itu sah — dan JOIN biasa akan membuangnya diam-diam,
     * sehingga keluhan dari meja tidak pernah sampai ke layar pemilik.
     */
    return (await sql`
      SELECT f.*, c.name AS customer_name, c.phone AS customer_phone, o.order_no, k.label AS card_label
      FROM member_feedback f
      LEFT JOIN customers c ON c.id = f.customer_id
      LEFT JOIN orders o ON o.id = f.order_id
      LEFT JOIN cards k ON k.id = f.card_id
      WHERE f.business_id = ${businessId}
      ORDER BY f.created_at DESC
      LIMIT ${limit}
    `) as unknown as import("./types").FeedbackRow[];
  },

  /** Mengambil seluruh ulasan & keluhan pelanggan untuk halaman Laporan Review & Keluhan khusus. */
  async getAllFeedback(
    businessId: string,
    limit = 1000,
  ): Promise<import("./types").FeedbackRow[]> {
    return (await sql`
      SELECT f.*, c.name AS customer_name, c.phone AS customer_phone, o.order_no, k.label AS card_label
      FROM member_feedback f
      LEFT JOIN customers c ON c.id = f.customer_id
      LEFT JOIN orders o ON o.id = f.order_id
      LEFT JOIN cards k ON k.id = f.card_id
      WHERE f.business_id = ${businessId}
      ORDER BY f.created_at DESC
      LIMIT ${limit}
    `) as unknown as import("./types").FeedbackRow[];
  },

  /** Simpan baris feedback langsung (1-5 bintang) untuk sinkronisasi ulasan. */
  async saveFeedbackRow(data: {
    rating: number;
    reason_code?: import("./types").FeedbackReasonCode;
    comment?: string;
    customer_id?: string;
    order_id?: string;
    card_id?: string;
    business_id?: string;
  }): Promise<{ id: string }> {
    /**
     * Usaha pemilik ulasan ditentukan dari BUKTI, bukan dari yang dikirim
     * pemanggil.
     *
     * Versi sebelumnya menerima business_id apa adanya, lalu — kalau tidak ada
     * satu pun keterangan — jatuh ke `SELECT id FROM businesses ORDER BY
     * created_at ASC LIMIT 1`: usaha TERTUA di seluruh tabel. Jadi ulasan tanpa
     * identitas mendarat di toko orang lain yang kebetulan mendaftar duluan,
     * dan pemiliknya melihat keluhan pelanggan yang bukan pelanggannya.
     *
     * Sekarang urutannya: pesanan dulu, lalu kartu. Keduanya baris nyata yang
     * tahu tenantnya sendiri. Tanpa salah satunya, ulasannya ditolak.
     */
    let bizId: string | undefined;
    if (data.order_id) {
      const ord = one<{ business_id: string }>(await sql`SELECT business_id FROM orders WHERE id = ${data.order_id}`);
      bizId = ord?.business_id;
    }
    if (!bizId && data.card_id) {
      const crd = one<{ business_id: string }>(await sql`SELECT business_id FROM cards WHERE id = ${data.card_id}`);
      bizId = crd?.business_id ?? undefined;
    }
    if (!bizId) {
      throw new Error("Ulasan tidak bisa disimpan tanpa pesanan atau kartu yang menyebutkan tokonya.");
    }

    /**
     * Kalau pemanggil ikut menyebut business_id, itu harus COCOK dengan bukti
     * di atas. Yang tidak cocok berarti ada yang salah tempel — dan menyimpan
     * ulasan ke tenant yang salah lebih buruk daripada gagal menyimpannya.
     */
    if (data.business_id && data.business_id !== bizId) {
      throw new Error("Ulasan ini tidak cocok dengan tokonya.");
    }

    /**
     * Pelanggan yang dilampirkan harus pelanggan toko ini juga. Tanpa
     * pemeriksaan ini, satu ulasan bisa ditempelkan ke member usaha lain.
     */
    let customerId = data.customer_id || null;
    if (customerId) {
      const cust = one<{ id: string }>(
        await sql`SELECT id FROM customers WHERE id = ${customerId} AND business_id = ${bizId}`,
      );
      if (!cust) customerId = null;
    }

    const row = one<{ id: string }>(await sql`
      INSERT INTO member_feedback ${sql({
        business_id: bizId,
        customer_id: customerId,
        order_id: data.order_id || null,
        card_id: data.card_id || null,
        rating: data.rating,
        reason_code: data.reason_code || null,
        comment: data.comment || null,
      })} RETURNING id
    `);
    return { id: row!.id };
  },

  /** Mengganti item pesanan yang habis di tengah hari dengan menu lain. */
  /**
   * Mengganti satu item pesanan dengan menu lain, biasanya karena bahannya
   * habis di tengah jalan.
   *
   * Versi sebelumnya melakukan tiga hal yang merusak pembukuan sekaligus:
   *
   *   1. MENIMPA name_snapshot dan price_snapshot pada barisnya. Padahal
   *      komentar tabelnya sendiri berbunyi "snapshot harga untuk menjamin
   *      keaslian audit masa lalu". Setelah penggantian, tidak ada satu pun
   *      cara tahu pelanggan sebenarnya memesan apa.
   *   2. Mengubah orders.total tanpa menyelesaikan selisihnya. Nota yang sudah
   *      lunas bisa totalnya naik Rp 5.000 tanpa ada yang menagih, atau turun
   *      tanpa ada yang mengembalikan. Selisih itu muncul lagi saat tutup
   *      shift, tanpa ada yang ingat penyebabnya.
   *   3. Tidak menyentuh stok sama sekali. Bahan menu lama sudah telanjur
   *      dipotong, bahan menu pengganti tidak pernah dipotong.
   *
   * Sekarang ketiganya ditutup: riwayat pesanan asli pindah ke
   * order_item_changes, selisihnya WAJIB dinyatakan mau diapakan, dan stok
   * kedua menu disesuaikan.
   */
  /**
   * Membatalkan SATU menu dari nota yang belum dibayar.
   *
   * Barisnya tidak dihapus, cuma ditandai batal. Kasir yang bisa menghapus
   * baris dari nota belum lunas memegang alat pencurian yang sempurna: tamu
   * membayar tunai, barisnya dihapus, dan tidak ada jejak item itu pernah ada
   * — laci pun tetap cocok, karena barisnya memang tidak pernah ikut dihitung.
   *
   * Yang dibatalkan otomatis hilang dari tagihan, struk, tiket dapur,
   * pemotongan stok, dan laporan penjualan. Yang tersisa cuma jejaknya, dan
   * itu yang membedakan pembatalan jujur dari uang yang menguap.
   */
  /**
   * Mengubah harga SATU baris pada nota yang belum dibayar.
   *
   * Ada karena permintaan tukar lauk adalah kejadian harian di rumah makan:
   * "nasambur tapi dadarnya diganti ayam". Menunya tetap yang itu, cuma
   * harganya berubah. Sebelum ini kasir tidak punya jalan sama sekali — mengganti
   * menu cuma bisa ke menu lain yang sudah terdaftar, dan diskon cuma bisa
   * menurunkan, tidak pernah menaikkan.
   *
   * ALASANNYA WAJIB, DAN ITU BUKAN FORMALITAS
   *
   * Kasir yang bisa menyetel harga apa pun tanpa jejak bisa menyetelnya jadi
   * Rp 0, menerima uang tunai pelanggannya, dan lacinya tetap cocok — karena
   * yang tercatat memang nol. Alasan, nama yang mengubah, dan selisihnya
   * tersimpan di riwayat yang sama dengan penggantian menu, jadi owner
   * membacanya di satu tempat.
   *
   * Alasannya juga ikut menempel ke catatan barisnya, supaya tercetak di tiket
   * dapur: yang memasak perlu tahu lauknya diganti, bukan cuma yang menagih.
   */
  async adjustOrderItemPrice(
    orderId: string,
    orderItemId: string,
    businessId: string,
    userId: string,
    opsi: { hargaBaru: number; reason: string },
  ): Promise<{ ok: boolean; error?: string; totalBaru?: number; selisih?: number }> {
    return sql.begin(async (tx) => {
      const order = one<Order>(await tx`
        SELECT * FROM orders WHERE id = ${orderId} AND business_id = ${businessId} FOR UPDATE
      `);
      if (!order) return { ok: false, error: "Pesanan tidak ditemukan." };

      if (order.payment_status === "paid") {
        return {
          ok: false,
          error:
            "Nota ini sudah dibayar, jadi harganya tidak bisa diubah begitu saja. Pakai Ganti / Refund supaya selisih uangnya tetap ada catatannya.",
        };
      }

      const item = one<OrderItem>(await tx`
        SELECT * FROM order_items WHERE id = ${orderItemId} AND order_id = ${orderId} FOR UPDATE
      `);
      if (!item) return { ok: false, error: "Menu ini tidak ada di nota tersebut." };
      if (item.cancelled_at) return { ok: false, error: "Menu ini sudah dibatalkan." };

      const alasan = opsi.reason?.trim();
      if (!alasan || alasan.length < 3) {
        return {
          ok: false,
          error: "Isi dulu alasannya, misalnya \"dadar diganti ayam\". Perubahan harga tanpa keterangan tidak bisa dipertanggungjawabkan saat tutup shift.",
        };
      }

      const hargaBaru = Math.round(Number(opsi.hargaBaru));
      if (!Number.isFinite(hargaBaru) || hargaBaru < 0 || hargaBaru > 100_000_000) {
        return { ok: false, error: "Harga barunya tidak masuk akal." };
      }

      const hargaLama = Number(item.price_snapshot);
      if (hargaBaru === hargaLama) {
        return { ok: false, error: "Harganya sama dengan yang sekarang." };
      }

      const selisih = (hargaBaru - hargaLama) * item.qty;

      /**
       * Riwayatnya menumpang tabel yang sama dengan penggantian menu.
       *
       * Keduanya menjawab pertanyaan yang sama — "kenapa baris ini tidak
       * seperti daftar menu?" — dan memisahkannya cuma memaksa owner membaca
       * dua laporan untuk satu pertanyaan.
       */
      await tx`
        INSERT INTO order_item_changes ${tx({
          business_id: businessId,
          order_id: orderId,
          order_item_id: orderItemId,
          old_menu_item_id: item.menu_item_id,
          old_name: item.name_snapshot,
          old_price: hargaLama,
          new_menu_item_id: item.menu_item_id,
          new_name: item.name_snapshot,
          new_price: hargaBaru,
          qty: item.qty,
          price_diff: selisih,
          // Belum lunas: yang ditagih nanti memang angka yang baru.
          settlement: "collect",
          reason: alasan,
          changed_by: userId,
        })}
      `;

      const catatanBaru = `${item.note ? item.note + " · " : ""}${alasan}`;

      await tx`
        UPDATE order_items SET
          price_snapshot = ${hargaBaru},
          subtotal = ${hargaBaru * item.qty},
          note = ${catatanBaru.slice(0, 200)}
        WHERE id = ${orderItemId}
      `;

      const sisa = (await tx`
        SELECT price_snapshot, qty FROM order_items
        WHERE order_id = ${orderId} AND cancelled_at IS NULL
      `) as unknown as { price_snapshot: string; qty: number }[];

      const biz = one<{ pos_tax_rate: string; pos_service_charge_rate: string }>(await tx`
        SELECT pos_tax_rate, pos_service_charge_rate FROM businesses WHERE id = ${businessId}
      `);
      const totals = calculateCartTotals(
        sisa.map((r) => ({ price: Number(r.price_snapshot), qty: r.qty })),
        Number(order.discount ?? 0),
        Number(biz?.pos_tax_rate ?? 0),
        Number(biz?.pos_service_charge_rate ?? 0),
      );
      const totalBaru = totals.total + Number(order.delivery_fee ?? 0);

      await tx`
        UPDATE orders SET
          subtotal = ${totals.subtotal},
          discount = ${totals.discount},
          tax = ${totals.tax},
          service_charge = ${totals.serviceCharge},
          total = ${totalBaru}
        WHERE id = ${orderId}
      `;

      return { ok: true, totalBaru, selisih };
    });
  },

  async cancelOrderItem(
    orderId: string,
    orderItemId: string,
    businessId: string,
    userId: string,
    opsi: {
      reason: string;
      disposition: "belum_dibuat" | "sudah_dibuat_dibuang" | "sudah_dibuat_disajikan";
    },
  ): Promise<{ ok: boolean; error?: string; totalBaru?: number; notaIkutBatal?: boolean }> {
    return sql.begin(async (tx) => {
      const order = one<Order>(await tx`
        SELECT * FROM orders WHERE id = ${orderId} AND business_id = ${businessId} FOR UPDATE
      `);
      if (!order) return { ok: false, error: "Pesanan tidak ditemukan." };

      /**
       * Nota yang sudah dibayar TIDAK boleh dibatalkan begitu saja.
       *
       * Uangnya sudah berpindah, jadi mengurangi tagihannya tanpa mengembalikan
       * uangnya berarti selisih kas yang tidak ada catatannya. Yang benar untuk
       * itu adalah refund, dan refund punya jejaknya sendiri.
       */
      if (order.payment_status === "paid") {
        return {
          ok: false,
          error:
            "Nota ini sudah dibayar, jadi menunya tidak bisa dibatalkan begitu saja. Pakai Pengembalian Dana (refund) supaya uang yang keluar tetap ada catatannya.",
        };
      }

      const item = one<OrderItem>(await tx`
        SELECT * FROM order_items WHERE id = ${orderItemId} AND order_id = ${orderId} FOR UPDATE
      `);
      if (!item) return { ok: false, error: "Menu ini tidak ada di nota tersebut." };
      if (item.cancelled_at) return { ok: false, error: "Menu ini sudah dibatalkan sebelumnya." };

      const alasan = opsi.reason?.trim();
      if (!alasan) {
        return { ok: false, error: "Isi dulu alasan pembatalannya." };
      }

      await tx`
        UPDATE order_items SET
          cancelled_at = NOW(),
          cancelled_by = ${userId},
          cancel_reason = ${alasan},
          cancel_disposition = ${opsi.disposition}
        WHERE id = ${orderItemId}
      `;

      const sisa = (await tx`
        SELECT price_snapshot, qty FROM order_items
        WHERE order_id = ${orderId} AND cancelled_at IS NULL
      `) as unknown as { price_snapshot: string; qty: number }[];

      /**
       * Nota yang seluruh menunya dibatalkan ikut dibatalkan.
       *
       * Nota kosong berisi nol rupiah tetap muncul di antrean kasir dan menahan
       * mejanya supaya tidak bisa ditutup — dan tidak ada satu pun cara
       * menyelesaikannya, karena memang tidak ada yang perlu dibayar.
       */
      if (!sisa.length) {
        await tx`
          UPDATE orders SET
            status = 'cancelled',
            fulfillment_status = 'cancelled',
            payment_status = CASE WHEN payment_status = 'pending' THEN 'failed' ELSE payment_status END,
            subtotal = 0, tax = 0, service_charge = 0, total = 0
          WHERE id = ${orderId}
        `;
        return { ok: true, totalBaru: 0, notaIkutBatal: true };
      }

      /**
       * Tagihannya dihitung ULANG dari menu yang tersisa, bukan dikurangi.
       *
       * Pajak dan service charge itu persentase: menguranginya sebesar harga
       * item yang batal akan meninggalkan sisa beberapa rupiah yang tidak
       * pernah cocok saat dijumlahkan. Diskon dan ongkir dipertahankan apa
       * adanya — keduanya keputusan tersendiri, bukan turunan dari isi nota.
       */
      const biz = one<{ pos_tax_rate: string; pos_service_charge_rate: string }>(await tx`
        SELECT pos_tax_rate, pos_service_charge_rate FROM businesses WHERE id = ${businessId}
      `);
      const totals = calculateCartTotals(
        sisa.map((r) => ({ price: Number(r.price_snapshot), qty: r.qty })),
        Math.min(Number(order.discount ?? 0), sisa.reduce((n, r) => n + Number(r.price_snapshot) * r.qty, 0)),
        Number(biz?.pos_tax_rate ?? 0),
        Number(biz?.pos_service_charge_rate ?? 0),
      );
      const totalBaru = totals.total + Number(order.delivery_fee ?? 0);

      await tx`
        UPDATE orders SET
          subtotal = ${totals.subtotal},
          discount = ${totals.discount},
          tax = ${totals.tax},
          service_charge = ${totals.serviceCharge},
          total = ${totalBaru}
        WHERE id = ${orderId}
      `;

      return { ok: true, totalBaru, notaIkutBatal: false };
    });
  },

  async replaceOrderItem(
    orderId: string,
    orderItemId: string,
    newMenuItemId: string,
    businessId: string,
    userId: string,
    settlement: ItemChangeSettlement,
    reason?: string,
  ): Promise<{
    ok: boolean;
    error?: string;
    newName: string;
    priceDiff: number;
    settlement: ItemChangeSettlement;
  }> {
    const gagal = (error: string) => ({
      ok: false as const,
      error,
      newName: "",
      priceDiff: 0,
      settlement: "none" as ItemChangeSettlement,
    });

    const unitCosts = await this.getMenuUnitCosts(businessId);

    return sql.begin(async (tx) => {
      const order = one<Order>(await tx`
        SELECT * FROM orders WHERE id = ${orderId} AND business_id = ${businessId} FOR UPDATE
      `);
      if (!order) return gagal("Pesanan tidak ditemukan.");
      if (order.status === "cancelled") return gagal("Pesanan ini sudah dibatalkan.");

      const oldItem = one<OrderItem>(await tx`
        SELECT * FROM order_items WHERE id = ${orderItemId} AND order_id = ${orderId} FOR UPDATE
      `);
      if (!oldItem) return gagal("Item pesanan tidak ditemukan.");

      const newMenu = one<MenuItem>(await tx`
        SELECT * FROM menu_items WHERE id = ${newMenuItemId} AND business_id = ${businessId}
      `);
      if (!newMenu) return gagal("Menu pengganti tidak ditemukan.");
      if (newMenu.id === oldItem.menu_item_id) return gagal("Menu penggantinya sama dengan yang lama.");

      const newUnitPrice = Number(newMenu.price);
      const newSubtotal = newUnitPrice * oldItem.qty;
      const priceDiff = newSubtotal - oldItem.subtotal;

      const sudahLunas = order.payment_status === "paid";

      /**
       * Selisih pada nota yang SUDAH lunas tidak boleh menggantung. Kasir harus
       * menyatakan uangnya ditagih, dikembalikan, atau ditanggung toko. Nota
       * yang belum dibayar tidak perlu: pelanggan tinggal membayar total baru.
       */
      let settlementDipakai: ItemChangeSettlement = "none";
      if (priceDiff !== 0 && sudahLunas) {
        if (settlement === "none") {
          return gagal(
            priceDiff > 0
              ? `Menu pengganti lebih mahal ${rupiahRingkas(priceDiff)}. Tentukan dulu: ditagih ke pelanggan, atau ditanggung toko.`
              : `Menu pengganti lebih murah ${rupiahRingkas(-priceDiff)}. Tentukan dulu: dikembalikan ke pelanggan, atau ditanggung toko.`,
          );
        }
        if (priceDiff > 0 && settlement === "refund") {
          return gagal("Menu penggantinya lebih mahal, jadi tidak ada yang bisa dikembalikan.");
        }
        if (priceDiff < 0 && settlement === "collect") {
          return gagal("Menu penggantinya lebih murah, jadi tidak ada tambahan yang bisa ditagih.");
        }
        settlementDipakai = settlement;
      } else if (priceDiff !== 0) {
        // Belum lunas: total berubah, pelanggan membayar angka yang baru.
        settlementDipakai = "collect";
      }

      // --- Riwayat pesanan aslinya, disimpan sebelum barisnya berubah. -------
      await tx`
        INSERT INTO order_item_changes ${tx({
          business_id: businessId,
          order_id: orderId,
          order_item_id: orderItemId,
          old_menu_item_id: oldItem.menu_item_id,
          old_name: oldItem.name_snapshot,
          old_price: oldItem.price_snapshot,
          new_menu_item_id: newMenu.id,
          new_name: newMenu.name,
          new_price: newUnitPrice,
          qty: oldItem.qty,
          price_diff: priceDiff,
          settlement: settlementDipakai,
          reason: reason?.trim() || null,
          changed_by: userId,
        })}
      `;

      const noteText = reason
        ? `${oldItem.note ? oldItem.note + " · " : ""}[Ganti: ${reason}]`
        : oldItem.note || null;

      await tx`
        UPDATE order_items SET
          menu_item_id = ${newMenu.id},
          name_snapshot = ${newMenu.name},
          price_snapshot = ${newUnitPrice},
          cost_snapshot = ${unitCosts.get(newMenu.id) ?? null},
          subtotal = ${newSubtotal},
          note = ${noteText}
        WHERE id = ${orderItemId}
      `;

      // --- Uangnya ----------------------------------------------------------
      // "waive" berarti toko menanggung selisihnya, jadi yang ditagih tidak
      // berubah sama sekali: totalnya tetap, dan selisih harga menu dicatat
      // sebagai diskon supaya laporan tetap menjumlahkan angka yang benar.
      if (settlementDipakai === "waive") {
        const diskonBaru = Number(order.discount) + Math.max(0, priceDiff);
        const alasanLama = order.discount_reason ? order.discount_reason + " · " : "";
        await tx`
          UPDATE orders SET
            subtotal = ${Math.max(0, Number(order.subtotal) + priceDiff)},
            discount = ${diskonBaru},
            discount_reason = ${alasanLama + `Penggantian menu ${oldItem.name_snapshot} → ${newMenu.name}`}
          WHERE id = ${orderId}
        `;
      } else {
        await tx`
          UPDATE orders SET
            subtotal = ${Math.max(0, Number(order.subtotal) + priceDiff)},
            total = ${Math.max(0, Number(order.total) + priceDiff)}
          WHERE id = ${orderId}
        `;
      }

      // Selisih yang dikembalikan ke pelanggan dicatat sebagai refund sungguhan,
      // supaya ikut terhitung saat kasir mencocokkan laci di akhir shift.
      if (settlementDipakai === "refund") {
        await tx`
          INSERT INTO refunds ${tx({
            order_id: orderId,
            order_item_id: orderItemId,
            amount: Math.abs(priceDiff),
            reason: `Selisih penggantian menu ${oldItem.name_snapshot} → ${newMenu.name}${reason ? ": " + reason.trim() : ""}`,
            reason_code: "stok_habis",
            method: order.payment_method === "cash" ? "cash" : order.payment_method,
            approved_by: userId,
            shift_id: order.shift_id,
          })}
        `;
      }

      // Nota lunas yang totalnya naik berarti masih ada yang harus dibayar.
      if (settlementDipakai === "collect" && sudahLunas && priceDiff > 0) {
        await tx`
          UPDATE orders SET payment_status = 'pending', status = 'open'
          WHERE id = ${orderId}
        `;
      }

      // --- Stoknya ----------------------------------------------------------
      // Hanya untuk pesanan yang bahannya memang sudah dipotong. Pesanan yang
      // belum lunas belum pernah menyentuh stok, jadi tidak ada yang perlu
      // dikembalikan.
      if (order.inventory_applied_at) {
        await this.adjustInventoryForItemSwap(
          tx,
          businessId,
          orderId,
          oldItem.menu_item_id,
          newMenu.id,
          oldItem.qty,
          userId,
          `${oldItem.name_snapshot} → ${newMenu.name} pada ${order.order_no}`,
        );
      }

      return { ok: true, newName: newMenu.name, priceDiff, settlement: settlementDipakai };
    });
  },

  /**
   * Mengembalikan bahan menu yang batal disajikan, lalu memotong bahan menu
   * penggantinya.
   *
   * Dicatat sebagai dua pergerakan terpisah, bukan satu selisih bersih. Saat
   * owner menelusuri kenapa stok susu berkurang, dia harus bisa melihat
   * kejadiannya, bukan cuma hasil akhirnya.
   */
  async adjustInventoryForItemSwap(
    tx: TransaksiSql,
    businessId: string,
    orderId: string,
    oldMenuItemId: string | null,
    newMenuItemId: string,
    qty: number,
    userId: string,
    note: string,
  ) {
    const kebutuhan = async (menuItemId: string) =>
      tx`
        SELECT inventory_item_id, SUM(required_qty) AS required_qty FROM (
          SELECT iri.inventory_item_id, (iri.qty_per_output * ${qty} / NULLIF(r.output_qty, 0)) AS required_qty
          FROM menu_items m
          JOIN recipes r ON r.id = m.recipe_id
          JOIN inventory_recipe_items iri ON iri.recipe_id = r.id
          WHERE m.id = ${menuItemId} AND m.business_id = ${businessId}
          UNION ALL
          SELECT m.inventory_item_id, (m.inventory_qty_per_sale * ${qty}) AS required_qty
          FROM menu_items m
          WHERE m.id = ${menuItemId} AND m.business_id = ${businessId}
            AND m.inventory_item_id IS NOT NULL AND m.inventory_qty_per_sale IS NOT NULL
            AND m.recipe_id IS NULL
        ) usage
        WHERE inventory_item_id IS NOT NULL
        GROUP BY inventory_item_id
      `;

    const gerak = async (inventoryItemId: string, delta: number, keterangan: string) => {
      const item = one<{ id: string; average_cost: number }>(await tx`
        SELECT id, average_cost FROM inventory_items
        WHERE id = ${inventoryItemId} AND business_id = ${businessId} FOR UPDATE
      `);
      if (!item) return;
      await tx`UPDATE inventory_items SET stock_qty = stock_qty + ${delta}, updated_at = NOW() WHERE id = ${item.id}`;
      await tx`INSERT INTO inventory_movements ${tx({
        business_id: businessId,
        inventory_item_id: item.id,
        movement_type: "adjustment",
        delta_qty: delta,
        unit_cost: num(item.average_cost),
        reference_type: "order",
        reference_id: orderId,
        created_by: userId,
        note: keterangan,
      })}`;
    };

    if (oldMenuItemId) {
      for (const need of await kebutuhan(oldMenuItemId)) {
        await gerak(need.inventory_item_id as string, num(need.required_qty), `Bahan kembali, penggantian menu: ${note}`);
      }
    }
    for (const need of await kebutuhan(newMenuItemId)) {
      await gerak(need.inventory_item_id as string, -num(need.required_qty), `Bahan terpakai, penggantian menu: ${note}`);
    }
  },

  /** Berapa lama pesanan swalayan boleh menunggu konfirmasi sebelum hangus. */
  PENDING_ORDER_MINUTES: 30,

  /**
   * Menghanguskan pesanan swalayan yang tidak pernah dibayar.
   *
   * Tanpa ini, satu orang iseng yang memesan lalu pergi meninggalkan barisnya
   * di antrean kasir selamanya, dan antrean yang penuh sampah berhenti dibaca
   * orang. Dijalankan saat antreannya dibuka, bukan lewat penjadwal: tidak ada
   * proses latar di serverless, dan yang paling butuh antreannya bersih justru
   * layar yang sedang membukanya.
   *
   * Hanya menyentuh pesanan dari QR. Pesanan kasir yang menunggu konfirmasi
   * QRIS ada orangnya di depan mesin, jadi tidak boleh hangus sendiri.
   */
  async expireStalePendingOrders(businessId: string): Promise<number> {
    const rows = await sql`
      UPDATE orders SET
        payment_status = 'expired',
        fulfillment_status = 'cancelled',
        status = 'cancelled'
      WHERE business_id = ${businessId}
        AND channel = 'qr'
        AND payment_status = 'pending'
        AND created_at < NOW() - (${this.PENDING_ORDER_MINUTES} * INTERVAL '1 minute')
      RETURNING id
    `;
    return rows.length;
  },

  /**
   * Antrean kasir: pesanan yang menunggu konfirmasi pembayaran, dan pesanan
   * lunas yang belum selesai dikerjakan dapur.
   */
  async getPendingQrOrders(businessId: string) {
    await this.expireStalePendingOrders(businessId);
    const orders = (await sql`
      SELECT * FROM orders
      WHERE business_id = ${businessId}
        AND (
          payment_status = 'pending'
          OR (payment_status = 'paid' AND fulfillment_status IN ('accepted', 'preparing', 'ready'))
        )
      ORDER BY created_at
    `) as unknown as Order[];
    return Promise.all(
      orders.map(async (o) => ({
        ...o,
        items: await this.getOrderItems(o.id),
      })),
    );
  },

  /**
   * Antrean yang dipakai tablet kasir dan layar dapur. Nama staf ikut diambil
   * agar tablet menjawab siapa yang sedang memegang pesanan, bukan hanya
   * menampilkan status abstrak yang harus ditebak antar staf.
   */
  async getOrderStationOrders(businessId: string) {
    await this.expireStalePendingOrders(businessId);
    const orders = (await sql`
      SELECT o.*, u.name AS claimed_by_name
      FROM orders o
      LEFT JOIN users u ON u.id = o.claimed_by
      WHERE o.business_id = ${businessId}
        -- Dulu di sini ada saringan channel = 'qr', dan itu berarti pesanan
        -- yang DIKETIK KASIR tidak pernah muncul di layar dapur sama sekali.
        -- Dapur cuma melihat pesanan dari QR meja; sisanya diteriakkan lewat
        -- mulut, dan saat ramai berarti ada yang tidak dimasak. Sekarang
        -- dua-duanya lewat antrean yang sama.
        AND o.payment_status IN ('pending', 'paid')
        AND o.fulfillment_status <> 'cancelled'
        /*
         * Pesanan yang uangnya BELUM masuk tetap ditahan di antrean, walaupun
         * dapur sudah menandainya selesai.
         *
         * Dulu saringannya membuang semua yang 'completed', dan itu membuat
         * nota yang belum dibayar lenyap dari layar kasir begitu makanannya
         * keluar — tidak ada lagi tombol untuk menagihnya, mejanya tidak bisa
         * ditutup, dan satu-satunya jejak tersisa cuma baris "belum bayar" di
         * riwayat yang tidak bisa diapa-apakan.
         */
        AND (o.payment_status = 'pending' OR o.fulfillment_status <> 'completed')
      ORDER BY o.created_at ASC
    `) as unknown as Order[];
    return Promise.all(orders.map(async (order) => ({
      ...order,
      items: await this.getOrderItems(order.id),
    })));
  },

  /**
   * Satu pesanan hanya boleh diambil oleh satu orang. Kondisi di WHERE bukan
   * sekadar aturan tampilan: dua tablet yang menekan tombol bersamaan tetap
   * tidak dapat membuat dua kasir merasa sedang mengerjakan order yang sama.
   */
  async claimOrder(
    orderId: string,
    businessId: string,
    userId: string,
  ): Promise<{ order: Order | null; error?: string }> {
    return sql.begin(async (tx) => {
      const existing = one<Order & { claimed_by_name?: string | null }>(await tx`
        SELECT o.*, u.name AS claimed_by_name
        FROM orders o LEFT JOIN users u ON u.id = o.claimed_by
        WHERE o.id = ${orderId} AND o.business_id = ${businessId}
        FOR UPDATE
      `);
      if (!existing || existing.payment_status !== "paid") return { order: null };
      if (existing.claimed_by && existing.claimed_by !== userId) {
        return { order: null, error: `Pesanan ini sudah diambil oleh ${existing.claimed_by_name ?? "staf lain"}.` };
      }
      const order = one<Order>(await tx`
        UPDATE orders SET
          claimed_by = ${userId},
          claimed_at = COALESCE(claimed_at, NOW()),
          fulfillment_status = CASE WHEN fulfillment_status = 'pending' THEN 'accepted' ELSE fulfillment_status END
        WHERE id = ${orderId} AND business_id = ${businessId}
        RETURNING *
      `);
      return { order };
    });
  },

  /**
   * Kasir menyatakan uangnya benar-benar diterima.
   *
   * Menyimpan siapa dan kapan, karena inilah satu-satunya bukti bahwa
   * pembayaran non-tunai itu terjadi: tidak ada gerbang pembayaran yang
   * mengabarkannya, jadi yang menjaminnya adalah orang yang menekan tombolnya.
   *
   * Syarat payment_status = 'pending' di WHERE membuat penekanan tombol dua
   * kali tidak menimpa penjamin pertama.
   *
   * Untuk tunai, uang yang disodorkan tamu WAJIB ada. Dulu tombolnya tidak
   * menanyakannya: struk pesanan antrean tidak bisa mencetak tunai diterima
   * dan kembalian, dan laporan owner tidak punya apa-apa untuk ditunjukkan.
   * Kembaliannya dihitung dari total baris yang dikunci di sini, bukan dari
   * angka di layar kasir — ongkir bisa saja berubah sesudah layarnya dibuka.
   */
  async confirmOrderPayment(
    orderId: string,
    businessId: string,
    confirmedBy: string,
    tunaiDiterima?: number | null,
  ): Promise<{ order: Order | null; error?: string }> {
    return sql.begin(async (tx) => {
      const pending = one<Order>(
        await tx`
        SELECT * FROM orders
        WHERE id = ${orderId} AND business_id = ${businessId} AND payment_status = 'pending'
        FOR UPDATE
      `,
      );
      if (!pending) return { order: null };

      let shiftId = pending.shift_id;
      let cashGiven: number | null = null;
      let cashChange: number | null = null;
      if (pending.payment_method === "cash") {
        const activeShift = one<Shift>(
          await tx`
          SELECT * FROM shifts WHERE business_id = ${businessId} AND closed_at IS NULL
          ORDER BY opened_at DESC LIMIT 1 FOR UPDATE
        `,
        );
        if (!activeShift) {
          return {
            order: null,
            error:
              "Buka shift kasir sebelum menerima pembayaran tunai dari pesanan QR.",
          };
        }
        shiftId = activeShift.id;

        const total = Number(pending.total);
        const diterima = Math.round(Number(tunaiDiterima));
        if (tunaiDiterima === null || tunaiDiterima === undefined || !Number.isFinite(diterima)) {
          return { order: null, error: "Isi dulu uang tunai yang diterima dari tamu." };
        }
        if (diterima < total) {
          return { order: null, error: "Uang tunai yang diterima kurang dari total tagihan." };
        }
        cashGiven = diterima;
        cashChange = diterima - total;
      }

      const order = one<Order>(
        await tx`
        UPDATE orders SET
        payment_status = 'paid',
        status = 'paid',
        fulfillment_status = CASE
          WHEN fulfillment_status = 'pending' THEN 'accepted'
          ELSE fulfillment_status
        END,
        paid_confirmed_by = ${confirmedBy},
        paid_confirmed_at = NOW(),
        shift_id = ${shiftId},
        cash_given = ${cashGiven},
        cash_change = ${cashChange}
        WHERE id = ${orderId} AND business_id = ${businessId}
      RETURNING *
      `,
      );
      return { order };
    });
  },

  /**
   * Mengurangi stok hanya setelah order berstatus lunas. Baris movement
   * memakai order sebagai referensi sehingga pengulangan action tidak akan
   * memotong stok dua kali.
   */
  async consumeInventoryForPaidOrder(
    orderId: string,
    businessId: string,
    userId: string,
  ) {
    return sql.begin(async (tx) => {
      const order = one<Order>(
        await tx`
        SELECT * FROM orders WHERE id = ${orderId} AND business_id = ${businessId}
          AND payment_status = 'paid' FOR UPDATE
      `,
      );
      if (!order)
        return {
          applied: false,
          shortages: [] as {
            name: string;
            required: number;
            available: number;
          }[],
        };
      const needs = await tx`
        SELECT inventory_item_id, SUM(required_qty) AS required_qty FROM (
          SELECT iri.inventory_item_id,
                 (iri.qty_per_output * oi.qty / NULLIF(r.output_qty, 0)) AS required_qty
          FROM order_items oi
          JOIN menu_items m ON m.id = oi.menu_item_id
          JOIN recipes r ON r.id = m.recipe_id
          JOIN inventory_recipe_items iri ON iri.recipe_id = r.id
          WHERE oi.order_id = ${orderId} AND oi.cancelled_at IS NULL
          UNION ALL
          SELECT m.inventory_item_id, (m.inventory_qty_per_sale * oi.qty) AS required_qty
          FROM order_items oi
          JOIN menu_items m ON m.id = oi.menu_item_id
          WHERE oi.order_id = ${orderId} AND oi.cancelled_at IS NULL AND m.inventory_item_id IS NOT NULL
            AND m.inventory_qty_per_sale IS NOT NULL AND m.recipe_id IS NULL
        ) usage
        GROUP BY inventory_item_id
      `;

      const shortages: { name: string; required: number; available: number }[] =
        [];
      for (const need of needs) {
        const prior = await tx`SELECT 1 FROM inventory_movements
          WHERE business_id = ${businessId} AND reference_type = 'order' AND reference_id = ${orderId}
            AND inventory_item_id = ${need.inventory_item_id as string} LIMIT 1`;
        if (prior.length) continue;
        const required = num(need.required_qty);
        const item = one<{
          id: string;
          name: string;
          stock_qty: number;
          average_cost: number;
        }>(
          await tx`
          SELECT id, name, stock_qty, average_cost FROM inventory_items
          WHERE id = ${need.inventory_item_id as string} AND business_id = ${businessId} FOR UPDATE
        `,
        );
        if (!item) continue;
        if (num(item.stock_qty) < required) {
          shortages.push({
            name: item.name,
            required,
            available: num(item.stock_qty),
          });
          continue;
        }
        await tx`UPDATE inventory_items SET stock_qty = stock_qty - ${required}, updated_at = NOW() WHERE id = ${item.id}`;
        await tx`INSERT INTO inventory_movements ${tx({
          business_id: businessId,
          inventory_item_id: item.id,
          movement_type: "sale_recipe",
          delta_qty: -required,
          unit_cost: num(item.average_cost),
          reference_type: "order",
          reference_id: orderId,
          created_by: userId,
          note: "Pengurangan otomatis dari pesanan " + order.order_no,
        })}`;
      }
      if (!shortages.length)
        await tx`UPDATE orders SET inventory_applied_at = NOW() WHERE id = ${orderId}`;
      return { applied: needs.length > 0, shortages };
    });
  },

  async syncPaidOrder(
    orderId: string,
    businessId: string,
    userId: string,
    /**
     * Poinnya sudah diurus pemanggil.
     *
     * Dipakai pembayaran satu meja: di sana poin dihitung SEKALI dari total
     * yang benar-benar dibayar, bukan per nota. Kalau di sini dihitung lagi,
     * satu belanja akan menghasilkan dua kali poin.
     */
    opsi?: { lewatiPoin?: boolean },
  ) {
    try {
      const order = one<Order>(
        await sql`SELECT * FROM orders WHERE id = ${orderId} AND business_id = ${businessId} AND payment_status = 'paid'`,
      );
      if (!order) return;
      if (opsi?.lewatiPoin) {
        /**
         * Ditandai sudah diproses supaya antrean sinkronisasi owner tidak
         * memberi poin kedua kalinya untuk nota yang sama.
         */
        await sql`UPDATE orders SET loyalty_applied_at = COALESCE(loyalty_applied_at, NOW()) WHERE id = ${orderId} AND business_id = ${businessId}`;
      } else if (order.customer_id && (await this.getLoyaltyProgram(businessId))) {
        await this.earnPointsFromPurchase(
          businessId,
          order.customer_id,
          num(order.total),
          userId,
          orderId,
        );
      } else {
        await sql`UPDATE orders SET loyalty_applied_at = NOW() WHERE id = ${orderId} AND business_id = ${businessId}`;
      }
      const stock = await this.consumeInventoryForPaidOrder(
        orderId,
        businessId,
        userId,
      );
      const message = stock.shortages.length
        ? "Stok kurang: " + stock.shortages.map((item) => item.name).join(", ")
        : null;
      await sql`UPDATE orders SET sync_error = ${message} WHERE id = ${orderId} AND business_id = ${businessId}`;
    } catch (error) {
      console.error("[KAEL] sinkronisasi order tertunda", orderId, error);
      try {
        await sql`UPDATE orders SET sync_error = 'Sinkronisasi tertunda. Coba ulang dari dashboard owner.' WHERE id = ${orderId} AND business_id = ${businessId}`;
      } catch {
        // Null completion timestamps keep this committed payment in the retry queue.
        console.error("[KAEL] status sinkronisasi belum tersimpan", orderId);
      }
    }
  },

  async getPendingOrderSync(businessId: string) {
    return (await sql`SELECT id, order_no, sync_error FROM orders WHERE business_id = ${businessId}
      AND payment_status = 'paid' AND (loyalty_applied_at IS NULL OR inventory_applied_at IS NULL OR sync_error IS NOT NULL)
      ORDER BY created_at LIMIT 100`) as unknown as {
      id: string;
      order_no: string;
      sync_error: string | null;
    }[];
  },

  /** Menandai pesanan gagal bayar. Dipakai kasir saat uangnya tidak pernah masuk. */
  async markOrderPaymentFailed(
    orderId: string,
    businessId: string,
  ): Promise<Order | null> {
    return one<Order>(
      await sql`
      UPDATE orders SET
        payment_status = 'failed',
        fulfillment_status = 'cancelled',
        status = 'cancelled'
      WHERE id = ${orderId} AND business_id = ${businessId}
        AND payment_status = 'pending'
      RETURNING *
    `,
    );
  },

  /**
   * Pembatalan (void) pesanan yang BELUM dibayar.
   *
   * Uang yang sudah diterima tidak bisa dibatalkan, cuma bisa dikembalikan.
   * Sebelum ini void menerima pesanan apa pun termasuk yang sudah lunas, dan
   * hasilnya nota hilang dari laporan penjualan tanpa satu pun baris yang
   * menjelaskan ke mana uangnya pergi — persis bentuk penyalahgunaan yang
   * paling sulit dilacak di kasir.
   *
   * Pesanan yang sudah lunas diarahkan ke refund, yang menyisakan jejak:
   * nominal, alasan, metode, siapa yang menyetujui, dan shift mana.
   */
  async cancelOrder(
    orderId: string,
    businessId: string,
    reason?: string,
    userId?: string,
  ): Promise<{ ok: boolean; error?: string; order?: Order }> {
    return sql.begin(async (tx) => {
      const order = one<Order>(await tx`
        SELECT * FROM orders WHERE id = ${orderId} AND business_id = ${businessId} FOR UPDATE
      `);
      if (!order) return { ok: false, error: "Pesanan tidak ditemukan." };
      if (order.status === "cancelled") return { ok: true, order };

      if (order.payment_status === "paid") {
        return {
          ok: false,
          error:
            "Pesanan ini sudah dibayar, jadi tidak bisa dibatalkan begitu saja. Pakai Pengembalian Dana (refund) supaya uang yang keluar tetap ada catatannya.",
        };
      }

      const updated = one<Order>(await tx`
        UPDATE orders SET
          fulfillment_status = 'cancelled',
          status = 'cancelled',
          payment_status = CASE WHEN payment_status = 'pending' THEN 'failed' ELSE payment_status END
        WHERE id = ${orderId} AND business_id = ${businessId}
        RETURNING *
      `);
      return { ok: true, order: updated! };
    }).then(async (hasil) => {
      if (hasil.ok && hasil.order && userId) {
        await this.recordAuditEvent({
          businessId,
          actorUserId: userId,
          action: "pos.order_cancelled",
          entityType: "order",
          entityId: orderId,
          metadata: { reason: reason ?? "Dibatalkan kasir dari antrean" },
        });
      }
      return hasil;
    });
  },

  /**
   * Kemajuan dapur. Hanya untuk pesanan yang SUDAH lunas: memasak sesuatu yang
   * belum dibayar adalah keputusan bisnis, bukan keadaan yang boleh terjadi
   * karena kasir salah tekan.
   */
  async setOrderFulfillment(
    orderId: string,
    businessId: string,
    status: Order["fulfillment_status"],
  ): Promise<Order | null> {
    return one<Order>(
      await sql`
      UPDATE orders SET fulfillment_status = ${status}
      WHERE id = ${orderId} AND business_id = ${businessId}
        AND status IN ('open', 'paid')
      RETURNING *
    `,
    );
  },

  async updateOrderStatus(
    orderId: string,
    businessId: string,
    status: Order["status"],
  ) {
    return one<Order>(
      await sql`
      UPDATE orders SET status = ${status}
      WHERE id = ${orderId} AND business_id = ${businessId} RETURNING *
    `,
    );
  },

  /**
   * Transaksi tidak pernah dihapus. Pengembalian dana adalah baris baru yang
   * menunjuk ke transaksi asli, dan hanya owner yang boleh menyetujuinya.
   */
  async refundOrder(
    orderId: string,
    businessId: string,
    amount: number,
    reason: string,
    /** Siapa yang melakukan refund — kasir maupun owner, keduanya boleh. */
    approvedByUserId: string,
    /**
     * Metode, kategori, dan item disimpan sebagai kolom sendiri — bukan
     * dijejalkan ke dalam kalimat alasan seperti "(Metode: CASH)". Kalimat bisa
     * dibaca manusia, tidak bisa dijumlahkan mesin, sehingga "berapa yang keluar
     * dari laci hari ini" tidak punya jawaban padahal itu yang dicocokkan kasir
     * tiap tutup shift.
     */
    opsi?: {
      method?: Refund["method"];
      reasonCode?: Refund["reason_code"];
      orderItemId?: string | null;
    },
  ) {
    return sql.begin(async (tx) => {
      const order = one<Order>(
        await tx`
        SELECT * FROM orders WHERE id = ${orderId} AND business_id = ${businessId} FOR UPDATE
      `,
      );
      if (!order || order.status !== "paid")
        return {
          success: false as const,
          error: "Transaksi lunas tidak ditemukan.",
        };
      const [sync] =
        await tx`SELECT loyalty_applied_at FROM orders WHERE id = ${orderId}`;
      if (order.customer_id && !sync.loyalty_applied_at)
        return {
          success: false as const,
          error: "Selesaikan pembaruan poin di dashboard owner sebelum refund.",
        };
      const existing =
        await tx`SELECT COALESCE(SUM(amount), 0) AS total FROM refunds WHERE order_id = ${orderId}`;
      const remaining = num(order.total) - num(existing[0]?.total);
      if (amount <= 0 || amount > remaining) {
        return {
          success: false as const,
          error: "Nominal refund melebihi nilai transaksi.",
        };
      }

      /**
       * Shift dibutuhkan kalau uangnya keluar dari LACI, dan itu ditentukan
       * metode refundnya — bukan cara pelanggan dulu membayar. Pelanggan yang
       * bayar QRIS tetap bisa dikembalikan tunai, dan uang itu tetap harus
       * muncul di rekap laci saat tutup shift.
       */
      const metodeRefund = opsi?.method ?? order.payment_method;
      let shiftId: string | null = null;
      if (metodeRefund === "cash") {
        const activeShift = one<Shift>(
          await tx`
          SELECT * FROM shifts WHERE business_id = ${businessId} AND closed_at IS NULL
          ORDER BY opened_at DESC LIMIT 1 FOR UPDATE
        `,
        );
        if (!activeShift)
          return {
            success: false as const,
            error: "Buka shift kasir sebelum mengeluarkan refund tunai.",
          };
        shiftId = activeShift.id;
      }

      const refund = one<Refund>(
        await tx`
        INSERT INTO refunds ${tx({
          order_id: orderId,
          order_item_id: opsi?.orderItemId ?? null,
          amount,
          reason,
          reason_code: opsi?.reasonCode ?? null,
          // Bawaannya mengikuti cara pelanggan membayar: uang yang masuk lewat
          // QRIS tidak lazim dikembalikan dari laci tunai.
          method: opsi?.method ?? order.payment_method,
          approved_by: approvedByUserId,
          shift_id: shiftId,
        })} RETURNING *
      `,
      )!;
      const [purchase] = await tx`SELECT delta, customer_id FROM point_ledger
        WHERE order_id = ${orderId} AND business_id = ${businessId} AND reason = 'purchase'`;
      if (purchase) {
        const [correction] =
          await tx`SELECT COALESCE(SUM(delta),0) AS delta FROM point_ledger
          WHERE order_id = ${orderId} AND business_id = ${businessId} AND reason = 'correction'`;
        const cumulativeRefund = num(existing[0]?.total) + amount;
        const target = -Math.min(
          num(purchase.delta),
          Math.floor(
            (num(purchase.delta) * cumulativeRefund) / num(order.total),
          ),
        );
        const delta = target - num(correction.delta);
        if (delta)
          await tx`INSERT INTO point_ledger ${tx({
            business_id: businessId,
            customer_id: purchase.customer_id,
            delta,
            reason: "correction",
            note: "Refund " + order.order_no,
            amount_spent: null,
            created_by: approvedByUserId,
            order_id: orderId,
          })}`;
      }
      return { success: true as const, refund };
    });
  },

  /**
   * Laporan POS. Batas "hari" mengikuti businesses.timezone, bukan UTC:
   * laporan harian sebuah warung berakhir 23:59 WIB. Salah di sini bikin
   * laporan tidak cocok dengan uang di laci, dan itu keluhan support yang
   * paling menghabiskan waktu.
   */
  async getPosReports(businessId: string) {
    const biz = await this.getBusiness(businessId);
    const tz = biz?.timezone || "Asia/Jakarta";

    const [today, month, allTime, salesByItem, byMethod] = await Promise.all([
      sql`
        WITH refunds_by_order AS (SELECT order_id, SUM(amount) AS total FROM refunds GROUP BY order_id)
        SELECT COUNT(*)::int AS orders, COALESCE(SUM(o.total - COALESCE(r.total, 0)), 0) AS revenue
        FROM orders o LEFT JOIN refunds_by_order r ON r.order_id = o.id
        WHERE o.business_id = ${businessId} AND o.status = 'paid'
          AND (o.created_at AT TIME ZONE ${tz})::date = (NOW() AT TIME ZONE ${tz})::date
      `,
      sql`
        WITH refunds_by_order AS (SELECT order_id, SUM(amount) AS total FROM refunds GROUP BY order_id)
        SELECT COUNT(*)::int AS orders, COALESCE(SUM(o.total - COALESCE(r.total, 0)), 0) AS revenue
        FROM orders o LEFT JOIN refunds_by_order r ON r.order_id = o.id
        WHERE o.business_id = ${businessId} AND o.status = 'paid'
          AND date_trunc('month', o.created_at AT TIME ZONE ${tz})
              = date_trunc('month', NOW() AT TIME ZONE ${tz})
      `,
      sql`
        WITH refunds_by_order AS (SELECT order_id, SUM(amount) AS total FROM refunds GROUP BY order_id)
        SELECT COUNT(*)::int AS orders, COALESCE(SUM(o.total - COALESCE(r.total, 0)), 0) AS revenue
        FROM orders o LEFT JOIN refunds_by_order r ON r.order_id = o.id
        WHERE o.business_id = ${businessId} AND o.status = 'paid'
      `,
      sql`
        WITH refunds_by_order AS (SELECT order_id, SUM(amount) AS total FROM refunds GROUP BY order_id)
        SELECT i.menu_item_id, i.name_snapshot AS name,
               COALESCE(SUM(i.qty * GREATEST(o.total - COALESCE(r.total, 0), 0)::numeric / NULLIF(o.total, 0)), 0) AS qty,
               COALESCE(SUM(i.subtotal * GREATEST(o.total - COALESCE(r.total, 0), 0)::numeric / NULLIF(o.total, 0)), 0) AS revenue,
               -- Modal yang DIKUNCI saat transaksi, bukan harga bahan hari ini.
               COALESCE(SUM(i.cost_snapshot * i.qty * GREATEST(o.total - COALESCE(r.total, 0), 0)::numeric / NULLIF(o.total, 0)), 0) AS hpp_terkunci,
               -- Berapa unit yang terjual tanpa modal yang diketahui. Dipakai
               -- menandai laporan "belum lengkap", bukan diam-diam dianggap nol.
               COALESCE(SUM(CASE WHEN i.cost_snapshot IS NULL THEN i.qty ELSE 0 END), 0) AS qty_tanpa_modal
        FROM order_items i
        JOIN orders o ON o.id = i.order_id
        LEFT JOIN refunds_by_order r ON r.order_id = o.id
        WHERE o.business_id = ${businessId} AND i.cancelled_at IS NULL AND o.status = 'paid'
        GROUP BY i.menu_item_id, i.name_snapshot
        ORDER BY qty DESC
      `,
      sql`
        WITH refunds_by_order AS (SELECT order_id, SUM(amount) AS total FROM refunds GROUP BY order_id)
        SELECT o.payment_method, COUNT(*)::int AS orders, COALESCE(SUM(o.total - COALESCE(r.total, 0)), 0) AS revenue
        FROM orders o LEFT JOIN refunds_by_order r ON r.order_id = o.id
        WHERE o.business_id = ${businessId} AND o.status = 'paid'
        GROUP BY o.payment_method ORDER BY revenue DESC
      `,
    ]);

    /**
     * Laba kotor, dihitung dari modal yang DIKUNCI saat tiap penjualan terjadi.
     *
     * Sebelum ini modalnya dihitung ulang dari harga bahan pada hari laporan
     * dibuka, jadi menaikkan harga satu bahan ikut mengubah laba bulan lalu.
     * Owner yang mencetak laporan yang sama dua kali dan mendapat dua angka
     * berbeda akan berhenti mempercayai laporannya, dan dia benar.
     *
     * Baris lama dari sebelum penguncian ada (cost_snapshot NULL) tetap
     * dihitung memakai modal hari ini, supaya laporan lama tidak mendadak
     * kosong — tapi jumlah unitnya dilaporkan terpisah lewat
     * `unitsWithoutCost`, supaya layar bisa berkata bagian mana yang masih
     * perkiraan alih-alih menyajikan semuanya seolah sama pastinya.
     */
    const unitCosts = await this.getMenuUnitCosts(businessId);

    /**
     * HPP satu baris laporan: yang terkunci, plus cadangan untuk baris lama.
     * Murni — dipanggil dua kali untuk baris yang masuk lima besar, jadi tidak
     * boleh menyimpan apa pun ke luar.
     */
    const hppUntukBaris = (row: Record<string, unknown>) => {
      const terkunci = num(row.hpp_terkunci);
      const qtyTanpaModal = num(row.qty_tanpa_modal);
      if (qtyTanpaModal <= 0) return { hpp: terkunci, unknownUnits: 0 };

      const modalSekarang = unitCosts.get(row.menu_item_id as string);
      // Menunya memang belum punya modal sampai sekarang. Tidak ditebak.
      if (modalSekarang == null) return { hpp: terkunci, unknownUnits: qtyTanpaModal };
      return { hpp: terkunci + modalSekarang * qtyTanpaModal, unknownUnits: 0 };
    };

    let totalEstimatedHpp = 0;
    let mappedRevenue = 0;
    let unitsWithoutCost = 0;

    for (const row of salesByItem) {
      const { hpp, unknownUnits } = hppUntukBaris(row as Record<string, unknown>);
      unitsWithoutCost += unknownUnits;
      if (hpp <= 0) continue;
      totalEstimatedHpp += hpp;
      mappedRevenue += num(row.revenue);
    }

    const totalNetRevenue = num(allTime[0]?.revenue);
    const topSellingItems = salesByItem.slice(0, 5).map((r) => {
      const revenue = num(r.revenue);
      const { hpp, unknownUnits } = hppUntukBaris(r as Record<string, unknown>);
      return {
        name: r.name as string,
        qty: num(r.qty),
        revenue,
        hpp,
        // Nol kalau menu belum punya modal. Ditampilkan apa adanya, tidak ditebak.
        grossProfit: hpp > 0 ? Math.max(0, revenue - hpp) : 0,
        /** Menunya belum punya resep maupun modal pokok, jadi labanya belum bisa dihitung. */
        costUnknown: unknownUnits > 0,
      };
    });

    // Dipakai kartu ringkasan yang mengakses per metode, misal .qris dan .cash.
    const paymentBreakdown: Record<string, number> = {
      cash: 0,
      qris: 0,
      transfer: 0,
    };
    for (const r of byMethod) {
      paymentBreakdown[r.payment_method as string] = num(r.revenue);
    }
    const byPaymentMethod = byMethod.map((r) => ({
      method: r.payment_method as string,
      orders: num(r.orders),
      revenue: num(r.revenue),
    }));

    return {
      today: { orders: num(today[0]?.orders), revenue: num(today[0]?.revenue) },
      month: { orders: num(month[0]?.orders), revenue: num(month[0]?.revenue) },
      totalNetRevenue,
      totalTransactions: num(allTime[0]?.orders),
      totalEstimatedHpp,
      totalEstimatedGrossProfit: Math.max(0, mappedRevenue - totalEstimatedHpp),
      /** Porsi omzet yang menunya sudah dipetakan ke resep. */
      hppCoverageRevenue: mappedRevenue,
      /**
       * Jumlah unit terjual yang modalnya tidak diketahui. Selama angka ini di
       * atas nol, laba di layar BELUM mencakup semua yang terjual — dan itu
       * harus tertulis, bukan disembunyikan di balik satu angka bulat.
       */
      unitsWithoutCost,
      topSellingItems,
      bestSellers: topSellingItems,
      paymentBreakdown,
      byPaymentMethod,
      timezone: tz,
    };
  },

  /**
   * Ringkasan operasional untuk owner. Semua angka ditarik dari tabel order
   * yang sama dengan terminal kasir, sehingga tidak ada salinan laporan yang
   * bisa tertinggal ketika transaksi baru masuk.
   */
  async getPosOwnerDashboard(businessId: string) {
    const biz = await this.getBusiness(businessId);
    const tz = biz?.timezone || "Asia/Jakarta";

    const [
      summary,
      queue,
      activeShifts,
      hourlySales,
      cashierSales,
      recentOrders,
      menuPerformance,
      pembayaran,
    ] = await Promise.all([
      sql`
        WITH refunded AS (SELECT order_id, SUM(amount) AS total FROM refunds GROUP BY order_id)
        SELECT
          COUNT(*) FILTER (WHERE o.status = 'paid')::int AS paid_orders,
          COALESCE(SUM(o.total - COALESCE(r.total, 0)) FILTER (WHERE o.status = 'paid'), 0) AS revenue,
          COALESCE(SUM(o.total - COALESCE(r.total, 0)) FILTER (WHERE o.status = 'paid' AND o.payment_method = 'cash'), 0) AS cash_revenue,
          COALESCE(SUM(o.total - COALESCE(r.total, 0)) FILTER (WHERE o.status = 'paid' AND o.payment_method = 'qris'), 0) AS qris_revenue,
          COALESCE(SUM(o.total - COALESCE(r.total, 0)) FILTER (WHERE o.status = 'paid' AND o.payment_method = 'transfer'), 0) AS transfer_revenue
        FROM orders o LEFT JOIN refunded r ON r.order_id = o.id
        WHERE o.business_id = ${businessId}
          AND (o.created_at AT TIME ZONE ${tz})::date = (NOW() AT TIME ZONE ${tz})::date
      `,
      sql`
        SELECT
          COUNT(*) FILTER (WHERE payment_status = 'pending')::int AS awaiting_payment,
          COUNT(*) FILTER (WHERE payment_status = 'paid' AND fulfillment_status IN ('accepted', 'preparing'))::int AS preparing,
          COUNT(*) FILTER (WHERE payment_status = 'paid' AND fulfillment_status = 'ready')::int AS ready
        FROM orders
        WHERE business_id = ${businessId}
          AND (created_at AT TIME ZONE ${tz})::date = (NOW() AT TIME ZONE ${tz})::date
          AND status <> 'cancelled'
      `,
      sql`
        SELECT s.*, u.name AS staff_name,
          COALESCE((SELECT SUM(o.total) FROM orders o WHERE o.shift_id = s.id AND o.status = 'paid' AND o.payment_method = 'cash'), 0)
          - COALESCE((SELECT SUM(r.amount) FROM refunds r JOIN orders o ON o.id = r.order_id WHERE r.shift_id = s.id AND o.payment_method = 'cash'), 0) AS cash_sales
        FROM shifts s
        LEFT JOIN users u ON u.id = s.opened_by
        WHERE s.business_id = ${businessId} AND s.closed_at IS NULL
        ORDER BY s.opened_at DESC
      `,
      sql`
        WITH refunded AS (SELECT order_id, SUM(amount) AS total FROM refunds GROUP BY order_id)
        SELECT
          EXTRACT(HOUR FROM o.created_at AT TIME ZONE ${tz})::int AS hour,
          COUNT(*)::int AS orders,
          COALESCE(SUM(o.total - COALESCE(r.total, 0)), 0) AS revenue
        FROM orders o LEFT JOIN refunded r ON r.order_id = o.id
        WHERE o.business_id = ${businessId} AND o.status = 'paid'
          AND (o.created_at AT TIME ZONE ${tz})::date = (NOW() AT TIME ZONE ${tz})::date
        GROUP BY 1
        ORDER BY hour
      `,
      sql`
        WITH refunded AS (SELECT order_id, SUM(amount) AS total FROM refunds GROUP BY order_id)
        SELECT
          COALESCE(NULLIF(TRIM(u.name), ''), 'Kasir') AS name,
          COUNT(*)::int AS orders,
          COALESCE(SUM(o.total - COALESCE(r.total, 0)), 0) AS revenue
        FROM orders o
        LEFT JOIN users u ON u.id = o.created_by
        LEFT JOIN refunded r ON r.order_id = o.id
        WHERE o.business_id = ${businessId} AND o.status = 'paid'
          AND (o.created_at AT TIME ZONE ${tz})::date = (NOW() AT TIME ZONE ${tz})::date
        GROUP BY u.id, u.name
        ORDER BY revenue DESC
      `,
      sql`
        SELECT o.*, COALESCE(r.refund_total, 0) AS refund_total FROM orders o
        LEFT JOIN (SELECT order_id, SUM(amount) AS refund_total FROM refunds GROUP BY order_id) r ON r.order_id = o.id
        WHERE o.business_id = ${businessId}
          AND (o.created_at AT TIME ZONE ${tz})::date = (NOW() AT TIME ZONE ${tz})::date
        ORDER BY o.created_at DESC
        LIMIT 12
      `,
      sql`
        WITH today_sales AS (
          SELECT 
            oi.menu_item_id,
            COALESCE(SUM(oi.qty), 0)::int AS qty,
            COALESCE(SUM(oi.subtotal), 0)::bigint AS revenue
          FROM order_items oi
          JOIN orders o ON o.id = oi.order_id
          WHERE o.business_id = ${businessId}
            AND oi.cancelled_at IS NULL
            AND o.status = 'paid'
            AND (o.created_at AT TIME ZONE ${tz})::date = (NOW() AT TIME ZONE ${tz})::date
          GROUP BY oi.menu_item_id
        ),
        week_sales AS (
          SELECT 
            oi.menu_item_id,
            COALESCE(SUM(oi.qty), 0)::int AS qty,
            COALESCE(SUM(oi.subtotal), 0)::bigint AS revenue
          FROM order_items oi
          JOIN orders o ON o.id = oi.order_id
          WHERE o.business_id = ${businessId}
            AND oi.cancelled_at IS NULL
            AND o.status = 'paid'
            AND o.created_at >= (NOW() - interval '7 days')
          GROUP BY oi.menu_item_id
        ),
        month_sales AS (
          SELECT 
            oi.menu_item_id,
            COALESCE(SUM(oi.qty), 0)::int AS qty,
            COALESCE(SUM(oi.subtotal), 0)::bigint AS revenue
          FROM order_items oi
          JOIN orders o ON o.id = oi.order_id
          WHERE o.business_id = ${businessId}
            AND oi.cancelled_at IS NULL
            AND o.status = 'paid'
            AND o.created_at >= (NOW() - interval '30 days')
          GROUP BY oi.menu_item_id
        )
        SELECT 
          m.id,
          m.name,
          m.price,
          m.is_available,
          c.name AS category_name,
          COALESCE(ts.qty, 0)::int AS today_qty,
          COALESCE(ts.revenue, 0)::bigint AS today_revenue,
          COALESCE(ws.qty, 0)::int AS week_qty,
          COALESCE(ws.revenue, 0)::bigint AS week_revenue,
          COALESCE(ms.qty, 0)::int AS month_qty,
          COALESCE(ms.revenue, 0)::bigint AS month_revenue
        FROM menu_items m
        LEFT JOIN categories c ON c.id = m.category_id
        LEFT JOIN today_sales ts ON ts.menu_item_id = m.id
        LEFT JOIN week_sales ws ON ws.menu_item_id = m.id
        LEFT JOIN month_sales ms ON ms.menu_item_id = m.id
        WHERE m.business_id = ${businessId}
        ORDER BY week_qty DESC, month_qty DESC, m.name ASC
      `,
      /**
       * Pembayaran hari ini, satu baris per peristiwa bayar — bukan per nota.
       *
       * Nota yang dilunasi bersama semeja (settleTableSession) dikenali dari
       * paid_confirmed_at yang SAMA PERSIS dengan dibayar_pada sesinya: keduanya
       * ditulis NOW() di transaksi yang sama. Nota semeja yang dibayar sendiri-
       * sendiri lebih dulu tetap jadi pembayarannya masing-masing.
       *
       * Himpunan notanya sama dengan ringkasan di atas (lunas, dibuat hari ini),
       * jadi jumlah per metode di sini selalu cocok dengan angka Tunai/QRIS/
       * Transfer yang sudah tampil.
       */
      sql`
        WITH refunded AS (SELECT order_id, SUM(amount) AS total FROM refunds GROUP BY order_id),
        nota AS (
          SELECT
            o.id, o.order_no, o.created_at, o.total, o.payment_method, o.table_no, o.service_type,
            o.cash_given, o.cash_change,
            COALESCE(r.total, 0) AS refund,
            ts.tunai_diterima, ts.kembalian,
            CASE WHEN ts.dibayar_pada IS NOT NULL AND o.paid_confirmed_at = ts.dibayar_pada
              THEN ts.id END AS sesi_id,
            CASE WHEN ts.dibayar_pada IS NOT NULL AND o.paid_confirmed_at = ts.dibayar_pada
              THEN ts.dibayar_pada ELSE COALESCE(o.paid_confirmed_at, o.created_at) END AS waktu_bayar,
            -- Yang menerima uangnya: kasir yang melunasi meja, yang menekan
            -- "Pembayaran sudah masuk", atau kasir yang mengetik pesanannya.
            CASE WHEN ts.dibayar_pada IS NOT NULL AND o.paid_confirmed_at = ts.dibayar_pada
              THEN ts.dibayar_oleh ELSE COALESCE(o.paid_confirmed_by, o.created_by) END AS penerima
          FROM orders o
          LEFT JOIN refunded r ON r.order_id = o.id
          LEFT JOIN table_sessions ts ON ts.id = o.table_session_id
          WHERE o.business_id = ${businessId} AND o.status = 'paid'
            AND (o.created_at AT TIME ZONE ${tz})::date = (NOW() AT TIME ZONE ${tz})::date
        )
        SELECT
          COALESCE(n.sesi_id, n.id)::text AS kunci,
          bool_or(n.sesi_id IS NOT NULL) AS lewat_meja,
          MIN(n.payment_method) AS metode,
          SUM(n.total) AS total,
          SUM(n.refund) AS refund,
          array_agg(n.order_no ORDER BY n.created_at) AS nota,
          MAX(n.table_no) AS meja,
          MIN(n.service_type) AS jenis_layanan,
          MAX(n.cash_given) AS cash_given,
          MAX(n.cash_change) AS cash_change,
          MAX(n.tunai_diterima) AS tunai_diterima,
          MAX(n.kembalian) AS kembalian,
          MAX(n.waktu_bayar) AS waktu_bayar,
          MIN(NULLIF(TRIM(u.name), '')) AS kasir
        FROM nota n
        LEFT JOIN users u ON u.id = n.penerima
        GROUP BY COALESCE(n.sesi_id, n.id)
        ORDER BY MAX(n.waktu_bayar) DESC
        LIMIT 500
      `,
    ]);

    const payment = summary[0] ?? {};
    const queueRow = queue[0] ?? {};
    const revenue = num(payment.revenue);
    const paidOrders = num(payment.paid_orders);

    const mappedMenuItems = (menuPerformance as any[]).map((row) => ({
      id: row.id as string,
      name: row.name as string,
      categoryName: (row.category_name as string | null) || "Lainnya",
      price: num(row.price),
      isAvailable: Boolean(row.is_available),
      todayQty: num(row.today_qty),
      todayRevenue: num(row.today_revenue),
      weekQty: num(row.week_qty),
      weekRevenue: num(row.week_revenue),
      monthQty: num(row.month_qty),
      monthRevenue: num(row.month_revenue),
    }));

    // Best sellers & slow movers for TODAY
    const todaySorted = [...mappedMenuItems].sort((a, b) => b.todayQty - a.todayQty || b.todayRevenue - a.todayRevenue);
    const todayBestSellers = todaySorted.filter((item) => item.todayQty > 0).slice(0, 8);
    const todaySlowMovers = [...mappedMenuItems]
      .filter((item) => item.isAvailable)
      .sort((a, b) => a.todayQty - b.todayQty || a.weekQty - b.weekQty || a.price - b.price)
      .slice(0, 8);

    // Best sellers & slow movers for 7 DAYS (WEEKLY - EVALUASI MINGGUAN)
    const weekSorted = [...mappedMenuItems].sort((a, b) => b.weekQty - a.weekQty || b.weekRevenue - a.weekRevenue);
    const weekBestSellers = weekSorted.filter((item) => item.weekQty > 0).slice(0, 8);
    const weekSlowMovers = [...mappedMenuItems]
      .filter((item) => item.isAvailable)
      .sort((a, b) => a.weekQty - b.weekQty || a.monthQty - b.monthQty || a.price - b.price)
      .slice(0, 8);

    // Best sellers & slow movers for 30 DAYS (MONTHLY)
    const monthSorted = [...mappedMenuItems].sort((a, b) => b.monthQty - a.monthQty || b.monthRevenue - a.monthRevenue);
    const monthBestSellers = monthSorted.filter((item) => item.monthQty > 0).slice(0, 8);
    const monthSlowMovers = [...mappedMenuItems]
      .filter((item) => item.isAvailable)
      .sort((a, b) => a.monthQty - b.monthQty || a.weekQty - b.weekQty || a.price - b.price)
      .slice(0, 8);

    return {
      timezone: tz,
      today: {
        paidOrders,
        revenue,
        averageOrder: paidOrders ? Math.round(revenue / paidOrders) : 0,
        payment: {
          cash: num(payment.cash_revenue),
          qris: num(payment.qris_revenue),
          transfer: num(payment.transfer_revenue),
        },
      },
      queue: {
        awaitingPayment: num(queueRow.awaiting_payment),
        preparing: num(queueRow.preparing),
        ready: num(queueRow.ready),
      },
      activeShifts: activeShifts.map((shift) => ({
        id: shift.id as string,
        openedAt: shift.opened_at as string,
        openingCash: num(shift.opening_cash),
        cashSales: num(shift.cash_sales),
        staffName: (shift.staff_name as string | null) || "Kasir",
      })),
      hourlySales: hourlySales.map((row) => ({
        hour: num(row.hour),
        orders: num(row.orders),
        revenue: num(row.revenue),
      })),
      cashierSales: cashierSales.map((row) => ({
        name: row.name as string,
        orders: num(row.orders),
        revenue: num(row.revenue),
      })),
      recentOrders: recentOrders as unknown as Order[],
      payments: (pembayaran as unknown as Record<string, unknown>[]).map((p): PembayaranHariIni => {
        const lewatMeja = Boolean(p.lewat_meja);
        const angkaAtauKosong = (v: unknown) => (v === null || v === undefined ? null : num(v));
        return {
          kunci: p.kunci as string,
          metode: p.metode as PembayaranHariIni["metode"],
          total: num(p.total),
          refund: num(p.refund),
          nota: (p.nota as string[] | null) ?? [],
          meja: (p.meja as string | null) ?? null,
          jenisLayanan: p.jenis_layanan as PembayaranHariIni["jenisLayanan"],
          lewatMeja,
          // Semeja: uangnya dicatat di kunjungan. Sendiri: di notanya.
          tunaiDiterima: angkaAtauKosong(lewatMeja ? p.tunai_diterima : p.cash_given),
          kembalian: angkaAtauKosong(lewatMeja ? p.kembalian : p.cash_change),
          dibayarPada: new Date(p.waktu_bayar as string | Date).toISOString(),
          kasir: (p.kasir as string | null) ?? null,
        };
      }),
      menuAnalytics: {
        totalMenuItems: mappedMenuItems.length,
        today: {
          bestSellers: todayBestSellers,
          slowMovers: weekSlowMovers, // Evaluasi mingguan untuk menu kurang laku
        },
        weekly: {
          bestSellers: weekBestSellers,
          slowMovers: weekSlowMovers,
        },
        monthly: {
          bestSellers: monthBestSellers,
          slowMovers: monthSlowMovers,
        },
      },
    };
  },

  /**
   * Mengambil daftar data transaksi, ulasan, dan shift yang dapat dipilih owner untuk dihapus.
   */
  async getDeletableTestData(businessId: string): Promise<DeletableTestData> {
    const [orders, feedbacks, shifts] = await Promise.all([
      sql<any[]>`
        SELECT 
          o.id,
          o.order_no,
          o.channel,
          o.table_no,
          o.status,
          o.total::int AS total,
          o.payment_method,
          o.created_at,
          c.name AS customer_name,
          COALESCE((SELECT COUNT(*) FROM order_items oi WHERE oi.order_id = o.id AND oi.cancelled_at IS NULL), 0)::int AS item_count
        FROM orders o
        LEFT JOIN customers c ON c.id = o.customer_id
        WHERE o.business_id = ${businessId}
        ORDER BY o.created_at DESC
        LIMIT 200
      `,
      sql<any[]>`
        SELECT 
          f.id,
          f.order_id,
          f.rating,
          f.reason_code,
          f.comment,
          f.created_at,
          o.order_no,
          c.name AS customer_name
        FROM member_feedback f
        LEFT JOIN orders o ON o.id = f.order_id
        LEFT JOIN customers c ON c.id = f.customer_id
        WHERE f.business_id = ${businessId}
        ORDER BY f.created_at DESC
        LIMIT 200
      `,
      sql<any[]>`
        SELECT 
          s.id,
          s.opened_at,
          s.closed_at,
          s.opening_cash::int AS opening_cash,
          s.closing_cash::int AS closing_cash,
          s.expected_cash::int AS expected_cash,
          s.variance::int AS variance,
          COALESCE(u.name, u.email, 'Kasir') AS opened_by_name,
          COALESCE((SELECT COUNT(*) FROM orders o WHERE o.shift_id = s.id), 0)::int AS order_count
        FROM shifts s
        LEFT JOIN users u ON u.id = s.opened_by
        WHERE s.business_id = ${businessId}
        ORDER BY s.opened_at DESC
        LIMIT 150
      `,
    ]);

    return {
      orders: orders.map((o) => ({
        id: o.id,
        order_no: o.order_no,
        channel: o.channel,
        table_no: o.table_no,
        status: o.status,
        total: Number(o.total) || 0,
        payment_method: o.payment_method,
        customer_name: o.customer_name,
        item_count: Number(o.item_count) || 0,
        created_at: o.created_at instanceof Date ? o.created_at.toISOString() : String(o.created_at),
      })),
      feedbacks: feedbacks.map((f) => ({
        id: f.id,
        order_id: f.order_id,
        order_no: f.order_no,
        rating: Number(f.rating) || 5,
        reason_code: f.reason_code,
        comment: f.comment,
        customer_name: f.customer_name,
        created_at: f.created_at instanceof Date ? f.created_at.toISOString() : String(f.created_at),
      })),
      shifts: shifts.map((s) => ({
        id: s.id,
        opened_by_name: s.opened_by_name,
        opened_at: s.opened_at instanceof Date ? s.opened_at.toISOString() : String(s.opened_at),
        closed_at: s.closed_at ? (s.closed_at instanceof Date ? s.closed_at.toISOString() : String(s.closed_at)) : null,
        opening_cash: Number(s.opening_cash) || 0,
        closing_cash: s.closing_cash !== null ? Number(s.closing_cash) : null,
        expected_cash: s.expected_cash !== null ? Number(s.expected_cash) : null,
        variance: s.variance !== null ? Number(s.variance) : null,
        order_count: Number(s.order_count) || 0,
      })),
    };
  },

  /**
   * Hapus daftar transaksi/order testing yang dipilih secara batch.
   */
  /**
   * Menyambungkan satu menu POS ke resepnya.
   *
   * Laporan laba mencari modal lewat kolom ini, bukan lewat kemiripan nama.
   * Jadi resep yang sudah diisi tapi belum disambungkan tetap tidak terbaca —
   * dan itu kegagalan yang paling membingungkan, karena semuanya terlihat sudah
   * dikerjakan.
   */
  async linkMenuItemToRecipe(
    menuItemId: string,
    recipeId: string,
    businessId: string,
  ): Promise<boolean> {
    const res = await sql`
      UPDATE menu_items SET recipe_id = ${recipeId}
      WHERE id = ${menuItemId} AND business_id = ${businessId}
      RETURNING id
    `;
    return res.length > 0;
  },

  /**
   * Menandai transaksi sebagai latihan, atau mencabut tandanya.
   *
   * Tanpa ini, pembatasan pembersihan massal ke `is_test` bikin fiturnya mati
   * total untuk toko sungguhan — dan owner yang baru latihan sebelum buka tetap
   * butuh cara merapikan transaksi coba-cobanya. Menandai adalah langkah yang
   * bisa dibatalkan; menghapus tidak.
   */
  async markOrdersAsTest(
    orderIds: string[],
    businessId: string,
    isTest: boolean,
  ): Promise<{ updatedCount: number }> {
    if (!orderIds?.length) return { updatedCount: 0 };
    const res = await sql`
      UPDATE orders SET is_test = ${isTest}
      WHERE id IN ${sql(orderIds)} AND business_id = ${businessId}
      RETURNING id
    `;
    return { updatedCount: res.length };
  },

  async deleteOrdersBatch(orderIds: string[], businessId: string): Promise<{ deletedCount: number }> {
    if (!orderIds || orderIds.length === 0) return { deletedCount: 0 };
    return sql.begin(async (tx) => {
      /**
       * Daftar id disaring dulu ke milik usaha ini, dan SEMUA penghapusan anak
       * memakai hasil saringan itu.
       *
       * Versi sebelumnya menghapus `refunds` dan `order_items` hanya berdasarkan
       * id yang dikirim pemanggil, tanpa memeriksa pesanan itu milik siapa.
       * Baris orders-nya memang aman karena disaring business_id, tapi refund
       * dan rincian item milik usaha LAIN tetap ikut terhapus — cukup dengan
       * menebak satu id pesanan tetangga.
       */
      const baris = await tx`
        SELECT id, table_session_id FROM orders
        WHERE id IN ${tx(orderIds)} AND business_id = ${businessId}
      `;
      const milikSendiri = baris.map((r) => r.id as string);
      if (!milikSendiri.length) return { deletedCount: 0 };

      // Dicatat SEBELUM pesanannya hilang: sesudah dihapus, jejak meja mana
      // yang terpengaruh ikut lenyap bersama barisnya.
      const sesiTerdampak = baris
        .map((r) => r.table_session_id as string | null)
        .filter((id): id is string => Boolean(id));

      await tx`DELETE FROM member_feedback WHERE order_id IN ${tx(milikSendiri)} AND business_id = ${businessId}`;
      await tx`DELETE FROM point_ledger WHERE order_id IN ${tx(milikSendiri)} AND business_id = ${businessId}`;
      await tx`DELETE FROM order_item_changes WHERE order_id IN ${tx(milikSendiri)} AND business_id = ${businessId}`;
      await tx`DELETE FROM refunds WHERE order_id IN ${tx(milikSendiri)}`;
      await tx`DELETE FROM order_items WHERE order_id IN ${tx(milikSendiri)}`;
      const res = await tx`DELETE FROM orders WHERE id IN ${tx(milikSendiri)} RETURNING id`;

      await bersihkanSesiMejaYatim(tx, businessId, sesiTerdampak);

      return { deletedCount: res.length };
    });
  },

  /**
   * Hapus daftar feedback/review testing yang dipilih secara batch.
   */
  async deleteFeedbackBatch(feedbackIds: string[], businessId: string): Promise<{ deletedCount: number }> {
    if (!feedbackIds || feedbackIds.length === 0) return { deletedCount: 0 };
    const res = await sql`
      DELETE FROM member_feedback WHERE id IN ${sql(feedbackIds)} AND business_id = ${businessId} RETURNING id
    `;
    return { deletedCount: res.length };
  },

  /**
   * Hapus daftar shift kasir testing yang dipilih secara batch.
   */
  async deleteShiftsBatch(shiftIds: string[], businessId: string): Promise<{ deletedCount: number }> {
    if (!shiftIds || shiftIds.length === 0) return { deletedCount: 0 };
    return sql.begin(async (tx) => {
      await tx`UPDATE orders SET shift_id = NULL WHERE shift_id IN ${sql(shiftIds)} AND business_id = ${businessId}`;
      const res = await tx`DELETE FROM shifts WHERE id IN ${sql(shiftIds)} AND business_id = ${businessId} RETURNING id`;
      return { deletedCount: res.length };
    });
  },

  /**
   * Hapus satu transaksi/order testing beserta relasi item, refund, feedback, dan poin.
   */
  async deleteOrder(orderId: string, businessId: string): Promise<boolean> {
    return sql.begin(async (tx) => {
      // Sesi mejanya dicatat dulu: sesudah pesanannya hilang, tidak ada lagi
      // yang menunjuk ke meja mana nota ini duduk.
      const induk = await tx`
        SELECT table_session_id FROM orders
        WHERE id = ${orderId} AND business_id = ${businessId}
      `;
      const sesi = induk[0]?.table_session_id as string | null | undefined;

      // 1. Delete associated feedback
      await tx`DELETE FROM member_feedback WHERE order_id = ${orderId} AND business_id = ${businessId}`;
      // 2. Delete point ledger entries tied to this order
      await tx`DELETE FROM point_ledger WHERE order_id = ${orderId} AND business_id = ${businessId}`;
      // 3. Delete refunds
      await tx`DELETE FROM refunds WHERE order_id = ${orderId}`;
      // 4. Delete order items
      await tx`DELETE FROM order_items WHERE order_id = ${orderId}`;
      // 5. Delete order
      const res = await tx`DELETE FROM orders WHERE id = ${orderId} AND business_id = ${businessId} RETURNING id`;

      // 6. Meja yang kehilangan seluruh notanya tidak boleh tetap "Disajikan"
      if (res.length && sesi) await bersihkanSesiMejaYatim(tx, businessId, [sesi]);

      return res.length > 0;
    });
  },

  /**
   * Hapus feedback/review testing tertentu.
   */
  async deleteFeedback(feedbackId: string, businessId: string): Promise<boolean> {
    const res = await sql`
      DELETE FROM member_feedback WHERE id = ${feedbackId} AND business_id = ${businessId} RETURNING id
    `;
    return res.length > 0;
  },

  /**
   * Hapus shift kasir testing.
   */
  async deleteShift(shiftId: string, businessId: string): Promise<boolean> {
    return sql.begin(async (tx) => {
      await tx`UPDATE orders SET shift_id = NULL WHERE shift_id = ${shiftId} AND business_id = ${businessId}`;
      const res = await tx`DELETE FROM shifts WHERE id = ${shiftId} AND business_id = ${businessId} RETURNING id`;
      return res.length > 0;
    });
  },

  /**
   * Pembersihan massal data testing untuk Owner.
   */
  async clearTestData(
    businessId: string,
    scope: "all_orders" | "all_feedback" | "all_shifts" | "everything",
  ): Promise<{ success: boolean; deletedCount: number }> {
    return sql.begin(async (tx) => {
      let count = 0;

      /**
       * SEMUA penghapusan di bawah dibatasi ke `is_test = TRUE`.
       *
       * Versi sebelumnya menjalankan `DELETE FROM orders WHERE business_id = ...`
       * tanpa satu pun saringan tentang apa itu "testing". Artinya satu klik
       * dari owner menghapus SELURUH riwayat penjualan tokonya — beserta refund,
       * rincian item, dan poin pembelian pelanggannya — dan tidak ada satu pun
       * cara mengembalikannya. Tombolnya bernama "Hapus Data Testing", jadi
       * tidak ada owner yang menduga itu yang akan terjadi.
       *
       * Sekarang yang bisa hilang cuma yang memang ditandai sebagai latihan.
       */
      if (scope === "all_orders" || scope === "everything") {
        const ujiSaja = tx`SELECT id FROM orders WHERE business_id = ${businessId} AND is_test`;

        // Dicatat sebelum penghapusan, selagi tautan ke mejanya masih ada.
        const sesiTerdampak = (
          await tx`
            SELECT DISTINCT table_session_id FROM orders
            WHERE business_id = ${businessId} AND is_test AND table_session_id IS NOT NULL
          `
        ).map((r) => r.table_session_id as string);

        await tx`DELETE FROM member_feedback WHERE business_id = ${businessId} AND order_id IN (${ujiSaja})`;
        await tx`DELETE FROM point_ledger WHERE business_id = ${businessId} AND order_id IN (${ujiSaja})`;
        await tx`DELETE FROM order_item_changes WHERE business_id = ${businessId} AND order_id IN (${ujiSaja})`;
        await tx`DELETE FROM refunds WHERE order_id IN (${ujiSaja})`;
        await tx`DELETE FROM order_items WHERE order_id IN (${ujiSaja})`;
        const delOrders = await tx`DELETE FROM orders WHERE business_id = ${businessId} AND is_test RETURNING id`;
        count += delOrders.length;

        await bersihkanSesiMejaYatim(tx, businessId, sesiTerdampak);
      }

      /**
       * Feedback tanpa pesanan induk tidak punya penanda uji sendiri, jadi yang
       * boleh dihapus massal hanya yang menempel pada transaksi latihan.
       * Ulasan pelanggan sungguhan dihapus satu per satu lewat layar pilihan,
       * bukan dengan satu tombol sapu bersih.
       */
      if (scope === "all_feedback" || scope === "everything") {
        const delFeedback = await tx`
          DELETE FROM member_feedback
          WHERE business_id = ${businessId}
            AND order_id IN (SELECT id FROM orders WHERE business_id = ${businessId} AND is_test)
          RETURNING id`;
        count += delFeedback.length;
      }

      /** Shift yang masih memegang transaksi sungguhan tidak boleh ikut hilang. */
      if (scope === "all_shifts" || scope === "everything") {
        const delShifts = await tx`
          DELETE FROM shifts
          WHERE business_id = ${businessId}
            AND NOT EXISTS (
              SELECT 1 FROM orders o
              WHERE o.shift_id = shifts.id AND NOT o.is_test
            )
          RETURNING id`;
        count += delShifts.length;
      }

      return { success: true, deletedCount: count };
    });
  },
  // =========================================================================
  // Finance operations, Ordering, Booking, and HR
  // =========================================================================

  async getSuppliers(businessId: string) {
    return await sql`SELECT * FROM suppliers WHERE business_id = ${businessId} ORDER BY name`;
  },

  async saveSupplier(
    businessId: string,
    data: {
      id?: string;
      name: string;
      phone?: string | null;
      email?: string | null;
      address?: string | null;
      payment_terms_days?: number;
      tax_number?: string | null;
    },
  ) {
    const row = {
      name: data.name,
      phone: data.phone ?? null,
      email: data.email ?? null,
      address: data.address ?? null,
      payment_terms_days: data.payment_terms_days ?? 0,
      tax_number: data.tax_number ?? null,
    };
    if (data.id) {
      const updated = one(
        await sql`UPDATE suppliers SET ${sql(row)} WHERE id = ${data.id} AND business_id = ${businessId} RETURNING *`,
      );
      if (updated) return updated;
    }
    return one(
      await sql`INSERT INTO suppliers ${sql({ business_id: businessId, ...row })} RETURNING *`,
    );
  },

  async createSupplierBill(
    businessId: string,
    userId: string,
    data: {
      supplier_id: string;
      bill_no: string;
      issued_on: string;
      due_on?: string | null;
      total_amount: number;
      note?: string | null;
    },
  ) {
    const supplier =
      await sql`SELECT 1 FROM suppliers WHERE id = ${data.supplier_id} AND business_id = ${businessId}`;
    if (!supplier.length) return null;
    return one(
      await sql`INSERT INTO supplier_bills ${sql({ business_id: businessId, created_by: userId, ...data, due_on: data.due_on ?? null, note: data.note ?? null, status: "open" })} RETURNING *`,
    );
  },

  async paySupplierBill(
    businessId: string,
    userId: string,
    billId: string,
    amount: number,
    paidOn: string,
    paymentMethod: "cash" | "transfer" | "qris" | "other",
    note?: string,
  ) {
    return sql.begin(async (tx) => {
      const bill = one<{ id: string; total_amount: number; status: string }>(
        await tx`SELECT * FROM supplier_bills WHERE id = ${billId} AND business_id = ${businessId} FOR UPDATE`,
      );
      if (!bill || !["open", "partial"].includes(bill.status)) return null;
      const paid =
        await tx`SELECT COALESCE(SUM(amount), 0) AS total FROM supplier_bill_payments WHERE bill_id = ${billId}`;
      if (num(paid[0]?.total) + amount > num(bill.total_amount)) return null;
      const payment = one(
        await tx`INSERT INTO supplier_bill_payments ${tx({ business_id: businessId, bill_id: billId, amount, paid_on: paidOn, payment_method: paymentMethod, note: note ?? null, created_by: userId })} RETURNING *`,
      );
      const status =
        num(paid[0]?.total) + amount === num(bill.total_amount)
          ? "paid"
          : "partial";
      await tx`UPDATE supplier_bills SET status = ${status} WHERE id = ${billId}`;
      return payment;
    });
  },

  async getPayables(businessId: string) {
    return await sql`
      SELECT b.*, s.name AS supplier_name, COALESCE((SELECT SUM(p.amount) FROM supplier_bill_payments p WHERE p.bill_id = b.id), 0) AS paid_amount
      FROM supplier_bills b JOIN suppliers s ON s.id = b.supplier_id
      WHERE b.business_id = ${businessId} AND b.status IN ('open', 'partial') ORDER BY b.due_on NULLS LAST, b.issued_on
    `;
  },

  async createStockOpname(
    businessId: string,
    userId: string,
    lines: { inventory_item_id: string; counted_qty: number; note?: string }[],
    note?: string,
  ) {
    return sql.begin(async (tx) => {
      const opname = one<{ id: string }>(
        await tx`INSERT INTO stock_opnames ${tx({ business_id: businessId, note: note ?? null, submitted_by: userId })} RETURNING id`,
      )!;
      for (const line of lines) {
        const item = one<{ stock_qty: number }>(
          await tx`SELECT stock_qty FROM inventory_items WHERE id = ${line.inventory_item_id} AND business_id = ${businessId}`,
        );
        if (!item) return null;
        await tx`INSERT INTO stock_opname_lines ${tx({ opname_id: opname.id, inventory_item_id: line.inventory_item_id, system_qty: item.stock_qty, counted_qty: line.counted_qty, note: line.note ?? null })}`;
      }
      await tx`UPDATE stock_opnames SET status = 'submitted', submitted_at = NOW() WHERE id = ${opname.id}`;
      return opname;
    });
  },

  async approveStockOpname(
    businessId: string,
    userId: string,
    opnameId: string,
    approve: boolean,
    rejectionNote?: string,
  ) {
    return sql.begin(async (tx) => {
      const opname = one<{ id: string; status: string }>(
        await tx`SELECT * FROM stock_opnames WHERE id = ${opnameId} AND business_id = ${businessId} FOR UPDATE`,
      );
      if (!opname || opname.status !== "submitted") return false;
      if (!approve) {
        await tx`UPDATE stock_opnames SET status = 'rejected', approved_by = ${userId}, approved_at = NOW(), rejection_note = ${rejectionNote ?? null} WHERE id = ${opnameId}`;
        return true;
      }
      const lines =
        await tx`SELECT l.*, i.stock_qty, i.average_cost FROM stock_opname_lines l JOIN inventory_items i ON i.id = l.inventory_item_id WHERE l.opname_id = ${opnameId} FOR UPDATE`;
      for (const line of lines) {
        const delta = num(line.counted_qty) - num(line.stock_qty);
        if (!delta) continue;
        await tx`UPDATE inventory_items SET stock_qty = ${line.counted_qty}, updated_at = NOW() WHERE id = ${line.inventory_item_id as string}`;
        await tx`INSERT INTO inventory_movements ${tx({ business_id: businessId, inventory_item_id: line.inventory_item_id, movement_type: "opname", delta_qty: delta, unit_cost: num(line.average_cost), reference_type: "stock_opname", reference_id: opnameId, created_by: userId, note: "Stock opname disetujui" })}`;
      }
      await tx`UPDATE stock_opnames SET status = 'approved', approved_by = ${userId}, approved_at = NOW() WHERE id = ${opnameId}`;
      return true;
    });
  },

  async getFormalFinanceReport(businessId: string, from: string, to: string) {
    const [manual, pos, inventory, payables, assets] = await Promise.all([
      sql`SELECT type, category, COALESCE(SUM(amount), 0) AS total, COALESCE(SUM(tax_amount), 0) AS tax FROM finance_transactions WHERE business_id = ${businessId} AND occurred_on BETWEEN ${from}::date AND ${to}::date GROUP BY type, category`,
      sql`SELECT COALESCE(SUM(total), 0) AS revenue FROM orders WHERE business_id = ${businessId} AND status = 'paid' AND created_at::date BETWEEN ${from}::date AND ${to}::date`,
      sql`SELECT COALESCE(SUM(ABS(delta_qty) * unit_cost) FILTER (WHERE delta_qty < 0), 0) AS cogs FROM inventory_movements WHERE business_id = ${businessId} AND created_at::date BETWEEN ${from}::date AND ${to}::date`,
      sql`SELECT COALESCE(SUM(b.total_amount - (SELECT COALESCE(SUM(p.amount), 0) FROM supplier_bill_payments p WHERE p.bill_id = b.id)), 0) AS total FROM supplier_bills b WHERE b.business_id = ${businessId} AND b.status IN ('open', 'partial')`,
      sql`SELECT COALESCE(SUM(purchase_cost - salvage_value), 0) AS total FROM finance_assets WHERE business_id = ${businessId} AND is_active = TRUE`,
    ]);
    const income =
      manual
        .filter((r) => r.type === "income")
        .reduce((sum, r) => sum + num(r.total), 0) + num(pos[0]?.revenue);
    const expenses = manual
      .filter((r) => r.type === "expense")
      .reduce((sum, r) => sum + num(r.total), 0);
    const cogs = num(inventory[0]?.cogs);
    return {
      income,
      expenses,
      cogs,
      grossProfit: income - cogs,
      netProfit: income - cogs - expenses,
      cashFlow: income - expenses,
      balanceSheet: {
        assets: num(assets[0]?.total),
        liabilities: num(payables[0]?.total),
        equity: num(assets[0]?.total) - num(payables[0]?.total),
      },
      categories: manual.map((r) => ({
        type: r.type as string,
        category: r.category as string,
        total: num(r.total),
        tax: num(r.tax),
      })),
    };
  },

  async getOrderingSettings(businessId: string) {
    const [settings, zones] = await Promise.all([
      one(
        await sql`SELECT * FROM ordering_settings WHERE business_id = ${businessId}`,
      ),
      sql`SELECT * FROM delivery_zones WHERE business_id = ${businessId} ORDER BY name`,
    ]);
    return { settings, zones };
  },

  async checkOrderingAvailability(businessId: string, total: number) {
    const [settings] =
      await sql`SELECT * FROM ordering_settings WHERE business_id = ${businessId}`;
    if (!settings) return { available: true as const };
    if (!settings.is_open)
      return {
        available: false as const,
        error: "Pemesanan sedang ditutup oleh toko.",
      };
    if (total < num(settings.minimum_order))
      return {
        available: false as const,
        error: `Minimum pesanan Rp ${num(settings.minimum_order).toLocaleString("id-ID")}.`,
      };
    if (settings.opens_at && settings.closes_at) {
      const business = await this.getBusiness(businessId);
      const time = new Intl.DateTimeFormat("en-GB", {
        timeZone: business?.timezone ?? "Asia/Jakarta",
        hour: "2-digit",
        minute: "2-digit",
        hourCycle: "h23",
      })
        .format(new Date())
        .replace(":", "");
      const open = String(settings.opens_at).slice(0, 5).replace(":", "");
      const close = String(settings.closes_at).slice(0, 5).replace(":", "");
      const inWindow =
        open <= close
          ? time >= open && time < close
          : time >= open || time < close;
      if (!inWindow)
        return {
          available: false as const,
          error: `Pemesanan dibuka pukul ${String(settings.opens_at).slice(0, 5)} sampai ${String(settings.closes_at).slice(0, 5)}.`,
        };
    }
    return { available: true as const };
  },

  async saveOrderingSettings(
    businessId: string,
    data: {
      is_open: boolean;
      minimum_order: number;
      opens_at?: string | null;
      closes_at?: string | null;
      delivery_enabled: boolean;
      pickup_enabled: boolean;
    },
  ) {
    return one(
      await sql`INSERT INTO ordering_settings ${sql({ business_id: businessId, ...data, opens_at: data.opens_at ?? null, closes_at: data.closes_at ?? null })} ON CONFLICT (business_id) DO UPDATE SET is_open = EXCLUDED.is_open, minimum_order = EXCLUDED.minimum_order, opens_at = EXCLUDED.opens_at, closes_at = EXCLUDED.closes_at, delivery_enabled = EXCLUDED.delivery_enabled, pickup_enabled = EXCLUDED.pickup_enabled, updated_at = NOW() RETURNING *`,
    );
  },

  async saveDeliveryZone(
    businessId: string,
    data: {
      id?: string;
      name: string;
      postal_codes: string[];
      fee: number;
      minimum_order: number;
      is_active: boolean;
    },
  ) {
    const row = {
      name: data.name,
      postal_codes: data.postal_codes,
      fee: data.fee,
      minimum_order: data.minimum_order,
      is_active: data.is_active,
    };
    if (data.id) {
      const updated = one(
        await sql`UPDATE delivery_zones SET ${sql(row)} WHERE id = ${data.id} AND business_id = ${businessId} RETURNING *`,
      );
      if (updated) return updated;
    }
    return one(
      await sql`INSERT INTO delivery_zones ${sql({ business_id: businessId, ...row })} RETURNING *`,
    );
  },

  async deleteDeliveryZone(businessId: string, zoneId: string) {
    const rows =
      await sql`DELETE FROM delivery_zones WHERE id = ${zoneId} AND business_id = ${businessId} RETURNING id`;
    return rows.length > 0;
  },

  async getBookingDashboard(businessId: string) {
    const [services, appointments, staff, schedules, waitlist, reminders] =
      await Promise.all([
        sql`SELECT * FROM booking_services WHERE business_id = ${businessId} ORDER BY name`,
        sql`SELECT a.*, s.name AS service_name, u.name AS staff_name FROM appointments a JOIN booking_services s ON s.id = a.service_id LEFT JOIN users u ON u.id = a.staff_user_id WHERE a.business_id = ${businessId} AND a.starts_at >= NOW() - INTERVAL '30 days' ORDER BY a.starts_at LIMIT 300`,
        sql`SELECT id, name FROM users WHERE business_id = ${businessId} AND role IN ('owner', 'staff') AND is_active = TRUE ORDER BY name`,
        sql`SELECT s.*, u.name AS staff_name FROM booking_schedules s LEFT JOIN users u ON u.id = s.user_id WHERE s.business_id = ${businessId} ORDER BY s.day_of_week, s.starts_at`,
        sql`SELECT w.*, s.name AS service_name FROM booking_waitlist w JOIN booking_services s ON s.id = w.service_id WHERE w.business_id = ${businessId} AND w.status IN ('waiting', 'notified') ORDER BY w.preferred_start NULLS LAST, w.created_at`,
        sql`SELECT r.*, a.customer_name, a.customer_phone, a.starts_at, s.name AS service_name FROM booking_reminders r JOIN appointments a ON a.id = r.appointment_id JOIN booking_services s ON s.id = a.service_id WHERE r.business_id = ${businessId} AND r.status = 'queued' ORDER BY r.scheduled_for LIMIT 100`,
      ]);
    const total = appointments.length;
    const completed = appointments.filter(
      (item) => item.status === "completed",
    ).length;
    const noShow = appointments.filter(
      (item) => item.status === "no_show",
    ).length;
    return {
      services,
      appointments,
      staff,
      schedules,
      waitlist,
      reminders,
      insights: {
        total,
        completed,
        noShow,
        noShowRate: total ? Math.round((noShow / total) * 100) : 0,
      },
    };
  },

  async saveBookingService(
    businessId: string,
    data: {
      id?: string;
      name: string;
      duration_minutes: number;
      price: number;
      deposit_amount: number;
      capacity: number;
      is_active: boolean;
    },
  ) {
    const row = {
      name: data.name,
      duration_minutes: data.duration_minutes,
      price: data.price,
      deposit_amount: data.deposit_amount,
      capacity: data.capacity,
      is_active: data.is_active,
    };
    if (data.id) {
      const updated = one(
        await sql`UPDATE booking_services SET ${sql(row)} WHERE id = ${data.id} AND business_id = ${businessId} RETURNING *`,
      );
      if (updated) return updated;
    }
    return one(
      await sql`INSERT INTO booking_services ${sql({ business_id: businessId, ...row })} RETURNING *`,
    );
  },

  async saveBookingSchedule(
    businessId: string,
    data: {
      id?: string;
      user_id?: string | null;
      day_of_week: number;
      starts_at: string;
      ends_at: string;
      slot_interval_minutes: number;
      is_active: boolean;
    },
  ) {
    const row = {
      user_id: data.user_id ?? null,
      day_of_week: data.day_of_week,
      starts_at: data.starts_at,
      ends_at: data.ends_at,
      slot_interval_minutes: data.slot_interval_minutes,
      is_active: data.is_active,
    };
    if (data.id)
      return one(
        await sql`UPDATE booking_schedules SET ${sql(row)} WHERE id = ${data.id} AND business_id = ${businessId} RETURNING *`,
      );
    return one(
      await sql`INSERT INTO booking_schedules ${sql({ business_id: businessId, ...row })} RETURNING *`,
    );
  },

  async deleteBookingSchedule(businessId: string, scheduleId: string) {
    const rows =
      await sql`DELETE FROM booking_schedules WHERE id = ${scheduleId} AND business_id = ${businessId} RETURNING id`;
    return rows.length > 0;
  },

  async getPublicBookingContext(storeCode: string) {
    const business = await this.getBusinessByStoreCode(storeCode);
    if (!business) return null;
    const [services, staff, schedules] = await Promise.all([
      sql`SELECT id, name, duration_minutes, price, deposit_amount, capacity FROM booking_services WHERE business_id = ${business.id} AND is_active = TRUE ORDER BY name`,
      sql`SELECT id, name FROM users WHERE business_id = ${business.id} AND role IN ('owner', 'staff') AND is_active = TRUE ORDER BY name`,
      sql`SELECT id, user_id, day_of_week, starts_at, ends_at, slot_interval_minutes FROM booking_schedules WHERE business_id = ${business.id} AND is_active = TRUE ORDER BY day_of_week, starts_at`,
    ]);
    return { business, services, staff, schedules };
  },

  async createAppointment(
    businessId: string,
    data: {
      service_id: string;
      staff_user_id?: string | null;
      customer_name: string;
      customer_phone: string;
      starts_at: string;
      note?: string | null;
    },
  ) {
    return sql.begin(async (tx) => {
      const service = one<{
        id: string;
        duration_minutes: number;
        deposit_amount: number;
        capacity: number;
      }>(
        await tx`SELECT * FROM booking_services WHERE id = ${data.service_id} AND business_id = ${businessId} AND is_active = TRUE`,
      );
      if (!service)
        return { appointment: null, error: "Layanan tidak tersedia." };
      const start = new Date(data.starts_at);
      if (
        Number.isNaN(start.getTime()) ||
        start.getTime() < Date.now() - 60_000
      )
        return {
          appointment: null,
          error: "Pilih jadwal booking yang masih akan datang.",
        };
      const end = new Date(
        start.getTime() + num(service.duration_minutes) * 60_000,
      );
      await tx`SELECT pg_advisory_xact_lock(hashtext(${`${businessId}:${service.id}:${data.staff_user_id ?? "any"}:${start.toISOString()}`}))`;
      const overlapping =
        await tx`SELECT COUNT(*)::int AS n FROM appointments WHERE business_id = ${businessId} AND service_id = ${service.id} AND status IN ('pending_deposit', 'confirmed') AND starts_at < ${end.toISOString()} AND ends_at > ${start.toISOString()} ${data.staff_user_id ? tx`AND staff_user_id = ${data.staff_user_id}` : tx``}`;
      if (num(overlapping[0]?.n) >= num(service.capacity))
        return { appointment: null, error: "Slot ini sudah penuh." };
      const deposit = num(service.deposit_amount);
      const appointment = one<{ id: string }>(
        await tx`INSERT INTO appointments ${tx({ business_id: businessId, service_id: service.id, staff_user_id: data.staff_user_id ?? null, customer_name: data.customer_name, customer_phone: data.customer_phone, starts_at: start.toISOString(), ends_at: end.toISOString(), status: deposit ? "pending_deposit" : "confirmed", deposit_amount: deposit, deposit_status: deposit ? "pending" : "not_required", note: data.note ?? null })} RETURNING *`,
      );
      if (appointment)
        await tx`INSERT INTO booking_reminders ${tx({ business_id: businessId, appointment_id: appointment.id, scheduled_for: new Date(start.getTime() - 24 * 60 * 60_000).toISOString() })}`;
      return { appointment, error: null };
    });
  },

  async updateAppointmentStatus(
    businessId: string,
    id: string,
    status: "confirmed" | "completed" | "cancelled" | "no_show",
  ) {
    return one(
      await sql`UPDATE appointments SET status = ${status}, cancelled_at = CASE WHEN ${status} = 'cancelled' THEN NOW() ELSE cancelled_at END WHERE id = ${id} AND business_id = ${businessId} RETURNING *`,
    );
  },

  async getPublicAppointment(token: string) {
    return one(
      await sql`
      SELECT a.*, b.name AS business_name, b.store_code, s.name AS service_name, s.duration_minutes
      FROM appointments a
      JOIN businesses b ON b.id = a.business_id
      JOIN booking_services s ON s.id = a.service_id
      WHERE a.public_token = ${token}
    `,
    );
  },

  async updatePublicAppointment(
    token: string,
    startsAt: string | null,
    cancel: boolean,
  ) {
    const appointment = (await this.getPublicAppointment(token)) as {
      id: string;
      business_id: string;
      service_id: string;
      staff_user_id: string | null;
      customer_name: string;
      customer_phone: string;
      note: string | null;
      status: string;
    } | null;
    if (
      !appointment ||
      !["pending_deposit", "confirmed"].includes(appointment.status)
    )
      return null;
    if (cancel)
      return one(
        await sql`UPDATE appointments SET status = 'cancelled', cancelled_at = NOW(), cancelled_by = 'customer' WHERE id = ${appointment.id} RETURNING *`,
      );
    if (!startsAt) return null;
    const replacement = await this.createAppointment(appointment.business_id, {
      service_id: appointment.service_id,
      staff_user_id: appointment.staff_user_id,
      customer_name: appointment.customer_name,
      customer_phone: appointment.customer_phone,
      starts_at: startsAt,
      note: appointment.note
        ? `${appointment.note} | Reschedule dari ${appointment.id}`
        : `Reschedule dari ${appointment.id}`,
    });
    if (!replacement.appointment) return null;
    await sql`UPDATE appointments SET status = 'cancelled', cancelled_at = NOW(), cancelled_by = 'customer_reschedule' WHERE id = ${appointment.id}`;
    return replacement.appointment;
  },

  async createBookingWaitlist(
    businessId: string,
    data: {
      service_id: string;
      customer_name: string;
      customer_phone: string;
      preferred_start?: string | null;
    },
  ) {
    return one(
      await sql`INSERT INTO booking_waitlist ${sql({ business_id: businessId, service_id: data.service_id, customer_name: data.customer_name, customer_phone: data.customer_phone, preferred_start: data.preferred_start ?? null })} RETURNING *`,
    );
  },

  async getHrDashboard(businessId: string) {
    const [
      staff,
      schedules,
      attendance,
      requests,
      periods,
      payrollLines,
      sites,
      policy,
      attendanceSummary,
    ] = await Promise.all([
      sql`SELECT id, name, role FROM users WHERE business_id = ${businessId} AND role IN ('owner', 'staff') AND is_active = TRUE ORDER BY name`,
      sql`SELECT s.*, u.name AS staff_name FROM staff_work_schedules s JOIN users u ON u.id = s.user_id WHERE s.business_id = ${businessId} AND s.ends_at >= NOW() - INTERVAL '30 days' ORDER BY s.starts_at LIMIT 300`,
      sql`SELECT a.*, u.name AS staff_name FROM attendance_records a JOIN users u ON u.id = a.user_id WHERE a.business_id = ${businessId} ORDER BY a.created_at DESC LIMIT 300`,
      sql`SELECT r.*, u.name AS staff_name FROM leave_requests r JOIN users u ON u.id = r.user_id WHERE r.business_id = ${businessId} ORDER BY r.created_at DESC LIMIT 100`,
      sql`SELECT p.*, COALESCE(SUM(l.base_pay + l.overtime_pay + l.incentive_pay + l.commission_pay - l.deduction), 0)::bigint AS total_pay FROM payroll_periods p LEFT JOIN payroll_lines l ON l.payroll_period_id = p.id WHERE p.business_id = ${businessId} GROUP BY p.id ORDER BY p.period_end DESC LIMIT 24`,
      sql`SELECT l.*, p.period_start, p.period_end, p.status AS period_status, u.name AS staff_name FROM payroll_lines l JOIN payroll_periods p ON p.id = l.payroll_period_id JOIN users u ON u.id = l.user_id WHERE p.business_id = ${businessId} ORDER BY p.period_end DESC, u.name LIMIT 500`,
      sql`SELECT * FROM attendance_sites WHERE business_id = ${businessId} AND is_active = TRUE ORDER BY name`,
      one(
        await sql`SELECT attendance_require_selfie, attendance_require_location, pos_require_scheduled_shift FROM businesses WHERE id = ${businessId}`,
      ),
      sql`SELECT u.id, u.name, COUNT(a.id)::int AS attendance_count, COUNT(a.id) FILTER (WHERE a.check_out_at IS NOT NULL)::int AS completed_count, COUNT(a.id) FILTER (WHERE a.check_out_at IS NULL)::int AS open_count, COALESCE(ROUND(SUM(EXTRACT(EPOCH FROM (COALESCE(a.check_out_at, NOW()) - a.check_in_at)) / 3600)::numeric, 1), 0) AS hours_worked FROM users u LEFT JOIN attendance_records a ON a.user_id = u.id AND a.business_id = ${businessId} AND a.check_in_at >= NOW() - INTERVAL '30 days' WHERE u.business_id = ${businessId} AND u.role IN ('owner', 'staff') AND u.is_active = TRUE GROUP BY u.id, u.name ORDER BY u.name`,
    ]);
    return {
      staff,
      schedules,
      attendance,
      requests,
      periods,
      payrollLines,
      sites,
      attendanceSummary,
      policy: policy ?? {
        attendance_require_selfie: true,
        attendance_require_location: true,
        pos_require_scheduled_shift: false,
      },
    };
  },

  async saveAttendancePolicy(
    businessId: string,
    policy: { requireSelfie: boolean; requireLocation: boolean },
  ) {
    return one(
      await sql`UPDATE businesses SET attendance_require_selfie = ${policy.requireSelfie}, attendance_require_location = ${policy.requireLocation} WHERE id = ${businessId} RETURNING id`,
    );
  },

  async setPosSchedulePolicy(businessId: string, required: boolean) {
    return one(
      await sql`UPDATE businesses SET pos_require_scheduled_shift = ${required} WHERE id = ${businessId} RETURNING id`,
    );
  },

  async saveAttendanceSite(
    businessId: string,
    data: {
      id?: string;
      name: string;
      google_place_id?: string | null;
      latitude?: number | null;
      longitude?: number | null;
      allowed_radius_meters: number;
      nfc_card_id?: string | null;
      is_active: boolean;
    },
  ) {
    const row = {
      name: data.name,
      google_place_id: data.google_place_id ?? null,
      latitude: data.latitude ?? null,
      longitude: data.longitude ?? null,
      allowed_radius_meters: data.allowed_radius_meters,
      nfc_card_id: data.nfc_card_id ?? null,
      is_active: data.is_active,
    };
    if (data.id)
      return one(
        await sql`UPDATE attendance_sites SET ${sql(row)} WHERE id = ${data.id} AND business_id = ${businessId} RETURNING *`,
      );
    return one(
      await sql`INSERT INTO attendance_sites ${sql({ business_id: businessId, ...row })} RETURNING *`,
    );
  },

  async getAttendanceSiteByToken(businessId: string, token: string) {
    return one(
      await sql`SELECT * FROM attendance_sites WHERE business_id = ${businessId} AND qr_token::text = ${token} AND is_active = TRUE`,
    );
  },

  async saveStaffSchedule(
    businessId: string,
    data: {
      user_id: string;
      starts_at: string;
      ends_at: string;
      role_label?: string | null;
      pos_shift_allowed: boolean;
    },
  ) {
    return sql.begin(async (tx) => {
      const user =
        await tx`SELECT 1 FROM users WHERE id = ${data.user_id} AND business_id = ${businessId} AND is_active = TRUE`;
      if (!user.length) return null;
      const conflict =
        await tx`SELECT 1 FROM staff_work_schedules WHERE business_id = ${businessId} AND user_id = ${data.user_id} AND status = 'scheduled' AND starts_at < ${data.ends_at}::timestamptz AND ends_at > ${data.starts_at}::timestamptz LIMIT 1`;
      if (conflict.length) return "conflict" as const;
      return one(
        await tx`INSERT INTO staff_work_schedules ${tx({ business_id: businessId, ...data, role_label: data.role_label ?? null })} RETURNING *`,
      );
    });
  },

  async cancelStaffSchedule(businessId: string, scheduleId: string) {
    return one(
      await sql`UPDATE staff_work_schedules SET status = 'cancelled' WHERE id = ${scheduleId} AND business_id = ${businessId} AND status = 'scheduled' RETURNING id`,
    );
  },

  async createLeaveRequest(
    businessId: string,
    userId: string,
    data: {
      leave_type: "leave" | "sick" | "permission" | "overtime";
      starts_at: string;
      ends_at: string;
      reason: string;
    },
  ) {
    return one(
      await sql`INSERT INTO leave_requests ${sql({ business_id: businessId, user_id: userId, ...data })} RETURNING *`,
    );
  },

  async reviewLeaveRequest(
    businessId: string,
    ownerId: string,
    requestId: string,
    approved: boolean,
  ) {
    return one(
      await sql`UPDATE leave_requests SET status = ${approved ? "approved" : "rejected"}, approved_by = ${ownerId}, approved_at = NOW() WHERE id = ${requestId} AND business_id = ${businessId} AND status = 'pending' RETURNING id`,
    );
  },

  async createPayrollPeriod(
    businessId: string,
    data: { period_start: string; period_end: string },
  ) {
    return sql.begin(async (tx) => {
      const period = one<{ id: string }>(
        await tx`INSERT INTO payroll_periods ${tx({ business_id: businessId, ...data })} ON CONFLICT (business_id, period_start, period_end) DO NOTHING RETURNING id`,
      );
      if (!period) return "exists" as const;
      await tx`INSERT INTO payroll_lines (payroll_period_id, user_id) SELECT ${period.id}, id FROM users WHERE business_id = ${businessId} AND role = 'staff' AND is_active = TRUE`;
      return period;
    });
  },

  async savePayrollLine(
    businessId: string,
    data: {
      payroll_period_id: string;
      user_id: string;
      base_pay: number;
      overtime_pay: number;
      incentive_pay: number;
      commission_pay: number;
      deduction: number;
      note?: string | null;
    },
  ) {
    return one(
      await sql`UPDATE payroll_lines l SET base_pay = ${data.base_pay}, overtime_pay = ${data.overtime_pay}, incentive_pay = ${data.incentive_pay}, commission_pay = ${data.commission_pay}, deduction = ${data.deduction}, note = ${data.note ?? null} FROM payroll_periods p WHERE l.payroll_period_id = ${data.payroll_period_id} AND l.user_id = ${data.user_id} AND l.payroll_period_id = p.id AND p.business_id = ${businessId} AND p.status = 'draft' RETURNING l.id`,
    );
  },

  async setPayrollPeriodStatus(
    businessId: string,
    ownerId: string,
    periodId: string,
    status: "approved" | "paid",
  ) {
    return one(
      await sql`UPDATE payroll_periods SET status = ${status}, approved_by = ${ownerId}, approved_at = NOW() WHERE id = ${periodId} AND business_id = ${businessId} AND ((status = 'draft' AND ${status} = 'approved') OR (status = 'approved' AND ${status} = 'paid')) RETURNING id`,
    );
  },

  async getLeaveRequestsForUser(businessId: string, userId: string) {
    return sql`SELECT * FROM leave_requests WHERE business_id = ${businessId} AND user_id = ${userId} ORDER BY created_at DESC LIMIT 50`;
  },

  async createAttendanceRecord(
    businessId: string,
    userId: string,
    data: {
      attendance_site_id?: string | null;
      latitude?: number | null;
      longitude?: number | null;
      selfie_url?: string | null;
      method: "self" | "qr" | "nfc" | "location";
      direction: "in" | "out";
    },
  ) {
    return sql.begin(async (tx) => {
      const open = one<{ id: string }>(
        await tx`SELECT id FROM attendance_records WHERE business_id = ${businessId} AND user_id = ${userId} AND check_out_at IS NULL ORDER BY created_at DESC LIMIT 1 FOR UPDATE`,
      );
      if (data.direction === "out") {
        if (!open) return null;
        return one(
          await tx`UPDATE attendance_records SET check_out_at = NOW(), check_out_latitude = ${data.latitude ?? null}, check_out_longitude = ${data.longitude ?? null}, check_out_selfie_url = ${data.selfie_url ?? null} WHERE id = ${open.id} RETURNING *`,
        );
      }
      if (open) return null;
      const schedule = one<{ id: string }>(
        await tx`SELECT id FROM staff_work_schedules WHERE business_id = ${businessId} AND user_id = ${userId} AND status = 'scheduled' AND NOW() BETWEEN starts_at - INTERVAL '2 hours' AND ends_at + INTERVAL '2 hours' ORDER BY starts_at DESC LIMIT 1`,
      );
      return one(
        await tx`INSERT INTO attendance_records ${tx({ business_id: businessId, user_id: userId, schedule_id: schedule?.id ?? null, attendance_site_id: data.attendance_site_id ?? null, check_in_at: new Date().toISOString(), check_in_latitude: data.latitude ?? null, check_in_longitude: data.longitude ?? null, check_in_selfie_url: data.selfie_url ?? null, method: data.method })} RETURNING *`,
      );
    });
  },

  // =========================================================================
  // KAEL admin control center. Never expose these aggregate queries publicly.
  // =========================================================================

  async getAdminControlCenter() {
    const [tenants, recentAudit] = await Promise.all([
      sql`
        SELECT b.id, b.name, b.business_type, b.is_demo, b.demo_expires_at, b.custom_domain,
          (SELECT COUNT(*)::int FROM users u WHERE u.business_id = b.id AND u.role = 'staff' AND u.is_active) AS staff_count,
          (SELECT COUNT(*)::int FROM business_modules m WHERE m.business_id = b.id AND m.status = 'active') AS active_modules,
          (SELECT COUNT(*)::int FROM inventory_items i WHERE i.business_id = b.id AND i.stock_qty <= i.reorder_level) AS low_stock,
          (SELECT COUNT(*)::int FROM appointments a WHERE a.business_id = b.id AND a.status = 'pending_deposit') AS pending_deposits,
          (SELECT COUNT(*)::int FROM orders o WHERE o.business_id = b.id AND o.payment_status = 'pending') AS pending_orders,
          (SELECT MAX(captured_at) FROM google_review_snapshots g WHERE g.business_id = b.id) AS last_review_sync,
          (SELECT provider FROM business_messaging_channels c WHERE c.business_id = b.id) AS messaging_provider,
          (SELECT is_enabled FROM business_messaging_channels c WHERE c.business_id = b.id) AS messaging_enabled
        FROM businesses b ORDER BY b.created_at DESC
      `,
      sql`
        SELECT e.*, b.name AS business_name, u.name AS actor_name
        FROM audit_events e LEFT JOIN businesses b ON b.id = e.business_id
        LEFT JOIN users u ON u.id = e.actor_user_id
        ORDER BY e.created_at DESC LIMIT 80
      `,
    ]);
    return { tenants, recentAudit };
  },

  async setAdminDemoExpiry(businessId: string, expiresAt: string | null) {
    return one(
      await sql`
      UPDATE businesses SET is_demo = ${Boolean(expiresAt)}, demo_expires_at = ${expiresAt}
      WHERE id = ${businessId} RETURNING id, is_demo, demo_expires_at
    `,
    );
  },

  async resetOwnerPasswordByAdmin(businessId: string, passwordHash: string) {
    return one<{ id: string; email: string }>(
      await sql`
      UPDATE users SET password_hash = ${passwordHash}, failed_pin_attempts = 0, locked_until = NULL
      WHERE business_id = ${businessId} AND role = 'owner' RETURNING id, email
    `,
    );
  },
};

export type Db = typeof db;
