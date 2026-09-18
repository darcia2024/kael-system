"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Banknote,
  BarChart3,
  CheckCircle2,
  FileText,
  X,
  ChevronRight,
  CircleDollarSign,
  Clock3,
  Coffee,
  CreditCard,
  Crown,
  ExternalLink,
  Flame,
  HeartHandshake,
  LayoutDashboard,
  Lightbulb,
  Loader2,
  ReceiptText,
  RefreshCw,
  ShieldCheck,
  ShoppingBag,
  Smartphone,
  Sparkles,
  Star,
  Timer,
  TrendingDown,
  Trophy,
  Users,
  UtensilsCrossed,
  WalletCards,
  QrCode,
} from "lucide-react";

import type { Business, Order, FeedbackSummary, FeedbackRow, MemberGrowthSummary } from "@/lib/types";
import { FEEDBACK_REASONS } from "@/lib/types";
import { formatBusinessDateTime, formatRupiah } from "@/lib/formatters";
import { PAYMENT_STATUS_LABEL, serviceTypeLabel } from "@/lib/pos-engine";
import { retryOrderSyncAction, deleteFeedbackAction } from "@/lib/actions";
import ClearTestDataModal from "../clear-test-data-modal";
import { Trash2, MoreHorizontal } from "lucide-react";
import TableQrModal from "../table-qr-modal";
import { isMochiBusiness } from "@/lib/mochi-brand";
import { BusinessMark } from "@/components/business-mark";
import PwaInstallBanner from "@/components/pwa-install-banner";
import { usePasangAplikasi } from "@/components/pasang-aplikasi";

type MenuItemStat = {
  id: string;
  name: string;
  categoryName: string;
  price: number;
  isAvailable: boolean;
  todayQty: number;
  todayRevenue: number;
  weekQty: number;
  weekRevenue: number;
  monthQty: number;
  monthRevenue: number;
};

type Dashboard = {
  timezone: string;
  today: {
    paidOrders: number;
    revenue: number;
    averageOrder: number;
    payment: { cash: number; qris: number; transfer: number };
  };
  queue: { awaitingPayment: number; preparing: number; ready: number };
  activeShifts: { id: string; openedAt: string; openingCash: number; cashSales: number; staffName: string }[];
  hourlySales: { hour: number; orders: number; revenue: number }[];
  cashierSales: { name: string; orders: number; revenue: number }[];
  recentOrders: Order[];
  menuAnalytics?: {
    totalMenuItems: number;
    today: {
      bestSellers: MenuItemStat[];
      slowMovers: MenuItemStat[];
    };
    weekly: {
      bestSellers: MenuItemStat[];
      slowMovers: MenuItemStat[];
    };
    monthly: {
      bestSellers: MenuItemStat[];
      slowMovers: MenuItemStat[];
    };
  };
};

function statusStyle(order: Order, isMochi = false) {
  if (order.payment_status === "pending") {
    return isMochi
      ? "border-amber-300 bg-amber-50 text-amber-800"
      : "border-[#f59e0b] bg-[#fffbeb] text-[#a16207]";
  }
  if (order.status === "cancelled" || order.payment_status === "failed" || order.payment_status === "expired") {
    return isMochi
      ? "border-rose-300 bg-rose-50 text-rose-800"
      : "border-[#fecaca] bg-[#fff7f7] text-[#b91c1c]";
  }
  if (order.fulfillment_status === "ready") {
    return isMochi
      ? "border-emerald-300 bg-[#edf8f3] text-[#167052]"
      : "border-[#86efac] bg-[#f0fdf4] text-[#15803d]";
  }
  return isMochi
    ? "border-emerald-200 bg-[#f7fcf9] text-[#0b3d2e]"
    : "border-[#ddd9ff] bg-[#f5f3ff] text-[#6d4cc4]";
}

