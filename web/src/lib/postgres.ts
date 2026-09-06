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
 *
 * LETAK GEOGRAFIS
 * Database ini ada di AWS ap-southeast-2 (Sydney) — lihat host DATABASE_URL.
 * `regions` di vercel.json WAJIB ikut di sana (`syd1`). Waktu fungsi berjalan
 * di sin1 (Singapura), satu query pulang-pergi diukur ~340 ms di produksi,
 * jadi halaman yang butuh sepuluh query menghabiskan tiga detik hanya untuk
 * menunggu jaringan. Pengguna cuma menyeberang satu kali ke Sydney; halaman
 * menyeberang sekali per query. Yang satu kali itu yang harus dipindah.
 *
 * Kalau database dipindah ke region lain, vercel.json harus ikut diubah di
 * commit yang sama.
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
    /**
     * Halaman Loyalty menembakkan 11 query sekaligus lewat Promise.all, POS
     * tujuh, dasbor pemilik enam. Dengan `max: 2` semuanya mengantre dua-dua:
     * yang ditulis paralel berjalan berurutan, dan halamannya menunggu enam
     * gelombang alih-alih satu. Pooler Supabase di port 6543 memang dibuat
     * untuk banyak koneksi pendek, jadi batasnya tidak perlu seketat itu.
     */
    max: isProd ? 10 : 5,
    /**
     * Lebih panjang dari jeda orang menekan tombol berikutnya. Sepuluh detik
     * membuat koneksi mati persis di antara dua klik, dan klik kedua membayar
     * lagi jabat tangan TLS yang di produksi terukur beberapa ratus milidetik.
     */
    idle_timeout: 60,
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
