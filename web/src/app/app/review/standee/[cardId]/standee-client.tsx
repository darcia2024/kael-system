"use client";

import { useState, type CSSProperties } from "react";
import Link from "next/link";
import { ArrowLeft, Printer, Save, ScanLine } from "lucide-react";

import QrCode from "@/components/qr-code";
import { saveReviewStandeeAction } from "@/lib/actions";
import type { Business, Card } from "@/lib/types";
import { siteHost } from "@/lib/site";
import { BusinessMark } from "@/components/business-mark";

type PrintSize = "A6" | "A5" | "A4";

const printWidths: Record<PrintSize, string> = {
  A6: "min(100%, 270px)",
  A5: "min(100%, 370px)",
  A4: "min(100%, 470px)",
};

const qrPrintSizes: Record<PrintSize, string> = {
  A6: "46mm",
  A5: "68mm",
  A4: "88mm",
};

export default function StandeeClient({
  card,
  business,
  saved,
}: {
  card: Card;
  business: Business;
  saved: { headline?: string; body?: string; print_size?: PrintSize } | null;
}) {
  const [headline, setHeadline] = useState(
    saved?.headline ?? "Bantu kami dengan ulasan"
  );
  const [body, setBody] = useState(
    saved?.body ?? "Scan QR atau tap kartu ini untuk berbagi pengalaman Anda."
  );
  const [size, setSize] = useState<PrintSize>(saved?.print_size ?? "A6");
  const [saving, setSaving] = useState(false);
  const [savedNotice, setSavedNotice] = useState("");
  const publicUrl = siteHost + "/r/" + card.card_code + "?source=standee";
  const brandName = business.public_name || business.name;
  const headlineLead =
    headline.replace(/\s*google\s*$/i, "").trim() || "Bantu kami dengan ulasan";

  const save = async () => {
    setSaving(true);
    setSavedNotice("");
    const result = await saveReviewStandeeAction(card.id, {
      headline,
      body,
      printSize: size,
    });
    setSaving(false);
    if (!result.ok)
      return setSavedNotice(result.error || "Belum bisa menyimpan standee.");
    setSavedNotice("Desain standee tersimpan.");
  };

  return (
    <main className="min-h-screen bg-[#f0f5f2] text-[#18392f] font-sans">
      <style jsx global>{`
        @page { size: ${size}; margin: 0; }
        @media print {
          body { background: white !important; }
          .standee-print-stage { padding: 0 !important; background: white !important; }
          .standee-paper { width: 100% !important; max-width: none !important; box-shadow: none !important; }
        }
        .kael-poster { container-type:inline-size; }
        .standee-template { position:absolute; inset:0; width:100%; height:100%; object-fit:cover; }
        .standee-copy { position:absolute; left:8%; right:8%; top:16%; z-index:2; }
        .standee-copy h2 { font-size:clamp(1.4rem, 7cqw, 3.5rem); line-height:.92; }
        .standee-copy p { max-width:31ch; font-size:clamp(.62rem, 2.4cqw, 1rem); line-height:1.16; }
        .standee-qr-zone { position:absolute; z-index:2; left:50%; top:51%; width:var(--qr-size); transform:translateX(-50%); }
        .standee-qr-zone svg[role="img"] { display:block; width:100% !important; height:auto !important; }
        .standee-footer { position:absolute; z-index:2; left:8%; right:8%; bottom:2.5%; }
      `}</style>

      {/* Sticky Emerald Header */}
      <header className="print:hidden sticky top-0 z-30 border-b border-emerald-800/60 bg-[#0b3d2e] px-4 py-3 text-white backdrop-blur-md shadow-sm sm:px-8">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <Link
              href="/app/review"
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-emerald-600/40 bg-white/10 text-white hover:bg-white/15 transition-colors shadow-xs"
              title="Kembali ke KAEL Review"
            >
              <ArrowLeft size={16} />
            </Link>
            <BusinessMark
              name={business.name}
              logoUrl={business.logo_url}
              brandColor={business.brand_color}
              className="h-9 w-9 shrink-0 rounded-full border border-emerald-400/40 bg-white p-0.5 shadow-xs"
            />
            <div className="min-w-0">
              <p className="font-mono text-[9px] font-bold text-[#c8f53a] uppercase">
                KAEL REVIEW / MATERI CETAK
              </p>
              <h1 className="truncate text-sm sm:text-base font-extrabold text-white">
                Standee QR {brandName}
              </h1>
            </div>
          </div>
          <div className="flex shrink-0 gap-2">
            <button
              type="button"
              onClick={save}
              disabled={saving}
              className="inline-flex min-h-10 items-center gap-1.5 rounded-xl border border-emerald-600/40 bg-white/10 px-3.5 text-xs font-bold text-white hover:bg-white/15 transition-colors disabled:opacity-50"
            >
              <Save size={15} />
              {saving ? "Menyimpan" : "Simpan"}
            </button>
            <button
              type="button"
              onClick={() => window.print()}
              className="inline-flex min-h-10 items-center gap-1.5 rounded-xl bg-[#c8f53a] hover:bg-[#d9ff57] px-4 text-xs font-bold text-[#073829] shadow-xs transition-colors"
            >
              <Printer size={15} />
              Cetak Standee
            </button>
          </div>
        </div>
      </header>

      <div className="mx-auto grid max-w-6xl gap-5 p-4 sm:p-8 lg:grid-cols-[292px_1fr]">
        <aside className="print:hidden h-fit rounded-3xl border border-[#d8e3de] bg-white p-5 sm:p-6 shadow-[0_4px_20px_rgba(11,61,46,0.04)]">
          <div className="border-b border-[#e5ede9] pb-3">
            <p className="font-mono text-[10px] font-bold text-[#167052] uppercase">
              ATUR MATERI
            </p>
            <h2 className="mt-1 text-base font-extrabold text-[#0b3d2e]">
              Siap cetak di meja kasir
            </h2>
            <p className="mt-1 text-xs leading-5 text-[#527867]">
              Teks pendek lebih mudah dibaca dari jarak antrean.
            </p>
          </div>
          <div className="mt-4 space-y-4">
            <fieldset>
              <legend className="text-xs font-bold text-[#0b3d2e]">Ukuran cetak</legend>
              <div className="mt-2 grid grid-cols-3 gap-2">
                {(["A6", "A5", "A4"] as PrintSize[]).map((option) => (
                  <button
                    key={option}
                    type="button"
                    onClick={() => setSize(option)}
                    className={
                      "min-h-10 rounded-xl border text-xs font-bold transition-colors " +
                      (size === option
                        ? "border-[#0b3d2e] bg-[#0b3d2e] text-[#c8f53a]"
                        : "border-[#d8e3de] bg-white text-[#527867] hover:bg-[#edf8f3]")
                    }
                  >
                    {option}
                  </button>
                ))}
              </div>
            </fieldset>
            <label className="block text-xs font-bold text-[#0b3d2e]">
              Judul utama
              <textarea
                value={headline}
                onChange={(event) =>
                  setHeadline(event.target.value.slice(0, 76))
                }
                maxLength={76}
                className="mt-1 min-h-24 w-full resize-y rounded-xl border border-[#d8e3de] bg-[#fbfdfc] p-3 text-xs font-bold text-[#0b3d2e] outline-none focus:border-emerald-600 focus:bg-white focus:ring-2 focus:ring-emerald-600/20"
              />
            </label>
            <label className="block text-xs font-bold text-[#0b3d2e]">
              Kalimat ajakan
              <textarea
                value={body}
                onChange={(event) =>
                  setBody(event.target.value.slice(0, 120))
                }
                maxLength={120}
                className="mt-1 min-h-24 w-full resize-y rounded-xl border border-[#d8e3de] bg-[#fbfdfc] p-3 text-xs font-bold text-[#0b3d2e] outline-none focus:border-emerald-600 focus:bg-white focus:ring-2 focus:ring-emerald-600/20"
              />
            </label>
            <div className="rounded-2xl border border-emerald-200 bg-[#eaf6ef] p-3 text-xs text-[#0b3d2e]">
              <p className="font-bold">Info Cetak</p>
              <p className="mt-1 text-[11px] leading-relaxed text-[#527867]">
                Template ini dirancang proporsional untuk akrilik berdiri di meja kasir atau meja pengunjung.
              </p>
            </div>
            {savedNotice && (
              <p className="rounded-xl border border-emerald-300 bg-emerald-50 p-2 text-center text-xs font-bold text-emerald-800">
                {savedNotice}
              </p>
            )}
          </div>
        </aside>

        <div className="standee-print-stage flex justify-center py-4">
          <div
            className="standee-paper relative aspect-[1/1.414] overflow-hidden rounded-2xl bg-white shadow-2xl transition-all print:rounded-none"
            style={
              {
                width: printWidths[size],
                "--qr-size": qrPrintSizes[size],
              } as CSSProperties
            }
          >
            <div className="kael-poster relative h-full w-full bg-[#0b3d2e] text-white">
              {/* Header inside poster */}
              <div className="standee-copy text-center">
                <p className="font-mono text-[10px] tracking-widest uppercase text-[#c8f53a] mb-1">
                  {brandName}
                </p>
                <h2 className="font-black tracking-tight text-white">
                  {headlineLead}
                </h2>
                <p className="mx-auto mt-2 text-emerald-100/90 font-medium">
                  {body}
                </p>
              </div>

              {/* QR Zone */}
              <div className="standee-qr-zone flex flex-col items-center">
                <div className="rounded-2xl bg-white p-3 shadow-lg">
                  <QrCode value={publicUrl} size={180} />
                </div>
                <div className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1 font-mono text-[10px] font-bold text-[#c8f53a] backdrop-blur-xs">
                  <ScanLine size={12} />
                  <span>Scan QR atau Tap NFC</span>
                </div>
              </div>

              {/* Footer inside poster */}
              <div className="standee-footer text-center">
                <p className="text-[9px] font-mono text-emerald-200/70">
                  Didukung oleh KAEL Review Engine · {brandName}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
