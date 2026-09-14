"use client";

import Link from "next/link";
import { CheckCircle2, CircleAlert, Printer, Smartphone } from "lucide-react";

type Check = { label: string; detail: string; ready: boolean; href?: string };

export default function ReadinessPanel({ checks }: { checks: Check[] }) {
  const ready = checks.filter((item) => item.ready).length;
  return <section className="rounded-3xl border border-[#d8e3de] bg-white p-6 shadow-[0_4px_20px_rgba(11,61,46,0.04)]"><div className="flex flex-wrap items-start justify-between gap-3 border-b border-[#d8e3de] pb-4"><div><h2 className="font-extrabold text-base text-[#0b3d2e]">Tes Perangkat & Integrasi</h2><p className="mt-1 font-mono text-[11px] text-[#527867]">{ready}/{checks.length} koneksi dasar siap. Uji alat fisik sebelum kasir mulai menerima transaksi.</p></div><button type="button" onClick={() => window.print()} className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-[#d8e3de] bg-white px-3 text-xs font-bold"><Printer size={15} />Cetak uji</button></div><div className="mt-4 space-y-2">{checks.map((item) => <div key={item.label} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[#d8e3de] bg-[#fbfdfc] p-3"><div className="flex min-w-0 items-start gap-2"><span className={item.ready ? "text-[#15803d]" : "text-[#b45309]"}>{item.ready ? <CheckCircle2 size={18} /> : <CircleAlert size={18} />}</span><div><p className="text-sm font-bold">{item.label}</p><p className="mt-0.5 text-xs leading-5 text-[#527867]">{item.detail}</p></div></div>{item.href && <Link href={item.href} className="inline-flex min-h-10 shrink-0 items-center gap-1 rounded-lg border border-[#d8e3de] px-3 text-xs font-bold"><Smartphone size={13} />Uji</Link>}</div>)}</div></section>;
}
