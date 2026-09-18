"use client";

import { useMemo, useState } from "react";
import { Banknote, CreditCard, Loader2, Smartphone, UserPlus, X } from "lucide-react";

import { formatRupiah } from "@/lib/formatters";

/**
 * Tamu selesai makan dan membayar seluruh tagihan mejanya.
 *
 * Ini satu-satunya titik di alur bayar-di-akhir tempat uang benar-benar
 * berpindah, jadi yang dijaga di layar ini semuanya soal itu:
 *
 *   1. Total yang ditagih adalah SELURUH nota meja, bukan yang terakhir saja.
 *      Tamu yang memesan empat kali sepanjang dua jam membayar sekali.
 *
 *   2. Kembalian dihitung di depan mata, sebelum tombolnya ditekan. Kasir yang
 *      menghitung di kepala sambil diburu antrean adalah sumber selisih laci
 *      yang paling sering, dan paling tidak pernah ketahuan sebabnya.
 *
 *   3. Member dilekatkan DI SINI, bukan saat memesan. Di alur ini kasir baru
 *      bertemu tamunya saat membayar — itu kesempatan pertama sekaligus
 *      terakhir untuk menawarkan pendaftaran.
 */

export type MetodeBayar = "cash" | "qris" | "transfer";

const METODE: { nilai: MetodeBayar; label: string; ikon: typeof Banknote }[] = [
  { nilai: "cash", label: "Tunai", ikon: Banknote },
  { nilai: "qris", label: "QRIS", ikon: Smartphone },
  { nilai: "transfer", label: "Transfer", ikon: CreditCard },
];

/** Pecahan yang paling sering disodorkan tamu, supaya kasir tidak mengetik. */
const PECAHAN = [10_000, 20_000, 50_000, 100_000];

