"use client";

import { useState } from "react";
import Link from "next/link";
import { 
  AlertCircle, 
  ArrowLeft, 
  ArrowRight, 
  Award, 
  Check, 
  CheckCircle2, 
  ChevronRight, 
  Clock, 
  Coffee, 
  Coins, 
  CreditCard, 
  Crown, 
  DollarSign, 
  ExternalLink, 
  Eye, 
  Flame, 
  Heart, 
  HeartHandshake, 
  HelpCircle, 
  Laptop, 
  LayoutDashboard, 
  LayoutGrid, 
  MapPin, 
  MessageCircle, 
  Minus, 
  Nfc, 
  Palette, 
  Percent, 
  PieChart, 
  Plus, 
  Printer, 
  QrCode, 
  Receipt, 
  RefreshCw, 
  Search, 
  Send, 
  Settings, 
  ShoppingBag, 
  Smartphone, 
  Sparkles, 
  SplitSquareVertical, 
  Star, 
  Table, 
  Tablet, 
  ThumbsUp, 
  Trash2, 
  TrendingUp, 
  User, 
  UserCheck, 
  Utensils, 
  Zap 
} from "lucide-react";
import { DemoNavbar } from "@/components/demo-navbar";
import { DEMO_BRANDS, DemoBrand } from "@/lib/demo-config";

