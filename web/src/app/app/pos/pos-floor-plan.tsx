"use client";

import { useMemo, useState } from "react";
import {
  Utensils,
  Plus,
  Clock,
  Printer,
  CheckCircle2,
  AlertTriangle,
  RotateCcw,
  RefreshCw,
  X,
  CreditCard,
  ChefHat,
  ChevronRight,
  Sparkles,
  Search,
  LayoutGrid,
} from "lucide-react";
import type { MenuItem, Order, OrderItem } from "@/lib/types";
import { formatRupiah, formatBusinessDateTime } from "@/lib/formatters";
import { serviceTypeLabel, PAYMENT_STATUS_LABEL } from "@/lib/pos-engine";
import { setFulfillmentAction, confirmPaymentAction } from "@/lib/actions";
import PosReplaceRefundModal from "./pos-replace-refund-modal";

type Antrean = Order & { items: OrderItem[] };

export interface TableSummary {
  tableNo: string;
  displayName: string;
  status: "available" | "cooking" | "dining" | "unpaid";
  orders: Antrean[];
  totalBill: number;
  itemCount: number;
  earliestOrderTime: string | null;
  hasUnpaid: boolean;
}

const PRESET_TABLES = [
  { no: "01", name: "Meja 01" },
  { no: "02", name: "Meja 02" },
  { no: "03", name: "Meja 03" },
  { no: "04", name: "Meja 04" },
  { no: "05", name: "Meja 05" },
  { no: "06", name: "Meja 06" },
  { no: "07", name: "Meja 07" },
  { no: "08", name: "Meja 08" },
  { no: "09", name: "Meja 09" },
  { no: "10", name: "Meja 10" },
  { no: "VIP", name: "Meja VIP" },
  { no: "Lesehan 1", name: "Lesehan 1" },
  { no: "Lesehan 2", name: "Lesehan 2" },
  { no: "Lesehan 3", name: "Lesehan 3" },
  { no: "Lesehan 4", name: "Lesehan 4" },
  { no: "Outdoor 1", name: "Outdoor 1" },
  { no: "Outdoor 2", name: "Outdoor 2" },
  { no: "Bar", name: "Bar Counter" },
];

function normalizeTableKey(raw: string | null | undefined): string {
  if (!raw) return "";
  const clean = raw.trim().toLowerCase().replace(/^mejas*/, "");
  if (/^0[1-9]$/.test(clean)) return clean;
  if (/^[1-9]$/.test(clean)) return `0${clean}`;
  return clean;
}

function getElapsedMinutes(isoString: string | null): string {
  if (!isoString) return "";
  const diff = Date.now() - new Date(isoString).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "Baru saja";
  if (mins < 60) return `${mins} mnt lalu`;
  const hrs = Math.floor(mins / 60);
  const remMins = mins % 60;
  return `${hrs}j ${remMins}m lalu`;
}

