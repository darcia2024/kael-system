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

    // High resolution A6 format
    const w = 720;
    const h = 1040;
    canvas.width = w;
    canvas.height = h;

    // Background Pure White
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, w, h);

    // Outer Forest Emerald Border
    ctx.strokeStyle = "#0b3d2e";
    ctx.lineWidth = 10;
    ctx.beginPath();
    ctx.roundRect(18, 18, w - 36, h - 36, 32);
    ctx.stroke();

    // Inner Dashed Line
    ctx.strokeStyle = "rgba(11, 61, 46, 0.28)";
    ctx.lineWidth = 2;
    ctx.setLineDash([8, 6]);
    ctx.beginPath();
    ctx.roundRect(30, 30, w - 60, h - 60, 24);
    ctx.stroke();
    ctx.setLineDash([]);

    const logoImg = new Image();
    logoImg.crossOrigin = "anonymous";
    logoImg.src = "/logo-mochi.png";

    const renderCanvasContent = () => {
      // 1. Top Logo Emblem
      const logoSize = 100;
      const logoX = (w - logoSize) / 2;
      const logoY = 56;

      ctx.save();
      ctx.beginPath();
      ctx.arc(w / 2, logoY + logoSize / 2, logoSize / 2 + 4, 0, Math.PI * 2);
      ctx.fillStyle = "#ffffff";
      ctx.fill();
      ctx.strokeStyle = "#0b3d2e";
      ctx.lineWidth = 4;
      ctx.stroke();
      ctx.clip();
      ctx.drawImage(logoImg, logoX, logoY, logoSize, logoSize);
      ctx.restore();

      // 2. Store Title & Subtitle
      ctx.fillStyle = "#0b3d2e";
      ctx.font = "900 30px -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
      ctx.textAlign = "center";
      ctx.fillText((storeName || "MOCHI CAFE N RESTO").toUpperCase(), w / 2, 202);

      ctx.fillStyle = "#3b5f52";
      ctx.font = "bold 15px -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
      ctx.fillText("Buku Menu Digital · Pesan Langsung Tanpa Antre", w / 2, 230);

      // 3. Table Banner Pill
      const bannerW = 320;
      const bannerH = 58;
      const bannerX = (w - bannerW) / 2;
      const bannerY = 256;

      ctx.fillStyle = "#0b3d2e";
      ctx.beginPath();
      ctx.roundRect(bannerX, bannerY, bannerW, bannerH, 18);
      ctx.fill();

      ctx.fillStyle = "#c8f53a";
      ctx.font = "900 28px monospace";
      ctx.fillText(`MEJA ${activeTable.toUpperCase()}`, w / 2, bannerY + 39);

      // 4. QR Code
      const qr = qrcode(0, "H");
      qr.addData(targetUrl, "Byte");
      qr.make();
      const n = qr.getModuleCount();
      const qrBoxSize = 340;
      const qrX = (w - qrBoxSize) / 2;
      const qrY = 340;
      const cellSize = qrBoxSize / n;

      ctx.fillStyle = "#ffffff";
      ctx.beginPath();
      ctx.roundRect(qrX - 18, qrY - 18, qrBoxSize + 36, qrBoxSize + 36, 20);
      ctx.fill();
      ctx.strokeStyle = "#dbe6e0";
      ctx.lineWidth = 1.5;
      ctx.stroke();

      // Corner Accents
      const cornerSize = 16;
      ctx.strokeStyle = "#0b3d2e";
      ctx.lineWidth = 3.5;
      ctx.beginPath();
      ctx.moveTo(qrX - 12, qrY - 12 + cornerSize); ctx.lineTo(qrX - 12, qrY - 12); ctx.lineTo(qrX - 12 + cornerSize, qrY - 12); ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(qrX + qrBoxSize + 12 - cornerSize, qrY - 12); ctx.lineTo(qrX + qrBoxSize + 12, qrY - 12); ctx.lineTo(qrX + qrBoxSize + 12, qrY - 12 + cornerSize); ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(qrX - 12, qrY + qrBoxSize + 12 - cornerSize); ctx.lineTo(qrX - 12, qrY + qrBoxSize + 12); ctx.lineTo(qrX - 12 + cornerSize, qrY + qrBoxSize + 12); ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(qrX + qrBoxSize + 12 - cornerSize, qrY + qrBoxSize + 12); ctx.lineTo(qrX + qrBoxSize + 12, qrY + qrBoxSize + 12); ctx.lineTo(qrX + qrBoxSize + 12, qrY + qrBoxSize + 12 - cornerSize); ctx.stroke();

      ctx.fillStyle = "#0b3d2e";
      for (let r = 0; r < n; r++) {
        for (let c = 0; c < n; c++) {
          if (qr.isDark(r, c)) {
            ctx.fillRect(qrX + c * cellSize, qrY + r * cellSize, cellSize + 0.4, cellSize + 0.4);
          }
        }
      }

      // Center Logo Emblem on QR
      const centerEmblemSize = 78;
      const ceX = (w - centerEmblemSize) / 2;
      const ceY = qrY + (qrBoxSize - centerEmblemSize) / 2;

      ctx.save();
      ctx.beginPath();
      ctx.arc(w / 2, ceY + centerEmblemSize / 2, centerEmblemSize / 2, 0, Math.PI * 2);
      ctx.fillStyle = "#ffffff";
      ctx.fill();
      ctx.strokeStyle = "#0b3d2e";
      ctx.lineWidth = 3;
      ctx.stroke();
      ctx.clip();
      ctx.drawImage(logoImg, ceX, ceY, centerEmblemSize, centerEmblemSize);
      ctx.restore();

      // 5. Scan Pill
      const pillW = 340;
      const pillH = 40;
      const pillX = (w - pillW) / 2;
      const pillY = 722;

      ctx.fillStyle = "#edf8f3";
      ctx.beginPath();
      ctx.roundRect(pillX, pillY, pillW, pillH, 20);
      ctx.fill();
      ctx.strokeStyle = "#b5ded0";
      ctx.lineWidth = 1.5;
      ctx.stroke();

      ctx.fillStyle = "#0b3d2e";
      ctx.font = "900 14px -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
      ctx.fillText("📷 SCAN DENGAN KAMERA HP", w / 2, pillY + 25);

      // 6. 3-Steps Instruction Box
      const instW = w - 90;
      const instH = 120;
      const instX = 45;
      const instY = 780;

      ctx.fillStyle = "#f4f8f6";
      ctx.beginPath();
      ctx.roundRect(instX, instY, instW, instH, 18);
      ctx.fill();
      ctx.strokeStyle = "#d8e5df";
      ctx.lineWidth = 1.5;
      ctx.stroke();

      ctx.fillStyle = "#0b3d2e";
      ctx.font = "900 16px -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
      ctx.fillText("1. Buka Kamera", instX + instW * 0.18, instY + 50);
      ctx.fillStyle = "#557266";
      ctx.font = "12px -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
      ctx.fillText("iPhone / Android", instX + instW * 0.18, instY + 76);

      ctx.strokeStyle = "#dce8e2";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(instX + instW * 0.35, instY + 20);
      ctx.lineTo(instX + instW * 0.35, instY + instH - 20);
      ctx.stroke();

      ctx.fillStyle = "#0b3d2e";
      ctx.font = "900 16px -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
      ctx.fillText("2. Arahkan QR", instX + instW * 0.51, instY + 50);
      ctx.fillStyle = "#557266";
      ctx.font = "12px -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
      ctx.fillText("Ke kode di atas", instX + instW * 0.51, instY + 76);

      ctx.beginPath();
      ctx.moveTo(instX + instW * 0.67, instY + 20);
      ctx.lineTo(instX + instW * 0.67, instY + instH - 20);
      ctx.stroke();

      ctx.fillStyle = "#0b3d2e";
      ctx.font = "900 16px -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
      ctx.fillText("3. Pilih & Pesan", instX + instW * 0.83, instY + 50);
      ctx.fillStyle = "#557266";
      ctx.font = "12px -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
      ctx.fillText("Langsung diantar", instX + instW * 0.83, instY + 76);

      // 7. Promo & Footer
      ctx.fillStyle = "#125740";
      ctx.font = "bold 14px -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
      ctx.fillText("✨ Dapatkan Poin Member di Setiap Pemesanan! ✨", w / 2, 935);

      ctx.fillStyle = "#71897f";
      ctx.font = "bold 11px -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
      ctx.fillText("PESANAN OTOMATIS MASUK KE KASIR & DAPUR · KAEL POS", w / 2, 975);

      const link = document.createElement("a");
      link.download = `Standee-Meja-${activeTable}-MochiCafe.png`;
      link.href = canvas.toDataURL("image/png");
      link.click();
      setIsDownloading(false);
    };

    logoImg.onload = renderCanvasContent;
    logoImg.onerror = renderCanvasContent;
    if (logoImg.complete) renderCanvasContent();
  };

  const handlePrintStandee = () => {
    const printWindow = window.open("", "_blank", "width=720,height=980");
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
    const qrSvg = `<svg viewBox="${-m} ${-m} ${total} ${total}" width="200" height="200" shape-rendering="crispEdges"><rect x="${-m}" y="${-m}" width="${total}" height="${total}" fill="#ffffff"/><path d="${pathD}" fill="#0b3d2e"/></svg>`;

    const htmlContent = `
      <!DOCTYPE html>
      <html lang="id">
      <head>
        <meta charset="utf-8" />
        <title>Standee QR Meja ${activeTable} - ${storeName}</title>
        <style>
          @page {
            size: A6 portrait;
            margin: 6mm;
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
            max-width: 380px;
            border: 3.5px solid #0b3d2e;
            border-radius: 26px;
            padding: 22px 18px;
            text-align: center;
            background: #ffffff;
            position: relative;
            box-shadow: 0 4px 20px rgba(11, 61, 46, 0.08);
            overflow: hidden;
          }
          .inner-border {
            position: absolute;
            inset: 6px;
            border: 1px dashed rgba(11, 61, 46, 0.32);
            border-radius: 20px;
            pointer-events: none;
          }
          .brand-emblem-wrap {
            display: flex;
            justify-content: center;
            margin-bottom: 8px;
            position: relative;
            z-index: 2;
          }
          .brand-emblem {
            width: 68px;
            height: 68px;
            border-radius: 50%;
            background: #ffffff;
            border: 2.5px solid #0b3d2e;
            box-shadow: 0 4px 12px rgba(11, 61, 46, 0.15);
            padding: 5px;
            display: flex;
            align-items: center;
            justify-content: center;
          }
          .brand-emblem img {
            width: 100%;
            height: 100%;
            object-fit: contain;
            border-radius: 50%;
          }
          .store-title {
            font-size: 19px;
            font-weight: 900;
            color: #0b3d2e;
            letter-spacing: 0.5px;
            text-transform: uppercase;
            margin-bottom: 3px;
            position: relative;
            z-index: 2;
          }
          .store-subtitle {
            font-size: 10.5px;
            color: #3b5f52;
            font-weight: 700;
            margin-bottom: 12px;
            position: relative;
            z-index: 2;
          }
          .table-banner {
            display: inline-flex;
            align-items: center;
            justify-content: center;
            background: #0b3d2e;
            color: #c8f53a;
            padding: 7px 22px;
            border-radius: 14px;
            margin-bottom: 14px;
            box-shadow: 0 3px 8px rgba(11, 61, 46, 0.18);
            position: relative;
            z-index: 2;
          }
          .table-banner-no {
            font-size: 20px;
            font-weight: 900;
            font-family: ui-monospace, SFMono-Regular, monospace;
            letter-spacing: 0.5px;
            color: #c8f53a;
          }
          .qr-frame {
            position: relative;
            display: inline-block;
            background: #ffffff;
            padding: 12px;
            border-radius: 18px;
            border: 1.5px solid #d5ded9;
            box-shadow: 0 4px 14px rgba(0, 0, 0, 0.05);
            margin-bottom: 10px;
            z-index: 2;
          }
          .qr-frame .corner {
            position: absolute;
            width: 12px;
            height: 12px;
            border-color: #0b3d2e;
            border-style: solid;
          }
          .qr-frame .tl { top: 4px; left: 4px; border-width: 2.5px 0 0 2.5px; border-top-left-radius: 5px; }
          .qr-frame .tr { top: 4px; right: 4px; border-width: 2.5px 2.5px 0 0; border-top-right-radius: 5px; }
          .qr-frame .bl { bottom: 4px; left: 4px; border-width: 0 0 2.5px 2.5px; border-bottom-left-radius: 5px; }
          .qr-frame .br { bottom: 4px; right: 4px; border-width: 0 2.5px 2.5px 0; border-bottom-right-radius: 5px; }

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
            width: 44px;
            height: 44px;
            background: #ffffff;
            border-radius: 50%;
            padding: 3.5px;
            box-shadow: 0 2px 8px rgba(0,0,0,0.25);
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
            gap: 5px;
            background: #edf8f3;
            color: #0b3d2e;
            border: 1px solid #c5dfd4;
            border-radius: 999px;
            padding: 4px 14px;
            font-size: 9.5px;
            font-weight: 800;
            letter-spacing: 0.8px;
            text-transform: uppercase;
            margin-bottom: 10px;
            position: relative;
            z-index: 2;
          }
          .steps-container {
            display: grid;
            grid-template-columns: 1fr 1fr 1fr;
            gap: 4px;
            background: #f4f8f6;
            border: 1px solid #d8e5df;
            border-radius: 14px;
            padding: 8px 6px;
            margin-bottom: 10px;
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
            border-right: 1px solid #dce8e2;
          }
          .step-icon {
            font-size: 15px;
            margin-bottom: 2px;
          }
          .step-title {
            font-size: 9.5px;
            font-weight: 900;
            color: #0b3d2e;
            line-height: 1.1;
          }
          .step-desc {
            font-size: 8px;
            color: #557266;
            margin-top: 1px;
          }
          .promo-badge {
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 4px;
            font-size: 9.5px;
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

          <!-- Top Brand Emblem -->
          <div class="brand-emblem-wrap">
            <div class="brand-emblem">
              <img src="${logoSrc}" alt="Mochi Logo" />
            </div>
          </div>

          <h1 class="store-title">${storeName}</h1>
          <p class="store-subtitle">Buku Menu Digital · Pesan Langsung Tanpa Antre</p>
          
          <div>
            <div class="table-banner">
              <span class="table-banner-no">MEJA ${activeTable.toUpperCase()}</span>
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
              <span class="step-desc">Ke kode di atas</span>
            </div>
            <div class="step-item">
              <span class="step-icon">🍽️</span>
              <span class="step-title">3. Langsung Pesan</span>
              <span class="step-desc">Menu diantar ke meja</span>
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
                Generator &amp; Cetak QR Meja
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
                Aktif: <strong className="font-mono text-[#0b3d2e]">Meja {activeTable}</strong>
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
              <span>Pratinjau Standee Meja Siap Cetak (A6 Akrilik)</span>
            </span>

            <div className="rounded-[28px] border-[3px] border-[#0b3d2e] bg-[#ffffff] p-5 text-center shadow-xl relative overflow-hidden max-w-[320px] mx-auto">
              {/* Inner dashed line */}
              <div className="pointer-events-none absolute inset-1.5 rounded-[22px] border border-dashed border-[#0b3d2e]/25" />

              {/* Logo Emblem Header */}
              <div className="relative z-10 mx-auto flex h-14 w-14 items-center justify-center rounded-full border-2 border-[#0b3d2e] bg-white p-1 shadow-md mb-2">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src="/logo-mochi.png"
                  alt="Mochi Cafe Logo"
                  className="h-full w-full rounded-full object-contain"
                />
              </div>

              {/* Nama Kafe */}
              <h3 className="relative z-10 text-base font-black uppercase tracking-tight text-[#0b3d2e]">
                {storeName || "Mochi Cafe n Resto"}
              </h3>
              <p className="relative z-10 text-[9.5px] font-semibold text-[#406254] mb-2.5">
                Buku Menu Digital · Pesan Langsung Tanpa Antre
              </p>

              {/* Nomor Meja Banner */}
              <div className="relative z-10 mb-3 inline-flex items-center gap-2 rounded-xl bg-[#0b3d2e] px-4 py-1.5 text-[#c8f53a] shadow-xs">
                <span className="font-mono text-sm font-black tracking-wider">
                  MEJA {activeTable.toUpperCase()}
                </span>
              </div>

              {/* QR Container with Corner Finder Accents */}
              <div className="relative z-10 mx-auto mb-2.5 inline-block rounded-2xl border border-[#d2ddd8] bg-white p-2.5 shadow-sm">
                {/* Corner accents */}
                <span className="absolute top-1 left-1 h-3 w-3 rounded-tl-xs border-t-2 border-l-2 border-[#0b3d2e]" />
                <span className="absolute top-1 right-1 h-3 w-3 rounded-tr-xs border-t-2 border-r-2 border-[#0b3d2e]" />
                <span className="absolute bottom-1 left-1 h-3 w-3 rounded-bl-xs border-b-2 border-l-2 border-[#0b3d2e]" />
                <span className="absolute bottom-1 right-1 h-3 w-3 rounded-br-xs border-b-2 border-r-2 border-[#0b3d2e]" />

                <QrCodeComponent
                  value={targetUrl}
                  size={170}
                  colorDark="#0b3d2e"
                  centerLogoUrl="/logo-mochi.png"
                  label={`QR Meja ${activeTable}`}
                />
              </div>

              {/* Scan Pill */}
              <div className="relative z-10 mb-2.5 inline-flex items-center gap-1 rounded-full border border-[#bce0d2] bg-[#edf8f3] px-3 py-0.5 text-[9px] font-black uppercase tracking-wider text-[#0b3d2e]">
                <span>📷 Scan dengan Kamera HP</span>
              </div>

              {/* 3 Step Instruction Box */}
              <div className="relative z-10 mb-2.5 grid grid-cols-3 gap-1 rounded-xl border border-[#d8e5df] bg-[#f4f8f6] p-1.5 text-[8.5px]">
                <div className="flex flex-col items-center text-center">
                  <span className="text-xs">📷</span>
                  <span className="font-extrabold text-[#0b3d2e] mt-0.5">1. Kamera HP</span>
                  <span className="text-[7.5px] text-[#5b7569]">iPhone/Android</span>
                </div>
                <div className="flex flex-col items-center text-center border-x border-[#dce8e2] px-0.5">
                  <span className="text-xs">📲</span>
                  <span className="font-extrabold text-[#0b3d2e] mt-0.5">2. Arahkan QR</span>
                  <span className="text-[7.5px] text-[#5b7569]">Ke kode meja</span>
                </div>
                <div className="flex flex-col items-center text-center">
                  <span className="text-xs">🍽️</span>
                  <span className="font-extrabold text-[#0b3d2e] mt-0.5">3. Pilih &amp; Pesan</span>
                  <span className="text-[7.5px] text-[#5b7569]">Diantar ke meja</span>
                </div>
              </div>

              <div className="relative z-10 text-[8.5px] font-bold text-[#125740]">
                ✨ Dapatkan Poin Member di Setiap Pesanan! ✨
              </div>

              <p className="relative z-10 mt-1 text-[7.5px] font-semibold uppercase tracking-wider text-[#799086]">
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
