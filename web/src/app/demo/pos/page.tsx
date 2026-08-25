"use client";

import { useState } from "react";
import Link from "next/link";
import { 
  ArrowLeft, 
  ArrowRight, 
  BarChart3, 
  Check, 
  Clock, 
  CreditCard, 
  DollarSign, 
  Layers, 
  MessageCircle, 
  Minus, 
  Plus, 
  Printer, 
  QrCode, 
  Search, 
  ShoppingBag, 
  Smartphone,
  Sparkles, 
  Table, 
  Trash2, 
  TrendingUp, 
  Utensils, 
  Zap 
} from "lucide-react";
import { DemoNavbar } from "@/components/demo-navbar";
import { DEMO_BRANDS, DemoBrand } from "@/lib/demo-config";

interface MenuItem {
  id: string;
  name: string;
  category: "all" | "coffee" | "food" | "snack";
  price: number;
  desc: string;
  badge?: string;
}

const MENU_DATA: MenuItem[] = [
  { id: "m1", name: "Iced Spanish Latte", category: "coffee", price: 28000, desc: "Espresso double shot, susu segar & condensed milk", badge: "⭐ Favorit" },
  { id: "m2", name: "Caramel Macchiato", category: "coffee", price: 32000, desc: "Vanilla syrup, steamed milk, espresso & caramel drizzle" },
  { id: "m3", name: "Butter Croissant", category: "food", price: 24000, desc: "Freshly baked artisan French pastry gurih & renyah", badge: "Best Seller" },
  { id: "m4", name: "Senja Beef Burger", category: "food", price: 48000, desc: "Juicy Australian beef patty, cheddar, caramelized onion" },
  { id: "m5", name: "Truffle French Fries", category: "snack", price: 26000, desc: "Kentang goreng renyah dengan aroma truffle oil & parmesan" },
  { id: "m6", name: "Matcha Oat Latte", category: "coffee", price: 30000, desc: "Pure Uji Matcha import dengan oat milk creamy" },
];

