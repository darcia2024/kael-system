"use client";

import { useState } from "react";
import Link from "next/link";
import { 
  AlertCircle, 
  ArrowDownRight, 
  ArrowLeft, 
  ArrowRight, 
  ArrowUpRight, 
  Award, 
  BarChart3, 
  Bell, 
  Calculator, 
  Calendar, 
  Check, 
  CheckCircle2, 
  ChevronDown, 
  ChevronRight, 
  Clock, 
  Coffee, 
  Coins, 
  Copy, 
  CreditCard, 
  Crown, 
  DollarSign, 
  Download, 
  ExternalLink, 
  Eye, 
  Filter, 
  Flame, 
  HeartHandshake, 
  HelpCircle, 
  History, 
  LayoutDashboard, 
  Layers, 
  MapPin, 
  Menu, 
  MessageCircle, 
  MessageSquare, 
  Minus, 
  MoreVertical, 
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
  Share2, 
  ShieldCheck, 
  ShoppingBag, 
  Smartphone, 
  Sparkles, 
  Star, 
  Table, 
  Tag, 
  TrendingDown, 
  TrendingUp, 
  User, 
  UserCheck, 
  UserPlus, 
  Users, 
  Utensils, 
  Wallet, 
  X, 
  Zap 
} from "lucide-react";
import { DEMO_BRANDS, DemoBrand } from "@/lib/demo-config";

