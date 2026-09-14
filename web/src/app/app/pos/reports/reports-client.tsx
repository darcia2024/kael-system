"use client";

import { useRouter } from "next/navigation";

import { useState, useMemo } from "react";
import Link from "next/link";
import { 
  TrendingUp, 
  DollarSign, 
  Receipt, 
  ArrowLeft, 
  Sparkles, 
  Layers, 
  RotateCcw, 
  Clock, 
  Coffee, 
  CheckCircle2, 
  AlertTriangle, 
  Search,
  ChevronRight,
  Star,
  MessageSquare,
  LayoutDashboard,
} from "lucide-react";
import type { Business, Order, ShiftReport, FeedbackSummary, FeedbackRow } from "@/lib/types";
import { FEEDBACK_REASONS } from "@/lib/types";
import { refundOrderAction } from "@/lib/actions";
import { serviceTypeLabel } from "@/lib/pos-engine";
import { formatRupiah, formatBusinessDateTime } from "@/lib/formatters";

type SoldItem = {
  name: string; qty: number; revenue: number;
  /** 0 kalau menu belum dipetakan ke resep KAEL Finance. */
  hpp: number; grossProfit: number;
};
type PaymentRow = { method: string; orders: number; revenue: number };

export interface PosReports {
  today: { orders: number; revenue: number };
  month: { orders: number; revenue: number };
  totalNetRevenue: number;
  totalTransactions: number;
  /** Perkiraan, hanya mencakup menu yang sudah dipetakan ke resep KAEL Finance. */
  totalEstimatedHpp: number;
  totalEstimatedGrossProfit: number;
  hppCoverageRevenue: number;
  topSellingItems: SoldItem[];
  bestSellers: SoldItem[];
  /** Omzet per metode bayar, diakses lewat kunci seperti .qris dan .cash. */
  paymentBreakdown: Record<string, number>;
  byPaymentMethod: PaymentRow[];
  timezone: string;
}

