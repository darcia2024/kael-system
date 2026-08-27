"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { X, Check, Ban, Loader2, Clock, AlertTriangle, ChefHat } from "lucide-react";

import {
  confirmPaymentAction,
  markPaymentFailedAction,
  setFulfillmentAction,
} from "@/lib/actions";
import {
  serviceTypeLabel,
  PAYMENT_STATUS_LABEL,
  FULFILLMENT_FLOW,
} from "@/lib/pos-engine";
import { formatRupiah } from "@/lib/formatters";
import type { Order, OrderItem } from "@/lib/types";

type Antrean = Order & { items: OrderItem[] };

/**
 * Antrean pesanan swalayan di layar kasir.
 *
 * Sebelumnya bagian ini hanya berupa lencana berisi angka yang, ketika ditekan,
 * memunculkan alert(). Tidak ada satu pun layar untuk benar-benar melihat
 * pesanannya, apalagi memprosesnya — jadi pesanan dari meja praktis tidak
 * pernah sampai ke kasir.
 *
 * Kasir TIDAK memilih metode pembayaran di sini. Pelanggan sudah memilihnya
 * sendiri dari HP-nya, dan menanyakannya ulang berarti meminta orang yang sama
 * membayar dua kali. Yang dikerjakan kasir cuma satu hal yang memang tidak bisa
 * diketahui sistem: apakah uangnya sudah benar-benar masuk.
 */
export default function OrderQueue({
  orders,
  onClose,
}: {
  orders: Antrean[];
  onClose: () => void;
}) {
  const router = useRouter();
  const [sibuk, setSibuk] = useState<string | null>(null);
  const [galat, setGalat] = useState<string | null>(null);

  const jalankan = async (id: string, fn: () => Promise<{ ok: boolean; error?: string }>) => {
    setSibuk(id);
    setGalat(null);
    const res = await fn();
    setSibuk(null);
    if (!res.ok) {
      setGalat(res.error ?? "Gagal memproses pesanan.");
      return;
    }
    router.refresh();
  };

  const menunggu = orders.filter((o) => o.payment_status === "pending");
  const diproses = orders.filter((o) => o.payment_status === "paid");

  return (
    <div className="fixed inset-0 z-50 bg-[#232331]/60 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="w-full sm:max-w-lg max-h-[92vh] overflow-y-auto rounded-t-3xl sm:rounded-3xl border-2 border-[#232331] bg-white shadow-ink-lg">
        <div className="sticky top-0 z-10 flex items-center justify-between gap-3 border-b-2 border-[#232331] bg-white px-5 py-3.5">
          <div>
            <h2 className="font-black text-base">Pesanan Masuk</h2>
            <p className="font-mono text-[11px] text-[#7b7b8e]">
              {menunggu.length} menunggu pembayaran · {diproses.length} diproses
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-9 w-9 items-center justify-center rounded-xl border border-[#232331] bg-[#fcfcfe] shadow-ink-xs"
          >
            <X size={16} />
          </button>
        </div>

        <div className="p-4 space-y-3">
          {galat && (
            <div className="flex items-start gap-2 rounded-xl border border-[#c0392b] bg-[#fdeeec] px-3 py-2 text-[#c0392b]">
              <AlertTriangle size={14} className="shrink-0 mt-0.5" />
              <p className="font-mono text-[11px] font-bold">{galat}</p>
            </div>
          )}

          {orders.length === 0 && (
            <div className="rounded-2xl border-2 border-dashed border-[#c9c9d4] p-10 text-center">
              <Clock size={26} className="mx-auto text-[#c9c9d4]" />
              <p className="font-mono text-xs text-[#7b7b8e] mt-2">
                Belum ada pesanan masuk dari meja.
              </p>
            </div>
          )}

          {orders.map((o) => {
            const menungguBayar = o.payment_status === "pending";
            const busy = sibuk === o.id;

            return (
              <div
                key={o.id}
                className={`rounded-2xl border-2 p-4 space-y-3 ${
                  menungguBayar ? "border-[#b45309] bg-[#fffbeb]" : "border-[#232331] bg-white"
                }`}
              >
                <div className="flex flex-wrap items-start justify-between gap-2 border-b border-[#dedee8] pb-2.5">
                  <div>
                    <span className="font-black text-base font-mono">#{o.order_no}</span>
                    <p className="font-mono text-[11px] text-[#7b7b8e]">
                      {serviceTypeLabel(o.service_type, o.table_no)}
                    </p>
                  </div>
                  <div className="text-right">
                    <span className="font-black text-base">{formatRupiah(Number(o.total))}</span>
                    <p className="font-mono text-[11px] font-bold uppercase text-[#7958d8]">
                      {o.payment_method}
                    </p>
                  </div>
                </div>

                <ul className="font-mono text-[11px] space-y-0.5">
                  {o.items.map((i) => (
                    <li key={i.id} className="flex justify-between gap-2">
                      <span className="truncate">
                        {i.qty}× {i.name_snapshot}
                        {i.note ? <span className="text-[#7b7b8e]"> · {i.note}</span> : null}
                      </span>
                      <span className="shrink-0">{formatRupiah(Number(i.subtotal))}</span>
                    </li>
                  ))}
                </ul>

                {menungguBayar ? (
                  <div className="space-y-2 border-t border-[#dedee8] pt-2.5">
                    {/*
                      Kalimatnya menyebut apa yang harus DIPERIKSA, bukan cuma
                      meminta konfirmasi. Tombol yang ditekan tanpa mengecek
                      apa pun sama saja dengan menandai lunas otomatis.
                    */}
                    <p className="font-mono text-[11px] text-[#8a6d00]">
                      Cek mutasi masuk {formatRupiah(Number(o.total))} lebih dulu, baru tekan
                      tombol di bawah.
                    </p>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => jalankan(o.id, () => confirmPaymentAction(o.id))}
                        className="btn-tactile flex-1 inline-flex items-center justify-center gap-1.5 rounded-xl border-2 border-[#232331] bg-[#16a34a] px-3 py-2.5 font-mono text-xs font-extrabold text-white shadow-ink-xs disabled:opacity-50"
                      >
                        {busy ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />}
                        Pembayaran diterima
                      </button>
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => jalankan(o.id, () => markPaymentFailedAction(o.id))}
                        className="inline-flex items-center gap-1.5 rounded-xl border border-[#c0392b] bg-white px-3 py-2.5 font-mono text-xs font-bold text-[#c0392b] disabled:opacity-50"
                      >
                        <Ban size={13} />
                        Gagal
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-2 border-t border-[#dedee8] pt-2.5">
                    <div className="flex items-center gap-1.5 font-mono text-[11px] font-bold text-[#16a34a]">
                      <Check size={12} />
                      {PAYMENT_STATUS_LABEL[o.payment_status]}
                      {o.paid_confirmed_at ? " · dikonfirmasi kasir" : ""}
                    </div>
                    <div className="flex items-center gap-1.5">
                      <ChefHat size={13} className="shrink-0 text-[#7958d8]" />
                      <div className="flex flex-wrap gap-1.5">
                        {FULFILLMENT_FLOW.map((f) => (
                          <button
                            key={f.key}
                            type="button"
                            disabled={busy}
                            onClick={() => jalankan(o.id, () => setFulfillmentAction(o.id, f.key))}
                            className={`rounded-lg border px-2 py-1 font-mono text-[10.5px] font-bold disabled:opacity-50 ${
                              o.fulfillment_status === f.key
                                ? "border-[#232331] bg-[#232331] text-[#d9ff57]"
                                : "border-[#dedee8] bg-white text-[#7b7b8e]"
                            }`}
                          >
                            {f.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