export default function DemoPosPage() {
  const [currentBrand, setCurrentBrand] = useState<DemoBrand>(DEMO_BRANDS[0]);
  const [showWhiteLabelBadge, setShowWhiteLabelBadge] = useState<boolean>(true);
  
  // App View: "customer" (Menu QR Meja) vs "cashier" (POS Kasir) vs "receipt" (Struk Thermal)
  const [appMode, setAppMode] = useState<"customer" | "cashier" | "receipt">("customer");
  
  // Customer State
  const [selectedTable, setSelectedTable] = useState<string>("08");
  const [orderType, setOrderType] = useState<"dine-in" | "takeaway">("dine-in");
  const [activeCategory, setActiveCategory] = useState<string>("all");
  const [cart, setCart] = useState<{ item: MenuItem; qty: number; note: string }[]>([
    { item: MENU_DATA[0], qty: 2, note: "Less sugar, es banyak" },
    { item: MENU_DATA[2], qty: 1, note: "Hangatkan sebentar" },
  ]);
  const [isQrisModalOpen, setIsQrisModalOpen] = useState<boolean>(false);
  const [isOrderPaid, setIsOrderPaid] = useState<boolean>(false);

  // Cashier Orders State
  const [activeOrders, setActiveOrders] = useState([
    { id: "ORD-9821", table: "08", type: "Dine-In", time: "14:20", items: "2x Spanish Latte, 1x Butter Croissant", total: 80000, status: "Dimasak", payment: "QRIS" },
    { id: "ORD-9820", table: "03", type: "Dine-In", time: "14:15", items: "1x Beef Burger, 1x Truffle Fries", total: 74000, status: "Selesai", payment: "Tunai" },
    { id: "ORD-9819", table: "Takeaway", type: "Takeaway", time: "14:05", items: "2x Matcha Oat Latte", total: 60000, status: "Selesai", payment: "QRIS" },
  ]);

  const addToCart = (item: MenuItem) => {
    setCart((prev) => {
      const exist = prev.find((p) => p.item.id === item.id);
      if (exist) {
        return prev.map((p) => (p.item.id === item.id ? { ...p, qty: p.qty + 1 } : p));
      }
      return [...prev, { item, qty: 1, note: "" }];
    });
  };

  const updateQty = (id: string, delta: number) => {
    setCart((prev) =>
      prev
        .map((p) => (p.item.id === id ? { ...p, qty: p.qty + delta } : p))
        .filter((p) => p.qty > 0)
    );
  };

  const subtotal = cart.reduce((acc, curr) => acc + curr.item.price * curr.qty, 0);
  const tax = Math.round(subtotal * 0.1);
  const grandTotal = subtotal + tax;

  const handleSimulatePayment = () => {
    setIsQrisModalOpen(false);
    setIsOrderPaid(true);
    // Add to cashier incoming orders
    setActiveOrders((prev) => [
      {
        id: `ORD-${Math.floor(1000 + Math.random() * 9000)}`,
        table: selectedTable,
        type: orderType === "dine-in" ? "Dine-In" : "Takeaway",
        time: "Baru Saja",
        items: cart.map((c) => `${c.qty}x ${c.item.name}`).join(", "),
        total: grandTotal,
        status: "Baru",
        payment: "QRIS",
      },
      ...prev,
    ]);
  };

  return (
    <div className="min-h-screen bg-[#fcfcfe] text-[#232331] flex flex-col">
      <DemoNavbar
        currentBrand={currentBrand}
        onBrandChange={setCurrentBrand}
        showWhiteLabelBadge={showWhiteLabelBadge}
        onToggleWhiteLabelBadge={setShowWhiteLabelBadge}
      />

      <main className="flex-1 max-w-7xl mx-auto px-3 sm:px-6 py-4 sm:py-8 w-full">
        
        {/* Top Header & Role Switcher */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-[#dedee8] pb-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="flex h-6 w-6 items-center justify-center rounded-md bg-[#16a34a] text-white font-mono text-[10px] font-bold">
                02
              </span>
              <h1 className="text-lg sm:text-2xl font-extrabold text-[#232331]">
                KAEL POS &amp; Ordering Live System
              </h1>
            </div>
            <p className="text-xs text-[#7b7b8e] mt-0.5">
              Menu digital self-order tamu di meja terhubung langsung ke kasir web &amp; printer struk bluetooth.
            </p>
          </div>

          {/* Role Switcher Pill */}
          <div className="flex items-center rounded-2xl border-2 border-[#232331] bg-white p-1 shadow-ink-xs font-mono text-xs">
            <button
              type="button"
              onClick={() => setAppMode("customer")}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl font-bold transition-all ${
                appMode === "customer"
                  ? "bg-[#232331] text-[#d9ff57] shadow-ink-xs"
                  : "text-[#7b7b8e] hover:text-[#232331]"
              }`}
            >
              <Smartphone size={13} />
              <span>1. Menu QR Tamu</span>
            </button>
            <button
              type="button"
              onClick={() => setAppMode("cashier")}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl font-bold transition-all ${
                appMode === "cashier"
                  ? "bg-[#232331] text-[#d9ff57] shadow-ink-xs"
                  : "text-[#7b7b8e] hover:text-[#232331]"
              }`}
            >
              <Table size={13} />
              <span>2. POS Kasir Web</span>
            </button>
            <button
              type="button"
              onClick={() => setAppMode("receipt")}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl font-bold transition-all ${
                appMode === "receipt"
                  ? "bg-[#232331] text-[#d9ff57] shadow-ink-xs"
                  : "text-[#7b7b8e] hover:text-[#232331]"
              }`}
            >
              <Printer size={13} />
              <span>3. Struk Thermal</span>
            </button>
          </div>
        </div>

        {/* ========================================================= */}
        {/* VIEW 1: CUSTOMER SELF-ORDER QR MENU */}
        {/* ========================================================= */}
        {appMode === "customer" && (
          <div className="mt-6 grid gap-6 lg:grid-cols-12 items-start">
            
            {/* Left Phone: Self-Order Menu Screen */}
            <div className="lg:col-span-7 min-w-0">
              <div className="rounded-3xl border-2 border-[#232331] bg-white p-4 sm:p-6 shadow-ink-md">
                
                {/* Store Header in App */}
                <div className="flex items-center justify-between border-b border-[#dedee8] pb-4">
                  <div className="flex items-center gap-3">
                    <span 
                      className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-white font-extrabold text-xs shadow-ink-xs"
                      style={{ backgroundColor: currentBrand.themeColor }}
                    >
                      {currentBrand.logoText.slice(0, 2)}
                    </span>
                    <div>
                      <h2 className="font-extrabold text-sm sm:text-base text-[#232331]">
                        {currentBrand.name}
                      </h2>
                      <p className="text-[11px] text-[#7b7b8e]">
                        Scan QR Meja • {currentBrand.tagline}
                      </p>
                    </div>
                  </div>

                  {/* Table & Order Type Selector */}
                  <div className="flex items-center gap-2">
                    <div className="flex items-center gap-1 rounded-xl bg-[#f0edff] border border-[#7958d8]/30 px-2.5 py-1 text-xs font-mono font-bold text-[#7958d8]">
                      <span>Meja:</span>
                      <select 
                        value={selectedTable} 
                        onChange={(e) => setSelectedTable(e.target.value)}
                        className="bg-transparent font-extrabold text-[#232331] focus:outline-none cursor-pointer"
                      >
                        {Array.from({ length: currentBrand.tableCount }).map((_, idx) => (
                          <option key={idx} value={String(idx + 1).padStart(2, "0")}>
                            {String(idx + 1).padStart(2, "0")}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>

                {/* Dine-In / Takeaway Toggle */}
                <div className="mt-4 flex rounded-xl border border-[#dedee8] bg-[#fcfcfe] p-1 font-mono text-xs">
                  <button
                    type="button"
                    onClick={() => setOrderType("dine-in")}
                    className={`flex-1 py-1.5 rounded-lg font-bold transition-all ${
                      orderType === "dine-in" ? "bg-[#232331] text-white" : "text-[#7b7b8e]"
                    }`}
                  >
                    Dine-In (Makan di Tempat)
                  </button>
                  <button
                    type="button"
                    onClick={() => setOrderType("takeaway")}
                    className={`flex-1 py-1.5 rounded-lg font-bold transition-all ${
                      orderType === "takeaway" ? "bg-[#232331] text-white" : "text-[#7b7b8e]"
                    }`}
                  >
                    Take-Away (Bungkus)
                  </button>
                </div>

                {/* Category Filter Pills */}
                <div className="mt-4 flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none font-mono text-xs">
                  {[
                    { id: "all", label: "Semua Menu" },
                    { id: "coffee", label: "Coffee & Beverage" },
                    { id: "food", label: "Main Course" },
                    { id: "snack", label: "Snack & Pastry" },
                  ].map((cat) => (
                    <button
                      key={cat.id}
                      type="button"
                      onClick={() => setActiveCategory(cat.id)}
                      className={`whitespace-nowrap px-3 py-1.5 rounded-xl font-bold border transition-all ${
                        activeCategory === cat.id
                          ? "bg-[#232331] text-[#d9ff57] border-[#232331]"
                          : "bg-white text-[#7b7b8e] border-[#dedee8] hover:border-[#232331]"
                      }`}
                    >
                      {cat.label}
                    </button>
                  ))}
                </div>

                {/* Menu Items List */}
                <div className="mt-4 space-y-3">
                  {MENU_DATA.filter((m) => activeCategory === "all" || m.category === activeCategory).map((item) => {
                    const inCart = cart.find((c) => c.item.id === item.id);
                    return (
                      <div
                        key={item.id}
                        className="flex items-center justify-between gap-3 rounded-2xl border border-[#dedee8] bg-white p-3.5 hover:border-[#232331] transition-all"
                      >
                        <div className="min-w-0 flex-1 pr-2">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-extrabold text-xs sm:text-sm text-[#232331]">
                              {item.name}
                            </span>
                            {item.badge && (
                              <span className="font-mono text-[9px] font-bold text-[#7958d8] bg-[#f0edff] px-1.5 py-0.2 rounded">
                                {item.badge}
                              </span>
                            )}
                          </div>
                          <p className="text-[11px] text-[#7b7b8e] mt-0.5 line-clamp-1">
                            {item.desc}
                          </p>
                          <span className="font-mono text-xs font-extrabold text-[#232331] block mt-1">
                            Rp {item.price.toLocaleString("id-ID")}
                          </span>
                        </div>

                        {/* Add / Stepper Button */}
                        <div className="shrink-0">
                          {inCart ? (
                            <div className="flex items-center gap-1.5 rounded-xl border border-[#232331] bg-[#d9ff57] p-1 font-mono text-xs font-bold text-[#232331] shadow-ink-xs">
                              <button
                                type="button"
                                onClick={() => updateQty(item.id, -1)}
                                className="flex h-6 w-6 items-center justify-center rounded-lg bg-white hover:bg-gray-100"
                              >
                                <Minus size={11} strokeWidth={3} />
                              </button>
                              <span className="w-5 text-center">{inCart.qty}</span>
                              <button
                                type="button"
                                onClick={() => updateQty(item.id, 1)}
                                className="flex h-6 w-6 items-center justify-center rounded-lg bg-white hover:bg-gray-100"
                              >
                                <Plus size={11} strokeWidth={3} />
                              </button>
                            </div>
                          ) : (
                            <button
                              type="button"
                              onClick={() => addToCart(item)}
                              className="btn-tactile rounded-xl bg-[#232331] px-3 py-1.5 font-mono text-xs font-bold text-white hover:bg-[#1a1a24] shadow-ink-xs"
                            >
                              + Pesan
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>

              </div>
            </div>

            {/* Right Drawer: Cart & Checkout */}
            <div className="lg:col-span-5 min-w-0">
              <div className="rounded-3xl border-2 border-[#232331] bg-white p-5 shadow-ink-md">
                
                <div className="flex items-center justify-between border-b border-[#dedee8] pb-3">
                  <div className="flex items-center gap-2">
                    <ShoppingBag size={16} className="text-[#7958d8]" />
                    <h3 className="font-extrabold text-sm text-[#232331]">
                      Ringkasan Pesanan (Meja {selectedTable})
                    </h3>
                  </div>
                  <span className="font-mono text-xs text-[#7b7b8e]">
                    {cart.reduce((a, b) => a + b.qty, 0)} Item
                  </span>
                </div>

                {/* Cart Items */}
                {cart.length > 0 ? (
                  <div className="mt-4 space-y-3 max-h-[300px] overflow-y-auto pr-1">
                    {cart.map((c) => (
                      <div key={c.item.id} className="rounded-xl bg-[#fcfcfe] border border-[#dedee8] p-3 text-xs">
                        <div className="flex items-center justify-between font-bold text-[#232331]">
                          <span>{c.item.name}</span>
                          <span className="font-mono">Rp {(c.item.price * c.qty).toLocaleString("id-ID")}</span>
                        </div>
                        <div className="mt-1 flex items-center justify-between text-[11px] text-[#7b7b8e]">
                          <span>Qty: {c.qty}x @Rp {c.item.price.toLocaleString("id-ID")}</span>
                          <button
                            type="button"
                            onClick={() => updateQty(c.item.id, -c.qty)}
                            className="text-[#ef4444] hover:underline"
                          >
                            Hapus
                          </button>
                        </div>
                        {c.note && (
                          <div className="mt-1 text-[10px] text-[#7958d8] italic bg-white p-1 rounded border">
                            Catatan: "{c.note}"
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="py-8 text-center text-xs text-[#7b7b8e]">
                    Keranjang masih kosong. Pilih menu di sebelah kiri!
                  </div>
                )}

                {/* Price Breakdown */}
                {cart.length > 0 && (
                  <div className="mt-4 border-t border-[#dedee8] pt-3 space-y-1.5 text-xs font-mono">
                    <div className="flex justify-between text-[#7b7b8e]">
                      <span>Subtotal Menu</span>
                      <span>Rp {subtotal.toLocaleString("id-ID")}</span>
                    </div>
                    <div className="flex justify-between text-[#7b7b8e]">
                      <span>PB1 / Pajak Resto (10%)</span>
                      <span>Rp {tax.toLocaleString("id-ID")}</span>
                    </div>
                    <div className="flex justify-between font-extrabold text-sm text-[#232331] pt-2 border-t">
                      <span>Total Bayar</span>
                      <span className="text-[#7958d8]">Rp {grandTotal.toLocaleString("id-ID")}</span>
                    </div>

                    {/* Checkout Buttons */}
                    <div className="mt-4 space-y-2 pt-2">
                      <button
                        type="button"
                        onClick={() => setIsQrisModalOpen(true)}
                        className="btn-tactile flex w-full items-center justify-center gap-2 rounded-xl bg-[#232331] py-3 text-xs font-extrabold text-[#d9ff57] shadow-ink-md"
                      >
                        <QrCode size={14} />
                        <span>Bayar QRIS di Meja (Instan)</span>
                      </button>

                      <button
                        type="button"
                        onClick={handleSimulatePayment}
                        className="btn-tactile flex w-full items-center justify-center gap-1.5 rounded-xl bg-[#f0edff] py-2.5 text-xs font-bold text-[#7958d8] border border-[#7958d8]/40"
                      >
                        <span>Pesan Dulu, Bayar Tunai di Kasir</span>
                      </button>
                    </div>

                  </div>
                )}

              </div>
            </div>

          </div>
        )}

        {/* ========================================================= */}
        {/* VIEW 2: CASHIER POS TERMINAL */}
        {/* ========================================================= */}
        {appMode === "cashier" && (
          <div className="mt-6 space-y-6">
            
            {/* Cashier Status Bar */}
            <div className="rounded-3xl border-2 border-[#232331] bg-white p-5 shadow-ink-md flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <div className="flex items-center gap-2">
                  <span className="h-2.5 w-2.5 rounded-full bg-[#16a34a] animate-pulse" />
                  <h3 className="font-extrabold text-base text-[#232331]">
                    Kasir Web Terminal: {currentBrand.name}
                  </h3>
                </div>
                <p className="text-xs text-[#7b7b8e] mt-0.5">
                  Menerima pesanan langsung dari QR meja tamu secara realtime.
                </p>
              </div>

              <div className="flex items-center gap-2 font-mono text-xs">
                <div className="rounded-xl bg-[#dcfce7] border border-[#16a34a] px-3 py-1.5 text-[#16a34a] font-bold">
                  ● Bluetooth Printer: Siap Cetak
                </div>
                <button
                  type="button"
                  onClick={() => setAppMode("receipt")}
                  className="btn-tactile rounded-xl bg-[#232331] px-3 py-1.5 font-bold text-[#d9ff57]"
                >
                  Lihat Struk Thermal
                </button>
              </div>
            </div>

            {/* Orders Table */}
            <div className="rounded-3xl border-2 border-[#232331] bg-white p-5 shadow-ink-md overflow-x-auto">
              <div className="flex items-center justify-between border-b border-[#dedee8] pb-3 mb-4">
                <h4 className="font-extrabold text-sm text-[#232331]">
                  Daftar Pesanan Meja Masuk (Realtime Feed)
                </h4>
                <span className="font-mono text-xs text-[#7b7b8e]">
                  Auto-refresh setiap detik
                </span>
              </div>

              <table className="w-full text-left font-mono text-xs">
                <thead>
                  <tr className="border-b border-[#dedee8] text-[#7b7b8e] text-[10px] uppercase">
                    <th className="py-2.5 px-3">No Order</th>
                    <th className="py-2.5 px-3">Meja / Tipe</th>
                    <th className="py-2.5 px-3">Menu Dipesan</th>
                    <th className="py-2.5 px-3">Total Nominal</th>
                    <th className="py-2.5 px-3">Metode</th>
                    <th className="py-2.5 px-3">Status</th>
                    <th className="py-2.5 px-3 text-right">Aksi Staf</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#dedee8]">
                  {activeOrders.map((ord) => (
                    <tr key={ord.id} className="hover:bg-[#fcfcfe]">
                      <td className="py-3 px-3 font-extrabold text-[#232331]">
                        {ord.id}
                      </td>
                      <td className="py-3 px-3">
                        <span className="font-bold text-[#7958d8]">Meja {ord.table}</span>
                        <span className="block text-[10px] text-[#7b7b8e]">{ord.type}</span>
                      </td>
                      <td className="py-3 px-3 font-sans text-xs text-[#232331] max-w-xs truncate">
                        {ord.items}
                      </td>
                      <td className="py-3 px-3 font-extrabold text-[#232331]">
                        Rp {ord.total.toLocaleString("id-ID")}
                      </td>
                      <td className="py-3 px-3">
                        <span className="rounded bg-[#f0edff] px-2 py-0.5 font-bold text-[#7958d8] text-[10px]">
                          {ord.payment}
                        </span>
                      </td>
                      <td className="py-3 px-3">
                        <span className={`rounded px-2 py-0.5 font-bold text-[10px] ${
                          ord.status === "Baru"
                            ? "bg-[#feebee] text-[#ef4444] animate-pulse"
                            : ord.status === "Dimasak"
                            ? "bg-[#ffedd5] text-[#c2410c]"
                            : "bg-[#dcfce7] text-[#16a34a]"
                        }`}>
                          {ord.status}
                        </span>
                      </td>
                      <td className="py-3 px-3 text-right">
                        <button
                          type="button"
                          onClick={() => setAppMode("receipt")}
                          className="btn-tactile inline-flex items-center gap-1 rounded-lg bg-[#232331] px-2.5 py-1 text-[10px] font-bold text-white"
                        >
                          <Printer size={10} />
                          <span>Cetak Struk</span>
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

          </div>
        )}

        {/* ========================================================= */}
        {/* VIEW 3: THERMAL BLUETOOTH RECEIPT SIMULATOR */}
        {/* ========================================================= */}
        {appMode === "receipt" && (
          <div className="mt-6 flex flex-col items-center justify-center">
            
            <div className="text-center mb-4">
              <span className="font-mono text-xs font-bold text-[#7958d8] uppercase">
                HASIL CETAK BLUETOOTH THERMAL PRINTER
              </span>
              <p className="text-xs text-[#7b7b8e] mt-0.5">
                Struk 58mm resmi dengan header tokomu &amp; footer ulasan Maps / Loyalty.
              </p>
            </div>

            {/* Thermal Struk Container */}
            <div className="relative w-full max-w-xs rounded-2xl border-2 border-[#232331] bg-white p-5 text-[#232331] shadow-ink-xl font-mono text-xs">
              
              {/* Receipt Header */}
              <div className="text-center border-b border-dashed border-[#232331] pb-3 space-y-1">
                <span className="text-base font-extrabold tracking-wider block">
                  {currentBrand.name.toUpperCase()}
                </span>
                <p className="text-[10px] text-[#7b7b8e]">{currentBrand.address}</p>
                <p className="text-[10px] text-[#7b7b8e]">Telp: 0813-1150-6025</p>
                <div className="flex justify-between text-[10px] text-[#7b7b8e] pt-1">
                  <span>Meja: 08</span>
                  <span>Kasir: POS-01</span>
                </div>
                <div className="flex justify-between text-[10px] text-[#7b7b8e]">
                  <span>25/08/2026 14:22</span>
                  <span>#ORD-9821</span>
                </div>
              </div>

              {/* Items List */}
              <div className="py-3 border-b border-dashed border-[#232331] space-y-2 text-[11px]">
                <div className="flex justify-between font-bold">
                  <span>2x Iced Spanish Latte</span>
                  <span>56.000</span>
                </div>
                <div className="flex justify-between font-bold">
                  <span>1x Butter Croissant</span>
                  <span>24.000</span>
                </div>
              </div>

              {/* Totals */}
              <div className="py-3 border-b border-dashed border-[#232331] space-y-1 text-xs">
                <div className="flex justify-between text-[#7b7b8e]">
                  <span>Subtotal</span>
                  <span>80.000</span>
                </div>
                <div className="flex justify-between text-[#7b7b8e]">
                  <span>PB1 Resto (10%)</span>
                  <span>8.000</span>
                </div>
                <div className="flex justify-between font-extrabold text-sm text-[#232331] pt-1">
                  <span>TOTAL AKHIR</span>
                  <span>Rp 88.000</span>
                </div>
                <div className="flex justify-between text-[10px] text-[#16a34a] font-bold">
                  <span>METODE: QRIS (LUNAS)</span>
                  <span>REF# 9812983</span>
                </div>
              </div>

              {/* Receipt Footer with Google Review CTA */}
              <div className="pt-4 text-center space-y-1.5 text-[10px]">
                <div className="rounded border border-[#232331] bg-[#d9ff57] px-2 py-0.5 font-bold text-[#232331] inline-block">
                  ★ TAP KARTU NFC DI KASIR UNTUK REVIEW ★
                </div>
                <p className="text-[#7b7b8e] text-[9.5px]">
                  Terima kasih atas kunjungan Anda di {currentBrand.name}!
                </p>
                {showWhiteLabelBadge && (
                  <p className="text-[8px] text-[#7b7b8e] pt-1 font-mono">
                    POWERED BY KAEL POS SYSTEM
                  </p>
                )}
              </div>

              {/* Action: Print Button */}
              <div className="mt-5 pt-3 border-t border-[#dedee8]">
                <button
                  type="button"
                  onClick={() => alert("Simulasi cetak struk ke printer Bluetooth 58mm berhasil dikirim!")}
                  className="btn-tactile flex w-full items-center justify-center gap-1.5 rounded-xl bg-[#232331] py-2.5 text-xs font-bold text-[#d9ff57] shadow-ink-xs"
                >
                  <Printer size={13} />
                  <span>Kirim ke Printer Bluetooth</span>
                </button>
              </div>

            </div>

          </div>
        )}

      </main>

      {/* QRIS PAYMENT MODAL */}
      {isQrisModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fadeIn">
          <div className="w-full max-w-sm rounded-3xl border-2 border-[#232331] bg-white p-5 text-center text-[#232331] shadow-ink-xl">
            <h3 className="font-extrabold text-base text-[#232331]">
              Scan QRIS untuk Bayar di Meja {selectedTable}
            </h3>
            <p className="text-xs text-[#7b7b8e] mt-0.5">
              Bisa dari BCA, GoPay, OVO, ShopeePay &amp; DANA
            </p>

            <div className="mt-4 mx-auto w-48 h-48 rounded-2xl border-2 border-[#232331] bg-[#fcfcfe] p-3 flex flex-col items-center justify-center shadow-ink-xs">
              <QrCode size={130} className="text-[#232331]" />
              <span className="font-mono text-[9.5px] font-bold text-[#7958d8] mt-1">
                NMID: ID10293847291
              </span>
            </div>

            <div className="mt-3 font-mono text-sm font-extrabold text-[#232331]">
              Total: Rp {grandTotal.toLocaleString("id-ID")}
            </div>

            <button
              type="button"
              onClick={handleSimulatePayment}
              className="btn-tactile mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-[#16a34a] py-3 text-xs font-extrabold text-white shadow-ink-xs"
            >
              <Check size={14} strokeWidth={3} />
              <span>Simulasikan Pembayaran Berhasil</span>
            </button>
          </div>
        </div>
      )}

      {/* Footer */}
      {showWhiteLabelBadge && (
        <footer className="border-t border-[#dedee8] py-4 text-center text-xs text-[#7b7b8e] bg-white">
          <p>⚡ Powered by <strong>KAEL POS &amp; Ordering</strong> · Live Demo Environment</p>
        </footer>
      )}
    </div>
  );
}
