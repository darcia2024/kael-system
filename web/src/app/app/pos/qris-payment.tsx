"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { AlertTriangle, Settings, Info, Maximize2, X, Sparkles } from "lucide-react";

import QrCode from "@/components/qr-code";
import { buildDynamicQris } from "@/lib/qris-engine";
import { formatRupiah } from "@/lib/formatters";
import type { Business } from "@/lib/types";
import { getMochiLogoUrl, isMochiBusiness } from "@/lib/mochi-brand";

/**
 * QRIS di layar kasir (POS). MENAMPILKAN saja, tidak pernah memasang.
 * 
 * Dilengkapi dengan logo resmi Mochi di tengah QR, nominal otomatis,
 * identitas merchant Bank Nagari, serta opsi perbesar QR untuk diarahkan ke pelanggan.
 */
export default function QrisPayment({
  business,
  amount,
  isOwner,
}: {
  business: Business | null;
  amount: number;
  isOwner: boolean;
}) {
  const [showZoomModal, setShowZoomModal] = useState(false);
  const tersimpan = business?.qris_payload ?? null;
  const isMochi = isMochiBusiness(business);
  const logoUrl = getMochiLogoUrl(business) || business?.logo_url || "/logo-mochi.png";

  /**
   * QR bernominal dirakit ulang tiap nominalnya berubah, dan tidak pernah
   * disimpan: ini kode sekali pakai yang sudah basi begitu transaksi selesai.
   */
  const dinamis = useMemo(() => {
    if (!tersimpan) return null;
    const bulat = Math.round(amount);
    if (!Number.isFinite(bulat) || bulat <= 0) return null;
    return buildDynamicQris(tersimpan, bulat);
  }, [tersimpan, amount]);

  // -----------------------------------------------------------------------
  // Belum dipasang
  // -----------------------------------------------------------------------
  if (!tersimpan) {
    return (
      <div className="rounded-2xl border border-[#dedee8] bg-[#fcfcfe] p-3 font-mono text-xs space-y-2">
        <div className="flex items-start gap-2 text-[#8a6d00]">
          <Info size={14} className="shrink-0 mt-0.5" />
          <div>
            <p className="font-bold">Pakai QRIS cetak yang ada di meja.</p>
            <p className="mt-0.5 text-[11px]">
              Pelanggan mengetik sendiri nominal {formatRupiah(Math.round(amount))}.
            </p>
          </div>
        </div>

        {isOwner ? (
          <Link
            href="/app/settings"
            className="btn-tactile flex items-center justify-center gap-2 rounded-xl border-2 border-[#232331] bg-[#d9ff57] px-3 py-2 font-extrabold shadow-ink-xs"
          >
            <Settings size={13} />
            Pasang QRIS toko di Pengaturan
          </Link>
        ) : (
          <p className="rounded-xl border border-[#dedee8] bg-white px-3 py-2 text-[11px] text-[#7b7b8e]">
            Minta pemilik usaha memasang QRIS toko lewat Pengaturan supaya nominalnya
            terisi otomatis.
          </p>
        )}
      </div>
    );
  }

  // -----------------------------------------------------------------------
  // Terpasang: tampilkan QR bernominal dengan logo Mochi
  // -----------------------------------------------------------------------
  return (
    <>
      <div className={`rounded-2xl border p-3.5 space-y-3 font-mono text-xs transition-all ${
        isMochi ? "border-emerald-300 bg-[#f4faf7]" : "border-[#dedee8] bg-[#fcfcfe]"
      }`}>
        {dinamis?.ok ? (
          <>
            {/* Header Mini QRIS Badge */}
            <div className="flex items-center justify-between gap-2 border-b border-black/5 pb-2">
              <div className="flex items-center gap-1.5">
                <span className="rounded bg-[#d32f2f] px-2 py-0.5 text-[10px] font-black text-white tracking-wider shadow-xs">
                  QRIS
                </span>
                <span className="text-[10px] font-extrabold text-[#0b3d2e] tracking-tight">
                  {business?.qris_merchant_name || business?.name || "Mochi Cafe"}
                </span>
              </div>
              <button
                type="button"
                onClick={() => setShowZoomModal(true)}
                className="flex items-center gap-1 text-[10.5px] font-bold text-[#167052] hover:text-[#0b3d2e] hover:underline"
                title="Perbesar Tampilan QR untuk Pelanggan"
              >
                <Maximize2 size={12} />
                <span>Perbesar</span>
              </button>
            </div>

            {/* Main QR Box with Mochi Logo in Center */}
            <div className="flex flex-col items-center gap-2 pt-1">
              <div
                onClick={() => setShowZoomModal(true)}
                className="group relative cursor-pointer rounded-2xl border-2 border-[#232331] bg-white p-3 shadow-ink-xs hover:shadow-ink-md transition-all active:scale-[0.99]"
                title="Klik untuk memperbesar QR untuk tamu"
              >
                <QrCode
                  value={dinamis.payload}
                  size={210}
                  colorDark="#07251a"
                  centerLogoUrl={logoUrl}
                  label={`QRIS pembayaran ${formatRupiah(Math.round(amount))}`}
                />
                <div className="absolute inset-x-0 bottom-1 flex justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                  <span className="rounded-full bg-[#0b3d2e]/90 text-[#c8f53a] px-2.5 py-0.5 text-[9px] font-black font-sans">
                    Klik untuk perbesar 🔍
                  </span>
                </div>
              </div>
              <p className="text-center text-[10.5px] text-[#52665e] font-sans">
                Arahkan layar ini ke pelanggan. Nominal <strong>{formatRupiah(Math.round(amount))}</strong> sudah terisi otomatis.
              </p>
            </div>

            {/* Merchant Details Bar */}
            <div className="rounded-xl border border-black/10 bg-white px-3 py-2 space-y-1">
              <div className="flex items-center justify-between gap-2">
                <span className="text-[#718078] text-[11px]">Total Tagihan</span>
                <span className="font-black text-sm text-[#0b3d2e]">
                  {formatRupiah(Math.round(amount))}
                </span>
              </div>
              <div className="flex items-center justify-between gap-2 text-[10.5px]">
                <span className="text-[#718078]">Rekening Tujuan</span>
                <span className="font-bold truncate max-w-[65%] text-right text-[#1c2d26]">
                  {business?.qris_merchant_name || business?.name || "Mochi Cafe n Resto"}
                </span>
              </div>
              <div className="flex items-center justify-between gap-2 text-[9.5px] text-[#8ba096] pt-0.5 border-t border-black/5">
                <span>NMID: {business?.qris_nmid || "ID1022226423583"}</span>
                <span>{business?.qris_merchant_city || "PADANG PANJANG"}</span>
              </div>
            </div>
          </>
        ) : (
          <div className="flex items-start gap-2 rounded-xl border border-[#e5b800] bg-[#fff8e1] px-3 py-2 text-[#8a6d00]">
            <AlertTriangle size={14} className="shrink-0 mt-0.5" />
            <p className="text-[11px] font-bold">
              {dinamis?.ok === false
                ? dinamis.error
                : "Nominal belum bisa dijadikan QR. Pakai QRIS cetak dulu."}
            </p>
          </div>
        )}
      </div>

      {/* =================================================================== */}
      {/* CUSTOMER FACING FULLSCREEN MODAL (FOR SCANNING FROM DISTANCE)      */}
      {/* =================================================================== */}
      {showZoomModal && dinamis?.ok && (
        <div
          className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/80 p-4 backdrop-blur-xs animate-in fade-in-50"
          onClick={() => setShowZoomModal(false)}
        >
          <div
            className="w-full max-w-sm rounded-[32px] bg-white p-6 text-center text-[#1c2d26] shadow-2xl space-y-4 animate-in zoom-in-95 border-2 border-[#0b3d2e]"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between pb-2 border-b border-[#e5ede9]">
              <div className="flex items-center gap-2">
                <span className="rounded bg-[#d32f2f] px-2 py-0.5 text-[10px] font-black text-white tracking-wider">
                  QRIS
                </span>
                <span className="text-xs font-black text-[#0b3d2e] font-mono uppercase">
                  Pembayaran Kasir
                </span>
              </div>
              <button
                type="button"
                onClick={() => setShowZoomModal(false)}
                className="flex h-8 w-8 items-center justify-center rounded-full bg-[#edf1ef] text-[#718078] hover:text-[#1c2d26]"
              >
                <X size={16} />
              </button>
            </div>

            {/* Big QR Code with Center Logo */}
            <div className="flex justify-center p-2 rounded-2xl bg-[#f8faf9] border border-[#d8e3de]">
              <QrCode
                value={dinamis.payload}
                size={270}
                colorDark="#07251a"
                centerLogoUrl={logoUrl}
                label={`QRIS pembayaran ${formatRupiah(Math.round(amount))}`}
              />
            </div>

            {/* Merchant and Amount */}
            <div className="space-y-1">
              <span className="text-[11px] text-[#718078] font-mono block">Total Pembayaran</span>
              <div className="text-2xl font-black font-mono text-[#0b3d2e]">
                {formatRupiah(Math.round(amount))}
              </div>
              <p className="text-xs font-bold text-[#1c2d26]">
                {business?.qris_merchant_name || business?.name || "Mochi Cafe n Resto"}
              </p>
              <p className="text-[10px] text-[#8ba096] font-mono">
                NMID: {business?.qris_nmid || "ID1022226423583"} · {business?.qris_merchant_city || "PADANG PANJANG"}
              </p>
            </div>

            <p className="text-[11px] text-[#52665e]">
              Buka aplikasi BCA, Bank Nagari, GoPay, OVO, Dana, ShopeePay atau mobile banking apa saja lalu scan QR di atas.
            </p>

            <button
              type="button"
              onClick={() => setShowZoomModal(false)}
              className="w-full rounded-2xl bg-[#0b3d2e] text-[#c8f53a] py-3 text-xs font-black shadow-md hover:bg-[#124634] active:scale-95 transition-all"
            >
              Tutup Tampilan QR
            </button>
          </div>
        </div>
      )}
    </>
  );
}
