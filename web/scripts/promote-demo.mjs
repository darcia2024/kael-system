import fs from "node:fs";
import postgres from "postgres";

/**
 * Mengubah tenant peragaan menjadi pelanggan sungguhan.
 *
 *   node scripts/promote-demo.mjs --kode=NAGURA
 *   node scripts/promote-demo.mjs --kode=NAGURA --sampai=2027-08-27
 *
 * Dijalankan saat calon yang didemokan jadi membeli. Tanpa ini, tenant yang
 * sudah dibayar tetap bertanda demo dan akan terjaring cleanup-demos.mjs —
 * data pelanggan yang membayar terhapus oleh perkakas kebersihan.
 *
 * Dua hal berubah sekaligus, dan memang harus sekaligus:
 *
 *   1. Tanda demo dilepas. CHECK di tabel businesses mengharuskan is_demo dan
 *      demo_expires_at sepakat, jadi keduanya diubah dalam satu perintah.
 *
 *   2. Masa berlaku modul diperpanjang. Modul demo hanya berumur belasan hari,
 *      dan kalau tidak ikut diperpanjang, pelanggan yang baru saja membayar
 *      masuk ke mode baca-saja dalam dua minggu.
 */

const argv = process.argv.slice(2);
const kodeArg = argv.find((a) => a.startsWith("--kode="));
const sampaiArg = argv.find((a) => a.startsWith("--sampai="));

const kode = kodeArg ? kodeArg.slice("--kode=".length).trim().toUpperCase() : null;
if (!kode) {
  console.error("Pemakaian: node scripts/promote-demo.mjs --kode=KODETOKO [--sampai=YYYY-MM-DD]");
  process.exit(1);
}

const setahunLagi = () => {
  const d = new Date();
  d.setFullYear(d.getFullYear() + 1);
  return d.toISOString().slice(0, 10);
};

const sampai = sampaiArg ? sampaiArg.slice("--sampai=".length).trim() : setahunLagi();
if (!/^\d{4}-\d{2}-\d{2}$/.test(sampai)) {
  console.error("--sampai harus berformat YYYY-MM-DD.");
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

const sql = postgres(env.DATABASE_URL, { prepare: false, ssl: "require", max: 1 });

/**
 * Kolom DATE dikembalikan driver sebagai objek Date pada tengah malam UTC,
 * bukan sebagai teks. String(date).slice(0, 10) menghasilkan "Sun Aug 30",
 * yang bukan hanya jelek dibaca: membandingkannya dengan tanggal ISO memberi
 * jawaban yang salah, sehingga demo yang sudah lewat tetap dilaporkan belum.
 *
 * Bentuk yang sama dipakai toIsoDate() di src/lib/licensing.ts.
 */
const tanggal = (v) =>
  v instanceof Date ? v.toISOString().slice(0, 10) : String(v ?? "").slice(0, 10);


try {
  const rows = await sql`
    SELECT id, name, store_code, is_demo, demo_expires_at
      FROM businesses
     WHERE upper(store_code) = ${kode}
  `;

  if (!rows.length) throw new Error(`Tidak ada toko dengan kode ${kode}.`);

  const biz = rows[0];
  if (!biz.is_demo) {
    console.log(`\n"${biz.name}" (${biz.store_code}) sudah berstatus pelanggan. Tidak ada yang diubah.\n`);
    process.exit(0);
  }

  const modul = await sql`
    SELECT module, expires_at FROM business_modules WHERE business_id = ${biz.id} ORDER BY module
  `;

  await sql.begin(async (sql) => {
    await sql`
      UPDATE businesses
         SET is_demo = FALSE, demo_expires_at = NULL
       WHERE id = ${biz.id}
    `;
    await sql`
      UPDATE business_modules
         SET status = 'active', expires_at = ${sampai}
       WHERE business_id = ${biz.id}
    `;
  });

  const garis = "-".repeat(60);
  console.log(`\n${garis}`);
  console.log(`  ${biz.name} (${biz.store_code}) kini pelanggan sungguhan`);
  console.log(garis);
  console.log(`  Tanda demo    : dilepas (sebelumnya berlaku s/d ${tanggal(biz.demo_expires_at)})`);
  console.log(`  Modul         : ${modul.map((m) => m.module).join(", ") || "tidak ada"}`);
  console.log(`  Jatuh tempo   : ${sampai}`);
  console.log(garis);
  console.log("  Tenant ini tidak lagi terjaring cleanup-demos.mjs, dan");
  console.log("  seed-prospect.mjs akan menolak menimpanya.\n");
} catch (e) {
  console.error("\nGagal: " + e.message + "\n");
  process.exitCode = 1;
} finally {
  await sql.end({ timeout: 10 });
}
