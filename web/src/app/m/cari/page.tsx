import type { Metadata } from "next";

import { db } from "@/lib/db";
import CariKartuClient from "./cari-kartu-client";

/**
 * Halaman "lupa tautan kartu member".
 *
 * Dibuka pelanggan yang sudah jadi member tapi kehilangan tautannya — struknya
 * terbuang, chat WhatsApp-nya tergeser, atau ganti HP. Tanpa halaman ini
 * satu-satunya jalan adalah bertanya ke kasir, dan poin yang tidak bisa dibuka
 * sama saja dengan poin yang tidak ada.
 *
 * Tidak butuh login: yang membukanya pelanggan, dan pelanggan tidak punya akun.
 */
export const metadata: Metadata = {
  title: "Cari Kartu Member",
  robots: { index: false, follow: false },
};

/** Isinya bergantung toko yang diminta, jadi tidak boleh dicache lintas pengunjung. */
export const dynamic = "force-dynamic";

export default async function CariKartuPage({
  searchParams,
}: {
  searchParams: Promise<{ toko?: string }>;
}) {
  const { toko } = await searchParams;
  const business = toko?.trim() ? await db.getBusinessByStoreCode(toko.trim()) : null;

  return (
    <CariKartuClient
      storeCode={business?.store_code ?? toko?.trim() ?? ""}
      businessName={business?.name ?? null}
      logoUrl={business?.logo_url ?? null}
      brandColor={business?.brand_color ?? "#0b3d2e"}
    />
  );
}
