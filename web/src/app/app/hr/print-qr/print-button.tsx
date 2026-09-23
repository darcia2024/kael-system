"use client";

import { Printer } from "lucide-react";

export default function PrintButton() {
  return (
    <button
      onClick={() => window.print()}
      className="inline-flex items-center gap-1.5 rounded-xl bg-[#c8f53a] px-3.5 py-1.5 font-mono text-xs font-black text-[#0b3d2e] shadow-sm hover:brightness-105 active:scale-95 transition-all"
    >
      <Printer size={14} /> Cetak Lembar Ini
    </button>
  );
}
