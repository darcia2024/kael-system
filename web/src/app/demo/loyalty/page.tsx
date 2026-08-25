"use client";

import { useState } from "react";
import Link from "next/link";
import { 
  ArrowLeft, 
  ArrowRight, 
  Award, 
  Cake, 
  Calendar, 
  Check, 
  CheckCircle2, 
  Clock, 
  Coffee, 
  Coins, 
  Copy, 
  Crown, 
  Flame, 
  Gift, 
  Heart, 
  HeartHandshake, 
  History, 
  Info, 
  MessageCircle, 
  Minus, 
  Nfc, 
  Percent, 
  Phone, 
  Plus, 
  QrCode, 
  Receipt, 
  Search, 
  Send, 
  Settings, 
  Share2, 
  ShieldCheck, 
  Smartphone, 
  Sparkles, 
  Star, 
  Tag, 
  Trash2, 
  TrendingUp, 
  User, 
  UserCheck, 
  UserPlus, 
  Utensils, 
  Wallet, 
  Zap 
} from "lucide-react";
import { DemoNavbar } from "@/components/demo-navbar";
import { DEMO_BRANDS, DemoBrand } from "@/lib/demo-config";

interface RewardVoucher {
  id: string;
  category: "discount" | "product" | "birthday";
  title: string;
  cost: number;
  expiry: string;
  claimed: boolean;
  voucherCode?: string;
}

interface PointLedgerItem {
  id: string;
  date: string;
  title: string;
  type: "earn" | "redeem";
  points: number;
  balanceAfter: number;
}

