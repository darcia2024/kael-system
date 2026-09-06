"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  Banknote,
  ChevronRight,
  CircleDollarSign,
  Clock3,
  Coffee,
  CreditCard,
  LayoutDashboard,
  Loader2,
  ReceiptText,
  RefreshCw,
  ShoppingBag,
  Smartphone,
  Timer,
  UtensilsCrossed,
  WalletCards,
} from "lucide-react";

import type { Business, Order } from "@/lib/types";
import { formatBusinessDateTime, formatRupiah } from "@/lib/formatters";
import { PAYMENT_STATUS_LABEL, serviceTypeLabel } from "@/lib/pos-engine";
import { retryOrderSyncAction } from '@/lib/actions';

type Dashboard = {
  timezone: string;
  today: {
    paidOrders: number;
    revenue: number;
    averageOrder: number;
    payment: { cash: number; qris: number; transfer: number };
  };
  queue: { awaitingPayment: number; preparing: number; ready: number };
  activeShifts: { id: string; openedAt: string; openingCash: number; cashSales: number; staffName: string }[];
  hourlySales: { hour: number; orders: number; revenue: number }[];
  cashierSales: { name: string; orders: number; revenue: number }[];
  recentOrders: Order[];
};

function statusStyle(order: Order) {
  if (order.payment_status === "pending") return "border-[#f59e0b] bg-[#fffbeb] text-[#a16207]";
  if (order.status === "cancelled" || order.payment_status === "failed" || order.payment_status === "expired") return "border-[#fecaca] bg-[#fff7f7] text-[#b91c1c]";
  if (order.fulfillment_status === "ready") return "border-[#86efac] bg-[#f0fdf4] text-[#15803d]";
  return "border-[#ddd9ff] bg-[#f5f3ff] text-[#6d4cc4]";
}

