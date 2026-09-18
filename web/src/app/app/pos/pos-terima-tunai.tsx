"use client";

import { useState } from "react";
import { Banknote, Loader2, X } from "lucide-react";

import { formatRupiah } from "@/lib/formatters";

/** Pecahan yang paling sering disodorkan tamu, supaya kasir tidak mengetik. */
export const PECAHAN = [10_000, 20_000, 50_000, 100_000];

/**
 * Isian uang tunai yang diterima, dengan kembalian yang dihitung di depan
 * mata sebelum tombol bayar ditekan.
 *
 * Dipakai di pembayaran meja dan di konfirmasi pesanan antrean — satu cara
 * menerima uang tunai, di mana pun kasirnya menerimanya.
 */
export function IsianTunai({
  total,
  tunai,
  onUbah,
}: {
  total: number;
  tunai: number;
  onUbah: (tunai: number) => void;
}) {
  const kembalian = tunai - total;
  const cukup = kembalian >= 0;

  return (
    <div className="space-y-2">
      <label className="block font-mono text-xs font-bold text-[#0b3d2e]">
        Uang diterima
        <input
          type="number"
          min={0}
          step={500}
          value={tunai}
          onChange={(e) => onUbah(Number(e.target.value) || 0)}
          className="mt-1.5 h-11 w-full rounded-xl border border-[#d8e3de] px-3 text-right font-mono text-lg font-black text-[#0b3d2e]"
        />
      </label>

      <div className="grid grid-cols-4 gap-1.5">
        {/* Uang pas dulu: itu yang paling sering terjadi di kafe. */}
        <button
          type="button"
          onClick={() => onUbah(total)}
          className="rounded-xl border border-[#d8e3de] bg-white py-2 font-mono text-[10.5px] font-black text-[#0b3d2e]"
        >
          Pas
        </button>
        {PECAHAN.filter((p) => p > total).slice(0, 3).map((p) => (
          <button
            key={p}
            type="button"
            onClick={() => onUbah(p)}
            className="rounded-xl border border-[#d8e3de] bg-white py-2 font-mono text-[10.5px] font-black text-[#0b3d2e]"
          >
            {p / 1000}rb
          </button>
        ))}
      </div>

      <div
        className={`flex items-center justify-between rounded-xl px-3.5 py-2.5 ${
          cukup ? "bg-[#edf8f3]" : "bg-amber-50"
        }`}
      >
        <span className="font-mono text-xs font-bold text-[#0b3d2e]">
          {cukup ? "Kembalian" : "Uangnya masih kurang"}
        </span>
        <span
          className={`font-mono text-lg font-black tabular-nums ${
            cukup ? "text-[#0b3d2e]" : "text-amber-800"
          }`}
        >
          {formatRupiah(Math.abs(kembalian))}
        </span>
      </div>
    </div>
  );
}

/**
 * Tamu membayar tunai pesanan yang sudah ada di antrean.
 *
 * Tombol "Pembayaran sudah masuk" dulu langsung menandai lunas tanpa
 * menanyakan uangnya. Akibatnya struk tidak bisa mencetak tunai diterima dan
 * kembalian, dan laporan owner tidak bisa menunjukkan berapa uang yang
 * benar-benar disodorkan tamu. Untuk pesanan tunai, jendela ini sekarang
 * berdiri di antara tombol itu dan pencatatannya.
 */
export default function PosTerimaTunaiModal({
  orderNo,
  keterangan,
  total,
  onTerima,
  onClose,
  isMochi = true,
}: {
  orderNo: string;
  /** Mis. "Meja 08" atau "Takeaway". */
  keterangan: string;
  total: number;
  /** Melempar Error berisi pesannya kalau server menolak. */
  onTerima: (tunaiDiterima: number) => Promise<void>;
  onClose: () => void;
  isMochi?: boolean;
}) {
  const [tunai, setTunai] = useState<number>(total);
  const [sibuk, setSibuk] = useState(false);
  const [galat, setGalat] = useState<string | null>(null);
  const cukup = tunai >= total;

  const terima = async () => {
    if (!cukup || sibuk) return;
    setSibuk(true);
    setGalat(null);
    try {
      await onTerima(tunai);
    } catch (e) {
      setGalat(e instanceof Error ? e.message : "Pembayaran gagal diproses.");
    } finally {
      setSibuk(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center bg-[#07281e]/60 p-0 backdrop-blur-xs sm:items-center sm:p-4">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="judul-terima-tunai"
        className="flex max-h-[92dvh] w-full max-w-md flex-col overflow-hidden rounded-t-3xl bg-white shadow-2xl sm:rounded-3xl"
      >
        <div className="flex items-start justify-between gap-3 border-b border-[#d8e3de] bg-[#f8faf9] px-4 py-3.5">
          <div className="min-w-0">
            <h2 id="judul-terima-tunai" className="text-base font-black text-[#0b3d2e]">
              Terima Pembayaran Tunai
            </h2>
            <p className="mt-0.5 font-mono text-[11px] text-[#527867]">
              #{orderNo} · {keterangan}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-[#d8e3de] bg-white text-[#527867]"
            aria-label="Tutup"
          >
            <X size={16} />
          </button>
        </div>

        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-4 py-4">
          <div className="rounded-2xl bg-[#0b3d2e] px-4 py-3.5 text-center">
            <p className="font-mono text-[10.5px] uppercase tracking-wider text-emerald-200/80">Total tagihan</p>
            <p className="text-3xl font-black tabular-nums text-[#c8f53a]">{formatRupiah(total)}</p>
          </div>

          <IsianTunai total={total} tunai={tunai} onUbah={setTunai} />

          {galat && (
            <p className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-[11.5px] font-bold text-rose-800">
              {galat}
            </p>
          )}
        </div>

        <div className="border-t border-[#d8e3de] bg-[#f8faf9] px-4 py-3 pb-[calc(0.75rem_+_env(safe-area-inset-bottom))] sm:pb-3">
          <button
            type="button"
            disabled={!cukup || sibuk}
            onClick={() => void terima()}
            className={`flex h-12 w-full items-center justify-center gap-2 rounded-xl text-sm font-black transition-all disabled:cursor-not-allowed disabled:opacity-45 ${
              isMochi ? "bg-[#c8f53a] text-[#073829] hover:bg-[#d9ff57]" : "bg-[#167052] text-white"
            }`}
          >
            {sibuk ? <Loader2 size={16} className="animate-spin" /> : <Banknote size={16} />}
            <span>{sibuk ? "Memproses..." : `Terima ${formatRupiah(total)}`}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