export default function DemoLoyaltyPage() {
  const [currentBrand, setCurrentBrand] = useState<DemoBrand>(DEMO_BRANDS[0]);
  const [showWhiteLabelBadge, setShowWhiteLabelBadge] = useState<boolean>(true);
  
  // App Navigation: "customer" (Layar HP Customer) vs "cashier" (Terminal Kasir) vs "settings" (Aturan Program)
  const [activeTab, setActiveTab] = useState<"customer" | "cashier" | "settings">("customer");

  // ==========================================
  // 1. CUSTOMER IDENTITY & LOYALTY PASSPORT
  // ==========================================
  const [isRegistered, setIsRegistered] = useState<boolean>(true);
  const [customerName, setCustomerName] = useState<string>("Rian Pratama");
  const [customerPhone, setCustomerPhone] = useState<string>("081298327812");
  const [customerBirthdate, setCustomerBirthdate] = useState<string>("15 Oktober");
  const [memberId, setMemberId] = useState<string>("VIP-8829");
  const [joinDate, setJoinDate] = useState<string>("12 Mei 2026");

  // Points & Stamps
  const [points, setPoints] = useState<number>(1850);
  const [stamps, setStamps] = useState<number>(7); // 7 out of 10
  const [activeCustomerSubTab, setActiveCustomerSubTab] = useState<"passport" | "vouchers" | "history">("passport");

  // Vouchers
  const [vouchers, setVouchers] = useState<RewardVoucher[]>([
    { id: "v1", category: "discount", title: "Diskon Rp 15.000 Belanja Min. Rp 50k", cost: 500, expiry: "30 Sep 2026", claimed: false },
    { id: "v2", category: "product", title: "Gratis 1 Iced Spanish Latte (Regular)", cost: 1000, expiry: "15 Okt 2026", claimed: false },
    { id: "v3", category: "product", title: "Free Artisan Butter Croissant", cost: 800, expiry: "20 Okt 2026", claimed: true, voucherCode: "CROISS-9821" },
    { id: "v4", category: "birthday", title: "Hadiah Ulang Tahun: Free Birthday Cake Slice", cost: 0, expiry: "Klaim di Bulan Ultah", claimed: false },
  ]);

  // Point Ledger History
  const [ledger, setLedger] = useState<PointLedgerItem[]>([
    { id: "L-101", date: "25 Agu 2026, 14:22", title: "Transaksi Kasir POS Meja 08", type: "earn", points: 88, balanceAfter: 1850 },
    { id: "L-100", date: "22 Agu 2026, 19:15", title: "Klaim Voucher Butter Croissant", type: "redeem", points: -800, balanceAfter: 1762 },
    { id: "L-099", date: "18 Agu 2026, 11:30", title: "Transaksi Kasir Dine-In Meja 03", type: "earn", points: 120, balanceAfter: 2562 },
    { id: "L-098", date: "12 Mei 2026, 10:00", title: "Bonus Registrasi Anggota Baru", type: "earn", points: 100, balanceAfter: 100 },
  ]);

  // ==========================================
  // 2. CASHIER TERMINAL STATE
  // ==========================================
  const [loyaltyMethod, setLoyaltyMethod] = useState<"visit" | "spend">("visit");
  const [searchQuery, setSearchQuery] = useState<string>("081298327812");
  const [billAmount, setBillAmount] = useState<number>(75000);
  const [redeemVoucherInput, setRedeemVoucherInput] = useState<string>("");
  const [notificationLog, setNotificationLog] = useState<string | null>(null);

  // ==========================================
  // 3. PROGRAM SETTINGS STATE
  // ==========================================
  const [pointRatio, setPointRatio] = useState<number>(1000); // Rp 1.000 = 1 Poin
  const [stampTarget, setStampTarget] = useState<number>(10);
  const [welcomeBonus, setWelcomeBonus] = useState<number>(100);

  // Tier Calculation
  let currentTier = "Bronze";
  let nextTier = "Silver";
  let tierProgress = 0;
  let multiplier = "1.0x";
  let tierColor = "#7958d8";

  if (points >= 3000) {
    currentTier = "Platinum VIP";
    nextTier = "Max Tier (Legend)";
    tierProgress = 100;
    multiplier = "2.0x Poin";
    tierColor = "#0f766e";
  } else if (points >= 1500) {
    currentTier = "Gold Member";
    nextTier = "Platinum VIP (3.000 Pts)";
    tierProgress = Math.round(((points - 1500) / 1500) * 100);
    multiplier = "1.5x Poin";
    tierColor = "#d97706";
  } else if (points >= 500) {
    currentTier = "Silver Member";
    nextTier = "Gold Member (1.500 Pts)";
    tierProgress = Math.round(((points - 500) / 1000) * 100);
    multiplier = "1.2x Poin";
    tierColor = "#4b5563";
  } else {
    currentTier = "Bronze Member";
    nextTier = "Silver Member (500 Pts)";
    tierProgress = Math.round((points / 500) * 100);
    multiplier = "1.0x Poin";
    tierColor = "#92400e";
  }

  // ==========================================
  // HANDLERS
  // ==========================================
  const handleAddStamp = () => {
    if (stamps < stampTarget) {
      setStamps((prev) => {
        const next = prev + 1;
        if (next === stampTarget) {
          alert(`🎉 SELAMAT! Paspor stempel ${currentBrand.name} kamu sudah PENUH (10/10)! Kamu berhak mendapatkan 1 Minuman / Makanan Gratis di kasir!`);
        }
        return next;
      });
    } else {
      setStamps(1);
      alert("Stempel di-reset untuk putaran reward berikutnya!");
    }
  };

  const handleClaimVoucher = (voucher: RewardVoucher) => {
    if (points < voucher.cost) {
      alert("Saldo poin kamu belum mencukupi!");
      return;
    }
    const newCode = `${currentBrand.logoText.slice(0, 4).trim()}-${Math.floor(1000 + Math.random() * 9000)}`;
    setPoints((prev) => {
      const newBal = prev - voucher.cost;
      setLedger((l) => [
        {
          id: `L-${Date.now().toString().slice(-4)}`,
          date: "Hari Ini, Baru Saja",
          title: `Tukar Reward: ${voucher.title}`,
          type: "redeem",
          points: -voucher.cost,
          balanceAfter: newBal,
        },
        ...l,
      ]);
      return newBal;
    });

    setVouchers((prev) =>
      prev.map((v) => (v.id === voucher.id ? { ...v, claimed: true, voucherCode: newCode } : v))
    );

    alert(`🎉 Voucher berhasil ditukarkan! Kode Voucher kamu: ${newCode}. Tunjukkan ke kasir saat memesan.`);
  };

  const handleTapVisit = () => {
    const visitPts = 100;
    const newBal = points + visitPts;
    setPoints(newBal);
    if (stamps < stampTarget) {
      setStamps((s) => Math.min(stampTarget, s + 1));
    }
    setLedger((l) => [
      {
        id: `L-${Date.now().toString().slice(-4)}`,
        date: "Hari Ini, Baru Saja",
        title: "Tap Kunjungan Standee NFC (+1 Stempel & +100 Pts)",
        type: "earn",
        points: visitPts,
        balanceAfter: newBal,
      },
      ...l,
    ]);
    setNotificationLog(
      `⚡ TAP KUNJUNGAN BERHASIL! +1 Stempel Kopi & +100 Poin langsung masuk ke ${customerName} (${customerPhone}). Bot WhatsApp otomatis mengirim pesan lapor saldo!`
    );
  };

  const handleCashierAddPoints = (customPts?: number) => {
    const earned = customPts !== undefined ? customPts : Math.floor(billAmount / pointRatio);
    const newBal = points + earned;
    setPoints(newBal);
    if (stamps < stampTarget) {
      setStamps((s) => Math.min(stampTarget, s + 1));
    }

    setLedger((l) => [
      {
        id: `L-${Date.now().toString().slice(-4)}`,
        date: "Hari Ini, Baru Saja",
        title: `Transaksi Kasir Senilai Rp ${billAmount.toLocaleString("id-ID")}`,
        type: "earn",
        points: earned,
        balanceAfter: newBal,
      },
      ...l,
    ]);

    setNotificationLog(
      `Sukses kirim +${earned} Poin & +1 Stempel ke ${customerName} (${customerPhone}). Bot WhatsApp otomatis mengirim pesan lapor saldo!`
    );
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
              <span className="flex h-6 w-6 items-center justify-center rounded-md bg-[#d97706] text-white font-mono text-[10px] font-bold">
                04
              </span>
              <h1 className="text-lg sm:text-2xl font-extrabold text-[#232331]">
                KAEL Loyalty &amp; Member VIP System
              </h1>
            </div>
            <p className="text-xs text-[#7b7b8e] mt-0.5">
              Registrasi member WhatsApp instan, stempel digital 10-kunjungan, tier membership, dan terminal approval kasir.
            </p>
          </div>

          {/* Role Navigation Pills */}
          <div className="flex items-center rounded-2xl border-2 border-[#232331] bg-white p-1 shadow-ink-xs font-mono text-xs">
            <button
              type="button"
              onClick={() => setActiveTab("customer")}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl font-bold transition-all ${
                activeTab === "customer"
                  ? "bg-[#232331] text-[#d9ff57] shadow-ink-xs"
                  : "text-[#7b7b8e] hover:text-[#232331]"
              }`}
            >
              <Smartphone size={13} />
              <span>1. Layar HP Member</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("cashier")}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl font-bold transition-all ${
                activeTab === "cashier"
                  ? "bg-[#232331] text-[#d9ff57] shadow-ink-xs"
                  : "text-[#7b7b8e] hover:text-[#232331]"
              }`}
            >
              <UserCheck size={13} />
              <span>2. Terminal Kasir</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("settings")}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl font-bold transition-all ${
                activeTab === "settings"
                  ? "bg-[#232331] text-[#d9ff57] shadow-ink-xs"
                  : "text-[#7b7b8e] hover:text-[#232331]"
              }`}
            >
              <Settings size={13} />
              <span>3. Aturan Program</span>
            </button>
          </div>
        </div>

        {/* ========================================================= */}
        {/* VIEW 1: CUSTOMER SMARTPHONE APP / PASSPORT */}
        {/* ========================================================= */}
        {activeTab === "customer" && (
          <div className="mt-6 grid gap-6 lg:grid-cols-12 items-start">
            
            {/* Phone Screen Simulator */}
            <div className="lg:col-span-6 flex justify-center">
              <div className="w-full max-w-sm rounded-[36px] border-[3px] border-[#232331] bg-white p-3 shadow-ink-xl">
                
                {/* Phone Header */}
                <div className="flex items-center justify-between px-3 py-1 text-[11px] font-mono text-[#7b7b8e] border-b border-gray-100">
                  <span>09:41</span>
                  <div className="flex items-center gap-1">
                    <span className="h-2 w-2 rounded-full bg-[#16a34a]" />
                    <span>WhatsApp VIP Active</span>
                  </div>
                </div>

                <div className="mt-2 rounded-[28px] bg-[#fcfcfe] p-4 border border-[#dedee8] text-[#232331] space-y-3">
                  
                  {/* Quick Tap Standee NFC Simulator Banner */}
                  <div className="rounded-2xl border-2 border-[#232331] bg-[#d9ff57] p-2.5 text-center shadow-ink-xs">
                    <span className="font-mono text-[9px] font-bold text-[#232331] uppercase block">
                      ⚡ STANDEE NFC KASIR / MEJA TERHUBUNG
                    </span>
                    <button
                      type="button"
                      onClick={handleTapVisit}
                      className="btn-tactile mt-1.5 flex w-full items-center justify-center gap-1.5 rounded-xl bg-[#232331] py-2 text-xs font-extrabold text-[#d9ff57] shadow-ink-xs"
                    >
                      <Zap size={13} fill="currentColor" />
                      <span>Tap HP ke Standee (+1 Stempel &amp; +100 Pts)</span>
                    </button>
                  </div>

                  {/* VIP Digital Membership Card */}
                  <div 
                    className="relative rounded-2xl border-2 border-[#232331] p-4 text-white shadow-ink-md flex flex-col justify-between h-48 overflow-hidden"
                    style={{ backgroundColor: currentBrand.themeColor }}
                  >
                    <div className="flex items-center justify-between z-10">
                      <div className="flex items-center gap-2">
                        <span className="font-extrabold text-sm tracking-wider">
                          {currentBrand.name}
                        </span>
                        <span className="rounded-full bg-white/20 px-2 py-0.5 font-mono text-[9px] font-bold text-white border border-white/30">
                          {currentTier}
                        </span>
                      </div>
                      <Crown size={18} className="text-[#d9ff57]" />
                    </div>

                    <div className="z-10 flex items-center justify-between font-mono">
                      <div>
                        <span className="text-[9px] opacity-75 uppercase block">NAMA MEMBER</span>
                        <span className="font-extrabold text-sm block">{customerName}</span>
                        <span className="text-[10px] opacity-80">{customerPhone}</span>
                      </div>
                      <div className="text-right">
                        <span className="text-[9px] opacity-75 uppercase block">SALDO POIN</span>
                        <span className="text-2xl font-extrabold text-[#d9ff57]">{points}</span>
                        <span className="text-[9px] opacity-75 block">Poin</span>
                      </div>
                    </div>

                    {/* Tier Progress Bar on Card */}
                    <div className="z-10 border-t border-white/20 pt-2 text-[9px] font-mono">
                      <div className="flex justify-between opacity-80 mb-1">
                        <span>Tier: {currentTier} ({multiplier})</span>
                        <span>Next: {nextTier}</span>
                      </div>
                      <div className="h-1.5 w-full rounded-full bg-black/20 overflow-hidden">
                        <div className="h-full rounded-full bg-[#d9ff57]" style={{ width: `${tierProgress}%` }} />
                      </div>
                    </div>

                    {/* Background Graphic Glow */}
                    <div className="absolute -bottom-8 -right-8 h-32 w-32 rounded-full bg-white/10 blur-xl pointer-events-none" />
                  </div>

                  {/* Customer Inner Sub-Tabs */}
                  <div className="flex rounded-xl border border-[#dedee8] bg-white p-1 font-mono text-xs text-center">
                    <button
                      type="button"
                      onClick={() => setActiveCustomerSubTab("passport")}
                      className={`flex-1 py-1 rounded-lg font-bold transition-all ${
                        activeCustomerSubTab === "passport" ? "bg-[#232331] text-[#d9ff57]" : "text-[#7b7b8e]"
                      }`}
                    >
                      ☕ Stempel
                    </button>
                    <button
                      type="button"
                      onClick={() => setActiveCustomerSubTab("vouchers")}
                      className={`flex-1 py-1 rounded-lg font-bold transition-all ${
                        activeCustomerSubTab === "vouchers" ? "bg-[#232331] text-[#d9ff57]" : "text-[#7b7b8e]"
                      }`}
                    >
                      🎁 Voucher ({vouchers.filter(v => !v.claimed).length})
                    </button>
                    <button
                      type="button"
                      onClick={() => setActiveCustomerSubTab("history")}
                      className={`flex-1 py-1 rounded-lg font-bold transition-all ${
                        activeCustomerSubTab === "history" ? "bg-[#232331] text-[#d9ff57]" : "text-[#7b7b8e]"
                      }`}
                    >
                      📜 Riwayat
                    </button>
                  </div>

                  {/* 1. STAMP CARD SUB-TAB */}
                  {activeCustomerSubTab === "passport" && (
                    <div className="rounded-2xl bg-white border border-[#dedee8] p-3.5 shadow-ink-xs space-y-3">
                      <div className="flex items-center justify-between border-b border-[#dedee8] pb-2">
                        <div className="flex items-center gap-1.5">
                          <Coffee size={14} className="text-[#7958d8]" />
                          <span className="font-extrabold text-xs text-[#232331]">
                            Kartu Stempel 10-Kunjungan
                          </span>
                        </div>
                        <span className="font-mono text-[9px] font-bold text-[#16a34a] bg-[#dcfce7] px-1.5 py-0.2 rounded">
                          {stamps}/10 Terkumpul
                        </span>
                      </div>

                      {/* 10 Visual Stamp Slots */}
                      <div className="grid grid-cols-5 gap-2 text-center font-mono">
                        {Array.from({ length: 10 }).map((_, idx) => {
                          const isFilled = idx < stamps;
                          const isTarget = idx === 9;
                          return (
                            <div
                              key={idx}
                              className={`flex flex-col items-center justify-center h-11 rounded-xl border text-[10px] transition-all ${
                                isFilled
                                  ? "bg-[#d9ff57] border-[#232331] text-[#232331] font-extrabold shadow-ink-xs scale-105"
                                  : isTarget
                                  ? "bg-[#feebee] border-dashed border-[#ef4444] text-[#ef4444] font-bold"
                                  : "bg-[#fcfcfe] border-[#dedee8] text-[#7b7b8e]"
                              }`}
                            >
                              {isFilled ? (
                                <span>☕ ✓</span>
                              ) : isTarget ? (
                                <span>🎁 GRATIS</span>
                              ) : (
                                <span>{idx + 1}</span>
                              )}
                            </div>
                          );
                        })}
                      </div>

                      {/* Simulation Button */}
                      <button
                        type="button"
                        onClick={handleAddStamp}
                        className="btn-tactile flex w-full items-center justify-center gap-1.5 rounded-xl bg-[#f0edff] py-2 text-xs font-bold text-[#7958d8] border border-[#7958d8]/30 hover:bg-[#e6dfff]"
                      >
                        <Plus size={13} />
                        <span>+ Tap Tambah 1 Stempel (Simulasi Kunjungan)</span>
                      </button>
                    </div>
                  )}

                  {/* 2. VOUCHERS SUB-TAB */}
                  {activeCustomerSubTab === "vouchers" && (
                    <div className="space-y-2.5 max-h-[260px] overflow-y-auto pr-1">
                      {vouchers.map((v) => (
                        <div
                          key={v.id}
                          className="rounded-2xl bg-white border border-[#dedee8] p-3 text-xs shadow-ink-xs space-y-1.5"
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              <span className="font-extrabold text-[#232331] block leading-tight">
                                {v.title}
                              </span>
                              <span className="text-[10px] text-[#7b7b8e]">
                                Exp: {v.expiry} • {v.cost > 0 ? `${v.cost} Poin` : "Gratis Ulang Tahun"}
                              </span>
                            </div>
                            <span className="font-mono text-xs font-extrabold text-[#7958d8] shrink-0">
                              {v.cost > 0 ? `${v.cost} Pts` : "FREE"}
                            </span>
                          </div>

                          {v.claimed ? (
                            <div className="rounded-lg bg-[#dcfce7] border border-[#16a34a] p-2 text-center text-[#16a34a] font-mono font-bold text-xs">
                              <span>KODE: {v.voucherCode}</span>
                              <span className="block text-[9.5px] font-sans font-normal text-[#232331]">
                                (Tunjukkan kode ini ke kasir)
                              </span>
                            </div>
                          ) : (
                            <button
                              type="button"
                              onClick={() => handleClaimVoucher(v)}
                              disabled={points < v.cost}
                              className={`btn-tactile w-full py-1.5 rounded-xl font-bold text-xs ${
                                points >= v.cost
                                  ? "bg-[#232331] text-[#d9ff57] shadow-ink-xs"
                                  : "bg-gray-100 text-gray-400 cursor-not-allowed"
                              }`}
                            >
                              {points >= v.cost ? "Tukarkan Poin Sekarang" : "Poin Tidak Cukup"}
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  )}

                  {/* 3. HISTORY LEDGER SUB-TAB */}
                  {activeCustomerSubTab === "history" && (
                    <div className="space-y-2 max-h-[260px] overflow-y-auto pr-1">
                      {ledger.map((item) => (
                        <div
                          key={item.id}
                          className="flex items-center justify-between rounded-xl bg-white border border-[#dedee8] p-2.5 text-xs font-mono"
                        >
                          <div className="min-w-0 pr-2">
                            <span className="font-sans font-bold text-[#232331] block truncate text-[11px]">
                              {item.title}
                            </span>
                            <span className="text-[9.5px] text-[#7b7b8e]">{item.date}</span>
                          </div>
                          <div className="text-right shrink-0">
                            <span className={`font-extrabold text-xs block ${item.type === "earn" ? "text-[#16a34a]" : "text-[#ef4444]"}`}>
                              {item.points > 0 ? `+${item.points}` : item.points} Pts
                            </span>
                            <span className="text-[9.5px] text-[#7b7b8e]">Saldo: {item.balanceAfter}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* QR Member Barcode for Cashier Scanning */}
                  <div className="rounded-2xl bg-white border border-[#dedee8] p-3 text-center shadow-ink-xs font-mono">
                    <p className="text-[10px] text-[#7b7b8e] mb-1">
                      Barcode Member untuk Scan Kasir:
                    </p>
                    <p className="text-base tracking-[0.25em] font-extrabold text-[#232331] leading-none">
                      ||| | |||| | ||| ||||
                    </p>
                    <span className="text-[9px] text-[#7958d8] font-bold mt-1 block">
                      ID: {memberId} ({customerPhone})
                    </span>
                  </div>

                </div>

              </div>
            </div>

            {/* Right Column: Live WhatsApp Bot Delivery Simulator */}
            <div className="lg:col-span-6 space-y-6">
              
              {/* WhatsApp Notification Bubble */}
              <div className="rounded-3xl border-2 border-[#232331] bg-white p-5 sm:p-6 shadow-ink-md">
                <div className="flex items-center justify-between border-b border-[#dedee8] pb-3">
                  <div className="flex items-center gap-2">
                    <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#25D366] text-white">
                      <MessageCircle size={15} fill="currentColor" />
                    </span>
                    <h3 className="font-extrabold text-sm text-[#232331]">
                      Simulasi Notifikasi Resmi WhatsApp
                    </h3>
                  </div>
                  <span className="font-mono text-[9px] font-bold text-[#16a34a] bg-[#dcfce7] px-2 py-0.5 rounded border border-[#16a34a]">
                    ● Auto-Sync Realtime
                  </span>
                </div>

                <div className="mt-4 rounded-2xl bg-[#ece5dd] p-4 font-sans text-xs">
                  <div className="max-w-[310px] rounded-2xl rounded-tl-none bg-white p-3.5 shadow-sm text-[#232331] space-y-1.5">
                    <div className="flex items-center gap-1.5 border-b border-gray-100 pb-1.5">
                      <span className="font-extrabold text-xs text-[#128c7e]">
                        {currentBrand.name} VIP Club
                      </span>
                      <span className="text-[9px] font-mono bg-gray-100 px-1 rounded text-gray-500">Verified</span>
                    </div>

                    <p className="text-[11.5px] leading-relaxed">
                      Halo <strong>Kak {customerName}</strong>! 🎉 <br />
                      Terima kasih sudah mampir hari ini. Saldo poin &amp; paspor stempelmu otomatis terupdate:
                    </p>

                    <div className="rounded-xl bg-[#f0f9f6] border border-[#25D366]/30 p-2.5 text-[11px] font-mono space-y-1">
                      <div className="flex justify-between">
                        <span>Status Tier:</span>
                        <strong className="text-[#7958d8]">{currentTier}</strong>
                      </div>
                      <div className="flex justify-between">
                        <span>Total Poin:</span>
                        <strong className="text-[#16a34a]">{points} Poin</strong>
                      </div>
                      <div className="flex justify-between">
                        <span>Paspor Kopi:</span>
                        <strong className="text-[#232331]">{stamps}/10 Stempel</strong>
                      </div>
                    </div>

                    <p className="text-[10px] text-gray-500 pt-1">
                      Ketik <strong>MENU</strong> atau klik link di bawah untuk melihat katalog voucher reward kamu: <br />
                      <span className="text-[#128c7e] underline font-mono">https://kael.id/m/{memberId}</span>
                    </p>

                    <span className="text-[9px] text-[#7b7b8e] block text-right font-mono">
                      14:25 ✓✓
                    </span>
                  </div>
                </div>

                <div className="mt-4 rounded-xl bg-[#f0edff] border border-[#7958d8]/30 p-3 text-xs text-[#232331] space-y-1">
                  <div className="font-bold flex items-center gap-1.5 text-[#7958d8]">
                    <Sparkles size={13} />
                    <span>Keuntungan Sistem Member KAEL:</span>
                  </div>
                  <p className="text-[11px] text-[#7b7b8e] leading-relaxed">
                    Customer <strong>TIDAK PERLU download aplikasi</strong> yang menuh-menuhin memori HP. Database no WhatsApp pelanggan otomatis tersimpan di toko untuk repeat order &amp; promo broadcast!
                  </p>
                </div>
              </div>

            </div>

          </div>
        )}

        {/* ========================================================= */}
        {/* VIEW 2: CASHIER TERMINAL (APPROVAL & POINT DISPATCH) */}
        {/* ========================================================= */}
        {activeTab === "cashier" && (
          <div className="mt-6 space-y-6">
            
            <div className="rounded-3xl border-2 border-[#232331] bg-white p-6 shadow-ink-md">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-[#dedee8] pb-4">
                <div>
                  <h3 className="font-extrabold text-base text-[#232331]">
                    Terminal Kasir: Cari &amp; Input Poin Member
                  </h3>
                  <p className="text-xs text-[#7b7b8e]">
                    Kasir mencari nomor WhatsApp customer, mengetik nominal belanja, dan approve voucher reward.
                  </p>
                </div>
                <span className="font-mono text-xs font-bold text-[#16a34a] bg-[#dcfce7] px-3 py-1 rounded-xl border border-[#16a34a]">
                  ● Kasir Standby: POS-01
                </span>
              </div>

              <div className="mt-6 grid gap-6 md:grid-cols-12 items-start">
                
                {/* Left: Search & Transaction Form */}
                <div className="md:col-span-7 space-y-4 font-mono text-xs">
                  
                  {/* Search Customer */}
                  <div>
                    <label className="text-[10.5px] font-bold text-[#7b7b8e] block">
                      1. Cari Customer (No. WA / Nama / Barcode):
                    </label>
                    <div className="mt-1 flex gap-2">
                      <div className="relative flex-1">
                        <Search size={14} className="absolute left-3 top-2.5 text-[#7b7b8e]" />
                        <input
                          type="text"
                          value={searchQuery}
                          onChange={(e) => setSearchQuery(e.target.value)}
                          className="w-full rounded-xl border-2 border-[#232331] pl-8 pr-3 py-2 text-xs font-bold text-[#232331]"
                        />
                      </div>
                      <button
                        type="button"
                        className="btn-tactile rounded-xl bg-[#232331] px-4 py-2 text-xs font-bold text-[#d9ff57]"
                      >
                        Cari
                      </button>
                    </div>
                  </div>

                  {/* Loyalty Method Switcher Tabs */}
                  <div className="border-t border-[#dedee8] pt-4">
                    <label className="text-[10.5px] font-bold text-[#7b7b8e] block mb-1.5">
                      2. Pilih Metode Pengisian Poin / Stempel:
                    </label>
                    <div className="flex rounded-xl border border-[#dedee8] bg-[#fcfcfe] p-1 font-mono text-xs">
                      <button
                        type="button"
                        onClick={() => setLoyaltyMethod("visit")}
                        className={`flex-1 py-2 rounded-lg font-bold transition-all ${
                          loyaltyMethod === "visit"
                            ? "bg-[#232331] text-[#d9ff57] shadow-ink-xs"
                            : "text-[#7b7b8e] hover:text-[#232331]"
                        }`}
                      >
                        ⚡ Mode 1: 1-Tap Kunjungan (Instan Sekali Datang)
                      </button>
                      <button
                        type="button"
                        onClick={() => setLoyaltyMethod("spend")}
                        className={`flex-1 py-2 rounded-lg font-bold transition-all ${
                          loyaltyMethod === "spend"
                            ? "bg-[#232331] text-[#d9ff57] shadow-ink-xs"
                            : "text-[#7b7b8e] hover:text-[#232331]"
                        }`}
                      >
                        💳 Mode 2: Input Nominal Belanja
                      </button>
                    </div>
                  </div>

                  {/* MODE 1: 1-TAP KUNJUNGAN DATANG INSTAN */}
                  {loyaltyMethod === "visit" && (
                    <div className="rounded-2xl border-2 border-[#7958d8] bg-[#f0edff] p-4 text-center space-y-2.5">
                      <span className="font-mono text-[10px] font-bold text-[#7958d8] uppercase block">
                        ⚡ METODE KUNJUNGAN CEPAT (DEFAULT)
                      </span>
                      <p className="text-xs text-[#232331] leading-relaxed">
                        Tamu cukup tap HP ke Standee NFC kasir atau kasir tekan tombol di bawah saat tamu datang. <strong>Langsung tercatat +1 Stempel Kopi &amp; +100 Poin Kunjungan</strong> ke nomor WhatsApp tamu tanpa repot hitung belanjaan!
                      </p>
                      <button
                        type="button"
                        onClick={handleTapVisit}
                        className="btn-tactile flex w-full items-center justify-center gap-2 rounded-xl bg-[#16a34a] py-3.5 text-xs sm:text-sm font-extrabold text-white shadow-ink-md hover:bg-[#15803d]"
                      >
                        <Zap size={15} fill="currentColor" />
                        <span>⚡ TAP KUNJUNGAN DATANG (+1 Stempel &amp; +100 Poin)</span>
                      </button>
                    </div>
                  )}

                  {/* MODE 2: INPUT NOMINAL BELANJA KASIR */}
                  {loyaltyMethod === "spend" && (
                    <div className="space-y-3">
                      <div>
                        <label className="text-[10.5px] font-bold text-[#7b7b8e] block">
                          Input Total Belanja Customer:
                        </label>
                        <div className="mt-1 flex items-center gap-2">
                          <span className="text-sm font-bold text-[#7b7b8e]">Rp</span>
                          <input
                            type="number"
                            value={billAmount}
                            onChange={(e) => setBillAmount(Number(e.target.value))}
                            className="flex-1 rounded-xl border-2 border-[#232331] px-3.5 py-2 text-sm font-extrabold text-[#232331]"
                          />
                        </div>

                        {/* Quick Bill Preset Pills */}
                        <div className="mt-2 flex flex-wrap gap-1.5">
                          {[25000, 50000, 75000, 100000, 150000].map((amt) => (
                            <button
                              key={amt}
                              type="button"
                              onClick={() => setBillAmount(amt)}
                              className="btn-tactile rounded-lg border border-[#dedee8] bg-[#fcfcfe] px-2.5 py-1 text-[10.5px] font-bold hover:border-[#232331]"
                            >
                              Rp {(amt / 1000)}k (+{Math.floor(amt / pointRatio)} Pts)
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Send Points Action */}
                      <div className="pt-1">
                        <button
                          type="button"
                          onClick={() => handleCashierAddPoints()}
                          className="btn-tactile flex w-full items-center justify-center gap-2 rounded-xl bg-[#16a34a] py-3 text-xs font-extrabold text-white shadow-ink-md hover:bg-[#15803d]"
                        >
                          <Send size={13} />
                          <span>Kirim +{Math.floor(billAmount / pointRatio)} Poin &amp; Pesan WhatsApp ke Customer</span>
                        </button>
                      </div>
                    </div>
                  )}

                  {notificationLog && (
                    <div className="rounded-xl bg-[#dcfce7] border-2 border-[#16a34a] p-3 text-xs text-[#16a34a] font-bold animate-fadeIn">
                      ✓ {notificationLog}
                    </div>
                  )}

                </div>

                {/* Right: Member Profile Card */}
                <div className="md:col-span-5 rounded-3xl border-2 border-[#232331] bg-[#f0edff] p-5 space-y-3 font-mono text-xs">
                  <div className="flex items-center justify-between border-b border-[#7958d8]/30 pb-2">
                    <span className="font-bold text-[#7958d8] text-[10px] uppercase">
                      PROFIL MEMBER TERDETEKSI
                    </span>
                    <span className="rounded bg-[#7958d8] text-white px-2 py-0.5 text-[9px] font-bold">
                      {currentTier}
                    </span>
                  </div>

                  <div>
                    <h4 className="text-base font-extrabold text-[#232331]">{customerName}</h4>
                    <p className="text-[#7b7b8e] font-bold">{customerPhone}</p>
                    <p className="text-[10px] text-[#7b7b8e]">Ultah: {customerBirthdate} • Member sejak: {joinDate}</p>
                  </div>

                  <div className="grid grid-cols-2 gap-2 pt-2">
                    <div className="rounded-xl bg-white p-2.5 border text-center">
                      <span className="text-[9px] text-[#7b7b8e] block">SALDO POIN</span>
                      <strong className="text-base text-[#232331]">{points} Pts</strong>
                    </div>
                    <div className="rounded-xl bg-white p-2.5 border text-center">
                      <span className="text-[9px] text-[#7b7b8e] block">PASPOR STEMPEL</span>
                      <strong className="text-base text-[#7958d8]">{stamps}/10</strong>
                    </div>
                  </div>

                  <div className="pt-2 border-t border-[#7958d8]/30">
                    <span className="font-bold text-[10.5px] text-[#232331] block mb-1.5">
                      Klaim Voucher Pending:
                    </span>
                    <div className="space-y-1.5">
                      {vouchers.filter(v => v.claimed).map(v => (
                        <div key={v.id} className="flex items-center justify-between rounded-lg bg-white p-2 border text-[10.5px]">
                          <span className="font-bold text-[#232331] truncate pr-1">{v.title}</span>
                          <span className="font-bold text-[#16a34a] shrink-0">Lunas ✓</span>
                        </div>
                      ))}
                    </div>
                  </div>

                </div>

              </div>
            </div>

          </div>
        )}

        {/* ========================================================= */}
        {/* VIEW 3: PROGRAM LOYALTY SETTINGS & RULES */}
        {/* ========================================================= */}
        {activeTab === "settings" && (
          <div className="mt-6 space-y-6">
            <div className="rounded-3xl border-2 border-[#232331] bg-white p-6 shadow-ink-md">
              <h3 className="font-extrabold text-base text-[#232331] border-b border-[#dedee8] pb-3">
                Pengaturan Aturan Program Loyalty Tokomu
              </h3>

              <div className="mt-5 grid gap-6 md:grid-cols-3 font-mono text-xs">
                
                {/* Setting 1: Point Ratio */}
                <div className="rounded-2xl border border-[#dedee8] bg-[#fcfcfe] p-4 space-y-2">
                  <span className="font-bold text-xs text-[#232331] block">
                    1. Rasio Poin per Belanja
                  </span>
                  <p className="text-[11px] text-[#7b7b8e]">
                    Setiap kelipatan belanja berapa rupiah customer mendapatkan 1 poin:
                  </p>
                  <div className="flex items-center gap-1">
                    <span className="font-bold text-xs text-[#7b7b8e]">Rp</span>
                    <input
                      type="number"
                      value={pointRatio}
                      onChange={(e) => setPointRatio(Number(e.target.value))}
                      className="w-full rounded-xl border border-[#232331] px-3 py-1.5 font-extrabold text-[#232331]"
                    />
                  </div>
                  <span className="text-[10px] text-[#16a34a] font-bold block">
                    = 1 Poin didapatkan
                  </span>
                </div>

                {/* Setting 2: Stamp Target */}
                <div className="rounded-2xl border border-[#dedee8] bg-[#fcfcfe] p-4 space-y-2">
                  <span className="font-bold text-xs text-[#232331] block">
                    2. Target Stempel Minuman Gratis
                  </span>
                  <p className="text-[11px] text-[#7b7b8e]">
                    Berapa kali stempel kunjungan untuk mendapatkan reward gratis:
                  </p>
                  <div className="flex items-center gap-1">
                    <input
                      type="number"
                      value={stampTarget}
                      onChange={(e) => setStampTarget(Number(e.target.value))}
                      className="w-full rounded-xl border border-[#232331] px-3 py-1.5 font-extrabold text-[#232331]"
                    />
                    <span className="font-bold text-xs text-[#7b7b8e]">Stempel</span>
                  </div>
                </div>

                {/* Setting 3: Welcome Bonus */}
                <div className="rounded-2xl border border-[#dedee8] bg-[#fcfcfe] p-4 space-y-2">
                  <span className="font-bold text-xs text-[#232331] block">
                    3. Bonus Poin Pendaftaran Baru
                  </span>
                  <p className="text-[11px] text-[#7b7b8e]">
                    Poin instan yang diberikan saat customer pertama kali daftar via WA:
                  </p>
                  <div className="flex items-center gap-1">
                    <input
                      type="number"
                      value={welcomeBonus}
                      onChange={(e) => setWelcomeBonus(Number(e.target.value))}
                      className="w-full rounded-xl border border-[#232331] px-3 py-1.5 font-extrabold text-[#232331]"
                    />
                    <span className="font-bold text-xs text-[#7b7b8e]">Poin</span>
                  </div>
                </div>

              </div>

              <div className="mt-5 pt-3 border-t border-[#dedee8] flex justify-end">
                <button
                  type="button"
                  onClick={() => alert("Pengaturan aturan program loyalty berhasil disimpan!")}
                  className="btn-tactile rounded-xl bg-[#232331] px-5 py-2.5 text-xs font-bold text-[#d9ff57] shadow-ink-xs"
                >
                  Simpan Aturan Program
                </button>
              </div>
            </div>
          </div>
        )}

      </main>

      {/* Footer */}
      {showWhiteLabelBadge && (
        <footer className="border-t border-[#dedee8] py-4 text-center text-xs text-[#7b7b8e] bg-white">
          <p>⚡ Powered by <strong>KAEL Loyalty &amp; Member Engine</strong> · Live Demo Environment</p>
        </footer>
      )}
    </div>
  );
}
