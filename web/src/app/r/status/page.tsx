"use client";

import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { ShieldAlert, AlertOctagon, HelpCircle, ArrowLeft } from "lucide-react";
import { Suspense } from "react";

function StatusContent() {
  const searchParams = useSearchParams();
  const type = searchParams.get("type") || "not_found";
  const code = searchParams.get("code") || "";

  const isSuspended = type === "suspended";

  /**
   * QR faktur WhatsApp yang sudah lewat masanya.
   *
   * Yang melihat ini kasir, bukan pelanggan — dia baru saja memindai layar
   * kasirnya sendiri. Pesan kartu NFC ("Kartu Tidak Dikenali") akan membuatnya
   * mengira ada yang rusak, padahal jalan keluarnya cuma satu: tampilkan QR baru.
   */
  if (type === "invoice_expired") {
    return (
      <div className="min-h-screen bg-[#f7f6fc] text-[#232331] flex flex-col items-center justify-center p-4 font-sans">
        <div className="w-full max-w-md rounded-3xl border-2 border-[#232331] bg-white p-6 sm:p-8 shadow-ink-lg text-center space-y-4">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl border-2 border-[#232331] bg-[#fff8e1] text-[#8a6d00] shadow-ink-xs">
            <HelpCircle size={32} />
          </div>
          <h1 className="text-xl sm:text-2xl font-extrabold">QR Faktur Sudah Kedaluwarsa</h1>
          <p className="text-sm leading-relaxed text-[#5c5c70]">
            QR faktur cuma berlaku 15 menit. Tutup halaman ini, lalu buka lagi faktur
            pesanannya di layar kasir untuk memunculkan QR yang baru.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f7f6fc] text-[#232331] flex flex-col items-center justify-center p-4 font-sans">
      <div className="w-full max-w-md rounded-3xl border-2 border-[#232331] bg-white p-6 sm:p-8 shadow-ink-lg text-center space-y-6">
        
        {/* Icon Header */}
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl border-2 border-[#232331] bg-[#feebee] text-[#ef4444] shadow-ink-xs">
          {isSuspended ? <AlertOctagon size={32} /> : <ShieldAlert size={32} />}
        </div>

        {/* Title & Message */}
        <div className="space-y-2">
          <h1 className="text-xl sm:text-2xl font-extrabold text-[#232331]">
            {isSuspended ? "Kartu Tidak Aktif" : "Kartu Tidak Dikenali"}
          </h1>
          <p className="text-xs sm:text-sm text-[#7b7b8e] leading-relaxed">
            {isSuspended
              ? "Kartu NFC ini telah dinonaktifkan atau ditangguhkan oleh pihak pemilik usaha demi keamanan."
              : code
              ? `Kode kartu "${code}" tidak ditemukan atau belum terdaftar di sistem KAEL.`
              : "Kode kartu NFC ini tidak ditemukan di database KAEL."}
          </p>
        </div>

        {/* Neutral Badge */}
        <div className="rounded-2xl border border-[#dedee8] bg-[#fcfcfe] p-4 text-xs text-[#7b7b8e] font-mono space-y-1">
          <div className="flex items-center justify-center gap-1.5 text-[#232331] font-bold">
            <HelpCircle size={14} className="text-[#7958d8]" />
            <span>Butuh Bantuan?</span>
          </div>
          <p className="text-[11px]">
            Jika Anda adalah pemilik kartu ini, hubungi Customer Care KAEL melalui WhatsApp untuk bantuan verifikasi kartu fisik Anda.
          </p>
        </div>

        {/* Actions */}
        <div className="pt-2 flex flex-col gap-2.5">
          <Link
            href="/"
            className="btn-tactile flex w-full items-center justify-center gap-2 rounded-2xl border-2 border-[#232331] bg-[#232331] py-3 text-xs font-extrabold text-white shadow-ink-xs"
          >
            <ArrowLeft size={14} />
            <span>Kembali ke Beranda KAEL</span>
          </Link>
        </div>

      </div>

      <footer className="mt-8 text-center text-xs font-mono text-[#7b7b8e]">
        KAEL Digital Ecosystem · Keamanan Kartu NFC &amp; QR
      </footer>
    </div>
  );
}

export default function CardStatusPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#f7f6fc] flex items-center justify-center text-xs font-mono">Memuat status kartu...</div>}>
      <StatusContent />
    </Suspense>
  );
}
