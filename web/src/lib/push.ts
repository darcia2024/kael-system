import "server-only";
import webpush from "web-push";

import { sql } from "./postgres";

/**
 * Notifikasi push KAEL.
 *
 * Dibangun untuk satu keperluan yang jelas: pemilik usaha harus tahu ada
 * pengembalian dana pada DETIK itu juga. Lapis inilah yang paling berpengaruh
 * mencegah refund fiktif — bukan karena hukumannya, tapi karena kepastian
 * ketahuannya.
 *
 * WhatsApp sengaja tidak dipakai untuk ini. Mendaftarkan sebuah nomor ke
 * WhatsApp Cloud API MENGUNCI nomor itu: sesudahnya tidak bisa lagi dibuka di
 * aplikasi WhatsApp biasa. Kafe yang pelanggannya memesan lewat chat akan
 * kehilangan WhatsApp hariannya demi satu notifikasi — pertukaran yang tidak
 * masuk akal. Push tidak menyentuh WhatsApp sama sekali dan gratis selamanya.
 */

const PUBLIC_KEY = process.env.VAPID_PUBLIC_KEY ?? process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
const PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY;
const KONTAK = process.env.VAPID_SUBJECT ?? "mailto:daru.fahma@gmail.com";

let siap = false;

/**
 * Kunci VAPID dibaca dari environment, tidak pernah dari basis data.
 *
 * Kunci privat ini menandatangani seluruh notifikasi KAEL untuk semua tenant;
 * menyimpannya bersama data tenant berarti satu kebocoran basis data
 * memungkinkan siapa pun mengirim notifikasi atas nama KAEL.
 */
function siapkan(): boolean {
  if (siap) return true;
  if (!PUBLIC_KEY || !PRIVATE_KEY) return false;
  webpush.setVapidDetails(KONTAK, PUBLIC_KEY, PRIVATE_KEY);
  siap = true;
  return true;
}

export function pushDikonfigurasi(): boolean {
  return Boolean(PUBLIC_KEY && PRIVATE_KEY);
}

export type IsiNotifikasi = {
  judul: string;
  pesan: string;
  /** Halaman yang dibuka saat notifikasinya ditekan. */
  tautan?: string;
  /**
   * Notifikasi dengan tag sama saling menimpa, bukan menumpuk. Dipakai supaya
   * lima refund berturut-turut tidak meninggalkan lima baris di layar kunci.
   */
  tag?: string;
};

/**
 * Mengirim notifikasi ke SEMUA perangkat milik para owner sebuah usaha.
 *
 * Owner bisa memasang KAEL di HP dan di laptop sekaligus, dan keduanya berhak
 * menerima kabar yang sama — yang dibuka duluan yang mana pun.
 */
export async function kirimNotifikasiOwner(
  businessId: string,
  isi: IsiNotifikasi,
): Promise<{ terkirim: number; gagal: number }> {
  if (!siapkan()) {
    console.warn("[KAEL] kunci VAPID belum diisi; notifikasi push dilewati");
    return { terkirim: 0, gagal: 0 };
  }

  const langganan = await sql`
    SELECT s.id, s.endpoint, s.p256dh, s.auth
    FROM push_subscriptions s
    JOIN users u ON u.id = s.user_id
    WHERE s.business_id = ${businessId} AND u.role = 'owner' AND u.is_active
  `;
  if (!langganan.length) return { terkirim: 0, gagal: 0 };

  const muatan = JSON.stringify(isi);
  let terkirim = 0;
  let gagal = 0;

  await Promise.all(
    langganan.map(async (s) => {
      try {
        await webpush.sendNotification(
          {
            endpoint: s.endpoint as string,
            keys: { p256dh: s.p256dh as string, auth: s.auth as string },
          },
          muatan,
        );
        terkirim++;
        await sql`UPDATE push_subscriptions SET last_used_at = NOW() WHERE id = ${s.id as string}`;
      } catch (error) {
        gagal++;
        const status = (error as { statusCode?: number }).statusCode;

        /**
         * 404 dan 410 berarti langganannya sudah mati permanen — aplikasinya
         * dihapus, atau izin notifikasinya dicabut. Barisnya dibuang supaya
         * tidak dicoba lagi selamanya. Galat lain (jaringan, 5xx) dibiarkan:
         * perangkatnya mungkin cuma sedang mati.
         */
        if (status === 404 || status === 410) {
          await sql`DELETE FROM push_subscriptions WHERE id = ${s.id as string}`;
        } else {
          console.error("[KAEL] notifikasi push gagal", status, (error as Error).message);
        }
      }
    }),
  );

  return { terkirim, gagal };
}

/** Menyimpan langganan perangkat. Mendaftar ulang dari perangkat yang sama tidak menggandakan. */
export async function simpanLangganan(
  businessId: string,
  userId: string,
  langganan: { endpoint: string; keys: { p256dh: string; auth: string } },
  label?: string,
) {
  await sql`
    INSERT INTO push_subscriptions ${sql({
      business_id: businessId,
      user_id: userId,
      endpoint: langganan.endpoint,
      p256dh: langganan.keys.p256dh,
      auth: langganan.keys.auth,
      label: label ?? null,
    })}
    ON CONFLICT (endpoint) DO UPDATE SET
      business_id = EXCLUDED.business_id,
      user_id = EXCLUDED.user_id,
      p256dh = EXCLUDED.p256dh,
      auth = EXCLUDED.auth,
      label = EXCLUDED.label
  `;
}

export async function hapusLangganan(endpoint: string) {
  await sql`DELETE FROM push_subscriptions WHERE endpoint = ${endpoint}`;
}