export default function OwnerDashboardClient({
  business,
  dashboard,
  pendingSync,
  feedbackSummary,
  recentFeedback,
  loyaltySummary,
  themeClassName = "",
}: {
  business: Business | null;
  dashboard: Dashboard;
  pendingSync: { id: string; order_no: string; sync_error: string | null }[];
  feedbackSummary: FeedbackSummary;
  recentFeedback: FeedbackRow[];
  loyaltySummary: MemberGrowthSummary;
  themeClassName?: string;
}) {
  const isMochi = isMochiBusiness(business);
  const [syncing, setSyncing] = useState(false);
  const [syncMessage, setSyncMessage] = useState("");
  const router = useRouter();
  const [refreshing, setRefreshing] = useState(false);
  const [showTableQrModal, setShowTableQrModal] = useState(false);
  const [menuPeriod, setMenuPeriod] = useState<"today" | "weekly" | "monthly">("weekly");
  const [feedbackFilter, setFeedbackFilter] = useState<"all" | "complaints" | "positive">("all");
  const [showReportsModal, setShowReportsModal] = useState(false);
  const [showClearModal, setShowClearModal] = useState(false);

  /*
   * Tiga keadaan yang cuma dipakai di layar HP. Di layar lebar semuanya tampil
   * berdampingan seperti sebelumnya; di HP, menumpuk semuanya membuat dasbor
   * ini hampir tujuh layar panjangnya.
   */
  const [menuAksiHp, setMenuAksiHp] = useState(false);
  const [tabMenuHp, setTabMenuHp] = useState<"laku" | "kurang">("laku");
  const [feedLengkapHp, setFeedLengkapHp] = useState(false);

  /*
   * Jalan kedua memasang KAEL Owner, lewat menu ⋯. Banner di atas cuma muncul
   * kalau peramban menawarkan jendela pasang atau di iPhone, dan bisa ditutup;
   * yang ini selalu ada, dan kalau jendela pasangnya tidak tersedia ia
   * membuka panduan.
   */
  const pasangAplikasi = usePasangAplikasi();

  const reasonMap = useMemo(() => {
    const map = new Map<string, string>();
    FEEDBACK_REASONS.forEach((r) => map.set(r.key, r.label));
    return map;
  }, []);

  const filteredFeedback = useMemo(() => {
    const list = recentFeedback || [];
    if (feedbackFilter === "complaints") {
      return list.filter((f) => f.rating <= 3);
    }
    if (feedbackFilter === "positive") {
      return list.filter((f) => f.rating >= 4);
    }
    return list;
  }, [recentFeedback, feedbackFilter]);
  const maxHourlyRevenue = Math.max(...dashboard.hourlySales.map((item) => item.revenue), 1);
  const totalPayment = dashboard.today.payment.cash + dashboard.today.payment.qris + dashboard.today.payment.transfer;
  const latestSync = new Intl.DateTimeFormat("id-ID", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: dashboard.timezone,
  }).format(new Date());

  const getMenuQty = (item: MenuItemStat, period: "today" | "weekly" | "monthly") => {
    if (period === "today") return item.todayQty;
    if (period === "weekly") return item.weekQty;
    return item.monthQty;
  };

  const getMenuRev = (item: MenuItemStat, period: "today" | "weekly" | "monthly") => {
    if (period === "today") return item.todayRevenue;
    if (period === "weekly") return item.weekRevenue;
    return item.monthRevenue;
  };

  const currentBestSellers = dashboard.menuAnalytics?.[menuPeriod]?.bestSellers ?? [];
  const currentSlowMovers = dashboard.menuAnalytics?.[menuPeriod]?.slowMovers ?? [];
  const maxBestSellerQty = Math.max(
    ...currentBestSellers.map((item) => getMenuQty(item, menuPeriod)),
    1
  );

  useEffect(() => {
    const timer = window.setInterval(() => router.refresh(), 60_000);
    return () => window.clearInterval(timer);
  }, [router]);

  const refresh = () => {
    setRefreshing(true);
    router.refresh();
    window.setTimeout(() => setRefreshing(false), 500);
  };

  const queueTotal = dashboard.queue.awaitingPayment + dashboard.queue.preparing + dashboard.queue.ready;
  const paymentRows = useMemo(
    () => [
      {
        label: "Tunai",
        value: dashboard.today.payment.cash,
        icon: Banknote,
        color: isMochi ? "bg-[#c8f53a] text-[#073829]" : "bg-[#d9ff57]",
        barColor: isMochi ? "bg-[#0b3d2e]" : "bg-[#232331]",
      },
      {
        label: "QRIS",
        value: dashboard.today.payment.qris,
        icon: Smartphone,
        color: isMochi ? "bg-[#edf8f3] text-[#167052]" : "bg-[#ddd9ff]",
        barColor: isMochi ? "bg-[#167052]" : "bg-[#232331]",
      },
      {
        label: "Transfer",
        value: dashboard.today.payment.transfer,
        icon: CreditCard,
        color: isMochi ? "bg-[#e0f2fe] text-[#0369a1]" : "bg-[#b9f4ea]",
        barColor: isMochi ? "bg-[#0ea5e9]" : "bg-[#232331]",
      },
    ],
    [dashboard.today.payment, isMochi]
  );

  return (
    <div
      className={`${themeClassName} mochi-shell min-h-screen ${
        isMochi ? "bg-[#f0f5f2] text-[#1a382d]" : "bg-[#f7f6fc] text-[#232331]"
      } pb-12`}
    >
      {pendingSync.length > 0 && (
        <section
          className={`mx-auto max-w-7xl mt-3 rounded-2xl border p-4 text-sm ${
            isMochi
              ? "border-amber-300 bg-amber-50/95 text-amber-900 shadow-sm"
              : "border-amber-300 bg-amber-50"
          }`}
          aria-label="Transaksi perlu diperiksa"
        >
          <p className="font-bold">{pendingSync.length} transaksi menunggu pembaruan poin atau stok</p>
          <ul className="mt-1 space-y-0.5 text-xs">
            {pendingSync.map((order) => (
              <li key={order.id}>
                #{order.order_no}: {order.sync_error || "Belum selesai diproses"}
              </li>
            ))}
          </ul>
          <button
            type="button"
            disabled={syncing}
            className="mt-2.5 inline-flex min-h-9 items-center gap-2 rounded-xl border border-current px-3 py-1 text-xs font-bold disabled:opacity-50"
            onClick={async () => {
              setSyncing(true);
              try {
                const result = await retryOrderSyncAction();
                setSyncMessage(
                  result.ok ? "Pemeriksaan selesai. Transaksi yang masih terkendala tetap ditampilkan." : result.error
                );
                router.refresh();
              } catch {
                setSyncMessage("Belum berhasil. Coba lagi sebentar.");
              } finally {
                setSyncing(false);
              }
            }}
          >
            <RefreshCw size={14} className={syncing ? "animate-spin" : ""} />
            {syncing ? "Memproses..." : "Coba proses ulang"}
          </button>
          {syncMessage && <p role="status" className="mt-1.5 text-xs font-medium">{syncMessage}</p>}
        </section>
      )}

      {/* Header */}
      <header
        className={`sticky top-0 z-30 border-b backdrop-blur-md px-3 py-2.5 sm:py-3 sm:px-6 transition-colors ${
          isMochi
            ? "border-[#07281e] bg-[#0b3d2e]/98 text-white shadow-sm"
            : "mochi-header border-b-2 border-[#232331] bg-white/95"
        }`}
      >
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-2">
          <div className="flex min-w-0 items-center gap-2.5 sm:gap-3">
            <Link
              href="/app"
              className={
                isMochi
                  ? "flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-emerald-700/50 bg-[#144f3d] text-white hover:bg-[#1b634d] transition-colors"
                  : "flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-[#232331] bg-[#fcfcfe] shadow-ink-xs"
              }
              aria-label="Kembali ke dashboard"
            >
              <ArrowLeft size={16} />
            </Link>

            {isMochi && (
              <BusinessMark
                name={business?.name}
                logoUrl={business?.logo_url}
                brandColor={business?.brand_color}
                className="h-9 w-9 shrink-0 rounded-full border border-emerald-400/40 shadow-xs"
              />
            )}

            <div className="min-w-0">
              <div className="flex items-center gap-1.5 sm:gap-2">
                <h1
                  className={`truncate text-sm font-black sm:text-base ${
                    isMochi ? "text-white" : "text-[#232331]"
                  }`}
                >
                  <span className="sm:hidden">Dashboard</span>
                  <span className="hidden sm:inline">Dashboard Owner Utama</span>
                </h1>
                <span
                  className={
                    isMochi
                      ? "hidden shrink-0 rounded-full bg-[#c8f53a] px-2 py-0.5 font-mono text-[9px] font-black text-[#073829] shadow-xs sm:inline"
                      : "hidden shrink-0 rounded-md border border-[#16a34a] bg-[#dcfce7] px-1.5 py-0.5 font-mono text-[9px] font-bold text-[#15803d] sm:inline"
                  }
                >
                  LIVE
                </span>
              </div>
              <p
                className={
                  isMochi
                    ? "truncate font-mono text-[10.5px] text-emerald-200/80"
                    : "truncate font-mono text-[10px] text-[#7b7b8e]"
                }
              >
                <span className="sm:hidden">tersinkron {latestSync}</span>
                <span className="hidden sm:inline">
                  Pusat Kendali Bisnis · {business?.name ?? "Mochi Cafe n Resto"} · tersinkron {latestSync}
                </span>
              </p>
            </div>
          </div>

          {/*
            Di bawah 1280px: satu baris saja — muat ulang, buka kasir, dan menu
            "lainnya". Grup tombol lengkap di bawahnya butuh sekitar 640px: di HP
            375px judul dasbor terhimpit sampai lebarnya nol dan tombol paling
            kanan terpotong di luar layar, di tablet 768px judulnya tinggal
            "Das…", dan di 1024px teks tombolnya terlipat jadi dua baris.
          */}
          <div className="relative flex shrink-0 items-center gap-1.5 xl:hidden">
            <button
              type="button"
              onClick={refresh}
              aria-label="Muat ulang data"
              className={
                isMochi
                  ? "flex h-9 w-9 items-center justify-center rounded-xl border border-emerald-700/50 bg-[#144f3d] text-white"
                  : "flex h-9 w-9 items-center justify-center rounded-xl border border-[#232331] bg-white"
              }
            >
              {refreshing ? <Loader2 size={15} className="animate-spin" /> : <RefreshCw size={15} />}
            </button>
            <Link
              href="/app/pos"
              aria-label="Buka kasir"
              className={
                isMochi
                  ? "flex h-9 items-center gap-1 rounded-xl bg-[#c8f53a] px-2.5 font-mono text-[11px] font-black text-[#073829]"
                  : "flex h-9 items-center gap-1 rounded-xl border-2 border-[#232331] bg-[#d9ff57] px-2.5 font-mono text-[11px] font-black"
              }
            >
              <ShoppingBag size={14} />
              <span>Kasir</span>
            </Link>
            <button
              type="button"
              onClick={() => setMenuAksiHp((v) => !v)}
              aria-label="Aksi lainnya"
              aria-expanded={menuAksiHp}
              className={
                isMochi
                  ? "flex h-9 w-9 items-center justify-center rounded-xl border border-emerald-700/50 bg-[#144f3d] text-white"
                  : "flex h-9 w-9 items-center justify-center rounded-xl border border-[#232331] bg-white"
              }
            >
              <MoreHorizontal size={17} />
            </button>

            {menuAksiHp && (
              <>
                {/* Ketuk di luar menu untuk menutupnya. */}
                <button
                  type="button"
                  aria-label="Tutup menu"
                  onClick={() => setMenuAksiHp(false)}
                  className="fixed inset-0 z-40 cursor-default"
                />
                <div className="absolute right-0 top-11 z-50 w-56 overflow-hidden rounded-2xl border border-[#d8e3de] bg-white py-1 text-[#1c2d26] shadow-xl">
                  {[
                    { label: "Pilihan laporan", icon: FileText, aksi: () => setShowReportsModal(true) },
                    { label: "Cetak QR meja", icon: QrCode, aksi: () => setShowTableQrModal(true) },
                    { label: "Kelola menu", icon: UtensilsCrossed, href: "/app/pos/menu" },
                  ].map((a) =>
                    a.href ? (
                      <Link
                        key={a.label}
                        href={a.href}
                        className="flex items-center gap-2.5 px-3.5 py-2.5 text-[13px] font-bold hover:bg-[#f4f8f6]"
                      >
                        <a.icon size={15} className="text-[#167052]" /> {a.label}
                      </Link>
                    ) : (
                      <button
                        key={a.label}
                        type="button"
                        onClick={() => {
                          setMenuAksiHp(false);
                          a.aksi?.();
                        }}
                        className="flex w-full items-center gap-2.5 px-3.5 py-2.5 text-left text-[13px] font-bold hover:bg-[#f4f8f6]"
                      >
                        <a.icon size={15} className="text-[#167052]" /> {a.label}
                      </button>
                    ),
                  )}
                  {pasangAplikasi.tampil && (
                    <button
                      type="button"
                      onClick={() => {
                        setMenuAksiHp(false);
                        pasangAplikasi.pasang();
                      }}
                      className="flex w-full items-center gap-2.5 px-3.5 py-2.5 text-left text-[13px] font-bold hover:bg-[#f4f8f6]"
                    >
                      <Smartphone size={15} className="text-[#167052]" /> Pasang di layar utama
                    </button>
                  )}
                  {/*
                    Aksi yang menghapus data ditaruh terakhir dan dipisah garis.
                    Di bilah atas tadinya dia tombol merah di tengah deretan, tepat
                    di bawah jempol.
                  */}
                  <div className="my-1 border-t border-[#eef3f0]" />
                  <button
                    type="button"
                    onClick={() => {
                      setMenuAksiHp(false);
                      setShowClearModal(true);
                    }}
                    className="flex w-full items-center gap-2.5 px-3.5 py-2.5 text-left text-[13px] font-bold text-rose-700 hover:bg-rose-50"
                  >
                    <Trash2 size={15} /> Hapus data testing
                  </button>
                </div>
              </>
            )}
          </div>

          <div className="hidden items-center gap-2 xl:flex">
            <button
              type="button"
              onClick={refresh}
              className={
                isMochi
                  ? "flex h-9 w-9 items-center justify-center rounded-xl border border-emerald-700/50 bg-[#144f3d] text-white hover:bg-[#1b634d] transition-colors"
                  : "btn-tactile flex h-9 w-9 items-center justify-center rounded-xl border border-[#232331] bg-white shadow-ink-xs"
              }
              title="Muat ulang data"
              aria-label="Muat ulang data"
            >
              {refreshing ? <Loader2 size={15} className="animate-spin" /> : <RefreshCw size={15} />}
            </button>
            <button
              type="button"
              onClick={() => setShowReportsModal(true)}
              className={
                isMochi
                  ? "inline-flex items-center gap-1.5 rounded-xl border border-emerald-600/70 bg-[#165a45] px-3 py-2 font-mono text-xs font-black text-white hover:bg-[#1a6850] shadow-sm transition-all active:scale-95"
                  : "btn-tactile inline-flex items-center gap-1.5 rounded-xl border-2 border-[#232331] bg-white px-3 py-2 font-mono text-xs font-black shadow-ink-xs hover:bg-[#f5f3ff]"
              }
              title="Buka Pilihan Laporan Lengkap"
            >
              <FileText size={14} className={isMochi ? "text-[#c8f53a]" : "text-[#7958d8]"} />
              <span>Pilihan Laporan ▾</span>
            </button>
            <button
              type="button"
              onClick={() => setShowTableQrModal(true)}
              className={
                isMochi
                  ? "inline-flex items-center gap-1.5 rounded-xl border border-emerald-700/60 bg-[#144f3d] px-3 py-2 font-mono text-xs font-bold text-[#c8f53a] hover:bg-[#1b634d] transition-colors"
                  : "btn-tactile inline-flex items-center gap-1.5 rounded-xl border-2 border-[#232331] bg-white px-3 py-2 font-mono text-xs font-black shadow-ink-xs hover:bg-[#edf8f3]"
              }
              title="Generator & Cetak QR Meja"
            >
              <QrCode size={14} />
              <span>Cetak QR Meja</span>
            </button>
            <button
              type="button"
              onClick={() => setShowClearModal(true)}
              className={
                isMochi
                  ? "inline-flex items-center gap-1.5 rounded-xl border border-rose-500/40 bg-rose-600/90 px-3 py-2 font-mono text-xs font-bold text-white hover:bg-rose-700 shadow-sm transition-all active:scale-95"
                  : "btn-tactile inline-flex items-center gap-1.5 rounded-xl border-2 border-rose-600 bg-rose-50 text-rose-700 px-3 py-2 font-mono text-xs font-bold shadow-ink-xs hover:bg-rose-100"
              }
              title="Pembersihan data transaksi & ulasan testing"
            >
              <Trash2 size={13} />
              <span>Hapus Data Testing</span>
            </button>
            <Link
              href="/app/pos/menu"
              className={
                isMochi
                  ? "inline-flex items-center gap-1.5 rounded-xl border border-emerald-600/70 bg-[#165a45] px-3 py-2 font-mono text-xs font-black text-white hover:bg-[#1a6850] shadow-sm transition-all active:scale-95"
                  : "btn-tactile inline-flex items-center gap-1.5 rounded-xl border-2 border-[#232331] bg-white px-3 py-2 font-mono text-xs font-black shadow-ink-xs hover:bg-[#f5f3ff]"
              }
              title="Pengaturan & Kelola Daftar Menu"
            >
              <UtensilsCrossed size={14} className={isMochi ? "text-[#c8f53a]" : "text-[#7958d8]"} />
              <span>Kelola Menu</span>
            </Link>
            <Link
              href="/app/pos"
              className={
                isMochi
                  ? "inline-flex items-center gap-1.5 rounded-xl bg-[#c8f53a] px-3.5 py-2 font-mono text-xs font-black text-[#073829] hover:bg-[#d9ff57] shadow-sm transition-all active:scale-95"
                  : "btn-tactile inline-flex items-center gap-1.5 rounded-xl border-2 border-[#232331] bg-[#d9ff57] px-3 py-2 font-mono text-xs font-black shadow-ink-xs"
              }
            >
              <ShoppingBag size={14} />
              <span>Buka Kasir</span>
            </Link>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="mx-auto w-full max-w-7xl space-y-3 p-3 sm:space-y-6 sm:p-6">
        {/* PWA INSTALL RECOMMENDATION BANNER */}
        <PwaInstallBanner isMochi={isMochi} />

        {/* MOBILE PROMINENT CAFE MENU SHORTCUT BANNER */}
        <div className="sm:hidden">
          <Link
            href="/app/pos/menu"
            className={`flex items-center justify-between gap-3 p-3.5 rounded-3xl border transition-all shadow-xs ${
              isMochi
                ? "bg-gradient-to-r from-[#0b3d2e] via-[#144f3d] to-[#0b3d2e] text-white border-emerald-700/60 hover:brightness-105 active:scale-98"
                : "bg-[#232331] text-white border-[#232331]"
            }`}
          >
            <div className="flex items-center gap-3 min-w-0">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[#c8f53a] text-[#073829] shadow-xs">
                <UtensilsCrossed size={20} />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="font-black text-sm text-white">Kelola Menu Kafe</span>
                  <span className="rounded-full bg-[#c8f53a]/20 text-[#c8f53a] px-2 py-0.2 font-mono text-[9px] font-black uppercase">
                    Aktif
                  </span>
                </div>
                <p className="text-[11px] text-emerald-100/80 truncate mt-0.5">
                  Tambah menu, ubah harga, upload foto &amp; atur stok
                </p>
              </div>
            </div>
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-white/10 text-white">
              <ArrowRight size={16} />
            </div>
          </Link>
        </div>

        {/* PUSAT PILIHAN LAPORAN OWNER (EXECUTIVE QUICK SWITCHER) */}
        <section
          className={
            isMochi
              ? "rounded-3xl border border-[#d8e3de] bg-white p-4 sm:p-5 shadow-[0_4px_24px_rgba(11,61,46,0.04)]"
              : "rounded-2xl border-2 border-[#232331] bg-white p-4 shadow-ink-md sm:p-5"
          }
        >
          {/* Header */}
          <div className="flex items-center justify-between gap-3 pb-3 sm:pb-4 border-b border-[#edf4f0]">
            <div className="flex items-center gap-2.5 min-w-0">
              <span
                className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-xl ${
                  isMochi ? "bg-[#c8f53a] text-[#073829] shadow-xs" : "bg-[#232331] text-white"
                }`}
              >
                <BarChart3 size={16} />
              </span>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <h2
                    className={`text-sm sm:text-base font-black tracking-tight truncate ${
                      isMochi ? "text-[#0b3d2e]" : "text-[#232331]"
                    }`}
                  >
                    Pusat Laporan &amp; Analisis
                  </h2>
                  <span
                    className={`hidden rounded-full px-2 py-0.5 font-mono text-[9px] font-extrabold sm:inline-flex ${
                      isMochi ? "bg-[#edf8f3] text-[#167052]" : "bg-[#f5f3ff] text-[#6d4cc4]"
                    }`}
                  >
                    NAVIGASI CEPAT
                  </span>
                </div>
                <p className={`text-[11px] truncate ${isMochi ? "text-[#5b7a6e]" : "text-[#7b7b8e]"}`}>
                  Pilih modul laporan untuk evaluasi performa toko
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setShowReportsModal(true)}
              className={`inline-flex shrink-0 items-center gap-1.5 rounded-xl px-3 py-2 font-mono text-xs font-bold transition-all shadow-xs active:scale-95 ${
                isMochi
                  ? "bg-[#edf8f3] text-[#0b3d2e] hover:bg-[#e0f2ea] border border-emerald-300"
                  : "bg-[#f7f6fc] text-[#232331] hover:bg-[#ecebf1] border border-[#dedee8]"
              }`}
            >
              <span>Semua Laporan</span>
              <ChevronRight size={14} className={isMochi ? "text-[#167052]" : "text-[#7b7b8e]"} />
            </button>
          </div>

          {/* Quick Switcher Cards Carousel / Grid */}
          <div className="-mx-4 sm:mx-0 mt-3.5 sm:mt-4 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden sm:grid sm:grid-cols-3 sm:gap-3 sm:overflow-visible sm:px-0 sm:pb-0 lg:grid-cols-7">
            {/* 1. Ringkasan Utama (Current) */}
            <div
              className={`w-[172px] sm:w-auto shrink-0 snap-start p-3.5 sm:p-4 rounded-2xl border transition-all flex flex-col justify-between ${
                isMochi
                  ? "border-emerald-600 bg-gradient-to-br from-[#0b3d2e] via-[#0f4635] to-[#144f3d] text-white shadow-md ring-2 ring-[#c8f53a]/20"
                  : "border-2 border-[#232331] bg-[#232331] text-white shadow-ink-xs"
              }`}
            >
              <div className="flex items-center justify-between gap-1">
                <span className="font-mono text-[10px] font-black uppercase tracking-wider text-[#c8f53a]">
                  AKTIF SAAT INI
                </span>
                <CheckCircle2 size={13} className="text-[#c8f53a] shrink-0" />
              </div>
              <div className="mt-2.5">
                <p className="font-black text-sm text-white tracking-tight leading-snug">
                  Ringkasan Hari Ini
                </p>
                <p className="text-[11px] text-emerald-200/80 truncate mt-0.5">
                  Omzet &amp; jam ramai
                </p>
              </div>
            </div>

            {/* 2. Kelola Menu Kafe */}
            <Link
              href="/app/pos/menu"
              className={`group w-[172px] sm:w-auto shrink-0 snap-start p-3.5 sm:p-4 rounded-2xl border transition-all flex flex-col justify-between shadow-xs hover:shadow-md ${
                isMochi
                  ? "border-emerald-200 bg-[#edf8f3] hover:border-emerald-400 hover:bg-[#e4f5ec]"
                  : "border border-[#dedee8] bg-[#fcfcfe] hover:border-[#232331]"
              }`}
            >
              <div className="flex items-center justify-between gap-1">
                <span className="font-mono text-[10px] font-black uppercase tracking-wider text-[#167052]">
                  PRODUK &amp; HARGA
                </span>
                <ChevronRight size={13} className="text-[#167052] group-hover:translate-x-0.5 transition-transform shrink-0" />
              </div>
              <div className="mt-2.5">
                <p className={`font-black text-sm tracking-tight leading-snug ${isMochi ? "text-[#0b3d2e]" : "text-[#232331]"}`}>
                  Kelola Menu
                </p>
                <p className={`text-[11px] truncate mt-0.5 ${isMochi ? "text-[#167052]" : "text-[#7b7b8e]"}`}>
                  Harga, stok &amp; foto
                </p>
              </div>
            </Link>

            {/* 3. Laporan Penjualan & Profit */}
            <Link
              href="/app/pos/reports"
              className={`group w-[172px] sm:w-auto shrink-0 snap-start p-3.5 sm:p-4 rounded-2xl border transition-all flex flex-col justify-between shadow-xs hover:shadow-md ${
                isMochi
                  ? "border-[#d8e3de] bg-[#fbfdfc] hover:border-emerald-400 hover:bg-[#f3faf6]"
                  : "border border-[#dedee8] bg-[#fcfcfe] hover:border-[#232331]"
              }`}
            >
              <div className="flex items-center justify-between gap-1">
                <span className="font-mono text-[10px] font-bold uppercase tracking-wider text-[#527867]">
                  HPP &amp; PROFIT
                </span>
                <ChevronRight size={13} className="text-[#7b7b8e] group-hover:translate-x-0.5 transition-transform shrink-0" />
              </div>
              <div className="mt-2.5">
                <p className={`font-black text-sm tracking-tight leading-snug ${isMochi ? "text-[#0b3d2e]" : "text-[#232331]"}`}>
                  Penjualan Kasir
                </p>
                <p className="text-[11px] text-[#7b7b8e] truncate mt-0.5">
                  Laba riil &amp; tutup shift
                </p>
              </div>
            </Link>

            {/* 4. Laporan Loyalty & Member */}
            <Link
              href="/app/loyalty/analytics"
              className={`group w-[172px] sm:w-auto shrink-0 snap-start p-3.5 sm:p-4 rounded-2xl border transition-all flex flex-col justify-between shadow-xs hover:shadow-md ${
                isMochi
                  ? "border-[#d8e3de] bg-[#fbfdfc] hover:border-emerald-400 hover:bg-[#f3faf6]"
                  : "border border-[#dedee8] bg-[#fcfcfe] hover:border-[#232331]"
              }`}
            >
              <div className="flex items-center justify-between gap-1">
                <span className="font-mono text-[10px] font-bold uppercase tracking-wider text-[#527867]">
                  RETENSI 30H
                </span>
                <ChevronRight size={13} className="text-[#7b7b8e] group-hover:translate-x-0.5 transition-transform shrink-0" />
              </div>
              <div className="mt-2.5">
                <p className={`font-black text-sm tracking-tight leading-snug ${isMochi ? "text-[#0b3d2e]" : "text-[#232331]"}`}>
                  Loyalty Member
                </p>
                <p className="text-[11px] text-[#7b7b8e] truncate mt-0.5">
                  Pertumbuhan &amp; repeat
                </p>
              </div>
            </Link>

            {/* 5. Laporan Review & Kepuasan */}
            <Link
              href="/app/review/reports"
              className={`group w-[172px] sm:w-auto shrink-0 snap-start p-3.5 sm:p-4 rounded-2xl border transition-all flex flex-col justify-between shadow-xs hover:shadow-md ${
                isMochi
                  ? "border-[#d8e3de] bg-[#fbfdfc] hover:border-emerald-400 hover:bg-[#f3faf6]"
                  : "border border-[#dedee8] bg-[#fcfcfe] hover:border-[#232331]"
              }`}
            >
              <div className="flex items-center justify-between gap-1">
                <span className="font-mono text-[10px] font-bold uppercase tracking-wider text-[#527867]">
                  SMART SHIELD
                </span>
                <ChevronRight size={13} className="text-[#7b7b8e] group-hover:translate-x-0.5 transition-transform shrink-0" />
              </div>
              <div className="mt-2.5">
                <p className={`font-black text-sm tracking-tight leading-snug ${isMochi ? "text-[#0b3d2e]" : "text-[#232331]"}`}>
                  Review Pelanggan
                </p>
                <p className="text-[11px] text-[#7b7b8e] truncate mt-0.5">
                  Rating ⭐ &amp; keluhan
                </p>
              </div>
            </Link>

            {/* 6. Laporan Keuangan */}
            <Link
              href="/app/finance/reports"
              className={`group w-[172px] sm:w-auto shrink-0 snap-start p-3.5 sm:p-4 rounded-2xl border transition-all flex flex-col justify-between shadow-xs hover:shadow-md ${
                isMochi
                  ? "border-[#d8e3de] bg-[#fbfdfc] hover:border-emerald-400 hover:bg-[#f3faf6]"
                  : "border border-[#dedee8] bg-[#fcfcfe] hover:border-[#232331]"
              }`}
            >
              <div className="flex items-center justify-between gap-1">
                <span className="font-mono text-[10px] font-bold uppercase tracking-wider text-[#527867]">
                  FINANCE
                </span>
                <ChevronRight size={13} className="text-[#7b7b8e] group-hover:translate-x-0.5 transition-transform shrink-0" />
              </div>
              <div className="mt-2.5">
                <p className={`font-black text-sm tracking-tight leading-snug ${isMochi ? "text-[#0b3d2e]" : "text-[#232331]"}`}>
                  Keuangan &amp; Kas
                </p>
                <p className="text-[11px] text-[#7b7b8e] truncate mt-0.5">
                  Laba rugi &amp; arus kas
                </p>
              </div>
            </Link>

            {/* 7. Laporan SDM / Absensi */}
            <Link
              href="/app/hr/attendance"
              className={`group w-[172px] sm:w-auto shrink-0 snap-start p-3.5 sm:p-4 rounded-2xl border transition-all flex flex-col justify-between shadow-xs hover:shadow-md ${
                isMochi
                  ? "border-[#d8e3de] bg-[#fbfdfc] hover:border-emerald-400 hover:bg-[#f3faf6]"
                  : "border border-[#dedee8] bg-[#fcfcfe] hover:border-[#232331]"
              }`}
            >
              <div className="flex items-center justify-between gap-1">
                <span className="font-mono text-[10px] font-bold uppercase tracking-wider text-[#527867]">
                  SDM &amp; SHIFT
                </span>
                <ChevronRight size={13} className="text-[#7b7b8e] group-hover:translate-x-0.5 transition-transform shrink-0" />
              </div>
              <div className="mt-2.5">
                <p className={`font-black text-sm tracking-tight leading-snug ${isMochi ? "text-[#0b3d2e]" : "text-[#232331]"}`}>
                  Absensi Staf
                </p>
                <p className="text-[11px] text-[#7b7b8e] truncate mt-0.5">
                  Kehadiran kasir &amp; tim
                </p>
              </div>
            </Link>
          </div>
        </section>

        {/* KPI Cards */}
        <section className="grid grid-cols-2 gap-2.5 lg:grid-cols-4 lg:gap-4">
          {isMochi ? (
            <>
              {/* Omzet Hari Ini - Highlight Card */}
              <div className="relative overflow-hidden rounded-2xl border border-emerald-700/60 bg-gradient-to-br from-[#0b3d2e] via-[#0e4837] to-[#07281e] p-3.5 text-white shadow-sm sm:p-5">
                <div className="flex items-start justify-between gap-2">
                  <p className="font-mono text-[9.5px] font-extrabold uppercase tracking-wider text-emerald-200/90">
                    Omzet hari ini
                  </p>
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-xl bg-[#c8f53a]/20 text-[#c8f53a]">
                    <CircleDollarSign size={16} />
                  </span>
                </div>
                <p className="mt-2.5 truncate font-mono text-lg font-black text-[#c8f53a] sm:text-2xl">
                  {formatRupiah(dashboard.today.revenue)}
                </p>
                <p className="mt-0.5 truncate text-[10.5px] text-emerald-200/80">
                  {dashboard.today.paidOrders} transaksi lunas
                </p>
              </div>

              {/* Rata-rata belanja */}
              <Kpi
                label="Rata-rata belanja"
                value={formatRupiah(dashboard.today.averageOrder)}
                hint="per transaksi lunas"
                icon={ReceiptText}
                tone="text-[#167052] bg-[#edf8f3]"
                isMochi={true}
              />

              {/* Pesanan perlu dicek */}
              <Kpi
                label="Pesanan perlu dicek"
                value={String(dashboard.queue.awaitingPayment)}
                hint="menunggu pembayaran"
                icon={Timer}
                tone={
                  dashboard.queue.awaitingPayment
                    ? "text-amber-700 bg-amber-100"
                    : "text-[#167052] bg-[#edf8f3]"
                }
                valueTone={dashboard.queue.awaitingPayment ? "text-amber-700" : undefined}
                isMochi={true}
              />

              {/* Pesanan siap */}
              <Kpi
                label="Pesanan siap"
                value={String(dashboard.queue.ready)}
                hint={`${dashboard.queue.preparing} sedang disiapkan`}
                icon={UtensilsCrossed}
                tone={
                  dashboard.queue.ready
                    ? "text-[#073829] bg-[#c8f53a]/40"
                    : "text-[#167052] bg-[#edf8f3]"
                }
                isMochi={true}
              />
            </>
          ) : (
            <>
              <Kpi
                label="Omzet hari ini"
                value={formatRupiah(dashboard.today.revenue)}
                hint={`${dashboard.today.paidOrders} transaksi lunas`}
                icon={CircleDollarSign}
                tone="text-[#6d4cc4] bg-[#f0edff]"
              />
              <Kpi
                label="Rata-rata belanja"
                value={formatRupiah(dashboard.today.averageOrder)}
                hint="per transaksi lunas"
                icon={ReceiptText}
                tone="text-[#15803d] bg-[#dcfce7]"
              />
              <Kpi
                label="Pesanan perlu dicek"
                value={String(dashboard.queue.awaitingPayment)}
                hint="menunggu pembayaran"
                icon={Timer}
                tone={
                  dashboard.queue.awaitingPayment
                    ? "text-[#a16207] bg-[#fef3c7]"
                    : "text-[#15803d] bg-[#dcfce7]"
                }
              />
              <Kpi
                label="Pesanan siap"
                value={String(dashboard.queue.ready)}
                hint={`${dashboard.queue.preparing} sedang disiapkan`}
                icon={UtensilsCrossed}
                tone={
                  dashboard.queue.ready
                    ? "text-[#15803d] bg-[#dcfce7]"
                    : "text-[#6d4cc4] bg-[#f0edff]"
                }
              />
            </>
          )}
        </section>

        {/* Irama Penjualan & Cara Bayar */}
        <section className="grid gap-3 sm:gap-4 lg:grid-cols-[1.45fr_0.9fr]">
          {/* Irama Penjualan Hari Ini */}
          <div
            className={
              isMochi
                ? "rounded-3xl border border-[#d8e3de] bg-white p-3.5 shadow-[0_4px_20px_rgba(11,61,46,0.04)] sm:p-6"
                : "border-2 border-[#232331] bg-white p-3 shadow-ink-md sm:p-5"
            }
          >
            <div
              className={`flex items-start justify-between gap-3 pb-3.5 ${
                isMochi ? "border-b border-[#e5ece8]" : "border-b border-[#dedee8]"
              }`}
            >
              <div>
                <h2
                  className={`text-sm font-black sm:text-base ${
                    isMochi ? "text-[#0b3d2e]" : "text-[#232331]"
                  }`}
                >
                  Irama penjualan hari ini
                </h2>
                <p className={`mt-0.5 hidden text-[11px] sm:block ${isMochi ? "text-[#637970]" : "text-[#7b7b8e]"}`}>
                  Jam ramai terlihat dari transaksi kasir yang sudah lunas.
                </p>
              </div>
              <span
                className={`shrink-0 rounded-lg px-2.5 py-1 font-mono text-[10px] font-bold ${
                  isMochi
                    ? "border border-emerald-200/80 bg-[#edf8f3] text-[#167052]"
                    : "bg-[#f0edff] text-[#6d4cc4]"
                }`}
              >
                WIB
              </span>
            </div>

            {dashboard.hourlySales.length ? (
              <div className="mt-3 flex h-32 items-end gap-1 sm:mt-5 sm:h-52 sm:gap-2">
                {dashboard.hourlySales.map((slot) => (
                  <div key={slot.hour} className="flex min-w-0 flex-1 flex-col items-center gap-1.5">
                    <div className="group relative flex w-full flex-1 items-end">
                      <div
                        className={`w-full min-h-[5px] transition-all ${
                          isMochi
                            ? "rounded-t-md bg-gradient-to-t from-[#0b3d2e] via-[#167052] to-[#c8f53a] group-hover:brightness-110 shadow-xs"
                            : "bg-[#7958d8] group-hover:opacity-75"
                        }`}
                        style={{
                          height: `${Math.max(5, (slot.revenue / maxHourlyRevenue) * 100)}%`,
                        }}
                        title={`${slot.hour}:00 · ${formatRupiah(slot.revenue)}`}
                      />
                    </div>
                    <span
                      className={`font-mono text-[9.5px] ${
                        isMochi ? "text-[#74877e]" : "text-[#7b7b8e]"
                      }`}
                    >
                      {String(slot.hour).padStart(2, "0")}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <Empty text="Belum ada transaksi lunas hari ini." />
            )}
          </div>

          {/* Cara Pelanggan Bayar */}
          <div
            className={
              isMochi
                ? "rounded-3xl border border-[#d8e3de] bg-white p-3.5 shadow-[0_4px_20px_rgba(11,61,46,0.04)] sm:p-6"
                : "border-2 border-[#232331] bg-white p-3 shadow-ink-md sm:p-5"
            }
          >
            <div
              className={`pb-3.5 ${
                isMochi ? "border-b border-[#e5ece8]" : "border-b border-[#dedee8]"
              }`}
            >
              <h2
                className={`text-sm font-black sm:text-base ${
                  isMochi ? "text-[#0b3d2e]" : "text-[#232331]"
                }`}
              >
                Cara pelanggan bayar
              </h2>
              <p className={`mt-0.5 hidden text-[11px] sm:block ${isMochi ? "text-[#637970]" : "text-[#7b7b8e]"}`}>
                Masuk otomatis dari transaksi POS.
              </p>
            </div>
            <div className="mt-2.5 space-y-2.5 sm:mt-3.5 sm:space-y-3.5">
              {paymentRows.map(({ label, value, icon: Icon, color, barColor }) => (
                <div key={label}>
                  <div className="flex items-center justify-between gap-2 text-xs">
                    <span className="flex items-center gap-2 font-bold">
                      <span className={`flex h-7 w-7 items-center justify-center rounded-xl ${color}`}>
                        <Icon size={14} />
                      </span>
                      <span className={isMochi ? "text-[#1a382d]" : "text-[#232331]"}>{label}</span>
                    </span>
                    <span className={`font-mono font-black ${isMochi ? "text-[#0b3d2e]" : ""}`}>
                      {formatRupiah(value)}
                    </span>
                  </div>
                  <div
                    className={`mt-1.5 h-2 overflow-hidden ${
                      isMochi ? "rounded-full bg-[#edf4f0]" : "bg-[#ecebf1]"
                    }`}
                  >
                    <div
                      className={`h-full transition-all ${
                        isMochi ? `${barColor} rounded-full` : "bg-[#232331]"
                      }`}
                      style={{
                        width: `${totalPayment ? Math.round((value / totalPayment) * 100) : 0}%`,
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Analisis Menu Kasir: Paling Laku & Kurang Laku */}
        <section
          className={
            isMochi
              ? "rounded-3xl border border-[#d8e3de] bg-white p-3.5 shadow-[0_4px_20px_rgba(11,61,46,0.04)] sm:p-6"
              : "border-2 border-[#232331] bg-white p-3 shadow-ink-md sm:p-5"
          }
        >
          <div
            className={`flex flex-col gap-2.5 pb-3 sm:gap-3 sm:pb-4 sm:flex-row sm:items-center sm:justify-between ${
              isMochi ? "border-b border-[#e5ece8]" : "border-b border-[#dedee8]"
            }`}
          >
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <span
                  className={`flex h-7 w-7 items-center justify-center rounded-xl ${
                    isMochi ? "bg-[#edf8f3] text-[#167052]" : "bg-[#f0edff] text-[#6d4cc4]"
                  }`}
                >
                  <Trophy size={16} />
                </span>
                <h2
                  className={`text-sm font-black sm:text-base ${
                    isMochi ? "text-[#0b3d2e]" : "text-[#232331]"
                  }`}
                >
                  <span className="sm:hidden">Performa menu</span>
                  <span className="hidden sm:inline">Analisis Performa Menu Kasir</span>
                </h2>
                <span
                  className={`rounded-full px-2.5 py-0.5 font-mono text-[10px] font-bold ${
                    isMochi
                      ? "border border-emerald-200 bg-[#edf8f3] text-[#167052]"
                      : "border border-[#ddd9ff] bg-[#f5f3ff] text-[#6d4cc4]"
                  }`}
                >
                  {dashboard.menuAnalytics?.totalMenuItems ?? 0} Menu
                </span>
                <Link
                  href="/app/pos/menu"
                  className={`inline-flex items-center gap-1 rounded-lg px-2 py-0.5 text-[10px] font-black transition-all ${
                    isMochi
                      ? "bg-[#0b3d2e] text-[#c8f53a] hover:bg-[#155944]"
                      : "bg-[#232331] text-white hover:bg-[#39394d]"
                  }`}
                  title="Buka Pengaturan Menu"
                >
                  <UtensilsCrossed size={11} />
                  <span className="sm:hidden">Kelola</span>
                  <span className="hidden sm:inline">+ Kelola / Tambah Menu</span>
                </Link>
              </div>
              <p className={`mt-1 hidden text-xs sm:block ${isMochi ? "text-[#637970]" : "text-[#7b7b8e]"}`}>
                Perbandingan menu paling laku (Best Seller) dan menu kurang laku (Slow Moving) dari transaksi kasir lunas.
              </p>
            </div>

            {/* Timeframe Switcher */}
            <div
              className={`flex w-full rounded-xl p-1 sm:inline-flex sm:w-auto sm:self-auto ${
                isMochi
                  ? "border border-[#d8e3de] bg-[#edf4f0]"
                  : "border-2 border-[#232331] bg-[#ecebf1]"
              }`}
            >
              <button
                type="button"
                onClick={() => setMenuPeriod("today")}
                className={`flex-1 rounded-lg px-2 py-1.5 text-xs font-bold transition-all sm:flex-none sm:px-3 ${
                  menuPeriod === "today"
                    ? isMochi
                      ? "bg-[#0b3d2e] text-[#c8f53a] shadow-xs"
                      : "bg-white text-[#232331] shadow-ink-xs"
                    : isMochi
                    ? "text-[#637970] hover:text-[#0b3d2e]"
                    : "text-[#7b7b8e] hover:text-[#232331]"
                }`}
              >
                Hari Ini
              </button>
              <button
                type="button"
                onClick={() => setMenuPeriod("weekly")}
                className={`flex-1 rounded-lg px-2 py-1.5 text-xs font-bold transition-all sm:flex-none sm:px-3 ${
                  menuPeriod === "weekly"
                    ? isMochi
                      ? "bg-[#0b3d2e] text-[#c8f53a] shadow-xs"
                      : "bg-white text-[#232331] shadow-ink-xs"
                    : isMochi
                    ? "text-[#637970] hover:text-[#0b3d2e]"
                    : "text-[#7b7b8e] hover:text-[#232331]"
                }`}
              >
                <span className="sm:hidden">7 hari</span>
                <span className="hidden sm:inline">7 Hari (Mingguan)</span>
              </button>
              <button
                type="button"
                onClick={() => setMenuPeriod("monthly")}
                className={`flex-1 rounded-lg px-2 py-1.5 text-xs font-bold transition-all sm:flex-none sm:px-3 ${
                  menuPeriod === "monthly"
                    ? isMochi
                      ? "bg-[#0b3d2e] text-[#c8f53a] shadow-xs"
                      : "bg-white text-[#232331] shadow-ink-xs"
                    : isMochi
                    ? "text-[#637970] hover:text-[#0b3d2e]"
                    : "text-[#7b7b8e] hover:text-[#232331]"
                }`}
              >
                <span className="sm:hidden">30 hari</span>
                <span className="hidden sm:inline">30 Hari (Bulanan)</span>
              </button>
            </div>
          </div>

          {/*
            Di bawah lebar lg kedua daftar ditumpuk, dan masing-masing bisa
            delapan baris — enam belas baris sebelum pembaca sampai ke review.
            Dijadikan tab: yang dilihat satu per satu, isinya tetap sama.
          */}
          <div
            className={`mt-3 flex rounded-xl p-1 lg:hidden ${
              isMochi ? "bg-[#edf4f0]" : "border border-[#dedee8] bg-[#f7f6fc]"
            }`}
          >
            {([
              { k: "laku", label: `🏆 Paling laku (${currentBestSellers.length})` },
              { k: "kurang", label: `🐢 Kurang laku (${currentSlowMovers.length})` },
            ] as const).map((t) => (
              <button
                key={t.k}
                type="button"
                onClick={() => setTabMenuHp(t.k)}
                className={`flex-1 rounded-lg py-1.5 text-[11px] font-black transition-colors ${
                  tabMenuHp === t.k
                    ? isMochi
                      ? "bg-white text-[#0b3d2e] shadow-xs"
                      : "bg-white text-[#232331] shadow-ink-xs"
                    : isMochi
                      ? "text-[#52665e]"
                      : "text-[#5c5c70]"
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>

          <div className="mt-3 grid gap-4 lg:mt-5 lg:grid-cols-2">
            {/* Kolom Menu Paling Laku */}
            <div
              className={`${tabMenuHp === "laku" ? "" : "hidden"} rounded-2xl p-3 sm:p-5 lg:block ${
                isMochi
                  ? "border border-emerald-200/90 bg-[#f7fcf9]"
                  : "border border-[#bbf7d0] bg-[#f0fdf4]/60"
              }`}
            >
              <div
                className={`flex items-center justify-between pb-3 ${
                  isMochi ? "border-b border-emerald-200/80" : "border-b border-[#bbf7d0]"
                }`}
              >
                <div className="flex items-center gap-2">
                  <span
                    className={`flex h-6 w-6 items-center justify-center rounded-lg ${
                      isMochi ? "bg-[#c8f53a] text-[#073829]" : "bg-[#dcfce7] text-[#15803d]"
                    }`}
                  >
                    <Flame size={14} />
                  </span>
                  <div>
                    <h3
                      className={`text-xs font-black sm:text-sm ${
                        isMochi ? "text-[#0b3d2e]" : "text-[#15803d]"
                      }`}
                    >
                      🏆 Menu Paling Laku
                    </h3>
                    <p className={`text-[10px] ${isMochi ? "text-[#167052]" : "text-[#166534]"}`}>
                      {menuPeriod === "today"
                        ? "Produk terfavorit hari ini"
                        : menuPeriod === "weekly"
                        ? "Produk terfavorit 7 hari terakhir (Mingguan)"
                        : "Produk terfavorit 30 hari terakhir (Bulanan)"}
                    </p>
                  </div>
                </div>
                <span
                  className={`font-mono text-[10px] font-bold ${
                    isMochi ? "text-[#167052]" : "text-[#166534]"
                  }`}
                >
                  Top {currentBestSellers.length}
                </span>
              </div>

              <div
                className={`mt-2 divide-y ${
                  isMochi ? "divide-[#e2ebe6]" : "divide-[#dcfce7]"
                }`}
              >
                {currentBestSellers.length > 0 ? (
                  currentBestSellers.map((item, index) => {
                    const qty = getMenuQty(item, menuPeriod);
                    const rev = getMenuRev(item, menuPeriod);
                    const pct = Math.max(8, Math.round((qty / maxBestSellerQty) * 100));

                    const rankBadge =
                      index === 0
                        ? isMochi
                          ? "bg-[#c8f53a] text-[#073829] border-[#a8de1a] shadow-xs"
                          : "bg-[#fef08a] text-[#854d0e] border-[#facc15]"
                        : index === 1
                        ? "bg-[#e2e8f0] text-[#334155] border-[#cbd5e1]"
                        : index === 2
                        ? "bg-[#fed7aa] text-[#9a3412] border-[#fdba74]"
                        : "bg-white text-[#64748b] border-[#e2e8f0]";

                    return (
                      <div key={item.id} className="py-2.5 first:pt-2 last:pb-1">
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex min-w-0 items-center gap-2">
                            <span
                              className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-md border text-[10px] font-black ${rankBadge}`}
                            >
                              {index + 1}
                            </span>
                            <div className="min-w-0">
                              <p
                                className={`truncate text-xs font-black ${
                                  isMochi ? "text-[#0b3d2e]" : "text-[#232331]"
                                }`}
                              >
                                {item.name}
                              </p>
                              <p
                                className={`truncate font-mono text-[10px] ${
                                  isMochi ? "text-[#637970]" : "text-[#7b7b8e]"
                                }`}
                              >
                                {item.categoryName} · {formatRupiah(item.price)}
                              </p>
                            </div>
                          </div>
                          <div className="text-right shrink-0">
                            <p
                              className={`font-mono text-xs font-black ${
                                isMochi ? "text-[#167052]" : "text-[#15803d]"
                              }`}
                            >
                              {qty}{" "}
                              <span
                                className={`text-[10px] font-normal ${
                                  isMochi ? "text-[#167052]/80" : "text-[#166534]"
                                }`}
                              >
                                terjual
                              </span>
                            </p>
                            <p
                              className={`font-mono text-[10px] ${
                                isMochi ? "text-[#637970]" : "text-[#7b7b8e]"
                              }`}
                            >
                              {formatRupiah(rev)}
                            </p>
                          </div>
                        </div>
                        <div
                          className={`mt-1.5 h-1.5 w-full overflow-hidden ${
                            isMochi ? "rounded-full bg-emerald-100" : "bg-[#dcfce7]"
                          }`}
                        >
                          <div
                            className={`h-full transition-all ${
                              isMochi ? "rounded-full bg-[#167052]" : "bg-[#16a34a]"
                            }`}
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <div className="py-8 text-center">
                    <p
                      className={`font-mono text-xs ${
                        isMochi ? "text-[#637970]" : "text-[#7b7b8e]"
                      }`}
                    >
                      Belum ada transaksi menu lunas pada periode ini.
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* Kolom Menu Kurang Laku */}
            <div
              className={`${tabMenuHp === "kurang" ? "" : "hidden"} rounded-2xl p-3 sm:p-5 lg:block ${
                isMochi
                  ? "border border-amber-200/90 bg-[#fffdfa]"
                  : "border border-[#fed7aa] bg-[#fffaf5]"
              }`}
            >
              <div
                className={`flex items-center justify-between pb-3 ${
                  isMochi ? "border-b border-amber-200/80" : "border-b border-[#fed7aa]"
                }`}
              >
                <div className="flex items-center gap-2">
                  <span
                    className={`flex h-6 w-6 items-center justify-center rounded-lg ${
                      isMochi ? "bg-amber-100 text-amber-700" : "bg-[#ffedd5] text-[#c2410c]"
                    }`}
                  >
                    <TrendingDown size={14} />
                  </span>
                  <div>
                    <div className="flex items-center gap-1.5 sm:gap-2">
                      <h3
                        className={`text-xs font-black sm:text-sm ${
                          isMochi ? "text-[#b45309]" : "text-[#c2410c]"
                        }`}
                      >
                        ⚠️ Menu Kurang Laku
                      </h3>
                      <span className="rounded-full bg-amber-100/90 border border-amber-300 text-amber-800 font-mono text-[9px] font-black px-2 py-0.2">
                        {menuPeriod === "monthly" ? "Evaluasi 30 Hari" : "Evaluasi Mingguan (7 Hari)"}
                      </span>
                    </div>
                    <p className={`text-[10px] ${isMochi ? "text-[#9a3412]" : "text-[#9a3412]"}`}>
                      {menuPeriod === "monthly"
                        ? "Berdasarkan penjualan 30 hari terakhir · Evaluasi harga, promo, atau bundling"
                        : "Berdasarkan penjualan 7 hari terakhir · Evaluasi mingguan untuk bundling & promo"}
                    </p>
                  </div>
                </div>
                <span className="font-mono text-[10px] font-bold text-[#9a3412]">
                  {currentSlowMovers.length} Menu
                </span>
              </div>

              <div
                className={`mt-2 divide-y ${
                  isMochi ? "divide-amber-100" : "divide-[#ffedd5]"
                }`}
              >
                {currentSlowMovers.length > 0 ? (
                  currentSlowMovers.map((item) => {
                    const qty = menuPeriod === "monthly" ? item.monthQty : item.weekQty;
                    const isZero = qty === 0;

                    return (
                      <div key={item.id} className="py-2.5 first:pt-2 last:pb-1">
                        <div className="flex items-center justify-between gap-2">
                          <div className="min-w-0">
                            <p
                              className={`truncate text-xs font-black ${
                                isMochi ? "text-[#2a241f]" : "text-[#232331]"
                              }`}
                            >
                              {item.name}
                            </p>
                            <p
                              className={`truncate font-mono text-[10px] ${
                                isMochi ? "text-[#8c7e75]" : "text-[#7b7b8e]"
                              }`}
                            >
                              {item.categoryName} · {formatRupiah(item.price)}
                            </p>
                          </div>
                          <div className="text-right shrink-0">
                            <span
                              className={`inline-block rounded-lg border px-2 py-0.5 font-mono text-[10px] font-black ${
                                isZero
                                  ? "border-rose-300 bg-rose-50 text-rose-700"
                                  : "border-amber-200 bg-amber-50 text-amber-800"
                              }`}
                            >
                              {qty} terjual {menuPeriod === "monthly" ? "(30 hr)" : "(7 hr)"}
                            </span>
                          </div>
                        </div>
                        <div className="mt-1 flex items-center gap-1 text-[9.5px]">
                          <span className="inline-flex items-center rounded-md bg-amber-100/60 px-2 py-0.5 font-medium text-amber-900">
                            {isZero
                              ? "💡 Belum dipesan 7 hari terakhir: Coba bundling dengan menu best seller atau promo meja"
                              : `📉 Gerak lambat mingguan (${qty} terjual): Pertimbangkan promo jam sepi atau cek margin harga`}
                          </span>
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <div className="py-8 text-center">
                    <p
                      className={`font-mono text-xs ${
                        isMochi ? "text-[#637970]" : "text-[#7b7b8e]"
                      }`}
                    >
                      Semua menu aktif berjalan dengan baik dalam evaluasi ini.
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Strategic Insight Box */}
          <div
            className={`mt-4 hidden items-start gap-3 rounded-2xl p-4 sm:flex ${
              isMochi
                ? "border border-dashed border-emerald-300 bg-[#edf8f3]"
                : "border border-dashed border-[#ddd9ff] bg-[#fbfaff]"
            }`}
          >
            <span
              className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-xl ${
                isMochi ? "bg-[#c8f53a] text-[#073829]" : "bg-[#ddd9ff] text-[#6d4cc4]"
              }`}
            >
              <Lightbulb size={15} />
            </span>
            <div className={`text-xs ${isMochi ? "text-[#164e3b]" : "text-[#4b4b63]"}`}>
              <p
                className={`font-black ${
                  isMochi ? "text-[#0b3d2e]" : "text-[#232331]"
                }`}
              >
                Tips Pengelolaan Menu untuk Owner:
              </p>
              <p className="mt-0.5 text-[11px] leading-relaxed">
                Manfaatkan menu <strong>Paling Laku</strong> sebagai daya tarik utama (traffic puller) dan gandengkan dengan menu <strong>Kurang Laku</strong> dalam paket promo bundling atau rekomendasi kasir (upselling). Bila menu tetap 0 penjualan selama 30 hari berturut-turut, pertimbangkan untuk menonaktifkan atau memperbarui resep.
              </p>
            </div>
          </div>
        </section>

        {/* Laporan Review & Kepuasan Pelanggan (Smart Review Routing) */}
        <section id="laporan-review"
          className={
            isMochi
              ? "rounded-3xl border border-[#d8e3de] bg-white p-3.5 shadow-[0_4px_20px_rgba(11,61,46,0.04)] sm:p-6"
              : "border-2 border-[#232331] bg-white p-3 shadow-ink-md sm:p-5"
          }
        >
          <div
            className={`flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 sm:gap-3 sm:pb-4 ${
              isMochi ? "border-b border-[#e5ece8]" : "border-b border-[#dedee8]"
            }`}
          >
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h2
                  className={`text-sm font-black sm:text-base ${
                    isMochi ? "text-[#0b3d2e]" : "text-[#232331]"
                  }`}
                >
                  <span className="sm:hidden">Review pelanggan</span>
                  <span className="hidden sm:inline">Laporan Review &amp; Kepuasan Pelanggan</span>
                </h2>
                <span
                  className={`hidden items-center gap-1 rounded-full px-2.5 py-0.5 font-mono text-[9px] font-black sm:inline-flex ${
                    isMochi
                      ? "bg-[#c8f53a] text-[#073829]"
                      : "bg-[#dcfce7] text-[#15803d]"
                  }`}
                >
                  <ShieldCheck size={12} /> SMART ROUTING AKTIF
                </span>
              </div>
              <p className={`mt-1 hidden text-[11px] leading-relaxed max-w-2xl sm:block ${isMochi ? "text-[#637970]" : "text-[#7b7b8e]"}`}>
                ⭐ <strong>Bintang 4–5:</strong> Otomatis dialihkan ke Google Review untuk mendongkrak reputasi publik toko.{" "}
                🔒 <strong>Bintang 1–3:</strong> Disaring privat ke dashboard ini agar komplain pelanggan cepat tertangani tanpa merusak rating publik.
              </p>
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              <Link
                href="/app/review/reports"
                className={`inline-flex items-center gap-1 font-mono text-[10px] font-bold ${
                  isMochi ? "text-[#167052] hover:text-[#0b3d2e]" : "text-[#6d4cc4]"
                }`}
              >
                <span className="sm:hidden">Lihat halaman review</span>
                <span className="hidden sm:inline">Buka Halaman Khusus &amp; Filter</span>
                <ChevronRight size={13} />
              </Link>
            </div>
          </div>

          {/* Review KPI Cards */}
          {/*
            Tiga kolom juga di HP. Sebelumnya ditumpuk satu kolom, jadi tiga
            angka pendek menghabiskan tinggi hampir satu layar. Di HP labelnya
            dipendekkan dan kalimat keterangannya disembunyikan; angkanya sama.
          */}
          <div className="mt-3 grid grid-cols-3 gap-2 sm:mt-4 sm:gap-2.5">
            {/* Card 1: Rata-rata Rating */}
            <div
              className={`p-2.5 sm:p-4 ${
                isMochi
                  ? "rounded-2xl border border-[#e0ebe5] bg-[#fbfdfc]"
                  : "border border-[#dedee8] bg-[#fcfcfe]"
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="font-mono text-[10px] font-bold uppercase tracking-wider text-[#7b7b8e]">
                  <span className="sm:hidden">Skor</span>
                  <span className="hidden sm:inline">Skor Kepuasan</span>
                </span>
                <span className="hidden items-center gap-1 text-amber-500 sm:flex">
                  <Star size={14} className="fill-amber-400 text-amber-400" />
                </span>
              </div>
              <div className="mt-1 flex flex-wrap items-baseline gap-x-1 sm:mt-2 sm:gap-2">
                <span
                  className={`font-mono text-xl font-black sm:text-2xl ${
                    isMochi ? "text-[#0b3d2e]" : "text-[#232331]"
                  }`}
                >
                  {feedbackSummary?.avgRating > 0 ? feedbackSummary.avgRating.toFixed(1) : "5.0"}
                </span>
                <span className="font-mono text-xs text-[#7b7b8e]">/ 5.0</span>
              </div>
              <p className="mt-1 hidden text-[10.5px] text-[#637970] sm:block">
                Total <strong>{feedbackSummary?.total ?? 0}</strong> penilaian masuk
              </p>
            </div>

            {/* Card 2: Ulasan Positif Bintang 4-5 (Direct Google) */}
            <div
              className={`p-2.5 sm:p-4 ${
                isMochi
                  ? "rounded-2xl border border-emerald-200 bg-[#edf8f3]"
                  : "border border-[#86efac] bg-[#f0fdf4]"
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="font-mono text-[10px] font-bold uppercase tracking-wider text-emerald-800">
                  <span className="sm:hidden">⭐ 4–5</span>
                  <span className="hidden sm:inline">Direct ke Google Review (⭐ 4–5)</span>
                </span>
                <Sparkles size={15} className="hidden text-emerald-600 sm:block" />
              </div>
              <div className="mt-1 flex flex-wrap items-baseline gap-x-1 sm:mt-2 sm:gap-2">
                <span className="font-mono text-xl font-black sm:text-2xl text-emerald-900">
                  {Math.max(0, (feedbackSummary?.total ?? 0) - (feedbackSummary?.lowCount ?? 0))}
                </span>
                <span className="font-mono text-xs text-emerald-700">ulasan</span>
              </div>
              <p className="mt-1 hidden text-[10.5px] text-emerald-800 font-medium sm:block">
                ✓ Otomatis dialihkan ke Google Review
              </p>
            </div>

            {/* Card 3: Keluhan Privat Bintang 1-3 (Dilindungi di Dashboard) */}
            <div
              className={`p-2.5 sm:p-4 ${
                (feedbackSummary?.lowCount ?? 0) > 0
                  ? isMochi
                    ? "rounded-2xl border border-amber-300 bg-amber-50/90"
                    : "border border-amber-300 bg-amber-50"
                  : isMochi
                  ? "rounded-2xl border border-[#e0ebe5] bg-[#fbfdfc]"
                  : "border border-[#dedee8] bg-[#fcfcfe]"
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="font-mono text-[10px] font-bold uppercase tracking-wider text-amber-900">
                  <span className="sm:hidden">⭐ 1–3</span>
                  <span className="hidden sm:inline">Masukan Privat (⭐ 1–3)</span>
                </span>
                <ShieldCheck size={15} className="hidden text-amber-600 sm:block" />
              </div>
              <div className="mt-1 flex flex-wrap items-baseline gap-x-1 sm:mt-2 sm:gap-2">
                <span
                  className={`font-mono text-xl font-black sm:text-2xl ${
                    (feedbackSummary?.lowCount ?? 0) > 0 ? "text-amber-900" : isMochi ? "text-[#0b3d2e]" : "text-[#232331]"
                  }`}
                >
                  {feedbackSummary?.lowCount ?? 0}
                </span>
                <span className="font-mono text-xs text-amber-700">keluhan</span>
              </div>
              <p className="mt-1 hidden text-[10.5px] text-amber-800 font-medium sm:block">
                🔒 Terlindungi di dashboard (tidak bocor ke Google)
              </p>
            </div>
          </div>

          {/* Breakdown Alasan Keluhan */}
          {feedbackSummary?.byReason && feedbackSummary.byReason.length > 0 && (
            <div className="mt-4 pt-3 border-t border-dashed border-[#dedee8]">
              <p className="font-mono text-[10px] font-bold uppercase tracking-wider text-[#7b7b8e]">
                Topik yang Sering Dikeluhkan Pelanggan:
              </p>
              <div className="mt-2 flex flex-wrap gap-2">
                {feedbackSummary.byReason.map((r) => (
                  <span
                    key={r.reason_code}
                    className="inline-flex items-center gap-1.5 rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-xs font-bold text-amber-900"
                  >
                    <span>{reasonMap.get(r.reason_code) || r.reason_code}</span>
                    <span className="rounded-full bg-amber-200 px-1.5 py-0.2 font-mono text-[10px]">
                      {r.count}x
                    </span>
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Feed Feedback Terbaru */}
          <div className="mt-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3">
              <p
                className={`font-mono text-xs font-bold uppercase tracking-wider ${
                  isMochi ? "text-[#0b3d2e]" : "text-[#232331]"
                }`}
              >
                Daftar Masukan &amp; Keluhan Terbaru
              </p>
              <div className="flex items-center gap-1 flex-wrap">
                <button
                  type="button"
                  onClick={() => setFeedbackFilter("all")}
                  className={`px-2.5 py-1 text-[10px] font-mono font-bold rounded-lg transition-colors ${
                    feedbackFilter === "all"
                      ? isMochi
                        ? "bg-[#0b3d2e] text-white"
                        : "bg-[#232331] text-white"
                      : "bg-[#f0f3f1] text-[#637970] hover:bg-[#e2e8e4]"
                  }`}
                >
                  Semua ({recentFeedback?.length ?? 0})
                </button>
                <button
                  type="button"
                  onClick={() => setFeedbackFilter("complaints")}
                  className={`px-2.5 py-1 text-[10px] font-mono font-bold rounded-lg transition-colors ${
                    feedbackFilter === "complaints"
                      ? "bg-amber-600 text-white"
                      : "bg-amber-50 text-amber-800 hover:bg-amber-100"
                  }`}
                >
                  Keluhan Bintang 1–3 ({feedbackSummary?.lowCount ?? 0})
                </button>
                <button
                  type="button"
                  onClick={() => setFeedbackFilter("positive")}
                  className={`px-2.5 py-1 text-[10px] font-mono font-bold rounded-lg transition-colors ${
                    feedbackFilter === "positive"
                      ? "bg-emerald-700 text-white"
                      : "bg-emerald-50 text-emerald-800 hover:bg-emerald-100"
                  }`}
                >
                  Bintang 4–5 ({Math.max(0, (feedbackSummary?.total ?? 0) - (feedbackSummary?.lowCount ?? 0))})
                </button>
              </div>
            </div>

            {filteredFeedback.length > 0 ? (
              <div className="space-y-2.5 sm:max-h-[420px] sm:overflow-y-auto sm:pr-1">
                {/*
                  Area gulir bersarang cuma di layar lebar. Di HP, kotak setinggi
                  420px yang menggulir sendiri di dalam halaman yang juga
                  menggulir membuat jempol "terjebak": geser di sini menggulir
                  daftarnya, bukan halamannya. Sebagai gantinya tiga teratas
                  tampil dulu, sisanya di balik tombol.
                */}
                {filteredFeedback.map((item, idx) => {
                  const isLow = item.rating <= 3;
                  return (
                    <div
                      key={item.id}
                      className={`${idx >= 3 && !feedLengkapHp ? "hidden sm:block" : ""} p-3 sm:p-4 rounded-2xl border transition-colors ${
                        isLow
                          ? isMochi
                            ? "border-amber-200/90 bg-[#fffdf9]"
                            : "border-amber-200 bg-[#fffcf7]"
                          : isMochi
                          ? "border-[#e0ebe5] bg-[#fbfdfc]"
                          : "border-[#dedee8] bg-[#fcfcfe]"
                      }`}
                    >
                      <div className="flex flex-row items-start justify-between gap-2 sm:items-center">
                        <div className="flex items-center gap-2 flex-wrap">
                                                  <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={async () => {
                              if (!window.confirm(`Hapus feedback dari ${item.customer_name || "Pelanggan"} (data testing)?`)) return;
                              const res = await deleteFeedbackAction(item.id);
                              if (!res.ok) alert(res.error);
                              else refresh();
                            }}
                            className="text-rose-500 hover:text-rose-700 p-1 rounded-lg hover:bg-rose-50 transition-colors"
                            title="Hapus feedback testing ini"
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                          {/* Stars */}
                          <div className="flex items-center gap-0.5">
                            {[1, 2, 3, 4, 5].map((s) => (
                              <Star
                                key={s}
                                size={14}
                                className={
                                  s <= item.rating
                                    ? isLow
                                      ? "fill-amber-400 text-amber-400"
                                      : "fill-emerald-500 text-emerald-500"
                                    : "text-[#dedee8]"
                                }
                              />
                            ))}
                          </div>
                          <span className="font-mono text-xs font-bold text-[#232331]">
                            {item.rating}/5
                          </span>

                          {/* Routing Badge */}
                          {isLow ? (
                            <span className="inline-flex items-center gap-1 rounded-full border border-amber-300 bg-amber-100 px-2 py-0.5 font-mono text-[9px] font-bold text-amber-900">
                              <ShieldCheck size={11} />
                              <span className="sm:hidden">Privat</span>
                              <span className="hidden sm:inline">Keluhan Privat (Hanya Owner)</span>
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 rounded-full border border-emerald-300 bg-emerald-100 px-2 py-0.5 font-mono text-[9px] font-bold text-emerald-900">
                              <ExternalLink size={11} />
                              <span className="sm:hidden">Google</span>
                              <span className="hidden sm:inline">Auto Direct Google Review</span>
                            </span>
                          )}

                          {item.reason_code && (
                            <span className="rounded-full bg-rose-50 border border-rose-200 px-2 py-0.5 text-[9px] font-bold text-rose-800">
                              Isu: {reasonMap.get(item.reason_code) || item.reason_code}
                            </span>
                          )}
                        </div>

                        <span className="shrink-0 text-right font-mono text-[10px] text-[#5c5c70]">
                          {formatBusinessDateTime(item.created_at)}
                        </span>
                      </div>

                      {/* Comment text */}
                      {item.comment ? (
                        <div className="mt-1.5 text-xs text-[#232331] leading-relaxed sm:mt-2.5 sm:rounded-xl sm:border sm:border-[#eceeed] sm:bg-white sm:p-3">
                          <p className="italic font-medium">"{item.comment}"</p>
                        </div>
                      ) : (
                        <p className="mt-1.5 hidden text-[11px] text-[#7b7b8e] italic sm:block">
                          (Tanpa komentar tambahan)
                        </p>
                      )}

                      {/* Origin & Metadata */}
                      <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[10px] text-[#52665e] font-mono sm:mt-2.5 sm:gap-3">
                        <span>
                          <span className="hidden sm:inline">Pelanggan: </span>
                          <strong>{item.customer_name || "Pelanggan Tanpa Nama"}</strong>
                        </span>
                        {item.card_label && (
                          <span>
                            · Meja / Kartu: <strong>{item.card_label}</strong>
                          </span>
                        )}
                        {item.order_no && (
                          <span>
                            · No. Pesanan: <strong>#{item.order_no}</strong>
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
                {filteredFeedback.length > 3 && !feedLengkapHp && (
                  <button
                    type="button"
                    onClick={() => setFeedLengkapHp(true)}
                    className={`w-full rounded-xl border py-2 text-[11px] font-black sm:hidden ${
                      isMochi
                        ? "border-[#d8e3de] bg-[#fbfdfc] text-[#167052]"
                        : "border-[#dedee8] bg-[#fcfcfe] text-[#6d4cc4]"
                    }`}
                  >
                    Lihat {filteredFeedback.length - 3} masukan lainnya
                  </button>
                )}
              </div>
            ) : (
              <div
                className={`py-8 text-center rounded-2xl border border-dashed ${
                  isMochi ? "border-[#d8e3de] bg-[#fbfdfc]" : "border-[#dedee8] bg-[#fcfcfe]"
                }`}
              >
                <ShieldCheck
                  size={32}
                  className={`mx-auto mb-2 ${isMochi ? "text-[#167052]" : "text-[#7958d8]"}`}
                />
                <p className="text-xs font-bold text-[#232331]">
                  Belum ada ulasan atau keluhan yang masuk.
                </p>
                <p className="mt-1 text-[11px] text-[#7b7b8e] max-w-md mx-auto">
                  Pelanggan yang menilai bintang 4–5 otomatis diarahkan ke Google Review, sementara bintang 1–3 akan ditampung di sini secara privat.
                </p>
              </div>
            )}
          </div>
        </section>

        {/* Laporan Loyalty & Retensi Member */}
        <section
          className={
            isMochi
              ? "rounded-3xl border border-[#d8e3de] bg-white p-3.5 shadow-[0_4px_20px_rgba(11,61,46,0.04)] sm:p-6"
              : "border-2 border-[#232331] bg-white p-3 shadow-ink-md sm:p-5"
          }
        >
          <div
            className={`flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 ${
              isMochi ? "border-b border-[#e5ece8]" : "border-b border-[#dedee8]"
            }`}
          >
            <div>
              <div className="flex items-center gap-2">
                <h2
                  className={`text-sm font-black sm:text-base ${
                    isMochi ? "text-[#0b3d2e]" : "text-[#232331]"
                  }`}
                >
                  Laporan Loyalty &amp; Retensi Member
                </h2>
                <span
                  className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 font-mono text-[9px] font-black ${
                    isMochi
                      ? "bg-[#edf8f3] text-[#167052]"
                      : "bg-[#ddd9ff] text-[#6d4cc4]"
                  }`}
                >
                  <Crown size={12} /> 30 HARI TERAKHIR
                </span>
              </div>
              <p className={`mt-0.5 hidden text-[11px] sm:block ${isMochi ? "text-[#637970]" : "text-[#7b7b8e]"}`}>
                Pantau pertumbuhan member aktif, repeat visit, dan omzet belanja pelanggan setia.
              </p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <Link
                href="/app/loyalty/analytics"
                className={`inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 font-mono text-xs font-bold transition-transform active:scale-95 ${
                  isMochi
                    ? "bg-[#c8f53a] text-[#073829] shadow-sm hover:bg-[#bbf028]"
                    : "bg-[#232331] text-white"
                }`}
              >
                Analitik Lengkap <ChevronRight size={13} />
              </Link>
            </div>
          </div>

          {/* Loyalty KPI Grid */}
          <div className="mt-3 grid grid-cols-2 gap-2 sm:mt-4 sm:gap-3 sm:grid-cols-4">
            {/* Card 1: Member Aktif */}
            <div
              className={`p-3.5 sm:p-4 ${
                isMochi
                  ? "rounded-2xl border border-[#e0ebe5] bg-[#fbfdfc]"
                  : "border border-[#dedee8] bg-[#fcfcfe]"
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="font-mono text-[10px] font-bold uppercase tracking-wider text-[#7b7b8e]">
                  Member Aktif
                </span>
                <Users size={15} className={isMochi ? "text-[#167052]" : "text-[#6d4cc4]"} />
              </div>
              <p
                className={`mt-2 font-mono text-xl font-black sm:text-2xl ${
                  isMochi ? "text-[#0b3d2e]" : "text-[#232331]"
                }`}
              >
                {loyaltySummary?.activeMembers ?? 0}
              </p>
              <p className="mt-0.5 hidden text-[10px] text-[#7b7b8e] sm:block">
                {loyaltySummary?.activeMembersPrior !== undefined
                  ? `Periode lalu: ${loyaltySummary.activeMembersPrior} orang`
                  : "Transaksi dalam 30 hari"}
              </p>
            </div>

            {/* Card 2: Pelanggan Berulang (Repeat) */}
            <div
              className={`p-3.5 sm:p-4 ${
                isMochi
                  ? "rounded-2xl border border-[#e0ebe5] bg-[#fbfdfc]"
                  : "border border-[#dedee8] bg-[#fcfcfe]"
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="font-mono text-[10px] font-bold uppercase tracking-wider text-[#7b7b8e]">
                  Repeat Order
                </span>
                <RefreshCw size={15} className="text-emerald-600" />
              </div>
              <p className="mt-2 font-mono text-xl font-black sm:text-2xl text-emerald-700">
                {loyaltySummary?.repeatCustomers ?? 0}
              </p>
              <p className="mt-0.5 hidden text-[10px] text-[#7b7b8e] sm:block">
                Belanja &ge; 2 kali di toko
              </p>
            </div>

            {/* Card 3: Omzet Member */}
            <div
              className={`p-3.5 sm:p-4 ${
                isMochi
                  ? "rounded-2xl border border-[#e0ebe5] bg-[#fbfdfc]"
                  : "border border-[#dedee8] bg-[#fcfcfe]"
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="font-mono text-[10px] font-bold uppercase tracking-wider text-[#7b7b8e]">
                  Omzet Member
                </span>
                <CircleDollarSign size={15} className={isMochi ? "text-[#167052]" : "text-[#15803d]"} />
              </div>
              <p
                className={`mt-2 font-mono text-base font-black sm:text-lg truncate ${
                  isMochi ? "text-[#167052]" : "text-[#15803d]"
                }`}
              >
                {formatRupiah(loyaltySummary?.revenue ?? 0)}
              </p>
              <p className="mt-0.5 hidden text-[10px] text-[#7b7b8e] sm:block">
                Kontribusi 30 hari terakhir
              </p>
            </div>

            {/* Card 4: Member Kembali (Returning) */}
            <div
              className={`p-3.5 sm:p-4 ${
                isMochi
                  ? "rounded-2xl border border-[#e0ebe5] bg-[#fbfdfc]"
                  : "border border-[#dedee8] bg-[#fcfcfe]"
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="font-mono text-[10px] font-bold uppercase tracking-wider text-[#7b7b8e]">
                  Member Kembali
                </span>
                <HeartHandshake size={15} className="text-rose-500" />
              </div>
              <p
                className={`mt-2 font-mono text-xl font-black sm:text-2xl ${
                  isMochi ? "text-[#0b3d2e]" : "text-[#232331]"
                }`}
              >
                {loyaltySummary?.returningMembers ?? 0}
              </p>
              <p className="mt-0.5 hidden text-[10px] text-[#7b7b8e] sm:block">
                Member lama yang aktif lagi
              </p>
            </div>
          </div>

          {/* Action Links */}
          <div className="mt-4 pt-3 border-t border-[#edf4f0] flex flex-wrap gap-2">
            <Link
              href="/app/loyalty"
              className={`inline-flex items-center gap-1.5 rounded-xl border px-3 py-1.5 font-mono text-xs font-bold transition-colors ${
                isMochi
                  ? "border-[#d8e3de] bg-[#fbfdfc] text-[#0b3d2e] hover:bg-[#edf8f3]"
                  : "border-[#dedee8] bg-white text-[#232331] hover:bg-[#f7f6fc]"
              }`}
            >
              <Users size={13} /> Kelola Database Member
            </Link>
            <Link
              href="/app/loyalty/kartu"
              className={`inline-flex items-center gap-1.5 rounded-xl border px-3 py-1.5 font-mono text-xs font-bold transition-colors ${
                isMochi
                  ? "border-[#d8e3de] bg-[#fbfdfc] text-[#0b3d2e] hover:bg-[#edf8f3]"
                  : "border-[#dedee8] bg-white text-[#232331] hover:bg-[#f7f6fc]"
              }`}
            >
              <QrCode size={13} /> Cetak Kartu Fisik &amp; QR Meja
            </Link>
            <Link
              href="/app/loyalty/analytics"
              className={`inline-flex items-center gap-1.5 rounded-xl border px-3 py-1.5 font-mono text-xs font-bold transition-colors ${
                isMochi
                  ? "border-emerald-300 bg-[#edf8f3] text-[#167052] hover:bg-[#e2f4eb]"
                  : "border-[#ddd9ff] bg-[#f5f3ff] text-[#6d4cc4]"
              }`}
            >
              <TrendingDown size={13} className="rotate-180" /> Analitik Pertumbuhan &amp; Retensi
            </Link>
          </div>
        </section>

        {/* Shift & Transaksi Terbaru */}
        <section className="grid gap-3 sm:gap-4 lg:grid-cols-[0.9fr_1.45fr]">
          {/* Shift & Laci Tunai */}
          <div
            className={
              isMochi
                ? "rounded-3xl border border-[#d8e3de] bg-white p-3.5 shadow-[0_4px_20px_rgba(11,61,46,0.04)] sm:p-6"
                : "border-2 border-[#232331] bg-white p-3 shadow-ink-md sm:p-5"
            }
          >
            <div
              className={`flex items-center justify-between gap-2 pb-3.5 ${
                isMochi ? "border-b border-[#e5ece8]" : "border-b border-[#dedee8]"
              }`}
            >
              <div>
                <h2
                  className={`text-sm font-black sm:text-base ${
                    isMochi ? "text-[#0b3d2e]" : "text-[#232331]"
                  }`}
                >
                  Shift & laci tunai
                </h2>
                <p className={`mt-0.5 hidden text-[11px] sm:block ${isMochi ? "text-[#637970]" : "text-[#7b7b8e]"}`}>
                  Pantau shift yang masih berjalan.
                </p>
              </div>
              <WalletCards size={18} className={isMochi ? "text-[#167052]" : "text-[#6d4cc4]"} />
            </div>

            <div className="mt-3.5 space-y-2.5">
              {dashboard.activeShifts.length ? (
                dashboard.activeShifts.map((shift) => (
                  <div
                    key={shift.id}
                    className={`p-3.5 ${
                      isMochi
                        ? "rounded-2xl border border-[#e0ebe5] bg-[#fbfdfc] hover:border-emerald-200 transition-colors"
                        : "border border-[#dedee8] bg-[#fcfcfe]"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span
                        className={`font-bold text-xs ${
                          isMochi ? "text-[#0b3d2e]" : ""
                        }`}
                      >
                        {shift.staffName}
                      </span>
                      <span
                        className={`px-2 py-0.5 font-mono text-[9px] font-black ${
                          isMochi
                            ? "rounded-full bg-[#c8f53a] text-[#073829]"
                            : "rounded-md bg-[#dcfce7] text-[#15803d]"
                        }`}
                      >
                        AKTIF
                      </span>
                    </div>
                    <p
                      className={`mt-1 font-mono text-[10px] ${
                        isMochi ? "text-[#637970]" : "text-[#7b7b8e]"
                      }`}
                    >
                      Dibuka {formatBusinessDateTime(shift.openedAt)}
                    </p>
                    <div className="mt-2 grid grid-cols-2 gap-2 font-mono text-[10px]">
                      <div>
                        <p className={isMochi ? "text-[#637970]" : "text-[#7b7b8e]"}>Modal awal</p>
                        <p className={`font-black ${isMochi ? "text-[#0b3d2e]" : ""}`}>
                          {formatRupiah(shift.openingCash)}
                        </p>
                      </div>
                      <div>
                        <p className={isMochi ? "text-[#637970]" : "text-[#7b7b8e]"}>Tunai masuk</p>
                        <p
                          className={`font-black ${
                            isMochi ? "text-[#167052]" : "text-[#15803d]"
                          }`}
                        >
                          {formatRupiah(shift.cashSales)}
                        </p>
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <Empty text="Belum ada shift kasir aktif." />
              )}
            </div>
          </div>

          {/* Transaksi Terbaru */}
          <div
            className={
              isMochi
                ? "rounded-3xl border border-[#d8e3de] bg-white p-3.5 shadow-[0_4px_20px_rgba(11,61,46,0.04)] sm:p-6"
                : "border-2 border-[#232331] bg-white p-3 shadow-ink-md sm:p-5"
            }
          >
            <div
              className={`flex items-start justify-between gap-3 pb-3.5 ${
                isMochi ? "border-b border-[#e5ece8]" : "border-b border-[#dedee8]"
              }`}
            >
              <div>
                <h2
                  className={`text-sm font-black sm:text-base ${
                    isMochi ? "text-[#0b3d2e]" : "text-[#232331]"
                  }`}
                >
                  Transaksi terbaru
                </h2>
                <p className={`mt-0.5 text-[11px] ${isMochi ? "text-[#637970]" : "text-[#7b7b8e]"}`}>
                  Ada {queueTotal} pesanan yang masih perlu ditindaklanjuti.
                </p>
              </div>
              <Link
                href="/app/pos/reports"
                className={`inline-flex shrink-0 items-center gap-1 font-mono text-[10px] font-bold ${
                  isMochi ? "text-[#167052] hover:text-[#0b3d2e]" : "text-[#6d4cc4]"
                }`}
              >
                Laporan lengkap <ChevronRight size={13} />
              </Link>
            </div>

            <div
              className={`mt-1 divide-y ${
                isMochi ? "divide-[#edf4f0]" : "divide-[#ecebf1]"
              }`}
            >
              {dashboard.recentOrders.length ? (
                dashboard.recentOrders.slice(0, 7).map((order) => {
                  const refundTotal = Number(order.refund_total ?? 0);
                  const netTotal = Math.max(0, Number(order.total) - refundTotal);
                  return (
                    <div key={order.id} className="flex items-center gap-2.5 py-2.5">
                      <div
                        className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-xl ${
                          isMochi ? "bg-[#edf8f3] text-[#167052]" : "bg-[#f0edff] text-[#6d4cc4]"
                        }`}
                      >
                        <Coffee size={14} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p
                          className={`truncate text-xs font-black ${
                            isMochi ? "text-[#0b3d2e]" : ""
                          }`}
                        >
                          #{order.order_no}{" "}
                          <span
                            className={`font-normal ${
                              isMochi ? "text-[#637970]" : "text-[#7b7b8e]"
                            }`}
                          >
                            · {serviceTypeLabel(order.service_type, order.table_no)}
                          </span>
                        </p>
                        <p
                          className={`font-mono text-[10px] ${
                            isMochi ? "text-[#74877e]" : "text-[#7b7b8e]"
                          }`}
                        >
                          {formatBusinessDateTime(order.created_at)} · {order.payment_method.toUpperCase()}
                        </p>
                      </div>
                      <div className="text-right shrink-0">
                        <p
                          className={`font-mono text-xs font-black ${
                            isMochi ? "text-[#0b3d2e]" : ""
                          }`}
                        >
                          {formatRupiah(netTotal)}
                        </p>
                        {refundTotal > 0 ? (
                          <span className="inline-block rounded-md border border-rose-300 bg-rose-50 px-1.5 py-0.5 font-mono text-[8.5px] font-bold text-rose-700">
                            Refund {formatRupiah(refundTotal)}
                          </span>
                        ) : (
                          <span
                            className={`inline-block rounded-md border px-1.5 py-0.5 font-mono text-[8.5px] font-bold ${statusStyle(
                              order,
                              isMochi
                            )}`}
                          >
                            {PAYMENT_STATUS_LABEL[order.payment_status] ?? order.fulfillment_status}
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })
              ) : (
                <Empty text="Belum ada transaksi hari ini." />
              )}
            </div>
          </div>
        </section>

        {/* Kontribusi Kasir Hari Ini */}
        <section
          className={
            isMochi
              ? "rounded-3xl border border-[#d8e3de] bg-white p-3.5 shadow-[0_4px_20px_rgba(11,61,46,0.04)] sm:p-6"
              : "border-2 border-[#232331] bg-white p-3 shadow-ink-md sm:p-5"
          }
        >
          <div
            className={`flex items-center justify-between gap-2 pb-3.5 ${
              isMochi ? "border-b border-[#e5ece8]" : "border-b border-[#dedee8]"
            }`}
          >
            <div>
              <h2
                className={`text-sm font-black sm:text-base ${
                  isMochi ? "text-[#0b3d2e]" : "text-[#232331]"
                }`}
              >
                Kontribusi kasir hari ini
              </h2>
              <p className={`mt-0.5 hidden text-[11px] sm:block ${isMochi ? "text-[#637970]" : "text-[#7b7b8e]"}`}>
                Berdasarkan transaksi yang dicatat di POS.
              </p>
            </div>
            <Clock3 size={17} className={isMochi ? "text-[#167052]" : "text-[#6d4cc4]"} />
          </div>
          {dashboard.cashierSales.length ? (
            <div className="mt-3.5 grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
              {dashboard.cashierSales.map((cashier) => (
                <div
                  key={cashier.name}
                  className={`p-3.5 ${
                    isMochi
                      ? "rounded-2xl border border-[#e0ebe5] bg-[#fbfdfc] hover:border-emerald-200 transition-colors"
                      : "border border-[#dedee8] bg-[#fcfcfe]"
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <p
                      className={`truncate text-xs font-black ${
                        isMochi ? "text-[#0b3d2e]" : ""
                      }`}
                    >
                      {cashier.name}
                    </p>
                    <span
                      className={`font-mono text-[10px] ${
                        isMochi ? "text-[#637970]" : "text-[#7b7b8e]"
                      }`}
                    >
                      {cashier.orders} trx
                    </span>
                  </div>
                  <p
                    className={`mt-1.5 font-mono text-sm font-black ${
                      isMochi ? "text-[#167052]" : "text-[#15803d]"
                    }`}
                  >
                    {formatRupiah(cashier.revenue)}
                  </p>
                </div>
              ))}
            </div>
          ) : (
            <Empty text="Belum ada penjualan yang tercatat hari ini." />
          )}
        </section>
      </main>

      {/* MODAL: KATALOG PILIHAN LAPORAN BISNIS */}
      {showReportsModal && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-[#07281e]/60 backdrop-blur-sm animate-in fade-in duration-200"
          onClick={() => setShowReportsModal(false)}
        >
          <div
            className={`w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-3xl p-5 sm:p-7 shadow-2xl transition-all ${
              isMochi
                ? "border border-emerald-700/60 bg-white text-[#1a382d]"
                : "border-2 border-[#232331] bg-white text-[#232331]"
            }`}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="flex items-start justify-between gap-3 pb-4 border-b border-[#edf4f0]">
              <div className="flex items-center gap-3">
                <div
                  className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl overflow-hidden ${
                    isMochi ? "bg-white border border-emerald-400/40 p-0.5 shadow-sm" : "bg-[#f0edff] text-[#7958d8]"
                  }`}
                >
                  {isMochi ? (
                    <img src="/logo-mochi.png" alt="Mochi Logo" className="h-full w-full object-contain" />
                  ) : (
                    <FileText size={22} />
                  )}
                </div>
                <div>
                  <h3
                    className={`font-black text-base sm:text-lg ${
                      isMochi ? "text-[#0b3d2e]" : "text-[#232331]"
                    }`}
                  >
                    Katalog Pilihan Laporan Bisnis
                  </h3>
                  <p className="text-xs text-[#637970] mt-0.5">
                    Pilih kategori laporan untuk melihat analitik mendalam {business?.name ?? "Mochi Cafe"}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowReportsModal(false)}
                className="flex h-8 w-8 items-center justify-center rounded-full bg-[#edf4f0] text-[#637970] hover:bg-[#e0ebe5] hover:text-[#0b3d2e] transition-colors"
                aria-label="Tutup modal"
              >
                <X size={16} />
              </button>
            </div>

            {/* Modal Content / Groups */}
            <div className="mt-5 space-y-5">
              {/* Group 1: Transaksi & Kasir */}
              <div>
                <p className="font-mono text-[10px] font-bold uppercase tracking-wider text-[#637970] mb-2.5">
                  1. Laporan Transaksi &amp; Kasir (POS)
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <Link
                    href="/app/pos/reports"
                    onClick={() => setShowReportsModal(false)}
                    className="group p-3.5 rounded-2xl border border-[#d8e3de] bg-[#fbfdfc] hover:border-emerald-400 hover:bg-[#edf8f3] transition-all"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-xs sm:text-sm text-[#0b3d2e] group-hover:text-emerald-700">
                        🧾 Laporan Penjualan &amp; Laba Kasir
                      </span>
                      <ArrowRight size={13} className="text-[#637970] group-hover:translate-x-1 transition-transform" />
                    </div>
                    <p className="text-[11px] text-[#637970] mt-1 line-clamp-2 leading-relaxed">
                      Omzet 30 hari, laba kotor HPP resep, rekap metode bayar (Tunai vs QRIS vs Transfer), dan riwayat transaksi.
                    </p>
                  </Link>

                  <Link
                    href="/app/pos/reports"
                    onClick={() => setShowReportsModal(false)}
                    className="group p-3.5 rounded-2xl border border-[#d8e3de] bg-[#fbfdfc] hover:border-emerald-400 hover:bg-[#edf8f3] transition-all"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-xs sm:text-sm text-[#0b3d2e] group-hover:text-emerald-700">
                        💼 Audit Shift &amp; Laci Kasir
                      </span>
                      <ArrowRight size={13} className="text-[#637970] group-hover:translate-x-1 transition-transform" />
                    </div>
                    <p className="text-[11px] text-[#637970] mt-1 line-clamp-2 leading-relaxed">
                      Laporan modal awal laci, uang fisik laci vs uang sistem kasir, dan audit selisih kas per staf kasir.
                    </p>
                  </Link>
                </div>
              </div>

              {/* Group 2: Pelanggan & Reputasi */}
              <div>
                <p className="font-mono text-[10px] font-bold uppercase tracking-wider text-[#637970] mb-2.5">
                  2. Laporan Pelanggan, Loyalty &amp; Ulasan
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <Link
                    href="/app/loyalty/analytics"
                    onClick={() => setShowReportsModal(false)}
                    className="group p-3.5 rounded-2xl border border-[#d8e3de] bg-[#fbfdfc] hover:border-emerald-400 hover:bg-[#edf8f3] transition-all"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-xs sm:text-sm text-[#0b3d2e] group-hover:text-emerald-700">
                        👑 Laporan Analitik Loyalty &amp; Member
                      </span>
                      <ArrowRight size={13} className="text-[#637970] group-hover:translate-x-1 transition-transform" />
                    </div>
                    <p className="text-[11px] text-[#637970] mt-1 line-clamp-2 leading-relaxed">
                      Pertumbuhan member aktif 30 hari, repeat order rate, cohort kunjungan, dan distribusi saldo poin.
                    </p>
                  </Link>

                  <Link
                    href="/app/review/reports"
                    onClick={() => setShowReportsModal(false)}
                    className="group p-3.5 rounded-2xl border border-[#d8e3de] bg-[#fbfdfc] hover:border-emerald-400 hover:bg-[#edf8f3] transition-all"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-xs sm:text-sm text-[#0b3d2e] group-hover:text-emerald-700">
                        ⭐ Laporan Review &amp; Smart Shield
                      </span>
                      <ArrowRight size={13} className="text-[#637970] group-hover:translate-x-1 transition-transform" />
                    </div>
                    <p className="text-[11px] text-[#637970] mt-1 line-clamp-2 leading-relaxed">
                      Halaman khusus ulasan bintang 1–5, filter tanggal &amp; sentimen, keluhan terlindungi, dan follow-up WhatsApp.
                    </p>
                  </Link>
                </div>
              </div>

              {/* Group 3: Finansial & Operasional */}
              <div>
                <p className="font-mono text-[10px] font-bold uppercase tracking-wider text-[#637970] mb-2.5">
                  3. Laporan Keuangan, SDM &amp; Operasional
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <Link
                    href="/app/finance/reports"
                    onClick={() => setShowReportsModal(false)}
                    className="group p-3.5 rounded-2xl border border-[#d8e3de] bg-[#fbfdfc] hover:border-emerald-400 hover:bg-[#edf8f3] transition-all"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-xs sm:text-sm text-[#0b3d2e] group-hover:text-emerald-700">
                        💰 Laporan Keuangan &amp; Arus Kas
                      </span>
                      <ArrowRight size={13} className="text-[#637970] group-hover:translate-x-1 transition-transform" />
                    </div>
                    <p className="text-[11px] text-[#637970] mt-1 line-clamp-2 leading-relaxed">
                      Ringkasan laba rugi bulanan, pencatatan biaya operasional, dan arus kas masuk/keluar usaha.
                    </p>
                  </Link>

                  <Link
                    href="/app/hr/attendance"
                    onClick={() => setShowReportsModal(false)}
                    className="group p-3.5 rounded-2xl border border-[#d8e3de] bg-[#fbfdfc] hover:border-emerald-400 hover:bg-[#edf8f3] transition-all"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-xs sm:text-sm text-[#0b3d2e] group-hover:text-emerald-700">
                        👥 Laporan Absensi &amp; Jam Kerja Staf
                      </span>
                      <ArrowRight size={13} className="text-[#637970] group-hover:translate-x-1 transition-transform" />
                    </div>
                    <p className="text-[11px] text-[#637970] mt-1 line-clamp-2 leading-relaxed">
                      Rekapitulasi jam masuk, jam pulang, dan shift staf kasir serta barista toko.
                    </p>
                  </Link>
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="mt-6 pt-4 border-t border-[#edf4f0] flex items-center justify-between">
              <p className="text-[11px] text-[#637970] font-mono">
                KAEL Executive Intelligence · Multi-Module Reporting Hub
              </p>
              <button
                type="button"
                onClick={() => setShowReportsModal(false)}
                className="px-4 py-2 rounded-xl bg-[#0b3d2e] font-mono text-xs font-bold text-white hover:bg-[#144f3d] transition-colors"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}

      <TableQrModal
        isOpen={showTableQrModal}
        onClose={() => setShowTableQrModal(false)}
        storeCode={business?.store_code || "MOCHIKAFE"}
        storeName={business?.name || "Mochi Cafe n Resto"}
        isMochi={true}
      />

      <ClearTestDataModal
        isOpen={showClearModal}
        onClose={() => setShowClearModal(false)}
        onSuccess={() => {
          router.refresh();
        }}
        isMochi={isMochi}
      />

      {pasangAplikasi.lembar}
    </div>
  );
}

function Kpi({
  label,
  value,
  hint,
  icon: Icon,
  tone,
  valueTone,
  isMochi = false,
}: {
  label: string;
  value: string;
  hint: string;
  icon: typeof LayoutDashboard;
  tone: string;
  valueTone?: string;
  isMochi?: boolean;
}) {
  if (isMochi) {
    return (
      <div className="rounded-2xl border border-[#d8e3de] bg-white p-3.5 sm:p-5 shadow-[0_4px_16px_rgba(11,61,46,0.04)] hover:border-emerald-300/60 transition-colors">
        <div className="flex items-start justify-between gap-2">
          <p className="font-mono text-[9.5px] font-bold uppercase tracking-wider text-[#637970]">{label}</p>
          <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-xl ${tone}`}>
            <Icon size={14} />
          </span>
        </div>
        <p className={`mt-2 truncate font-mono text-lg font-black sm:text-2xl ${valueTone ?? "text-[#0b3d2e]"}`}>
          {value}
        </p>
        <p className="mt-0.5 truncate text-[10px] text-[#74877e]">{hint}</p>
      </div>
    );
  }

  return (
    <div className="border-2 border-[#232331] bg-white p-3 shadow-ink-xs sm:p-4">
      <div className="flex items-start justify-between gap-2">
        <p className="font-mono text-[9px] font-bold uppercase text-[#7b7b8e]">{label}</p>
        <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ${tone}`}>
          <Icon size={14} />
        </span>
      </div>
      <p className="mt-2 truncate font-mono text-base font-black sm:text-xl">{value}</p>
      <p className="mt-0.5 truncate text-[10px] text-[#7b7b8e]">{hint}</p>
    </div>
  );
}

function Empty({ text }: { text: string }) {
  return <div className="py-7 text-center font-mono text-[11px] text-[#7b7b8e]">{text}</div>;
}
