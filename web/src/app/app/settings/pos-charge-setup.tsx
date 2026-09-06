"use client";

import { useState } from "react";
import { Check, Loader2 } from "lucide-react";

import { savePosChargeSettingsAction } from "@/lib/actions-pos-settings";

export default function PosChargeSetup({ taxRate, serviceChargeRate }: { taxRate: number; serviceChargeRate: number }) {
  const [tax, setTax] = useState(String(taxRate));
  const [service, setService] = useState(String(serviceChargeRate));
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusy(true); setMessage(null);
    const result = await savePosChargeSettingsAction(Number(tax), Number(service));
    setBusy(false);
    setMessage(result.ok ? "Tarif kasir tersimpan. Berlaku untuk transaksi berikutnya." : result.error);
  };

  return <form onSubmit={save} className="space-y-3">
    <p className="font-mono text-xs text-[#7b7b8e]">Kasir tidak bisa mengubah tarif per transaksi. Nilai uang dihitung ulang oleh server saat checkout.</p>
    <div className="grid gap-3 sm:grid-cols-2">
      <label className="font-mono text-xs font-bold">Pajak (%)<input type="number" min="0" max="100" step="0.01" value={tax} onChange={(event) => setTax(event.target.value)} className="mt-1.5 w-full rounded-xl border border-[#c9c9d4] px-3 py-2 font-sans text-sm" /></label>
      <label className="font-mono text-xs font-bold">Service charge (%)<input type="number" min="0" max="100" step="0.01" value={service} onChange={(event) => setService(event.target.value)} className="mt-1.5 w-full rounded-xl border border-[#c9c9d4] px-3 py-2 font-sans text-sm" /></label>
    </div>
    {message && <p className={`font-mono text-[11px] font-bold ${message.includes("tersimpan") ? "text-[#15803d]" : "text-[#b91c1c]"}`}>{message}</p>}
    <button type="submit" disabled={busy} className="btn-tactile inline-flex min-h-10 items-center gap-1.5 rounded-xl border-2 border-[#232331] bg-[#d9ff57] px-3 font-mono text-xs font-extrabold shadow-ink-xs disabled:opacity-50">{busy ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />}Simpan tarif</button>
  </form>;
}
