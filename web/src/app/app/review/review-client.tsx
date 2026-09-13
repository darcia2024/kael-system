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
} from "lucide-react";
import {
  CARD_SERVICE_DESTINATION,
  CARD_SERVICE_LABEL,
  type Business,
  type Card,
  type CardService,
  type CardTap,
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

export default function KaelReviewOwnerDashboard({
  business,
  cards,
  rawTaps,
  googleReport,
  suspiciousTapCount,
  sessionRole,
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
  /** Menentukan ke beranda mana tombol kembali mengantar. */
  sessionRole: "owner" | "staff";
}) {
  const router = useRouter();
  const [selectedCardForEdit, setSelectedCardForEdit] = useState<Card | null>(
    null,
  );

  // Edit card modal state
  const [editLabel, setEditLabel] = useState("");
  const [editSearchQuery, setEditSearchQuery] = useState("");
  const [editPlacesResults, setEditPlacesResults] = useState<
    GooglePlaceResult[]
  >([]);
  const [selectedPlace, setSelectedPlace] = useState<GooglePlaceResult | null>(
    null,
  );
  const [manualPlaceId, setManualPlaceId] = useState("");

  /**
   * Tujuan untuk kartu jenis `link`, yang tidak menunjuk tempat di Google.
   * Kartu ulasan tidak memakai ini dan alurnya tidak berubah sama sekali.
   */
  const [editCustomUrl, setEditCustomUrl] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [isSyncingGoogle, setIsSyncingGoogle] = useState(false);

  /**
   * Pemilihan layanan kartu. Satu kartu satu layanan, jadi ini radio, bukan
   * centang: tidak ada bentuk layar yang mengizinkan dua-duanya sekaligus.
   */
  const [serviceCard, setServiceCard] = useState<Card | null>(null);
  const [serviceChoice, setServiceChoice] = useState<CardService>("review");
  const [isSavingService, setIsSavingService] = useState(false);
  const [serviceError, setServiceError] = useState("");

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

  // Angka mentah datang dari server; pembersihannya (dedup 10 menit, kunjungan
  // otomatis, permintaan HEAD) terjadi di sini sebelum ditampilkan.
  const cleanMetrics = calculateCleanTaps(rawTaps);
  const dailySeries = generateDailyTapSeries(cleanMetrics.cleanTaps, 14); // 14 hari terakhir

  // Max taps for chart scaling
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

    /**
     * Kartu tautan tidak pernah menyentuh Google Places. Pemeriksaan bentuk
     * alamat dilakukan di sini supaya kesalahan ketik ketahuan sebelum
     * dikirim, tapi server tetap memeriksanya lagi lewat updateCardAction.
     */
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
          "Tautan tidak valid. Tulis lengkap beserta https:// di depannya.",
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
    const res = await setCardServiceAction(serviceCard.id, serviceChoice);
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
      serviceChoice,
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
        ? `Nonaktifkan kartu ${card.card_code}? Pelanggan yang men-tap akan melihat halaman kartu tidak aktif.`
        : `Aktifkan kembali kartu ${card.card_code}?`;

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
    <div className="min-h-screen bg-[#f7f6fc] text-[#232331] font-sans flex flex-col">
      {/* Top Header */}
      <header className="sticky top-0 z-30 border-b-2 border-[#232331] bg-white px-4 sm:px-8 py-3.5">
        <div className="mx-auto flex max-w-6xl items-center justify-between">
          <div className="flex items-center gap-3">
            <Link
              href={sessionRole === "owner" ? "/app" : "/app/staff"}
              className="flex h-9 w-9 items-center justify-center rounded-xl border border-[#232331] bg-[#fcfcfe] text-[#232331] shadow-ink-xs hover:bg-[#f0edff]"
              title="Kembali ke Hub KAEL"
            >
              <ArrowLeft size={16} />
            </Link>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="font-extrabold text-sm sm:text-base text-[#232331]">
                  KAEL Review · Command Center
                </h1>
                <span className="rounded-md bg-[#f0edff] px-2 py-0.5 font-mono text-[9px] font-bold text-[#7958d8] border border-[#7958d8]">
                  Modul 01 Live
                </span>
              </div>
              <span className="text-[11px] text-[#7b7b8e] font-mono block">
                {business?.name} · Google Place ID Locked
              </span>
            </div>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="flex-1 mx-auto w-full max-w-6xl p-4 sm:p-8 space-y-6">
        {/* HONESTY ALERT: Tap vs Ulasan (KAEL Review 6.3) */}
        <div className="rounded-3xl border-2 border-[#232331] bg-[#ffedd5] p-5 sm:p-6 shadow-ink-md space-y-2">
          <div className="flex items-center gap-2 text-[#c2410c] font-black text-sm">
            <Info size={18} />
            <span>
              Penting: Memahami Perbedaan "Jumlah Tap" vs "Jumlah Ulasan"
            </span>
          </div>
          <p className="text-xs text-[#7c2d12] leading-relaxed">
            Metrik di bawah mencatat{" "}
            <strong>berapa kali kartu fisik di-tap oleh pelanggan</strong>.
            Pengisian ulasan bintang terjadi langsung di dalam platform resmi
            Google Maps dan Google tidak mengirimkan data ulasan balik ke pihak
            ketiga. Label ini disajikan secara transparan agar kalkulasi
            pertumbuhan reputasi tokomu tetap akurat.
          </p>
        </div>

        <section className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
          <div className="rounded-2xl border-2 border-[#232331] bg-white p-5 shadow-ink-md">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="font-mono text-[10px] font-bold text-[#7958d8]">
                  GOOGLE REVIEW SNAPSHOT
                </p>
                <h2 className="mt-1 text-lg font-extrabold">
                  {googleReport.latest
                    ? `${googleReport.latest.rating.toFixed(1)} dari ${googleReport.latest.reviewCount} ulasan`
                    : "Belum ada snapshot"}
                </h2>
                <p className="mt-1 text-xs text-[#7b7b8e]">
                  Pertumbuhan 7 hari: {googleReport.growth7d >= 0 ? "+" : ""}
                  {googleReport.growth7d} ulasan. 30 hari:{" "}
                  {googleReport.growth30d >= 0 ? "+" : ""}
                  {googleReport.growth30d} ulasan.
                </p>
              </div>
              {sessionRole === "owner" && (
                <button
                  type="button"
                  onClick={handleSyncGoogle}
                  disabled={isSyncingGoogle}
                  className="btn-tactile rounded-lg border-2 border-[#232331] bg-[#d9ff57] px-3 py-2 text-xs font-bold disabled:opacity-50"
                >
                  {isSyncingGoogle ? "Menyinkronkan..." : "Sync Google"}
                </button>
              )}
            </div>
          </div>
          <div
            className={`rounded-2xl border-2 p-5 shadow-ink-md ${suspiciousTapCount ? "border-[#c2410c] bg-[#ffedd5]" : "border-[#232331] bg-[#dcfce7]"}`}
          >
            <p className="font-mono text-[10px] font-bold">MONITOR TAP</p>
            <p className="mt-1 text-lg font-extrabold">
              {suspiciousTapCount
                ? `${suspiciousTapCount} tap perlu dicek`
                : "Tidak ada tap mencurigakan"}
            </p>
            <p className="mt-1 text-xs">
              Sistem menandai lonjakan berulang dari sumber yang sama dalam 24
              jam.
            </p>
          </div>
        </section>

        {/* 4 SUMMARY METRICS */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="card-tactile rounded-3xl border-2 border-[#232331] bg-white p-5 shadow-ink-md">
            <div className="flex items-center justify-between border-b border-[#dedee8] pb-2.5">
              <span className="font-mono text-[10px] font-bold text-[#7958d8] uppercase">
                TOTAL CLEAN TAPS
              </span>
              <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#f0edff] text-[#7958d8]">
                <Nfc size={15} />
              </span>
            </div>
            <div className="mt-3">
              <h3 className="text-2xl sm:text-3xl font-extrabold font-mono text-[#232331]">
                {cleanMetrics.cleanTotal} Tap
              </h3>
              <span className="text-[11px] text-[#16a34a] font-mono font-bold block mt-1">
                ✓ Bersih dari Bot &amp; Spam
              </span>
            </div>
          </div>

          <div className="card-tactile rounded-3xl border-2 border-[#232331] bg-white p-5 shadow-ink-md">
            <div className="flex items-center justify-between border-b border-[#dedee8] pb-2.5">
              <span className="font-mono text-[10px] font-bold text-[#16a34a] uppercase">
                SUMBER INTERAKSI
              </span>
              <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#dcfce7] text-[#16a34a]">
                <QrCode size={15} />
              </span>
            </div>
            <div className="mt-3">
              <div className="flex items-baseline gap-2 font-mono">
                <span className="text-lg font-extrabold text-[#7958d8]">
                  {cleanMetrics.nfcCount} NFC
                </span>
                <span className="text-[#dedee8]">/</span>
                <span className="text-lg font-extrabold text-[#16a34a]">
                  {cleanMetrics.qrCount} QR
                </span>
              </div>
              <span className="text-[11px] text-[#7b7b8e] font-mono block mt-1">
                {Math.round(
                  (cleanMetrics.nfcCount / (cleanMetrics.cleanTotal || 1)) *
                    100,
                )}
                % via Chip Kontak NFC
              </span>
            </div>
          </div>

          <div className="card-tactile rounded-3xl border-2 border-[#232331] bg-white p-5 shadow-ink-md">
            <div className="flex items-center justify-between border-b border-[#dedee8] pb-2.5">
              <span className="font-mono text-[10px] font-bold text-[#c2410c] uppercase">
                FILTER PEMBERSIHAN
              </span>
              <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#ffedd5] text-[#c2410c]">
                <ShieldCheck size={15} />
              </span>
            </div>
            <div className="mt-3">
              <h3 className="text-2xl sm:text-3xl font-extrabold font-mono text-[#232331]">
                {cleanMetrics.filteredDuplicateCount +
                  cleanMetrics.filteredBotCount}{" "}
                Tap
              </h3>
              <span className="text-[11px] text-[#7b7b8e] font-mono block mt-1">
                {cleanMetrics.filteredDuplicateCount} duplikat &lt;10m ·{" "}
                {cleanMetrics.filteredBotCount} bot
              </span>
            </div>
          </div>

          <div className="card-tactile rounded-3xl border-2 border-[#232331] bg-white p-5 shadow-ink-md">
            <div className="flex items-center justify-between border-b border-[#dedee8] pb-2.5">
              <span className="font-mono text-[10px] font-bold text-[#d97706] uppercase">
                KARTU FISIK AKTIF
              </span>
              <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#fef3c7] text-[#d97706]">
                <Layers size={15} />
              </span>
            </div>
            <div className="mt-3">
              <h3 className="text-2xl sm:text-3xl font-extrabold font-mono text-[#232331]">
                {cards.filter((c) => c.status === "active").length} Kartu
              </h3>
              <span className="text-[11px] text-[#7b7b8e] font-mono block mt-1">
                Garansi fisik 6 bulan aktif
              </span>
            </div>
          </div>
        </div>

        {/* 14-DAY TAP TRENDS BAR CHART */}
        <div className="rounded-3xl border-2 border-[#232331] bg-white p-5 sm:p-6 shadow-ink-md space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-[#dedee8] pb-3">
            <div>
              <h3 className="font-extrabold text-sm sm:text-base text-[#232331]">
                Aktivitas Tap Bersih 14 Hari Terakhir
              </h3>
              <p className="text-xs text-[#7b7b8e]">
                Lonjakan tap menunjukkan jam sibuk dan efektivitas peletakan
                kartu/standee di meja kasir.
              </p>
            </div>
            <span className="font-mono text-xs text-[#7958d8] font-bold">
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
                  (item.taps / maxDailyTap) * 100,
                );
                return (
                  <div
                    key={item.date}
                    className="flex flex-col items-center gap-1.5 h-full justify-end group"
                  >
                    <span className="text-[9.5px] font-mono font-bold text-[#7b7b8e] group-hover:text-[#232331]">
                      {item.taps}
                    </span>
                    <div
                      className="w-full rounded-t-xl bg-[#f0edff] border-t-2 border-x-2 border-[#232331] group-hover:bg-[#d9ff57] transition-all relative overflow-hidden"
                      style={{ height: `${heightPercent}%` }}
                    >
                      {item.qr > 0 && (
                        <div
                          className="absolute bottom-0 inset-x-0 bg-[#16a34a]"
                          style={{
                            height: `${(item.qr / (item.taps || 1)) * 100}%`,
                          }}
                          title={`${item.qr} via QR`}
                        />
                      )}
                    </div>
                    <span className="text-[9px] font-mono text-[#7b7b8e] truncate w-full text-center">
                      {item.displayDate}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
          <div className="flex items-center justify-center gap-4 text-[11px] font-mono text-[#7b7b8e] pt-2 border-t border-[#dedee8]">
            <span className="flex items-center gap-1.5">
              <span className="h-3 w-3 rounded-sm bg-[#f0edff] border border-[#232331]" />{" "}
              Tap NFC Kontak
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-3 w-3 rounded-sm bg-[#16a34a]" /> Scan QR
              Backup
            </span>
          </div>
        </div>

        {/* CARDS LIST & MANAGEMENT TABLE */}
        <div className="rounded-3xl border-2 border-[#232331] bg-white p-5 sm:p-6 shadow-ink-md space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#dedee8] pb-4">
            <div>
              <h3 className="font-extrabold text-base text-[#232331]">
                Daftar Kartu NFC &amp; Standee Ulasan Terdaftar
              </h3>
              <p className="text-xs text-[#7b7b8e]">
                Kelola label lokasi meja, perbarui link Google Review jika
                bisnis pindah, atau nonaktifkan kartu yang hilang.
              </p>
            </div>
            <Link
              href="/admin/cards"
              className="btn-tactile text-xs font-mono font-bold text-[#7958d8] hover:underline"
            >
              + Terbitkan Kartu Tambahan via Admin ➔
            </Link>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left font-mono text-xs">
              <thead>
                <tr className="border-b border-[#dedee8] text-[#7b7b8e] text-[10px] uppercase">
                  <th className="py-2.5 px-3">Kode Kartu</th>
                  <th className="py-2.5 px-3">Label Penempatan</th>
                  <th className="py-2.5 px-3">Tujuan Form Ulasan</th>
                  <th className="py-2.5 px-3">Total Tap</th>
                  <th className="py-2.5 px-3">Status</th>
                  <th className="py-2.5 px-3 text-right">
                    Aksi &amp; Uji Coba
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#dedee8]">
                {cards.map((card) => {
                  const isActive = card.status === "active";
                  return (
                    <tr key={card.id} className="hover:bg-[#fcfcfe]">
                      {/* Code */}
                      <td className="py-3 px-3">
                        <div className="flex items-center gap-1.5">
                          <Nfc size={14} className="text-[#7958d8]" />
                          <span className="font-extrabold text-[#232331]">
                            {formatCardCodeDisplay(card.card_code)}
                          </span>
                        </div>
                        <span className="text-[10px] text-[#7b7b8e] block break-all">
                          {siteHost}/r/{card.card_code}
                        </span>
                      </td>

                      {/* Label + layanan kartu ini */}
                      <td className="py-3 px-3 font-sans font-bold text-[#232331]">
                        <span className="block">
                          {card.label || "Tanpa Label"}
                        </span>
                        {/*
                          Layanan ditulis terang-terangan di tiap baris. Satu
                          kartu melayani satu hal, dan pemiliknya harus bisa
                          melihat yang mana tanpa menebak dari tombol yang
                          kebetulan muncul di sebelah kanan.
                        */}
                        {sessionRole === "owner" ? (
                          <button
                            type="button"
                            onClick={() => handleOpenServiceModal(card)}
                            title="Ganti layanan kartu ini"
                            className="btn-tactile mt-1 inline-flex items-center gap-1 rounded-full border border-[#7958d8] bg-[#f0edff] px-2 py-0.5 font-mono text-[9px] font-bold text-[#7958d8]"
                          >
                            {CARD_SERVICE_LABEL[card.type]}
                            <Layers size={9} />
                          </button>
                        ) : (
                          <span className="mt-1 inline-block rounded-full border border-[#7958d8] bg-[#f0edff] px-2 py-0.5 font-mono text-[9px] font-bold text-[#7958d8]">
                            {CARD_SERVICE_LABEL[card.type]}
                          </span>
                        )}
                      </td>

                      {/* Destination — hanya untuk layanan yang benar-benar memakainya */}
                      <td className="py-3 px-3 max-w-[200px]">
                        {CARD_SERVICE_DESTINATION[card.type] ? (
                          <span
                            className="truncate block text-[#7b7b8e] text-[11px]"
                            title={card.destination_url || "-"}
                          >
                            {card.destination_url || "Belum ditentukan"}
                          </span>
                        ) : (
                          <span
                            className="block text-[11px] text-[#b6b6c4]"
                            title="Layanan kartu ini tidak memakai alamat tujuan"
                          >
                            —
                          </span>
                        )}
                      </td>

                      {/* Tap Count */}
                      <td className="py-3 px-3">
                        <span className="font-extrabold text-sm text-[#232331] block">
                          {card.tap_count} Tap
                        </span>
                        <span className="text-[9.5px] text-[#7b7b8e]">
                          {card.last_tapped_at
                            ? formatBusinessDateTime(card.last_tapped_at)
                            : "Belum pernah"}
                        </span>
                      </td>

                      {/* Status */}
                      <td className="py-3 px-3">
                        <span
                          className={`inline-flex items-center gap-1 font-bold text-[10px] px-2 py-0.5 rounded-full border ${
                            isActive
                              ? "bg-[#dcfce7] text-[#16a34a] border-[#16a34a]"
                              : card.status === "suspended"
                                ? "bg-[#feebee] text-[#ef4444] border-[#ef4444]"
                                : "bg-[#f0edff] text-[#7958d8] border-[#7958d8]"
                          }`}
                        >
                          <span
                            className={`h-1.5 w-1.5 rounded-full ${isActive ? "bg-[#16a34a]" : "bg-[#ef4444]"}`}
                          />
                          {card.status.toUpperCase()}
                        </span>
                      </td>

                      {/* Actions */}
                      <td className="py-3 px-3 text-right space-x-1.5 whitespace-nowrap">
                        {/* Open 302 Redirect */}
                        <Link
                          href={`/r/${card.card_code}`}
                          target="_blank"
                          className="btn-tactile inline-flex items-center gap-0.5 rounded-lg border border-[#dedee8] bg-white px-2 py-1 text-[10.5px] font-bold text-[#7b7b8e] hover:text-[#232331]"
                          title="Buka endpoint redirect 302 asli"
                        >
                          <ExternalLink size={11} />
                          <span>302</span>
                        </Link>

                        {card.type === "review" && sessionRole === "owner" && (
                          <Link
                            href={`/app/review/standee/${card.id}`}
                            className="btn-tactile inline-flex items-center gap-0.5 rounded-lg border border-[#232331] bg-[#d9ff57] px-2 py-1 text-[10.5px] font-bold text-[#232331]"
                          >
                            Cetak
                          </Link>
                        )}

                        {card.type === "smart_touch" &&
                          sessionRole === "owner" && (
                            <Link
                              href={`/app/review/smart-touch/${card.id}`}
                              className="btn-tactile inline-flex items-center gap-0.5 rounded-lg border border-[#232331] bg-[#d9ff57] px-2 py-1 text-[10.5px] font-bold text-[#232331]"
                            >
                              Smart Touch
                            </Link>
                          )}

                        {/*
                          "Edit Tujuan" cuma untuk kartu yang layanannya memang
                          membaca alamat tujuan. Menawarkannya di kartu member
                          atau Smart Touch cuma mengundang alamat tersimpan yang
                          tidak pernah dipakai rute mana pun.
                        */}
                        {CARD_SERVICE_DESTINATION[card.type] && (
                          <button
                            type="button"
                            onClick={() => handleOpenEditModal(card)}
                            className="btn-tactile rounded-lg border border-[#7958d8] bg-[#f0edff] px-2 py-1 text-[10.5px] font-bold text-[#7958d8]"
                          >
                            Edit Tujuan
                          </button>
                        )}

                        {/* Suspend / Unsuspend */}
                        <button
                          type="button"
                          onClick={() => handleToggleSuspend(card)}
                          className={`btn-tactile rounded-lg px-2 py-1 text-[10.5px] font-bold ${
                            isActive
                              ? "bg-[#feebee] text-[#ef4444] border border-[#ef4444]"
                              : "bg-[#dcfce7] text-[#16a34a] border border-[#16a34a]"
                          }`}
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
      </main>

      {/*
        PILIH LAYANAN KARTU

        Radio, bukan centang, dan itu memang inti dari layar ini: satu kartu
        mengerjakan satu hal. Kartu ulasan tidak sekalian jadi kartu member,
        dan Smart Touch tidak menumpang di kartu tautan — pemiliknya memilih,
        lalu kartunya melakukan persis itu saat di-tap.
      */}
      {serviceCard && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#232331]/60 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md space-y-5 rounded-3xl border-2 border-[#232331] bg-white p-6 shadow-ink-lg animate-in fade-in zoom-in duration-150">
            <div className="flex items-center justify-between border-b border-[#dedee8] pb-3">
              <div className="flex items-center gap-2">
                <Layers size={18} className="text-[#7958d8]" />
                <h3 className="text-base font-extrabold text-[#232331]">
                  Layanan Kartu {formatCardCodeDisplay(serviceCard.card_code)}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setServiceCard(null)}
                className="rounded-xl p-1 text-[#7b7b8e] hover:bg-[#f0edff] hover:text-[#232331]"
              >
                <X size={18} />
              </button>
            </div>

            <p className="text-[11.5px] leading-relaxed text-[#7b7b8e]">
              Satu kartu untuk satu keperluan. Pilih salah satu — kartunya akan
              melakukan persis itu setiap kali di-tap, tidak ada yang lain.
            </p>

            <div className="space-y-2">
              {(Object.keys(CARD_SERVICE_LABEL) as CardService[]).map(
                (service) => {
                  const dipilih = serviceChoice === service;
                  return (
                    <label
                      key={service}
                      className={`flex cursor-pointer items-start gap-2.5 rounded-2xl border-2 p-3 transition ${
                        dipilih
                          ? "border-[#232331] bg-[#f0edff]"
                          : "border-[#dedee8] bg-white hover:border-[#7958d8]"
                      }`}
                    >
                      <input
                        type="radio"
                        name="layanan-kartu"
                        value={service}
                        checked={dipilih}
                        onChange={() => setServiceChoice(service)}
                        className="mt-0.5 accent-[#7958d8]"
                      />
                      <span className="flex-1">
                        <span className="block text-xs font-extrabold text-[#232331]">
                          {CARD_SERVICE_LABEL[service]}
                        </span>
                        {CARD_SERVICE_DESTINATION[service] && (
                          <span className="mt-0.5 block text-[10.5px] leading-relaxed text-[#7b7b8e]">
                            {CARD_SERVICE_DESTINATION[service]}
                          </span>
                        )}
                        {service === serviceCard.type && (
                          <span className="mt-1 inline-block font-mono text-[9px] font-bold text-[#16a34a]">
                            LAYANAN SEKARANG
                          </span>
                        )}
                      </span>
                    </label>
                  );
                },
              )}
            </div>

            {/*
              Alamat tujuan dikosongkan, dan itu ditulis di depan sebelum
              tombolnya ditekan. Alamat lama milik layanan yang lama.
            */}
            {serviceChoice !== serviceCard.type && (
              <div className="rounded-2xl border border-[#f59e0b] bg-[#fffbeb] p-3">
                <p className="text-[11px] leading-relaxed font-bold text-[#92400e]">
                  Alamat tujuan kartu ini akan dikosongkan.
                </p>
                <p className="mt-0.5 text-[10.5px] leading-relaxed text-[#92400e]">
                  {CARD_SERVICE_DESTINATION[serviceChoice]
                    ? "Setelah pindah, isi alamat barunya lewat tombol Edit Tujuan."
                    : `Layanan ${CARD_SERVICE_LABEL[serviceChoice]} memang tidak memakai alamat tujuan.`}
                </p>
              </div>
            )}

            {serviceCard.type === "smart_touch" &&
              serviceChoice !== "smart_touch" && (
                <div className="rounded-2xl border border-[#7958d8] bg-[#f0edff] p-3">
                  <p className="text-[11px] font-bold text-[#4c2f9a]">
                    Smart Touch akan diarsipkan dulu, bukan dihapus.
                  </p>
                  <p className="mt-1 text-[10.5px] leading-relaxed text-[#5f5a78]">
                    Judul, subjudul, dan semua tombol disimpan sebagai cadangan
                    audit. Setelah itu kartu ini hanya menjalankan layanan baru
                    yang dipilih.
                  </p>
                  <button
                    type="button"
                    onClick={handleArchiveAndMoveService}
                    disabled={isSavingService}
                    className="btn-tactile mt-3 rounded-xl border-2 border-[#232331] bg-[#d9ff57] px-4 py-2 text-xs font-extrabold text-[#232331] shadow-ink-xs disabled:opacity-40"
                  >
                    {isSavingService
                      ? "Mengarsipkan..."
                      : "Arsipkan Smart Touch & Pindahkan"}
                  </button>
                </div>
              )}

            {serviceError && (
              <div className="flex items-start gap-2 rounded-2xl border border-[#ef4444] bg-[#feebee] p-3">
                <AlertCircle
                  size={14}
                  className="mt-0.5 shrink-0 text-[#ef4444]"
                />
                <p className="text-[11px] leading-relaxed font-bold text-[#ef4444]">
                  {serviceError}
                </p>
              </div>
            )}

            <div className="flex justify-end gap-2 border-t border-[#dedee8] pt-3">
              <button
                type="button"
                onClick={() => setServiceCard(null)}
                className="rounded-xl border border-[#dedee8] bg-white px-4 py-2 text-xs font-bold text-[#7b7b8e]"
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
                className="btn-tactile rounded-xl bg-[#232331] px-5 py-2 text-xs font-extrabold text-[#d9ff57] shadow-ink-xs disabled:opacity-40"
              >
                {isSavingService ? "Memindah..." : "Pakai Layanan Ini ✓"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* EDIT MODAL DIALOG */}
      {selectedCardForEdit && (
        <div className="fixed inset-0 z-50 bg-[#232331]/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="w-full max-w-lg rounded-3xl border-2 border-[#232331] bg-white p-6 sm:p-7 shadow-ink-lg space-y-5 animate-in fade-in zoom-in duration-150">
            <div className="flex items-center justify-between border-b border-[#dedee8] pb-3">
              <div className="flex items-center gap-2">
                <Edit3 size={18} className="text-[#7958d8]" />
                <h3 className="font-extrabold text-base text-[#232331]">
                  Edit Kartu{" "}
                  {formatCardCodeDisplay(selectedCardForEdit.card_code)}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setSelectedCardForEdit(null)}
                className="rounded-xl p-1 text-[#7b7b8e] hover:bg-[#f0edff] hover:text-[#232331]"
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
                <label className="block font-mono text-xs font-bold text-[#232331]">
                  Label Penempatan Meja:
                </label>
                <input
                  type="text"
                  required
                  value={editLabel}
                  onChange={(e) => setEditLabel(e.target.value)}
                  placeholder="Contoh: Meja 08, Kasir Lantai 2"
                  className="w-full rounded-xl border-2 border-[#232331] p-2.5 text-xs font-bold text-[#232331] focus:outline-none"
                />
              </div>

              {/* Kartu tautan: alamat diketik langsung, tidak ada tempat Google. */}
              {selectedCardForEdit.type === "link" ? (
                <div className="space-y-1.5">
                  <label className="block font-mono text-xs font-bold text-[#232331]">
                    Ganti alamat tujuan:
                  </label>
                  <input
                    type="url"
                    value={editCustomUrl}
                    onChange={(e) => setEditCustomUrl(e.target.value)}
                    placeholder="https://portofolio-saya.com"
                    className="w-full rounded-xl border border-[#232331] px-3 py-2.5 font-mono text-xs font-bold text-[#232331] focus:outline-none"
                  />
                  <p className="text-[11px] leading-relaxed text-[#7b7b8e]">
                    Harus diawali https. Kartunya tidak perlu ditulis ulang:
                    yang tersimpan di kartu cuma alamat pengalihan, tujuannya
                    disimpan di sini.
                  </p>
                </div>
              ) : (
                <>
                  {/* Places Search */}
                  <div className="space-y-1.5">
                    <label className="block font-mono text-xs font-bold text-[#232331]">
                      Ganti Lokasi Google Maps Usaha:
                    </label>
                    <div className="relative">
                      <Search
                        className="absolute left-3 top-3 text-[#7b7b8e]"
                        size={15}
                      />
                      <input
                        type="text"
                        value={editSearchQuery}
                        onChange={(e) => setEditSearchQuery(e.target.value)}
                        placeholder="Cari nama cafe / bisnis baru..."
                        className="w-full rounded-xl border border-[#232331] pl-9 pr-3 py-2.5 text-xs font-bold text-[#232331] focus:outline-none"
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
                            className={`cursor-pointer rounded-xl border p-2 text-xs transition-all ${
                              isPicked
                                ? "border-[#7958d8] bg-[#f0edff] font-bold text-[#7958d8]"
                                : "border-[#dedee8] bg-[#fcfcfe] hover:border-[#232331]"
                            }`}
                          >
                            <span className="font-extrabold block">
                              {p.name}
                            </span>
                            <span className="text-[10.5px] text-[#7b7b8e] line-clamp-1">
                              {p.address}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </>
              )}

              {/* Destination Preview */}
              <div className="rounded-xl border border-[#dedee8] bg-[#fcfcfe] p-3 text-[11px] font-mono space-y-1">
                <span className="text-[#7b7b8e] block">
                  URL TUJUAN AKHIR SAAT INI:
                </span>
                <p className="text-[#16a34a] font-bold break-all">
                  {selectedCardForEdit.type === "link"
                    ? editCustomUrl.trim() ||
                      selectedCardForEdit.destination_url
                    : selectedPlace
                      ? selectedPlace.directReviewUrl
                      : selectedCardForEdit.destination_url}
                </p>
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-[#dedee8]">
                <button
                  type="button"
                  onClick={() => setSelectedCardForEdit(null)}
                  className="rounded-xl border border-[#dedee8] bg-white px-4 py-2 text-xs font-bold text-[#7b7b8e]"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="btn-tactile rounded-xl bg-[#232331] px-5 py-2 text-xs font-extrabold text-[#d9ff57] shadow-ink-xs"
                >
                  {isSaving ? "Menyimpan..." : "Simpan Perubahan ✓"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Footer */}
      <footer className="border-t border-[#dedee8] bg-white py-4 text-center text-xs font-mono text-[#7b7b8e]">
        KAEL Review Engine · 302 Temporary Direct Redirect &amp; Bot-Safe Tap
        Analytics
      </footer>
    </div>
  );
}
