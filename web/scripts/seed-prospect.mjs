import fs from "node:fs";
import path from "node:path";
import { randomBytes, scryptSync, createHash } from "node:crypto";
import postgres from "postgres";

/**
 * Menyiapkan satu tenant peragaan atas nama calon pembeli.
 *
 *   node scripts/seed-prospect.mjs prospects/nagura.json
 *   node scripts/seed-prospect.mjs prospects/nagura.json --periksa
 *
 * Dengan --periksa, berkasnya hanya diperiksa dan basis data tidak disentuh
 * sama sekali. Dipakai untuk memastikan menunya sudah benar sebelum berangkat,
 * bukan saat sudah berdiri di depan pemiliknya.
 *
 * Dipakai sebelum mendatangi sebuah usaha: isi satu berkas JSON dengan nama,
 * menu, harga, dan staf usaha itu, jalankan perintah ini, lalu tunjukkan
 * aplikasinya ke pemiliknya dalam keadaan sudah berisi barang dagangannya
 * sendiri. Yang dilihat pemilik usaha adalah aplikasi yang sesungguhnya, bukan
 * tangkapan layar.
 *
 * Aman diulang. Semua id diturunkan dari `slug`, jadi menjalankan ulang setelah
 * menambah menu memperbarui tenant yang sama, tidak membuat tenant kedua.
 *
 * Yang TIDAK dibuat skrip ini, dan itu disengaja: riwayat penjualan karangan.
 * Layar laporan yang penuh angka hasil rekaan terbaca oleh pemilik usaha
 * sebagai janji pendapatan, dan itu janji yang tidak pernah dibuat siapa pun.
 * Transaksi pertama sebaiknya dibuat di depan orangnya, memakai kasirnya.
 */

// ---------------------------------------------------------------------------
// Argumen dan lingkungan
// ---------------------------------------------------------------------------

const argv = process.argv.slice(2);

/** Memeriksa berkas tanpa menyentuh basis data sama sekali. */
const periksaSaja = argv.includes("--periksa");
const berkasProspek = argv.find((a) => !a.startsWith("--"));

if (!berkasProspek) {
  console.error("Pemakaian: node scripts/seed-prospect.mjs <berkas.json> [--periksa]");
  console.error("Contoh   : node scripts/seed-prospect.mjs prospects/contoh.json");
  process.exit(1);
}

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

if (!env.DATABASE_URL) {
  console.error("DATABASE_URL belum diisi di .env.local");
  process.exit(1);
}

// ---------------------------------------------------------------------------
// Bantuan
// ---------------------------------------------------------------------------

/**
 * Format hash harus sama persis dengan src/lib/auth.ts, yaitu
 * scrypt$<salt hex>$<hash hex>. verifyPin menolak apa pun yang tidak diawali
 * "scrypt$", jadi akun yang dibuat dengan format lain akan tampak berhasil
 * dibuat tapi tidak pernah bisa dipakai masuk.
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

/**
 * Kata sandi pemilik untuk tenant demo.
 *
 * Dibuat acak kalau berkas prospek tidak menyebutkannya, supaya berkas yang
 * beredar di folder kerja tidak perlu memuat kata sandi sama sekali. Nilainya
 * dicetak sekali di akhir, dan hanya itu satu-satunya kesempatan membacanya:
 * yang tersimpan di basis data cuma hash-nya.
 */
function kataSandiAcak() {
  const kata = ["kopi", "meja", "kasir", "struk", "nota", "tenda", "gerai", "lampu"];
  const pilih = () => kata[randomBytes(1)[0] % kata.length];
  return `${pilih()}-${pilih()}-${randomBytes(2).toString("hex")}`;
}

const tanggalPlus = (hari) => {
  const d = new Date();
  d.setDate(d.getDate() + hari);
  return d.toISOString().slice(0, 10);
};

const rupiah = (n) => `Rp ${Number(n).toLocaleString("id-ID")}`;

// ---------------------------------------------------------------------------
// Membaca dan memeriksa berkas prospek
// ---------------------------------------------------------------------------

const JENIS_USAHA = new Set(["kuliner", "jasa", "retail"]);

