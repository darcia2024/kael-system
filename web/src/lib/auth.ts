import "server-only";
import { cookies } from "next/headers";
import {
  createHmac,
  randomBytes,
  scryptSync,
  timingSafeEqual,
} from "node:crypto";

import type { StaffPermission, User } from "./types";
import { getActiveSessionUser } from "./session-user";
import { isCurrentSession } from "./session-policy";

/**
 * Sesi dan verifikasi PIN.
 *
 * Catatan penting dari dokumentasi Next 16: Server Action bisa dipanggil
 * langsung lewat POST, bukan hanya lewat tombol di UI. Karena itu otorisasi
 * dicek di dalam tiap action memakai requireOwner/requireStaff di bawah, dan
 * proxy.ts hanya dipakai untuk pengalihan optimistis, bukan sebagai penjaga.
 */

const SESSION_COOKIE = "kael_session";
const SESSION_MAX_AGE = 60 * 60 * 12; // 12 jam, kira-kira satu hari kerja

function secret(): string {
  const s = process.env.KAEL_AUTH_SALT;
  if (!s || s.length < 16) {
    throw new Error(
      "KAEL_AUTH_SALT belum diisi atau terlalu pendek. Isi di .env.local dengan nilai acak minimal 16 karakter.",
    );
  }
  return s;
}

// ---------------------------------------------------------------------------
// PIN
// ---------------------------------------------------------------------------

/**
 * PIN 6 digit hanya punya sejuta kemungkinan, jadi hash cepat seperti SHA-256
 * bisa dibongkar habis dalam hitungan detik kalau database bocor. scrypt lambat
 * dan pakai salt berbeda per pengguna, sehingga satu tabel pelangi tidak bisa
 * membuka PIN semua staf sekaligus.
 *
 * Format tersimpan: scrypt$<salt hex>$<hash hex>
 */
export function hashPin(pin: string): string {
  const salt = randomBytes(16);
  const hash = scryptSync(pin, salt, 32);
  return `scrypt$${salt.toString("hex")}$${hash.toString("hex")}`;
}

/**
 * Perbandingan waktu tetap. Tidak ada jalan mundur ke perbandingan teks polos:
 * versi sebelumnya menerima `storedHash === inputPin`, sehingga PIN yang
 * tersimpan mentah tetap meloloskan login.
 */
export function verifyPin(pin: string, stored: string | null): boolean {
  if (!pin || !stored) return false;

  const parts = stored.split("$");
  if (parts.length !== 3 || parts[0] !== "scrypt") return false;

  const [, saltHex, hashHex] = parts;
  let expected: Buffer;
  let actual: Buffer;
  try {
    expected = Buffer.from(hashHex, "hex");
    actual = scryptSync(pin, Buffer.from(saltHex, "hex"), expected.length);
  } catch {
    return false;
  }

  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

/** Format hash lama (`h_...` atau SHA-256 polos) tidak lagi diterima. */
export function isLegacyPinHash(stored: string | null): boolean {
  return !!stored && !stored.startsWith("scrypt$");
}

// ---------------------------------------------------------------------------
// Sesi
// ---------------------------------------------------------------------------

export interface Session {
  userId: string;
  businessId: string | null;
  role: User["role"];
  name: string;
  /** Hanya diisi untuk staf. Owner tidak dibatasi daftar ini. */
  permissions?: StaffPermission[];
}

function sign(payload: string): string {
  return createHmac("sha256", secret()).update(payload).digest("base64url");
}

function serialize(session: Session): string {
  const body = Buffer.from(JSON.stringify(session)).toString("base64url");
  return `${body}.${sign(body)}`;
}

function deserialize(raw: string | undefined): Session | null {
  if (!raw) return null;
  const dot = raw.lastIndexOf(".");
  if (dot < 1) return null;

  const body = raw.slice(0, dot);
  const mac = raw.slice(dot + 1);

  const expected = Buffer.from(sign(body));
  const actual = Buffer.from(mac);
  if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) {
    return null;
  }

  try {
    return JSON.parse(Buffer.from(body, "base64url").toString()) as Session;
  } catch {
    return null;
  }
}

export async function createSession(session: Session): Promise<void> {
  const store = await cookies();
  store.set(SESSION_COOKIE, serialize(session), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_MAX_AGE,
  });
}

export async function destroySession(): Promise<void> {
  const store = await cookies();
  store.delete(SESSION_COOKIE);
}

export async function getSession(): Promise<Session | null> {
  const store = await cookies();
  const session = deserialize(store.get(SESSION_COOKIE)?.value);
  if (!session) return null;

  const current = await getActiveSessionUser(session.userId);
  // Semua atribut otorisasi wajib sama dengan data terbaru di database.
  // Ini menutup sesi staf yang sudah dicabut atau dipindah tenant.
  if (!current || !isCurrentSession(session, current)) return null;

  return {
    userId: current.id,
    businessId: current.businessId,
    role: current.role,
    name: current.name,
    permissions: current.role === "staff" ? current.permissions : undefined,
  };
}

// ---------------------------------------------------------------------------
// Penjaga
// ---------------------------------------------------------------------------

export class AuthError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AuthError";
  }
}

/** Owner atau staf pada satu bisnis. Dipakai layar operasional. */
export async function requireStaff(): Promise<Session & { businessId: string }> {
  const s = await getSession();
  if (!s || !s.businessId || (s.role !== "owner" && s.role !== "staff")) {
    throw new AuthError("Silakan masuk lebih dulu.");
  }
  return s as Session & { businessId: string };
}

/** Hanya owner. Dipakai laporan laba, harga, refund, dan pengaturan. */
export async function requireOwner(): Promise<Session & { businessId: string }> {
  const s = await getSession();
  if (!s || !s.businessId || s.role !== "owner") {
    throw new AuthError("Hanya pemilik usaha yang bisa membuka bagian ini.");
  }
  return s as Session & { businessId: string };
}

/**
 * Staf dengan izin modul tertentu.
 *
 * Owner selalu lolos: dia yang memberi izin, jadi tidak masuk akal kalau dia
 * sendiri terhalang. Staf harus punya modulnya di daftar izinnya.
 *
 * Ini dipanggil di halaman DAN di dalam action, karena Server Action bisa
 * dijangkau lewat POST langsung tanpa pernah membuka layarnya.
 */
export async function requirePermission(
  module: StaffPermission,
): Promise<Session & { businessId: string }> {
  const s = await requireStaff();
  if (s.role === "owner") return s;
  if (!s.permissions?.includes(module)) {
    throw new AuthError("Akses ini belum diberikan oleh pemilik usaha.");
  }
  return s;
}

/** Hanya tim KAEL. Tidak pernah diberi akses ke data pelanggan sebuah bisnis. */
export async function requireKaelAdmin(): Promise<Session> {
  const s = await getSession();
  if (!s || s.role !== "kael_admin") {
    throw new AuthError("Halaman ini khusus tim KAEL.");
  }
  return s;
}