export default function PosFloorPlan({
  orders,
  menuItems,
  isMochi = true,
  onAddItemsToTable,
  onPrintCombinedTableBill,
  onRefresh,
}: {
  orders: Antrean[];
  menuItems: MenuItem[];
  isMochi?: boolean;
  onAddItemsToTable: (tableNo: string) => void;
  onPrintCombinedTableBill?: (table: TableSummary) => void;
  onRefresh?: () => void;
}) {
  const [selectedTableNo, setSelectedTableNo] = useState<string | null>(null);
  const [filterStatus, setFilterStatus] = useState<"all" | "active" | "available">("all");
  const [searchTable, setSearchTable] = useState("");

  // Penyesuaian / Ganti / Refund Modal
  const [modalOrder, setModalOrder] = useState<Antrean | null>(null);
  const [modalItem, setModalItem] = useState<OrderItem | null>(null);
  const [showAdjustModal, setShowAdjustModal] = useState(false);
  const [busyAction, setBusyAction] = useState<string | null>(null);

  // Active unclosed orders
  const activeOrders = useMemo(() => {
    return orders.filter(
      (o) =>
        o.status !== "cancelled" &&
        o.payment_status !== "failed" &&
        o.fulfillment_status !== "completed" &&
        o.fulfillment_status !== "cancelled"
    );
  }, [orders]);

  // Compute table statuses
  const tableSummaries: TableSummary[] = useMemo(() => {
    // 1. Map existing orders by normalized table key
    const orderGroups: Record<string, Antrean[]> = {};

    activeOrders.forEach((o) => {
      if (!o.table_no) return;
      const key = normalizeTableKey(o.table_no);
      if (!orderGroups[key]) orderGroups[key] = [];
      orderGroups[key].push(o);
    });

    // 2. Build list combining presets + any extra custom tables from orders
    const allTableKeys = new Set(PRESET_TABLES.map((t) => normalizeTableKey(t.no)));
    Object.keys(orderGroups).forEach((k) => allTableKeys.add(k));

    const list: TableSummary[] = [];

    PRESET_TABLES.forEach((preset) => {
      const key = normalizeTableKey(preset.no);
      const tableOrders = (orderGroups[key] || []).sort(
        (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
      );

      const hasUnpaid = tableOrders.some((o) => o.payment_status === "pending");
      const isCooking = tableOrders.some(
        (o) =>
          o.fulfillment_status === "pending" ||
          o.fulfillment_status === "accepted" ||
          o.fulfillment_status === "preparing"
      );

      let status: "available" | "cooking" | "dining" | "unpaid" = "available";
      if (tableOrders.length > 0) {
        if (hasUnpaid) status = "unpaid";
        else if (isCooking) status = "cooking";
        else status = "dining";
      }

      const totalBill = tableOrders.reduce((sum, o) => sum + Number(o.total), 0);
      const itemCount = tableOrders.reduce(
        (sum, o) => sum + o.items.reduce((iSum, i) => iSum + i.qty, 0),
        0
      );

      list.push({
        tableNo: preset.no,
        displayName: preset.name,
        status,
        orders: tableOrders,
        totalBill,
        itemCount,
        earliestOrderTime: tableOrders[0]?.created_at || null,
        hasUnpaid,
      });
    });

    // Add extra custom tables
    Object.keys(orderGroups).forEach((key) => {
      const isAlreadyIncluded = PRESET_TABLES.some((p) => normalizeTableKey(p.no) === key);
      if (!isAlreadyIncluded) {
        const tableOrders = orderGroups[key].sort(
          (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
        );
        const hasUnpaid = tableOrders.some((o) => o.payment_status === "pending");
        const isCooking = tableOrders.some(
          (o) =>
            o.fulfillment_status === "pending" ||
            o.fulfillment_status === "accepted" ||
            o.fulfillment_status === "preparing"
        );
        const rawTableNo = tableOrders[0]?.table_no || key;

        list.push({
          tableNo: rawTableNo,
          displayName: `Meja ${rawTableNo}`,
          status: hasUnpaid ? "unpaid" : isCooking ? "cooking" : "dining",
          orders: tableOrders,
          totalBill: tableOrders.reduce((sum, o) => sum + Number(o.total), 0),
          itemCount: tableOrders.reduce(
            (sum, o) => sum + o.items.reduce((iSum, i) => iSum + i.qty, 0),
            0
          ),
          earliestOrderTime: tableOrders[0]?.created_at || null,
          hasUnpaid,
        });
      }
    });

    return list;
  }, [activeOrders]);

  // Selected table detail
  const activeSelectedTable = useMemo(() => {
    if (!selectedTableNo) return null;
    return tableSummaries.find(
      (t) => normalizeTableKey(t.tableNo) === normalizeTableKey(selectedTableNo)
    );
  }, [selectedTableNo, tableSummaries]);

  // Filtered tables
  const filteredTables = useMemo(() => {
    return tableSummaries.filter((t) => {
      if (filterStatus === "active" && t.status === "available") return false;
      if (filterStatus === "available" && t.status !== "available") return false;
      if (searchTable.trim()) {
        const q = searchTable.toLowerCase().trim();
        return t.displayName.toLowerCase().includes(q) || t.tableNo.toLowerCase().includes(q);
      }
      return true;
    });
  }, [tableSummaries, filterStatus, searchTable]);

  // Action: Selesaikan semua pesanan meja dan kosongkan meja
  const handleClearTable = async (table: TableSummary) => {
    if (table.orders.length === 0) return;
    const confirm = window.confirm(
      `Yakin ingin menyelesaikan & mengosongkan ${table.displayName}? Semua pesanan di meja ini akan ditandai selesai.`
    );
    if (!confirm) return;

    setBusyAction(table.tableNo);
    for (const ord of table.orders) {
      if (ord.payment_status === "pending") {
        await confirmPaymentAction(ord.id);
      }
      await setFulfillmentAction(ord.id, "completed");
    }
    setBusyAction(null);
    setSelectedTableNo(null);
    if (onRefresh) onRefresh();
  };

  const occupiedCount = tableSummaries.filter((t) => t.status !== "available").length;
  const availableCount = tableSummaries.filter((t) => t.status === "available").length;
  const unpaidCount = tableSummaries.filter((t) => t.status === "unpaid").length;

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Top Floor Plan Bar */}
      <div className={`p-3 sm:p-4 border-b flex flex-wrap items-center justify-between gap-3 ${
        isMochi ? "bg-white border-[#d8e3de]" : "bg-white border-[#dedee8]"
      }`}>
        <div className="flex items-center gap-2.5">
          <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl shadow-xs ${
            isMochi ? "bg-[#0b3d2e] text-[#c8f53a]" : "bg-[#232331] text-white"
          }`}>
            <LayoutGrid size={20} />
          </div>
          <div>
            <h2 className={`font-black text-sm sm:text-base ${isMochi ? "text-[#0b3d2e]" : "text-[#232331]"}`}>
              Denah Meja Aktif (Live Floor Plan)
            </h2>
            <p className="font-mono text-[11px] text-[#718078]">
              {occupiedCount} Meja Terisi · {availableCount} Kosong {unpaidCount > 0 ? `· ⚠️ ${unpaidCount} Belum Lunas` : ""}
            </p>
          </div>
        </div>

        {/* Filter Pills */}
        <div className="flex items-center gap-1.5 font-mono text-xs">
          <button
            type="button"
            onClick={() => setFilterStatus("all")}
            className={`px-3 py-1.5 rounded-xl font-bold transition-all ${
              filterStatus === "all"
                ? isMochi
                  ? "bg-[#0b3d2e] text-[#c8f53a] shadow-xs"
                  : "bg-[#232331] text-white shadow-xs"
                : "bg-[#edf4f0] text-[#526159] hover:bg-[#e2ede7]"
            }`}
          >
            Semua ({tableSummaries.length})
          </button>
          <button
            type="button"
            onClick={() => setFilterStatus("active")}
            className={`px-3 py-1.5 rounded-xl font-bold transition-all ${
              filterStatus === "active"
                ? "bg-amber-500 text-white shadow-xs"
                : "bg-amber-50 text-amber-800 hover:bg-amber-100"
            }`}
          >
            Terisi ({occupiedCount})
          </button>
          <button
            type="button"
            onClick={() => setFilterStatus("available")}
            className={`px-3 py-1.5 rounded-xl font-bold transition-all ${
              filterStatus === "available"
                ? "bg-emerald-600 text-white shadow-xs"
                : "bg-emerald-50 text-emerald-800 hover:bg-emerald-100"
            }`}
          >
            Kosong ({availableCount})
          </button>
        </div>
      </div>

      {/* Grid of Tables */}
      <div className="flex-1 overflow-y-auto p-3 sm:p-4">
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3 font-mono">
          {filteredTables.map((t) => {
            const isSelected = selectedTableNo === t.tableNo;
            const isOccupied = t.status !== "available";

            return (
              <div
                key={t.tableNo}
                onClick={() => setSelectedTableNo(t.tableNo)}
                className={`relative cursor-pointer rounded-2xl p-3.5 sm:p-4 border-2 transition-all flex flex-col justify-between select-none min-h-[140px] ${
                  isSelected
                    ? "ring-3 ring-emerald-500 shadow-lg scale-[1.02]"
                    : "hover:shadow-md hover:scale-[1.01]"
                } ${
                  t.status === "available"
                    ? isMochi
                      ? "border-[#d8e3de] bg-white text-[#2a453b]"
                      : "border-[#dedee8] bg-white text-[#232331]"
                    : t.status === "unpaid"
                    ? "border-rose-400 bg-rose-50/70 text-rose-950 shadow-xs"
                    : t.status === "cooking"
                    ? "border-amber-400 bg-amber-50/70 text-amber-950 shadow-xs"
                    : "border-blue-400 bg-blue-50/70 text-blue-950 shadow-xs"
                }`}
              >
                {/* Header Meja */}
                <div className="flex items-start justify-between gap-1.5">
                  <div>
                    <h3 className="font-black text-sm sm:text-base font-sans leading-tight">
                      {t.displayName}
                    </h3>
                    {t.earliestOrderTime && (
                      <span className="text-[10px] text-[#718078] flex items-center gap-1 mt-0.5">
                        <Clock size={10} />
                        {getElapsedMinutes(t.earliestOrderTime)}
                      </span>
                    )}
                  </div>

                  {/* Status Indicator Dot */}
                  <span
                    className={`h-3 w-3 rounded-full shrink-0 mt-0.5 ${
                      t.status === "available"
                        ? "bg-emerald-500 ring-2 ring-emerald-200"
                        : t.status === "unpaid"
                        ? "bg-rose-500 ring-2 ring-rose-200 animate-pulse"
                        : t.status === "cooking"
                        ? "bg-amber-500 ring-2 ring-amber-200 animate-pulse"
                        : "bg-blue-500 ring-2 ring-blue-200"
                    }`}
                    title={
                      t.status === "available"
                        ? "Kosong / Siap Tamu"
                        : t.status === "unpaid"
                        ? "Menunggu Pembayaran"
                        : t.status === "cooking"
                        ? "Sedang Dimasak di Dapur"
                        : "Sedang Makan / Disajikan"
                    }
                  />
                </div>

                {/* Body Details */}
                {isOccupied ? (
                  <div className="space-y-1.5 pt-2 border-t border-black/5 mt-2">
                    <div className="flex justify-between items-baseline">
                      <span className="text-[10px] font-bold opacity-75">
                        {t.orders.length} Tiket ({t.itemCount} menu)
                      </span>
                      <strong className="text-xs sm:text-sm font-black text-[#0b3d2e]">
                        {formatRupiah(t.totalBill)}
                      </strong>
                    </div>

                    <div className="flex items-center justify-between text-[9.5px] font-bold">
                      <span
                        className={`px-1.5 py-0.5 rounded-md ${
                          t.status === "unpaid"
                            ? "bg-rose-200 text-rose-900"
                            : t.status === "cooking"
                            ? "bg-amber-200 text-amber-900"
                            : "bg-blue-200 text-blue-900"
                        }`}
                      >
                        {t.status === "unpaid"
                          ? "🔴 Belum Lunas"
                          : t.status === "cooking"
                          ? "🟡 Dimasak"
                          : "🔵 Disajikan"}
                      </span>
                      <span className="text-[#55695f] hover:underline">Rincian →</span>
                    </div>
                  </div>
                ) : (
                  <div className="pt-2 border-t border-black/5 mt-2 flex flex-col justify-end">
                    <span className="text-[10.5px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md self-start">
                      🟢 Meja Kosong
                    </span>
                    <span className="text-[9.5px] text-[#718078] mt-1">Sentuh untuk buka pesanan</span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* DRAWER / MODAL: TABLE ORDER DETAILS */}
      {activeSelectedTable && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 backdrop-blur-xs bg-[#07281e]/60">
          <div className="w-full sm:max-w-xl max-h-[92vh] overflow-y-auto rounded-t-3xl sm:rounded-3xl bg-white border border-[#d8e3de] shadow-2xl font-mono text-xs flex flex-col">
            {/* Header Drawer */}
            <div className="sticky top-0 z-10 bg-white px-5 py-3.5 border-b border-[#d8e3de] flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="font-black text-base font-sans text-[#0b3d2e]">
                    Rincian Pesanan {activeSelectedTable.displayName}
                  </h2>
                  <span
                    className={`px-2 py-0.5 rounded-md text-[10px] font-black ${
                      activeSelectedTable.status === "available"
                        ? "bg-emerald-100 text-emerald-800"
                        : activeSelectedTable.status === "unpaid"
                        ? "bg-rose-100 text-rose-900"
                        : activeSelectedTable.status === "cooking"
                        ? "bg-amber-100 text-amber-900"
                        : "bg-blue-100 text-blue-900"
                    }`}
                  >
                    {activeSelectedTable.status === "available"
                      ? "KOSONG"
                      : activeSelectedTable.status === "unpaid"
                      ? "BELUM LUNAS"
                      : activeSelectedTable.status === "cooking"
                      ? "SEDANG DIMASAK"
                      : "SEDANG MAKAN"}
                  </span>
                </div>
                <p className="text-[11px] text-[#718078] mt-0.5">
                  {activeSelectedTable.orders.length} Tiket Pesanan · Total Tagihan Meja:{" "}
                  <strong className="text-[#0b3d2e]">{formatRupiah(activeSelectedTable.totalBill)}</strong>
                </p>
              </div>

              <button
                type="button"
                onClick={() => setSelectedTableNo(null)}
                className="flex h-9 w-9 items-center justify-center rounded-xl border border-[#d8e3de] bg-[#f0f5f2] text-[#0b3d2e] hover:bg-[#e2ede7]"
              >
                <X size={16} />
              </button>
            </div>

            {/* Content Body */}
            <div className="p-4 space-y-4 flex-1 overflow-y-auto">
              {activeSelectedTable.orders.length === 0 ? (
                <div className="rounded-2xl border-2 border-dashed border-[#ccd9d3] bg-[#f8faf9] p-8 text-center space-y-3">
                  <Utensils size={32} className="mx-auto text-emerald-700" />
                  <div>
                    <p className="font-black text-sm text-[#0b3d2e]">Meja Ini Sedang Kosong</p>
                    <p className="text-xs text-[#718078] mt-1">
                      Belum ada pesanan aktif. Kasir atau tamu via QR dapat langsung memesan ke meja ini.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      onAddItemsToTable(activeSelectedTable.tableNo);
                      setSelectedTableNo(null);
                    }}
                    className="inline-flex items-center gap-1.5 rounded-xl bg-[#c8f53a] hover:bg-[#d9ff57] text-[#073829] px-4 py-2 text-xs font-black shadow-xs transition-all"
                  >
                    <Plus size={14} />
                    <span>+ Buat Pesanan Baru untuk Meja Ini</span>
                  </button>
                </div>
              ) : (
                <div className="space-y-3">
                  {activeSelectedTable.orders.map((order, idx) => (
                    <div
                      key={order.id}
                      className="rounded-2xl border border-[#d8e3de] bg-white p-3.5 space-y-2.5 shadow-xs"
                    >
                      {/* Ticket Header */}
                      <div className="flex items-center justify-between border-b border-[#edf2ef] pb-2 text-[11px]">
                        <div className="flex items-center gap-1.5">
                          <span className="font-black text-sm text-[#0b3d2e]">#{order.order_no}</span>
                          <span
                            className={`px-1.5 py-0.2 rounded text-[9.5px] font-black ${
                              idx === 0
                                ? "bg-[#edf8f3] text-[#167052] border border-emerald-300"
                                : "bg-purple-100 text-purple-900 border border-purple-300"
                            }`}
                          >
                            {idx === 0 ? "Pesanan Utama" : `Pesanan Tambahan ${idx}`}
                          </span>
                        </div>
                        <div className="text-right">
                          <span className="font-black text-sm text-[#0b3d2e] block">
                            {formatRupiah(Number(order.total))}
                          </span>
                          <span className="text-[10px] text-[#718078]">
                            {order.payment_method.toUpperCase()} ·{" "}
                            {PAYMENT_STATUS_LABEL[order.payment_status] || order.payment_status}
                          </span>
                        </div>
                      </div>

                      {/* Items List */}
                      <ul className="space-y-1.5 divide-y divide-[#f0f5f2]">
                        {order.items.map((item) => (
                          <li
                            key={item.id}
                            className="pt-1.5 flex items-center justify-between gap-2 text-[11px]"
                          >
                            <div className="min-w-0 flex-1">
                              <span className="font-bold text-[#0b3d2e] block truncate">
                                {item.qty}× {item.name_snapshot}
                              </span>
                              {item.note && (
                                <span className="text-[10px] text-[#718078] block">Catatan: {item.note}</span>
                              )}
                            </div>

                            <div className="flex items-center gap-2 shrink-0">
                              <span className="font-black text-[#0b3d2e]">
                                {formatRupiah(Number(item.subtotal))}
                              </span>
                              <button
                                type="button"
                                onClick={() => {
                                  setModalOrder(order);
                                  setModalItem(item);
                                  setShowAdjustModal(true);
                                }}
                                className="px-2 py-1 rounded-lg border border-amber-300 bg-amber-50 hover:bg-amber-100 text-amber-900 font-bold text-[10px] flex items-center gap-1"
                                title="Ganti menu karena stok habis atau refund item ini"
                              >
                                <span>⚠️ Ganti / Refund</span>
                              </button>
                            </div>
                          </li>
                        ))}
                      </ul>

                      {/* Order Footer Actions */}
                      <div className="flex items-center justify-between pt-2 border-t border-[#edf2ef] text-[10.5px]">
                        <span className="text-[#718078] flex items-center gap-1">
                          <ChefHat size={11} />
                          Dapur: <strong>{order.fulfillment_status?.toUpperCase()}</strong>
                        </span>

                        <button
                          type="button"
                          onClick={() => {
                            setModalOrder(order);
                            setModalItem(null);
                            setShowAdjustModal(true);
                          }}
                          className="text-rose-700 hover:underline font-bold"
                        >
                          ↩️ Refund / Void Tiket Ini
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Bottom Actions Drawer */}
            {activeSelectedTable.orders.length > 0 && (
              <div className="sticky bottom-0 bg-[#f8faf9] p-3.5 border-t border-[#d8e3de] space-y-2">
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      onAddItemsToTable(activeSelectedTable.tableNo);
                      setSelectedTableNo(null);
                    }}
                    className="flex items-center justify-center gap-1.5 rounded-xl bg-[#0b3d2e] hover:bg-[#124d3a] text-[#c8f53a] py-2.5 px-3 text-xs font-black shadow-xs transition-all"
                  >
                    <Plus size={14} />
                    <span>➕ Tambah Menu ke Meja Ini</span>
                  </button>

                  {onPrintCombinedTableBill && (
                    <button
                      type="button"
                      onClick={() => onPrintCombinedTableBill(activeSelectedTable)}
                      className="flex items-center justify-center gap-1.5 rounded-xl bg-[#c8f53a] hover:bg-[#d9ff57] text-[#073829] py-2.5 px-3 text-xs font-black shadow-xs transition-all"
                    >
                      <Printer size={14} />
                      <span>🖨️ Cetak Total Tagihan Meja</span>
                    </button>
                  )}
                </div>

                <button
                  type="button"
                  disabled={busyAction === activeSelectedTable.tableNo}
                  onClick={() => handleClearTable(activeSelectedTable)}
                  className="w-full flex items-center justify-center gap-1.5 rounded-xl border border-emerald-800/30 bg-white hover:bg-emerald-50 text-[#0b3d2e] py-2 text-xs font-black transition-all disabled:opacity-50"
                >
                  <CheckCircle2 size={14} className="text-emerald-700" />
                  <span>
                    {busyAction === activeSelectedTable.tableNo
                      ? "Memproses..."
                      : "✓ Tamu Selesai Makan · Tutup & Kosongkan Meja"}
                  </span>
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ADJUSTMENT MODAL (Ganti Menu & Refund) */}
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
            if (onRefresh) onRefresh();
          }}
        />
      )}
    </div>
  );
}
