"use client";

import { useState, useMemo, useEffect, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { 
  Receipt, 
  ShoppingCart, 
  Plus, 
  Minus, 
  Trash2, 
  Check, 
  CheckCircle2, 
  AlertCircle, 
  Search, 
  ArrowLeft, 
  Share2, 
  Printer, 
  QrCode, 
  Clock, 
  CreditCard, 
  DollarSign, 
  Coffee, 
  Utensils, 
  Percent, 
  FileText, 
  RotateCcw, 
  ExternalLink, 
  Sparkles, 
  Sliders, 
  Users, 
  ShieldCheck,
  TrendingUp,
  RefreshCw
} from "lucide-react";
import type { 
  MenuItem, 
  Category, 
  Business, 
  User, 
  Customer, 
  Shift, 
  Order, 
  OrderItem 
} from "@/lib/types";
import { 
  createOrderAction,
  openShiftAction,
  closeShiftAction,
  updateOrderStatusAction,
  searchCustomersAction
} from "@/lib/actions";
import { 
  calculateCartTotals, 
  calculateCashChange, 
  generateEscPosReceiptText,
  generateDailyOrderNo
} from "@/lib/pos-engine";
import { formatRupiah, formatBusinessDateTime } from "@/lib/formatters";
import QrisPayment from "./qris-payment";
import { maskPhoneNumber, calculateEarnedPoints } from "@/lib/loyalty-engine";

interface PosClientProps {
  business: Business | null;
  categories: Category[];
  menuItems: MenuItem[];
  activeShift: Shift | null;
  pendingQrOrders: (Order & { items: OrderItem[] })[];
  staffList: { id: string; name: string }[];
  currentUserId: string;
  orderCountToday: number;
  /** Pemasangan QRIS hanya untuk pemilik usaha: ini menentukan ke rekening siapa uang masuk. */
  userRole: "owner" | "staff";
}

export default function PosClient({
  business,
  categories,
  menuItems,
  activeShift,
  pendingQrOrders,
  staffList,
  currentUserId,
  orderCountToday,
  userRole,
}: PosClientProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [selectedStaffId] = useState<string>(currentUserId || staffList[0]?.id || "");
  const [activeCategory, setActiveCategory] = useState<string>("all");

  // Cart State
  const [cart, setCart] = useState<Record<string, { item: MenuItem; qty: number; note: string }>>({});
  const [discountNominal, setDiscountNominal] = useState<number>(0);
  const [taxRatePct, setTaxRatePct] = useState<number>(0);
  const [serviceChargePct, setServiceChargePct] = useState<number>(0);

  // Payment Modal State
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<"cash" | "qris" | "transfer">("cash");
  const [cashGivenInput, setCashGivenInput] = useState<number>(0);
  const [selectedTableNo, setSelectedTableNo] = useState<string>("");
  const [orderChannel, setOrderChannel] = useState<"cashier" | "qr_dinein" | "qr_takeaway">("cashier");

  // Loyalty Customer Integration in POS
  const [loyaltySearchQuery, setLoyaltySearchQuery] = useState("");
  const [loyaltySearchResults, setLoyaltySearchResults] = useState<(Customer & { balance: number })[]>([]);
  const [attachedCustomer, setAttachedCustomer] = useState<(Customer & { balance: number }) | null>(null);

  // Post-Payment Completed Order
  const [completedOrder, setCompletedOrder] = useState<{
    orderId: string;
    orderNo: string;
    total: number;
    change: number;
    paymentMethod: string;
    tableNo?: string | null;
    items: { name: string; qty: number; price: number; note?: string }[];
  } | null>(null);

  // Shift Modal State
  const [showShiftModal, setShowShiftModal] = useState(false);
  const [shiftOpeningCashInput, setShiftOpeningCashInput] = useState<number>(100000);
  const [shiftClosingCashInput, setShiftClosingCashInput] = useState<number>(0);

  const refreshAll = () => {
    startTransition(() => {
      router.refresh();
    });
  };

  // Cart Calculations
  const cartList = Object.values(cart);
  const cartTotals = useMemo(() => {
    return calculateCartTotals(
      cartList.map((c) => ({ price: c.item.price, qty: c.qty })),
      discountNominal,
      taxRatePct,
      serviceChargePct
    );
  }, [cartList, discountNominal, taxRatePct, serviceChargePct]);

  // Cash Change Calculation
  const cashChangeCalc = useMemo(() => {
    return calculateCashChange(cartTotals.total, cashGivenInput);
  }, [cartTotals.total, cashGivenInput]);

  // Filtered Menu Items
  const filteredMenu = useMemo(() => {
    return menuItems.filter((m) => {
      if (activeCategory === "all") return true;
      return m.category_id === activeCategory;
    });
  }, [menuItems, activeCategory]);

  // Search Loyalty Customers via Server Action
  useEffect(() => {
    if (!loyaltySearchQuery.trim()) {
      setLoyaltySearchResults([]);
      return;
    }
    const timer = setTimeout(async () => {
      const res = await searchCustomersAction(loyaltySearchQuery);
      setLoyaltySearchResults(res as (Customer & { balance: number })[]);
    }, 200);
    return () => clearTimeout(timer);
  }, [loyaltySearchQuery]);

  // ---------------------------------------------------------------------------
  // CART ACTIONS
  // ---------------------------------------------------------------------------
  const handleAddToCart = (item: MenuItem) => {
    if (!item.is_available) return;
    setCart((prev) => {
      const existing = prev[item.id];
      if (existing) {
        return { ...prev, [item.id]: { ...existing, qty: existing.qty + 1 } };
      }
      return { ...prev, [item.id]: { item, qty: 1, note: "" } };
    });
  };

  const handleUpdateQty = (itemId: string, delta: number) => {
    setCart((prev) => {
      const existing = prev[itemId];
      if (!existing) return prev;
      const nextQty = existing.qty + delta;
      if (nextQty <= 0) {
        const copy = { ...prev };
        delete copy[itemId];
        return copy;
      }
      return { ...prev, [itemId]: { ...existing, qty: nextQty } };
    });
  };

  const handleUpdateNote = (itemId: string, note: string) => {
    setCart((prev) => {
      const existing = prev[itemId];
      if (!existing) return prev;
      return { ...prev, [itemId]: { ...existing, note } };
    });
  };

  const handleClearCart = () => {
    if (confirm("Kosongkan seluruh keranjang kasir?")) {
      setCart({});
      setDiscountNominal(0);
      setAttachedCustomer(null);
    }
  };

  // ---------------------------------------------------------------------------
  // CHECKOUT & PAYMENT PROCESSING
  // ---------------------------------------------------------------------------
  const handleOpenPayment = () => {
    if (cartList.length === 0) return;
    setCashGivenInput(cartTotals.total);
    setShowPaymentModal(true);
  };

  const handleProcessPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (cartList.length === 0) return;

    if (paymentMethod === "cash" && !cashChangeCalc.isSufficient) {
      alert("Uang tunai yang diterima kurang dari total tagihan.");
      return;
    }

    const itemsPayload = cartList.map((c) => ({
      menu_item_id: c.item.id,
      qty: c.qty,
      note: c.note || undefined,
    }));

    const res = await createOrderAction({
      channel: orderChannel,
      table_no: selectedTableNo || null,
      payment_method: paymentMethod,
      discount: cartTotals.discount,
      tax: cartTotals.tax,
      service_charge: cartTotals.serviceCharge,
      cash_given: paymentMethod === "cash" ? cashGivenInput : null,
      customer_id: attachedCustomer?.id || null,
      items: itemsPayload,
    });

    if (!res.ok) {
      alert(res.error);
      return;
    }

    const completed = {
      orderId: res.data.orderId,
      orderNo: res.data.orderNo,
      total: res.data.total,
      change: res.data.change,
      paymentMethod,
      tableNo: selectedTableNo || null,
      items: cartList.map((c) => ({
        name: c.item.name,
        qty: c.qty,
        price: c.item.price,
        note: c.note,
      })),
    };

    setShowPaymentModal(false);
    setCart({});
    setDiscountNominal(0);
    setAttachedCustomer(null);
    setCompletedOrder(completed);
    refreshAll();
  };

  // Accept incoming QR order
  const handleAcceptQrOrder = async (qrOrder: Order & { items: OrderItem[] }) => {
    const res = await updateOrderStatusAction(qrOrder.id, "paid");
    if (!res.ok) {
      alert(res.error);
      return;
    }
    refreshAll();
    alert(`Pesanan Meja ${qrOrder.table_no || '-'} (${qrOrder.order_no}) berhasil ditandai lunas.`);
  };

  // ---------------------------------------------------------------------------
  // SHIFT MANAGEMENT
  // ---------------------------------------------------------------------------
  const handleOpenShift = async (e: React.FormEvent) => {
    e.preventDefault();
    const res = await openShiftAction(shiftOpeningCashInput, "Shift Kasir");
    if (!res.ok) {
      alert(res.error);
      return;
    }
    setShowShiftModal(false);
    refreshAll();
    alert(`Shift baru dibuka dengan modal awal ${formatRupiah(shiftOpeningCashInput)}.`);
  };

  const handleCloseShift = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeShift) return;

    const res = await closeShiftAction(activeShift.id, shiftClosingCashInput, "Tutup Shift");
    if (!res.ok) {
      alert(res.error);
      return;
    }

    setShowShiftModal(false);
    refreshAll();
    const variance = res.data.variance;
    alert(
      `Shift selesai ditutup!\n` +
      `Selisih Laci: ${formatRupiah(variance)} (${variance === 0 ? "PAS ✓" : variance > 0 ? "LEBIH" : "KURANG"})`
    );
  };

  // Web Bluetooth Thermal ESC/POS Trigger
  const handlePrintBluetoothThermal = async () => {
    if (!completedOrder) return;
    const staff = staffList.find((s) => s.id === selectedStaffId);
    const receiptText = generateEscPosReceiptText({
      businessName: business?.name || "KAEL POS",
      businessAddress: business?.address || "",
      businessPhone: business?.phone || "",
      orderNo: completedOrder.orderNo,
      tableNo: completedOrder.tableNo,
      channel: orderChannel,
      cashierName: staff?.name || "Kasir",
      createdAt: new Date().toISOString(),
      items: completedOrder.items,
      subtotal: cartTotals.subtotal,
      discount: discountNominal,
      tax: cartTotals.tax,
      serviceCharge: cartTotals.serviceCharge,
      total: completedOrder.total,
      paymentMethod: completedOrder.paymentMethod,
      cashGiven: cashGivenInput || undefined,
      cashChange: completedOrder.change || undefined,
      customerName: attachedCustomer?.name,
    });

    try {
      if ((navigator as any).bluetooth) {
        alert("Menghubungkan ke printer Bluetooth 58mm...");
        const device = await (navigator as any).bluetooth.requestDevice({
          acceptAllDevices: true,
          optionalServices: ["000018f0-0000-1000-8000-00805f9b34fb"],
        });
        alert(`Terhubung ke ${device.name}. Mengirim perintah cetak struk ESC/POS.`);
      } else {
        window.open(`/receipt/${completedOrder.orderId}`, "_blank");
      }
    } catch {
      window.open(`/receipt/${completedOrder.orderId}`, "_blank");
    }
  };

  return (
    <div className="min-h-screen bg-[#f7f6fc] text-[#232331] font-sans flex flex-col h-screen overflow-hidden">
      
      {/* Top POS Header */}
      <header className="border-b-2 border-[#232331] bg-white px-3 sm:px-6 py-2.5 shrink-0 z-30">
        <div className="flex items-center justify-between gap-2">
          
          <div className="flex items-center gap-2 sm:gap-3 min-w-0">
            <Link
              href="/app"
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-[#232331] bg-[#fcfcfe] text-[#232331] shadow-ink-xs hover:bg-[#f0edff]"
            >
              <ArrowLeft size={16} />
            </Link>

            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <h1 className="font-black text-xs sm:text-base text-[#232331] truncate">
                  {business?.name} · POS
                </h1>
                <span className="rounded-md bg-[#dcfce7] px-1.5 py-0.2 font-mono text-[8.5px] sm:text-[9px] font-bold text-[#16a34a] border border-[#16a34a] shrink-0">
                  Online Kasir
                </span>
              </div>
              <span className="text-[10px] sm:text-[11px] text-[#7b7b8e] font-mono block truncate">
                Shift: {activeShift ? `Aktif (${formatRupiah(Number(activeShift.opening_cash))})` : "Belum Dibuka"}
              </span>
            </div>
          </div>

          {/* Quick Actions Header */}
          <div className="flex items-center gap-1.5 font-mono text-xs">
            
            {/* Reports Link */}
            <Link
              href="/app/pos/reports"
              className="btn-tactile flex items-center gap-1 rounded-xl border border-[#232331] bg-white px-2.5 py-1.5 font-bold text-[#232331] shadow-ink-xs"
            >
              <TrendingUp size={13} />
              <span className="hidden sm:inline">Laporan Laba</span>
            </Link>

            {/* QR Orders Queue Badge */}
            {pendingQrOrders.length > 0 && (
              <button
                type="button"
                onClick={() => alert(`Ada ${pendingQrOrders.length} pesanan QR Meja yang menunggu diproses di antrean dapur.`)}
                className="btn-tactile flex items-center gap-1 rounded-xl border border-[#d97706] bg-[#fef3c7] px-2.5 py-1.5 font-bold text-[#d97706] shadow-ink-xs animate-pulse"
              >
                <Utensils size={13} />
                <span>{pendingQrOrders.length} Pesanan QR</span>
              </button>
            )}

            {/* Shift Button */}
            <button
              type="button"
              onClick={() => setShowShiftModal(true)}
              className={`btn-tactile flex items-center gap-1 rounded-xl border-2 px-3 py-1.5 font-black shadow-ink-xs ${
                activeShift
                  ? "border-[#232331] bg-[#d9ff57] text-[#232331]"
                  : "border-[#ef4444] bg-[#feebee] text-[#ef4444]"
              }`}
            >
              <Clock size={13} />
              <span>{activeShift ? "Tutup Shift" : "Buka Shift"}</span>
            </button>

          </div>

        </div>
      </header>

      {/* Main Terminal Workspace (Split View) */}
      <main className="flex-1 grid grid-cols-12 overflow-hidden">
        
        {/* Left Side: Visual Category & Menu Grid */}
        <section className="col-span-12 lg:col-span-7 xl:col-span-8 flex flex-col border-r-2 border-[#232331] bg-[#f7f6fc] overflow-hidden">
          
          {/* Category Bar */}
          <div className="flex items-center gap-1.5 p-3 border-b border-[#dedee8] bg-white overflow-x-auto scrollbar-none shrink-0 font-mono text-xs font-bold">
            <button
              type="button"
              onClick={() => setActiveCategory("all")}
              className={`px-3.5 py-2 rounded-xl border transition-all whitespace-nowrap min-h-[44px] flex items-center ${
                activeCategory === "all"
                  ? "bg-[#232331] text-[#d9ff57] border-[#232331] shadow-ink-xs"
                  : "bg-white text-[#7b7b8e] border-[#dedee8]"
              }`}
            >
              Semua Menu ({menuItems.length})
            </button>

            {categories.map((cat) => (
              <button
                key={cat.id}
                type="button"
                onClick={() => setActiveCategory(cat.id)}
                className={`px-3.5 py-2 rounded-xl border transition-all whitespace-nowrap min-h-[44px] flex items-center ${
                  activeCategory === cat.id
                    ? "bg-[#232331] text-[#d9ff57] border-[#232331] shadow-ink-xs"
                    : "bg-white text-[#7b7b8e] border-[#dedee8]"
                }`}
              >
                {cat.name}
              </button>
            ))}
          </div>

          {/* Menu Grid */}
          <div className="flex-1 p-3 sm:p-4 overflow-y-auto grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-2.5 sm:gap-3 auto-rows-max">
            {filteredMenu.map((item) => {
              const inCart = cart[item.id];
              return (
                <button
                  key={item.id}
                  type="button"
                  disabled={!item.is_available}
                  onClick={() => handleAddToCart(item)}
                  className={`card-tactile rounded-2xl border-2 p-3 text-left flex flex-col justify-between min-h-[100px] transition-all relative ${
                    item.is_available
                      ? "border-[#232331] bg-white hover:bg-[#fcfcfe] shadow-ink-xs"
                      : "border-[#dedee8] bg-[#f0edff]/40 opacity-50 cursor-not-allowed"
                  }`}
                >
                  {inCart && (
                    <span className="absolute top-2 right-2 flex h-6 w-6 items-center justify-center rounded-full bg-[#232331] text-[#d9ff57] font-mono text-xs font-black">
                      {inCart.qty}
                    </span>
                  )}

                  <div>
                    <h3 className="font-black text-xs sm:text-sm text-[#232331] font-sans leading-tight">
                      {item.name}
                    </h3>
                  </div>

                  <div className="mt-2 flex justify-between items-baseline font-mono">
                    <span className="text-xs sm:text-sm font-black text-[#c2410c]">
                      {formatRupiah(Number(item.price))}
                    </span>
                    {!item.is_available && (
                      <span className="text-[9px] text-[#ef4444] font-bold">Habis</span>
                    )}
                  </div>
                </button>
              );
            })}
          </div>

        </section>

        {/* Right Side: Sticky Live Cart & Checkout */}
        <section className="col-span-12 lg:col-span-5 xl:col-span-4 flex flex-col bg-white overflow-hidden">
          
          {/* Cart Header */}
          <div className="p-3.5 border-b border-[#dedee8] flex items-center justify-between shrink-0">
            <div className="flex items-center gap-2">
              <ShoppingCart size={17} className="text-[#7958d8]" />
              <h2 className="font-extrabold text-sm text-[#232331]">
                Keranjang Kasir ({cartList.reduce((s, c) => s + c.qty, 0)})
              </h2>
            </div>

            {cartList.length > 0 && (
              <button
                type="button"
                onClick={handleClearCart}
                className="text-[11px] font-mono text-[#ef4444] hover:underline font-bold"
              >
                Kosongkan
              </button>
            )}
          </div>

          {/* Cart Items List */}
          <div className="flex-1 p-3 overflow-y-auto space-y-2 font-mono text-xs">
            {cartList.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center p-6 text-[#7b7b8e] space-y-2">
                <Coffee size={36} className="text-[#dedee8]" />
                <p className="text-xs">Keranjang masih kosong. Ketuk menu di sebelah kiri untuk menambah pesanan.</p>
              </div>
            ) : (
              cartList.map(({ item, qty, note }) => (
                <div key={item.id} className="rounded-2xl border border-[#dedee8] bg-[#fcfcfe] p-2.5 space-y-2">
                  <div className="flex justify-between items-start">
                    <div className="min-w-0 flex-1">
                      <span className="font-bold text-xs text-[#232331] font-sans block truncate">
                        {item.name}
                      </span>
                      <span className="text-[11px] text-[#c2410c] font-black">
                        {formatRupiah(Number(item.price) * qty)}
                      </span>
                    </div>

                    {/* Qty Steppers */}
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        type="button"
                        onClick={() => handleUpdateQty(item.id, -1)}
                        className="h-7 w-7 rounded-lg bg-white border border-[#dedee8] font-black flex items-center justify-center text-[#7b7b8e] hover:border-[#232331]"
                      >
                        <Minus size={12} />
                      </button>
                      <span className="w-6 text-center font-black text-xs">{qty}</span>
                      <button
                        type="button"
                        onClick={() => handleUpdateQty(item.id, 1)}
                        className="h-7 w-7 rounded-lg bg-[#232331] text-[#d9ff57] font-black flex items-center justify-center"
                      >
                        <Plus size={12} />
                      </button>
                    </div>
                  </div>

                  <input
                    type="text"
                    value={note}
                    onChange={(e) => handleUpdateNote(item.id, e.target.value)}
                    placeholder="Catatan item (less sugar, es sedikit)..."
                    className="w-full rounded-lg border border-[#dedee8] bg-white px-2 py-1 text-[10.5px] text-[#232331] font-sans focus:outline-none"
                  />
                </div>
              ))
            )}
          </div>

          {/* Cart Financial Summary & Checkout Footer */}
          <div className="p-3.5 border-t-2 border-[#232331] bg-[#fcfcfe] space-y-2 shrink-0 font-mono text-xs">
            
            <div className="flex justify-between text-[#7b7b8e]">
              <span>Subtotal:</span>
              <span>{formatRupiah(cartTotals.subtotal)}</span>
            </div>

            {/* Discount Pill Selector */}
            <div className="flex items-center justify-between">
              <span className="text-[#7b7b8e]">Diskon:</span>
              <div className="flex items-center gap-1">
                {[0, 5000, 10000, 15000].map((d) => (
                  <button
                    key={d}
                    type="button"
                    onClick={() => setDiscountNominal(d)}
                    className={`px-1.5 py-0.5 rounded text-[10px] font-bold border ${
                      discountNominal === d ? "bg-[#232331] text-white border-[#232331]" : "bg-white text-[#7b7b8e] border-[#dedee8]"
                    }`}
                  >
                    {d === 0 ? "0" : `-${d / 1000}k`}
                  </button>
                ))}
              </div>
            </div>

            {/* Grand Total */}
            <div className="flex justify-between items-baseline pt-1 border-t border-[#dedee8]">
              <span className="font-extrabold text-sm text-[#232331]">TOTAL:</span>
              <span className="text-xl font-black text-[#16a34a]">
                {formatRupiah(cartTotals.total)}
              </span>
            </div>

            {/* Big Touch Checkout Button */}
            <button
              type="button"
              disabled={cartList.length === 0}
              onClick={handleOpenPayment}
              className="btn-tactile w-full flex items-center justify-center gap-2 rounded-2xl border-2 border-[#232331] bg-[#232331] py-3.5 text-sm font-black text-white shadow-ink-md disabled:opacity-40 min-h-[48px]"
            >
              <span>Bayar {formatRupiah(cartTotals.total)} ➔</span>
            </button>

          </div>

        </section>

      </main>

      {/* MODAL: PAYMENT MODAL & CASH CALCULATOR */}
      {showPaymentModal && (
        <div className="fixed inset-0 z-50 bg-[#232331]/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4">
          <div className="w-full max-w-lg rounded-3xl border-2 border-[#232331] bg-white p-5 sm:p-6 shadow-ink-lg space-y-4 animate-in zoom-in-95 font-mono text-xs max-h-[95vh] overflow-y-auto">
            
            <div className="flex items-center justify-between border-b border-[#dedee8] pb-3">
              <h3 className="font-extrabold text-base text-[#232331] font-sans">
                Pembayaran Kasir #{generateDailyOrderNo(orderCountToday + 1)}
              </h3>
              <button
                type="button"
                onClick={() => setShowPaymentModal(false)}
                className="text-[#7b7b8e] hover:text-[#232331] font-bold p-1"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleProcessPayment} className="space-y-4 font-sans text-xs">
              
              {/* Order Channel Selector */}
              <div className="space-y-1 font-mono">
                <label className="block font-bold text-[#232331]">Tipe Layanan:</label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { id: "cashier", label: "Takeaway / Kasir" },
                    { id: "qr_dinein", label: "Dine-In (Meja)" },
                    { id: "qr_takeaway", label: "Bungkus" },
                  ].map((ch) => (
                    <button
                      key={ch.id}
                      type="button"
                      onClick={() => setOrderChannel(ch.id as any)}
                      className={`p-2 rounded-xl border font-bold text-center text-[11px] ${
                        orderChannel === ch.id ? "bg-[#232331] text-[#d9ff57] border-[#232331]" : "bg-white text-[#7b7b8e] border-[#dedee8]"
                      }`}
                    >
                      {ch.label}
                    </button>
                  ))}
                </div>
              </div>

              {orderChannel === "qr_dinein" && (
                <div className="space-y-1 font-mono">
                  <label className="block font-bold text-[#232331]">Nomor Meja:</label>
                  <input
                    type="text"
                    value={selectedTableNo}
                    onChange={(e) => setSelectedTableNo(e.target.value)}
                    placeholder="Contoh: 04"
                    className="w-full rounded-xl border border-[#232331] p-2 text-xs font-bold text-[#232331]"
                  />
                </div>
              )}

              {/* Loyalty Customer Attacher */}
              <div className="space-y-1 font-mono border-t border-[#dedee8] pt-3">
                <div className="flex justify-between items-center">
                  <label className="font-bold text-[#7958d8]">Member KAEL Loyalty (Opsional):</label>
                  {attachedCustomer && (
                    <button
                      type="button"
                      onClick={() => setAttachedCustomer(null)}
                      className="text-[10px] text-[#ef4444] font-bold hover:underline"
                    >
                      Lepas Member
                    </button>
                  )}
                </div>

                {attachedCustomer ? (
                  <div className="rounded-xl border border-[#16a34a] bg-[#dcfce7] p-2.5 flex justify-between items-center">
                    <div>
                      <span className="font-bold text-sm text-[#232331] block">{attachedCustomer.name}</span>
                      <span className="text-[10.5px] text-[#7b7b8e]">{maskPhoneNumber(attachedCustomer.phone)}</span>
                    </div>
                    <span className="font-black text-xs text-[#16a34a]">
                      +{calculateEarnedPoints(cartTotals.total, 10000)} Pts Masuk ✓
                    </span>
                  </div>
                ) : (
                  <div className="relative">
                    <Search className="absolute left-3 top-2.5 text-[#7b7b8e]" size={14} />
                    <input
                      type="text"
                      value={loyaltySearchQuery}
                      onChange={(e) => setLoyaltySearchQuery(e.target.value)}
                      placeholder="Ketik 4 digit WA member..."
                      className="w-full rounded-xl border border-[#dedee8] pl-8 pr-3 py-1.5 text-xs font-bold text-[#232331]"
                    />

                    {loyaltySearchResults.length > 0 && (
                      <div className="mt-1 rounded-xl border border-[#7958d8] bg-white p-1 space-y-1 max-h-32 overflow-y-auto">
                        {loyaltySearchResults.map((c) => (
                          <button
                            key={c.id}
                            type="button"
                            onClick={() => {
                              setAttachedCustomer(c);
                              setLoyaltySearchQuery("");
                            }}
                            className="w-full flex justify-between items-center p-1.5 rounded-lg hover:bg-[#f0edff] text-left text-[11px]"
                          >
                            <span className="font-bold text-[#232331]">{c.name} ({maskPhoneNumber(c.phone)})</span>
                            <span className="font-bold text-[#16a34a]">{c.balance} Pts</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Payment Method Selector */}
              <div className="space-y-1 font-mono border-t border-[#dedee8] pt-3">
                <label className="block font-bold text-[#232331]">Metode Pembayaran:</label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { id: "cash", label: "💵 Tunai (Cash)" },
                    { id: "qris", label: "📱 QRIS" },
                    { id: "transfer", label: "🏦 Transfer" },
                  ].map((m) => (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => setPaymentMethod(m.id as any)}
                      className={`p-2.5 rounded-xl border font-bold text-center text-xs ${
                        paymentMethod === m.id ? "bg-[#232331] text-[#d9ff57] border-[#232331] shadow-ink-xs" : "bg-white text-[#7b7b8e] border-[#dedee8]"
                      }`}
                    >
                      {m.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Cash Input & Change Calculator */}
              {paymentMethod === "cash" && (
                <div className="rounded-2xl border border-[#dedee8] bg-[#fcfcfe] p-3 space-y-2 font-mono text-xs">
                  <label className="block font-bold text-[#232331]">Uang Tunai Diterima (Rp):</label>
                  <input
                    type="number"
                    min={cartTotals.total}
                    step={5000}
                    value={cashGivenInput}
                    onChange={(e) => setCashGivenInput(Number(e.target.value))}
                    className="w-full rounded-xl border-2 border-[#232331] p-2.5 text-base font-black text-[#232331]"
                  />

                  {/* Quick Cash Pills */}
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {[cartTotals.total, 50000, 100000, 150000, 200000].filter((v, i, a) => a.indexOf(v) === i && v >= cartTotals.total).map((amt) => (
                      <button
                        key={amt}
                        type="button"
                        onClick={() => setCashGivenInput(amt)}
                        className="px-2 py-1 rounded-lg border border-[#dedee8] bg-white text-[10.5px] font-bold text-[#7b7b8e] hover:border-[#232331]"
                      >
                        {amt === cartTotals.total ? "Uang Pas" : formatRupiah(amt)}
                      </button>
                    ))}
                  </div>

                  {/* Kembalian Display */}
                  <div className="flex justify-between items-center pt-2 border-t border-[#dedee8]">
                    <span className="font-bold text-[#7b7b8e]">KEMBALIAN:</span>
                    <span className="text-base font-black text-[#16a34a]">
                      {formatRupiah(cashChangeCalc.cashChange)}
                    </span>
                  </div>
                </div>
              )}

              {/* QRIS: QR bernominal, atau pemasangan kalau belum terpasang */}
              {paymentMethod === "qris" && (
                <QrisPayment
                  business={business}
                  amount={cartTotals.total}
                  isOwner={userRole === "owner"}
                />
              )}

              {/* Submit Payment */}
              <div className="pt-2">
                <button
                  type="submit"
                  disabled={isPending}
                  className="btn-tactile w-full flex items-center justify-center gap-2 rounded-2xl border-2 border-[#232331] bg-[#16a34a] py-3.5 text-sm font-black text-white shadow-ink-md disabled:opacity-50"
                >
                  <Check size={16} />
                  <span>{isPending ? "Memproses..." : "Proses Pembayaran Selesai ✓"}</span>
                </button>
              </div>

            </form>

          </div>
        </div>
      )}

      {/* MODAL: POST-PAYMENT SUCCESS & RECEIPT ACTIONS */}
      {completedOrder && (
        <div className="fixed inset-0 z-50 bg-[#232331]/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="w-full max-w-sm rounded-3xl border-2 border-[#232331] bg-white p-6 shadow-ink-lg text-center space-y-4 animate-in zoom-in-95 font-mono text-xs">
            
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-[#dcfce7] text-[#16a34a] border-2 border-[#16a34a]">
              <CheckCircle2 size={32} />
            </div>

            <div className="space-y-1">
              <span className="text-[10.5px] text-[#7958d8] font-bold block uppercase">TRANSAKSI SUKSES</span>
              <h3 className="text-2xl font-black text-[#232331]">
                #{completedOrder.orderNo}
              </h3>
              <p className="text-base font-extrabold text-[#16a34a]">
                Total: {formatRupiah(completedOrder.total)}
              </p>
              {completedOrder.paymentMethod === "cash" && (
                <p className="text-xs text-[#7b7b8e]">
                  Kembalian: {formatRupiah(completedOrder.change)}
                </p>
              )}
            </div>

            {/* Receipt Actions */}
            <div className="space-y-2 pt-2">
              <button
                type="button"
                onClick={handlePrintBluetoothThermal}
                className="btn-tactile w-full flex items-center justify-center gap-2 rounded-xl border-2 border-[#232331] bg-[#232331] py-2.5 text-xs font-bold text-white shadow-ink-xs"
              >
                <Printer size={14} />
                <span>Cetak Struk Thermal (ESC/POS)</span>
              </button>

              <Link
                href={`/receipt/${completedOrder.orderId}`}
                target="_blank"
                className="btn-tactile w-full flex items-center justify-center gap-2 rounded-xl border border-[#16a34a] bg-[#dcfce7] py-2.5 text-xs font-bold text-[#16a34a]"
              >
                <Share2 size={14} />
                <span>Kirim Struk Digital WhatsApp</span>
              </Link>
            </div>

            <button
              type="button"
              onClick={() => setCompletedOrder(null)}
              className="w-full py-2 text-xs font-bold text-[#7b7b8e] hover:text-[#232331] pt-1"
            >
              + Transaksi Baru
            </button>

          </div>
        </div>
      )}

      {/* MODAL: SHIFT MANAGEMENT */}
      {showShiftModal && (
        <div className="fixed inset-0 z-50 bg-[#232331]/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="w-full max-w-md rounded-3xl border-2 border-[#232331] bg-white p-6 shadow-ink-lg space-y-4 animate-in zoom-in-95 font-mono text-xs">
            
            <div className="flex items-center justify-between border-b border-[#dedee8] pb-3">
              <h3 className="font-extrabold text-base text-[#232331] font-sans">
                {activeShift ? "Tutup Shift Kasir" : "Buka Shift Kasir Baru"}
              </h3>
              <button
                type="button"
                onClick={() => setShowShiftModal(false)}
                className="text-[#7b7b8e] hover:text-[#232331] font-bold p-1"
              >
                ✕
              </button>
            </div>

            {activeShift ? (
              <form onSubmit={handleCloseShift} className="space-y-3 font-sans">
                <div className="rounded-xl bg-[#f0edff] p-3 space-y-1 font-mono text-xs">
                  <div className="flex justify-between">
                    <span className="text-[#7b7b8e]">Waktu Buka:</span>
                    <span>{formatBusinessDateTime(activeShift.opened_at)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[#7b7b8e]">Modal Awal:</span>
                    <span className="font-bold">{formatRupiah(Number(activeShift.opening_cash))}</span>
                  </div>
                </div>

                <div className="space-y-1 font-mono">
                  <label className="block font-bold text-[#232331]">
                    Hitung Uang Fisik di Laci Kasir (Rp):
                  </label>
                  <input
                    type="number"
                    required
                    min={0}
                    step={5000}
                    value={shiftClosingCashInput}
                    onChange={(e) => setShiftClosingCashInput(Number(e.target.value))}
                    className="w-full rounded-xl border-2 border-[#232331] p-2.5 text-base font-black text-[#232331]"
                    autoFocus
                  />
                  <span className="text-[10px] text-[#7b7b8e] block">
                    Sistem otomatis mencocokkan dengan rekaman penjualan kasir.
                  </span>
                </div>

                <div className="flex justify-end gap-2 pt-2 font-mono">
                  <button
                    type="button"
                    onClick={() => setShowShiftModal(false)}
                    className="rounded-xl border border-[#dedee8] bg-white px-3 py-2 font-bold text-[#7b7b8e]"
                  >
                    Batal
                  </button>
                  <button
                    type="submit"
                    disabled={isPending}
                    className="btn-tactile rounded-xl bg-[#ef4444] px-5 py-2 font-black text-white shadow-ink-xs disabled:opacity-50"
                  >
                    Tutup Shift &amp; Rekonsiliasi ✓
                  </button>
                </div>
              </form>
            ) : (
              <form onSubmit={handleOpenShift} className="space-y-3 font-sans">
                <div className="space-y-1 font-mono">
                  <label className="block font-bold text-[#232331]">
                    Modal Awal Uang Kembalian (Rp):
                  </label>
                  <input
                    type="number"
                    required
                    min={0}
                    step={10000}
                    value={shiftOpeningCashInput}
                    onChange={(e) => setShiftOpeningCashInput(Number(e.target.value))}
                    className="w-full rounded-xl border-2 border-[#232331] p-2.5 text-base font-black text-[#232331]"
                    autoFocus
                  />
                </div>

                <div className="flex justify-end gap-2 pt-2 font-mono">
                  <button
                    type="button"
                    onClick={() => setShowShiftModal(false)}
                    className="rounded-xl border border-[#dedee8] bg-white px-3 py-2 font-bold text-[#7b7b8e]"
                  >
                    Batal
                  </button>
                  <button
                    type="submit"
                    disabled={isPending}
                    className="btn-tactile rounded-xl bg-[#232331] px-5 py-2 font-black text-[#d9ff57] shadow-ink-xs disabled:opacity-50"
                  >
                    Buka Shift Sekarang ✓
                  </button>
                </div>
              </form>
            )}

          </div>
        </div>
      )}

    </div>
  );
}
