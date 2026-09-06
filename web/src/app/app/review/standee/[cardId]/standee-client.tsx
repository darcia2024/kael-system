"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowLeft, Printer, Save } from "lucide-react";

import QrCode from "@/components/qr-code";
import { saveReviewStandeeAction } from "@/lib/actions";
import type { Business, Card } from "@/lib/types";
import { siteHost } from "@/lib/site";

export default function StandeeClient({ card, business, saved }: {
  card: Card; business: Business; saved: { headline?: string; body?: string; print_size?: "A6" | "A5" | "A4" } | null;
}) {
  const [headline, setHeadline] = useState(saved?.headline ?? "Bantu kami dengan ulasan Google");
  const [body, setBody] = useState(saved?.body ?? "Scan QR atau tap kartu ini untuk memberi ulasan.");
  const [size, setSize] = useState<"A6" | "A5" | "A4">(saved?.print_size ?? "A6");
  const [saving, setSaving] = useState(false);
  const publicUrl = `${siteHost}/r/${card.card_code}?source=standee`;

  const save = async () => {
    setSaving(true);
    const result = await saveReviewStandeeAction(card.id, { headline, body, printSize: size });
    setSaving(false);
    if (!result.ok) alert(result.error);
  };

  return (
    <main className="min-h-screen bg-[#f7f6fc] p-4 text-[#232331] sm:p-8">
      <div className="mx-auto max-w-5xl">
        <div className="mb-6 flex items-center justify-between gap-3 print:hidden">
          <Link href="/app/review" className="inline-flex h-10 w-10 items-center justify-center rounded-lg border-2 border-[#232331] bg-white" title="Kembali"><ArrowLeft size={17} /></Link>
          <div className="flex gap-2">
            <button type="button" onClick={save} disabled={saving} className="inline-flex items-center gap-2 rounded-lg border-2 border-[#232331] bg-white px-3 py-2 text-sm font-bold disabled:opacity-50"><Save size={15} />{saving ? "Menyimpan" : "Simpan"}</button>
            <button type="button" onClick={() => window.print()} className="inline-flex items-center gap-2 rounded-lg border-2 border-[#232331] bg-[#d9ff57] px-3 py-2 text-sm font-bold"><Printer size={15} />Cetak</button>
          </div>
        </div>
        <div className="grid gap-6 lg:grid-cols-[280px_1fr] print:block">
          <aside className="space-y-4 rounded-2xl border-2 border-[#232331] bg-white p-4 print:hidden">
            <label className="block text-xs font-bold">Ukuran cetak<select value={size} onChange={(event) => setSize(event.target.value as "A6" | "A5" | "A4")} className="mt-1 block w-full rounded-md border border-[#232331] p-2"><option>A6</option><option>A5</option><option>A4</option></select></label>
            <label className="block text-xs font-bold">Judul<textarea value={headline} onChange={(event) => setHeadline(event.target.value)} className="mt-1 min-h-20 w-full rounded-md border border-[#232331] p-2 text-sm" /></label>
            <label className="block text-xs font-bold">Pesan singkat<textarea value={body} onChange={(event) => setBody(event.target.value)} className="mt-1 min-h-24 w-full rounded-md border border-[#232331] p-2 text-sm" /></label>
          </aside>
          <section className="flex justify-center bg-[#e8e6ef] p-4 print:bg-white print:p-0">
            <article className="flex aspect-[0.707] w-full max-w-[420px] flex-col items-center justify-between border-[3px] border-[#232331] bg-white p-8 text-center shadow-ink-md print:border-2 print:shadow-none" style={{ borderTopColor: business.brand_color }}>
              <div><p className="text-xs font-bold uppercase tracking-wide" style={{ color: business.brand_color }}>{business.public_name || business.name}</p><h1 className="mt-5 text-3xl font-black leading-tight">{headline}</h1><p className="mt-3 text-sm leading-relaxed text-[#555566]">{body}</p></div>
              <QrCode value={publicUrl} size={220} label={`QR ulasan ${business.name}`} />
              <div><p className="text-sm font-bold">Terima kasih sudah mampir.</p><p className="mt-1 font-mono text-[10px] text-[#7b7b8e]">{card.label || "Kartu ulasan"} · {card.card_code}</p></div>
            </article>
          </section>
        </div>
      </div>
    </main>
  );
}