/** Modul yang benar-benar sudah jadi. Menjanjikan yang belum ada itu utang. */
const MODUL_TERSEDIA = new Set(["review", "pos", "loyalty", "finance"]);

/** Modul yang hanya masuk akal untuk jenis usaha tertentu. Sama dengan modules-catalog.ts. */
const MODUL_COCOK = { finance: ["kuliner"] };

const galat = [];
const peringatan = [];

let prospek;
try {
  prospek = JSON.parse(fs.readFileSync(berkasProspek, "utf8"));
} catch (e) {
  console.error(`Tidak bisa membaca ${berkasProspek}: ${e.message}`);
  process.exit(1);
}

const slug = (prospek.slug || "").trim().toLowerCase();
if (!/^[a-z0-9-]{3,40}$/.test(slug)) {
  galat.push('"slug" wajib diisi, 3-40 huruf kecil, angka, atau tanda hubung.');
}

const b = prospek.business || {};
if (!(b.name || "").trim()) galat.push('business.name wajib diisi.');
if (!JENIS_USAHA.has(b.business_type)) {
  galat.push('business.business_type harus salah satu dari: kuliner, jasa, retail.');
}

const storeCode = (b.store_code || "").trim().toUpperCase();
if (!/^[A-Z0-9]{3,10}$/.test(storeCode)) {
  galat.push("business.store_code harus 3-10 huruf atau angka, tanpa spasi.");
}

if (b.brand_color && !/^#?([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(b.brand_color.trim())) {
  galat.push("business.brand_color harus hex, misal #2f5d50.");
}

const owner = prospek.owner || {};
if (!(owner.name || "").trim()) galat.push("owner.name wajib diisi.");
const ownerEmail = (owner.email || "").trim().toLowerCase();
if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(ownerEmail)) galat.push("owner.email tidak valid.");

const modul = [...new Set(prospek.modules || [])];
if (!modul.length) galat.push('"modules" wajib berisi minimal satu modul.');
for (const m of modul) {
  if (!MODUL_TERSEDIA.has(m)) {
    galat.push(`Modul "${m}" belum jadi atau tidak dikenali. Yang tersedia: ${[...MODUL_TERSEDIA].join(", ")}.`);
  } else if (MODUL_COCOK[m] && !MODUL_COCOK[m].includes(b.business_type)) {
    peringatan.push(
      `Modul "${m}" hanya masuk akal untuk ${MODUL_COCOK[m].join("/")}, sementara usaha ini ${b.business_type}.`,
    );
  }
}

const staf = prospek.staff || [];
for (const s of staf) {
  if (!(s.name || "").trim()) galat.push("Ada staf tanpa nama.");
  if (!/^\d{4,6}$/.test(String(s.pin ?? ""))) {
    galat.push(`PIN staf "${s.name}" harus 4-6 angka.`);
  }
}

const menu = prospek.menu || [];
for (const kategori of menu) {
  if (!(kategori.category || "").trim()) galat.push("Ada kategori menu tanpa nama.");
  for (const item of kategori.items || []) {
    if (!(item.name || "").trim()) galat.push(`Ada menu tanpa nama di kategori "${kategori.category}".`);
    if (!Number.isInteger(item.price) || item.price < 0) {
      galat.push(`Harga "${item.name}" harus bilangan bulat rupiah tanpa titik, misal 22000.`);
    }
  }
}

if (menu.length && !modul.includes("pos")) {
  peringatan.push("Menu diisi tapi modul pos tidak dibeli, jadi menunya tidak akan terlihat di mana pun.");
}
if (modul.includes("loyalty") && !prospek.loyalty) {
  peringatan.push('Modul loyalty aktif tanpa blok "loyalty"; dipakai pengaturan bawaan (poin, Rp 10.000 per poin).');
}
if (modul.includes("review") && !(b.google_place_id || "").trim()) {
  peringatan.push(
    "Modul review aktif tanpa google_place_id. Bagian paling meyakinkan dari demo Review adalah halaman ulasan Google asli milik mereka.",
  );
}

