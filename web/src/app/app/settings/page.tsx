import type { Metadata } from "next";

import { db } from "@/lib/db";
import { guardOwnerPage, getModuleViews } from "@/lib/licensing";
import { mochiThemeClass } from "@/lib/mochi-theme";
import { MODULE_BY_KEY, type ModuleKey } from "@/lib/modules-catalog";
import SettingsClient, { type ModuleRow } from "./settings-client";
import ReadinessPanel from "./readiness-panel";

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

  const [business, views, channel, cards] = await Promise.all([
    db.getBusiness(session.businessId),
    getModuleViews(session.businessId),
    db.getMessagingChannel(session.businessId),
    db.getCards(session.businessId),
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
    <>
    <SettingsClient
      business={business}
      themeClassName={mochiThemeClass(business)}
      businessName={business?.name ?? "Usahamu"}
      storeCode={business?.store_code ?? null}
      qris={{
        payload: business?.qris_payload ?? null,
        merchantName: business?.qris_merchant_name ?? null,
        merchantCity: business?.qris_merchant_city ?? null,
        nmid: business?.qris_nmid ?? null,
      }}
      posCharges={{
        taxRate: Number(business?.pos_tax_rate ?? 0),
        serviceChargeRate: Number(business?.pos_service_charge_rate ?? 0),
      }}
      refundLimits={{
        maxPerTransaction: Number(business?.refund_max_per_transaction ?? 0),
        dailyLimitPerCashier: Number(business?.refund_daily_limit_per_cashier ?? 0),
      }}
      modules={modules}
    />
    <div className="mx-auto max-w-3xl px-4 pb-8 sm:px-8">
      <ReadinessPanel checks={[
        { label: "QRIS merchant", ready: Boolean(business?.qris_payload), detail: business?.qris_payload ? "Payload QRIS tersimpan. Cetak uji di struk dan bayar nominal kecil." : "Belum ada payload QRIS merchant.", href: "/app/settings" },
        { label: "WhatsApp tenant", ready: Boolean(channel?.is_enabled && channel.sender_phone), detail: channel?.is_enabled ? `Channel ${channel.provider} aktif. Kirim pesan uji ke nomor sendiri.` : "Channel belum aktif. Pesan masih memakai tombol wa.me manual.", href: "/app/settings/brand" },
        { label: "Google Review", ready: Boolean(business?.google_place_id), detail: business?.google_place_id ? "Place ID tersimpan. Jalankan sinkronisasi lalu cek rating di dashboard Review." : "Place ID Google belum diisi.", href: "/app/review" },
        { label: "Thermal printer", ready: false, detail: "Butuh cetak langsung dari browser pada printer 58/80 mm. Klik Cetak uji lalu pilih printer kasir.", href: "/app/pos" },
        { label: "Selfie, GPS, QR/NFC absensi", ready: cards.some((card) => card.type === "attendance" && card.status === "active"), detail: "Buka layar absensi dari HP staf dan uji izin kamera, GPS, QR, serta NFC yang dipakai di lokasi.", href: "/app/hr" },
      ]} />
    </div>
    </>
  );
}