export default function DualPerspectiveExperiencePage() {
  const [currentBrand, setCurrentBrand] = useState<DemoBrand>(DEMO_BRANDS[0]);
  const [showWhiteLabelBadge, setShowWhiteLabelBadge] = useState<boolean>(true);

  // View Layout Mode: "split" (Berdampingan) vs "customer-only" vs "umkm-only"
  const [layoutMode, setLayoutMode] = useState<"split" | "customer-only" | "umkm-only">("split");

  // Customer Screen State
  const [customerScreen, setCustomerScreen] = useState<"review" | "order" | "loyalty" | "wa">("order");
  const [selectedTable, setSelectedTable] = useState<string>("05");
  const [rating, setRating] = useState<number>(5);
  const [customerPoints, setCustomerPoints] = useState<number>(1850);
  const [customerStamps, setCustomerStamps] = useState<number>(7);
  const [customerOrders, setCustomerOrders] = useState([
    { name: "Iced Spanish Latte", qty: 2, price: 28000 },
    { name: "Butter Croissant", qty: 1, price: 24000 },
  ]);
  const [isOrderSentToPos, setIsOrderSentToPos] = useState<boolean>(false);

  // UMKM Screen State
  const [umkmScreen, setUmkmScreen] = useState<"pos" | "dashboard" | "crm">("pos");
  const [posIncomingOrders, setPosIncomingOrders] = useState([
    { id: "ORD-9821", table: "05", items: "2x Spanish Latte, 1x Croissant", total: 88000, status: "Baru", time: "14:32" },
    { id: "ORD-9820", table: "02", items: "1x Beef Burger, 1x Ice Tea", total: 58000, status: "Dimasak", time: "14:25" },
    { id: "ORD-9819", table: "08", items: "2x Americano", total: 44000, status: "Selesai", time: "14:15" },
  ]);
  const [liveToast, setLiveToast] = useState<string | null>(null);

  // Trigger Toast Notification
  const triggerToast = (msg: string) => {
    setLiveToast(msg);
    setTimeout(() => setLiveToast(null), 4000);
  };

  // SYNC ACTION 1: Customer sends order from Table QR ➔ Appears on UMKM POS
  const handleCustomerCheckout = () => {
    const total = customerOrders.reduce((a, b) => a + b.price * b.qty, 0) + 8000;
    const newOrd = {
      id: `ORD-${Math.floor(1000 + Math.random() * 9000)}`,
      table: selectedTable,
      items: customerOrders.map(c => `${c.qty}x ${c.name}`).join(", "),
      total: total,
      status: "Baru",
      time: "Baru Saja",
    };
    setPosIncomingOrders([newOrd, ...posIncomingOrders]);
    setIsOrderSentToPos(true);
    triggerToast(`🔔 BEEP! Pesanan baru masuk dari Meja ${selectedTable} ke Tablet Kasir!`);
  };

  // SYNC ACTION 2: Customer taps 5-Star NFC ➔ Dashboard counter updates
  const handleCustomerReview = (stars: number) => {
    setRating(stars);
    triggerToast(`⭐ Tamu baru saja memberikan rating bintang ${stars} via Kartu NFC!`);
  };

  // SYNC ACTION 3: UMKM Cashier sends points ➔ Customer phone updates
  const handleUmkmSendPoints = () => {
    setCustomerPoints(prev => prev + 100);
    setCustomerStamps(prev => Math.min(10, prev + 1));
    triggerToast(`📲 +100 Poin & +1 Stempel terkirim ke WhatsApp HP Tamu!`);
  };

  return (
    <div className="min-h-screen bg-[#f7f6fc] text-[#232331] flex flex-col font-sans">
      <DemoNavbar
        currentBrand={currentBrand}
        onBrandChange={setCurrentBrand}
        showWhiteLabelBadge={showWhiteLabelBadge}
        onToggleWhiteLabelBadge={setShowWhiteLabelBadge}
      />

      {/* Floating Live Sync Toast */}
      {liveToast && (
        <div className="fixed bottom-6 right-6 z-50 rounded-2xl border-2 border-[#232331] bg-[#d9ff57] p-4 text-[#232331] font-mono text-xs font-extrabold shadow-ink-xl flex items-center gap-2 animate-fadeIn">
          <Sparkles size={16} />
          <span>{liveToast}</span>
        </div>
      )}

      {/* Top Experience Sub-Bar */}
      <div className="bg-white border-b-2 border-[#232331] px-4 py-3">
        <div className="max-w-[1600px] mx-auto flex flex-col md:flex-row md:items-center justify-between gap-3">
          
          <div>
            <div className="flex items-center gap-2">
              <span className="rounded-md bg-[#7958d8] text-white px-2 py-0.5 font-mono text-[10px] font-bold">
                DUAL-SCREEN SYNC
              </span>
              <h1 className="text-sm sm:text-base font-extrabold text-[#232331]">
                Simulasi Interaktif: Sisi Customer vs Sisi Pemilik UMKM
              </h1>
            </div>
            <p className="text-[11px] text-[#7b7b8e] mt-0.5">
              Coba lakukan aksi di HP Customer (kiri), lihat bagaimana sistem di Tablet Kasir UMKM (kanan) merespons secara instan realtime!
            </p>
          </div>

          {/* Layout Mode Toggles */}
          <div className="flex items-center rounded-xl border border-[#232331] bg-[#fcfcfe] p-1 font-mono text-xs">
            <button
              type="button"
              onClick={() => setLayoutMode("split")}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-bold transition-all ${
                layoutMode === "split" ? "bg-[#232331] text-[#d9ff57] shadow-ink-xs" : "text-[#7b7b8e]"
              }`}
            >
              <SplitSquareVertical size={13} />
              <span className="hidden sm:inline">Layar Berdampingan</span>
              <span className="sm:hidden">Split</span>
            </button>
            <button
              type="button"
              onClick={() => setLayoutMode("customer-only")}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-bold transition-all ${
                layoutMode === "customer-only" ? "bg-[#232331] text-[#d9ff57] shadow-ink-xs" : "text-[#7b7b8e]"
              }`}
            >
              <Smartphone size={13} />
              <span>Hanya HP Tamu</span>
            </button>
            <button
              type="button"
              onClick={() => setLayoutMode("umkm-only")}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-bold transition-all ${
                layoutMode === "umkm-only" ? "bg-[#232331] text-[#d9ff57] shadow-ink-xs" : "text-[#7b7b8e]"
              }`}
            >
              <Tablet size={13} />
              <span>Hanya Tablet UMKM</span>
            </button>
          </div>

        </div>
      </div>

      {/* ========================================================= */}
      {/* MAIN VIEWPORT: DUAL DEVICES CONTAINER */}
      {/* ========================================================= */}
      <main className="flex-1 max-w-[1600px] w-full mx-auto p-3 sm:p-6 lg:p-8">
        
        <div className={`grid gap-8 items-start ${
          layoutMode === "split" 
            ? "lg:grid-cols-12" 
            : layoutMode === "customer-only" 
            ? "max-w-md mx-auto" 
            : "w-full"
        }`}>
          
          {/* ========================================================= */}
          {/* LEFT: 📱 SISI CUSTOMER / PELANGGAN (HP TAMU) */}
          {/* ========================================================= */}
          {(layoutMode === "split" || layoutMode === "customer-only") && (
            <div className={layoutMode === "split" ? "lg:col-span-5 flex flex-col items-center" : "w-full flex flex-col items-center"}>
              
              {/* Header Label */}
              <div className="w-full flex items-center justify-between mb-3 px-2">
                <div className="flex items-center gap-2">
                  <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#f0edff] text-[#7958d8] border border-[#232331]">
                    <Smartphone size={15} />
                  </span>
                  <div>
                    <h2 className="font-extrabold text-sm text-[#232331]">
                      1. Layar HP Customer
                    </h2>
                    <span className="text-[10px] text-[#7b7b8e] font-mono block">
                      (Dipegang Tamu / Pelanggan)
                    </span>
                  </div>
                </div>

                <span className="font-mono text-[9px] font-bold text-[#16a34a] bg-[#dcfce7] px-2 py-0.5 rounded border border-[#16a34a]">
                  Scan QR / Tap NFC
                </span>
              </div>

              {/* Customer Screen Switcher Tabs */}
              <div className="w-full max-w-sm flex rounded-xl border border-[#dedee8] bg-white p-1 font-mono text-[11px] mb-3 text-center shadow-ink-xs">
                <button
                  type="button"
                  onClick={() => setCustomerScreen("order")}
                  className={`flex-1 py-1 rounded-lg font-bold ${
                    customerScreen === "order" ? "bg-[#232331] text-[#d9ff57]" : "text-[#7b7b8e]"
                  }`}
                >
                  🍽️ Menu QR
                </button>
                <button
                  type="button"
                  onClick={() => setCustomerScreen("loyalty")}
                  className={`flex-1 py-1 rounded-lg font-bold ${
                    customerScreen === "loyalty" ? "bg-[#232331] text-[#d9ff57]" : "text-[#7b7b8e]"
                  }`}
                >
                  💳 Member
                </button>
                <button
                  type="button"
                  onClick={() => setCustomerScreen("review")}
                  className={`flex-1 py-1 rounded-lg font-bold ${
                    customerScreen === "review" ? "bg-[#232331] text-[#d9ff57]" : "text-[#7b7b8e]"
                  }`}
                >
                  ⭐ Review
                </button>
                <button
                  type="button"
                  onClick={() => setCustomerScreen("wa")}
                  className={`flex-1 py-1 rounded-lg font-bold ${
                    customerScreen === "wa" ? "bg-[#232331] text-[#d9ff57]" : "text-[#7b7b8e]"
                  }`}
                >
                  💬 Chat WA
                </button>
              </div>

              {/* Physical Smartphone Mockup */}
              <div className="w-full max-w-sm rounded-[38px] border-[3px] border-[#232331] bg-white p-3 shadow-ink-xl">
                
                {/* Phone Speaker & Notch */}
                <div className="flex items-center justify-between px-3 py-1 text-[10.5px] font-mono text-[#7b7b8e] border-b border-gray-100">
                  <span>09:41</span>
                  <div className="h-3.5 w-16 rounded-full bg-[#232331]" />
                  <div className="flex items-center gap-1">
                    <span className="h-2 w-2 rounded-full bg-[#16a34a]" />
                    <span>4G</span>
                  </div>
                </div>

                {/* Inner Screen Viewport */}
                <div className="mt-2 rounded-[28px] bg-[#fcfcfe] p-4 border border-[#dedee8] min-h-[500px] flex flex-col justify-between text-[#232331]">
                  
                  {/* STORE HEADER IN CUSTOMER APP */}
                  <div>
                    <div className="flex items-center justify-between border-b border-[#dedee8] pb-3">
                      <div className="flex items-center gap-2">
                        <span 
                          className="flex h-8 w-8 items-center justify-center rounded-xl text-white font-extrabold text-xs shadow-ink-xs"
                          style={{ backgroundColor: currentBrand.themeColor }}
                        >
                          {currentBrand.logoText.slice(0, 2)}
                        </span>
                        <div>
                          <h3 className="font-extrabold text-xs text-[#232331]">{currentBrand.name}</h3>
                          <p className="text-[9.5px] text-[#7b7b8e]">Meja {selectedTable} • {currentBrand.category}</p>
                        </div>
                      </div>
                      <span className="font-mono text-[9px] font-bold text-[#7958d8] bg-[#f0edff] px-2 py-0.5 rounded">
                        Meja {selectedTable}
                      </span>
                    </div>

                    {/* 1. CUSTOMER VIEW: MENU QR & SELF ORDER */}
                    {customerScreen === "order" && (
                      <div className="mt-3 space-y-3">
                        <div className="rounded-xl bg-[#f0edff] p-2.5 text-[11px] text-[#7958d8] font-mono font-bold flex items-center justify-between">
                          <span>Daftar Pesanan Meja {selectedTable}:</span>
                          <span>2 Menu Dipilih</span>
                        </div>

                        <div className="space-y-2 text-xs">
                          {customerOrders.map((ord, idx) => (
                            <div key={idx} className="flex items-center justify-between rounded-xl bg-white border border-[#dedee8] p-2.5 font-mono">
                              <div>
                                <span className="font-bold text-[#232331] block">{ord.name}</span>
                                <span className="text-[10px] text-[#7b7b8e]">{ord.qty}x @Rp {ord.price.toLocaleString("id-ID")}</span>
                              </div>
                              <strong className="text-[#232331]">Rp {(ord.price * ord.qty).toLocaleString("id-ID")}</strong>
                            </div>
                          ))}
                        </div>

                        <div className="rounded-xl bg-white border border-[#dedee8] p-3 font-mono text-xs space-y-1">
                          <div className="flex justify-between text-[#7b7b8e]">
                            <span>Subtotal Menu:</span>
                            <span>Rp 80.000</span>
                          </div>
                          <div className="flex justify-between text-[#7b7b8e]">
                            <span>PB1 Resto (10%):</span>
                            <span>Rp 8.000</span>
                          </div>
                          <div className="flex justify-between font-extrabold text-sm text-[#232331] pt-1 border-t">
                            <span>Total Bayar:</span>
                            <span className="text-[#7958d8]">Rp 88.000</span>
                          </div>
                        </div>

                        {!isOrderSentToPos ? (
                          <button
                            type="button"
                            onClick={handleCustomerCheckout}
                            className="btn-tactile flex w-full items-center justify-center gap-1.5 rounded-xl bg-[#232331] py-3 text-xs font-extrabold text-[#d9ff57] shadow-ink-md"
                          >
                            <QrCode size={14} />
                            <span>Kirim Pesanan &amp; Bayar QRIS (Meja {selectedTable})</span>
                          </button>
                        ) : (
                          <div className="rounded-xl bg-[#dcfce7] border border-[#16a34a] p-3 text-center text-xs font-bold text-[#16a34a] animate-fadeIn">
                            ✓ Pesanan berhasil dikirim ke Kasir &amp; Dapur!
                          </div>
                        )}
                      </div>
                    )}

                    {/* 2. CUSTOMER VIEW: VIP MEMBER & STEMPEL PASSPORT */}
                    {customerScreen === "loyalty" && (
                      <div className="mt-3 space-y-3">
                        <div 
                          className="rounded-2xl border-2 border-[#232331] p-3.5 text-white shadow-ink-xs font-mono"
                          style={{ backgroundColor: currentBrand.themeColor }}
                        >
                          <div className="flex justify-between text-[10px]">
                            <span>VIP MEMBER PASS</span>
                            <Crown size={14} className="text-[#d9ff57]" />
                          </div>
                          <h4 className="font-extrabold text-sm mt-1">Rian Pratama</h4>
                          <div className="mt-2 flex justify-between items-end">
                            <span className="text-[9px] opacity-75">0812-9832-xxxx</span>
                            <span className="text-lg font-extrabold text-[#d9ff57]">{customerPoints} Pts</span>
                          </div>
                        </div>

                        {/* 10-Stamp Visual */}
                        <div className="rounded-xl bg-white border border-[#dedee8] p-3 text-xs font-mono space-y-2">
                          <div className="flex justify-between text-[11px] font-bold">
                            <span>Paspor Kopi ({customerStamps}/10)</span>
                            <span className="text-[#16a34a]">{customerStamps === 10 ? "Gratis 1 Kopi ✓" : "Kurang 3 lagi"}</span>
                          </div>
                          <div className="grid grid-cols-5 gap-1.5 text-center text-[10px]">
                            {Array.from({ length: 10 }).map((_, i) => (
                              <div
                                key={i}
                                className={`h-8 rounded-lg flex items-center justify-center border font-bold ${
                                  i < customerStamps ? "bg-[#d9ff57] border-[#232331] text-[#232331]" : "bg-gray-50 border-gray-200 text-gray-400"
                                }`}
                              >
                                {i < customerStamps ? "☕" : i + 1}
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    )}

                    {/* 3. CUSTOMER VIEW: REVIEW NFC */}
                    {customerScreen === "review" && (
                      <div className="mt-3 text-center space-y-3">
                        <p className="text-xs font-bold text-[#232331]">
                          Beri Bintang Ulasan di Google Maps:
                        </p>
                        <div className="flex justify-center gap-1.5">
                          {[1, 2, 3, 4, 5].map((s) => (
                            <button
                              key={s}
                              type="button"
                              onClick={() => handleCustomerReview(s)}
                              className="text-2xl transition-transform hover:scale-125 focus:outline-none"
                            >
                              {s <= rating ? "⭐" : "☆"}
                            </button>
                          ))}
                        </div>
                        <p className="text-[11px] font-mono text-[#7958d8] font-bold">
                          {rating === 5 ? "⭐⭐⭐⭐⭐ Sangat Memuaskan!" : `${rating} Bintang`}
                        </p>
                        <div className="rounded-xl bg-white border border-[#dedee8] p-3 text-left text-xs">
                          <p className="text-[#7b7b8e] italic">
                            "Tempatnya nyaman banget, kopinya enak, staff ramah! Pasti balik lagi."
                          </p>
                        </div>
                      </div>
                    )}

                    {/* 4. CUSTOMER VIEW: CHAT WA BOT */}
                    {customerScreen === "wa" && (
                      <div className="mt-3 rounded-2xl bg-[#ece5dd] p-3 font-sans text-xs space-y-2">
                        <div className="max-w-[240px] rounded-xl rounded-tl-none bg-white p-2.5 shadow-sm text-[#232331] space-y-1">
                          <span className="font-bold text-[11px] text-[#128c7e] block">{currentBrand.name}</span>
                          <p className="text-[10.5px] leading-tight">
                            Halo Kak Rian! 🎉 Saldo poinmu sekarang: <strong>{customerPoints} Poin</strong> &amp; <strong>{customerStamps}/10 Stempel Kopi</strong>.
                          </p>
                          <span className="text-[8.5px] text-[#7b7b8e] block text-right font-mono">14:32 ✓✓</span>
                        </div>
                      </div>
                    )}

                  </div>

                  {/* Footer inside Phone */}
                  <div className="text-center text-[9px] text-[#7b7b8e] pt-2 border-t border-gray-100 font-mono">
                    {showWhiteLabelBadge ? "Powered by KAEL Operating System" : `© ${currentBrand.name}`}
                  </div>

                </div>

              </div>

            </div>
          )}

          {/* ========================================================= */}
          {/* RIGHT: 💻 / 📱 SISI PEMILIK UMKM & KASIR (TABLET POS) */}
          {/* ========================================================= */}
          {(layoutMode === "split" || layoutMode === "umkm-only") && (
            <div className={layoutMode === "split" ? "lg:col-span-7 flex flex-col" : "w-full flex flex-col"}>
              
              {/* Header Label */}
              <div className="w-full flex items-center justify-between mb-3 px-2">
                <div className="flex items-center gap-2">
                  <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#dcfce7] text-[#16a34a] border border-[#232331]">
                    <Tablet size={15} />
                  </span>
                  <div>
                    <h2 className="font-extrabold text-sm text-[#232331]">
                      2. Layar Tablet POS &amp; Dashboard UMKM
                    </h2>
                    <span className="text-[10px] text-[#7b7b8e] font-mono block">
                      (Dipegang Kasir &amp; Owner Usaha)
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2 font-mono text-[10px]">
                  <span className="text-[#16a34a] font-bold">● Bluetooth Printer Ready</span>
                </div>
              </div>

              {/* UMKM Screen Switcher Tabs */}
              <div className="flex rounded-xl border border-[#dedee8] bg-white p-1 font-mono text-xs mb-3 shadow-ink-xs">
                <button
                  type="button"
                  onClick={() => setUmkmScreen("pos")}
                  className={`flex-1 py-1.5 rounded-lg font-bold ${
                    umkmScreen === "pos" ? "bg-[#232331] text-[#d9ff57]" : "text-[#7b7b8e]"
                  }`}
                >
                  🖨️ Web POS Kasir ({posIncomingOrders.length} Order)
                </button>
                <button
                  type="button"
                  onClick={() => setUmkmScreen("dashboard")}
                  className={`flex-1 py-1.5 rounded-lg font-bold ${
                    umkmScreen === "dashboard" ? "bg-[#232331] text-[#d9ff57]" : "text-[#7b7b8e]"
                  }`}
                >
                  📊 Executive Omzet
                </button>
                <button
                  type="button"
                  onClick={() => setUmkmScreen("crm")}
                  className={`flex-1 py-1.5 rounded-lg font-bold ${
                    umkmScreen === "crm" ? "bg-[#232331] text-[#d9ff57]" : "text-[#7b7b8e]"
                  }`}
                >
                  📲 Terminal Approval WA
                </button>
              </div>

              {/* Tablet POS Frame Container */}
              <div className="rounded-3xl border-2 border-[#232331] bg-white p-5 sm:p-6 shadow-ink-xl min-h-[500px]">
                
                {/* UMKM VIEW 1: WEB POS KASIR */}
                {umkmScreen === "pos" && (
                  <div className="space-y-4 font-mono text-xs">
                    <div className="flex items-center justify-between border-b border-[#dedee8] pb-3">
                      <div>
                        <h3 className="font-extrabold text-sm text-[#232331] font-sans">
                          Antrean Pesanan Masuk dari Meja (Live Feed)
                        </h3>
                        <p className="text-[11px] text-[#7b7b8e]">
                          Pesanan yang dibuat customer di HP sebelah kiri otomatis muncul di sini!
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => alert("Simulasi cetak struk bluetooth 58mm berhasil!")}
                        className="btn-tactile rounded-xl bg-[#232331] px-3 py-1.5 font-bold text-[#d9ff57]"
                      >
                        <Printer size={12} className="inline mr-1" />
                        <span>Cetak Struk</span>
                      </button>
                    </div>

                    <div className="overflow-x-auto">
                      <table className="w-full text-left font-mono text-xs">
                        <thead>
                          <tr className="border-b border-[#dedee8] text-[#7b7b8e] text-[9.5px] uppercase">
                            <th className="py-2 px-2">Order ID</th>
                            <th className="py-2 px-2">Meja</th>
                            <th className="py-2 px-2">Menu Dipesan</th>
                            <th className="py-2 px-2">Total</th>
                            <th className="py-2 px-2">Status</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-[#dedee8]">
                          {posIncomingOrders.map((ord) => (
                            <tr key={ord.id} className="hover:bg-[#fcfcfe]">
                              <td className="py-2.5 px-2 font-extrabold text-[#232331]">{ord.id}</td>
                              <td className="py-2.5 px-2 font-bold text-[#7958d8]">Meja {ord.table}</td>
                              <td className="py-2.5 px-2 font-sans text-xs text-[#232331] truncate max-w-[180px]">{ord.items}</td>
                              <td className="py-2.5 px-2 font-extrabold text-[#232331]">Rp {ord.total.toLocaleString("id-ID")}</td>
                              <td className="py-2.5 px-2">
                                <span className={`rounded px-2 py-0.5 font-bold text-[9.5px] ${
                                  ord.status === "Baru" ? "bg-[#feebee] text-[#ef4444] animate-pulse" : "bg-[#dcfce7] text-[#16a34a]"
                                }`}>
                                  {ord.status}
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {/* UMKM VIEW 2: EXECUTIVE DASHBOARD */}
                {umkmScreen === "dashboard" && (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between border-b border-[#dedee8] pb-3">
                      <h3 className="font-extrabold text-sm text-[#232331]">
                        Laporan Penjualan Hari Ini: {currentBrand.name}
                      </h3>
                      <span className="font-mono text-xs text-[#16a34a] font-bold">
                        ● Toko Ramai
                      </span>
                    </div>

                    <div className="grid grid-cols-3 gap-3 font-mono">
                      <div className="rounded-2xl border border-[#232331] bg-[#f0edff] p-3 text-center">
                        <span className="text-[9.5px] text-[#7b7b8e] block uppercase">OMZET HARI INI</span>
                        <strong className="text-base sm:text-lg text-[#232331] mt-0.5 block">Rp 3.420.000</strong>
                      </div>
                      <div className="rounded-2xl border border-[#232331] bg-[#dcfce7] p-3 text-center">
                        <span className="text-[9.5px] text-[#16a34a] block uppercase font-bold">ULASAN GOOGLE</span>
                        <strong className="text-base sm:text-lg text-[#16a34a] mt-0.5 block">+18 Ulasan (4.9⭐)</strong>
                      </div>
                      <div className="rounded-2xl border border-[#232331] bg-[#ffedd5] p-3 text-center">
                        <span className="text-[9.5px] text-[#c2410c] block uppercase font-bold">MARGIN HPP</span>
                        <strong className="text-base sm:text-lg text-[#c2410c] mt-0.5 block">67.5% (Sehat)</strong>
                      </div>
                    </div>
                  </div>
                )}

                {/* UMKM VIEW 3: CRM & WA DISPATCH */}
                {umkmScreen === "crm" && (
                  <div className="space-y-4 font-mono text-xs">
                    <div className="flex items-center justify-between border-b border-[#dedee8] pb-3">
                      <h3 className="font-extrabold text-sm text-[#232331] font-sans">
                        Terminal Tambah Poin &amp; Notifikasi Member
                      </h3>
                      <span className="text-[10px] text-[#7958d8]">Target: Rian Pratama (0812-9832-xxxx)</span>
                    </div>

                    <div className="rounded-2xl bg-[#f0edff] border border-[#7958d8]/30 p-4 space-y-2">
                      <p className="font-sans text-xs text-[#232331]">
                        Klik tombol di bawah untuk mengirim <strong>+100 Poin</strong> ke HP Customer sebelah kiri secara real-time!
                      </p>

                      <button
                        type="button"
                        onClick={handleUmkmSendPoints}
                        className="btn-tactile flex items-center gap-2 rounded-xl bg-[#16a34a] px-4 py-2.5 text-xs font-extrabold text-white shadow-ink-xs"
                      >
                        <Send size={13} />
                        <span>Kirim +100 Poin &amp; Notif WA ke HP Tamu</span>
                      </button>
                    </div>
                  </div>
                )}

              </div>

            </div>
          )}

        </div>

      </main>

      {/* Footer */}
      {showWhiteLabelBadge && (
        <footer className="border-t border-[#dedee8] py-4 text-center text-xs text-[#7b7b8e] bg-white">
          <p>⚡ Powered by <strong>KAEL Dual-Perspective Engine</strong> · Real-Time Interactive Experience</p>
        </footer>
      )}
    </div>
  );
}