const masaBerlaku = Number.isInteger(prospek.demo_days) ? prospek.demo_days : 14;
if (masaBerlaku < 1 || masaBerlaku > 90) {
  galat.push("demo_days harus antara 1 dan 90 hari.");
}

if (galat.length) {
  console.error(`\n${berkasProspek} belum bisa dipakai:\n`);
  galat.forEach((g) => console.error("  - " + g));
  process.exit(1);
}

if (periksaSaja) {
  const jumlahMenu = menu.reduce((n, k) => n + (k.items || []).length, 0);
  console.log("");
  console.log(berkasProspek + " sudah benar. Basis data tidak disentuh.");
  console.log("");
  console.log("  " + b.name + " · " + b.business_type + " · kode " + storeCode);
  console.log("  Modul  : " + modul.join(", "));
  console.log("  Menu   : " + jumlahMenu + " item dalam " + menu.length + " kategori");
  console.log("  Staf   : " + staf.length);
  console.log("  Berlaku: " + masaBerlaku + " hari sejak dijalankan");
  if (peringatan.length) {
    console.log("");
    console.log("  Perhatian:");
    peringatan.forEach((p) => console.log("    - " + p));
  }
  console.log("");
  process.exit(0);
}

// ---------------------------------------------------------------------------
// Menulis
// ---------------------------------------------------------------------------

const sql = postgres(env.DATABASE_URL, { prepare: false, ssl: "require", max: 1 });

const businessId = stableUuid(`kael-prospek-${slug}`);
const kataSandi = (owner.password || "").trim() || kataSandiAcak();
const kedaluwarsa = tanggalPlus(masaBerlaku);

