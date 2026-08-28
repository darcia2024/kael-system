"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { 
  Gift, 
  Sparkles, 
  QrCode, 
  History, 
  CheckCircle2, 
  AlertCircle, 
  ArrowRight, 
  Store, 
  ShieldCheck, 
  Copy, 
  Check, 
  Clock, 
  Ticket,
  ChevronRight
} from "lucide-react";
import type { Customer, Business, LoyaltyProgram, Reward, PointLedger, Redemption } from "@/lib/types";
import { maskPhoneNumber } from "@/lib/loyalty-engine";
import { formatRupiah, formatBusinessDateTime } from "@/lib/formatters";
import { BusinessMark } from "@/components/business-mark";

/**
 * Tampilan halaman member. Seluruh datanya dikirim sebagai props oleh komponen
 * server di page.tsx.
 *
 * Sebelumnya komponen ini memanggil db langsung dari sisi klien, yang berarti
 * token pelanggan dan seluruh data contoh ikut masuk ke bundel JavaScript.
 * Token itu satu-satunya pengaman halaman ini, jadi dia tidak boleh sampai ke
 * browser siapa pun selain pemiliknya.
 */
export interface MemberPageData {
  customer: Customer | null;
  business: Business | null;
  program: LoyaltyProgram | null;
  rewards: Reward[];
  balance: number;
  ledger: PointLedger[];
  redemptions: Redemption[];
}

