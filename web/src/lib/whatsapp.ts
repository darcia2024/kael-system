import "server-only";

import { db } from "./db";
import { normalizePhoneNumber } from "./loyalty-engine";

/**
 * Satu-satunya pintu keluar pesan WhatsApp KAEL.
 *
 * Sampai sekarang KAEL tidak punya jalur pengiriman sama sekali: kolom
 * penyetelannya sudah ada di `business_messaging_channels` sejak lama, tapi
 * tidak ada satu baris pun yang benar-benar mengirim. Jadi "notifikasi
 * WhatsApp" selama ini berupa tempat penyimpanan nomor, bukan pesan yang
 * sampai ke orangnya.
 *
 * Yang dibangun di sini pintunya, bukan janjinya:
 *
 *   meta_cloud  benar-benar terkirim lewat WhatsApp Cloud API milik toko
 *   manual      TIDAK bisa terkirim sendiri; yang dikembalikan tautan wa.me
 *               untuk ditekan stafnya
 *
 * Bedanya dinyatakan terang-terangan lewat `terkirim`. Layar yang memanggil
 * fungsi ini TIDAK boleh bilang "sudah dikirim" kalau nilainya false — pesan
 * sukses palsu persis yang bikin printer diam berjam-jam tanpa ada yang curiga.
 */
export type HasilKirimWa =
  | { terkirim: true; lewat: "meta_cloud" }
  | { terkirim: false; alasan: string; tautanManual: string };

/** Tautan wa.me untuk dibuka staf secara manual. */
export function tautanWa(tujuan: string, pesan: string): string {
  return `https://wa.me/${normalizePhoneNumber(tujuan)}?text=${encodeURIComponent(pesan)}`;
}

export async function kirimPesanWhatsApp(
  businessId: string,
  tujuan: string,
  pesan: string,
): Promise<HasilKirimWa> {
  const nomor = normalizePhoneNumber(tujuan);
  const manual = tautanWa(nomor, pesan);

  const channel = await db.getMessagingChannel(businessId);

  if (!channel || !channel.is_enabled) {
    return {
      terkirim: false,
      alasan: "Channel WhatsApp toko ini belum disiapkan.",
      tautanManual: manual,
    };
  }

  if (channel.provider !== "meta_cloud") {
    return {
      terkirim: false,
      alasan: "Toko ini memakai pengiriman manual, jadi pesannya dikirim staf.",
      tautanManual: manual,
    };
  }

  /**
   * Tokennya dibaca dari environment lewat NAMA yang disimpan di secret_ref,
   * bukan disimpan di basis data. Token Cloud API berlaku untuk seluruh nomor
   * bisnis; menyimpannya bersama data tenant berarti satu kebocoran basis data
   * membuka WhatsApp resmi semua toko sekaligus.
   */
  const token = channel.secret_ref ? process.env[channel.secret_ref] : undefined;
  if (!token || !channel.phone_number_id) {
    return {
      terkirim: false,
      alasan: "Kredensial WhatsApp Cloud API belum lengkap di server.",
      tautanManual: manual,
    };
  }

  try {
    const balasan = await fetch(
      `https://graph.facebook.com/v21.0/${channel.phone_number_id}/messages`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          messaging_product: "whatsapp",
          to: nomor,
          type: "text",
          text: { preview_url: true, body: pesan },
        }),
      },
    );

    if (!balasan.ok) {
      const isi = await balasan.text();
      console.error("[KAEL] WhatsApp Cloud API menolak", balasan.status, isi.slice(0, 300));
      return {
        terkirim: false,
        alasan: "WhatsApp menolak pengiriman pesannya.",
        tautanManual: manual,
      };
    }

    return { terkirim: true, lewat: "meta_cloud" };
  } catch (error) {
    console.error("[KAEL] pengiriman WhatsApp gagal", error);
    return {
      terkirim: false,
      alasan: "Pengiriman WhatsApp tidak bisa dijangkau dari server.",
      tautanManual: manual,
    };
  }
}
