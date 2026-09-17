"use server";

import { AuthError, getSession } from "./auth";
import { hapusLangganan, kirimNotifikasiOwner, pushDikonfigurasi, simpanLangganan } from "./push";
import type { ActionResult } from "./actions";

/**
 * Pendaftaran perangkat untuk notifikasi KAEL.
 *
 * Yang didaftarkan BUKAN nomor atau akun, melainkan satu perangkat: satu HP,
 * satu peramban. Owner yang memasang KAEL di HP dan di laptop mendaftar dua
 * kali, dan itu memang yang diinginkan — kabar uang keluar sebaiknya sampai ke
 * layar mana pun yang sedang dipegang.
 */

export type LanggananDariPeramban = {
  endpoint: string;
  keys: { p256dh: string; auth: string };
};

/**
 * Hanya owner yang dilanggankan.
 *
 * Isi notifikasinya kabar pengembalian dana — persis hal yang sedang diawasi
 * dari kasir. Kasir yang bisa mendaftarkan HP-nya sendiri berarti tahu kapan
 * owner menerima kabarnya, dan itu justru membalik gunanya.
 */
async function penjagaOwner() {
  const sesi = await getSession();
  if (!sesi || !sesi.businessId || sesi.role !== "owner") {
    throw new AuthError("Hanya pemilik usaha yang bisa menyalakan notifikasi ini.");
  }
  return sesi as typeof sesi & { businessId: string };
}

export async function subscribePushAction(
  langganan: LanggananDariPeramban,
  label?: string,
): Promise<ActionResult<null>> {
  try {
    const sesi = await penjagaOwner();

    if (!pushDikonfigurasi()) {
      return {
        ok: false,
        error: "Notifikasi belum disiapkan di server (kunci VAPID kosong). Hubungi KAEL.",
      };
    }

    if (!langganan?.endpoint || !langganan.keys?.p256dh || !langganan.keys?.auth) {
      return { ok: false, error: "Data langganan dari peramban tidak lengkap." };
    }

    await simpanLangganan(sesi.businessId, sesi.userId, langganan, label);

    /**
     * Satu notifikasi uji dikirim langsung, dan ini bukan basa-basi: izin
     * peramban bisa berstatus "granted" sementara pengirimannya tetap tidak
     * sampai — HP hemat baterai, notifikasi aplikasi dimatikan di setelan
     * sistem, atau PWA-nya belum dipasang ke layar utama di iPhone. Kalau
     * kegagalan itu baru ketahuan saat ada refund sungguhan, owner mengira
     * dirinya diawasi padahal tidak.
     */
    await kirimNotifikasiOwner(sesi.businessId, {
      judul: "Notifikasi KAEL aktif",
      pesan: "Mulai sekarang setiap pengembalian dana masuk ke HP ini.",
      tautan: "/app/pos/reports",
      tag: "kael-uji",
    });

    return { ok: true, data: null };
  } catch (error) {
    if (error instanceof AuthError) return { ok: false, error: error.message };
    console.error("[KAEL] pendaftaran notifikasi gagal", error);
    return { ok: false, error: "Gagal menyimpan langganan notifikasi." };
  }
}

export async function unsubscribePushAction(endpoint: string): Promise<ActionResult<null>> {
  try {
    await penjagaOwner();
    await hapusLangganan(endpoint);
    return { ok: true, data: null };
  } catch (error) {
    if (error instanceof AuthError) return { ok: false, error: error.message };
    console.error("[KAEL] pencabutan notifikasi gagal", error);
    return { ok: false, error: "Gagal mencabut langganan notifikasi." };
  }
}

/**
 * Kunci publik VAPID dikirim ke peramban lewat action, bukan lewat variabel
 * NEXT_PUBLIC_.
 *
 * Alasannya praktis: variabel NEXT_PUBLIC_ dipanggang ke dalam bundel saat
 * build. Kalau kuncinya baru diisi di Vercel setelah build terakhir, tombolnya
 * akan diam-diam gagal sampai ada deploy berikutnya — kegagalan yang sangat
 * sulit ditebak dari layar.
 */
export async function ambilKunciPushAction(): Promise<ActionResult<{ kunci: string }>> {
  try {
    await penjagaOwner();
    const kunci = process.env.VAPID_PUBLIC_KEY ?? process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
    if (!kunci) {
      return { ok: false, error: "Kunci notifikasi belum dipasang di server." };
    }
    return { ok: true, data: { kunci } };
  } catch (error) {
    if (error instanceof AuthError) return { ok: false, error: error.message };
    throw error;
  }
}
