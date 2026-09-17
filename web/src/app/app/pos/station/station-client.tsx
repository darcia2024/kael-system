"use client";

import Link from "next/link";
import { useEffect, useRef, useState, useTransition } from "react";
import { BellRing, ChefHat, Check, Clock3, Volume2, VolumeX, RefreshCw, MonitorSmartphone, ArrowLeft, Printer } from "lucide-react";

import { claimOrderAction, confirmPaymentAction, getOrderStationSnapshotAction, setFulfillmentAction } from "@/lib/actions";
import { formatRupiah } from "@/lib/formatters";
import { serviceTypeLabel, generateKitchenTicketText } from "@/lib/pos-engine";
import type { Order, OrderItem } from "@/lib/types";
import { ambilPrinter, sambungPrinter, jalurTulisPrinter, lupakanPrinter } from "@/lib/thermal-printer";

type StationOrder = Order & { items: OrderItem[] };
type Stage = "cashier" | "kitchen";

const kitchenSteps: Record<string, { next: "preparing" | "ready" | "completed"; label: string }> = {
  accepted: { next: "preparing", label: "Mulai buat" },
  preparing: { next: "ready", label: "Sudah siap" },
  ready: { next: "completed", label: "Sudah diambil" },
};

function timeSince(value: string) {
  const minutes = Math.max(0, Math.floor((Date.now() - new Date(value).getTime()) / 60000));
  return minutes === 0 ? "baru masuk" : `${minutes} menit lalu`;
}

function playIncomingOrderTone() {
  const AudioContextClass = window.AudioContext;
  const context = new AudioContextClass();
  const oscillator = context.createOscillator();
  const gain = context.createGain();
  oscillator.type = "sine";
  oscillator.frequency.setValueAtTime(880, context.currentTime);
  gain.gain.setValueAtTime(0.001, context.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.15, context.currentTime + 0.02);
  gain.gain.exponentialRampToValueAtTime(0.001, context.currentTime + 0.28);
  oscillator.connect(gain).connect(context.destination);
  oscillator.start();
  oscillator.stop(context.currentTime + 0.3);
  window.setTimeout(() => void context.close(), 400);
}

