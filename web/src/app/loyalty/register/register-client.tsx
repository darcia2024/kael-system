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
      <div className="min-h-screen bg-[#07281e] text-white font-sans flex flex-col justify-center items-center p-4 relative overflow-hidden">
        {/* Glow ambient effects */}
        <div className="pointer-events-none absolute -top-24 -left-24 h-96 w-96 rounded-full bg-emerald-500/10 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-24 -right-24 h-96 w-96 rounded-full bg-[#c8f53a]/10 blur-3xl" />

        <div className="w-full max-w-md rounded-[32px] border border-emerald-600/30 bg-[#0b3d2e] p-6 sm:p-8 shadow-2xl space-y-6 relative z-10 backdrop-blur-md">
          {/* Merchant Branding */}
          <div className="text-center space-y-2">
            <div className="flex justify-center">
              <BusinessMark
                name={business?.name || "Mochi Cafe"}
                logoUrl={business?.logo_url}
                brandColor={business?.brand_color}
                className="h-16 w-16 rounded-2xl border-2 border-emerald-500/40 shadow-md"
              />
            </div>
            {business?.is_demo && (
              <p className="text-xs font-bold text-amber-300">DEMO - gunakan data uji</p>
            )}

            <div>
              <span className="inline-flex items-center gap-1 rounded-full bg-[#c8f53a] px-3 py-0.5 text-[10px] font-black uppercase tracking-wider text-[#0b3d2e]">
                PROGRAM MEMBER RESMI
              </span>
              <h1 className="mt-2 text-2xl font-black tracking-tight text-white">
                {business?.name || "Mochi Cafe n Resto"}
              </h1>
            </div>

            <p className="text-xs leading-relaxed text-emerald-100/70">
              Kumpulkan poin di setiap transaksi kopi & hidangan favoritmu, lalu nikmati menu gratis dan voucher eksklusif!
            </p>
          </div>

          {/* Referral Banner */}
          {referrerName && (
            <div className="rounded-2xl border border-emerald-500/40 bg-[#07241b] p-3 flex items-center gap-2.5">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-[#c8f53a] text-[#0b3d2e]">
                <UserPlus size={16} />
              </span>
              <p className="text-xs font-bold text-emerald-100 leading-snug">
                Diajak oleh <span className="text-[#c8f53a]">{referrerName.trim().split(/\s+/)[0]}</span>. Daftar sekarang, dan kalian berdua dapat bonus di transaksi pertamamu!
              </p>
            </div>
          )}

          {/* Benefits Preview Pill */}
          <div className="rounded-2xl border border-emerald-700/50 bg-[#07241b] p-3.5 text-xs text-emerald-100/80 flex items-center justify-between">
            <div className="flex items-center gap-2 text-[#c8f53a] font-black">
              <Sparkles size={16} />
              <span>Kurs {program?.mode === "stamp" ? "Stempel" : "Poin"}</span>
            </div>
            <span className="font-extrabold text-white">
              {program?.mode === "stamp" ? "1 Kunjungan = 1 Stamp" : `${formatRupiah(program?.earn_rate ?? 0)} = 1 Pts`}
            </span>
          </div>

          {/* Error Alert */}
          {errorMsg && (
            <div className="rounded-xl border border-rose-500/50 bg-rose-950/50 p-3 text-xs text-rose-200 flex items-start gap-2">
              <AlertCircle size={15} className="shrink-0 mt-0.5 text-rose-400" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Registration Form */}
          <form onSubmit={handleSubmit} className="space-y-4 text-xs">
            <div className="space-y-1.5">
              <label className="block font-bold text-emerald-100">
                Nama Lengkap / Panggilan: <span className="text-rose-400">*</span>
              </label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Contoh: Sarah Angelina"
                className="w-full rounded-xl border border-emerald-600/40 bg-[#07241b] p-3 text-sm font-bold text-white placeholder-emerald-400/40 focus:outline-none focus:ring-2 focus:ring-[#c8f53a] focus:border-[#c8f53a]"
              />
            </div>

            <div className="space-y-1.5">
              <label className="block font-bold text-emerald-100">
                Nomor WhatsApp: <span className="text-rose-400">*</span>
              </label>
              <input
                type="tel"
                required
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="Contoh: 0812-3456-7890"
                className="w-full rounded-xl border border-emerald-600/40 bg-[#07241b] p-3 text-sm font-bold text-white placeholder-emerald-400/40 focus:outline-none focus:ring-2 focus:ring-[#c8f53a] focus:border-[#c8f53a]"
              />
              <span className="text-[10px] text-emerald-200/60 block">
                Dipakai kasir untuk mencari member saat transaksi kasir.
              </span>
            </div>

            <div className="space-y-1.5">
              <label className="block font-bold text-emerald-100">
                Tanggal Lahir (Opsional):
              </label>
              <input
                type="date"
                value={birthday}
                onChange={(e) => setBirthday(e.target.value)}
                className="w-full rounded-xl border border-emerald-600/40 bg-[#07241b] p-2.5 text-xs font-bold text-white focus:outline-none focus:ring-2 focus:ring-[#c8f53a]"
              />
              <span className="text-[10px] text-emerald-200/60 block">
                Untuk traktiran dan voucher spesial ulang tahun dari Mochi.
              </span>
            </div>

            {/* UU PDP Consent */}
            <div className="rounded-2xl border border-emerald-700/50 bg-[#07241b] p-3 space-y-2 text-[11px] leading-relaxed">
              <label className="flex items-start gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={consent}
                  onChange={(e) => setConsent(e.target.checked)}
                  className="mt-0.5 h-4 w-4 rounded accent-[#c8f53a]"
                />
                <span className="text-emerald-100/80">
                  Saya menyetujui penyimpanan nomor WhatsApp dan nama untuk program loyalitas member di <strong className="text-white">{business?.name}</strong> (Kepatuhan UU PDP No. 27/2022).
                </span>
              </label>
              <label className="flex items-start gap-2 cursor-pointer border-t border-emerald-700/40 pt-2">
                <input
                  type="checkbox"
                  checked={marketingConsent}
                  onChange={(e) => setMarketingConsent(e.target.checked)}
                  className="mt-0.5 h-4 w-4 rounded accent-[#c8f53a]"
                />
                <span className="text-emerald-200/70">
                  Saya bersedia menerima info promo dan pengingat poin melalui WhatsApp.
                </span>
              </label>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full flex items-center justify-center gap-2 rounded-2xl bg-[#c8f53a] py-3.5 text-sm font-black text-[#0b3d2e] shadow-lg hover:bg-[#d9ff57] transition-transform active:scale-[0.98] disabled:opacity-50"
            >
              <span>{isLoading ? "Menyiapkan Kartu..." : "Buka Paspor Member Mochi"}</span>
              <ArrowRight size={16} />
            </button>
          </form>

          <div className="flex items-center justify-center gap-1.5 text-[10px] text-emerald-300/70">
            <ShieldCheck size={14} className="text-[#c8f53a]" />
            <span>Privasi Terlindungi · Tanpa Password / Akun Rumit</span>
          </div>
        </div>
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
