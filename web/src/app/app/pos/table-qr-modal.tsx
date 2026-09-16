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

  // ===========================================================================
  // 1. GENERATOR PNG KANVAS 1:1 SQUARE (1800 x 1800 PX ULTRA-HD ANTI-GEPENG)
  // ===========================================================================
  const handleDownloadPng = () => {
    setIsDownloading(true);
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d", { willReadFrequently: false });
    if (!ctx) {
      setIsDownloading(false);
      return;
    }

    // Exact 1:1 Ultra-HD 300-DPI Square Resolution
    const size = 1800;
    canvas.width = size;
    canvas.height = size;

    // Smooth vector-like anti-aliasing
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";

    // 1. Background Fill: Luxury Ivory to Pale Mint Gradient
    const bgGrad = ctx.createLinearGradient(0, 0, 0, size);
    bgGrad.addColorStop(0, "#ffffff");
    bgGrad.addColorStop(0.5, "#fbfcfa");
    bgGrad.addColorStop(1, "#f2f7f4");
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, size, size);

    // 2. Luxury Square Borders
    // Outer Deep Forest Emerald Border
    ctx.strokeStyle = "#072e22";
    ctx.lineWidth = 24;
    ctx.beginPath();
    ctx.roundRect(40, 40, size - 80, size - 80, 56);
    ctx.stroke();

    // Inner Lime Accent Hairline
    ctx.strokeStyle = "#c8f53a";
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.roundRect(58, 58, size - 116, size - 116, 44);
    ctx.stroke();

    // Fine Dashed Registration Line
    ctx.strokeStyle = "rgba(7, 46, 34, 0.25)";
    ctx.lineWidth = 2.5;
    ctx.setLineDash([14, 10]);
    ctx.beginPath();
    ctx.roundRect(74, 74, size - 148, size - 148, 34);
    ctx.stroke();
    ctx.setLineDash([]);

    // Corner registration dots
    ctx.fillStyle = "#072e22";
    const dotR = 5;
    const corners = [
      [96, 96],
      [size - 96, 96],
      [96, size - 96],
      [size - 96, size - 96],
    ];
    for (const [cx, cy] of corners) {
      ctx.beginPath();
      ctx.arc(cx, cy, dotR, 0, Math.PI * 2);
      ctx.fill();
    }

    const logoImg = new Image();
    logoImg.crossOrigin = "anonymous";
    logoImg.src = "/logo-mochi.png";

    const renderCanvasContent = () => {
      // 1. Top Logo (Crisp & Balanced)
      const logoW = 280;
      const logoH = 115;
      const logoX = (size - logoW) / 2;
      const logoY = 95;
      if (logoImg.naturalWidth > 0) {
        ctx.drawImage(logoImg, logoX, logoY, logoW, logoH);
      }

      // 2. Store Title & Tagline
      ctx.fillStyle = "#072e22";
      ctx.font = "900 42px -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
      ctx.textAlign = "center";
      ctx.fillText((storeName || "MOCHI CAFE N RESTO").toUpperCase(), size / 2, 250);

      ctx.fillStyle = "#4a6b5e";
      ctx.font = "bold 20px -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
      ctx.fillText("BUKU MENU DIGITAL · SELF-SERVICE DINING", size / 2, 288);

      // 3. Central Table Badge (Dark Emerald & Lime Glow)
      const tableBadgeW = 540;
      const tableBadgeH = 92;
      const tableBadgeX = (size - tableBadgeW) / 2;
      const tableBadgeY = 325;

      ctx.fillStyle = "#072e22";
      ctx.beginPath();
      ctx.roundRect(tableBadgeX, tableBadgeY, tableBadgeW, tableBadgeH, 26);
      ctx.fill();

      // Neon Lime Inner Border on Badge
      ctx.strokeStyle = "#c8f53a";
      ctx.lineWidth = 3.5;
      ctx.stroke();

      ctx.fillStyle = "#c8f53a";
      ctx.font = "900 46px monospace";
      ctx.fillText(`MEJA ${formattedTableNumber}`, size / 2, tableBadgeY + 63);

      // 4. QR Code Container & Exact Square Matrix
      const qr = qrcode(0, "H");
      qr.addData(targetUrl, "Byte");
      qr.make();
      const n = qr.getModuleCount();
      const qrBoxSize = 560;
      const qrX = (size - qrBoxSize) / 2;
      const qrY = 450;

      // QR White Card Background with Soft Border
      const cardPadding = 26;
      ctx.fillStyle = "#ffffff";
      ctx.beginPath();
      ctx.roundRect(
        qrX - cardPadding,
        qrY - cardPadding,
        qrBoxSize + cardPadding * 2,
        qrBoxSize + cardPadding * 2,
        34,
      );
      ctx.fill();
      ctx.strokeStyle = "#d4e2dc";
      ctx.lineWidth = 2.5;
      ctx.stroke();

      // Corner Viewfinder Precision Brackets
      const cornerLen = 34;
      ctx.strokeStyle = "#072e22";
      ctx.lineWidth = 6;
      ctx.lineCap = "round";

      // Top Left
      ctx.beginPath();
      ctx.moveTo(qrX - 14, qrY - 14 + cornerLen);
      ctx.lineTo(qrX - 14, qrY - 14);
      ctx.lineTo(qrX - 14 + cornerLen, qrY - 14);
      ctx.stroke();

      // Top Right
      ctx.beginPath();
      ctx.moveTo(qrX + qrBoxSize + 14 - cornerLen, qrY - 14);
      ctx.lineTo(qrX + qrBoxSize + 14, qrY - 14);
      ctx.lineTo(qrX + qrBoxSize + 14, qrY - 14 + cornerLen);
      ctx.stroke();

      // Bottom Left
      ctx.beginPath();
      ctx.moveTo(qrX - 14, qrY + qrBoxSize + 14 - cornerLen);
      ctx.lineTo(qrX - 14, qrY + qrBoxSize + 14);
      ctx.lineTo(qrX - 14 + cornerLen, qrY + qrBoxSize + 14);
      ctx.stroke();

      // Bottom Right
      ctx.beginPath();
      ctx.moveTo(qrX + qrBoxSize + 14 - cornerLen, qrY + qrBoxSize + 14);
      ctx.lineTo(qrX + qrBoxSize + 14, qrY + qrBoxSize + 14);
      ctx.lineTo(qrX + qrBoxSize + 14, qrY + qrBoxSize + 14 - cornerLen);
      ctx.stroke();
      ctx.lineCap = "butt";

      // Draw Exact 1:1 Pixel-Perfect QR Code Matrix
      const cellSize = qrBoxSize / n;
      ctx.fillStyle = "#072e22";
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

      // Center Logo Badge on QR (Circular Squircle)
      const centerBadgeSize = 124;
      const cbX = (size - centerBadgeSize) / 2;
      const cbY = qrY + (qrBoxSize - centerBadgeSize) / 2;

      ctx.save();
      ctx.beginPath();
      ctx.arc(
        size / 2,
        cbY + centerBadgeSize / 2,
        centerBadgeSize / 2 + 4,
        0,
        Math.PI * 2,
      );
      ctx.fillStyle = "#ffffff";
      ctx.fill();
      ctx.strokeStyle = "#072e22";
      ctx.lineWidth = 4;
      ctx.stroke();
      ctx.clip();
      if (logoImg.naturalWidth > 0) {
        ctx.drawImage(logoImg, cbX, cbY, centerBadgeSize, centerBadgeSize);
      }
      ctx.restore();

      // 5. Instruction Scan Pill
      const pillW = 580;
      const pillH = 64;
      const pillX = (size - pillW) / 2;
      const pillY = 1100;

      ctx.fillStyle = "#edf8f3";
      ctx.beginPath();
      ctx.roundRect(pillX, pillY, pillW, pillH, 32);
      ctx.fill();
      ctx.strokeStyle = "#a3d4c0";
      ctx.lineWidth = 2.5;
      ctx.stroke();

      ctx.fillStyle = "#072e22";
      ctx.font = "900 23px -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
      ctx.fillText("📷 SCAN DENGAN KAMERA HP / WA", size / 2, pillY + 41);

      // 6. 3 Steps Instruction Cards Box (Balanced Grid)
      const stepsW = 1440;
      const stepsH = 190;
      const stepsX = (size - stepsW) / 2;
      const stepsY = 1195;

      ctx.fillStyle = "#f6faf8";
      ctx.beginPath();
      ctx.roundRect(stepsX, stepsY, stepsW, stepsH, 28);
      ctx.fill();
      ctx.strokeStyle = "#d4e4dc";
      ctx.lineWidth = 2.5;
      ctx.stroke();

      // Step 1
      ctx.font = "36px -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
      ctx.fillText("📷", stepsX + stepsW * 0.17, stepsY + 62);
      ctx.fillStyle = "#072e22";
      ctx.font = "900 24px -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
      ctx.fillText("1. Buka Kamera", stepsX + stepsW * 0.17, stepsY + 106);
      ctx.fillStyle = "#557266";
      ctx.font = "17px -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
      ctx.fillText("iPhone / Android / WA", stepsX + stepsW * 0.17, stepsY + 144);

      // Separator 1
      ctx.strokeStyle = "#dce8e2";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(stepsX + stepsW * 0.34, stepsY + 30);
      ctx.lineTo(stepsX + stepsW * 0.34, stepsY + stepsH - 30);
      ctx.stroke();

      // Step 2
      ctx.font = "36px -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
      ctx.fillText("📲", stepsX + stepsW * 0.5, stepsY + 62);
      ctx.fillStyle = "#072e22";
      ctx.font = "900 24px -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
      ctx.fillText("2. Arahkan QR", stepsX + stepsW * 0.5, stepsY + 106);
      ctx.fillStyle = "#557266";
      ctx.font = "17px -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
      ctx.fillText("Buka menu & pilih sajian", stepsX + stepsW * 0.5, stepsY + 144);

      // Separator 2
      ctx.beginPath();
      ctx.moveTo(stepsX + stepsW * 0.66, stepsY + 30);
      ctx.lineTo(stepsX + stepsW * 0.66, stepsY + stepsH - 30);
      ctx.stroke();

      // Step 3
      ctx.font = "36px -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
      ctx.fillText("🍽️", stepsX + stepsW * 0.83, stepsY + 62);
      ctx.fillStyle = "#072e22";
      ctx.font = "900 24px -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
      ctx.fillText("3. Pesan & Santap", stepsX + stepsW * 0.83, stepsY + 106);
      ctx.fillStyle = "#557266";
      ctx.font = "17px -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
      ctx.fillText("Diantar langsung ke meja", stepsX + stepsW * 0.83, stepsY + 144);

      // 7. Footer Member & Assurance
      ctx.fillStyle = "#125740";
      ctx.font = "bold 23px -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
      ctx.fillText("✨ Kumpulkan Poin Member di Setiap Pemesanan! ✨", size / 2, 1445);

      ctx.fillStyle = "#71897f";
      ctx.font = "bold 17px -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
      ctx.fillText(
        "PESANAN OTOMATIS TERHUBUNG KE KASIR & DAPUR · KAEL POS",
        size / 2,
        1490,
      );

      ctx.fillStyle = "#9db2a8";
      ctx.font = "13.5px -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
      ctx.fillText("Buku Menu Digital Meja · Self-Service Dining", size / 2, 1525);

      const link = document.createElement("a");
      link.download = `Standee-Meja-${formattedTableNumber}-MochiCafe-1x1.png`;
      link.href = canvas.toDataURL("image/png");
      link.click();
      setIsDownloading(false);
    };

    let hasRendered = false;
    const doRender = () => {
      if (hasRendered) return;
      hasRendered = true;
      renderCanvasContent();
    };

    logoImg.onload = doRender;
    logoImg.onerror = doRender;
    if (logoImg.complete) {
      doRender();
    } else {
      // Fallback timeout in case image loading is blocked or stalls
      setTimeout(doRender, 300);
    }
  };

  // ===========================================================================
  // 2. CETAK STANDEE MEJA 1:1 SQUARE
  // ===========================================================================
  const handlePrintStandee = () => {
    const printWindow = window.open("", "_blank", "width=800,height=800");
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
    const qrSvg = `<svg viewBox="${-m} ${-m} ${total} ${total}" width="220" height="220" shape-rendering="crispEdges"><rect x="${-m}" y="${-m}" width="${total}" height="${total}" fill="#ffffff"/><path d="${pathD}" fill="#072e22"/></svg>`;

    const htmlContent = `
      <!DOCTYPE html>
      <html lang="id">
      <head>
        <meta charset="utf-8" />
        <title>Standee QR Meja ${formattedTableNumber} (1x1) - ${storeName}</title>
        <style>
          @page {
            size: 160mm 160mm;
            margin: 5mm;
          }
          * {
            box-sizing: border-box;
            margin: 0;
            padding: 0;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          body {
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Plus Jakarta Sans", sans-serif;
            background-color: #ffffff;
            color: #072e22;
            display: flex;
            align-items: center;
            justify-content: center;
            min-height: 100vh;
            padding: 0;
          }
          .standee-card {
            width: 100%;
            max-width: 520px;
            aspect-ratio: 1 / 1;
            border: 6px solid #072e22;
            border-radius: 38px;
            padding: 24px 20px;
            text-align: center;
            background: linear-gradient(180deg, #ffffff 0%, #fbfcfa 50%, #f2f7f4 100%);
            position: relative;
            box-shadow: 0 8px 32px rgba(7, 46, 34, 0.1);
            overflow: hidden;
            display: flex;
            flex-direction: column;
            justify-content: space-between;
          }
          .inner-accent {
            position: absolute;
            inset: 6px;
            border: 2px solid #c8f53a;
            border-radius: 32px;
            pointer-events: none;
          }
          .inner-border {
            position: absolute;
            inset: 12px;
            border: 1.5px dashed rgba(7, 46, 34, 0.25);
            border-radius: 26px;
            pointer-events: none;
          }
          .brand-logo-wrap {
            display: flex;
            justify-content: center;
            margin-bottom: 4px;
            position: relative;
            z-index: 2;
          }
          .brand-logo-wrap img {
            height: 48px;
            width: auto;
            max-width: 180px;
            object-fit: contain;
          }
          .store-title {
            font-size: 18px;
            font-weight: 900;
            color: #072e22;
            letter-spacing: 0.5px;
            text-transform: uppercase;
            margin-bottom: 2px;
            position: relative;
            z-index: 2;
          }
          .store-subtitle {
            font-size: 9.5px;
            color: #4a6b5e;
            font-weight: 800;
            letter-spacing: 0.5px;
            text-transform: uppercase;
            margin-bottom: 8px;
            position: relative;
            z-index: 2;
          }
          .table-banner {
            display: inline-flex;
            align-items: center;
            justify-content: center;
            background: #072e22;
            color: #c8f53a;
            border: 2px solid #c8f53a;
            padding: 6px 28px;
            border-radius: 14px;
            margin-bottom: 8px;
            box-shadow: 0 4px 16px rgba(7, 46, 34, 0.2);
            position: relative;
            z-index: 2;
          }
          .table-banner-no {
            font-size: 18px;
            font-weight: 900;
            font-family: ui-monospace, SFMono-Regular, monospace;
            letter-spacing: 1.5px;
            color: #c8f53a;
          }
          .qr-frame {
            position: relative;
            display: inline-block;
            background: #ffffff;
            padding: 12px;
            border-radius: 22px;
            border: 2px solid #d4e2dc;
            box-shadow: 0 4px 16px rgba(7, 46, 34, 0.08);
            margin-bottom: 8px;
            z-index: 2;
          }
          .qr-frame .corner {
            position: absolute;
            width: 14px;
            height: 14px;
            border-color: #072e22;
            border-style: solid;
          }
          .qr-frame .tl { top: 4px; left: 4px; border-width: 3px 0 0 3px; border-top-left-radius: 6px; }
          .qr-frame .tr { top: 4px; right: 4px; border-width: 3px 3px 0 0; border-top-right-radius: 6px; }
          .qr-frame .bl { bottom: 4px; left: 4px; border-width: 0 0 3px 3px; border-bottom-left-radius: 6px; }
          .qr-frame .br { bottom: 4px; right: 4px; border-width: 0 3px 3px 0; border-bottom-right-radius: 6px; }

          .qr-box {
            position: relative;
            display: inline-block;
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
            border: 2.5px solid #072e22;
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 3px;
            box-shadow: 0 2px 8px rgba(0,0,0,0.15);
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
            color: #072e22;
            border: 1.5px solid #a3d4c0;
            padding: 5px 18px;
            border-radius: 20px;
            font-size: 10px;
            font-weight: 900;
            letter-spacing: 0.5px;
            margin-bottom: 8px;
            position: relative;
            z-index: 2;
          }
          .steps-container {
            display: grid;
            grid-template-columns: repeat(3, 1fr);
            background: #f6faf8;
            border: 1.5px solid #d4e4dc;
            border-radius: 16px;
            padding: 8px 6px;
            margin-bottom: 6px;
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
            color: #072e22;
            line-height: 1.1;
          }
          .step-desc {
            font-size: 7.5px;
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
            margin-bottom: 3px;
            position: relative;
            z-index: 2;
          }
          .footer-note {
            font-size: 8px;
            color: #71897f;
            font-weight: 700;
            text-transform: uppercase;
            letter-spacing: 0.5px;
            position: relative;
            z-index: 2;
          }
        </style>
      </head>
      <body>
        <div class="standee-card">
          <div class="inner-accent"></div>
          <div class="inner-border"></div>

          <div>
            <!-- Top Brand Logo -->
            <div class="brand-logo-wrap">
              <img src="${logoSrc}" alt="Mochi Logo" />
            </div>

            <h1 class="store-title">${storeName}</h1>
            <p class="store-subtitle">Buku Menu Digital · Self-Service Dining</p>
            
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

            <div>
              <div class="scan-pill">
                📷 SCAN DENGAN KAMERA HP / WA
              </div>
            </div>

            <!-- 3 Easy Steps -->
            <div class="steps-container">
              <div class="step-item">
                <span class="step-icon">📷</span>
                <span class="step-title">1. Buka Kamera</span>
                <span class="step-desc">iPhone / Android / WA</span>
              </div>
              <div class="step-item">
                <span class="step-icon">📲</span>
                <span class="step-title">2. Arahkan QR</span>
                <span class="step-desc">Buka menu &amp; pilih sajian</span>
              </div>
              <div class="step-item">
                <span class="step-icon">🍽️</span>
                <span class="step-title">3. Pesan &amp; Santap</span>
                <span class="step-desc">Diantar ke meja</span>
              </div>
            </div>
          </div>

          <div>
            <div class="promo-badge">
              ✨ Kumpulkan Poin Member di Setiap Pemesanan! ✨
            </div>
            <p class="footer-note">Pesanan otomatis masuk ke Kasir &amp; Dapur · KAEL POS</p>
          </div>
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
      <div className="w-full max-w-xl rounded-3xl bg-white text-[#1c2d26] shadow-2xl overflow-hidden flex flex-col my-auto animate-in zoom-in-95 border border-[#d8e3de]">
        {/* Header Modal */}
        <div className="flex items-center justify-between border-b border-[#e2ebe6] bg-[#0b3d2e] px-5 py-4 text-white">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#c8f53a] text-[#073829] shadow-xs">
              <QrCodeIcon size={19} strokeWidth={2.4} />
            </div>
            <div>
              <h2 className="text-sm sm:text-base font-black tracking-tight">
                Generator Standee QR Meja (Format 1:1 Presisi)
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

        <div className="p-4 sm:p-6 space-y-5 overflow-y-auto max-h-[82vh]">
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

          {/* 2. Pratinjau Standee Meja Akrilik Eksklusif 1:1 SQUARE */}
          <div className="space-y-2">
            <span className="text-xs font-black text-[#0b3d2e] uppercase tracking-wider flex items-center gap-1.5">
              <Sparkles size={13} />
              <span>Pratinjau Standee Meja Presisi 1:1 Square (Anti-Gepeng)</span>
            </span>

            <div className="aspect-square w-full max-w-[380px] sm:max-w-[420px] mx-auto rounded-[34px] border-[5px] border-[#072e22] bg-gradient-to-b from-white via-[#fbfcfa] to-[#f2f7f4] p-4 sm:p-5 text-center shadow-2xl relative overflow-hidden flex flex-col justify-between">
              {/* Inner accent lime line */}
              <div className="pointer-events-none absolute inset-1.5 rounded-[28px] border-[1.5px] border-[#c8f53a]" />
              {/* Inner dashed line */}
              <div className="pointer-events-none absolute inset-3 rounded-[22px] border border-dashed border-[#072e22]/20" />

              <div>
                {/* Logo Header (Borderless, Prominent) */}
                <div className="relative z-10 flex justify-center mb-0.5">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src="/logo-mochi.png"
                    alt="Mochi Cafe Logo"
                    className="h-10 sm:h-12 w-auto max-w-[150px] object-contain mx-auto"
                  />
                </div>

                {/* Nama Kafe */}
                <h3 className="relative z-10 text-xs sm:text-sm font-black uppercase tracking-tight text-[#072e22]">
                  {storeName || "Mochi Cafe n Resto"}
                </h3>
                <p className="relative z-10 text-[8px] sm:text-[8.5px] font-extrabold uppercase tracking-wider text-[#4a6b5e] mb-1.5">
                  Buku Menu Digital · Self-Service Dining
                </p>

                {/* Nomor Meja Banner */}
                <div className="relative z-10 mb-2 inline-flex items-center justify-center rounded-xl bg-[#072e22] px-4 py-1 text-[#c8f53a] border-[1.5px] border-[#c8f53a] shadow-xs">
                  <span className="font-mono text-xs sm:text-sm font-black tracking-wider">
                    MEJA {formattedTableNumber}
                  </span>
                </div>

                {/* QR Container with Corner Finder Accents */}
                <div className="relative z-10 mx-auto mb-1.5 inline-block rounded-2xl border border-[#d4e2dc] bg-white p-2.5 shadow-sm">
                  {/* Corner accents */}
                  <span className="absolute top-1 left-1 h-3 w-3 rounded-tl-xs border-t-[2.5px] border-l-[2.5px] border-[#072e22]" />
                  <span className="absolute top-1 right-1 h-3 w-3 rounded-tr-xs border-t-[2.5px] border-r-[2.5px] border-[#072e22]" />
                  <span className="absolute bottom-1 left-1 h-3 w-3 rounded-bl-xs border-b-[2.5px] border-l-[2.5px] border-[#072e22]" />
                  <span className="absolute bottom-1 right-1 h-3 w-3 rounded-br-xs border-b-[2.5px] border-r-[2.5px] border-[#072e22]" />

                  <QrCodeComponent
                    value={targetUrl}
                    size={140}
                    colorDark="#072e22"
                    centerLogoUrl="/logo-mochi.png"
                    label={`QR Meja ${formattedTableNumber}`}
                  />
                </div>

                {/* Scan Pill */}
                <div>
                  <div className="relative z-10 mb-1.5 inline-flex items-center gap-1 rounded-full border border-[#a3d4c0] bg-[#edf8f3] px-3 py-0.5 text-[8.5px] sm:text-[9px] font-black uppercase tracking-wider text-[#072e22]">
                    <span>📷 Scan dengan Kamera HP / WA</span>
                  </div>
                </div>

                {/* 3 Step Instruction Box */}
                <div className="relative z-10 mb-1.5 grid grid-cols-3 gap-0.5 rounded-xl border border-[#d4e4dc] bg-[#f6faf8] p-1.5 text-[7.5px] sm:text-[8px]">
                  <div className="flex flex-col items-center text-center">
                    <span className="text-xs">📷</span>
                    <span className="font-extrabold text-[#072e22] mt-0.5">1. Buka Kamera</span>
                    <span className="text-[6.5px] text-[#557266]">iPhone / Android / WA</span>
                  </div>
                  <div className="flex flex-col items-center text-center border-x border-[#dce8e2] px-0.5">
                    <span className="text-xs">📲</span>
                    <span className="font-extrabold text-[#072e22] mt-0.5">2. Arahkan QR</span>
                    <span className="text-[6.5px] text-[#557266]">Buka menu &amp; pesan</span>
                  </div>
                  <div className="flex flex-col items-center text-center">
                    <span className="text-xs">🍽️</span>
                    <span className="font-extrabold text-[#072e22] mt-0.5">3. Pesan &amp; Santap</span>
                    <span className="text-[6.5px] text-[#557266]">Diantar ke meja</span>
                  </div>
                </div>
              </div>

              <div>
                <div className="relative z-10 text-[8.5px] sm:text-[9px] font-extrabold text-[#125740]">
                  ✨ Kumpulkan Poin Member di Setiap Pemesanan! ✨
                </div>

                <p className="relative z-10 mt-0.5 text-[7.5px] font-bold uppercase tracking-wider text-[#71897f]">
                  Pesanan otomatis masuk ke Kasir &amp; Dapur · KAEL POS
                </p>
              </div>
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
              <span>Cetak Standee Meja (1x1)</span>
            </button>

            {/* Tombol Download PNG 1:1 */}
            <button
              type="button"
              onClick={handleDownloadPng}
              disabled={isDownloading}
              className="flex items-center justify-center gap-2 rounded-2xl border-2 border-[#0b3d2e] bg-white px-4 py-3 text-xs font-black text-[#0b3d2e] shadow-xs hover:bg-[#edf8f3] active:scale-95 transition-all disabled:opacity-50"
            >
              <Download size={15} />
              <span>{isDownloading ? "Menyiapkan PNG..." : "Download PNG Presisi 1x1"}</span>
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
