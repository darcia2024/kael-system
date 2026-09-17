"use client";

import { useState } from "react";
import { Check, Loader2, ShieldAlert } from "lucide-react";

import { saveRefundLimitsAction } from "@/lib/actions-pos-settings";

/**
 * Pembatas pengembalian dana oleh staf.
 *
 * Keterangan di layar ini sengaja menjelaskan KENAPA, bukan cuma apa. Owner
 * yang mengira "lacinya cocok berarti aman" tidak akan pernah menyetel batas
 * ini — padahal justru penipuan refund-lah yang membuat laci tetap cocok.
 */
export default function RefundLimitSetup({
  maxPerTransaction,
  dailyLimitPerCashier,
}: {
  maxPerTransaction: number;
  dailyLimitPerCashier: number;
}) {
  const [sekali, setSekali] = useState(String(maxPerTransaction));
  const [harian, setHarian] = useState(String(dailyLimitPerCashier));
  const [busy, setBusy] = useState(false);
  const [pesan, setPesan] = useState<string | null>(null);

  const simpan = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setPesan(null);
    const hasil = await saveRefundLimitsAction(Number(sekali), Number(harian));
    setBusy(false);
    setPesan(hasil.ok ? "Batas refund tersimpan. Berlaku untuk refund berikutnya." : hasil.error);
  };

  return (
    <form onSubmit={simpan} className="space-y-3">
      <div className="flex items-start gap-2 rounded-2xl border border-amber-300 bg-amber-50 p-3">
        <ShieldAlert size={16} className="mt-0.5 shrink-0 text-amber-700" />
        <p className="text-[11.5px] leading-relaxed text-amber-900">
          Mencocokkan laci <b>tidak menangkap</b> penipuan refund. Uang pelanggan
          masuk, dicatat keluar, dan selisih lacinya tetap nol — jadi lacinya
          cocok justru saat uangnya diambil. Yang menangkapnya: owner tahu saat
          itu juga, nominalnya dibatasi, dan polanya terlihat.
        </p>
      </div>

      <p className="font-mono text-xs text-[#527867]">
        Isi <b>0</b> kalau tidak mau dibatasi. Owner tidak pernah terkena batas ini —
        yang melewatinya berpindah tangan ke owner, bukan berhenti.
      </p>

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="font-mono text-xs font-bold">
          Batas sekali refund (Rp)
          <input
            type="number"
            min="0"
            step="1"
            value={sekali}
            onChange={(e) => setSekali(e.target.value)}
            className="mt-1.5 w-full rounded-xl border border-[#d8e3de] px-3 py-2 font-sans text-sm"
          />
          <span className="mt-1 block font-sans text-[11px] font-normal leading-relaxed text-[#527867]">
            Di atas ini, refund harus diproses owner.
          </span>
        </label>

        <label className="font-mono text-xs font-bold">
          Batas per kasir per hari (Rp)
          <input
            type="number"
            min="0"
            step="1"
            value={harian}
            onChange={(e) => setHarian(e.target.value)}
            className="mt-1.5 w-full rounded-xl border border-[#d8e3de] px-3 py-2 font-sans text-sm"
          />
          <span className="mt-1 block font-sans text-[11px] font-normal leading-relaxed text-[#527867]">
            Memagari kerugian sebelum polanya sempat terbaca.
          </span>
        </label>
      </div>

      {pesan && (
        <p className={`font-mono text-[11px] font-bold ${pesan.includes("tersimpan") ? "text-[#15803d]" : "text-[#b91c1c]"}`}>
          {pesan}
        </p>
      )}

      <button
        type="submit"
        disabled={busy}
        className="inline-flex min-h-10 items-center gap-1.5 rounded-xl border border-[#d8e3de] bg-[#0b3d2e] px-4 font-mono text-xs font-bold text-[#c8f53a] shadow-xs hover:bg-[#0e4837] disabled:opacity-50"
      >
        {busy ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />}
        Simpan batas refund
      </button>
    </form>
  );
}