export default function OwnerDashboardClient({ business, dashboard, pendingSync }: { business: Business | null; dashboard: Dashboard; pendingSync: {id: string; order_no: string; sync_error: string | null}[] }) {
  const [syncing, setSyncing] = useState(false);
  const [syncMessage, setSyncMessage] = useState('');
  const router = useRouter();
  const [refreshing, setRefreshing] = useState(false);
  const maxHourlyRevenue = Math.max(...dashboard.hourlySales.map((item) => item.revenue), 1);
  const totalPayment = dashboard.today.payment.cash + dashboard.today.payment.qris + dashboard.today.payment.transfer;
  const latestSync = new Intl.DateTimeFormat("id-ID", { hour: "2-digit", minute: "2-digit", timeZone: dashboard.timezone }).format(new Date());

  useEffect(() => {
    const timer = window.setInterval(() => router.refresh(), 60_000);
    return () => window.clearInterval(timer);
  }, [router]);

  const refresh = () => {
    setRefreshing(true);
    router.refresh();
    window.setTimeout(() => setRefreshing(false), 500);
  };

  const queueTotal = dashboard.queue.awaitingPayment + dashboard.queue.preparing + dashboard.queue.ready;
  const paymentRows = useMemo(() => [
    { label: "Tunai", value: dashboard.today.payment.cash, icon: Banknote, color: "bg-[#d9ff57]" },
    { label: "QRIS", value: dashboard.today.payment.qris, icon: Smartphone, color: "bg-[#ddd9ff]" },
    { label: "Transfer", value: dashboard.today.payment.transfer, icon: CreditCard, color: "bg-[#b9f4ea]" },
  ], [dashboard.today.payment]);

  return (
    <div className="min-h-screen bg-[#f7f6fc] pb-10 text-[#232331]">
      {pendingSync.length > 0 && <section className="border-b border-amber-300 bg-amber-50 p-4 text-sm" aria-label="Transaksi perlu diperiksa">
        <p className="font-bold">{pendingSync.length} transaksi menunggu pembaruan poin atau stok</p>
        <ul>{pendingSync.map(order => <li key={order.id}>#{order.order_no}: {order.sync_error || 'Belum selesai diproses'}</li>)}</ul>
        <button type="button" disabled={syncing} className="mt-2 inline-flex min-h-11 items-center gap-2 rounded-lg border border-current px-3 disabled:opacity-50" onClick={async () => {
          setSyncing(true);
          try { const result = await retryOrderSyncAction(); setSyncMessage(result.ok ? 'Pemeriksaan selesai. Transaksi yang masih terkendala tetap ditampilkan.' : result.error); router.refresh(); }
          catch { setSyncMessage('Belum berhasil. Coba lagi sebentar.'); }
          finally { setSyncing(false); }
        }}><RefreshCw size={16}/>{syncing ? 'Memproses...' : 'Coba proses ulang'}</button>
        <p role="status">{syncMessage}</p>
      </section>}
      <header className="sticky top-0 z-30 border-b-2 border-[#232331] bg-white/95 px-3 py-2.5 backdrop-blur sm:px-6">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-2">
          <div className="flex min-w-0 items-center gap-2.5">
            <Link href="/app" className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-[#232331] bg-[#fcfcfe] shadow-ink-xs" aria-label="Kembali ke dashboard">
              <ArrowLeft size={16} />
            </Link>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <h1 className="truncate text-sm font-black sm:text-base">Dashboard Owner POS</h1>
                <span className="shrink-0 rounded-md border border-[#16a34a] bg-[#dcfce7] px-1.5 py-0.5 font-mono text-[9px] font-bold text-[#15803d]">LIVE</span>
              </div>
              <p className="truncate font-mono text-[10px] text-[#7b7b8e]">{business?.name ?? "Toko KAEL"} · tersinkron {latestSync}</p>
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            <button type="button" onClick={refresh} className="btn-tactile flex h-9 w-9 items-center justify-center rounded-xl border border-[#232331] bg-white shadow-ink-xs" title="Muat ulang data" aria-label="Muat ulang data">
              {refreshing ? <Loader2 size={15} className="animate-spin" /> : <RefreshCw size={15} />}
            </button>
            <Link href="/app/pos" className="btn-tactile inline-flex items-center gap-1.5 rounded-xl border-2 border-[#232331] bg-[#d9ff57] px-3 py-2 font-mono text-xs font-black shadow-ink-xs">
              <ShoppingBag size={14} /><span className="hidden sm:inline">Buka Kasir</span>
            </Link>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-7xl space-y-4 p-3 sm:space-y-6 sm:p-6">
        <section className="grid grid-cols-2 gap-2.5 lg:grid-cols-4 lg:gap-4">
          <Kpi label="Omzet hari ini" value={formatRupiah(dashboard.today.revenue)} hint={`${dashboard.today.paidOrders} transaksi lunas`} icon={CircleDollarSign} tone="text-[#6d4cc4] bg-[#f0edff]" />
          <Kpi label="Rata-rata belanja" value={formatRupiah(dashboard.today.averageOrder)} hint="per transaksi lunas" icon={ReceiptText} tone="text-[#15803d] bg-[#dcfce7]" />
          <Kpi label="Pesanan perlu dicek" value={String(dashboard.queue.awaitingPayment)} hint="menunggu pembayaran" icon={Timer} tone={dashboard.queue.awaitingPayment ? "text-[#a16207] bg-[#fef3c7]" : "text-[#15803d] bg-[#dcfce7]"} />
          <Kpi label="Pesanan siap" value={String(dashboard.queue.ready)} hint={`${dashboard.queue.preparing} sedang disiapkan`} icon={UtensilsCrossed} tone={dashboard.queue.ready ? "text-[#15803d] bg-[#dcfce7]" : "text-[#6d4cc4] bg-[#f0edff]"} />
        </section>

        <section className="grid gap-4 lg:grid-cols-[1.45fr_0.9fr]">
          <div className="border-2 border-[#232331] bg-white p-4 shadow-ink-md sm:p-5">
            <div className="flex items-start justify-between gap-3 border-b border-[#dedee8] pb-3">
              <div><h2 className="text-sm font-black sm:text-base">Irama penjualan hari ini</h2><p className="mt-0.5 text-[11px] text-[#7b7b8e]">Jam ramai terlihat dari transaksi kasir yang sudah lunas.</p></div>
              <span className="shrink-0 rounded-lg bg-[#f0edff] px-2 py-1 font-mono text-[10px] font-bold text-[#6d4cc4]">WIB</span>
            </div>
            {dashboard.hourlySales.length ? <div className="mt-5 flex h-40 items-end gap-1.5 sm:h-52 sm:gap-2">
              {dashboard.hourlySales.map((slot) => <div key={slot.hour} className="flex min-w-0 flex-1 flex-col items-center gap-1.5">
                <div className="group relative flex w-full flex-1 items-end"><div className="w-full min-h-[5px] bg-[#7958d8] transition-opacity group-hover:opacity-75" style={{ height: `${Math.max(5, (slot.revenue / maxHourlyRevenue) * 100)}%` }} title={`${slot.hour}:00 · ${formatRupiah(slot.revenue)}`} /></div>
                <span className="font-mono text-[9px] text-[#7b7b8e]">{String(slot.hour).padStart(2, "0")}</span>
              </div>)}
            </div> : <Empty text="Belum ada transaksi lunas hari ini." />}
          </div>

          <div className="border-2 border-[#232331] bg-white p-4 shadow-ink-md sm:p-5">
            <div className="border-b border-[#dedee8] pb-3"><h2 className="text-sm font-black sm:text-base">Cara pelanggan bayar</h2><p className="mt-0.5 text-[11px] text-[#7b7b8e]">Masuk otomatis dari transaksi POS.</p></div>
            <div className="mt-3 space-y-3">
              {paymentRows.map(({ label, value, icon: Icon, color }) => <div key={label}>
                <div className="flex items-center justify-between gap-2 text-xs"><span className="flex items-center gap-1.5 font-bold"><span className={`flex h-6 w-6 items-center justify-center rounded-md ${color}`}><Icon size={13} /></span>{label}</span><span className="font-mono font-black">{formatRupiah(value)}</span></div>
                <div className="mt-1.5 h-1.5 overflow-hidden bg-[#ecebf1]"><div className="h-full bg-[#232331]" style={{ width: `${totalPayment ? Math.round((value / totalPayment) * 100) : 0}%` }} /></div>
              </div>)}
            </div>
          </div>
        </section>

        <section className="grid gap-4 lg:grid-cols-[0.9fr_1.45fr]">
          <div className="border-2 border-[#232331] bg-white p-4 shadow-ink-md sm:p-5">
            <div className="flex items-center justify-between gap-2 border-b border-[#dedee8] pb-3"><div><h2 className="text-sm font-black sm:text-base">Shift & laci tunai</h2><p className="mt-0.5 text-[11px] text-[#7b7b8e]">Pantau shift yang masih berjalan.</p></div><WalletCards size={18} className="text-[#6d4cc4]" /></div>
            <div className="mt-3 space-y-2.5">
              {dashboard.activeShifts.length ? dashboard.activeShifts.map((shift) => <div key={shift.id} className="border border-[#dedee8] bg-[#fcfcfe] p-3">
                <div className="flex items-center justify-between gap-2"><span className="font-bold text-xs">{shift.staffName}</span><span className="rounded-md bg-[#dcfce7] px-1.5 py-0.5 font-mono text-[9px] font-bold text-[#15803d]">AKTIF</span></div>
                <p className="mt-1 font-mono text-[10px] text-[#7b7b8e]">Dibuka {formatBusinessDateTime(shift.openedAt)}</p>
                <div className="mt-2 grid grid-cols-2 gap-2 font-mono text-[10px]"><div><p className="text-[#7b7b8e]">Modal awal</p><p className="font-black">{formatRupiah(shift.openingCash)}</p></div><div><p className="text-[#7b7b8e]">Tunai masuk</p><p className="font-black text-[#15803d]">{formatRupiah(shift.cashSales)}</p></div></div>
              </div>) : <Empty text="Belum ada shift kasir aktif." />}
            </div>
          </div>

          <div className="border-2 border-[#232331] bg-white p-4 shadow-ink-md sm:p-5">
            <div className="flex items-start justify-between gap-3 border-b border-[#dedee8] pb-3"><div><h2 className="text-sm font-black sm:text-base">Transaksi terbaru</h2><p className="mt-0.5 text-[11px] text-[#7b7b8e]">Ada {queueTotal} pesanan yang masih perlu ditindaklanjuti.</p></div><Link href="/app/pos/reports" className="inline-flex shrink-0 items-center gap-1 font-mono text-[10px] font-bold text-[#6d4cc4]">Laporan lengkap <ChevronRight size={13} /></Link></div>
            <div className="mt-1 divide-y divide-[#ecebf1]">
              {dashboard.recentOrders.length ? dashboard.recentOrders.slice(0, 7).map((order) => {
                const refundTotal = Number(order.refund_total ?? 0);
                const netTotal = Math.max(0, Number(order.total) - refundTotal);
                return <div key={order.id} className="flex items-center gap-2 py-2.5">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#f0edff] text-[#6d4cc4]"><Coffee size={14} /></div>
                <div className="min-w-0 flex-1"><p className="truncate text-xs font-black">#{order.order_no} <span className="font-normal text-[#7b7b8e]">· {serviceTypeLabel(order.service_type, order.table_no)}</span></p><p className="font-mono text-[10px] text-[#7b7b8e]">{formatBusinessDateTime(order.created_at)} · {order.payment_method.toUpperCase()}</p></div>
                <div className="text-right"><p className="font-mono text-xs font-black">{formatRupiah(netTotal)}</p>{refundTotal > 0 ? <span className="inline-block rounded-md border border-[#fecaca] bg-[#fff7f7] px-1.5 py-0.5 font-mono text-[8.5px] font-bold text-[#b91c1c]">Refund {formatRupiah(refundTotal)}</span> : <span className={`inline-block rounded-md border px-1.5 py-0.5 font-mono text-[8.5px] font-bold ${statusStyle(order)}`}>{PAYMENT_STATUS_LABEL[order.payment_status] ?? order.fulfillment_status}</span>}</div>
              </div>;
              }) : <Empty text="Belum ada transaksi hari ini." />}
            </div>
          </div>
        </section>

        <section className="border-2 border-[#232331] bg-white p-4 shadow-ink-md sm:p-5">
          <div className="flex items-center justify-between gap-2 border-b border-[#dedee8] pb-3"><div><h2 className="text-sm font-black sm:text-base">Kontribusi kasir hari ini</h2><p className="mt-0.5 text-[11px] text-[#7b7b8e]">Berdasarkan transaksi yang dicatat di POS.</p></div><Clock3 size={17} className="text-[#6d4cc4]" /></div>
          {dashboard.cashierSales.length ? <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">{dashboard.cashierSales.map((cashier) => <div key={cashier.name} className="border border-[#dedee8] bg-[#fcfcfe] p-3"><div className="flex items-center justify-between gap-2"><p className="truncate text-xs font-black">{cashier.name}</p><span className="font-mono text-[10px] text-[#7b7b8e]">{cashier.orders} trx</span></div><p className="mt-1.5 font-mono text-sm font-black text-[#15803d]">{formatRupiah(cashier.revenue)}</p></div>)}</div> : <Empty text="Belum ada penjualan yang tercatat hari ini." />}
        </section>
      </main>
    </div>
  );
}

function Kpi({ label, value, hint, icon: Icon, tone }: { label: string; value: string; hint: string; icon: typeof LayoutDashboard; tone: string }) {
  return <div className="border-2 border-[#232331] bg-white p-3 shadow-ink-xs sm:p-4"><div className="flex items-start justify-between gap-2"><p className="font-mono text-[9px] font-bold uppercase text-[#7b7b8e]">{label}</p><span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ${tone}`}><Icon size={14} /></span></div><p className="mt-2 truncate font-mono text-base font-black sm:text-xl">{value}</p><p className="mt-0.5 truncate text-[10px] text-[#7b7b8e]">{hint}</p></div>;
}

function Empty({ text }: { text: string }) {
  return <div className="py-7 text-center font-mono text-[11px] text-[#7b7b8e]">{text}</div>;
}
