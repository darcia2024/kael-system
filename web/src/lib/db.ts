import "server-only";
import { sql, DEFAULT_BUSINESS_ID } from "./postgres";
import { hashPin, verifyPin, isLegacyPinHash } from "./auth";
import { generateCardCode, generateActivationPin } from "./card-code";
import { hashClientIp, checkStaffLockout, calculateLockoutExpiry } from "./auth-security";
import { calculateRecipeHpp, type IngredientItem, type RecipeHppResult } from "./finance-engine";
import {
  normalizePhoneNumber,
  generateCustomerToken,
  generateRedemptionCode,
  calculateEarnedPoints,
} from "./loyalty-engine";
import {
  generateDailyOrderNo,
  calculateCartTotals,
  calculateShiftReconciliation,
} from "./pos-engine";
import type {
  Business, BusinessModule, User, Customer, Card, CardTap,
  Ingredient, IngredientPriceHistory, Recipe, LoyaltyProgram, PointLedger,
  Reward, Redemption, Category, MenuItem, Shift, Order, OrderItem, Refund,
} from "./types";

export * from "./types";
export { DEFAULT_BUSINESS_ID };

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

const one = <T,>(rows: readonly unknown[]): T | null =>
  (rows.length ? (rows[0] as T) : null);

/** Uang selalu bigint di Postgres; driver mengembalikannya sebagai string. */
const num = (v: unknown): number =>
  v === null || v === undefined ? 0 : typeof v === "number" ? v : Number(v);

