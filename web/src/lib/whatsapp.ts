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

/**
 * Template yang dipakai saat pesannya di luar jendela 24 jam.
 *
 * WhatsApp Cloud API hanya menerima teks bebas untuk nomor yang MENGIRIM pesan
 * ke nomor bisnis dalam 24 jam terakhir. Di luar itu ditolak dengan galat
 * 131047, dan yang boleh dikirim cuma template yang sudah disetujui Meta.
 *
 * Dua pemakaian WhatsApp di KAEL justru selalu di luar jendela itu: owner tidak
 * pernah mengirim pesan ke nomor tokonya sendiri, dan pelanggan meminta tautan
 * kartunya lewat halaman web. Jadi tanpa template, keduanya hampir selalu gagal.
 */
export type JenisPesanWa = "notifikasi" | "tautan_member";

export async function kirimPesanWhatsApp(
  businessId: string,
  tujuan: string,
  pesan: string,
  /**
   * Jenis pesan menentukan template mana yang dipakai. Parameternya mengisi
   * {{1}}, {{2}}, ... pada template yang sudah disetujui, urut.
   */
  opsi?: { jenis?: JenisPesanWa; parameter?: string[] },
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
        body: JSON.stringify(bangunIsi(nomor, pesan, channel, opsi)),
      },
    );

    if (!balasan.ok) {
      const isi = await balasan.text();
      console.error("[KAEL] WhatsApp Cloud API menolak", balasan.status, isi.slice(0, 500));
      return {
        terkirim: false,
        alasan: alasanPenolakan(isi),
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

/**
 * Menyusun isi permintaan ke Cloud API.
 *
 * Template dipakai kalau namanya sudah disetel; kalau tidak, dicoba sebagai
 * teks bebas — yang cuma berhasil di dalam jendela 24 jam.
 */
function bangunIsi(
  nomor: string,
  pesan: string,
  channel: { template_notifikasi?: string | null; template_tautan_member?: string | null; template_bahasa?: string | null },
  opsi?: { jenis?: JenisPesanWa; parameter?: string[] },
) {
  const namaTemplate =
    opsi?.jenis === "notifikasi"
      ? channel.template_notifikasi?.trim()
      : opsi?.jenis === "tautan_member"
        ? channel.template_tautan_member?.trim()
        : null;

  if (!namaTemplate) {
    return {
      messaging_product: "whatsapp",
      to: nomor,
      type: "text",
      text: { preview_url: true, body: pesan },
    };
  }

  return {
    messaging_product: "whatsapp",
    to: nomor,
    type: "template",
    template: {
      name: namaTemplate,
      language: { code: channel.template_bahasa?.trim() || "id" },
      components: (opsi?.parameter ?? []).length
        ? [
            {
              type: "body",
              parameters: (opsi!.parameter ?? []).map((teks) => ({ type: "text", text: teks })),
            },
          ]
        : [],
    },
  };
}

/**
 * Menerjemahkan penolakan Meta jadi kalimat yang menyebut penyebabnya.
 *
 * Yang paling sering muncul dan paling membingungkan adalah 131047: pesannya
 * ditolak bukan karena salah nomor atau salah token, melainkan karena lewat
 * jendela 24 jam. Tanpa disebutkan, orang akan memeriksa hal yang salah
 * berjam-jam.
 */
function alasanPenolakan(isiBalasan: string): string {
  if (isiBalasan.includes("131047")) {
    return "Lewat jendela 24 jam WhatsApp. Pesan bebas cuma boleh ke nomor yang baru mengirim chat; untuk kabar seperti ini butuh template yang sudah disetujui Meta.";
  }
  if (isiBalasan.includes("132001") || isiBalasan.includes("does not exist")) {
    return "Nama template tidak ditemukan di akun WhatsApp toko, atau bahasanya tidak cocok.";
  }
  if (isiBalasan.includes("131030")) {
    return "Nomor tujuan belum terdaftar di daftar penerima uji. Nomor uji Meta cuma bisa mengirim ke nomor yang sudah didaftarkan.";
  }
  if (isiBalasan.includes("190") || isiBalasan.toLowerCase().includes("access token")) {
    return "Token WhatsApp sudah kedaluwarsa atau tidak berlaku. Token sementara hanya hidup 24 jam — pakai token System User yang permanen.";
  }
  return "WhatsApp menolak pengiriman pesannya.";
}
