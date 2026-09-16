"use client";

import { useState, useMemo } from "react";
import {
  X,
  Printer,
  Copy,
  Check,
  ExternalLink,
  QrCode as QrCodeIcon,
  Sparkles,
  Layers,
  Download,
  Camera,
  UtensilsCrossed,
  Smartphone,
} from "lucide-react";
import qrcode from "qrcode-generator";
import QrCodeComponent from "@/components/qr-code";
import { siteHost } from "@/lib/site";

interface TableQrModalProps {
  isOpen: boolean;
  onClose: () => void;
  storeCode: string;
  storeName: string;
  isMochi?: boolean;
}

const QUICK_TABLES = [
  "1",
  "2",
  "3",
  "4",
  "5",
  "6",
  "7",
  "8",
  "9",
  "10",
  "VIP",
  "Lesehan",
];

export default function TableQrModal({
  isOpen,
  onClose,
  storeCode,
  storeName,
  isMochi = true,
}: TableQrModalProps) {
  const [selectedTable, setSelectedTable] = useState<string>("1");
  const [customTableInput, setCustomTableInput] = useState<string>("");
  const [copied, setCopied] = useState<boolean>(false);
  const [isDownloading, setIsDownloading] = useState<boolean>(false);

  const activeTable = useMemo(() => {
    return customTableInput.trim() || selectedTable;
  }, [customTableInput, selectedTable]);

  const formattedTableNumber = useMemo(() => {
    const raw = activeTable.trim();
    if (/^\d+$/.test(raw)) {
      return raw.length === 1 ? `0${raw}` : raw;
    }
    return raw.toUpperCase();
  }, [activeTable]);

  const targetUrl = useMemo(() => {
    const origin = typeof window !== "undefined" ? window.location.origin : `https://${siteHost}`;
    return `${origin}/order/${encodeURIComponent(storeCode || "MOCHIKAFE")}/${encodeURIComponent(activeTable)}`;
  }, [storeCode, activeTable]);

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(targetUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback
    }
  };

  const handleDownloadPng = () => {
    setIsDownloading(true);
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      setIsDownloading(false);
      return;
    }

    // High resolution A5/A6 portrait format
    const w = 800;
    const h = 1180;
    canvas.width = w;
    canvas.height = h;

    // Background Pure White
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, w, h);

    // Outer Forest Emerald Border
    ctx.strokeStyle = "#0b3d2e";
    ctx.lineWidth = 12;
    ctx.beginPath();
    ctx.roundRect(24, 24, w - 48, h - 48, 36);
    ctx.stroke();

    // Inner Dashed Pinstripe
    ctx.strokeStyle = "rgba(11, 61, 46, 0.22)";
    ctx.lineWidth = 2;
    ctx.setLineDash([8, 6]);
    ctx.beginPath();
    ctx.roundRect(38, 38, w - 76, h - 76, 26);
    ctx.stroke();
    ctx.setLineDash([]);

    const logoImg = new Image();
    logoImg.crossOrigin = "anonymous";
    logoImg.src = "/logo-mochi.png";

    const renderCanvasContent = () => {
      // 1. Top Logo (Clean, borderless)
      const logoW = 160;
      const logoH = 70;
      const logoX = (w - logoW) / 2;
      const logoY = 62;
      ctx.drawImage(logoImg, logoX, logoY, logoW, logoH);

      // 2. Store Title & Subtitle
      ctx.fillStyle = "#0b3d2e";
      ctx.font = "900 32px -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
      ctx.textAlign = "center";
      ctx.fillText((storeName || "MOCHI CAFE N RESTO").toUpperCase(), w / 2, 175);

      ctx.fillStyle = "#4a6b5e";
      ctx.font = "bold 15px -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
      ctx.fillText("BUKU MENU DIGITAL · PESAN LANGSUNG DARI MEJA", w / 2, 205);

      // 3. Central Table Badge (Balanced & Prominent)
      const tableBadgeW = 340;
      const tableBadgeH = 62;
      const tableBadgeX = (w - tableBadgeW) / 2;
      const tableBadgeY = 238;

      ctx.fillStyle = "#0b3d2e";
      ctx.beginPath();
      ctx.roundRect(tableBadgeX, tableBadgeY, tableBadgeW, tableBadgeH, 20);
      ctx.fill();

      // Gold/Lime Inner Border on Badge
      ctx.strokeStyle = "#c8f53a";
      ctx.lineWidth = 2;
      ctx.stroke();

      ctx.fillStyle = "#c8f53a";
      ctx.font = "900 30px monospace";
      ctx.fillText(`MEJA ${formattedTableNumber}`, w / 2, tableBadgeY + 43);

      // 4. QR Code Container & Crisp QR
      const qr = qrcode(0, "H");
      qr.addData(targetUrl, "Byte");
      qr.make();
      const n = qr.getModuleCount();
      const qrBoxSize = 360;
      const qrX = (w - qrBoxSize) / 2;
      const qrY = 328;
      const cellSize = qrBoxSize / n;

      // QR White Card Background
      ctx.fillStyle = "#ffffff";
      ctx.beginPath();
      ctx.roundRect(qrX - 20, qrY - 20, qrBoxSize + 40, qrBoxSize + 40, 24);
      ctx.fill();
      ctx.strokeStyle = "#d1ded7";
      ctx.lineWidth = 2;
      ctx.stroke();

      // Corner Precision Crop Accents
      const cornerLen = 22;
      ctx.strokeStyle = "#0b3d2e";
      ctx.lineWidth = 4;

      // Top Left
      ctx.beginPath();
      ctx.moveTo(qrX - 12, qrY - 12 + cornerLen);
      ctx.lineTo(qrX - 12, qrY - 12);
      ctx.lineTo(qrX - 12 + cornerLen, qrY - 12);
      ctx.stroke();

      // Top Right
      ctx.beginPath();
      ctx.moveTo(qrX + qrBoxSize + 12 - cornerLen, qrY - 12);
      ctx.lineTo(qrX + qrBoxSize + 12, qrY - 12);
      ctx.lineTo(qrX + qrBoxSize + 12, qrY - 12 + cornerLen);
      ctx.stroke();

      // Bottom Left
      ctx.beginPath();
      ctx.moveTo(qrX - 12, qrY + qrBoxSize + 12 - cornerLen);
      ctx.lineTo(qrX - 12, qrY + qrBoxSize + 12);
      ctx.lineTo(qrX - 12 + cornerLen, qrY + qrBoxSize + 12);
      ctx.stroke();

      // Bottom Right
      ctx.beginPath();
      ctx.moveTo(qrX + qrBoxSize + 12 - cornerLen, qrY + qrBoxSize + 12);
      ctx.lineTo(qrX + qrBoxSize + 12, qrY + qrBoxSize + 12);
      ctx.lineTo(qrX + qrBoxSize + 12, qrY + qrBoxSize + 12 - cornerLen);
      ctx.stroke();

      // Draw QR Code Matrix
      ctx.fillStyle = "#0b3d2e";
      for (let r = 0; r < n; r++) {
        for (let c = 0; c < n; c++) {
          if (qr.isDark(r, c)) {
            ctx.fillRect(qrX + c * cellSize, qrY + r * cellSize, cellSize + 0.5, cellSize + 0.5);
          }
        }
      }

      // Center Logo Badge on QR
      const centerBadgeSize = 80;
      const cbX = (w - centerBadgeSize) / 2;
      const cbY = qrY + (qrBoxSize - centerBadgeSize) / 2;

      ctx.save();
      ctx.beginPath();
      ctx.arc(w / 2, cbY + centerBadgeSize / 2, centerBadgeSize / 2 + 2, 0, Math.PI * 2);
      ctx.fillStyle = "#ffffff";
      ctx.fill();
      ctx.strokeStyle = "#0b3d2e";
      ctx.lineWidth = 3;
      ctx.stroke();
      ctx.clip();
      ctx.drawImage(logoImg, cbX, cbY, centerBadgeSize, centerBadgeSize);
      ctx.restore();

      // 5. Instruction Scan Pill
      const pillW = 380;
      const pillH = 44;
      const pillX = (w - pillW) / 2;
      const pillY = 746;

      ctx.fillStyle = "#edf8f3";
      ctx.beginPath();
      ctx.roundRect(pillX, pillY, pillW, pillH, 22);
      ctx.fill();
      ctx.strokeStyle = "#b8ded0";
      ctx.lineWidth = 1.5;
      ctx.stroke();

      ctx.fillStyle = "#0b3d2e";
      ctx.font = "900 16px -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
      ctx.fillText("📷 SCAN DENGAN KAMERA HP", w / 2, pillY + 28);

      // 6. 3 Steps Instruction Cards Box
      const stepsW = w - 100;
      const stepsH = 135;
      const stepsX = 50;
      const stepsY = 812;

      ctx.fillStyle = "#f6faf8";
      ctx.beginPath();
      ctx.roundRect(stepsX, stepsY, stepsW, stepsH, 20);
      ctx.fill();
      ctx.strokeStyle = "#d8e6e0";
      ctx.lineWidth = 1.5;
      ctx.stroke();

      // Step 1
      ctx.fillStyle = "#0b3d2e";
      ctx.font = "900 17px -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
      ctx.fillText("1. Buka Kamera", stepsX + stepsW * 0.18, stepsY + 54);
      ctx.fillStyle = "#557266";
      ctx.font = "13px -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
      ctx.fillText("iPhone / Android", stepsX + stepsW * 0.18, stepsY + 84);

      // Separator 1
      ctx.strokeStyle = "#dce8e2";
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(stepsX + stepsW * 0.35, stepsY + 25);
      ctx.lineTo(stepsX + stepsW * 0.35, stepsY + stepsH - 25);
      ctx.stroke();

      // Step 2
      ctx.fillStyle = "#0b3d2e";
      ctx.font = "900 17px -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
      ctx.fillText("2. Arahkan QR", stepsX + stepsW * 0.51, stepsY + 54);
      ctx.fillStyle = "#557266";
      ctx.font = "13px -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
      ctx.fillText("Pilih menu lezat", stepsX + stepsW * 0.51, stepsY + 84);

      // Separator 2
      ctx.beginPath();
      ctx.moveTo(stepsX + stepsW * 0.67, stepsY + 25);
      ctx.lineTo(stepsX + stepsW * 0.67, stepsY + stepsH - 25);
      ctx.stroke();

      // Step 3
      ctx.fillStyle = "#0b3d2e";
      ctx.font = "900 17px -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
      ctx.fillText("3. Pesan & Santap", stepsX + stepsW * 0.83, stepsY + 54);
      ctx.fillStyle = "#557266";
      ctx.font = "13px -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
      ctx.fillText("Diantar ke meja", stepsX + stepsW * 0.83, stepsY + 84);

      // 7. Footer Member & Assurance
      ctx.fillStyle = "#125740";
      ctx.font = "bold 15px -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
      ctx.fillText("✨ Kumpulkan Poin Member di Setiap Pemesanan! ✨", w / 2, 985);

      ctx.fillStyle = "#71897f";
      ctx.font = "bold 12px -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
      ctx.fillText("PESANAN OTOMATIS MASUK KE KASIR & DAPUR · KAEL POS", w / 2, 1025);

      const link = document.createElement("a");
      link.download = `Standee-Meja-${formattedTableNumber}-MochiCafe.png`;
      link.href = canvas.toDataURL("image/png");
      link.click();
      setIsDownloading(false);
    };

    logoImg.onload = renderCanvasContent;
    logoImg.onerror = renderCanvasContent;
    if (logoImg.complete) renderCanvasContent();
  };

  const handlePrintStandee = () => {
    const printWindow = window.open("", "_blank", "width=750,height=1000");
    if (!printWindow) {
      alert("Izinkan pop-up browser untuk mencetak kartu standee meja.");
      return;
    }

    const origin = typeof window !== "undefined" ? window.location.origin : `https://${siteHost}`;
    const logoSrc = `${origin}/logo-mochi.png`;

    const qr = qrcode(0, "H");
    qr.addData(targetUrl, "Byte");
    qr.make();
    const n = qr.getModuleCount();
    let pathD = "";
    for (let r = 0; r < n; r++) {
      for (let c = 0; c < n; c++) {
        if (qr.isDark(r, c)) pathD += `M${c},${r}h1v1h-1z`;
      }
    }
    const m = 3;
    const total = n + m * 2;
    const qrSvg = `<svg viewBox="${-m} ${-m} ${total} ${total}" width="220" height="220" shape-rendering="crispEdges"><rect x="${-m}" y="${-m}" width="${total}" height="${total}" fill="#ffffff"/><path d="${pathD}" fill="#0b3d2e"/></svg>`;

    const htmlContent = `
      <!DOCTYPE html>
      <html lang="id">
      <head>
        <meta charset="utf-8" />
        <title>Standee QR Meja ${formattedTableNumber} - ${storeName}</title>
        <style>
          @page {
            size: A5 portrait;
            margin: 8mm;
          }
          * {
            box-sizing: border-box;
            margin: 0;
            padding: 0;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          body {
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
            background-color: #ffffff;
            color: #0b3d2e;
            display: flex;
            align-items: center;
            justify-content: center;
            min-height: 100vh;
            padding: 0;
          }
          .standee-card {
            width: 100%;
            max-width: 420px;
            border: 4px solid #0b3d2e;
            border-radius: 30px;
            padding: 26px 20px;
            text-align: center;
            background: #ffffff;
            position: relative;
            box-shadow: 0 6px 24px rgba(11, 61, 46, 0.08);
            overflow: hidden;
          }
          .inner-border {
            position: absolute;
            inset: 8px;
            border: 1.5px dashed rgba(11, 61, 46, 0.25);
            border-radius: 22px;
            pointer-events: none;
          }
          .brand-logo-wrap {
            display: flex;
            justify-content: center;
            margin-bottom: 8px;
            position: relative;
            z-index: 2;
          }
          .brand-logo-wrap img {
            height: 52px;
            width: auto;
            max-width: 180px;
            object-fit: contain;
          }
          .store-title {
            font-size: 20px;
            font-weight: 900;
            color: #0b3d2e;
            letter-spacing: 0.5px;
            text-transform: uppercase;
            margin-bottom: 2px;
            position: relative;
            z-index: 2;
          }
          .store-subtitle {
            font-size: 11px;
            color: #4a6b5e;
            font-weight: 700;
            margin-bottom: 14px;
            position: relative;
            z-index: 2;
          }
          .table-banner {
            display: inline-flex;
            align-items: center;
            justify-content: center;
            background: #0b3d2e;
            color: #c8f53a;
            border: 1.5px solid #c8f53a;
            padding: 8px 28px;
            border-radius: 16px;
            margin-bottom: 14px;
            box-shadow: 0 4px 12px rgba(11, 61, 46, 0.2);
            position: relative;
            z-index: 2;
          }
          .table-banner-no {
            font-size: 22px;
            font-weight: 900;
            font-family: ui-monospace, SFMono-Regular, monospace;
            letter-spacing: 1px;
            color: #c8f53a;
          }
          .qr-frame {
            position: relative;
            display: inline-block;
            background: #ffffff;
            padding: 14px;
            border-radius: 22px;
            border: 2px solid #d5ded9;
            box-shadow: 0 4px 16px rgba(0, 0, 0, 0.06);
            margin-bottom: 12px;
            z-index: 2;
          }
          .qr-frame .corner {
            position: absolute;
            width: 14px;
            height: 14px;
            border-color: #0b3d2e;
            border-style: solid;
          }
          .qr-frame .tl { top: 5px; left: 5px; border-width: 3px 0 0 3px; border-top-left-radius: 6px; }
          .qr-frame .tr { top: 5px; right: 5px; border-width: 3px 3px 0 0; border-top-right-radius: 6px; }
          .qr-frame .bl { bottom: 5px; left: 5px; border-width: 0 0 3px 3px; border-bottom-left-radius: 6px; }
          .qr-frame .br { bottom: 5px; right: 5px; border-width: 0 3px 3px 0; border-bottom-right-radius: 6px; }

          .qr-box {
            position: relative;
            display: inline-block;
          }
          .qr-box svg {
            display: block;
            margin: 0 auto;
          }
          .qr-center-logo {
            position: absolute;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            width: 48px;
            height: 48px;
            background: #ffffff;
            border-radius: 50%;
            padding: 4px;
            box-shadow: 0 2px 8px rgba(0,0,0,0.2);
            border: 2px solid #0b3d2e;
            display: flex;
            align-items: center;
            justify-content: center;
          }
          .qr-center-logo img {
            width: 100%;
            height: 100%;
            object-fit: contain;
            border-radius: 50%;
          }
          .scan-pill {
            display: inline-flex;
            align-items: center;
            gap: 6px;
            background: #edf8f3;
            color: #0b3d2e;
            border: 1px solid #bce0d2;
            border-radius: 999px;
            padding: 5px 18px;
            font-size: 10.5px;
            font-weight: 800;
            letter-spacing: 0.8px;
            text-transform: uppercase;
            margin-bottom: 12px;
            position: relative;
            z-index: 2;
          }
          .steps-container {
            display: grid;
            grid-template-columns: 1fr 1fr 1fr;
            gap: 4px;
            background: #f6faf8;
            border: 1.5px solid #d8e5df;
            border-radius: 16px;
            padding: 10px 8px;
            margin-bottom: 12px;
            position: relative;
            z-index: 2;
          }
          .step-item {
            display: flex;
            flex-direction: column;
            align-items: center;
            text-align: center;
          }
          .step-item:not(:last-child) {
            border-right: 1.5px solid #dce8e2;
          }
          .step-icon {
            font-size: 16px;
            margin-bottom: 3px;
          }
          .step-title {
            font-size: 10px;
            font-weight: 900;
            color: #0b3d2e;
            line-height: 1.1;
          }
          .step-desc {
            font-size: 8.5px;
            color: #557266;
            margin-top: 2px;
          }
          .promo-badge {
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 4px;
            font-size: 10px;
            font-weight: 800;
            color: #125740;
            margin-bottom: 6px;
            position: relative;
            z-index: 2;
          }
          .footer-note {
            font-size: 8.5px;
            color: #71897f;
            font-weight: 600;
            text-transform: uppercase;
            letter-spacing: 0.4px;
            position: relative;
            z-index: 2;
          }
        </style>
      </head>
      <body>
        <div class="standee-card">
          <div class="inner-border"></div>

          <!-- Top Brand Logo -->
          <div class="brand-logo-wrap">
            <img src="${logoSrc}" alt="Mochi Logo" />
          </div>

          <h1 class="store-title">${storeName}</h1>
          <p class="store-subtitle">Buku Menu Digital · Pesan Langsung Tanpa Antre</p>
          
          <!-- Balanced Table Banner -->
          <div>
            <div class="table-banner">
              <span class="table-banner-no">MEJA ${formattedTableNumber}</span>
            </div>
          </div>

          <!-- QR Section with Corner Accents & Center Logo -->
          <div>
            <div class="qr-frame">
              <span class="corner tl"></span>
              <span class="corner tr"></span>
              <span class="corner bl"></span>
              <span class="corner br"></span>

              <div class="qr-box">
                ${qrSvg}
                <div class="qr-center-logo">
                  <img src="${logoSrc}" alt="Logo" />
                </div>
              </div>
            </div>
          </div>

          <div class="scan-pill">
            📷 SCAN DENGAN KAMERA HP
          </div>

          <!-- 3 Easy Steps -->
          <div class="steps-container">
            <div class="step-item">
              <span class="step-icon">📷</span>
              <span class="step-title">1. Buka Kamera</span>
              <span class="step-desc">iPhone / Android</span>
            </div>
            <div class="step-item">
              <span class="step-icon">📲</span>
              <span class="step-title">2. Arahkan QR</span>
              <span class="step-desc">Pilih menu favorit</span>
            </div>
            <div class="step-item">
              <span class="step-icon">🍽️</span>
              <span class="step-title">3. Pesan &amp; Santap</span>
              <span class="step-desc">Diantar ke meja</span>
            </div>
          </div>

          <div class="promo-badge">
            ✨ Kumpulkan Poin Member di Setiap Pemesanan! ✨
          </div>

          <p class="footer-note">Pesanan otomatis masuk ke Kasir &amp; Dapur · KAEL POS</p>
        </div>

        <script>
          window.onload = function() {
            setTimeout(function() {
              window.print();
            }, 300);
          };
        </script>
      </body>
      </html>
    `;

    printWindow.document.open();
    printWindow.document.write(htmlContent);
    printWindow.document.close();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-3 sm:p-5 backdrop-blur-xs animate-in fade-in-50 overflow-y-auto">
      <div className="w-full max-w-lg rounded-3xl bg-white text-[#1c2d26] shadow-2xl overflow-hidden flex flex-col my-auto animate-in zoom-in-95 border border-[#d8e3de]">
        {/* Header Modal */}
        <div className="flex items-center justify-between border-b border-[#e2ebe6] bg-[#0b3d2e] px-5 py-4 text-white">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#c8f53a] text-[#073829] shadow-xs">
              <QrCodeIcon size={19} strokeWidth={2.4} />
            </div>
            <div>
              <h2 className="text-sm sm:text-base font-black tracking-tight">
                Generator Standee QR Meja
              </h2>
              <p className="text-[10.5px] text-emerald-200/90">
                Pilih atau tambah nomor meja untuk dicetak di akrilik meja tamu
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Tutup"
            className="flex h-8 w-8 items-center justify-center rounded-full bg-white/10 text-white/80 hover:bg-white/20 hover:text-white transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        <div className="p-4 sm:p-6 space-y-5 overflow-y-auto max-h-[80vh]">
          {/* 1. Pemilihan Nomor Meja */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-black text-[#0b3d2e] uppercase tracking-wider flex items-center gap-1.5">
                <Layers size={13} />
                <span>Pilih Nomor Meja</span>
              </label>
              <span className="text-[11px] font-bold text-[#556b62]">
                Aktif: <strong className="font-mono text-[#0b3d2e]">Meja {formattedTableNumber}</strong>
              </span>
            </div>

            {/* Quick Chips */}
            <div className="flex flex-wrap gap-1.5">
              {QUICK_TABLES.map((table) => {
                const isSelected = !customTableInput && selectedTable === table;
                return (
                  <button
                    key={table}
                    type="button"
                    onClick={() => {
                      setSelectedTable(table);
                      setCustomTableInput("");
                    }}
                    className={`px-3 py-1.5 rounded-xl text-xs font-mono font-black transition-all ${
                      isSelected
                        ? "bg-[#0b3d2e] text-[#c8f53a] shadow-xs scale-105"
                        : "bg-[#edf8f3] text-[#1c2d26] hover:bg-[#dfeee6] border border-[#d8e3de]"
                    }`}
                  >
                    Meja {table}
                  </button>
                );
              })}
            </div>

            {/* Custom Input */}
            <div className="pt-1">
              <div className="relative">
                <input
                  type="text"
                  value={customTableInput}
                  onChange={(e) => setCustomTableInput(e.target.value)}
                  placeholder="Atau ketik nomor/nama meja bebas (contoh: 12, VIP-2, Outdoor)"
                  className="w-full rounded-xl border border-[#ccd9d3] bg-white px-3.5 py-2 text-xs font-mono font-bold text-[#1c2d26] placeholder-[#8ba096] focus:border-[#167052] focus:outline-hidden focus:ring-2 focus:ring-[#167052]/20"
                />
                {customTableInput && (
                  <button
                    type="button"
                    onClick={() => setCustomTableInput("")}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-[#718078] hover:text-[#1c2d26]"
                  >
                    Reset
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* 2. Pratinjau Standee Meja Akrilik Eksklusif */}
          <div className="space-y-2">
            <span className="text-xs font-black text-[#0b3d2e] uppercase tracking-wider flex items-center gap-1.5">
              <Sparkles size={13} />
              <span>Pratinjau Standee Meja Siap Cetak (A5/A6 Akrilik)</span>
            </span>

            <div className="rounded-[28px] border-[3.5px] border-[#0b3d2e] bg-[#ffffff] p-5 sm:p-6 text-center shadow-xl relative overflow-hidden max-w-[340px] mx-auto">
              {/* Inner dashed line */}
              <div className="pointer-events-none absolute inset-2 rounded-[20px] border border-dashed border-[#0b3d2e]/20" />

              {/* Logo Header (Borderless, Prominent) */}
              <div className="relative z-10 flex justify-center mb-2">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src="/logo-mochi.png"
                  alt="Mochi Cafe Logo"
                  className="h-12 w-auto max-w-[160px] object-contain mx-auto"
                />
              </div>

              {/* Nama Kafe */}
              <h3 className="relative z-10 text-base font-black uppercase tracking-tight text-[#0b3d2e]">
                {storeName || "Mochi Cafe n Resto"}
              </h3>
              <p className="relative z-10 text-[9.5px] font-bold text-[#4a6b5e] mb-3">
                Buku Menu Digital · Pesan Langsung dari Meja
              </p>

              {/* Nomor Meja Banner (Prominently Centered Above QR) */}
              <div className="relative z-10 mb-3.5 inline-flex items-center justify-center rounded-2xl bg-[#0b3d2e] px-5 py-2 text-[#c8f53a] border border-[#c8f53a] shadow-md">
                <span className="font-mono text-base font-black tracking-wider">
                  MEJA {formattedTableNumber}
                </span>
              </div>

              {/* QR Container with Corner Finder Accents */}
              <div className="relative z-10 mx-auto mb-3 inline-block rounded-2xl border-2 border-[#d5ded9] bg-white p-3 shadow-md">
                {/* Corner accents */}
                <span className="absolute top-1.5 left-1.5 h-3.5 w-3.5 rounded-tl-xs border-t-[2.5px] border-l-[2.5px] border-[#0b3d2e]" />
                <span className="absolute top-1.5 right-1.5 h-3.5 w-3.5 rounded-tr-xs border-t-[2.5px] border-r-[2.5px] border-[#0b3d2e]" />
                <span className="absolute bottom-1.5 left-1.5 h-3.5 w-3.5 rounded-bl-xs border-b-[2.5px] border-l-[2.5px] border-[#0b3d2e]" />
                <span className="absolute bottom-1.5 right-1.5 h-3.5 w-3.5 rounded-br-xs border-b-[2.5px] border-r-[2.5px] border-[#0b3d2e]" />

                <QrCodeComponent
                  value={targetUrl}
                  size={180}
                  colorDark="#0b3d2e"
                  centerLogoUrl="/logo-mochi.png"
                  label={`QR Meja ${formattedTableNumber}`}
                />
              </div>

              {/* Scan Pill */}
              <div className="relative z-10 mb-3 inline-flex items-center gap-1.5 rounded-full border border-[#bce0d2] bg-[#edf8f3] px-3.5 py-1 text-[9.5px] font-black uppercase tracking-wider text-[#0b3d2e]">
                <span>📷 Scan dengan Kamera HP</span>
              </div>

              {/* 3 Step Instruction Box */}
              <div className="relative z-10 mb-3 grid grid-cols-3 gap-1 rounded-xl border border-[#d8e5df] bg-[#f6faf8] p-2 text-[8.5px]">
                <div className="flex flex-col items-center text-center">
                  <span className="text-sm">📷</span>
                  <span className="font-extrabold text-[#0b3d2e] mt-0.5">1. Buka Kamera</span>
                  <span className="text-[7.5px] text-[#5b7569]">iPhone / Android</span>
                </div>
                <div className="flex flex-col items-center text-center border-x border-[#dce8e2] px-0.5">
                  <span className="text-sm">📲</span>
                  <span className="font-extrabold text-[#0b3d2e] mt-0.5">2. Arahkan QR</span>
                  <span className="text-[7.5px] text-[#5b7569]">Pilih menu lezat</span>
                </div>
                <div className="flex flex-col items-center text-center">
                  <span className="text-sm">🍽️</span>
                  <span className="font-extrabold text-[#0b3d2e] mt-0.5">3. Pesan &amp; Santap</span>
                  <span className="text-[7.5px] text-[#5b7569]">Diantar ke meja</span>
                </div>
              </div>

              <div className="relative z-10 text-[9px] font-bold text-[#125740]">
                ✨ Kumpulkan Poin Member di Setiap Pemesanan! ✨
              </div>

              <p className="relative z-10 mt-1 text-[8px] font-semibold uppercase tracking-wider text-[#799086]">
                Pesanan otomatis masuk ke Kasir &amp; Dapur · KAEL POS
              </p>
            </div>
          </div>

          {/* 3. Tombol Aksi */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-2 border-t border-[#e2ebe6]">
            {/* Tombol Print Standee */}
            <button
              type="button"
              onClick={handlePrintStandee}
              className="flex items-center justify-center gap-2 rounded-2xl bg-[#0b3d2e] px-4 py-3 text-xs font-black text-[#c8f53a] shadow-md hover:bg-[#124634] active:scale-95 transition-all"
            >
              <Printer size={15} />
              <span>Cetak Standee Meja</span>
            </button>

            {/* Tombol Download PNG */}
            <button
              type="button"
              onClick={handleDownloadPng}
              disabled={isDownloading}
              className="flex items-center justify-center gap-2 rounded-2xl border-2 border-[#0b3d2e] bg-white px-4 py-3 text-xs font-black text-[#0b3d2e] shadow-xs hover:bg-[#edf8f3] active:scale-95 transition-all disabled:opacity-50"
            >
              <Download size={15} />
              <span>{isDownloading ? "Menyiapkan PNG..." : "Download Gambar (PNG)"}</span>
            </button>

            {/* Tombol Salin Link */}
            <button
              type="button"
              onClick={handleCopyLink}
              className="flex items-center justify-center gap-1.5 rounded-2xl border border-[#d8e3de] bg-[#f8faf9] px-3 py-2.5 text-xs font-bold text-[#1c2d26] hover:bg-[#edf8f3] active:scale-95 transition-all"
            >
              {copied ? <Check size={14} className="text-[#167052]" /> : <Copy size={14} />}
              <span>{copied ? "Link Tersalin!" : "Salin Link Meja"}</span>
            </button>

            {/* Tombol Buka Menu */}
            <a
              href={targetUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-1.5 rounded-2xl border border-[#d8e3de] bg-white px-3 py-2.5 text-xs font-bold text-[#556b62] hover:text-[#0b3d2e] hover:bg-[#f8faf9] transition-colors"
            >
              <span>Tes Buka Menu</span>
              <ExternalLink size={13} />
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
