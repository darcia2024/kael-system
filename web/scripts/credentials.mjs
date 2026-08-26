import fs from "node:fs";
import { randomBytes, scryptSync } from "node:crypto";
import postgres from "postgres";

/**
 * Menyetel kredensial pengguna.
 *
 *   node scripts/credentials.mjs list
 *   node scripts/credentials.mjs password <email> <kata-sandi>
 *   node scripts/credentials.mjs pin <nama-staf> <6-digit>
 *
 * Format hash sama persis dengan src/lib/auth.ts: scrypt$<salt>$<hash>, salt
 * berbeda tiap pengguna. Dipakai untuk onboarding bisnis baru dan untuk
 * menyetel ulang PIN staf yang lupa.
 *
 * Kata sandi diberikan lewat argumen, jadi jalankan ini di mesin sendiri, dan
 * ingat bahwa riwayat shell menyimpannya.
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
  idle_timeout: 5,
});

function hash(secret) {
  const salt = randomBytes(16);
  return `scrypt$${salt.toString("hex")}$${scryptSync(secret, salt, 32).toString("hex")}`;
}

const [cmd, a, b] = process.argv.slice(2);

try {
  if (cmd === "list") {
    const rows = await sql`
      SELECT name, role, email, is_active,
             (password_hash IS NOT NULL) AS has_password,
             (pin_hash LIKE 'scrypt$%') AS pin_ok
      FROM users ORDER BY role, name
    `;
    console.log("PERAN        NAMA                 EMAIL                     SANDI  PIN");
    for (const r of rows) {
      console.log(
        r.role.padEnd(12) +
          (r.name ?? "").padEnd(21) +
          (r.email ?? "-").padEnd(26) +
          (r.has_password ? "ada    " : "-      ") +
          (r.pin_ok ? "ok" : r.role === "staff" ? "PERLU DIRESET" : "-"),
      );
    }
  } else if (cmd === "password") {
    if (!a || !b) throw new Error("Pakai: password <email> <kata-sandi>");
    if (b.length < 8) throw new Error("Kata sandi minimal 8 karakter.");
    const rows = await sql`
      UPDATE users SET password_hash = ${hash(b)}
      WHERE email = ${a.toLowerCase()} AND role IN ('owner', 'kael_admin')
      RETURNING name, role
    `;
    if (!rows.length) throw new Error("Akun owner/admin dengan email itu tidak ditemukan.");
    console.log(`Kata sandi disetel untuk ${rows[0].name} (${rows[0].role}).`);
  } else if (cmd === "pin") {
    if (!a || !b) throw new Error("Pakai: pin <nama-staf> <6-digit>");
    if (!/^\d{6}$/.test(b)) throw new Error("PIN harus tepat 6 angka.");
    const rows = await sql`
      UPDATE users SET pin_hash = ${hash(b)}, failed_pin_attempts = 0, locked_until = NULL
      WHERE name = ${a} AND role = 'staff'
      RETURNING name
    `;
    if (!rows.length) throw new Error("Staf dengan nama itu tidak ditemukan.");
    console.log(`PIN disetel untuk ${rows[0].name}.`);
  } else {
    console.log("Perintah: list | password <email> <sandi> | pin <nama> <6-digit>");
  }
} catch (e) {
  console.error("Gagal:", e.message);
  process.exitCode = 1;
} finally {
  await sql.end({ timeout: 5 });
}
