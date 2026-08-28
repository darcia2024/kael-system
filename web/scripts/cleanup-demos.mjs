import fs from "node:fs";
import postgres from "postgres";

/**
 * Membersihkan tenant peragaan yang masa berlakunya sudah lewat.
 *
 *   node scripts/cleanup-demos.mjs                 lihat saja, tidak menghapus
 *   node scripts/cleanup-demos.mjs --semua         termasuk yang belum lewat
 *   node scripts/cleanup-demos.mjs --kode=NAGURA   satu tenant, meski belum lewat
 *   node scripts/cleanup-demos.mjs --hapus         benar-benar menghapus
 *
 * Tanpa --hapus skrip ini tidak menulis apa pun. Menghapus adalah bawaan yang
 * salah untuk perkakas yang dijalankan sambil lalu.
 *
 * Sasarannya SELALU dibatasi is_demo = TRUE. Pendahulunya
 * (scratch-cleanup-dummy.mjs) memakai daftar id yang ditulis tangan, dan daftar
 * seperti itu tidak punya cara memastikan yang dihapus memang data peragaan.
 */

// ---------------------------------------------------------------------------
// Argumen
// ---------------------------------------------------------------------------

const argv = process.argv.slice(2);
const hapusBeneran = argv.includes("--hapus");
const termasukBelumLewat = argv.includes("--semua");
const kodeArg = argv.find((a) => a.startsWith("--kode="));
const kode = kodeArg ? kodeArg.slice("--kode=".length).trim().toUpperCase() : null;

