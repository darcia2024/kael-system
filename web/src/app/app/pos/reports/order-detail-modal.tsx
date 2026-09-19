"use client";

import { X, Receipt, ShoppingBag, ArrowUpRight, User, MapPin, Phone, RotateCcw } from "lucide-react";
import type { Order } from "@/lib/types";
import { formatRupiah, formatBusinessDateTime } from "@/lib/formatters";
import { serviceTypeLabel } from "@/lib/pos-engine";
import Link from "next/link";

export default function OrderDetailModal({
  order,
  isOpen,
  onClose,
  onOpenRefund,
  isMochi = false,
}: {
  order: Order | null;
  isOpen: boolean;
  onClose: () => void;
  onOpenRefund?: (order: Order) => void;
  isMochi?: boolean;
}) {
  if (!isOpen || !order) return null;

  const items = order.items || [];
  const hasRefund = Number(order.refund_total ?? 0) > 0;
  const netTotal = Math.max(0, Number(order.total) - Number(order.refund_total ?? 0));
  const canRefund = order.status === "paid" && Number(order.refund_total ?? 0) < Number(order.total);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-3 sm:p-4 backdrop-blur-xs animate-in fade-in-50">
      {/* Backdrop click to close */}
      <div className="fixed inset-0" onClick={onClose} />

      <div className="relative w-full max-w-lg rounded-3xl bg-white text-[#1c2d26] shadow-2xl overflow-hidden flex flex-col max-h-[90vh] border border-[#d8e3de] animate-in zoom-in-95 z-10">
        
        {/* Header Modal */}
        <div
          className={`flex items-start justify-between border-b p-4 sm:p-5 text-white ${
            isMochi
              ? "border-[#07281e] bg-gradient-to-r from-[#0b3d2e] to-[#144f3d]"
              : "border-[#232331] bg-[#232331]"
          }`}
        >
          <div className="flex items-start gap-3 min-w-0">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-white/15 text-[#c8f53a] shadow-xs">
              <ShoppingBag size={20} />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-base sm:text-lg font-black tracking-tight text-white">
                  Pesanan #{order.order_no}
                </h2>
                <span
                  className={`inline-flex items-center rounded-full px-2 py-0.5 font-mono text-[9.5px] font-black uppercase ${
                    hasRefund
                      ? "bg-rose-500 text-white"
                      : order.status === "paid"
                      ? "bg-[#c8f53a] text-[#073829]"
                      : "bg-amber-400 text-amber-950"
                  }`}
                >
                  {hasRefund ? `REFUND ${formatRupiah(order.refund_total ?? 0)}` : order.status === "paid" ? "LUNAS" : order.status.toUpperCase()}
                </span>
              </div>
              <p className="text-[11px] text-emerald-100/90 font-mono mt-0.5 truncate">
                {serviceTypeLabel(order.service_type, order.table_no)} · {formatBusinessDateTime(order.created_at)}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Tutup"
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-white/10 text-white hover:bg-white/20 transition-colors"
          >
            <X size={17} />
          </button>
        </div>

        {/* Scrollable Content Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4 font-sans text-xs">
          
          {/* Metadata Pelanggan / Delivery Info */}
          {(order.customer_name || order.delivery_name || order.table_no) && (
            <div className="rounded-2xl border border-[#d8e3de] bg-[#f8faf9] p-3 space-y-1.5 font-mono">
              <div className="flex items-center justify-between">
                <span className="text-[10px] uppercase font-bold text-[#637970]">Info Pemesan / Meja</span>
                <span className="rounded bg-emerald-100 text-[#0b3d2e] px-1.5 py-0.2 text-[9.5px] font-bold">
                  {order.channel === "qr" ? "Order via QR Meja" : "Input Kasir"}
                </span>
              </div>
              <div className="text-xs font-black text-[#0b3d2e] flex items-center gap-1.5">
                <User size={13} className="text-[#167052]" />
                <span>{order.customer_name || order.delivery_name || `Meja ${order.table_no || "-"}`}</span>
              </div>
              {order.delivery_phone && (
                <div className="text-[11px] text-[#526159] flex items-center gap-1.5">
                  <Phone size={12} className="text-[#637970]" />
                  <span>{order.delivery_phone}</span>
                </div>
              )}
              {order.delivery_address && (
                <div className="text-[11px] text-[#526159] flex items-start gap-1.5 pt-0.5">
                  <MapPin size={12} className="text-[#637970] shrink-0 mt-0.5" />
                  <span className="line-clamp-2">{order.delivery_address}</span>
                </div>
              )}
            </div>
          )}

          {/* Daftar Menu / Item Dipesan */}
          <div className="space-y-2">
            <div className="flex items-center justify-between pb-1 border-b border-[#edf2ef]">
              <span className="font-mono text-[11px] font-black uppercase text-[#0b3d2e]">
                Menu Dipesan ({items.length} item)
              </span>
              <span className="font-mono text-[10px] text-[#637970]">Subtotal Item</span>
            </div>

            {items.length > 0 ? (
              <div className="divide-y divide-[#f0f4f2] rounded-2xl border border-[#d8e3de] bg-white overflow-hidden">
                {items.map((item, idx) => {
                  const isCancelled = Boolean(item.cancelled_at);
                  return (
                    <div
                      key={item.id || idx}
                      className={`p-3 flex items-start justify-between gap-3 ${
                        isCancelled ? "bg-rose-50/60 opacity-60" : "hover:bg-[#fbfdfc]"
                      }`}
                    >
                      <div className="min-w-0 flex-1 space-y-0.5">
                        <div className="flex items-center gap-2">
                          <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-md bg-[#edf8f3] text-[#0b3d2e] font-mono text-[11px] font-black">
                            {item.qty}x
                          </span>
                          <span className={`font-bold text-xs ${isCancelled ? "line-through text-rose-800" : "text-[#0b3d2e]"}`}>
                            {item.name_snapshot}
                          </span>
                          {isCancelled && (
                            <span className="rounded bg-rose-200 px-1 py-0.2 font-mono text-[9px] font-bold text-rose-800">
                              Dibatalkan
                            </span>
                          )}
                        </div>
                        <div className="pl-7 font-mono text-[10.5px] text-[#637970]">
                          @{formatRupiah(item.price_snapshot)}
                        </div>
                        {item.note && (
                          <p className="pl-7 text-[10.5px] italic text-amber-800 bg-amber-50/80 rounded px-1.5 py-0.5 mt-1 inline-block">
                            Catatan: {item.note}
                          </p>
                        )}
                      </div>

                      <div className="text-right font-mono font-black text-xs text-[#0b3d2e] shrink-0 pt-0.5">
                        {formatRupiah(item.subtotal || item.qty * item.price_snapshot)}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="p-4 text-center text-xs text-[#637970] rounded-2xl border border-dashed border-[#d8e3de] bg-[#fbfdfc]">
                Tidak ada data rincian item.
              </p>
            )}
          </div>

          {/* Ringkasan Perhitungan Biaya */}
          <div className="rounded-2xl border border-[#d8e3de] bg-[#f8faf9] p-3.5 space-y-2 font-mono">
            <div className="flex items-center justify-between text-xs text-[#526159]">
              <span>Subtotal Produk</span>
              <span className="font-bold text-[#0b3d2e]">{formatRupiah(order.subtotal)}</span>
            </div>

            {Number(order.discount) > 0 && (
              <div className="flex items-center justify-between text-xs text-rose-600">
                <span>Diskon {order.discount_reason ? `(${order.discount_reason})` : ""}</span>
                <span className="font-bold">-{formatRupiah(order.discount)}</span>
              </div>
            )}

            {Number(order.tax) > 0 && (
              <div className="flex items-center justify-between text-xs text-[#526159]">
                <span>Pajak (PB1 / PPN)</span>
                <span className="font-bold text-[#0b3d2e]">+{formatRupiah(order.tax)}</span>
              </div>
            )}

            {Number(order.service_charge) > 0 && (
              <div className="flex items-center justify-between text-xs text-[#526159]">
                <span>Biaya Layanan</span>
                <span className="font-bold text-[#0b3d2e]">+{formatRupiah(order.service_charge)}</span>
              </div>
            )}

            {Number(order.delivery_fee) > 0 && (
              <div className="flex items-center justify-between text-xs text-[#526159]">
                <span>Ongkos Kirim</span>
                <span className="font-bold text-[#0b3d2e]">+{formatRupiah(order.delivery_fee)}</span>
              </div>
            )}

            <div className="border-t border-[#d8e3de] pt-2 flex items-center justify-between text-sm">
              <span className="font-black text-[#0b3d2e]">TOTAL BAYAR</span>
              <span className="font-black text-sm sm:text-base text-[#167052]">{formatRupiah(order.total)}</span>
            </div>

            {hasRefund && (
              <div className="border-t border-rose-200 pt-1.5 flex items-center justify-between text-xs text-rose-700 font-bold">
                <span>Dana Dikembalikan (Refund)</span>
                <span>-{formatRupiah(order.refund_total ?? 0)}</span>
              </div>
            )}

            {hasRefund && (
              <div className="flex items-center justify-between text-xs text-[#0b3d2e] font-black">
                <span>TOTAL BERSIH (RIIL)</span>
                <span>{formatRupiah(netTotal)}</span>
              </div>
            )}
          </div>

          {/* Info Metode Bayar & Kasir */}
          <div className="rounded-2xl border border-[#d8e3de] bg-white p-3 space-y-1.5 font-mono text-[11px]">
            <div className="flex items-center justify-between">
              <span className="text-[#637970]">Metode Pembayaran</span>
              <span className="font-black uppercase text-[#0b3d2e] bg-[#edf8f3] px-2 py-0.5 rounded">
                {order.payment_method}
              </span>
            </div>

            {order.payment_method === "cash" && order.cash_given != null && (
              <>
                <div className="flex items-center justify-between text-[#526159]">
                  <span>Uang Diterima Kasir</span>
                  <span className="font-bold">{formatRupiah(order.cash_given)}</span>
                </div>
                {order.cash_change != null && (
                  <div className="flex items-center justify-between text-[#526159]">
                    <span>Uang Kembalian</span>
                    <span className="font-bold">{formatRupiah(order.cash_change)}</span>
                  </div>
                )}
              </>
            )}

            {order.paid_confirmed_by && (
              <div className="flex items-center justify-between text-[#526159] pt-1 border-t border-[#edf2ef]">
                <span>Dikonfirmasi Oleh</span>
                <span className="font-bold">{order.paid_confirmed_by}</span>
              </div>
            )}
          </div>

        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-between gap-2 p-3 sm:p-4 border-t border-[#edf2ef] bg-[#f8faf9] font-mono shrink-0">
          <Link
            href={`/receipt/${order.id}`}
            target="_blank"
            className="inline-flex items-center gap-1.5 rounded-xl border border-[#ccd9d3] bg-white hover:bg-[#edf8f3] px-3 py-2 text-xs font-bold text-[#167052] transition-all shadow-xs active:scale-95"
          >
            <Receipt size={14} />
            <span>Struk Digital</span>
            <ArrowUpRight size={12} />
          </Link>

          <div className="flex items-center gap-2">
            {canRefund && onOpenRefund && (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onOpenRefund(order);
                }}
                className="inline-flex items-center gap-1.5 rounded-xl border border-rose-300 bg-rose-50 hover:bg-rose-100 px-3 py-2 text-xs font-bold text-rose-700 transition-all shadow-xs active:scale-95"
              >
                <RotateCcw size={13} />
                <span>Refund</span>
              </button>
            )}

            <button
              type="button"
              onClick={onClose}
              className="rounded-xl bg-[#0b3d2e] hover:bg-[#167052] px-4 py-2 text-xs font-black text-[#c8f53a] shadow-xs transition-all active:scale-95"
            >
              Tutup
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}
