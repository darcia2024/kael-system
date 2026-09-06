"use client";

import Link from "next/link";
import {
  ArrowLeft,
  Users,
  UserCheck,
  Repeat,
  TrendingUp,
  ArrowUpRight,
  ArrowDownRight,
  Minus
} from "lucide-react";
import type { Business } from "@/lib/types";
import { formatRupiah } from "@/lib/formatters";

export interface MemberGrowthTrendRow {
  week_start: string;
  new_signups: number;
  active_members: number;
  revenue: number;
}

export interface MemberGrowthSummary {
  activeMembers: number;
  activeMembersPrior: number;
  repeatCustomers: number;
  returningMembers: number;
  revenue: number;
  revenuePrior: number;
}

function DeltaBadge({ current, prior }: { current: number; prior: number }) {
  if (prior === 0) {
    return current > 0
      ? <span className="inline-flex items-center gap-0.5 text-[10px] font-bold text-[#16a34a]"><ArrowUpRight size={11} />Baru</span>
      : <span className="inline-flex items-center gap-0.5 text-[10px] font-bold text-[#7b7b8e]"><Minus size={11} />Sama</span>;
  }
  const pct = Math.round(((current - prior) / prior) * 100);
  if (pct === 0) return <span className="inline-flex items-center gap-0.5 text-[10px] font-bold text-[#7b7b8e]"><Minus size={11} />0%</span>;
  return pct > 0
    ? <span className="inline-flex items-center gap-0.5 text-[10px] font-bold text-[#16a34a]"><ArrowUpRight size={11} />+{pct}%</span>
    : <span className="inline-flex items-center gap-0.5 text-[10px] font-bold text-[#dc2626]"><ArrowDownRight size={11} />{pct}%</span>;
}

function MiniBarChart({
  data, valueKey, color, formatValue,
}: {
  data: MemberGrowthTrendRow[];
  valueKey: keyof Pick<MemberGrowthTrendRow, "new_signups" | "active_members" | "revenue">;
  color: string;
  formatValue: (v: number) => string;
}) {
  const max = Math.max(...data.map((d) => d[valueKey]), 1);
  return (
    <div className="flex h-20 items-end gap-1">
      {data.map((d) => {
        const value = d[valueKey];
        const heightPct = Math.max((value / max) * 100, value > 0 ? 6 : 2);
        const isLast = d === data[data.length - 1];
        return (
          <div key={d.week_start} className="group relative flex flex-1 flex-col items-center justify-end">
            <div
              className={`w-full rounded-t-sm transition-opacity ${isLast ? "" : "opacity-70"}`}
              style={{ height: `${heightPct}%`, minHeight: "2px", backgroundColor: color }}
              title={`${new Date(d.week_start).toLocaleDateString("id-ID", { day: "numeric", month: "short" })}: ${formatValue(value)}`}
            />
          </div>
        );
      })}
    </div>
  );
}