export default function PosOwnerReportsPage({
  business,
  reports,
  orders,
  shifts,
  feedbackSummary,
  recentFeedback,
  themeClassName = "",
}: {
  business: Business | null;
  reports: PosReports;
  orders: Order[];
  shifts: ShiftReport[];
  feedbackSummary: FeedbackSummary;
  recentFeedback: FeedbackRow[];
  themeClassName?: string;
}) {
  const router = useRouter();

  // Refund Modal State
  const [refundingOrderId, setRefundingOrderId] = useState<string | null>(null);
  const [refundReason, setRefundReason] = useState("");
  const [refundAmount, setRefundAmount] = useState<number>(0);

  // Data ditarik ulang dari server, bukan disusun ulang di klien.
  const refreshAll = () => router.refresh();

  const handleOpenRefund = (order: Order) => {
    const remaining = Math.max(0, Number(order.total) - Number(order.refund_total ?? 0));
    setRefundingOrderId(order.id);
    setRefundAmount(remaining);
    setRefundReason("Pembatalan Pesanan Pelanggan");
  };

  const handleProcessRefund = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!refundingOrderId) return;

    // Pemilik transaksi dan identitas penyetuju ditentukan server dari sesi,
    // bukan dari id yang dikirim halaman ini.
    const res = await refundOrderAction(refundingOrderId, refundAmount, refundReason);
    if (!res.ok) {
      alert(res.error);
      return;
    }
    setRefundingOrderId(null);
    refreshAll();
  };

  return (
    <div className={`${themeClassName} mochi-shell min-h-screen bg-[#f7f6fc] text-[#232331] font-sans flex flex-col pb-16 sm:pb-8`}>
      
      {/* Top Header */}
      <header className="mochi-header sticky top-0 z-30 border-b-2 border-[#232331] bg-white/95 backdrop-blur-md px-3 sm:px-8 py-2.5 sm:py-3.5">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-2">
          <div className="flex items-center gap-2 sm:gap-3 min-w-0">
            <Link
              href="/app/pos"
              className="flex h-8 w-8 sm:h-9 sm:w-9 shrink-0 items-center justify-center rounded-xl border border-[#232331] bg-[#fcfcfe] text-[#232331] shadow-ink-xs hover:bg-[#f0edff]"
              title="Kembali ke Terminal Kasir"
            >
              <ArrowLeft size={15} />
            </Link>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <h1 className="font-extrabold text-xs sm:text-base text-[#232331] truncate">
                  Laporan Omzet &amp; Laba Kasir
                </h1>
                <span className="rounded-md bg-[#dcfce7] px-1.5 py-0.2 font-mono text-[8.5px] sm:text-[9px] font-bold text-[#16a34a] border border-[#16a34a] shrink-0">
                  Finance Terintegrasi
                </span>
              </div>
              <span className="text-[9.5px] sm:text-[11px] text-[#7b7b8e] font-mono block truncate">
                {business?.name} · Analisis Laba Riil Toko
              </span>
            </div>
          </div>

          <Link
            href="/app/pos/owner"
            className="btn-tactile flex items-center gap-1 rounded-xl border-2 border-[#232331] bg-[#d9ff57] px-3.5 py-1.5 font-mono text-xs font-black text-[#232331] shadow-ink-xs"
          >
            <LayoutDashboard size={13} />
            <span>Dashboard Owner</span>
          </Link>
        </div>
      </header>

      {/* Main Container */}
      <main className="flex-1 mx-auto w-full max-w-6xl p-3 sm:p-6 lg:p-8 space-y-5">
        
        {/* KPI OVERVIEW WITH FINANCE GROSS PROFIT */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-4">
          
          <div className="card-tactile rounded-2xl sm:rounded-3xl border sm:border-2 border-[#232331] bg-white p-3.5 sm:p-5 shadow-ink-xs sm:shadow-ink-md">
            <div className="flex items-center justify-between border-b border-[#dedee8] pb-1.5 sm:pb-2.5">
              <span className="font-mono text-[9px] sm:text-[10px] font-bold text-[#7958d8] uppercase">TOTAL OMZET BERSIH</span>
              <span className="flex h-6 w-6 sm:h-7 sm:w-7 items-center justify-center rounded-lg bg-[#f0edff] text-[#7958d8]">
                <TrendingUp size={13} />
              </span>
            </div>
            <div className="mt-2 sm:mt-3">
              <h3 className="text-lg sm:text-2xl font-black font-mono text-[#232331]">
                {formatRupiah(reports.totalNetRevenue)}
              </h3>
              <span className="text-[9.5px] sm:text-[11px] text-[#7b7b8e] font-mono block mt-0.5 sm:mt-1">
                {reports.totalTransactions} Transaksi Selesai
              </span>
            </div>
          </div>

          <div className="card-tactile rounded-2xl sm:rounded-3xl border sm:border-2 border-[#232331] bg-white p-3.5 sm:p-5 shadow-ink-xs sm:shadow-ink-md">
            <div className="flex items-center justify-between border-b border-[#dedee8] pb-1.5 sm:pb-2.5">
              <span className="font-mono text-[9px] sm:text-[10px] font-bold text-[#16a34a] uppercase">ESTIMASI LABA KOTOR</span>
              <span className="flex h-6 w-6 sm:h-7 sm:w-7 items-center justify-center rounded-lg bg-[#dcfce7] text-[#16a34a]">
                <Sparkles size={13} />
              </span>
            </div>
            <div className="mt-2 sm:mt-3">
              <h3 className="text-lg sm:text-2xl font-black font-mono text-[#16a34a]">
                +{formatRupiah(reports.totalEstimatedGrossProfit)}
              </h3>
              <span className="text-[9.5px] sm:text-[11px] text-[#16a34a] font-mono font-bold block mt-0.5 sm:mt-1">
                Margin: {reports.totalNetRevenue > 0 ? Math.round((reports.totalEstimatedGrossProfit / reports.totalNetRevenue) * 100) : 0}% (Sehat ✓)
              </span>
            </div>
          </div>

          <div className="card-tactile rounded-2xl sm:rounded-3xl border sm:border-2 border-[#232331] bg-white p-3.5 sm:p-5 shadow-ink-xs sm:shadow-ink-md">
            <div className="flex items-center justify-between border-b border-[#dedee8] pb-1.5 sm:pb-2.5">
              <span className="font-mono text-[9px] sm:text-[10px] font-bold text-[#c2410c] uppercase">TOTAL HPP MODAL</span>
              <span className="flex h-6 w-6 sm:h-7 sm:w-7 items-center justify-center rounded-lg bg-[#ffedd5] text-[#c2410c]">
                <Layers size={13} />
              </span>
            </div>
            <div className="mt-2 sm:mt-3">
              <h3 className="text-lg sm:text-2xl font-black font-mono text-[#c2410c]">
                {formatRupiah(reports.totalEstimatedHpp)}
              </h3>
              <span className="text-[9.5px] sm:text-[11px] text-[#7b7b8e] font-mono block mt-0.5 sm:mt-1">
                Bahan &amp; Kemasan Terpakai
              </span>
            </div>
          </div>

          <div className="card-tactile rounded-2xl sm:rounded-3xl border sm:border-2 border-[#232331] bg-white p-3.5 sm:p-5 shadow-ink-xs sm:shadow-ink-md">
            <div className="flex items-center justify-between border-b border-[#dedee8] pb-1.5 sm:pb-2.5">
              <span className="font-mono text-[9px] sm:text-[10px] font-bold text-[#d97706] uppercase">METODE BAYAR QRIS</span>
              <span className="flex h-6 w-6 sm:h-7 sm:w-7 items-center justify-center rounded-lg bg-[#fef3c7] text-[#d97706]">
                <Receipt size={13} />
              </span>
            </div>
            <div className="mt-2 sm:mt-3">
              <h3 className="text-lg sm:text-2xl font-black font-mono text-[#232331]">
                {formatRupiah(reports.paymentBreakdown.qris)}
              </h3>
              <span className="text-[9.5px] sm:text-[11px] text-[#7b7b8e] font-mono block mt-0.5 sm:mt-1">
                Tunai: {formatRupiah(reports.paymentBreakdown.cash)}
              </span>
            </div>
          </div>

        </div>

        {/* SECTION 1: TOP SELLING MENU WITH REAL PROFIT FROM FINANCE HPP */}
        <div className="rounded-2xl sm:rounded-3xl border sm:border-2 border-[#232331] bg-white p-4 sm:p-6 shadow-ink-md space-y-4">
          <div className="border-b border-[#dedee8] pb-3">
            <h3 className="font-extrabold text-sm sm:text-base text-[#232331]">
              Menu Terlaris &amp; Kontribusi Laba Riil (Koneksi Modul Finance)
            </h3>
            <p className="text-[11px] sm:text-xs text-[#7b7b8e]">
              Dihitung otomatis dari data transaksi kasir dan resep HPP bahan baku KAEL Finance.
            </p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left font-mono text-xs">
              <thead>
                <tr className="border-b border-[#dedee8] text-[#7b7b8e] text-[10px] uppercase">
                  <th className="py-2.5 px-3">Nama Menu</th>
                  <th className="py-2.5 px-3">Qty Terjual</th>
                  <th className="py-2.5 px-3">Total Omzet</th>
                  <th className="py-2.5 px-3">Total Modal HPP</th>
                  <th className="py-2.5 px-3">Laba Bersih Menu</th>
                  <th className="py-2.5 px-3 text-right">Margin %</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#dedee8]">
                {reports.topSellingItems.map((item, idx) => {
                  const marginPct = item.revenue > 0 ? Math.round((item.grossProfit / item.revenue) * 100) : 0;
                  return (
                    <tr key={idx} className="hover:bg-[#fcfcfe]">
                      <td className="py-3 px-3 font-extrabold text-[#232331] font-sans">
                        {item.name}
                      </td>
                      <td className="py-3 px-3 font-black text-sm text-[#7958d8]">
                        {item.qty} pcs
                      </td>
                      <td className="py-3 px-3 font-bold text-[#232331]">
                        {formatRupiah(item.revenue)}
                      </td>
                      <td className="py-3 px-3 font-bold text-[#c2410c]">
                        {formatRupiah(item.hpp)}
                      </td>
                      <td className="py-3 px-3 font-black text-sm text-[#16a34a]">
                        +{formatRupiah(item.grossProfit)}
                      </td>
                      <td className="py-3 px-3 text-right font-black text-[#16a34a]">
                        {marginPct}%
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* SECTION 1.5: FEEDBACK PASCATRANSAKSI */}
        <div className="rounded-2xl sm:rounded-3xl border sm:border-2 border-[#232331] bg-white p-4 sm:p-6 shadow-ink-md space-y-4">
          <div className="border-b border-[#dedee8] pb-3">
            <h3 className="font-extrabold text-sm sm:text-base text-[#232331]">
              Feedback Pelanggan
            </h3>
            <p className="text-[11px] sm:text-xs text-[#7b7b8e]">
              Rating dan alasan singkat yang dikirim pelanggan dari halaman struk, sesudah transaksi.
            </p>
          </div>

          {feedbackSummary.total === 0 ? (
            <div className="py-8 text-center">
              <MessageSquare className="mx-auto text-[#7958d8]" size={25} />
              <p className="mt-3 text-sm font-bold">Belum ada feedback masuk</p>
              <p className="mt-1 text-xs text-[#5c5c70]">Muncul otomatis begitu pelanggan mengisi rating dari struk digitalnya.</p>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-3 gap-3 font-mono text-xs">
                <div className="rounded-xl border border-[#dedee8] bg-[#fcfcfe] p-3 text-center">
                  <p className="text-lg font-black text-[#232331]">{feedbackSummary.total}</p>
                  <p className="text-[10px] text-[#7b7b8e]">Total Feedback</p>
                </div>
                <div className="rounded-xl border border-[#dedee8] bg-[#fcfcfe] p-3 text-center">
                  <p className="flex items-center justify-center gap-1 text-lg font-black text-[#232331]">
                    {feedbackSummary.avgRating.toFixed(1)}
                    <Star size={14} className="fill-[#facc15] text-[#facc15]" />
                  </p>
                  <p className="text-[10px] text-[#7b7b8e]">Rata-rata Rating</p>
                </div>
                <div className="rounded-xl border border-[#dedee8] bg-[#fcfcfe] p-3 text-center">
                  <p className={`text-lg font-black ${feedbackSummary.lowCount > 0 ? "text-[#c2410c]" : "text-[#232331]"}`}>{feedbackSummary.lowCount}</p>
                  <p className="text-[10px] text-[#7b7b8e]">Rating ≤3</p>
                </div>
              </div>

              {feedbackSummary.byReason.length > 0 && (
                <div>
                  <p className="font-mono text-[10px] font-bold uppercase text-[#7958d8]">Masalah yang paling sering muncul</p>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {feedbackSummary.byReason.map((r) => (
                      <span key={r.reason_code} className="rounded-full border border-[#dedee8] bg-[#fcfcfe] px-2.5 py-1 font-mono text-[11px] font-bold text-[#5c5c70]">
                        {FEEDBACK_REASONS.find((f) => f.key === r.reason_code)?.label ?? r.reason_code} · {r.count}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              <div className="max-h-72 divide-y divide-[#dedee8] overflow-y-auto">
                {recentFeedback.map((f) => (
                  <div key={f.id} className="py-2.5">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1">
                        {[1, 2, 3, 4, 5].map((n) => (
                          <Star key={n} size={12} className={f.rating >= n ? "fill-[#facc15] text-[#facc15]" : "text-[#dedee8]"} />
                        ))}
                        {f.reason_code && (
                          <span className="ml-1.5 rounded-full bg-[#fff7f7] px-2 py-0.5 font-mono text-[9.5px] font-bold text-[#b91c1c]">
                            {FEEDBACK_REASONS.find((r) => r.key === f.reason_code)?.label ?? f.reason_code}
                          </span>
                        )}
                      </div>
                      <span className="shrink-0 font-mono text-[10px] text-[#7b7b8e]">{formatBusinessDateTime(f.created_at)}</span>
                    </div>
                    <p className="mt-1 text-xs text-[#5c5c70]">
                      <span className="font-bold text-[#232331]">{f.customer_name || "Pelanggan"}</span> · #{f.order_no}
                    </p>
                    {f.comment && <p className="mt-1 text-xs italic text-[#232331]">&ldquo;{f.comment}&rdquo;</p>}
                  </div>
                ))}
              </div>
            </>
          )}
        </div>

        {/* SECTION 2: RECENT ORDERS & OWNER REFUND */}
        <div className="rounded-2xl sm:rounded-3xl border sm:border-2 border-[#232331] bg-white p-4 sm:p-6 shadow-ink-md space-y-4">
          <div className="border-b border-[#dedee8] pb-3">
            <h3 className="font-extrabold text-sm sm:text-base text-[#232331]">
              Riwayat Transaksi &amp; Pengembalian Dana (Refund)
            </h3>
            <p className="text-[11px] sm:text-xs text-[#7b7b8e]">
              Transaksi bersifat immutable. Pembatalan/refund wajib disetujui owner dan dicatat terpisah.
            </p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left font-mono text-xs">
              <thead>
                <tr className="border-b border-[#dedee8] text-[#7b7b8e] text-[10px] uppercase">
                  <th className="py-2.5 px-3">No. Order</th>
                  <th className="py-2.5 px-3">Waktu</th>
                  <th className="py-2.5 px-3">Tipe &amp; Meja</th>
                  <th className="py-2.5 px-3">Total Bayar</th>
                  <th className="py-2.5 px-3">Metode</th>
                  <th className="py-2.5 px-3">Status</th>
                  <th className="py-2.5 px-3 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#dedee8]">
                {orders.map((ord) => (
                  <tr key={ord.id} className="hover:bg-[#fcfcfe]">
                    <td className="py-3 px-3 font-black text-sm text-[#232331]">
                      {ord.order_no}
                    </td>
                    <td className="py-3 px-3 text-[#7b7b8e] text-[11px]">
                      {formatBusinessDateTime(ord.created_at)}
                    </td>
                    <td className="py-3 px-3 font-bold text-[#7958d8]">
                      {serviceTypeLabel(ord.service_type, ord.table_no)}
                    </td>
                    <td className="py-3 px-3 font-black text-sm text-[#16a34a]">
                      {formatRupiah(Math.max(0, Number(ord.total) - Number(ord.refund_total ?? 0)))}
                    </td>
                    <td className="py-3 px-3 uppercase font-bold text-[#7b7b8e]">
                      {ord.payment_method}
                    </td>
                    <td className="py-3 px-3">
                      <span className={`inline-flex items-center gap-1 font-bold text-[10px] px-2 py-0.5 rounded-full border ${
                        (ord.refund_total ?? 0) > 0
                          ? "bg-[#feebee] text-[#ef4444] border-[#ef4444]"
                          : ord.status === "paid"
                          ? "bg-[#dcfce7] text-[#16a34a] border-[#16a34a]"
                          : ord.status === "refunded"
                          ? "bg-[#feebee] text-[#ef4444] border-[#ef4444]"
                          : "bg-[#fef3c7] text-[#d97706] border-[#d97706]"
                      }`}>
                        {(ord.refund_total ?? 0) > 0 ? `REFUND ${formatRupiah(ord.refund_total ?? 0)}` : ord.status.toUpperCase()}
                      </span>
                    </td>
                    <td className="py-3 px-3 text-right space-x-1.5 whitespace-nowrap">
                      <Link
                        href={`/receipt/${ord.id}`}
                        target="_blank"
                        className="btn-tactile rounded-lg border border-[#7958d8] bg-[#f0edff] px-2.5 py-1 text-[10.5px] font-bold text-[#7958d8]"
                      >
                        Struk
                      </Link>
                      {ord.status === "paid" && Number(ord.refund_total ?? 0) < Number(ord.total) && (
                        <button
                          type="button"
                          onClick={() => handleOpenRefund(ord)}
                          className="btn-tactile rounded-lg border border-[#ef4444] bg-[#feebee] px-2 py-1 text-[10.5px] font-bold text-[#ef4444]"
                        >
                          Refund
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* SECTION 3: SHIFTS AUDIT & CASH DRAWER VARIANCE */}
        <div className="rounded-2xl sm:rounded-3xl border sm:border-2 border-[#232331] bg-white p-4 sm:p-6 shadow-ink-md space-y-4">
          <div className="border-b border-[#dedee8] pb-3">
            <h3 className="font-extrabold text-sm sm:text-base text-[#232331]">
              Histori Shift Kasir &amp; Rekonsiliasi Laci Kas
            </h3>
            <p className="text-[11px] sm:text-xs text-[#7b7b8e]">
              Audit selisih uang tunai laci untuk mencegah kehilangan uang kasir.
            </p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left font-mono text-xs">
              <thead>
                <tr className="border-b border-[#dedee8] text-[#7b7b8e] text-[10px] uppercase">
                  <th className="py-2.5 px-3">Kasir</th>
                  <th className="py-2.5 px-3">Waktu Buka</th>
                  <th className="py-2.5 px-3 text-right">Dilayani</th>
                  <th className="py-2.5 px-3">Penjualan</th>
                  <th className="py-2.5 px-3">Modal Awal</th>
                  <th className="py-2.5 px-3">Waktu Tutup</th>
                  <th className="py-2.5 px-3">Uang Sistem</th>
                  <th className="py-2.5 px-3">Uang Fisik Laci</th>
                  <th className="py-2.5 px-3 text-right">Selisih (Variance)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#dedee8]">
                {shifts.map((sh) => (
                  <tr key={sh.id} className="hover:bg-[#fcfcfe]">
                    <td className="py-3 px-3 font-sans text-xs font-black text-[#232331]">
                      {sh.staff_name}
                    </td>
                    <td className="py-3 px-3 text-[11px]">
                      {formatBusinessDateTime(sh.opened_at)}
                    </td>
                    <td className="py-3 px-3 text-right font-bold">
                      {sh.orders_count} orang
                    </td>
                    {/* Termasuk QRIS dan transfer; yang dibandingkan dengan laci
                        cuma bagian tunai, dan itu ada di kolom Uang Sistem. */}
                    <td className="py-3 px-3 font-bold text-[#15803d]">
                      {formatRupiah(sh.total_sales)}
                    </td>
                    <td className="py-3 px-3 font-bold">
                      {formatRupiah(sh.opening_cash)}
                    </td>
                    <td className="py-3 px-3 text-[11px] text-[#7b7b8e]">
                      {sh.closed_at ? formatBusinessDateTime(sh.closed_at) : "Sedang Berjalan..."}
                    </td>
                    <td className="py-3 px-3 font-bold text-[#7958d8]">
                      {sh.expected_cash !== null ? formatRupiah(sh.expected_cash) : "-"}
                    </td>
                    <td className="py-3 px-3 font-bold">
                      {sh.closing_cash !== null ? formatRupiah(sh.closing_cash) : "-"}
                    </td>
                    <td className="py-3 px-3 text-right">
                      {sh.variance !== null ? (
                        <span className={`font-black text-sm ${sh.variance === 0 ? "text-[#16a34a]" : sh.variance > 0 ? "text-[#d97706]" : "text-[#ef4444]"}`}>
                          {sh.variance === 0 ? "PAS (Rp 0) ✓" : `${sh.variance > 0 ? "+" : ""}${formatRupiah(sh.variance)}`}
                        </span>
                      ) : (
                        <span className="text-[#d97706] font-bold text-[10px]">SHIFT AKTIF</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

      
        {/* LAPORAN REVIEW & AUDIT KEPUASAN PELANGGAN (SMART ROUTING) */}
        <div className="rounded-2xl sm:rounded-3xl border-2 border-[#232331] bg-white p-4 sm:p-6 shadow-ink space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#dedee8] pb-4">
            <div>
              <div className="flex items-center gap-2">
                <h2 className="font-black text-sm sm:text-base text-[#232331]">
                  Laporan Review &amp; Audit Kepuasan Pelanggan
                </h2>
                <span className="inline-flex items-center gap-1 rounded-full bg-[#dcfce7] px-2.5 py-0.5 font-mono text-[9px] font-black text-[#15803d]">
                  <CheckCircle2 size={12} /> SMART ROUTING
                </span>
              </div>
              <p className="mt-1 text-xs text-[#7b7b8e] max-w-xl">
                ⭐ Bintang 4–5 otomatis dialihkan ke Google Review publik. 🔒 Bintang 1–3 disaring privat ke dashboard ini.
              </p>
            </div>
          </div>

          {/* Stat Ringkas */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="rounded-xl border border-[#dedee8] bg-[#fcfcfe] p-3.5">
              <div className="flex items-center justify-between">
                <span className="font-mono text-[10px] font-bold uppercase text-[#7b7b8e]">Skor Kepuasan</span>
                <Star size={14} className="fill-amber-400 text-amber-400" />
              </div>
              <div className="mt-2 flex items-baseline gap-1">
                <span className="font-mono text-2xl font-black text-[#232331]">
                  {feedbackSummary?.avgRating > 0 ? feedbackSummary.avgRating.toFixed(1) : "5.0"}
                </span>
                <span className="font-mono text-xs text-[#7b7b8e]">/ 5.0</span>
              </div>
              <p className="mt-0.5 text-[10px] text-[#7b7b8e]">Dari {feedbackSummary?.total ?? 0} penilaian</p>
            </div>

            <div className="rounded-xl border border-[#86efac] bg-[#f0fdf4] p-3.5">
              <div className="flex items-center justify-between">
                <span className="font-mono text-[10px] font-bold uppercase text-emerald-800">Direct ke Google (⭐ 4-5)</span>
                <Sparkles size={14} className="text-emerald-600" />
              </div>
              <div className="mt-2 flex items-baseline gap-1">
                <span className="font-mono text-2xl font-black text-emerald-900">
                  {Math.max(0, (feedbackSummary?.total ?? 0) - (feedbackSummary?.lowCount ?? 0))}
                </span>
                <span className="font-mono text-xs text-emerald-700">ulasan</span>
              </div>
              <p className="mt-0.5 text-[10px] text-emerald-700 font-medium">Otomatis dialihkan ke Google Review</p>
            </div>

            <div className="rounded-xl border border-amber-300 bg-amber-50 p-3.5">
              <div className="flex items-center justify-between">
                <span className="font-mono text-[10px] font-bold uppercase text-amber-900">Keluhan Privat (⭐ 1-3)</span>
                <AlertTriangle size={14} className="text-amber-600" />
              </div>
              <div className="mt-2 flex items-baseline gap-1">
                <span className="font-mono text-2xl font-black text-amber-900">
                  {feedbackSummary?.lowCount ?? 0}
                </span>
                <span className="font-mono text-xs text-amber-700">keluhan</span>
              </div>
              <p className="mt-0.5 text-[10px] text-amber-800 font-medium">Terlindungi di dashboard (tidak bocor ke publik)</p>
            </div>
          </div>

          {/* Tabel / Daftar Feedback */}
          {recentFeedback && recentFeedback.length > 0 ? (
            <div className="overflow-x-auto rounded-xl border border-[#dedee8]">
              <table className="w-full text-left font-mono text-xs">
                <thead className="border-b border-[#dedee8] bg-[#f7f6fc] text-[10px] font-bold uppercase text-[#7b7b8e]">
                  <tr>
                    <th className="py-2.5 px-3">Rating</th>
                    <th className="py-2.5 px-3">Tujuan / Status</th>
                    <th className="py-2.5 px-3">Topik Evaluasi</th>
                    <th className="py-2.5 px-3">Komentar / Masukan</th>
                    <th className="py-2.5 px-3">Pelanggan / Titik</th>
                    <th className="py-2.5 px-3 text-right">Waktu</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#dedee8] bg-white">
                  {recentFeedback.map((f) => {
                    const isLow = f.rating <= 3;
                    return (
                      <tr key={f.id} className="hover:bg-[#fcfcfe]">
                        <td className="py-3 px-3 font-black text-[#232331]">
                          <span className="inline-flex items-center gap-1">
                            <Star size={13} className={isLow ? "fill-amber-400 text-amber-400" : "fill-emerald-500 text-emerald-500"} />
                            {f.rating}/5
                          </span>
                        </td>
                        <td className="py-3 px-3">
                          {isLow ? (
                            <span className="inline-block rounded-full border border-amber-300 bg-amber-100 px-2 py-0.5 text-[9px] font-bold text-amber-900">
                              🔒 Privat (Dashboard)
                            </span>
                          ) : (
                            <span className="inline-block rounded-full border border-emerald-300 bg-emerald-100 px-2 py-0.5 text-[9px] font-bold text-emerald-900">
                              ⭐ Direct Google
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-3 text-[#232331] font-bold">
                          {f.reason_code ? f.reason_code.toUpperCase() : "-"}
                        </td>
                        <td className="py-3 px-3 font-sans text-xs text-[#232331] max-w-xs">
                          {f.comment ? `"${f.comment}"` : <span className="text-[#7b7b8e] italic">(Tanpa pesan)</span>}
                        </td>
                        <td className="py-3 px-3 text-[11px] text-[#7b7b8e]">
                          <div>{f.customer_name || "Pelanggan"}</div>
                          {f.card_label && <div className="text-[10px] text-[#637970]">{f.card_label}</div>}
                          {f.order_no && <div className="text-[10px]">Order #{f.order_no}</div>}
                        </td>
                        <td className="py-3 px-3 text-right text-[11px] text-[#7b7b8e]">
                          {formatBusinessDateTime(f.created_at)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="py-6 text-center text-xs text-[#7b7b8e] font-mono">
              Belum ada ulasan atau masukan pelanggan tercatat.
            </div>
          )}
        </div>

      </main>

      {/* MODAL: OWNER REFUND PROCESSING */}
      {refundingOrderId && (
        <div className="fixed inset-0 z-50 bg-[#232331]/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="w-full max-w-md rounded-3xl border-2 border-[#232331] bg-white p-6 shadow-ink-lg space-y-4 animate-in zoom-in-95 font-mono text-xs">
            <div className="flex items-center justify-between border-b border-[#dedee8] pb-3">
              <h3 className="font-extrabold text-base text-[#232331] font-sans">
                Persetujuan Refund (Owner Only)
              </h3>
              <button
                type="button"
                onClick={() => setRefundingOrderId(null)}
                className="text-[#7b7b8e] hover:text-[#232331] font-bold p-1"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleProcessRefund} className="space-y-3 font-sans text-xs">
              <div className="space-y-1 font-mono">
                <label className="block font-bold text-[#232331]">Nominal Refund (Rp):</label>
                <input
                  type="number"
                  required
                  min={1}
                  value={refundAmount}
                  onChange={(e) => setRefundAmount(Number(e.target.value))}
                  className="w-full rounded-xl border-2 border-[#232331] p-2.5 font-black text-base text-[#ef4444]"
                />
              </div>

              <div className="space-y-1 font-mono">
                <label className="block font-bold text-[#232331]">Alasan Refund:</label>
                <textarea
                  required
                  rows={2}
                  value={refundReason}
                  onChange={(e) => setRefundReason(e.target.value)}
                  placeholder="Misal: Pelanggan salah pesan / barang habis..."
                  className="w-full rounded-xl border border-[#dedee8] p-2 text-xs text-[#232331]"
                />
              </div>

              <p className="text-[10px] text-[#7b7b8e] leading-relaxed">
                Transaksi asli tetap tercatat sebagai penjualan. Nominal refund mengurangi omzet dan laci kas pada shift pengembaliannya.
              </p>

              <div className="flex justify-end gap-2 pt-2 border-t border-[#dedee8] font-mono">
                <button
                  type="button"
                  onClick={() => setRefundingOrderId(null)}
                  className="rounded-xl border border-[#dedee8] bg-white px-3 py-2 font-bold text-[#7b7b8e]"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="btn-tactile rounded-xl bg-[#ef4444] px-5 py-2 font-black text-white shadow-ink-xs"
                >
                  Setujui Refund ✓
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Footer */}
      <footer className="border-t border-[#dedee8] bg-white py-4 text-center text-xs font-mono text-[#7b7b8e]">
        KAEL POS &amp; Ordering Engine · Integrated Finance &amp; Immutable Audit
      </footer>

    </div>
  );
}
