import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";

import { db } from "./db";
import { AuthError, getSession, type Session } from "./auth";
import { STAFF_PERMISSIONS, type StaffPermission } from "./types";
import { MODULE_BY_KEY, type ModuleKey } from "./modules-catalog";

/**
 * Lisensi modul: apa yang DIBELI oleh sebuah bisnis.
 *
 * Ini lapis yang berbeda dari izin staf di auth.ts. Keduanya harus lulus:
 *
 *   business_modules  -> apa yang dibeli bisnisnya      (tim KAEL yang set)
 *   users.permissions -> siapa di toko itu yang boleh   (owner yang set)
 *
 * Sebelum berkas ini ada, tabel business_modules terisi tapi tidak pernah
 * dibaca oleh satu pun halaman. Akibatnya owner yang cuma membeli KAEL Review
 * tetap bisa membuka Finance dan POS, dan tanggal jatuh tempo yang tersimpan
 * tidak berpengaruh apa-apa saat terlampaui.
 */

/**
 * Masa tenggang setelah jatuh tempo. Sesuai spec fondasi 2.1: lewat tenggang
 * sistem masuk mode baca-saja, TIDAK dimatikan. Mematikan kasir sebuah warung
 * karena telat bayar tiga hari adalah cara tercepat kehilangan pelanggan, dan
 * menyandera data penjualan mereka bukan posisi yang mau kita tempati.
 */
const GRACE_DAYS = 14;

export type LicenseState =
  /** Dibeli dan belum jatuh tempo. */
  | "aktif"
  /** Sudah lewat jatuh tempo tapi masih dalam 14 hari tenggang. Masih bisa tulis. */
  | "tenggang"
  /** Lewat tenggang, atau ditandai kedaluwarsa oleh admin. Baca-saja. */
  | "kedaluwarsa"
  /** Ditangguhkan admin. Tidak bisa dibuka sama sekali. */
  | "ditangguhkan"
  /** Tidak pernah dibeli. Tidak ada barisnya di business_modules. */
  | "tidak_dimiliki";

export interface ModuleLicense {
  module: ModuleKey;
  state: LicenseState;
  /** Boleh membuka layar dan melihat data lama. */
  canRead: boolean;
  /** Boleh menambah, mengubah, atau menghapus data. */
  canWrite: boolean;
  expiresAt: string | null;
  /** Sisa hari sampai jatuh tempo. Negatif berarti sudah lewat. */
  daysLeft: number;
}

const NOT_OWNED = (module: ModuleKey): ModuleLicense => ({
  module,
  state: "tidak_dimiliki",
  canRead: false,
  canWrite: false,
  expiresAt: null,
  daysLeft: 0,
});

/**
 * Tanggal hari ini di Asia/Jakarta, bukan UTC.
 *
 * Kolom expires_at bertipe DATE. Kalau dibandingkan dengan waktu UTC yang
 * punya jam, modul yang jatuh tempo hari ini akan terbaca kedaluwarsa sejak
 * pukul 07:00 WIB pada hari itu juga. Perbandingan tanggal-ke-tanggal
 * menghilangkan selisih satu hari itu.
 */
function todayInJakarta(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Jakarta" }).format(new Date());
}

function toIsoDate(value: string | Date): string {
  return value instanceof Date ? value.toISOString().slice(0, 10) : String(value).slice(0, 10);
}

function dayDiff(from: string, to: string): number {
  return Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000);
}

/**
 * Lisensi seluruh modul milik satu bisnis.
 *
 * Dibungkus cache() dari React sesuai anjuran dokumentasi Next pada panduan
 * Authentication, supaya satu render yang memeriksa lisensi di beberapa tempat
 * hanya menembak database sekali.
 */
export const getLicenses = cache(
  async (businessId: string): Promise<Map<ModuleKey, ModuleLicense>> => {
    const rows = await db.getModules(businessId);
    const today = todayInJakarta();
    const map = new Map<ModuleKey, ModuleLicense>();

    for (const row of rows) {
      const expiresAt = toIsoDate(row.expires_at);
      const daysLeft = dayDiff(today, expiresAt);

      let state: LicenseState;
      if (row.status === "suspended") state = "ditangguhkan";
      else if (row.status === "expired") state = "kedaluwarsa";
      else if (daysLeft >= 0) state = "aktif";
      else if (daysLeft >= -GRACE_DAYS) state = "tenggang";
      else state = "kedaluwarsa";

      map.set(row.module, {
        module: row.module,
        state,
        canRead: state !== "ditangguhkan",
        canWrite: state === "aktif" || state === "tenggang",
        expiresAt,
        daysLeft,
      });
    }

    return map;
  },
);

