"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Gift,
  Sparkles,
  ShieldCheck,
  ArrowRight,
  Coffee,
  CheckCircle2,
  AlertCircle,
  Lock,
  UserPlus,
  User,
  Phone,
  Cake,
  CreditCard,
  Wifi,
  Star,
  Award,
  Crown
} from "lucide-react";
import type { Business, LoyaltyProgram } from "@/lib/types";
import { registerCustomerAction } from "@/lib/actions";
import { normalizePhoneNumber, isValidIndonesianPhoneNumber } from "@/lib/loyalty-engine";
import { formatRupiah } from "@/lib/formatters";
import { BusinessMark } from '@/components/business-mark';
import { isMochiBusiness } from "@/lib/mochi-brand";

export default function CustomerRegistrationPage({
  business,
  program,
  referralCode,
  referrerName,
}: {
  business: Business | null;
  program: LoyaltyProgram | null;
  referralCode?: string;
  referrerName?: string | null;
}) {
  const router = useRouter();

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [birthday, setBirthday] = useState("");
  const [consent, setConsent] = useState(true);
  const [marketingConsent, setMarketingConsent] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const isMochi = isMochiBusiness(business);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (!name.trim()) {
      setErrorMsg("Mohon masukkan nama Anda.");
      return;
    }

    const norm = normalizePhoneNumber(phone);
    if (!isValidIndonesianPhoneNumber(norm)) {
      setErrorMsg("Nomor WhatsApp tidak valid. Masukkan nomor yang benar (contoh: 08123456789).");
      return;
    }

    if (!consent) {
      setErrorMsg("Persetujuan privasi penyimpanan data diperlukan sesuai UU PDP.");
      return;
    }

    setIsLoading(true);

    try {
      if (!business) {
        setErrorMsg("Bisnis belum siap menerima pendaftaran.");
        setIsLoading(false);
        return;
      }
      const res = await registerCustomerAction(
        business.id, name.trim(), norm, consent, birthday || undefined, marketingConsent, referralCode,
      );
      if (res.ok) {
        if (res.data.alreadyMember || !res.data.token) {
          setErrorMsg("Nomor ini sudah terdaftar. Minta kasir toko membantu membuka kartu member Anda.");
          setIsLoading(false);
          return;
        }
        router.push(`/m/${res.data.token}`);
      } else {
        setErrorMsg(res.error);
        setIsLoading(false);
      }
    } catch (err: any) {
      setErrorMsg(err.message || "Terjadi kesalahan.");
      setIsLoading(false);
    }
  };

  if (isMochi) {
    return (
      <div className="min-h-screen bg-[#f7f4ed] text-[#1c2e26] font-sans flex flex-col justify-between relative overflow-x-hidden selection:bg-[#c8f53a] selection:text-[#073829]">
        {/* Subtle Ambient Glow Background */}
        <div className="pointer-events-none fixed top-0 left-1/2 -translate-x-1/2 w-[700px] h-[350px] bg-gradient-to-b from-[#0b3d2e]/10 to-transparent blur-3xl opacity-70" />

        {/* FLOATING TOP BRAND HEADER */}
        <header className="sticky top-3 z-30 px-4">
          <div className="mx-auto flex max-w-md items-center justify-between gap-3 rounded-full border border-[#0b3d2e]/15 bg-[#0b3d2e]/95 px-4 py-2.5 text-white shadow-[0_8px_30px_rgba(11,61,46,0.18)] backdrop-blur-md">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white p-0.5 shadow-sm border border-[#c8f53a]/50 overflow-hidden">
                <img
                  src={business?.logo_url || "/logo-mochi.png"}
                  alt={business?.name || "Mochi Cafe"}
                  className="h-full w-full object-contain rounded-full"
                />
              </div>
              <div className="min-w-0">
                <h2 className="truncate text-xs sm:text-sm font-extrabold tracking-tight text-white leading-tight">
                  {business?.name || "Mochi Cafe n Resto"}
                </h2>
                <span className="block text-[10px] text-emerald-200/85 truncate">
                  Padang Panjang · Sumatra Barat
                </span>
              </div>
            </div>
            
            <div className="flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1 border border-white/15 text-[10px] font-mono font-bold text-[#c8f53a] shrink-0 tracking-wider">
              <Crown size={11} className="text-[#c8f53a]" />
              <span>VIP CLUB</span>
            </div>
          </div>
        </header>

        {/* MAIN CONTAINER */}
        <main className="flex-1 flex flex-col items-center justify-center px-4 py-6 sm:py-8 my-auto relative z-10">
          <div className="w-full max-w-md space-y-4 sm:space-y-5 my-auto">

            {/* 1. INTERACTIVE DIGITAL MEMBERSHIP CARD (VIP PASS) */}
            <div className="relative rounded-[28px] p-5 sm:p-6 text-white bg-gradient-to-br from-[#0c4031] via-[#072a1f] to-[#041a13] shadow-[0_20px_50px_rgba(11,61,46,0.28)] border border-emerald-500/25 overflow-hidden transition-all group">
              {/* Gold / Lime Holographic Ambient Corner Glow */}
              <div className="pointer-events-none absolute -top-16 -right-16 h-48 w-48 rounded-full bg-[#c8f53a]/20 blur-2xl" />
              <div className="pointer-events-none absolute -bottom-16 -left-16 h-48 w-48 rounded-full bg-emerald-500/15 blur-2xl" />

              {/* Card Top Row: Brand & Contactless Chip */}
              <div className="relative z-10 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-white/10 border border-white/15 backdrop-blur-xs text-[#c8f53a]">
                    <Sparkles size={14} />
                  </div>
                  <div>
                    <span className="text-[9px] font-mono tracking-[0.2em] uppercase text-emerald-200/80 block font-bold">
                      OFFICIAL MEMBERSHIP
                    </span>
                    <span className="text-xs font-black tracking-tight text-white block">
                      Mochi Privilege Pass
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-1 text-emerald-300/80 font-mono text-[10px]">
                  <Wifi size={13} className="rotate-90 text-[#c8f53a]" />
                  <span>TAP &amp; EARN</span>
                </div>
              </div>

              {/* Card Middle: Customer Live Name Preview */}
              <div className="relative z-10 pt-4 pb-2 space-y-1">
                <span className="text-[9.5px] font-mono uppercase tracking-widest text-[#c8f53a] font-bold block">
                  NAMA MEMBER
                </span>
                <h3 className="text-lg sm:text-xl font-black tracking-wide text-white truncate font-sans uppercase">
                  {name.trim() ? name.trim() : "NAMA LENGKAP ANDA"}
                </h3>
                <p className="text-[11px] font-mono text-emerald-200/70 tracking-wider">
                  {phone.trim() ? phone.replace(/(\d{4})(?=\d)/g, "$1-") : "08••-••••-••••"}
                </p>
              </div>

              {/* Card Bottom Row: Tier Badge & Kurs Poin */}
              <div className="relative z-10 pt-3 border-t border-white/10 flex items-center justify-between text-xs font-mono">
                <div className="flex items-center gap-1.5">
                  <span className="flex h-2 w-2 rounded-full bg-[#c8f53a] animate-pulse" />
                  <span className="text-[10px] font-bold text-emerald-100 tracking-wider">AUTHENTIC MEMBER</span>
                </div>
                <span className="text-[10.5px] font-bold text-[#c8f53a] bg-white/10 px-2.5 py-0.5 rounded-full border border-[#c8f53a]/30">
                  {program?.mode === "stamp" ? "1 Kunjungan = 1 Stamp" : `${formatRupiah(program?.earn_rate ?? 10000)} = 1 Pts`}
                </span>
              </div>
            </div>

            {/* 2. 3-COLUMN VIP PRIVILEGES HIGHLIGHT */}
            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="rounded-2xl border border-[#0b3d2e]/10 bg-white/80 backdrop-blur-xs p-2.5 space-y-1 shadow-xs">
                <span className="flex h-7 w-7 mx-auto items-center justify-center rounded-xl bg-[#edf8f3] text-[#0b3d2e] font-black text-xs">
                  🎁
                </span>
                <span className="text-[11px] font-extrabold text-[#0b3d2e] block leading-tight">Cashback Poin</span>
                <span className="text-[9.5px] text-[#637d71] block font-medium">Tukar menu gratis</span>
              </div>

              <div className="rounded-2xl border border-[#0b3d2e]/10 bg-white/80 backdrop-blur-xs p-2.5 space-y-1 shadow-xs">
                <span className="flex h-7 w-7 mx-auto items-center justify-center rounded-xl bg-[#edf8f3] text-[#0b3d2e] font-black text-xs">
                  🎂
                </span>
                <span className="text-[11px] font-extrabold text-[#0b3d2e] block leading-tight">Traktiran Ultah</span>
                <span className="text-[9.5px] text-[#637d71] block font-medium">Voucher hari spesial</span>
              </div>

              <div className="rounded-2xl border border-[#0b3d2e]/10 bg-white/80 backdrop-blur-xs p-2.5 space-y-1 shadow-xs">
                <span className="flex h-7 w-7 mx-auto items-center justify-center rounded-xl bg-[#edf8f3] text-[#0b3d2e] font-black text-xs">
                  ⚡
                </span>
                <span className="text-[11px] font-extrabold text-[#0b3d2e] block leading-tight">Promo VIP</span>
                <span className="text-[9.5px] text-[#637d71] block font-medium">Akses promo khusus</span>
              </div>
            </div>

            {/* 3. FORM CARD (DOUBLE-BEZEL LUXURY ARCHITECTURE) */}
            <div className="rounded-[32px] border border-[#e2ece6] bg-white p-6 sm:p-7 shadow-[0_20px_60px_rgba(11,61,46,0.07)] space-y-5">
              
              {/* Header inside Form Card */}
              <div className="space-y-1">
                <h1 className="text-xl sm:text-2xl font-black tracking-tight text-[#0b3d2e]">
                  Daftar Member Mochi
                </h1>
                <p className="text-xs text-[#5a7569] font-medium leading-relaxed">
                  Isi data singkat berikut untuk langsung mendapatkan kartu member digital.
                </p>
              </div>

              {/* Referral Banner */}
              {referrerName && (
                <div className="rounded-2xl border border-emerald-300 bg-emerald-50/80 p-3 flex items-center gap-2.5 text-xs">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-[#0b3d2e] text-[#c8f53a] shadow-xs">
                    <UserPlus size={15} />
                  </span>
                  <p className="text-emerald-950 font-medium leading-snug">
                    Undangan spesial dari <strong className="text-[#0b3d2e] font-bold">{referrerName.trim().split(/\s+/)[0]}</strong>. Dapatkan bonus poin di kunjungan pertamamu!
                  </p>
                </div>
              )}

              {/* Error Alert */}
              {errorMsg && (
                <div className="rounded-2xl border border-rose-300 bg-rose-50 p-3.5 text-xs text-rose-800 flex items-start gap-2 shadow-xs">
                  <AlertCircle size={16} className="shrink-0 mt-0.5 text-rose-600" />
                  <span className="font-semibold">{errorMsg}</span>
                </div>
              )}

              {/* Form Elements */}
              <form onSubmit={handleSubmit} className="space-y-4 text-xs">
                
                {/* Field 1: Nama Lengkap */}
                <div className="space-y-1.5">
                  <label className="block font-bold text-xs text-[#18392f]">
                    Nama Lengkap / Panggilan: <span className="text-rose-500">*</span>
                  </label>
                  <div className="relative">
                    <User size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#768f83]" />
                    <input
                      type="text"
                      required
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="Contoh: Sarah Angelina"
                      className="w-full rounded-2xl border border-[#d6e2dc] bg-[#f9fbf9] pl-10 pr-4 py-3 text-sm font-bold text-[#18392f] placeholder-[#95a89f] focus:outline-none focus:border-[#0b3d2e] focus:bg-white focus:ring-4 focus:ring-[#0b3d2e]/8 transition-all"
                    />
                  </div>
                </div>

                {/* Field 2: WhatsApp */}
                <div className="space-y-1.5">
                  <label className="block font-bold text-xs text-[#18392f]">
                    Nomor WhatsApp: <span className="text-rose-500">*</span>
                  </label>
                  <div className="relative">
                    <Phone size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#768f83]" />
                    <input
                      type="tel"
                      required
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="Contoh: 0812-3456-7890"
                      className="w-full rounded-2xl border border-[#d6e2dc] bg-[#f9fbf9] pl-10 pr-4 py-3 text-sm font-bold text-[#18392f] placeholder-[#95a89f] focus:outline-none focus:border-[#0b3d2e] focus:bg-white focus:ring-4 focus:ring-[#0b3d2e]/8 transition-all"
                    />
                  </div>
                  <span className="text-[10.5px] text-[#698075] font-medium block pl-1">
                    Cukup sebut nama / 4 digit nomor WA ini ke kasir saat memesan.
                  </span>
                </div>

                {/* Field 3: Tanggal Lahir (Opsional) */}
                <div className="space-y-1.5">
                  <label className="block font-bold text-xs text-[#18392f]">
                    Tanggal Lahir (Opsional):
                  </label>
                  <div className="relative">
                    <Cake size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#768f83]" />
                    <input
                      type="date"
                      value={birthday}
                      onChange={(e) => setBirthday(e.target.value)}
                      className="w-full rounded-2xl border border-[#d6e2dc] bg-[#f9fbf9] pl-10 pr-4 py-2.5 text-xs font-bold text-[#18392f] focus:outline-none focus:border-[#0b3d2e] focus:bg-white focus:ring-4 focus:ring-[#0b3d2e]/8 transition-all"
                    />
                  </div>
                  <span className="text-[10.5px] text-[#698075] font-medium block pl-1">
                    Untuk voucher traktiran &amp; kejutan spesial di hari ulang tahun Anda.
                  </span>
                </div>

                {/* UU PDP Consent */}
                <div className="rounded-2xl border border-[#d6e5dd] bg-[#f4f9f6] p-3.5 space-y-2.5 text-[11px] leading-relaxed text-[#2c473b]">
                  <label className="flex items-start gap-2.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={consent}
                      onChange={(e) => setConsent(e.target.checked)}
                      className="mt-0.5 h-4 w-4 rounded accent-[#0b3d2e] shrink-0"
                    />
                    <span>
                      Saya menyetujui penyimpanan nomor WhatsApp &amp; nama untuk kartu member di <strong className="text-[#0b3d2e]">{business?.name || "Mochi Cafe n Resto"}</strong> (Kepatuhan UU PDP No. 27/2022).
                    </span>
                  </label>
                  <label className="flex items-start gap-2.5 cursor-pointer border-t border-[#dfeae3] pt-2">
                    <input
                      type="checkbox"
                      checked={marketingConsent}
                      onChange={(e) => setMarketingConsent(e.target.checked)}
                      className="mt-0.5 h-4 w-4 rounded accent-[#0b3d2e] shrink-0"
                    />
                    <span className="text-[#597367]">
                      Saya bersedia menerima info promo eksklusif &amp; pengingat poin lewat WhatsApp.
                    </span>
                  </label>
                </div>

                {/* Luxury Button-in-Button CTA */}
                <button
                  type="submit"
                  disabled={isLoading}
                  className="group w-full flex items-center justify-between rounded-full bg-[#0b3d2e] hover:bg-[#104a39] py-2.5 pl-6 pr-2.5 text-sm font-extrabold text-white shadow-[0_10px_28px_rgba(11,61,46,0.22)] transition-all active:scale-[0.98] disabled:opacity-50"
                >
                  <span className="tracking-wide">
                    {isLoading ? "Menyiapkan Kartu Member..." : "Buka Paspor Member Digital"}
                  </span>
                  
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#c8f53a] text-[#073829] shadow-sm transition-transform duration-300 group-hover:scale-105 group-hover:translate-x-0.5">
                    <ArrowRight size={17} strokeWidth={2.5} />
                  </div>
                </button>
              </form>

              {/* Trust Badge */}
              <div className="flex items-center justify-center gap-1.5 text-[11px] font-semibold text-[#5a7569] pt-1">
                <ShieldCheck size={14} className="text-emerald-700" />
                <span>Tanpa Password Rumit · Langsung Aktif di Kasir</span>
              </div>
            </div>

          </div>
        </main>

        {/* ELEGANT FOOTER */}
        <footer className="py-4 text-center text-[11px] text-[#789185] font-mono">
          <p>© {new Date().getFullYear()} {business?.name || "Mochi Cafe n Resto"} · KAEL Member Engine</p>
        </footer>
      </div>
    );
  }

  // Non-Mochi Standard Tenant Fallback
  return (
    <div className="min-h-screen bg-[#f7f6fc] text-[#232331] font-sans flex flex-col justify-center items-center p-4">
      
      <div className="w-full max-w-md rounded-3xl border border-[#dedee8] bg-white p-6 sm:p-8 shadow-xl space-y-6">
        
        {/* Merchant Branding */}
        <div className="text-center space-y-2">
          <div className="flex justify-center"><BusinessMark name={business?.name || 'Kafe'} logoUrl={business?.logo_url} brandColor={business?.brand_color}/></div>
          {business?.is_demo && <p className="text-xs font-bold text-amber-800">DEMO - gunakan data uji</p>}

          <div>
            <span className="text-[10.5px] font-mono font-bold text-[#7958d8] uppercase tracking-wider block">
              PROGRAM MEMBER RESMI
            </span>
            <h1 className="text-xl sm:text-2xl font-black text-[#232331]">
              {business?.name || "Toko Kami"}
            </h1>
          </div>

          <p className="text-xs text-[#7b7b8e]">
            Kumpulkan {program?.mode === "stamp" ? "stempel" : "poin"} setiap belanja dan nikmati berbagai traktiran menu gratis!
          </p>
        </div>

        {/* Referral Banner */}
        {referrerName && (
          <div className="rounded-2xl border-2 border-[#7958d8] bg-[#f0edff] p-3 flex items-center gap-2.5">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-[#7958d8] text-white">
              <UserPlus size={15} />
            </span>
            <p className="text-xs font-bold text-[#5b3fb0] leading-snug">
              Diajak oleh <span className="text-[#232331]">{referrerName.trim().split(/\s+/)[0]}</span>. Daftar sekarang, dan kalian berdua dapat bonus di belanja pertamamu.
            </p>
          </div>
        )}

        {/* Benefits Preview Pill */}
        <div className="rounded-2xl border border-[#dedee8] bg-[#fcfcfe] p-3 font-mono text-xs text-[#7b7b8e] flex items-center justify-between">
          <div className="flex items-center gap-2 text-[#16a34a] font-bold">
            <Sparkles size={15} />
            <span>Kurs {program?.mode === "stamp" ? "Stempel" : "Poin"}</span>
          </div>
          <span className="font-extrabold text-[#232331]">
            {program?.mode === "stamp" ? "1 Kunjungan = 1 Stamp" : `${formatRupiah(program?.earn_rate ?? 0)} = 1 Pts`}
          </span>
        </div>

        {/* Error Alert */}
        {errorMsg && (
          <div className="rounded-xl border border-[#ef4444] bg-[#feebee] p-3 text-xs font-mono text-[#ef4444] flex items-start gap-2">
            <AlertCircle size={15} className="shrink-0 mt-0.5" />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* Registration Form */}
        <form onSubmit={handleSubmit} className="space-y-4 font-sans text-xs">
          
          <div className="space-y-1">
            <label className="block font-mono font-bold text-[#232331]">
              Nama Lengkap Panggilan: <span className="text-[#ef4444]">*</span>
            </label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Contoh: Rian Pratama"
              className="w-full rounded-xl border border-[#dedee8] p-3 text-sm font-bold text-[#232331] focus:outline-none focus:ring-2 focus:ring-[#7958d8]"
            />
          </div>

          <div className="space-y-1">
            <label className="block font-mono font-bold text-[#232331]">
              Nomor WhatsApp: <span className="text-[#ef4444]">*</span>
            </label>
            <input
              type="tel"
              required
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="Contoh: 0813-1150-6025"
              className="w-full rounded-xl border border-[#dedee8] p-3 text-sm font-bold text-[#232331] focus:outline-none focus:ring-2 focus:ring-[#7958d8]"
            />
            <span className="text-[10px] text-[#7b7b8e] font-mono block">
              Dipakai kasir untuk mencari member saat transaksi kasir.
            </span>
          </div>

          <div className="space-y-1">
            <label className="block font-mono font-bold text-[#232331]">
              Tanggal Lahir (Opsional):
            </label>
            <input
              type="date"
              value={birthday}
              onChange={(e) => setBirthday(e.target.value)}
              className="w-full rounded-xl border border-[#dedee8] p-2.5 text-xs font-bold text-[#232331] bg-[#fcfcfe]"
            />
            <span className="text-[10px] text-[#7b7b8e] font-mono block">
              Untuk hadiah traktiran ulang tahun khusus member.
            </span>
          </div>

          {/* UU PDP Consent Checkbox */}
          <div className="rounded-xl border border-[#dedee8] bg-[#fcfcfe] p-3 space-y-2 font-mono text-[10.5px]">
            <label className="flex items-start gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={consent}
                onChange={(e) => setConsent(e.target.checked)}
                className="mt-0.5 h-4 w-4 rounded accent-[#232331]"
              />
              <span className="text-[#7b7b8e] leading-snug">
                Saya menyetujui penyimpanan nomor WhatsApp dan nama untuk keperluan program loyalitas member di <strong className="text-[#232331]">{business?.name}</strong> (Kepatuhan UU PDP No. 27/2022).
              </span>
            </label>
            <label className="flex items-start gap-2 cursor-pointer border-t border-[#dedee8] pt-2">
              <input
                type="checkbox"
                checked={marketingConsent}
                onChange={(e) => setMarketingConsent(e.target.checked)}
                className="mt-0.5 h-4 w-4 rounded accent-[#232331]"
              />
              <span className="text-[#5c5c70] leading-snug">
                Saya bersedia menerima info promo dan pengingat poin melalui WhatsApp. Pilihan ini boleh diubah kapan saja dari kartu member saya.
              </span>
            </label>
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full flex items-center justify-center gap-2 rounded-2xl bg-[#7958d8] py-3.5 text-sm font-black text-white shadow-lg hover:bg-[#6844ce] transition-transform active:scale-[0.98]"
          >
            <span>{isLoading ? "Menyiapkan Kartu..." : "Buka Paspor Member Saya"}</span>
            <ArrowRight size={16} />
          </button>

        </form>

        <div className="flex items-center justify-center gap-1.5 font-mono text-[10px] text-[#7b7b8e]">
          <ShieldCheck size={13} className="text-[#16a34a]" />
          <span>Privasi Terlindungi · Tanpa Password / Akun Rumit</span>
        </div>

      </div>

    </div>
  );
}
