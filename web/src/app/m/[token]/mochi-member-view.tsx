"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import {
  Bell,
  QrCode,
  Gift,
  Ticket,
  UtensilsCrossed,
  Star,
  Sparkles,
  ArrowRight,
  ShieldCheck,
  Copy,
  Check,
  Clock,
  Share2,
  Cake,
  Crown,
  MessageCircle,
  Eye,
  EyeOff,
  Home,
  User,
  X,
  MapPin,
  ChevronRight,
  Info,
  CheckCircle2,
  AlertCircle,
  Coffee,
  Plus,
  Search,
  Lock,
  Unlock,
  Zap,
  Flame,
  Award,
} from "lucide-react";

import type { MemberPageData } from "./member-client";
import { PLACEHOLDER_MENU, type MenuItem } from "@/lib/types";
import { maskPhoneNumber, resolveTier } from "@/lib/loyalty-engine";
import { formatRupiah, formatBusinessDateTime } from "@/lib/formatters";
import QrCodeComponent from "@/components/qr-code";
import { updateMarketingPreferenceAction, updateCustomerBirthdayAction } from "@/lib/actions";
import { siteHost } from "@/lib/site";

export default function MochiMemberView({
  customer,
  business,
  program,
  rewards,
  balance,
  ledger,
  redemptions,
  referralCode,
  tiers,
  lifetimeSpend,
  cardSettings,
  menuItems = [],
  categories = [],
  visitCount,
}: MemberPageData) {
  // Modal states
  const [showQrModal, setShowQrModal] = useState(false);
  const [showRewardModal, setShowRewardModal] = useState(false);
  const [showVoucherModal, setShowVoucherModal] = useState(false);
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [activeNavTab, setActiveNavTab] = useState<"home" | "voucher" | "menu" | "profile">("home");

  // Menu tab state
  const [menuSearchQuery, setMenuSearchQuery] = useState("");
  const [selectedMenuCategory, setSelectedMenuCategory] = useState<string>("all");
  const [selectedMenuDetail, setSelectedMenuDetail] = useState<MenuItem | null>(null);
  const [tableInput, setTableInput] = useState("");

  // Balance visibility toggle
  const [hideBalance, setHideBalance] = useState(false);

  // Copy state
  const [copiedCode, setCopiedCode] = useState<string | null>(null);
  const [copiedReferral, setCopiedReferral] = useState(false);

  // Birthday & Marketing state
  const [birthdayInput, setBirthdayInput] = useState("");
  const [savingBirthday, setSavingBirthday] = useState(false);
  const [birthdaySaved, setBirthdaySaved] = useState(false);
  const [birthdayError, setBirthdayError] = useState<string | null>(null);

  const [marketingOptIn, setMarketingOptIn] = useState(customer?.marketing_opt_in ?? false);
  const [savingMarketing, setSavingMarketing] = useState(false);

  // ---------------------------------------------------------------------------
  // TIER DEFINITIONS (Reguler, Perak, Emas)
  // ---------------------------------------------------------------------------
  const sortedTiers = useMemo(
    () => [...tiers].sort((a, b) => a.min_lifetime_spend - b.min_lifetime_spend),
    [tiers],
  );

  const tierConfig = useMemo(() => {
    const perakTier = sortedTiers.find((t) => t.name.toLowerCase().includes("perak") || t.name.toLowerCase().includes("silver")) || {
      id: "tier-perak",
      name: "Perak",
      min_lifetime_spend: 250000,
      earn_multiplier: 1.25,
      benefit_note: "Dapat 1.25x poin tiap transaksi, voucher ulang tahun, dan diskon promo seasonal.",
    };

    const emasTier = sortedTiers.find((t) => t.name.toLowerCase().includes("emas") || t.name.toLowerCase().includes("gold")) || {
      id: "tier-emas",
      name: "Emas",
      min_lifetime_spend: 1000000,
      earn_multiplier: 1.5,
      benefit_note: "Dapat 1.5x poin tiap transaksi, 1 complimentary menu ulang tahun, dan prioritas VIP table.",
    };

    const regulerTier = sortedTiers.find((t) => t.name.toLowerCase().includes("reguler") || t.min_lifetime_spend === 0) || {
      id: "tier-reguler",
      name: "Reguler",
      min_lifetime_spend: 0,
      earn_multiplier: 1.0,
      benefit_note: "Kumpulkan poin di setiap pesanan dan tukar hadiah di katalog.",
    };

    return { reguler: regulerTier, perak: perakTier, emas: emasTier };
  }, [sortedTiers]);

  // Determine current active tier
  const userCurrentTierKey = useMemo<"reguler" | "perak" | "emas">(() => {
    if (lifetimeSpend >= tierConfig.emas.min_lifetime_spend) return "emas";
    if (lifetimeSpend >= tierConfig.perak.min_lifetime_spend) return "perak";
    return "reguler";
  }, [lifetimeSpend, tierConfig]);

  // Selected card preview tab (user can click to preview locked or unlocked cards)
  const [selectedCardTier, setSelectedCardTier] = useState<"reguler" | "perak" | "emas">(userCurrentTierKey);

  if (!customer || !business || !program) return null;

  const currentTier = useMemo(() => resolveTier(lifetimeSpend, tiers), [lifetimeSpend, tiers]);

  const activeVoucher = useMemo(
    () => redemptions.find((r) => r.status === "issued") ?? null,
    [redemptions],
  );

  const activeVoucherCount = useMemo(
    () => redemptions.filter((r) => r.status === "issued").length,
    [redemptions],
  );

  // Next target reward
  const targetReward = useMemo(() => {
    const sorted = [...rewards].sort((a, b) => a.point_cost - b.point_cost);
    return sorted.find((r) => r.point_cost > balance) ?? sorted[sorted.length - 1] ?? null;
  }, [rewards, balance]);

  const pointsNeeded = targetReward ? Math.max(0, targetReward.point_cost - balance) : 0;
  const progressPct = targetReward
    ? Math.min(100, Math.round((balance / Math.max(1, targetReward.point_cost)) * 100))
    : 100;

  // Referral link
  const referralLink = useMemo(() => {
    if (!referralCode || !business?.store_code) return null;
    return `https://${siteHost}/loyalty/register?toko=${encodeURIComponent(business.store_code)}&ref=${encodeURIComponent(referralCode)}`;
  }, [referralCode, business?.store_code]);

  // Menu Categories with counts
  const menuCategories = useMemo(() => {
    const list: { id: string; name: string; count: number }[] = [];
    const categoryMap = new Map<string, string>();
    categories.forEach((c) => categoryMap.set(c.id, c.name));

    const counts = new Map<string, number>();
    menuItems.forEach((item) => {
      const catId = item.category_id || "uncategorized";
      counts.set(catId, (counts.get(catId) || 0) + 1);
    });

    categories.forEach((cat) => {
      const count = counts.get(cat.id) || 0;
      if (count > 0) {
        list.push({ id: cat.id, name: cat.name, count });
      }
    });

    menuItems.forEach((item) => {
      if (item.category_id && !categoryMap.has(item.category_id) && !list.some((l) => l.id === item.category_id)) {
        list.push({ id: item.category_id, name: "Menu Lainnya", count: counts.get(item.category_id) || 1 });
      }
    });

    return list;
  }, [categories, menuItems]);

  // Filtered menu items for search & category selection
  const filteredMenuItems = useMemo(() => {
    return menuItems.filter((item) => {
      const query = menuSearchQuery.toLowerCase().trim();
      const matchesSearch =
        !query ||
        item.name.toLowerCase().includes(query) ||
        (item.description && item.description.toLowerCase().includes(query));

      const matchesCategory =
        selectedMenuCategory === "all" || item.category_id === selectedMenuCategory;

      return matchesSearch && matchesCategory;
    });
  }, [menuItems, menuSearchQuery, selectedMenuCategory]);

  // Featured menu items for Home tab preview (first 6 items)
  const featuredMenuItems = useMemo(() => {
    return menuItems.slice(0, 6);
  }, [menuItems]);

  const handleCopy = (text: string, isRef = false) => {
    navigator.clipboard.writeText(text);
    if (isRef) {
      setCopiedReferral(true);
      setTimeout(() => setCopiedReferral(false), 2000);
    } else {
      setCopiedCode(text);
      setTimeout(() => setCopiedCode(null), 2000);
    }
  };

  const handleSaveBirthday = async () => {
    if (!customer || !birthdayInput) return;
    setBirthdayError(null);
    setSavingBirthday(true);
    const result = await updateCustomerBirthdayAction(customer.token, birthdayInput);
    setSavingBirthday(false);
    if (!result.ok) {
      setBirthdayError(result.error);
      return;
    }
    setBirthdaySaved(true);
  };

  const handleToggleMarketing = async (nextVal: boolean) => {
    if (!customer) return;
    setSavingMarketing(true);
    const res = await updateMarketingPreferenceAction(customer.token, nextVal);
    setSavingMarketing(false);
    if (res.ok) {
      setMarketingOptIn(nextVal);
    }
  };

  const firstName = customer.name?.trim().split(/\s+/)[0] || "Member";

  return (
    <div className="mx-auto min-h-screen max-w-md bg-[#0b3d2e] font-sans text-white antialiased selection:bg-[#c8f53a] selection:text-[#0b3d2e] relative overflow-x-hidden pb-28">
      
      {/* =================================================================== */}
      {/* 1. TOP STATUS & PROFILE HEADER                                      */}
      {/* =================================================================== */}
      <header className="px-5 pt-6 pb-4">
        {/* Dynamic Island / Time Bar subtle spacing */}
        <div className="flex items-center justify-between text-[11px] text-emerald-200/80 font-mono pb-3">
          <span>{new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}</span>
          <div className="flex items-center gap-1.5">
            <span className="inline-block h-2 w-2 rounded-full bg-[#c8f53a]" />
            <span>Mochi Member VIP</span>
          </div>
        </div>

        <div className="flex items-center justify-between gap-3">
          {/* Avatar and Customer Name - CLICKABLE TO OPEN PROFILE SHEET */}
          <button
            type="button"
            onClick={() => setShowProfileModal(true)}
            className="flex items-center gap-3 min-w-0 text-left group cursor-pointer focus:outline-none"
            title="Klik untuk membuka Profil & Pengaturan Member"
          >
            <div className="relative flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-emerald-950 border-2 border-emerald-600/40 text-emerald-100 font-extrabold text-base shadow-sm overflow-hidden group-hover:border-[#c8f53a] group-hover:scale-105 transition-all">
              <span className="font-mono text-sm">{firstName.slice(0, 2).toUpperCase()}</span>
            </div>

            <div className="min-w-0">
              <div className="flex items-center gap-1">
                <span className="block text-[11px] text-emerald-200/75 leading-tight font-medium">
                  Halo,
                </span>
                <span className="text-[10px] text-[#c8f53a] font-bold group-hover:underline flex items-center">
                  (Buka Profil <ChevronRight size={11} className="inline" />)
                </span>
              </div>
              <h1 className="truncate text-base font-extrabold text-white leading-snug tracking-tight group-hover:text-[#c8f53a] transition-colors">
                {customer.name}
              </h1>
            </div>
          </button>

          {/* Top Right Bell / Notification Pill */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setShowProfileModal(true)}
              aria-label="Profil dan Notifikasi"
              className="relative flex h-10 w-10 items-center justify-center rounded-full bg-white/10 hover:bg-white/15 border border-white/15 text-emerald-100 transition-colors active:scale-95"
              title="Profil & Pengaturan"
            >
              <Bell size={18} className="text-[#c8f53a]" />
              {activeVoucherCount > 0 && (
                <span className="absolute top-2 right-2 h-2 w-2 rounded-full bg-[#c8f53a] ring-2 ring-[#0b3d2e]" />
              )}
            </button>
          </div>
        </div>

        {/* ================================================================= */}
        {/* 2. WALLET HERO BALANCE                                            */}
        {/* ================================================================= */}
        <div className="mt-5 text-center space-y-1">
          <span className="text-[12px] font-medium text-emerald-200/80 tracking-wide">
            Saldo Poin Loyalitas
          </span>

          <div className="flex items-center justify-center gap-2 pt-0.5">
            <span className="text-3xl sm:text-4xl font-black tracking-tight text-white font-mono">
              {hideBalance ? "••••••" : `${balance.toLocaleString("id-ID")} Poin`}
            </span>
            <button
              type="button"
              onClick={() => setHideBalance(!hideBalance)}
              className="text-emerald-300/80 hover:text-white p-1 transition-colors"
              title={hideBalance ? "Tampilkan Saldo" : "Sembunyikan Saldo"}
            >
              {hideBalance ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </div>

          <p className="text-[11px] font-mono text-emerald-300/70">
            ≈ Senilai {formatRupiah(balance * 1000)} · {visitCount}x Kunjungan
          </p>

          {/* DUAL PILL ACTION BUTTONS */}
          <div className="flex items-center justify-center gap-3 pt-3">
            <button
              type="button"
              onClick={() => setShowRewardModal(true)}
              className="flex-1 max-w-[130px] rounded-full bg-[#c8f53a] hover:bg-[#d9ff57] py-2.5 px-4 font-bold text-xs text-[#0b3d2e] shadow-sm transition-all active:scale-95 text-center font-sans tracking-tight"
            >
              Tukar Hadiah
            </button>
            <button
              type="button"
              onClick={() => setShowQrModal(true)}
              className="flex-1 max-w-[130px] rounded-full bg-[#c8f53a] hover:bg-[#d9ff57] py-2.5 px-4 font-bold text-xs text-[#0b3d2e] shadow-sm transition-all active:scale-95 text-center font-sans tracking-tight"
            >
              Tunjuk QR
            </button>
          </div>
        </div>

        {/* ================================================================= */}
        {/* 3. TIER STATUS STRIP (QUICK OVERVIEW)                             */}
        {/* ================================================================= */}
        <div className="mt-5 rounded-2xl bg-black/25 border border-white/15 p-3 backdrop-blur-md">
          <div className="flex items-center justify-between pb-2">
            <span className="text-[11px] font-bold text-emerald-100 tracking-tight flex items-center gap-1.5">
              <Crown size={13} className="text-[#c8f53a]" />
              Level Member Aktif
            </span>
            <span className="text-[10px] font-mono text-[#c8f53a] font-bold">
              {userCurrentTierKey === "emas" ? "Member Emas (Gold VIP)" : userCurrentTierKey === "perak" ? "Member Perak (Silver VIP)" : "Member Reguler"}
            </span>
          </div>

          <div className="flex items-center gap-2 overflow-x-auto scrollbar-none pb-0.5">
            {/* Reguler Pill */}
            <button
              type="button"
              onClick={() => setSelectedCardTier("reguler")}
              className={`rounded-full px-3 py-1 text-[10.5px] font-extrabold whitespace-nowrap transition-all ${
                selectedCardTier === "reguler"
                  ? "bg-[#c8f53a] text-[#0b3d2e] shadow-xs"
                  : "bg-white/10 border border-white/10 text-emerald-100/90"
              }`}
            >
              🌿 Reguler {userCurrentTierKey === "reguler" && "✓"}
            </button>

            {/* Perak Pill */}
            <button
              type="button"
              onClick={() => setSelectedCardTier("perak")}
              className={`rounded-full px-3 py-1 text-[10.5px] font-extrabold whitespace-nowrap transition-all ${
                selectedCardTier === "perak"
                  ? "bg-slate-100 text-slate-900 shadow-xs ring-2 ring-slate-300"
                  : "bg-white/10 border border-white/10 text-emerald-100/90"
              }`}
            >
              🥈 Perak {userCurrentTierKey === "perak" ? "✓" : userCurrentTierKey === "emas" ? "✓" : "🔒"}
            </button>

            {/* Emas Pill */}
            <button
              type="button"
              onClick={() => setSelectedCardTier("emas")}
              className={`rounded-full px-3 py-1 text-[10.5px] font-extrabold whitespace-nowrap transition-all ${
                selectedCardTier === "emas"
                  ? "bg-amber-400 text-amber-950 shadow-xs ring-2 ring-amber-300"
                  : "bg-white/10 border border-white/10 text-emerald-100/90"
              }`}
            >
              👑 Emas {userCurrentTierKey === "emas" ? "✓" : "🔒"}
            </button>

            <button
              type="button"
              onClick={() => setShowRewardModal(true)}
              className="rounded-full bg-white/10 hover:bg-white/20 border border-white/15 text-emerald-200 px-2.5 py-1 text-[10.5px] font-bold whitespace-nowrap flex items-center gap-1 transition-colors ml-auto"
            >
              <Plus size={12} />
              <span>Hadiah</span>
            </button>
          </div>
        </div>
      </header>

      {/* =================================================================== */}
      {/* 4. WHITE SHEET CONTAINER (MAIN DASHBOARD & CARD SHOWCASE)           */}
      {/* =================================================================== */}
      <div className="rounded-t-[32px] bg-[#f8faf9] text-[#1c2d26] pt-5 pb-24 px-4 sm:px-5 shadow-[0_-8px_30px_rgba(0,0,0,0.15)] min-h-[520px]">
        
        {/* SEGMENTED SWITCHER: DOMPET MEMBER vs KATALOG MENU */}
        <div className="flex rounded-2xl bg-[#e5ede9] p-1.5 mb-5 shadow-inner">
          <button
            type="button"
            onClick={() => setActiveNavTab("home")}
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-black transition-all ${
              activeNavTab === "home"
                ? "bg-[#0b3d2e] text-[#c8f53a] shadow-sm scale-[1.01]"
                : "text-[#52665e] hover:text-[#1c2d26]"
            }`}
          >
            <Home size={15} />
            <span>Dompet Member</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveNavTab("menu")}
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-black transition-all ${
              activeNavTab === "menu"
                ? "bg-[#0b3d2e] text-[#c8f53a] shadow-sm scale-[1.01]"
                : "text-[#52665e] hover:text-[#1c2d26]"
            }`}
          >
            <UtensilsCrossed size={15} />
            <span>Katalog Menu {menuItems.length > 0 && `(${menuItems.length})`}</span>
          </button>
        </div>

        {activeNavTab === "home" ? (
          <>
            {/* QUICK ACTION GRID (4 ROUND BUTTONS) */}
            <section aria-label="Menu Cepat" className="grid grid-cols-4 gap-2 text-center pb-5">
              {/* Button 1: QR Member */}
              <button
                type="button"
                onClick={() => setShowQrModal(true)}
                className="flex flex-col items-center gap-1.5 group active:scale-95 transition-transform"
              >
                <div className="flex h-13 w-13 items-center justify-center rounded-full border-2 border-[#167052] bg-[#edf8f3] text-[#167052] shadow-sm group-hover:bg-[#167052] group-hover:text-white transition-colors">
                  <QrCode size={22} strokeWidth={2.2} />
                </div>
                <span className="text-[11px] font-extrabold text-[#20372e] tracking-tight">
                  QR Kasir
                </span>
              </button>

              {/* Button 2: Voucher */}
              <button
                type="button"
                onClick={() => setShowVoucherModal(true)}
                className="flex flex-col items-center gap-1.5 group active:scale-95 transition-transform relative"
              >
                <div className="flex h-13 w-13 items-center justify-center rounded-full border-2 border-[#ea580c] bg-[#fff7ed] text-[#ea580c] shadow-sm group-hover:bg-[#ea580c] group-hover:text-white transition-colors">
                  <Ticket size={22} strokeWidth={2.2} />
                </div>
                {activeVoucherCount > 0 && (
                  <span className="absolute top-0 right-3 flex h-4 w-4 items-center justify-center rounded-full bg-[#ea580c] text-[9px] font-black text-white">
                    {activeVoucherCount}
                  </span>
                )}
                <span className="text-[11px] font-extrabold text-[#20372e] tracking-tight">
                  Voucher
                </span>
              </button>

              {/* Button 3: Katalog Menu (Opens Menu Tab) */}
              <button
                type="button"
                onClick={() => {
                  setActiveNavTab("menu");
                  window.scrollTo({ top: 380, behavior: "smooth" });
                }}
                className="flex flex-col items-center gap-1.5 group active:scale-95 transition-transform"
              >
                <div className="flex h-13 w-13 items-center justify-center rounded-full border-2 border-[#167052] bg-[#edf8f3] text-[#167052] shadow-sm group-hover:bg-[#167052] group-hover:text-white transition-colors">
                  <UtensilsCrossed size={22} strokeWidth={2.2} />
                </div>
                <span className="text-[11px] font-extrabold text-[#20372e] tracking-tight">
                  Katalog Menu
                </span>
              </button>

              {/* Button 4: Profil & Pengaturan (FIXED DIRECT ACCESS) */}
              <button
                type="button"
                onClick={() => setShowProfileModal(true)}
                className="flex flex-col items-center gap-1.5 group active:scale-95 transition-transform"
              >
                <div className="flex h-13 w-13 items-center justify-center rounded-full border-2 border-[#0b3d2e] bg-[#edf8f3] text-[#0b3d2e] shadow-sm group-hover:bg-[#0b3d2e] group-hover:text-[#c8f53a] transition-colors">
                  <User size={22} strokeWidth={2.2} />
                </div>
                <span className="text-[11px] font-extrabold text-[#20372e] tracking-tight">
                  Profil Saya
                </span>
              </button>
            </section>

            {/* ============================================================= */}
            {/* 3-TIER MEMBERSHIP CARD SHOWCASE (REGULER, PERAK, EMAS)        */}
            {/* ============================================================= */}
            <section aria-label="Status & Kartu Keanggotaan" className="mb-6 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-sm font-black text-[#1c2d26] tracking-tight flex items-center gap-1.5">
                    <Crown size={15} className="text-[#167052]" />
                    <span>Kartu Status Keanggotaan</span>
                  </h2>
                  <p className="text-[11px] text-[#718078]">
                    Pilih kartu untuk melihat desain &amp; keuntungan tiap level
                  </p>
                </div>
                <span className="text-[10.5px] font-mono text-[#167052] font-bold bg-[#edf8f3] px-2 py-0.5 rounded-md border border-[#c5d8cf]">
                  Level Anda: {userCurrentTierKey.toUpperCase()}
                </span>
              </div>

              {/* TIER TABS SELECTOR (REGULER, PERAK 🔒, EMAS 🔒) */}
              <div className="grid grid-cols-3 gap-1.5 p-1 rounded-2xl bg-[#e5ede9] text-xs font-bold shadow-inner">
                <button
                  type="button"
                  onClick={() => setSelectedCardTier("reguler")}
                  className={`flex items-center justify-center gap-1 py-2 px-1 rounded-xl transition-all ${
                    selectedCardTier === "reguler"
                      ? "bg-[#0b3d2e] text-[#c8f53a] shadow-sm"
                      : "text-[#52665e] hover:text-[#1c2d26]"
                  }`}
                >
                  <span>🌿 Reguler</span>
                  {userCurrentTierKey === "reguler" && <Check size={12} className="text-[#c8f53a]" />}
                </button>

                <button
                  type="button"
                  onClick={() => setSelectedCardTier("perak")}
                  className={`flex items-center justify-center gap-1 py-2 px-1 rounded-xl transition-all ${
                    selectedCardTier === "perak"
                      ? "bg-slate-800 text-slate-100 shadow-sm"
                      : "text-[#52665e] hover:text-[#1c2d26]"
                  }`}
                >
                  <span>🥈 Perak</span>
                  {lifetimeSpend >= tierConfig.perak.min_lifetime_spend ? (
                    <Check size={12} className="text-emerald-400" />
                  ) : (
                    <Lock size={11} className="text-amber-600" />
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => setSelectedCardTier("emas")}
                  className={`flex items-center justify-center gap-1 py-2 px-1 rounded-xl transition-all ${
                    selectedCardTier === "emas"
                      ? "bg-gradient-to-r from-amber-700 to-amber-900 text-amber-100 shadow-sm"
                      : "text-[#52665e] hover:text-[#1c2d26]"
                  }`}
                >
                  <span>👑 Emas</span>
                  {lifetimeSpend >= tierConfig.emas.min_lifetime_spend ? (
                    <Check size={12} className="text-[#c8f53a]" />
                  ) : (
                    <Lock size={11} className="text-amber-500" />
                  )}
                </button>
              </div>

              {/* CARD PREVIEW CONTAINER */}
              {selectedCardTier === "reguler" && (
                /* CARD 1: REGULER CARD (EMERALD BRONZE) */
                <div className="relative overflow-hidden rounded-3xl border-2 border-emerald-700/50 bg-gradient-to-br from-[#0a3528] via-[#0d4a37] to-[#06241a] p-5 text-white shadow-xl space-y-4 animate-in fade-in">
                  <div className="absolute top-0 right-0 w-44 h-44 bg-emerald-400/10 rounded-full blur-3xl pointer-events-none" />
                  
                  {/* Top Bar: Brand & Status Badge */}
                  <div className="flex items-start justify-between gap-2 relative z-10">
                    <div className="space-y-0.5">
                      <span className="font-mono text-[10px] tracking-widest text-[#c8f53a] uppercase font-bold">
                        {business.name} · MEMBER PASS
                      </span>
                      <h3 className="text-lg font-black tracking-tight text-white flex items-center gap-1.5">
                        <span>Mochi Reguler Pass</span>
                      </h3>
                    </div>

                    <span className="inline-flex items-center gap-1 rounded-full bg-[#c8f53a] text-[#073829] px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wider shadow-xs">
                      <Check size={11} strokeWidth={3} />
                      {userCurrentTierKey === "reguler" ? "Kartu Aktif" : "Level Terbuka"}
                    </span>
                  </div>

                  {/* Card Chip & Points Multiplier */}
                  <div className="flex items-center justify-between py-1 relative z-10">
                    <div className="flex items-center gap-2">
                      <div className="h-8 w-11 rounded-md bg-gradient-to-tr from-amber-600 to-amber-300 border border-amber-400/50 shadow-xs flex items-center justify-center">
                        <div className="h-4 w-6 border-y border-amber-800/40" />
                      </div>
                      <span className="font-mono text-[11px] text-emerald-200/90 font-bold">
                        1.0x Poin Belanja
                      </span>
                    </div>

                    <span className="font-mono text-xs font-black text-[#c8f53a]">
                      Min. Belanja: Rp 0
                    </span>
                  </div>

                  {/* Card Footer: Holder Info */}
                  <div className="flex items-end justify-between border-t border-emerald-600/30 pt-3 relative z-10">
                    <div>
                      <span className="text-[9.5px] uppercase font-mono text-emerald-200/70 block">
                        Nama Pemegang Kartu
                      </span>
                      <p className="font-black text-sm text-white tracking-wide truncate max-w-[200px]">
                        {customer.name}
                      </p>
                    </div>
                    <div className="text-right">
                      <span className="text-[9.5px] uppercase font-mono text-emerald-200/70 block">
                        Saldo Poin
                      </span>
                      <p className="font-mono text-sm font-black text-[#c8f53a]">
                        {balance} Pts
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {selectedCardTier === "perak" && (
                /* CARD 2: PERAK (SILVER PLATINUM VIP) */
                <div className="relative overflow-hidden rounded-3xl border-2 border-slate-400/60 bg-gradient-to-br from-[#1e293b] via-[#334155] to-[#0f172a] p-5 text-white shadow-xl space-y-4 animate-in fade-in">
                  <div className="absolute top-0 right-0 w-44 h-44 bg-slate-300/15 rounded-full blur-3xl pointer-events-none" />
                  
                  {/* Top Bar: Brand & Status Badge */}
                  <div className="flex items-start justify-between gap-2 relative z-10">
                    <div className="space-y-0.5">
                      <span className="font-mono text-[10px] tracking-widest text-slate-300 uppercase font-bold flex items-center gap-1">
                        <Sparkles size={11} className="text-slate-200" />
                        {business.name} · SILVER VIP
                      </span>
                      <h3 className="text-lg font-black tracking-tight text-white flex items-center gap-1.5">
                        <span>Mochi Silver VIP Pass</span>
                      </h3>
                    </div>

                    {lifetimeSpend >= tierConfig.perak.min_lifetime_spend ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 text-slate-900 px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wider shadow-xs">
                        <Check size={11} strokeWidth={3} />
                        {userCurrentTierKey === "perak" ? "Kartu Aktif" : "Level Terbuka"}
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/20 border border-amber-400/40 text-amber-300 px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wider">
                        <Lock size={10} />
                        Terkunci
                      </span>
                    )}
                  </div>

                  {/* Card Chip & Multiplier */}
                  <div className="flex items-center justify-between py-1 relative z-10">
                    <div className="flex items-center gap-2">
                      <div className="h-8 w-11 rounded-md bg-gradient-to-tr from-slate-400 to-slate-100 border border-slate-200/70 shadow-xs flex items-center justify-center">
                        <div className="h-4 w-6 border-y border-slate-600/40" />
                      </div>
                      <span className="font-mono text-[11px] text-slate-200 font-bold">
                        ⚡ 1.25x Poin Belanja (+25%)
                      </span>
                    </div>

                    <span className="font-mono text-xs font-black text-slate-200">
                      Min. {formatRupiah(tierConfig.perak.min_lifetime_spend)}
                    </span>
                  </div>

                  {/* Locked / Unlocked Progress Bar */}
                  {lifetimeSpend < tierConfig.perak.min_lifetime_spend ? (
                    <div className="rounded-xl bg-black/40 border border-white/10 p-2.5 space-y-1.5 text-xs relative z-10">
                      <div className="flex items-center justify-between text-[10.5px]">
                        <span className="text-slate-300 flex items-center gap-1">
                          <Lock size={11} className="text-amber-400" />
                          Syarat Buka Level Perak:
                        </span>
                        <span className="font-mono text-amber-300 font-bold">
                          {formatRupiah(lifetimeSpend)} / {formatRupiah(tierConfig.perak.min_lifetime_spend)}
                        </span>
                      </div>
                      <div className="h-2 w-full rounded-full bg-white/15 overflow-hidden">
                        <div
                          className="h-full rounded-full bg-gradient-to-r from-amber-400 to-slate-200"
                          style={{
                            width: `${Math.min(100, Math.round((lifetimeSpend / Math.max(1, tierConfig.perak.min_lifetime_spend)) * 100))}%`,
                          }}
                        />
                      </div>
                      <p className="text-[10px] text-slate-300 leading-tight">
                        Belanja <strong>{formatRupiah(Math.max(0, tierConfig.perak.min_lifetime_spend - lifetimeSpend))}</strong> lagi di kasir untuk otomatis mengaktifkan kartu ini!
                      </p>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 rounded-xl bg-emerald-950/60 border border-emerald-500/30 p-2 text-xs text-emerald-300 relative z-10">
                      <CheckCircle2 size={14} className="shrink-0" />
                      <span>Selamat! Anda telah memenuhi syarat level Silver VIP.</span>
                    </div>
                  )}

                  {/* Card Footer: Holder Info */}
                  <div className="flex items-end justify-between border-t border-slate-500/30 pt-3 relative z-10">
                    <div>
                      <span className="text-[9.5px] uppercase font-mono text-slate-400 block">
                        Nama Pemegang Kartu
                      </span>
                      <p className="font-black text-sm text-white tracking-wide truncate max-w-[200px]">
                        {customer.name}
                      </p>
                    </div>
                    <div className="text-right">
                      <span className="text-[9.5px] uppercase font-mono text-slate-400 block">
                        Poin Boost
                      </span>
                      <p className="font-mono text-sm font-black text-slate-200">
                        1.25x Multiplier
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {selectedCardTier === "emas" && (
                /* CARD 3: EMAS (GOLD PRESTIGE VIP) */
                <div className="relative overflow-hidden rounded-3xl border-2 border-amber-400/70 bg-gradient-to-br from-[#1c1917] via-[#291e0a] to-[#0c0a09] p-5 text-white shadow-2xl space-y-4 animate-in fade-in">
                  <div className="absolute top-0 right-0 w-44 h-44 bg-amber-400/20 rounded-full blur-3xl pointer-events-none" />
                  
                  {/* Top Bar: Brand & Status Badge */}
                  <div className="flex items-start justify-between gap-2 relative z-10">
                    <div className="space-y-0.5">
                      <span className="font-mono text-[10px] tracking-widest text-amber-300 uppercase font-bold flex items-center gap-1">
                        <Crown size={12} className="text-amber-400" />
                        {business.name} · GOLD PRESTIGE VIP
                      </span>
                      <h3 className="text-lg font-black tracking-tight text-white flex items-center gap-1.5">
                        <span>Mochi Gold Prestige Pass</span>
                      </h3>
                    </div>

                    {lifetimeSpend >= tierConfig.emas.min_lifetime_spend ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-gradient-to-r from-amber-400 to-yellow-300 text-amber-950 px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wider shadow-xs">
                        <Crown size={11} />
                        Kartu Aktif
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 rounded-full bg-amber-950/80 border border-amber-500/40 text-amber-300 px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wider">
                        <Lock size={10} />
                        Terkunci
                      </span>
                    )}
                  </div>

                  {/* Card Chip & Multiplier */}
                  <div className="flex items-center justify-between py-1 relative z-10">
                    <div className="flex items-center gap-2">
                      <div className="h-8 w-11 rounded-md bg-gradient-to-tr from-yellow-600 via-amber-400 to-yellow-200 border border-yellow-300 shadow-md flex items-center justify-center">
                        <div className="h-4 w-6 border-y border-amber-900/50" />
                      </div>
                      <span className="font-mono text-[11px] text-amber-300 font-bold">
                        👑 1.5x Poin Belanja (+50%)
                      </span>
                    </div>

                    <span className="font-mono text-xs font-black text-amber-300">
                      Min. {formatRupiah(tierConfig.emas.min_lifetime_spend)}
                    </span>
                  </div>

                  {/* Locked / Unlocked Progress Bar */}
                  {lifetimeSpend < tierConfig.emas.min_lifetime_spend ? (
                    <div className="rounded-xl bg-black/60 border border-amber-500/30 p-2.5 space-y-1.5 text-xs relative z-10">
                      <div className="flex items-center justify-between text-[10.5px]">
                        <span className="text-amber-200 flex items-center gap-1">
                          <Lock size={11} className="text-amber-400" />
                          Syarat Buka Level Emas:
                        </span>
                        <span className="font-mono text-amber-300 font-bold">
                          {formatRupiah(lifetimeSpend)} / {formatRupiah(tierConfig.emas.min_lifetime_spend)}
                        </span>
                      </div>
                      <div className="h-2 w-full rounded-full bg-white/15 overflow-hidden">
                        <div
                          className="h-full rounded-full bg-gradient-to-r from-amber-500 to-yellow-300"
                          style={{
                            width: `${Math.min(100, Math.round((lifetimeSpend / Math.max(1, tierConfig.emas.min_lifetime_spend)) * 100))}%`,
                          }}
                        />
                      </div>
                      <p className="text-[10px] text-amber-200/90 leading-tight">
                        Belanja <strong>{formatRupiah(Math.max(0, tierConfig.emas.min_lifetime_spend - lifetimeSpend))}</strong> lagi di kasir untuk otomatis mengaktifkan kartu Gold Prestige ini!
                      </p>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 rounded-xl bg-amber-950/80 border border-amber-400/40 p-2 text-xs text-amber-300 relative z-10">
                      <Crown size={14} className="shrink-0 text-amber-400" />
                      <span>Prestisius! Anda adalah Member Gold VIP Mochi Cafe.</span>
                    </div>
                  )}

                  {/* Card Footer: Holder Info */}
                  <div className="flex items-end justify-between border-t border-amber-600/30 pt-3 relative z-10">
                    <div>
                      <span className="text-[9.5px] uppercase font-mono text-amber-400/80 block">
                        Nama Pemegang Kartu
                      </span>
                      <p className="font-black text-sm text-white tracking-wide truncate max-w-[200px]">
                        {customer.name}
                      </p>
                    </div>
                    <div className="text-right">
                      <span className="text-[9.5px] uppercase font-mono text-amber-400/80 block">
                        Keuntungan Tertinggi
                      </span>
                      <p className="font-mono text-sm font-black text-amber-300">
                        1.5x Multiplier &amp; VIP
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* BENEFIT HIGHLIGHT BOX FOR SELECTED TIER */}
              <div className="rounded-2xl border border-[#d8e3de] bg-white p-3.5 space-y-2 shadow-xs">
                <h4 className="text-xs font-black text-[#1c2d26] flex items-center gap-1.5">
                  <Award size={14} className="text-[#167052]" />
                  <span>Keuntungan Eksklusif Level {selectedCardTier.toUpperCase()}:</span>
                </h4>
                <ul className="text-[11px] text-[#556b62] space-y-1.5">
                  {selectedCardTier === "reguler" && (
                    <>
                      <li className="flex items-start gap-2">
                        <span className="text-[#167052] font-bold">✓</span>
                        <span>Dapat 1 Poin per kelipatan kurs belanja ({formatRupiah(program.earn_rate || 1000)} = 1 Pts).</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="text-[#167052] font-bold">✓</span>
                        <span>Akses tukar seluruh katalog voucher hadiah makanan &amp; minuman Mochi.</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="text-[#167052] font-bold">✓</span>
                        <span>Bonus poin referral ajak teman &amp; ucapan ulang tahun.</span>
                      </li>
                    </>
                  )}

                  {selectedCardTier === "perak" && (
                    <>
                      <li className="flex items-start gap-2 font-bold text-[#1c2d26]">
                        <span className="text-amber-600">⚡</span>
                        <span>1.25x Poin Booster (+25% lebih banyak poin di setiap transaksi).</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="text-[#167052] font-bold">✓</span>
                        <span>Voucher hadiah spesial khusus member Perak di bulan ulang tahun.</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="text-[#167052] font-bold">✓</span>
                        <span>Akses awal promo seasonal &amp; diskon produk tertentu.</span>
                      </li>
                    </>
                  )}

                  {selectedCardTier === "emas" && (
                    <>
                      <li className="flex items-start gap-2 font-bold text-[#1c2d26]">
                        <span className="text-amber-500">👑</span>
                        <span>1.5x Poin Booster (+50% poin maksimal di setiap pesanan).</span>
                      </li>
                      <li className="flex items-start gap-2 font-bold text-[#1c2d26]">
                        <span className="text-[#167052]">☕</span>
                        <span>Gratis 1 Minuman / Pastry Favorit Spesial saat hari ulang tahun.</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="text-[#167052] font-bold">✓</span>
                        <span>Undangan eksklusif VIP private tasting menu baru &amp; prioritas meja.</span>
                      </li>
                    </>
                  )}
                </ul>
              </div>
            </section>

            {/* ACTIVE VOUCHER HERO CARD (IF ANY) */}
            {activeVoucher && (
              <div className="mb-5 rounded-2xl border-2 border-[#ea580c] bg-gradient-to-r from-[#fff7ed] to-[#ffedd5] p-3.5 shadow-sm space-y-2">
                <div className="flex items-center justify-between">
                  <span className="inline-flex items-center gap-1 rounded-md bg-[#ea580c] px-2 py-0.5 text-[10px] font-black text-white uppercase tracking-wider">
                    Voucher Siap Pakai
                  </span>
                  <span className="font-mono text-[10.5px] text-[#9a3412] font-bold">
                    Tunjukkan ke Kasir
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="font-black text-sm text-[#7c2d12]">
                      {rewards.find((r) => r.id === activeVoucher.reward_id)?.name ?? "Voucher Hadiah"}
                    </h4>
                    <p className="text-[11px] text-[#9a3412]">
                      Kode: <strong className="font-mono font-black text-sm tracking-wider text-[#ea580c]">{activeVoucher.code}</strong>
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleCopy(activeVoucher.code)}
                    className="flex items-center gap-1 rounded-xl bg-white px-3 py-1.5 text-xs font-bold text-[#ea580c] shadow-xs border border-[#ea580c]/30 active:scale-95"
                  >
                    {copiedCode === activeVoucher.code ? <Check size={13} /> : <Copy size={13} />}
                    <span>{copiedCode === activeVoucher.code ? "Tersalin" : "Salin"}</span>
                  </button>
                </div>
              </div>
            )}

            {/* TARGET REWARD MILESTONE BAR */}
            {targetReward && (
              <div className="mb-6 rounded-2xl bg-white border border-[#d8e3de] p-4 shadow-xs space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold text-[#6f8279] uppercase tracking-wide">
                    Target Hadiah Berikutnya
                  </span>
                  <span className="text-xs font-black text-[#167052] font-mono">
                    {balance} / {targetReward.point_cost} Pts
                  </span>
                </div>

                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-[#edf8f3] text-[#167052]">
                      <Gift size={16} />
                    </span>
                    <h3 className="text-xs font-bold text-[#20372e] truncate">
                      {targetReward.name}
                    </h3>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowRewardModal(true)}
                    className="text-[11px] font-bold text-[#167052] hover:underline shrink-0"
                  >
                    Lihat
                  </button>
                </div>

                {/* Progress Bar */}
                <div className="h-2 w-full rounded-full bg-[#edf1ef] overflow-hidden">
                  <div
                    className="h-full rounded-full bg-[#167052] transition-all duration-500"
                    style={{ width: `${progressPct}%` }}
                  />
                </div>

                <p className="text-[10.5px] text-[#718078] leading-tight">
                  {pointsNeeded === 0
                    ? "🎉 Poin Anda sudah cukup! Klik tombol Tukar Hadiah untuk klaim voucher."
                    : `Kumpulkan ${pointsNeeded} poin lagi untuk mendapatkan hadiah ini.`}
                </p>
              </div>
            )}

            {/* PILIHAN MENU FAVORIT MOCHI */}
            {featuredMenuItems.length > 0 && (
              <section aria-label="Menu Favorit Mochi" className="mb-6 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-sm font-black text-[#1c2d26] tracking-tight flex items-center gap-1.5">
                      <Sparkles size={14} className="text-[#167052]" />
                      <span>Menu Favorit Mochi</span>
                    </h2>
                    <p className="text-[11px] text-[#718078]">
                      Dapatkan poin member tiap pesan menu di bawah
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setActiveNavTab("menu");
                      window.scrollTo({ top: 380, behavior: "smooth" });
                    }}
                    className="text-xs font-bold text-[#167052] hover:underline flex items-center gap-0.5 shrink-0"
                  >
                    <span>Lihat Semua</span>
                    <ChevronRight size={13} />
                  </button>
                </div>

                {/* 2-Column Responsive Grid */}
                <div className="grid grid-cols-2 gap-2.5">
                  {featuredMenuItems.slice(0, 4).map((item) => {
                    const earnedPts = Math.max(1, Math.floor(item.price / (program.earn_rate || 1000)));
                    return (
                      <div
                        key={item.id}
                        onClick={() => setSelectedMenuDetail(item)}
                        className="flex flex-col justify-between rounded-2xl bg-white border border-[#d8e3de] p-2.5 shadow-xs hover:border-[#167052]/40 transition-all group cursor-pointer"
                      >
                        <div className="space-y-2">
                          <div className="relative aspect-4/3 w-full rounded-xl overflow-hidden bg-[#edf8f3]">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              src={item.photo_url || PLACEHOLDER_MENU}
                              alt={item.name}
                              loading="lazy"
                              className="h-full w-full object-cover group-hover:scale-105 transition-transform duration-300"
                            />
                            <span className="absolute top-1.5 right-1.5 rounded-full bg-[#0b3d2e]/90 backdrop-blur-xs text-[#c8f53a] px-2 py-0.5 text-[9px] font-black font-mono shadow-xs">
                              +{earnedPts} Pts
                            </span>
                          </div>
                          <div>
                            <h3 className="text-xs font-black text-[#1c2d26] line-clamp-1 group-hover:text-[#167052] transition-colors">
                              {item.name}
                            </h3>
                            {item.description && (
                              <p className="text-[10px] text-[#718078] line-clamp-1 mt-0.5">
                                {item.description}
                              </p>
                            )}
                          </div>
                        </div>
                        <div className="mt-2.5 flex items-center justify-between pt-2 border-t border-[#f0f4f2]">
                          <span className="text-xs font-black font-mono text-[#0b3d2e]">
                            {formatRupiah(item.price)}
                          </span>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedMenuDetail(item);
                            }}
                            className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#edf8f3] text-[#167052] hover:bg-[#167052] hover:text-white transition-colors"
                            title="Lihat Detail Menu"
                          >
                            <Eye size={14} strokeWidth={2.2} />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </section>
            )}

            {/* RECENT TRANSACTIONS */}
            <section aria-label="Riwayat Transaksi" className="space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="text-base font-extrabold text-[#1c2d26] tracking-tight">
                  Aktivitas Terakhir
                </h2>
                <button
                  type="button"
                  onClick={() => setShowVoucherModal(true)}
                  className="text-xs font-bold text-[#167052] hover:underline"
                >
                  Lihat kupon
                </button>
              </div>

              {ledger.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-[#ccd9d3] bg-white p-6 text-center text-xs text-[#718078] space-y-1">
                  <Coffee size={24} className="mx-auto text-[#167052] opacity-50 mb-1" />
                  <p className="font-bold text-[#20372e]">Belum ada catatan aktivitas</p>
                  <p>Poin Anda akan otomatis bertambah saat berbelanja di kasir Mochi.</p>
                </div>
              ) : (
                <div className="divide-y divide-[#e5ede9] rounded-2xl bg-white border border-[#d8e3de] overflow-hidden shadow-xs">
                  {ledger.slice(0, 5).map((entry) => {
                    const isEarn = entry.delta > 0;
                    return (
                      <div key={entry.id} className="flex items-center justify-between p-3.5 hover:bg-[#fcfdfc] transition-colors">
                        <div className="flex items-center gap-3 min-w-0">
                          <div
                            className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${
                              isEarn
                                ? "bg-[#edf8f3] text-[#167052]"
                                : "bg-[#fff1f2] text-[#e11d48]"
                            }`}
                          >
                            {isEarn ? (
                              <Coffee size={18} strokeWidth={2} />
                            ) : (
                              <Gift size={18} strokeWidth={2} />
                            )}
                          </div>

                          <div className="min-w-0">
                            <h3 className="text-xs font-extrabold text-[#20372e] truncate">
                              {entry.reason === "purchase"
                                ? "Kunjungan & Belanja Kasir"
                                : entry.reason === "redeem"
                                ? "Tukar Voucher Hadiah"
                                : entry.reason === "referral"
                                ? "Bonus Ajak Teman"
                                : "Penyesuaian Stempel"}
                            </h3>
                            <p className="text-[10px] text-[#718078] font-mono">
                              {formatBusinessDateTime(entry.created_at)}
                            </p>
                          </div>
                        </div>

                        <div className="text-right shrink-0">
                          <span
                            className={`block text-xs font-black font-mono ${
                              isEarn ? "text-[#167052]" : "text-[#e11d48]"
                            }`}
                          >
                            {isEarn ? `+${entry.delta}` : entry.delta} Pts
                          </span>
                          <span className="text-[9.5px] font-bold text-[#8ba096]">
                            {isEarn ? "Berhasil" : "Klaim"}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </section>
          </>
        ) : (
          /* ================================================================= */
          /* DEDICATED MENU VIEW (KATALOG MENU MOCHI - CLEAN NO CONFUSING QR)  */
          /* ================================================================= */
          <section aria-label="Katalog Menu Mochi" className="space-y-4">
            {/* Elegant Menu Catalog Header */}
            <div className="rounded-2xl border border-[#c5d8cf] bg-white p-4 text-[#1c2d26] shadow-xs space-y-1">
              <div className="flex items-center gap-1.5 text-[#167052] text-[10px] font-black uppercase tracking-wider font-mono">
                <Coffee size={13} />
                <span>Katalog Menu &amp; Minuman Resmi</span>
              </div>
              <h2 className="text-base font-extrabold text-[#0b3d2e]">
                Daftar Menu Mochi Cafe n Resto
              </h2>
              <p className="text-[11px] text-[#556b62] leading-snug">
                Pesan di kasir atau pesan langsung dari meja kafe untuk kumpulkan poin loyalitas.
              </p>
            </div>

            {/* Search Bar */}
            <div className="relative">
              <Search
                size={16}
                className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#718078]"
              />
              <input
                type="text"
                value={menuSearchQuery}
                onChange={(e) => setMenuSearchQuery(e.target.value)}
                placeholder="Cari makanan, minuman, pastry..."
                className="w-full rounded-2xl border border-[#ccd9d3] bg-white pl-10 pr-9 py-2.5 text-xs text-[#1c2d26] placeholder-[#8ba096] focus:border-[#167052] focus:outline-hidden focus:ring-2 focus:ring-[#167052]/20 shadow-xs"
              />
              {menuSearchQuery && (
                <button
                  type="button"
                  onClick={() => setMenuSearchQuery("")}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[#8ba096] hover:text-[#1c2d26]"
                >
                  <X size={14} />
                </button>
              )}
            </div>

            {/* Category Filter Chips */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar text-xs">
              <button
                type="button"
                onClick={() => setSelectedMenuCategory("all")}
                className={`rounded-xl px-3 py-1.5 font-bold whitespace-nowrap transition-all ${
                  selectedMenuCategory === "all"
                    ? "bg-[#0b3d2e] text-[#c8f53a] shadow-xs"
                    : "bg-white border border-[#d8e3de] text-[#52665e] hover:bg-[#edf8f3]"
                }`}
              >
                Semua ({menuItems.length})
              </button>
              {menuCategories.map((cat) => (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => setSelectedMenuCategory(cat.id)}
                  className={`rounded-xl px-3 py-1.5 font-bold whitespace-nowrap transition-all ${
                    selectedMenuCategory === cat.id
                      ? "bg-[#0b3d2e] text-[#c8f53a] shadow-xs"
                      : "bg-white border border-[#d8e3de] text-[#52665e] hover:bg-[#edf8f3]"
                  }`}
                >
                  {cat.name} ({cat.count})
                </button>
              ))}
            </div>

            {/* Menu Grid (2-Columns) */}
            {filteredMenuItems.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-[#ccd9d3] bg-white p-8 text-center text-xs text-[#718078] space-y-2">
                <Coffee size={28} className="mx-auto text-[#167052] opacity-40" />
                <p className="font-bold text-[#20372e]">Menu tidak ditemukan</p>
                <p className="text-[11px]">
                  Coba kata kunci pencarian lain atau pilih kategori Semua.
                </p>
                {menuSearchQuery && (
                  <button
                    type="button"
                    onClick={() => {
                      setMenuSearchQuery("");
                      setSelectedMenuCategory("all");
                    }}
                    className="mt-2 inline-flex items-center gap-1 rounded-xl bg-[#edf8f3] text-[#167052] px-3 py-1.5 font-bold text-xs"
                  >
                    Reset Pencarian
                  </button>
                )}
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-2.5">
                {filteredMenuItems.map((item) => {
                  const earnedPts = Math.max(1, Math.floor(item.price / (program.earn_rate || 1000)));
                  return (
                    <div
                      key={item.id}
                      onClick={() => setSelectedMenuDetail(item)}
                      className="flex flex-col justify-between rounded-2xl bg-white border border-[#d8e3de] p-2.5 shadow-xs hover:border-[#167052]/40 transition-all group cursor-pointer"
                    >
                      <div className="space-y-2">
                        <div className="relative aspect-4/3 w-full rounded-xl overflow-hidden bg-[#edf8f3]">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={item.photo_url || PLACEHOLDER_MENU}
                            alt={item.name}
                            loading="lazy"
                            className="h-full w-full object-cover group-hover:scale-105 transition-transform duration-300"
                          />
                          <span className="absolute top-1.5 right-1.5 rounded-full bg-[#0b3d2e]/90 backdrop-blur-xs text-[#c8f53a] px-2 py-0.5 text-[9px] font-black font-mono shadow-xs">
                            +{earnedPts} Pts
                          </span>
                        </div>
                        <div>
                          <h3 className="text-xs font-black text-[#1c2d26] line-clamp-2 leading-tight group-hover:text-[#167052] transition-colors">
                            {item.name}
                          </h3>
                          {item.description && (
                            <p className="text-[10px] text-[#718078] line-clamp-2 mt-1 leading-snug">
                              {item.description}
                            </p>
                          )}
                        </div>
                      </div>
                      <div className="mt-3 flex items-center justify-between pt-2 border-t border-[#f0f4f2]">
                        <div>
                          <span className="block text-xs font-black font-mono text-[#0b3d2e]">
                            {formatRupiah(item.price)}
                          </span>
                          <span className="text-[9px] font-bold text-[#8ba096]">
                            +{earnedPts} poin
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedMenuDetail(item);
                          }}
                          className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#edf8f3] text-[#167052] hover:bg-[#167052] hover:text-white transition-colors"
                          title="Lihat Detail Menu"
                        >
                          <Eye size={14} strokeWidth={2.2} />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        )}

      </div>

      {/* =================================================================== */}
      {/* 5. FLOATING BOTTOM NAVIGATION BAR (DOCK)                            */}
      {/* =================================================================== */}
      <nav
        aria-label="Navigasi Utama"
        className="fixed bottom-3 inset-x-3 max-w-sm mx-auto z-40 bg-[#073829] text-emerald-100 rounded-[28px] p-2 px-4 shadow-[0_12px_40px_rgba(7,56,41,0.4)] flex items-center justify-between border border-emerald-700/30 backdrop-blur-md"
      >
        {/* Nav 1: Home */}
        <button
          type="button"
          onClick={() => {
            setActiveNavTab("home");
            window.scrollTo({ top: 0, behavior: "smooth" });
          }}
          className={`flex flex-col items-center gap-1 py-1 px-2.5 transition-colors ${
            activeNavTab === "home" ? "text-[#c8f53a]" : "text-emerald-200/70 hover:text-white"
          }`}
        >
          <Home size={19} strokeWidth={activeNavTab === "home" ? 2.6 : 2} />
          <span className="text-[9.5px] font-bold tracking-tight">Beranda</span>
        </button>

        {/* Nav 2: Voucher */}
        <button
          type="button"
          onClick={() => setShowVoucherModal(true)}
          className="flex flex-col items-center gap-1 py-1 px-2.5 text-emerald-200/70 hover:text-white transition-colors relative"
        >
          <Ticket size={19} />
          {activeVoucherCount > 0 && (
            <span className="absolute top-0 right-2 h-2 w-2 rounded-full bg-[#c8f53a]" />
          )}
          <span className="text-[9.5px] font-bold tracking-tight">Voucher</span>
        </button>

        {/* Center Floating FAB Button (QR CODE CASHIER QUICK ACTION) */}
        <button
          type="button"
          onClick={() => setShowQrModal(true)}
          aria-label="Tunjukkan QR Kasir"
          className="relative -mt-6 flex h-13 w-13 items-center justify-center rounded-full bg-[#c8f53a] hover:bg-[#d9ff57] text-[#073829] shadow-[0_8px_20px_rgba(200,245,58,0.4)] ring-4 ring-[#0b3d2e] active:scale-90 transition-transform"
          title="Tunjukkan QR Kasir"
        >
          <QrCode size={24} strokeWidth={2.4} />
        </button>

        {/* Nav 3: Menu */}
        <button
          type="button"
          onClick={() => {
            setActiveNavTab("menu");
            window.scrollTo({ top: 380, behavior: "smooth" });
          }}
          className={`flex flex-col items-center gap-1 py-1 px-2.5 transition-colors ${
            activeNavTab === "menu" ? "text-[#c8f53a]" : "text-emerald-200/70 hover:text-white"
          }`}
        >
          <UtensilsCrossed size={19} strokeWidth={activeNavTab === "menu" ? 2.6 : 2} />
          <span className="text-[9.5px] font-bold tracking-tight">Menu</span>
        </button>

        {/* Nav 4: Profil (PROMPTLY OPENS PROFILE MODAL) */}
        <button
          type="button"
          onClick={() => setShowProfileModal(true)}
          className="flex flex-col items-center gap-1 py-1 px-2.5 text-emerald-200/70 hover:text-white transition-colors"
          title="Buka Profil Member"
        >
          <User size={19} />
          <span className="text-[9.5px] font-bold tracking-tight">Profil</span>
        </button>
      </nav>

      {/* =================================================================== */}
      {/* MODAL 1: QR CODE FULLSCREEN (FOR CASHIER SCANNER)                   */}
      {/* =================================================================== */}
      {showQrModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-xs animate-in fade-in-50">
          <div className="w-full max-w-xs rounded-3xl bg-white p-6 text-center text-[#1c2d26] shadow-2xl space-y-4 animate-in zoom-in-95">
            <div className="flex items-center justify-between">
              <span className="text-xs font-black text-[#167052] uppercase tracking-wider font-mono">
                QR Member Kasir
              </span>
              <button
                type="button"
                onClick={() => setShowQrModal(false)}
                className="flex h-7 w-7 items-center justify-center rounded-full bg-[#edf1ef] text-[#718078] hover:text-[#1c2d26]"
              >
                <X size={15} />
              </button>
            </div>

            {/* QR Visual */}
            <div className="rounded-2xl border-2 border-[#167052] bg-white p-3 flex justify-center shadow-inner">
              <QrCodeComponent
                value={customer.token}
                size={200}
                label={`QR Member ${customer.name}`}
              />
            </div>

            <div className="space-y-0.5">
              <h3 className="text-base font-black text-[#1c2d26]">{customer.name}</h3>
              <p className="text-xs font-mono text-[#718078]">{maskPhoneNumber(customer.phone)}</p>
            </div>

            <p className="text-[11px] text-[#556b62] leading-relaxed">
              Tunjukkan QR ini kepada kasir saat pembayaran untuk menambah poin atau klaim hadiah.
            </p>

            <button
              type="button"
              onClick={() => setShowQrModal(false)}
              className="w-full rounded-2xl bg-[#0b3d2e] text-[#c8f53a] py-3 text-xs font-black shadow-md hover:bg-[#124634] active:scale-95 transition-all"
            >
              Tutup QR
            </button>
          </div>
        </div>
      )}

      {/* =================================================================== */}
      {/* MODAL 2: KATALOG REWARD                                             */}
      {/* =================================================================== */}
      {showRewardModal && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/70 p-0 sm:p-4 backdrop-blur-xs animate-in fade-in-50">
          <div className="w-full max-w-md rounded-t-[32px] sm:rounded-3xl bg-white p-5 sm:p-6 text-[#1c2d26] max-h-[85vh] flex flex-col shadow-2xl animate-in slide-in-from-bottom-10">
            <div className="flex items-center justify-between pb-3 border-b border-[#e5ede9]">
              <div>
                <h3 className="text-base font-black text-[#1c2d26]">Katalog Hadiah Mochi</h3>
                <p className="text-xs text-[#718078]">Poin Anda: <strong className="text-[#167052]">{balance} Pts</strong></p>
              </div>
              <button
                type="button"
                onClick={() => setShowRewardModal(false)}
                className="flex h-8 w-8 items-center justify-center rounded-full bg-[#edf1ef] text-[#718078]"
              >
                <X size={16} />
              </button>
            </div>

            <div className="overflow-y-auto py-3 space-y-2.5 flex-1 pr-1">
              {rewards.length === 0 ? (
                <p className="text-xs text-[#718078] text-center py-8">Belum ada daftar hadiah aktif.</p>
              ) : (
                rewards.map((r) => {
                  const canRedeem = balance >= r.point_cost;
                  return (
                    <div
                      key={r.id}
                      className={`flex items-center justify-between p-3.5 rounded-2xl border ${
                        canRedeem
                          ? "border-[#167052] bg-[#f2faf6]"
                          : "border-[#d8e3de] bg-white opacity-80"
                      }`}
                    >
                      <div className="min-w-0 pr-2">
                        <h4 className="text-xs font-black text-[#20372e]">{r.name}</h4>
                        <span className="text-[11px] font-mono text-[#167052] font-bold">
                          {r.point_cost} Poin
                        </span>
                        {r.market_value && (
                          <span className="text-[10px] text-[#718078] ml-2">
                            (Senilai {formatRupiah(r.market_value)})
                          </span>
                        )}
                      </div>

                      <button
                        type="button"
                        onClick={() => {
                          setShowRewardModal(false);
                          setShowQrModal(true);
                        }}
                        disabled={!canRedeem}
                        className={`rounded-xl px-3 py-1.5 text-xs font-extrabold shrink-0 ${
                          canRedeem
                            ? "bg-[#167052] text-white hover:bg-[#0f4f39] shadow-xs active:scale-95"
                            : "bg-[#e5ede9] text-[#718078] cursor-not-allowed"
                        }`}
                      >
                        {canRedeem ? "Tukar di Kasir" : `Kurang ${r.point_cost - balance} Pts`}
                      </button>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}

      {/* =================================================================== */}
      {/* MODAL 3: VOUCHER SAYA                                               */}
      {/* =================================================================== */}
      {showVoucherModal && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/70 p-0 sm:p-4 backdrop-blur-xs animate-in fade-in-50">
          <div className="w-full max-w-md rounded-t-[32px] sm:rounded-3xl bg-white p-5 sm:p-6 text-[#1c2d26] max-h-[85vh] flex flex-col shadow-2xl animate-in slide-in-from-bottom-10">
            <div className="flex items-center justify-between pb-3 border-b border-[#e5ede9]">
              <div>
                <h3 className="text-base font-black text-[#1c2d26]">Voucher &amp; Kupon Saya</h3>
                <p className="text-xs text-[#718078]">Daftar kupon yang siap dipakai di kasir</p>
              </div>
              <button
                type="button"
                onClick={() => setShowVoucherModal(false)}
                className="flex h-8 w-8 items-center justify-center rounded-full bg-[#edf1ef] text-[#718078]"
              >
                <X size={16} />
              </button>
            </div>

            <div className="overflow-y-auto py-3 space-y-3 flex-1 pr-1">
              {redemptions.length === 0 ? (
                <div className="text-center py-10 space-y-2">
                  <Ticket size={28} className="mx-auto text-[#718078] opacity-50" />
                  <p className="text-xs font-bold text-[#20372e]">Belum ada kupon aktif</p>
                  <p className="text-[11px] text-[#718078]">Tukar poin Anda dengan hadiah menarik di katalog!</p>
                </div>
              ) : (
                redemptions.map((red) => {
                  const isReady = red.status === "issued";
                  return (
                    <div
                      key={red.id}
                      className={`p-4 rounded-2xl border-2 ${
                        isReady
                          ? "border-[#ea580c] bg-[#fff7ed]"
                          : "border-[#d8e3de] bg-[#f8faf9] opacity-60"
                      } space-y-2`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-black text-[#7c2d12]">
                          {rewards.find((r) => r.id === red.reward_id)?.name ?? "Voucher Hadiah"}
                        </span>
                        <span
                          className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                            isReady ? "bg-[#ea580c] text-white" : "bg-gray-200 text-gray-700"
                          }`}
                        >
                          {isReady ? "Siap Ditukar" : "Sudah Digunakan"}
                        </span>
                      </div>

                      <div className="flex items-center justify-between bg-white p-2.5 rounded-xl border border-[#fed7aa]">
                        <div>
                          <span className="text-[10px] text-[#718078] block">Kode Voucher:</span>
                          <span className="font-mono text-sm font-black text-[#ea580c] tracking-wider">{red.code}</span>
                        </div>
                        {isReady && (
                          <button
                            type="button"
                            onClick={() => handleCopy(red.code)}
                            className="flex items-center gap-1 rounded-lg bg-[#ea580c] px-3 py-1.5 text-xs font-bold text-white shadow-xs"
                          >
                            {copiedCode === red.code ? <Check size={13} /> : <Copy size={13} />}
                            <span>{copiedCode === red.code ? "Tersalin" : "Salin"}</span>
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}

      {/* =================================================================== */}
      {/* MODAL 4: PROFIL, KARTU STATUS & PENGATURAN (RICH & RELIABLE)        */}
      {/* =================================================================== */}
      {showProfileModal && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/75 p-0 sm:p-4 backdrop-blur-xs animate-in fade-in-50">
          <div className="w-full max-w-md rounded-t-[32px] sm:rounded-3xl bg-white p-5 sm:p-6 text-[#1c2d26] max-h-[90vh] flex flex-col shadow-2xl animate-in slide-in-from-bottom-10 space-y-4 overflow-y-auto">
            {/* Modal Header */}
            <div className="flex items-center justify-between pb-3 border-b border-[#e5ede9]">
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#0b3d2e] text-[#c8f53a] font-extrabold text-base font-mono">
                  {firstName.slice(0, 2).toUpperCase()}
                </div>
                <div>
                  <h3 className="text-base font-black text-[#1c2d26]">{customer.name}</h3>
                  <p className="text-xs font-mono text-[#718078]">{maskPhoneNumber(customer.phone)} · {business.name}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowProfileModal(false)}
                className="flex h-8 w-8 items-center justify-center rounded-full bg-[#edf1ef] text-[#718078] hover:text-[#1c2d26]"
              >
                <X size={16} />
              </button>
            </div>

            {/* Member Stats Snapshot */}
            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="p-3 rounded-2xl bg-[#f8faf9] border border-[#d8e3de]">
                <span className="text-[10px] text-[#718078] uppercase font-mono block">Level</span>
                <span className="text-xs font-black text-[#167052] capitalize block mt-0.5">
                  {userCurrentTierKey}
                </span>
              </div>
              <div className="p-3 rounded-2xl bg-[#f8faf9] border border-[#d8e3de]">
                <span className="text-[10px] text-[#718078] uppercase font-mono block">Total Belanja</span>
                <span className="text-xs font-black text-[#0b3d2e] font-mono block mt-0.5">
                  {formatRupiah(lifetimeSpend)}
                </span>
              </div>
              <div className="p-3 rounded-2xl bg-[#f8faf9] border border-[#d8e3de]">
                <span className="text-[10px] text-[#718078] uppercase font-mono block">Kunjungan</span>
                <span className="text-xs font-black text-[#0b3d2e] font-mono block mt-0.5">
                  {visitCount} Kali
                </span>
              </div>
            </div>

            {/* Birthday Reward Form */}
            <div className="rounded-2xl border border-[#d8e3de] bg-[#f8faf9] p-3.5 space-y-2">
              <div className="flex items-center gap-2 text-xs font-extrabold text-[#20372e]">
                <Cake size={16} className="text-[#ea580c]" />
                <span>Hadiah Ulang Tahun Member</span>
              </div>
              {customer.birthday ? (
                <p className="text-xs text-[#167052] font-bold">
                  ✓ Tanggal lahir tercatat ({customer.birthday}). Hadiah kejutan akan otomatis aktif saat hari ulang tahun Anda!
                </p>
              ) : birthdaySaved ? (
                <p className="text-xs text-[#167052] font-bold">
                  ✓ Tanggal lahir berhasil disimpan! Sampai jumpa di hari spesialmu!
                </p>
              ) : (
                <div className="space-y-2">
                  <p className="text-[11px] text-[#718078]">
                    Daftarkan tanggal lahir Anda untuk mendapatkan voucher spesial traktiran Mochi di hari ulang tahun.
                  </p>
                  <div className="flex gap-2">
                    <input
                      type="date"
                      value={birthdayInput}
                      onChange={(e) => setBirthdayInput(e.target.value)}
                      className="rounded-xl border border-[#ccd9d3] bg-white px-3 py-1.5 text-xs text-[#1c2d26] flex-1 font-mono"
                    />
                    <button
                      type="button"
                      disabled={savingBirthday || !birthdayInput}
                      onClick={handleSaveBirthday}
                      className="rounded-xl bg-[#167052] px-3.5 py-1.5 text-xs font-bold text-white disabled:opacity-50"
                    >
                      {savingBirthday ? "..." : "Simpan"}
                    </button>
                  </div>
                  {birthdayError && <p className="text-[10px] text-red-500">{birthdayError}</p>}
                </div>
              )}
            </div>

            {/* Referral / Ajak Teman */}
            {referralLink && (
              <div className="rounded-2xl border border-[#d8e3de] bg-[#f8faf9] p-3.5 space-y-2">
                <div className="flex items-center gap-2 text-xs font-extrabold text-[#20372e]">
                  <Share2 size={16} className="text-[#167052]" />
                  <span>Program Ajak Teman (Referral)</span>
                </div>
                <p className="text-[11px] text-[#718078]">
                  Ajak teman gabung jadi member Mochi. Anda berdua akan mendapatkan bonus poin saat mereka berbelanja!
                </p>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    readOnly
                    value={referralLink}
                    className="flex-1 rounded-xl border border-[#ccd9d3] bg-white px-3 py-2 text-[10.5px] font-mono text-[#556b62]"
                  />
                  <button
                    type="button"
                    onClick={() => handleCopy(referralLink, true)}
                    className="rounded-xl bg-[#0b3d2e] px-3 py-2 text-xs font-bold text-[#c8f53a] shrink-0 active:scale-95"
                  >
                    {copiedReferral ? "Tersalin!" : "Salin Link"}
                  </button>
                </div>
              </div>
            )}

            {/* PDP Privacy Consent */}
            <div className="rounded-2xl border border-[#d8e3de] bg-[#f8faf9] p-3.5 space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-xs font-extrabold text-[#20372e]">
                  <ShieldCheck size={16} className="text-[#167052]" />
                  <span>Privasi Data &amp; Info Promo (UU PDP)</span>
                </div>
                <input
                  type="checkbox"
                  checked={marketingOptIn}
                  disabled={savingMarketing}
                  onChange={(e) => handleToggleMarketing(e.target.checked)}
                  className="h-4 w-4 rounded accent-[#167052]"
                />
              </div>
              <p className="text-[10.5px] text-[#718078]">
                Izinkan {business.name} mengirimkan info promo eksklusif dan voucher poin ke nomor WhatsApp Anda.
              </p>
            </div>

            {/* Store Contact & Customer Care */}
            <div className="rounded-2xl border border-[#d8e3de] bg-white p-3.5 space-y-2 text-xs">
              <div className="flex items-center justify-between text-[#20372e] font-extrabold">
                <span className="flex items-center gap-1.5">
                  <MapPin size={14} className="text-[#167052]" />
                  <span>Lokasi &amp; Kontak Toko</span>
                </span>
                {cardSettings?.whatsapp && (
                  <a
                    href={`https://wa.me/${cardSettings.whatsapp.replace(/\D/g, "")}`}
                    target="_blank"
                    rel="noreferrer"
                    className="text-[#167052] font-bold hover:underline flex items-center gap-1"
                  >
                    <MessageCircle size={13} />
                    <span>WhatsApp</span>
                  </a>
                )}
              </div>
              <p className="text-[11px] text-[#718078]">
                {business.address || "Mochi Cafe n Resto, Kawasan Bisnis Kuliner."}
              </p>
            </div>

            <button
              type="button"
              onClick={() => setShowProfileModal(false)}
              className="w-full rounded-2xl bg-[#0b3d2e] text-[#c8f53a] py-3 text-xs font-black shadow-md hover:bg-[#124634] active:scale-95 transition-all"
            >
              Tutup Profil &amp; Pengaturan
            </button>
          </div>
        </div>
      )}

      {/* =================================================================== */}
      {/* MODAL 5: DETAIL MENU & CARA PESAN                                   */}
      {/* =================================================================== */}
      {selectedMenuDetail && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/75 p-0 sm:p-4 backdrop-blur-xs animate-in fade-in-50">
          <div className="w-full max-w-sm rounded-t-[32px] sm:rounded-3xl bg-white p-5 text-[#1c2d26] max-h-[88vh] overflow-y-auto shadow-2xl animate-in slide-in-from-bottom-10 space-y-4">
            {/* Header */}
            <div className="flex items-center justify-between">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-[#edf8f3] px-3 py-1 text-[11px] font-bold text-[#167052]">
                <Coffee size={13} />
                <span>{categories?.find((c) => c.id === selectedMenuDetail.category_id)?.name || "Menu Mochi"}</span>
              </span>
              <button
                type="button"
                onClick={() => {
                  setSelectedMenuDetail(null);
                  setTableInput("");
                }}
                className="flex h-7 w-7 items-center justify-center rounded-full bg-[#edf1ef] text-[#718078] hover:text-[#1c2d26]"
              >
                <X size={15} />
              </button>
            </div>

            {/* Menu Image */}
            <div className="relative aspect-4/3 w-full rounded-2xl overflow-hidden bg-[#edf8f3] border border-[#e5ede9]">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={selectedMenuDetail.photo_url || PLACEHOLDER_MENU}
                alt={selectedMenuDetail.name}
                className="h-full w-full object-cover"
              />
              <span className="absolute top-2 right-2 rounded-full bg-[#0b3d2e]/90 backdrop-blur-xs text-[#c8f53a] px-2.5 py-1 text-[10px] font-black font-mono shadow-xs">
                +{Math.max(1, Math.floor(selectedMenuDetail.price / (program.earn_rate || 1000)))} Poin
              </span>
            </div>

            {/* Menu Info */}
            <div className="space-y-1">
              <div className="flex items-baseline justify-between gap-2">
                <h3 className="text-base font-black text-[#1c2d26]">
                  {selectedMenuDetail.name}
                </h3>
                <span className="text-sm font-black font-mono text-[#0b3d2e] shrink-0">
                  {formatRupiah(selectedMenuDetail.price)}
                </span>
              </div>
              {selectedMenuDetail.description && (
                <p className="text-xs text-[#556b62] leading-relaxed">
                  {selectedMenuDetail.description}
                </p>
              )}
            </div>

            {/* Loyalty Reward Callout */}
            <div className="rounded-xl border border-[#d8e3de] bg-[#f9fbf9] p-3 text-xs space-y-1">
              <div className="flex items-center gap-1.5 text-[#167052] font-black">
                <Sparkles size={14} />
                <span>Kumpulkan Poin Member</span>
              </div>
              <p className="text-[11px] text-[#556b62] leading-relaxed">
                Pesan menu ini di kasir dan tunjukkan QR Member Anda untuk mendapatkan +{Math.max(1, Math.floor(selectedMenuDetail.price / (program.earn_rate || 1000)))} poin loyalty.
              </p>
            </div>

            {/* Meja QR Ordering Option */}
            <div className="rounded-xl border border-[#ccd9d3] p-3 bg-white space-y-2">
              <div className="flex items-center gap-1.5 text-[11px] font-black text-[#1c2d26]">
                <UtensilsCrossed size={13} className="text-[#167052]" />
                <span>Sedang Duduk di Meja Kafe?</span>
              </div>
              <p className="text-[10px] text-[#718078]">
                Masukkan nomor meja Anda untuk langsung memesan dari tempat duduk:
              </p>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min="1"
                  max="99"
                  placeholder="No. Meja"
                  value={tableInput}
                  onChange={(e) => setTableInput(e.target.value)}
                  className="w-24 rounded-xl border border-[#ccd9d3] px-3 py-2 text-xs font-mono font-bold text-center focus:border-[#167052] focus:outline-hidden"
                />
                <button
                  type="button"
                  disabled={!tableInput || parseInt(tableInput, 10) < 1}
                  onClick={() => {
                    if (tableInput && parseInt(tableInput, 10) > 0) {
                      window.location.href = `/order/${encodeURIComponent(business.store_code || "MOCHIKAFE")}/${encodeURIComponent(tableInput.trim())}`;
                    }
                  }}
                  className="flex-1 rounded-xl bg-[#0b3d2e] py-2 text-xs font-bold text-[#c8f53a] disabled:opacity-40 disabled:cursor-not-allowed hover:bg-[#124634] transition-colors"
                >
                  Pesan di Meja {tableInput ? `#${tableInput}` : ""}
                </button>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex items-center gap-2 pt-1">
              <button
                type="button"
                onClick={() => {
                  setSelectedMenuDetail(null);
                  setShowQrModal(true);
                }}
                className="flex-1 flex items-center justify-center gap-1.5 rounded-2xl bg-[#c8f53a] py-3 text-xs font-black text-[#073829] shadow-sm hover:bg-[#b8e830] active:scale-95 transition-transform"
              >
                <QrCode size={14} />
                <span>Tunjuk QR di Kasir</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setSelectedMenuDetail(null);
                  setTableInput("");
                }}
                className="rounded-2xl border border-[#d8e3de] bg-white px-4 py-3 text-xs font-bold text-[#718078] hover:bg-[#f5f7f6]"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
