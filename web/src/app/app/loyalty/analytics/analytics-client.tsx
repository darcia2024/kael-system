"use client";

import { useState, useMemo } from "react";
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
  Minus,
  Gift,
  Crown,
  Sparkles,
  Search,
  Download,
  ExternalLink,
  MessageCircle,
  Coins,
  Receipt,
  ShieldAlert,
  ChevronRight,
  SlidersHorizontal,
  Flame,
  Award,
} from "lucide-react";
import type {
  Business,
  LoyaltyProgram,
  LoyaltyTier,
  Reward,
  CustomerProfileSummary,
  LoyaltyOverallStats,
  BusinessPointLedgerRow,
  LoyaltyCampaignSummary,
  ReferralReportRow,
} from "@/lib/types";
import { formatRupiah, formatBusinessDateTime } from "@/lib/formatters";
import { isMochiBusiness } from "@/lib/mochi-brand";
import { mochiThemeClass } from "@/lib/mochi-theme";
import { BusinessMark } from "@/components/business-mark";
import { resolveTier } from "@/lib/loyalty-engine";
import { getMemberSegment, MEMBER_SEGMENT_COPY } from "@/lib/member-segments";

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
    return current > 0 ? (
      <span className="inline-flex items-center gap-0.5 text-[10px] font-bold text-[#16a34a]">
        <ArrowUpRight size={11} /> Baru
      </span>
    ) : (
      <span className="inline-flex items-center gap-0.5 text-[10px] font-bold text-[#789689]">
        <Minus size={11} /> Sama
      </span>
    );
  }
  const pct = Math.round(((current - prior) / prior) * 100);
  if (pct === 0)
    return (
      <span className="inline-flex items-center gap-0.5 text-[10px] font-bold text-[#789689]">
        <Minus size={11} /> 0%
      </span>
    );
  return pct > 0 ? (
    <span className="inline-flex items-center gap-0.5 text-[10px] font-bold text-[#16a34a]">
      <ArrowUpRight size={11} /> +{pct}%
    </span>
  ) : (
    <span className="inline-flex items-center gap-0.5 text-[10px] font-bold text-[#dc2626]">
      <ArrowDownRight size={11} /> {pct}%
    </span>
  );
}

function MiniBarChart({
  data,
  valueKey,
  color,
  formatValue,
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
              className={`w-full rounded-t-md transition-all ${
                isLast ? "brightness-105 shadow-sm" : "opacity-75 hover:opacity-100"
              }`}
              style={{ height: `${heightPct}%`, minHeight: "4px", backgroundColor: color }}
              title={`${new Date(d.week_start).toLocaleDateString("id-ID", {
                day: "numeric",
                month: "short",
              })}: ${formatValue(value)}`}
            />
          </div>
        );
      })}
    </div>
  );
}

