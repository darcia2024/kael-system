"use client";

import Link from "next/link";
import { CheckCircle2, CircleAlert, Printer, Smartphone } from "lucide-react";

type Check = { label: string; detail: string; ready: boolean; href?: string };

export default function ReadinessPanel({ checks }: { checks: Check[] }) {
  const ready = checks.filter((item) => item.ready).length;
  return <section className="rounded-3xl border-2 border-[#232331] bg-white p-6 shadow-ink-md"><div className="flex flex-wrap items-start justify-between gap-3 border-b border-[#dedee8] pb-4"><div><h2 className="font-extrabold text-base">Tes Perangkat & Integrasi</h2><p className="mt-1 font-mono text-[11px] text-[#7b7b8e]">{ready}/{checks.length} koneksi dasar siap. Uji alat fisik sebelum kasir mulai menerima transaksi.</p></div><button type="button" onClick={() => window.print()} className="inline-flex min-h-11 items-center gap-2 rounded-xl border-2 border-[#232331] bg-white px-3 text-xs font-bold"><Printer size={15} />Cetak uji</button></div><div className="mt-4 space-y-2">{checks.map((item) => <div key={item.label} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[#dedee8] bg-[#fcfcfe] p-3"><div className="flex min-w-0 items-start gap-2"><span className={item.ready ? "text-[#15803d]" : "text-[#b45309]"}>{item.ready ? <CheckCircle2 size={18} /> : <CircleAlert size={18} />}</span><div><p className="text-sm font-bold">{item.label}</p><p className="mt-0.5 text-xs leading-5 text-[#66667a]">{item.detail}</p></div></div>{item.href && <Link href={item.href} className="inline-flex min-h-10 shrink-0 items-center gap-1 rounded-lg border border-[#232331] px-3 text-xs font-bold"><Smartphone size={13} />Uji</Link>}</div>)}</div></section>;
}
