"use client";

import Link from "next/link";
import { ArrowLeft, QrCode, CheckCircle2, AlertTriangle, Wrench, ArrowRight, MessageSquare, PhoneCall } from "lucide-react";

import QrisSetup from "./qris-setup";
import PosChargeSetup from "./pos-charge-setup";
import DeliveryContactSetup from "./delivery-contact-setup";
import { BusinessMark } from "@/components/business-mark";
import type { Business } from "@/lib/types";
import type { ModuleStatus } from "@/lib/licensing";
import type { ModuleKey } from "@/lib/modules-catalog";

export interface ModuleRow {
  key: ModuleKey;
  name: string;
  status: ModuleStatus;
  setupHint: string | null;
  setupHref: string | null;
}

/**
 * Lencana status modul.
 */
const BADGE: Record<ModuleStatus, { teks: string; warna: string; bg: string; garis: string }> = {
  aktif: { teks: "Aktif", warna: "#16a34a", bg: "#dcfce7", garis: "#16a34a" },
  perlu_disiapkan: { teks: "Perlu disiapkan", warna: "#b45309", bg: "#fef3c7", garis: "#b45309" },
  tenggang: { teks: "Masa tenggang", warna: "#b45309", bg: "#fef3c7", garis: "#b45309" },
  kedaluwarsa: { teks: "Baca-saja", warna: "#b91c1c", bg: "#fee2e2", garis: "#b91c1c" },
  ditangguhkan: { teks: "Ditangguhkan", warna: "#b91c1c", bg: "#fee2e2", garis: "#b91c1c" },
  tidak_dimiliki: { teks: "Belum aktif", warna: "#7b7b8e", bg: "#f2f2f7", garis: "#c9c9d4" },
};