const tidakDikenal = argv.filter(
  (a) => !["--hapus", "--semua"].includes(a) && !a.startsWith("--kode="),
);
if (tidakDikenal.length) {
  console.error("Argumen tidak dikenali: " + tidakDikenal.join(", "));
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


// ---------------------------------------------------------------------------

try {
  /**
   * Menyaring dengan is_demo di kueri, bukan setelah baris terbaca. Pelanggan
   * sungguhan tidak pernah ikut terambil, jadi kesalahan apa pun di bawah tidak
   * bisa menjangkau mereka.
   */
  const sasaran = kode
    ? await sql`
        SELECT id, name, store_code, demo_expires_at
          FROM businesses
         WHERE is_demo = TRUE AND upper(store_code) = ${kode}
         ORDER BY name
      `
    : termasukBelumLewat
      ? await sql`
          SELECT id, name, store_code, demo_expires_at
            FROM businesses
           WHERE is_demo = TRUE
           ORDER BY demo_expires_at
        `
      : await sql`
          SELECT id, name, store_code, demo_expires_at
            FROM businesses
           WHERE is_demo = TRUE AND demo_expires_at < CURRENT_DATE
           ORDER BY demo_expires_at
        `;

  if (!sasaran.length) {
    console.log(
      kode
        ? `\nTidak ada tenant demo dengan kode ${kode}.\n`
        : "\nTidak ada tenant demo yang perlu dibereskan.\n",
    );
    process.exit(0);
  }

  const hariIni = new Date().toISOString().slice(0, 10);
  const ids = sasaran.map((s) => s.id);

  // Hitungan dipakai baik untuk pratinjau maupun laporan akhir.
  const [pengguna, kartu, pesanan, pelanggan, menu] = await Promise.all([
    sql`SELECT business_id, COUNT(*)::int n FROM users WHERE business_id = ANY(${ids}) GROUP BY business_id`,
    sql`SELECT business_id, COUNT(*)::int n FROM cards WHERE business_id = ANY(${ids}) GROUP BY business_id`,
    sql`SELECT business_id, COUNT(*)::int n FROM orders WHERE business_id = ANY(${ids}) GROUP BY business_id`,
    sql`SELECT business_id, COUNT(*)::int n FROM customers WHERE business_id = ANY(${ids}) GROUP BY business_id`,
    sql`SELECT business_id, COUNT(*)::int n FROM menu_items WHERE business_id = ANY(${ids}) GROUP BY business_id`,
  ]);

  const petaHitung = (rows) => new Map(rows.map((r) => [r.business_id, r.n]));
  const nPengguna = petaHitung(pengguna);
  const nKartu = petaHitung(kartu);
  const nPesanan = petaHitung(pesanan);
  const nPelanggan = petaHitung(pelanggan);
  const nMenu = petaHitung(menu);

  const garis = "-".repeat(70);
  console.log(`\n${garis}`);
  console.log(hapusBeneran ? "  MENGHAPUS tenant demo berikut" : "  PRATINJAU. Tidak ada yang dihapus.");
  console.log(garis);

  for (const s of sasaran) {
    const berlakuSampai = tanggal(s.demo_expires_at);
    const lewat = berlakuSampai < hariIni;
    console.log(`  ${s.name}  (${s.store_code})`);
    console.log(
      `    berlaku s/d ${berlakuSampai}` + (lewat ? "  sudah lewat" : "  BELUM lewat"),
    );
    console.log(
      `    ikut terhapus: ${nPengguna.get(s.id) ?? 0} akun, ${nMenu.get(s.id) ?? 0} menu, ` +
        `${nPesanan.get(s.id) ?? 0} pesanan, ${nPelanggan.get(s.id) ?? 0} pelanggan`,
    );
    if (nKartu.get(s.id)) {
      console.log(`    ${nKartu.get(s.id)} kartu fisik dikembalikan ke stok, tidak dihapus`);
    }
  }
  console.log(garis);

  if (!hapusBeneran) {
    console.log("  Tambahkan --hapus kalau daftar di atas sudah benar.\n");
    process.exit(0);
  }

  let bisnisTerhapus = 0;
  let kartuKembali = 0;

  for (const s of sasaran) {
    await sql.begin(async (sql) => {
      /**
       * Kartu fisik adalah barang inventaris KAEL, bukan milik tenant. Foreign
       * key-nya memang SET NULL supaya kartu kembali ke stok saat bisnisnya
       * hilang. Yang tidak diurus foreign key adalah sisa jejak demo yang
       * menempel di kartunya: tujuan pengalihan masih menunjuk halaman ulasan
       * usaha tadi, statusnya masih aktif, dan hitungan tap-nya bukan nol. Kalau
       * kartu itu dipakai lagi untuk pelanggan lain, semua itu ikut terbawa.
       */
      const kartuTenant = await sql`
        SELECT id FROM cards WHERE business_id = ${s.id}
      `;
      if (kartuTenant.length) {
        const kartuIds = kartuTenant.map((k) => k.id);
        await sql`DELETE FROM card_taps WHERE card_id = ANY(${kartuIds})`;
        await sql`
          UPDATE cards
             SET status = 'unactivated',
                 destination_url = NULL,
                 activation_pin_hash = NULL,
                 customer_id = NULL,
                 tap_count = 0,
                 last_tapped_at = NULL
           WHERE id = ANY(${kartuIds})
        `;
        kartuKembali += kartuIds.length;
      }

      /**
       * users.business_id juga SET NULL, tapi di sana itu bukan yang diinginkan:
       * akun pemilik demo akan tertinggal tanpa bisnis, dan kolom email-nya
       * unik. Alamat yang sama tidak akan bisa dipakai lagi saat calon yang sama
       * didatangi ulang, tanpa petunjuk apa pun kenapa.
       */
      await sql`DELETE FROM users WHERE business_id = ${s.id}`;

      // Sisanya CASCADE: menu, kategori, pesanan, shift, loyalty, finance.
      await sql`DELETE FROM businesses WHERE id = ${s.id} AND is_demo = TRUE`;
      bisnisTerhapus++;
    });

    console.log(`  terhapus  ${s.name} (${s.store_code})`);
  }

  console.log(garis);
  console.log(
    `  ${bisnisTerhapus} tenant demo dihapus` +
      (kartuKembali ? `, ${kartuKembali} kartu dikembalikan ke stok` : ""),
  );
  console.log(garis + "\n");
} catch (e) {
  console.error("\nGagal: " + e.message + "\n");
  process.exitCode = 1;
} finally {
  await sql.end({ timeout: 10 });
}