try {
  /**
   * Penjagaan sebelum menulis apa pun.
   *
   * Kode toko dan email pemilik sama-sama unik di seluruh tabel. Kalau salah
   * satunya sudah dipegang PELANGGAN SUNGGUHAN, melanjutkan berarti menimpa
   * data usaha yang membayar dengan data peragaan. Berhenti di sini jauh lebih
   * murah daripada memulihkannya nanti.
   */
  const bentrokKode = await sql`
    SELECT id, name, is_demo FROM businesses
     WHERE upper(store_code) = ${storeCode} AND id <> ${businessId}
  `;
  if (bentrokKode.length) {
    throw new Error(
      `Kode toko ${storeCode} sudah dipakai "${bentrokKode[0].name}"` +
        `${bentrokKode[0].is_demo ? " (demo lain)" : " — PELANGGAN SUNGGUHAN"}. Pilih kode lain.`,
    );
  }

  const bentrokEmail = await sql`
    SELECT u.id, u.business_id, b.name, b.is_demo
      FROM users u LEFT JOIN businesses b ON b.id = u.business_id
     WHERE lower(u.email) = ${ownerEmail} AND u.business_id IS DISTINCT FROM ${businessId}
  `;
  if (bentrokEmail.length) {
    throw new Error(
      `Email ${ownerEmail} sudah dipakai akun di "${bentrokEmail[0].name ?? "tanpa bisnis"}"` +
        `${bentrokEmail[0].is_demo ? " (demo lain)" : " — PELANGGAN SUNGGUHAN"}. Pilih email lain.`,
    );
  }

  const sudahAda = await sql`SELECT is_demo, name FROM businesses WHERE id = ${businessId}`;
  if (sudahAda.length && !sudahAda[0].is_demo) {
    throw new Error(
      `Slug "${slug}" menunjuk ke "${sudahAda[0].name}" yang BUKAN tenant demo. ` +
        "Skrip ini menolak menimpa pelanggan sungguhan.",
    );
  }

  await sql.begin(async (sql) => {
    // ---------------------------------------------------------------- bisnis
    await sql`
      INSERT INTO businesses ${sql({
        id: businessId,
        name: b.name.trim(),
        category: (b.category || "").trim(),
        business_type: b.business_type,
        phone: (b.phone || "").trim(),
        address: (b.address || "").trim(),
        google_place_id: (b.google_place_id || "").trim(),
        logo_url: (b.logo_url || "").trim() || null,
        brand_color: (b.brand_color || "#7958d8").trim(),
        timezone: (b.timezone || "Asia/Jakarta").trim(),
        store_code: storeCode,
        is_demo: true,
        demo_expires_at: kedaluwarsa,
      })}
      ON CONFLICT (id) DO UPDATE SET
        name = EXCLUDED.name,
        category = EXCLUDED.category,
        business_type = EXCLUDED.business_type,
        phone = EXCLUDED.phone,
        address = EXCLUDED.address,
        google_place_id = EXCLUDED.google_place_id,
        logo_url = EXCLUDED.logo_url,
        brand_color = EXCLUDED.brand_color,
        timezone = EXCLUDED.timezone,
        store_code = EXCLUDED.store_code,
        is_demo = TRUE,
        demo_expires_at = EXCLUDED.demo_expires_at
    `;

    // ---------------------------------------------------------------- pemilik
    await sql`
      INSERT INTO users ${sql({
        id: stableUuid(`kael-prospek-${slug}-owner`),
        business_id: businessId,
        role: "owner",
        name: owner.name.trim(),
        email: ownerEmail,
        password_hash: hash(kataSandi),
        is_active: true,
      })}
      ON CONFLICT (id) DO UPDATE SET
        name = EXCLUDED.name,
        email = EXCLUDED.email,
        password_hash = EXCLUDED.password_hash,
        is_active = TRUE
    `;

    // ---------------------------------------------------------------- staf
    /**
     * Staf yang hilang dari berkas ikut hilang dari tenant. Berkas prospek
     * adalah satu-satunya sumber kebenaran; kalau tidak, nama karyawan yang
     * sudah keluar tetap tertinggal di layar saat demo.
     */
    const idStaf = staf.map((s) => stableUuid(`kael-prospek-${slug}-staf-${s.name}`));
    if (idStaf.length) {
      await sql`
        DELETE FROM users
         WHERE business_id = ${businessId} AND role = 'staff' AND id <> ALL(${idStaf})
      `;
    } else {
      await sql`DELETE FROM users WHERE business_id = ${businessId} AND role = 'staff'`;
    }

    for (const [i, s] of staf.entries()) {
      await sql`
        INSERT INTO users ${sql({
          id: idStaf[i],
          business_id: businessId,
          role: "staff",
          name: s.name.trim(),
          pin_hash: hash(String(s.pin)),
          permissions: s.permissions?.length ? s.permissions : ["pos", "loyalty"],
          is_active: true,
        })}
        ON CONFLICT (id) DO UPDATE SET
          name = EXCLUDED.name,
          pin_hash = EXCLUDED.pin_hash,
          permissions = EXCLUDED.permissions,
          is_active = TRUE
      `;
    }

    // ---------------------------------------------------------------- modul
    await sql`
      DELETE FROM business_modules
       WHERE business_id = ${businessId} AND module <> ALL(${modul})
    `;
    for (const m of modul) {
      await sql`
        INSERT INTO business_modules ${sql({
          business_id: businessId,
          module: m,
          status: "active",
          expires_at: kedaluwarsa,
        })}
        ON CONFLICT (business_id, module) DO UPDATE SET
          status = 'active',
          expires_at = EXCLUDED.expires_at
      `;
    }

    // ---------------------------------------------------------------- menu
    /**
     * Menu ditulis ulang seluruhnya tiap kali dijalankan, supaya berkas prospek
     * tetap jadi satu-satunya sumber kebenaran saat menunya dirapikan sesaat
     * sebelum berkunjung. Riwayat transaksi tidak ikut hilang: order_items
     * menyimpan nama dan harga sebagai snapshot, dan foreign key-nya SET NULL.
     */
    await sql`DELETE FROM menu_items WHERE business_id = ${businessId}`;
    await sql`DELETE FROM categories WHERE business_id = ${businessId}`;

    let jumlahMenu = 0;
    for (const [iKat, kategori] of menu.entries()) {
      const categoryId = stableUuid(`kael-prospek-${slug}-kategori-${kategori.category}`);
      await sql`
        INSERT INTO categories ${sql({
          id: categoryId,
          business_id: businessId,
          name: kategori.category.trim(),
          sort_order: iKat,
        })}
      `;

      for (const [iItem, item] of (kategori.items || []).entries()) {
        await sql`
          INSERT INTO menu_items ${sql({
            id: stableUuid(`kael-prospek-${slug}-menu-${kategori.category}-${item.name}`),
            business_id: businessId,
            category_id: categoryId,
            name: item.name.trim(),
            price: item.price,
            is_available: item.is_available !== false,
            sort_order: iItem,
          })}
        `;
        jumlahMenu++;
      }
    }

    // ---------------------------------------------------------------- loyalty
    /**
     * Program wajib ada begitu modulnya aktif. Tanpa baris ini dasbor Loyalty
     * tampil "Aktif" sementara tiap pendaftaran member ditolak, dan itu persis
     * jenis kejutan yang tidak boleh muncul saat demo.
     */
    if (modul.includes("loyalty")) {
      const l = prospek.loyalty || {};
      await sql`
        INSERT INTO loyalty_programs ${sql({
          business_id: businessId,
          mode: l.mode === "stamp" ? "stamp" : "point",
          earn_rate: Number.isInteger(l.earn_rate) && l.earn_rate > 0 ? l.earn_rate : 10000,
          stamp_per_visit:
            Number.isInteger(l.stamp_per_visit) && l.stamp_per_visit > 0 ? l.stamp_per_visit : 1,
        })}
        ON CONFLICT (business_id) DO UPDATE SET
          mode = EXCLUDED.mode,
          earn_rate = EXCLUDED.earn_rate,
          stamp_per_visit = EXCLUDED.stamp_per_visit
      `;
    }

    prospek._jumlahMenu = jumlahMenu;
  });

  // -------------------------------------------------------------------------
  // Ringkasan serah terima
  // -------------------------------------------------------------------------
  const garis = "-".repeat(64);
  console.log(`\n${garis}`);
  console.log(`  ${b.name}  ·  tenant demo siap`);
  console.log(garis);
  console.log(`  Kode toko     : ${storeCode}`);
  console.log(`  Modul aktif   : ${modul.join(", ")}`);
  console.log(`  Menu          : ${prospek._jumlahMenu} item dalam ${menu.length} kategori`);
  console.log(`  Staf          : ${staf.length ? staf.map((s) => s.name).join(", ") : "belum ada"}`);
  console.log(`  Warna merek   : ${b.brand_color || "#7958d8 (bawaan)"}`);
  console.log(`  Logo          : ${b.logo_url ? b.logo_url : "belum ada, dipakai inisial"}`);
  console.log(`  Berlaku s/d   : ${kedaluwarsa}  (${masaBerlaku} hari)`);
  console.log(garis);
  console.log("  Masuk sebagai pemilik:");
  console.log(`    Email       : ${ownerEmail}`);
  console.log(`    Kata sandi  : ${kataSandi}`);
  if (!owner.password) {
    console.log("    (dibuat acak dan hanya tampil sekali; catat sekarang)");
  }
  if (staf.length) {
    console.log("  Masuk sebagai staf: kode toko di atas, lalu PIN masing-masing.");
  }
  console.log(garis);

  if (menu.length) {
    const contoh = menu[0].items?.[0];
    if (contoh) {
      console.log(`  Periksa cepat : /order/${storeCode}/1 harus menampilkan`);
      console.log(`                  "${contoh.name}" ${rupiah(contoh.price)}`);
    }
  }
  if (b.google_place_id) {
    console.log(`  Halaman ulasan: https://search.google.com/local/writereview?placeid=${b.google_place_id}`);
  }
  console.log(garis);

  if (peringatan.length) {
    console.log("\n  Perhatian:");
    peringatan.forEach((p) => console.log("    - " + p));
  }

  console.log(
    "\n  Tenant ini bertanda demo dan akan terjaring scripts/cleanup-demos.mjs" +
      "\n  setelah " +
      kedaluwarsa +
      ". Kalau calon jadi membeli, lepas tandanya lebih dulu.\n",
  );
} catch (e) {
  console.error("\nGagal: " + e.message + "\n");
  process.exitCode = 1;
} finally {
  await sql.end({ timeout: 10 });
}
