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
  QrCode,
  Eye,
  Banknote,
  Plus,
  X,
  AlertCircle,
  Calendar,
} from "lucide-react";
import OrderDetailModal from "./order-detail-modal";
import type { Business, Order, ShiftReport, FeedbackSummary, FeedbackRow, RefundReasonCode } from "@/lib/types";
import { FEEDBACK_REASONS, REFUND_REASONS } from "@/lib/types";
import { refundOrderAction, deleteOrderAction, deleteFeedbackAction, deleteShiftAction, recordShiftCashMovementAction } from "@/lib/actions";
import ClearTestDataModal from "../clear-test-data-modal";
import { Trash2 } from "lucide-react";
import { serviceTypeLabel } from "@/lib/pos-engine";
import { formatRupiah, formatBusinessDateTime } from "@/lib/formatters";
import { isMochiBusiness } from "@/lib/mochi-brand";
import { BusinessMark } from "@/components/business-mark";

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
  /**
   * Unit terjual yang modalnya belum diketahui. Selama di atas nol, laba di
   * layar BELUM mencakup semua yang terjual — dan itu harus tertulis, bukan
   * disembunyikan di balik satu angka bulat.
   */
  unitsWithoutCost: number;
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
  polaRefund,
  menuViewStats,
  themeClassName = "",
}: {
  business: Business | null;
  reports: PosReports;
  orders: Order[];
  shifts: ShiftReport[];
  feedbackSummary: FeedbackSummary;
  recentFeedback: FeedbackRow[];
  /** Perbandingan refund antar kasir. Pola, bukan kejadian tunggal. */
  polaRefund: {
    userId: string; nama: string; peran: string;
    jumlahNota: number; omzet: number;
    jumlahRefund: number; nilaiRefund: number; refundTunai: number;
    persenRefund: number;
  }[];
  /** Kunjungan ke menu digital. Menjawab "QR-nya dipindai atau tidak", terlepas dari ada yang pesan atau tidak. */
  menuViewStats: {
    hariIni: number;
    tujuhHari: number;
    tigaPuluhHari: number;
    perMeja: { tableNo: string; jumlah: number }[];
  };
  themeClassName?: string;
}) {
  const router = useRouter();
  const isMochi = isMochiBusiness(business);

  // Selected Order for Order Detail Pop-up Modal
  const [selectedOrderDetail, setSelectedOrderDetail] = useState<Order | null>(null);

  // Refund Modal State
  const [refundingOrderId, setRefundingOrderId] = useState<string | null>(null);
  const [refundReason, setRefundReason] = useState("");
  const [refundAmount, setRefundAmount] = useState<number>(0);
  /**
   * Kategori dan metode pengembalian.
   *
   * Keduanya kolom sungguhan di tabel refunds, dan METODE-nya yang menentukan
   * uang keluar dari laci atau tidak — jadi rekap tutup shift ikut bergantung
   * padanya. Sebelum ini layar ini tidak menanyakan keduanya, jadi kategorinya
   * selalu "lainnya" dan metodenya selalu menebak dari cara pelanggan membayar.
   */
  const [refundCategory, setRefundCategory] = useState<RefundReasonCode>("salah_input");
  const [refundMethod, setRefundMethod] = useState<"cash" | "qris" | "transfer">("cash");

  // Retroactive Shift Expense Modal (Catat Pengeluaran untuk Shift)
  const [modalShiftExpense, setModalShiftExpense] = useState<{
    shiftId: string;
    staffName: string;
    openedAt: string;
    currentVariance: number;
    amount: number | "";
    category: string;
    note: string;
  } | null>(null);
  const [isSubmittingExpense, setIsSubmittingExpense] = useState(false);

  const handleRecordShiftExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!modalShiftExpense) return;
    const numAmount = Number(modalShiftExpense.amount);
    if (!numAmount || numAmount <= 0) {
      alert("Masukkan nominal pengeluaran kas yang valid.");
      return;
    }
    if (!modalShiftExpense.note.trim()) {
      alert("Catatan pengeluaran wajib diisi.");
      return;
    }

    setIsSubmittingExpense(true);
    const res = await recordShiftCashMovementAction({
      shiftId: modalShiftExpense.shiftId,
      type: "cash_out",
      amount: numAmount,
      category: modalShiftExpense.category || "Bahan Baku/Dapur",
      note: modalShiftExpense.note.trim(),
    });
    setIsSubmittingExpense(false);

    if (!res.ok) {
      alert(`Gagal mencatat pengeluaran: ${res.error}`);
      return;
    }

    setModalShiftExpense(null);
    router.refresh();
    alert(`Pengeluaran sebesar ${formatRupiah(numAmount)} berhasil dicatat! Laci shift berhasil direkonsiliasi ulang.`);
  };

  // Data ditarik ulang dari server, bukan disusun ulang di klien.
  const refreshAll = () => router.refresh();

  const handleOpenRefund = (order: Order) => {
    const remaining = Math.max(0, Number(order.total) - Number(order.refund_total ?? 0));
    setRefundingOrderId(order.id);
    setRefundAmount(remaining);
    setRefundReason("Pembatalan Pesanan Pelanggan");
  };

  const [showClearModal, setShowClearModal] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Filter Periode & Paginasi Riwayat Transaksi (Hari Ini, 7 Hari, Bulan Ini, Semua)
  type OrderPeriodFilter = "today" | "week" | "month" | "all";
  const [orderPeriod, setOrderPeriod] = useState<OrderPeriodFilter>("today");
  const [orderSearch, setOrderSearch] = useState("");
  const [orderPage, setOrderPage] = useState(1);
  const [orderPageSize, setOrderPageSize] = useState(10);

  const handlePeriodChange = (period: OrderPeriodFilter) => {
    setOrderPeriod(period);
    setOrderPage(1);
  };

  const orderStats = useMemo(() => {
    const now = new Date();
    const todayStr = new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Jakarta",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(now);

    let todayCount = 0;
    let todayRevenue = 0;
    let weekCount = 0;
    let weekRevenue = 0;
    let monthCount = 0;
    let monthRevenue = 0;
    let allCount = orders.length;
    let allRevenue = 0;

    orders.forEach((o) => {
      const net = Math.max(0, Number(o.total) - Number(o.refund_total ?? 0));
      allRevenue += net;

      const oDate = new Date(o.created_at);
      const oDateStr = new Intl.DateTimeFormat("en-CA", {
        timeZone: "Asia/Jakarta",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      }).format(oDate);

      const diffDays = (now.getTime() - oDate.getTime()) / (1000 * 3600 * 24);

      if (oDateStr === todayStr) {
        todayCount++;
        todayRevenue += net;
      }
      if (diffDays <= 7) {
        weekCount++;
        weekRevenue += net;
      }
      if (diffDays <= 30) {
        monthCount++;
        monthRevenue += net;
      }
    });

    return {
      today: { count: todayCount, revenue: todayRevenue },
      week: { count: weekCount, revenue: weekRevenue },
      month: { count: monthCount, revenue: monthRevenue },
      all: { count: allCount, revenue: allRevenue },
    };
  }, [orders]);

  const filteredOrders = useMemo(() => {
    const now = new Date();
    const todayStr = new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Jakarta",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(now);

    return orders.filter((o) => {
      if (orderPeriod !== "all") {
        const oDate = new Date(o.created_at);
        if (orderPeriod === "today") {
          const oDateStr = new Intl.DateTimeFormat("en-CA", {
            timeZone: "Asia/Jakarta",
            year: "numeric",
            month: "2-digit",
            day: "2-digit",
          }).format(oDate);
          if (oDateStr !== todayStr) return false;
        } else if (orderPeriod === "week") {
          const diffDays = (now.getTime() - oDate.getTime()) / (1000 * 3600 * 24);
          if (diffDays > 7) return false;
        } else if (orderPeriod === "month") {
          const diffDays = (now.getTime() - oDate.getTime()) / (1000 * 3600 * 24);
          if (diffDays > 30) return false;
        }
      }

      if (orderSearch.trim()) {
        const q = orderSearch.trim().toLowerCase();
        const matchNo = o.order_no.toLowerCase().includes(q);
        const matchTable = (o.table_no ?? "").toLowerCase().includes(q);
        const matchCustomer = (o.customer_name ?? "").toLowerCase().includes(q);
        const matchDelivery = (o.delivery_name ?? "").toLowerCase().includes(q);
        const matchMethod = o.payment_method.toLowerCase().includes(q);
        if (!matchNo && !matchTable && !matchCustomer && !matchDelivery && !matchMethod) {
          return false;
        }
      }

      return true;
    });
  }, [orders, orderPeriod, orderSearch]);

  const totalFilteredRevenue = useMemo(() => {
    return filteredOrders.reduce((sum, o) => sum + Math.max(0, Number(o.total) - Number(o.refund_total ?? 0)), 0);
  }, [filteredOrders]);

  const totalPages = Math.max(1, Math.ceil(filteredOrders.length / orderPageSize));
  const paginatedOrders = useMemo(() => {
    const startIndex = (orderPage - 1) * orderPageSize;
    return filteredOrders.slice(startIndex, startIndex + orderPageSize);
  }, [filteredOrders, orderPage, orderPageSize]);

  const handleDeleteOrder = async (orderId: string, orderNo: string) => {
    if (!window.confirm(`Hapus transaksi #${orderNo} (data testing)? Transaksi akan dihapus permanen dari laporan.`)) return;
    setDeletingId(orderId);
    const res = await deleteOrderAction(orderId);
    setDeletingId(null);
    if (!res.ok) {
      alert(res.error);
      return;
    }
    refreshAll();
  };

  const handleDeleteFeedback = async (feedbackId: string, name: string) => {
    if (!window.confirm(`Hapus ulasan/feedback dari ${name || "Pelanggan"} (data testing)?`)) return;
    const res = await deleteFeedbackAction(feedbackId);
    if (!res.ok) {
      alert(res.error);
      return;
    }
    refreshAll();
  };

  const handleDeleteShift = async (shiftId: string, staffName: string) => {
    if (!window.confirm(`Hapus rekap shift kasir dari ${staffName} (data testing)?`)) return;
    const res = await deleteShiftAction(shiftId);
    if (!res.ok) {
      alert(res.error);
      return;
    }
    refreshAll();
  };

  const handleProcessRefund = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!refundingOrderId) return;

    // Pemilik transaksi dan identitas penyetuju ditentukan server dari sesi,
    // bukan dari id yang dikirim halaman ini.
    const res = await refundOrderAction(
      refundingOrderId,
      refundAmount,
      refundReason,
      refundCategory,
      refundMethod,
    );
    if (!res.ok) {
      alert(res.error);
      return;
    }
    setRefundingOrderId(null);
    refreshAll();
  };

  return (
    <div className={`${themeClassName} mochi-shell min-h-screen ${isMochi ? "bg-[#f0f5f2] text-[#1a382d]" : "bg-[#f7f6fc] text-[#232331]"} font-sans flex flex-col pb-16 sm:pb-8`}>
      
      {/* Top Header */}
      <header
        className={`sticky top-0 z-30 border-b backdrop-blur-md px-3 sm:px-8 py-2.5 sm:py-3.5 transition-colors ${
          isMochi
            ? "border-[#07281e] bg-[#0b3d2e]/98 text-white shadow-sm"
            : "mochi-header border-b-2 border-[#232331] bg-white/95"
        }`}
      >
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-2 sm:gap-3">

          <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1">
            <Link
              href="/app/pos/owner"
              className={
                isMochi
                  ? "flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-emerald-700/50 bg-[#144f3d] text-white hover:bg-[#1b634d] transition-colors"
                  : "flex h-8 w-8 sm:h-9 sm:w-9 shrink-0 items-center justify-center rounded-xl border border-[#232331] bg-[#fcfcfe] text-[#232331] shadow-ink-xs hover:bg-[#f0edff]"
              }
              title="Kembali ke Dashboard Owner Utama"
            >
              <ArrowLeft size={16} />
            </Link>

            {isMochi && (
              <BusinessMark
                name={business?.name}
                logoUrl={business?.logo_url}
                brandColor={business?.brand_color}
                className="h-8 w-8 sm:h-9 sm:w-9 shrink-0 rounded-full border border-emerald-400/40 shadow-xs"
              />
            )}

            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5 sm:gap-2">
                <h1
                  className={`font-black text-xs sm:text-base truncate ${
                    isMochi ? "text-white" : "text-[#232331]"
                  }`}
                >
                  Laporan Omzet &amp; Laba Kasir
                </h1>
                <span
                  className={
                    isMochi
                      ? "hidden md:inline-flex rounded-full bg-[#c8f53a] px-2 py-0.5 font-mono text-[9px] font-black text-[#073829] shadow-xs shrink-0"
                      : "hidden md:inline-flex rounded-md bg-[#dcfce7] px-1.5 py-0.2 font-mono text-[8.5px] sm:text-[9px] font-bold text-[#16a34a] border border-[#16a34a] shrink-0"
                  }
                >
                  Finance Terintegrasi
                </span>
              </div>
              <span
                className={`text-[9.5px] sm:text-[11px] font-mono block truncate ${
                  isMochi ? "text-emerald-200/80" : "text-[#7b7b8e]"
                }`}
              >
                {business?.name ?? "Mochi Cafe n Resto"} · Analisis Laba Riil Toko &amp; HPP
              </span>
            </div>
          </div>

          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
            {/* Tombol Hapus Data Testing */}
            <button
              type="button"
              onClick={() => setShowClearModal(true)}
              className={
                isMochi
                  ? "flex items-center justify-center h-9 w-9 sm:w-auto sm:px-3 sm:py-2 gap-1.5 rounded-xl border border-rose-400/40 bg-rose-600/90 hover:bg-rose-700 font-mono text-xs font-bold text-white shadow-sm transition-all active:scale-95 shrink-0"
                  : "btn-tactile flex items-center justify-center h-9 w-9 sm:w-auto sm:px-3 sm:py-1.5 gap-1 rounded-xl border-2 border-rose-600 bg-rose-50 text-rose-700 hover:bg-rose-100 font-mono text-xs font-bold shadow-ink-xs shrink-0"
              }
              title="Pembersihan data transaksi & ulasan testing"
            >
              <Trash2 size={14} />
              <span className="hidden sm:inline">Hapus Data Testing</span>
            </button>

            {/* Tombol Dashboard Owner (Desktop only, di HP sudah ada tombol kembali di kiri) */}
            <Link
              href="/app/pos/owner"
              className={
                isMochi
                  ? "hidden sm:flex items-center gap-1.5 rounded-xl bg-[#c8f53a] hover:bg-[#d9ff57] px-3.5 py-2 font-mono text-xs font-black text-[#073829] shadow-sm transition-all active:scale-95 shrink-0"
                  : "btn-tactile hidden sm:flex items-center gap-1 rounded-xl border-2 border-[#232331] bg-[#d9ff57] px-3.5 py-1.5 font-mono text-xs font-black text-[#232331] shadow-ink-xs shrink-0"
              }
            >
              <LayoutDashboard size={14} />
              <span>Dashboard Owner Utama</span>
            </Link>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="flex-1 mx-auto w-full max-w-6xl p-3 sm:p-6 lg:p-8 space-y-5">

        {/* Quick Report Switcher Bar */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 font-mono text-xs scrollbar-none">
          <Link
            href="/app/pos/owner"
            className={`inline-flex shrink-0 items-center gap-1.5 rounded-xl border px-3 py-1.5 font-bold transition-all ${
              isMochi
                ? "border-[#ccd9d3] bg-[#edf8f3] text-[#0b3d2e] hover:bg-[#e0f1e8]"
                : "border-[#dedee8] bg-white text-[#7b7b8e] hover:border-[#232331] hover:text-[#232331]"
            }`}
          >
            <ArrowLeft size={13} />
            <span>Dashboard Owner Utama</span>
          </Link>
          <span
            className={`inline-flex shrink-0 items-center gap-1.5 rounded-xl border px-3 py-1.5 font-bold ${
              isMochi
                ? "border-[#0b3d2e] bg-[#0b3d2e] text-[#c8f53a] shadow-sm"
                : "border-2 border-[#232331] bg-[#232331] text-white shadow-ink-xs"
            }`}
          >
            <Receipt size={13} />
            <span>Laporan Penjualan &amp; Laba</span>
          </span>
          <Link
            href="/app/loyalty/analytics"
            className={`inline-flex shrink-0 items-center gap-1.5 rounded-xl border px-3 py-1.5 font-bold transition-all ${
              isMochi
                ? "border-[#d8e3de] bg-white text-[#20372e] hover:bg-[#edf8f3] hover:border-[#167052]/40"
                : "border-[#dedee8] bg-white text-[#7b7b8e] hover:border-[#232331] hover:text-[#232331]"
            }`}
          >
            <Sparkles size={13} />
            <span>Laporan Loyalty Member</span>
          </Link>
          <Link
            href="/app/review/reports"
            className={`inline-flex shrink-0 items-center gap-1.5 rounded-xl border px-3 py-1.5 font-bold transition-all ${
              isMochi
                ? "border-[#d8e3de] bg-white text-[#20372e] hover:bg-[#edf8f3] hover:border-[#167052]/40"
                : "border-[#dedee8] bg-white text-[#7b7b8e] hover:border-[#232331] hover:text-[#232331]"
            }`}
          >
            <Star size={13} />
            <span>Laporan Review &amp; Keluhan</span>
          </Link>
          <Link
            href="/app/finance/reports"
            className={`inline-flex shrink-0 items-center gap-1.5 rounded-xl border px-3 py-1.5 font-bold transition-all ${
              isMochi
                ? "border-[#d8e3de] bg-white text-[#20372e] hover:bg-[#edf8f3] hover:border-[#167052]/40"
                : "border-[#dedee8] bg-white text-[#7b7b8e] hover:border-[#232331] hover:text-[#232331]"
            }`}
          >
            <Clock size={13} />
            <span>Laporan Keuangan</span>
          </Link>
        </div>

        
        {/* KPI OVERVIEW WITH FINANCE GROSS PROFIT */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-4">
          
          <div className={isMochi ? "rounded-2xl sm:rounded-3xl border border-[#d8e3de] bg-white p-3.5 sm:p-5 shadow-sm hover:border-[#167052]/40 transition-all" : "card-tactile rounded-2xl sm:rounded-3xl border sm:border-2 border-[#232331] bg-white p-3.5 sm:p-5 shadow-ink-xs sm:shadow-ink-md"}>
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

          <div className={isMochi ? "rounded-2xl sm:rounded-3xl border border-[#d8e3de] bg-white p-3.5 sm:p-5 shadow-sm hover:border-[#167052]/40 transition-all" : "card-tactile rounded-2xl sm:rounded-3xl border sm:border-2 border-[#232331] bg-white p-3.5 sm:p-5 shadow-ink-xs sm:shadow-ink-md"}>
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
              {/*
                Persentasenya ditampilkan apa adanya. Sebelum ini angka berapa
                pun diberi label "(Sehat ✓)" — termasuk margin 4%, dan owner
                yang percaya label itu tidak punya alasan memeriksa lagi.
              */}
              <span className="text-[9.5px] sm:text-[11px] text-[#16a34a] font-mono font-bold block mt-0.5 sm:mt-1">
                Margin: {reports.totalNetRevenue > 0 ? Math.round((reports.totalEstimatedGrossProfit / reports.totalNetRevenue) * 100) : 0}% dari omzet
              </span>
              {/*
                Menu tanpa modal tidak ikut terhitung, jadi laba di atas selalu
                lebih tinggi dari yang sebenarnya. Itu ditulis di sini, bukan
                dibiarkan owner menyimpulkan sendiri.
              */}
              {reports.unitsWithoutCost > 0 && (
                <span className="mt-1.5 block rounded-lg bg-[#fffbeb] px-2 py-1 font-mono text-[9.5px] font-bold leading-relaxed text-[#92400e]">
                  Belum lengkap: {Math.round(reports.unitsWithoutCost)} porsi terjual belum punya resep atau modal pokok,
                  jadi labanya belum ikut dihitung. Angka aslinya lebih kecil dari ini.
                </span>
              )}
            </div>
          </div>

          <div className={isMochi ? "rounded-2xl sm:rounded-3xl border border-[#d8e3de] bg-white p-3.5 sm:p-5 shadow-sm hover:border-[#167052]/40 transition-all" : "card-tactile rounded-2xl sm:rounded-3xl border sm:border-2 border-[#232331] bg-white p-3.5 sm:p-5 shadow-ink-xs sm:shadow-ink-md"}>
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

          <div className={isMochi ? "rounded-2xl sm:rounded-3xl border border-[#d8e3de] bg-white p-3.5 sm:p-5 shadow-sm hover:border-[#167052]/40 transition-all" : "card-tactile rounded-2xl sm:rounded-3xl border sm:border-2 border-[#232331] bg-white p-3.5 sm:p-5 shadow-ink-xs sm:shadow-ink-md"}>
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
        <div className={isMochi ? "rounded-2xl sm:rounded-3xl border border-[#d8e3de] bg-white p-4 sm:p-6 shadow-sm space-y-4" : "rounded-2xl sm:rounded-3xl border sm:border-2 border-[#232331] bg-white p-4 sm:p-6 shadow-ink-md space-y-4"}>
          <div className="border-b border-[#dedee8] pb-3">
            <h3 className={isMochi ? "font-black text-sm sm:text-base text-[#0b3d2e]" : "font-extrabold text-sm sm:text-base text-[#232331]"}>
              Menu Terlaris &amp; Kontribusi Laba Riil (Koneksi Modul Finance)
            </h3>
            <p className={isMochi ? "text-[11px] sm:text-xs text-[#526159]" : "text-[11px] sm:text-xs text-[#7b7b8e]"}>
              Dihitung otomatis dari data transaksi kasir dan resep HPP bahan baku KAEL Finance.
            </p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left font-mono text-xs">
              <thead>
                <tr className={isMochi ? "border-b border-[#d8e3de] bg-[#edf8f3] text-[#167052] text-[10px] uppercase font-extrabold" : "border-b border-[#dedee8] text-[#7b7b8e] text-[10px] uppercase"}>
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
                    <tr key={idx} className={isMochi ? "hover:bg-[#f7fcf9] transition-colors" : "hover:bg-[#fcfcfe]"}>
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
        <div className={isMochi ? "rounded-2xl sm:rounded-3xl border border-[#d8e3de] bg-white p-4 sm:p-6 shadow-sm space-y-4" : "rounded-2xl sm:rounded-3xl border sm:border-2 border-[#232331] bg-white p-4 sm:p-6 shadow-ink-md space-y-4"}>
          <div className="border-b border-[#dedee8] pb-3">
            <h3 className={isMochi ? "font-black text-sm sm:text-base text-[#0b3d2e]" : "font-extrabold text-sm sm:text-base text-[#232331]"}>
              Feedback Pelanggan
            </h3>
            <p className={isMochi ? "text-[11px] sm:text-xs text-[#526159]" : "text-[11px] sm:text-xs text-[#7b7b8e]"}>
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
                      <div className="flex items-center gap-2">
                        <span className="shrink-0 font-mono text-[10px] text-[#7b7b8e]">{formatBusinessDateTime(f.created_at)}</span>
                        <button
                          type="button"
                          onClick={() => handleDeleteFeedback(f.id, f.customer_name || "Pelanggan")}
                          className="text-rose-500 hover:text-rose-700 p-0.5 rounded hover:bg-rose-50 transition-colors"
                          title="Hapus feedback testing ini"
                        >
                          <Trash2 size={12} />
                        </button>
                      </div>
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
        <div className={isMochi ? "rounded-2xl sm:rounded-3xl border border-[#d8e3de] bg-white p-3.5 sm:p-6 shadow-sm space-y-4" : "rounded-2xl sm:rounded-3xl border sm:border-2 border-[#232331] bg-white p-3.5 sm:p-6 shadow-ink-md space-y-4"}>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-[#dedee8] pb-3">
            <div>
              <h3 className={isMochi ? "font-black text-sm sm:text-base text-[#0b3d2e]" : "font-extrabold text-sm sm:text-base text-[#232331]"}>
                Riwayat Transaksi &amp; Pengembalian Dana (Refund)
              </h3>
              <p className={isMochi ? "text-[11px] sm:text-xs text-[#526159]" : "text-[11px] sm:text-xs text-[#7b7b8e]"}>
                Transaksi bersifat immutable. Ketuk pesanan untuk membuka pop-up rincian menu &amp; rincian tagihan instan.
              </p>
            </div>
            <span className={isMochi ? "inline-flex items-center gap-1 rounded-full bg-[#edf8f3] px-2.5 py-1 font-mono text-[10px] font-black text-[#167052] self-start sm:self-auto border border-emerald-200" : "inline-flex items-center gap-1 rounded-full bg-[#f0edff] px-2.5 py-1 font-mono text-[10px] font-black text-[#7958d8] self-start sm:self-auto"}>
              {orders.length} Transaksi Tercatat
            </span>
          </div>

          {/* FILTER PERIODE & PENCARIAN TRANSAKSI */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 bg-[#f8faf9] p-3 rounded-2xl border border-[#e2ece6]">
            {/* Tabs: Hari Ini / 7 Hari / Bulan Ini / Semua */}
            <div className="flex flex-wrap items-center gap-1.5 font-mono text-xs">
              <button
                type="button"
                onClick={() => handlePeriodChange("today")}
                className={`px-3 py-1.5 rounded-xl font-bold transition-all flex items-center gap-1.5 ${
                  orderPeriod === "today"
                    ? isMochi
                      ? "bg-[#0b3d2e] text-[#c8f53a] shadow-xs"
                      : "bg-[#232331] text-white shadow-xs"
                    : "bg-white text-[#526159] hover:bg-[#edf4f0] border border-[#d8e3de]"
                }`}
              >
                <Calendar size={13} />
                <span>Hari Ini</span>
                <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-black/10">
                  {orderStats.today.count}
                </span>
              </button>
              <button
                type="button"
                onClick={() => handlePeriodChange("week")}
                className={`px-3 py-1.5 rounded-xl font-bold transition-all flex items-center gap-1.5 ${
                  orderPeriod === "week"
                    ? isMochi
                      ? "bg-[#0b3d2e] text-[#c8f53a] shadow-xs"
                      : "bg-[#232331] text-white shadow-xs"
                    : "bg-white text-[#526159] hover:bg-[#edf4f0] border border-[#d8e3de]"
                }`}
              >
                <span>7 Hari</span>
                <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-black/10">
                  {orderStats.week.count}
                </span>
              </button>
              <button
                type="button"
                onClick={() => handlePeriodChange("month")}
                className={`px-3 py-1.5 rounded-xl font-bold transition-all flex items-center gap-1.5 ${
                  orderPeriod === "month"
                    ? isMochi
                      ? "bg-[#0b3d2e] text-[#c8f53a] shadow-xs"
                      : "bg-[#232331] text-white shadow-xs"
                    : "bg-white text-[#526159] hover:bg-[#edf4f0] border border-[#d8e3de]"
                }`}
              >
                <span>Bulan Ini</span>
                <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-black/10">
                  {orderStats.month.count}
                </span>
              </button>
              <button
                type="button"
                onClick={() => handlePeriodChange("all")}
                className={`px-3 py-1.5 rounded-xl font-bold transition-all flex items-center gap-1.5 ${
                  orderPeriod === "all"
                    ? isMochi
                      ? "bg-[#0b3d2e] text-[#c8f53a] shadow-xs"
                      : "bg-[#232331] text-white shadow-xs"
                    : "bg-white text-[#526159] hover:bg-[#edf4f0] border border-[#d8e3de]"
                }`}
              >
                <span>Semua</span>
                <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-black/10">
                  {orderStats.all.count}
                </span>
              </button>
            </div>

            {/* Search and Summary */}
            <div className="flex items-center gap-2 flex-1 md:justify-end">
              <div className="relative flex-1 max-w-xs">
                <Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[#7b8a82]" />
                <input
                  type="search"
                  value={orderSearch}
                  onChange={(e) => {
                    setOrderSearch(e.target.value);
                    setOrderPage(1);
                  }}
                  placeholder="Cari order / meja / nama..."
                  className="w-full rounded-xl border border-[#ccd9d3] bg-white pl-8 pr-3 py-1.5 text-xs text-[#0b3d2e] outline-none focus:border-[#167052] font-mono"
                />
              </div>
              <span className="text-[11px] font-mono font-bold text-[#167052] bg-[#edf8f3] px-2.5 py-1.5 rounded-xl border border-emerald-200 shrink-0">
                {formatRupiah(totalFilteredRevenue)}
              </span>
            </div>
          </div>

          {/* VIEW 1: MOBILE COMPACT CARDS (Mobile-First, No Horizontal Scrolling) */}
          <div className="block md:hidden space-y-2.5">
            {filteredOrders.length === 0 ? (
              <div className="text-center py-8 text-xs text-[#7b7b8e] font-mono space-y-2">
                <p>Tidak ada transaksi pada periode ini.</p>
                {orderPeriod !== "all" && (
                  <button
                    type="button"
                    onClick={() => handlePeriodChange("all")}
                    className="text-xs text-[#167052] font-bold underline"
                  >
                    Tampilkan Semua Transaksi
                  </button>
                )}
              </div>
            ) : (
              paginatedOrders.map((ord) => {
                const hasRefund = (ord.refund_total ?? 0) > 0;
                const netTotal = Math.max(0, Number(ord.total) - Number(ord.refund_total ?? 0));
                const itemsCount = ord.items?.length ?? 0;

                return (
                  <div
                    key={ord.id}
                    onClick={() => setSelectedOrderDetail(ord)}
                    className={
                      isMochi
                        ? "rounded-2xl border border-[#d8e3de] bg-[#fbfdfc] hover:bg-[#f0f7f3] p-3 space-y-2.5 transition-all shadow-xs active:scale-[0.99] cursor-pointer"
                        : "rounded-2xl border-2 border-[#232331] bg-white p-3 space-y-2.5 shadow-ink-xs active:scale-[0.99] cursor-pointer"
                    }
                  >
                    {/* Header: Order No, Payment Method, Date & Status Badge */}
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="font-mono text-sm font-black text-[#0b3d2e]">
                            #{ord.order_no}
                          </span>
                          <span className="text-[9.5px] uppercase font-mono font-bold px-1.5 py-0.2 rounded bg-[#edf8f3] text-[#167052] border border-emerald-200">
                            {ord.payment_method}
                          </span>
                        </div>
                        <p className="text-[10px] font-mono text-[#637970] mt-0.5">
                          {formatBusinessDateTime(ord.created_at)}
                        </p>
                      </div>

                      <span className={`inline-flex items-center gap-1 font-mono font-black text-[9px] px-2 py-0.5 rounded-full border shrink-0 ${
                        hasRefund
                          ? "bg-rose-50 text-rose-700 border-rose-300"
                          : ord.status === "paid"
                          ? "bg-emerald-50 text-[#167052] border-emerald-300"
                          : "bg-amber-50 text-amber-900 border-amber-300"
                      }`}>
                        {hasRefund ? `REFUND ${formatRupiah(ord.refund_total ?? 0)}` : ord.status.toUpperCase()}
                      </span>
                    </div>

                    {/* Middle: Service Type & Total */}
                    <div className="flex items-end justify-between border-t border-b border-[#edf2ef] py-1.5">
                      <div>
                        <span className="text-[11px] font-bold text-[#7958d8] block">
                          {serviceTypeLabel(ord.service_type, ord.table_no)}
                        </span>
                        {(ord.customer_name || ord.delivery_name) && (
                          <span className="text-[10px] text-[#526159] block truncate max-w-[150px]">
                            {ord.customer_name || ord.delivery_name}
                          </span>
                        )}
                        {itemsCount > 0 && (
                          <span className="text-[9.5px] text-[#167052] font-mono font-bold block mt-0.5">
                            📦 {itemsCount} menu · tap untuk rincian ➔
                          </span>
                        )}
                      </div>
                      <div className="text-right font-mono">
                        <span className="text-[9px] text-[#637970] block uppercase font-bold">Total Riil</span>
                        <span className="text-sm font-black text-[#167052]">
                          {formatRupiah(netTotal)}
                        </span>
                      </div>
                    </div>

                    {/* Action Bar */}
                    <div
                      className="flex items-center justify-between gap-1.5 pt-0.5 font-mono"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <button
                        type="button"
                        onClick={() => setSelectedOrderDetail(ord)}
                        className={
                          isMochi
                            ? "flex-1 rounded-xl border border-emerald-300 bg-[#edf8f3] hover:bg-[#d8f0e5] py-1.5 px-2 text-[10.5px] font-bold text-[#0b3d2e] inline-flex items-center justify-center gap-1 shadow-xs active:scale-95 transition-all"
                            : "flex-1 rounded-xl border border-[#232331] bg-[#f0edff] py-1.5 px-2 text-[10.5px] font-bold text-[#232331] inline-flex items-center justify-center gap-1 active:scale-95"
                        }
                      >
                        <Eye size={12} />
                        <span>Rincian</span>
                      </button>

                      <Link
                        href={`/receipt/${ord.id}`}
                        target="_blank"
                        className={
                          isMochi
                            ? "flex-1 rounded-xl border border-[#ccd9d3] bg-white hover:bg-[#f8faf9] py-1.5 px-2 text-[10.5px] font-bold text-[#526159] inline-flex items-center justify-center gap-1 shadow-xs active:scale-95 transition-all"
                            : "flex-1 rounded-xl border border-[#232331] bg-white py-1.5 px-2 text-[10.5px] font-bold text-[#232331] inline-flex items-center justify-center gap-1 active:scale-95"
                        }
                      >
                        <Receipt size={12} />
                        <span>Struk</span>
                      </Link>

                      {ord.status === "paid" && Number(ord.refund_total ?? 0) < Number(ord.total) && (
                        <button
                          type="button"
                          onClick={() => handleOpenRefund(ord)}
                          className="rounded-xl border border-rose-300 bg-rose-50 hover:bg-rose-100 py-1.5 px-2.5 text-[10.5px] font-bold text-rose-700 inline-flex items-center justify-center gap-1 active:scale-95 transition-all"
                        >
                          <RotateCcw size={11} />
                          <span>Refund</span>
                        </button>
                      )}

                      <button
                        type="button"
                        onClick={() => handleDeleteOrder(ord.id, ord.order_no)}
                        disabled={deletingId === ord.id}
                        className="rounded-xl border border-rose-200 bg-rose-50/70 hover:bg-rose-100 py-1.5 px-2 text-[10.5px] font-bold text-rose-700 inline-flex items-center justify-center disabled:opacity-50 active:scale-95 transition-all"
                        title="Hapus data testing"
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* VIEW 2: DESKTOP / TABLET DATA TABLE */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-left font-mono text-xs">
              <thead>
                <tr className={isMochi ? "border-b border-[#d8e3de] bg-[#edf8f3] text-[#167052] text-[10px] uppercase font-extrabold" : "border-b border-[#dedee8] text-[#7b7b8e] text-[10px] uppercase"}>
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
                {filteredOrders.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-8 text-center text-[#7b7b8e] font-mono">
                      Tidak ada transaksi pada periode ini.
                    </td>
                  </tr>
                ) : (
                  paginatedOrders.map((ord) => (
                    <tr
                      key={ord.id}
                      onClick={() => setSelectedOrderDetail(ord)}
                      className={`${
                        isMochi ? "hover:bg-[#f7fcf9]" : "hover:bg-[#fcfcfe]"
                      } cursor-pointer transition-colors group`}
                    >
                      <td className="py-3 px-3 font-black text-sm text-[#232331]">
                        <div className="flex items-center gap-1.5">
                          <span className="group-hover:text-[#167052] transition-colors font-mono">#{ord.order_no}</span>
                          <span className="opacity-0 group-hover:opacity-100 transition-opacity text-[10px] text-[#167052] font-sans font-medium">
                            (lihat rincian)
                          </span>
                        </div>
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
                      <td
                        className="py-3 px-3 text-right space-x-1.5 whitespace-nowrap"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <button
                          type="button"
                          onClick={() => setSelectedOrderDetail(ord)}
                          className={
                            isMochi
                              ? "rounded-xl border border-emerald-300 bg-[#edf8f3] hover:bg-[#d8f0e5] px-2.5 py-1 text-[11px] font-mono font-bold text-[#167052] transition-all inline-flex items-center gap-1 shadow-xs active:scale-95"
                              : "btn-tactile rounded-lg border border-[#7958d8] bg-[#f0edff] px-2 py-1 text-[10.5px] font-bold text-[#7958d8] inline-flex items-center gap-1"
                          }
                          title="Lihat Pop-up Rincian Pesanan"
                        >
                          <Eye size={12} />
                          <span>Detail</span>
                        </button>
                        <Link
                          href={`/receipt/${ord.id}`}
                          target="_blank"
                          className={isMochi ? "rounded-xl border border-[#ccd9d3] bg-white hover:bg-[#edf8f3] px-2.5 py-1 text-[11px] font-mono font-bold text-[#167052] transition-colors inline-block" : "btn-tactile rounded-lg border border-[#7958d8] bg-[#f0edff] px-2.5 py-1 text-[10.5px] font-bold text-[#7958d8]"}
                        >
                          Struk
                        </Link>
                        {ord.status === "paid" && Number(ord.refund_total ?? 0) < Number(ord.total) && (
                          <button
                            type="button"
                            onClick={() => handleOpenRefund(ord)}
                            className={isMochi ? "rounded-xl border border-rose-200 bg-rose-50 hover:bg-rose-100 px-2.5 py-1 text-[11px] font-mono font-bold text-rose-700 transition-colors" : "btn-tactile rounded-lg border border-[#ef4444] bg-[#feebee] px-2 py-1 text-[10.5px] font-bold text-[#ef4444]"}
                          >
                            Refund
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => handleDeleteOrder(ord.id, ord.order_no)}
                          disabled={deletingId === ord.id}
                          className="rounded-xl border border-rose-200 bg-rose-50 hover:bg-rose-100 px-2 py-1 text-[11px] font-mono font-bold text-rose-700 transition-colors inline-flex items-center gap-0.5 disabled:opacity-50"
                          title="Hapus transaksi (data testing)"
                        >
                          <Trash2 size={11} />
                          <span>Hapus</span>
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* CONTROLS PAGINASI & UKURAN HALAMAN */}
          {filteredOrders.length > 0 && (
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-3 border-t border-[#edf2ef] font-mono text-xs">
              <div className="flex items-center gap-2 text-[#637970] text-[11px]">
                <span>
                  Menampilkan {(orderPage - 1) * orderPageSize + 1}–{Math.min(orderPage * orderPageSize, filteredOrders.length)} dari {filteredOrders.length} transaksi
                </span>
                <span className="text-gray-300">|</span>
                <div className="flex items-center gap-1">
                  <span>Per hal:</span>
                  {[10, 25, 50].map((sz) => (
                    <button
                      key={sz}
                      type="button"
                      onClick={() => {
                        setOrderPageSize(sz);
                        setOrderPage(1);
                      }}
                      className={`px-2 py-0.5 rounded-lg text-[10.5px] font-bold transition-colors ${
                        orderPageSize === sz
                          ? "bg-[#0b3d2e] text-[#c8f53a]"
                          : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                      }`}
                    >
                      {sz}
                    </button>
                  ))}
                </div>
              </div>

              {totalPages > 1 && (
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    disabled={orderPage <= 1}
                    onClick={() => setOrderPage((p) => Math.max(1, p - 1))}
                    className="px-3 py-1 rounded-xl border border-[#ccd9d3] bg-white font-bold text-[#0b3d2e] hover:bg-[#edf8f3] disabled:opacity-40 disabled:cursor-not-allowed transition-colors text-xs"
                  >
                    ← Sebelumnya
                  </button>
                  <span className="px-2 font-bold text-[#0b3d2e] text-xs">
                    {orderPage} / {totalPages}
                  </span>
                  <button
                    type="button"
                    disabled={orderPage >= totalPages}
                    onClick={() => setOrderPage((p) => Math.min(totalPages, p + 1))}
                    className="px-3 py-1 rounded-xl border border-[#ccd9d3] bg-white font-bold text-[#0b3d2e] hover:bg-[#edf8f3] disabled:opacity-40 disabled:cursor-not-allowed transition-colors text-xs"
                  >
                    Selanjutnya →
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {/*
          POLA PENGEMBALIAN DANA PER KASIR

          Panel ini ada karena rekonsiliasi laci di bawah TIDAK menangkap
          penipuan refund. Pelanggan membayar tunai, kasir mencatatnya sebagai
          refund, uangnya diambil — dan selisih lacinya tetap nol, karena
          sistem memang mengharapkan uang itu sudah keluar.

          Satu refund tidak pernah mencurigakan dengan sendirinya. Yang
          berbicara adalah perbandingannya: kasir yang mengembalikan 12%
          penjualannya sementara rekannya 0,4% adalah pertanyaan yang layak
          diajukan — dan pertanyaan itu tidak akan pernah muncul kalau angkanya
          tidak pernah diletakkan bersebelahan.
        */}
        {polaRefund.length > 0 && (
          <div className={isMochi ? "rounded-2xl sm:rounded-3xl border border-[#d8e3de] bg-white p-4 sm:p-6 shadow-sm space-y-4" : "rounded-2xl sm:rounded-3xl border sm:border-2 border-[#232331] bg-white p-4 sm:p-6 shadow-ink-md space-y-4"}>
            <div className="border-b border-[#dedee8] pb-3">
              <h3 className={isMochi ? "font-black text-sm sm:text-base text-[#0b3d2e]" : "font-extrabold text-sm sm:text-base text-[#232331]"}>
                Pola Pengembalian Dana per Kasir · 30 Hari
              </h3>
              <p className={isMochi ? "text-[11px] sm:text-xs text-[#526159]" : "text-[11px] sm:text-xs text-[#7b7b8e]"}>
                Rekonsiliasi laci tidak menangkap refund fiktif — lacinya tetap cocok.
                Yang terbaca di sini polanya, bukan satu kejadian.
              </p>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left font-mono text-xs">
                <thead>
                  <tr className={isMochi ? "border-b border-[#d8e3de] bg-[#edf8f3] text-[#167052] text-[10px] uppercase font-extrabold" : "border-b border-[#dedee8] text-[#7b7b8e] text-[10px] uppercase"}>
                    <th className="py-2.5 px-3">Nama</th>
                    <th className="py-2.5 px-3 text-right">Nota</th>
                    <th className="py-2.5 px-3 text-right">Penjualan</th>
                    <th className="py-2.5 px-3 text-right">Refund</th>
                    <th className="py-2.5 px-3 text-right">Nilai Refund</th>
                    <th className="py-2.5 px-3 text-right">Tunai</th>
                    <th className="py-2.5 px-3 text-right">% dari Penjualan</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#dedee8]">
                  {polaRefund.map((r) => {
                    // 5% sudah tinggi untuk warung; 10% pantas ditanyakan hari itu juga.
                    const tinggi = r.persenRefund >= 10;
                    const sedang = !tinggi && r.persenRefund >= 5;
                    return (
                      <tr key={r.userId} className={tinggi ? "bg-rose-50" : sedang ? "bg-amber-50" : ""}>
                        <td className="py-3 px-3 font-sans text-xs font-black text-[#232331]">
                          {r.nama}
                          <span className="ml-1.5 font-mono text-[9.5px] font-normal text-[#7b7b8e]">
                            {r.peran === "owner" ? "owner" : "kasir"}
                          </span>
                        </td>
                        <td className="py-3 px-3 text-right">{r.jumlahNota}</td>
                        <td className="py-3 px-3 text-right">{formatRupiah(r.omzet)}</td>
                        <td className="py-3 px-3 text-right">{r.jumlahRefund}</td>
                        <td className="py-3 px-3 text-right font-bold text-rose-700">
                          {r.nilaiRefund > 0 ? formatRupiah(r.nilaiRefund) : "-"}
                        </td>
                        <td className="py-3 px-3 text-right">{r.refundTunai || "-"}</td>
                        <td className={`py-3 px-3 text-right font-black ${tinggi ? "text-rose-700" : sedang ? "text-amber-700" : "text-[#5b7a6e]"}`}>
                          {r.persenRefund.toFixed(1)}%
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <p className="flex items-start gap-2 text-[11px] leading-relaxed text-[#5b7a6e]">
              <AlertTriangle size={13} className="mt-0.5 shrink-0 text-amber-600" />
              <span>
                Angka tinggi bukan tuduhan — bisa saja satu kasir memang kebagian
                shift yang banyak komplainnya. Yang penting angkanya ditanyakan,
                bukan didiamkan.
              </span>
            </p>
          </div>
        )}

        {/*
          KUNJUNGAN MENU DIGITAL

          Owner yang mencetak QR di tiap meja tidak punya cara tahu apakah
          QR-nya benar-benar dipindai, atau cuma tertempel diam di meja. Tanpa
          angka ini, "menu digital sepi" dan "menu digital ramai tapi tidak
          ada yang pesan" terlihat identik dari kasir — padahal dua masalah
          itu solusinya berbeda total: yang satu soal QR-nya tidak terlihat
          atau tidak menarik, yang satu soal menu atau harganya.
        */}
        <div className={isMochi ? "rounded-2xl sm:rounded-3xl border border-[#d8e3de] bg-white p-4 sm:p-6 shadow-sm space-y-4" : "rounded-2xl sm:rounded-3xl border sm:border-2 border-[#232331] bg-white p-4 sm:p-6 shadow-ink-md space-y-4"}>
          <div className="flex items-center gap-2 border-b border-[#dedee8] pb-3">
            <QrCode size={16} className={isMochi ? "text-[#167052]" : "text-[#232331]"} />
            <div>
              <h3 className={isMochi ? "font-black text-sm sm:text-base text-[#0b3d2e]" : "font-extrabold text-sm sm:text-base text-[#232331]"}>
                Kunjungan Menu Digital
              </h3>
              <p className={isMochi ? "text-[11px] sm:text-xs text-[#526159]" : "text-[11px] sm:text-xs text-[#7b7b8e]"}>
                Berapa kali QR di meja dipindai — terpisah dari ada tidaknya pesanan.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2 sm:gap-3">
            <div className={isMochi ? "rounded-xl bg-[#edf8f3] p-3 text-center" : "rounded-xl bg-[#f4f4fb] p-3 text-center"}>
              <p className="font-mono text-[10px] uppercase text-[#7b8a82]">Hari Ini</p>
              <p className={isMochi ? "font-black text-lg text-[#0b3d2e]" : "font-extrabold text-lg text-[#232331]"}>
                {menuViewStats.hariIni}
              </p>
            </div>
            <div className={isMochi ? "rounded-xl bg-[#edf8f3] p-3 text-center" : "rounded-xl bg-[#f4f4fb] p-3 text-center"}>
              <p className="font-mono text-[10px] uppercase text-[#7b8a82]">7 Hari</p>
              <p className={isMochi ? "font-black text-lg text-[#0b3d2e]" : "font-extrabold text-lg text-[#232331]"}>
                {menuViewStats.tujuhHari}
              </p>
            </div>
            <div className={isMochi ? "rounded-xl bg-[#edf8f3] p-3 text-center" : "rounded-xl bg-[#f4f4fb] p-3 text-center"}>
              <p className="font-mono text-[10px] uppercase text-[#7b8a82]">30 Hari</p>
              <p className={isMochi ? "font-black text-lg text-[#0b3d2e]" : "font-extrabold text-lg text-[#232331]"}>
                {menuViewStats.tigaPuluhHari}
              </p>
            </div>
          </div>

          {menuViewStats.perMeja.length > 0 ? (
            <div>
              <p className="mb-1.5 font-mono text-[10px] uppercase text-[#7b8a82]">
                Meja paling sering memindai · 7 hari
              </p>
              <div className="flex flex-wrap gap-1.5">
                {menuViewStats.perMeja.map((m) => (
                  <span
                    key={m.tableNo}
                    className={isMochi
                      ? "inline-flex items-center gap-1 rounded-lg bg-[#f0f5f2] px-2.5 py-1 font-mono text-[11px] text-[#0b3d2e]"
                      : "inline-flex items-center gap-1 rounded-lg bg-[#f4f4fb] px-2.5 py-1 font-mono text-[11px] text-[#232331]"}
                  >
                    Meja {m.tableNo}
                    <span className="font-bold">{m.jumlah}×</span>
                  </span>
                ))}
              </div>
            </div>
          ) : (
            <p className="text-[11px] leading-relaxed text-[#7b8a82]">
              Belum ada kunjungan tercatat. Kalau QR-nya sudah tertempel di
              meja tapi angkanya tetap nol, kemungkinan besar tidak ada tamu
              yang memindainya — bukan berarti sistemnya diam.
            </p>
          )}
        </div>

        {/* SECTION 3: SHIFTS AUDIT & CASH DRAWER VARIANCE */}
        <div className={isMochi ? "rounded-2xl sm:rounded-3xl border border-[#d8e3de] bg-white p-4 sm:p-6 shadow-sm space-y-4" : "rounded-2xl sm:rounded-3xl border sm:border-2 border-[#232331] bg-white p-4 sm:p-6 shadow-ink-md space-y-4"}>
          <div className="border-b border-[#dedee8] pb-3">
            <h3 className={isMochi ? "font-black text-sm sm:text-base text-[#0b3d2e]" : "font-extrabold text-sm sm:text-base text-[#232331]"}>
              Histori Shift Kasir &amp; Rekonsiliasi Laci Kas
            </h3>
            <p className={isMochi ? "text-[11px] sm:text-xs text-[#526159]" : "text-[11px] sm:text-xs text-[#7b7b8e]"}>
              Audit selisih uang tunai laci untuk mencegah kehilangan uang kasir.
            </p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left font-mono text-xs">
              <thead>
                <tr className={isMochi ? "border-b border-[#d8e3de] bg-[#edf8f3] text-[#167052] text-[10px] uppercase font-extrabold" : "border-b border-[#dedee8] text-[#7b7b8e] text-[10px] uppercase"}>
                  <th className="py-2.5 px-3">Kasir</th>
                  <th className="py-2.5 px-3">Waktu Buka</th>
                  <th className="py-2.5 px-3 text-right">Dilayani</th>
                  <th className="py-2.5 px-3">Penjualan</th>
                  <th className="py-2.5 px-3">Modal Awal</th>
                  <th className="py-2.5 px-3 text-right">Kas Keluar</th>
                  <th className="py-2.5 px-3">Waktu Tutup</th>
                  <th className="py-2.5 px-3">Target Laci</th>
                  <th className="py-2.5 px-3">Uang Fisik Laci</th>
                  <th className="py-2.5 px-3 text-right">Selisih (Variance)</th>
                  <th className="py-2.5 px-3 text-center">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#dedee8]">
                {shifts.map((sh) => (
                  <tr key={sh.id} className={isMochi ? "hover:bg-[#f7fcf9] transition-colors" : "hover:bg-[#fcfcfe]"}>
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
                        cuma bagian tunai, dan itu ada di kolom Target Laci. */}
                    <td className="py-3 px-3 font-bold text-[#15803d]">
                      {formatRupiah(sh.total_sales)}
                    </td>
                    <td className="py-3 px-3 font-bold">
                      {formatRupiah(sh.opening_cash)}
                    </td>
                    <td className="py-3 px-3 text-right font-bold text-rose-600">
                      {Number(sh.cash_out || 0) > 0 ? `-${formatRupiah(Number(sh.cash_out))}` : "-"}
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
                    <td className="py-3 px-3 text-center whitespace-nowrap">
                      {sh.closed_at ? (
                        <button
                          type="button"
                          onClick={() => setModalShiftExpense({
                            shiftId: sh.id,
                            staffName: sh.staff_name,
                            openedAt: sh.opened_at,
                            currentVariance: sh.variance ?? 0,
                            amount: sh.variance && sh.variance < 0 ? Math.abs(sh.variance) : "",
                            category: "Bahan Baku/Dapur",
                            note: "Belanja bahan dapur & operasional kasir",
                          })}
                          className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-xl font-mono text-[11px] font-bold transition-all shadow-xs ${
                            sh.variance && sh.variance < 0
                              ? "bg-amber-400 hover:bg-amber-300 text-amber-950 font-black"
                              : "bg-[#edf8f3] hover:bg-[#dbeee4] text-[#167052] border border-[#ccd9d3]"
                          }`}
                          title="Catat pengeluaran kas / belanja dapur untuk shift ini"
                        >
                          <Plus size={12} />
                          <span>{sh.variance && sh.variance < 0 ? "Catat Kas Keluar" : "+ Kas Keluar"}</span>
                        </button>
                      ) : (
                        <span className="text-[10px] text-[#7b8a82] font-mono">Shift Aktif</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

      
        {/* LAPORAN REVIEW & AUDIT KEPUASAN PELANGGAN (SMART ROUTING) */}
        <div className={isMochi ? "rounded-2xl sm:rounded-3xl border border-[#d8e3de] bg-white p-4 sm:p-6 shadow-sm space-y-4" : "rounded-2xl sm:rounded-3xl border-2 border-[#232331] bg-white p-4 sm:p-6 shadow-ink space-y-4"}>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#dedee8] pb-4">
            <div>
              <div className="flex items-center gap-2">
                <h2 className={isMochi ? "font-black text-sm sm:text-base text-[#0b3d2e]" : "font-black text-sm sm:text-base text-[#232331]"}>
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
                <thead className={isMochi ? "border-b border-[#d8e3de] bg-[#edf8f3] text-[#167052] text-[10px] font-extrabold uppercase" : "border-b border-[#dedee8] bg-[#f7f6fc] text-[10px] font-bold uppercase text-[#7b7b8e]"}>
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
                      <tr key={f.id} className={isMochi ? "hover:bg-[#f7fcf9] transition-colors" : "hover:bg-[#fcfcfe]"}>
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
        <div className={`fixed inset-0 z-50 backdrop-blur-xs flex items-center justify-center p-4 ${isMochi ? "bg-[#07281e]/65" : "bg-[#232331]/60"}`}>
          <div className={`w-full max-w-md rounded-3xl p-6 font-mono text-xs space-y-4 animate-in zoom-in-95 ${
            isMochi ? "border border-[#d8e3de] bg-white shadow-xl" : "border-2 border-[#232331] bg-white shadow-ink-lg"
          }`}>
            <div className={`flex items-center justify-between border-b pb-3 ${isMochi ? "border-[#edf2ef]" : "border-[#dedee8]"}`}>
              <h3 className={`font-extrabold text-base font-sans ${isMochi ? "text-[#0b3d2e]" : "text-[#232331]"}`}>
                Persetujuan Refund (Owner Only)
              </h3>
              <button
                type="button"
                onClick={() => setRefundingOrderId(null)}
                className={`font-bold p-1 ${isMochi ? "text-[#526159] hover:text-[#0b3d2e]" : "text-[#7b7b8e] hover:text-[#232331]"}`}
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleProcessRefund} className="space-y-3 font-sans text-xs">
              <div className="space-y-1 font-mono">
                <label className={`block font-bold ${isMochi ? "text-[#0b3d2e]" : "text-[#232331]"}`}>Nominal Refund (Rp):</label>
                <input
                  type="number"
                  required
                  min={1}
                  value={refundAmount}
                  onChange={(e) => setRefundAmount(Number(e.target.value))}
                  className={`w-full rounded-xl p-2.5 font-black text-base text-[#ef4444] ${
                    isMochi ? "border border-[#ccd9d3] bg-[#fdfefe] focus:border-[#0b3d2e] focus:outline-none" : "border-2 border-[#232331]"
                  }`}
                />
              </div>

              <div className="space-y-1 font-mono">
                <label className={`block font-bold ${isMochi ? "text-[#0b3d2e]" : "text-[#232331]"}`}>Kategori Alasan:</label>
                <select
                  value={refundCategory}
                  onChange={(e) => setRefundCategory(e.target.value as RefundReasonCode)}
                  className={`w-full rounded-xl p-2.5 text-xs font-bold ${
                    isMochi ? "border border-[#ccd9d3] bg-white text-[#0b3d2e]" : "border-2 border-[#232331]"
                  }`}
                >
                  {REFUND_REASONS.map((r) => (
                    <option key={r.key} value={r.key}>{r.label}</option>
                  ))}
                </select>
              </div>

              <div className="space-y-1 font-mono">
                <label className={`block font-bold ${isMochi ? "text-[#0b3d2e]" : "text-[#232331]"}`}>Uang Dikembalikan Lewat:</label>
                <div className="grid grid-cols-3 gap-1.5">
                  {([["cash","Tunai"],["qris","QRIS"],["transfer","Transfer"]] as const).map(([nilai,label]) => (
                    <button
                      key={nilai}
                      type="button"
                      onClick={() => setRefundMethod(nilai)}
                      className={`rounded-xl py-2 text-[11px] font-bold transition-colors ${
                        refundMethod === nilai
                          ? "bg-[#0b3d2e] text-white"
                          : isMochi ? "border border-[#ccd9d3] bg-white text-[#0b3d2e]" : "border border-[#dedee8] bg-white text-[#232331]"
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
                {/*
                  Ditanyakan, bukan ditebak: yang bayar QRIS bisa saja
                  dikembalikan tunai, dan uang itu tetap keluar dari laci.
                */}
                <p className={`text-[10px] leading-relaxed ${isMochi ? "text-[#526159]" : "text-[#7b7b8e]"}`}>
                  {refundMethod === "cash"
                    ? "Uang keluar dari laci, dan ikut terhitung saat tutup shift."
                    : "Tidak menyentuh laci kas, tapi tetap mengurangi omzet."}
                </p>
              </div>

              <div className="space-y-1 font-mono">
                <label className={`block font-bold ${isMochi ? "text-[#0b3d2e]" : "text-[#232331]"}`}>Keterangan:</label>
                <textarea
                  required
                  rows={2}
                  value={refundReason}
                  onChange={(e) => setRefundReason(e.target.value)}
                  placeholder="Misal: Pelanggan salah pesan / barang habis..."
                  className={`w-full rounded-xl p-2 text-xs ${
                    isMochi ? "border border-[#ccd9d3] text-[#0b3d2e] placeholder:text-[#889990] focus:border-[#0b3d2e] focus:outline-none" : "border border-[#dedee8] text-[#232331]"
                  }`}
                />
              </div>

              <p className={`text-[10px] leading-relaxed ${isMochi ? "text-[#526159]" : "text-[#7b7b8e]"}`}>
                Transaksi asli tetap tercatat sebagai penjualan. Nominal refund mengurangi omzet dan laci kas pada shift pengembaliannya.
              </p>

              <div className={`flex justify-end gap-2 pt-2 border-t font-mono ${isMochi ? "border-[#edf2ef]" : "border-[#dedee8]"}`}>
                <button
                  type="button"
                  onClick={() => setRefundingOrderId(null)}
                  className={`rounded-xl px-3 py-2 font-bold transition-colors ${
                    isMochi ? "border border-[#ccd9d3] bg-[#f8faf9] text-[#526159] hover:bg-[#edf8f3]" : "border border-[#dedee8] bg-white text-[#7b7b8e]"
                  }`}
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="rounded-xl bg-rose-600 hover:bg-rose-700 px-5 py-2 font-black text-white shadow-xs transition-colors"
                >
                  Setujui Refund ✓
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* POP-UP DETAIL / RINCIAN PESANAN LENGKAP */}
      <OrderDetailModal
        order={selectedOrderDetail}
        isOpen={selectedOrderDetail !== null}
        onClose={() => setSelectedOrderDetail(null)}
        onOpenRefund={(ord) => {
          setSelectedOrderDetail(null);
          handleOpenRefund(ord);
        }}
        isMochi={isMochi}
      />

      {/* Pembersih Data Testing Modal */}
      <ClearTestDataModal
        isOpen={showClearModal}
        onClose={() => setShowClearModal(false)}
        onSuccess={() => {
          refreshAll();
        }}
        isMochi={isMochi}
      />

      {/* MODAL CATAT PENGELUARAN / KAS KELUAR SHIFT */}
      {modalShiftExpense && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs font-sans">
          <div className="w-full max-w-md rounded-3xl bg-white p-5 sm:p-6 space-y-4 shadow-2xl border border-[#d8e3de] animate-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-[#eef2f0] pb-3">
              <div>
                <h3 className="font-black text-base text-[#0b3d2e] flex items-center gap-2">
                  <Banknote size={18} className="text-amber-600" />
                  Catat Kas Keluar / Belanja
                </h3>
                <p className="text-[11px] text-[#556960] mt-0.5">
                  Shift: {modalShiftExpense.staffName} · {formatBusinessDateTime(modalShiftExpense.openedAt)}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setModalShiftExpense(null)}
                className="rounded-xl p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
              >
                <X size={18} />
              </button>
            </div>

            {modalShiftExpense.currentVariance < 0 && (
              <div className="p-3 rounded-2xl bg-amber-50 border border-amber-300 text-xs text-amber-950 flex items-start gap-2">
                <AlertCircle size={16} className="text-amber-700 shrink-0 mt-0.5" />
                <div className="leading-relaxed">
                  <p className="font-bold">Selisih saat ini: {formatRupiah(modalShiftExpense.currentVariance)}</p>
                  <p className="text-[11px] text-amber-800">
                    Jika selisih minus ini disebabkan oleh uang laci yang dipakai belanja bahan dapur / es / galon yang lupa diinput kasir, masukkan nominalnya di bawah ini untuk menyeimbangkan laci.
                  </p>
                </div>
              </div>
            )}

            <form onSubmit={handleRecordShiftExpense} className="space-y-3.5">
              <div>
                <label className="block text-xs font-black text-[#0b3d2e] mb-1">
                  Nominal Pengeluaran Kas (Rp):
                </label>
                <input
                  type="number"
                  required
                  min={1}
                  step={1}
                  value={modalShiftExpense.amount}
                  onChange={(e) => setModalShiftExpense({
                    ...modalShiftExpense,
                    amount: e.target.value ? Number(e.target.value) : "",
                  })}
                  placeholder="Contoh: 488000"
                  className="w-full rounded-xl border-2 border-[#ccd9d3] focus:border-[#167052] bg-white p-2.5 text-sm font-black text-[#0b3d2e] outline-none font-mono"
                  autoFocus
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-[#0b3d2e] mb-1">
                  Kategori Pengeluaran:
                </label>
                <div className="flex flex-wrap gap-1.5">
                  {["Bahan Baku/Dapur", "Es Batu/Galon", "Operasional Toko", "Kembalian/Lainnya"].map((cat) => (
                    <button
                      key={cat}
                      type="button"
                      onClick={() => setModalShiftExpense({ ...modalShiftExpense, category: cat })}
                      className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-colors ${
                        modalShiftExpense.category === cat
                          ? "bg-[#0b3d2e] text-[#c8f53a]"
                          : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                      }`}
                    >
                      {cat}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-[#0b3d2e] mb-1">
                  Keterangan / Rincian Belanja:
                </label>
                <input
                  type="text"
                  required
                  value={modalShiftExpense.note}
                  onChange={(e) => setModalShiftExpense({ ...modalShiftExpense, note: e.target.value })}
                  placeholder="Misal: Belanja pasar pagi, es batu kristal"
                  className="w-full rounded-xl border border-[#ccd9d3] focus:border-[#167052] bg-white p-2.5 text-xs text-gray-800 outline-none"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-[#eef2f0] font-mono text-xs">
                <button
                  type="button"
                  onClick={() => setModalShiftExpense(null)}
                  className="rounded-xl border border-gray-300 bg-white px-3 py-2 font-bold text-gray-700 hover:bg-gray-50"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingExpense}
                  className="rounded-xl bg-amber-400 hover:bg-amber-300 px-4 py-2 font-black text-amber-950 shadow-xs transition-all disabled:opacity-50"
                >
                  {isSubmittingExpense ? "Menyimpan..." : "Simpan & Rekonsiliasi"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Footer */}
      <footer className={`border-t py-4 text-center text-xs font-mono transition-colors ${
        isMochi ? "border-[#d8e3de] bg-white text-[#526159]" : "border-[#dedee8] bg-white text-[#7b7b8e]"
      }`}>
        KAEL POS &amp; Ordering Engine · Integrated Finance &amp; Immutable Audit
      </footer>

    </div>
  );
}
