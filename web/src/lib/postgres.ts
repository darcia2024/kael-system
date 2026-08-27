import "server-only";
import postgres from "postgres";

/**
 * Koneksi Postgres tunggal ke Supabase.
 *
 * `server-only` di baris pertama bukan hiasan. Kalau ada file client yang tidak
 * sengaja meng-import modul ini, build akan gagal dengan pesan yang jelas,
 * bukan diam-diam mengirim kredensial database ke browser.
 *
 * Catatan pooler: DATABASE_URL memakai port 6543 (transaction mode). Di mode
 * itu PgBouncer tidak mendukung prepared statement, jadi `prepare: false`
 * wajib. Tanpa itu query akan gagal secara acak di serverless.
 * Untuk DDL, scripts/migrate.mjs menukar port ke 5432 (session mode).
 */

declare global {
  // eslint-disable-next-line no-var
  var __kael_sql: ReturnType<typeof postgres> | undefined;
}

function createClient() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error(
      "DATABASE_URL belum diisi. Salin web/.env.example ke web/.env.local lalu isi nilainya.",
    );
  }

  const isProd = process.env.NODE_ENV === "production";

  return postgres(url, {
    prepare: false,
    ssl: "require",
    max: isProd ? 2 : 5,
    idle_timeout: 10,
    connect_timeout: 10,
    transform: { undefined: null },
  });
}

/**
 * Di dev, Next me-reload modul tiap perubahan file. Tanpa cache di globalThis,
 * tiap reload membuka pool baru dan koneksi lama menumpuk sampai Supabase
 * menolak koneksi berikutnya.
 */
export const sql = globalThis.__kael_sql ?? createClient();

if (process.env.NODE_ENV !== "production") {
  globalThis.__kael_sql = sql;
}