export default function AnalyticsClient({
  business,
  program,
  trend,
  summary,
  overall,
  memberInsights,
  tiers,
  rewards,
  recentLedger,
  campaigns,
  referralReport,
}: {
  business: Business | null;
  program: LoyaltyProgram | null;
  trend: MemberGrowthTrendRow[];
  summary: MemberGrowthSummary;
  overall: LoyaltyOverallStats;
  memberInsights: CustomerProfileSummary[];
  tiers: LoyaltyTier[];
  rewards: Reward[];
  recentLedger: BusinessPointLedgerRow[];
  campaigns: LoyaltyCampaignSummary[];
  referralReport: ReferralReportRow[];
}) {
  const isMochi = isMochiBusiness(business);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedSegment, setSelectedSegment] = useState<string>("all");
  const [selectedTier, setSelectedTier] = useState<string>("all");
  const [sortBy, setSortBy] = useState<"spend" | "points" | "visits" | "recent" | "newest">("spend");
  const [activeTab, setActiveTab] = useState<"directory" | "tiers" | "trends" | "feed" | "rewards">("directory");

  // Format repeat purchase rate
  const repeatRatePct =
    summary.activeMembers > 0
      ? Math.round((summary.repeatCustomers / summary.activeMembers) * 100)
      : overall.totalMembers > 0
      ? Math.round((overall.repeatMembersCount / overall.totalMembers) * 100)
      : 0;

  const avgSpendPerMember =
    overall.totalMembers > 0
      ? Math.round(overall.totalMemberRevenue / overall.totalMembers)
      : summary.activeMembers > 0
      ? Math.round(summary.revenue / summary.activeMembers)
      : 0;

  // Process members with segments and tiers
  const processedMembers = useMemo(() => {
    return memberInsights.map((m) => {
      const spend = Number(m.lifetime_spend || 0);
      const tier = tiers.length > 0 ? resolveTier(spend, tiers) : null;
      const segment = getMemberSegment({
        purchase_count: m.purchase_count,
        last_activity_at: m.last_activity_at,
      });

      return {
        ...m,
        lifetime_spend_num: spend,
        tierName: tier?.name ?? "Reguler",
        tierMultiplier: tier?.earn_multiplier ?? 1,
        segment,
      };
    });
  }, [memberInsights, tiers]);

  // Segment counts
  const segmentCounts = useMemo(() => {
    const counts = { all: processedMembers.length, active: 0, new: 0, at_risk: 0, inactive: 0 };
    processedMembers.forEach((m) => {
      counts[m.segment]++;
    });
    return counts;
  }, [processedMembers]);

  // Tier counts & spend
  const tierBreakdown = useMemo(() => {
    const map = new Map<string, { count: number; spend: number; tier: LoyaltyTier | null }>();

    // Base regular tier
    map.set("Reguler", { count: 0, spend: 0, tier: null });

    // Custom tiers
    tiers.forEach((t) => {
      map.set(t.name, { count: 0, spend: 0, tier: t });
    });

    processedMembers.forEach((m) => {
      const existing = map.get(m.tierName) || { count: 0, spend: 0, tier: null };
      existing.count += 1;
      existing.spend += m.lifetime_spend_num;
      map.set(m.tierName, existing);
    });

    return Array.from(map.entries()).map(([name, data]) => ({
      name,
      ...data,
      pct: processedMembers.length > 0 ? Math.round((data.count / processedMembers.length) * 100) : 0,
    }));
  }, [processedMembers, tiers]);

  // Filtered and sorted members
  const filteredMembers = useMemo(() => {
    return processedMembers
      .filter((m) => {
        // Search filter
        if (searchQuery.trim()) {
          const q = searchQuery.toLowerCase();
          const matchName = (m.name || "").toLowerCase().includes(q);
          const matchPhone = (m.phone || "").includes(q);
          if (!matchName && !matchPhone) return false;
        }

        // Segment filter
        if (selectedSegment !== "all" && m.segment !== selectedSegment) {
          return false;
        }

        // Tier filter
        if (selectedTier !== "all" && m.tierName !== selectedTier) {
          return false;
        }

        return true;
      })
      .sort((a, b) => {
        if (sortBy === "spend") return b.lifetime_spend_num - a.lifetime_spend_num;
        if (sortBy === "points") return b.balance - a.balance;
        if (sortBy === "visits") return b.purchase_count - a.purchase_count;
        if (sortBy === "recent") {
          const dateA = a.last_activity_at ? new Date(a.last_activity_at).getTime() : 0;
          const dateB = b.last_activity_at ? new Date(b.last_activity_at).getTime() : 0;
          return dateB - dateA;
        }
        if (sortBy === "newest") {
          return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
        }
        return 0;
      });
  }, [processedMembers, searchQuery, selectedSegment, selectedTier, sortBy]);

  // Export to CSV function
  const handleExportCSV = () => {
    if (!processedMembers.length) return;

    const headers = [
      "Nama Member",
      "Nomor WhatsApp",
      "Tier / Level",
      "Status Segmentasi",
      "Saldo Poin",
      "Total Poin Didapat",
      "Total Transaksi",
      "Total Belanja (Rp)",
      "Kunjungan Terakhir",
      "Tanggal Bergabung",
    ];

    const rows = processedMembers.map((m) => [
      `"${(m.name || "Member KAEL").replace(/"/g, '""')}"`,
      `"${m.phone}"`,
      `"${m.tierName}"`,
      `"${MEMBER_SEGMENT_COPY[m.segment].label}"`,
      m.balance,
      m.points_earned,
      m.purchase_count,
      m.lifetime_spend_num,
      m.last_activity_at ? `"${m.last_activity_at}"` : '"Belum pernah"',
      `"${m.created_at}"`,
    ]);

    const csvContent = "data:text/csv;charset=utf-8,\uFEFF" + [headers.join(","), ...rows.map((e) => e.join(","))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute(
      "download",
      `data-member-${business?.name.toLowerCase().replace(/\s+/g, "-") || "kael"}-${new Date().toISOString().slice(0, 10)}.csv`
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Helper formatting for recency
  const formatRecency = (lastActivity: string | null) => {
    if (!lastActivity) return "Belum pernah";
    const days = Math.floor((Date.now() - new Date(lastActivity).getTime()) / 86_400_000);
    if (days === 0) return "Hari ini";
    if (days === 1) return "Kemarin";
    if (days < 7) return `${days} hari lalu`;
    if (days < 30) return `${Math.floor(days / 7)} minggu lalu`;
    if (days < 365) return `${Math.floor(days / 30)} bulan lalu`;
    return `${Math.floor(days / 365)} thn lalu`;
  };

  return (
    <div className={`${mochiThemeClass(business)} min-h-screen bg-[#f0f5f2] text-[#1a382d] font-sans pb-16`}>
      {/* TOP STICKY HEADER */}
      <header className="sticky top-0 z-30 border-b border-[#07281e] bg-[#0b3d2e] text-white shadow-md">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-2 px-3 py-2.5 sm:px-6">
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
                  className="h-7 w-7 rounded-full border border-emerald-400/40 shadow-xs shrink-0"
                />
                <h1 className="truncate text-xs font-black sm:text-base tracking-tight">
                  Analitik &amp; Intelijen Member
                </h1>
              </div>
              <span className="block truncate font-mono text-[10px] text-emerald-200/80 sm:text-[11px]">
                {business?.name} · Dashboard Lengkap Owner &amp; Manajemen Loyalitas
              </span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleExportCSV}
              className="hidden sm:inline-flex items-center gap-1.5 rounded-xl border border-emerald-500/40 bg-[#144f3d] px-3 py-1.5 font-mono text-xs font-bold text-white hover:bg-[#1a5e4a] transition-all shadow-sm"
              title="Unduh data seluruh member dalam format CSV/Excel"
            >
              <Download size={13} />
              <span>Ekspor CSV</span>
            </button>
            <Link
              href="/app/pos/owner"
              className="flex items-center gap-1.5 rounded-xl bg-[#c8f53a] px-3.5 py-1.5 font-mono text-xs font-black text-[#0b3d2e] shadow-sm hover:brightness-105 active:scale-[0.98] transition-all"
            >
              <LayoutDashboard size={13} />
              <span className="hidden sm:inline">Dashboard Owner</span>
              <span className="sm:hidden">Owner</span>
            </Link>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-7xl space-y-6 p-3 sm:p-6 lg:p-8">
        {/* QUICK REPORT SWITCHER BAR */}
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
          <span className="inline-flex shrink-0 items-center gap-1.5 rounded-xl bg-[#0b3d2e] border border-[#0b3d2e] px-3.5 py-1.5 font-bold text-[#c8f53a] shadow-sm">
            <Sparkles size={13} />
            <span>Laporan Loyalty Member</span>
          </span>
          <Link
            href="/app/review/reports"
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

        {/* SECTION 1: 8 EXECUTIVE METRIC CARDS */}
        <div className="grid grid-cols-2 gap-2.5 sm:gap-4 lg:grid-cols-4">
          {/* Card 1: Total Registered Members */}
          <div className="rounded-2xl border border-[#d8e3de] bg-white p-3.5 shadow-sm sm:rounded-3xl sm:p-5 hover:border-[#0b3d2e]/30 transition-all">
            <div className="flex items-center justify-between border-b border-[#edf3f0] pb-1.5 sm:pb-2.5">
              <span className="font-mono text-[9px] font-bold uppercase text-[#0b3d2e] sm:text-[10px]">
                TOTAL MEMBER TERDAFTAR
              </span>
              <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-[#e6f4ed] text-[#0b3d2e] sm:h-7 sm:w-7">
                <Users size={13} />
              </span>
            </div>
            <div className="mt-2 sm:mt-3">
              <h3 className="font-mono text-xl font-black text-[#0b3d2e] sm:text-2xl">
                {overall.totalMembers} <span className="text-xs font-normal text-[#527867]">orang</span>
              </h3>
              <div className="mt-0.5 flex items-center gap-1.5 sm:mt-1">
                <span className="inline-flex items-center gap-0.5 text-[10px] font-bold text-[#16a34a]">
                  <ArrowUpRight size={11} /> +{overall.newMembers30d} baru
                </span>
                <span className="text-[9.5px] text-[#527867]">dalam 30 hari</span>
              </div>
            </div>
          </div>

          {/* Card 2: Active Members 30D */}
          <div className="rounded-2xl border border-[#d8e3de] bg-white p-3.5 shadow-sm sm:rounded-3xl sm:p-5 hover:border-[#0b3d2e]/30 transition-all">
            <div className="flex items-center justify-between border-b border-[#edf3f0] pb-1.5 sm:pb-2.5">
              <span className="font-mono text-[9px] font-bold uppercase text-[#16a34a] sm:text-[10px]">
                MEMBER AKTIF (30 HARI)
              </span>
              <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-[#dcfce7] text-[#16a34a] sm:h-7 sm:w-7">
                <UserCheck size={13} />
              </span>
            </div>
            <div className="mt-2 sm:mt-3">
              <h3 className="font-mono text-xl font-black text-[#0b3d2e] sm:text-2xl">
                {overall.activeMembers30d || summary.activeMembers}{" "}
                <span className="text-xs font-normal text-[#527867]">member</span>
              </h3>
              <div className="mt-0.5 flex items-center gap-1.5 sm:mt-1">
                <DeltaBadge current={summary.activeMembers} prior={summary.activeMembersPrior} />
                <span className="text-[9.5px] text-[#527867]">vs {summary.activeMembersPrior} periode lalu</span>
              </div>
            </div>
          </div>

          {/* Card 3: Repeat Purchase Rate */}
          <div className="rounded-2xl border border-[#d8e3de] bg-white p-3.5 shadow-sm sm:rounded-3xl sm:p-5 hover:border-[#0b3d2e]/30 transition-all">
            <div className="flex items-center justify-between border-b border-[#edf3f0] pb-1.5 sm:pb-2.5">
              <span className="font-mono text-[9px] font-bold uppercase text-[#0f766e] sm:text-[10px]">
                REPEAT PURCHASE RATE
              </span>
              <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-[#ccfbf1] text-[#0f766e] sm:h-7 sm:w-7">
                <Repeat size={13} />
              </span>
            </div>
            <div className="mt-2 sm:mt-3">
              <h3 className="font-mono text-xl font-black text-[#0b3d2e] sm:text-2xl">{repeatRatePct}%</h3>
              <span className="mt-0.5 block text-[9.5px] text-[#527867] sm:mt-1">
                {overall.repeatMembersCount || summary.repeatCustomers} dari {overall.totalMembers} member belanja &gt;1x
              </span>
            </div>
          </div>

          {/* Card 4: Total Member Revenue */}
          <div className="rounded-2xl border border-[#d8e3de] bg-white p-3.5 shadow-sm sm:rounded-3xl sm:p-5 hover:border-[#0b3d2e]/30 transition-all">
            <div className="flex items-center justify-between border-b border-[#edf3f0] pb-1.5 sm:pb-2.5">
              <span className="font-mono text-[9px] font-bold uppercase text-[#0b3d2e] sm:text-[10px]">
                TOTAL BELANJA MEMBER
              </span>
              <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-[#e6f4ed] text-[#0b3d2e] sm:h-7 sm:w-7">
                <TrendingUp size={13} />
              </span>
            </div>
            <div className="mt-2 sm:mt-3">
              <h3 className="truncate font-mono text-base font-black text-[#0b3d2e] sm:text-2xl">
                {formatRupiah(overall.totalMemberRevenue || summary.revenue)}
              </h3>
              <div className="mt-0.5 flex items-center gap-1.5 sm:mt-1">
                <span className="text-[9.5px] text-[#527867]">
                  Rata-rata {formatRupiah(avgSpendPerMember)}/member
                </span>
              </div>
            </div>
          </div>

          {/* Card 5: Total Points Balance (Circulating) */}
          <div className="rounded-2xl border border-[#d8e3de] bg-white p-3.5 shadow-sm sm:rounded-3xl sm:p-5 hover:border-[#0b3d2e]/30 transition-all">
            <div className="flex items-center justify-between border-b border-[#edf3f0] pb-1.5 sm:pb-2.5">
              <span className="font-mono text-[9px] font-bold uppercase text-[#d97706] sm:text-[10px]">
                SALDO POIN BEREDAR
              </span>
              <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-[#fef3c7] text-[#d97706] sm:h-7 sm:w-7">
                <Coins size={13} />
              </span>
            </div>
            <div className="mt-2 sm:mt-3">
              <h3 className="font-mono text-xl font-black text-[#b45309] sm:text-2xl">
                {overall.totalPointsBalance.toLocaleString("id-ID")}{" "}
                <span className="text-xs font-normal text-[#92400e]">Poin</span>
              </h3>
              <span className="mt-0.5 block text-[9.5px] text-[#78716c] sm:mt-1">
                Poin aktif yang siap ditukar hadiah
              </span>
            </div>
          </div>

          {/* Card 6: Points Earned (Issued) */}
          <div className="rounded-2xl border border-[#d8e3de] bg-white p-3.5 shadow-sm sm:rounded-3xl sm:p-5 hover:border-[#0b3d2e]/30 transition-all">
            <div className="flex items-center justify-between border-b border-[#edf3f0] pb-1.5 sm:pb-2.5">
              <span className="font-mono text-[9px] font-bold uppercase text-[#167052] sm:text-[10px]">
                TOTAL POIN DIBERIKAN
              </span>
              <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-[#edf8f3] text-[#167052] sm:h-7 sm:w-7">
                <Sparkles size={13} />
              </span>
            </div>
            <div className="mt-2 sm:mt-3">
              <h3 className="font-mono text-xl font-black text-[#167052] sm:text-2xl">
                {overall.totalPointsEarned.toLocaleString("id-ID")}{" "}
                <span className="text-xs font-normal text-[#527867]">Poin</span>
              </h3>
              <span className="mt-0.5 block text-[9.5px] text-[#527867] sm:mt-1">
                Akumulasi reward belanja pelanggan
              </span>
            </div>
          </div>

          {/* Card 7: Points Redeemed */}
          <div className="rounded-2xl border border-[#d8e3de] bg-white p-3.5 shadow-sm sm:rounded-3xl sm:p-5 hover:border-[#0b3d2e]/30 transition-all">
            <div className="flex items-center justify-between border-b border-[#edf3f0] pb-1.5 sm:pb-2.5">
              <span className="font-mono text-[9px] font-bold uppercase text-[#7c3aed] sm:text-[10px]">
                HADIAH DITUKAR (REDEEMED)
              </span>
              <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-[#f3e8ff] text-[#7c3aed] sm:h-7 sm:w-7">
                <Gift size={13} />
              </span>
            </div>
            <div className="mt-2 sm:mt-3">
              <h3 className="font-mono text-xl font-black text-[#7c3aed] sm:text-2xl">
                {overall.totalPointsRedeemed.toLocaleString("id-ID")}{" "}
                <span className="text-xs font-normal text-[#6b21a8]">Poin</span>
              </h3>
              <span className="mt-0.5 block text-[9.5px] text-[#7e22ce] sm:mt-1">
                Kupon &amp; reward sukses diklaim
              </span>
            </div>
          </div>

          {/* Card 8: Total Member Transactions */}
          <div className="rounded-2xl border border-[#d8e3de] bg-white p-3.5 shadow-sm sm:rounded-3xl sm:p-5 hover:border-[#0b3d2e]/30 transition-all">
            <div className="flex items-center justify-between border-b border-[#edf3f0] pb-1.5 sm:pb-2.5">
              <span className="font-mono text-[9px] font-bold uppercase text-[#2563eb] sm:text-[10px]">
                TOTAL TRANSAKSI MEMBER
              </span>
              <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-[#eff6ff] text-[#2563eb] sm:h-7 sm:w-7">
                <Receipt size={13} />
              </span>
            </div>
            <div className="mt-2 sm:mt-3">
              <h3 className="font-mono text-xl font-black text-[#1e40af] sm:text-2xl">
                {overall.totalMemberTransactions.toLocaleString("id-ID")}{" "}
                <span className="text-xs font-normal text-[#3b82f6]">kali</span>
              </h3>
              <span className="mt-0.5 block text-[9.5px] text-[#60a5fa] sm:mt-1">
                Kunjungan &amp; checkout kasir ber-member
              </span>
            </div>
          </div>
        </div>

        {/* OWNER ACTION & INTELLIGENCE ALERTS */}
        {overall.atRiskMembersCount > 0 && (
          <div className="rounded-2xl border-2 border-[#fcd34d] bg-[#fffbeb] p-4 text-[#92400e] shadow-sm sm:flex sm:items-center sm:justify-between gap-4">
            <div className="flex items-start gap-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#fef3c7] text-[#d97706]">
                <ShieldAlert size={18} />
              </div>
              <div>
                <h4 className="font-black text-sm text-[#78350f]">
                  Perhatian Owner: Ada {overall.atRiskMembersCount} Member yang Mulai Jarang Datang (&gt;30 Hari)
                </h4>
                <p className="text-xs text-[#92400e] mt-0.5 leading-relaxed">
                  Pancing kedatangan mereka kembali dengan mengirim pesan sapaan ramah WhatsApp atau kupon diskon spesial.
                </p>
              </div>
            </div>
            <div className="mt-3 sm:mt-0 shrink-0">
              <button
                onClick={() => {
                  setSelectedSegment("at_risk");
                  setActiveTab("directory");
                }}
                className="inline-flex items-center gap-1.5 rounded-xl bg-[#d97706] px-4 py-2 text-xs font-black text-white hover:bg-[#b45309] shadow-sm transition-all"
              >
                <span>Lihat {overall.atRiskMembersCount} Member Ini</span>
                <ChevronRight size={14} />
              </button>
            </div>
          </div>
        )}

        {/* TAB CONTROLS */}
        <div className="flex items-center gap-1.5 border-b border-[#d8e3de] pb-1 overflow-x-auto no-scrollbar font-mono text-xs">
          <button
            onClick={() => setActiveTab("directory")}
            className={`flex items-center gap-2 rounded-xl px-4 py-2 font-bold transition-all ${
              activeTab === "directory"
                ? "bg-[#0b3d2e] text-[#c8f53a] shadow-sm"
                : "text-[#527867] hover:bg-white hover:text-[#0b3d2e]"
            }`}
          >
            <Users size={14} />
            <span>Direktori Member ({processedMembers.length})</span>
          </button>

          <button
            onClick={() => setActiveTab("tiers")}
            className={`flex items-center gap-2 rounded-xl px-4 py-2 font-bold transition-all ${
              activeTab === "tiers"
                ? "bg-[#0b3d2e] text-[#c8f53a] shadow-sm"
                : "text-[#527867] hover:bg-white hover:text-[#0b3d2e]"
            }`}
          >
            <Crown size={14} />
            <span>Status &amp; Level Keanggotaan</span>
          </button>

          <button
            onClick={() => setActiveTab("trends")}
            className={`flex items-center gap-2 rounded-xl px-4 py-2 font-bold transition-all ${
              activeTab === "trends"
                ? "bg-[#0b3d2e] text-[#c8f53a] shadow-sm"
                : "text-[#527867] hover:bg-white hover:text-[#0b3d2e]"
            }`}
          >
            <TrendingUp size={14} />
            <span>Grafik Tren 12 Minggu</span>
          </button>

          <button
            onClick={() => setActiveTab("feed")}
            className={`flex items-center gap-2 rounded-xl px-4 py-2 font-bold transition-all ${
              activeTab === "feed"
                ? "bg-[#0b3d2e] text-[#c8f53a] shadow-sm"
                : "text-[#527867] hover:bg-white hover:text-[#0b3d2e]"
            }`}
          >
            <Flame size={14} />
            <span>Aktivitas Poin Live ({recentLedger.length})</span>
          </button>

          <button
            onClick={() => setActiveTab("rewards")}
            className={`flex items-center gap-2 rounded-xl px-4 py-2 font-bold transition-all ${
              activeTab === "rewards"
                ? "bg-[#0b3d2e] text-[#c8f53a] shadow-sm"
                : "text-[#527867] hover:bg-white hover:text-[#0b3d2e]"
            }`}
          >
            <Gift size={14} />
            <span>Katalog Reward ({rewards.length})</span>
          </button>
        </div>

        {/* TAB 1: DIREKTORI MEMBER LENGKAP */}
        {activeTab === "directory" && (
          <div className="space-y-4">
            {/* Filter & Search Toolbar */}
            <div className="rounded-2xl border border-[#d8e3de] bg-white p-4 shadow-sm space-y-3">
              <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
                {/* Search Box */}
                <div className="relative w-full sm:w-80">
                  <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#789689]" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Cari nama atau nomor WA..."
                    className="w-full rounded-xl border border-[#d8e3de] bg-[#f9fbf9] pl-9 pr-3 py-2 text-xs font-medium text-[#1a382d] placeholder-[#789689] focus:border-[#0b3d2e] focus:bg-white focus:outline-none"
                  />
                  {searchQuery && (
                    <button
                      onClick={() => setSearchQuery("")}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-[#789689] hover:text-[#0b3d2e]"
                    >
                      ✕
                    </button>
                  )}
                </div>

                {/* Sort selector */}
                <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
                  <span className="text-xs font-bold text-[#527867] flex items-center gap-1 font-mono shrink-0">
                    <SlidersHorizontal size={13} /> Urutkan:
                  </span>
                  <select
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value as any)}
                    className="rounded-xl border border-[#d8e3de] bg-[#f9fbf9] px-3 py-2 text-xs font-bold text-[#0b3d2e] focus:border-[#0b3d2e] focus:bg-white focus:outline-none"
                  >
                    <option value="spend">Total Belanja Terbesar</option>
                    <option value="points">Saldo Poin Terbanyak</option>
                    <option value="visits">Kunjungan Terbanyak</option>
                    <option value="recent">Kunjungan Terakhir</option>
                    <option value="newest">Member Paling Baru</option>
                  </select>

                  <button
                    onClick={handleExportCSV}
                    className="sm:hidden flex items-center gap-1 rounded-xl bg-[#0b3d2e] px-3 py-2 text-xs font-bold text-[#c8f53a]"
                  >
                    <Download size={13} />
                    <span>CSV</span>
                  </button>
                </div>
              </div>

              {/* Segment Pills */}
              <div className="flex items-center gap-2 overflow-x-auto pt-2 border-t border-[#edf3f0] no-scrollbar font-mono text-[11px]">
                <button
                  onClick={() => setSelectedSegment("all")}
                  className={`rounded-xl px-3 py-1.5 font-bold transition-all shrink-0 ${
                    selectedSegment === "all"
                      ? "bg-[#0b3d2e] text-[#c8f53a]"
                      : "bg-[#edf3f0] text-[#527867] hover:bg-[#d8e3de]"
                  }`}
                >
                  Semua ({segmentCounts.all})
                </button>
                <button
                  onClick={() => setSelectedSegment("active")}
                  className={`rounded-xl px-3 py-1.5 font-bold transition-all shrink-0 ${
                    selectedSegment === "active"
                      ? "bg-[#16a34a] text-white"
                      : "bg-[#dcfce7] text-[#16a34a] hover:bg-[#bbf7d0]"
                  }`}
                >
                  Aktif ({segmentCounts.active})
                </button>
                <button
                  onClick={() => setSelectedSegment("new")}
                  className={`rounded-xl px-3 py-1.5 font-bold transition-all shrink-0 ${
                    selectedSegment === "new"
                      ? "bg-[#0284c7] text-white"
                      : "bg-[#e0f2fe] text-[#0284c7] hover:bg-[#bae6fd]"
                  }`}
                >
                  Baru Daftar ({segmentCounts.new})
                </button>
                <button
                  onClick={() => setSelectedSegment("at_risk")}
                  className={`rounded-xl px-3 py-1.5 font-bold transition-all shrink-0 ${
                    selectedSegment === "at_risk"
                      ? "bg-[#d97706] text-white"
                      : "bg-[#fef3c7] text-[#d97706] hover:bg-[#fde68a]"
                  }`}
                >
                  Mulai Jarang ({segmentCounts.at_risk})
                </button>
                <button
                  onClick={() => setSelectedSegment("inactive")}
                  className={`rounded-xl px-3 py-1.5 font-bold transition-all shrink-0 ${
                    selectedSegment === "inactive"
                      ? "bg-[#64748b] text-white"
                      : "bg-[#f1f5f9] text-[#64748b] hover:bg-[#e2e8f0]"
                  }`}
                >
                  Lama Tidak Belanja ({segmentCounts.inactive})
                </button>

                {/* Tier filters */}
                {tiers.length > 0 && (
                  <>
                    <span className="text-[#cbd5e1] px-1">|</span>
                    {tiers.map((t) => (
                      <button
                        key={t.id}
                        onClick={() => setSelectedTier(selectedTier === t.name ? "all" : t.name)}
                        className={`rounded-xl px-3 py-1.5 font-bold transition-all shrink-0 ${
                          selectedTier === t.name
                            ? "bg-[#b45309] text-white"
                            : "bg-[#fef3c7] text-[#92400e] hover:bg-[#fde68a]"
                        }`}
                      >
                        Level {t.name}
                      </button>
                    ))}
                  </>
                )}
              </div>
            </div>

            {/* Member List Cards / Table */}
            {filteredMembers.length === 0 ? (
              <div className="rounded-2xl border border-[#d8e3de] bg-white p-8 text-center space-y-2">
                <Users size={32} className="mx-auto text-[#a2b8ad]" />
                <h4 className="font-black text-sm text-[#0b3d2e]">Tidak ada member yang cocok</h4>
                <p className="text-xs text-[#527867]">
                  Coba ubah kata kunci pencarian atau ganti filter segmentasi di atas.
                </p>
              </div>
            ) : (
              <div className="rounded-2xl border border-[#d8e3de] bg-white shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-left font-sans text-xs">
                    <thead className="bg-[#f0f5f2] border-b border-[#d8e3de] font-mono text-[10px] uppercase text-[#527867]">
                      <tr>
                        <th className="py-3 px-4">Member</th>
                        <th className="py-3 px-4">Status &amp; Tier</th>
                        <th className="py-3 px-4 text-right">Total Belanja</th>
                        <th className="py-3 px-4 text-center">Kunjungan</th>
                        <th className="py-3 px-4 text-right">Saldo Poin</th>
                        <th className="py-3 px-4">Kunjungan Terakhir</th>
                        <th className="py-3 px-4 text-right">Aksi</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#edf3f0]">
                      {filteredMembers.map((m) => {
                        const waNumber = m.phone.replace(/[^0-9]/g, "");
                        const waClean = waNumber.startsWith("0") ? "62" + waNumber.slice(1) : waNumber;
                        const waMsg = encodeURIComponent(
                          `Halo Kak ${m.name || ""}, terima kasih sudah menjadi member setia di ${
                            business?.name || "toko kami"
                          }. Ada promo spesial untuk Kakak hari ini!`
                        );

                        return (
                          <tr key={m.id} className="hover:bg-[#f9fbf9] transition-colors">
                            {/* Member Info */}
                            <td className="py-3.5 px-4">
                              <div className="flex items-center gap-2.5">
                                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#0b3d2e] font-mono text-xs font-black text-[#c8f53a]">
                                  {(m.name || "M").charAt(0).toUpperCase()}
                                </div>
                                <div className="min-w-0">
                                  <Link
                                    href={`/app/loyalty/member/${m.id}`}
                                    className="font-black text-xs text-[#0b3d2e] hover:underline truncate block"
                                  >
                                    {m.name || "Pelanggan Member"}
                                  </Link>
                                  <span className="font-mono text-[11px] text-[#527867]">{m.phone}</span>
                                </div>
                              </div>
                            </td>

                            {/* Status & Tier */}
                            <td className="py-3.5 px-4">
                              <div className="space-y-1">
                                {m.tierName !== "Reguler" ? (
                                  <span className="inline-flex items-center gap-1 rounded-md bg-[#fef3c7] px-2 py-0.5 font-mono text-[10px] font-black text-[#92400e] border border-[#fcd34d]">
                                    <Crown size={10} /> {m.tierName}
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center gap-1 rounded-md bg-[#edf3f0] px-2 py-0.5 font-mono text-[10px] font-bold text-[#527867]">
                                    Reguler
                                  </span>
                                )}

                                <div>
                                  {m.segment === "active" && (
                                    <span className="inline-flex items-center gap-1 text-[10px] font-bold text-[#16a34a]">
                                      <span className="h-1.5 w-1.5 rounded-full bg-[#16a34a]" /> Aktif
                                    </span>
                                  )}
                                  {m.segment === "new" && (
                                    <span className="inline-flex items-center gap-1 text-[10px] font-bold text-[#0284c7]">
                                      <span className="h-1.5 w-1.5 rounded-full bg-[#0284c7]" /> Baru
                                    </span>
                                  )}
                                  {m.segment === "at_risk" && (
                                    <span className="inline-flex items-center gap-1 text-[10px] font-bold text-[#d97706]">
                                      <span className="h-1.5 w-1.5 rounded-full bg-[#d97706]" /> Mulai Jarang
                                    </span>
                                  )}
                                  {m.segment === "inactive" && (
                                    <span className="inline-flex items-center gap-1 text-[10px] font-bold text-[#64748b]">
                                      <span className="h-1.5 w-1.5 rounded-full bg-[#64748b]" /> Pasif
                                    </span>
                                  )}
                                </div>
                              </div>
                            </td>

                            {/* Total Belanja */}
                            <td className="py-3.5 px-4 text-right">
                              <span className="font-mono text-xs font-black text-[#0b3d2e]">
                                {formatRupiah(m.lifetime_spend_num)}
                              </span>
                            </td>

                            {/* Kunjungan */}
                            <td className="py-3.5 px-4 text-center">
                              <span className="inline-block rounded-lg bg-[#edf3f0] px-2 py-1 font-mono text-xs font-black text-[#0b3d2e]">
                                {m.purchase_count}x
                              </span>
                            </td>

                            {/* Saldo Poin */}
                            <td className="py-3.5 px-4 text-right">
                              <span className="font-mono text-xs font-black text-[#b45309]">
                                {m.balance.toLocaleString("id-ID")}
                              </span>
                              <span className="block text-[9.5px] text-[#78716c]">
                                total +{m.points_earned}
                              </span>
                            </td>

                            {/* Kunjungan Terakhir */}
                            <td className="py-3.5 px-4">
                              <div className="space-y-0.5">
                                <span className="font-bold text-xs text-[#1a382d]">
                                  {formatRecency(m.last_activity_at)}
                                </span>
                                {m.last_activity_at && (
                                  <span className="block font-mono text-[10px] text-[#789689]">
                                    {new Date(m.last_activity_at).toLocaleDateString("id-ID", {
                                      day: "numeric",
                                      month: "short",
                                      year: "numeric",
                                    })}
                                  </span>
                                )}
                              </div>
                            </td>

                            {/* Actions */}
                            <td className="py-3.5 px-4 text-right">
                              <div className="flex items-center justify-end gap-1.5">
                                <a
                                  href={`https://wa.me/${waClean}?text=${waMsg}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#25d366]/15 text-[#128c7e] hover:bg-[#25d366] hover:text-white transition-all"
                                  title="Chat WhatsApp Member"
                                >
                                  <MessageCircle size={14} />
                                </a>

                                <Link
                                  href={`/m/${m.token}`}
                                  target="_blank"
                                  className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#edf3f0] text-[#0b3d2e] hover:bg-[#d8e3de] transition-all"
                                  title="Buka Kartu Member Digital"
                                >
                                  <ExternalLink size={14} />
                                </Link>

                                <Link
                                  href={`/app/loyalty/member/${m.id}`}
                                  className="inline-flex items-center gap-1 rounded-lg bg-[#0b3d2e] px-2.5 py-1.5 font-mono text-[11px] font-black text-[#c8f53a] hover:bg-[#144f3d] transition-all"
                                >
                                  <span>Detail</span>
                                </Link>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}

        {/* TAB 2: LEVEL & STATUS KEANGGOTAAN */}
        {activeTab === "tiers" && (
          <div className="space-y-6">
            <div className="rounded-2xl border border-[#d8e3de] bg-white p-5 shadow-sm space-y-4">
              <div className="border-b border-[#edf3f0] pb-3">
                <h3 className="text-base font-extrabold text-[#0b3d2e] flex items-center gap-2">
                  <Crown size={18} className="text-[#d97706]" />
                  <span>Breakdown Level Keanggotaan &amp; Segmentasi</span>
                </h3>
                <p className="text-xs text-[#527867]">
                  Evaluasi kontribusi masing-masing tier member terhadap total omzet toko dan sebaran pelanggan.
                </p>
              </div>

              {/* Tier Cards Grid */}
              <div className="grid gap-4 sm:grid-cols-3">
                {tierBreakdown.map((tb) => (
                  <div
                    key={tb.name}
                    className={`rounded-2xl border p-4 shadow-sm relative overflow-hidden ${
                      tb.name === "Emas"
                        ? "border-[#fcd34d] bg-gradient-to-b from-[#fffdf5] to-[#fef9c3]"
                        : tb.name === "Perak"
                        ? "border-[#cbd5e1] bg-gradient-to-b from-[#f8fafc] to-[#e2e8f0]"
                        : "border-[#d8e3de] bg-[#f9fbf9]"
                    }`}
                  >
                    <div className="flex items-center justify-between pb-2 border-b border-black/5">
                      <div className="flex items-center gap-1.5">
                        <Award
                          size={16}
                          className={
                            tb.name === "Emas"
                              ? "text-[#d97706]"
                              : tb.name === "Perak"
                              ? "text-[#64748b]"
                              : "text-[#16a34a]"
                          }
                        />
                        <span className="font-mono text-xs font-black uppercase text-[#1a382d]">
                          Level {tb.name}
                        </span>
                      </div>
                      {tb.tier?.earn_multiplier && tb.tier.earn_multiplier > 1 && (
                        <span className="rounded-full bg-[#0b3d2e] px-2 py-0.5 font-mono text-[10px] font-black text-[#c8f53a]">
                          Poin {tb.tier.earn_multiplier}x
                        </span>
                      )}
                    </div>

                    <div className="mt-3 space-y-2">
                      <div>
                        <span className="text-[10px] font-bold text-[#527867] uppercase font-mono">
                          Populasi Member
                        </span>
                        <h4 className="font-mono text-2xl font-black text-[#0b3d2e]">
                          {tb.count} <span className="text-xs font-normal text-[#527867]">({tb.pct}%)</span>
                        </h4>
                      </div>

                      <div className="pt-2 border-t border-black/5">
                        <span className="text-[10px] font-bold text-[#527867] uppercase font-mono">
                          Total Omzet dari Tier Ini
                        </span>
                        <p className="font-mono text-sm font-black text-[#0b3d2e]">
                          {formatRupiah(tb.spend)}
                        </p>
                      </div>

                      {tb.tier && (
                        <div className="text-[11px] text-[#527867] bg-white/70 rounded-xl p-2 border border-black/5">
                          <p className="font-bold">Syarat: Min. Belanja {formatRupiah(tb.tier.min_lifetime_spend)}</p>
                          {tb.tier.benefit_note && <p className="text-[10px] italic mt-0.5">{tb.tier.benefit_note}</p>}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Segment Analysis */}
            <div className="rounded-2xl border border-[#d8e3de] bg-white p-5 shadow-sm space-y-4">
              <div className="border-b border-[#edf3f0] pb-3">
                <h4 className="text-sm font-extrabold text-[#0b3d2e]">Kesehatan Segmentasi Retensi</h4>
                <p className="text-xs text-[#527867]">Distribusi kebiasaan berbelanja pelanggan di toko Anda.</p>
              </div>

              <div className="grid gap-3 sm:grid-cols-4 font-mono text-xs">
                <div className="rounded-xl border border-[#dcfce7] bg-[#f0fdf4] p-3 space-y-1">
                  <div className="flex items-center justify-between text-[#16a34a] font-bold">
                    <span>MEMBER AKTIF</span>
                    <span>{segmentCounts.active}</span>
                  </div>
                  <p className="font-sans text-[11px] text-[#15803d]">Belanja dalam 30 hari terakhir.</p>
                </div>

                <div className="rounded-xl border border-[#e0f2fe] bg-[#f0f9ff] p-3 space-y-1">
                  <div className="flex items-center justify-between text-[#0284c7] font-bold">
                    <span>MEMBER BARU</span>
                    <span>{segmentCounts.new}</span>
                  </div>
                  <p className="font-sans text-[11px] text-[#0369a1]">Daftar baru, menunggu transaksi perdana.</p>
                </div>

                <div className="rounded-xl border border-[#fef3c7] bg-[#fffbeb] p-3 space-y-1">
                  <div className="flex items-center justify-between text-[#d97706] font-bold">
                    <span>MULAI JARANG</span>
                    <span>{segmentCounts.at_risk}</span>
                  </div>
                  <p className="font-sans text-[11px] text-[#b45309]">31-60 hari belum belanja lagi.</p>
                </div>

                <div className="rounded-xl border border-[#f1f5f9] bg-[#f8fafc] p-3 space-y-1">
                  <div className="flex items-center justify-between text-[#64748b] font-bold">
                    <span>PASIF (&gt;60 HARI)</span>
                    <span>{segmentCounts.inactive}</span>
                  </div>
                  <p className="font-sans text-[11px] text-[#475569]">Lebih dari 2 bulan tidak ada kunjungan.</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 3: TREN 12 MINGGU */}
        {activeTab === "trends" && (
          <div className="rounded-2xl border border-[#d8e3de] bg-white p-4 shadow-sm sm:rounded-3xl sm:p-6 space-y-6">
            <div className="border-b border-[#edf3f0] pb-3">
              <h3 className="text-base font-extrabold text-[#0b3d2e]">Tren Pertumbuhan 12 Minggu Terakhir</h3>
              <p className="text-xs text-[#527867]">
                Garis dasar pertumbuhan untuk menilai apakah ajakan, referral, dan promo benar-benar menambah member &amp; omzet.
              </p>
            </div>

            <div className="grid gap-5 sm:grid-cols-3">
              <div className="rounded-2xl border border-[#edf3f0] bg-[#f9fbf9] p-4">
                <p className="font-mono text-[10px] font-bold uppercase text-[#167052]">Pendaftaran Baru</p>
                <p className="mt-0.5 font-mono text-xl font-black text-[#0b3d2e]">
                  {trend.reduce((sum, d) => sum + d.new_signups, 0)} member
                </p>
                <div className="mt-2">
                  <MiniBarChart
                    data={trend}
                    valueKey="new_signups"
                    color="#0b3d2e"
                    formatValue={(v) => `${v} member baru`}
                  />
                </div>
              </div>

              <div className="rounded-2xl border border-[#edf3f0] bg-[#f9fbf9] p-4">
                <p className="font-mono text-[10px] font-bold uppercase text-[#16a34a]">Member Aktif / Minggu</p>
                <p className="mt-0.5 font-mono text-xl font-black text-[#0b3d2e]">
                  {trend.length ? trend[trend.length - 1].active_members : 0} aktif
                </p>
                <div className="mt-2">
                  <MiniBarChart
                    data={trend}
                    valueKey="active_members"
                    color="#16a34a"
                    formatValue={(v) => `${v} member aktif`}
                  />
                </div>
              </div>

              <div className="rounded-2xl border border-[#edf3f0] bg-[#f9fbf9] p-4">
                <p className="font-mono text-[10px] font-bold uppercase text-[#0f766e]">Nilai Belanja / Minggu</p>
                <p className="mt-0.5 truncate font-mono text-xl font-black text-[#0b3d2e]">
                  {trend.length ? formatRupiah(trend[trend.length - 1].revenue) : formatRupiah(0)}
                </p>
                <div className="mt-2">
                  <MiniBarChart
                    data={trend}
                    valueKey="revenue"
                    color="#0f766e"
                    formatValue={(v) => formatRupiah(v)}
                  />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 4: AKTIVITAS POIN LIVE */}
        {activeTab === "feed" && (
          <div className="rounded-2xl border border-[#d8e3de] bg-white p-5 shadow-sm space-y-4">
            <div className="border-b border-[#edf3f0] pb-3 flex items-center justify-between">
              <div>
                <h3 className="text-base font-extrabold text-[#0b3d2e] flex items-center gap-2">
                  <Flame size={18} className="text-[#f97316]" />
                  <span>Riwayat Aktivitas &amp; Transaksi Poin Live</span>
                </h3>
                <p className="text-xs text-[#527867]">
                  Feed transaksi poin terkini di kasir (pembelian, klaim reward, koreksi, dan bonus).
                </p>
              </div>
              <span className="font-mono text-xs font-bold text-[#167052] bg-[#edf8f3] px-2.5 py-1 rounded-lg">
                {recentLedger.length} Transaksi Terakhir
              </span>
            </div>

            {recentLedger.length === 0 ? (
              <p className="py-8 text-center text-xs text-[#527867]">
                Belum ada mutasi poin tercatat di sistem.
              </p>
            ) : (
              <div className="divide-y divide-[#edf3f0] font-sans text-xs">
                {recentLedger.map((row) => {
                  const isPositive = row.delta > 0;
                  return (
                    <div key={row.id} className="py-3 flex items-center justify-between gap-3 hover:bg-[#f9fbf9]">
                      <div className="flex items-center gap-3">
                        <div
                          className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl font-mono text-xs font-black ${
                            isPositive ? "bg-[#edf8f3] text-[#167052]" : "bg-[#fef2f2] text-[#ef4444]"
                          }`}
                        >
                          {isPositive ? `+${row.delta}` : row.delta}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-black text-[#0b3d2e]">
                              {row.customer_name || "Pelanggan Member"}
                            </span>
                            <span className="font-mono text-[11px] text-[#527867]">({row.customer_phone})</span>
                          </div>
                          <p className="text-[11px] text-[#527867]">
                            {row.note || "Transaksi Poin"} {row.amount_spent ? `• ${formatRupiah(row.amount_spent)}` : ""}
                          </p>
                        </div>
                      </div>

                      <div className="text-right shrink-0 font-mono text-[10.5px] text-[#789689]">
                        <span>{formatBusinessDateTime(row.created_at, business?.timezone)}</span>
                        {row.staff_name && <span className="block text-[9.5px]">Kasir: {row.staff_name}</span>}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* TAB 5: KATALOG REWARD */}
        {activeTab === "rewards" && (
          <div className="rounded-2xl border border-[#d8e3de] bg-white p-5 shadow-sm space-y-4">
            <div className="border-b border-[#edf3f0] pb-3 flex items-center justify-between">
              <div>
                <h3 className="text-base font-extrabold text-[#0b3d2e] flex items-center gap-2">
                  <Gift size={18} className="text-[#7c3aed]" />
                  <span>Katalog Hadiah &amp; Kupon Penukaran</span>
                </h3>
                <p className="text-xs text-[#527867]">
                  Daftar reward yang dapat ditukar oleh pelanggan menggunakan saldo poin mereka.
                </p>
              </div>
              <Link
                href="/app/loyalty"
                className="font-mono text-xs font-bold text-[#0b3d2e] bg-[#c8f53a] px-3 py-1.5 rounded-xl hover:brightness-105 transition-all"
              >
                + Kelola Reward
              </Link>
            </div>

            {rewards.length === 0 ? (
              <p className="py-8 text-center text-xs text-[#527867]">
                Belum ada hadiah yang ditambahkan. Buat reward di halaman KAEL Loyalty.
              </p>
            ) : (
              <div className="grid gap-3 sm:grid-cols-3">
                {rewards.map((r) => (
                  <div key={r.id} className="rounded-2xl border border-[#d8e3de] bg-[#f9fbf9] p-4 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-[10px] font-black uppercase text-[#167052] bg-[#edf8f3] px-2 py-0.5 rounded-md">
                        {r.point_cost} POIN
                      </span>
                      <span
                        className={`text-[10px] font-bold ${
                          r.is_active ? "text-[#16a34a]" : "text-[#dc2626]"
                        }`}
                      >
                        {r.is_active ? "Aktif ✓" : "Nonaktif"}
                      </span>
                    </div>
                    <h4 className="font-black text-sm text-[#0b3d2e]">{r.name}</h4>
                    <div className="flex justify-between text-xs font-mono text-[#527867] pt-1 border-t border-[#edf3f0]">
                      <span>Nilai Hadiah:</span>
                      <span className="font-bold">{formatRupiah(r.market_value)}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