export default function OrderStationClient({
  businessName,
  initialOrders,
  currentUserId,
  mode,
  themeClassName = "",
  isMochi = false,
}: {
  businessName: string;
  initialOrders: StationOrder[];
  currentUserId: string;
  mode: Stage;
  themeClassName?: string;
  isMochi?: boolean;
}) {
  const [orders, setOrders] = useState(initialOrders);
  const [soundEnabled, setSoundEnabled] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const knownIds = useRef(new Set(initialOrders.map((order) => order.id)));
  const soundEnabledRef = useRef(false);
  const title = mode === "cashier" ? "Pos Kasir Tetap" : "Layar Dapur";
  const isMochiStation = isMochi || businessName.toLowerCase().includes("mochi") || themeClassName.includes("mochi-ui");

  const refresh = async (notify = true) => {
    const result = await getOrderStationSnapshotAction();
    if (!result.ok) { setMessage(result.error ?? "Antrean tidak bisa diperbarui."); return; }
    const incoming = result.data.orders.filter((order) => !knownIds.current.has(order.id));
    result.data.orders.forEach((order) => knownIds.current.add(order.id));
    setOrders(result.data.orders);
    if (notify && incoming.length) {
      setMessage(`${incoming.length} pesanan baru masuk.`);
      if (soundEnabledRef.current) playIncomingOrderTone();
    }
  };

  useEffect(() => {
    const timer = window.setInterval(() => void refresh(), 10000);
    return () => window.clearInterval(timer);
  }, []);

  const printKitchenTicket = async (order: StationOrder) => {
    const ticketText = generateKitchenTicketText({
      businessName,
      orderNo: order.order_no,
      tableNo: order.table_no,
      serviceType: (order.service_type || "dine_in") as "dine_in" | "takeaway" | "delivery",
      createdAt: order.created_at,
      items: order.items.map((i) => ({
        name: i.name_snapshot,
        qty: i.qty,
        note: i.note || undefined,
      })),
    });

    const bluetooth = (navigator as Navigator & { bluetooth?: any }).bluetooth;
    if (!bluetooth) {
      const printWindow = window.open("", "_blank", "width=380,height=600");
      if (printWindow) {
        printWindow.document.write(`
          <html>
            <head>
              <title>Tiket Dapur #${order.order_no}</title>
              <style>
                body { font-family: monospace; font-size: 13px; white-space: pre-wrap; padding: 20px; line-height: 1.3; }
                @media print { body { padding: 0; } }
              </style>
            </head>
            <body>${ticketText.replace(/</g, "&lt;").replace(/>/g, "&gt;")}</body>
          </html>
        `);
        printWindow.document.close();
        printWindow.focus();
        setTimeout(() => printWindow.print(), 300);
      }
      return;
    }

    try {
      // Sama seperti layar kasir: printer yang izinnya sudah pernah diberikan
      // langsung dipakai, jadi tiket dapur tidak membuka dialog Bluetooth lagi.
      const device = await ambilPrinter(bluetooth);
      const server = await sambungPrinter(device);
      const characteristic = await jalurTulisPrinter(server);

      const encoded = new TextEncoder().encode(ticketText);
      const finish = [0x0a, 0x0a, 0x0a, 0x1d, 0x56, 0x00];
      const payload = new Uint8Array(encoded.length + 2 + finish.length);
      payload.set([0x1b, 0x40], 0);
      payload.set(encoded, 2);
      payload.set(finish, encoded.length + 2);

      for (let offset = 0; offset < payload.length; offset += 180) {
        const chunk = payload.slice(offset, offset + 180);
        if (typeof characteristic.writeValueWithoutResponse === "function") {
          await characteristic.writeValueWithoutResponse(chunk);
        } else {
          await characteristic.writeValue(chunk);
        }
      }
      // Sambungan sengaja dibiarkan terbuka; menutupnya berarti tiket
      // berikutnya harus menyambung ulang, dan itulah yang memunculkan dialog.
      setMessage(`Tiket Dapur #${order.order_no} berhasil dicetak.`);
    } catch (err) {
      // Printer yang gagal dipakai dilupakan, supaya percobaan berikutnya
      // menyambung ulang alih-alih menulis ke sesi yang sudah mati.
      lupakanPrinter();
      console.warn("Print tiket dapur gagal", err);
      const printWindow = window.open("", "_blank", "width=380,height=600");
      if (printWindow) {
        printWindow.document.write(`
          <html>
            <head>
              <title>Tiket Dapur #${order.order_no}</title>
              <style>
                body { font-family: monospace; font-size: 13px; white-space: pre-wrap; padding: 20px; line-height: 1.3; }
                @media print { body { padding: 0; } }
              </style>
            </head>
            <body>${ticketText.replace(/</g, "&lt;").replace(/>/g, "&gt;")}</body>
          </html>
        `);
        printWindow.document.close();
        printWindow.focus();
        setTimeout(() => printWindow.print(), 300);
      }
    }
  };

  const run = (fn: () => Promise<{ ok: boolean; error?: string }>) => {
    startTransition(async () => {
      setMessage(null);
      const result = await fn();
      if (!result.ok) setMessage(result.error ?? "Aksi belum berhasil.");
      await refresh(false);
    });
  };

  const visibleOrders = mode === "cashier"
    ? orders
    : orders.filter((order) => ["accepted", "preparing", "ready"].includes(order.fulfillment_status));
  const newOrders = visibleOrders.filter((order) => order.payment_status === "pending").length;

  if (isMochiStation) {
    return (
      <main className="min-h-dvh bg-[#f0f5f2] text-[#1c2d26] pb-12 font-sans">
        {/* HEADER BAR (DEEP FOREST EMERALD & NEON LIME ACCENTS) */}
        <header className="sticky top-0 z-20 bg-[#0b3d2e] text-white px-4 py-3.5 sm:px-8 shadow-md border-b border-emerald-800/50 backdrop-blur-md">
          <div className="mx-auto flex max-w-6xl items-center justify-between gap-4">
            <div className="min-w-0 flex items-center gap-3">
              <Link
                href="/app/pos"
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/10 hover:bg-white/20 text-white transition-all active:scale-95 border border-white/10"
                aria-label="Kembali ke kasir"
              >
                <ArrowLeft size={18} />
              </Link>
              {isMochiStation && (
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white p-0.5 border border-emerald-400/40 shadow-xs overflow-hidden">
                  <img src="/logo-mochi.png" alt="Mochi Logo" className="h-full w-full object-contain" />
                </div>
              )}
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <h1 className="text-base sm:text-lg font-black tracking-tight text-white leading-tight">
                    {title}
                  </h1>
                  <span className="inline-flex items-center gap-1 rounded-full bg-[#c8f53a] px-2 py-0.5 text-[9.5px] font-black text-[#073829] uppercase tracking-wider">
                    Live Monitor
                  </span>
                </div>
                <p className="mt-0.5 truncate text-xs text-emerald-200/80 font-mono">
                  {businessName} · diperbarui otomatis tiap 10 detik
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2.5">
              {/* Sound Toggle Button */}
              <button
                type="button"
                onClick={() => {
                  const next = !soundEnabledRef.current;
                  soundEnabledRef.current = next;
                  setSoundEnabled(next);
                  setMessage(next ? "Suara notifikasi aktif di perangkat ini." : "Suara notifikasi dimatikan.");
                }}
                className={`flex h-10 items-center gap-1.5 px-3.5 rounded-xl text-xs font-bold transition-all active:scale-95 ${
                  soundEnabled
                    ? "bg-[#c8f53a] text-[#073829] shadow-sm font-black"
                    : "bg-white/10 text-emerald-100/80 hover:bg-white/20 border border-white/10"
                }`}
                aria-label="Atur suara notifikasi"
              >
                {soundEnabled ? <Volume2 size={16} /> : <VolumeX size={16} />}
                <span className="hidden sm:inline">{soundEnabled ? "Audio Aktif" : "Audio Bisu"}</span>
              </button>

              {/* Refresh Button */}
              <button
                type="button"
                onClick={() => void refresh(false)}
                className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/10 hover:bg-white/20 text-white transition-all active:scale-95 border border-white/10"
                aria-label="Perbarui antrean"
              >
                <RefreshCw size={17} className={isPending ? "animate-spin text-[#c8f53a]" : ""} />
              </button>
            </div>
          </div>
        </header>

        {/* METRICS & ORDER BOARD */}
        <section className="mx-auto max-w-6xl px-4 pt-6 sm:px-8 space-y-6">
          {/* STATS SUMMARY BAR */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
            {/* Card 1: Antrean Aktif */}
            <div className="rounded-2xl bg-gradient-to-br from-[#0b3d2e] to-[#124d3a] p-4 text-white shadow-md border border-emerald-700/40 flex flex-col justify-between">
              <div className="flex items-center justify-between">
                <span className="inline-flex items-center gap-1.5 text-[11px] font-black uppercase tracking-wider text-emerald-200">
                  <BellRing size={14} className="text-[#c8f53a]" />
                  <span>Antrean Aktif</span>
                </span>
                <span className="flex h-2 w-2 rounded-full bg-[#c8f53a] animate-ping" />
              </div>
              <div className="mt-3 flex items-baseline gap-1.5">
                <span className="text-3xl font-black text-[#c8f53a] tracking-tight font-mono">
                  {visibleOrders.length}
                </span>
                <span className="text-xs font-bold text-emerald-100/90">pesanan berjalan</span>
              </div>
            </div>

            {/* Card 2: Perangkat & Audio */}
            <div className="rounded-2xl bg-white p-4 shadow-sm border border-[#d8e3de] flex flex-col justify-between">
              <div className="flex items-center justify-between">
                <span className="inline-flex items-center gap-1.5 text-[11px] font-black uppercase tracking-wider text-[#718078]">
                  <MonitorSmartphone size={14} className="text-[#167052]" />
                  <span>Perangkat Kasir</span>
                </span>
                <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-black ${soundEnabled ? "bg-[#edf8f3] text-[#167052]" : "bg-gray-100 text-gray-500"}`}>
                  {soundEnabled ? "Siap Dengar" : "Mode Hening"}
                </span>
              </div>
              <div className="mt-3">
                <p className="text-sm font-extrabold text-[#1c2d26]">
                  {soundEnabled ? "🔔 Suara Notif Aktif" : "🔕 Suara Notif Mati"}
                </p>
                <p className="text-[11px] text-[#718078] mt-0.5">
                  Bisa dipakai staf bergantian di kasir/dapur
                </p>
              </div>
            </div>

            {/* Card 3: Menunggu Bayar (Cashier Mode only) */}
            {mode === "cashier" ? (
              <div className="rounded-2xl bg-gradient-to-br from-[#fff7ed] to-[#ffedd5] p-4 shadow-sm border-2 border-[#ea580c]/30 flex flex-col justify-between">
                <div className="flex items-center justify-between">
                  <span className="inline-flex items-center gap-1.5 text-[11px] font-black uppercase tracking-wider text-[#9a3412]">
                    <Clock3 size={14} className="text-[#ea580c]" />
                    <span>Cek Pembayaran</span>
                  </span>
                  {newOrders > 0 && (
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-black bg-[#ea580c] text-white animate-bounce">
                      Perlu Kasir
                    </span>
                  )}
                </div>
                <div className="mt-3 flex items-baseline gap-1.5">
                  <span className="text-3xl font-black text-[#ea580c] tracking-tight font-mono">
                    {newOrders}
                  </span>
                  <span className="text-xs font-bold text-[#9a3412]">menunggu pelunasan</span>
                </div>
              </div>
            ) : (
              <div className="rounded-2xl bg-white p-4 shadow-sm border border-[#d8e3de] flex flex-col justify-between">
                <div className="flex items-center justify-between">
                  <span className="inline-flex items-center gap-1.5 text-[11px] font-black uppercase tracking-wider text-[#167052]">
                    <ChefHat size={14} className="text-[#167052]" />
                    <span>Stasiun Dapur</span>
                  </span>
                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-black bg-[#edf8f3] text-[#167052]">
                    KDS Aktif
                  </span>
                </div>
                <div className="mt-3">
                  <p className="text-sm font-extrabold text-[#1c2d26]">Pesanan Siap Masak</p>
                  <p className="text-[11px] text-[#718078] mt-0.5">Order yang lunas otomatis masuk dapur</p>
                </div>
              </div>
            )}
          </div>

          {/* Flash Message Banner */}
          {message && (
            <div
              role="status"
              className="rounded-2xl border border-[#167052]/30 bg-[#edf8f3] px-4 py-3 text-xs font-bold text-[#167052] flex items-center justify-between shadow-xs animate-in fade-in-50"
            >
              <div className="flex items-center gap-2">
                <BellRing size={16} className="text-[#167052] shrink-0" />
                <span>{message}</span>
              </div>
              <button
                type="button"
                onClick={() => setMessage(null)}
                className="text-xs font-bold text-[#167052] hover:underline"
              >
                Tutup
              </button>
            </div>
          )}

          {/* EMPTY STATE OR ORDER GRID */}
          {visibleOrders.length === 0 ? (
            <div className="rounded-3xl bg-white border border-[#d8e3de] p-12 sm:p-16 text-center shadow-xs space-y-4">
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-[#edf8f3] text-[#167052]">
                <ChefHat size={32} />
              </div>
              <div className="space-y-1 max-w-sm mx-auto">
                <h2 className="text-lg font-black text-[#1c2d26] tracking-tight">
                  Belum Ada Pesanan yang Perlu Dikerjakan
                </h2>
                <p className="text-xs text-[#718078] leading-relaxed">
                  Layar ini memantau pesanan baru dari Meja QR dan Kasir secara otomatis tiap 10 detik.
                </p>
              </div>
              <div className="pt-2">
                <span className="inline-flex items-center gap-2 rounded-full bg-[#edf8f3] px-3.5 py-1.5 text-xs font-bold text-[#167052] border border-[#167052]/20">
                  <span className="h-2 w-2 rounded-full bg-[#167052] animate-pulse" />
                  <span>Sistem Siaga &amp; Terhubung</span>
                </span>
              </div>
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2">
              {visibleOrders.map((order) => {
                const pendingPayment = order.payment_status === "pending";
                const step = kitchenSteps[order.fulfillment_status];

                return (
                  <article
                    key={order.id}
                    className={`rounded-2xl bg-white p-5 shadow-sm space-y-4 transition-all duration-200 ${
                      pendingPayment
                        ? "border-2 border-[#ea580c] ring-2 ring-[#ea580c]/15 shadow-md"
                        : "border border-[#d8e3de] hover:border-[#167052]/40"
                    }`}
                  >
                    {/* Order Header */}
                    <div className="flex items-start justify-between gap-3 border-b border-[#e5ede9] pb-3.5">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-xl font-black text-[#0b3d2e]">
                            #{order.order_no}
                          </span>
                          <span className="rounded-lg bg-[#edf8f3] text-[#167052] px-2 py-0.5 text-xs font-black">
                            {serviceTypeLabel(order.service_type, order.table_no)}
                          </span>
                        </div>
                        <p className="mt-1 flex items-center gap-1 font-mono text-[11px] text-[#718078]">
                          <Clock3 size={12} />
                          <span>{timeSince(order.created_at)}</span>
                        </p>
                      </div>

                      <div className="text-right">
                        <p className="font-mono text-base font-black text-[#0b3d2e]">
                          {formatRupiah(Number(order.total))}
                        </p>
                        <span
                          className={`mt-1 inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider ${
                            pendingPayment
                              ? "bg-[#ea580c] text-white shadow-xs"
                              : order.fulfillment_status === "ready"
                              ? "bg-[#c8f53a] text-[#073829]"
                              : "bg-[#edf8f3] text-[#167052]"
                          }`}
                        >
                          {pendingPayment ? "Menunggu Bayar" : order.fulfillment_status}
                        </span>
                      </div>
                    </div>

                    {/* Order Items List */}
                    <ul className="space-y-2 py-1">
                      {order.items.map((item) => (
                        <li key={item.id} className="flex items-start justify-between gap-3 text-xs">
                          <div className="min-w-0">
                            <span className="font-extrabold text-[#1c2d26]">
                              <span className="text-[#167052] font-black mr-1">{item.qty}x</span>
                              {item.name_snapshot}
                            </span>
                            {item.note && (
                              <span className="block mt-0.5 rounded-md bg-[#fff7ed] text-[#ea580c] px-2 py-0.5 text-[11px] font-bold">
                                Catatan: {item.note}
                              </span>
                            )}
                          </div>
                          <span className="shrink-0 font-mono font-bold text-[#718078]">
                            {formatRupiah(Number(item.subtotal))}
                          </span>
                        </li>
                      ))}
                    </ul>

                    {/* Order Action Footer */}
                    <div className="border-t border-[#e5ede9] pt-3.5">
                      {mode === "cashier" ? (
                        pendingPayment ? (
                          <button
                            type="button"
                            disabled={isPending}
                            onClick={() => run(() => confirmPaymentAction(order.id))}
                            className="w-full rounded-xl bg-[#c8f53a] hover:bg-[#d9ff57] text-[#073829] py-3 text-xs font-black shadow-sm flex items-center justify-center gap-2 active:scale-98 transition-all disabled:opacity-50"
                          >
                            <Check size={16} strokeWidth={2.6} />
                            <span>Konfirmasi Pembayaran Lunas</span>
                          </button>
                        ) : order.claimed_by && order.claimed_by !== currentUserId ? (
                          <div className="rounded-xl bg-[#edf1ef] py-2.5 px-3 text-center text-xs font-bold text-[#718078]">
                            Sedang dipegang oleh {order.claimed_by_name ?? "staf lain"}.
                          </div>
                        ) : order.claimed_by === currentUserId ? (
                          <div className="rounded-xl bg-[#edf8f3] border border-[#167052]/30 py-2.5 px-3 text-center text-xs font-black text-[#167052] flex items-center justify-center gap-1.5">
                            <Check size={15} strokeWidth={2.6} />
                            <span>Kamu memegang pesanan ini</span>
                          </div>
                        ) : (
                          <button
                            type="button"
                            disabled={isPending}
                            onClick={() => run(() => claimOrderAction(order.id))}
                            className="w-full rounded-xl bg-[#0b3d2e] hover:bg-[#124d3a] text-white py-2.5 text-xs font-black shadow-sm flex items-center justify-center gap-2 active:scale-98 transition-all disabled:opacity-50"
                          >
                            <span>Ambil Pesanan Ini</span>
                          </button>
                        )
                      ) : step ? (
                        <div className="flex gap-2">
                          <button
                            type="button"
                            disabled={isPending}
                            onClick={() => run(() => setFulfillmentAction(order.id, step.next))}
                            className="flex-1 rounded-xl bg-[#c8f53a] hover:bg-[#d9ff57] text-[#073829] py-3 text-xs font-black shadow-sm flex items-center justify-center gap-2 active:scale-98 transition-all disabled:opacity-50"
                          >
                            <Check size={16} strokeWidth={2.6} />
                            <span>{step.label}</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => void printKitchenTicket(order)}
                            className="rounded-xl border border-[#d8e3de] bg-white hover:bg-[#edf8f3] text-[#0b3d2e] px-3.5 flex items-center justify-center transition-colors shadow-xs"
                            title="Cetak Tiket Dapur Thermal"
                          >
                            <Printer size={16} />
                          </button>
                        </div>
                      ) : null}
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </section>
      </main>
    );
  }

  return (
    <main className={`${themeClassName} mochi-shell min-h-dvh bg-[#f7f6fc] text-[#232331] pb-7`}>
      <header className="mochi-header sticky top-0 z-20 border-b-2 border-[#232331] bg-white px-4 py-3 sm:px-7">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3">
          <div className="min-w-0 flex items-center gap-2.5">
            <Link href="/app/pos" className="grid h-9 w-9 shrink-0 place-items-center rounded-lg border-2 border-[#232331] bg-white shadow-ink-xs" aria-label="Kembali ke kasir"><ArrowLeft size={17} /></Link>
            <div className="min-w-0"><p className="font-black leading-none">{title}</p><p className="mt-1 truncate font-mono text-[10px] text-[#777587]">{businessName} · diperbarui otomatis tiap 10 detik</p></div>
          </div>
          <div className="flex items-center gap-2">
            <button type="button" onClick={() => { const next = !soundEnabledRef.current; soundEnabledRef.current = next; setSoundEnabled(next); setMessage(next ? "Suara notifikasi aktif di perangkat ini." : "Suara notifikasi dimatikan."); }} className={`grid h-9 w-9 place-items-center rounded-lg border-2 border-[#232331] shadow-ink-xs ${soundEnabled ? "bg-[#d9ff57]" : "bg-white"}`} aria-label="Atur suara notifikasi">{soundEnabled ? <Volume2 size={17} /> : <VolumeX size={17} />}</button>
            <button type="button" onClick={() => void refresh(false)} className="grid h-9 w-9 place-items-center rounded-lg border-2 border-[#232331] bg-white shadow-ink-xs" aria-label="Perbarui antrean"><RefreshCw size={17} className={isPending ? "animate-spin" : ""} /></button>
          </div>
        </div>
      </header>

      <section className="mx-auto max-w-6xl px-4 pt-5 sm:px-7">
        <div className="mb-5 flex flex-wrap items-stretch gap-3">
          <div className="mochi-primary min-w-[168px] flex-1 border-2 border-[#232331] px-4 py-3 shadow-ink-sm"><div className="flex items-center gap-2 font-mono text-[11px] font-bold text-white/75"><BellRing size={14} /> ANTREAN AKTIF</div><p className="mt-1.5 text-2xl font-black">{visibleOrders.length} pesanan</p></div>
          <div className="mochi-panel min-w-[168px] flex-1 border-2 border-[#232331] bg-white px-4 py-3 shadow-ink-sm"><div className="flex items-center gap-2 font-mono text-[11px] font-bold text-[#7958d8]"><MonitorSmartphone size={14} /> PERANGKAT INI</div><p className="mt-1.5 font-black">{soundEnabled ? "Suara aktif" : "Suara mati"}</p><p className="font-mono text-[10px] text-[#777587]">Bisa dipakai staf bergantian</p></div>
          {mode === "cashier" && <div className="min-w-[168px] flex-1 border-2 border-[#d97706] bg-[#fff7e5] px-4 py-3 shadow-ink-sm"><div className="flex items-center gap-2 font-mono text-[11px] font-bold text-[#b45309]"><Clock3 size={14} /> CEK PEMBAYARAN</div><p className="mt-1.5 text-2xl font-black">{newOrders} menunggu</p></div>}
        </div>
        {message && <div role="status" className="mb-4 border-2 border-[#7958d8] bg-[#f1edff] px-3 py-2 font-mono text-xs font-bold text-[#4c36aa]">{message}</div>}

        {visibleOrders.length === 0 ? <div className="border-2 border-dashed border-[#aaa8b7] bg-white px-6 py-16 text-center"><ChefHat size={30} className="mx-auto text-[#7958d8]" /><p className="mt-3 font-black">Belum ada pesanan yang perlu dikerjakan.</p><p className="mt-1 font-mono text-xs text-[#777587]">Layar ini tetap memantau pesanan baru secara otomatis.</p></div> : <div className="grid gap-4 lg:grid-cols-2">{visibleOrders.map((order) => {
          const pendingPayment = order.payment_status === "pending";
          const step = kitchenSteps[order.fulfillment_status];
          return <article key={order.id} className={`mochi-panel border-2 p-4 shadow-ink-sm ${pendingPayment ? "border-[#d97706] bg-[#fffaf0]" : "border-[#232331] bg-white"}`}>
            <div className="flex items-start justify-between gap-3 border-b-2 border-[#dedee8] pb-3"><div><p className="font-mono text-xl font-black">#{order.order_no}</p><p className="font-mono text-[11px] text-[#777587]">{serviceTypeLabel(order.service_type, order.table_no)} · {timeSince(order.created_at)}</p></div><div className="text-right"><p className="font-black">{formatRupiah(Number(order.total))}</p><p className="font-mono text-[10px] font-bold uppercase text-[#7958d8]">{pendingPayment ? "Menunggu bayar" : order.fulfillment_status}</p></div></div>
            <ul className="my-3 space-y-1.5 font-mono text-xs">{order.items.map((item) => <li key={item.id} className="flex justify-between gap-3"><span>{item.qty}x {item.name_snapshot}{item.note ? <span className="block pl-5 text-[10px] text-[#777587]">Catatan: {item.note}</span> : null}</span><span>{formatRupiah(Number(item.subtotal))}</span></li>)}</ul>
            <div className="border-t-2 border-[#dedee8] pt-3">{mode === "cashier" ? pendingPayment ? <button type="button" disabled={isPending} onClick={() => run(() => confirmPaymentAction(order.id))} className="btn-tactile w-full rounded-lg border-2 border-[#232331] bg-[#d9ff57] px-3 py-2.5 font-mono text-xs font-black shadow-ink-xs disabled:opacity-50">Pembayaran sudah masuk</button> : order.claimed_by && order.claimed_by !== currentUserId ? <p className="font-mono text-xs font-bold text-[#7958d8]">Sedang dipegang {order.claimed_by_name ?? "staf lain"}.</p> : order.claimed_by === currentUserId ? <p className="flex items-center gap-1.5 font-mono text-xs font-bold text-[#15803d]"><Check size={14} /> Kamu pegang pesanan ini</p> : <button type="button" disabled={isPending} onClick={() => run(() => claimOrderAction(order.id))} className="btn-tactile w-full rounded-lg border-2 border-[#232331] bg-white px-3 py-2.5 font-mono text-xs font-black shadow-ink-xs disabled:opacity-50">Ambil pesanan ini</button> : step ? <div className="flex gap-2"><button type="button" disabled={isPending} onClick={() => run(() => setFulfillmentAction(order.id, step.next))} className="btn-tactile flex-1 rounded-lg border-2 border-[#232331] bg-[#d9ff57] px-3 py-2.5 font-mono text-xs font-black shadow-ink-xs disabled:opacity-50">{step.label}</button><button type="button" onClick={() => void printKitchenTicket(order)} className="btn-tactile rounded-lg border-2 border-[#232331] bg-white px-3 py-2.5 shadow-ink-xs" title="Cetak Tiket Dapur"><Printer size={15} /></button></div> : null}</div>
          </article>;
        })}</div>}
      </section>
    </main>
  );
}
