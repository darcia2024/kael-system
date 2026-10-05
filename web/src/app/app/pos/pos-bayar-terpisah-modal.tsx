"use client";

import { useMemo, useState } from "react";
import { Banknote, CheckCircle2, CheckSquare, CreditCard, Loader2, Minus, Plus, Smartphone, Square, X } from "lucide-react";

import { formatRupiah } from "@/lib/formatters";
import { hitungBayarTerpisah, type PilihanBayarTerpisah } from "@/lib/bayar-terpisah";
import type { Order, OrderItem } from "@/lib/types";
import { IsianTunai } from "./pos-terima-tunai";

/**
 * Bayar terpisah: tiap tamu di satu meja membayar menunya sendiri, dengan cara
 * bayarnya sendiri.
 *
 * Dulu tombol "Bagi Tagihan" cuma mencetak struk per orang; uangnya tetap
 * dicatat SATU pembayaran untuk seluruh meja. Rombongan yang sebagian bayar
 * tunai dan sebagian QRIS tidak bisa dicatat dengan benar, dan laci tidak
 * pernah cocok. Di sini tiap tamu jadi pembayaran sungguhan dengan struknya
 * sendiri, dan sisa meja tetap terbuka sampai tamu terakhir membayar.
 *
 * Angka yang ditagih dihitung dengan fungsi yang sama dengan server
 * (lib/bayar-terpisah.ts), dan server menolak kalau tagihannya berubah sejak
 * layar ini dibuka — tamu tidak pernah ditagih angka yang berbeda dari yang
 * dilihat kasir.
 */

export type MetodeBayarTerpisah = "cash" | "qris" | "transfer";

export interface HasilBayarDiLayar {
  /** Kalimat singkat untuk kasir, mis. "#A-012 lunas · kembalian Rp 3.000". */
  pesan: string;
  sisaTagihan: number;
  lunasSemua: boolean;
}

const METODE: { nilai: MetodeBayarTerpisah; label: string; ikon: typeof Banknote }[] = [
  { nilai: "cash", label: "Tunai", ikon: Banknote },
  { nilai: "qris", label: "QRIS", ikon: Smartphone },
  { nilai: "transfer", label: "Transfer", ikon: CreditCard },
];

type Antrean = Order & { items: OrderItem[] };