export default function PosSettleTableModal({
  namaMeja,
  total,
  jumlahNota,
  namaMember,
  onCariMember,
  onBayar,
  onClose,
  isMochi = true,
}: {
  namaMeja: string;
  total: number;
  jumlahNota: number;
  /** Member yang sedang terlampir di kasir, kalau ada. */
  namaMember?: string | null;
  /** Membuka pencarian member milik layar kasir. */
  onCariMember?: () => void;
  onBayar: (metode: MetodeBayar, tunaiDiterima: number | null) => Promise<void>;
  onClose: () => void;
  isMochi?: boolean;
}) {
  const [metode, setMetode] = useState<MetodeBayar>("cash");
  const [tunai, setTunai] = useState<number>(total);
  const [sibuk, setSibuk] = useState(false);
  const [galat, setGalat] = useState<string | null>(null);

  const kembalian = useMemo(() => tunai - total, [tunai, total]);
  const cukup = metode !== "cash" || kembalian >= 0;

  const bayar = async () => {
    if (!cukup) return;
    setSibuk(true);
    setGalat(null);
    try {
      await onBayar(metode, metode === "cash" ? tunai : null);
    } catch (e) {
      setGalat(e instanceof Error ? e.message : "Pembayaran gagal diproses.");
    } finally {
      setSibuk(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center bg-[#07281e]/60 p-0 backdrop-blur-xs sm:items-center sm:p-4">
      <div className="flex max-h-[92dvh] w-full max-w-md flex-col overflow-hidden rounded-t-3xl bg-white shadow-2xl sm:rounded-3xl">
        <div className="flex items-start justify-between gap-3 border-b border-[#d8e3de] bg-[#f8faf9] px-4 py-3.5">
          <div className="min-w-0">
            <h2 className="text-base font-black text-[#0b3d2e]">Terima Pembayaran</h2>
            <p className="mt-0.5 font-mono text-[11px] text-[#527867]">
              {namaMeja} · {jumlahNota} nota digabung
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
            <p className="font-mono text-[10.5px] uppercase tracking-wider text-emerald-200/80">
              Total tagihan meja
            </p>
            <p className="text-3xl font-black tabular-nums text-[#c8f53a]">{formatRupiah(total)}</p>
          </div>

          <div>
            <p className="mb-1.5 font-mono text-xs font-bold text-[#0b3d2e]">Dibayar dengan</p>
            <div className="grid grid-cols-3 gap-1.5">
              {METODE.map((m) => {
                const Ikon = m.ikon;
                const aktif = metode === m.nilai;
                return (
                  <button
                    key={m.nilai}
                    type="button"
                    onClick={() => setMetode(m.nilai)}
                    className={`flex flex-col items-center justify-center gap-1 rounded-xl border py-2.5 text-[11px] font-black transition-all ${
                      aktif
                        ? "border-[#0b3d2e] bg-[#0b3d2e] text-[#c8f53a]"
                        : "border-[#d8e3de] bg-white text-[#0b3d2e] hover:bg-[#f8faf9]"
                    }`}
                  >
                    <Ikon size={15} />
                    <span>{m.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {metode === "cash" && (
            <div className="space-y-2">
              <label className="block font-mono text-xs font-bold text-[#0b3d2e]">
                Uang diterima
                <input
                  type="number"
                  min={0}
                  step={500}
                  value={tunai}
                  onChange={(e) => setTunai(Number(e.target.value) || 0)}
                  className="mt-1.5 h-11 w-full rounded-xl border border-[#d8e3de] px-3 text-right font-mono text-lg font-black text-[#0b3d2e]"
                />
              </label>

              <div className="grid grid-cols-4 gap-1.5">
                {/* Uang pas dulu: itu yang paling sering terjadi di kafe. */}
                <button
                  type="button"
                  onClick={() => setTunai(total)}
                  className="rounded-xl border border-[#d8e3de] bg-white py-2 font-mono text-[10.5px] font-black text-[#0b3d2e]"
                >
                  Pas
                </button>
                {PECAHAN.filter((p) => p > total).slice(0, 3).map((p) => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => setTunai(p)}
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
          )}

          {/*
            Kesempatan pertama sekaligus terakhir menawarkan member: di alur ini
            kasir baru bertemu tamunya saat membayar.
          */}
          <div
            className={`rounded-2xl border p-3 ${
              namaMember ? "border-[#0b3d2e] bg-[#edf8f3]" : "border-amber-300 bg-amber-50"
            }`}
          >
            {namaMember ? (
              <div className="flex items-center justify-between gap-2">
                <p className="font-mono text-xs font-bold text-[#0b3d2e]">
                  Poin masuk ke <span className="text-[#167052]">{namaMember}</span>
                </p>
                {onCariMember && (
                  <button
                    type="button"
                    onClick={onCariMember}
                    className="shrink-0 font-mono text-[10.5px] font-bold text-[#527867] underline"
                  >
                    Ganti
                  </button>
                )}
              </div>
            ) : (
              <div className="space-y-2">
                <p className="text-[11.5px] font-bold leading-relaxed text-amber-900">
                  Tamunya member? Lekatkan <b>sekarang</b>.
                </p>
                {/*
                  Peringatan, bukan ajakan. Poin dihitung dari nota yang
                  dilunasi, jadi member yang baru dilekatkan SESUDAH tombol
                  bayar ditekan tidak akan pernah mendapat poin transaksi ini —
                  dan tamunya baru sadar berhari-hari kemudian, saat poinnya
                  kurang dan tidak ada yang bisa menjelaskan kenapa.
                */}
                <p className="text-[10.5px] leading-relaxed text-amber-800">
                  Setelah pembayaran diproses, poin transaksi ini tidak bisa
                  dimasukkan lagi ke siapa pun.
                </p>
                {onCariMember && (
                  <button
                    type="button"
                    onClick={onCariMember}
                    className="inline-flex w-full items-center justify-center gap-1.5 rounded-xl border border-emerald-800/30 bg-white py-2.5 font-mono text-[11px] font-black text-[#0b3d2e]"
                  >
                    <UserPlus size={13} /> Scan QR · Cari Nomor · Daftar Baru
                  </button>
                )}
              </div>
            )}
          </div>

          {galat && (
            <p className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-[11.5px] font-bold text-rose-800">
              {galat}
            </p>
          )}
        </div>

        <div className="border-t border-[#d8e3de] bg-[#f8faf9] px-4 py-3">
          <button
            type="button"
            disabled={!cukup || sibuk}
            onClick={() => void bayar()}
            className={`flex h-12 w-full items-center justify-center gap-2 rounded-xl text-sm font-black transition-all disabled:cursor-not-allowed disabled:opacity-45 ${
              isMochi
                ? "bg-[#c8f53a] text-[#073829] hover:bg-[#d9ff57]"
                : "bg-[#167052] text-white"
            }`}
          >
            {sibuk ? <Loader2 size={16} className="animate-spin" /> : <Banknote size={16} />}
            <span>{sibuk ? "Memproses..." : `Terima ${formatRupiah(total)} & Cetak Struk`}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
