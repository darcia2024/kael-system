"use client";

import { useState, useMemo } from "react";
import {
  X,
  Printer,
  Copy,
  Check,
  ExternalLink,
  QrCode as QrCodeIcon,
  Coffee,
  Sparkles,
  Layers,
} from "lucide-react";
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
}: TableQrModalProps) {
  const [selectedTable, setSelectedTable] = useState<string>("1");
  const [customTableInput, setCustomTableInput] = useState<string>("");
  const [copied, setCopied] = useState<boolean>(false);

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

  const handlePrintStandee = () => {
    const printWindow = window.open("", "_blank", "width=700,height=900");
    if (!printWindow) {
      alert("Izinkan pop-up browser untuk mencetak kartu standee meja.");
      return;
    }

    const htmlContent = `
      <!DOCTYPE html>
      <html lang="id">
      <head>
        <meta charset="utf-8" />
        <title>Standee QR Meja ${activeTable} - ${storeName}</title>
        <style>
          @page {
            size: A6 portrait;
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
            padding: 10px;
          }
          .standee-card {
            width: 100%;
            max-width: 360px;
            border: 3px solid #0b3d2e;
            border-radius: 24px;
            padding: 24px 20px;
            text-align: center;
            background: #ffffff;
            position: relative;
            box-shadow: 0 4px 20px rgba(0,0,0,0.06);
          }
          .header-badge {
            display: inline-block;
            background: #edf8f3;
            color: #167052;
            font-size: 11px;
            font-weight: 800;
            letter-spacing: 1.5px;
            text-transform: uppercase;
            padding: 5px 14px;
            border-radius: 999px;
            margin-bottom: 12px;
          }
          .store-title {
            font-size: 22px;
            font-weight: 900;
            color: #0b3d2e;
            margin-bottom: 4px;
            letter-spacing: -0.5px;
          }
          .subtitle {
            font-size: 12px;
            color: #556b62;
            margin-bottom: 18px;
            font-weight: 500;
          }
          .table-pill {
            display: inline-block;
            background: #0b3d2e;
            color: #c8f53a;
            font-size: 20px;
            font-weight: 900;
            font-family: ui-monospace, SFMono-Regular, monospace;
            padding: 8px 24px;
            border-radius: 16px;
            margin-bottom: 18px;
            letter-spacing: 0.5px;
          }
          .qr-wrapper {
            background: #ffffff;
            border: 2px dashed #0b3d2e;
            border-radius: 20px;
            padding: 16px;
            display: inline-block;
            margin-bottom: 16px;
          }
          .qr-wrapper svg {
            display: block;
            margin: 0 auto;
          }
          .instructions {
            background: #edf8f3;
            border-radius: 16px;
            padding: 12px;
            font-size: 11px;
            color: #1c2d26;
            line-height: 1.5;
            margin-bottom: 16px;
          }
          .instructions strong {
            color: #0b3d2e;
          }
          .footer-text {
            font-size: 10px;
            color: #718078;
            font-weight: 600;
          }
        </style>
      </head>
      <body>
        <div class="standee-card">
          <div class="header-badge">SCAN &amp; PESAN DARI MEJA</div>
          <h1 class="store-title">${storeName}</h1>
          <p class="subtitle">Buku Menu Digital · Pesan Langsung Tanpa Antre</p>
          
          <div>
            <span class="table-pill">MEJA ${activeTable.toUpperCase()}</span>
          </div>

          <div class="qr-wrapper">
            <div id="qrcode-container"></div>
          </div>

          <div class="instructions">
            <strong>Cara Pesan:</strong><br />
            1. Buka kamera HP atau scanner QR<br />
            2. Arahkan ke kode di atas<br />
            3. Pilih menu favorit &amp; kirim pesanan
          </div>

          <p class="footer-text">Pesanan otomatis masuk ke Kasir &amp; Dapur · KAEL POS</p>
        </div>

        <script src="https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js"></script>
        <script>
          new QRCode(document.getElementById("qrcode-container"), {
            text: ${JSON.stringify(targetUrl)},
            width: 190,
            height: 190,
            colorDark: "#0b3d2e",
            colorLight: "#ffffff",
            correctLevel: QRCode.CorrectLevel.M
          });
          setTimeout(() => {
            window.print();
          }, 450);
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

          {/* 2. Pratinjau Standee Meja Akrilik */}
          <div className="space-y-2">
            <span className="text-xs font-black text-[#0b3d2e] uppercase tracking-wider flex items-center gap-1.5">
              <Sparkles size={13} />
              <span>Pratinjau Standee Meja Siap Tempel</span>
            </span>

            <div className="rounded-2xl border-2 border-[#0b3d2e] bg-white p-5 text-center shadow-md relative overflow-hidden max-w-xs mx-auto">
              {/* Badge */}
              <span className="inline-flex items-center gap-1 rounded-full bg-[#edf8f3] px-3 py-0.5 text-[10px] font-black text-[#167052] uppercase tracking-wider mb-2">
                <Coffee size={11} />
                <span>Pesan dari Meja</span>
              </span>

              {/* Nama Kafe */}
              <h3 className="text-base font-black text-[#0b3d2e] leading-tight">
                {storeName}
              </h3>
              <p className="text-[10px] text-[#556b62] mb-3">
                Menu Digital &amp; Self-Order
              </p>

              {/* Nomor Meja Besar */}
              <div className="inline-block rounded-xl bg-[#0b3d2e] px-4 py-1.5 text-[#c8f53a] font-mono text-sm font-black mb-3 shadow-xs">
                MEJA {activeTable.toUpperCase()}
              </div>

              {/* QR Container */}
              <div className="mx-auto flex justify-center rounded-2xl border-2 border-dashed border-[#167052] bg-white p-3 shadow-inner max-w-[200px]">
                <QrCodeComponent
                  value={targetUrl}
                  size={170}
                  label={`QR Meja ${activeTable}`}
                />
              </div>

              {/* Instructions */}
              <div className="mt-3 rounded-xl bg-[#edf8f3] p-2 text-[10px] text-[#20372e] leading-tight">
                Arahkan kamera HP ke QR di atas untuk memesan menu langsung dari tempat duduk.
              </div>

              <p className="mt-2 text-[9px] text-[#718078] font-mono truncate">
                {targetUrl}
              </p>
            </div>
          </div>

          {/* 3. Tombol Aksi */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-1 border-t border-[#e2ebe6]">
            {/* Tombol Print */}
            <button
              type="button"
              onClick={handlePrintStandee}
              className="flex items-center justify-center gap-2 rounded-2xl bg-[#0b3d2e] px-4 py-3 text-xs font-black text-[#c8f53a] shadow-md hover:bg-[#124634] active:scale-95 transition-all"
            >
              <Printer size={15} />
              <span>Cetak Standee Meja</span>
            </button>

            {/* Tombol Salin Link */}
            <button
              type="button"
              onClick={handleCopyLink}
              className="flex items-center justify-center gap-1.5 rounded-2xl border border-[#d8e3de] bg-[#f8faf9] px-3 py-3 text-xs font-bold text-[#1c2d26] hover:bg-[#edf8f3] active:scale-95 transition-all"
            >
              {copied ? <Check size={14} className="text-[#167052]" /> : <Copy size={14} />}
              <span>{copied ? "Link Tersalin!" : "Salin Link Meja"}</span>
            </button>

            {/* Tombol Buka Menu */}
            <a
              href={targetUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-1.5 rounded-2xl border border-[#d8e3de] bg-white px-3 py-3 text-xs font-bold text-[#556b62] hover:text-[#0b3d2e] hover:bg-[#f8faf9] transition-colors"
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
