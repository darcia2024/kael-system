import type { Metadata } from "next";

import { db } from "@/lib/db";
import { guardOwnerPage, getModuleViews } from "@/lib/licensing";
import { MODULE_BY_KEY, type ModuleKey } from "@/lib/modules-catalog";
import SettingsClient, { type ModuleRow } from "./settings-client";

/**
 * Pengaturan usaha. Hanya pemilik usaha.
 *
 * Dua hal yang tidak boleh disentuh kasir tinggal di sini:
 *
 *   1. QRIS toko. Ini menentukan ke rekening SIAPA uang pelanggan mengalir.
 *      Kasir yang bisa menggantinya tinggal memasang QRIS pribadinya, dan
 *      setiap pembayaran masuk ke kantongnya sementara sistem tetap mencatat
 *      transaksinya lunas. Pemilik usaha baru menyadarinya saat rekonsiliasi.
 *
 *   2. Daftar kesiapan modul. Modul yang sudah dibayar tapi belum disetel
 *      tampil di sini beserta apa yang kurang, supaya "Aktif" di dasbor tidak
 *      pernah lagi berarti "sebenarnya belum bisa dipakai".
 */

export const metadata: Metadata = {
  title: "Pengaturan Usaha",
  robots: { index: false, follow: false },
};

export default async function SettingsPage() {
  const session = await guardOwnerPage("/app/settings");

  const [business, views] = await Promise.all([
    db.getBusiness(session.businessId),
    getModuleViews(session.businessId),
  ]);

  const modules: ModuleRow[] = (Object.keys(MODULE_BY_KEY) as ModuleKey[])
    .map((key) => {
      const view = views.get(key);
      const entry = MODULE_BY_KEY[key];
      if (!view || !entry || view.state === "tidak_dimiliki") return null;
      return {
        key,
        name: entry.name,
        status: view.status,
        setupHint: view.setupHint,
        setupHref: view.setupHref,
      };
    })
    .filter((m): m is ModuleRow => m !== null);

  return (
    <SettingsClient
      businessName={business?.name ?? "Usahamu"}
      storeCode={business?.store_code ?? null}
      qris={{
        payload: business?.qris_payload ?? null,
        merchantName: business?.qris_merchant_name ?? null,
        merchantCity: business?.qris_merchant_city ?? null,
        nmid: business?.qris_nmid ?? null,
      }}
      modules={modules}
    />
  );
}
