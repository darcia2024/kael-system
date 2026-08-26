import fs from "node:fs";
import path from "node:path";
import postgres from "postgres";

/**
 * Menjalankan migrasi SQL yang belum pernah terpasang.
 *
 * Berkas yang sudah pernah dijalankan dicatat di tabel _kael_migrations, jadi
 * perintah ini aman diulang. Tanpa pencatatan itu, menjalankan ulang akan gagal
 * di CREATE POLICY, yang tidak punya bentuk IF NOT EXISTS.
 *
 * DDL dikirim lewat port 5432 (session pooler). Port 6543 memakai transaction
 * mode, dan DDL tidak berjalan mulus di sana.
 *
 * Jalankan: npm run migrate
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

if (!env.DATABASE_URL) {
  console.error("DATABASE_URL belum diisi di .env.local");
  process.exit(1);
}

const sql = postgres(env.DATABASE_URL.replace(":6543/", ":5432/"), {
  prepare: false,
  ssl: "require",
  max: 1,
  idle_timeout: 10,
});

const dir = "supabase/migrations";

try {
  await sql.unsafe(`
    CREATE TABLE IF NOT EXISTS public._kael_migrations (
      filename TEXT PRIMARY KEY,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  const applied = new Set(
    (await sql`SELECT filename FROM _kael_migrations`).map((r) => r.filename),
  );

  const files = fs.readdirSync(dir).filter((f) => f.endsWith(".sql")).sort();
  let ran = 0;

  for (const f of files) {
    if (applied.has(f)) {
      console.log("lewati  " + f);
      continue;
    }
    try {
      await sql.unsafe(fs.readFileSync(path.join(dir, f), "utf8"));
      await sql`INSERT INTO _kael_migrations ${sql({ filename: f })}`;
      console.log("OK      " + f);
      ran++;
    } catch (e) {
      console.error("GAGAL   " + f);
      console.error("        " + e.message);
      process.exitCode = 1;
      break;
    }
  }

  console.log("\n" + ran + " migrasi baru dijalankan, " + applied.size + " sudah ada sebelumnya");
} finally {
  await sql.end({ timeout: 10 });
}
