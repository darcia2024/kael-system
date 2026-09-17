"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Nfc,
  QrCode,
  MapPin,
  TrendingUp,
  ShieldCheck,
  AlertCircle,
  Edit3,
  Power,
  ExternalLink,
  Sparkles,
  CheckCircle2,
  HelpCircle,
  ArrowLeft,
  Plus,
  Info,
  Calendar,
  Layers,
  X,
  Search,
  FileText,
  Star,
  MessageSquare,
  MessageCircle,
  AlertTriangle,
} from "lucide-react";
import {
  CARD_SERVICE_DESTINATION,
  CARD_SERVICE_LABEL,
  type Business,
  type Card,
  type CardService,
  type CardTap,
  type FeedbackRow,
  type FeedbackSummary,
} from "@/lib/types";
import {
  updateCardAction,
  searchPlacesAction,
  syncGoogleReviewSnapshotAction,
  setCardServiceAction,
  archiveSmartTouchAndSetCardServiceAction,
} from "@/lib/actions";
import { calculateCleanTaps, generateDailyTapSeries } from "@/lib/tap-counter";
import { formatCardCodeDisplay } from "@/lib/card-code";
import { formatBusinessDateTime } from "@/lib/formatters";
import {
  buildGoogleReviewUrl,
  type GooglePlaceResult,
} from "@/lib/google-places";
import { siteHost } from "@/lib/site";
import { BusinessMark } from "@/components/business-mark";
import ReviewQrModal from "@/components/review-qr-modal";

const REASON_LABELS: Record<string, string> = {
  rasa: "Rasa Makanan/Minuman",
  porsi: "Ukuran Porsi",
  kebersihan: "Kebersihan Area/Alat",
  layanan: "Keramahan Pelayanan",
  lama: "Kecepatan Penyajian",
  harga: "Kesesuaian Harga",
  lainnya: "Lainnya / Masukan Umum",
};