export async function getLicense(businessId: string, module: ModuleKey): Promise<ModuleLicense> {
  return (await getLicenses(businessId)).get(module) ?? NOT_OWNED(module);
}

// ===========================================================================
// Kesiapan: sudah dibeli belum tentu sudah bisa dipakai
// ===========================================================================

/**
 * Status modul yang DITAMPILKAN. Menggabungkan dua lapis yang berbeda.
 *
 * Lisensi menjawab "sudah dibayar belum". Kesiapan menjawab "sudah bisa dipakai
 * belum". Sebuah modul bisa lunas terbayar dan tetap tidak berguna, dan itu
 * bukan kasus teori: Loyalty pernah tampil "Aktif" di dasbor pemilik sementara
 * setiap pendaftaran member ditolak, karena barisnya di loyalty_programs tidak
 * pernah ada. Pemiliknya melihat produk yang rusak, bukan produk yang belum
 * disetel — dan tidak ada satu pun layar yang membedakan keduanya.
 */
export type ModuleStatus = LicenseState | "perlu_disiapkan";

export interface ModuleView extends ModuleLicense {
  /** Untuk lencana di layar. */
  status: ModuleStatus;
  /** Konfigurasi minimumnya belum lengkap, apa pun keadaan lisensinya. */
  needsSetup: boolean;
  /** Kalimat untuk pemilik usaha. Null kalau tidak ada yang perlu disiapkan. */
  setupHint: string | null;
  /** Ke mana pemilik usaha harus pergi untuk membereskannya. */
  setupHref: string | null;
  /**
   * Boleh dipakai sungguhan: lisensinya mengizinkan menulis DAN konfigurasinya
   * lengkap. Inilah yang menentukan apakah pelanggan boleh mendaftar member
   * atau memesan lewat QR.
   */
  usable: boolean;
}

const SETUP: Partial<Record<ModuleKey, { hint: string; href: string }>> = {
  loyalty: {
    hint: "Kurs poin belum disetel, jadi pelanggan belum bisa mendaftar jadi member.",
    href: "/app/loyalty",
  },
  pos: {
    hint: "Menu belum diisi, jadi kasir belum bisa mencatat transaksi.",
    href: "/app/pos",
  },
  review: {
    hint: "Belum ada kartu yang diaktivasi, jadi belum ada yang bisa di-tap pelanggan.",
    href: "/app/review",
  },
  booking: {
    hint: "Belum ada layanan booking. Tambahkan layanan dan durasinya lebih dulu.",
    href: "/app/booking",
  },
  hr: {
    hint: "Belum ada staf aktif untuk dijadwalkan.",
    href: "/app/hr",
  },
};

/**
 * Pandangan lengkap seluruh modul satu usaha.
 *
 * Satu-satunya sumber kebenaran untuk pertanyaan "modul ini keadaannya apa".
 * Dibungkus cache() supaya satu render yang menanyakannya di beberapa tempat
 * hanya menembak database sekali.
 */
export const getModuleViews = cache(
  async (businessId: string): Promise<Map<ModuleKey, ModuleView>> => {
    const [licenses, readiness] = await Promise.all([
      getLicenses(businessId),
      db.getModuleReadiness(businessId),
    ]);

    const views = new Map<ModuleKey, ModuleView>();
    for (const key of Object.keys(MODULE_BY_KEY) as ModuleKey[]) {
      const license = licenses.get(key) ?? NOT_OWNED(key);
      const siap = (readiness as Record<string, boolean>)[key] ?? true;

      // Kesiapan hanya relevan untuk modul yang memang dimiliki. Menyuruh
      // pemilik usaha menyiapkan modul yang belum dibelinya cuma membingungkan.
      const needsSetup = license.state !== "tidak_dimiliki" && !siap;

      /**
       * Lencana: persoalan lisensi didahulukan karena menyangkut akses dan
       * pembayaran, dan "perlu disiapkan" tidak ada gunanya dibaca oleh usaha
       * yang modulnya sedang ditangguhkan. Kalau lisensinya sehat, barulah
       * kesiapan yang menentukan.
       */
      const status: ModuleStatus =
        license.state === "aktif" && needsSetup ? "perlu_disiapkan" : license.state;

      views.set(key, {
        ...license,
        status,
        needsSetup,
        setupHint: needsSetup ? (SETUP[key]?.hint ?? null) : null,
        setupHref: needsSetup ? (SETUP[key]?.href ?? null) : null,
        usable: license.canWrite && !needsSetup,
      });
    }
    return views;
  },
);

