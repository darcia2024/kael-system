"use client";

import { useState, useEffect, useMemo } from "react";
import { 
  X, 
  Receipt, 
  ShoppingBag, 
  ArrowDownRight, 
  ArrowUpRight, 
  CheckCircle2, 
  AlertTriangle, 
  Search, 
  DollarSign, 
  Wallet, 
  CreditCard, 
  QrCode, 
  Banknote, 
  Plus, 
  Trash2, 
  Clock, 
  User, 
  Coffee, 
  FileText, 
  Sparkles,
  AlertCircle,
  Calendar,
  UtensilsCrossed
} from "lucide-react";
import type { ShiftFullDetail, ShiftReport, Order, ShiftCashMovement } from "@/lib/types";
import { getShiftDetailAction, deleteShiftCashMovementAction, recordShiftCashMovementAction } from "@/lib/actions";
import { formatRupiah, formatBusinessDateTime } from "@/lib/formatters";
import { serviceTypeLabel } from "@/lib/pos-engine";

interface ShiftDetailModalProps {
  shiftId: string | null;
  isOpen: boolean;
  onClose: () => void;
  onSelectOrder?: (order: Order) => void;
  onRefreshParent?: () => void;
  isMochi?: boolean;
}

export default function ShiftDetailModal({
  shiftId,
  isOpen,
  onClose,
  onSelectOrder,
  onRefreshParent,
  isMochi = false,
}: ShiftDetailModalProps) {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<ShiftFullDetail | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Tabs: 'reconciliation' | 'movements' | 'orders' | 'items'
  const [activeTab, setActiveTab] = useState<"orders" | "movements" | "items">("orders");

  // Filter for orders
  const [orderSearch, setOrderSearch] = useState("");
  const [paymentFilter, setPaymentFilter] = useState<string>("all");

  // Inline Quick Add Expense state
  const [showAddExpense, setShowAddExpense] = useState(false);
  const [expenseAmount, setExpenseAmount] = useState<number | "">("");
  const [expenseCategory, setExpenseCategory] = useState("Bahan Baku/Dapur");
  const [expenseNote, setExpenseNote] = useState("");
  const [submittingExpense, setSubmittingExpense] = useState(false);

  // Deleting movement state
  const [deletingMovementId, setDeletingMovementId] = useState<string | null>(null);

  const fetchDetail = async (id: string) => {
    setLoading(true);
    setError(null);
    try {
      const res = await getShiftDetailAction(id);
      if (res.ok) {
        setData(res.data);
      } else {
        setError(res.error || "Gagal memuat rincian shift.");
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Terjadi kesalahan koneksi.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen && shiftId) {
      fetchDetail(shiftId);
      setShowAddExpense(false);
      setOrderSearch("");
      setPaymentFilter("all");
    } else {
      setData(null);
      setError(null);
    }
  }, [isOpen, shiftId]);

  // Aggregate items sold
  const aggregatedItems = useMemo(() => {
    if (!data?.orders) return [];
    const map = new Map<string, { name: string; qty: number; totalRevenue: number }>();
    for (const order of data.orders) {
      if (!order.items) continue;
      for (const item of order.items) {
        const key = item.menu_item_id || item.name_snapshot;
        const existing = map.get(key);
        const qty = Number(item.qty || 0);
        const subtotal = Number(item.subtotal || 0);
        if (existing) {
          existing.qty += qty;
          existing.totalRevenue += subtotal;
        } else {
          map.set(key, {
            name: item.name_snapshot,
            qty,
            totalRevenue: subtotal,
          });
        }
      }
    }
    return Array.from(map.values()).sort((a, b) => b.qty - a.qty);
  }, [data?.orders]);

  // Filtered orders
  const filteredOrders = useMemo(() => {
    if (!data?.orders) return [];
    return data.orders.filter((ord) => {
      if (paymentFilter !== "all" && ord.payment_method !== paymentFilter) {
        return false;
      }
      if (!orderSearch.trim()) return true;
      const q = orderSearch.toLowerCase();
      const matchNo = ord.order_no.toLowerCase().includes(q);
      const matchCustomer = ord.customer_name?.toLowerCase().includes(q) ?? false;
      const matchTable = ord.table_no?.toLowerCase().includes(q) ?? false;
      const matchItem = ord.items?.some((i) => i.name_snapshot.toLowerCase().includes(q)) ?? false;
      return matchNo || matchCustomer || matchTable || matchItem;
    });
  }, [data?.orders, orderSearch, paymentFilter]);

  if (!isOpen) return null;

  const handleAddExpenseSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!shiftId || !expenseAmount || Number(expenseAmount) <= 0 || !expenseNote.trim()) {
      alert("Harap isi nominal dan keterangan kas keluar.");
      return;
    }

    setSubmittingExpense(true);
    const res = await recordShiftCashMovementAction({
      shiftId,
      type: "cash_out",
      amount: Number(expenseAmount),
      category: expenseCategory,
      note: expenseNote.trim(),
    });
    setSubmittingExpense(false);

    if (!res.ok) {
      alert(`Gagal mencatat pengeluaran: ${res.error}`);
      return;
    }

    setExpenseAmount("");
    setExpenseNote("");
    setShowAddExpense(false);
    // Refresh modal data & parent
    await fetchDetail(shiftId);
    if (onRefreshParent) onRefreshParent();
  };

  const handleDeleteMovement = async (movementId: string) => {
    if (!shiftId) return;
    if (!confirm("Hapus catatan kas keluar/masuk ini? Target laci akan dihitung ulang.")) return;

    setDeletingMovementId(movementId);
    const res = await deleteShiftCashMovementAction(shiftId, movementId);
    setDeletingMovementId(null);

    if (!res.ok) {
      alert(`Gagal menghapus: ${res.error}`);
      return;
    }

    await fetchDetail(shiftId);
    if (onRefreshParent) onRefreshParent();
  };

  const shift = data?.shift;
  const stats = data?.stats;
  const movements = data?.movements || [];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-2 sm:p-4 backdrop-blur-xs animate-in fade-in-50">
      {/* Backdrop */}
      <div className="fixed inset-0" onClick={onClose} />

      <div className="relative w-full max-w-4xl rounded-3xl bg-white text-[#1c2d26] shadow-2xl overflow-hidden flex flex-col max-h-[92vh] border border-[#d8e3de] animate-in zoom-in-95 z-10">
        
        {/* Header Modal */}
        <div
          className={`flex items-start justify-between border-b p-4 sm:p-5 text-white ${
            isMochi
              ? "border-[#07281e] bg-gradient-to-r from-[#0b3d2e] via-[#0f4635] to-[#144f3d]"
              : "border-[#232331] bg-[#232331]"
          }`}
        >
          <div className="flex items-start gap-3 min-w-0">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-white/15 text-[#c8f53a] shadow-xs">
              <FileText size={22} />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-base sm:text-xl font-black tracking-tight text-white">
                  Rincian Lengkap Shift Kasir
                </h2>
                {shift && (
                  <span
                    className={`inline-flex items-center rounded-full px-2.5 py-0.5 font-mono text-[10px] font-black uppercase tracking-wider ${
                      shift.closed_at
                        ? "bg-[#c8f53a] text-[#073829]"
                        : "bg-amber-400 text-amber-950 animate-pulse"
                    }`}
                  >
                    {shift.closed_at ? "Shift Ditutup" : "Shift Sedang Berjalan"}
                  </span>
                )}
              </div>

              {shift && (
                <div className="text-xs text-emerald-100/90 font-mono mt-1 flex flex-wrap items-center gap-x-3 gap-y-1">
                  <span className="flex items-center gap-1 font-bold text-white">
                    <User size={13} className="text-[#c8f53a]" />
                    {shift.staff_name}
                  </span>
                  <span>·</span>
                  <span className="flex items-center gap-1">
                    <Clock size={13} />
                    {formatBusinessDateTime(shift.opened_at)}
                    {shift.closed_at && ` s/d ${formatBusinessDateTime(shift.closed_at)}`}
                  </span>
                </div>
              )}
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Tutup"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white/10 text-white hover:bg-white/20 transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-5 bg-[#fafcfb]">
          {loading && (
            <div className="py-20 text-center space-y-3">
              <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-[#167052] border-r-transparent"></div>
              <p className="font-mono text-xs text-[#526159]">Memuat seluruh data transaksi &amp; kas shift...</p>
            </div>
          )}

          {error && !loading && (
            <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-rose-800 text-xs flex items-center gap-3">
              <AlertCircle size={20} className="shrink-0 text-rose-600" />
              <div>
                <p className="font-bold">Gagal Mengambil Data Shift</p>
                <p>{error}</p>
              </div>
            </div>
          )}

          {data && !loading && (
            <>
              {/* STATUS SELISIH VARIANCE BANNER */}
              {shift && (
                <div
                  className={`rounded-2xl p-4 sm:p-5 border transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                    shift.variance === 0
                      ? "bg-[#edf8f3] border-[#a8dfc5] text-[#0d593f]"
                      : shift.variance !== null && shift.variance > 0
                      ? "bg-amber-50 border-amber-300 text-amber-950"
                      : shift.variance !== null && shift.variance < 0
                      ? "bg-rose-50 border-rose-300 text-rose-950"
                      : "bg-blue-50 border-blue-200 text-blue-950"
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <div
                      className={`h-10 w-10 rounded-xl flex items-center justify-center shrink-0 ${
                        shift.variance === 0
                          ? "bg-emerald-600 text-white"
                          : shift.variance !== null && shift.variance > 0
                          ? "bg-amber-500 text-white"
                          : shift.variance !== null && shift.variance < 0
                          ? "bg-rose-600 text-white"
                          : "bg-blue-600 text-white"
                      }`}
                    >
                      {shift.variance === 0 ? (
                        <CheckCircle2 size={22} />
                      ) : (
                        <AlertTriangle size={22} />
                      )}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs uppercase font-extrabold tracking-wider">
                          Rekonsiliasi Laci Kas
                        </span>
                        <span className="font-mono text-xs px-2 py-0.5 rounded-full font-black bg-white/70 shadow-xs">
                          {shift.variance === 0
                            ? "PAS (Rp 0) ✓"
                            : shift.variance !== null && shift.variance > 0
                            ? `LEBIH (+${formatRupiah(shift.variance)})`
                            : shift.variance !== null && shift.variance < 0
                            ? `KURANG (${formatRupiah(shift.variance)})`
                            : "SHIFT AKTIF"}
                        </span>
                      </div>
                      <p className="text-xs mt-1 leading-relaxed">
                        {shift.variance === 0 ? (
                          "Hitungan uang fisik kasir cocok persis dengan target sistem (Penjualan Tunai + Modal - Kas Keluar)."
                        ) : shift.variance !== null && shift.variance < 0 ? (
                          <span>
                            Uang fisik di laci kurang sebesar{" "}
                            <strong>{formatRupiah(Math.abs(shift.variance))}</strong>. Ini biasa terjadi jika kasir memakai uang laci untuk belanja bahan baku / es batu tanpa mencatatnya.
                          </span>
                        ) : shift.variance !== null && shift.variance > 0 ? (
                          <span>
                            Uang fisik di laci lebih banyak{" "}
                            <strong>{formatRupiah(shift.variance)}</strong> dibanding target pencatatan.
                          </span>
                        ) : (
                          "Shift ini masih aktif dan belum dihitung uang penutupannya."
                        )}
                      </p>
                    </div>
                  </div>

                  {shift.closed_at && (
                    <button
                      type="button"
                      onClick={() => setShowAddExpense(!showAddExpense)}
                      className="shrink-0 self-start sm:self-center px-3.5 py-2 rounded-xl bg-white border border-current shadow-xs text-xs font-bold hover:bg-white/80 transition-all flex items-center gap-1.5"
                    >
                      <Plus size={14} />
                      <span>{showAddExpense ? "Tutup Form" : "+ Catat Kas Keluar"}</span>
                    </button>
                  )}
                </div>
              )}

              {/* QUICK ADD EXPENSE FORM (DROPDOWN) */}
              {showAddExpense && (
                <div className="rounded-2xl border-2 border-amber-300 bg-amber-50/60 p-4 space-y-3 animate-in fade-in-50">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-black text-[#0b3d2e] flex items-center gap-1.5">
                      <Sparkles size={14} className="text-amber-600" />
                      Catat Kas Keluar Retroaktif untuk Shift Ini
                    </h4>
                    <button
                      type="button"
                      onClick={() => setShowAddExpense(false)}
                      className="text-gray-400 hover:text-gray-600"
                    >
                      <X size={15} />
                    </button>
                  </div>
                  <form onSubmit={handleAddExpenseSubmit} className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                    <div>
                      <label className="block text-[11px] font-bold text-gray-700 mb-1">
                        Nominal (Rp):
                      </label>
                      <input
                        type="number"
                        required
                        min={1}
                        value={expenseAmount}
                        onChange={(e) => setExpenseAmount(e.target.value ? Number(e.target.value) : "")}
                        placeholder="Contoh: 50000"
                        className="w-full rounded-xl border border-gray-300 bg-white p-2 text-xs font-mono font-bold text-[#0b3d2e] outline-none focus:border-[#167052]"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-gray-700 mb-1">
                        Kategori:
                      </label>
                      <select
                        value={expenseCategory}
                        onChange={(e) => setExpenseCategory(e.target.value)}
                        className="w-full rounded-xl border border-gray-300 bg-white p-2 text-xs font-bold text-[#0b3d2e] outline-none focus:border-[#167052]"
                      >
                        <option value="Bahan Baku/Dapur">Bahan Baku/Dapur</option>
                        <option value="Es Batu/Galon">Es Batu/Galon</option>
                        <option value="Operasional Toko">Operasional Toko</option>
                        <option value="Kembalian/Lainnya">Kembalian/Lainnya</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-gray-700 mb-1">
                        Keterangan Belanja:
                      </label>
                      <div className="flex gap-2">
                        <input
                          type="text"
                          required
                          value={expenseNote}
                          onChange={(e) => setExpenseNote(e.target.value)}
                          placeholder="Misal: Beli es kristal 2 bal"
                          className="w-full rounded-xl border border-gray-300 bg-white p-2 text-xs text-gray-800 outline-none focus:border-[#167052]"
                        />
                        <button
                          type="submit"
                          disabled={submittingExpense}
                          className="px-3 py-2 rounded-xl bg-[#0b3d2e] text-[#c8f53a] font-bold text-xs shrink-0 hover:bg-[#124f3c] transition-all disabled:opacity-50"
                        >
                          {submittingExpense ? "..." : "Simpan"}
                        </button>
                      </div>
                    </div>
                  </form>
                </div>
              )}

              {/* CARD SECTION 1: PERHITUNGAN LACI KAS DETAIL */}
              <div className="rounded-2xl border border-[#d8e3de] bg-white p-4 sm:p-5 shadow-xs space-y-3.5">
                <div className="flex items-center justify-between border-b border-[#edf2ef] pb-2.5">
                  <h3 className="font-black text-xs sm:text-sm text-[#0b3d2e] flex items-center gap-1.5">
                    <Wallet size={16} className="text-[#167052]" />
                    Struktur Perhitungan Target Laci Kasir
                  </h3>
                  <span className="text-[11px] font-mono text-[#526159]">
                    Total Dilayani: <strong>{data.orders.length} Transaksi</strong>
                  </span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 sm:gap-3 font-mono">
                  {/* Modal Awal */}
                  <div className="p-3 rounded-2xl bg-[#f8faf9] border border-[#e5ece8]">
                    <span className="text-[10px] text-[#637970] font-bold block uppercase tracking-wider">
                      1. Modal Awal Laci
                    </span>
                    <span className="text-sm sm:text-base font-black text-[#0b3d2e] block mt-0.5">
                      {formatRupiah(shift?.opening_cash ?? 0)}
                    </span>
                    <span className="text-[10px] text-[#7d9388] block">Kas laci saat buka</span>
                  </div>

                  {/* Penjualan Tunai */}
                  <div className="p-3 rounded-2xl bg-emerald-50/70 border border-emerald-200">
                    <span className="text-[10px] text-emerald-800 font-bold block uppercase tracking-wider">
                      2. (+) Penjualan Tunai
                    </span>
                    <span className="text-sm sm:text-base font-black text-emerald-700 block mt-0.5">
                      +{formatRupiah(stats?.cashSales ?? shift?.cash_sales ?? 0)}
                    </span>
                    <span className="text-[10px] text-emerald-800 block">
                      {stats?.cashCount ?? 0} nota uang tunai
                    </span>
                  </div>

                  {/* Kas Keluar */}
                  <div className="p-3 rounded-2xl bg-rose-50/70 border border-rose-200">
                    <span className="text-[10px] text-rose-800 font-bold block uppercase tracking-wider">
                      3. (-) Kas Keluar
                    </span>
                    <span className="text-sm sm:text-base font-black text-rose-600 block mt-0.5">
                      -{formatRupiah(stats?.totalCashOut ?? shift?.cash_out ?? 0)}
                    </span>
                    <span className="text-[10px] text-rose-800 block">
                      {movements.filter(m => m.type === "cash_out").length} belanja / petty cash
                    </span>
                  </div>

                  {/* Target Akhir Laci */}
                  <div className="p-3 rounded-2xl bg-[#edf8f3] border-2 border-[#167052]/30">
                    <span className="text-[10px] text-[#167052] font-black block uppercase tracking-wider">
                      = Target Laci Sistem
                    </span>
                    <span className="text-sm sm:text-base font-black text-[#0b3d2e] block mt-0.5">
                      {shift?.expected_cash !== null ? formatRupiah(shift?.expected_cash ?? 0) : "-"}
                    </span>
                    <span className="text-[10px] text-[#526159] block">
                      Fisik Kasir: {shift?.closing_cash !== null ? formatRupiah(shift?.closing_cash ?? 0) : "-"}
                    </span>
                  </div>
                </div>
              </div>

              {/* CARD SECTION 2: BREAKDOWN METODE PEMBAYARAN & TOTAL OMZET */}
              <div className="rounded-2xl border border-[#d8e3de] bg-white p-4 sm:p-5 shadow-xs space-y-3.5">
                <div className="flex items-center justify-between border-b border-[#edf2ef] pb-2.5">
                  <h3 className="font-black text-xs sm:text-sm text-[#0b3d2e] flex items-center gap-1.5">
                    <Banknote size={16} className="text-[#167052]" />
                    Rincian Omzet Berdasarkan Metode Bayar
                  </h3>
                  <span className="font-mono text-xs font-bold text-[#167052]">
                    Total Omzet: {formatRupiah(stats?.totalSales ?? shift?.total_sales ?? 0)}
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {/* Tunai */}
                  <div className="flex items-center justify-between p-3 rounded-2xl border border-emerald-100 bg-[#f7fcf9]">
                    <div className="flex items-center gap-2.5">
                      <div className="h-9 w-9 rounded-xl bg-emerald-100 text-[#0b3d2e] flex items-center justify-center">
                        <Banknote size={18} />
                      </div>
                      <div>
                        <div className="font-black text-xs text-[#0b3d2e]">Uang Tunai (Cash)</div>
                        <div className="text-[10px] text-[#556960] font-mono">{stats?.cashCount ?? 0} transaksi</div>
                      </div>
                    </div>
                    <div className="text-right font-mono font-black text-xs text-[#0b3d2e]">
                      {formatRupiah(stats?.cashSales ?? 0)}
                    </div>
                  </div>

                  {/* QRIS */}
                  <div className="flex items-center justify-between p-3 rounded-2xl border border-blue-100 bg-[#f8fbff]">
                    <div className="flex items-center gap-2.5">
                      <div className="h-9 w-9 rounded-xl bg-blue-100 text-blue-800 flex items-center justify-center">
                        <QrCode size={18} />
                      </div>
                      <div>
                        <div className="font-black text-xs text-blue-950">QRIS / Non-Tunai</div>
                        <div className="text-[10px] text-blue-700 font-mono">{stats?.qrisCount ?? 0} transaksi</div>
                      </div>
                    </div>
                    <div className="text-right font-mono font-black text-xs text-blue-900">
                      {formatRupiah(stats?.qrisSales ?? 0)}
                    </div>
                  </div>

                  {/* Transfer Bank */}
                  <div className="flex items-center justify-between p-3 rounded-2xl border border-purple-100 bg-[#faf8ff]">
                    <div className="flex items-center gap-2.5">
                      <div className="h-9 w-9 rounded-xl bg-purple-100 text-purple-800 flex items-center justify-center">
                        <CreditCard size={18} />
                      </div>
                      <div>
                        <div className="font-black text-xs text-purple-950">Transfer Bank</div>
                        <div className="text-[10px] text-purple-700 font-mono">{stats?.transferCount ?? 0} transaksi</div>
                      </div>
                    </div>
                    <div className="text-right font-mono font-black text-xs text-purple-900">
                      {formatRupiah(stats?.transferSales ?? 0)}
                    </div>
                  </div>
                </div>
              </div>

              {/* CATATAN KASIR JIKA ADA */}
              {shift?.notes && (
                <div className="rounded-2xl border border-amber-200 bg-amber-50/50 p-3.5 text-xs text-amber-950 flex items-start gap-2.5">
                  <FileText size={16} className="text-amber-700 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-bold block text-[11px] uppercase tracking-wider text-amber-800">
                      Catat Kasir Saat Tutup Shift:
                    </span>
                    <p className="mt-0.5 font-mono text-xs">{shift.notes}</p>
                  </div>
                </div>
              )}

              {/* TABS NAVIGATION */}
              <div className="space-y-3">
                <div className="flex items-center gap-1.5 border-b border-[#d8e3de] pb-2 overflow-x-auto">
                  <button
                    type="button"
                    onClick={() => setActiveTab("orders")}
                    className={`px-3.5 py-1.5 rounded-xl text-xs font-black transition-all flex items-center gap-1.5 shrink-0 ${
                      activeTab === "orders"
                        ? "bg-[#0b3d2e] text-[#c8f53a] shadow-xs"
                        : "text-[#526159] hover:bg-[#edf8f3]"
                    }`}
                  >
                    <Receipt size={14} />
                    <span>Daftar Nota Transaksi ({data.orders.length})</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setActiveTab("movements")}
                    className={`px-3.5 py-1.5 rounded-xl text-xs font-black transition-all flex items-center gap-1.5 shrink-0 ${
                      activeTab === "movements"
                        ? "bg-[#0b3d2e] text-[#c8f53a] shadow-xs"
                        : "text-[#526159] hover:bg-[#edf8f3]"
                    }`}
                  >
                    <ArrowDownRight size={14} />
                    <span>Rincian Kas Keluar &amp; Masuk ({movements.length})</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setActiveTab("items")}
                    className={`px-3.5 py-1.5 rounded-xl text-xs font-black transition-all flex items-center gap-1.5 shrink-0 ${
                      activeTab === "items"
                        ? "bg-[#0b3d2e] text-[#c8f53a] shadow-xs"
                        : "text-[#526159] hover:bg-[#edf8f3]"
                    }`}
                  >
                    <UtensilsCrossed size={14} />
                    <span>Menu Terjual Shift Ini ({aggregatedItems.length})</span>
                  </button>
                </div>

                {/* TAB CONTENT 1: DAFTAR TRANSAKSI (ORDERS) */}
                {activeTab === "orders" && (
                  <div className="space-y-3">
                    {/* Search & Filter bar */}
                    <div className="flex flex-col sm:flex-row gap-2 justify-between">
                      <div className="relative flex-1">
                        <Search size={14} className="absolute left-3 top-2.5 text-[#7b8a82]" />
                        <input
                          type="text"
                          value={orderSearch}
                          onChange={(e) => setOrderSearch(e.target.value)}
                          placeholder="Cari nomor nota (#A-001), meja, menu..."
                          className="w-full pl-8 pr-3 py-1.5 rounded-xl border border-[#d8e3de] bg-white text-xs text-[#0b3d2e] outline-none focus:border-[#167052]"
                        />
                      </div>
                      <div className="flex gap-1">
                        {[
                          { id: "all", label: "Semua" },
                          { id: "cash", label: "Tunai" },
                          { id: "qris", label: "QRIS" },
                          { id: "transfer", label: "Transfer" },
                        ].map((btn) => (
                          <button
                            key={btn.id}
                            type="button"
                            onClick={() => setPaymentFilter(btn.id)}
                            className={`px-2.5 py-1 rounded-lg text-[11px] font-bold font-mono transition-colors ${
                              paymentFilter === btn.id
                                ? "bg-[#167052] text-white"
                                : "bg-white border border-[#d8e3de] text-[#526159] hover:bg-[#edf8f3]"
                            }`}
                          >
                            {btn.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Table of Orders */}
                    <div className="overflow-x-auto rounded-2xl border border-[#d8e3de] bg-white">
                      <table className="w-full text-left font-mono text-xs">
                        <thead>
                          <tr className="border-b border-[#d8e3de] bg-[#edf8f3] text-[#167052] text-[10px] uppercase font-black">
                            <th className="py-2.5 px-3">No. Nota</th>
                            <th className="py-2.5 px-3">Waktu</th>
                            <th className="py-2.5 px-3">Layanan</th>
                            <th className="py-2.5 px-3">Metode Bayar</th>
                            <th className="py-2.5 px-3">Item Pesanan</th>
                            <th className="py-2.5 px-3 text-right">Total</th>
                            <th className="py-2.5 px-3 text-center">Aksi</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-[#edf2ef]">
                          {filteredOrders.length === 0 ? (
                            <tr>
                              <td colSpan={7} className="py-8 text-center text-[#7b8a82]">
                                Tidak ada nota transaksi yang cocok.
                              </td>
                            </tr>
                          ) : (
                            filteredOrders.map((ord) => {
                              const itemsCount = ord.items?.reduce((s, i) => s + Number(i.qty || 0), 0) || 0;
                              const itemsPreview = ord.items?.map(i => `${i.qty}x ${i.name_snapshot}`).join(", ") || "-";
                              return (
                                <tr key={ord.id} className="hover:bg-[#f7fcf9] transition-colors">
                                  <td className="py-2.5 px-3 font-black text-[#0b3d2e]">
                                    #{ord.order_no}
                                  </td>
                                  <td className="py-2.5 px-3 text-[11px] text-[#526159]">
                                    {formatBusinessDateTime(ord.created_at).split(", ")[1] || formatBusinessDateTime(ord.created_at)}
                                  </td>
                                  <td className="py-2.5 px-3 text-[11px]">
                                    <span className="font-sans font-bold text-[#1c2d26]">
                                      {serviceTypeLabel(ord.service_type, ord.table_no)}
                                    </span>
                                  </td>
                                  <td className="py-2.5 px-3">
                                    <span
                                      className={`inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-black uppercase ${
                                        ord.payment_method === "cash"
                                          ? "bg-emerald-100 text-[#0b3d2e]"
                                          : ord.payment_method === "qris"
                                          ? "bg-blue-100 text-blue-900"
                                          : "bg-purple-100 text-purple-900"
                                      }`}
                                    >
                                      {ord.payment_method}
                                    </span>
                                  </td>
                                  <td className="py-2.5 px-3 text-[11px] text-[#526159] max-w-xs truncate font-sans" title={itemsPreview}>
                                    <span className="font-bold font-mono text-[#0b3d2e] mr-1">[{itemsCount} item]</span>
                                    {itemsPreview}
                                  </td>
                                  <td className="py-2.5 px-3 text-right font-black text-[#0b3d2e]">
                                    {formatRupiah(ord.total)}
                                  </td>
                                  <td className="py-2.5 px-3 text-center whitespace-nowrap">
                                    <button
                                      type="button"
                                      onClick={() => {
                                        if (onSelectOrder) onSelectOrder(ord);
                                      }}
                                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl bg-[#edf8f3] hover:bg-[#d8eedf] text-[#167052] font-mono text-[11px] font-bold border border-[#ccd9d3] transition-all"
                                      title="Lihat struk pesanan ini"
                                    >
                                      <Receipt size={12} />
                                      <span>Struk</span>
                                    </button>
                                  </td>
                                </tr>
                              );
                            })
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {/* TAB CONTENT 2: RINCIAN KAS KELUAR & MASUK */}
                {activeTab === "movements" && (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-[#526159] font-mono">
                        Daftar arus kas kecil / belanja operasional yang diambil dari laci.
                      </span>
                      <button
                        type="button"
                        onClick={() => setShowAddExpense(true)}
                        className="px-3 py-1.5 rounded-xl bg-[#0b3d2e] text-[#c8f53a] text-xs font-bold hover:bg-[#124f3c] transition-all flex items-center gap-1.5"
                      >
                        <Plus size={14} />
                        <span>Catat Pengeluaran Baru</span>
                      </button>
                    </div>

                    <div className="overflow-x-auto rounded-2xl border border-[#d8e3de] bg-white">
                      <table className="w-full text-left font-mono text-xs">
                        <thead>
                          <tr className="border-b border-[#d8e3de] bg-[#edf8f3] text-[#167052] text-[10px] uppercase font-black">
                            <th className="py-2.5 px-3">Waktu</th>
                            <th className="py-2.5 px-3">Tipe</th>
                            <th className="py-2.5 px-3">Kategori</th>
                            <th className="py-2.5 px-3">Keterangan / Rincian</th>
                            <th className="py-2.5 px-3 text-right">Nominal</th>
                            <th className="py-2.5 px-3 text-center">Aksi</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-[#edf2ef]">
                          {movements.length === 0 ? (
                            <tr>
                              <td colSpan={6} className="py-8 text-center text-[#7b8a82]">
                                Tidak ada catatan kas keluar/masuk untuk shift ini.
                              </td>
                            </tr>
                          ) : (
                            movements.map((m) => (
                              <tr key={m.id} className="hover:bg-[#f7fcf9] transition-colors">
                                <td className="py-2.5 px-3 text-[11px] text-[#526159]">
                                  {formatBusinessDateTime(m.created_at)}
                                </td>
                                <td className="py-2.5 px-3">
                                  <span
                                    className={`inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-black uppercase ${
                                      m.type === "cash_out"
                                        ? "bg-rose-100 text-rose-800"
                                        : "bg-emerald-100 text-emerald-800"
                                    }`}
                                  >
                                    {m.type === "cash_out" ? "Kas Keluar" : "Kas Masuk"}
                                  </span>
                                </td>
                                <td className="py-2.5 px-3 font-bold text-[#0b3d2e]">
                                  {m.category}
                                </td>
                                <td className="py-2.5 px-3 text-[#1c2d26] font-sans text-xs">
                                  {m.note}
                                </td>
                                <td className={`py-2.5 px-3 text-right font-black ${
                                  m.type === "cash_out" ? "text-rose-600" : "text-emerald-600"
                                }`}>
                                  {m.type === "cash_out" ? `-${formatRupiah(m.amount)}` : `+${formatRupiah(m.amount)}`}
                                </td>
                                <td className="py-2.5 px-3 text-center">
                                  <button
                                    type="button"
                                    disabled={deletingMovementId === m.id}
                                    onClick={() => handleDeleteMovement(m.id)}
                                    className="p-1 rounded-lg text-rose-500 hover:bg-rose-50 hover:text-rose-700 transition-colors disabled:opacity-40"
                                    title="Hapus pencatatan ini"
                                  >
                                    <Trash2 size={13} />
                                  </button>
                                </td>
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {/* TAB CONTENT 3: MENU TERJUAL SHIFT INI */}
                {activeTab === "items" && (
                  <div className="space-y-3">
                    <span className="text-xs text-[#526159] font-mono block">
                      Total {aggregatedItems.reduce((acc, curr) => acc + curr.qty, 0)} porsi/item terjual selama shift ini.
                    </span>

                    <div className="overflow-x-auto rounded-2xl border border-[#d8e3de] bg-white">
                      <table className="w-full text-left font-mono text-xs">
                        <thead>
                          <tr className="border-b border-[#d8e3de] bg-[#edf8f3] text-[#167052] text-[10px] uppercase font-black">
                            <th className="py-2.5 px-3">Nama Menu</th>
                            <th className="py-2.5 px-3 text-center">Qty Terjual</th>
                            <th className="py-2.5 px-3 text-right">Subtotal Omzet</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-[#edf2ef]">
                          {aggregatedItems.length === 0 ? (
                            <tr>
                              <td colSpan={3} className="py-8 text-center text-[#7b8a82]">
                                Belum ada item menu yang terjual.
                              </td>
                            </tr>
                          ) : (
                            aggregatedItems.map((it, idx) => (
                              <tr key={idx} className="hover:bg-[#f7fcf9] transition-colors">
                                <td className="py-2.5 px-3 font-sans font-bold text-[#0b3d2e]">
                                  {it.name}
                                </td>
                                <td className="py-2.5 px-3 text-center font-black text-[#167052]">
                                  {it.qty}x
                                </td>
                                <td className="py-2.5 px-3 text-right font-black text-[#0b3d2e]">
                                  {formatRupiah(it.totalRevenue)}
                                </td>
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-[#d8e3de] bg-white p-3 sm:p-4 flex items-center justify-between text-xs font-mono">
          <span className="text-[11px] text-[#637970]">
            ID Shift: <span className="font-bold">{shiftId?.slice(0, 8)}...</span>
          </span>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold transition-colors"
          >
            Tutup
          </button>
        </div>

      </div>
    </div>
  );
}
