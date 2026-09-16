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
import qrcode from "qrcode-generator";
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

  // 1. Download QR Code Murni (Raw HD 2048px untuk Canva/Photoshop)
  const handleDownloadPureQr = () => {
    setIsGeneratingPng(true);
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d", { willReadFrequently: false });
    if (!ctx) {
      setIsGeneratingPng(false);
      return;
    }

    const size = 2048;
    canvas.width = size;
    canvas.height = size;
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";

    // Clean pure white background
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, size, size);

    const qr = qrcode(0, "H");
    qr.addData(registrationUrl, "Byte");
    qr.make();
    const n = qr.getModuleCount();

    const padding = 160;
    const qrMatrixSize = size - padding * 2;
    const cellSize = qrMatrixSize / n;

    ctx.fillStyle = isMochi ? "#072e22" : "#111111";
    for (let r = 0; r < n; r++) {
      for (let c = 0; c < n; c++) {
        if (qr.isDark(r, c)) {
          ctx.fillRect(
            padding + c * cellSize,
            padding + r * cellSize,
            cellSize + 0.65,
            cellSize + 0.65,
          );
        }
      }
    }

    const logoImg = new Image();
    logoImg.crossOrigin = "anonymous";
    logoImg.src = logoUrl || "/logo-mochi.png";

    const renderLogoAndSave = () => {
      const centerBadgeSize = Math.round(qrMatrixSize * 0.22);
      const cbX = (size - centerBadgeSize) / 2;
      const cbY = (size - centerBadgeSize) / 2;

      ctx.save();
      ctx.beginPath();
      ctx.arc(size / 2, size / 2, centerBadgeSize / 2 + 12, 0, Math.PI * 2);
      ctx.fillStyle = "#ffffff";
      ctx.fill();
      ctx.strokeStyle = isMochi ? "#072e22" : "#111111";
      ctx.lineWidth = 12;
      ctx.stroke();
      ctx.clip();
      if (logoImg.naturalWidth > 0) {
        ctx.drawImage(logoImg, cbX, cbY, centerBadgeSize, centerBadgeSize);
      }
      ctx.restore();

      const link = document.createElement("a");
      link.download = `QR-Member-${storeCode.toLowerCase()}-HD.png`;
      link.href = canvas.toDataURL("image/png");
      link.click();
      setIsGeneratingPng(false);
    };

    let done = false;
    const trigger = () => {
      if (done) return;
      done = true;
      renderLogoAndSave();
    };

    logoImg.onload = trigger;
    logoImg.onerror = trigger;
    if (logoImg.complete && logoImg.naturalWidth > 0) {
      trigger();
    } else {
      setTimeout(trigger, 300);
    }
  };

  // 2. Download Standee Poster Lengkap
  const handleDownloadPng = () => {
    setIsGeneratingPng(true);
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d", { willReadFrequently: false });
    if (!ctx) {
      setIsGeneratingPng(false);
      return;
    }

    const w = 1200;
    const h = 1600;
    canvas.width = w;
    canvas.height = h;
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";

    // Background Gradient
    const grad = ctx.createLinearGradient(0, 0, 0, h);
    if (isMochi) {
      grad.addColorStop(0, "#052016");
      grad.addColorStop(0.5, "#0b3d2e");
      grad.addColorStop(1, "#03170f");
    } else {
      grad.addColorStop(0, "#191924");
      grad.addColorStop(1, "#0f0f17");
    }
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);

    // Decorative glow
    ctx.fillStyle = isMochi ? "rgba(200, 245, 58, 0.08)" : "rgba(121, 88, 216, 0.1)";
    ctx.beginPath();
    ctx.arc(w / 2, 240, 360, 0, Math.PI * 2);
    ctx.fill();

    // Header Badge
    ctx.fillStyle = isMochi ? "#c8f53a" : "#7958d8";
    ctx.beginPath();
    ctx.roundRect(w / 2 - 200, 70, 400, 56, 28);
    ctx.fill();

    ctx.fillStyle = isMochi ? "#07281e" : "#ffffff";
    ctx.font = "900 24px -apple-system, BlinkMacSystemFont, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("PROGRAM MEMBER RESMI", w / 2, 107);

    // Store Name & Subtitle
    ctx.fillStyle = "#ffffff";
    ctx.font = "900 56px -apple-system, BlinkMacSystemFont, sans-serif";
    ctx.fillText(businessName, w / 2, 195);

    ctx.fillStyle = isMochi ? "#a2d4c0" : "#a1a1ba";
    ctx.font = "bold 24px -apple-system, BlinkMacSystemFont, sans-serif";
    ctx.fillText("Scan QR untuk Bergabung & Kumpulkan Poin Belanja", w / 2, 245);

    // White QR Container Card
    const boxW = 860;
    const boxH = 920;
    const boxX = (w - boxW) / 2;
    const boxY = 295;

    ctx.fillStyle = "#ffffff";
    ctx.beginPath();
    ctx.roundRect(boxX, boxY, boxW, boxH, 48);
    ctx.fill();
    ctx.strokeStyle = isMochi ? "#d4e4dc" : "#dedee8";
    ctx.lineWidth = 3;
    ctx.stroke();

    // QR Matrix Render
    const qr = qrcode(0, "H");
    qr.addData(registrationUrl, "Byte");
    qr.make();
    const n = qr.getModuleCount();
    const qrSize = 660;
    const qrX = (w - qrSize) / 2;
    const qrY = boxY + 45;
    const cellSize = qrSize / n;

    ctx.fillStyle = isMochi ? "#072e22" : "#111111";
    for (let r = 0; r < n; r++) {
      for (let c = 0; c < n; c++) {
        if (qr.isDark(r, c)) {
          ctx.fillRect(
            qrX + c * cellSize,
            qrY + r * cellSize,
            cellSize + 0.55,
            cellSize + 0.55,
          );
        }
      }
    }

    // Rate Pill inside Card
    const rateW = 760;
    const rateH = 95;
    const rateX = (w - rateW) / 2;
    const rateY = boxY + boxH - 135;

    ctx.fillStyle = isMochi ? "#edf8f3" : "#f4f4f8";
    ctx.beginPath();
    ctx.roundRect(rateX, rateY, rateW, rateH, 24);
    ctx.fill();
    ctx.strokeStyle = isMochi ? "#a3d4c0" : "#dedee8";
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.fillStyle = isMochi ? "#072e22" : "#232331";
    ctx.font = "900 28px -apple-system, BlinkMacSystemFont, sans-serif";
    ctx.fillText(`Kurs Poin: ${formatRupiah(earnRate)} = 1 Pts`, w / 2, rateY + 44);

    ctx.fillStyle = isMochi ? "#4a6b5e" : "#6c6c80";
    ctx.font = "bold 19px -apple-system, BlinkMacSystemFont, sans-serif";
    ctx.fillText("Arahkan kamera HP ke QR Code untuk buka form member", w / 2, rateY + 77);

    // Footer Instructions
    ctx.fillStyle = "#ffffff";
    ctx.font = "900 30px -apple-system, BlinkMacSystemFont, sans-serif";
    ctx.fillText("Arahkan Kamera HP Anda ke QR Code", w / 2, 1300);

    ctx.fillStyle = isMochi ? "#a2d4c0" : "#8e8ea6";
    ctx.font = "bold 22px -apple-system, BlinkMacSystemFont, sans-serif";
    ctx.fillText("Tanpa install aplikasi · Langsung buka kartu member digital", w / 2, 1345);

    // App Credit Footer
    ctx.fillStyle = isMochi ? "#c8f53a" : "#7958d8";
    ctx.font = "900 24px monospace";
    ctx.fillText(`${businessName.toUpperCase()} · POWERED BY KAEL POS`, w / 2, 1485);

    // Center Logo Badge
    const logoImg = new Image();
    logoImg.crossOrigin = "anonymous";
    logoImg.src = logoUrl || "/logo-mochi.png";

    const renderLogoAndSave = () => {
      const centerBadgeSize = 148;
      const cbX = (w - centerBadgeSize) / 2;
      const cbY = qrY + (qrSize - centerBadgeSize) / 2;

      ctx.save();
      ctx.beginPath();
      ctx.arc(w / 2, cbY + centerBadgeSize / 2, centerBadgeSize / 2 + 6, 0, Math.PI * 2);
      ctx.fillStyle = "#ffffff";
      ctx.fill();
      ctx.strokeStyle = isMochi ? "#072e22" : "#111111";
      ctx.lineWidth = 4;
      ctx.stroke();
      ctx.clip();
      if (logoImg.naturalWidth > 0) {
        ctx.drawImage(logoImg, cbX, cbY, centerBadgeSize, centerBadgeSize);
      }
      ctx.restore();

      const link = document.createElement("a");
      link.download = `Standee-Member-${storeCode.toLowerCase()}.png`;
      link.href = canvas.toDataURL("image/png");
      link.click();
      setIsGeneratingPng(false);
    };

    let done = false;
    const trigger = () => {
      if (done) return;
      done = true;
      renderLogoAndSave();
    };

    logoImg.onload = trigger;
    logoImg.onerror = trigger;
    if (logoImg.complete && logoImg.naturalWidth > 0) {
      trigger();
    } else {
      setTimeout(trigger, 300);
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
            className={`flex items-center gap-1 rounded-xl px-3 py-1.5 text-xs font-black transition-all cursor-pointer ${
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

        {/* Action Buttons: Main Download Row */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {/* Download QR Saja HD */}
          <button
            type="button"
            onClick={handleDownloadPureQr}
            disabled={isGeneratingPng}
            className={`flex items-center justify-center gap-1.5 rounded-2xl py-3 px-3 text-xs font-black transition-all cursor-pointer shadow-sm ${
              isMochi
                ? "bg-[#0b3d2e] hover:bg-[#124e3c] text-[#c8f53a]"
                : "bg-[#232331] text-white"
            } disabled:opacity-50`}
          >
            <QrIcon size={14} />
            <span>{isGeneratingPng ? "Memproses..." : "Download QR Saja (HD)"}</span>
          </button>

          {/* Download Standee Lengkap */}
          <button
            type="button"
            onClick={handleDownloadPng}
            disabled={isGeneratingPng}
            className={`flex items-center justify-center gap-1.5 rounded-2xl border-2 py-3 px-3 text-xs font-black transition-all cursor-pointer ${
              isMochi
                ? "border-[#0b3d2e] bg-white hover:bg-[#edf8f3] text-[#0b3d2e]"
                : "border-[#232331] bg-white text-[#232331]"
            } disabled:opacity-50`}
          >
            <Download size={14} />
            <span>{isGeneratingPng ? "Memproses..." : "Download Standee (PNG)"}</span>
          </button>
        </div>

        {/* Utility Buttons: Cetak Standee, Buka Form */}
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={handlePrint}
            className={`flex items-center justify-center gap-1.5 rounded-xl border py-2.5 px-3 text-xs font-bold transition-all cursor-pointer ${
              isMochi
                ? "border-[#d8e3de] bg-[#f8faf9] hover:bg-[#edf8f3] text-[#0b3d2e]"
                : "border-[#dedee8] bg-[#f8faf9] text-[#232331]"
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
