"use client";

import Link from "next/link";
import {
  ArrowLeft,
  LayoutDashboard,
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
import { isMochiBusiness } from "@/lib/mochi-brand";
import { BusinessMark } from "@/components/business-mark";

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
      : <span className="inline-flex items-center gap-0.5 text-[10px] font-bold text-[#789689]"><Minus size={11} />Sama</span>;
  }
  const pct = Math.round(((current - prior) / prior) * 100);
  if (pct === 0) return <span className="inline-flex items-center gap-0.5 text-[10px] font-bold text-[#789689]"><Minus size={11} />0%</span>;
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
    <div className="flex h-20 items-end gap-1.5 pt-2">
      {data.map((d) => {
        const value = d[valueKey];
        const heightPct = Math.max((value / max) * 100, value > 0 ? 8 : 3);
        const isLast = d === data[data.length - 1];
        return (
          <div key={d.week_start} className="group relative flex flex-1 flex-col items-center justify-end h-full">
            <div
              className={`w-full rounded-t-md transition-all ${isLast ? "brightness-105 shadow-sm" : "opacity-75 hover:opacity-100"}`}
              style={{ height: `${heightPct}%`, minHeight: "4px", backgroundColor: color }}
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
  const isMochi = isMochiBusiness(business);
  const repeatRatePct = summary.activeMembers > 0
    ? Math.round((summary.repeatCustomers / summary.activeMembers) * 100)
    : 0;
  const avgSpendPerMember = summary.activeMembers > 0
    ? Math.round(summary.revenue / summary.activeMembers)
    : 0;

  return (
    <div className="min-h-screen bg-[#f0f5f2] text-[#1a382d] font-sans">
      <header className="sticky top-0 z-30 border-b border-[#07281e] bg-[#0b3d2e] text-white shadow-md">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-2 px-3 py-2.5 sm:px-6">
          <div className="flex min-w-0 items-center gap-2.5">
            <Link
              href="/app/loyalty"
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-[#144f3d] text-white hover:bg-[#1a5e4a] border border-[#1a5e4a] transition-colors"
              title="Kembali ke KAEL Loyalty"
            >
              <ArrowLeft size={15} />
            </Link>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <BusinessMark
                  name={business?.name}
                  logoUrl={business?.logo_url}
                  brandColor={business?.brand_color}
                  size="sm"
                  className="h-5 w-5 rounded-md object-cover shrink-0"
                />
                <h1 className="truncate text-xs font-black sm:text-base tracking-tight">Analitik Pertumbuhan Member</h1>
              </div>
              <span className="block truncate font-mono text-[10px] text-emerald-200/80 sm:text-[11px]">{business?.name} · 30 hari terakhir dibanding 30 hari sebelumnya</span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Link
              href="/app/pos/owner"
              className="flex items-center gap-1.5 rounded-xl bg-[#c8f53a] px-3.5 py-1.5 font-mono text-xs font-black text-[#0b3d2e] shadow-sm hover:brightness-105 active:scale-[0.98] transition-all"
            >
              <LayoutDashboard size={13} />
              <span className="hidden sm:inline">Dashboard Owner Utama</span>
              <span className="sm:hidden">Dashboard</span>
            </Link>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-6xl space-y-5 p-3 sm:p-6 lg:p-8">

        {/* Quick Report Switcher Bar */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 font-mono text-xs no-scrollbar">
          <Link
            href="/app/pos/owner"
            className="inline-flex shrink-0 items-center gap-1.5 rounded-xl border border-[#d8e3de] bg-white px-3 py-1.5 font-bold text-[#527867] hover:border-[#0b3d2e] hover:text-[#0b3d2e] transition-colors"
          >
            <ArrowLeft size={13} />
            <span>Dashboard Owner Utama</span>
          </Link>
          <Link
            href="/app/pos/reports"
            className="inline-flex shrink-0 items-center gap-1.5 rounded-xl border border-[#d8e3de] bg-white px-3 py-1.5 font-bold text-[#527867] hover:border-[#0b3d2e] hover:text-[#0b3d2e] transition-colors"
          >
            <span>Laporan Penjualan &amp; Laba</span>
          </Link>
          <span className="inline-flex shrink-0 items-center gap-1.5 rounded-xl bg-[#0b3d2e] border border-[#0b3d2e] px-3 py-1.5 font-bold text-[#c8f53a] shadow-sm">
            <span>Laporan Loyalty Member</span>
          </span>
          <Link
            href="/app/pos/owner#laporan-review"
            className="inline-flex shrink-0 items-center gap-1.5 rounded-xl border border-[#d8e3de] bg-white px-3 py-1.5 font-bold text-[#527867] hover:border-[#0b3d2e] hover:text-[#0b3d2e] transition-colors"
          >
            <span>Laporan Review &amp; Keluhan</span>
          </Link>
          <Link
            href="/app/finance/reports"
            className="inline-flex shrink-0 items-center gap-1.5 rounded-xl border border-[#d8e3de] bg-white px-3 py-1.5 font-bold text-[#527867] hover:border-[#0b3d2e] hover:text-[#0b3d2e] transition-colors"
          >
            <span>Laporan Keuangan</span>
          </Link>
        </div>

        {/* SUMMARY KPI */}
        <div className="grid grid-cols-2 gap-2.5 sm:gap-4 lg:grid-cols-4">
          <div className="rounded-2xl border border-[#d8e3de] bg-white p-3.5 shadow-sm sm:rounded-3xl sm:p-5">
            <div className="flex items-center justify-between border-b border-[#edf3f0] pb-1.5 sm:pb-2.5">
              <span className="font-mono text-[9px] font-bold uppercase text-[#0b3d2e] sm:text-[10px]">MEMBER AKTIF</span>
              <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-[#e6f4ed] text-[#0b3d2e] sm:h-7 sm:w-7"><UserCheck size={13} /></span>
            </div>
            <div className="mt-2 sm:mt-3">
              <h3 className="font-mono text-lg font-black text-[#0b3d2e] sm:text-2xl">{summary.activeMembers}</h3>
              <div className="mt-0.5 flex items-center gap-1.5 sm:mt-1">
                <DeltaBadge current={summary.activeMembers} prior={summary.activeMembersPrior} />
                <span className="text-[9.5px] text-[#527867]">vs {summary.activeMembersPrior} periode lalu</span>
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-[#d8e3de] bg-white p-3.5 shadow-sm sm:rounded-3xl sm:p-5">
            <div className="flex items-center justify-between border-b border-[#edf3f0] pb-1.5 sm:pb-2.5">
              <span className="font-mono text-[9px] font-bold uppercase text-[#16a34a] sm:text-[10px]">MEMBER KEMBALI</span>
              <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-[#dcfce7] text-[#16a34a] sm:h-7 sm:w-7"><Repeat size={13} /></span>
            </div>
            <div className="mt-2 sm:mt-3">
              <h3 className="font-mono text-lg font-black text-[#0b3d2e] sm:text-2xl">{summary.returningMembers}</h3>
              <span className="mt-0.5 block text-[9.5px] text-[#527867] sm:mt-1">Member lama yang belanja lagi</span>
            </div>
          </div>

          <div className="rounded-2xl border border-[#d8e3de] bg-white p-3.5 shadow-sm sm:rounded-3xl sm:p-5">
            <div className="flex items-center justify-between border-b border-[#edf3f0] pb-1.5 sm:pb-2.5">
              <span className="font-mono text-[9px] font-bold uppercase text-[#0f766e] sm:text-[10px]">REPEAT PURCHASE</span>
              <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-[#ccfbf1] text-[#0f766e] sm:h-7 sm:w-7"><Users size={13} /></span>
            </div>
            <div className="mt-2 sm:mt-3">
              <h3 className="font-mono text-lg font-black text-[#0b3d2e] sm:text-2xl">{repeatRatePct}%</h3>
              <span className="mt-0.5 block text-[9.5px] text-[#527867] sm:mt-1">{summary.repeatCustomers} dari {summary.activeMembers} member belanja &gt;1x</span>
            </div>
          </div>

          <div className="rounded-2xl border border-[#d8e3de] bg-white p-3.5 shadow-sm sm:rounded-3xl sm:p-5">
            <div className="flex items-center justify-between border-b border-[#edf3f0] pb-1.5 sm:pb-2.5">
              <span className="font-mono text-[9px] font-bold uppercase text-[#0b3d2e] sm:text-[10px]">NILAI BELANJA</span>
              <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-[#e6f4ed] text-[#0b3d2e] sm:h-7 sm:w-7"><TrendingUp size={13} /></span>
            </div>
            <div className="mt-2 sm:mt-3">
              <h3 className="truncate font-mono text-base font-black text-[#0b3d2e] sm:text-2xl">{formatRupiah(summary.revenue)}</h3>
              <div className="mt-0.5 flex items-center gap-1.5 sm:mt-1">
                <DeltaBadge current={summary.revenue} prior={summary.revenuePrior} />
                <span className="text-[9.5px] text-[#527867]">rata-rata {formatRupiah(avgSpendPerMember)}/member</span>
              </div>
            </div>
          </div>
        </div>

        {/* TREND 12 MINGGU */}
        <div className="rounded-2xl border border-[#d8e3de] bg-white p-4 shadow-sm sm:rounded-3xl sm:p-6">
          <div className="border-b border-[#edf3f0] pb-3">
            <h3 className="text-sm font-extrabold sm:text-base text-[#0b3d2e]">Tren 12 Minggu Terakhir</h3>
            <p className="text-[11px] text-[#527867] sm:text-xs">Garis dasar untuk menilai apakah ajakan, referral, dan promo benar-benar menambah member — bukan cuma menambah keramaian.</p>
          </div>

          <div className="mt-4 grid gap-5 sm:grid-cols-3">
            <div className="rounded-2xl border border-[#edf3f0] bg-[#f9fbf9] p-3.5">
              <p className="font-mono text-[10px] font-bold uppercase text-[#167052]">Pendaftaran Baru</p>
              <p className="mt-0.5 font-mono text-lg font-black text-[#0b3d2e]">{trend.reduce((sum, d) => sum + d.new_signups, 0)}</p>
              <div className="mt-2">
                <MiniBarChart data={trend} valueKey="new_signups" color="#0b3d2e" formatValue={(v) => `${v} member baru`} />
              </div>
            </div>
            <div className="rounded-2xl border border-[#edf3f0] bg-[#f9fbf9] p-3.5">
              <p className="font-mono text-[10px] font-bold uppercase text-[#16a34a]">Member Aktif / Minggu</p>
              <p className="mt-0.5 font-mono text-lg font-black text-[#0b3d2e]">{trend.length ? trend[trend.length - 1].active_members : 0}</p>
              <div className="mt-2">
                <MiniBarChart data={trend} valueKey="active_members" color="#16a34a" formatValue={(v) => `${v} member aktif`} />
              </div>
            </div>
            <div className="rounded-2xl border border-[#edf3f0] bg-[#f9fbf9] p-3.5">
              <p className="font-mono text-[10px] font-bold uppercase text-[#0f766e]">Nilai Belanja / Minggu</p>
              <p className="mt-0.5 truncate font-mono text-lg font-black text-[#0b3d2e]">{trend.length ? formatRupiah(trend[trend.length - 1].revenue) : formatRupiah(0)}</p>
              <div className="mt-2">
                <MiniBarChart data={trend} valueKey="revenue" color="#0f766e" formatValue={(v) => formatRupiah(v)} />
              </div>
            </div>
          </div>

          {trend.every((d) => d.new_signups === 0 && d.active_members === 0) && (
            <p className="mt-4 border-t border-[#edf3f0] pt-3 text-xs text-[#527867]">Belum ada aktivitas dalam 12 minggu terakhir. Grafik akan terisi begitu member baru daftar atau bertransaksi.</p>
          )}
        </div>

      </main>
    </div>
  );
}
