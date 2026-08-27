"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, HeartHandshake, AlertTriangle, Check, Loader2 } from "lucide-react";

import { createLoyaltyProgramAction } from "@/lib/actions";
import { formatRupiah } from "@/lib/formatters";

/**
 * Layar penyiapan program loyalty.
 *
 * Menggantikan `throw new Error("Program loyalty belum dibuat")`. Galat itu
 * naik ke app/error.tsx, dan Next menyensor pesan aslinya di produksi, jadi
 * pemilik usaha yang modul Loyalty-nya sudah dibayar melihat layar galat tanpa
 * penjelasan — lalu menyimpulkan produknya rusak.
 *
 * Yang sebenarnya kurang cuma satu baris konfigurasi, dan halaman inilah
 * tempat mengisinya.
 */
export default function LoyaltySetup({ businessName }: { businessName: string }) {
  const router = useRouter();
  const [mode, setMode] = useState<"point" | "stamp">("point");
  const [kurs, setKurs] = useState<number>(10_000);
  const [stempel, setStempel] = useState<number>(1);
  const [busy, setBusy] = useState(false);
  const [galat, setGalat] = useState<string | null>(null);

  const simpan = async () => {
    setBusy(true);
    setGalat(null);
    const res = await createLoyaltyProgramAction({
      mode,
      earnRate: kurs,
      stampPerVisit: stempel,
    });
    setBusy(false);
    if (!res.ok) {
      setGalat(res.error);
      return;
    }
    router.refresh();
  };

  const kursValid = Number.isInteger(kurs) && kurs >= 1;

  return (
    <div className="min-h-screen bg-[#f7f6fc] text-[#232331] font-sans">
      <header className="sticky top-0 z-30 border-b-2 border-[#232331] bg-white px-4 sm:px-8 py-3.5">
        <div className="mx-auto flex max-w-2xl items-center gap-3">
          <Link
            href="/app"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-[#232331] bg-[#fcfcfe] shadow-ink-xs"
          >
            <ArrowLeft size={16} />
          </Link>
          <div className="min-w-0">
            <h1 className="font-black text-sm sm:text-base truncate">
              {businessName} · Loyalty
            </h1>
            <span className="text-[11px] text-[#7b7b8e] font-mono">Penyiapan awal</span>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-2xl px-4 sm:px-8 py-6 space-y-5">
        <div className="flex items-start gap-2.5 rounded-2xl border-2 border-[#e5b800] bg-[#fff8e1] px-4 py-3 text-[#8a6d00]">
          <AlertTriangle size={18} className="shrink-0 mt-0.5" />
          <div className="font-mono text-xs">
            <p className="font-bold">Modul sudah aktif, tapi kurs poinnya belum disetel.</p>
            <p className="mt-1">
              Selama ini belum diisi, pelanggan belum bisa mendaftar jadi member. Isi sekali
              di bawah — nanti masih bisa diubah kapan saja.
            </p>
          </div>
        </div>

        <div className="rounded-3xl border-2 border-[#232331] bg-white p-6 shadow-ink-md space-y-5">
          <div className="flex items-center gap-2 border-b border-[#dedee8] pb-4">
            <HeartHandshake size={20} className="text-[#d97706]" />
            <h2 className="font-extrabold text-base">Cara pelanggan mengumpulkan</h2>
          </div>

          <div className="grid grid-cols-2 gap-2">
            {[
              { id: "point" as const, label: "Poin", hint: "Dihitung dari nominal belanja" },
              { id: "stamp" as const, label: "Stempel", hint: "Dihitung per kunjungan" },
            ].map((m) => (
              <button
                key={m.id}
                type="button"
                onClick={() => setMode(m.id)}
                className={`rounded-2xl border-2 p-3 text-left transition-colors ${
                  mode === m.id
                    ? "border-[#232331] bg-[#232331] text-[#d9ff57] shadow-ink-xs"
                    : "border-[#dedee8] bg-white text-[#7b7b8e]"
                }`}
              >
                <span className="font-extrabold text-sm block">{m.label}</span>
                <span className="text-[11px] font-mono">{m.hint}</span>
              </button>
            ))}
          </div>

          {mode === "point" ? (
            <div className="space-y-2">
              <label className="block font-mono text-xs font-bold">
                Berapa rupiah belanja untuk 1 poin?
              </label>
              <input
                type="number"
                min={1}
                step={1000}
                value={kurs}
                onChange={(e) => setKurs(Number(e.target.value))}
                className="w-full rounded-2xl border-2 border-[#232331] px-4 py-3 text-lg font-black"
              />
              <div className="flex flex-wrap gap-1.5">
                {[5_000, 10_000, 20_000, 50_000].map((v) => (
                  <button
                    key={v}
                    type="button"
                    onClick={() => setKurs(v)}
                    className="rounded-lg border border-[#dedee8] bg-white px-2 py-1 font-mono text-[11px] font-bold text-[#7b7b8e] hover:border-[#232331]"
                  >
                    {formatRupiah(v)}
                  </button>
                ))}
              </div>
              <p className="font-mono text-[11px] text-[#7b7b8e]">
                {kursValid
                  ? `Pelanggan belanja ${formatRupiah(kurs)} dapat 1 poin.`
                  : "Kurs harus lebih dari nol."}
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              <label className="block font-mono text-xs font-bold">
                Berapa stempel per kunjungan?
              </label>
              <input
                type="number"
                min={1}
                max={10}
                value={stempel}
                onChange={(e) => setStempel(Number(e.target.value))}
                className="w-full rounded-2xl border-2 border-[#232331] px-4 py-3 text-lg font-black"
              />
            </div>
          )}

          {galat && (
            <div className="flex items-start gap-2 rounded-xl border border-[#c0392b] bg-[#fdeeec] px-3 py-2 text-[#c0392b]">
              <AlertTriangle size={13} className="shrink-0 mt-0.5" />
              <p className="font-mono text-[11px] font-bold">{galat}</p>
            </div>
          )}

          <button
            type="button"
            onClick={simpan}
            disabled={busy || (mode === "point" && !kursValid)}
            className="btn-tactile w-full inline-flex items-center justify-center gap-2 rounded-2xl border-2 border-[#232331] bg-[#d9ff57] px-4 py-3.5 font-mono text-sm font-extrabold shadow-ink-md disabled:opacity-50"
          >
            {busy ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />}
            {busy ? "Menyimpan..." : "Aktifkan program member"}
          </button>
        </div>
      </main>
    </div>
  );
}