export default function PosBayarTerpisahModal({
  namaMeja,
  orders,
  tarifPajak,
  tarifService,
  onBayar,
  onClose,
  isMochi = true,
}: {
  namaMeja: string;
  /** Nota meja ini. Yang sudah lunas atau batal disaring di sini. */
  orders: Antrean[];
  tarifPajak: number;
  tarifService: number;
  onBayar: (input: {
    pilihan: PilihanBayarTerpisah[];
    metode: MetodeBayarTerpisah;
    tunai: number | null;
    totalDiharapkan: number;
  }) => Promise<HasilBayarDiLayar>;
  onClose: () => void;
  isMochi?: boolean;
}) {
  const [jumlah, setJumlah] = useState<Record<string, number>>({});
  const [tahap, setTahap] = useState<"pilih" | "bayar">("pilih");
  const [metode, setMetode] = useState<MetodeBayarTerpisah>("cash");
  const [tunai, setTunai] = useState(0);
  const [sibuk, setSibuk] = useState(false);
  const [galat, setGalat] = useState<string | null>(null);
  const [terakhir, setTerakhir] = useState<HasilBayarDiLayar | null>(null);

  const belumLunas = useMemo(
    () =>
      orders
        .filter((o) => o.payment_status === "pending" && o.status !== "cancelled")
        .map((o) => ({ ...o, items: o.items.filter((i) => !i.cancelled_at) }))
        .filter((o) => o.items.length > 0),
    [orders],
  );

  const pilihan: PilihanBayarTerpisah[] = useMemo(
    () => Object.entries(jumlah).filter(([, q]) => q > 0).map(([itemId, qty]) => ({ itemId, qty })),
    [jumlah],
  );

  const hitung = useMemo(() => {
    if (!pilihan.length) return null;
    return hitungBayarTerpisah(
      belumLunas.map((o) => ({
        id: o.id,
        discount: Number(o.discount) || 0,
        deliveryFee: Number(o.delivery_fee) || 0,
        items: o.items.map((i) => ({ id: i.id, price: Number(i.price_snapshot), qty: Number(i.qty) })),
      })),
      pilihan,
      tarifPajak,
      tarifService,
    );
  }, [belumLunas, pilihan, tarifPajak, tarifService]);

  const total = hitung?.ok ? hitung.bagian.total : 0;
  const sisaMeja = belumLunas.reduce((n, o) => n + Number(o.total), 0);
  const mejaLunas = belumLunas.length === 0;

  const ubah = (itemId: string, qty: number) => setJumlah((lama) => ({ ...lama, [itemId]: qty }));

  const lanjut = () => {
    if (!hitung?.ok) return;
    setTunai(hitung.bagian.total);
    setMetode("cash");
    setGalat(null);
    setTahap("bayar");
  };

  const bayar = async () => {
    if (!hitung?.ok || sibuk) return;
    if (metode === "cash" && tunai < total) return;
    setSibuk(true);
    setGalat(null);
    try {
      const hasil = await onBayar({
        pilihan,
        metode,
        tunai: metode === "cash" ? tunai : null,
        totalDiharapkan: total,
      });
      setTerakhir(hasil);
      setJumlah({});
      setTahap("pilih");
    } catch (e) {
      setGalat(e instanceof Error ? e.message : "Pembayaran gagal diproses.");
    } finally {
      setSibuk(false);
    }
  };

  const warnaUtama = isMochi
    ? "bg-[#0b3d2e] text-[#c8f53a] hover:bg-[#124d3a]"
    : "border-2 border-[#232331] bg-[#d9ff57] text-[#232331]";

  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center bg-[#07281e]/60 p-0 backdrop-blur-xs sm:items-center sm:p-4">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="judul-bayar-terpisah"
        className="flex max-h-[92dvh] w-full max-w-lg flex-col overflow-hidden rounded-t-3xl bg-white shadow-2xl sm:rounded-3xl"
      >
        <div className="flex items-start justify-between gap-3 border-b border-[#d8e3de] bg-[#f8faf9] px-4 py-3.5">
          <div className="min-w-0">
            <h2 id="judul-bayar-terpisah" className="text-base font-black text-[#0b3d2e]">
              Bayar Terpisah
            </h2>
            <p className="mt-0.5 font-mono text-[11px] text-[#527867]">
              {namaMeja} · sisa tagihan {formatRupiah(sisaMeja)}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={sibuk}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-[#d8e3de] bg-white text-[#527867]"
            aria-label="Tutup"
          >
            <X size={16} />
          </button>
        </div>

        {terakhir && (
          <div className="flex items-start gap-2 border-b border-emerald-200 bg-[#edf8f3] px-4 py-2.5 text-[12px] font-bold text-[#0b3d2e]">
            <CheckCircle2 size={16} className="mt-0.5 shrink-0 text-emerald-700" />
            <span>{terakhir.pesan}</span>
          </div>
        )}

        {mejaLunas ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-3 px-6 py-10 text-center">
            <CheckCircle2 size={36} className="text-emerald-600" />
            <p className="text-sm font-black text-[#0b3d2e]">Tagihan meja ini sudah lunas semua.</p>
            <button type="button" onClick={onClose} className={`rounded-xl px-5 py-2.5 text-xs font-black ${warnaUtama}`}>
              Selesai
            </button>
          </div>
        ) : tahap === "pilih" ? (
          <>
            <p className="border-b border-[#edf2ef] px-4 py-2 text-[11px] leading-relaxed text-[#2f4b3f]">
              Centang menu milik <b>satu tamu</b>, lalu bayar. Tamu berikutnya menyusul sesudahnya. Menu
              yang dipesan lebih dari satu bisa dibayar sebagian.
            </p>

            <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3">
              <ul className="space-y-1.5">
                {belumLunas.flatMap((o) =>
                  o.items.map((item) => {
                    const ambil = jumlah[item.id] ?? 0;
                    const dipilih = ambil > 0;
                    const harga = Number(item.price_snapshot);
                    return (
                      <li
                        key={item.id}
                        className={`rounded-2xl border px-3 py-2.5 transition-all ${
                          dipilih ? "border-[#0b3d2e] bg-[#edf8f3]" : "border-[#d8e3de] bg-white"
                        }`}
                      >
                        <button
                          type="button"
                          onClick={() => ubah(item.id, dipilih ? 0 : Number(item.qty))}
                          className="flex w-full items-center gap-2.5 text-left"
                        >
                          <span className="shrink-0 text-[#0b3d2e]">
                            {dipilih ? <CheckSquare size={17} /> : <Square size={17} />}
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-xs font-bold text-[#0b3d2e]">
                              {item.qty}× {item.name_snapshot}
                            </span>
                            <span className="block font-mono text-[10px] text-[#52665e]">
                              #{o.order_no} · {formatRupiah(harga)}/porsi
                              {item.note ? ` · ${item.note}` : ""}
                            </span>
                          </span>
                          <span className="shrink-0 text-xs font-black text-[#0b3d2e]">
                            {formatRupiah(harga * (dipilih ? ambil : Number(item.qty)))}
                          </span>
                        </button>

                        {dipilih && Number(item.qty) > 1 && (
                          <div className="mt-2 flex items-center justify-end gap-2 font-mono text-[11px] font-bold text-[#0b3d2e]">
                            <span className="mr-auto pl-7 text-[#52665e]">Dibayar tamu ini:</span>
                            <button
                              type="button"
                              onClick={() => ubah(item.id, Math.max(1, ambil - 1))}
                              disabled={ambil <= 1}
                              aria-label="Kurangi"
                              className="flex h-7 w-7 items-center justify-center rounded-lg border border-[#d8e3de] bg-white disabled:opacity-40"
                            >
                              <Minus size={13} />
                            </button>
                            <span className="w-12 text-center">
                              {ambil} / {item.qty}
                            </span>
                            <button
                              type="button"
                              onClick={() => ubah(item.id, Math.min(Number(item.qty), ambil + 1))}
                              disabled={ambil >= Number(item.qty)}
                              aria-label="Tambah"
                              className="flex h-7 w-7 items-center justify-center rounded-lg border border-[#d8e3de] bg-white disabled:opacity-40"
                            >
                              <Plus size={13} />
                            </button>
                          </div>
                        )}
                      </li>
                    );
                  }),
                )}
              </ul>
            </div>

            <div className="space-y-2 border-t border-[#d8e3de] bg-[#f8faf9] px-4 py-3">
              {hitung && !hitung.ok && (
                <p className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-[11.5px] font-bold text-rose-800">
                  {hitung.error}
                </p>
              )}
              {hitung?.ok && hitung.semuaTerpilih && (
                <p className="text-[11px] leading-relaxed text-[#2f4b3f]">
                  Ini seluruh sisa meja — dicatat sebagai lunas meja.
                </p>
              )}
              {hitung?.ok && (hitung.bagian.tax > 0 || hitung.bagian.serviceCharge > 0 || hitung.bagian.discount > 0) && (
                <p className="font-mono text-[10.5px] text-[#52665e]">
                  Menu {formatRupiah(hitung.bagian.subtotal)}
                  {hitung.bagian.discount > 0 ? ` · diskon -${formatRupiah(hitung.bagian.discount)}` : ""}
                  {hitung.bagian.serviceCharge > 0 ? ` · service ${formatRupiah(hitung.bagian.serviceCharge)}` : ""}
                  {hitung.bagian.tax > 0 ? ` · pajak ${formatRupiah(hitung.bagian.tax)}` : ""}
                </p>
              )}
              <button
                type="button"
                disabled={!hitung?.ok}
                onClick={lanjut}
                className={`flex w-full items-center justify-center gap-2 rounded-xl py-3 text-sm font-black transition-all disabled:opacity-45 ${warnaUtama}`}
              >
                {hitung?.ok ? `Lanjut bayar · ${formatRupiah(total)}` : "Centang menu tamu ini dulu"}
              </button>
            </div>
          </>
        ) : (
          <>
            <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-4 py-4">
              <div className="rounded-2xl bg-[#0b3d2e] px-4 py-3.5 text-center">
                <p className="font-mono text-[10.5px] uppercase tracking-wider text-emerald-200/80">
                  Tagihan tamu ini · {pilihan.reduce((n, p) => n + p.qty, 0)} porsi
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

              {metode === "cash" && <IsianTunai total={total} tunai={tunai} onUbah={setTunai} />}

              {galat && (
                <p className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-[11.5px] font-bold text-rose-800">
                  {galat}
                </p>
              )}
            </div>

            <div className="flex gap-2 border-t border-[#d8e3de] bg-[#f8faf9] px-4 py-3 pb-[calc(0.75rem_+_env(safe-area-inset-bottom))] sm:pb-3">
              <button
                type="button"
                onClick={() => setTahap("pilih")}
                disabled={sibuk}
                className="rounded-xl border border-[#d8e3de] bg-white px-4 text-xs font-bold text-[#527867]"
              >
                Kembali
              </button>
              <button
                type="button"
                disabled={sibuk || (metode === "cash" && tunai < total)}
                onClick={() => void bayar()}
                className={`flex h-12 flex-1 items-center justify-center gap-2 rounded-xl text-sm font-black transition-all disabled:cursor-not-allowed disabled:opacity-45 ${
                  isMochi ? "bg-[#c8f53a] text-[#073829] hover:bg-[#d9ff57]" : "bg-[#167052] text-white"
                }`}
              >
                {sibuk ? <Loader2 size={16} className="animate-spin" /> : <Banknote size={16} />}
                <span>{sibuk ? "Memproses..." : `Terima ${formatRupiah(total)} & Cetak Struk`}</span>
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