export default function CustomerMemberProgressPage({
  customer, business, program, rewards, balance, ledger, redemptions,
}: MemberPageData) {
  const [activeTab, setActiveTab] = useState<"rewards" | "history">("rewards");
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  const handleCopyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    setCopiedCode(code);
    setTimeout(() => setCopiedCode(null), 2000);
  };

  // Next reward progress
  const nextTargetReward = useMemo(() => {
    const sorted = [...rewards].sort((a, b) => a.point_cost - b.point_cost);
    return sorted.find((r) => r.point_cost > balance) || sorted[sorted.length - 1];
  }, [rewards, balance]);

  const progressPercent = nextTargetReward
    ? Math.min(100, Math.round((balance / nextTargetReward.point_cost) * 100))
    : 100;

  if (!customer || !business || !program) {
    return (
      <div className="min-h-screen bg-[#f7f6fc] text-[#232331] font-sans flex items-center justify-center p-4">
        <div className="w-full max-w-sm rounded-3xl border-2 border-[#232331] bg-white p-6 shadow-ink-lg text-center space-y-4">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-[#feebee] text-[#ef4444] border-2 border-[#ef4444]">
            <AlertCircle size={28} />
          </div>
          <div className="space-y-1">
            <h1 className="text-lg font-black text-[#232331]">Kartu Member Tidak Ditemukan</h1>
            <p className="text-xs text-[#7b7b8e]">
              Tautan kartu member ini tidak valid atau telah diperbarui oleh pihak toko.
            </p>
          </div>
          <Link
            href="/loyalty/register"
            className="btn-tactile inline-flex w-full items-center justify-center gap-2 rounded-2xl border-2 border-[#232331] bg-[#d9ff57] py-3 text-xs font-black text-[#232331] shadow-ink-xs"
          >
            <span>Daftar Member Baru</span>
            <ArrowRight size={14} />
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f7f6fc] text-[#232331] font-sans flex flex-col justify-between max-w-md mx-auto border-x border-[#dedee8] min-h-screen">
      
      {/* Top Merchant Identity Header */}
      <header className="sticky top-0 z-30 border-b-2 border-[#232331] bg-white/95 backdrop-blur-md px-4 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5 min-w-0">
            <BusinessMark
              name={business.name}
              logoUrl={business.logo_url}
              brandColor={business.brand_color}
              className="rounded-xl border border-[#232331]"
            />
            <div className="min-w-0">
              <h1 className="font-black text-sm text-[#232331] truncate">
                {business.name}
              </h1>
              <span className="text-[10px] text-[#7b7b8e] font-mono block truncate">
                Member Paspor Digital Resmi
              </span>
            </div>
          </div>

          <div className="flex items-center gap-1">
            <span className="inline-flex items-center gap-1 rounded-full border border-[#16a34a] bg-[#dcfce7] px-2 py-0.5 font-mono text-[9px] font-bold text-[#16a34a]">
              <ShieldCheck size={11} />
              <span>PDP Safe</span>
            </span>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="flex-1 p-4 space-y-4">
        
        {/* CUSTOMER PASSPORT DIGITAL CARD */}
        <div className="card-tactile rounded-3xl border-2 border-[#232331] bg-gradient-to-br from-[#232331] via-[#2c2b3d] to-[#1e1d2b] p-5 text-white shadow-ink-lg space-y-4 relative overflow-hidden">
          
          {/* Subtle Watermark Pattern */}
          <div className="absolute right-[-20px] bottom-[-20px] opacity-10 text-white pointer-events-none">
            <Sparkles size={160} />
          </div>

          {/* Card Top */}
          <div className="flex justify-between items-start">
            <div>
              <span className="text-[10px] font-mono text-[#d9ff57] font-bold uppercase tracking-wider block">
                PASPOR MEMBER {program.mode === "stamp" ? "STEMPEL" : "LOYALITAS"}
              </span>
              <h2 className="text-xl font-black text-white font-sans mt-0.5">
                {customer.name}
              </h2>
              <span className="text-[11px] font-mono text-[#a1a1aa]">
                {maskPhoneNumber(customer.phone)}
              </span>
            </div>

            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-white/10 border border-white/20 text-[#d9ff57]">
              <Ticket size={20} />
            </div>
          </div>

          {/* Large Point / Stamp Gauge */}
          <div className="rounded-2xl bg-white/10 backdrop-blur-md p-4 border border-white/15 flex items-center justify-between">
            <div>
              <span className="text-[10px] font-mono text-[#dedee8] uppercase block">
                SALDO {program.mode === "stamp" ? "STEMPEL AKTIF" : "POIN TERKUMPUL"}
              </span>
              <div className="flex items-baseline gap-1.5 mt-0.5">
                <span className="text-3xl sm:text-4xl font-black font-mono text-[#d9ff57]">
                  {balance}
                </span>
                <span className="text-xs font-mono text-white/80 font-bold">
                  {program.mode === "stamp" ? "Stempel" : "Pts"}
                </span>
              </div>
            </div>

            <div className="text-right font-mono text-xs">
              <span className="text-[10px] text-[#a1a1aa] block">Kurs Belanja</span>
              <span className="font-bold text-white text-[11px]">
                {program.mode === "stamp" ? "1 Kunjungan = 1 Stamp" : `${formatRupiah(program.earn_rate)} = 1 Pts`}
              </span>
            </div>
          </div>

          {/* Progress to Next Reward */}
          {nextTargetReward && (
            <div className="space-y-1.5 font-mono text-xs">
              <div className="flex justify-between text-[10.5px]">
                <span className="text-[#dedee8]">Target: {nextTargetReward.name}</span>
                <span className="text-[#d9ff57] font-bold">{balance}/{nextTargetReward.point_cost} Pts</span>
              </div>
              
              <div className="h-2 w-full rounded-full bg-white/20 overflow-hidden">
                <div 
                  className="h-full bg-[#d9ff57] rounded-full transition-all duration-500" 
                  style={{ width: `${progressPercent}%` }}
                />
              </div>

              <span className="text-[9.5px] text-[#a1a1aa] block text-right">
                {balance >= nextTargetReward.point_cost 
                  ? "✓ Siap ditukarkan ke kasir!" 
                  : `Kurang ${nextTargetReward.point_cost - balance} poin lagi untuk klaim.`}
              </span>
            </div>
          )}

        </div>

        {/* RECENT CLAIMED REDEMPTION VOUCHER CARD (If Any) */}
        {redemptions.length > 0 && redemptions[0] && (
          <div className="rounded-2xl border-2 border-[#16a34a] bg-[#dcfce7] p-3.5 space-y-2 font-mono text-xs animate-in fade-in">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5 text-[#16a34a] font-black">
                <CheckCircle2 size={15} />
                <span>VOUCHER DIGITAL ANDA</span>
              </div>
              <span className="text-[9.5px] bg-white px-2 py-0.5 rounded-full border border-[#16a34a] font-bold text-[#16a34a]">
                Tunjukkan ke Kasir
              </span>
            </div>

            <div className="rounded-xl bg-white p-2.5 border border-[#16a34a]/30 flex items-center justify-between gap-2">
              <div>
                <span className="font-extrabold text-sm text-[#232331] font-mono block tracking-wider">
                  {redemptions[0].code}
                </span>
                <span className="text-[10px] text-[#7b7b8e] font-sans">
                  Status: Berhasil diverifikasi kasir ✓
                </span>
              </div>

              <button
                type="button"
                onClick={() => handleCopyCode(redemptions[0].code)}
                className="btn-tactile rounded-lg bg-[#232331] text-[#d9ff57] p-1.5 text-[10.5px] font-bold"
                title="Salin Kode"
              >
                {copiedCode === redemptions[0].code ? <Check size={14} /> : <Copy size={14} />}
              </button>
            </div>
          </div>
        )}

        {/* 2-TAB SWITCH: REWARDS & RIWAYAT */}
        <div className="flex items-center rounded-2xl border-2 border-[#232331] bg-white p-1 font-mono text-xs font-bold gap-1 shadow-ink-xs">
          <button
            type="button"
            onClick={() => setActiveTab("rewards")}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl transition-all ${
              activeTab === "rewards" ? "bg-[#232331] text-[#d9ff57] shadow-ink-xs" : "text-[#7b7b8e] hover:text-[#232331]"
            }`}
          >
            <Gift size={14} />
            <span>Katalog Hadiah ({rewards.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("history")}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl transition-all ${
              activeTab === "history" ? "bg-[#232331] text-[#d9ff57] shadow-ink-xs" : "text-[#7b7b8e] hover:text-[#232331]"
            }`}
          >
            <History size={14} />
            <span>Riwayat Poin</span>
          </button>
        </div>

        {/* TAB 1: REWARD CATALOG */}
        {activeTab === "rewards" && (
          <div className="space-y-2.5">
            {rewards.map((reward) => {
              const canRedeem = balance >= reward.point_cost;
              return (
                <div
                  key={reward.id}
                  className={`card-tactile rounded-2xl border-2 p-3.5 space-y-2 transition-all ${
                    canRedeem
                      ? "border-[#232331] bg-white shadow-ink-xs"
                      : "border-[#dedee8] bg-[#fcfcfe] opacity-80"
                  }`}
                >
                  <div className="flex justify-between items-start gap-2">
                    <div className="min-w-0">
                      <h4 className="font-extrabold text-sm text-[#232331] font-sans">
                        {reward.name}
                      </h4>
                      <span className="text-[11px] text-[#7b7b8e] font-mono block">
                        Nilai Menu: {formatRupiah(reward.market_value)}
                      </span>
                    </div>

                    <div className="rounded-xl border border-[#7958d8] bg-[#f0edff] px-2.5 py-1 text-center shrink-0">
                      <span className="font-black text-sm text-[#7958d8] font-mono block">
                        {reward.point_cost}
                      </span>
                      <span className="text-[8.5px] text-[#7958d8] font-bold uppercase font-mono block">
                        Poin
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between gap-2 pt-1 border-t border-[#dedee8] font-mono text-xs">
                    <span className="text-[10px] text-[#7b7b8e]">
                      {canRedeem ? "✓ Saldo poinmu cukup" : `Kurang ${reward.point_cost - balance} poin`}
                    </span>

                    <span className="text-[10.5px] font-bold text-[#7958d8]">
                      Tukarkan di Kasir ➔
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* TAB 2: POINT LEDGER HISTORY */}
        {activeTab === "history" && (
          <div className="rounded-2xl border-2 border-[#232331] bg-white p-4 shadow-ink-xs space-y-3 font-mono text-xs">
            <div className="flex items-center justify-between border-b border-[#dedee8] pb-2">
              <span className="font-bold text-[#232331]">Buku Transaksi Poin</span>
              <span className="text-[10px] text-[#7b7b8e]">{ledger.length} Aktivitas</span>
            </div>

            <div className="space-y-2 divide-y divide-[#dedee8]">
              {ledger.map((item) => (
                <div key={item.id} className="pt-2 first:pt-0 flex justify-between items-center gap-2">
                  <div className="min-w-0">
                    <span className="font-bold text-[#232331] font-sans block text-xs truncate">
                      {item.note || (item.delta > 0 ? "Perolehan Belanja" : "Penukaran Hadiah")}
                    </span>
                    <span className="text-[10px] text-[#7b7b8e] block">
                      {formatBusinessDateTime(item.created_at)}
                    </span>
                  </div>

                  <span className={`font-black text-sm shrink-0 ${
                    item.delta > 0 ? "text-[#16a34a]" : "text-[#ef4444]"
                  }`}>
                    {item.delta > 0 ? `+${item.delta}` : item.delta} Pts
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* UU PDP PRIVACY NOTICE */}
        <div className="rounded-2xl border border-[#dedee8] bg-white p-3.5 space-y-1.5 text-center text-xs font-mono text-[#7b7b8e]">
          <div className="flex items-center justify-center gap-1 text-[#16a34a] font-bold text-[10.5px]">
            <ShieldCheck size={13} />
            <span>Kerahasiaan Data Terjamin (UU PDP No. 27/2022)</span>
          </div>
          <p className="text-[9.5px] leading-relaxed">
            Data Anda hanya digunakan untuk keperluan program loyalitas toko {business.name}.
          </p>
        </div>

      </main>

      {/* Footer */}
      <footer className="border-t border-[#dedee8] bg-white py-3 text-center text-[10.5px] font-mono text-[#7b7b8e]">
        KAEL Loyalty Member Passport · Live
      </footer>

    </div>
  );
}
