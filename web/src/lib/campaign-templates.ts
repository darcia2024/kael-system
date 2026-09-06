import type { MemberSegment } from "./member-segments";

/**
 * KAEL System · Template Campaign & Kode Promo
 *
 * Teks statis yang diedit lebih sering daripada skema database, jadi hidup di
 * kode (bisa direvisi lewat git, bukan migrasi) — bukan di tabel. Owner tetap
 * bisa mengedit pesannya sendiri sebelum daftar dibuat; ini cuma titik awal.
 *
 * Ulang tahun sengaja TIDAK ada di daftar ini. Dia sudah punya alur sendiri
 * (lihat tab Ajakan WA bagian "Ulang Tahun & Anniversary") dengan mesin bonus
 * poinnya sendiri yang cair saat owner menandai pesan terkirim. Menambahkan
 * jalur kedua di sini cuma akan memberi owner dua cara berbeda membuat
 * campaign ulang tahun yang sama.
 */

export type CampaignGoalKey =
  | "member_baru"
  | "kembali_lagi"
  | "naikkan_frekuensi"
  | "poin_hampir_hangus"
  | "promo_produk";

export interface CampaignGoal {
  key: CampaignGoalKey;
  name: string;
  description: string;
  /** 'segment': target dari empat MemberSegment biasa. 'expiring_points': dari daftar kedaluwarsa poin. */
  targetSource: "segment" | "expiring_points";
  segment?: MemberSegment;
  messageTemplate: string;
  /** Titik awal, bukan patokan. Isi 0 kalau kodenya cuma buat melacak diskon manual di kasir. */
  defaultRewardPoints: number;
}

export const CAMPAIGN_GOALS: CampaignGoal[] = [
  {
    key: "member_baru",
    name: "Ajak member baru belanja",
    description: "Sudah daftar, tapi belum pernah tercatat belanja.",
    targetSource: "segment",
    segment: "new",
    messageTemplate: "Halo {{nama}}, makasih sudah jadi member {{toko}}! Pakai kode {{kode}} di kasir waktu belanja pertamamu, ada bonus spesial nunggu.",
    defaultRewardPoints: 5,
  },
  {
    key: "kembali_lagi",
    name: "Ajak yang lama tidak belanja",
    description: "Lebih dari 60 hari tidak ada transaksi.",
    targetSource: "segment",
    segment: "inactive",
    messageTemplate: "Halo {{nama}}, udah lama nggak mampir ke {{toko}} nih. Pakai kode {{kode}} di kasir buat bonus belanja berikutnya!",
    defaultRewardPoints: 10,
  },
  {
    key: "naikkan_frekuensi",
    name: "Dorong yang sudah aktif",
    description: "Masih rutin belanja dalam 30 hari terakhir.",
    targetSource: "segment",
    segment: "active",
    messageTemplate: "Halo {{nama}}, makasih udah jadi pelanggan setia {{toko}}! Pakai kode {{kode}} di kasir buat bonus belanja minggu ini.",
    defaultRewardPoints: 5,
  },
  {
    key: "poin_hampir_hangus",
    name: "Poin hampir hangus",
    description: "Daftarnya sudah dihitung di tab Aturan Program — dipakai ulang di sini.",
    targetSource: "expiring_points",
    messageTemplate: "Halo {{nama}}, poinmu di {{toko}} bakal hangus sebentar lagi! Pakai kode {{kode}} di kasir sebelum keburu hilang.",
    defaultRewardPoints: 0,
  },
  {
    key: "promo_produk",
    name: "Promo produk / musiman",
    description: "Bebas — target awalnya member aktif, boleh diubah sebelum dibuat.",
    targetSource: "segment",
    segment: "active",
    messageTemplate: "Halo {{nama}}, {{toko}} lagi ada promo spesial! Pakai kode {{kode}} di kasir buat dapat bonusnya.",
    defaultRewardPoints: 5,
  },
];
