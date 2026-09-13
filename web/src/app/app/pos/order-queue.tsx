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
  isMochi,
}: {
  orders: Antrean[];
  onClose: () => void;
  isMochi?: boolean;
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
    <div className={`fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 backdrop-blur-xs ${
      isMochi ? "bg-[#07281e]/60" : "bg-[#232331]/60"
    }`}>
      <div className={`w-full sm:max-w-lg max-h-[92vh] overflow-y-auto rounded-t-3xl sm:rounded-3xl bg-white ${
        isMochi ? "border border-[#d8e3de] shadow-2xl" : "border-2 border-[#232331] shadow-ink-lg"
      }`}>
        <div className={`sticky top-0 z-10 flex items-center justify-between gap-3 bg-white px-5 py-3.5 border-b ${
          isMochi ? "border-[#d8e3de]" : "border-b-2 border-[#232331]"
        }`}>
          <div>
            <h2 className={`font-black text-base ${isMochi ? "text-[#0b3d2e]" : "text-[#232331]"}`}>Pesanan Masuk</h2>
            <p className="font-mono text-[11px] text-[#7b7b8e]">
              {menunggu.length} menunggu pembayaran · {diproses.length} diproses
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className={`flex h-9 w-9 items-center justify-center rounded-xl border transition-colors ${
              isMochi
                ? "border-[#d8e3de] bg-[#f0f5f2] text-[#0b3d2e] hover:bg-[#e2ede7]"
                : "border-[#232331] bg-[#fcfcfe] shadow-ink-xs"
            }`}
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
            <div className={`rounded-2xl border-2 border-dashed p-10 text-center ${
              isMochi ? "border-[#ccd9d3] bg-[#f8faf9]" : "border-[#c9c9d4]"
            }`}>
              <Clock size={26} className={`mx-auto ${isMochi ? "text-[#8fa399]" : "text-[#c9c9d4]"}`} />
              <p className="font-mono text-xs text-[#7b8882] mt-2">
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
                className={`rounded-2xl p-4 space-y-3 ${
                  isMochi
                    ? menungguBayar
                      ? "border border-amber-300/80 bg-amber-50/70"
                      : "border border-[#d8e3de] bg-white shadow-xs"
                    : menungguBayar
                      ? "border-2 border-[#b45309] bg-[#fffbeb]"
                      : "border-2 border-[#232331] bg-white"
                }`}
              >
                <div className={`flex flex-wrap items-start justify-between gap-2 border-b pb-2.5 ${
                  isMochi ? "border-[#e0ebe5]" : "border-[#dedee8]"
                }`}>
                  <div>
                    <span className={`font-black text-base font-mono ${isMochi ? "text-[#0b3d2e]" : ""}`}>#{o.order_no}</span>
                    <p className="font-mono text-[11px] text-[#7b7b8e]">
                      {serviceTypeLabel(o.service_type, o.table_no)}
                    </p>
                  </div>
                  <div className="text-right">
                    <span className={`font-black text-base ${isMochi ? "text-[#0b3d2e] font-mono" : ""}`}>{formatRupiah(Number(o.total))}</span>
                    <p className={`font-mono text-[11px] font-bold uppercase ${isMochi ? "text-[#167052]" : "text-[#7958d8]"}`}>
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
                  <div className={`space-y-2 border-t pt-2.5 ${isMochi ? "border-[#e0ebe5]" : "border-[#dedee8]"}`}>
                    <p className="font-mono text-[11px] text-[#8a6d00]">
                      Cek mutasi masuk {formatRupiah(Number(o.total))} lebih dulu, baru tekan
                      tombol di bawah.
                    </p>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => jalankan(o.id, () => confirmPaymentAction(o.id))}
                        className={`flex-1 inline-flex items-center justify-center gap-1.5 rounded-xl px-3 py-2.5 font-mono text-xs font-black disabled:opacity-50 transition-all ${
                          isMochi
                            ? "bg-[#c8f53a] hover:bg-[#d9ff57] text-[#073829] shadow-xs"
                            : "btn-tactile border-2 border-[#232331] bg-[#16a34a] text-white shadow-ink-xs"
                        }`}
                      >
                        {busy ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />}
                        Uang sudah masuk
                      </button>
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => jalankan(o.id, () => markPaymentFailedAction(o.id))}
                        className={`inline-flex items-center gap-1.5 rounded-xl px-3 py-2.5 font-mono text-xs font-bold disabled:opacity-50 ${
                          isMochi
                            ? "border border-rose-200 bg-white text-rose-700 hover:bg-rose-50"
                            : "border border-[#c0392b] bg-white text-[#c0392b]"
                        }`}
                      >
                        <Ban size={13} />
                        Gagal
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className={`space-y-2 border-t pt-2.5 ${isMochi ? "border-[#e0ebe5]" : "border-[#dedee8]"}`}>
                    <div className="flex items-center gap-1.5 font-mono text-[11px] font-bold text-[#16a34a]">
                      <Check size={12} />
                      {PAYMENT_STATUS_LABEL[o.payment_status]}
                      {o.paid_confirmed_at ? " · dikonfirmasi kasir" : ""}
                    </div>
                    <div className="flex items-center gap-1.5">
                      <ChefHat size={13} className={`shrink-0 ${isMochi ? "text-[#167052]" : "text-[#7958d8]"}`} />
                      <div className="flex flex-wrap gap-1.5">
                        {FULFILLMENT_FLOW.map((f) => (
                          <button
                            key={f.key}
                            type="button"
                            disabled={busy}
                            onClick={() => jalankan(o.id, () => setFulfillmentAction(o.id, f.key))}
                            className={`rounded-lg border px-2 py-1 font-mono text-[10.5px] font-bold disabled:opacity-50 transition-colors ${
                              o.fulfillment_status === f.key
                                ? (isMochi ? "border-[#0b3d2e] bg-[#0b3d2e] text-[#c8f53a]" : "border-[#232331] bg-[#232331] text-[#d9ff57]")
                                : (isMochi ? "border-[#d8e3de] bg-white text-[#526159] hover:bg-[#edf8f3]" : "border-[#dedee8] bg-white text-[#7b7b8e]")
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
