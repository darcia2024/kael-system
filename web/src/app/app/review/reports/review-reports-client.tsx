"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  LayoutDashboard,
  Star,
  ShieldCheck,
  Calendar,
  Filter,
  Search,
  CheckCircle2,
  AlertTriangle,
  MessageSquare,
  MessageCircle,
  QrCode,
  Receipt,
  RotateCcw,
  SlidersHorizontal,
  Table as TableIcon,
  LayoutGrid,
  TrendingUp,
  User,
  MapPin,
  ExternalLink,
} from "lucide-react";
import type { Business, FeedbackRow, FeedbackSummary, FeedbackReasonCode } from "@/lib/types";
import { formatBusinessDateTime } from "@/lib/formatters";
import { BusinessMark } from "@/components/business-mark";
import { isMochiBusiness } from "@/lib/mochi-brand";

type DateFilterPreset = "all" | "today" | "7d" | "30d" | "this_month" | "custom";
type SentimentFilter = "all" | "good" | "bad" | "5" | "4" | "3" | "2" | "1";
type ChannelFilter = "all" | "card" | "order";

const REASON_LABELS: Record<string, string> = {
  rasa: "Rasa Makanan/Minuman",
  porsi: "Ukuran Porsi",
  kebersihan: "Kebersihan Area/Alat",
  layanan: "Keramahan Pelayanan",
  lama: "Kecepatan Penyajian",
  harga: "Kesesuaian Harga",
  lainnya: "Lainnya / Masukan Umum",
};

