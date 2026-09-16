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
  UserPlus
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
      <div className="min-h-screen bg-[#f4efe6] text-[#1d2823] font-sans flex flex-col justify-between relative overflow-x-hidden">
        {/* TOP APP HEADER - MATCHING MENU HEADER */}
        <header className="sticky top-0 z-30 border-b border-[#082f23] bg-[#0b3d2e] px-4 py-3.5 text-white shadow-md">
          <div className="mx-auto flex max-w-lg items-center justify-between gap-3">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white p-0.5 shadow-sm">
                <img
                  src={business?.logo_url || "/logo-mochi.png"}
                  alt={business?.name || "Mochi Cafe"}
                  className="h-full w-full object-contain rounded-full"
                />
              </div>
              <div className="min-w-0">
                <h2 className="truncate text-sm font-black tracking-tight text-white leading-tight">
                  {business?.name || "Mochi Cafe n Resto"}
                </h2>
                <span className="block text-[11px] font-medium text-emerald-200/90">
                  Padang Panjang · Sumatra Barat
                </span>
              </div>
            </div>
            <div className="flex h-8 items-center rounded-xl bg-[#c8f53a] px-3 font-mono text-[10.5px] font-black text-[#0b3d2e] shadow-xs uppercase tracking-wider shrink-0">
              Member Resmi
            </div>
          </div>
        </header>

        {/* MAIN CONTAINER */}
        <main className="flex-1 flex flex-col items-center justify-center p-4 sm:p-6 my-auto">
          <div className="w-full max-w-md rounded-[32px] border-2 border-[#0b3d2e]/15 bg-white p-6 sm:p-8 shadow-[0_20px_60px_rgba(11,61,46,0.08)] space-y-6 relative overflow-hidden my-4">
            {/* Subtle inner dashed border matching receipt/menu aesthetic */}
            <div className="pointer-events-none absolute inset-2 rounded-[26px] border border-dashed border-[#0b3d2e]/10" />

            {/* Floating food icons matching Mochi mascot vibe */}
            <div className="pointer-events-none absolute -top-1 -left-1 flex h-9 w-9 items-center justify-center rounded-full bg-emerald-50 text-sm shadow-xs border border-emerald-100">
              🍵
            </div>
            <div className="pointer-events-none absolute -top-1 -right-1 flex h-9 w-9 items-center justify-center rounded-full bg-emerald-50 text-sm shadow-xs border border-emerald-100">
              🍡
            </div>

            {/* Merchant Branding & Welcome */}
            <div className="text-center space-y-2 relative z-10 pt-1">
              <div className="inline-flex items-center gap-1.5 rounded-full bg-[#edf8f3] border border-[#bde2d1] px-3.5 py-1 text-xs font-black text-[#0b3d2e]">
                <Sparkles size={13} className="text-[#0b3d2e]" />
                <span>PASPOR LOYALITAS DIGITAL</span>
              </div>

              <h1 className="text-2xl sm:text-[28px] font-black tracking-tight text-[#0b3d2e] leading-tight pt-1">
                Daftar Member Mochi
              </h1>

              <p className="text-xs sm:text-[13px] leading-relaxed text-[#557064] font-medium max-w-xs mx-auto">
                Kumpulkan poin di setiap transaksi hidangan favoritmu, lalu nikmati menu gratis dan voucher eksklusif!
              </p>
            </div>

            {/* Referral Banner */}
            {referrerName && (
              <div className="relative z-10 rounded-2xl border border-emerald-300 bg-emerald-50/90 p-3.5 flex items-center gap-3">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#c8f53a] text-[#0b3d2e] shadow-xs">
                  <UserPlus size={16} />
                </span>
                <p className="text-xs font-bold text-emerald-950 leading-snug">
                  Diajak oleh <span className="font-extrabold text-[#0b3d2e]">{referrerName.trim().split(/\s+/)[0]}</span>. Daftar sekarang dan kalian berdua dapat traktiran bonus di transaksi pertamamu!
                </p>
              </div>
            )}

            {/* Kurs Poin Benefit Banner */}
            <div className="relative z-10 rounded-2xl border border-[#bde2d1] bg-[#edf8f3] p-3.5 text-xs text-[#0b3d2e] flex items-center justify-between shadow-xs">
              <div className="flex items-center gap-2 font-black">
                <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#c8f53a] text-[#0b3d2e]">
                  <Gift size={15} />
                </div>
                <span>Kurs {program?.mode === "stamp" ? "Stempel" : "Poin"}</span>
              </div>
              <span className="font-black text-xs text-[#073829] bg-[#c8f53a] px-3 py-1.5 rounded-xl shadow-xs">
                {program?.mode === "stamp" ? "1 Kunjungan = 1 Stamp" : `${formatRupiah(program?.earn_rate ?? 0)} = 1 Pts`}
              </span>
            </div>

            {/* Error Alert */}
            {errorMsg && (
              <div className="relative z-10 rounded-2xl border border-rose-300 bg-rose-50 p-3.5 text-xs text-rose-800 flex items-start gap-2 shadow-xs">
                <AlertCircle size={16} className="shrink-0 mt-0.5 text-rose-600" />
                <span className="font-semibold">{errorMsg}</span>
              </div>
            )}

            {/* Registration Form */}
            <form onSubmit={handleSubmit} className="space-y-4 text-xs relative z-10">
              <div className="space-y-1.5">
                <label className="block font-extrabold text-xs text-[#18392f]">
                  Nama Lengkap / Panggilan: <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Contoh: Sarah Angelina"
                  className="w-full rounded-2xl border border-[#cfdad4] bg-[#f8faf9] px-4 py-3 text-sm font-bold text-[#18392f] placeholder-[#8f9e96] focus:outline-none focus:border-[#0b3d2e] focus:ring-2 focus:ring-[#0b3d2e]/10 transition-all"
                />
              </div>

              <div className="space-y-1.5">
                <label className="block font-extrabold text-xs text-[#18392f]">
                  Nomor WhatsApp: <span className="text-rose-500">*</span>
                </label>
                <input
                  type="tel"
                  required
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="Contoh: 0812-3456-7890"
                  className="w-full rounded-2xl border border-[#cfdad4] bg-[#f8faf9] px-4 py-3 text-sm font-bold text-[#18392f] placeholder-[#8f9e96] focus:outline-none focus:border-[#0b3d2e] focus:ring-2 focus:ring-[#0b3d2e]/10 transition-all"
                />
                <span className="text-[11px] text-[#60766b] font-medium block pt-0.5">
                  Dipakai kasir untuk mencari data member saat transaksi kasir.
                </span>
              </div>

              <div className="space-y-1.5">
                <label className="block font-extrabold text-xs text-[#18392f]">
                  Tanggal Lahir (Opsional):
                </label>
                <input
                  type="date"
                  value={birthday}
                  onChange={(e) => setBirthday(e.target.value)}
                  className="w-full rounded-2xl border border-[#cfdad4] bg-[#f8faf9] px-4 py-2.5 text-xs font-bold text-[#18392f] focus:outline-none focus:border-[#0b3d2e] focus:ring-2 focus:ring-[#0b3d2e]/10 transition-all"
                />
                <span className="text-[11px] text-[#60766b] font-medium block pt-0.5">
                  Untuk traktiran dan voucher spesial ulang tahun dari Mochi.
                </span>
              </div>

              {/* UU PDP Consent */}
              <div className="rounded-2xl border border-[#dce5e0] bg-[#f8faf9] p-4 space-y-2.5 text-[11.5px] leading-relaxed text-[#2d4037]">
                <label className="flex items-start gap-2.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={consent}
                    onChange={(e) => setConsent(e.target.checked)}
                    className="mt-0.5 h-4 w-4 rounded accent-[#0b3d2e] shrink-0"
                  />
                  <span>
                    Saya menyetujui penyimpanan nomor WhatsApp dan nama untuk program loyalitas member di <strong className="text-[#0b3d2e]">{business?.name || "Mochi Cafe n Resto"}</strong> (Kepatuhan UU PDP No. 27/2022).
                  </span>
                </label>
                <label className="flex items-start gap-2.5 cursor-pointer border-t border-[#e2eae5] pt-2.5">
                  <input
                    type="checkbox"
                    checked={marketingConsent}
                    onChange={(e) => setMarketingConsent(e.target.checked)}
                    className="mt-0.5 h-4 w-4 rounded accent-[#0b3d2e] shrink-0"
                  />
                  <span className="text-[#55695f]">
                    Saya bersedia menerima info promo dan pengingat poin melalui WhatsApp.
                  </span>
                </label>
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="w-full flex items-center justify-center gap-2 rounded-2xl bg-[#c8f53a] hover:bg-[#d9ff57] py-4 text-sm font-black text-[#073829] shadow-[0_6px_20px_rgba(200,245,58,0.32)] transition-transform active:scale-[0.98] disabled:opacity-50"
              >
                <span>{isLoading ? "Menyiapkan Kartu..." : "Buka Paspor Member Mochi"}</span>
                <ArrowRight size={17} strokeWidth={2.5} />
              </button>
            </form>

            <div className="flex items-center justify-center gap-1.5 text-[11px] font-semibold text-[#557064] relative z-10">
              <ShieldCheck size={15} className="text-emerald-700" />
              <span>Privasi Terlindungi · Tanpa Password / Akun Rumit</span>
            </div>
          </div>
        </main>

        {/* FOOTER */}
        <footer className="py-4 text-center text-xs text-[#6e857a] font-mono">
          <p>© {new Date().getFullYear()} {business?.name || "Mochi Cafe n Resto"} · KAEL Loyalty System</p>
        </footer>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f7f6fc] text-[#232331] font-sans flex flex-col justify-center items-center p-4">
      
      <div className="w-full max-w-md rounded-3xl border-2 border-[#232331] bg-white p-6 sm:p-8 shadow-ink-lg space-y-6">
        
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
              className="w-full rounded-xl border-2 border-[#232331] p-3 text-sm font-bold text-[#232331] focus:outline-none focus:ring-2 focus:ring-[#7958d8]"
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
              className="w-full rounded-xl border-2 border-[#232331] p-3 text-sm font-bold text-[#232331] focus:outline-none focus:ring-2 focus:ring-[#7958d8]"
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
            className="btn-tactile w-full flex items-center justify-center gap-2 rounded-2xl border-2 border-[#232331] bg-[#232331] py-3.5 text-sm font-black text-white shadow-ink-md hover:bg-[#323244]"
          >
            <span>{isLoading ? "Menyiapkan Kartu..." : "Buka Paspor Member Saya"}</span>
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