export async function getModuleView(
  businessId: string,
  module: ModuleKey,
): Promise<ModuleView> {
  const view = (await getModuleViews(businessId)).get(module);
  if (view) return view;
  return {
    ...NOT_OWNED(module),
    status: "tidak_dimiliki",
    needsSetup: false,
    setupHint: null,
    setupHref: null,
    usable: false,
  };
}

// ===========================================================================
// Penjaga
// ===========================================================================

/**
 * Modul yang boleh didelegasikan owner ke karyawan. Finance sengaja tidak ada
 * di sini: harga modal dan margin bukan urusan kasir, dan itu ditegakkan di
 * kode, bukan lewat kolom yang bisa dibalik dari layar.
 */
const GRANTABLE = new Set<string>(STAFF_PERMISSIONS.map((p) => p.key));

function isGrantable(module: ModuleKey): module is StaffPermission {
  return GRANTABLE.has(module);
}

function moduleName(module: ModuleKey): string {
  return MODULE_BY_KEY[module]?.name ?? module;
}

/**
 * Alasan sebuah modul tidak bisa dipakai, dalam kalimat yang boleh dibaca
 * pemilik usaha. Mengembalikan null kalau boleh lanjut.
 *
 * Sengaja MENGEMBALIKAN pesan, bukan melempar galat.
 *
 * Penolakan peran (kasir memanggil action yang bukan haknya) itu jalur yang
 * seharusnya tidak pernah terjadi lewat layar, jadi melempar galat di sana
 * wajar. Tapi masa aktif habis itu keadaan bisnis yang normal dan pasti
 * dialami pelanggan yang telat memperpanjang. Kalau itu dilempar, tidak ada
 * satu pun klien di aplikasi ini yang menangkapnya: galatnya naik ke
 * app/error.tsx, dan Next menyensor pesan aslinya di produksi. Kasir akan
 * melihat layar galat tanpa penjelasan alih-alih kalimat yang menyuruhnya
 * menghubungi pemilik usaha.
 */
export async function moduleLock(
  businessId: string,
  module: ModuleKey,
  mode: "read" | "write",
): Promise<string | null> {
  const license = await getModuleView(businessId, module);
  const name = moduleName(module);

  if (license.state === "tidak_dimiliki") {
    return `${name} belum aktif untuk usaha ini. Hubungi tim KAEL untuk mengaktifkan.`;
  }
  if (license.state === "ditangguhkan") {
    return `${name} sedang ditangguhkan. Hubungi tim KAEL.`;
  }
  /**
   * Konfigurasi belum lengkap: menulis pasti gagal, jadi ditolak lebih awal
   * dengan alasan yang benar. Sebelum ini, pelanggan yang mendaftar member di
   * toko tanpa kurs poin mengisi nama dan nomor WhatsApp-nya lebih dulu, baru
   * ditolak — dan pesannya menyalahkan ketersediaan, bukan menyebut yang
   * sebenarnya kurang.
   *
   * Pesannya tetap tidak menyebut sebabnya ke pelanggan. Yang perlu tahu
   * pemilik usahanya, dan dia melihatnya di dasbornya sendiri.
   */
  if (mode === "write" && license.needsSetup) {
    return `${name} belum selesai disiapkan pemilik usaha.`;
  }
  if (mode === "write" && !license.canWrite) {
    return (
      `Masa aktif ${name} sudah lewat, jadi data baru belum bisa disimpan. ` +
      `Data lama tetap bisa dilihat dan diekspor. Perpanjang lewat tim KAEL untuk membukanya lagi.`
    );
  }
  return null;
}

/**
 * Penjaga peran + lisensi untuk action yang hanya MEMBACA dan tidak
 * mengembalikan ActionResult. Melempar, karena kegagalannya bukan jalur normal.
 */
export async function requireModuleRead(
  module: ModuleKey,
  opts: { ownerOnly?: boolean } = {},
): Promise<Session & { businessId: string }> {
  const session = await getSession();
  if (!session?.businessId || (session.role !== "owner" && session.role !== "staff")) {
    throw new AuthError("Silakan masuk lebih dulu.");
  }

  if (!opts.ownerOnly && isGrantable(module)) {
    if (session.role === "staff" && !session.permissions?.includes(module)) {
      throw new AuthError("Akses ini belum diberikan oleh pemilik usaha.");
    }
  } else if (session.role !== "owner") {
    throw new AuthError("Hanya pemilik usaha yang bisa membuka bagian ini.");
  }

  const locked = await moduleLock(session.businessId, module, "read");
  if (locked) throw new AuthError(locked);

  return session as Session & { businessId: string };
}