export default function SettingsClient({
  businessName,
  storeCode,
  qris,
  posCharges,
  modules,
  business,
  themeClassName,
}: {
  businessName: string;
  storeCode: string | null;
  qris: {
    payload: string | null;
    merchantName: string | null;
    merchantCity: string | null;
    nmid: string | null;
  };
  posCharges: { taxRate: number; serviceChargeRate: number };
  modules: ModuleRow[];
  business?: Business | null;
  themeClassName?: string;
}) {
  const perluDisiapkan = modules.filter((m) => m.setupHint);

  return (
    <div className={`${themeClassName || ""} min-h-screen bg-[#f0f5f2] text-[#1a382d] font-sans`}>
      <header className="sticky top-0 z-30 border-b border-emerald-800/60 bg-[#0b3d2e] px-4 sm:px-8 py-3 text-white backdrop-blur-md shadow-sm">
        <div className="mx-auto flex max-w-3xl items-center gap-3">
          <Link
            href="/app"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-emerald-600/40 bg-white/10 text-white hover:bg-white/15 transition-colors"
            title="Kembali ke Beranda"
          >
            <ArrowLeft size={16} />
          </Link>
          <BusinessMark
            name={business?.name || businessName}
            logoUrl={business?.logo_url}
            brandColor={business?.brand_color}
            className="h-9 w-9 shrink-0 rounded-full border border-emerald-400/40 bg-white p-0.5 shadow-xs"
          />
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h1 className="font-extrabold text-sm sm:text-base truncate text-white tracking-tight">Pengaturan Usaha</h1>
              <span className="rounded-full bg-[#c8f53a] px-2 py-0.5 font-mono text-[9px] font-bold text-[#073829] shrink-0">
                Admin Toko
              </span>
            </div>
            <span className="text-[10.5px] text-emerald-200/80 font-mono block truncate">
              {businessName}
              {storeCode ? ` · kode toko ${storeCode}` : ""}
            </span>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 sm:px-8 py-6 space-y-5">
        {perluDisiapkan.length > 0 && (
          <div className="flex items-start gap-2.5 rounded-2xl border border-amber-200/90 bg-[#fffbeb] px-4 py-3.5 text-[#92400e] shadow-xs">
            <AlertTriangle size={18} className="shrink-0 mt-0.5" />
            <div className="font-mono text-xs">
              <p className="font-bold">
                {perluDisiapkan.length} modul sudah aktif tapi belum selesai disiapkan.
              </p>
              <p className="mt-0.5">
                Selama belum beres, bagian itu belum bisa dipakai kasir maupun pelanggan.
              </p>
            </div>
          </div>
        )}

        {/* --- NOMOR WHATSAPP DELIVERY & KONTAK TOKO --- */}
        <section className="rounded-3xl border border-[#d8e3de] bg-white p-6 shadow-[0_4px_20px_rgba(11,61,46,0.04)] space-y-4">
          <div className="flex items-center gap-2 border-b border-[#d8e3de] pb-4">
            <PhoneCall size={20} className="text-[#167052]" />
            <div>
              <h2 className="font-extrabold text-base text-[#0b3d2e]">Nomor WhatsApp Delivery &amp; Kontak Toko</h2>
              <p className="font-mono text-[11px] text-[#527867]">
                Digunakan untuk pesanan delivery member &amp; konfirmasi pembayaran pelanggan
              </p>
            </div>
          </div>

          <DeliveryContactSetup
            initialPhone={business?.phone}
            initialAddress={business?.address}
            businessName={business?.name || businessName}
          />
        </section>

        {/* --- QRIS --- */}
        <section className="rounded-3xl border border-[#d8e3de] bg-white p-6 shadow-[0_4px_20px_rgba(11,61,46,0.04)] space-y-4">
          <div className="flex items-center gap-2 border-b border-[#d8e3de] pb-4">
            <QrCode size={20} className="text-[#167052]" />
            <div>
              <h2 className="font-extrabold text-base text-[#0b3d2e]">QRIS Toko</h2>
              <p className="font-mono text-[11px] text-[#527867]">
                Hanya pemilik usaha yang bisa mengubah ini
              </p>
            </div>
          </div>

          <QrisSetup
            payload={qris.payload}
            merchantName={qris.merchantName}
            merchantCity={qris.merchantCity}
            nmid={qris.nmid}
          />
        </section>

        <section className="rounded-3xl border border-[#d8e3de] bg-white p-6 shadow-[0_4px_20px_rgba(11,61,46,0.04)]">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div><h2 className="font-extrabold text-base text-[#0b3d2e]">Brand, White Label & WhatsApp</h2><p className="mt-1 font-mono text-[11px] text-[#527867]">Nama aplikasi, domain tenant, dan nomor pengirim WhatsApp per usaha.</p></div>
            <Link href="/app/settings/brand" className="rounded-xl bg-[#0b3d2e] hover:bg-[#0e4837] px-3.5 py-2 font-mono text-xs font-bold text-[#c8f53a] shadow-xs transition-colors">Atur Brand</Link>
          </div>
        </section>

        <section className="rounded-3xl border border-[#d8e3de] bg-white p-6 shadow-[0_4px_20px_rgba(11,61,46,0.04)] space-y-4">
          <div className="flex items-center gap-2 border-b border-[#d8e3de] pb-4">
            <Wrench size={20} className="text-[#167052]" />
            <div>
              <h2 className="font-extrabold text-base text-[#0b3d2e]">Tarif Kasir</h2>
              <p className="font-mono text-[11px] text-[#527867]">Pajak dan service charge dipakai otomatis di setiap struk.</p>
            </div>
          </div>
          <PosChargeSetup taxRate={posCharges.taxRate} serviceChargeRate={posCharges.serviceChargeRate} />
        </section>

        {/* --- Kesiapan modul --- */}
        <section className="rounded-3xl border border-[#d8e3de] bg-white p-6 shadow-[0_4px_20px_rgba(11,61,46,0.04)] space-y-4">
          <div className="flex items-center gap-2 border-b border-[#d8e3de] pb-4">
            <Wrench size={20} className="text-[#167052]" />
            <div>
              <h2 className="font-extrabold text-base text-[#0b3d2e]">Kesiapan Modul</h2>
              <p className="font-mono text-[11px] text-[#527867]">
                Sudah dibayar belum tentu sudah bisa dipakai
              </p>
            </div>
          </div>

          {modules.length === 0 ? (
            <p className="font-mono text-xs text-[#527867]">Belum ada modul yang aktif.</p>
          ) : (
            <div className="space-y-2.5">
              {modules.map((m) => {
                const b = BADGE[m.status];
                return (
                  <div
                    key={m.key}
                    className="rounded-2xl border border-[#d8e3de] bg-[#fbfdfc] px-4 py-3 space-y-2"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="font-extrabold text-sm">{m.name}</span>
                      <span
                        className="inline-flex items-center gap-1 rounded-lg border px-2 py-0.5 font-mono text-[10px] font-bold"
                        style={{ color: b.warna, background: b.bg, borderColor: b.garis }}
                      >
                        {m.status === "aktif" ? (
                          <CheckCircle2 size={11} />
                        ) : (
                          <AlertTriangle size={11} />
                        )}
                        {b.teks}
                      </span>
                    </div>

                    {m.setupHint && (
                      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-[#d8e3de] pt-2">
                        <p className="font-mono text-[11px] text-[#8a6d00] flex-1 min-w-[200px]">
                          {m.setupHint}
                        </p>
                        {m.setupHref && (
                          <Link
                            href={m.setupHref}
                            className="inline-flex items-center gap-1.5 rounded-xl border border-[#d8e3de] bg-[#c8f53a] px-3 py-1.5 font-mono text-[11px] font-extrabold shadow-xs"
                          >
                            Siapkan
                            <ArrowRight size={12} />
                          </Link>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
