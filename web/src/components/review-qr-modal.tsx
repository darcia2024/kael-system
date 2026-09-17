"use client";

import { useState, useRef, useMemo } from "react";
import {
  X,
  Copy,
  Check,
  Download,
  ExternalLink,
  Sparkles,
  QrCode as QrIcon,
  Star,
  Layers,
  FileImage,
  Printer,
  ChevronDown,
} from "lucide-react";
import qrcode from "qrcode-generator";
import type { Business, Card } from "@/lib/types";
import { formatCardCodeDisplay } from "@/lib/card-code";
import { isMochiBusiness, MOCHI_LOGO_URL } from "@/lib/mochi-brand";
import { BusinessMark } from "@/components/business-mark";

export interface ReviewQrModalProps {
  isOpen: boolean;
  onClose: () => void;
  cards: Card[];
  business: Business | null;
  initialCardId?: string | null;
  themeClassName?: string;
}

type TabType = "pure_qr" | "standee_square";

export default function ReviewQrModal({
  isOpen,
  onClose,
  cards,
  business,
  initialCardId,
  themeClassName = "",
}: ReviewQrModalProps) {
  const reviewCards = useMemo(() => {
    const revs = cards.filter((c) => c.type === "review");
    return revs.length > 0 ? revs : cards;
  }, [cards]);

  const [selectedCardId, setSelectedCardId] = useState<string>(
    initialCardId || (reviewCards[0]?.id ?? "")
  );

  const activeCard = useMemo(() => {
    return reviewCards.find((c) => c.id === selectedCardId) || reviewCards[0] || null;
  }, [reviewCards, selectedCardId]);

  const [activeTab, setActiveTab] = useState<TabType>("pure_qr");
  const [withCenterLogo, setWithCenterLogo] = useState(true);
  const [isTransparentBg, setIsTransparentBg] = useState(false);
  const [qrColor, setQrColor] = useState<"emerald" | "black">("emerald");
  const [copied, setCopied] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);

  const isMochi = isMochiBusiness(business);
  const businessName = business?.public_name || business?.name || "Mochi Cafe n Resto";
  const logoUrl = isMochi ? MOCHI_LOGO_URL : (business?.logo_url || "/logo-mochi.png");

  const cardCode = activeCard?.card_code || "";
  const reviewUrl = typeof window !== "undefined"
    ? `${window.location.origin}/nilai/${cardCode}`
    : `https://kaels.site/nilai/${cardCode}`;

  const raw302Url = typeof window !== "undefined"
    ? `${window.location.origin}/r/${cardCode}?src=qr`
    : `https://kaels.site/r/${cardCode}?src=qr`;

  if (!isOpen || !activeCard) return null;

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(reviewUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2200);
    } catch {
      // fallback
    }
  };

  // Helper: Generator Kanvas QR Murni HD (2048 x 2048 px)
  const generatePureQrCanvas = (
    withLogo: boolean,
    transparent: boolean,
    color: "emerald" | "black"
  ): Promise<HTMLCanvasElement> => {
    return new Promise((resolve) => {
      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d", { willReadFrequently: false });
      if (!ctx) return resolve(canvas);

      const size = 2048;
      canvas.width = size;
      canvas.height = size;
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = "high";

      // Latar Belakang
      if (!transparent) {
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, size, size);
      } else {
        ctx.clearRect(0, 0, size, size);
      }

      // QR Matrix
      const qr = qrcode(0, "H");
      qr.addData(raw302Url, "Byte");
      qr.make();
      const n = qr.getModuleCount();

      const padding = 160;
      const qrMatrixSize = size - padding * 2;
      const cellSize = qrMatrixSize / n;

      ctx.fillStyle = color === "emerald" ? "#072e22" : "#000000";
      for (let r = 0; r < n; r++) {
        for (let c = 0; c < n; c++) {
          if (qr.isDark(r, c)) {
            ctx.fillRect(
              padding + c * cellSize,
              padding + r * cellSize,
              cellSize + 0.65,
              cellSize + 0.65
            );
          }
        }
      }

      if (!withLogo) {
        return resolve(canvas);
      }

      // Logo Tengah
      const logoImg = new Image();
      logoImg.crossOrigin = "anonymous";
      logoImg.src = logoUrl;

      const renderLogo = () => {
        const centerBadgeSize = Math.round(qrMatrixSize * 0.22);
        const cbX = (size - centerBadgeSize) / 2;
        const cbY = (size - centerBadgeSize) / 2;

        ctx.save();
        ctx.beginPath();
        ctx.arc(size / 2, size / 2, centerBadgeSize / 2 + 16, 0, Math.PI * 2);
        ctx.fillStyle = "#ffffff";
        ctx.fill();
        ctx.strokeStyle = color === "emerald" ? "#072e22" : "#000000";
        ctx.lineWidth = 14;
        ctx.stroke();
        ctx.clip();

        if (logoImg.naturalWidth > 0) {
          ctx.drawImage(logoImg, cbX, cbY, centerBadgeSize, centerBadgeSize);
        }
        ctx.restore();
        resolve(canvas);
      };

      let done = false;
      const trigger = () => {
        if (done) return;
        done = true;
        renderLogo();
      };

      logoImg.onload = trigger;
      logoImg.onerror = trigger;
      if (logoImg.complete && logoImg.naturalWidth > 0) {
        trigger();
      } else {
        setTimeout(trigger, 250);
      }
    });
  };

  // 1. Download Pure HD QR PNG
  const handleDownloadPureQr = async () => {
    setIsDownloading(true);
    try {
      const canvas = await generatePureQrCanvas(withCenterLogo, isTransparentBg, qrColor);
      const link = document.createElement("a");
      const labelSlug = (activeCard.label || "review").replace(/[^a-zA-Z0-9]/g, "-").toLowerCase();
      link.download = `QR-Review-Google-${labelSlug}-${cardCode}-HD.png`;
      link.href = canvas.toDataURL("image/png");
      link.click();
    } catch (e) {
      console.error(e);
    } finally {
      setIsDownloading(false);
    }
  };

  // 2. Download SVG Vector
  const handleDownloadSvg = () => {
    try {
      const qr = qrcode(0, withCenterLogo ? "H" : "M");
      qr.addData(raw302Url, "Byte");
      qr.make();
      const n = qr.getModuleCount();
      const m = 4;
      const total = n + m * 2;
      let pathD = "";
      for (let r = 0; r < n; r++) {
        for (let c = 0; c < n; c++) {
          if (qr.isDark(r, c)) pathD += `M${c},${r}h1v1h-1z`;
        }
      }

      const color = qrColor === "emerald" ? "#072e22" : "#000000";
      const svgString = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${-m} ${-m} ${total} ${total}" width="2048" height="2048"><rect x="${-m}" y="${-m}" width="${total}" height="${total}" fill="${isTransparentBg ? "none" : "#ffffff"}"/><path d="${pathD}" fill="${color}"/></svg>`;
      const blob = new Blob([svgString], { type: "image/svg+xml;charset=utf-8" });
      const link = document.createElement("a");
      const labelSlug = (activeCard.label || "review").replace(/[^a-zA-Z0-9]/g, "-").toLowerCase();
      link.download = `QR-Review-Google-${labelSlug}-${cardCode}.svg`;
      link.href = URL.createObjectURL(blob);
      link.click();
    } catch (e) {
      console.error(e);
    }
  };

  // 3. Download Standee Square (1:1 HD 2048x2048)
  const handleDownloadStandeeSquare = async () => {
    setIsDownloading(true);
    try {
      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d", { willReadFrequently: false });
      if (!ctx) return;

      const size = 2048;
      canvas.width = size;
      canvas.height = size;
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = "high";

      // Background Emerald
      ctx.fillStyle = "#0b3d2e";
      ctx.fillRect(0, 0, size, size);

      // Gold/Lime Header Banner
      ctx.fillStyle = "#c8f53a";
      ctx.fillRect(90, 80, size - 180, 16);

      // Store Title
      ctx.fillStyle = "#ffffff";
      ctx.font = "bold 68px Plus Jakarta Sans, sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(businessName.toUpperCase(), size / 2, 200);

      // 5 Stars Google Review
      ctx.fillStyle = "#fbbf24";
      ctx.font = "bold 52px sans-serif";
      ctx.fillText("⭐ ⭐ ⭐ ⭐ ⭐", size / 2, 280);

      // Main Instruction
      ctx.fillStyle = "#c8f53a";
      ctx.font = "900 86px Plus Jakarta Sans, sans-serif";
      ctx.fillText("BERI ULASAN GOOGLE", size / 2, 385);

      ctx.fillStyle = "#d1fae5";
      ctx.font = "500 44px Plus Jakarta Sans, sans-serif";
      ctx.fillText("Scan QR untuk bagikan pengalaman jujur Anda", size / 2, 450);

      // White Card for QR
      const cardBoxSize = 1100;
      const cardBoxX = (size - cardBoxSize) / 2;
      const cardBoxY = 510;
      ctx.fillStyle = "#ffffff";
      ctx.beginPath();
      ctx.roundRect(cardBoxX, cardBoxY, cardBoxSize, cardBoxSize, 48);
      ctx.fill();

      // Draw QR Inside Card
      const qrCanvas = await generatePureQrCanvas(true, false, "emerald");
      ctx.drawImage(qrCanvas, cardBoxX + 60, cardBoxY + 60, cardBoxSize - 120, cardBoxSize - 120);

      // Card Label / Table placement
      ctx.fillStyle = "#072e22";
      ctx.font = "bold 40px monospace";
      ctx.fillText(
        `TITIK: ${(activeCard.label || "MEJA KASIR").toUpperCase()} · KODE: ${formatCardCodeDisplay(cardCode)}`,
        size / 2,
        cardBoxY + cardBoxSize - 30
      );

      // Footer
      ctx.fillStyle = "#a7f3d0";
      ctx.font = "bold 42px Plus Jakarta Sans, sans-serif";
      ctx.fillText("Terima kasih atas kunjungan & apresiasi Anda!", size / 2, 1720);

      ctx.fillStyle = "#6ee7b7";
      ctx.font = "400 32px monospace";
      ctx.fillText("KAEL Review System · Ulasan Terverifikasi", size / 2, 1780);

      const link = document.createElement("a");
      const labelSlug = (activeCard.label || "review").replace(/[^a-zA-Z0-9]/g, "-").toLowerCase();
      link.download = `Standee-Review-Google-${labelSlug}-${cardCode}-1x1.png`;
      link.href = canvas.toDataURL("image/png");
      link.click();
    } catch (e) {
      console.error(e);
    } finally {
      setIsDownloading(false);
    }
  };

  return (
    <div className={`fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-3 backdrop-blur-sm animate-in fade-in-50 ${themeClassName}`}>
      <div className="relative flex max-h-[94vh] w-full max-w-2xl flex-col rounded-3xl border border-[#d8e3de] bg-white shadow-2xl overflow-hidden animate-in zoom-in-95">
        
        {/* Header Modal */}
        <div className="flex items-center justify-between border-b border-[#edf3f0] bg-[#0b3d2e] px-5 py-4 text-white">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[#c8f53a] text-[#0b3d2e] font-black shadow-xs">
              <QrIcon size={20} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-black tracking-tight text-white sm:text-lg">
                  Download QR Ulasan Google
                </h2>
                <span className="rounded-full bg-[#c8f53a] px-2 py-0.5 font-mono text-[9px] font-black text-[#073829]">
                  Ultra HD 2048px
                </span>
              </div>
              <p className="text-xs text-emerald-200/90 font-mono mt-0.5">
                {businessName} · {activeCard.label || "Meja Kasir"} ({formatCardCodeDisplay(cardCode)})
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-xl bg-white/10 text-white hover:bg-white/20 transition-colors"
          >
            <X size={17} />
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-5">
          
          {/* Multi-Card Selector (if more than 1 card exists) */}
          {reviewCards.length > 1 && (
            <div className="rounded-2xl border border-[#d8e3de] bg-[#f8faf9] p-3">
              <label className="block font-mono text-[10px] font-extrabold uppercase text-[#527867] mb-1.5">
                Pilih Titik Kartu / Standee Ulasan:
              </label>
              <div className="flex flex-wrap gap-2">
                {reviewCards.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => setSelectedCardId(c.id)}
                    className={`rounded-xl px-3 py-1.5 font-mono text-xs font-bold transition-all ${
                      c.id === activeCard.id
                        ? "bg-[#0b3d2e] text-[#c8f53a] shadow-xs"
                        : "border border-[#d8e3de] bg-white text-[#527867] hover:border-[#0b3d2e] hover:text-[#0b3d2e]"
                    }`}
                  >
                    {c.label || "Tanpa Label"} ({formatCardCodeDisplay(c.card_code)})
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Tab Selector: QR Murni vs Standee Meja */}
          <div className="flex rounded-2xl border border-[#d8e3de] bg-[#edf8f3] p-1">
            <button
              type="button"
              onClick={() => setActiveTab("pure_qr")}
              className={`flex-1 rounded-xl py-2 font-mono text-xs font-extrabold transition-all flex items-center justify-center gap-1.5 ${
                activeTab === "pure_qr"
                  ? "bg-[#0b3d2e] text-[#c8f53a] shadow-xs"
                  : "text-[#167052] hover:text-[#0b3d2e]"
              }`}
            >
              <QrIcon size={14} />
              <span>1. QR Code Murni (HD PNG/SVG)</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("standee_square")}
              className={`flex-1 rounded-xl py-2 font-mono text-xs font-extrabold transition-all flex items-center justify-center gap-1.5 ${
                activeTab === "standee_square"
                  ? "bg-[#0b3d2e] text-[#c8f53a] shadow-xs"
                  : "text-[#167052] hover:text-[#0b3d2e]"
              }`}
            >
              <FileImage size={14} />
              <span>2. Standee 1:1 Siap Cetak</span>
            </button>
          </div>

          {/* TAB 1: PURE QR CODE */}
          {activeTab === "pure_qr" && (
            <div className="grid gap-5 sm:grid-cols-[220px_1fr] items-center animate-in fade-in-50">
              {/* QR Preview Box */}
              <div className="flex flex-col items-center justify-center rounded-3xl border-2 border-dashed border-[#0b3d2e]/20 bg-[#f9fbf9] p-4 text-center">
                <div className="relative flex h-44 w-44 items-center justify-center rounded-2xl bg-white p-2.5 shadow-sm border border-[#d8e3de]">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={logoUrl}
                    alt="Mochi Logo"
                    className="absolute inset-0 m-auto h-9 w-9 rounded-full border-2 border-[#0b3d2e] bg-white p-0.5 object-contain shadow-md z-10"
                  />
                  <div
                    dangerouslySetInnerHTML={{
                      __html: qrcode(0, "H").createSvgTag({
                        scalable: true,
                        margin: 0,
                      }),
                    }}
                    className="h-full w-full [&_svg]:h-full [&_svg]:w-full [&_path]:fill-[#072e22]"
                  />
                </div>
                <span className="mt-2 font-mono text-[10.5px] font-bold text-[#527867]">
                  Resolusi Ekspor: 2048 x 2048 px
                </span>
              </div>

              {/* Options & Download Controls */}
              <div className="space-y-3.5">
                <div>
                  <h4 className="text-sm font-black text-[#0b3d2e]">
                    File QR Murni Resolusi Tinggi
                  </h4>
                  <p className="text-xs text-[#527867] leading-relaxed mt-0.5">
                    Cocok untuk dimasukkan ke desain Canva, stiker meja akrilik, banner promosi, atau materi cetak sendiri.
                  </p>
                </div>

                {/* Customization Toggles */}
                <div className="grid grid-cols-2 gap-2 font-mono text-xs">
                  <label className="flex items-center gap-2 rounded-xl border border-[#d8e3de] bg-white p-2.5 cursor-pointer hover:bg-[#f8faf9]">
                    <input
                      type="checkbox"
                      checked={withCenterLogo}
                      onChange={(e) => setWithCenterLogo(e.target.checked)}
                      className="rounded text-[#0b3d2e] focus:ring-[#0b3d2e]"
                    />
                    <span className="font-bold text-[#0b3d2e] text-[11px]">Logo di Tengah</span>
                  </label>

                  <label className="flex items-center gap-2 rounded-xl border border-[#d8e3de] bg-white p-2.5 cursor-pointer hover:bg-[#f8faf9]">
                    <input
                      type="checkbox"
                      checked={isTransparentBg}
                      onChange={(e) => setIsTransparentBg(e.target.checked)}
                      className="rounded text-[#0b3d2e] focus:ring-[#0b3d2e]"
                    />
                    <span className="font-bold text-[#0b3d2e] text-[11px]">Latar Transparan</span>
                  </label>
                </div>

                {/* Download Action Buttons */}
                <div className="flex flex-col sm:flex-row gap-2.5 pt-1">
                  <button
                    type="button"
                    onClick={handleDownloadPureQr}
                    disabled={isDownloading}
                    className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl bg-[#0b3d2e] hover:bg-[#0e4837] px-4 py-3 font-mono text-xs font-black text-[#c8f53a] shadow-sm hover:brightness-105 active:scale-[0.98] transition-all disabled:opacity-50"
                  >
                    <Download size={14} />
                    <span>{isDownloading ? "Membuat File..." : "Download PNG HD (2048px)"}</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleDownloadSvg}
                    className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-[#0b3d2e] bg-white hover:bg-[#edf8f3] px-3.5 py-3 font-mono text-xs font-bold text-[#0b3d2e] transition-colors"
                    title="Format Vektor SVG untuk Illustrator & Canva"
                  >
                    <Download size={13} />
                    <span>SVG Vektor</span>
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: STANDEE SQUARE 1:1 */}
          {activeTab === "standee_square" && (
            <div className="space-y-4 animate-in fade-in-50">
              <div className="rounded-3xl border border-[#0b3d2e] bg-[#0b3d2e] p-5 text-white text-center shadow-md space-y-3">
                <div className="flex items-center justify-center gap-1.5 text-amber-300">
                  <Star size={18} className="fill-amber-400 text-amber-400" />
                  <Star size={18} className="fill-amber-400 text-amber-400" />
                  <Star size={18} className="fill-amber-400 text-amber-400" />
                  <Star size={18} className="fill-amber-400 text-amber-400" />
                  <Star size={18} className="fill-amber-400 text-amber-400" />
                </div>
                <div>
                  <h3 className="text-lg sm:text-xl font-black text-[#c8f53a] uppercase tracking-wide">
                    BERI ULASAN GOOGLE
                  </h3>
                  <p className="text-xs text-emerald-100/90 font-mono mt-0.5">
                    {businessName} · Scan QR untuk bagikan pengalaman Anda
                  </p>
                </div>

                <div className="mx-auto inline-block rounded-2xl bg-white p-3 shadow-inner">
                  <div className="relative flex h-40 w-40 items-center justify-center">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={logoUrl}
                      alt="Mochi Logo"
                      className="absolute inset-0 m-auto h-8 w-8 rounded-full border border-[#0b3d2e] bg-white p-0.5 object-contain shadow-md z-10"
                    />
                    <div
                      dangerouslySetInnerHTML={{
                        __html: qrcode(0, "H").createSvgTag({
                          scalable: true,
                          margin: 0,
                        }),
                      }}
                      className="h-full w-full [&_svg]:h-full [&_svg]:w-full [&_path]:fill-[#072e22]"
                    />
                  </div>
                </div>

                <div className="text-[11px] font-mono text-emerald-200/90">
                  Titik: <strong className="text-white">{(activeCard.label || "Meja Kasir").toUpperCase()}</strong> · Kode: {formatCardCodeDisplay(cardCode)}
                </div>
              </div>

              <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-1">
                <p className="text-xs text-[#527867]">
                  Format 1:1 Square siap cetak untuk stiker meja kasir atau akrilik tent card.
                </p>
                <button
                  type="button"
                  onClick={handleDownloadStandeeSquare}
                  disabled={isDownloading}
                  className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-xl bg-[#0b3d2e] hover:bg-[#0e4837] px-5 py-2.5 font-mono text-xs font-black text-[#c8f53a] shadow-xs transition-all disabled:opacity-50"
                >
                  <Download size={14} />
                  <span>Download Standee HD (2048px)</span>
                </button>
              </div>
            </div>
          )}

          {/* Quick Direct Link & Test Action Bar */}
          <div className="rounded-2xl border border-[#edf3f0] bg-[#f9fbf9] p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs font-mono">
            <div className="min-w-0 space-y-0.5">
              <span className="block text-[10px] font-extrabold uppercase text-[#527867]">
                Tautan Form Review Langsung:
              </span>
              <p className="truncate font-bold text-[#0b3d2e] select-all">
                {reviewUrl}
              </p>
            </div>

            <div className="flex shrink-0 items-center gap-2">
              <button
                type="button"
                onClick={handleCopyLink}
                className="inline-flex items-center gap-1 rounded-xl border border-[#d8e3de] bg-white px-3 py-1.5 font-bold text-[#0b3d2e] hover:bg-[#edf8f3] transition-colors shadow-xs"
              >
                {copied ? <Check size={13} className="text-emerald-600" /> : <Copy size={13} />}
                <span>{copied ? "Tersalin!" : "Salin Link"}</span>
              </button>

              <a
                href={reviewUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 rounded-xl bg-[#0b3d2e] px-3 py-1.5 font-bold text-[#c8f53a] hover:brightness-105 transition-colors shadow-xs"
              >
                <ExternalLink size={12} />
                <span>Uji Coba ↗</span>
              </a>
            </div>
          </div>

        </div>

        {/* Footer */}
        <div className="border-t border-[#edf3f0] bg-[#f8faf9] px-5 py-3 flex items-center justify-between text-xs text-[#527867] font-mono">
          <span className="flex items-center gap-1.5">
            <Sparkles size={13} className="text-emerald-600" />
            <span>Smart Routing: ⭐4–5 Google Maps · ⭐1–3 Privat Dashboard</span>
          </span>
          <button
            type="button"
            onClick={onClose}
            className="font-bold text-[#0b3d2e] hover:underline"
          >
            Tutup
          </button>
        </div>

      </div>
    </div>
  );
}
