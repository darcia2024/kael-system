"use client";

import { useState } from "react";
import { Check, Loader2, X } from "lucide-react";

import { formatRupiah } from "@/lib/formatters";
import { labelCaraBayar } from "@/lib/pos-engine";

/**
 * Satu pertanyaan sebelum pesanan non-tunai ditandai lunas.
 *
 * Status lunas tidak bisa dibatalkan dari layar kasir — transaksi tidak pernah
 * dihapus, yang ada hanya refund. Jadi salah tekan di sini baru bisa dibereskan
 * lewat refund, nota baru, dan pemberitahuan ke owner. Tombol tunai sudah
 * berhenti dulu di isian uang; transfer dan QRIS tadinya langsung tercatat
 * lunas hanya dengan satu sentuhan.
 *
 * Nomor nota, meja, dan nominal ditampilkan lagi di sini supaya kasir sempat
 * melihat bahwa yang akan dilunasi memang nota yang sedang dibayar tamu — bukan
 * nota sebelahnya di daftar.
 */
export default function PosKonfirmasiLunasModal({
  orderNo,
  keterangan,
  total,
  metode,
  onKonfirmasi,
  onClose,
  isMochi = true,
}: {
  orderNo: string;
  /** Mis. "Meja 07" atau "Takeaway". */
  keterangan: string;
  total: number;
  /** Nilai mentah metode bayar ("transfer", "qris", ...). */
  metode: string;
  onKonfirmasi: () => Promise<void>;
  onClose: () => void;
  isMochi?: boolean;
}) {
  const [sibuk, setSibuk] = useState(false);
  const [galat, setGalat] = useState<string | null>(null);
  const caraBayar = labelCaraBayar(metode);

  const konfirmasi = async () => {
    if (sibuk) return;
    setSibuk(true);
    setGalat(null);
    try {
      await onKonfirmasi();
    } catch (e) {
      setGalat(e instanceof Error ? e.message : "Pembayaran gagal diproses.");
      setSibuk(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center bg-[#07281e]/60 p-0 backdrop-blur-xs sm:items-center sm:p-4">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="judul-konfirmasi-lunas"
        className="flex w-full max-w-md flex-col overflow-hidden rounded-t-3xl bg-white shadow-2xl sm:rounded-3xl"
      >
        <div className="flex items-start justify-between gap-3 border-b border-[#d8e3de] bg-[#f8faf9] px-4 py-3.5">
          <div className="min-w-0">
            <h2 id="judul-konfirmasi-lunas" className="text-base font-black text-[#0b3d2e]">
              Uangnya sudah masuk?
            </h2>
            <p className="mt-0.5 font-mono text-[11px] text-[#527867]">
              #{orderNo} · {keterangan}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={sibuk}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-[#d8e3de] bg-white text-[#527867] disabled:opacity-50"
            aria-label="Tutup"
          >
            <X size={16} />
          </button>
        </div>

        <div className="space-y-3 px-4 py-4">
          <div className="rounded-2xl bg-[#0b3d2e] px-4 py-3.5 text-center">
            <p className="font-mono text-[10.5px] uppercase tracking-wider text-emerald-200/80">
              {caraBayar}
            </p>
            <p className="text-3xl font-black tabular-nums text-[#c8f53a]">{formatRupiah(total)}</p>
          </div>

          <p className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-[11.5px] font-bold leading-relaxed text-amber-900">
            Cek dulu mutasi atau bukti bayarnya. Setelah ditandai lunas, statusnya tidak bisa
            dibatalkan — hanya bisa lewat refund.
          </p>

          {galat && (
            <p className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-[11.5px] font-bold text-rose-800">
              {galat}
            </p>
          )}
        </div>

        <div className="grid grid-cols-2 gap-2 border-t border-[#d8e3de] bg-[#f8faf9] px-4 py-3 pb-[calc(0.75rem_+_env(safe-area-inset-bottom))] sm:pb-3">
          <button
            type="button"
            onClick={onClose}
            disabled={sibuk}
            className="h-12 rounded-xl border border-[#d8e3de] bg-white text-sm font-black text-[#0b3d2e] disabled:opacity-50"
          >
            Belum
          </button>
          <button
            type="button"
            disabled={sibuk}
            onClick={() => void konfirmasi()}
            className={`flex h-12 items-center justify-center gap-2 rounded-xl text-sm font-black transition-all disabled:cursor-not-allowed disabled:opacity-60 ${
              isMochi ? "bg-[#c8f53a] text-[#073829] hover:bg-[#d9ff57]" : "bg-[#167052] text-white"
            }`}
          >
            {sibuk ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />}
            <span>{sibuk ? "Memproses..." : "Ya, sudah lunas"}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
