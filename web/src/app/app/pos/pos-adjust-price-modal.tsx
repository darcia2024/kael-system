"use client";

import { useState } from "react";
import { Loader2, Tag, X } from "lucide-react";

import { adjustOrderItemPriceAction } from "@/lib/actions";
import { formatRupiah } from "@/lib/formatters";

/**
 * Mengubah harga satu baris karena permintaan pelanggan.
 *
 * Kejadian hariannya di rumah makan: "nasambur tapi dadarnya diganti ayam".
 * Menunya tetap yang itu, harganya yang berbeda. Ganti Menu tidak menjawabnya
 * — itu cuma bisa pindah ke menu lain yang sudah terdaftar — dan diskon cuma
 * bisa menurunkan, tidak pernah menaikkan.
 *
 * Alasannya wajib, dan itu menjaga dua hal sekaligus. Yang pertama uang: kasir
 * yang bisa menyetel harga apa pun tanpa jejak bisa menyetelnya Rp 0, menerima
 * tunai pelanggannya, dan lacinya tetap cocok. Yang kedua dapur: alasannya ikut
 * menempel ke catatan barisnya, jadi yang memasak ikut tahu lauknya diganti —
 * bukan cuma yang menagih.
 */

const CEPAT = [
  "Ganti lauk sesuai permintaan",
  "Porsi disesuaikan",
  "Tanpa salah satu bahan",
];

export default function PosAdjustPriceModal({
  orderId,
  orderNo,
  itemId,
  namaMenu,
  qty,
  hargaSekarang,
  onSelesai,
  onClose,
  isMochi = true,
}: {
  orderId: string;
  orderNo: string;
  itemId: string;
  namaMenu: string;
  qty: number;
  hargaSekarang: number;
  onSelesai: () => void;
  onClose: () => void;
  isMochi?: boolean;
}) {
  const [harga, setHarga] = useState<number>(hargaSekarang);
  const [alasan, setAlasan] = useState("");
  const [sibuk, setSibuk] = useState(false);
  const [galat, setGalat] = useState<string | null>(null);

  const selisih = (harga - hargaSekarang) * qty;

  const simpan = async () => {
    setSibuk(true);
    setGalat(null);
    const res = await adjustOrderItemPriceAction(orderId, itemId, harga, alasan);
    setSibuk(false);
    if (!res.ok) {
      setGalat(res.error);
      return;
    }
    onSelesai();
  };

  return (
    <div className="fixed inset-0 z-[65] flex items-end justify-center bg-[#07281e]/60 p-0 backdrop-blur-xs sm:items-center sm:p-4">
      <div className="flex max-h-[92dvh] w-full max-w-md flex-col overflow-hidden rounded-t-3xl bg-white shadow-2xl sm:rounded-3xl">
        <div className="flex items-start justify-between gap-3 border-b border-[#d8e3de] bg-[#f8faf9] px-4 py-3.5">
          <div className="min-w-0">
            <h2 className="flex items-center gap-1.5 text-base font-black text-[#0b3d2e]">
              <Tag size={17} /> Ubah Harga
            </h2>
            <p className="mt-0.5 truncate font-mono text-[11px] text-[#527867]">
              #{orderNo} · {qty}× {namaMenu}
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
          <div className="grid grid-cols-2 gap-2">
            <div className="rounded-xl bg-[#f4f7f5] px-3 py-2.5">
              <p className="font-mono text-[10.5px] text-[#527867]">Harga daftar menu</p>
              <p className="font-mono text-sm font-black text-[#527867] line-through">
                {formatRupiah(hargaSekarang)}
              </p>
            </div>
            <div className="rounded-xl bg-[#edf8f3] px-3 py-2.5">
              <p className="font-mono text-[10.5px] text-[#0b3d2e]">Harga baru</p>
              <p className="font-mono text-sm font-black text-[#0b3d2e]">{formatRupiah(harga)}</p>
            </div>
          </div>

          <label className="block">
            <span className="mb-1 block font-mono text-xs font-bold text-[#0b3d2e]">
              Harga satuan yang baru
            </span>
            <input
              type="number"
              min={0}
              step={500}
              value={harga}
              onChange={(e) => setHarga(Number(e.target.value) || 0)}
              className="h-11 w-full rounded-xl border border-[#d8e3de] px-3 text-right font-mono text-lg font-black text-[#0b3d2e] focus:border-[#167052] focus:outline-none"
            />
          </label>

          {selisih !== 0 && (
            <div
              className={`flex items-center justify-between rounded-xl px-3.5 py-2.5 ${
                selisih > 0 ? "bg-[#edf8f3]" : "bg-amber-50"
              }`}
            >
              <span className="font-mono text-xs font-bold text-[#0b3d2e]">
                {selisih > 0 ? "Tagihan bertambah" : "Tagihan berkurang"}
                {qty > 1 ? ` (${qty} porsi)` : ""}
              </span>
              <span className="font-mono text-sm font-black text-[#0b3d2e]">
                {selisih > 0 ? "+" : "−"}
                {formatRupiah(Math.abs(selisih))}
              </span>
            </div>
          )}

          <div>
            <p className="mb-1.5 font-mono text-xs font-bold text-[#0b3d2e]">
              Kenapa harganya beda? <span className="text-rose-700">wajib</span>
            </p>
            {/*
              Keterangan ini ikut tercetak di tiket dapur, bukan cuma tersimpan
              untuk owner. Yang memasak perlu tahu lauknya diganti — kalau tidak,
              yang keluar tetap yang lama dan pelanggannya komplain.
            */}
            <div className="mb-1.5 flex flex-wrap gap-1.5">
              {CEPAT.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setAlasan(c)}
                  className="rounded-lg border border-[#d8e3de] bg-white px-2.5 py-1.5 text-[10.5px] font-bold text-[#2f4b3f] hover:bg-[#f8faf9]"
                >
                  {c}
                </button>
              ))}
            </div>
            <input
              type="text"
              value={alasan}
              onChange={(e) => setAlasan(e.target.value)}
              placeholder="Contoh: dadar diganti ayam"
              className="h-11 w-full rounded-xl border border-[#d8e3de] px-3 text-xs focus:border-[#167052] focus:outline-none"
            />
            <p className="mt-1 text-[10.5px] leading-relaxed text-[#527867]">
              Ikut tercetak di tiket dapur dan struk, dan tercatat atas namamu.
            </p>
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
            disabled={sibuk || harga === hargaSekarang || alasan.trim().length < 3}
            onClick={() => void simpan()}
            className={`flex h-12 w-full items-center justify-center gap-2 rounded-xl text-sm font-black transition-all disabled:cursor-not-allowed disabled:opacity-45 ${
              isMochi ? "bg-[#0b3d2e] text-[#c8f53a] hover:bg-[#124d3a]" : "bg-[#167052] text-white"
            }`}
          >
            {sibuk ? <Loader2 size={16} className="animate-spin" /> : <Tag size={16} />}
            <span>{sibuk ? "Menyimpan..." : "Simpan Harga Baru"}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