export default function KaelReviewOwnerDashboard({
  business,
  cards,
  rawTaps,
  googleReport,
  suspiciousTapCount,
  feedbacks = [],
  feedbackSummary = { total: 0, avgRating: 0, lowCount: 0, byReason: [] },
  sessionRole,
  themeClassName = "",
}: {
  business: Business | null;
  cards: Card[];
  rawTaps: CardTap[];
  googleReport: {
    latest: { rating: number; reviewCount: number; capturedAt: string } | null;
    growth7d: number;
    growth30d: number;
  };
  suspiciousTapCount: number;
  feedbacks?: FeedbackRow[];
  feedbackSummary?: FeedbackSummary;
  sessionRole: "owner" | "staff";
  themeClassName?: string;
}) {
  const router = useRouter();
  const [selectedCardForEdit, setSelectedCardForEdit] = useState<Card | null>(
    null
  );

  // QR Modal States
  const [isQrModalOpen, setIsQrModalOpen] = useState(false);
  const [qrModalCardId, setQrModalCardId] = useState<string | null>(null);

  const handleOpenQrModal = (cardId?: string) => {
    if (cardId) {
      setQrModalCardId(cardId);
    } else {
      const revCard = cards.find((c) => c.type === "review") || cards[0];
      setQrModalCardId(revCard?.id || null);
    }
    setIsQrModalOpen(true);
  };

  // Tab & Feedback Filter States
  const [activeTab, setActiveTab] = useState<"feedback" | "cards" | "overview">("overview");
  const [feedbackStarFilter, setFeedbackStarFilter] = useState<"all" | "low" | "1" | "2" | "3" | "4" | "5">("all");
  const [feedbackSearch, setFeedbackSearch] = useState("");

  // Edit card modal state
  const [editLabel, setEditLabel] = useState("");
  const [editSearchQuery, setEditSearchQuery] = useState("");
  const [editPlacesResults, setEditPlacesResults] = useState<
    GooglePlaceResult[]
  >([]);
  const [selectedPlace, setSelectedPlace] = useState<GooglePlaceResult | null>(
    null
  );
  const [manualPlaceId, setManualPlaceId] = useState("");

  const [editCustomUrl, setEditCustomUrl] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [isSyncingGoogle, setIsSyncingGoogle] = useState(false);

  const [serviceCard, setServiceCard] = useState<Card | null>(null);
  const [serviceChoice, setServiceChoice] = useState<CardService>("review");
  const [isSavingService, setIsSavingService] = useState(false);
  const [serviceError, setServiceError] = useState("");

  // Filtered feedbacks
  const filteredFeedbacks = feedbacks.filter((f) => {
    if (feedbackStarFilter === "low" && f.rating > 3) return false;
    if (feedbackStarFilter === "1" && f.rating !== 1) return false;
    if (feedbackStarFilter === "2" && f.rating !== 2) return false;
    if (feedbackStarFilter === "3" && f.rating !== 3) return false;
    if (feedbackStarFilter === "4" && f.rating !== 4) return false;
    if (feedbackStarFilter === "5" && f.rating !== 5) return false;

    if (feedbackSearch.trim()) {
      const q = feedbackSearch.toLowerCase();
      const matchComment = (f.comment || "").toLowerCase().includes(q);
      const matchCustomer = (f.customer_name || "").toLowerCase().includes(q);
      const matchCard = (f.card_label || "").toLowerCase().includes(q);
      const matchReason = (f.reason_code ? REASON_LABELS[f.reason_code] || f.reason_code : "").toLowerCase().includes(q);
      if (!matchComment && !matchCustomer && !matchCard && !matchReason) return false;
    }
    return true;
  });

  // Debounce search query perubahan Google Places
  useEffect(() => {
    const q = editSearchQuery.trim();
    if (q.length < 2) {
      setEditPlacesResults([]);
      return;
    }
    const timer = setTimeout(() => {
      searchPlacesAction(q).then((r) => setEditPlacesResults(r.results));
    }, 350);
    return () => clearTimeout(timer);
  }, [editSearchQuery]);

  const cleanMetrics = calculateCleanTaps(rawTaps);
  const dailySeries = generateDailyTapSeries(cleanMetrics.cleanTaps, 14);
  const maxDailyTap = Math.max(1, ...dailySeries.map((d) => d.taps));

  const handleOpenEditModal = (card: Card) => {
    setSelectedCardForEdit(card);
    setEditLabel(card.label || "");
    setEditSearchQuery(business?.name || "");
    setManualPlaceId("");
    setEditCustomUrl(card.destination_url || "");
    setSelectedPlace(null);
  };

  const handleSaveCardEdits = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCardForEdit) return;

    setIsSaving(true);
    let newDestinationUrl = selectedCardForEdit.destination_url;

    if (selectedCardForEdit.type === "link") {
      const tautan = editCustomUrl.trim();
      try {
        const sah = new URL(tautan);
        if (sah.protocol !== "https:") {
          alert("Tautan harus memakai https.");
          setIsSaving(false);
          return;
        }
        newDestinationUrl = sah.toString();
      } catch {
        alert(
          "Tautan tidak valid. Tulis lengkap beserta https:// di depannya."
        );
        setIsSaving(false);
        return;
      }
    } else if (selectedPlace) {
      newDestinationUrl = selectedPlace.directReviewUrl;
    } else if (manualPlaceId.trim()) {
      newDestinationUrl = buildGoogleReviewUrl(manualPlaceId.trim());
    }

    const res = await updateCardAction(selectedCardForEdit.id, {
      label: editLabel.trim() || selectedCardForEdit.label || undefined,
      destination_url: newDestinationUrl ?? undefined,
    });

    setIsSaving(false);
    if (!res.ok) {
      alert(res.error);
      return;
    }
    setSelectedCardForEdit(null);
    router.refresh();
  };

  const handleOpenServiceModal = (card: Card) => {
    setServiceCard(card);
    setServiceChoice(card.type);
    setServiceError("");
  };

  const handleSaveService = async () => {
    if (!serviceCard || serviceChoice === serviceCard.type) return;
    setIsSavingService(true);
    setServiceError("");
    const res = await setCardServiceAction(serviceCard.id, serviceChoice as any);
    setIsSavingService(false);
    if (!res.ok) {
      setServiceError(res.error);
      return;
    }
    setServiceCard(null);
    router.refresh();
  };

  const handleArchiveAndMoveService = async () => {
    if (
      !serviceCard ||
      serviceCard.type !== "smart_touch" ||
      serviceChoice === "smart_touch"
    )
      return;
    setIsSavingService(true);
    setServiceError("");
    const res = await archiveSmartTouchAndSetCardServiceAction(
      serviceCard.id,
      serviceChoice
    );
    setIsSavingService(false);
    if (!res.ok) {
      setServiceError(res.error);
      return;
    }
    setServiceCard(null);
    router.refresh();
  };

  const handleToggleSuspend = async (card: Card) => {
    const nextStatus = card.status === "active" ? "suspended" : "active";
    const confirmMsg =
      card.status === "active"
        ? "Nonaktifkan kartu " +
          card.card_code +
          "? Pelanggan yang men-tap akan melihat halaman kartu tidak aktif."
        : "Aktifkan kembali kartu " + card.card_code + "?";

    if (!confirm(confirmMsg)) return;
    const res = await updateCardAction(card.id, { status: nextStatus });
    if (!res.ok) {
      alert(res.error);
      return;
    }
    router.refresh();
  };

  const handleSyncGoogle = async () => {
    setIsSyncingGoogle(true);
    const result = await syncGoogleReviewSnapshotAction();
    setIsSyncingGoogle(false);
    if (!result.ok) return alert(result.error);
    router.refresh();
  };

  return (
    <div
      className={
        "min-h-screen bg-[#f0f5f2] text-[#18392f] font-sans flex flex-col " +
        themeClassName
      }
    >
      {/* Sticky Deep Forest Emerald Header */}
      <header className="sticky top-0 z-30 border-b border-emerald-800/60 bg-[#0b3d2e] px-4 sm:px-8 py-3 text-white backdrop-blur-md shadow-sm">
        <div className="mx-auto flex max-w-6xl items-center justify-between">
          <div className="flex items-center gap-3">
            <Link
              href={sessionRole === "owner" ? "/app" : "/app/staff"}
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-emerald-600/40 bg-white/10 text-white hover:bg-white/15 transition-colors shadow-xs"
              title="Kembali ke Portal Hub"
            >
              <ArrowLeft size={16} />
            </Link>
            <BusinessMark
              name={business?.name}
              logoUrl={business?.logo_url}
              brandColor={business?.brand_color}
              className="h-9 w-9 shrink-0 rounded-full border border-emerald-400/40 bg-white p-0.5 shadow-xs"
            />
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h1 className="font-extrabold text-sm sm:text-base truncate text-white tracking-tight">
                  KAEL Review · Command Center
                </h1>
                <span className="rounded-full bg-[#c8f53a] px-2 py-0.5 font-mono text-[9px] font-bold text-[#073829]">
                  Modul 01 Live
                </span>
              </div>
              <span className="text-[10.5px] text-emerald-200/80 font-mono block truncate">
                {(business?.name || "Mochi Cafe n Resto") + " · Google Place ID Locked"}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => handleOpenQrModal()}
              className="inline-flex items-center gap-1.5 rounded-xl border border-emerald-400/50 bg-[#c8f53a] px-3 py-1.5 text-xs font-mono font-black text-[#073829] hover:brightness-105 transition-all shadow-xs"
            >
              <QrCode size={13} />
              <span>Download QR</span>
            </button>
            {sessionRole === "owner" && (
              <Link
                href="/app/review/reports"
                className="inline-flex items-center gap-1.5 rounded-xl border border-emerald-600/40 bg-white/10 px-3 py-1.5 text-xs font-mono font-bold text-white hover:bg-white/15 transition-colors shadow-xs"
              >
                <FileText size={13} />
                <span className="hidden sm:inline">Laporan Feedback Pelanggan ➔</span>
                <span className="sm:hidden">Feedback ➔</span>
              </Link>
            )}
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="flex-1 mx-auto w-full max-w-6xl p-4 sm:p-8 space-y-6">
        {/* Quick QR Review Banner */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-2xl border border-emerald-800/40 bg-gradient-to-r from-[#072e22] via-[#0b3d2e] to-[#12533e] p-4 text-white shadow-sm">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#c8f53a] text-[#0b3d2e] font-black">
              <QrCode size={20} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h4 className="text-sm font-black text-white">
                  Download QR Code Ulasan Google Mochi Cafe
                </h4>
                <span className="rounded-full bg-[#c8f53a] px-2 py-0.5 font-mono text-[9px] font-black text-[#073829]">
                  HD PNG &amp; SVG
                </span>
              </div>
              <p className="text-xs text-emerald-200/90 font-mono mt-0.5">
                Download QR murni (2048x2048px) dengan logo untuk materi cetak / Canva, atau standee meja 1:1 siap pakai.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => handleOpenQrModal()}
            className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl bg-[#c8f53a] hover:bg-[#d9ff57] px-4 py-2 font-mono text-xs font-black text-[#073829] shadow-xs hover:brightness-105 transition-all"
          >
            <QrCode size={14} />
            <span>Buka Generator QR</span>
          </button>
        </div>
        {/* VIEW NAVIGATION TABS */}
        <div className="flex items-center gap-2 border-b border-[#d8e3de] pb-3 overflow-x-auto">
          <button
            type="button"
            onClick={() => setActiveTab("overview")}
            className={`px-4 py-2 rounded-2xl text-xs font-mono font-bold transition-all flex items-center gap-2 shrink-0 ${
              activeTab === "overview"
                ? "bg-[#0b3d2e] text-[#c8f53a] shadow-sm"
                : "bg-white text-[#18392f] hover:bg-[#edf8f3] border border-[#d8e3de]"
            }`}
          >
            <span>📊 Ringkasan Lengkap</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("feedback")}
            className={`px-4 py-2 rounded-2xl text-xs font-mono font-bold transition-all flex items-center gap-2 shrink-0 ${
              activeTab === "feedback"
                ? "bg-[#0b3d2e] text-[#c8f53a] shadow-sm"
                : "bg-white text-[#18392f] hover:bg-[#edf8f3] border border-[#d8e3de]"
            }`}
          >
            <span>⭐ Ulasan &amp; Keluhan Pelanggan</span>
            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
              feedbackSummary.lowCount > 0
                ? "bg-red-500 text-white animate-pulse"
                : "bg-emerald-100 text-emerald-800"
            }`}>
              {feedbacks.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("cards")}
            className={`px-4 py-2 rounded-2xl text-xs font-mono font-bold transition-all flex items-center gap-2 shrink-0 ${
              activeTab === "cards"
                ? "bg-[#0b3d2e] text-[#c8f53a] shadow-sm"
                : "bg-white text-[#18392f] hover:bg-[#edf8f3] border border-[#d8e3de]"
            }`}
          >
            <Nfc size={14} />
            <span>🎴 Kartu Smart Touch ({cards.length})</span>
          </button>
        </div>

        {/* SECTION: ULASAN & KELUHAN PELANGGAN */}
        {(activeTab === "overview" || activeTab === "feedback") && (
          <div className="rounded-3xl border border-[#d8e3de] bg-white p-5 sm:p-6 shadow-[0_4px_20px_rgba(11,61,46,0.04)] space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#e5ede9] pb-4">
              <div className="flex items-center gap-2.5">
                <span className="flex h-9 w-9 items-center justify-center rounded-2xl bg-amber-100 text-amber-900 shrink-0">
                  <Star size={18} className="fill-amber-500 text-amber-500" />
                </span>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-extrabold text-base text-[#0b3d2e]">
                      Ulasan &amp; Keluhan Pelanggan (Rating 1–5 Bintang)
                    </h3>
                    <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-800 font-mono">
                      Realtime Live
                    </span>
                  </div>
                  <p className="text-xs text-[#527867]">
                    Rating 1–3 masuk sebagai masukan &amp; keluhan privat owner, rating 4–5 diarahkan ke Google Review.
                  </p>
                </div>
              </div>
              <Link
                href="/app/review/reports"
                className="inline-flex items-center gap-1.5 rounded-xl bg-[#0b3d2e] hover:bg-[#0e4837] px-4 py-2 text-xs font-mono font-bold text-[#c8f53a] shadow-xs transition-colors shrink-0"
              >
                <FileText size={14} />
                <span>Buka Laporan Lengkap &amp; Sentimen ➔</span>
              </Link>
            </div>

            {/* Metric Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="rounded-2xl border border-emerald-200 bg-emerald-50/50 p-3.5">
                <span className="text-[10px] font-mono font-bold text-emerald-800 uppercase tracking-wider block">
                  RATA-RATA RATING
                </span>
                <div className="mt-1 flex items-baseline gap-1.5">
                  <span className="text-2xl font-black text-emerald-950 font-mono">
                    {feedbackSummary.avgRating ? feedbackSummary.avgRating.toFixed(1) : "0.0"}
                  </span>
                  <span className="text-xs text-emerald-700 font-bold">/ 5.0</span>
                </div>
                <div className="mt-1 flex items-center gap-0.5 text-amber-500">
                  {[1, 2, 3, 4, 5].map((s) => (
                    <Star
                      key={s}
                      size={12}
                      className={
                        s <= Math.round(feedbackSummary.avgRating || 0)
                          ? "fill-amber-400 text-amber-400"
                          : "text-gray-300"
                      }
                    />
                  ))}
                </div>
              </div>

              <div className="rounded-2xl border border-red-200 bg-red-50/50 p-3.5">
                <span className="text-[10px] font-mono font-bold text-red-800 uppercase tracking-wider block">
                  KELUHAN KRITIS (1–3★)
                </span>
                <div className="mt-1 flex items-baseline gap-1.5">
                  <span className="text-2xl font-black text-red-950 font-mono">
                    {feedbackSummary.lowCount}
                  </span>
                  <span className="text-xs text-red-700 font-bold">Masukan</span>
                </div>
                <span className="text-[10.5px] text-red-700 block mt-1">
                  {feedbackSummary.lowCount > 0 ? "⚠️ Perlu respon cepat tim" : "✓ Tidak ada keluhan"}
                </span>
              </div>

              <div className="rounded-2xl border border-emerald-200 bg-emerald-50/50 p-3.5">
                <span className="text-[10px] font-mono font-bold text-emerald-800 uppercase tracking-wider block">
                  APRESIASI (4–5★)
                </span>
                <div className="mt-1 flex items-baseline gap-1.5">
                  <span className="text-2xl font-black text-emerald-950 font-mono">
                    {feedbacks.filter((f) => f.rating >= 4).length}
                  </span>
                  <span className="text-xs text-emerald-700 font-bold">Ulasan</span>
                </div>
                <span className="text-[10.5px] text-emerald-700 block mt-1">
                  ✓ Masuk ke Google Maps
                </span>
              </div>

              <div className="rounded-2xl border border-[#d8e3de] bg-white p-3.5">
                <span className="text-[10px] font-mono font-bold text-[#167052] uppercase tracking-wider block">
                  TOTAL MASUKAN
                </span>
                <div className="mt-1 flex items-baseline gap-1.5">
                  <span className="text-2xl font-black text-[#0b3d2e] font-mono">
                    {feedbacks.length}
                  </span>
                  <span className="text-xs text-[#527867]">Data</span>
                </div>
                <span className="text-[10.5px] text-[#527867] block mt-1">
                  {feedbacks.filter((f) => f.comment).length} dengan catatan kritik
                </span>
              </div>
            </div>

            {/* Filter Chips & Search Bar */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5 pt-1">
              <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0 text-xs font-mono">
                <button
                  type="button"
                  onClick={() => setFeedbackStarFilter("all")}
                  className={`px-3 py-1.5 rounded-xl font-bold transition-all shrink-0 ${
                    feedbackStarFilter === "all"
                      ? "bg-[#0b3d2e] text-[#c8f53a] shadow-xs"
                      : "bg-[#edf8f3] text-[#0b3d2e] hover:bg-[#e0f1e8]"
                  }`}
                >
                  Semua ({feedbacks.length})
                </button>
                <button
                  type="button"
                  onClick={() => setFeedbackStarFilter("low")}
                  className={`px-3 py-1.5 rounded-xl font-bold transition-all shrink-0 flex items-center gap-1 ${
                    feedbackStarFilter === "low"
                      ? "bg-red-700 text-white shadow-xs"
                      : "bg-red-50 text-red-800 hover:bg-red-100"
                  }`}
                >
                  <span>🚨 Kritis 1–3★</span>
                  <span className="rounded-full bg-white/20 px-1.5 py-0.2 text-[10px]">
                    {feedbackSummary.lowCount}
                  </span>
                </button>
                {[1, 2, 3, 4, 5].map((star) => (
                  <button
                    key={star}
                    type="button"
                    onClick={() => setFeedbackStarFilter(String(star) as any)}
                    className={`px-2.5 py-1.5 rounded-xl font-bold transition-all shrink-0 flex items-center gap-1 ${
                      feedbackStarFilter === String(star)
                        ? "bg-[#0b3d2e] text-[#c8f53a] shadow-xs"
                        : "bg-white border border-[#d8e3de] text-[#18392f] hover:bg-[#edf8f3]"
                    }`}
                  >
                    <span>⭐ {star}★</span>
                    <span className="text-[10px] text-gray-500">
                      ({feedbacks.filter((f) => f.rating === star).length})
                    </span>
                  </button>
                ))}
              </div>

              <div className="relative min-w-[200px]">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  value={feedbackSearch}
                  onChange={(e) => setFeedbackSearch(e.target.value)}
                  placeholder="Cari keluhan, komentar..."
                  className="w-full rounded-xl border border-[#d8e3de] bg-white pl-8.5 pr-3 py-1.5 text-xs text-[#0b3d2e] placeholder-gray-400 focus:border-[#0b3d2e] focus:outline-none"
                />
                {feedbackSearch && (
                  <button
                    type="button"
                    onClick={() => setFeedbackSearch("")}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-gray-400 hover:text-gray-700"
                  >
                    ✕
                  </button>
                )}
              </div>
            </div>

            {/* Feedback List */}
            {filteredFeedbacks.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-[#d8e3de] bg-[#f8faf9] p-8 text-center space-y-2">
                <MessageSquare size={28} className="mx-auto text-gray-400" />
                <p className="text-xs font-bold text-[#0b3d2e]">
                  Tidak ada data review yang sesuai dengan filter.
                </p>
                <p className="text-[11px] text-[#527867]">
                  Coba ganti filter bintang atau reset pencarian.
                </p>
              </div>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2">
                {filteredFeedbacks.map((f) => {
                  const isLow = f.rating <= 3;
                  const starColor =
                    f.rating === 1
                      ? "bg-red-600 text-white"
                      : f.rating === 2
                      ? "bg-amber-600 text-white"
                      : f.rating === 3
                      ? "bg-amber-500 text-white"
                      : "bg-emerald-600 text-white";

                  const cardBorder = isLow
                    ? "border-red-200/90 bg-red-50/20"
                    : "border-emerald-200/70 bg-emerald-50/10";

                  return (
                    <div
                      key={f.id}
                      className={`rounded-2xl border ${cardBorder} p-4 shadow-xs space-y-3 transition-all hover:shadow-md`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <span
                            className={`inline-flex items-center gap-1 rounded-xl ${starColor} px-2.5 py-1 font-mono text-xs font-black shadow-xs`}
                          >
                            <span>⭐ {f.rating}</span>
                            <span className="text-[9px] opacity-80">/5</span>
                          </span>

                          {isLow ? (
                            <span className="inline-flex items-center gap-1 rounded-full bg-red-100 border border-red-200 px-2 py-0.5 text-[10px] font-bold text-red-800">
                              🚨 Keluhan Privat
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 border border-emerald-200 px-2 py-0.5 text-[10px] font-bold text-emerald-800">
                              🌟 Google Rating
                            </span>
                          )}
                        </div>

                        <span className="font-mono text-[10px] text-[#527867] shrink-0">
                          {formatBusinessDateTime(f.created_at)}
                        </span>
                      </div>

                      {/* Comment Bubble */}
                      {f.comment ? (
                        <div className="rounded-xl border border-[#d8e3de] bg-white p-3 shadow-2xs">
                          <div className="flex items-start gap-2">
                            <MessageSquare size={13} className="text-[#167052] shrink-0 mt-0.5" />
                            <p className="text-xs font-medium text-[#0b3d2e] leading-relaxed break-words">
                              "{f.comment}"
                            </p>
                          </div>
                        </div>
                      ) : (
                        <p className="text-[11px] italic text-[#8ea498]">
                          (Hanya memberi rating bintang {f.rating}, tanpa catatan keluhan tertulis)
                        </p>
                      )}

                      {/* Metadata row */}
                      <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-gray-100 text-[10.5px] font-mono text-[#527867]">
                        <div className="flex items-center gap-2">
                          {f.reason_code && (
                            <span className="rounded-md bg-gray-100 px-2 py-0.5 text-gray-700 font-bold">
                              {REASON_LABELS[f.reason_code] || f.reason_code}
                            </span>
                          )}
                          <span>
                            {f.card_label ? `📍 ${f.card_label}` : f.order_no ? `🧾 Struk ${f.order_no}` : "📱 Review"}
                          </span>
                        </div>

                        {f.customer_phone && (
                          <a
                            href={`https://wa.me/${f.customer_phone.replace(/\D/g, "")}?text=${encodeURIComponent(
                              `Halo kak, terima kasih atas masukannya di ${business?.name || "kafe kami"}. Kami ingin menindaklanjuti keluhan terkait "${f.comment || 'pelayanan'}" agar kami bisa memberikan kompensasi & perbaikan.`
                            )}`}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white px-2 py-0.5 text-[10px] font-bold transition-colors"
                          >
                            <MessageCircle size={11} />
                            <span>Follow Up WA</span>
                          </a>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* HONESTY ALERT: Tap vs Ulasan */}
        {(activeTab === "overview" || activeTab === "cards") && (
          <div className="rounded-3xl border border-amber-200/90 bg-[#fffbeb] p-5 sm:p-6 shadow-[0_4px_20px_rgba(11,61,46,0.04)] space-y-2">
            <div className="flex items-center gap-2.5 text-[#92400e] font-extrabold text-sm">
              <span className="flex h-7 w-7 items-center justify-center rounded-xl bg-amber-100 text-[#92400e]">
                <Info size={16} />
              </span>
              <span>Penting: Memahami Perbedaan "Jumlah Tap" vs "Jumlah Ulasan"</span>
            </div>
            <p className="text-xs text-[#78350f] leading-relaxed pl-0 sm:pl-9.5">
              Metrik di bawah mencatat{" "}
              <strong>berapa kali kartu fisik di-tap oleh pelanggan</strong>.
              Pengisian ulasan bintang terjadi langsung di dalam platform resmi
              Google Maps dan Google tidak mengirimkan data ulasan balik ke pihak
              ketiga. Label ini disajikan secara transparan agar kalkulasi
              pertumbuhan reputasi tokomu tetap akurat.
            </p>
          </div>
        )}

        {/* Top Split: Google Snapshot & Monitor Tap */}
        {(activeTab === "overview" || activeTab === "cards") && (
          <section className="grid gap-5 lg:grid-cols-[1.35fr_1fr]">
            <div className="rounded-3xl border border-[#d8e3de] bg-white p-5 sm:p-6 shadow-[0_4px_20px_rgba(11,61,46,0.04)]">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="font-mono text-[10px] font-bold uppercase tracking-wider text-[#167052]">
                    GOOGLE REVIEW SNAPSHOT
                  </p>
                  <h2 className="mt-1.5 text-xl font-black text-[#0b3d2e]">
                    {googleReport.latest
                      ? googleReport.latest.rating.toFixed(1) +
                        " dari " +
                        googleReport.latest.reviewCount +
                        " ulasan"
                      : "Belum ada snapshot"}
                  </h2>
                  <p className="mt-1 text-xs text-[#527867]">
                    Pertumbuhan 7 hari:{" "}
                    {(googleReport.growth7d >= 0 ? "+" : "") +
                      googleReport.growth7d}{" "}
                    ulasan. 30 hari:{" "}
                    {(googleReport.growth30d >= 0 ? "+" : "") +
                      googleReport.growth30d}{" "}
                    ulasan.
                  </p>
                </div>
                {sessionRole === "owner" && (
                  <button
                    type="button"
                    onClick={handleSyncGoogle}
                    disabled={isSyncingGoogle}
                    className="inline-flex min-h-10 items-center justify-center gap-1.5 rounded-xl bg-[#0b3d2e] hover:bg-[#0e4837] px-3.5 py-2 font-mono text-xs font-bold text-[#c8f53a] shadow-xs transition-colors disabled:opacity-50 shrink-0"
                  >
                    {isSyncingGoogle ? "Menyinkronkan..." : "Sync Google"}
                  </button>
                )}
              </div>
            </div>

            <div
              className={
                "rounded-3xl border p-5 sm:p-6 shadow-[0_4px_20px_rgba(11,61,46,0.04)] " +
                (suspiciousTapCount
                  ? "border-amber-300 bg-[#fffbeb] text-[#92400e]"
                  : "border-emerald-200 bg-[#eaf6ef] text-[#0b3d2e]")
              }
            >
              <p className="font-mono text-[10px] font-bold uppercase tracking-wider text-[#167052]">
                MONITOR TAP
              </p>
              <p className="mt-1.5 text-xl font-black">
                {suspiciousTapCount
                  ? suspiciousTapCount + " tap perlu dicek"
                  : "Tidak ada tap mencurigakan"}
              </p>
              <p className="mt-1 text-xs text-[#527867]">
                Sistem menandai lonjakan berulang dari sumber yang sama dalam 24 jam.
              </p>
            </div>
          </section>
        )}

        {/* 4 SUMMARY METRICS */}
        {(activeTab === "overview" || activeTab === "cards") && (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-3xl border border-[#d8e3de] bg-white p-5 shadow-[0_4px_20px_rgba(11,61,46,0.04)]">
              <div className="flex items-center justify-between border-b border-[#e5ede9] pb-3">
                <span className="font-mono text-[10px] font-bold text-[#167052] uppercase tracking-wider">
                  TOTAL CLEAN TAPS
                </span>
                <span className="flex h-7 w-7 items-center justify-center rounded-xl bg-[#edf8f3] text-[#0b3d2e]">
                  <Nfc size={15} />
                </span>
              </div>
              <div className="mt-3">
                <h3 className="text-2xl sm:text-3xl font-black font-mono text-[#0b3d2e]">
                  {cleanMetrics.cleanTotal} Tap
                </h3>
                <span className="text-[11px] text-[#167052] font-mono font-bold block mt-1">
                  ✓ Bersih dari Bot &amp; Spam
                </span>
              </div>
            </div>

            <div className="rounded-3xl border border-[#d8e3de] bg-white p-5 shadow-[0_4px_20px_rgba(11,61,46,0.04)]">
              <div className="flex items-center justify-between border-b border-[#e5ede9] pb-3">
                <span className="font-mono text-[10px] font-bold text-[#167052] uppercase tracking-wider">
                  SUMBER INTERAKSI
                </span>
                <span className="flex h-7 w-7 items-center justify-center rounded-xl bg-[#edf8f3] text-[#0b3d2e]">
                  <QrCode size={15} />
                </span>
              </div>
              <div className="mt-3">
                <div className="flex items-baseline gap-2 font-mono">
                  <span className="text-lg font-black text-[#0b3d2e]">
                    {cleanMetrics.nfcCount} NFC
                  </span>
                  <span className="text-[#d8e3de]">/</span>
                  <span className="text-lg font-black text-[#167052]">
                    {cleanMetrics.qrCount} QR
                  </span>
                </div>
                <span className="text-[11px] text-[#527867] font-mono block mt-1">
                  {Math.round(
                    (cleanMetrics.nfcCount / (cleanMetrics.cleanTotal || 1)) * 100
                  )}
                  % via Chip Kontak NFC
                </span>
              </div>
            </div>

            <div className="rounded-3xl border border-[#d8e3de] bg-white p-5 shadow-[0_4px_20px_rgba(11,61,46,0.04)]">
              <div className="flex items-center justify-between border-b border-[#e5ede9] pb-3">
                <span className="font-mono text-[10px] font-bold text-amber-800 uppercase tracking-wider">
                  FILTER PEMBERSIHAN
                </span>
                <span className="flex h-7 w-7 items-center justify-center rounded-xl bg-amber-50 text-amber-800">
                  <ShieldCheck size={15} />
                </span>
              </div>
              <div className="mt-3">
                <h3 className="text-2xl sm:text-3xl font-black font-mono text-[#0b3d2e]">
                  {cleanMetrics.filteredDuplicateCount +
                    cleanMetrics.filteredBotCount}{" "}
                  Tap
                </h3>
                <span className="text-[11px] text-[#527867] font-mono block mt-1">
                  {cleanMetrics.filteredDuplicateCount} duplikat &lt;10m ·{" "}
                  {cleanMetrics.filteredBotCount} bot
                </span>
              </div>
            </div>

            <div className="rounded-3xl border border-[#d8e3de] bg-white p-5 shadow-[0_4px_20px_rgba(11,61,46,0.04)]">
              <div className="flex items-center justify-between border-b border-[#e5ede9] pb-3">
                <span className="font-mono text-[10px] font-bold text-[#167052] uppercase tracking-wider">
                  KARTU FISIK AKTIF
                </span>
                <span className="flex h-7 w-7 items-center justify-center rounded-xl bg-[#edf8f3] text-[#0b3d2e]">
                  <Layers size={15} />
                </span>
              </div>
              <div className="mt-3">
                <h3 className="text-2xl sm:text-3xl font-black font-mono text-[#0b3d2e]">
                  {cards.filter((c) => c.status === "active").length} Kartu
                </h3>
                <span className="text-[11px] text-[#527867] font-mono block mt-1">
                  Garansi fisik 6 bulan aktif
                </span>
              </div>
            </div>
          </div>
        )}

        {/* 14-DAY TAP TRENDS BAR CHART */}
        {(activeTab === "overview" || activeTab === "cards") && (
          <div className="rounded-3xl border border-[#d8e3de] bg-white p-5 sm:p-6 shadow-[0_4px_20px_rgba(11,61,46,0.04)] space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-[#e5ede9] pb-3">
            <div>
              <h3 className="font-extrabold text-sm sm:text-base text-[#0b3d2e]">
                Aktivitas Tap Bersih 14 Hari Terakhir
              </h3>
              <p className="text-xs text-[#527867]">
                Lonjakan tap menunjukkan jam sibuk dan efektivitas peletakan kartu/standee di meja kasir.
              </p>
            </div>
            <span className="font-mono text-xs text-[#167052] font-bold">
              Total 14 Hari: {dailySeries.reduce((acc, d) => acc + d.taps, 0)}{" "}
              Interaksi
            </span>
          </div>

          {/* Simple Clean Bar Chart */}
          <div className="pt-4 pb-2">
            <div className="grid grid-cols-7 sm:grid-cols-14 gap-2 items-end h-40">
              {dailySeries.map((item) => {
                const heightPercent = Math.max(
                  8,
                  (item.taps / maxDailyTap) * 100
                );
                return (
                  <div
                    key={item.date}
                    className="flex flex-col items-center gap-1.5 h-full justify-end group"
                  >
                    <span className="text-[9.5px] font-mono font-bold text-[#527867] group-hover:text-[#0b3d2e]">
                      {item.taps}
                    </span>
                    <div
                      className="w-full rounded-t-xl bg-[#edf8f3] border-t border-x border-[#d8e3de] group-hover:bg-[#c8f53a]/70 transition-all relative overflow-hidden"
                      style={{ height: heightPercent + "%" }}
                    >
                      {item.qr > 0 && (
                        <div
                          className="absolute bottom-0 inset-x-0 bg-[#0b3d2e]"
                          style={{
                            height: ((item.qr / (item.taps || 1)) * 100) + "%",
                          }}
                          title={item.qr + " via QR"}
                        />
                      )}
                    </div>
                    <span className="text-[9px] font-mono text-[#527867] truncate w-full text-center">
                      {item.displayDate}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
          <div className="flex items-center justify-center gap-5 text-[11px] font-mono text-[#527867] pt-3 border-t border-[#e5ede9]">
            <span className="flex items-center gap-1.5">
              <span className="h-3 w-3 rounded-md bg-[#edf8f3] border border-[#d8e3de]" />{" "}
              Tap NFC Kontak
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-3 w-3 rounded-md bg-[#0b3d2e]" /> Scan QR
              Backup
            </span>
          </div>
        </div>
        )}

        {/* CARDS LIST & MANAGEMENT TABLE */}
        {(activeTab === "overview" || activeTab === "cards") && (
          <div className="rounded-3xl border border-[#d8e3de] bg-white p-5 sm:p-6 shadow-[0_4px_20px_rgba(11,61,46,0.04)] space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#e5ede9] pb-4">
            <div>
              <h3 className="font-extrabold text-base text-[#0b3d2e]">
                Daftar Kartu NFC &amp; Standee Ulasan Terdaftar
              </h3>
              <p className="text-xs text-[#527867]">
                Kelola label lokasi meja, perbarui link Google Review jika bisnis pindah, atau nonaktifkan kartu yang hilang.
              </p>
            </div>
            <Link
              href="/admin/cards"
              className="text-xs font-mono font-bold text-[#167052] hover:underline"
            >
              + Terbitkan Kartu Tambahan via Admin ➔
            </Link>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left font-mono text-xs">
              <thead>
                <tr className="border-b border-[#d8e3de] bg-[#f8faf9] text-[#527867] text-[10px] uppercase">
                  <th className="py-2.5 px-3">Kode Kartu</th>
                  <th className="py-2.5 px-3">Label Penempatan</th>
                  <th className="py-2.5 px-3">Tujuan Form Ulasan</th>
                  <th className="py-2.5 px-3">Total Tap</th>
                  <th className="py-2.5 px-3">Status</th>
                  <th className="py-2.5 px-3 text-right">Aksi &amp; Uji Coba</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#e5ede9]">
                {cards.map((card) => {
                  const isActive = card.status === "active";
                  return (
                    <tr key={card.id} className="hover:bg-[#f4faf6] transition-colors">
                      {/* Code */}
                      <td className="py-3 px-3">
                        <div className="flex items-center gap-1.5">
                          <Nfc size={14} className="text-[#167052]" />
                          <span className="font-extrabold text-[#0b3d2e]">
                            {formatCardCodeDisplay(card.card_code)}
                          </span>
                        </div>
                        <span className="text-[10px] text-[#527867] block break-all">
                          {siteHost}/r/{card.card_code}
                        </span>
                      </td>

                      {/* Label + Layanan */}
                      <td className="py-3 px-3 font-sans font-bold text-[#18392f]">
                        <span className="block text-sm">
                          {card.label || "Tanpa Label"}
                        </span>
                        {sessionRole === "owner" ? (
                          <button
                            type="button"
                            onClick={() => handleOpenServiceModal(card)}
                            title="Ganti layanan kartu ini"
                            className="mt-1 inline-flex items-center gap-1 rounded-full border border-emerald-300 bg-[#edf8f3] px-2 py-0.5 font-mono text-[9px] font-bold text-[#0b3d2e] hover:bg-emerald-100 transition-colors"
                          >
                            {CARD_SERVICE_LABEL[card.type]}
                            <Layers size={9} />
                          </button>
                        ) : (
                          <span className="mt-1 inline-block rounded-full border border-emerald-300 bg-[#edf8f3] px-2 py-0.5 font-mono text-[9px] font-bold text-[#0b3d2e]">
                            {CARD_SERVICE_LABEL[card.type]}
                          </span>
                        )}
                      </td>

                      {/* Destination */}
                      <td className="py-3 px-3 max-w-[200px]">
                        {CARD_SERVICE_DESTINATION[card.type] ? (
                          <span
                            className="truncate block text-[#527867] text-[11px]"
                            title={card.destination_url || "-"}
                          >
                            {card.destination_url || "Belum ditentukan"}
                          </span>
                        ) : (
                          <span
                            className="block text-[11px] text-[#8ea498]"
                            title="Layanan kartu ini tidak memakai alamat tujuan"
                          >
                            —
                          </span>
                        )}
                      </td>

                      {/* Tap Count */}
                      <td className="py-3 px-3">
                        <span className="font-extrabold text-sm text-[#0b3d2e] block">
                          {card.tap_count} Tap
                        </span>
                        <span className="text-[9.5px] text-[#527867]">
                          {card.last_tapped_at
                            ? formatBusinessDateTime(card.last_tapped_at)
                            : "Belum pernah"}
                        </span>
                      </td>

                      {/* Status */}
                      <td className="py-3 px-3">
                        <span
                          className={
                            "inline-flex items-center gap-1 font-bold text-[10px] px-2.5 py-0.5 rounded-full border " +
                            (isActive
                              ? "bg-emerald-50 text-emerald-800 border-emerald-200"
                              : card.status === "suspended"
                              ? "bg-red-50 text-red-700 border-red-200"
                              : "bg-amber-50 text-amber-800 border-amber-200")
                          }
                        >
                          <span
                            className={
                              "h-1.5 w-1.5 rounded-full " +
                              (isActive ? "bg-emerald-600" : "bg-red-500")
                            }
                          />
                          {card.status.toUpperCase()}
                        </span>
                      </td>

                      {/* Actions */}
                      <td className="py-3 px-3 text-right space-x-1.5 whitespace-nowrap">
                        {/* Open 302 Redirect */}
                        <Link
                          href={"/r/" + card.card_code}
                          target="_blank"
                          className="inline-flex items-center gap-0.5 rounded-lg border border-[#d8e3de] bg-white px-2 py-1 text-[10.5px] font-bold text-[#527867] hover:text-[#0b3d2e] hover:bg-[#edf8f3] transition-colors"
                          title="Buka endpoint redirect 302 asli"
                        >
                          <ExternalLink size={11} />
                          <span>302</span>
                        </Link>

                        {/* Open QR Modal Button */}
                        <button
                          type="button"
                          onClick={() => handleOpenQrModal(card.id)}
                          className="inline-flex items-center gap-1 rounded-lg border border-emerald-300 bg-emerald-50 hover:bg-emerald-100 px-2 py-1 text-[10.5px] font-bold text-[#0b3d2e] transition-colors"
                          title="Download QR Code murni / standee meja"
                        >
                          <QrCode size={11} />
                          <span>QR</span>
                        </button>

                        {card.type === "review" && sessionRole === "owner" && (
                          <Link
                            href={"/app/review/standee/" + card.id}
                            className="inline-flex items-center gap-0.5 rounded-lg bg-[#0b3d2e] hover:bg-[#0e4837] px-2.5 py-1 text-[10.5px] font-bold text-[#c8f53a] shadow-xs transition-colors"
                          >
                            Cetak
                          </Link>
                        )}

                        {card.type === "smart_touch" &&
                          sessionRole === "owner" && (
                            <Link
                              href={"/app/review/smart-touch/" + card.id}
                              className="inline-flex items-center gap-0.5 rounded-lg bg-[#0b3d2e] hover:bg-[#0e4837] px-2.5 py-1 text-[10.5px] font-bold text-[#c8f53a] shadow-xs transition-colors"
                            >
                              Smart Touch
                            </Link>
                          )}

                        {CARD_SERVICE_DESTINATION[card.type] && (
                          <button
                            type="button"
                            onClick={() => handleOpenEditModal(card)}
                            className="rounded-lg border border-[#d8e3de] bg-white hover:bg-[#edf8f3] px-2.5 py-1 text-[10.5px] font-bold text-[#0b3d2e] transition-colors"
                          >
                            Edit Tujuan
                          </button>
                        )}

                        {/* Suspend / Unsuspend */}
                        <button
                          type="button"
                          onClick={() => handleToggleSuspend(card)}
                          className={
                            "rounded-lg px-2.5 py-1 text-[10.5px] font-bold transition-colors " +
                            (isActive
                              ? "bg-red-50 text-red-700 border border-red-200 hover:bg-red-100"
                              : "bg-emerald-50 text-emerald-800 border border-emerald-200 hover:bg-emerald-100")
                          }
                        >
                          {isActive ? "Suspend" : "Aktifkan"}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
        )}
      </main>

      {/* PILIH LAYANAN KARTU MODAL */}
      {serviceCard && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#07281e]/60 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md space-y-5 rounded-3xl border border-[#d8e3de] bg-white p-6 shadow-2xl animate-in fade-in zoom-in duration-150">
            <div className="flex items-center justify-between border-b border-[#e5ede9] pb-3">
              <div className="flex items-center gap-2">
                <Layers size={18} className="text-[#0b3d2e]" />
                <h3 className="text-base font-extrabold text-[#0b3d2e]">
                  Layanan Kartu {formatCardCodeDisplay(serviceCard.card_code)}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setServiceCard(null)}
                className="rounded-xl p-1 text-[#527867] hover:bg-[#edf8f3] hover:text-[#0b3d2e] transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            <p className="text-[11.5px] leading-relaxed text-[#527867]">
              Satu kartu untuk satu keperluan. Pilih salah satu — kartunya akan melakukan persis itu setiap kali di-tap, tidak ada yang lain.
            </p>

            <div className="space-y-2.5">
              {(Object.keys(CARD_SERVICE_LABEL) as CardService[]).map(
                (service) => {
                  const dipilih = serviceChoice === service;
                  return (
                    <label
                      key={service}
                      className={
                        "flex cursor-pointer items-start gap-2.5 rounded-2xl border p-3.5 transition-colors " +
                        (dipilih
                          ? "border-[#0b3d2e] bg-[#edf8f3]"
                          : "border-[#d8e3de] bg-white hover:border-emerald-400")
                      }
                    >
                      <input
                        type="radio"
                        name="layanan-kartu"
                        value={service}
                        checked={dipilih}
                        onChange={() => setServiceChoice(service)}
                        className="mt-0.5 accent-[#0b3d2e]"
                      />
                      <span className="flex-1">
                        <span className="block text-xs font-extrabold text-[#0b3d2e]">
                          {CARD_SERVICE_LABEL[service]}
                        </span>
                        {CARD_SERVICE_DESTINATION[service] && (
                          <span className="mt-0.5 block text-[10.5px] leading-relaxed text-[#527867]">
                            {CARD_SERVICE_DESTINATION[service]}
                          </span>
                        )}
                        {service === serviceCard.type && (
                          <span className="mt-1 inline-block font-mono text-[9px] font-bold text-[#167052]">
                            LAYANAN SEKARANG
                          </span>
                        )}
                      </span>
                    </label>
                  );
                }
              )}
            </div>

            {serviceChoice !== serviceCard.type && (
              <div className="rounded-2xl border border-amber-200 bg-[#fffbeb] p-3">
                <p className="text-[11px] leading-relaxed font-bold text-[#92400e]">
                  Alamat tujuan kartu ini akan dikosongkan.
                </p>
                <p className="mt-0.5 text-[10.5px] leading-relaxed text-[#92400e]">
                  {CARD_SERVICE_DESTINATION[serviceChoice]
                    ? "Setelah pindah, isi alamat barunya lewat tombol Edit Tujuan."
                    : "Layanan " +
                      CARD_SERVICE_LABEL[serviceChoice] +
                      " memang tidak memakai alamat tujuan."}
                </p>
              </div>
            )}

            {serviceCard.type === "smart_touch" &&
              serviceChoice !== "smart_touch" && (
                <div className="rounded-2xl border border-emerald-300 bg-[#edf8f3] p-3">
                  <p className="text-[11px] font-bold text-[#0b3d2e]">
                    Smart Touch akan diarsipkan dulu, bukan dihapus.
                  </p>
                  <p className="mt-1 text-[10.5px] leading-relaxed text-[#527867]">
                    Judul, subjudul, dan semua tombol disimpan sebagai cadangan audit. Setelah itu kartu ini hanya menjalankan layanan baru yang dipilih.
                  </p>
                  <button
                    type="button"
                    onClick={handleArchiveAndMoveService}
                    disabled={isSavingService}
                    className="mt-3 rounded-xl bg-[#0b3d2e] hover:bg-[#0e4837] px-4 py-2 text-xs font-extrabold text-[#c8f53a] shadow-xs transition-colors disabled:opacity-40"
                  >
                    {isSavingService
                      ? "Mengarsipkan..."
                      : "Arsipkan Smart Touch & Pindahkan"}
                  </button>
                </div>
              )}

            {serviceError && (
              <div className="flex items-start gap-2 rounded-2xl border border-red-200 bg-red-50 p-3">
                <AlertCircle
                  size={14}
                  className="mt-0.5 shrink-0 text-red-600"
                />
                <p className="text-[11px] leading-relaxed font-bold text-red-700">
                  {serviceError}
                </p>
              </div>
            )}

            <div className="flex justify-end gap-2 border-t border-[#e5ede9] pt-3">
              <button
                type="button"
                onClick={() => setServiceCard(null)}
                className="rounded-xl border border-[#d8e3de] bg-white px-4 py-2 text-xs font-bold text-[#527867] hover:bg-[#edf8f3] transition-colors"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleSaveService}
                disabled={
                  isSavingService ||
                  serviceChoice === serviceCard.type ||
                  (serviceCard.type === "smart_touch" &&
                    serviceChoice !== "smart_touch")
                }
                className="rounded-xl bg-[#0b3d2e] hover:bg-[#0e4837] px-5 py-2 text-xs font-extrabold text-[#c8f53a] shadow-xs transition-colors disabled:opacity-40"
              >
                {isSavingService ? "Memindah..." : "Pakai Layanan Ini ✓"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* EDIT MODAL DIALOG */}
      {selectedCardForEdit && (
        <div className="fixed inset-0 z-50 bg-[#07281e]/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="w-full max-w-lg rounded-3xl border border-[#d8e3de] bg-white p-6 sm:p-7 shadow-2xl space-y-5 animate-in fade-in zoom-in duration-150">
            <div className="flex items-center justify-between border-b border-[#e5ede9] pb-3">
              <div className="flex items-center gap-2">
                <Edit3 size={18} className="text-[#0b3d2e]" />
                <h3 className="font-extrabold text-base text-[#0b3d2e]">
                  Edit Kartu {formatCardCodeDisplay(selectedCardForEdit.card_code)}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setSelectedCardForEdit(null)}
                className="rounded-xl p-1 text-[#527867] hover:bg-[#edf8f3] hover:text-[#0b3d2e] transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            <form
              onSubmit={handleSaveCardEdits}
              className="space-y-4 font-sans"
            >
              {/* Label */}
              <div className="space-y-1.5">
                <label className="block font-mono text-xs font-bold text-[#0b3d2e]">
                  Label Penempatan Meja:
                </label>
                <input
                  type="text"
                  required
                  value={editLabel}
                  onChange={(e) => setEditLabel(e.target.value)}
                  placeholder="Contoh: Meja 08, Kasir Lantai 2"
                  className="w-full rounded-xl border border-[#d8e3de] bg-[#fbfdfc] p-2.5 text-xs font-bold text-[#0b3d2e] focus:border-emerald-600 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-600/20"
                />
              </div>

              {/* Kartu tautan: alamat diketik langsung */}
              {selectedCardForEdit.type === "link" ? (
                <div className="space-y-1.5">
                  <label className="block font-mono text-xs font-bold text-[#0b3d2e]">
                    Ganti alamat tujuan:
                  </label>
                  <input
                    type="url"
                    value={editCustomUrl}
                    onChange={(e) => setEditCustomUrl(e.target.value)}
                    placeholder="https://portofolio-saya.com"
                    className="w-full rounded-xl border border-[#d8e3de] bg-[#fbfdfc] px-3 py-2.5 font-mono text-xs font-bold text-[#0b3d2e] focus:border-emerald-600 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-600/20"
                  />
                  <p className="text-[11px] leading-relaxed text-[#527867]">
                    Harus diawali https. Kartunya tidak perlu ditulis ulang: yang tersimpan di kartu cuma alamat pengalihan, tujuannya disimpan di sini.
                  </p>
                </div>
              ) : (
                <div className="space-y-1.5">
                  <label className="block font-mono text-xs font-bold text-[#0b3d2e]">
                    Ganti Lokasi Google Maps Usaha:
                  </label>
                  <div className="relative">
                    <Search
                      className="absolute left-3 top-3 text-[#527867]"
                      size={15}
                    />
                    <input
                      type="text"
                      value={editSearchQuery}
                      onChange={(e) => setEditSearchQuery(e.target.value)}
                      placeholder="Cari nama cafe / bisnis baru..."
                      className="w-full rounded-xl border border-[#d8e3de] bg-[#fbfdfc] pl-9 pr-3 py-2.5 text-xs font-bold text-[#0b3d2e] focus:border-emerald-600 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-600/20"
                    />
                  </div>

                  {/* Places Suggestion */}
                  <div className="space-y-1.5 max-h-40 overflow-y-auto pr-1 mt-2">
                    {editPlacesResults.slice(0, 3).map((p) => {
                      const isPicked = selectedPlace?.placeId === p.placeId;
                      return (
                        <div
                          key={p.placeId}
                          onClick={() => setSelectedPlace(p)}
                          className={
                            "cursor-pointer rounded-xl border p-2.5 text-xs transition-all " +
                            (isPicked
                              ? "border-[#0b3d2e] bg-[#edf8f3] font-bold text-[#0b3d2e]"
                              : "border-[#d8e3de] bg-[#fbfdfc] hover:border-emerald-400")
                          }
                        >
                          <span className="font-extrabold block text-sm">
                            {p.name}
                          </span>
                          <span className="text-[10.5px] text-[#527867] line-clamp-1">
                            {p.address}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Destination Preview */}
              <div className="rounded-2xl border border-[#d8e3de] bg-[#f8faf9] p-3 text-[11px] font-mono space-y-1">
                <span className="text-[#527867] block">
                  URL TUJUAN AKHIR SAAT INI:
                </span>
                <p className="text-[#167052] font-bold break-all">
                  {selectedCardForEdit.type === "link"
                    ? editCustomUrl.trim() || selectedCardForEdit.destination_url
                    : selectedPlace
                    ? selectedPlace.directReviewUrl
                    : selectedCardForEdit.destination_url}
                </p>
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-[#e5ede9]">
                <button
                  type="button"
                  onClick={() => setSelectedCardForEdit(null)}
                  className="rounded-xl border border-[#d8e3de] bg-white px-4 py-2 text-xs font-bold text-[#527867] hover:bg-[#edf8f3] transition-colors"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="rounded-xl bg-[#0b3d2e] hover:bg-[#0e4837] px-5 py-2 text-xs font-extrabold text-[#c8f53a] shadow-xs transition-colors"
                >
                  {isSaving ? "Menyimpan..." : "Simpan Perubahan ✓"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Footer */}
      <footer className="border-t border-[#d8e3de] bg-white/80 py-4 text-center text-xs font-mono text-[#527867]">
        KAEL Review Engine · 302 Temporary Direct Redirect &amp; Bot-Safe Tap Analytics
      </footer>

      {/* Review QR Modal */}
      <ReviewQrModal
        isOpen={isQrModalOpen}
        onClose={() => setIsQrModalOpen(false)}
        cards={cards}
        business={business}
        initialCardId={qrModalCardId}
        themeClassName={themeClassName}
      />
    </div>
  );
}
