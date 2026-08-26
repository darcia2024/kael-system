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
  ChevronRight 
} from "lucide-react";
import type { Business, Order, Shift } from "@/lib/types";
import { refundOrderAction } from "@/lib/actions";
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
}: {
  business: Business | null;
  reports: PosReports;
  orders: Order[];
  shifts: Shift[];
}) {
  const router = useRouter();

  // Refund Modal State
  const [refundingOrderId, setRefundingOrderId] = useState<string | null>(null);
  const [refundReason, setRefundReason] = useState("");
  const [refundAmount, setRefundAmount] = useState<number>(0);

  // Data ditarik ulang dari server, bukan disusun ulang di klien.
  const refreshAll = () => router.refresh();

  const handleOpenRefund = (order: Order) => {
    setRefundingOrderId(order.id);
    setRefundAmount(order.total);
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
    <div className="min-h-screen bg-[#f7f6fc] text-[#232331] font-sans flex flex-col pb-16 sm:pb-8">
      
      {/* Top Header */}
      <header className="sticky top-0 z-30 border-b-2 border-[#232331] bg-white/95 backdrop-blur-md px-3 sm:px-8 py-2.5 sm:py-3.5">
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
            href="/app/pos"
            className="btn-tactile flex items-center gap-1 rounded-xl border-2 border-[#232331] bg-[#d9ff57] px-3.5 py-1.5 font-mono text-xs font-black text-[#232331] shadow-ink-xs"
          >
            <Receipt size={13} />
            <span>Buka Kasir</span>
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
                      {ord.channel === "qr_dinein" ? `Meja ${ord.table_no || '-'}` : "Takeaway"}
                    </td>
                    <td className="py-3 px-3 font-black text-sm text-[#16a34a]">
                      {formatRupiah(ord.total)}
                    </td>
                    <td className="py-3 px-3 uppercase font-bold text-[#7b7b8e]">
                      {ord.payment_method}
                    </td>
                    <td className="py-3 px-3">
                      <span className={`inline-flex items-center gap-1 font-bold text-[10px] px-2 py-0.5 rounded-full border ${
                        ord.status === "paid"
                          ? "bg-[#dcfce7] text-[#16a34a] border-[#16a34a]"
                          : ord.status === "refunded"
                          ? "bg-[#feebee] text-[#ef4444] border-[#ef4444]"
                          : "bg-[#fef3c7] text-[#d97706] border-[#d97706]"
                      }`}>
                        {ord.status.toUpperCase()}
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
                      {ord.status === "paid" && (
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
                  <th className="py-2.5 px-3">Waktu Buka</th>
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
                    <td className="py-3 px-3 text-[11px]">
                      {formatBusinessDateTime(sh.opened_at)}
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
                ⚡ Transaksi asli akan tetap tersimpan di database sebagai jejak audit dan ditandai sebagai 'refunded'.
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
