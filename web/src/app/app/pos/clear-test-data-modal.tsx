"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import {
  X,
  Trash2,
  AlertTriangle,
  Receipt,
  MessageSquare,
  Clock,
  Sparkles,
  CheckCircle2,
  Loader2,
  ShieldAlert,
  Search,
  CheckSquare,
  Square,
  RefreshCw,
  Star,
  User,
  ArrowUpDown,
  CreditCard,
  Banknote,
  Smartphone,
  ChevronRight,
} from "lucide-react";
import type { DeletableTestData, DeletableOrder, DeletableFeedback, DeletableShift } from "@/lib/types";
import {
  getDeletableTestDataAction,
  deleteOrdersBatchAction,
  markOrdersAsTestAction,
  deleteFeedbackBatchAction,
  deleteShiftsBatchAction,
  deleteOrderAction,
  deleteFeedbackAction,
  deleteShiftAction,
  clearTestDataAction,
} from "@/lib/actions";
import { formatRupiah, formatBusinessDateTime } from "@/lib/formatters";

interface ClearTestDataModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  isMochi?: boolean;
}

type TabKey = "orders" | "feedback" | "shifts" | "bulk";
type CleanScope = "all_orders" | "all_feedback" | "all_shifts" | "everything";

export default function ClearTestDataModal({
  isOpen,
  onClose,
  onSuccess,
  isMochi = true,
}: ClearTestDataModalProps) {
  const [activeTab, setActiveTab] = useState<TabKey>("orders");
  const [data, setData] = useState<DeletableTestData>({
    orders: [],
    feedbacks: [],
    shifts: [],
  });
  const [loadingData, setLoadingData] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [actionMessage, setActionMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Search queries per tab
  const [orderSearch, setOrderSearch] = useState("");
  const [feedbackSearch, setFeedbackSearch] = useState("");
  const [shiftSearch, setShiftSearch] = useState("");

  // Selected item IDs
  const [selectedOrderIds, setSelectedOrderIds] = useState<Set<string>>(new Set());
  const [selectedFeedbackIds, setSelectedFeedbackIds] = useState<Set<string>>(new Set());
  const [selectedShiftIds, setSelectedShiftIds] = useState<Set<string>>(new Set());

  // Bulk tab states
  const [bulkScope, setBulkScope] = useState<CleanScope>("all_orders");
  const [bulkConfirmText, setBulkConfirmText] = useState("");

  // Load data function
  const loadTestData = useCallback(async () => {
    setLoadingData(true);
    setActionMessage(null);
    try {
      const res = await getDeletableTestDataAction();
      if (res.ok) {
        setData(res.data);
      } else {
        setActionMessage({
          type: "error",
          text: res.error || "Gagal memuat data testing.",
        });
      }
    } catch (err: any) {
      setActionMessage({
        type: "error",
        text: err?.message || "Terjadi kendala saat memuat data.",
      });
    } finally {
      setLoadingData(false);
    }
  }, []);

  useEffect(() => {
    if (isOpen) {
      loadTestData();
      setSelectedOrderIds(new Set());
      setSelectedFeedbackIds(new Set());
      setSelectedShiftIds(new Set());
      setActionMessage(null);
    }
  }, [isOpen, loadTestData]);

  // Filtered lists
  const filteredOrders = useMemo(() => {
    const q = orderSearch.toLowerCase().trim();
    if (!q) return data.orders;
    return data.orders.filter(
      (o) =>
        o.order_no.toLowerCase().includes(q) ||
        (o.table_no && o.table_no.toLowerCase().includes(q)) ||
        (o.customer_name && o.customer_name.toLowerCase().includes(q)) ||
        o.payment_method.toLowerCase().includes(q) ||
        o.channel.toLowerCase().includes(q)
    );
  }, [data.orders, orderSearch]);

  const filteredFeedbacks = useMemo(() => {
    const q = feedbackSearch.toLowerCase().trim();
    if (!q) return data.feedbacks;
    return data.feedbacks.filter(
      (f) =>
        (f.customer_name && f.customer_name.toLowerCase().includes(q)) ||
        (f.order_no && f.order_no.toLowerCase().includes(q)) ||
        (f.comment && f.comment.toLowerCase().includes(q)) ||
        (f.reason_code && f.reason_code.toLowerCase().includes(q))
    );
  }, [data.feedbacks, feedbackSearch]);

  const filteredShifts = useMemo(() => {
    const q = shiftSearch.toLowerCase().trim();
    if (!q) return data.shifts;
    return data.shifts.filter((s) =>
      s.opened_by_name.toLowerCase().includes(q)
    );
  }, [data.shifts, shiftSearch]);

  // Toggle selection helpers
  const toggleSelectOrder = (id: string) => {
    setSelectedOrderIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAllOrders = () => {
    if (selectedOrderIds.size === filteredOrders.length && filteredOrders.length > 0) {
      setSelectedOrderIds(new Set());
    } else {
      setSelectedOrderIds(new Set(filteredOrders.map((o) => o.id)));
    }
  };

  const toggleSelectFeedback = (id: string) => {
    setSelectedFeedbackIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAllFeedbacks = () => {
    if (selectedFeedbackIds.size === filteredFeedbacks.length && filteredFeedbacks.length > 0) {
      setSelectedFeedbackIds(new Set());
    } else {
      setSelectedFeedbackIds(new Set(filteredFeedbacks.map((f) => f.id)));
    }
  };

  const toggleSelectShift = (id: string) => {
    setSelectedShiftIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAllShifts = () => {
    if (selectedShiftIds.size === filteredShifts.length && filteredShifts.length > 0) {
      setSelectedShiftIds(new Set());
    } else {
      setSelectedShiftIds(new Set(filteredShifts.map((s) => s.id)));
    }
  };

  /**
   * Menandai transaksi terpilih sebagai latihan.
   *
   * Ini langkah yang harus dilewati sebelum pembersihan massal boleh menyentuh
   * apa pun. Sengaja dipisah dari tombol hapus: menandai bisa dibatalkan,
   * menghapus tidak.
   */
  const handleMarkSelectedAsTest = async () => {
    const ids = Array.from(selectedOrderIds);
    if (ids.length === 0) return;

    setProcessing(true);
    setActionMessage(null);
    try {
      const res = await markOrdersAsTestAction(ids, true);
      if (res.ok) {
        setActionMessage({
          type: "success",
          text: `${res.data.updatedCount} transaksi ditandai sebagai latihan. Sekarang boleh ikut dibersihkan massal.`,
        });
        setSelectedOrderIds(new Set());
        await loadTestData();
        onSuccess();
      } else {
        setActionMessage({ type: "error", text: res.error });
      }
    } finally {
      setProcessing(false);
    }
  };

  // Execution Handlers
  const handleDeleteSelectedOrders = async () => {
    const ids = Array.from(selectedOrderIds);
    if (ids.length === 0) return;
    if (
      !window.confirm(
        `Hapus ${ids.length} transaksi yang dipilih? Data pesanan dan relasinya akan dihapus permanen.`
      )
    )
      return;

    setProcessing(true);
    setActionMessage(null);
    try {
      const res = await deleteOrdersBatchAction(ids);
      if (res.ok) {
        setActionMessage({
          type: "success",
          text: `Berhasil menghapus ${res.data.deletedCount} transaksi testing terpilih.`,
        });
        setSelectedOrderIds(new Set());
        await loadTestData();
        onSuccess();
      } else {
        setActionMessage({
          type: "error",
          text: res.error || "Gagal menghapus transaksi terpilih.",
        });
      }
    } catch (err: any) {
      setActionMessage({
        type: "error",
        text: err?.message || "Terjadi kesalahan saat menghapus.",
      });
    } finally {
      setProcessing(false);
    }
  };

  const handleDeleteSingleOrder = async (id: string, orderNo: string) => {
    if (
      !window.confirm(
        `Hapus transaksi #${orderNo}? Transaksi ini akan dihapus permanen dari laporan.`
      )
    )
      return;

    setProcessing(true);
    setActionMessage(null);
    try {
      const res = await deleteOrderAction(id);
      if (res.ok) {
        setActionMessage({
          type: "success",
          text: `Transaksi #${orderNo} berhasil dihapus.`,
        });
        setSelectedOrderIds((prev) => {
          const next = new Set(prev);
          next.delete(id);
          return next;
        });
        await loadTestData();
        onSuccess();
      } else {
        setActionMessage({
          type: "error",
          text: res.error || "Gagal menghapus transaksi.",
        });
      }
    } catch (err: any) {
      setActionMessage({
        type: "error",
        text: err?.message || "Terjadi kesalahan saat menghapus.",
      });
    } finally {
      setProcessing(false);
    }
  };

  const handleDeleteSelectedFeedbacks = async () => {
    const ids = Array.from(selectedFeedbackIds);
    if (ids.length === 0) return;
    if (!window.confirm(`Hapus ${ids.length} ulasan yang dipilih?`)) return;

    setProcessing(true);
    setActionMessage(null);
    try {
      const res = await deleteFeedbackBatchAction(ids);
      if (res.ok) {
        setActionMessage({
          type: "success",
          text: `Berhasil menghapus ${res.data.deletedCount} ulasan terpilih.`,
        });
        setSelectedFeedbackIds(new Set());
        await loadTestData();
        onSuccess();
      } else {
        setActionMessage({
          type: "error",
          text: res.error || "Gagal menghapus ulasan terpilih.",
        });
      }
    } catch (err: any) {
      setActionMessage({
        type: "error",
        text: err?.message || "Terjadi kesalahan saat menghapus.",
      });
    } finally {
      setProcessing(false);
    }
  };

  const handleDeleteSingleFeedback = async (id: string, name: string | null) => {
    if (!window.confirm(`Hapus ulasan dari ${name || "Pelanggan"}?`)) return;

    setProcessing(true);
    setActionMessage(null);
    try {
      const res = await deleteFeedbackAction(id);
      if (res.ok) {
        setActionMessage({
          type: "success",
          text: `Ulasan dari ${name || "Pelanggan"} berhasil dihapus.`,
        });
        setSelectedFeedbackIds((prev) => {
          const next = new Set(prev);
          next.delete(id);
          return next;
        });
        await loadTestData();
        onSuccess();
      } else {
        setActionMessage({
          type: "error",
          text: res.error || "Gagal menghapus ulasan.",
        });
      }
    } catch (err: any) {
      setActionMessage({
        type: "error",
        text: err?.message || "Terjadi kesalahan saat menghapus.",
      });
    } finally {
      setProcessing(false);
    }
  };

  const handleDeleteSelectedShifts = async () => {
    const ids = Array.from(selectedShiftIds);
    if (ids.length === 0) return;
    if (!window.confirm(`Hapus ${ids.length} shift kasir yang dipilih?`)) return;

    setProcessing(true);
    setActionMessage(null);
    try {
      const res = await deleteShiftsBatchAction(ids);
      if (res.ok) {
        setActionMessage({
          type: "success",
          text: `Berhasil menghapus ${res.data.deletedCount} shift kasir terpilih.`,
        });
        setSelectedShiftIds(new Set());
        await loadTestData();
        onSuccess();
      } else {
        setActionMessage({
          type: "error",
          text: res.error || "Gagal menghapus shift terpilih.",
        });
      }
    } catch (err: any) {
      setActionMessage({
        type: "error",
        text: err?.message || "Terjadi kesalahan saat menghapus.",
      });
    } finally {
      setProcessing(false);
    }
  };

  const handleDeleteSingleShift = async (id: string, staffName: string) => {
    if (!window.confirm(`Hapus rekap shift kasir dari ${staffName}?`)) return;

    setProcessing(true);
    setActionMessage(null);
    try {
      const res = await deleteShiftAction(id);
      if (res.ok) {
        setActionMessage({
          type: "success",
          text: `Shift dari ${staffName} berhasil dihapus.`,
        });
        setSelectedShiftIds((prev) => {
          const next = new Set(prev);
          next.delete(id);
          return next;
        });
        await loadTestData();
        onSuccess();
      } else {
        setActionMessage({
          type: "error",
          text: res.error || "Gagal menghapus shift.",
        });
      }
    } catch (err: any) {
      setActionMessage({
        type: "error",
        text: err?.message || "Terjadi kesalahan saat menghapus.",
      });
    } finally {
      setProcessing(false);
    }
  };

  const handleExecuteBulkClean = async () => {
    if (bulkConfirmText.trim().toUpperCase() !== "HAPUS") {
      setActionMessage({
        type: "error",
        text: "Ketik 'HAPUS' dengan huruf besar untuk mengonfirmasi pembersihan massal.",
      });
      return;
    }

    setProcessing(true);
    setActionMessage(null);
    try {
      const res = await clearTestDataAction(bulkScope);
      if (res.ok) {
        setActionMessage({
          type: "success",
          text: `Berhasil membersihkan ${res.data.deletedCount} data testing secara massal.`,
        });
        setBulkConfirmText("");
        await loadTestData();
        onSuccess();
      } else {
        setActionMessage({
          type: "error",
          text: res.error || "Gagal melakukan pembersihan massal.",
        });
      }
    } catch (err: any) {
      setActionMessage({
        type: "error",
        text: err?.message || "Terjadi kendala saat membersihkan data.",
      });
    } finally {
      setProcessing(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-2.5 sm:p-4 backdrop-blur-xs animate-in fade-in-50">
      <div className="w-full max-w-4xl rounded-3xl bg-white text-[#1c2d26] shadow-2xl overflow-hidden flex flex-col max-h-[92vh] border border-[#d8e3de] animate-in zoom-in-95">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-rose-200 bg-[#b91c1c] px-4 sm:px-6 py-3.5 text-white shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/20 text-white shadow-xs">
              <Trash2 size={19} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-sm sm:text-base font-black tracking-tight">
                  Pembersih Data Laporan &amp; Testing
                </h2>
                <span className="rounded-full bg-white/20 px-2 py-0.5 font-mono text-[10px] font-black uppercase text-white">
                  Owner Area
                </span>
              </div>
              <p className="text-[10.5px] text-rose-100 hidden sm:block">
                Pilih data transaksi, ulasan, atau shift testing yang ingin dihapus dari laporan toko
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={loadTestData}
              disabled={loadingData || processing}
              title="Segarkan Data"
              className="flex h-8 w-8 items-center justify-center rounded-xl bg-white/10 text-white hover:bg-white/20 transition-colors disabled:opacity-50"
            >
              <RefreshCw size={15} className={loadingData ? "animate-spin" : ""} />
            </button>
            <button
              type="button"
              onClick={onClose}
              aria-label="Tutup"
              className="flex h-8 w-8 items-center justify-center rounded-xl bg-white/10 text-white/80 hover:bg-white/20 hover:text-white transition-colors"
            >
              <X size={16} />
            </button>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-[#edf4f0] bg-[#f9fbf9] px-4 sm:px-6 pt-2 shrink-0 overflow-x-auto no-scrollbar gap-1.5 sm:gap-2">
          <button
            type="button"
            onClick={() => setActiveTab("orders")}
            className={`flex items-center gap-2 border-b-2 px-3 sm:px-4 py-2.5 font-mono text-xs font-black transition-all ${
              activeTab === "orders"
                ? "border-rose-600 text-rose-600 bg-white rounded-t-xl shadow-xs"
                : "border-transparent text-[#637970] hover:text-[#1c2d26]"
            }`}
          >
            <Receipt size={14} />
            <span>Transaksi &amp; Pesanan</span>
            <span
              className={`rounded-full px-1.5 py-0.2 text-[10px] ${
                activeTab === "orders"
                  ? "bg-rose-100 text-rose-700"
                  : "bg-[#e5ece8] text-[#52655c]"
              }`}
            >
              {data.orders.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("feedback")}
            className={`flex items-center gap-2 border-b-2 px-3 sm:px-4 py-2.5 font-mono text-xs font-black transition-all ${
              activeTab === "feedback"
                ? "border-rose-600 text-rose-600 bg-white rounded-t-xl shadow-xs"
                : "border-transparent text-[#637970] hover:text-[#1c2d26]"
            }`}
          >
            <Star size={14} />
            <span>Ulasan &amp; Rating</span>
            <span
              className={`rounded-full px-1.5 py-0.2 text-[10px] ${
                activeTab === "feedback"
                  ? "bg-rose-100 text-rose-700"
                  : "bg-[#e5ece8] text-[#52655c]"
              }`}
            >
              {data.feedbacks.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("shifts")}
            className={`flex items-center gap-2 border-b-2 px-3 sm:px-4 py-2.5 font-mono text-xs font-black transition-all ${
              activeTab === "shifts"
                ? "border-rose-600 text-rose-600 bg-white rounded-t-xl shadow-xs"
                : "border-transparent text-[#637970] hover:text-[#1c2d26]"
            }`}
          >
            <Clock size={14} />
            <span>Shift Kasir</span>
            <span
              className={`rounded-full px-1.5 py-0.2 text-[10px] ${
                activeTab === "shifts"
                  ? "bg-rose-100 text-rose-700"
                  : "bg-[#e5ece8] text-[#52655c]"
              }`}
            >
              {data.shifts.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("bulk")}
            className={`flex items-center gap-2 border-b-2 px-3 sm:px-4 py-2.5 font-mono text-xs font-black transition-all ${
              activeTab === "bulk"
                ? "border-rose-600 text-rose-600 bg-white rounded-t-xl shadow-xs"
                : "border-transparent text-[#637970] hover:text-[#1c2d26]"
            }`}
          >
            <Sparkles size={14} />
            <span>Reset Cepat (Bulk)</span>
          </button>
        </div>

        {/* Action Message Banner */}
        {actionMessage && (
          <div
            className={`mx-4 sm:mx-6 mt-3 flex items-center justify-between rounded-xl px-3.5 py-2.5 text-xs font-medium ${
              actionMessage.type === "success"
                ? "bg-emerald-50 text-emerald-800 border border-emerald-200"
                : "bg-rose-50 text-rose-800 border border-rose-200"
            }`}
          >
            <div className="flex items-center gap-2">
              {actionMessage.type === "success" ? (
                <CheckCircle2 size={16} className="text-emerald-600 shrink-0" />
              ) : (
                <AlertTriangle size={16} className="text-rose-600 shrink-0" />
              )}
              <span>{actionMessage.text}</span>
            </div>
            <button
              type="button"
              onClick={() => setActionMessage(null)}
              className="text-gray-400 hover:text-gray-600"
            >
              <X size={14} />
            </button>
          </div>
        )}

        {/* Tab Contents */}
        <div className="p-4 sm:p-6 overflow-y-auto flex-1 space-y-4 font-sans text-xs">
          {loadingData ? (
            <div className="py-16 text-center space-y-3">
              <Loader2 size={32} className="animate-spin text-rose-600 mx-auto" />
              <p className="font-mono text-xs text-[#637970]">Memuat data laporan &amp; testing...</p>
            </div>
          ) : (
            <>
              {/* TAB 1: TRANSAKSI & PESANAN */}
              {activeTab === "orders" && (
                <div className="space-y-3">
                  {/* Filter & Selection Control Bar */}
                  <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5 bg-[#f9fbf9] p-3 rounded-2xl border border-[#e5ece8]">
                    <div className="relative flex-1">
                      <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#889b92]" />
                      <input
                        type="text"
                        value={orderSearch}
                        onChange={(e) => setOrderSearch(e.target.value)}
                        placeholder="Cari nomor order (#A-001), meja, nama pelanggan..."
                        className="w-full rounded-xl border border-[#ccd9d3] bg-white pl-9 pr-3 py-1.5 font-mono text-xs text-[#1c2d26] placeholder-[#94a59d] focus:border-rose-500 focus:outline-hidden"
                      />
                    </div>

                    <div className="flex items-center justify-between sm:justify-end gap-2 shrink-0">
                      <button
                        type="button"
                        onClick={toggleSelectAllOrders}
                        className="inline-flex items-center gap-1.5 rounded-xl border border-[#ccd9d3] bg-white px-3 py-1.5 font-mono text-xs font-bold text-[#1c2d26] hover:bg-[#edf4f0] transition-colors"
                      >
                        {selectedOrderIds.size === filteredOrders.length && filteredOrders.length > 0 ? (
                          <CheckSquare size={14} className="text-rose-600" />
                        ) : (
                          <Square size={14} className="text-[#889b92]" />
                        )}
                        <span>Pilih Semua ({filteredOrders.length})</span>
                      </button>

                      <button
                        type="button"
                        onClick={handleMarkSelectedAsTest}
                        disabled={selectedOrderIds.size === 0 || processing}
                        className="inline-flex items-center gap-1.5 rounded-xl border border-amber-300 bg-amber-50 px-3.5 py-1.5 font-mono text-xs font-black text-amber-900 hover:bg-amber-100 disabled:opacity-40 disabled:cursor-not-allowed shadow-xs transition-all active:scale-95"
                        title="Menandai bisa dibatalkan, menghapus tidak"
                      >
                        <span>Tandai ({selectedOrderIds.size}) Sebagai Latihan</span>
                      </button>

                      <button
                        type="button"
                        onClick={handleDeleteSelectedOrders}
                        disabled={selectedOrderIds.size === 0 || processing}
                        className="inline-flex items-center gap-1.5 rounded-xl bg-rose-600 px-3.5 py-1.5 font-mono text-xs font-black text-white hover:bg-rose-700 disabled:opacity-40 disabled:cursor-not-allowed shadow-xs transition-all active:scale-95"
                      >
                        {processing ? (
                          <Loader2 size={13} className="animate-spin" />
                        ) : (
                          <Trash2 size={13} />
                        )}
                        <span>Hapus ({selectedOrderIds.size}) Terpilih</span>
                      </button>
                    </div>
                  </div>

                  {/* Order List */}
                  {filteredOrders.length === 0 ? (
                    <div className="rounded-2xl border border-dashed border-[#ccd9d3] p-10 text-center space-y-2">
                      <Receipt size={28} className="mx-auto text-[#94a59d]" />
                      <p className="font-bold text-xs text-[#41534b]">Tidak ada transaksi ditemukan</p>
                      <p className="text-[11px] text-[#74877e]">
                        {orderSearch ? "Coba ganti kata kunci pencarian Anda." : "Belum ada riwayat transaksi tersimpan."}
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {filteredOrders.map((ord) => {
                        const isSelected = selectedOrderIds.has(ord.id);
                        return (
                          <div
                            key={ord.id}
                            className={`flex items-center justify-between gap-3 rounded-2xl border p-3 transition-all ${
                              isSelected
                                ? "border-rose-500 bg-rose-50/40 shadow-xs ring-1 ring-rose-500"
                                : "border-[#e5ece8] bg-white hover:border-[#ccd9d3]"
                            }`}
                          >
                            <div className="flex items-center gap-3 min-w-0">
                              <button
                                type="button"
                                onClick={() => toggleSelectOrder(ord.id)}
                                className="text-rose-600 shrink-0 p-1 hover:bg-rose-100 rounded-lg transition-colors"
                              >
                                {isSelected ? <CheckSquare size={18} /> : <Square size={18} className="text-[#889b92]" />}
                              </button>

                              <div className="min-w-0 space-y-0.5">
                                <div className="flex flex-wrap items-center gap-1.5">
                                  <span className="font-mono text-xs font-black text-[#0b3d2e] bg-[#edf8f3] border border-emerald-300/60 px-2 py-0.2 rounded-md">
                                    #{ord.order_no}
                                  </span>
                                  {ord.table_no && (
                                    <span className="font-mono text-[10.5px] font-bold text-[#355245] bg-[#f0f4f2] px-1.5 py-0.2 rounded-md">
                                      Meja {ord.table_no}
                                    </span>
                                  )}
                                  <span className="font-mono text-[10px] text-[#74877e] uppercase">
                                    {ord.channel === "cashier" ? "Kasir" : "QR Order"}
                                  </span>
                                  <span className="rounded-md bg-emerald-100 px-1.5 py-0.2 font-mono text-[10px] font-bold text-emerald-800">
                                    {ord.payment_method.toUpperCase()}
                                  </span>
                                </div>
                                <div className="flex items-center gap-2 text-[11px] text-[#637970] truncate">
                                  <span className="font-bold text-[#1c2d26] truncate">
                                    {ord.customer_name || "Pelanggan Umum"}
                                  </span>
                                  <span>·</span>
                                  <span>{ord.item_count} item</span>
                                  <span>·</span>
                                  <span className="font-mono">{formatBusinessDateTime(ord.created_at)}</span>
                                </div>
                              </div>
                            </div>

                            <div className="flex items-center gap-3 shrink-0">
                              <div className="text-right">
                                <p className="font-mono text-xs font-black text-[#0b3d2e]">
                                  {formatRupiah(ord.total)}
                                </p>
                                <span className="font-mono text-[9.5px] font-bold text-[#637970] uppercase">
                                  {ord.status}
                                </span>
                              </div>

                              <button
                                type="button"
                                onClick={() => handleDeleteSingleOrder(ord.id, ord.order_no)}
                                disabled={processing}
                                title="Hapus transaksi ini saja"
                                className="flex h-8 w-8 items-center justify-center rounded-xl border border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100 hover:border-rose-300 transition-colors"
                              >
                                <Trash2 size={14} />
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              {/* TAB 2: ULASAN & FEEDBACK */}
              {activeTab === "feedback" && (
                <div className="space-y-3">
                  {/* Control Bar */}
                  <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5 bg-[#f9fbf9] p-3 rounded-2xl border border-[#e5ece8]">
                    <div className="relative flex-1">
                      <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#889b92]" />
                      <input
                        type="text"
                        value={feedbackSearch}
                        onChange={(e) => setFeedbackSearch(e.target.value)}
                        placeholder="Cari nama pelanggan, ulasan, atau order..."
                        className="w-full rounded-xl border border-[#ccd9d3] bg-white pl-9 pr-3 py-1.5 font-mono text-xs text-[#1c2d26] placeholder-[#94a59d] focus:border-rose-500 focus:outline-hidden"
                      />
                    </div>

                    <div className="flex items-center justify-between sm:justify-end gap-2 shrink-0">
                      <button
                        type="button"
                        onClick={toggleSelectAllFeedbacks}
                        className="inline-flex items-center gap-1.5 rounded-xl border border-[#ccd9d3] bg-white px-3 py-1.5 font-mono text-xs font-bold text-[#1c2d26] hover:bg-[#edf4f0] transition-colors"
                      >
                        {selectedFeedbackIds.size === filteredFeedbacks.length && filteredFeedbacks.length > 0 ? (
                          <CheckSquare size={14} className="text-rose-600" />
                        ) : (
                          <Square size={14} className="text-[#889b92]" />
                        )}
                        <span>Pilih Semua ({filteredFeedbacks.length})</span>
                      </button>

                      <button
                        type="button"
                        onClick={handleDeleteSelectedFeedbacks}
                        disabled={selectedFeedbackIds.size === 0 || processing}
                        className="inline-flex items-center gap-1.5 rounded-xl bg-rose-600 px-3.5 py-1.5 font-mono text-xs font-black text-white hover:bg-rose-700 disabled:opacity-40 disabled:cursor-not-allowed shadow-xs transition-all active:scale-95"
                      >
                        {processing ? (
                          <Loader2 size={13} className="animate-spin" />
                        ) : (
                          <Trash2 size={13} />
                        )}
                        <span>Hapus ({selectedFeedbackIds.size}) Terpilih</span>
                      </button>
                    </div>
                  </div>

                  {/* Feedback List */}
                  {filteredFeedbacks.length === 0 ? (
                    <div className="rounded-2xl border border-dashed border-[#ccd9d3] p-10 text-center space-y-2">
                      <Star size={28} className="mx-auto text-[#94a59d]" />
                      <p className="font-bold text-xs text-[#41534b]">Tidak ada ulasan ditemukan</p>
                      <p className="text-[11px] text-[#74877e]">
                        {feedbackSearch ? "Coba ganti kata kunci pencarian Anda." : "Belum ada ulasan/rating tersimpan."}
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {filteredFeedbacks.map((f) => {
                        const isSelected = selectedFeedbackIds.has(f.id);
                        return (
                          <div
                            key={f.id}
                            className={`flex items-start justify-between gap-3 rounded-2xl border p-3 transition-all ${
                              isSelected
                                ? "border-rose-500 bg-rose-50/40 shadow-xs ring-1 ring-rose-500"
                                : "border-[#e5ece8] bg-white hover:border-[#ccd9d3]"
                            }`}
                          >
                            <div className="flex items-start gap-3 min-w-0">
                              <button
                                type="button"
                                onClick={() => toggleSelectFeedback(f.id)}
                                className="text-rose-600 shrink-0 p-1 hover:bg-rose-100 rounded-lg transition-colors mt-0.5"
                              >
                                {isSelected ? <CheckSquare size={18} /> : <Square size={18} className="text-[#889b92]" />}
                              </button>

                              <div className="min-w-0 space-y-1">
                                <div className="flex flex-wrap items-center gap-1.5">
                                  <div className="flex items-center gap-0.5 text-amber-500">
                                    {[...Array(5)].map((_, idx) => (
                                      <Star
                                        key={idx}
                                        size={12}
                                        className={idx < f.rating ? "fill-amber-400 text-amber-400" : "text-[#d8e3de]"}
                                      />
                                    ))}
                                  </div>
                                  <span className="font-bold text-xs text-[#1c2d26]">
                                    {f.customer_name || "Pelanggan Tanpa Nama"}
                                  </span>
                                  {f.order_no && (
                                    <span className="font-mono text-[10px] text-[#0b3d2e] bg-[#edf8f3] px-1.5 py-0.2 rounded-md">
                                      #{f.order_no}
                                    </span>
                                  )}
                                  {f.reason_code && (
                                    <span className="font-mono text-[10px] text-rose-700 bg-rose-100 px-1.5 py-0.2 rounded-md uppercase font-bold">
                                      {f.reason_code}
                                    </span>
                                  )}
                                </div>
                                {f.comment && (
                                  <p className="text-[11.5px] text-[#41534b] italic bg-[#f9fbf9] p-2 rounded-xl border border-[#edf4f0]">
                                    &ldquo;{f.comment}&rdquo;
                                  </p>
                                )}
                                <p className="font-mono text-[10px] text-[#889b92]">
                                  {formatBusinessDateTime(f.created_at)}
                                </p>
                              </div>
                            </div>

                            <button
                              type="button"
                              onClick={() => handleDeleteSingleFeedback(f.id, f.customer_name)}
                              disabled={processing}
                              title="Hapus ulasan ini saja"
                              className="flex h-8 w-8 items-center justify-center rounded-xl border border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100 hover:border-rose-300 transition-colors shrink-0"
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              {/* TAB 3: SHIFT KASIR */}
              {activeTab === "shifts" && (
                <div className="space-y-3">
                  {/* Control Bar */}
                  <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5 bg-[#f9fbf9] p-3 rounded-2xl border border-[#e5ece8]">
                    <div className="relative flex-1">
                      <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#889b92]" />
                      <input
                        type="text"
                        value={shiftSearch}
                        onChange={(e) => setShiftSearch(e.target.value)}
                        placeholder="Cari nama kasir..."
                        className="w-full rounded-xl border border-[#ccd9d3] bg-white pl-9 pr-3 py-1.5 font-mono text-xs text-[#1c2d26] placeholder-[#94a59d] focus:border-rose-500 focus:outline-hidden"
                      />
                    </div>

                    <div className="flex items-center justify-between sm:justify-end gap-2 shrink-0">
                      <button
                        type="button"
                        onClick={toggleSelectAllShifts}
                        className="inline-flex items-center gap-1.5 rounded-xl border border-[#ccd9d3] bg-white px-3 py-1.5 font-mono text-xs font-bold text-[#1c2d26] hover:bg-[#edf4f0] transition-colors"
                      >
                        {selectedShiftIds.size === filteredShifts.length && filteredShifts.length > 0 ? (
                          <CheckSquare size={14} className="text-rose-600" />
                        ) : (
                          <Square size={14} className="text-[#889b92]" />
                        )}
                        <span>Pilih Semua ({filteredShifts.length})</span>
                      </button>

                      <button
                        type="button"
                        onClick={handleDeleteSelectedShifts}
                        disabled={selectedShiftIds.size === 0 || processing}
                        className="inline-flex items-center gap-1.5 rounded-xl bg-rose-600 px-3.5 py-1.5 font-mono text-xs font-black text-white hover:bg-rose-700 disabled:opacity-40 disabled:cursor-not-allowed shadow-xs transition-all active:scale-95"
                      >
                        {processing ? (
                          <Loader2 size={13} className="animate-spin" />
                        ) : (
                          <Trash2 size={13} />
                        )}
                        <span>Hapus ({selectedShiftIds.size}) Terpilih</span>
                      </button>
                    </div>
                  </div>

                  {/* Shift List */}
                  {filteredShifts.length === 0 ? (
                    <div className="rounded-2xl border border-dashed border-[#ccd9d3] p-10 text-center space-y-2">
                      <Clock size={28} className="mx-auto text-[#94a59d]" />
                      <p className="font-bold text-xs text-[#41534b]">Tidak ada rekap shift ditemukan</p>
                      <p className="text-[11px] text-[#74877e]">
                        {shiftSearch ? "Coba ganti kata kunci pencarian Anda." : "Belum ada riwayat shift kasir."}
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {filteredShifts.map((s) => {
                        const isSelected = selectedShiftIds.has(s.id);
                        return (
                          <div
                            key={s.id}
                            className={`flex items-center justify-between gap-3 rounded-2xl border p-3 transition-all ${
                              isSelected
                                ? "border-rose-500 bg-rose-50/40 shadow-xs ring-1 ring-rose-500"
                                : "border-[#e5ece8] bg-white hover:border-[#ccd9d3]"
                            }`}
                          >
                            <div className="flex items-center gap-3 min-w-0">
                              <button
                                type="button"
                                onClick={() => toggleSelectShift(s.id)}
                                className="text-rose-600 shrink-0 p-1 hover:bg-rose-100 rounded-lg transition-colors"
                              >
                                {isSelected ? <CheckSquare size={18} /> : <Square size={18} className="text-[#889b92]" />}
                              </button>

                              <div className="min-w-0 space-y-0.5">
                                <div className="flex items-center gap-2">
                                  <span className="font-bold text-xs text-[#1c2d26]">
                                    {s.opened_by_name}
                                  </span>
                                  <span className="font-mono text-[10px] text-[#0b3d2e] bg-[#edf8f3] px-1.5 py-0.2 rounded-md">
                                    {s.order_count} Transaksi
                                  </span>
                                  <span
                                    className={`font-mono text-[10px] font-bold px-1.5 py-0.2 rounded-md ${
                                      s.closed_at
                                        ? "bg-[#e5ece8] text-[#52655c]"
                                        : "bg-emerald-100 text-emerald-800"
                                    }`}
                                  >
                                    {s.closed_at ? "Shift Ditutup" : "Shift Terbuka"}
                                  </span>
                                </div>
                                <p className="font-mono text-[10.5px] text-[#637970]">
                                  Buka: {formatBusinessDateTime(s.opened_at)}
                                  {s.closed_at && ` · Tutup: ${formatBusinessDateTime(s.closed_at)}`}
                                </p>
                              </div>
                            </div>

                            <div className="flex items-center gap-3 shrink-0">
                              <div className="text-right font-mono text-xs">
                                <p className="text-[#637970] text-[10px]">Modal Awal</p>
                                <p className="font-bold text-[#0b3d2e]">{formatRupiah(s.opening_cash)}</p>
                              </div>

                              <button
                                type="button"
                                onClick={() => handleDeleteSingleShift(s.id, s.opened_by_name)}
                                disabled={processing}
                                title="Hapus rekap shift ini saja"
                                className="flex h-8 w-8 items-center justify-center rounded-xl border border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100 hover:border-rose-300 transition-colors"
                              >
                                <Trash2 size={14} />
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              {/* TAB 4: BULK CLEAN / RESET CEPAT */}
              {activeTab === "bulk" && (
                <div className="space-y-4">
                  <div className="rounded-2xl border border-amber-300 bg-amber-50 p-3.5 text-amber-900 flex items-start gap-3">
                    <ShieldAlert size={18} className="text-amber-600 shrink-0 mt-0.5" />
                    <div className="space-y-0.5">
                      <h4 className="font-black text-xs text-amber-950">
                        Pembersihan Data Massal Sekaligus
                      </h4>
                      <p className="text-[11px] text-amber-800 leading-relaxed">
                        Fitur ini menghapus seluruh catatan sesuai kategori yang dipilih dalam satu langkah.
                        Data yang sudah dihapus tidak dapat dipulihkan kembali.
                      </p>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="font-bold text-xs text-[#0b3d2e] uppercase font-mono tracking-wider">
                      Pilih Cakupan Data yang Ingin Dibersihkan:
                    </label>

                    <div className="grid gap-2">
                      <label
                        className={`flex items-start gap-3 rounded-2xl border p-3.5 cursor-pointer transition-all ${
                          bulkScope === "all_orders"
                            ? "border-rose-500 bg-rose-50/50 shadow-xs ring-1 ring-rose-500"
                            : "border-[#d8e3de] bg-white hover:bg-[#f9fbf9]"
                        }`}
                      >
                        <input
                          type="radio"
                          name="bulkScope"
                          checked={bulkScope === "all_orders"}
                          onChange={() => setBulkScope("all_orders")}
                          className="mt-1 text-rose-600 focus:ring-rose-500"
                        />
                        <div className="space-y-0.5">
                          <div className="flex items-center gap-1.5 font-black text-xs text-[#1c2d26]">
                            <Receipt size={14} className="text-rose-600" />
                            <span>Hapus Seluruh Pesanan &amp; Transaksi ({data.orders.length} Data)</span>
                          </div>
                          <p className="text-[11px] text-[#556b62]">
                            Mereset riwayat transaksi kasir, item pesanan, dan laporan omzet/penjualan menjadi Rp 0.
                          </p>
                        </div>
                      </label>

                      <label
                        className={`flex items-start gap-3 rounded-2xl border p-3.5 cursor-pointer transition-all ${
                          bulkScope === "all_feedback"
                            ? "border-rose-500 bg-rose-50/50 shadow-xs ring-1 ring-rose-500"
                            : "border-[#d8e3de] bg-white hover:bg-[#f9fbf9]"
                        }`}
                      >
                        <input
                          type="radio"
                          name="bulkScope"
                          checked={bulkScope === "all_feedback"}
                          onChange={() => setBulkScope("all_feedback")}
                          className="mt-1 text-rose-600 focus:ring-rose-500"
                        />
                        <div className="space-y-0.5">
                          <div className="flex items-center gap-1.5 font-black text-xs text-[#1c2d26]">
                            <Star size={14} className="text-rose-600" />
                            <span>Hapus Seluruh Ulasan &amp; Rating Pelanggan ({data.feedbacks.length} Data)</span>
                          </div>
                          <p className="text-[11px] text-[#556b62]">
                            Membersihkan rating testing dan komentar review pascatransaksi.
                          </p>
                        </div>
                      </label>

                      <label
                        className={`flex items-start gap-3 rounded-2xl border p-3.5 cursor-pointer transition-all ${
                          bulkScope === "all_shifts"
                            ? "border-rose-500 bg-rose-50/50 shadow-xs ring-1 ring-rose-500"
                            : "border-[#d8e3de] bg-white hover:bg-[#f9fbf9]"
                        }`}
                      >
                        <input
                          type="radio"
                          name="bulkScope"
                          checked={bulkScope === "all_shifts"}
                          onChange={() => setBulkScope("all_shifts")}
                          className="mt-1 text-rose-600 focus:ring-rose-500"
                        />
                        <div className="space-y-0.5">
                          <div className="flex items-center gap-1.5 font-black text-xs text-[#1c2d26]">
                            <Clock size={14} className="text-rose-600" />
                            <span>Hapus Seluruh Rekap Shift Kasir ({data.shifts.length} Data)</span>
                          </div>
                          <p className="text-[11px] text-[#556b62]">
                            Mereset riwayat buka/tutup kasir dan rekonsiliasi laci uang tunai.
                          </p>
                        </div>
                      </label>

                      <label
                        className={`flex items-start gap-3 rounded-2xl border p-3.5 cursor-pointer transition-all ${
                          bulkScope === "everything"
                            ? "border-rose-600 bg-rose-100/60 shadow-xs ring-2 ring-rose-600"
                            : "border-rose-200 bg-rose-50/30 hover:bg-rose-50"
                        }`}
                      >
                        <input
                          type="radio"
                          name="bulkScope"
                          checked={bulkScope === "everything"}
                          onChange={() => setBulkScope("everything")}
                          className="mt-1 text-rose-600 focus:ring-rose-500"
                        />
                        <div className="space-y-0.5">
                          <div className="flex items-center gap-1.5 font-black text-xs text-rose-900">
                            <Sparkles size={14} className="text-rose-600" />
                            <span>Pembersihan Total: Hapus Semua Data Bertanda Latihan</span>
                          </div>
                          {/*
                            Keterangan lamanya berbunyi "mereset SELURUH pesanan
                            ... untuk memulai toko dari nol bersih", dan kodenya
                            memang melakukan persis itu: DELETE FROM orders tanpa
                            saringan apa pun. Owner yang menekan tombol bernama
                            "Hapus Data Testing" kehilangan seluruh riwayat
                            penjualannya. Sekarang yang bisa hilang hanya yang
                            sudah ditandai latihan lebih dulu.
                          */}
                          <p className="text-[11px] text-rose-700">
                            Menghapus pesanan, ulasan, refund, dan shift yang <b>sudah ditandai
                            sebagai latihan</b>. Transaksi penjualan sungguhan tidak ikut terhapus,
                            walaupun tombol ini ditekan.
                          </p>
                          <p className="mt-1 text-[11px] text-rose-700">
                            Belum ada yang bertanda? Pilih transaksinya di daftar atas, lalu tandai
                            dulu sebagai latihan. Menandai bisa dibatalkan, menghapus tidak.
                          </p>
                        </div>
                      </label>
                    </div>
                  </div>

                  {/* Confirmation Input */}
                  <div className="rounded-2xl border border-rose-200 bg-rose-50/50 p-4 space-y-3">
                    <label className="block text-xs font-bold text-rose-900">
                      Ketik <span className="font-mono text-rose-600 font-black">&quot;HAPUS&quot;</span> untuk konfirmasi:
                    </label>
                    <input
                      type="text"
                      value={bulkConfirmText}
                      onChange={(e) => setBulkConfirmText(e.target.value)}
                      placeholder="Ketik HAPUS di sini..."
                      className="w-full rounded-xl border border-rose-300 bg-white px-3.5 py-2 font-mono text-xs font-bold uppercase tracking-wider text-rose-900 placeholder-rose-300 focus:border-rose-600 focus:outline-hidden"
                    />
                    <button
                      type="button"
                      onClick={handleExecuteBulkClean}
                      disabled={bulkConfirmText.trim().toUpperCase() !== "HAPUS" || processing}
                      className="w-full flex items-center justify-center gap-2 rounded-xl bg-rose-600 hover:bg-rose-700 disabled:opacity-40 disabled:cursor-not-allowed py-2.5 font-mono text-xs font-black text-white shadow-sm transition-all active:scale-98"
                    >
                      {processing ? (
                        <>
                          <Loader2 size={15} className="animate-spin" />
                          <span>Sedang Menghapus Data...</span>
                        </>
                      ) : (
                        <>
                          <Trash2 size={15} />
                          <span>Eksekusi Pembersihan Massal Sekarang</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Modal Footer */}
        <div className="flex items-center justify-between border-t border-[#edf4f0] bg-[#f9fbf9] px-4 sm:px-6 py-3 shrink-0">
          <p className="text-[11px] text-[#637970] font-mono">
            KAEL System · Manajemen Integritas Data &amp; Laporan Owner
          </p>
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-[#ccd9d3] bg-white px-4 py-1.5 font-mono text-xs font-bold text-[#1c2d26] hover:bg-[#edf4f0] transition-colors"
          >
            Tutup
          </button>
        </div>
      </div>
    </div>
  );
}