export default function AnalyticsClient({
  business,
  trend,
  summary,
}: {
  business: Business | null;
  trend: MemberGrowthTrendRow[];
  summary: MemberGrowthSummary;
}) {
  const repeatRatePct = summary.activeMembers > 0
    ? Math.round((summary.repeatCustomers / summary.activeMembers) * 100)
    : 0;
  const avgSpendPerMember = summary.activeMembers > 0
    ? Math.round(summary.revenue / summary.activeMembers)
    : 0;

  return (
    <div className="min-h-screen bg-[#f7f6fc] text-[#232331] font-sans">
      <header className="sticky top-0 z-30 border-b-2 border-[#232331] bg-white/95 backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-2 px-3 py-2.5 sm:px-6">
          <div className="flex min-w-0 items-center gap-2.5">
            <Link
              href="/app/loyalty"
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border border-[#232331] bg-[#fcfcfe] text-[#232331] shadow-ink-xs hover:bg-[#f0edff]"
              title="Kembali ke KAEL Loyalty"
            >
              <ArrowLeft size={15} />
            </Link>
            <div className="min-w-0">
              <h1 className="truncate text-xs font-extrabold sm:text-base">Analitik Pertumbuhan Member</h1>
              <span className="block truncate font-mono text-[10px] text-[#7b7b8e] sm:text-[11px]">{business?.name} · 30 hari terakhir dibanding 30 hari sebelumnya</span>
            </div>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-6xl space-y-5 p-3 sm:p-6 lg:p-8">

        {/* SUMMARY KPI */}
        <div className="grid grid-cols-2 gap-2.5 sm:gap-4 lg:grid-cols-4">
          <div className="card-tactile rounded-2xl border-2 border-[#232331] bg-white p-3.5 shadow-ink-xs sm:rounded-3xl sm:p-5 sm:shadow-ink-md">
            <div className="flex items-center justify-between border-b border-[#dedee8] pb-1.5 sm:pb-2.5">
              <span className="font-mono text-[9px] font-bold uppercase text-[#7958d8] sm:text-[10px]">MEMBER AKTIF</span>
              <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-[#f0edff] text-[#7958d8] sm:h-7 sm:w-7"><UserCheck size={13} /></span>
            </div>
            <div className="mt-2 sm:mt-3">
              <h3 className="font-mono text-lg font-black text-[#232331] sm:text-2xl">{summary.activeMembers}</h3>
              <div className="mt-0.5 flex items-center gap-1.5 sm:mt-1">
                <DeltaBadge current={summary.activeMembers} prior={summary.activeMembersPrior} />
                <span className="text-[9.5px] text-[#7b7b8e]">vs {summary.activeMembersPrior} periode lalu</span>
              </div>
            </div>
          </div>

          <div className="card-tactile rounded-2xl border-2 border-[#232331] bg-white p-3.5 shadow-ink-xs sm:rounded-3xl sm:p-5 sm:shadow-ink-md">
            <div className="flex items-center justify-between border-b border-[#dedee8] pb-1.5 sm:pb-2.5">
              <span className="font-mono text-[9px] font-bold uppercase text-[#16a34a] sm:text-[10px]">MEMBER KEMBALI</span>
              <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-[#dcfce7] text-[#16a34a] sm:h-7 sm:w-7"><Repeat size={13} /></span>
            </div>
            <div className="mt-2 sm:mt-3">
              <h3 className="font-mono text-lg font-black text-[#232331] sm:text-2xl">{summary.returningMembers}</h3>
              <span className="mt-0.5 block text-[9.5px] text-[#7b7b8e] sm:mt-1">Member lama yang belanja lagi</span>
            </div>
          </div>

          <div className="card-tactile rounded-2xl border-2 border-[#232331] bg-white p-3.5 shadow-ink-xs sm:rounded-3xl sm:p-5 sm:shadow-ink-md">
            <div className="flex items-center justify-between border-b border-[#dedee8] pb-1.5 sm:pb-2.5">
              <span className="font-mono text-[9px] font-bold uppercase text-[#d97706] sm:text-[10px]">REPEAT PURCHASE</span>
              <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-[#fef3c7] text-[#d97706] sm:h-7 sm:w-7"><Users size={13} /></span>
            </div>
            <div className="mt-2 sm:mt-3">
              <h3 className="font-mono text-lg font-black text-[#232331] sm:text-2xl">{repeatRatePct}%</h3>
              <span className="mt-0.5 block text-[9.5px] text-[#7b7b8e] sm:mt-1">{summary.repeatCustomers} dari {summary.activeMembers} member belanja &gt;1x</span>
            </div>
          </div>

          <div className="card-tactile rounded-2xl border-2 border-[#232331] bg-white p-3.5 shadow-ink-xs sm:rounded-3xl sm:p-5 sm:shadow-ink-md">
            <div className="flex items-center justify-between border-b border-[#dedee8] pb-1.5 sm:pb-2.5">
              <span className="font-mono text-[9px] font-bold uppercase text-[#c2410c] sm:text-[10px]">NILAI BELANJA</span>
              <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-[#ffedd5] text-[#c2410c] sm:h-7 sm:w-7"><TrendingUp size={13} /></span>
            </div>
            <div className="mt-2 sm:mt-3">
              <h3 className="truncate font-mono text-base font-black text-[#232331] sm:text-2xl">{formatRupiah(summary.revenue)}</h3>
              <div className="mt-0.5 flex items-center gap-1.5 sm:mt-1">
                <DeltaBadge current={summary.revenue} prior={summary.revenuePrior} />
                <span className="text-[9.5px] text-[#7b7b8e]">rata-rata {formatRupiah(avgSpendPerMember)}/member</span>
              </div>
            </div>
          </div>
        </div>

        {/* TREND 12 MINGGU */}
        <div className="rounded-2xl border-2 border-[#232331] bg-white p-4 shadow-ink-md sm:rounded-3xl sm:p-6">
          <div className="border-b border-[#dedee8] pb-3">
            <h3 className="text-sm font-extrabold sm:text-base">Tren 12 Minggu Terakhir</h3>
            <p className="text-[11px] text-[#7b7b8e] sm:text-xs">Garis dasar untuk menilai apakah ajakan, referral, dan promo benar-benar menambah member — bukan cuma menambah keramaian.</p>
          </div>

          <div className="mt-4 grid gap-5 sm:grid-cols-3">
            <div>
              <p className="font-mono text-[10px] font-bold uppercase text-[#7958d8]">Pendaftaran Baru</p>
              <p className="mt-0.5 font-mono text-lg font-black text-[#232331]">{trend.reduce((sum, d) => sum + d.new_signups, 0)}</p>
              <div className="mt-2 text-[#7958d8]">
                <MiniBarChart data={trend} valueKey="new_signups" color="#7958d8" formatValue={(v) => `${v} member baru`} />
              </div>
            </div>
            <div>
              <p className="font-mono text-[10px] font-bold uppercase text-[#16a34a]">Member Aktif / Minggu</p>
              <p className="mt-0.5 font-mono text-lg font-black text-[#232331]">{trend.length ? trend[trend.length - 1].active_members : 0}</p>
              <div className="mt-2">
                <MiniBarChart data={trend} valueKey="active_members" color="#16a34a" formatValue={(v) => `${v} member aktif`} />
              </div>
            </div>
            <div>
              <p className="font-mono text-[10px] font-bold uppercase text-[#c2410c]">Nilai Belanja / Minggu</p>
              <p className="mt-0.5 truncate font-mono text-lg font-black text-[#232331]">{trend.length ? formatRupiah(trend[trend.length - 1].revenue) : formatRupiah(0)}</p>
              <div className="mt-2">
                <MiniBarChart data={trend} valueKey="revenue" color="#c2410c" formatValue={(v) => formatRupiah(v)} />
              </div>
            </div>
          </div>

          {trend.every((d) => d.new_signups === 0 && d.active_members === 0) && (
            <p className="mt-4 border-t border-[#dedee8] pt-3 text-xs text-[#5c5c70]">Belum ada aktivitas dalam 12 minggu terakhir. Grafik akan terisi begitu member baru daftar atau bertransaksi.</p>
          )}
        </div>

      </main>
    </div>
  );
}
