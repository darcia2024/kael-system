"use client";

import { useMemo, useState } from "react";
import { CheckSquare, Printer, Receipt, Square, X } from "lucide-react";

import { formatRupiah } from "@/lib/formatters";

/**
 * Bagi tagihan satu meja jadi beberapa struk.
 *
 * Tamu rombongan sering minta struk sendiri-sendiri untuk menu yang mereka
 * pesan — buat patungan, atau buat diklaim ke kantor. Sebelum ini kasir cuma
 * punya satu tombol: cetak tagihan seluruh meja. Jadi rombongan enam orang
 * dilayani dengan satu lembar yang dioper-oper dan dihitung manual di atas
 * meja.
 *
 * Dua hal yang dijaga di layar ini, dan dua-duanya soal uang:
 *
 *   1. Tidak ada menu yang kelewat. Yang sudah dicetak ditandai, dan sisa
 *      tagihan yang belum kebagian struk selalu terlihat di bawah. Kasir tahu
 *      persis kapan mejanya benar-benar habis terbagi.
 *
 *   2. Tidak ada bagian yang disangka tagihan penuh. Tiap struk bagian memuat
 *      total seluruh meja di sampingnya.
 *
 * Yang dibagi di sini CUMA cetakannya. Pencatatan uangnya tetap satu nota utuh
 * seperti aslinya — memecah transaksinya jadi beberapa pembayaran itu urusan
 * lain, dan menyentuhnya diam-diam bakal bikin laporan penjualan tidak cocok.
 */

export type ItemBagiTagihan = {
  id: string;
  nama: string;
  qty: number;
  harga: number;
  subtotal: number;
  catatan?: string | null;
  orderNo: string;
};

