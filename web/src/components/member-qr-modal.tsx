"use client";

import { useState, useRef } from "react";
import {
  X,
  Copy,
  Check,
  Download,
  Printer,
  ExternalLink,
  Sparkles,
  QrCode as QrIcon,
  Coffee,
  Gift,
  Share2,
} from "lucide-react";
import QrCode from "@/components/qr-code";
import { formatRupiah } from "@/lib/formatters";

export interface MemberQrProps {
  businessName?: string | null;
  storeCode?: string | null;
  logoUrl?: string | null;
  isMochi?: boolean;
  earnRate?: number;
}

export function MemberQrCard({
  businessName: passedBusinessName,
  storeCode: passedStoreCode,
  logoUrl = "/logo-mochi.png",
  isMochi = true,
  earnRate = 10000,
}: MemberQrProps) {
  const businessName = passedBusinessName || "Mochi Cafe n Resto";
  const storeCode = passedStoreCode || "MOCHIKAFE";
  const [copied, setCopied] = useState(false);
  const [isGeneratingPng, setIsGeneratingPng] = useState(false);
  const printRef = useRef<HTMLDivElement>(null);

  const registrationUrl = typeof window !== "undefined"
    ? `${window.location.origin}/loyalty/register?toko=${encodeURIComponent(storeCode)}`
    : `https://kaels.site/loyalty/register?toko=${encodeURIComponent(storeCode)}`;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(registrationUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      // fallback
    }
  };

  const handleDownloadPng = async () => {
    setIsGeneratingPng(true);
    try {
      const canvas = document.createElement("canvas");
      canvas.width = 1024;
      canvas.height = 1400;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      // 1. Background Gradient (Mochi Emerald or Classic Dark)
      const grad = ctx.createLinearGradient(0, 0, 0, 1400);
      if (isMochi) {
        grad.addColorStop(0, "#052016");
        grad.addColorStop(0.5, "#0b3d2e");
        grad.addColorStop(1, "#03170f");
      } else {
        grad.addColorStop(0, "#191924");
        grad.addColorStop(1, "#0f0f17");
      }
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, 1024, 1400);

      // 2. Decorative circles / glow
      ctx.fillStyle = isMochi ? "rgba(200, 245, 58, 0.08)" : "rgba(121, 88, 216, 0.1)";
      ctx.beginPath();
      ctx.arc(512, 200, 320, 0, Math.PI * 2);
      ctx.fill();

      // 3. Header Badge
      ctx.fillStyle = isMochi ? "#c8f53a" : "#7958d8";
      ctx.beginPath();
      ctx.roundRect(512 - 170, 70, 340, 48, 24);
      ctx.fill();

      ctx.fillStyle = isMochi ? "#07281e" : "#ffffff";
      ctx.font = "bold 20px sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("PROGRAM MEMBER RESMI", 512, 102);

      // 4. Store Name & Tagline
      ctx.fillStyle = "#ffffff";
      ctx.font = "900 52px sans-serif";
      ctx.fillText(businessName, 512, 185);

      ctx.fillStyle = isMochi ? "#a2d4c0" : "#a1a1ba";
      ctx.font = "500 24px sans-serif";
      ctx.fillText("Scan QR untuk Bergabung & Kumpulkan Poin Belanja", 512, 230);

      // 5. White QR Container Card
      ctx.fillStyle = "#ffffff";
      ctx.shadowColor = "rgba(0, 0, 0, 0.35)";
      ctx.shadowBlur = 40;
      ctx.shadowOffsetY = 20;
      ctx.beginPath();
      ctx.roundRect(142, 280, 740, 780, 44);
      ctx.fill();
      ctx.shadowColor = "transparent";

      // 6. Draw QR Code into the white card
      const svg = document.getElementById(`member-qr-svg-${storeCode}`);
      if (svg) {
        const svgData = new XMLSerializer().serializeToString(svg);
        const svgBlob = new Blob([svgData], { type: "image/svg+xml;charset=utf-8" });
        const URL = window.URL || window.webkitURL || window;
        const blobURL = URL.createObjectURL(svgBlob);
        const img = new Image();

        await new Promise<void>((resolve) => {
          img.onload = () => {
            // Draw QR centered in white card
            ctx.drawImage(img, 212, 330, 600, 600);
            URL.revokeObjectURL(blobURL);
            resolve();
          };
          img.src = blobURL;
        });
      }

      // 7. Card footer inside white container
      ctx.fillStyle = isMochi ? "#edf8f3" : "#f4f4f8";
      ctx.beginPath();
      ctx.roundRect(182, 945, 660, 85, 20);
      ctx.fill();

      ctx.fillStyle = isMochi ? "#0b3d2e" : "#232331";
      ctx.font = "bold 24px sans-serif";
      ctx.fillText(`Kurs Poin: ${formatRupiah(earnRate)} = 1 Pts`, 512, 998);

      // 8. Standee Footer instructions
      ctx.fillStyle = "#ffffff";
      ctx.font = "bold 26px sans-serif";
      ctx.fillText("Arahkan Kamera HP Anda ke QR Code", 512, 1140);

      ctx.fillStyle = isMochi ? "#a2d4c0" : "#8e8ea6";
      ctx.font = "20px sans-serif";
      ctx.fillText("Tanpa install aplikasi · Langsung buka kartu member digital", 512, 1180);

      // 9. Brand & App Footer
      ctx.fillStyle = isMochi ? "#c8f53a" : "#7958d8";
      ctx.font = "bold 22px monospace";
      ctx.fillText(`${businessName} · Powered by KAEL System`, 512, 1310);

      // Trigger download
      const pngUrl = canvas.toDataURL("image/png");
      const a = document.createElement("a");
      a.href = pngUrl;
      a.download = `qr-daftar-member-${storeCode.toLowerCase()}.png`;
      a.click();
    } catch (err) {
      console.error("Gagal download PNG:", err);
    } finally {
      setIsGeneratingPng(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className={`rounded-3xl border ${
      isMochi ? "border-[#d8e3de] bg-white shadow-md" : "border-[#dedee8] bg-white shadow-ink-md"
    } p-5 sm:p-6 space-y-5 text-center`}>
      {/* Header Info */}
      <div className="space-y-1">
        <div className="flex items-center justify-center gap-1.5">
          <span className={`inline-flex items-center gap-1 rounded-full px-3 py-0.5 text-[10.5px] font-black uppercase tracking-wider ${
            isMochi ? "bg-[#c8f53a] text-[#073829]" : "bg-[#ded9ff] text-[#5b3fb0]"
          }`}>
            <QrIcon size={12} />
            <span>QR Pendaftaran Member</span>
          </span>
        </div>
        <h3 className={`text-base sm:text-lg font-black ${isMochi ? "text-[#0b3d2e]" : "text-[#232331]"}`}>
          Scan & Daftar Member di Meja / Kasir
        </h3>
        <p className="text-xs text-[#527867]">
          Tampilkan di tablet kasir, cetak sebagai tent card meja, atau bagikan link ke pelanggan.
        </p>
      </div>

      {/* QR Visual Card - Beautiful Cafe Tent Card Mockup */}
      <div className={`relative mx-auto max-w-xs rounded-3xl p-5 sm:p-6 text-white text-center space-y-4 shadow-xl border overflow-hidden ${
        isMochi
          ? "border-emerald-700/60 bg-gradient-to-b from-[#052016] via-[#0b3d2e] to-[#041910]"
          : "border-[#323246] bg-gradient-to-b from-[#1b1b26] to-[#0f0f18]"
      }`}>
        {/* Glow ambient */}
        <div className="pointer-events-none absolute -top-12 -left-12 h-40 w-40 rounded-full bg-[#c8f53a]/15 blur-2xl" />

        <div className="relative z-10 space-y-1">
          <span className="text-[9.5px] font-mono font-extrabold uppercase tracking-widest text-[#c8f53a] block">
            PROGRAM MEMBER RESMI
          </span>
          <h4 className="text-sm sm:text-base font-black tracking-tight text-white">
            {businessName}
          </h4>
        </div>

        {/* QR Code Container */}
        <div className="relative z-10 mx-auto flex w-fit items-center justify-center rounded-2xl bg-white p-3.5 shadow-2xl">
          <div id={`member-qr-svg-${storeCode}`}>
            <QrCode
              value={registrationUrl}
              size={210}
              colorDark={isMochi ? "#0b3d2e" : "#000000"}
              centerLogoUrl={logoUrl || (isMochi ? "/logo-mochi.png" : undefined)}
              errorCorrectionLevel="H"
            />
          </div>
        </div>

        {/* Benefit Pill */}
        <div className="relative z-10 rounded-xl bg-white/10 p-2.5 backdrop-blur-xs border border-white/10 text-center space-y-0.5">
          <span className="text-[10px] font-mono text-[#c8f53a] font-bold block">
            Kurs Poin: {formatRupiah(earnRate)} = 1 Pts
          </span>
          <p className="text-[10px] text-emerald-100/80 leading-snug">
            Arahkan kamera HP ke QR Code untuk buka form member
          </p>
        </div>
      </div>

      {/* URL Display & Quick Actions */}
      <div className="space-y-3 pt-1 font-mono text-xs">
        <div className="flex items-center gap-2 rounded-2xl border border-[#d8e3de] bg-[#f8faf9] p-2.5">
          <span className="truncate flex-1 text-left text-[11px] text-[#2c4b3f] font-semibold pl-1 select-all">
            {registrationUrl}
          </span>
          <button
            type="button"
            onClick={handleCopy}
            className={`flex items-center gap-1 rounded-xl px-3 py-1.5 text-xs font-black transition-all ${
              copied
                ? "bg-emerald-600 text-white"
                : isMochi
                  ? "bg-[#0b3d2e] hover:bg-[#124e3c] text-[#c8f53a]"
                  : "bg-[#232331] text-white"
            }`}
          >
            {copied ? <Check size={13} /> : <Copy size={13} />}
            <span>{copied ? "Tersalin!" : "Salin Link"}</span>
          </button>
        </div>

        {/* Action Buttons: Download PNG, Cetak Standee, Buka Form */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          <button
            type="button"
            onClick={handleDownloadPng}
            disabled={isGeneratingPng}
            className={`flex items-center justify-center gap-1.5 rounded-xl border py-2.5 px-3 text-xs font-bold transition-all ${
              isMochi
                ? "border-[#d8e3de] bg-white hover:bg-[#edf8f3] text-[#0b3d2e]"
                : "border-[#232331] bg-white text-[#232331]"
            }`}
          >
            <Download size={13} />
            <span>{isGeneratingPng ? "Memproses..." : "Download PNG"}</span>
          </button>

          <button
            type="button"
            onClick={handlePrint}
            className={`flex items-center justify-center gap-1.5 rounded-xl border py-2.5 px-3 text-xs font-bold transition-all ${
              isMochi
                ? "border-[#d8e3de] bg-white hover:bg-[#edf8f3] text-[#0b3d2e]"
                : "border-[#232331] bg-white text-[#232331]"
            }`}
          >
            <Printer size={13} />
            <span>Cetak Standee</span>
          </button>

          <a
            href={registrationUrl}
            target="_blank"
            rel="noopener noreferrer"
            className={`flex items-center justify-center gap-1.5 rounded-xl py-2.5 px-3 text-xs font-black shadow-xs transition-all ${
              isMochi
                ? "bg-[#c8f53a] hover:bg-[#d9ff57] text-[#073829]"
                : "bg-[#7958d8] text-white"
            }`}
          >
            <span>Buka Form</span>
            <ExternalLink size={13} />
          </a>
        </div>
      </div>

      {/* PRINT-ONLY STANDEE TEMPLATE (Clean A6 Tent Card layout when window.print() is called) */}
      <div className="hidden print:block fixed inset-0 bg-white z-[9999] p-8 text-black">
        <div className="max-w-md mx-auto border-4 border-[#0b3d2e] rounded-3xl p-8 text-center space-y-6">
          <div className="flex justify-center">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={logoUrl || "/logo-mochi.png"} alt={businessName} className="h-20 w-20 object-contain rounded-full border-2 border-[#0b3d2e]" />
          </div>
          <div>
            <span className="text-xs font-black tracking-widest text-[#0b3d2e] uppercase block">
              PROGRAM MEMBER RESMI
            </span>
            <h1 className="text-3xl font-black text-[#0b3d2e] mt-1">{businessName}</h1>
            <p className="text-sm font-medium text-gray-600 mt-1">
              Scan untuk Bergabung & Kumpulkan Poin Setiap Belanja
            </p>
          </div>

          <div className="flex justify-center p-4 bg-gray-50 rounded-2xl border-2 border-dashed border-[#0b3d2e]">
            <QrCode
              value={registrationUrl}
              size={320}
              colorDark="#0b3d2e"
              centerLogoUrl={logoUrl || "/logo-mochi.png"}
              errorCorrectionLevel="H"
            />
          </div>

          <div className="space-y-1 text-xs font-mono text-gray-700">
            <p className="font-bold text-sm text-[#0b3d2e]">Kurs Poin: {formatRupiah(earnRate)} = 1 Poin Belanja</p>
            <p>1. Buka Kamera HP atau aplikasi pemindai QR</p>
            <p>2. Arahkan ke QR Code di atas dan isi nama & WhatsApp</p>
            <p>3. Dapatkan voucher traktiran langsung di kasir!</p>
          </div>

          <div className="pt-4 border-t border-gray-300 text-[11px] text-gray-500 font-mono">
            Tersedia di Meja & Kasir {businessName} · KAEL System
          </div>
        </div>
      </div>
    </div>
  );
}

export function MemberQrModal({
  isOpen,
  onClose,
  businessName,
  storeCode,
  logoUrl = "/logo-mochi.png",
  isMochi = true,
  earnRate = 10000,
}: MemberQrProps & {
  isOpen: boolean;
  onClose: () => void;
}) {
  if (!isOpen) return null;

  return (
    <div className={`fixed inset-0 z-50 flex items-center justify-center p-4 backdrop-blur-xs ${
      isMochi ? "bg-[#07281e]/60" : "bg-[#232331]/60"
    } animate-in fade-in duration-200`}>
      <div className={`relative w-full max-w-md max-h-[90vh] overflow-y-auto rounded-3xl bg-white p-6 shadow-2xl border ${
        isMochi ? "border-[#d8e3de]" : "border-[#232331]"
      }`}>
        <button
          type="button"
          onClick={onClose}
          className={`absolute top-4 right-4 flex h-9 w-9 items-center justify-center rounded-xl border transition-colors ${
            isMochi
              ? "border-[#d8e3de] bg-[#f0f5f2] text-[#0b3d2e] hover:bg-[#e2ede7]"
              : "border-[#dedee8] bg-white text-[#232331]"
          }`}
        >
          <X size={16} />
        </button>

        <MemberQrCard
          businessName={businessName}
          storeCode={storeCode}
          logoUrl={logoUrl}
          isMochi={isMochi}
          earnRate={earnRate}
        />
      </div>
    </div>
  );
}