export default function UnifiedDashboardPage() {
  // Store & White Label State
  const [currentBrand, setCurrentBrand] = useState<DemoBrand>(DEMO_BRANDS[0]);
  const [showWhiteLabelBadge, setShowWhiteLabelBadge] = useState<boolean>(true);
  const [activeModule, setActiveModule] = useState<"overview" | "review" | "pos" | "finance" | "loyalty" | "settings">("overview");
  const [sidebarOpen, setSidebarOpen] = useState<boolean>(false);
  const [dateRange, setDateRange] = useState<"today" | "week" | "month">("today");

  // Live Metric States
  const [dailyRevenue, setDailyRevenue] = useState<number>(3420000); // Rp 3.420.000
  const [totalOrders, setTotalOrders] = useState<number>(54);
  const [newReviews, setNewReviews] = useState<number>(18);
  const [activeMembers, setActiveMembers] = useState<number>(412);
  const [avgFoodCost, setAvgFoodCost] = useState<number>(32.5); // 32.5% HPP (Margin 67.5%)

  // POS Orders Feed
  const [orders, setOrders] = useState([
    { id: "ORD-9825", table: "08", type: "Dine-In", items: "2x Spanish Latte, 1x Croissant", total: 80000, status: "Dimasak", time: "14:28", payment: "QRIS" },
    { id: "ORD-9824", table: "02", type: "Dine-In", items: "1x Beef Burger, 1x Ice Tea", total: 58000, status: "Baru", time: "14:25", payment: "Tunai" },
    { id: "ORD-9823", table: "Takeaway", type: "Takeaway", items: "3x Matcha Oat Latte", total: 90000, status: "Selesai", time: "14:10", payment: "QRIS" },
    { id: "ORD-9822", table: "11", type: "Dine-In", items: "2x Americano, 2x Truffle Fries", total: 96000, status: "Selesai", time: "13:50", payment: "QRIS" },
  ]);

  // Review List
  const [reviews, setReviews] = useState([
    { id: "rev-1", author: "Budi Santoso", stars: 5, time: "15 menit lalu", source: "Tap NFC Meja 04", comment: "Kopi latte-nya juara banget, tempat nyaman buat WFC. Staff ramah!", replied: true },
    { id: "rev-2", author: "Amanda Putri", stars: 5, time: "1 jam lalu", source: "Tap NFC Kasir", comment: "Croissant renyah, wangi butter. Pelayanan gercep!", replied: false },
    { id: "rev-3", author: "Dimas Anggara", stars: 4, time: "3 jam lalu", source: "Scan QR Meja", comment: "Makanannya enak, cuma pas jam makan siang agak ramai.", replied: false },
  ]);

  // Loyalty Members Stream
  const [members, setMembers] = useState([
    { id: "M-01", name: "Rian Pratama", phone: "0812-9832-7812", tier: "Gold Member", points: 1850, stamps: 7, lastVisit: "Hari ini" },
    { id: "M-02", name: "Siti Rahmawati", phone: "0857-1122-3344", tier: "Silver Member", points: 820, stamps: 4, lastVisit: "Kemarin" },
    { id: "M-03", name: "Kevin Sanjaya", phone: "0813-9988-7766", tier: "Platinum VIP", points: 3450, stamps: 10, lastVisit: "2 hari lalu" },
    { id: "M-04", name: "Nadia Utami", phone: "0821-4455-6677", tier: "Bronze Member", points: 250, stamps: 2, lastVisit: "25 Agu" },
  ]);

  // Quick Action Handlers
  const handleQuickAddOrder = () => {
    const newOrd = {
      id: `ORD-${Math.floor(1000 + Math.random() * 9000)}`,
      table: String(Math.floor(1 + Math.random() * currentBrand.tableCount)).padStart(2, "0"),
      type: "Dine-In",
      items: "1x Iced Spanish Latte, 1x Croissant",
      total: 52000,
      status: "Baru",
      time: "Baru Saja",
      payment: "QRIS",
    };
    setOrders([newOrd, ...orders]);
    setDailyRevenue((prev) => prev + 52000);
    setTotalOrders((prev) => prev + 1);
    alert(`Order baru ${newOrd.id} dari Meja ${newOrd.table} berhasil masuk ke Kasir & Dapur!`);
  };

  const handleQuickAddReview = () => {
    const newRev = {
      id: `rev-${Date.now()}`,
      author: "Pelanggan Baru (NFC)",
      stars: 5,
      time: "Baru saja",
      source: "Tap NFC Standee",
      comment: "Luar biasa! Tap kartu NFC langsung bintang 5 di Google Maps ⭐⭐⭐⭐⭐",
      replied: false,
    };
    setReviews([newRev, ...reviews]);
    setNewReviews((prev) => prev + 1);
    alert("Simulasi Tap NFC Ulasan Pelanggan berhasil diterima!");
  };

  const navModules = [
    { id: "overview", label: "Executive Overview", icon: LayoutDashboard, badge: "Live" },
    { id: "review", label: "1. KAEL Review", icon: Nfc, badge: `${newReviews} Baru` },
    { id: "pos", label: "2. POS & Ordering", icon: Printer, badge: `${orders.length} Order` },
    { id: "finance", label: "3. KAEL Finance", icon: Calculator, badge: `${avgFoodCost}% HPP` },
    { id: "loyalty", label: "4. KAEL Loyalty", icon: HeartHandshake, badge: `${activeMembers} Member` },
    { id: "settings", label: "Settings & Brand", icon: Settings, badge: "" },
  ];

  return (
    <div className="min-h-screen bg-[#f7f6fc] text-[#232331] flex flex-col font-sans">
      
      {/* ========================================================= */}
      {/* TOP OWNER COMMAND BAR */}
      {/* ========================================================= */}
      <header className="sticky top-0 z-40 border-b-2 border-[#232331] bg-white/95 backdrop-blur-md">
        <div className="mx-auto flex h-14 sm:h-16 items-center justify-between px-3 sm:px-6 gap-2 sm:gap-4 max-w-[1600px]">
          
          {/* Left: Mobile Toggle & Brand Logo */}
          <div className="flex items-center gap-2 sm:gap-3 min-w-0">
            <button
              type="button"
              onClick={() => setSidebarOpen((v) => !v)}
              className="lg:hidden flex h-9 w-9 items-center justify-center rounded-xl border border-[#232331] bg-[#fcfcfe] text-[#232331]"
            >
              {sidebarOpen ? <X size={16} /> : <Menu size={16} />}
            </button>

            <Link
              href="/"
              className="flex items-center gap-2 font-bold text-xs text-[#7b7b8e] hover:text-[#232331] pr-2 border-r border-[#dedee8] hidden sm:flex shrink-0"
              title="Kembali ke Landing Page KAEL"
            >
              <ArrowLeft size={14} />
              <span>Landing</span>
            </Link>

            <div className="flex items-center gap-2 min-w-0">
              <span 
                className="flex h-8 w-8 sm:h-9 sm:w-9 shrink-0 items-center justify-center rounded-xl border border-[#232331] text-white font-extrabold text-xs shadow-ink-xs"
                style={{ backgroundColor: currentBrand.themeColor }}
              >
                {currentBrand.logoText.slice(0, 2)}
              </span>
              <div className="min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="font-extrabold text-xs sm:text-sm text-[#232331] truncate">
                    {currentBrand.name}
                  </span>
                  <span className="inline-flex items-center gap-1 rounded-full bg-[#dcfce7] px-2 py-0.2 font-mono text-[8.5px] font-bold text-[#16a34a] border border-[#16a34a] shrink-0">
                    <span className="h-1.5 w-1.5 rounded-full bg-[#16a34a] animate-pulse" />
                    Toko Buka
                  </span>
                </div>
                <span className="text-[10px] text-[#7b7b8e] block truncate">
                  Owner Command Center · {currentBrand.category}
                </span>
              </div>
            </div>
          </div>

          {/* Right: Quick Action Buttons & Brand Switcher */}
          <div className="flex items-center gap-2 shrink-0 font-mono text-xs">
            
            {/* Quick Demo Trigger: New Order */}
            <button
              type="button"
              onClick={handleQuickAddOrder}
              className="btn-tactile hidden md:inline-flex items-center gap-1.5 rounded-xl border border-[#232331] bg-[#d9ff57] px-3 py-1.5 font-bold text-[#232331] shadow-ink-xs"
            >
              <Plus size={13} strokeWidth={3} />
              <span>Simulasi Order Meja</span>
            </button>

            {/* Quick Demo Trigger: New Review */}
            <button
              type="button"
              onClick={handleQuickAddReview}
              className="btn-tactile hidden xl:inline-flex items-center gap-1.5 rounded-xl border border-[#232331] bg-[#f0edff] px-3 py-1.5 font-bold text-[#7958d8]"
            >
              <Nfc size={13} />
              <span>Simulasi Tap NFC</span>
            </button>

            {/* Switch Brand Dropdown */}
            <select
              value={currentBrand.id}
              onChange={(e) => {
                const b = DEMO_BRANDS.find((brand) => brand.id === e.target.value);
                if (b) setCurrentBrand(b);
              }}
              className="rounded-xl border border-[#232331] bg-white px-2.5 py-1.5 text-xs font-bold text-[#232331] focus:outline-none cursor-pointer"
            >
              {DEMO_BRANDS.map((brand) => (
                <option key={brand.id} value={brand.id}>
                  {brand.name}
                </option>
              ))}
            </select>

            <Link
              href="/demo"
              className="btn-tactile flex items-center gap-1 rounded-xl bg-[#232331] px-3 py-1.5 text-xs font-bold text-white shadow-ink-xs"
              title="Buka Demo Hub"
            >
              <ExternalLink size={12} />
              <span className="hidden sm:inline">Hub</span>
            </Link>
          </div>

        </div>
      </header>

      {/* ========================================================= */}
      {/* MAIN LAYOUT: SIDEBAR + CONTENT AREA */}
      {/* ========================================================= */}
      <div className="flex-1 flex max-w-[1600px] w-full mx-auto">
        
        {/* SIDEBAR NAVIGATION */}
        <aside
          className={`fixed inset-y-0 left-0 z-30 w-64 bg-white border-r-2 border-[#232331] p-4 flex flex-col justify-between transition-transform duration-200 lg:static lg:translate-x-0 ${
            sidebarOpen ? "translate-x-0 top-14" : "-translate-x-full lg:translate-x-0"
          }`}
        >
          <div className="space-y-6">
            
            {/* Nav Title */}
            <div>
              <span className="font-mono text-[9.5px] font-bold text-[#7958d8] uppercase tracking-wider block px-3">
                INTEGRATED MODUL KAEL
              </span>
              <nav className="mt-2 space-y-1">
                {navModules.map((mod) => {
                  const Icon = mod.icon;
                  const isActive = activeModule === mod.id;
                  return (
                    <button
                      key={mod.id}
                      type="button"
                      onClick={() => {
                        setActiveModule(mod.id as any);
                        setSidebarOpen(false);
                      }}
                      className={`btn-tactile flex w-full items-center justify-between rounded-xl px-3 py-2.5 text-xs font-bold transition-all ${
                        isActive
                          ? "bg-[#232331] text-[#d9ff57] shadow-ink-xs"
                          : "text-[#7b7b8e] hover:bg-[#f0edff] hover:text-[#232331]"
                      }`}
                    >
                      <div className="flex items-center gap-2.5">
                        <Icon size={16} strokeWidth={isActive ? 2.5 : 2} />
                        <span>{mod.label}</span>
                      </div>
                      {mod.badge && (
                        <span className={`font-mono text-[9px] font-bold px-1.5 py-0.2 rounded ${
                          isActive
                            ? "bg-[#d9ff57] text-[#232331]"
                            : "bg-[#f0edff] text-[#7958d8]"
                        }`}>
                          {mod.badge}
                        </span>
                      )}
                    </button>
                  );
                })}
              </nav>
            </div>

            {/* Quick Standalone Slugs */}
            <div className="border-t border-[#dedee8] pt-4 px-3">
              <span className="font-mono text-[9.5px] font-bold text-[#7b7b8e] uppercase tracking-wider block">
                Direct Slugs (Aplikasi Mandiri):
              </span>
              <div className="mt-2 space-y-1 text-[11px] font-mono">
                <Link href="/demo/review" className="block text-[#7958d8] hover:underline">
                  ➔ /demo/review
                </Link>
                <Link href="/demo/pos" className="block text-[#7958d8] hover:underline">
                  ➔ /demo/pos
                </Link>
                <Link href="/demo/finance" className="block text-[#7958d8] hover:underline">
                  ➔ /demo/finance
                </Link>
                <Link href="/demo/loyalty" className="block text-[#7958d8] hover:underline">
                  ➔ /demo/loyalty
                </Link>
              </div>
            </div>

          </div>

          {/* Sidebar Footer */}
          <div className="border-t border-[#dedee8] pt-3 px-2 text-[10.5px] text-[#7b7b8e]">
            <div className="flex items-center justify-between font-mono">
              <span>Bluetooth Printer</span>
              <span className="text-[#16a34a] font-bold">Connected ✓</span>
            </div>
            <div className="flex items-center justify-between font-mono mt-1">
              <span>NFC Status</span>
              <span className="text-[#7958d8] font-bold">Locked URL</span>
            </div>
          </div>
        </aside>

        {/* CONTENT VIEWPORT */}
        <main className="flex-1 p-3 sm:p-6 lg:p-8 min-w-0 overflow-y-auto">
          
          {/* ========================================================= */}
          {/* TAB 1: EXECUTIVE OVERVIEW DASHBOARD */}
          {/* ========================================================= */}
          {activeModule === "overview" && (
            <div className="space-y-6">
              
              {/* Header Title & Date Range */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#dedee8] pb-4">
                <div>
                  <h1 className="text-xl sm:text-2xl font-extrabold text-[#232331]">
                    Executive Command Center
                  </h1>
                  <p className="text-xs text-[#7b7b8e] mt-0.5">
                    Satu layar terintegrasi memantau penjualan, antrean kasir, ulasan Google, HPP makanan, dan member loyal tokomu.
                  </p>
                </div>

                {/* Date Filter Pills */}
                <div className="flex items-center rounded-xl border border-[#232331] bg-white p-0.5 font-mono text-xs">
                  <button
                    type="button"
                    onClick={() => setDateRange("today")}
                    className={`px-3 py-1 rounded-lg font-bold ${
                      dateRange === "today" ? "bg-[#232331] text-[#d9ff57]" : "text-[#7b7b8e]"
                    }`}
                  >
                    Hari Ini
                  </button>
                  <button
                    type="button"
                    onClick={() => setDateRange("week")}
                    className={`px-3 py-1 rounded-lg font-bold ${
                      dateRange === "week" ? "bg-[#232331] text-[#d9ff57]" : "text-[#7b7b8e]"
                    }`}
                  >
                    7 Hari
                  </button>
                  <button
                    type="button"
                    onClick={() => setDateRange("month")}
                    className={`px-3 py-1 rounded-lg font-bold ${
                      dateRange === "month" ? "bg-[#232331] text-[#d9ff57]" : "text-[#7b7b8e]"
                    }`}
                  >
                    30 Hari
                  </button>
                </div>
              </div>

              {/* 4 CORE KPI HERO CARDS */}
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                
                {/* KPI 1: Omzet / POS Revenue */}
                <div className="card-tactile rounded-3xl border-2 border-[#232331] bg-white p-5 shadow-ink-md">
                  <div className="flex items-center justify-between border-b border-[#dedee8] pb-3">
                    <span className="font-mono text-[10px] font-bold text-[#16a34a] uppercase tracking-wider">
                      2. POS &amp; ORDERING
                    </span>
                    <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#dcfce7] text-[#16a34a]">
                      <Receipt size={15} />
                    </span>
                  </div>
                  <div className="mt-3">
                    <span className="text-[11px] text-[#7b7b8e] font-mono block">OMZET HARI INI</span>
                    <h3 className="text-xl sm:text-2xl font-extrabold font-mono text-[#232331] mt-0.5">
                      Rp {dailyRevenue.toLocaleString("id-ID")}
                    </h3>
                    <div className="mt-2 flex items-center justify-between text-[11px] font-mono">
                      <span className="text-[#16a34a] font-bold flex items-center gap-0.5">
                        <TrendingUp size={12} /> +18.4% vs Kemarin
                      </span>
                      <span className="text-[#7b7b8e]">{totalOrders} Transaksi</span>
                    </div>
                  </div>
                </div>

                {/* KPI 2: Review NFC Taps */}
                <div className="card-tactile rounded-3xl border-2 border-[#232331] bg-white p-5 shadow-ink-md">
                  <div className="flex items-center justify-between border-b border-[#dedee8] pb-3">
                    <span className="font-mono text-[10px] font-bold text-[#7958d8] uppercase tracking-wider">
                      1. REVIEW NFC
                    </span>
                    <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#f0edff] text-[#7958d8]">
                      <Nfc size={15} />
                    </span>
                  </div>
                  <div className="mt-3">
                    <span className="text-[11px] text-[#7b7b8e] font-mono block">GOOGLE REVIEW ORGANIK</span>
                    <h3 className="text-xl sm:text-2xl font-extrabold font-mono text-[#232331] mt-0.5">
                      +{newReviews} Ulasan Baru
                    </h3>
                    <div className="mt-2 flex items-center justify-between text-[11px] font-mono">
                      <span className="text-[#f59e0b] font-bold">★ 4.9 (340 Total)</span>
                      <span className="text-[#7958d8] font-bold">94% Bintang 5</span>
                    </div>
                  </div>
                </div>

                {/* KPI 3: Finance Food Cost Margin */}
                <div className="card-tactile rounded-3xl border-2 border-[#232331] bg-white p-5 shadow-ink-md">
                  <div className="flex items-center justify-between border-b border-[#dedee8] pb-3">
                    <span className="font-mono text-[10px] font-bold text-[#c2410c] uppercase tracking-wider">
                      3. FINANCE &amp; HPP
                    </span>
                    <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#ffedd5] text-[#c2410c]">
                      <Calculator size={15} />
                    </span>
                  </div>
                  <div className="mt-3">
                    <span className="text-[11px] text-[#7b7b8e] font-mono block">RATA-RATA FOOD COST HPP</span>
                    <h3 className="text-xl sm:text-2xl font-extrabold font-mono text-[#232331] mt-0.5">
                      {avgFoodCost}% <span className="text-xs text-[#16a34a] font-bold">(Margin 67.5%)</span>
                    </h3>
                    <div className="mt-2 flex items-center justify-between text-[11px] font-mono">
                      <span className="text-[#16a34a] font-bold">✓ Kategori Sehat</span>
                      <span className="text-[#7b7b8e]">Laba Kotor +Rp 2.3Jt</span>
                    </div>
                  </div>
                </div>

                {/* KPI 4: Loyalty & Member Retention */}
                <div className="card-tactile rounded-3xl border-2 border-[#232331] bg-white p-5 shadow-ink-md">
                  <div className="flex items-center justify-between border-b border-[#dedee8] pb-3">
                    <span className="font-mono text-[10px] font-bold text-[#d97706] uppercase tracking-wider">
                      4. LOYALTY CRM
                    </span>
                    <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#fef3c7] text-[#d97706]">
                      <HeartHandshake size={15} />
                    </span>
                  </div>
                  <div className="mt-3">
                    <span className="text-[11px] text-[#7b7b8e] font-mono block">TOTAL DATABASE MEMBER</span>
                    <h3 className="text-xl sm:text-2xl font-extrabold font-mono text-[#232331] mt-0.5">
                      {activeMembers} No. WA
                    </h3>
                    <div className="mt-2 flex items-center justify-between text-[11px] font-mono">
                      <span className="text-[#16a34a] font-bold">78% Repeat Order</span>
                      <span className="text-[#d97706] font-bold">14 Reward Klaim</span>
                    </div>
                  </div>
                </div>

              </div>

              {/* 2-COLUMN SECTION: LIVE POS ORDERS + RECENT GOOGLE REVIEWS */}
              <div className="grid gap-6 lg:grid-cols-12 items-start">
                
                {/* Left (7 Cols): Realtime Table Orders & POS */}
                <div className="lg:col-span-7 rounded-3xl border-2 border-[#232331] bg-white p-5 sm:p-6 shadow-ink-md space-y-4">
                  <div className="flex items-center justify-between border-b border-[#dedee8] pb-3">
                    <div className="flex items-center gap-2">
                      <Printer size={16} className="text-[#16a34a]" />
                      <h3 className="font-extrabold text-sm sm:text-base text-[#232331]">
                        Live Feed Pesanan Meja (POS Kasir)
                      </h3>
                    </div>
                    <button
                      type="button"
                      onClick={() => setActiveModule("pos")}
                      className="text-xs font-bold text-[#7958d8] hover:underline font-mono"
                    >
                      Buka Web POS ➔
                    </button>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="w-full text-left font-mono text-xs">
                      <thead>
                        <tr className="border-b border-[#dedee8] text-[#7b7b8e] text-[10px] uppercase">
                          <th className="py-2 px-2">Order ID</th>
                          <th className="py-2 px-2">Lokasi</th>
                          <th className="py-2 px-2">Rincian Menu</th>
                          <th className="py-2 px-2">Total</th>
                          <th className="py-2 px-2">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#dedee8]">
                        {orders.map((ord) => (
                          <tr key={ord.id} className="hover:bg-[#fcfcfe]">
                            <td className="py-3 px-2 font-extrabold text-[#232331]">
                              {ord.id}
                            </td>
                            <td className="py-3 px-2 font-bold text-[#7958d8]">
                              Meja {ord.table}
                            </td>
                            <td className="py-3 px-2 font-sans text-xs text-[#232331] max-w-[180px] truncate">
                              {ord.items}
                            </td>
                            <td className="py-3 px-2 font-extrabold text-[#232331]">
                              Rp {ord.total.toLocaleString("id-ID")}
                            </td>
                            <td className="py-3 px-2">
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
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Right (5 Cols): Live Google Reviews Stream */}
                <div className="lg:col-span-5 rounded-3xl border-2 border-[#232331] bg-white p-5 sm:p-6 shadow-ink-md space-y-4">
                  <div className="flex items-center justify-between border-b border-[#dedee8] pb-3">
                    <div className="flex items-center gap-2">
                      <Nfc size={16} className="text-[#7958d8]" />
                      <h3 className="font-extrabold text-sm sm:text-base text-[#232331]">
                        Ulasan Google Terbaru (NFC)
                      </h3>
                    </div>
                    <button
                      type="button"
                      onClick={() => setActiveModule("review")}
                      className="text-xs font-bold text-[#7958d8] hover:underline font-mono"
                    >
                      Lihat Semua ➔
                    </button>
                  </div>

                  <div className="space-y-3">
                    {reviews.map((rev) => (
                      <div key={rev.id} className="rounded-2xl border border-[#dedee8] bg-[#fcfcfe] p-3.5 space-y-1.5">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-1.5">
                            <span className="font-extrabold text-xs text-[#232331]">{rev.author}</span>
                            <span className="font-mono text-[9px] bg-[#f0edff] text-[#7958d8] px-1.5 rounded font-bold">
                              {rev.source}
                            </span>
                          </div>
                          <div className="flex text-[#f59e0b] text-xs">
                            {"★".repeat(rev.stars)}
                          </div>
                        </div>
                        <p className="text-xs text-[#7b7b8e] leading-relaxed italic">
                          "{rev.comment}"
                        </p>
                        <span className="text-[9.5px] font-mono text-[#7b7b8e] block text-right">
                          {rev.time}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

              </div>

              {/* 2-COLUMN SECTION: MEMBER RETENTION & HPP MARGIN RADAR */}
              <div className="grid gap-6 lg:grid-cols-12 items-start">
                
                {/* Loyalty Member Highlights */}
                <div className="lg:col-span-6 rounded-3xl border-2 border-[#232331] bg-white p-5 sm:p-6 shadow-ink-md space-y-4">
                  <div className="flex items-center justify-between border-b border-[#dedee8] pb-3">
                    <div className="flex items-center gap-2">
                      <HeartHandshake size={16} className="text-[#d97706]" />
                      <h3 className="font-extrabold text-sm sm:text-base text-[#232331]">
                        Member VIP &amp; Paspor Stempel Aktif
                      </h3>
                    </div>
                    <button
                      type="button"
                      onClick={() => setActiveModule("loyalty")}
                      className="text-xs font-bold text-[#7958d8] hover:underline font-mono"
                    >
                      Buka CRM ➔
                    </button>
                  </div>

                  <div className="space-y-2.5">
                    {members.map((m) => (
                      <div key={m.id} className="flex items-center justify-between rounded-xl border border-[#dedee8] p-3 font-mono text-xs">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-[#232331] font-sans">{m.name}</span>
                            <span className="text-[9px] bg-[#f0edff] text-[#7958d8] px-1.5 rounded font-bold">
                              {m.tier}
                            </span>
                          </div>
                          <span className="text-[10px] text-[#7b7b8e] block">{m.phone} • Kunjungan: {m.lastVisit}</span>
                        </div>
                        <div className="text-right">
                          <span className="font-extrabold text-[#232331] block">{m.points} Pts</span>
                          <span className="text-[10px] text-[#16a34a] font-bold">{m.stamps}/10 Stempel</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Finance HPP Margin Radar */}
                <div className="lg:col-span-6 rounded-3xl border-2 border-[#232331] bg-white p-5 sm:p-6 shadow-ink-md space-y-4">
                  <div className="flex items-center justify-between border-b border-[#dedee8] pb-3">
                    <div className="flex items-center gap-2">
                      <Calculator size={16} className="text-[#c2410c]" />
                      <h3 className="font-extrabold text-sm sm:text-base text-[#232331]">
                        Radar Margin &amp; HPP Menu Terlaris
                      </h3>
                    </div>
                    <button
                      type="button"
                      onClick={() => setActiveModule("finance")}
                      className="text-xs font-bold text-[#7958d8] hover:underline font-mono"
                    >
                      Hitung Resep ➔
                    </button>
                  </div>

                  <div className="space-y-3 font-mono text-xs">
                    {[
                      { name: "Iced Spanish Latte", hpp: 8250, price: 28000, margin: 70, status: "Sangat Sehat" },
                      { name: "Artisan Butter Croissant", hpp: 7800, price: 24000, margin: 67, status: "Sangat Sehat" },
                      { name: "Senja Beef Burger", hpp: 19500, price: 48000, margin: 59, status: "Aman" },
                    ].map((item) => (
                      <div key={item.name} className="rounded-xl border border-[#dedee8] bg-[#fcfcfe] p-3 space-y-1.5">
                        <div className="flex justify-between font-bold">
                          <span className="font-sans text-[#232331]">{item.name}</span>
                          <span className="text-[#16a34a]">Margin {item.margin}% ({item.status})</span>
                        </div>
                        <div className="flex justify-between text-[11px] text-[#7b7b8e]">
                          <span>HPP Modal: Rp {item.hpp.toLocaleString("id-ID")}</span>
                          <span>Harga Jual: Rp {item.price.toLocaleString("id-ID")}</span>
                        </div>
                        <div className="h-1.5 w-full rounded-full bg-gray-200 overflow-hidden">
                          <div className="h-full rounded-full bg-[#16a34a]" style={{ width: `${item.margin}%` }} />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

              </div>

            </div>
          )}

          {/* ========================================================= */}
          {/* TAB 2: REVIEW MODULE IN DASHBOARD */}
          {/* ========================================================= */}
          {activeModule === "review" && (
            <div className="space-y-6">
              <div className="flex items-center justify-between border-b border-[#dedee8] pb-4">
                <div>
                  <h2 className="text-xl font-extrabold text-[#232331]">
                    KAEL Review Command Module
                  </h2>
                  <p className="text-xs text-[#7b7b8e]">
                    Manajemen ulasan Google Maps, status kartu NFC meja kasir, dan analitik tap counter.
                  </p>
                </div>
                <Link
                  href="/demo/review"
                  className="btn-tactile rounded-xl bg-[#232331] px-3.5 py-1.5 text-xs font-bold text-[#d9ff57]"
                >
                  Buka Customer View ➔
                </Link>
              </div>

              <div className="grid gap-6 lg:grid-cols-3">
                <div className="rounded-3xl border-2 border-[#232331] bg-white p-5 shadow-ink-md text-center">
                  <span className="font-mono text-[10px] font-bold text-[#7958d8] uppercase">TOTAL TAP NFC BULAN INI</span>
                  <p className="text-3xl font-extrabold font-mono text-[#232331] mt-2">1,248 Tap</p>
                  <p className="text-xs text-[#16a34a] font-bold mt-1">Konversi Ulasan 84%</p>
                </div>
                <div className="rounded-3xl border-2 border-[#232331] bg-white p-5 shadow-ink-md text-center">
                  <span className="font-mono text-[10px] font-bold text-[#7958d8] uppercase">RATING GOOGLE MAPS</span>
                  <p className="text-3xl font-extrabold font-mono text-[#f59e0b] mt-2">★ 4.9 / 5.0</p>
                  <p className="text-xs text-[#7b7b8e] mt-1">Dari 340+ Ulasan Asli</p>
                </div>
                <div className="rounded-3xl border-2 border-[#232331] bg-white p-5 shadow-ink-md text-center">
                  <span className="font-mono text-[10px] font-bold text-[#7958d8] uppercase">STATUS CHIP NFC</span>
                  <p className="text-3xl font-extrabold font-mono text-[#16a34a] mt-2">Locked ✓</p>
                  <p className="text-xs text-[#7b7b8e] mt-1">Direct Link Permanen Aman</p>
                </div>
              </div>
            </div>
          )}

          {/* ========================================================= */}
          {/* TAB 3: POS & ORDERING MODULE IN DASHBOARD */}
          {/* ========================================================= */}
          {activeModule === "pos" && (
            <div className="space-y-6">
              <div className="flex items-center justify-between border-b border-[#dedee8] pb-4">
                <div>
                  <h2 className="text-xl font-extrabold text-[#232331]">
                    KAEL POS &amp; Kitchen Management
                  </h2>
                  <p className="text-xs text-[#7b7b8e]">
                    Penerimaan pesanan meja realtime, cetak thermal bluetooth, dan status meja aktif.
                  </p>
                </div>
                <Link
                  href="/demo/pos"
                  className="btn-tactile rounded-xl bg-[#232331] px-3.5 py-1.5 text-xs font-bold text-[#d9ff57]"
                >
                  Buka Full POS App ➔
                </Link>
              </div>

              {/* Table Grid Status */}
              <div className="rounded-3xl border-2 border-[#232331] bg-white p-5 shadow-ink-md">
                <span className="font-mono text-[10px] font-bold text-[#7958d8] uppercase block mb-3">
                  PETA STATUS MEJA (DINE-IN FLOOR MAP)
                </span>
                <div className="grid grid-cols-3 sm:grid-cols-5 md:grid-cols-6 gap-2.5 font-mono text-xs">
                  {Array.from({ length: currentBrand.tableCount }).map((_, i) => {
                    const num = String(i + 1).padStart(2, "0");
                    const isOccupied = i === 1 || i === 7 || i === 10;
                    return (
                      <div
                        key={num}
                        className={`rounded-2xl border-2 p-3 text-center transition-all ${
                          isOccupied
                            ? "border-[#ef4444] bg-[#feebee] text-[#ef4444]"
                            : "border-[#16a34a] bg-[#dcfce7] text-[#16a34a]"
                        }`}
                      >
                        <span className="font-extrabold text-sm block">Meja {num}</span>
                        <span className="text-[10px] font-bold mt-1 block">
                          {isOccupied ? "Terisi (ORD)" : "Kosong"}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* ========================================================= */}
          {/* TAB 4: FINANCE & HPP MODULE IN DASHBOARD */}
          {/* ========================================================= */}
          {activeModule === "finance" && (
            <div className="space-y-6">
              <div className="flex items-center justify-between border-b border-[#dedee8] pb-4">
                <div>
                  <h2 className="text-xl font-extrabold text-[#232331]">
                    KAEL Finance &amp; Profit Engine
                  </h2>
                  <p className="text-xs text-[#7b7b8e]">
                    Kalkulator HPP produksi resep, analisis margin laba, dan proteksi boncos.
                  </p>
                </div>
                <Link
                  href="/demo/finance"
                  className="btn-tactile rounded-xl bg-[#232331] px-3.5 py-1.5 text-xs font-bold text-[#d9ff57]"
                >
                  Buka Full Finance Engine ➔
                </Link>
              </div>

              <div className="rounded-3xl border-2 border-[#232331] bg-white p-6 shadow-ink-md">
                <p className="text-xs text-[#7b7b8e]">
                  Gunakan aplikasi kalkulator HPP mandiri untuk menambah resep, mengatur gramasi bahan baku, dan menghitung target BEP bulanan usahamu.
                </p>
                <div className="mt-4">
                  <Link
                    href="/demo/finance"
                    className="btn-tactile inline-flex items-center gap-2 rounded-xl bg-[#232331] px-4 py-2 text-xs font-bold text-[#d9ff57]"
                  >
                    <Calculator size={14} />
                    <span>Luncurkan Kalkulator HPP Spreadsheet</span>
                  </Link>
                </div>
              </div>
            </div>
          )}

          {/* ========================================================= */}
          {/* TAB 5: LOYALTY CRM IN DASHBOARD */}
          {/* ========================================================= */}
          {activeModule === "loyalty" && (
            <div className="space-y-6">
              <div className="flex items-center justify-between border-b border-[#dedee8] pb-4">
                <div>
                  <h2 className="text-xl font-extrabold text-[#232331]">
                    KAEL Loyalty &amp; CRM Database
                  </h2>
                  <p className="text-xs text-[#7b7b8e]">
                    Daftar nomor WhatsApp pelanggan, poin reward aktif, dan kartu stempel terisi.
                  </p>
                </div>
                <Link
                  href="/demo/loyalty"
                  className="btn-tactile rounded-xl bg-[#232331] px-3.5 py-1.5 text-xs font-bold text-[#d9ff57]"
                >
                  Buka Full Loyalty App ➔
                </Link>
              </div>

              <div className="rounded-3xl border-2 border-[#232331] bg-white p-6 shadow-ink-md space-y-4">
                <span className="font-mono text-[10px] font-bold text-[#7958d8] uppercase block">
                  DATABASE MEMBER TERSIMPAN ({members.length} TERAKHIR DITAMPILKAN)
                </span>
                <div className="space-y-2">
                  {members.map((m) => (
                    <div key={m.id} className="flex items-center justify-between rounded-xl border border-[#dedee8] p-3 text-xs font-mono">
                      <div>
                        <span className="font-bold text-sm text-[#232331] font-sans">{m.name}</span>
                        <span className="text-[#7b7b8e] block">{m.phone} • {m.tier}</span>
                      </div>
                      <div className="text-right">
                        <span className="font-extrabold text-[#7958d8] text-sm block">{m.points} Poin</span>
                        <span className="text-[10px] text-[#16a34a] font-bold">{m.stamps}/10 Stempel Kopi</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* ========================================================= */}
          {/* TAB 6: STORE SETTINGS & WHITE LABEL */}
          {/* ========================================================= */}
          {activeModule === "settings" && (
            <div className="space-y-6">
              <div className="border-b border-[#dedee8] pb-4">
                <h2 className="text-xl font-extrabold text-[#232331]">
                  Pengaturan Brand Toko &amp; White-Label
                </h2>
                <p className="text-xs text-[#7b7b8e]">
                  Kustomisasi identitas tokomu pada struk kasir, menu QR meja, dan standee akrilik.
                </p>
              </div>

              <div className="rounded-3xl border-2 border-[#232331] bg-white p-6 shadow-ink-md space-y-4 font-mono text-xs">
                <div>
                  <label className="text-[10.5px] font-bold text-[#7b7b8e] block">Nama Usaha / Toko:</label>
                  <input
                    type="text"
                    value={currentBrand.name}
                    onChange={(e) => setCurrentBrand({ ...currentBrand, name: e.target.value })}
                    className="mt-1 w-full rounded-xl border border-[#232331] px-3.5 py-2 text-sm font-extrabold text-[#232331]"
                  />
                </div>

                <div>
                  <label className="text-[10.5px] font-bold text-[#7b7b8e] block">Alamat Toko (Tampil di Struk &amp; QR):</label>
                  <input
                    type="text"
                    value={currentBrand.address}
                    onChange={(e) => setCurrentBrand({ ...currentBrand, address: e.target.value })}
                    className="mt-1 w-full rounded-xl border border-[#dedee8] px-3.5 py-2 text-xs font-bold text-[#232331]"
                  />
                </div>

                <div className="pt-2 border-t border-[#dedee8] flex items-center justify-between">
                  <div>
                    <span className="font-bold text-xs text-[#232331] block">Badge Co-Branding "Powered by KAEL"</span>
                    <span className="text-[10.5px] text-[#7b7b8e]">{showWhiteLabelBadge ? "Aktif" : "Nonaktif (100% White-Label)"}</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowWhiteLabelBadge(!showWhiteLabelBadge)}
                    className="btn-tactile rounded-xl border border-[#232331] bg-[#d9ff57] px-3 py-1.5 font-bold text-[#232331]"
                  >
                    {showWhiteLabelBadge ? "Co-Branding ✓" : "White-Label"}
                  </button>
                </div>
              </div>
            </div>
          )}

        </main>
      </div>

      {/* Footer */}
      {showWhiteLabelBadge && (
        <footer className="border-t border-[#dedee8] py-4 text-center text-xs text-[#7b7b8e] bg-white">
          <p>⚡ Powered by <strong>KAEL Unified Operating System</strong> · All-in-One Merchant Dashboard</p>
        </footer>
      )}
    </div>
  );
}