export default function ReviewReportsClient({
  business,
  initialFeedbacks = [],
  initialSummary,
  themeClassName = "",
}: {
  business: Business | null;
  initialFeedbacks?: FeedbackRow[];
  initialSummary?: FeedbackSummary;
  themeClassName?: string;
}) {
  const isMochi = isMochiBusiness(business);
  const safeFeedbacks = useMemo(() => (Array.isArray(initialFeedbacks) ? initialFeedbacks : []), [initialFeedbacks]);

  // Filter States
  const [datePreset, setDatePreset] = useState<DateFilterPreset>("all");
  const [customFrom, setCustomFrom] = useState<string>("");
  const [customTo, setCustomTo] = useState<string>("");
  const [sentimentFilter, setSentimentFilter] = useState<SentimentFilter>("all");
  const [reasonFilter, setReasonFilter] = useState<string>("all");
  const [channelFilter, setChannelFilter] = useState<ChannelFilter>("all");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [viewMode, setViewMode] = useState<"cards" | "table">("cards");

  // Filter Logic
  const filteredFeedbacks = useMemo(() => {
    const now = new Date();
    const todayStr = now.toISOString().slice(0, 10);
    const startOf7d = new Date(Date.now() - 7 * 86_400_000).toISOString();
    const startOf30d = new Date(Date.now() - 30 * 86_400_000).toISOString();
    const thisMonthPrefix = now.toISOString().slice(0, 7); // YYYY-MM

    return safeFeedbacks.filter((f) => {
      if (!f) return false;
      const fIso = f.created_at
        ? typeof f.created_at === "string"
          ? f.created_at
          : new Date(f.created_at).toISOString()
        : "";
      const fDay = fIso.slice(0, 10);

      // 1. Date Filter
      if (datePreset === "today") {
        if (fDay !== todayStr) return false;
      } else if (datePreset === "7d") {
        if (fIso < startOf7d) return false;
      } else if (datePreset === "30d") {
        if (fIso < startOf30d) return false;
      } else if (datePreset === "this_month") {
        if (!fIso.startsWith(thisMonthPrefix)) return false;
      } else if (datePreset === "custom") {
        if (customFrom && fDay < customFrom) return false;
        if (customTo && fDay > customTo) return false;
      }

      // 2. Sentiment / Star Filter
      const rating = Number(f.rating || 0);
      if (sentimentFilter === "good") {
        if (rating < 4) return false;
      } else if (sentimentFilter === "bad") {
        if (rating > 3) return false;
      } else if (sentimentFilter === "5" && rating !== 5) {
        return false;
      } else if (sentimentFilter === "4" && rating !== 4) {
        return false;
      } else if (sentimentFilter === "3" && rating !== 3) {
        return false;
      } else if (sentimentFilter === "2" && rating !== 2) {
        return false;
      } else if (sentimentFilter === "1" && rating !== 1) {
        return false;
      }

      // 3. Reason Code Filter
      if (reasonFilter !== "all") {
        if ((f.reason_code || "lainnya") !== reasonFilter) return false;
      }

      // 4. Channel Filter (Card Tap vs Order Receipt)
      if (channelFilter === "card" && !f.card_id) return false;
      if (channelFilter === "order" && !f.order_id) return false;

      // 5. Search Text Filter
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesComment = (f.comment || "").toLowerCase().includes(q);
        const matchesCustomer = (f.customer_name || "").toLowerCase().includes(q);
        const matchesOrder = (f.order_no || "").toLowerCase().includes(q);
        const matchesCard = (f.card_label || "").toLowerCase().includes(q);
        const matchesReason = (f.reason_code ? REASON_LABELS[f.reason_code] || f.reason_code : "").toLowerCase().includes(q);
        if (!matchesComment && !matchesCustomer && !matchesOrder && !matchesCard && !matchesReason) {
          return false;
        }
      }

      return true;
    });
  }, [
    safeFeedbacks,
    datePreset,
    customFrom,
    customTo,
    sentimentFilter,
    reasonFilter,
    channelFilter,
    searchQuery,
  ]);

  // Dynamic Metrics Computed for the Filtered Set
  const metrics = useMemo(() => {
    const list = filteredFeedbacks || [];
    const total = list.length;
    if (total === 0) {
      return {
        total: 0,
        avgRating: 0,
        goodCount: 0,
        goodPct: 0,
        badCount: 0,
        badPct: 0,
        stars: { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 } as Record<number, number>,
        reasons: {} as Record<string, number>,
      };
    }

    let sumRating = 0;
    let goodCount = 0;
    let badCount = 0;
    const stars: Record<number, number> = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 };
    const reasons: Record<string, number> = {};

    for (const f of list) {
      const r = Number(f.rating || 0);
      sumRating += r;
      if (r >= 4) goodCount++;
      if (r <= 3) badCount++;
      if (r >= 1 && r <= 5) {
        stars[r] = (stars[r] || 0) + 1;
      }
      if (f.reason_code) {
        reasons[f.reason_code] = (reasons[f.reason_code] || 0) + 1;
      }
    }

    return {
      total,
      avgRating: Number((sumRating / total).toFixed(2)) || 0,
      goodCount,
      goodPct: Math.round((goodCount / total) * 100) || 0,
      badCount,
      badPct: Math.round((badCount / total) * 100) || 0,
      stars,
      reasons,
    };
  }, [filteredFeedbacks]);

  const resetAllFilters = () => {
    setDatePreset("all");
    setCustomFrom("");
    setCustomTo("");
    setSentimentFilter("all");
    setReasonFilter("all");
    setChannelFilter("all");
    setSearchQuery("");
  };

  const hasActiveFilters =
    datePreset !== "all" ||
    customFrom !== "" ||
    customTo !== "" ||
    sentimentFilter !== "all" ||
    reasonFilter !== "all" ||
    channelFilter !== "all" ||
    searchQuery !== "";

  return (
    <div className={`${themeClassName} min-h-screen bg-[#f0f5f2] text-[#1a382d] font-sans`}>
      {/* Sticky Header */}
      <header className="sticky top-0 z-30 border-b border-[#07281e] bg-[#0b3d2e] text-white shadow-md">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-2 px-3 py-2.5 sm:px-6">
          <div className="flex min-w-0 items-center gap-2.5">
            <Link
              href="/app/pos/owner"
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-[#144f3d] text-white hover:bg-[#1a5e4a] border border-[#1a5e4a] transition-colors"
              title="Kembali ke Dashboard Owner"
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
                  Laporan Review &amp; Keluhan
                </h1>
                <span className="hidden sm:inline-flex items-center gap-1 rounded-full bg-[#c8f53a] px-2 py-0.5 font-mono text-[9px] font-black text-[#073829] shadow-xs shrink-0">
                  Smart Routing Active
                </span>
              </div>
              <span className="block truncate font-mono text-[10px] text-emerald-200/80 sm:text-[11px]">
                {business?.name ?? "Mochi Cafe"} · Audit Rating Google ⭐4–5 &amp; Dashboard Privat ⭐1–3
              </span>
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
          <Link
            href="/app/loyalty/analytics"
            className="inline-flex shrink-0 items-center gap-1.5 rounded-xl border border-[#d8e3de] bg-white px-3 py-1.5 font-bold text-[#527867] hover:border-[#0b3d2e] hover:text-[#0b3d2e] transition-colors"
          >
            <span>Laporan Loyalty Member</span>
          </Link>
          <span className="inline-flex shrink-0 items-center gap-1.5 rounded-xl bg-[#0b3d2e] border border-[#0b3d2e] px-3 py-1.5 font-bold text-[#c8f53a] shadow-sm">
            <span>Laporan Review &amp; Keluhan</span>
          </span>
          <Link
            href="/app/finance/reports"
            className="inline-flex shrink-0 items-center gap-1.5 rounded-xl border border-[#d8e3de] bg-white px-3 py-1.5 font-bold text-[#527867] hover:border-[#0b3d2e] hover:text-[#0b3d2e] transition-colors"
          >
            <span>Laporan Keuangan</span>
          </Link>
        </div>

        {/* 4 Summary KPIs */}
        <div className="grid grid-cols-2 gap-2.5 sm:gap-4 lg:grid-cols-4">
          {/* TOTAL REVIEW */}
          <div className="rounded-2xl border border-[#d8e3de] bg-white p-3.5 shadow-sm sm:rounded-3xl sm:p-5">
            <div className="flex items-center justify-between border-b border-[#edf3f0] pb-1.5 sm:pb-2.5">
              <span className="font-mono text-[9px] font-bold uppercase text-[#0b3d2e] sm:text-[10px]">
                TOTAL REVIEW
              </span>
              <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-[#e6f4ed] text-[#0b3d2e] sm:h-7 sm:w-7">
                <MessageSquare size={13} />
              </span>
            </div>
            <div className="mt-2 sm:mt-3">
              <h3 className="font-mono text-lg font-black text-[#0b3d2e] sm:text-2xl">
                {metrics.total} <span className="text-xs font-normal text-[#527867]">ulasan</span>
              </h3>
              <p className="mt-0.5 text-[9.5px] text-[#527867]">
                {hasActiveFilters ? "Sesuai kriteria filter aktif" : "Total seluruh riwayat toko"}
              </p>
            </div>
          </div>

          {/* RATA-RATA RATING */}
          <div className="rounded-2xl border border-[#d8e3de] bg-white p-3.5 shadow-sm sm:rounded-3xl sm:p-5">
            <div className="flex items-center justify-between border-b border-[#edf3f0] pb-1.5 sm:pb-2.5">
              <span className="font-mono text-[9px] font-bold uppercase text-amber-700 sm:text-[10px]">
                SKOR RATA-RATA
              </span>
              <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-amber-100 text-amber-700 sm:h-7 sm:w-7">
                <Star size={13} className="fill-amber-500 text-amber-500" />
              </span>
            </div>
            <div className="mt-2 sm:mt-3">
              <div className="flex items-baseline gap-1.5">
                <h3 className="font-mono text-lg font-black text-[#0b3d2e] sm:text-2xl">
                  {metrics.avgRating.toFixed(1)}
                </h3>
                <span className="font-mono text-xs text-[#527867]">/ 5.0</span>
                <span className="flex items-center text-amber-500">
                  <Star size={12} className="fill-amber-400 text-amber-400" />
                </span>
              </div>
              <p className="mt-0.5 text-[9.5px] text-[#527867]">
                Dari {metrics.total} kepuasan pelanggan
              </p>
            </div>
          </div>

          {/* REVIEW BAIK (⭐ 4–5) */}
          <div className="rounded-2xl border border-[#d8e3de] bg-white p-3.5 shadow-sm sm:rounded-3xl sm:p-5">
            <div className="flex items-center justify-between border-b border-[#edf3f0] pb-1.5 sm:pb-2.5">
              <span className="font-mono text-[9px] font-bold uppercase text-[#16a34a] sm:text-[10px]">
                REVIEW BAIK (⭐ 4–5)
              </span>
              <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-[#dcfce7] text-[#16a34a] sm:h-7 sm:w-7">
                <CheckCircle2 size={13} />
              </span>
            </div>
            <div className="mt-2 sm:mt-3">
              <div className="flex items-baseline gap-2">
                <h3 className="font-mono text-lg font-black text-[#16a34a] sm:text-2xl">
                  {metrics.goodCount}
                </h3>
                <span className="rounded-md bg-[#dcfce7] px-1.5 py-0.5 font-mono text-[10px] font-bold text-[#15803d]">
                  {metrics.goodPct}%
                </span>
              </div>
              <p className="mt-0.5 text-[9.5px] text-[#527867]">
                ✓ Auto-Direct Google Maps Publik
              </p>
            </div>
          </div>

          {/* KELUHAN TERTAHAN (⭐ 1–3) */}
          <div className="rounded-2xl border border-[#d8e3de] bg-white p-3.5 shadow-sm sm:rounded-3xl sm:p-5">
            <div className="flex items-center justify-between border-b border-[#edf3f0] pb-1.5 sm:pb-2.5">
              <span className="font-mono text-[9px] font-bold uppercase text-rose-700 sm:text-[10px]">
                KELUHAN TERTAHAN (⭐ 1–3)
              </span>
              <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-rose-100 text-rose-700 sm:h-7 sm:w-7">
                <ShieldCheck size={13} />
              </span>
            </div>
            <div className="mt-2 sm:mt-3">
              <div className="flex items-baseline gap-2">
                <h3 className="font-mono text-lg font-black text-rose-600 sm:text-2xl">
                  {metrics.badCount}
                </h3>
                <span className="rounded-md bg-rose-100 px-1.5 py-0.5 font-mono text-[10px] font-bold text-rose-800">
                  {metrics.badPct}%
                </span>
              </div>
              <p className="mt-0.5 text-[9.5px] text-[#527867]">
                🔒 Disaring Privat di Dashboard Toko
              </p>
            </div>
          </div>
        </div>

        {/* Filter Panel */}
        <section className="rounded-3xl border border-[#d8e3de] bg-white p-4 sm:p-6 shadow-sm space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#edf3f0] pb-3.5">
            <div className="flex items-center gap-2">
              <SlidersHorizontal size={17} className="text-[#0b3d2e]" />
              <h2 className="text-sm font-extrabold sm:text-base text-[#0b3d2e]">
                Filter Sentimen &amp; Rentang Tanggal
              </h2>
            </div>
            {hasActiveFilters && (
              <button
                type="button"
                onClick={resetAllFilters}
                className="inline-flex items-center gap-1 text-xs font-bold text-rose-600 hover:text-rose-700 hover:underline"
              >
                <RotateCcw size={12} />
                <span>Reset Semua Filter</span>
              </button>
            )}
          </div>

          {/* 1. FILTER SENTIMEN: BAIK vs BURUK */}
          <div className="space-y-1.5">
            <label className="block font-mono text-[10px] font-extrabold uppercase text-[#527867]">
              1. Kategori Sentimen Review
            </label>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => setSentimentFilter("all")}
                className={`rounded-xl px-3 py-1.5 font-mono text-xs font-bold transition-all ${
                  sentimentFilter === "all"
                    ? "bg-[#0b3d2e] text-[#c8f53a] shadow-xs"
                    : "border border-[#d8e3de] bg-[#f9fbf9] text-[#527867] hover:border-[#0b3d2e] hover:text-[#0b3d2e]"
                }`}
              >
                Semua Review ({safeFeedbacks.length})
              </button>

              <button
                type="button"
                onClick={() => setSentimentFilter("good")}
                className={`inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 font-mono text-xs font-bold transition-all ${
                  sentimentFilter === "good"
                    ? "bg-[#16a34a] text-white shadow-xs"
                    : "border border-[#d8e3de] bg-[#f9fbf9] text-[#16a34a] hover:bg-[#edf8f3]"
                }`}
              >
                <CheckCircle2 size={13} />
                <span>⭐ Review Baik (Bintang 4–5) ({safeFeedbacks.filter((f) => Number(f.rating) >= 4).length})</span>
              </button>

              <button
                type="button"
                onClick={() => setSentimentFilter("bad")}
                className={`inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 font-mono text-xs font-bold transition-all ${
                  sentimentFilter === "bad"
                    ? "bg-rose-600 text-white shadow-xs"
                    : "border border-[#d8e3de] bg-[#f9fbf9] text-rose-600 hover:bg-rose-50"
                }`}
              >
                <ShieldCheck size={13} />
                <span>⚠️ Review Buruk / Keluhan (Bintang 1–3) ({safeFeedbacks.filter((f) => Number(f.rating) <= 3).length})</span>
              </button>

              <div className="flex items-center gap-1 pl-1 border-l border-[#d8e3de]">
                {(["5", "4", "3", "2", "1"] as const).map((star) => (
                  <button
                    key={star}
                    type="button"
                    onClick={() => setSentimentFilter(star)}
                    className={`rounded-lg px-2 py-1 font-mono text-xs font-bold transition-all ${
                      sentimentFilter === star
                        ? "bg-[#0b3d2e] text-amber-300"
                        : "border border-[#d8e3de] bg-white text-[#527867] hover:bg-[#edf8f3]"
                    }`}
                  >
                    ⭐{star} ({safeFeedbacks.filter((f) => Number(f.rating) === Number(star)).length})
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* 2. FILTER TANGGAL */}
          <div className="space-y-1.5 pt-2 border-t border-[#edf3f0]">
            <label className="block font-mono text-[10px] font-extrabold uppercase text-[#527867]">
              2. Rentang Tanggal
            </label>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => setDatePreset("all")}
                className={`rounded-xl px-3 py-1.5 font-mono text-xs font-bold transition-all ${
                  datePreset === "all"
                    ? "bg-[#0b3d2e] text-[#c8f53a] shadow-xs"
                    : "border border-[#d8e3de] bg-[#f9fbf9] text-[#527867] hover:border-[#0b3d2e]"
                }`}
              >
                Semua Waktu
              </button>
              <button
                type="button"
                onClick={() => setDatePreset("today")}
                className={`rounded-xl px-3 py-1.5 font-mono text-xs font-bold transition-all ${
                  datePreset === "today"
                    ? "bg-[#0b3d2e] text-[#c8f53a] shadow-xs"
                    : "border border-[#d8e3de] bg-[#f9fbf9] text-[#527867] hover:border-[#0b3d2e]"
                }`}
              >
                Hari Ini
              </button>
              <button
                type="button"
                onClick={() => setDatePreset("7d")}
                className={`rounded-xl px-3 py-1.5 font-mono text-xs font-bold transition-all ${
                  datePreset === "7d"
                    ? "bg-[#0b3d2e] text-[#c8f53a] shadow-xs"
                    : "border border-[#d8e3de] bg-[#f9fbf9] text-[#527867] hover:border-[#0b3d2e]"
                }`}
              >
                7 Hari Terakhir
              </button>
              <button
                type="button"
                onClick={() => setDatePreset("30d")}
                className={`rounded-xl px-3 py-1.5 font-mono text-xs font-bold transition-all ${
                  datePreset === "30d"
                    ? "bg-[#0b3d2e] text-[#c8f53a] shadow-xs"
                    : "border border-[#d8e3de] bg-[#f9fbf9] text-[#527867] hover:border-[#0b3d2e]"
                }`}
              >
                30 Hari Terakhir
              </button>
              <button
                type="button"
                onClick={() => setDatePreset("this_month")}
                className={`rounded-xl px-3 py-1.5 font-mono text-xs font-bold transition-all ${
                  datePreset === "this_month"
                    ? "bg-[#0b3d2e] text-[#c8f53a] shadow-xs"
                    : "border border-[#d8e3de] bg-[#f9fbf9] text-[#527867] hover:border-[#0b3d2e]"
                }`}
              >
                Bulan Ini
              </button>
              <button
                type="button"
                onClick={() => setDatePreset("custom")}
                className={`inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 font-mono text-xs font-bold transition-all ${
                  datePreset === "custom"
                    ? "bg-[#0b3d2e] text-[#c8f53a] shadow-xs"
                    : "border border-[#d8e3de] bg-[#f9fbf9] text-[#527867] hover:border-[#0b3d2e]"
                }`}
              >
                <Calendar size={13} />
                <span>Kustom Tanggal</span>
              </button>
            </div>

            {datePreset === "custom" && (
              <div className="mt-2.5 flex flex-wrap items-center gap-3 rounded-2xl border border-[#d8e3de] bg-[#f9fbf9] p-3 animate-in fade-in-50">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-xs font-bold text-[#527867]">Dari:</span>
                  <input
                    type="date"
                    value={customFrom}
                    onChange={(e) => setCustomFrom(e.target.value)}
                    className="rounded-xl border border-[#ccd9d3] bg-white px-3 py-1.5 font-mono text-xs text-[#0b3d2e] focus:border-[#0b3d2e] focus:outline-none"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <span className="font-mono text-xs font-bold text-[#527867]">Sampai:</span>
                  <input
                    type="date"
                    value={customTo}
                    onChange={(e) => setCustomTo(e.target.value)}
                    className="rounded-xl border border-[#ccd9d3] bg-white px-3 py-1.5 font-mono text-xs text-[#0b3d2e] focus:border-[#0b3d2e] focus:outline-none"
                  />
                </div>
                {(customFrom || customTo) && (
                  <button
                    type="button"
                    onClick={() => {
                      setCustomFrom("");
                      setCustomTo("");
                    }}
                    className="text-xs font-bold text-rose-600 hover:underline"
                  >
                    Hapus Rentang
                  </button>
                )}
              </div>
            )}
          </div>

          {/* 3. PENCARIAN & FILTER TAMBAHAN */}
          <div className="grid gap-3 sm:grid-cols-3 pt-2 border-t border-[#edf3f0]">
            {/* Search Input */}
            <div className="relative">
              <label className="block font-mono text-[10px] font-extrabold uppercase text-[#527867] mb-1">
                Pencarian Teks
              </label>
              <div className="relative flex items-center">
                <Search size={14} className="absolute left-3 text-[#527867]" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Cari komentar, nama, order..."
                  className="w-full rounded-xl border border-[#ccd9d3] bg-white py-2 pl-9 pr-8 text-xs text-[#0b3d2e] placeholder:text-[#889990] focus:border-[#0b3d2e] focus:outline-none"
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery("")}
                    className="absolute right-2.5 text-xs text-[#889990] hover:text-[#0b3d2e]"
                  >
                    ✕
                  </button>
                )}
              </div>
            </div>

            {/* Reason Filter */}
            <div>
              <label className="block font-mono text-[10px] font-extrabold uppercase text-[#527867] mb-1">
                Alasan / Topik Masukan
              </label>
              <select
                value={reasonFilter}
                onChange={(e) => setReasonFilter(e.target.value)}
                className="w-full rounded-xl border border-[#ccd9d3] bg-white py-2 px-3 text-xs text-[#0b3d2e] focus:border-[#0b3d2e] focus:outline-none"
              >
                <option value="all">Semua Alasan ({safeFeedbacks.length})</option>
                {Object.entries(REASON_LABELS).map(([code, label]) => {
                  const count = safeFeedbacks.filter((f) => f.reason_code === code).length;
                  return (
                    <option key={code} value={code}>
                      {label} ({count})
                    </option>
                  );
                })}
              </select>
            </div>

            {/* Channel Filter */}
            <div>
              <label className="block font-mono text-[10px] font-extrabold uppercase text-[#527867] mb-1">
                Sumber Ulasan
              </label>
              <select
                value={channelFilter}
                onChange={(e) => setChannelFilter(e.target.value as ChannelFilter)}
                className="w-full rounded-xl border border-[#ccd9d3] bg-white py-2 px-3 text-xs text-[#0b3d2e] focus:border-[#0b3d2e] focus:outline-none"
              >
                <option value="all">Semua Sumber</option>
                <option value="card">Tap Kartu Meja / NFC / QR ({safeFeedbacks.filter((f) => f.card_id).length})</option>
                <option value="order">Struk Pembayaran Kasir ({safeFeedbacks.filter((f) => f.order_id).length})</option>
              </select>
            </div>
          </div>
        </section>

        {/* Rating Breakdown & Insights Grid */}
        <div className="grid gap-5 lg:grid-cols-2">
          {/* Distribusi Skor Bintang */}
          <div className="rounded-3xl border border-[#d8e3de] bg-white p-5 sm:p-6 shadow-sm space-y-3">
            <h3 className="text-sm font-extrabold sm:text-base text-[#0b3d2e]">
              Distribusi Skor Bintang
            </h3>
            <p className="text-[11px] text-[#527867]">
              Sebaran rating pelanggan pada hasil filter yang aktif saat ini.
            </p>

            <div className="space-y-2 pt-2">
              {([5, 4, 3, 2, 1] as const).map((star) => {
                const count = metrics.stars[star];
                const pct = metrics.total > 0 ? Math.round((count / metrics.total) * 100) : 0;
                const isGood = star >= 4;
                return (
                  <div key={star} className="flex items-center gap-2.5 text-xs font-mono">
                    <button
                      type="button"
                      onClick={() => setSentimentFilter(String(star) as SentimentFilter)}
                      className="flex w-16 shrink-0 items-center gap-1 font-bold text-[#0b3d2e] hover:underline"
                    >
                      <span>⭐ {star}</span>
                      <span className="text-[10px] text-[#527867]">({count})</span>
                    </button>
                    <div className="h-3 flex-1 overflow-hidden rounded-full bg-[#edf3f0]">
                      <div
                        className={`h-full rounded-full transition-all ${
                          isGood ? "bg-emerald-500" : "bg-rose-500"
                        }`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <span className="w-10 text-right text-[11px] font-bold text-[#527867]">
                      {pct}%
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Top Alasan Masukan & Keluhan */}
          <div className="rounded-3xl border border-[#d8e3de] bg-white p-5 sm:p-6 shadow-sm space-y-3">
            <h3 className="text-sm font-extrabold sm:text-base text-[#0b3d2e]">
              Top Alasan Masukan &amp; Keluhan
            </h3>
            <p className="text-[11px] text-[#527867]">
              Area yang paling banyak disorot pelanggan untuk evaluasi operasional.
            </p>

            <div className="flex flex-wrap gap-2 pt-2">
              {Object.keys(metrics.reasons).length > 0 ? (
                Object.entries(metrics.reasons)
                  .sort((a, b) => b[1] - a[1])
                  .map(([code, count]) => {
                    return (
                      <button
                        key={code}
                        type="button"
                        onClick={() => setReasonFilter(code)}
                        className={`rounded-xl border px-3 py-2 text-xs font-mono font-bold transition-all ${
                          reasonFilter === code
                            ? "border-[#0b3d2e] bg-[#0b3d2e] text-[#c8f53a] shadow-xs"
                            : "border-[#d8e3de] bg-[#f9fbf9] text-[#0b3d2e] hover:border-[#0b3d2e]"
                        }`}
                      >
                        <span className="block font-bold">
                          {REASON_LABELS[code] || code.toUpperCase()}
                        </span>
                        <span className="block text-[10px] text-[#527867] mt-0.5">
                          {count} laporan pelanggan
                        </span>
                      </button>
                    );
                  })
              ) : (
                <div className="rounded-xl border border-[#edf3f0] bg-[#f9fbf9] p-4 text-xs text-[#527867] w-full text-center">
                  Belum ada alasan spesifik tercatat pada filter saat ini.
                </div>
              )}
            </div>
          </div>
        </div>

        {/* List of Reviews & Feedbacks */}
        <section className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h3 className="text-base font-black text-[#0b3d2e]">
                Daftar Ulasan &amp; Keluhan Pelanggan ({filteredFeedbacks.length})
              </h3>
              <p className="text-xs text-[#527867]">
                Menampilkan ulasan terurut dari yang paling terbaru.
              </p>
            </div>

            {/* View Mode Switcher */}
            <div className="inline-flex items-center gap-1 rounded-xl border border-[#d8e3de] bg-white p-1 shadow-xs">
              <button
                type="button"
                onClick={() => setViewMode("cards")}
                className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1 text-xs font-bold transition-all ${
                  viewMode === "cards"
                    ? "bg-[#0b3d2e] text-white shadow-xs"
                    : "text-[#527867] hover:text-[#0b3d2e]"
                }`}
              >
                <LayoutGrid size={13} />
                <span>Kartu</span>
              </button>
              <button
                type="button"
                onClick={() => setViewMode("table")}
                className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1 text-xs font-bold transition-all ${
                  viewMode === "table"
                    ? "bg-[#0b3d2e] text-white shadow-xs"
                    : "text-[#527867] hover:text-[#0b3d2e]"
                }`}
              >
                <TableIcon size={13} />
                <span>Tabel</span>
              </button>
            </div>
          </div>

          {filteredFeedbacks.length === 0 ? (
            <div className="rounded-3xl border border-[#d8e3de] bg-white p-10 text-center space-y-3 shadow-sm">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-[#edf8f3] text-[#167052]">
                <MessageSquare size={24} />
              </div>
              <h4 className="text-sm font-black text-[#0b3d2e]">
                Tidak Ada Ulasan Ditemukan
              </h4>
              <p className="text-xs text-[#527867] max-w-md mx-auto leading-relaxed">
                Tidak ada data ulasan yang cocok dengan kombinasi filter tanggal, sentimen, atau pencarian yang Anda tentukan.
              </p>
              {hasActiveFilters && (
                <button
                  type="button"
                  onClick={resetAllFilters}
                  className="rounded-xl bg-[#0b3d2e] px-4 py-2 font-mono text-xs font-black text-[#c8f53a] shadow-xs hover:brightness-105"
                >
                  Reset Semua Filter ↺
                </button>
              )}
            </div>
          ) : viewMode === "cards" ? (
            /* CARD VIEW */
            <div className="grid gap-3 sm:gap-4 md:grid-cols-2">
              {filteredFeedbacks.map((f) => {
                const isGood = f.rating >= 4;
                const starsArr = [1, 2, 3, 4, 5];
                const cleanPhone = (f.customer_phone || "").replace(/\D/g, "");
                const waLink = cleanPhone
                  ? `https://wa.me/${cleanPhone}?text=${encodeURIComponent(
                      `Halo Kak ${f.customer_name || ""}, terima kasih atas kunjungannya di ${business?.name ?? "Mochi Cafe"}. Kami ingin menindaklanjuti masukan Kakak terkait ulasan kemarin...`
                    )}`
                  : null;

                return (
                  <div
                    key={f.id}
                    className="rounded-2xl sm:rounded-3xl border border-[#d8e3de] bg-white p-4 sm:p-5 shadow-sm space-y-3 hover:border-[#167052]/40 transition-all flex flex-col justify-between"
                  >
                    <div className="space-y-2.5">
                      {/* Card Header: Stars & Route Badge */}
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-1">
                          {starsArr.map((s) => (
                            <Star
                              key={s}
                              size={15}
                              className={
                                s <= f.rating
                                  ? isGood
                                    ? "fill-amber-400 text-amber-400"
                                    : "fill-rose-500 text-rose-500"
                                  : "text-[#d8e3de]"
                              }
                            />
                          ))}
                          <span className="font-mono text-xs font-black text-[#0b3d2e] ml-1">
                            {f.rating}/5
                          </span>
                        </div>

                        {/* Status Routing Badge */}
                        {isGood ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-[#dcfce7] border border-[#bbf7d0] px-2.5 py-0.5 font-mono text-[9.5px] font-bold text-[#15803d]">
                            <Star size={10} className="fill-[#15803d]" />
                            Direct Google (Review Baik)
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 rounded-full bg-rose-100 border border-rose-200 px-2.5 py-0.5 font-mono text-[9.5px] font-bold text-rose-800">
                            <ShieldCheck size={10} />
                            Dashboard Privat (Keluhan)
                          </span>
                        )}
                      </div>

                      {/* Reason Tag */}
                      {f.reason_code && (
                        <div className="inline-block rounded-lg bg-[#edf8f3] border border-[#d8e3de] px-2 py-0.5 font-mono text-[10px] font-extrabold text-[#167052]">
                          🏷️ {REASON_LABELS[f.reason_code] || f.reason_code.toUpperCase()}
                        </div>
                      )}

                      {/* Comment */}
                      <p className="text-xs sm:text-sm text-[#1a382d] leading-relaxed italic bg-[#f9fbf9] border border-[#edf3f0] p-3 rounded-xl">
                        {f.comment ? (
                          `"${f.comment}"`
                        ) : (
                          <span className="text-[#889990] not-italic">
                            (Pelanggan memberikan rating tanpa pesan tertulis)
                          </span>
                        )}
                      </p>
                    </div>

                    {/* Card Footer: Metadata & Quick Actions */}
                    <div className="pt-2 border-t border-[#edf3f0] flex items-center justify-between gap-2 text-xs font-mono">
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5 font-bold text-[#0b3d2e] truncate">
                          <User size={12} className="text-[#527867]" />
                          <span className="truncate">{f.customer_name || "Pelanggan Tanpa Nama"}</span>
                        </div>
                        <div className="flex items-center gap-2 text-[10px] text-[#527867] mt-0.5">
                          {f.order_no && <span>Order #{f.order_no}</span>}
                          {f.card_label && <span>Meja: {f.card_label}</span>}
                          <span>{formatBusinessDateTime(f.created_at)}</span>
                        </div>
                      </div>

                      {/* Action WA */}
                      {waLink && (
                        <a
                          href={waLink}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex shrink-0 items-center gap-1 rounded-xl border border-[#d8e3de] bg-white px-2.5 py-1 text-[11px] font-bold text-[#167052] hover:bg-[#edf8f3] transition-colors"
                        >
                          <MessageCircle size={12} className="text-[#16a34a]" />
                          <span>Hubungi WA</span>
                        </a>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            /* TABLE VIEW */
            <div className="overflow-x-auto rounded-3xl border border-[#d8e3de] bg-white shadow-sm">
              <table className="w-full text-left font-mono text-xs">
                <thead className="border-b border-[#d8e3de] bg-[#edf8f3] text-[10px] font-extrabold uppercase text-[#167052]">
                  <tr>
                    <th className="p-3">Rating</th>
                    <th className="p-3">Rute / Status</th>
                    <th className="p-3">Topik / Alasan</th>
                    <th className="p-3">Komentar Pelanggan</th>
                    <th className="p-3">Pelanggan &amp; Meja</th>
                    <th className="p-3 text-right">Waktu</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#edf3f0]">
                  {filteredFeedbacks.map((f) => {
                    const isGood = f.rating >= 4;
                    return (
                      <tr key={f.id} className="hover:bg-[#f7fcf9] transition-colors">
                        <td className="p-3 font-black text-[#0b3d2e]">
                          <span className="inline-flex items-center gap-1">
                            <Star
                              size={13}
                              className={isGood ? "fill-amber-400 text-amber-400" : "fill-rose-500 text-rose-500"}
                            />
                            {f.rating}/5
                          </span>
                        </td>
                        <td className="p-3">
                          {isGood ? (
                            <span className="inline-block rounded-full bg-[#dcfce7] border border-[#bbf7d0] px-2 py-0.5 text-[9px] font-bold text-[#15803d]">
                              ⭐ Google Direct (Baik)
                            </span>
                          ) : (
                            <span className="inline-block rounded-full bg-rose-100 border border-rose-200 px-2 py-0.5 text-[9px] font-bold text-rose-800">
                              🔒 Privat Dashboard (Buruk)
                            </span>
                          )}
                        </td>
                        <td className="p-3 font-bold text-[#0b3d2e]">
                          {f.reason_code ? REASON_LABELS[f.reason_code] || f.reason_code.toUpperCase() : "-"}
                        </td>
                        <td className="p-3 font-sans text-xs text-[#1a382d] max-w-xs">
                          {f.comment ? (
                            `"${f.comment}"`
                          ) : (
                            <span className="text-[#889990] italic">(Tanpa pesan)</span>
                          )}
                        </td>
                        <td className="p-3 text-[11px] text-[#527867]">
                          <div className="font-bold text-[#0b3d2e]">{f.customer_name || "Pelanggan"}</div>
                          {f.card_label && <div className="text-[10px]">Titik: {f.card_label}</div>}
                          {f.order_no && <div className="text-[10px]">Order #{f.order_no}</div>}
                        </td>
                        <td className="p-3 text-right text-[11px] text-[#527867]">
                          {formatBusinessDateTime(f.created_at)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
