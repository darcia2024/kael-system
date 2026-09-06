import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { db } from "@/lib/db";
import { normalizeCardCode } from "@/lib/card-code";
import RatingClient from "./rating-client";

/**
 * Halaman penilaian yang dibuka kartu NFC KAEL Review.
 *
 * Terbuka tanpa login: yang membukanya pelanggan kafe yang baru saja menempelkan
 * ponselnya ke sebuah kartu di meja. Tidak ada yang bisa diminta darinya selain
 * satu ketukan.
 *
 * Halaman ini SENGAJA tidak menerima apa pun dari query string selain kode
 * kartu. Nama toko, warna, dan alamat ulasan Google semuanya dibaca dari
 * database berdasarkan kode itu. Kalau salah satunya boleh dititipkan lewat
 * URL, kartu siapa pun bisa dipakai menampilkan nama kafe orang lain.
 */

export const metadata: Metadata = {
  title: "Beri Penilaian",
  robots: { index: false, follow: false },
};

export default async function RatingPage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code } = await params;
  const cardCode = normalizeCardCode(code);
  const card = await db.getRatingCard(cardCode);

  /**
   * Kartu yang tidak dikenali, tidak aktif, atau bukan kartu Review dikirim ke
   * halaman status yang sudah ada — bukan ke 404. Yang memegang kartunya
   * pelanggan, bukan pemilik usaha; dia tidak bisa memperbaiki apa pun dan
   * tidak perlu melihat layar galat.
   */
  if (!card) {
    redirect("/r/status?type=not_found");
  }

  return (
    <RatingClient
      cardCode={cardCode}
      businessName={card.business_name}
      logoUrl={card.logo_url}
      brandColor={card.brand_color}
    />
  );
}
