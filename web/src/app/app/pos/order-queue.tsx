"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  X,
  Check,
  Ban,
  Loader2,
  Clock,
  AlertTriangle,
  ChefHat,
  MessageSquare,
  Printer,
  CheckCircle2,
  Trash2,
} from "lucide-react";

import {
  confirmPaymentAction,
  markPaymentFailedAction,
  cancelOrderAction,
  setFulfillmentAction,
} from "@/lib/actions";
import {
  serviceTypeLabel,
  PAYMENT_STATUS_LABEL,
  FULFILLMENT_FLOW,
} from "@/lib/pos-engine";
import { formatRupiah } from "@/lib/formatters";
import type { Order, OrderItem, MenuItem } from "@/lib/types";
import PosReplaceRefundModal from "./pos-replace-refund-modal";

type Antrean = Order & { items: OrderItem[] };

/**
 * Antrean pesanan swalayan di layar kasir.
 *
 * Mengelola pesanan yang baru masuk dari meja (QRIS / Tunai).
 * Pesanan yang sudah selesai (completed) atau dibatalkan (cancelled)
 * otomatis bersih seketika dari antrean aktif.
 */
export default function OrderQueue({
  orders,
  onOrdersChange,
  onClose,
  isMochi,
  onPrintKitchenTicket,
  onPrintThreePly,
  autoPrintThreePly,
  onToggleAutoPrintThreePly,
  menuItems = [],
}: {
  orders: Antrean[];
  onOrdersChange?: (orders: Antrean[]) => void;
  onClose: () => void;
  isMochi?: boolean;
  onPrintKitchenTicket?: (order: Antrean) => void;
  onPrintThreePly?: (order: {
    order_no: string;
    table_no?: string | null;
    service_type: string;
    created_at: string;
    items: { name_snapshot: string; qty: number; unit_price_snapshot?: number; subtotal?: number; note?: string | null }[];
    total: number | string;
    payment_method: string;
    customer_name?: string | null;
  }) => void;
  autoPrintThreePly?: boolean;
  onToggleAutoPrintThreePly?: (val: boolean) => void;
  menuItems?: MenuItem[];
}) {
  const router = useRouter();
  const [localOrders, setLocalOrders] = useState<Antrean[]>(orders);
  const [sibuk, setSibuk] = useState<string | null>(null);
  const [galat, setGalat] = useState<string | null>(null);
  const [modalOrder, setModalOrder] = useState<Antrean | null>(null);
  const [modalItem, setModalItem] = useState<OrderItem | null>(null);
  const [showAdjustModal, setShowAdjustModal] = useState(false);


  useEffect(() => {
    setLocalOrders(orders);
  }, [orders]);

  // Antrean aktif: belum berstatus selesai (completed) dan belum dibatalkan (cancelled/failed)
  const activeOrders = useMemo(() => {
    return localOrders.filter(
      (o) =>
        o.status !== "cancelled" &&
        o.payment_status !== "failed" &&
        o.fulfillment_status !== "completed" &&
        o.fulfillment_status !== "cancelled",
    );
  }, [localOrders]);

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

  // Selesaikan pesanan & langsung bersihkan dari antrean (optimistic)
  const selesaikanPesanan = async (orderId: string) => {
    const sisa = localOrders.filter((o) => o.id !== orderId);
    setLocalOrders(sisa);
    if (onOrdersChange) onOrdersChange(sisa);

    await jalankan(orderId, () => setFulfillmentAction(orderId, "completed"));
  };

  // Batalkan pesanan & hapus dari antrean (baik belum bayar maupun salah input)
  const batalkanPesanan = async (orderId: string, orderNo: string, isPaid: boolean) => {
    const konfirmasi = window.confirm(
      `Yakin ingin membatalkan dan menghapus pesanan #${orderNo} dari antrean?`,
    );
    if (!konfirmasi) return;

    const sisa = localOrders.filter((o) => o.id !== orderId);
    setLocalOrders(sisa);
    if (onOrdersChange) onOrdersChange(sisa);

    if (isPaid) {
      await jalankan(orderId, () =>
        cancelOrderAction(orderId, "Dibatalkan kasir dari antrean pesanan masuk"),
      );
    } else {
      await jalankan(orderId, () => markPaymentFailedAction(orderId));
    }
  };

  // Update status dapur secara bertahap (Diterima -> Disiapkan -> Siap -> Selesai)
  const updateFulfillment = async (
    orderId: string,
    status: "accepted" | "preparing" | "ready" | "completed",
  ) => {
    if (status === "completed") {
      await selesaikanPesanan(orderId);
      return;
    }

    const updated = localOrders.map((o) =>
      o.id === orderId ? { ...o, fulfillment_status: status } : o,
    );
    setLocalOrders(updated);
    if (onOrdersChange) onOrdersChange(updated);

    await jalankan(orderId, () => setFulfillmentAction(orderId, status));
  };

  const forwardToWhatsapp = (order: Antrean) => {
    const staffPhone = typeof window !== "undefined" ? localStorage.getItem("kael_pos_wa_staff") || "" : "";
    const phoneClean = staffPhone.replace(/[^0-9]/g, "").replace(/^0/, "62");

    const itemsText = order.items
      .map((i) => `• ${i.qty}x ${i.name_snapshot}${i.note ? ` (${i.note})` : ""}`)
      .join("\n");
    const text = encodeURIComponent(
      `🔔 *PESANAN MASUK #${order.order_no}*\n` +
      `━━━━━━━━━━━━━━━━━━━━━━\n` +
      `📍 ${serviceTypeLabel(order.service_type, order.table_no)}\n` +
      `💰 Total: ${formatRupiah(Number(order.total))} (${order.payment_method.toUpperCase()})\n` +
      `📌 Status: ${PAYMENT_STATUS_LABEL[order.payment_status] || order.payment_status}\n\n` +
      `📋 *Menu Pesanan:*\n${itemsText}\n\n` +
      `👉 Buka Kasir: https://kaels.site/app/pos`
    );

    const url = phoneClean ? `https://wa.me/${phoneClean}?text=${text}` : `https://wa.me/?text=${text}`;
    window.open(url, "_blank");
  };

  const menunggu = activeOrders.filter((o) => o.payment_status === "pending");
  const diproses = activeOrders.filter((o) => o.payment_status === "paid");

  return (
    <div className={`fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 backdrop-blur-xs ${
      isMochi ? "bg-[#07281e]/60" : "bg-[#232331]/60"
    }`}>
      <div className={`w-full sm:max-w-lg max-h-[92vh] overflow-y-auto rounded-t-3xl sm:rounded-3xl bg-white ${
        isMochi ? "border border-[#d8e3de] shadow-2xl" : "border-2 border-[#232331] shadow-ink-lg"
      }`}>
        <div className={`sticky top-0 z-10 flex flex-col gap-2 bg-white px-5 py-3.5 border-b ${
          isMochi ? "border-[#d8e3de]" : "border-b-2 border-[#232331]"
        }`}>
          <div className="flex items-center justify-between gap-3">
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

          {onToggleAutoPrintThreePly && (
            <label className={`flex items-center justify-between gap-2 px-3 py-1.5 rounded-xl border cursor-pointer font-mono text-[10.5px] font-bold transition-colors ${
              isMochi ? "bg-[#edf8f3] border-[#d8e3de] text-[#0b3d2e]" : "bg-slate-50 border-slate-200 text-slate-700"
            }`}>
              <span>🖨️ Cetak otomatis 3 rangkap saat pesanan diterima</span>
              <input
                type="checkbox"
                checked={autoPrintThreePly ?? true}
                onChange={(e) => onToggleAutoPrintThreePly(e.target.checked)}
                className="h-3.5 w-3.5 rounded accent-[#0b3d2e]"
              />
            </label>
          )}
        </div>

        <div className="p-4 space-y-3">
          {galat && (
            <div className="flex items-start gap-2 rounded-xl border border-[#c0392b] bg-[#fdeeec] px-3 py-2 text-[#c0392b]">
              <AlertTriangle size={14} className="shrink-0 mt-0.5" />
              <p className="font-mono text-[11px] font-bold">{galat}</p>
            </div>
          )}

          {activeOrders.length === 0 && (
            <div className={`rounded-2xl border-2 border-dashed p-8 text-center space-y-3 ${
              isMochi ? "border-[#ccd9d3] bg-[#f8faf9]" : "border-[#c9c9d4]"
            }`}>
              <CheckCircle2 size={32} className={`mx-auto ${isMochi ? "text-emerald-600" : "text-[#16a34a]"}`} />
              <div>
                <p className={`font-black text-sm ${isMochi ? "text-[#0b3d2e]" : "text-[#232331]"}`}>
                  Semua Pesanan Selesai!
                </p>
                <p className="font-mono text-xs text-[#7b8882] mt-1">
                  Tidak ada antrean pesanan aktif yang perlu diproses saat ini.
                </p>
              </div>
              <button
                type="button"
                onClick={onClose}
                className={`inline-flex items-center gap-1.5 rounded-xl px-4 py-2 font-mono text-xs font-black transition-all ${
                  isMochi ? "bg-[#c8f53a] hover:bg-[#d9ff57] text-[#073829]" : "bg-[#232331] text-white"
                }`}
              >
                Tutup Antrean
              </button>
            </div>
          )}

          {activeOrders.map((o) => {
            const isQris = o.payment_method === "qris";
            const menungguBayar = o.payment_status === "pending";
            const busy = sibuk === o.id;

            return (
              <div
                key={o.id}
                className={`rounded-2xl p-4 space-y-3 ${
                  isMochi
                    ? menungguBayar
                      ? isQris
                        ? "border-2 border-emerald-500/70 bg-emerald-50/60 shadow-sm"
                        : "border border-amber-300/80 bg-amber-50/70"
                      : "border border-[#d8e3de] bg-white shadow-xs"
                    : menungguBayar
                      ? isQris
                        ? "border-2 border-emerald-600 bg-emerald-50/60"
                        : "border-2 border-[#b45309] bg-[#fffbeb]"
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
                    <p className={`font-mono text-[11px] font-bold uppercase ${
                      isQris 
                        ? (isMochi ? "text-emerald-800 bg-emerald-100/90 px-2 py-0.5 rounded-md inline-block" : "text-emerald-700 font-bold")
                        : (isMochi ? "text-[#167052]" : "text-[#7958d8]")
                    }`}>
                      {isQris ? "QRIS (Tamu Scan di Meja)" : o.payment_method}
                    </p>
                  </div>
                </div>

                <ul className="font-mono text-[11px] space-y-1">
                  {o.items.map((i) => (
                    <li key={i.id} className="flex items-center justify-between gap-2 py-0.5">
                      <span className="truncate flex-1">
                        {i.qty}× {i.name_snapshot}
                        {i.note ? <span className="text-[#7b7b8e]"> · {i.note}</span> : null}
                      </span>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <span className="font-bold">{formatRupiah(Number(i.subtotal))}</span>
                        {menuItems && menuItems.length > 0 && (
                          <button
                            type="button"
                            onClick={() => {
                              setModalOrder(o);
                              setModalItem(i);
                              setShowAdjustModal(true);
                            }}
                            className="px-1.5 py-0.5 rounded text-[9.5px] font-bold border border-amber-300 bg-amber-50 hover:bg-amber-100 text-amber-900 transition-colors"
                            title="Ganti menu (stok habis) atau refund item ini"
                          >
                            ⚠️ Ganti/Refund
                          </button>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>

                {menungguBayar ? (
                  <div className={`space-y-2 border-t pt-2.5 ${isMochi ? "border-[#e0ebe5]" : "border-[#dedee8]"}`}>
                    {isQris ? (
                      /* Alur Khusus QRIS */
                      <div className="space-y-2.5">
                        <div className="flex items-center justify-between font-mono text-[11px]">
                          <span className="font-extrabold text-emerald-900 bg-emerald-100/90 px-2 py-0.5 rounded-md flex items-center gap-1.5">
                            <span>💳 Menunggu Cek QRIS</span>
                          </span>
                          <span className="font-bold text-[#55695f]">Tagihan: {formatRupiah(Number(o.total))}</span>
                        </div>

                        <div className="rounded-xl border border-emerald-300 bg-emerald-50/90 p-3 space-y-2 font-mono text-xs">
                          <p className="text-[11px] font-bold text-emerald-950 leading-relaxed">
                            📲 Tamu sudah bayar via QRIS di meja. Cek bukti transfer / mutasi Bank Nagari, lalu konfirmasi di bawah:
                          </p>

                          {/* Tombol Utama: Konfirmasi QRIS Lunas & Teruskan ke Dapur */}
                          <button
                            type="button"
                            disabled={busy}
                            onClick={async () => {
                              await jalankan(o.id, () => confirmPaymentAction(o.id));
                              if (autoPrintThreePly && onPrintThreePly) {
                                onPrintThreePly(o);
                              }
                            }}
                            className={`w-full flex items-center justify-center gap-2 rounded-xl py-2.5 px-3 text-xs font-black transition-all shadow-sm ${
                              isMochi
                                ? "bg-[#c8f53a] hover:bg-[#d9ff57] text-[#073829]"
                                : "bg-[#16a34a] hover:bg-[#15803d] text-white"
                            }`}
                          >
                            {busy ? <Loader2 size={14} className="animate-spin" /> : <Check size={15} strokeWidth={2.8} />}
                            <span>✓ Konfirmasi QRIS Masuk · Lunas & Kirim ke Dapur 🍳</span>
                          </button>
                        </div>

                        {/* Dapur terkunci sampai kasir konfirmasi bayar */}
                        <div className="flex items-center justify-between text-[11px] font-mono px-1">
                          <span className="text-amber-800 font-bold flex items-center gap-1">
                            <span>🔒 Dapur Menunggu Lunas (Belum Masak)</span>
                          </span>
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() => batalkanPesanan(o.id, o.order_no, false)}
                            className="font-bold text-rose-600 hover:underline flex items-center gap-1"
                          >
                            <Ban size={12} />
                            <span>Batal</span>
                          </button>
                        </div>
                      </div>
                    ) : (
                      /* Alur Tunai / Makan Dulu */
                      <div className="space-y-2">
                        <div className="flex items-center justify-between font-mono text-[11px]">
                          <span className="font-bold text-amber-800 flex items-center gap-1">
                            <span>💵 Makan Dulu (Bayar Tunai di Kasir)</span>
                          </span>
                          <span className="font-bold text-[#718078]">Tagihan: {formatRupiah(Number(o.total))}</span>
                        </div>

                        {o.fulfillment_status === "pending" ? (
                          <div className="rounded-xl border border-amber-300 bg-amber-50 p-2.5 space-y-1.5 font-mono text-xs">
                            <p className="text-[11px] font-bold text-amber-900">
                              👉 Samperin ke meja untuk pastikan pesanan benar, lalu klik tombol di bawah:
                            </p>
                            <button
                              type="button"
                              disabled={busy}
                              onClick={async () => {
                                await jalankan(o.id, () => setFulfillmentAction(o.id, "accepted"));
                                if (autoPrintThreePly && onPrintThreePly) {
                                  onPrintThreePly(o);
                                }
                              }}
                              className={`w-full flex items-center justify-center gap-1.5 rounded-xl py-2 px-3 text-xs font-black transition-all ${
                                isMochi
                                  ? "bg-[#0b3d2e] hover:bg-[#124d3a] text-[#c8f53a] shadow-xs"
                                  : "btn-tactile border-2 border-[#232331] bg-[#232331] text-[#d9ff57]"
                              }`}
                            >
                              <Check size={14} />
                              <span>Pesanan Meja Benar · Teruskan ke Dapur 🍳</span>
                            </button>
                          </div>
                        ) : (
                          <div className="space-y-1.5">
                            <div className="flex items-center gap-1.5 font-mono text-[11px] font-bold text-[#16a34a]">
                              <ChefHat size={13} className={isMochi ? "text-[#167052]" : "text-[#7958d8]"} />
                              <span>Dapur / Barista: {o.fulfillment_status?.toUpperCase()}</span>
                            </div>
                            <div className="flex flex-wrap gap-1.5">
                              {FULFILLMENT_FLOW.map((f) => (
                                <button
                                  key={f.key}
                                  type="button"
                                  disabled={busy}
                                  onClick={() => updateFulfillment(o.id, f.key)}
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
                        )}

                        {/* Tombol Pembayaran Selesai Makan */}
                        <div className="flex gap-2 pt-1 border-t border-[#e0ebe5]">
                          <button
                            type="button"
                            disabled={busy}
                            onClick={async () => {
                              await jalankan(o.id, () => confirmPaymentAction(o.id));
                              if (autoPrintThreePly && onPrintThreePly) {
                                onPrintThreePly(o);
                              }
                            }}
                            className={`flex-1 inline-flex items-center justify-center gap-1.5 rounded-xl px-3 py-2 font-mono text-xs font-black disabled:opacity-50 transition-all ${
                              isMochi
                                ? "bg-[#c8f53a] hover:bg-[#d9ff57] text-[#073829] shadow-xs"
                                : "btn-tactile border-2 border-[#232331] bg-[#16a34a] text-white shadow-ink-xs"
                            }`}
                            title="Tamu selesai makan dan membayar tagihan"
                          >
                            {busy ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />}
                            Selesai Makan · Terima Bayar
                          </button>
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() => batalkanPesanan(o.id, o.order_no, false)}
                            className={`inline-flex items-center gap-1.5 rounded-xl px-3 py-2 font-mono text-xs font-bold disabled:opacity-50 ${
                              isMochi
                                ? "border border-rose-200 bg-white text-rose-700 hover:bg-rose-50"
                                : "border border-[#c0392b] bg-white text-[#c0392b]"
                            }`}
                          >
                            <Ban size={13} />
                            Batal
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className={`space-y-2.5 border-t pt-2.5 ${isMochi ? "border-[#e0ebe5]" : "border-[#dedee8]"}`}>
                    <div className="flex items-center justify-between font-mono text-[11px]">
                      <div className="flex items-center gap-1.5 font-bold text-[#16a34a]">
                        <Check size={12} />
                        <span>{PAYMENT_STATUS_LABEL[o.payment_status]}</span>
                        {o.paid_confirmed_at ? <span>· dikonfirmasi kasir</span> : ""}
                      </div>
                      <span className="font-bold text-[#55695f]">{serviceTypeLabel(o.service_type, o.table_no)}</span>
                    </div>

                    <div className="space-y-1.5">
                      <div className="flex items-center gap-1.5 font-mono text-[11px] font-bold text-[#16a34a]">
                        <ChefHat size={13} className={isMochi ? "text-[#167052]" : "text-[#7958d8]"} />
                        <span>Dapur / Barista: {o.fulfillment_status?.toUpperCase()}</span>
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {FULFILLMENT_FLOW.map((f) => (
                          <button
                            key={f.key}
                            type="button"
                            disabled={busy}
                            onClick={() => updateFulfillment(o.id, f.key)}
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

                    {/* Tombol Aksi Kasir: Selesai & Bersihkan dari Antrean + Batal / Hapus */}
                    <div className="flex items-center gap-2 pt-1 border-t border-[#e0ebe5]">
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => selesaikanPesanan(o.id)}
                        className={`flex-1 inline-flex items-center justify-center gap-1.5 rounded-xl py-2.5 px-3 font-mono text-xs font-black transition-all shadow-xs ${
                          isMochi
                            ? "bg-[#0b3d2e] hover:bg-[#124d3a] text-[#c8f53a]"
                            : "bg-[#16a34a] hover:bg-[#15803d] text-white"
                        }`}
                        title="Tandai pesanan selesai disajikan dan bersihkan dari antrean"
                      >
                        {busy ? <Loader2 size={13} className="animate-spin" /> : <CheckCircle2 size={14} />}
                        <span>✓ Selesai & Hapus dari Antrean</span>
                      </button>

                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => batalkanPesanan(o.id, o.order_no, true)}
                        className="inline-flex items-center justify-center gap-1 rounded-xl border border-rose-200 bg-rose-50/70 hover:bg-rose-100 text-rose-700 px-3 py-2 font-mono text-xs font-bold transition-colors"
                        title="Batalkan / Hapus pesanan ini dari antrean"
                      >
                        <Trash2 size={13} />
                        <span>Batal</span>
                      </button>
                    </div>
                  </div>
                )}

                <div className="flex flex-col sm:flex-row gap-2 pt-1">
                  {onPrintThreePly && (
                    <button
                      type="button"
                      onClick={() => {
                        if (o.fulfillment_status === "pending") {
                          void jalankan(o.id, () => setFulfillmentAction(o.id, "accepted"));
                        }
                        onPrintThreePly(o);
                      }}
                      className={`flex-1 inline-flex items-center justify-center gap-1.5 rounded-xl py-2 px-3 font-mono text-[11px] font-black transition-all ${
                        isMochi
                          ? "bg-[#c8f53a] hover:bg-[#d9ff57] text-[#073829] shadow-xs ring-1 ring-[#c8f53a]"
                          : "btn-tactile border-2 border-[#232331] bg-[#d9ff57] text-[#232331] shadow-ink-xs"
                      }`}
                      title="Cetak 3 rangkap sekaligus (Dapur + Kasir + Pelanggan)"
                    >
                      <Printer size={13} />
                      <span>Cetak 3 Rangkap 🖨️</span>
                    </button>
                  )}
                  {onPrintKitchenTicket && (
                    <button
                      type="button"
                      onClick={() => {
                        if (o.fulfillment_status === "pending") {
                          void jalankan(o.id, () => setFulfillmentAction(o.id, "accepted"));
                        }
                        onPrintKitchenTicket(o);
                      }}
                      className={`inline-flex items-center justify-center gap-1.5 rounded-xl border py-2 px-3 font-mono text-[11px] font-bold transition-all ${
                        isMochi
                          ? "border-emerald-800/20 bg-white text-[#0b3d2e] hover:bg-[#edf8f3]"
                          : "border border-[#232331] bg-white text-[#232331]"
                      }`}
                      title="Cetak tiket dapur via printer thermal"
                    >
                      <ChefHat size={13} />
                      <span>Tiket Dapur</span>
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => forwardToWhatsapp(o)}
                    className={`inline-flex items-center justify-center gap-1.5 rounded-xl border py-2 px-3 font-mono text-[11px] font-bold transition-colors ${
                      onPrintThreePly || onPrintKitchenTicket ? "sm:w-auto" : "w-full"
                    } ${
                      isMochi
                        ? "border-emerald-600/30 bg-emerald-50 text-emerald-800 hover:bg-emerald-100"
                        : "border-[#22c55e]/40 bg-[#f0fdf4] text-[#15803d] hover:bg-[#dcfce7]"
                    }`}
                    title="Kirim detail pesanan ini ke nomor WhatsApp staf atau grup dapur"
                  >
                    <MessageSquare size={13} />
                    <span>WA</span>
                  </button>
                </div>
              </div>
            );
          })}        </div>
      </div>

      {showAdjustModal && modalOrder && (
        <PosReplaceRefundModal
          isOpen={showAdjustModal}
          onClose={() => {
            setShowAdjustModal(false);
            setModalOrder(null);
            setModalItem(null);
          }}
          order={modalOrder}
          selectedItem={modalItem}
          menuItems={menuItems}
          isMochi={isMochi}
          onSuccess={() => {
            router.refresh();
          }}
        />
      )}
    </div>
  );
}
