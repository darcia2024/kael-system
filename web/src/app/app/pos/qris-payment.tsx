"use client";

import { useMemo } from "react";
import Link from "next/link";
import { AlertTriangle, Settings, Info } from "lucide-react";

import QrCode from "@/components/qr-code";
import { buildDynamicQris } from "@/lib/qris-engine";
import { formatRupiah } from "@/lib/formatters";
import type { Business } from "@/lib/types";

/**
 * QRIS di layar kasir. MENAMPILKAN saja, tidak pernah memasang.
 *
 * Formulir unggah QRIS dulu ada di sini, dan itu keliru: layar ini dipakai
 * karyawan. Kasir yang bisa mengganti QRIS tinggal memasang QRIS pribadinya,
 * dan setiap pembayaran masuk ke kantongnya sementara sistem tetap mencatat
 * transaksinya lunas — pemilik usaha baru menyadarinya saat rekonsiliasi, atau
 * tidak pernah. Pemasangannya sekarang tinggal di /app/settings, dan
 * saveQrisAction menuntut peran pemilik usaha di server.
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
  const tersimpan = business?.qris_payload ?? null;

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
  // Terpasang: tampilkan QR bernominal
  // -----------------------------------------------------------------------
  return (
    <div className="rounded-2xl border border-[#dedee8] bg-[#fcfcfe] p-3 space-y-3 font-mono text-xs">
      {dinamis?.ok ? (
        <>
          <div className="flex flex-col items-center gap-2">
            <div className="rounded-2xl border-2 border-[#232331] bg-white p-2.5 shadow-ink-xs">
              <QrCode
                value={dinamis.payload}
                size={200}
                label={`QRIS pembayaran ${formatRupiah(Math.round(amount))}`}
              />
            </div>
            <p className="text-center text-[11px] text-[#7b7b8e]">
              Pelanggan pindai QR ini. Nominalnya sudah terisi otomatis.
            </p>
          </div>

          <div className="rounded-xl border border-[#dedee8] bg-white px-3 py-2 space-y-0.5">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[#7b7b8e]">Nominal</span>
              <span className="font-black text-sm">{formatRupiah(Math.round(amount))}</span>
            </div>
            <div className="flex items-center justify-between gap-2">
              <span className="text-[#7b7b8e]">Masuk ke</span>
              <span className="font-bold truncate max-w-[60%] text-right">
                {business?.qris_merchant_name || "—"}
              </span>
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
  );
}