export default function PosSplitBillModal({
  namaMeja,
  totalMeja,
  items,
  onCetak,
  onClose,
  isMochi = true,
}: {
  namaMeja: string;
  totalMeja: number;
  items: ItemBagiTagihan[];
  /** Mencetak satu bagian. `bagianKe` dipakai sebagai penomoran di struknya. */
  onCetak: (
    itemTerpilih: ItemBagiTagihan[],
    totalBagian: number,
    bagianKe: number,
  ) => Promise<void> | void;
  onClose: () => void;
  isMochi?: boolean;
}) {
  const [terpilih, setTerpilih] = useState<Set<string>>(new Set());
  const [sudahDicetak, setSudahDicetak] = useState<Set<string>>(new Set());
  const [bagianKe, setBagianKe] = useState(1);
  const [sibuk, setSibuk] = useState(false);

  const belumDicetak = useMemo(
    () => items.filter((i) => !sudahDicetak.has(i.id)),
    [items, sudahDicetak],
  );

  const totalTerpilih = useMemo(
    () => items.filter((i) => terpilih.has(i.id)).reduce((n, i) => n + i.subtotal, 0),
    [items, terpilih],
  );

  const sisaTagihan = useMemo(
    () => belumDicetak.reduce((n, i) => n + i.subtotal, 0),
    [belumDicetak],
  );

  const pilih = (id: string) => {
    setTerpilih((lama) => {
      const baru = new Set(lama);
      if (baru.has(id)) baru.delete(id);
      else baru.add(id);
      return baru;
    });
  };

  const cetakBagian = async (daftar: ItemBagiTagihan[], nomor: number) => {
    if (!daftar.length) return;
    const total = daftar.reduce((n, i) => n + i.subtotal, 0);
    await onCetak(daftar, total, nomor);
    setSudahDicetak((lama) => {
      const baru = new Set(lama);
      for (const i of daftar) baru.add(i.id);
      return baru;
    });
  };

  const cetakTerpilih = async () => {
    const daftar = items.filter((i) => terpilih.has(i.id));
    if (!daftar.length) return;
    setSibuk(true);
    try {
      await cetakBagian(daftar, bagianKe);
      setBagianKe((n) => n + 1);
      setTerpilih(new Set());
    } finally {
      setSibuk(false);
    }
  };

  /**
   * Satu struk untuk tiap menu, sekali tekan.
   *
   * Ini bentuk paling sering diminta rombongan: tiap orang pesan satu, jadi
   * satu menu memang berarti satu orang. Dicetak berurutan dan ditunggu satu
   * per satu supaya kegagalan di tengah tidak menenggelamkan sisanya.
   */
  const cetakSatuPerMenu = async () => {
    if (!belumDicetak.length) return;
    setSibuk(true);
    try {
      let nomor = bagianKe;
      for (const item of belumDicetak) {
        await cetakBagian([item], nomor);
        nomor += 1;
      }
      setBagianKe(nomor);
      setTerpilih(new Set());
    } finally {
      setSibuk(false);
    }
  };

  const sudahSemua = belumDicetak.length === 0;

  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center bg-[#07281e]/60 p-0 backdrop-blur-xs sm:items-center sm:p-4">
      <div className="flex max-h-[92dvh] w-full max-w-lg flex-col overflow-hidden rounded-t-3xl bg-white shadow-2xl sm:rounded-3xl">
        {/* Kepala */}
        <div className="flex items-start justify-between gap-3 border-b border-[#d8e3de] bg-[#f8faf9] px-4 py-3.5">
          <div className="min-w-0">
            <h2 className="flex items-center gap-1.5 text-base font-black text-[#0b3d2e]">
              <Receipt size={17} /> Bagi Tagihan
            </h2>
            <p className="mt-0.5 font-mono text-[11px] text-[#527867]">
              {namaMeja} · total {formatRupiah(totalMeja)}
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

        <p className="border-b border-[#edf2ef] bg-[#edf8f3] px-4 py-2 text-[11px] leading-relaxed text-[#0b3d2e]">
          Centang menu milik satu orang, lalu cetak. Yang sudah dicetak ditandai,
          jadi tidak ada yang kelewat maupun dobel. <b>Pencatatan uangnya tetap
          satu nota</b> — ini membagi struknya, bukan transaksinya.
        </p>

        {/* Daftar menu */}
        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3">
          <ul className="space-y-1.5">
            {items.map((item) => {
              const dicetak = sudahDicetak.has(item.id);
              const dipilih = terpilih.has(item.id);
              return (
                <li key={item.id}>
                  <button
                    type="button"
                    disabled={dicetak || sibuk}
                    onClick={() => pilih(item.id)}
                    className={`flex w-full items-center gap-2.5 rounded-2xl border px-3 py-2.5 text-left transition-all ${
                      dicetak
                        ? "border-[#e3ece8] bg-[#f4f7f5] opacity-55"
                        : dipilih
                          ? "border-[#0b3d2e] bg-[#edf8f3]"
                          : "border-[#d8e3de] bg-white hover:bg-[#f8faf9]"
                    }`}
                  >
                    <span className="shrink-0 text-[#0b3d2e]">
                      {dipilih ? <CheckSquare size={17} /> : <Square size={17} />}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-xs font-bold text-[#0b3d2e]">
                        {item.qty}× {item.nama}
                      </span>
                      <span className="block font-mono text-[10px] text-[#718078]">
                        #{item.orderNo}
                        {item.catatan ? ` · ${item.catatan}` : ""}
                        {dicetak ? " · sudah dicetak" : ""}
                      </span>
                    </span>
                    <span className="shrink-0 text-xs font-black text-[#0b3d2e]">
                      {formatRupiah(item.subtotal)}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </div>

        {/* Kaki */}
        <div className="space-y-2 border-t border-[#d8e3de] bg-[#f8faf9] px-4 py-3">
          <div className="flex items-center justify-between font-mono text-[11px]">
            <span className="text-[#527867]">
              {sudahSemua ? (
                <b className="text-emerald-700">Semua menu sudah kebagian struk ✓</b>
              ) : (
                <>
                  Sisa belum dicetak:{" "}
                  <b className="text-[#0b3d2e]">{formatRupiah(sisaTagihan)}</b>{" "}
                  ({belumDicetak.length} menu)
                </>
              )}
            </span>
            {terpilih.size > 0 && (
              <span className="font-black text-[#0b3d2e]">{formatRupiah(totalTerpilih)}</span>
            )}
          </div>

          <button
            type="button"
            disabled={terpilih.size === 0 || sibuk}
            onClick={() => void cetakTerpilih()}
            className={`flex w-full items-center justify-center gap-2 rounded-xl py-3 text-xs font-black transition-all disabled:opacity-45 ${
              isMochi
                ? "bg-[#0b3d2e] text-[#c8f53a] hover:bg-[#124d3a]"
                : "border-2 border-[#232331] bg-[#d9ff57] text-[#232331]"
            }`}
          >
            <Printer size={15} />
            <span>
              {terpilih.size === 0
                ? "Centang menu dulu"
                : `Cetak Bagian ${bagianKe} · ${terpilih.size} menu`}
            </span>
          </button>

          <button
            type="button"
            disabled={sudahSemua || sibuk}
            onClick={() => void cetakSatuPerMenu()}
            className="flex w-full items-center justify-center gap-2 rounded-xl border border-emerald-800/30 bg-white py-2.5 text-[11px] font-black text-[#0b3d2e] transition-all hover:bg-[#edf8f3] disabled:opacity-45"
          >
            <Receipt size={14} />
            <span>Cetak Satu Struk per Menu ({belumDicetak.length})</span>
          </button>
        </div>
      </div>
    </div>
  );
}
