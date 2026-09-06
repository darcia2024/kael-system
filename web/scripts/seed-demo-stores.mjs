import fs from "node:fs";
import { randomBytes, scryptSync, createHash } from "node:crypto";
import postgres from "postgres";

/**
 * Menambahkan dua tenant contoh untuk mencoba seluruh layanan KAEL.
 *
 *   node scripts/seed-demo-stores.mjs
 *
 * Aman diulang: memakai ON CONFLICT, jadi menjalankannya dua kali tidak
 * menggandakan data.
 *
 * Kredensial yang dibuat:
 *   owner@barberbro.id      / KaelDemo!2026
 *   owner@baksopakmin.id    / KaelDemo!2026
 *   PIN semua staf demo     : 246810
 */

const env = Object.fromEntries(
  fs
    .readFileSync(".env.local", "utf8")
    .split("\n")
    .filter((l) => l.includes("=") && !l.trim().startsWith("#"))
    .map((l) => {
      const i = l.indexOf("=");
      return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^"|"$/g, "")];
    }),
);

const sql = postgres(env.DATABASE_URL, {
  prepare: false,
  ssl: "require",
  max: 1,
});

/**
 * Format hash harus sama persis dengan src/lib/auth.ts, yaitu
 * scrypt$<salt hex>$<hash hex>.
 *
 * Versi sebelumnya memakai bcrypt. verifyPin menolak apa pun yang tidak diawali
 * "scrypt$" dan memperlakukannya sebagai format lama, jadi akun yang dibuat
 * dengan bcrypt akan tampak berhasil dibuat tapi tidak pernah bisa dipakai
 * masuk. Paket bcrypt juga tidak terpasang di proyek ini.
 */
function hash(secret) {
  const salt = randomBytes(16);
  return `scrypt$${salt.toString("hex")}$${scryptSync(secret, salt, 32).toString("hex")}`;
}

/**
 * Kolom id bertipe UUID, sementara skrip ini perlu id yang tetap sama tiap kali
 * dijalankan supaya ON CONFLICT bekerja. UUID diturunkan dari nama yang stabil,
 * bukan diacak.
 */
function stableUuid(name) {
  const h = createHash("sha256").update(name).digest("hex");
  return [
    h.slice(0, 8),
    h.slice(8, 12),
    "4" + h.slice(13, 16),
    ((parseInt(h[16], 16) & 0x3) | 0x8).toString(16) + h.slice(17, 20),
    h.slice(20, 32),
  ].join("-");
}

const DEMO = [
  {
    id: stableUuid("kael-demo-barber"),
    name: "Barber Bro Heritage",
    category: "Barbershop & Grooming",
    business_type: "jasa",
    phone: "6281299887766",
    address: "Jl. Gandaria No. 12, Jakarta",
    brand_color: "#1e293b",
    store_code: "BARBER",
    ownerName: "Mas Rian (Owner)",
    ownerEmail: "owner@barberbro.id",
    staff: ["Joko (Capster Senior)", "Rian (Kasir Barber)"],
  },
  {
    id: stableUuid("kael-demo-bakso"),
    name: "Bakso & Mie Ayam Pak Min",
    category: "Kuliner & Makanan",
    business_type: "kuliner",
    phone: "6281377665544",
    address: "Jl. Tebet Raya No. 45, Jakarta",
    brand_color: "#c2410c",
    store_code: "BAKSOMIN",
    ownerName: "Pak Min (Owner)",
    ownerEmail: "owner@baksopakmin.id",
    staff: ["Dewi (Kasir Shift Pagi)", "Agus (Kasir Shift Malam)"],
  },
];

const MODULES = ["review", "finance", "loyalty", "pos", "booking", "hr"];