/**
 * Penjaga HALAMAN khusus pemilik usaha.
 *
 * Dipakai halaman yang isinya keputusan pemilik: daftar akun staf, harga modal,
 * laporan laba, pengaturan usaha, dan langganan modul. Kasir tidak boleh
 * membukanya walaupun dia mengetik alamatnya sendiri di bilah alamat.
 *
 * MENGALIHKAN, bukan menyembunyikan. Sebelum berkas ini ada, /app hanya
 * memeriksa "sudah masuk atau belum", lalu bagian-bagian yang bukan hak kasir
 * disembunyikan satu per satu di dalam komponen kliennya. Cara itu gagal dengan
 * dua cara sekaligus: satu blok yang lupa diberi syarat langsung terlihat oleh
 * kasir, dan datanya tetap dikirim ke browser walaupun tidak digambar.
 *
 * Karena itu penjaganya ada di server, satu pintu, dan halaman kasir dipisahkan
 * ke alamatnya sendiri alih-alih memakai halaman yang sama dengan pemilik.
 */
export async function guardOwnerPage(
  path: string,
): Promise<Session & { businessId: string; role: "owner" }> {
  const session = await getSession();
  if (!session) redirect(`/app/login?next=${path}`);
  if (session.role === "kael_admin") redirect("/admin/businesses");
  if (!session.businessId) redirect("/app/login");

  // Kasir diantar ke berandanya sendiri, bukan dilempar ke layar galat: dia
  // tidak melakukan kesalahan apa pun, cuma membuka pintu yang bukan pintunya.
  if (session.role !== "owner") redirect("/app/staff?ditolak=area-pemilik");

  return session as Session & { businessId: string; role: "owner" };
}

/**
 * Beranda yang benar untuk sebuah sesi.
 *
 * Satu tempat untuk menjawabnya, supaya tombol kembali di layar kasir tidak
 * perlu menebak. Sebelumnya tombol itu menunjuk "/app" secara tetap, sehingga
 * kasir yang menekannya mendarat di dasbor pemilik.
 */
export function homeFor(role: Session["role"]): string {
  if (role === "kael_admin") return "/admin/businesses";
  return role === "owner" ? "/app" : "/app/staff";
}

/**
 * Penjaga untuk HALAMAN modul. Mengalihkan, bukan melempar, supaya pengguna
 * mendarat di beranda dengan penjelasan alih-alih melihat layar galat.
 */
export async function guardModulePage(
  module: ModuleKey,
  path: string,
): Promise<{ session: Session & { businessId: string }; license: ModuleView }> {
  const session = await getSession();
  if (!session) redirect(`/app/login?next=${path}`);
  if (session.role === "kael_admin") redirect("/admin/cards");
  if (!session.businessId) redirect("/app/login");

  // Penolakan mengantar ke beranda MASING-MASING peran. Versi sebelumnya selalu
  // menunjuk "/app", jadi kasir yang membuka modul di luar haknya justru
  // mendarat di dasbor pemilik — persis tempat yang seharusnya tertutup baginya.
  const beranda = homeFor(session.role);

  const license = await getModuleView(session.businessId, module);
  // Modul yang tidak dimiliki atau ditangguhkan: layarnya tidak dibuka sama
  // sekali. Modul yang lewat masa aktif tetap dibuka, dalam mode baca-saja.
  if (!license.canRead) redirect(`${beranda}?terkunci=${module}`);

  if (isGrantable(module)) {
    if (session.role === "staff" && !session.permissions?.includes(module)) {
      redirect(`${beranda}?ditolak=${module}`);
    }
  } else if (session.role !== "owner") {
    redirect(`${beranda}?ditolak=${module}`);
  }

  /**
   * Belum selesai disiapkan: pemilik usaha TETAP masuk, karena dialah yang
   * harus membereskannya dan layarnya itu sendiri tempat membereskannya.
   * Kasir dihentikan di sini — dia tidak punya wewenang menyetel apa pun, dan
   * membiarkannya masuk cuma menyerahkan layar yang setiap tombolnya menolak.
   */
  if (license.needsSetup && session.role !== "owner") {
    redirect(`${beranda}?belumsiap=${module}`);
  }

  return { session: session as Session & { businessId: string }, license };
}
