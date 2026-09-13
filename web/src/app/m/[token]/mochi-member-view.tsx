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
  Plus
} from "lucide-react";

import type { MemberPageData } from "./member-client";
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
  menuItems,
  visitCount,
}: MemberPageData) {
  // Modal states
  const [showQrModal, setShowQrModal] = useState(false);
  const [showRewardModal, setShowRewardModal] = useState(false);
  const [showVoucherModal, setShowVoucherModal] = useState(false);
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [activeNavTab, setActiveNavTab] = useState<"home" | "voucher" | "menu" | "profile">("home");

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

  if (!customer || !business || !program) return null;

  const sortedTiers = useMemo(
    () => [...tiers].sort((a, b) => a.min_lifetime_spend - b.min_lifetime_spend),
    [tiers],
  );
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
            <span>Mochi Member</span>
          </div>
        </div>

        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            {/* Avatar Circle */}
            <div className="relative flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-emerald-950 border-2 border-emerald-600/40 text-emerald-100 font-extrabold text-base shadow-sm overflow-hidden">
              <span className="font-mono text-sm">{firstName.slice(0, 2).toUpperCase()}</span>
            </div>

            <div className="min-w-0">
              <span className="block text-[11px] text-emerald-200/75 leading-tight font-medium">
                Halo,
              </span>
              <h1 className="truncate text-base font-extrabold text-white leading-snug tracking-tight">
                {customer.name}
              </h1>
            </div>
          </div>

          {/* Top Right Bell / Notification Pill */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setShowProfileModal(true)}
              aria-label="Profil dan Notifikasi"
              className="relative flex h-10 w-10 items-center justify-center rounded-full bg-white/10 hover:bg-white/15 border border-white/15 text-emerald-100 transition-colors active:scale-95"
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

          {/* DUAL PILL ACTION BUTTONS (EXACT TO MOCKUP: Fund & Send style) */}
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
        {/* 3. "YOUR WALLET" / MEMBERSHIP TIER STRIP                          */}
        {/* ================================================================= */}
        <div className="mt-5 rounded-2xl bg-black/25 border border-white/15 p-3 backdrop-blur-md">
          <div className="flex items-center justify-between pb-2">
            <span className="text-[11px] font-bold text-emerald-100 tracking-tight flex items-center gap-1.5">
              <Crown size={13} className="text-[#c8f53a]" />
              Status Keanggotaan
            </span>
            <span className="text-[10px] font-mono text-emerald-300/80">
              {currentTier?.name ?? "Member Reguler"}
            </span>
          </div>

          <div className="flex items-center gap-2 overflow-x-auto scrollbar-none pb-0.5">
            {/* Active Tier Pill (Lime Highlight) */}
            <span className="inline-flex items-center gap-1 rounded-full bg-[#c8f53a] text-[#0b3d2e] px-3 py-1 text-[10.5px] font-extrabold whitespace-nowrap shadow-xs">
              <Check size={11} strokeWidth={3} />
              {currentTier?.name ?? "Reguler"}
            </span>

            {/* Other Tiers or Info Pills */}
            {sortedTiers
              .filter((t) => t.id !== currentTier?.id)
              .map((tier) => (
                <span
                  key={tier.id}
                  className="rounded-full bg-white/10 border border-white/10 text-emerald-100/90 px-3 py-1 text-[10.5px] font-bold whitespace-nowrap"
                >
                  {tier.name}
                </span>
              ))}

            {sortedTiers.length === 0 && (
              <>
                <span className="rounded-full bg-white/10 border border-white/10 text-emerald-100/90 px-3 py-1 text-[10.5px] font-bold whitespace-nowrap">
                  Perak
                </span>
                <span className="rounded-full bg-white/10 border border-white/10 text-emerald-100/90 px-3 py-1 text-[10.5px] font-bold whitespace-nowrap">
                  Emas
                </span>
              </>
            )}

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
      {/* 4. WHITE SHEET CONTAINER (MATCHING MOCKUP LOWER HALF)               */}
      {/* =================================================================== */}
      <div className="rounded-t-[32px] bg-[#f8faf9] text-[#1c2d26] pt-6 pb-8 px-4 sm:px-5 shadow-[0_-8px_30px_rgba(0,0,0,0.15)] min-h-[480px]">
        
        {/* QUICK ACTION GRID (4 ROUND BUTTONS LIKE MOCKUP) */}
        <section aria-label="Menu Cepat" className="grid grid-cols-4 gap-2 text-center pb-6">
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

          {/* Button 3: Pesan Meja (QR Order) */}
          <Link
            href={`/order/${business.store_code || "MOCHIKAFE"}/1`}
            className="flex flex-col items-center gap-1.5 group active:scale-95 transition-transform"
          >
            <div className="flex h-13 w-13 items-center justify-center rounded-full border-2 border-[#0284c7] bg-[#f0f9ff] text-[#0284c7] shadow-sm group-hover:bg-[#0284c7] group-hover:text-white transition-colors">
              <UtensilsCrossed size={22} strokeWidth={2.2} />
            </div>
            <span className="text-[11px] font-extrabold text-[#20372e] tracking-tight">
              Pesan Meja
            </span>
          </Link>

          {/* Button 4: Review Google */}
          <button
            type="button"
            onClick={() => {
              if (business.google_place_id) {
                window.open(`https://search.google.com/local/writereview?placeid=${business.google_place_id}`, "_blank");
              } else {
                alert("Tautan Google Review sedang disiapkan oleh pengelola toko.");
              }
            }}
            className="flex flex-col items-center gap-1.5 group active:scale-95 transition-transform"
          >
            <div className="flex h-13 w-13 items-center justify-center rounded-full border-2 border-[#eab308] bg-[#fefce8] text-[#ca8a04] shadow-sm group-hover:bg-[#eab308] group-hover:text-white transition-colors">
              <Star size={22} strokeWidth={2.2} />
            </div>
            <span className="text-[11px] font-extrabold text-[#20372e] tracking-tight">
              Ulasan
            </span>
          </button>
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

        {/* ================================================================= */}
        {/* 5. RECENT TRANSACTIONS (MATCHING MOCKUP BOTTOM HALF)              */}
        {/* ================================================================= */}
        <section aria-label="Riwayat Transaksi" className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-extrabold text-[#1c2d26] tracking-tight">
              Aktivitas Terakhir
            </h2>
            <button
              type="button"
              onClick={() => setActiveNavTab("voucher")}
              className="text-xs font-bold text-[#167052] hover:underline"
            >
              Lihat semua
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

      </div>

      {/* =================================================================== */}
      {/* 6. FLOATING BOTTOM NAVIGATION BAR (MATCHING MOCKUP DOCK)            */}
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

        {/* Center Floating FAB Button (QR SCAN / AIRPLANE ICON STYLE) */}
        <button
          type="button"
          onClick={() => setShowQrModal(true)}
          aria-label="Tunjukkan QR Kasir"
          className="relative -mt-6 flex h-13 w-13 items-center justify-center rounded-full bg-[#c8f53a] hover:bg-[#d9ff57] text-[#073829] shadow-[0_8px_20px_rgba(200,245,58,0.4)] ring-4 ring-[#0b3d2e] active:scale-90 transition-transform"
        >
          <QrCode size={24} strokeWidth={2.4} />
        </button>

        {/* Nav 3: Menu */}
        <Link
          href={`/order/${business.store_code || "MOCHIKAFE"}/1`}
          className="flex flex-col items-center gap-1 py-1 px-2.5 text-emerald-200/70 hover:text-white transition-colors"
        >
          <UtensilsCrossed size={19} />
          <span className="text-[9.5px] font-bold tracking-tight">Menu</span>
        </Link>

        {/* Nav 4: Profil */}
        <button
          type="button"
          onClick={() => setShowProfileModal(true)}
          className="flex flex-col items-center gap-1 py-1 px-2.5 text-emerald-200/70 hover:text-white transition-colors"
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
      {/* MODAL 4: PROFIL & PENGATURAN                                        */}
      {/* =================================================================== */}
      {showProfileModal && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/70 p-0 sm:p-4 backdrop-blur-xs animate-in fade-in-50">
          <div className="w-full max-w-md rounded-t-[32px] sm:rounded-3xl bg-white p-5 sm:p-6 text-[#1c2d26] max-h-[85vh] flex flex-col shadow-2xl animate-in slide-in-from-bottom-10 space-y-4 overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-[#e5ede9]">
              <div>
                <h3 className="text-base font-black text-[#1c2d26]">Profil &amp; Privasi Member</h3>
                <p className="text-xs text-[#718078]">{business.name}</p>
              </div>
              <button
                type="button"
                onClick={() => setShowProfileModal(false)}
                className="flex h-8 w-8 items-center justify-center rounded-full bg-[#edf1ef] text-[#718078]"
              >
                <X size={16} />
              </button>
            </div>

            {/* Birthday Reward */}
            <div className="rounded-2xl border border-[#d8e3de] bg-[#f8faf9] p-3.5 space-y-2">
              <div className="flex items-center gap-2 text-xs font-extrabold text-[#20372e]">
                <Cake size={16} className="text-[#ea580c]" />
                <span>Hadiah Ulang Tahun</span>
              </div>
              {customer.birthday ? (
                <p className="text-xs text-[#167052] font-bold">
                  ✓ Tanggal lahir tercatat ({customer.birthday}). Hadiah kejutan akan dikirim di hari ulang tahun Anda!
                </p>
              ) : birthdaySaved ? (
                <p className="text-xs text-[#167052] font-bold">
                  ✓ Tanggal lahir berhasil disimpan!
                </p>
              ) : (
                <div className="space-y-2">
                  <p className="text-[11px] text-[#718078]">
                    Daftarkan tanggal lahir Anda untuk mendapatkan voucher spesial saat hari ulang tahun.
                  </p>
                  <div className="flex gap-2">
                    <input
                      type="date"
                      value={birthdayInput}
                      onChange={(e) => setBirthdayInput(e.target.value)}
                      className="rounded-xl border border-[#ccd9d3] bg-white px-3 py-1.5 text-xs text-[#1c2d26] flex-1"
                    />
                    <button
                      type="button"
                      disabled={savingBirthday || !birthdayInput}
                      onClick={handleSaveBirthday}
                      className="rounded-xl bg-[#167052] px-3 py-1.5 text-xs font-bold text-white disabled:opacity-50"
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
                  Bagikan tautan ini ke teman. Anda berdua akan mendapatkan bonus poin saat mereka berbelanja!
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
                    {copiedReferral ? "Tersalin!" : "Salin"}
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

            <button
              type="button"
              onClick={() => setShowProfileModal(false)}
              className="w-full rounded-2xl bg-[#f0f4f2] text-[#20372e] py-3 text-xs font-bold hover:bg-[#e2ebe6]"
            >
              Tutup Pengaturan
            </button>
          </div>
        </div>
      )}

    </div>
  );
}
