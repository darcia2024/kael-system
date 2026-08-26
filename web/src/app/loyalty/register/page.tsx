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
  Lock 
} from "lucide-react";
import { db, Business, LoyaltyProgram } from "@/lib/db";
import { normalizePhoneNumber } from "@/lib/loyalty-engine";
import { formatRupiah } from "@/lib/formatters";

export default function CustomerRegistrationPage() {
  const router = useRouter();
  const business: Business | null = db.getBusiness();
  const program: LoyaltyProgram = db.getLoyaltyProgram();

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [birthday, setBirthday] = useState("");
  const [consent, setConsent] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (!name.trim()) {
      setErrorMsg("Mohon masukkan nama Anda.");
      return;
    }

    const norm = normalizePhoneNumber(phone);
    if (!norm || norm.length < 9) {
      setErrorMsg("Nomor WhatsApp tidak valid. Masukkan nomor yang benar (contoh: 08123456789).");
      return;
    }

    if (!consent) {
      setErrorMsg("Persetujuan privasi penyimpanan data diperlukan sesuai UU PDP.");
      return;
    }

    setIsLoading(true);

    try {
      const res = db.registerCustomer(business?.id, name.trim(), norm, birthday || undefined);
      if (res.success && res.customer) {
        // Direct redirect to unguessable token member passport
        router.push(`/m/${res.customer.token}`);
      } else {
        setErrorMsg(res.error || "Gagal mendaftar member. Silakan coba lagi.");
        setIsLoading(false);
      }
    } catch (err: any) {
      setErrorMsg(err.message || "Terjadi kesalahan.");
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#f7f6fc] text-[#232331] font-sans flex flex-col justify-center items-center p-4">
      
      <div className="w-full max-w-md rounded-3xl border-2 border-[#232331] bg-white p-6 sm:p-8 shadow-ink-lg space-y-6">
        
        {/* Merchant Branding */}
        <div className="text-center space-y-2">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl border-2 border-[#232331] bg-[#d9ff57] text-[#232331] shadow-ink-xs">
            <Gift size={24} />
          </div>

          <div>
            <span className="text-[10.5px] font-mono font-bold text-[#7958d8] uppercase tracking-wider block">
              PROGRAM MEMBER RESMI
            </span>
            <h1 className="text-xl sm:text-2xl font-black text-[#232331]">
              {business?.name || "Toko Kami"}
            </h1>
          </div>

          <p className="text-xs text-[#7b7b8e]">
            Kumpulkan {program.mode === "stamp" ? "stempel" : "poin"} setiap belanja dan nikmati berbagai traktiran menu gratis!
          </p>
        </div>

        {/* Benefits Preview Pill */}
        <div className="rounded-2xl border border-[#dedee8] bg-[#fcfcfe] p-3 font-mono text-xs text-[#7b7b8e] flex items-center justify-between">
          <div className="flex items-center gap-2 text-[#16a34a] font-bold">
            <Sparkles size={15} />
            <span>Kurs {program.mode === "stamp" ? "Stempel" : "Poin"}</span>
          </div>
          <span className="font-extrabold text-[#232331]">
            {program.mode === "stamp" ? "1 Kunjungan = 1 Stamp" : `${formatRupiah(program.earn_rate)} = 1 Pts`}
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
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="btn-tactile w-full flex items-center justify-center gap-2 rounded-2xl border-2 border-[#232331] bg-[#232331] py-3.5 text-sm font-black text-white shadow-ink-md hover:bg-[#323244]"
          >
            <span>{isLoading ? "Menyiapkan Kartu..." : "Buka Paspor Member Saya ➔"}</span>
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