export const db = {
  // =========================================================================
  // Bisnis, modul, pengguna
  // =========================================================================

  async getBusiness(id = DEFAULT_BUSINESS_ID): Promise<Business | null> {
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
      (owners as unknown as { business_id: string; name: string; email: string }[]).map((o) => [
        o.business_id,
        o,
      ]),
    );
    const staffBy = new Map(
      (staffCounts as unknown as { business_id: string; n: number }[]).map((s) => [
        s.business_id,
        s.n,
      ]),
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
  }): Promise<{ success: true; business: Business } | { success: false; error: string }> {
    const storeCode = input.storeCode.trim().toUpperCase();
    const email = input.ownerEmail.trim().toLowerCase();

    const codeTaken = await sql`
      SELECT 1 FROM businesses WHERE upper(store_code) = ${storeCode} LIMIT 1
    `;
    if (codeTaken.length) {
      return { success: false, error: `Kode toko ${storeCode} sudah dipakai usaha lain.` };
    }

    const emailTaken = await sql`SELECT 1 FROM users WHERE lower(email) = ${email} LIMIT 1`;
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
            google_place_id: input.googlePlaceId ? input.googlePlaceId.trim() : "",
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

        return created;
      });

      return { success: true, business: business as Business };
    } catch (e) {
      return { success: false, error: (e as Error).message };
    }
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
    return one<Business>(await sql`
      SELECT * FROM businesses WHERE upper(store_code) = upper(${code}) LIMIT 1
    `);
  },

  async updateBusiness(id: string, updates: Partial<Business>): Promise<Business | null> {
    const allowed = ["name", "category", "phone", "address", "google_place_id", "logo_url", "brand_color", "timezone"] as const;
    const patch = Object.fromEntries(
      Object.entries(updates).filter(([k]) => (allowed as readonly string[]).includes(k)),
    );
    if (!Object.keys(patch).length) return this.getBusiness(id);
    return one<Business>(
      await sql`UPDATE businesses SET ${sql(patch)} WHERE id = ${id} RETURNING *`,
    );
  },

  async getModules(businessId = DEFAULT_BUSINESS_ID): Promise<BusinessModule[]> {
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
  async getModuleAccess(businessId = DEFAULT_BUSINESS_ID) {
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
         WHERE o.business_id = ${businessId} AND o.status = 'paid'
           AND o.created_at >= now() - interval '30 days'
         GROUP BY oi.name_snapshot
         ORDER BY qty DESC
         LIMIT 1
      `,
    ]);

    const row = counts[0] as { paid_orders: number; customers: number; taps: number };
    const best = top[0] as { name: string; qty: number } | undefined;

    return {
      paidOrders30d: row?.paid_orders ?? 0,
      customers: row?.customers ?? 0,
      taps30d: row?.taps ?? 0,
      topItem: best ? { name: best.name, qty: best.qty } : null,
    };
  },

  async getUsers(businessId = DEFAULT_BUSINESS_ID): Promise<User[]> {
    return (await sql`
      SELECT * FROM users WHERE business_id = ${businessId} ORDER BY role, name
    `) as unknown as User[];
  },

  async getUserByEmail(email: string): Promise<User | null> {
    return one<User>(await sql`SELECT * FROM users WHERE email = ${email} LIMIT 1`);
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
    const user = one<User>(await sql`
      SELECT * FROM users
      WHERE id = ${userId} AND business_id = ${businessId}
        AND role = 'staff' AND is_active = TRUE
    `);
    if (!user) return { success: false as const, error: "Staf tidak ditemukan." };

    const lockout = checkStaffLockout(user.failed_pin_attempts, user.locked_until);
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
        error: "PIN perlu diatur ulang oleh pemilik usaha (format lama sudah tidak dipakai).",
      };
    }

    if (verifyPin(pin, user.pin_hash)) {
      await sql`
        UPDATE users SET failed_pin_attempts = 0, locked_until = NULL WHERE id = ${user.id}
      `;
      return { success: true as const, user };
    }

    const attempts = (user.failed_pin_attempts ?? 0) + 1;
    const lockedUntil = attempts >= 5 ? calculateLockoutExpiry().toISOString() : null;
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
      return { success: false as const, error: "Akun ini bukan akun pemilik usaha." };
    }
    if (!user.password_hash) {
      return {
        success: false as const,
        error: "Akun ini belum menyetel kata sandi. Hubungi tim KAEL untuk mengaturnya.",
      };
    }

    /**
     * Penguncian setelah 5 percobaan, memakai kolom yang sama dengan PIN staf.
     *
     * Ini bukan pelengkap. Kata sandi owner boleh berupa angka pendek, dan
     * angka pendek tanpa pembatas percobaan bisa ditebak habis oleh skrip dalam
     * hitungan menit. Yang menahan bukan panjangnya, tapi batas percobaannya.
     */
    const lockout = checkStaffLockout(user.failed_pin_attempts, user.locked_until);
    if (lockout.isLocked) {
      return {
        success: false as const,
        error: `Terlalu banyak percobaan. Coba lagi dalam ${lockout.remainingMinutes} menit.`,
      };
    }

    if (!verifyPin(password, user.password_hash)) {
      const attempts = (user.failed_pin_attempts ?? 0) + 1;
      const lockedUntil = attempts >= 5 ? calculateLockoutExpiry().toISOString() : null;
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
    return one<User>(await sql`
      INSERT INTO users ${sql({
        business_id: businessId,
        role: "staff",
        name,
        pin_hash: hashPin(pin),
        failed_pin_attempts: 0,
        is_active: true,
        permissions,
      })} RETURNING *
    `)!;
  },

  async setStaffPin(userId: string, businessId: string, pin: string): Promise<boolean> {
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

  // =========================================================================
  // Kartu dan tap (KAEL Review)
  // =========================================================================

  async getCardByCode(code: string): Promise<Card | null> {
    return one<Card>(await sql`SELECT * FROM cards WHERE card_code = ${code}`);
  },

  async getCards(businessId = DEFAULT_BUSINESS_ID): Promise<Card[]> {
    return (await sql`
      SELECT * FROM cards WHERE business_id = ${businessId} ORDER BY created_at
    `) as unknown as Card[];
  },

  /** Mencari bisnis berdasarkan Google Place ID */
  async getBusinessByGooglePlaceId(placeId: string): Promise<Business | null> {
    if (!placeId) return null;
    return one<Business>(await sql`SELECT * FROM businesses WHERE google_place_id = ${placeId} LIMIT 1`);
  },

  /** Membuat bisnis baru otomatis dari pilihan Google Places saat aktivasi kartu */
  async createBusinessFromPlace(data: { name: string; address: string; googlePlaceId: string }): Promise<Business> {
    let storeCode = data.name.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 8);
    if (storeCode.length < 3) storeCode = "TOKO" + Math.floor(100 + Math.random() * 900);

    const clash = await sql`SELECT 1 FROM businesses WHERE upper(store_code) = ${storeCode} LIMIT 1`;
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
  async createBatchCards(count: number, type: "review" | "loyalty" | "attendance" = "review") {
    const issued: { card_code: string; activation_pin: string }[] = [];
    for (let i = 0; i < count; i++) {
      const pin = generateActivationPin();
      let code = generateCardCode();
      for (let attempt = 0; attempt < 5; attempt++) {
        const clash = await sql`SELECT 1 FROM cards WHERE card_code = ${code} LIMIT 1`;
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
    destinationUrl: string,
    label = "Meja Kasir",
  ): Promise<{ success: boolean; error?: string; card?: Card }> {
    const card = await this.getCardByCode(code);
    if (!card) return { success: false, error: "Kartu tidak dikenali." };
    if (card.status === "suspended") return { success: false, error: "Kartu ini tidak aktif." };
    if (card.status === "active") return { success: false, error: "Kartu sudah pernah diaktivasi." };
    if (!verifyPin(pin, card.activation_pin_hash)) {
      return { success: false, error: "PIN aktivasi salah. Cek kertas di dalam kemasan." };
    }

    const updated = one<Card>(await sql`
      UPDATE cards SET
        business_id = ${businessId},
        status = 'active',
        destination_url = ${destinationUrl},
        label = ${label}
      WHERE id = ${card.id}
      RETURNING *
    `);
    return { success: true, card: updated! };
  },

  async updateCard(cardId: string, businessId: string, updates: Partial<Card>): Promise<Card | null> {
    const allowed = ["destination_url", "label", "status"] as const;
    const patch = Object.fromEntries(
      Object.entries(updates).filter(([k]) => (allowed as readonly string[]).includes(k)),
    );
    if (!Object.keys(patch).length) return null;
    return one<Card>(await sql`
      UPDATE cards SET ${sql(patch)}
      WHERE id = ${cardId} AND business_id = ${businessId}
      RETURNING *
    `);
  },

  /**
   * Dipanggil tanpa await oleh endpoint redirect supaya pengalihan tidak
   * menunggu database. Trigger Postgres yang menaikkan cards.tap_count.
   */
  async recordCardTap(cardId: string, source: "nfc" | "qr", ip: string, userAgent: string) {
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
  // Loyalty
  // =========================================================================

  async getLoyaltyProgram(businessId = DEFAULT_BUSINESS_ID): Promise<LoyaltyProgram | null> {
    return one<LoyaltyProgram>(await sql`
      SELECT * FROM loyalty_programs WHERE business_id = ${businessId} LIMIT 1
    `);
  },

  async updateLoyaltyProgram(businessId: string, updates: Partial<LoyaltyProgram>) {
    const allowed = ["mode", "earn_rate", "stamp_per_visit", "point_expiry_months"] as const;
    const patch = Object.fromEntries(
      Object.entries(updates).filter(([k]) => (allowed as readonly string[]).includes(k)),
    );
    if (!Object.keys(patch).length) return this.getLoyaltyProgram(businessId);
    return one<LoyaltyProgram>(await sql`
      UPDATE loyalty_programs SET ${sql({ ...patch, updated_at: new Date().toISOString() })}
      WHERE business_id = ${businessId} RETURNING *
    `);
  },

  async getCustomers(businessId = DEFAULT_BUSINESS_ID): Promise<Customer[]> {
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
  async getCustomersWithBalance(businessId = DEFAULT_BUSINESS_ID) {
    return (await sql`
      SELECT c.*, COALESCE(SUM(l.delta), 0)::int AS balance
      FROM customers c
      LEFT JOIN point_ledger l ON l.customer_id = c.id
      WHERE c.business_id = ${businessId}
      GROUP BY c.id
      ORDER BY c.created_at DESC
    `) as unknown as (Customer & { balance: number })[];
  },

  async getCustomerById(id: string, businessId: string): Promise<Customer | null> {
    return one<Customer>(await sql`
      SELECT * FROM customers WHERE id = ${id} AND business_id = ${businessId}
    `);
  },

  /**
   * Halaman pelanggan terbuka tanpa login, dijaga hanya oleh token yang tidak
   * bisa ditebak. Karena itu token tidak boleh ikut ke bundel browser, dan
   * pemanggilnya wajib komponen server.
   */
  async getCustomerByToken(token: string): Promise<Customer | null> {
    return one<Customer>(await sql`SELECT * FROM customers WHERE token = ${token}`);
  },

  async searchCustomers(businessId: string, query: string) {
    const q = "%" + query.trim() + "%";
    return (await sql`
      SELECT c.*, COALESCE(SUM(l.delta), 0)::int AS balance
      FROM customers c
      LEFT JOIN point_ledger l ON l.customer_id = c.id
      WHERE c.business_id = ${businessId}
        AND (c.phone ILIKE ${q} OR c.name ILIKE ${q})
      GROUP BY c.id
      ORDER BY c.created_at DESC
      LIMIT 20
    `) as unknown as (Customer & { balance: number })[];
  },

  async registerCustomer(businessId: string, name: string, rawPhone: string, birthday?: string) {
    const phone = normalizePhoneNumber(rawPhone);
    if (!phone) return { success: false as const, error: "Nomor WhatsApp tidak valid." };

    const existing = one<Customer>(await sql`
      SELECT * FROM customers WHERE business_id = ${businessId} AND phone = ${phone}
    `);
    if (existing) return { success: true as const, customer: existing, alreadyMember: true };

    const customer = one<Customer>(await sql`
      INSERT INTO customers ${sql({
        business_id: businessId,
        phone,
        name,
        birthday: birthday || null,
        token: generateCustomerToken(),
        consent_at: new Date().toISOString(),
      })} RETURNING *
    `)!;
    return { success: true as const, customer, alreadyMember: false };
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
  ): Promise<PointLedger> {
    return one<PointLedger>(await sql`
      INSERT INTO point_ledger ${sql({
        business_id: businessId,
        customer_id: customerId,
        delta,
        reason,
        note,
        amount_spent: amountSpent,
        created_by: staffUserId,
      })} RETURNING *
    `)!;
  },

  async earnPointsFromPurchase(
    businessId: string,
    customerId: string,
    amountSpent: number,
    staffUserId: string,
  ) {
    const program = await this.getLoyaltyProgram(businessId);
    if (!program) return null;
    const earned =
      program.mode === "stamp"
        ? program.stamp_per_visit
        : calculateEarnedPoints(amountSpent, program.earn_rate);
    if (earned <= 0) return null;
    return this.addPointTransaction(
      businessId, customerId, earned, "purchase",
      "Belanja Rp " + amountSpent.toLocaleString("id-ID"), amountSpent, staffUserId,
    );
  },

  async getRewards(businessId = DEFAULT_BUSINESS_ID): Promise<Reward[]> {
    return (await sql`
      SELECT * FROM rewards WHERE business_id = ${businessId} ORDER BY point_cost
    `) as unknown as Reward[];
  },

  async saveReward(businessId: string, data: Partial<Reward> & { id?: string }): Promise<Reward> {
    const row = {
      name: data.name!,
      point_cost: data.point_cost!,
      stock: data.stock ?? null,
      is_active: data.is_active ?? true,
    };
    if (data.id) {
      const updated = one<Reward>(await sql`
        UPDATE rewards SET ${sql(row)}
        WHERE id = ${data.id} AND business_id = ${businessId} RETURNING *
      `);
      if (updated) return updated;
    }
    return one<Reward>(await sql`
      INSERT INTO rewards ${sql({ ...row, business_id: businessId })} RETURNING *
    `)!;
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
  async issueRedemption(businessId: string, customerId: string, rewardId: string, staffUserId: string) {
    return sql.begin(async (tx) => {
      const reward = one<Reward>(await tx`
        SELECT * FROM rewards WHERE id = ${rewardId} AND business_id = ${businessId} FOR UPDATE
      `);
      if (!reward || !reward.is_active) {
        return { success: false as const, error: "Reward tidak tersedia." };
      }
      if (reward.stock !== null && reward.stock <= 0) {
        return { success: false as const, error: "Stok reward habis." };
      }

      const bal = await tx`
        SELECT COALESCE(SUM(delta), 0)::int AS balance
        FROM point_ledger WHERE customer_id = ${customerId}
      `;
      const balance = num(bal[0]?.balance);
      if (balance < reward.point_cost) {
        return {
          success: false as const,
          error: "Poin kurang. Saldo " + balance + ", butuh " + reward.point_cost + ".",
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

      const redemption = one<Redemption>(await tx`
        INSERT INTO redemptions ${tx({
          customer_id: customerId,
          reward_id: rewardId,
          code: generateRedemptionCode(),
          status: "issued",
          redeemed_by: staffUserId,
        })} RETURNING *
      `)!;

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
  async anonymizeCustomer(customerId: string, businessId: string): Promise<boolean> {
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
  async getStaffPointsAudit(businessId = DEFAULT_BUSINESS_ID) {
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
      id: string; name: string; points_issued: number;
      manual_count: number; total_entries: number;
    }[];
  },

  // =========================================================================
  // Finance
  // =========================================================================

  async getIngredients(businessId = DEFAULT_BUSINESS_ID): Promise<Ingredient[]> {
    return (await sql`
      SELECT * FROM ingredients WHERE business_id = ${businessId} ORDER BY name
    `) as unknown as Ingredient[];
  },

  async getIngredientsMap(businessId = DEFAULT_BUSINESS_ID): Promise<Map<string, IngredientItem>> {
    const rows = await this.getIngredients(businessId);
    return new Map(
      rows.map((i) => [
        i.id,
        {
          id: i.id, name: i.name,
          pack_price: num(i.pack_price), pack_size: num(i.pack_size),
          base_unit: i.base_unit,
        },
      ]),
    );
  },

  async createIngredient(
    businessId: string, name: string, packPrice: number, packSize: number,
    baseUnit: "gr" | "ml" | "pcs",
  ): Promise<Ingredient> {
    return one<Ingredient>(await sql`
      INSERT INTO ingredients ${sql({
        business_id: businessId, name, pack_price: packPrice,
        pack_size: packSize, base_unit: baseUnit,
      })} RETURNING *
    `)!;
  },

  /**
   * Mengubah harga bahan sekaligus menulis riwayatnya. Ini yang menjawab
   * "kenapa HPP saya naik?", dan yang membuat modul ini punya nilai berulang
   * alih-alih jadi kalkulator sekali pakai.
   */
  async updateIngredientPrice(id: string, businessId: string, newPackPrice: number) {
    return sql.begin(async (tx) => {
      const ing = one<Ingredient>(await tx`
        SELECT * FROM ingredients WHERE id = ${id} AND business_id = ${businessId} FOR UPDATE
      `);
      if (!ing) return null;

      await tx`
        INSERT INTO ingredient_price_history ${tx({
          ingredient_id: id, pack_price: num(ing.pack_price),
        })}
      `;
      return one<Ingredient>(await tx`
        UPDATE ingredients SET pack_price = ${newPackPrice}, updated_at = NOW()
        WHERE id = ${id} RETURNING *
      `);
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

  async getRecipes(businessId = DEFAULT_BUSINESS_ID): Promise<Recipe[]> {
    const recipes = (await sql`
      SELECT * FROM recipes WHERE business_id = ${businessId} ORDER BY name
    `) as unknown as Recipe[];
    if (!recipes.length) return [];

    const ids = recipes.map((r) => r.id);
    const ing = await sql`SELECT * FROM recipe_ingredients WHERE recipe_id = ANY(${ids})`;
    const pack = await sql`SELECT * FROM recipe_packaging WHERE recipe_id = ANY(${ids})`;

    return recipes.map((r) => ({
      ...r,
      ingredients: ing
        .filter((x) => x.recipe_id === r.id)
        .map((x) => ({ ingredient_id: x.ingredient_id as string, qty: num(x.qty) })),
      packaging: pack
        .filter((x) => x.recipe_id === r.id)
        .map((x) => ({ name: x.name as string, cost: num(x.cost) })),
    }));
  },

  async getAllRecipesWithCalculations(businessId = DEFAULT_BUSINESS_ID) {
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
        recipe = one<Recipe>(await tx`
          UPDATE recipes SET ${tx(row)}
          WHERE id = ${data.id} AND business_id = ${businessId} RETURNING *
        `);
      }
      if (!recipe) {
        recipe = one<Recipe>(await tx`
          INSERT INTO recipes ${tx({ ...row, business_id: businessId })} RETURNING *
        `)!;
      }

      await tx`DELETE FROM recipe_ingredients WHERE recipe_id = ${recipe.id}`;
      await tx`DELETE FROM recipe_packaging WHERE recipe_id = ${recipe.id}`;

      for (const i of data.ingredients ?? []) {
        await tx`INSERT INTO recipe_ingredients ${tx({
          recipe_id: recipe.id, ingredient_id: i.ingredient_id, qty: i.qty,
        })}`;
      }
      for (const p of data.packaging ?? []) {
        await tx`INSERT INTO recipe_packaging ${tx({
          recipe_id: recipe.id, name: p.name, cost: p.cost,
        })}`;
      }
      return { ...recipe, ingredients: data.ingredients ?? [], packaging: data.packaging ?? [] };
    });
  },

  // =========================================================================
  // POS dan Ordering
  // =========================================================================

  async getCategories(businessId = DEFAULT_BUSINESS_ID): Promise<Category[]> {
    return (await sql`
      SELECT * FROM categories WHERE business_id = ${businessId} ORDER BY sort_order, name
    `) as unknown as Category[];
  },

  async getMenuItems(businessId = DEFAULT_BUSINESS_ID): Promise<MenuItem[]> {
    return (await sql`
      SELECT * FROM menu_items WHERE business_id = ${businessId} ORDER BY sort_order, name
    `) as unknown as MenuItem[];
  },

  async updateMenuItemAvailability(id: string, businessId: string, isAvailable: boolean) {
    const rows = await sql`
      UPDATE menu_items SET is_available = ${isAvailable}, updated_at = NOW()
      WHERE id = ${id} AND business_id = ${businessId} RETURNING id
    `;
    return rows.length > 0;
  },

  async createMenuItem(businessId: string, data: Partial<MenuItem>): Promise<MenuItem> {
    return one<MenuItem>(await sql`
      INSERT INTO menu_items ${sql({
        business_id: businessId,
        category_id: data.category_id ?? null,
        name: data.name!,
        price: data.price ?? 0,
        photo_url: data.photo_url ?? null,
        is_available: data.is_available ?? true,
        recipe_id: data.recipe_id ?? null,
        sort_order: data.sort_order ?? 0,
      })} RETURNING *
    `)!;
  },

  async getActiveShift(businessId = DEFAULT_BUSINESS_ID): Promise<Shift | null> {
    return one<Shift>(await sql`
      SELECT * FROM shifts WHERE business_id = ${businessId} AND closed_at IS NULL
      ORDER BY opened_at DESC LIMIT 1
    `);
  },

  async getShifts(businessId = DEFAULT_BUSINESS_ID): Promise<Shift[]> {
    return (await sql`
      SELECT * FROM shifts WHERE business_id = ${businessId} ORDER BY opened_at DESC LIMIT 60
    `) as unknown as Shift[];
  },

  async openShift(businessId: string, staffUserId: string, openingCash: number, notes?: string) {
    const active = await this.getActiveShift(businessId);
    if (active) return { success: false as const, error: "Masih ada shift yang belum ditutup." };
    const shift = one<Shift>(await sql`
      INSERT INTO shifts ${sql({
        business_id: businessId, opened_by: staffUserId,
        opening_cash: openingCash, notes: notes ?? null,
      })} RETURNING *
    `)!;
    return { success: true as const, shift };
  },

  /**
   * Menutup shift menghitung selisih laci: uang fisik dibanding modal awal
   * ditambah seluruh penjualan tunai pada shift itu. Tanpa ini tidak ada cara
   * mencocokkan isi laci dengan catatan sistem.
   */
  async closeShift(shiftId: string, businessId: string, physicalClosingCash: number, notes?: string) {
    return sql.begin(async (tx) => {
      const shift = one<Shift>(await tx`
        SELECT * FROM shifts WHERE id = ${shiftId} AND business_id = ${businessId} FOR UPDATE
      `);
      if (!shift || shift.closed_at) return null;

      const cash = await tx`
        SELECT COALESCE(SUM(total), 0) AS cash_sales FROM orders
        WHERE shift_id = ${shiftId} AND payment_method = 'cash' AND status = 'paid'
      `;
      const recon = calculateShiftReconciliation(
        num(shift.opening_cash), num(cash[0]?.cash_sales), physicalClosingCash,
      );

      return one<Shift>(await tx`
        UPDATE shifts SET
          closed_at = NOW(),
          closing_cash = ${physicalClosingCash},
          expected_cash = ${recon.expectedCash},
          variance = ${recon.variance},
          notes = ${notes ?? shift.notes ?? null}
        WHERE id = ${shiftId} RETURNING *
      `);
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
    itemsData: { menu_item_id: string; name: string; price: number; qty: number; note?: string }[],
  ) {
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
      const total = subtotal - discount + tax + service;

      /**
       * Nomor urut harian mengikuti zona waktu bisnis, bukan UTC.
       *
       * Dengan CURRENT_DATE (UTC), transaksi jam 07:00 WIB dihitung sebagai
       * hari sebelumnya, sehingga penomoran mengulang dari 001 di tengah hari
       * kerja dan tidak cocok dengan laporan harian yang memang sudah memakai
       * AT TIME ZONE. Itu jenis selisih yang berakhir jadi tuduhan ke kasir.
       */
      const biz = await tx`SELECT timezone FROM businesses WHERE id = ${businessId}`;
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

      const order = one<Order>(await tx`
        INSERT INTO orders ${tx({
          business_id: businessId,
          order_no: orderNo,
          channel: orderData.channel,
          table_no: orderData.table_no ?? null,
          status: orderData.status ?? "paid",
          subtotal, discount, tax, service_charge: service, total,
          payment_method: orderData.payment_method,
          cash_given: cashGiven,
          cash_change: cashChange,
          customer_id: orderData.customer_id ?? null,
          shift_id: orderData.shift_id ?? null,
          created_by: orderData.created_by,
        })} RETURNING *
      `)!;

      const items: OrderItem[] = [];
      for (const i of itemsData) {
        items.push(one<OrderItem>(await tx`
          INSERT INTO order_items ${tx({
            order_id: order.id,
            menu_item_id: i.menu_item_id,
            name_snapshot: i.name,
            price_snapshot: i.price,
            qty: i.qty,
            subtotal: i.price * i.qty,
            note: i.note ?? null,
          })} RETURNING *
        `)!);
      }
      return { order, items };
    });
  },

  async getOrders(businessId = DEFAULT_BUSINESS_ID, limit = 50): Promise<Order[]> {
    return (await sql`
      SELECT * FROM orders WHERE business_id = ${businessId}
      ORDER BY created_at DESC LIMIT ${limit}
    `) as unknown as Order[];
  },

  async getOrderItems(orderId: string): Promise<OrderItem[]> {
    return (await sql`
      SELECT * FROM order_items WHERE order_id = ${orderId} ORDER BY id
    `) as unknown as OrderItem[];
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

  async getPendingQrOrders(businessId = DEFAULT_BUSINESS_ID) {
    const orders = (await sql`
      SELECT * FROM orders
      WHERE business_id = ${businessId} AND channel <> 'cashier' AND status = 'open'
      ORDER BY created_at
    `) as unknown as Order[];
    return Promise.all(
      orders.map(async (o) => ({ ...o, items: await this.getOrderItems(o.id) })),
    );
  },

  async updateOrderStatus(orderId: string, businessId: string, status: Order["status"]) {
    return one<Order>(await sql`
      UPDATE orders SET status = ${status}
      WHERE id = ${orderId} AND business_id = ${businessId} RETURNING *
    `);
  },

  /**
   * Transaksi tidak pernah dihapus. Pengembalian dana adalah baris baru yang
   * menunjuk ke transaksi asli, dan hanya owner yang boleh menyetujuinya.
   */
  async refundOrder(orderId: string, businessId: string, amount: number, reason: string, ownerUserId: string) {
    return sql.begin(async (tx) => {
      const order = one<Order>(await tx`
        SELECT * FROM orders WHERE id = ${orderId} AND business_id = ${businessId} FOR UPDATE
      `);
      if (!order) return { success: false as const, error: "Transaksi tidak ditemukan." };
      if (order.status === "refunded") return { success: false as const, error: "Transaksi sudah direfund." };
      if (amount <= 0 || amount > num(order.total)) {
        return { success: false as const, error: "Nominal refund melebihi nilai transaksi." };
      }

      const refund = one<Refund>(await tx`
        INSERT INTO refunds ${tx({
          order_id: orderId, amount, reason, approved_by: ownerUserId,
        })} RETURNING *
      `)!;
      await tx`UPDATE orders SET status = 'refunded' WHERE id = ${orderId}`;
      return { success: true as const, refund };
    });
  },

  /**
   * Laporan POS. Batas "hari" mengikuti businesses.timezone, bukan UTC:
   * laporan harian sebuah warung berakhir 23:59 WIB. Salah di sini bikin
   * laporan tidak cocok dengan uang di laci, dan itu keluhan support yang
   * paling menghabiskan waktu.
   */
  async getPosReports(businessId = DEFAULT_BUSINESS_ID) {
    const biz = await this.getBusiness(businessId);
    const tz = biz?.timezone || "Asia/Jakarta";

    const [today, month, allTime, top, byMethod] = await Promise.all([
      sql`
        SELECT COUNT(*)::int AS orders, COALESCE(SUM(total), 0) AS revenue
        FROM orders WHERE business_id = ${businessId} AND status = 'paid'
          AND (created_at AT TIME ZONE ${tz})::date = (NOW() AT TIME ZONE ${tz})::date
      `,
      sql`
        SELECT COUNT(*)::int AS orders, COALESCE(SUM(total), 0) AS revenue
        FROM orders WHERE business_id = ${businessId} AND status = 'paid'
          AND date_trunc('month', created_at AT TIME ZONE ${tz})
              = date_trunc('month', NOW() AT TIME ZONE ${tz})
      `,
      sql`
        SELECT COUNT(*)::int AS orders, COALESCE(SUM(total), 0) AS revenue
        FROM orders WHERE business_id = ${businessId} AND status = 'paid'
      `,
      sql`
        SELECT i.menu_item_id, i.name_snapshot AS name,
               SUM(i.qty)::int AS qty, COALESCE(SUM(i.subtotal), 0) AS revenue
        FROM order_items i
        JOIN orders o ON o.id = i.order_id
        WHERE o.business_id = ${businessId} AND o.status = 'paid'
        GROUP BY i.menu_item_id, i.name_snapshot
        ORDER BY qty DESC
        LIMIT 25
      `,
      sql`
        SELECT payment_method, COUNT(*)::int AS orders, COALESCE(SUM(total), 0) AS revenue
        FROM orders WHERE business_id = ${businessId} AND status = 'paid'
        GROUP BY payment_method ORDER BY revenue DESC
      `,
    ]);

    /**
     * Laba kotor perkiraan. Inilah sambungan POS ke Finance: menu yang sudah
     * dipetakan ke resep memakai HPP hasil hitungan, dan yang belum dipetakan
     * tidak dihitung sama sekali.
     *
     * Karena itu angka ini selalu perkiraan, dan hanya seakurat pemetaan resep
     * yang sudah dibuat owner. Jangan ditampilkan sebagai laba final.
     */
    const menuItems = await this.getMenuItems(businessId);
    const recipeByMenu = new Map(
      menuItems.filter((m) => m.recipe_id).map((m) => [m.id, m.recipe_id as string]),
    );

    let hppByRecipe = new Map<string, number>();
    if (recipeByMenu.size) {
      const calcs = await this.getAllRecipesWithCalculations(businessId);
      hppByRecipe = new Map(calcs.map((c) => [c.recipe.id, c.calc.hpp_per_unit ?? 0]));
    }

    /** HPP per item terjual. 0 kalau menunya belum dipetakan ke resep. */
    const hppForMenuItem = (menuItemId: string): number => {
      const recipeId = recipeByMenu.get(menuItemId);
      if (!recipeId) return 0;
      return hppByRecipe.get(recipeId) ?? 0;
    };

    let totalEstimatedHpp = 0;
    let mappedRevenue = 0;
    for (const row of top) {
      const hpp = hppForMenuItem(row.menu_item_id as string);
      if (!hpp) continue;
      totalEstimatedHpp += hpp * num(row.qty);
      mappedRevenue += num(row.revenue);
    }

    const totalNetRevenue = num(allTime[0]?.revenue);
    const topSellingItems = top.slice(0, 5).map((r) => {
      const revenue = num(r.revenue);
      const hpp = hppForMenuItem(r.menu_item_id as string) * num(r.qty);
      return {
        name: r.name as string,
        qty: num(r.qty),
        revenue,
        hpp,
        // Nol kalau menu belum punya resep. Ditampilkan apa adanya, tidak ditebak.
        grossProfit: hpp > 0 ? Math.max(0, revenue - hpp) : 0,
      };
    });

    // Dipakai kartu ringkasan yang mengakses per metode, misal .qris dan .cash.
    const paymentBreakdown: Record<string, number> = { cash: 0, qris: 0, transfer: 0 };
    for (const r of byMethod) {
      paymentBreakdown[r.payment_method as string] = num(r.revenue);
    }
    const byPaymentMethod = byMethod.map((r) => ({
      method: r.payment_method as string, orders: num(r.orders), revenue: num(r.revenue),
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
      topSellingItems,
      bestSellers: topSellingItems,
      paymentBreakdown,
      byPaymentMethod,
      timezone: tz,
    };
  },
};

export type Db = typeof db;
