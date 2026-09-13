"use client";

import { useState, type CSSProperties } from "react";
import Link from "next/link";
import { ArrowLeft, Printer, Save, ScanLine } from "lucide-react";

import QrCode from "@/components/qr-code";
import { saveReviewStandeeAction } from "@/lib/actions";
import type { Business, Card } from "@/lib/types";
import { siteHost } from "@/lib/site";

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
    saved?.headline ?? "Bantu kami dengan ulasan",
  );
  const [body, setBody] = useState(
    saved?.body ?? "Scan QR atau tap kartu ini untuk berbagi pengalaman Anda.",
  );
  const [size, setSize] = useState<PrintSize>(saved?.print_size ?? "A6");
  const [saving, setSaving] = useState(false);
  const [savedNotice, setSavedNotice] = useState("");
  const publicUrl = `${siteHost}/r/${card.card_code}?source=standee`;
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
    <main className="min-h-screen bg-[#f7f6fc] text-[#232331]">
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

      <header className="print:hidden border-b-2 border-[#232331] bg-white px-4 py-3 sm:px-8">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <Link
              href="/app/review"
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border-2 border-[#232331] bg-white"
              title="Kembali ke KAEL Review"
            >
              <ArrowLeft size={17} />
            </Link>
            <div className="min-w-0">
              <p className="font-mono text-[10px] font-bold text-[#7958d8]">
                KAEL REVIEW / MATERI CETAK
              </p>
              <h1 className="truncate text-base font-black">
                Standee QR {brandName}
              </h1>
            </div>
          </div>
          <div className="flex shrink-0 gap-2">
            <button
              type="button"
              onClick={save}
              disabled={saving}
              className="inline-flex min-h-10 items-center gap-2 rounded-xl border-2 border-[#232331] bg-white px-3 text-xs font-black disabled:opacity-50"
            >
              <Save size={15} />
              {saving ? "Menyimpan" : "Simpan"}
            </button>
            <button
              type="button"
              onClick={() => window.print()}
              className="inline-flex min-h-10 items-center gap-2 rounded-xl border-2 border-[#232331] bg-[#d9ff57] px-3 text-xs font-black shadow-ink-xs"
            >
              <Printer size={15} />
              Cetak
            </button>
          </div>
        </div>
      </header>

      <div className="mx-auto grid max-w-6xl gap-5 p-4 sm:p-8 lg:grid-cols-[292px_1fr]">
        <aside className="print:hidden h-fit rounded-2xl border-2 border-[#232331] bg-white p-4 shadow-ink-sm">
          <div className="border-b border-[#dedee8] pb-3">
            <p className="font-mono text-[10px] font-bold text-[#7958d8]">
              ATUR MATERI
            </p>
            <h2 className="mt-1 text-lg font-black">
              Siap cetak di meja kasir
            </h2>
            <p className="mt-1 text-xs leading-5 text-[#66667a]">
              Teks pendek lebih mudah dibaca dari jarak antrean.
            </p>
          </div>
          <div className="mt-4 space-y-4">
            <fieldset>
              <legend className="text-xs font-bold">Ukuran cetak</legend>
              <div className="mt-2 grid grid-cols-3 gap-2">
                {(["A6", "A5", "A4"] as PrintSize[]).map((option) => (
                  <button
                    key={option}
                    type="button"
                    onClick={() => setSize(option)}
                    className={`min-h-10 rounded-xl border-2 border-[#232331] text-xs font-black ${size === option ? "bg-[#d9ff57]" : "bg-white"}`}
                  >
                    {option}
                  </button>
                ))}
              </div>
            </fieldset>
            <label className="block text-xs font-bold">
              Judul utama
              <textarea
                value={headline}
                onChange={(event) =>
                  setHeadline(event.target.value.slice(0, 76))
                }
                maxLength={76}
                className="mt-1 min-h-24 w-full resize-y rounded-xl border-2 border-[#232331] p-3 text-sm font-bold outline-none focus:ring-2 focus:ring-[#7958d8]"
              />
            </label>
            <label className="block text-xs font-bold">
              Pesan singkat
              <textarea
                value={body}
                onChange={(event) => setBody(event.target.value.slice(0, 140))}
                maxLength={140}
                className="mt-1 min-h-28 w-full resize-y rounded-xl border-2 border-[#232331] p-3 text-sm outline-none focus:ring-2 focus:ring-[#7958d8]"
              />
            </label>
            {savedNotice && (
              <p
                role="status"
                className={`rounded-xl border p-3 text-xs font-bold ${savedNotice === "Desain standee tersimpan." ? "border-[#15803d] bg-[#dcfce7] text-[#166534]" : "border-[#b91c1c] bg-[#fef2f2] text-[#b91c1c]"}`}
              >
                {savedNotice}
              </p>
            )}
          </div>
        </aside>

        <section className="standee-print-stage flex min-h-[650px] items-center justify-center rounded-2xl border-2 border-dashed border-[#cfcddd] bg-[#e8e6ef] p-5 sm:p-10 print:min-h-0 print:border-0 print:bg-white print:p-0">
          <article
            className="kael-poster standee-paper relative aspect-[0.703] overflow-hidden border-[3px] border-[#11111c] bg-white shadow-ink-lg print:border-2 print:shadow-none"
            style={
              {
                width: printWidths[size],
                "--qr-size": qrPrintSizes[size],
              } as CSSProperties
            }
          >
            <img
              src="/standee-review-template-v2.png"
              alt=""
              className="standee-template"
            />
            <div className="absolute left-[27%] top-[5%] z-[2] flex items-start justify-between gap-2">
              <img
                src="/kael-logo-full.png"
                alt="KAEL"
                className="h-auto w-[36%] max-w-[120px] object-contain"
              />
              <span className="rounded-full border-2 border-[#11111c] bg-white px-2 py-1 font-mono text-[clamp(.35rem,1.5cqw,.58rem)] font-black leading-none shadow-[2px_2px_0_#11111c]">
                KAEL REVIEW
              </span>
            </div>
            <div className="standee-copy">
              <p className="font-mono text-[clamp(.38rem,2.4cqw,.65rem)] font-black text-[#7958d8]">
                PENGALAMAN ANDA BERARTI
              </p>
              <h2 className="mt-2 font-black">
                {headlineLead}
                <br />
                <span className="inline-block rounded-[.24em] border-2 border-[#11111c] bg-[#d9ff57] px-[.16em] pb-[.08em] shadow-[3px_4px_0_#11111c]">
                  Google
                </span>
              </h2>
              <p className="mt-4 font-medium text-[#232331]">{body}</p>
            </div>
            <div className="standee-qr-zone">
              <div className="mb-2 flex items-center justify-center gap-1.5 font-mono text-[clamp(.5rem,3.2cqw,.9rem)] font-black">
                <ScanLine size={16} /> SCAN ATAU TAP
              </div>
              <QrCode
                value={publicUrl}
                size={280}
                className="h-auto w-full"
                label={`QR ulasan ${business.name}`}
              />
            </div>
            <div className="standee-footer flex items-end justify-between">
              <p className="font-black text-[clamp(.72rem,5.5cqw,1.4rem)] leading-none">
                Terima kasih
                <br />
                sudah mampir!
              </p>
              <p className="rounded-full border-2 border-[#11111c] bg-white px-2 py-1 font-mono text-[clamp(.38rem,2cqw,.58rem)] font-bold">
                {card.card_code} · kaels.site
              </p>
            </div>
          </article>
        </section>
      </div>
    </main>
  );
}
