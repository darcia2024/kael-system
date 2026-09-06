"use client";

import Link from "next/link";
import { ArrowLeft, QrCode, CheckCircle2, AlertTriangle, Wrench, ArrowRight } from "lucide-react";

import QrisSetup from "./qris-setup";
import PosChargeSetup from "./pos-charge-setup";
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
 *
 * "perlu_disiapkan" ada di sini karena inilah pembedaan yang dulu tidak ada:
 * modul yang sudah dibayar tapi belum bisa dipakai dulu tampil "Aktif", jadi
 * pemilik usaha menyimpulkan produknya rusak alih-alih belum disetel.
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
}) {
  const perluDisiapkan = modules.filter((m) => m.setupHint);

  return (
    <div className="min-h-screen bg-[#f7f6fc] text-[#232331] font-sans">
      <header className="sticky top-0 z-30 border-b-2 border-[#232331] bg-white px-4 sm:px-8 py-3.5">
        <div className="mx-auto flex max-w-3xl items-center gap-3">
          <Link
            href="/app"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-[#232331] bg-[#fcfcfe] shadow-ink-xs"
          >
            <ArrowLeft size={16} />
          </Link>
          <div className="min-w-0">
            <h1 className="font-black text-sm sm:text-base truncate">Pengaturan Usaha</h1>
            <span className="text-[11px] text-[#7b7b8e] font-mono block truncate">
              {businessName}
              {storeCode ? ` · kode toko ${storeCode}` : ""}
            </span>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 sm:px-8 py-6 space-y-5">
        {perluDisiapkan.length > 0 && (
          <div className="flex items-start gap-2.5 rounded-2xl border-2 border-[#e5b800] bg-[#fff8e1] px-4 py-3 text-[#8a6d00]">
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

        {/* --- QRIS --- */}
        <section className="rounded-3xl border-2 border-[#232331] bg-white p-6 shadow-ink-md space-y-4">
          <div className="flex items-center gap-2 border-b border-[#dedee8] pb-4">
            <QrCode size={20} className="text-[#7958d8]" />
            <div>
              <h2 className="font-extrabold text-base">QRIS Toko</h2>
              <p className="font-mono text-[11px] text-[#7b7b8e]">
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

        <section className="rounded-3xl border-2 border-[#232331] bg-white p-6 shadow-ink-md">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div><h2 className="font-extrabold text-base">Brand, White Label & WhatsApp</h2><p className="mt-1 font-mono text-[11px] text-[#7b7b8e]">Nama aplikasi, domain tenant, dan nomor pengirim WhatsApp per usaha.</p></div>
            <Link href="/app/settings/brand" className="btn-tactile rounded-xl border-2 border-[#232331] bg-[#d9ff57] px-3 py-2 text-xs font-bold">Atur Brand</Link>
          </div>
        </section>

        <section className="rounded-3xl border-2 border-[#232331] bg-white p-6 shadow-ink-md space-y-4">
          <div className="flex items-center gap-2 border-b border-[#dedee8] pb-4">
            <Wrench size={20} className="text-[#7958d8]" />
            <div>
              <h2 className="font-extrabold text-base">Tarif Kasir</h2>
              <p className="font-mono text-[11px] text-[#7b7b8e]">Pajak dan service charge dipakai otomatis di setiap struk.</p>
            </div>
          </div>
          <PosChargeSetup taxRate={posCharges.taxRate} serviceChargeRate={posCharges.serviceChargeRate} />
        </section>

        {/* --- Kesiapan modul --- */}
        <section className="rounded-3xl border-2 border-[#232331] bg-white p-6 shadow-ink-md space-y-4">
          <div className="flex items-center gap-2 border-b border-[#dedee8] pb-4">
            <Wrench size={20} className="text-[#7958d8]" />
            <div>
              <h2 className="font-extrabold text-base">Kesiapan Modul</h2>
              <p className="font-mono text-[11px] text-[#7b7b8e]">
                Sudah dibayar belum tentu sudah bisa dipakai
              </p>
            </div>
          </div>

          {modules.length === 0 ? (
            <p className="font-mono text-xs text-[#7b7b8e]">Belum ada modul yang aktif.</p>
          ) : (
            <div className="space-y-2.5">
              {modules.map((m) => {
                const b = BADGE[m.status];
                return (
                  <div
                    key={m.key}
                    className="rounded-2xl border border-[#dedee8] bg-[#fcfcfe] px-4 py-3 space-y-2"
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
                      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-[#dedee8] pt-2">
                        <p className="font-mono text-[11px] text-[#8a6d00] flex-1 min-w-[200px]">
                          {m.setupHint}
                        </p>
                        {m.setupHref && (
                          <Link
                            href={m.setupHref}
                            className="btn-tactile inline-flex items-center gap-1.5 rounded-xl border-2 border-[#232331] bg-[#d9ff57] px-3 py-1.5 font-mono text-[11px] font-extrabold shadow-ink-xs"
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