async function main() {
  const pinHash = hash("246810");
  const pwHash = hash("KaelDemo!2026");
  const demoExpiry = new Date(Date.now() + 30 * 86_400_000).toISOString().slice(0, 10);

  for (const biz of DEMO) {
    await sql`
      INSERT INTO businesses ${sql({
        id: biz.id,
        name: biz.name,
        category: biz.category,
        business_type: biz.business_type,
        phone: biz.phone,
        address: biz.address,
        brand_color: biz.brand_color,
        timezone: "Asia/Jakarta",
        store_code: biz.store_code,
        is_demo: true,
        demo_expires_at: demoExpiry,
      })}
      ON CONFLICT (id) DO UPDATE
      SET name = EXCLUDED.name, category = EXCLUDED.category,
          business_type = EXCLUDED.business_type, store_code = EXCLUDED.store_code,
          is_demo = TRUE, demo_expires_at = EXCLUDED.demo_expires_at
    `;

    await sql`
      INSERT INTO users ${sql({
        id: stableUuid(biz.ownerEmail),
        business_id: biz.id,
        role: "owner",
        name: biz.ownerName,
        email: biz.ownerEmail,
        password_hash: pwHash,
        is_active: true,
      })}
      ON CONFLICT (id) DO UPDATE
      SET name = EXCLUDED.name, password_hash = EXCLUDED.password_hash, is_active = TRUE
    `;

    for (const staffName of biz.staff) {
      await sql`
        INSERT INTO users ${sql({
          id: stableUuid(biz.id + staffName),
          business_id: biz.id,
          role: "staff",
          name: staffName,
          pin_hash: pinHash,
          permissions: ["pos", "loyalty", "review"],
          is_active: true,
        })}
        ON CONFLICT (id) DO UPDATE
        SET name = EXCLUDED.name, pin_hash = EXCLUDED.pin_hash,
            permissions = EXCLUDED.permissions, is_active = TRUE
      `;
    }

    for (const m of MODULES) {
      // Kolomnya activated_at, bukan starts_at.
      await sql`
        INSERT INTO business_modules ${sql({
          business_id: biz.id,
          module: m,
          status: "active",
        })}
        ON CONFLICT (business_id, module) DO NOTHING
      `;
    }

    // Program loyalty perlu ada, kalau tidak dashboard Loyalty langsung gagal.
    await sql`
      INSERT INTO loyalty_programs ${sql({
        business_id: biz.id,
        mode: "point",
        earn_rate: 10000,
        stamp_per_visit: 1,
      })}
      ON CONFLICT DO NOTHING
    `;

    // Menu kecil yang cukup untuk mencoba kasir tanpa mengarang transaksi.
    const categoryId = stableUuid(`${biz.id}-demo-category`);
    const menuId = stableUuid(`${biz.id}-demo-menu`);
    await sql`
      INSERT INTO categories ${sql({ id: categoryId, business_id: biz.id, name: "Menu Demo", sort_order: 1 })}
      ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name
    `;
    await sql`
      INSERT INTO menu_items ${sql({ id: menuId, business_id: biz.id, category_id: categoryId, name: biz.business_type === "jasa" ? "Potong Rambut Reguler" : "Bakso Urat", price: biz.business_type === "jasa" ? 45000 : 25000, is_available: true, sort_order: 1 })}
      ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, price = EXCLUDED.price, is_available = TRUE
    `;

    // Satu layanan dan jadwal membuat Booking/HR langsung punya alur uji.
    const serviceId = stableUuid(`${biz.id}-demo-service`);
    await sql`
      INSERT INTO booking_services ${sql({ id: serviceId, business_id: biz.id, name: biz.business_type === "jasa" ? "Potong Rambut" : "Konsultasi Pesanan", duration_minutes: 30, price: biz.business_type === "jasa" ? 45000 : 0, deposit_amount: biz.business_type === "jasa" ? 10000 : 0, capacity: 1, is_active: true })}
      ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, duration_minutes = EXCLUDED.duration_minutes, price = EXCLUDED.price, deposit_amount = EXCLUDED.deposit_amount, is_active = TRUE
    `;

    const firstStaffId = stableUuid(biz.id + biz.staff[0]);
    const scheduleId = stableUuid(`${biz.id}-demo-schedule`);
    const starts = new Date(); starts.setHours(8, 0, 0, 0);
    const ends = new Date(); ends.setHours(17, 0, 0, 0);
    await sql`
      INSERT INTO staff_work_schedules ${sql({ id: scheduleId, business_id: biz.id, user_id: firstStaffId, starts_at: starts.toISOString(), ends_at: ends.toISOString(), role_label: "Shift Demo", pos_shift_allowed: true })}
      ON CONFLICT (id) DO UPDATE SET starts_at = EXCLUDED.starts_at, ends_at = EXCLUDED.ends_at, pos_shift_allowed = TRUE
    `;

    console.log("OK  " + biz.name);
  }

  const all = await sql`SELECT name, category FROM businesses ORDER BY name`;
  console.log("\nBisnis di database sekarang:");
  all.forEach((b) => console.log("  - " + b.name + " (" + b.category + ")"));
  console.log("\nLogin owner : KaelDemo!2026   PIN staf: 246810");
}

main()
  .catch((err) => {
    console.error("Gagal:", err.message);
    process.exitCode = 1;
  })
  .finally(() => sql.end({ timeout: 10 }));
