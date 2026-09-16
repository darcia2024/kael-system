"use client";

import { useState, useMemo, useEffect, useRef } from "react";
import {
  CheckCircle2,
  Coffee,
  CupSoda,
  Eye,
  Loader2,
  MessageSquare,
  Minus,
  Package,
  Plus,
  Receipt,
  Search,
  ShoppingBag,
  Soup,
  Sparkles,
  UtensilsCrossed,
  Crown,
  ArrowRight,
  X,
  Download,
  Copy,
  Check,
  RotateCcw,
  ArrowLeft,
  type LucideIcon,
} from "lucide-react";
import qrcode from "qrcode-generator";
import type { Business, Category, MenuItem } from "@/lib/types";
import { PLACEHOLDER_MENU } from "@/lib/types";
import { createQrOrderAction, getQrOrderStatusAction } from "@/lib/actions";
import QrCode from "@/components/qr-code";
import { buildDynamicQris } from "@/lib/qris-engine";
import { formatRupiah } from "@/lib/formatters";
import { BusinessMark } from "@/components/business-mark";
import { isMochiBusiness } from "@/lib/mochi-brand";

function getCategoryIcon(categoryName: string): LucideIcon {
  const name = categoryName.toLowerCase();

  if (name.includes("coffee") || name.includes("kopi")) return Coffee;
  if (name.includes("mie") || name.includes("sup") || name.includes("berkuah")) return Soup;
  if (
    name.includes("minuman") ||
    name.includes("dalgona") ||
    name.includes("mojito") ||
    name.includes("milkshake") ||
    name.includes("float") ||
    name.includes("jus")
  ) {
    return CupSoda;
  }
  if (name.includes("cemilan") || name.includes("tambahan")) return Package;

  return UtensilsCrossed;
}

export default function CustomerQrOrderPage({
  tableNo,
  business,
  categories,
  menuItems,
  fontClassName,
}: {
  tableNo: string;
  business: Business | null;
  categories: Category[];
  menuItems: MenuItem[];
  fontClassName: string;
}) {
  const isMochi = isMochiBusiness(business);
  const [activeCategory, setActiveCategory] = useState<string>(categories[0]?.id ?? "");
  const [searchQuery, setSearchQuery] = useState("");
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [cart, setCart] = useState<Record<string, { item: MenuItem; qty: number; note: string }>>({});
  const [selectedMenuItem, setSelectedMenuItem] = useState<MenuItem | null>(null);
  const [modalQty, setModalQty] = useState(1);
  const [modalNote, setModalNote] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [nameError, setNameError] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDownloadingQris, setIsDownloadingQris] = useState(false);
  const [copiedNominal, setCopiedNominal] = useState(false);
  const [isBrowsingMenu, setIsBrowsingMenu] = useState(false);

  const customerNameInputRef = useRef<HTMLInputElement>(null);

  /**
   * Cara bayar dipilih pelanggan dari HP-nya:
   * "qris" = Tampilkan QRIS resmi Bank Nagari dinamis dengan nominal pas
   * "cash" = Makan dulu, bayar di kasir saat selesai
   */
  const [caraBayar, setCaraBayar] = useState<"qris" | "cash">("qris");
  const [pesananSelesai, setPesananSelesai] = useState<{ id: string; no: string; total: number } | null>(null);
  const [sudahKirimBukti, setSudahKirimBukti] = useState(false);
  const [paymentStatus, setPaymentStatus] = useState<string>("pending");
  const [fulfillmentStatus, setFulfillmentStatus] = useState<string>("pending");

  const storageKey = business?.id ? `kael_active_order_${business.id}_table_${tableNo.toLowerCase()}` : null;

  // ---------------------------------------------------------------------------
  // 1. Rehidrasi pesanan aktif dari LocalStorage (mencegah QRIS tertutup saat ganti app)
  // ---------------------------------------------------------------------------
  useEffect(() => {
    if (!storageKey) return;
    try {
      const saved = localStorage.getItem(storageKey);
      if (saved) {
        const parsed = JSON.parse(saved);
        // Valid jika dibuat kurang dari 6 jam yang lalu
        if (parsed?.id && parsed?.timestamp && Date.now() - parsed.timestamp < 6 * 3600 * 1000) {
          setPesananSelesai({ id: parsed.id, no: parsed.no, total: Number(parsed.total) });
          if (parsed.caraBayar) setCaraBayar(parsed.caraBayar);
          if (parsed.customerName) setCustomerName(parsed.customerName);

          // Cek status terkini ke server
          getQrOrderStatusAction(parsed.id).then((res) => {
            if (res.ok) {
              setPaymentStatus(res.data.paymentStatus);
              setFulfillmentStatus(res.data.fulfillmentStatus);
            }
          });
        } else {
          localStorage.removeItem(storageKey);
        }
      }
    } catch (e) {
      console.warn("Error reading active order storage:", e);
    }
  }, [storageKey]);

  // ---------------------------------------------------------------------------
  // 2. Polling status pesanan secara berkala (tiap 3 detik) jika QRIS belum lunas
  // ---------------------------------------------------------------------------
  useEffect(() => {
    if (!pesananSelesai?.id || paymentStatus === "paid") return;

    let isMounted = true;
    const interval = setInterval(async () => {
      try {
        const res = await getQrOrderStatusAction(pesananSelesai.id);
        if (res.ok && isMounted) {
          if (res.data.paymentStatus) {
            setPaymentStatus(res.data.paymentStatus);
          }
          if (res.data.fulfillmentStatus) {
            setFulfillmentStatus(res.data.fulfillmentStatus);
          }
        }
      } catch (err) {
        console.warn("Polling status error:", err);
      }
    }, 3000);

    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [pesananSelesai?.id, paymentStatus]);

  // ---------------------------------------------------------------------------
  // 3. Kunci halaman agar tidak bisa di-zoom out atau zoom in di HP (skala 1.0)
  // ---------------------------------------------------------------------------
  useEffect(() => {
    const preventGesture = (e: Event) => {
      e.preventDefault();
    };

    const handleTouchStart = (e: TouchEvent) => {
      if (e.touches.length > 1) {
        e.preventDefault();
      }
    };

    let lastTouchEnd = 0;
    const handleTouchEnd = (e: TouchEvent) => {
      const now = Date.now();
      if (now - lastTouchEnd <= 300) {
        const target = e.target as HTMLElement | null;
        const isInteractive = target?.closest("input, textarea, select, button, a");
        if (!isInteractive) {
          e.preventDefault();
        }
      }
      lastTouchEnd = now;
    };

    document.addEventListener("gesturestart", preventGesture, { passive: false });
    document.addEventListener("gesturechange", preventGesture, { passive: false });
    document.addEventListener("gestureend", preventGesture, { passive: false });
    document.addEventListener("touchstart", handleTouchStart, { passive: false });
    document.addEventListener("touchend", handleTouchEnd, { passive: false });

    return () => {
      document.removeEventListener("gesturestart", preventGesture);
      document.removeEventListener("gesturechange", preventGesture);
      document.removeEventListener("gestureend", preventGesture);
      document.removeEventListener("touchstart", handleTouchStart);
      document.removeEventListener("touchend", handleTouchEnd);
    };
  }, []);

  useEffect(() => {
    if (!isCartOpen && !selectedMenuItem) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [isCartOpen, selectedMenuItem]);

  const categorizedMenu = useMemo(
    () =>
      categories
        .map((category) => ({
          category,
          items: menuItems.filter((item) => item.category_id === category.id),
        }))
        .filter((group) => group.items.length > 0),
    [categories, menuItems],
  );

  const activeMenuGroup =
    categorizedMenu.find((group) => group.category.id === activeCategory) ??
    categorizedMenu[0];

  const normalizedSearch = searchQuery.trim().toLowerCase();
  const visibleItems = normalizedSearch
    ? menuItems.filter((item) => {
        const categoryName = categories.find((category) => category.id === item.category_id)?.name ?? "";
        return `${item.name} ${item.description ?? ""} ${categoryName}`
          .toLowerCase()
          .includes(normalizedSearch);
      })
    : activeMenuGroup?.items ?? [];

  const visibleSectionTitle = normalizedSearch
    ? `Hasil pencarian: ${searchQuery.trim()}`
    : activeMenuGroup?.category.name ?? "Menu";

  const selectCategory = (categoryId: string) => {
    setActiveCategory(categoryId);
    requestAnimationFrame(() => {
      document.getElementById("menu-results")?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    });
  };

  const cartList = Object.values(cart);
  const cartTotal = cartList.reduce((sum, c) => sum + c.item.price * c.qty, 0);
  const totalItemCount = cartList.reduce((sum, c) => sum + c.qty, 0);

  useEffect(() => {
    if (cartList.length === 0 && isCartOpen) setIsCartOpen(false);
  }, [cartList.length, isCartOpen]);

  const handleAddToCart = (item: MenuItem) => {
    if (!item.is_available) return;
    setCart((prev) => {
      const existing = prev[item.id];
      if (existing) {
        return {
          ...prev,
          [item.id]: { ...existing, qty: existing.qty + 1 },
        };
      }
      return {
        ...prev,
        [item.id]: { item, qty: 1, note: "" },
      };
    });
  };

  const handleUpdateQty = (itemId: string, delta: number) => {
    setCart((prev) => {
      const existing = prev[itemId];
      if (!existing) return prev;
      const nextQty = existing.qty + delta;
      if (nextQty <= 0) {
        const copy = { ...prev };
        delete copy[itemId];
        return copy;
      }
      return {
        ...prev,
        [itemId]: { ...existing, qty: nextQty },
      };
    });
  };

  const handleUpdateNote = (itemId: string, note: string) => {
    setCart((prev) => {
      const existing = prev[itemId];
      if (!existing) return prev;
      return {
        ...prev,
        [itemId]: { ...existing, note },
      };
    });
  };

  const handleOpenDetailModal = (item: MenuItem) => {
    setSelectedMenuItem(item);
    const existing = cart[item.id];
    setModalQty(existing ? existing.qty : 1);
    setModalNote(existing ? existing.note : "");
  };

  const handleSaveModalItem = () => {
    if (!selectedMenuItem) return;
    setCart((prev) => ({
      ...prev,
      [selectedMenuItem.id]: {
        item: selectedMenuItem,
        qty: modalQty,
        note: modalNote.trim(),
      },
    }));
    setSelectedMenuItem(null);
  };

  const handleCheckout = async () => {
    if (cartList.length === 0) return;

    if (!customerName.trim()) {
      setNameError(true);
      customerNameInputRef.current?.focus();
      return;
    }
    setNameError(false);

    setIsSubmitting(true);

    if (!business) {
      setIsSubmitting(false);
      alert("Toko belum siap menerima pesanan.");
      return;
    }

    const res = await createQrOrderAction(
      business.id,
      tableNo,
      "dine_in",
      caraBayar,
      cartList.map((c) => ({ menu_item_id: c.item.id, qty: c.qty, note: c.note })),
    );

    setIsSubmitting(false);
    if (!res.ok) {
      alert(res.error);
      return;
    }

    const newOrderData = {
      id: res.data.orderId,
      no: res.data.orderNo,
      total: res.data.total,
      caraBayar,
      customerName: customerName.trim(),
      timestamp: Date.now(),
    };

    if (storageKey) {
      try {
        localStorage.setItem(storageKey, JSON.stringify(newOrderData));
      } catch (e) {
        console.warn("Failed saving order to localStorage", e);
      }
    }

    setPesananSelesai({ id: res.data.orderId, no: res.data.orderNo, total: res.data.total });
    setPaymentStatus("pending");
    setFulfillmentStatus("pending");
    setSudahKirimBukti(false);
    setIsCartOpen(false);
    setIsBrowsingMenu(false);
    setCart({});
  };

  const handleCopyNominal = (amount: number) => {
    try {
      navigator.clipboard.writeText(String(Math.round(amount)));
      setCopiedNominal(true);
      setTimeout(() => setCopiedNominal(false), 2200);
    } catch {
      // ignore
    }
  };

  const handleDownloadQrisImage = (
    payloadValue: string,
    orderNumber: string,
    totalAmount: number,
  ) => {
    try {
      setIsDownloadingQris(true);
      const qr = qrcode(0, "H");
      qr.addData(payloadValue, "Byte");
      qr.make();
      const count = qr.getModuleCount();

      const canvas = document.createElement("canvas");
      const width = 800;
      const height = 1120;
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        setIsDownloadingQris(false);
        return;
      }

      const brand = isMochi ? "MOCHI CAFE N RESTO" : (business?.name?.toUpperCase() || "RESTO");

      // Deep emerald gradient background
      const grad = ctx.createLinearGradient(0, 0, 0, height);
      grad.addColorStop(0, "#052016");
      grad.addColorStop(0.5, "#0b3d2e");
      grad.addColorStop(1, "#03160f");
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, width, height);

      // Gold / neon lime border
      ctx.strokeStyle = "#c8f53a";
      ctx.lineWidth = 6;
      ctx.strokeRect(18, 18, width - 36, height - 36);

      // Header Brand
      ctx.fillStyle = "#ffffff";
      ctx.font = "bold 26px 'Plus Jakarta Sans', sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(brand, width / 2, 65);

      ctx.fillStyle = "#c8f53a";
      ctx.font = "bold 15px 'Plus Jakarta Sans', monospace";
      ctx.fillText(`ANTREAN #${orderNumber} · MEJA ${tableNo.toUpperCase()}`, width / 2, 96);

      // White Squircle Card for QR
      const cardX = 50;
      const cardY = 125;
      const cardW = width - 100;
      const cardH = 590;

      ctx.fillStyle = "#ffffff";
      ctx.beginPath();
      ctx.roundRect(cardX, cardY, cardW, cardH, 28);
      ctx.fill();
      ctx.strokeStyle = "#0e2319";
      ctx.lineWidth = 4;
      ctx.stroke();

      // QRIS Red Pill
      ctx.fillStyle = "#d32f2f";
      ctx.beginPath();
      ctx.roundRect(cardX + 28, cardY + 22, 68, 26, 6);
      ctx.fill();
      ctx.fillStyle = "#ffffff";
      ctx.font = "bold 13px sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("QRIS", cardX + 62, cardY + 39);

      // Bank Nagari / Merchant info
      ctx.fillStyle = "#0b3d2e";
      ctx.font = "bold 15px 'Plus Jakarta Sans', sans-serif";
      ctx.textAlign = "right";
      ctx.fillText(business?.qris_merchant_name || brand, cardX + cardW - 28, cardY + 40);

      // Draw QR inside card
      const qrSize = 380;
      const qrX = cardX + (cardW - qrSize) / 2;
      const qrY = cardY + 68;
      const cellSize = qrSize / count;

      for (let r = 0; r < count; r++) {
        for (let c = 0; c < count; c++) {
          if (qr.isDark(r, c)) {
            ctx.fillStyle = "#07251a";
            ctx.fillRect(qrX + c * cellSize, qrY + r * cellSize, cellSize + 0.35, cellSize + 0.35);
          }
        }
      }

      // Bottom of card: NMID
      ctx.fillStyle = "#335345";
      ctx.font = "bold 13px monospace";
      ctx.textAlign = "center";
      ctx.fillText(`NMID: ${business?.qris_nmid || "ID1022226423583"} · ${business?.qris_merchant_city || "PADANG PANJANG"}`, width / 2, cardY + cardH - 36);
      ctx.font = "11.5px 'Plus Jakarta Sans', sans-serif";
      ctx.fillStyle = "#5d7a6e";
      ctx.fillText("BCA · Mandiri · BRI · BNI · GoPay · DANA · OVO · ShopeePay & Semua M-Banking", width / 2, cardY + cardH - 16);

      // Nominal Box
      const nomY = 740;
      ctx.fillStyle = "#c8f53a";
      ctx.beginPath();
      ctx.roundRect(cardX + 15, nomY, cardW - 30, 95, 22);
      ctx.fill();

      ctx.fillStyle = "#07251a";
      ctx.font = "bold 13px 'Plus Jakarta Sans', sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("NOMINAL PEMBAYARAN (PAS):", width / 2, nomY + 30);
      ctx.font = "bold 36px 'Plus Jakarta Sans', monospace";
      ctx.fillText(formatRupiah(totalAmount), width / 2, nomY + 72);

      // Instructions
      ctx.fillStyle = "#e2ece7";
      ctx.font = "14px 'Plus Jakarta Sans', sans-serif";
      ctx.fillText("1. Simpan gambar ini ke galeri HP Anda.", width / 2, 885);
      ctx.fillText("2. Buka BCA / GoPay / DANA / Livin / ShopeePay.", width / 2, 915);
      ctx.fillText("3. Pilih Scan QR lalu pilih ikon Galeri untuk memindai.", width / 2, 945);

      ctx.fillStyle = "#9cc2b2";
      ctx.font = "italic 12px 'Plus Jakarta Sans', sans-serif";
      ctx.fillText("Mochi Cafe n Resto · Padang Panjang", width / 2, 995);

      const link = document.createElement("a");
      link.download = `QRIS-Meja-${tableNo}-Order-${orderNumber}.png`;
      link.href = canvas.toDataURL("image/png");
      link.click();
      setIsDownloadingQris(false);
    } catch (e) {
      console.error("Failed to generate QRIS image", e);
      setIsDownloadingQris(false);
    }
  };

  const handleStartNewOrder = () => {
    if (storageKey) {
      try {
        localStorage.removeItem(storageKey);
      } catch {}
    }
    setPesananSelesai(null);
    setCart({});
    setIsBrowsingMenu(false);
    setPaymentStatus("pending");
    setFulfillmentStatus("pending");
    setSudahKirimBukti(false);
  };

  // ===========================================================================
  // LAYAR AKTIF: TAMPILAN PESANAN (QRIS / STRUK)
  // ===========================================================================
  if (pesananSelesai && !isBrowsingMenu) {
    const isQris = caraBayar === "qris";
    const isPaid = paymentStatus === "paid";
    const qris =
      isQris && business?.qris_payload
        ? buildDynamicQris(business.qris_payload, Math.round(pesananSelesai.total))
        : null;

    const brandName = isMochi ? "Mochi Cafe n Resto" : (business?.name || "Resto");
    const logoSrc = isMochi ? "/logo-mochi.png" : (business?.logo_url || null);

    // -------------------------------------------------------------------------
    // A. TAMPILAN KHUSUS QRIS BELUM LUNAS: MASCOT MOCHI HOLDING QR
    // -------------------------------------------------------------------------
    if (isQris && qris?.ok && !isPaid) {
      return (
        <div className={`${fontClassName} flex min-h-screen flex-col items-center justify-center bg-gradient-to-b from-[#052016] via-[#0b3d2e] to-[#03160f] p-4 text-white selection:bg-[#c8f53a] selection:text-[#0b3d2e]`}>
          <div className="w-full max-w-sm sm:max-w-md mx-auto text-center space-y-3.5 animate-in zoom-in-95">
            
            {/* Top Bar: Navigasi & Meja Badge */}
            <div className="flex items-center justify-between gap-2">
              <button
                type="button"
                onClick={() => setIsBrowsingMenu(true)}
                className="inline-flex items-center gap-1.5 rounded-full bg-white/10 hover:bg-white/20 px-3 py-1 text-xs font-bold text-emerald-200 border border-white/15 transition-all active:scale-95 shadow-xs"
              >
                <ArrowLeft size={13} />
                <span>Lihat Menu</span>
              </button>

              <div className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3.5 py-1 text-xs font-black tracking-wide text-[#c8f53a] border border-white/15 backdrop-blur-md shadow-xs">
                <span className="h-2 w-2 rounded-full bg-[#c8f53a] animate-pulse" />
                <span>ANTREAN #{pesananSelesai.no} · MEJA {tableNo.toUpperCase()}</span>
              </div>
            </div>

            {/* Header Title & Subtitle */}
            <div>
              <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-white drop-shadow-xs">
                Pembayaran QRIS Resmi
              </h1>
              <p className="text-xs sm:text-sm font-medium text-emerald-200/90 mt-0.5">
                {brandName} · Padang Panjang
              </p>
            </div>

            {/* MASCOT HOLDING QR CARD */}
            <div className="relative inline-block mx-auto pt-6 pb-2 px-5 sm:px-6">
              {/* Mascot Ears */}
              <div className="absolute -top-1 inset-x-0 flex justify-center pointer-events-none z-0">
                <svg width="150" height="52" viewBox="0 0 150 52" fill="none" className="drop-shadow-sm">
                  <path d="M 35 32 Q 75 18 115 32" stroke="#0e2319" strokeWidth="4" fill="none" />
                  <path d="M 28 48 L 47 6 C 50 -1, 60 -1, 64 8 L 78 48 Z" fill="#ffffff" stroke="#0e2319" strokeWidth="4.5" strokeLinejoin="round" />
                  <path d="M 44 38 L 52 14 L 62 38" stroke="#0e2319" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" />
                  <path d="M 72 48 L 86 8 C 90 -1, 100 -1, 103 6 L 122 48 Z" fill="#ffffff" stroke="#0e2319" strokeWidth="4.5" strokeLinejoin="round" />
                  <path d="M 88 38 L 98 14 L 106 38" stroke="#0e2319" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </div>

              {/* Floating Bubbles */}
              <div className="pointer-events-none absolute -top-1 -left-2 sm:-left-3 z-20 flex h-11 w-11 sm:h-12 sm:w-12 items-center justify-center rounded-full border border-white/30 bg-white/15 text-xl sm:text-2xl shadow-lg backdrop-blur-md animate-bounce [animation-duration:3.2s]">
                🍵
              </div>
              <div className="pointer-events-none absolute top-5 -right-2 sm:-right-3 z-20 flex h-11 w-11 sm:h-12 sm:w-12 items-center justify-center rounded-full border border-white/30 bg-white/15 text-xl sm:text-2xl shadow-lg backdrop-blur-md animate-bounce [animation-duration:3.8s] [animation-delay:0.5s]">
                🍡
              </div>
              <div className="pointer-events-none absolute -bottom-1 -left-2 sm:-left-3 z-20 flex h-11 w-11 sm:h-12 sm:w-12 items-center justify-center rounded-full border border-white/30 bg-white/15 text-xl sm:text-2xl shadow-lg backdrop-blur-md animate-bounce [animation-duration:4s] [animation-delay:1s]">
                ☕
              </div>
              <div className="pointer-events-none absolute bottom-5 -right-2 sm:-right-3 z-20 flex h-11 w-11 sm:h-12 sm:w-12 items-center justify-center rounded-full border border-white/30 bg-white/15 text-xl sm:text-2xl shadow-lg backdrop-blur-md animate-bounce [animation-duration:3.5s] [animation-delay:1.5s]">
                ✨
              </div>

              {/* TOP-LEFT PAW */}
              <div className="pointer-events-none absolute top-10 left-0 sm:left-1 z-30">
                <svg width="40" height="56" viewBox="0 0 44 60" fill="none" className="drop-shadow-md">
                  <path d="M 0 35 C 0 18, 10 10, 22 13 C 32 15, 36 24, 26 28 C 36 30, 38 39, 28 43 C 36 46, 35 56, 22 58 C 10 59, 0 52, 0 43 Z" fill="#ffffff" stroke="#0e2319" strokeWidth="4.5" strokeLinejoin="round" />
                  <path d="M 14 28 L 26 28" stroke="#0e2319" strokeWidth="3" strokeLinecap="round" />
                  <path d="M 16 43 L 28 43" stroke="#0e2319" strokeWidth="3" strokeLinecap="round" />
                </svg>
              </div>

              {/* BOTTOM-RIGHT PAW */}
              <div className="pointer-events-none absolute bottom-6 right-0 sm:right-1 z-30">
                <svg width="40" height="56" viewBox="0 0 44 60" fill="none" className="drop-shadow-md">
                  <path d="M 44 25 C 44 42, 34 50, 22 47 C 12 45, 8 36, 18 32 C 8 30, 6 21, 16 17 C 8 14, 9 4, 22 2 C 34 1, 44 8, 44 17 Z" fill="#ffffff" stroke="#0e2319" strokeWidth="4.5" strokeLinejoin="round" />
                  <path d="M 30 32 L 18 32" stroke="#0e2319" strokeWidth="3" strokeLinecap="round" />
                  <path d="M 28 17 L 16 17" stroke="#0e2319" strokeWidth="3" strokeLinecap="round" />
                </svg>
              </div>

              {/* THE WHITE SQUIRCLE QR CARD */}
              <div className="relative z-10 rounded-[32px] sm:rounded-[38px] border-[4px] border-[#0e2319] bg-white p-4 sm:p-5 shadow-[0_24px_50px_rgba(0,0,0,0.55)]">
                <div className="relative mx-auto flex items-center justify-center">
                  <QrCode
                    value={qris.payload}
                    size={216}
                    colorDark="#07251a"
                    centerLogoUrl={logoSrc}
                    label={`QRIS pembayaran ${formatRupiah(pesananSelesai.total)}`}
                  />
                </div>
                <p className="mt-2 text-[10.5px] font-extrabold uppercase tracking-wider text-[#355749]">
                  Pindai dengan Aplikasi Apa Saja
                </p>
              </div>
            </div>

            {/* KETERANGAN & DETAIL PEMBAYARAN */}
            <div className="space-y-2 pt-0.5">
              {/* Bank Nagari & QRIS Row */}
              <div className="flex items-center justify-center gap-2 text-xs font-bold">
                <span className="rounded bg-[#d32f2f] px-2 py-0.5 text-[10px] font-black text-white tracking-wider shadow-xs">
                  QRIS
                </span>
                <span className="text-white font-extrabold">Bank Nagari</span>
                <span className="text-white/40">|</span>
                <span className="text-[#c8f53a] font-extrabold">{business?.qris_merchant_name || brandName}</span>
              </div>

              {/* Nominal Pas Pill with 1-Tap Copy */}
              <div>
                <div className="inline-flex items-center gap-2 rounded-full bg-[#c8f53a] px-5 py-2 text-base sm:text-lg font-black text-[#07251a] shadow-[0_4px_20px_rgba(200,245,58,0.3)]">
                  <span>🔒 Nominal Pas: {formatRupiah(pesananSelesai.total)}</span>
                  <button
                    type="button"
                    title="Salin nominal"
                    onClick={() => handleCopyNominal(pesananSelesai.total)}
                    className="flex h-7 w-7 items-center justify-center rounded-full bg-[#07251a] text-[#c8f53a] hover:bg-[#0b3d2e] transition-all active:scale-90"
                  >
                    {copiedNominal ? <Check size={14} /> : <Copy size={13} />}
                  </button>
                </div>
                <p className="mt-1 text-[11px] text-emerald-200/90 font-medium">
                  {copiedNominal ? "✓ Nominal berhasil disalin ke clipboard!" : "Nominal pas otomatis terisi saat scan · Tanpa perlu ketik manual"}
                </p>
              </div>

              {/* NMID & Supported Payment Apps */}
              <div className="text-center space-y-0.5 pt-0.5">
                <p className="text-xs font-extrabold text-white tracking-wide">
                  NMID: {business?.qris_nmid || "ID1022226423583"} · {business?.qris_merchant_city || "PADANG PANJANG"}
                </p>
                <p className="text-[10px] sm:text-[11px] text-emerald-300/80">
                  BCA · Mandiri · BRI · BNI · GoPay · DANA · OVO · ShopeePay & semua m-banking
                </p>
              </div>
            </div>

            {/* 1-Tap Action: Simpan Gambar QRIS & Tips */}
            <div className="grid grid-cols-1 gap-2 pt-1">
              <button
                type="button"
                onClick={() => handleDownloadQrisImage(qris.payload, pesananSelesai.no, pesananSelesai.total)}
                disabled={isDownloadingQris}
                className="flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl bg-white text-[#07251a] hover:bg-emerald-50 px-4 text-xs sm:text-sm font-black transition-all shadow-md active:scale-[0.98] border border-white"
              >
                {isDownloadingQris ? (
                  <Loader2 size={17} className="animate-spin" />
                ) : (
                  <Download size={17} strokeWidth={2.5} className="text-[#07251a]" />
                )}
                <span>{isDownloadingQris ? "Menyiapkan Gambar..." : "📥 Download Gambar QRIS ke Galeri HP"}</span>
              </button>
            </div>

            {/* Tips Scan Langsung */}
            <div className="rounded-2xl border border-white/15 bg-white/10 p-3 text-left backdrop-blur-xs space-y-1">
              <div className="flex items-center gap-1.5 text-xs font-bold text-[#c8f53a]">
                <Sparkles size={14} />
                <span>Tips scan langsung dari HP ini:</span>
              </div>
              <p className="text-[11px] text-emerald-100/90 leading-relaxed">
                1. Klik tombol <strong>Download Gambar QRIS</strong> di atas (atau screenshot QR).<br />
                2. Buka aplikasi m-Banking atau E-Wallet (BCA, GoPay, DANA, dll).<br />
                3. Pilih menu <strong>Scan QR</strong> lalu klik ikon <strong>Galeri</strong> untuk memindai gambar tadi.
              </p>
            </div>

            {/* STATUS / KONFIRMASI PEMBAYARAN */}
            {!sudahKirimBukti ? (
              <div className="rounded-2xl border-2 border-[#c8f53a]/40 bg-[#06291e]/80 p-3.5 text-left space-y-2.5 shadow-lg backdrop-blur-xs">
                <div className="flex items-start gap-2">
                  <span className="text-base shrink-0 mt-0.5">⚠️</span>
                  <div>
                    <p className="text-xs font-black text-[#c8f53a] uppercase tracking-tight">
                      Pesanan Masuk Dapur Setelah Dibayar
                    </p>
                    <p className="text-[11px] text-emerald-200/80 font-medium leading-relaxed mt-0.5">
                      Selesaikan pembayaran QRIS di atas. Setelah transfer sukses, klik tombol di bawah agar kasir memverifikasi dan pesanan langsung dimasak:
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setSudahKirimBukti(true)}
                  className="w-full flex items-center justify-center gap-2 rounded-xl bg-[#c8f53a] hover:bg-[#b8e52a] text-[#07251a] py-3.5 px-4 text-xs sm:text-sm font-black transition-all shadow-[0_4px_16px_rgba(200,245,58,0.25)] active:scale-[0.98]"
                >
                  <CheckCircle2 size={18} />
                  <span>✅ SAYA SUDAH TRANSFER / BAYAR VIA QRIS</span>
                </button>
              </div>
            ) : (
              <div className="rounded-2xl border-2 border-emerald-400 bg-emerald-950/70 p-4 text-left space-y-2 shadow-lg backdrop-blur-xs animate-in fade-in-50">
                <div className="flex items-center gap-2">
                  <span className="flex h-2.5 w-2.5 relative">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-400"></span>
                  </span>
                  <h4 className="text-xs font-black text-[#c8f53a] uppercase tracking-wide">
                    Sedang Diverifikasi Kasir...
                  </h4>
                </div>
                <p className="text-[11px] text-emerald-200 font-medium leading-relaxed">
                  Terima kasih! Kasir sedang memeriksa mutasi Bank Nagari. Layar HP ini akan <strong>otomatis berubah menjadi LUNAS</strong> begitu kasir menekan tombol konfirmasi.
                </p>
              </div>
            )}

            {/* Tombol Bantuan, Struk & Tambah Menu */}
            <div className="space-y-2 pt-1">
              {pesananSelesai?.id && (
                <a
                  href={`/receipt/${pesananSelesai.id}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-white/20 bg-white/10 px-4 font-mono text-xs font-bold text-white hover:bg-white/15 transition-all shadow-xs backdrop-blur-xs"
                >
                  <Receipt size={16} />
                  <span>Buka Struk Digital Resmi</span>
                </a>
              )}

              {business?.phone ? (
                <a
                  href={`https://wa.me/${business.phone.replace(/[^0-9]/g, "").replace(/^0/, "62")}?text=${encodeURIComponent(
                    `Halo ${business.name}, saya memesan dari Meja ${tableNo} (Pesanan #${pesananSelesai.no}) dengan total ${formatRupiah(pesananSelesai.total)}. Saya sudah bayar via QRIS, mohon dicek ya!`
                  )}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-[#25d366]/50 bg-[#25d366]/15 px-4 font-mono text-xs font-bold text-emerald-200 hover:bg-[#25d366]/25 transition-all shadow-xs backdrop-blur-xs"
                >
                  <MessageSquare size={16} className="text-[#25d366]" />
                  <span>Kirim Bukti Bayar ke WhatsApp Toko</span>
                </a>
              ) : null}

              <button
                type="button"
                onClick={() => setIsBrowsingMenu(true)}
                className="min-h-11 w-full rounded-xl bg-white/10 px-4 text-xs font-extrabold text-[#c8f53a] transition-all hover:bg-white/15 active:scale-[0.98] border border-white/15 flex items-center justify-center gap-2"
              >
                <Plus size={16} />
                <span>Pesan Menu Tambahan (Buka Menu)</span>
              </button>
            </div>
          </div>
        </div>
      );
    }

    // -------------------------------------------------------------------------
    // B. TAMPILAN JIKA SUDAH LUNAS (PAID) ATAU BAYAR TUNAI DI KASIR
    // -------------------------------------------------------------------------
    return (
      <div className={`${fontClassName} flex min-h-screen items-center justify-center bg-[#f4efe6] p-4 text-[#1d2823]`}>
        <div className="w-full max-w-md space-y-4 rounded-[32px] border-2 border-[#0b3d2e]/20 bg-white p-6 sm:p-7 text-center shadow-[0_20px_60px_rgba(11,61,46,0.12)] animate-in zoom-in-95 relative overflow-hidden">
          {/* Subtle inner dashed border */}
          <div className="pointer-events-none absolute inset-2 rounded-[26px] border border-dashed border-[#0b3d2e]/15" />

          {/* Logo / Brand Header */}
          <div className="relative z-10">
            {logoSrc ? (
              <div className="relative mx-auto mb-2.5 flex h-20 w-20 items-center justify-center rounded-full border-2 border-[#0b3d2e] bg-white p-1.5 shadow-md">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={logoSrc}
                  alt={brandName}
                  className="h-full w-full rounded-full object-contain"
                />
                <div className={`absolute -bottom-1 -right-1 flex h-6 w-6 items-center justify-center rounded-full ring-2 ring-white shadow-xs ${
                  isPaid ? "bg-emerald-600 text-white" : "bg-[#0b3d2e] text-[#c8f53a]"
                }`}>
                  <CheckCircle2 size={16} />
                </div>
              </div>
            ) : (
              <div className="mx-auto mb-2.5 flex h-14 w-14 items-center justify-center rounded-full border border-[#2f6b55] bg-[#e7f0eb] text-[#2f6b55]">
                <CheckCircle2 size={30} />
              </div>
            )}

            <h2 className="text-base font-extrabold uppercase tracking-tight text-[#0b3d2e]">
              {brandName}
            </h2>
            <p className="text-[10.5px] font-medium text-[#557064] mb-2.5">
              {isPaid
                ? "Pembayaran Diterima · Pesanan Sedang Disiapkan"
                : "Padang Panjang · Pesanan Meja Berhasil Dibuat"}
            </p>

            {/* Table Badge */}
            <div className="inline-flex items-center gap-1.5 rounded-full bg-[#0b3d2e] px-4 py-1 text-xs font-black text-[#c8f53a] shadow-xs">
              <span>MEJA {tableNo.toUpperCase()}</span>
            </div>
          </div>

          {/* Ticket Info Card */}
          <div className="relative z-10 rounded-2xl border border-[#d8e5df] bg-[#f7faf8] p-3.5 space-y-1 text-center shadow-2xs">
            <span className="text-[11px] font-bold uppercase tracking-wider text-[#557064]">
              Nomor Antrean Pesanan
            </span>
            <h1 className="text-3xl sm:text-4xl font-black text-[#0b3d2e] tracking-tight font-mono">
              #{pesananSelesai.no}
            </h1>
            <div className="pt-1.5 border-t border-[#e2ece7] flex items-center justify-between px-2">
              <span className="text-xs font-semibold text-[#557064]">Total Pembayaran:</span>
              <span className="text-xl font-black text-[#0b3d2e]">
                {formatRupiah(pesananSelesai.total)}
              </span>
            </div>
          </div>

          {/* KONDISI 1: JIKA SUDAH LUNAS (PAID) */}
          {isPaid ? (
            <div className="relative z-10 rounded-2xl border-2 border-emerald-500 bg-emerald-50/90 p-4 text-center space-y-2.5 shadow-sm animate-in zoom-in-95">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-emerald-600 text-white shadow-xs">
                <CheckCircle2 size={26} />
              </div>
              <div>
                <span className="inline-block rounded-full bg-[#c8f53a] px-3 py-0.5 text-[11px] font-black text-[#073829] uppercase tracking-wider">
                  ✓ Pembayaran Lunas
                </span>
                <h3 className="mt-1 text-base font-black text-emerald-950">
                  Pesanan Resmi Masuk ke Dapur!
                </h3>
                <p className="mt-1 text-xs text-emerald-800 leading-relaxed font-medium">
                  Terima kasih! Pembayaran Anda sudah terverifikasi lunas. Tim Dapur & Barista {brandName} saat ini sedang menyiapkan hidangan Anda.
                </p>
              </div>
            </div>
          ) : (
            /* KONDISI 2: TUNAI / MAKAN DULU */
            <div className="relative z-10 space-y-3">
              <div className="space-y-1.5 rounded-2xl border border-[#d8e5df] bg-[#f7faf8] p-4 text-center">
                <span className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-[#edf8f3] text-[#0b3d2e] font-bold text-lg mb-0.5">
                  💵
                </span>
                <p className="font-extrabold text-sm text-[#0b3d2e]">
                  Makan Dulu · Bayar di Kasir Saat Selesai
                </p>
                <p className="text-[11.5px] text-[#557064] leading-relaxed">
                  Sebutkan <strong>Meja {tableNo}</strong> atau <strong>No. Pesanan #{pesananSelesai.no}</strong> saat melakukan pembayaran di kasir.
                </p>
              </div>

              <div className="flex items-start gap-2.5 rounded-xl border border-[#bde2d1] bg-[#eef8f3] p-3 text-left">
                <span className="text-base shrink-0 mt-0.5">🍳</span>
                <p className="text-[11.5px] font-semibold text-[#0b3d2e] leading-snug">
                  Pesanan Anda sudah masuk ke antrean kasir. Kasir akan memverifikasi pesanan meja Anda sebelum diteruskan ke Dapur & Barista {brandName}.
                </p>
              </div>
            </div>
          )}

          {/* Struk Digital Link */}
          {pesananSelesai?.id && (
            <a
              href={`/receipt/${pesananSelesai.id}`}
              target="_blank"
              rel="noopener noreferrer"
              className="relative z-10 flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-[#0b3d2e]/20 bg-white px-4 font-mono text-xs font-bold text-[#0b3d2e] hover:bg-[#f0f6f3] transition-all shadow-xs"
            >
              <Receipt size={16} />
              <span>Buka Struk Digital Resmi</span>
            </a>
          )}

          {/* WhatsApp Confirmation Button */}
          {business?.phone ? (
            <a
              href={`https://wa.me/${business.phone.replace(/[^0-9]/g, "").replace(/^0/, "62")}?text=${encodeURIComponent(
                `Halo ${business.name}, saya memesan dari Meja ${tableNo} (Pesanan #${pesananSelesai.no}) dengan total ${formatRupiah(pesananSelesai.total)}. Saya sudah bayar, mohon dicek ya!`
              )}`}
              target="_blank"
              rel="noopener noreferrer"
              className="relative z-10 flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-[#25d366]/40 bg-[#f0fdf4] px-4 font-mono text-xs font-bold text-[#166534] hover:bg-[#dcfce7] transition-all shadow-xs"
            >
              <MessageSquare size={16} className="text-[#25d366]" />
              <span>Kirim Bukti Bayar ke WhatsApp Toko</span>
            </a>
          ) : null}

          {/* Action: Lihat Menu & Tambah Pesanan */}
          <div className="relative z-10 space-y-2 pt-1">
            <button
              type="button"
              onClick={() => setIsBrowsingMenu(true)}
              className="min-h-12 w-full rounded-xl bg-[#0b3d2e] px-4 text-xs font-extrabold text-[#c8f53a] transition-all hover:bg-[#124e3c] active:scale-[0.98] shadow-sm flex items-center justify-center gap-2"
            >
              <Plus size={16} />
              <span>Pesan Menu Tambahan</span>
            </button>

            <button
              type="button"
              onClick={handleStartNewOrder}
              className="min-h-10 w-full rounded-xl bg-[#e8f2ed] hover:bg-[#d5e7dd] px-4 text-[11px] font-bold text-[#0b3d2e] transition-all flex items-center justify-center gap-1.5"
            >
              <RotateCcw size={13} />
              <span>Selesai &amp; Mulai Pesanan Baru Meja Ini</span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ===========================================================================
  // LAYAR KATALOG MENU & KERANJANG BELANJA
  // ===========================================================================
  const renderCartContent = (showCloseButton: boolean) => (
    <div className="flex min-h-0 flex-col">
      <div className="flex items-start justify-between border-b border-[#dce5e0] pb-4">
        <div>
          <p className="text-[11px] font-bold uppercase text-[#6b7972]">Pesanan saat ini</p>
          <h2 className="mt-1 text-lg font-extrabold text-[#18392f]">Meja {tableNo}</h2>
          <p className="text-xs text-[#75827b]">{totalItemCount} item dipilih</p>
        </div>
        {showCloseButton && (
          <button
            type="button"
            aria-label="Tutup pesanan"
            onClick={() => setIsCartOpen(false)}
            className="flex h-11 w-11 items-center justify-center rounded-lg border border-[#d5ded9] text-[#53635b] hover:bg-[#f2f6f4]"
          >
            <X size={20} aria-hidden="true" />
          </button>
        )}
      </div>

      <div className="divide-y divide-[#e2e8e5]">
        {cartList.map(({ item, qty, note }) => (
          <div key={item.id} className="space-y-2 py-3">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <h3 className="text-sm font-bold leading-snug text-[#20352d]">{item.name}</h3>
                <p className="mt-0.5 text-xs font-semibold text-[#8c5437]">
                  {formatRupiah(item.price * qty)}
                </p>
              </div>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  aria-label={`Kurangi ${item.name}`}
                  onClick={() => handleUpdateQty(item.id, -1)}
                  className="flex h-9 w-9 items-center justify-center rounded-lg border border-[#bad0c4] text-[#1e5a45]"
                >
                  <Minus size={14} aria-hidden="true" />
                </button>
                <span className="w-8 text-center text-xs font-extrabold text-[#18392f]">{qty}</span>
                <button
                  type="button"
                  aria-label={`Tambah ${item.name}`}
                  onClick={() => handleUpdateQty(item.id, 1)}
                  className={`flex h-9 w-9 items-center justify-center rounded-lg font-bold ${
                    isMochi
                      ? "bg-[#c8f53a] text-[#0b3d2e] hover:bg-[#d9ff57]"
                      : "bg-[#0aae6f] text-white"
                  }`}
                >
                  <Plus size={14} aria-hidden="true" />
                </button>
              </div>
            </div>
            <input
              type="text"
              placeholder="Catatan pesanan (contoh: pedas, tanpa es, dll)"
              value={note}
              onChange={(event) => handleUpdateNote(item.id, event.target.value)}
              className="min-h-11 w-full rounded-lg border border-[#d5ded9] bg-[#f8faf9] px-3 text-xs text-[#263b33] outline-none focus:border-[#176c4f]"
            />
          </div>
        ))}
      </div>

      <div className="space-y-3 border-t border-[#dce5e0] pt-4">
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-1">
          <label className="space-y-1 text-xs font-semibold text-[#35483f]">
            <span className="flex items-center justify-between">
              <span>Nama pemesan <span className="text-rose-600">*</span></span>
              {nameError && (
                <span className="text-[11px] font-bold text-rose-600 animate-pulse">
                  Wajib diisi
                </span>
              )}
            </span>
            <input
              ref={customerNameInputRef}
              type="text"
              required
              placeholder="Masukkan nama Anda"
              value={customerName}
              onChange={(event) => {
                setCustomerName(event.target.value);
                if (event.target.value.trim()) setNameError(false);
              }}
              className={`min-h-11 w-full rounded-lg border bg-white px-3 text-sm outline-none transition-colors ${
                nameError
                  ? "border-rose-500 ring-2 ring-rose-200"
                  : "border-[#cfd9d4] focus:border-[#176c4f]"
              }`}
            />
          </label>
          <label className="space-y-1 text-xs font-semibold text-[#35483f]">
            <span>Nomor WhatsApp <span className="font-normal text-[#849089]">(opsional)</span></span>
            <input
              type="tel"
              placeholder="08xxxxxxxxxx"
              value={customerPhone}
              onChange={(event) => setCustomerPhone(event.target.value)}
              className="min-h-11 w-full rounded-lg border border-[#cfd9d4] bg-white px-3 text-sm outline-none focus:border-[#176c4f]"
            />
          </label>
        </div>

        <fieldset>
          <legend className="mb-1.5 text-xs font-semibold text-[#35483f]">Pilihan Cara Bayar</legend>
          <div className="grid grid-cols-2 gap-2">
            {[
              { id: "qris" as const, label: "QRIS dari HP", hint: "Bayar langsung di HP" },
              { id: "cash" as const, label: "Bayar di Kasir", hint: "Makan dulu, bayar selesai" },
            ].map((method) => (
              <button
                key={method.id}
                type="button"
                onClick={() => setCaraBayar(method.id)}
                className={`min-h-11 rounded-xl border p-2.5 text-left transition-all ${
                  caraBayar === method.id
                    ? isMochi
                      ? "border-[#0b3d2e] bg-[#0b3d2e] text-[#c8f53a] shadow-sm scale-[1.02]"
                      : "border-[#176c4f] bg-[#e7f4ee] text-[#174a38] scale-[1.02]"
                    : "border-[#d5ded9] bg-white text-[#5e6c65] hover:border-[#b0c4ba]"
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="block text-xs font-black">{method.label}</span>
                  {caraBayar === method.id && (
                    <CheckCircle2 size={14} className={isMochi ? "text-[#c8f53a]" : "text-[#174a38]"} />
                  )}
                </div>
                <span className={`block text-[10px] mt-0.5 ${caraBayar === method.id ? "text-white/90" : "text-[#7b8a82]"}`}>
                  {method.hint}
                </span>
              </button>
            ))}
          </div>

          {caraBayar === "qris" ? (
            <p className="mt-2 text-[10.5px] text-[#2c5243] font-medium bg-[#eaf4ef] rounded-lg p-2 border border-[#cbe0d5]">
              ✨ <strong>QRIS resmi</strong> dengan nominal pas otomatis langsung muncul di layar setelah tombol ditekan.
            </p>
          ) : (
            <p className="mt-2 text-[10.5px] text-[#556960] font-medium bg-[#f5f8f6] rounded-lg p-2 border border-[#dbe6df]">
              💵 Pesanan dikirim ke dapur sekarang. Anda dapat membayar tunai di kasir setelah selesai bersantap.
            </p>
          )}
        </fieldset>

        <div className="flex items-center justify-between border-t border-[#dce5e0] pt-3">
          <div>
            <span className="block text-[10px] font-semibold uppercase text-[#78857e]">Total</span>
            <span className="text-xl font-extrabold text-[#18392f]">{formatRupiah(cartTotal)}</span>
          </div>
          <button
            type="button"
            onClick={handleCheckout}
            disabled={isSubmitting}
            className={`min-h-12 rounded-xl px-5 text-sm font-black transition-all disabled:cursor-not-allowed disabled:opacity-50 flex items-center justify-center gap-2 shadow-md ${
              isMochi
                ? "bg-[#c8f53a] text-[#0b3d2e] hover:bg-[#d9ff57] shadow-[#c8f53a]/25 active:scale-[0.98]"
                : "bg-[#0aae6f] text-white hover:bg-[#079760]"
            }`}
          >
            {isSubmitting ? (
              <>
                <Loader2 size={16} className="animate-spin" />
                <span>Memproses...</span>
              </>
            ) : caraBayar === "qris" ? (
              <>
                <span>Lanjut Bayar QRIS ({formatRupiah(cartTotal)})</span>
                <ArrowRight size={15} />
              </>
            ) : (
              <span>Kirim Pesanan ({formatRupiah(cartTotal)})</span>
            )}
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <div className={`${fontClassName} ${isMochi ? "mochi-ui mochi-shell" : ""} min-h-screen bg-[#edf4f0] pb-24 text-[#1c2d26] lg:pb-0`}>
      {business?.is_demo && (
        <p className="bg-[#f1e5b9] px-4 py-2 text-center text-[10px] font-bold uppercase text-[#6d5520]">
          Demo, tidak untuk pembayaran sungguhan
        </p>
      )}

      {/* STICKY TOP ALERT: JIKA ADA PESANAN AKTIF DARI MEJA INI */}
      {pesananSelesai && (
        <aside
          role="region"
          aria-label="Status antrean pesanan aktif"
          className="sticky top-0 z-40 bg-gradient-to-r from-[#07281e] via-[#0b3d2e] to-[#041a13] text-white px-4 py-2.5 border-b border-[#c8f53a]/30 shadow-md backdrop-blur-md"
        >
          <div className="mx-auto flex max-w-6xl items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <span className="flex h-2.5 w-2.5 relative shrink-0">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#c8f53a] opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-[#c8f53a]"></span>
              </span>
              <p className="text-xs font-bold truncate">
                Pesanan Meja {tableNo} (#{pesananSelesai.no}) ·{" "}
                <span className="text-[#c8f53a] font-black">
                  {paymentStatus === "paid" ? "✓ LUNAS" : "Menunggu Bayar"}
                </span>
              </p>
            </div>
            <button
              type="button"
              onClick={() => setIsBrowsingMenu(false)}
              className="shrink-0 rounded-full bg-[#c8f53a] hover:bg-[#d9ff57] text-[#073829] px-3 py-1 text-[11px] font-black transition-all active:scale-95 shadow-xs"
            >
              Lihat QRIS / Status →
            </button>
          </div>
        </aside>
      )}

      <header className={`sticky ${pesananSelesai ? "top-10" : "top-0"} z-30 border-b backdrop-blur-md ${
        isMochi ? "border-[#07281e] bg-[#0b3d2e] text-white shadow-sm" : "mochi-header border-[#d8e1dc] bg-white/95"
      }`}>
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3 lg:px-6">
          <div className="flex min-w-0 items-center gap-3">
            <BusinessMark
              name={business?.name}
              logoUrl={business?.logo_url}
              brandColor={business?.brand_color}
              className={`rounded-full border ${isMochi ? "border-emerald-400/40 shadow-xs" : "border-[#cdd8d2]"}`}
            />
            <div className="min-w-0">
              <h1 className={`truncate text-base font-extrabold ${isMochi ? "text-white" : "text-[#18392f]"}`}>
                {business?.name || "Toko Kami"}
              </h1>
              <span className={`block text-[11px] font-medium ${isMochi ? "text-emerald-200/80" : "text-[#718078]"}`}>
                Menu digital · Meja {tableNo}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* WhatsApp Bantuan / Panggil Pelayan */}
            {business?.phone && (
              <a
                href={`https://wa.me/${business.phone.replace(/[^0-9]/g, "").replace(/^0/, "62")}?text=${encodeURIComponent(
                  `Halo ${business?.name || "Admin"}, saya tamu di Meja ${tableNo} butuh bantuan / pelayan.`
                )}`}
                target="_blank"
                rel="noopener noreferrer"
                className={`flex items-center gap-1.5 rounded-xl px-2.5 sm:px-3 py-2 text-xs font-black transition-all shadow-xs border ${
                  isMochi
                    ? "bg-emerald-500/20 hover:bg-emerald-500/30 text-[#c8f53a] border-emerald-400/30"
                    : "bg-[#eef7f2] hover:bg-[#dcf0e5] text-[#166534] border-[#c0decb]"
                }`}
                title="Panggil Pelayan / Hubungi Kasir via WhatsApp"
              >
                <MessageSquare size={14} className={isMochi ? "text-[#c8f53a]" : "text-[#25d366]"} />
                <span className="hidden sm:inline">Panggil Pelayan</span>
              </a>
            )}

            {pesananSelesai && (
              <button
                type="button"
                onClick={() => setIsBrowsingMenu(false)}
                className="hidden sm:flex items-center gap-1.5 rounded-xl bg-white/10 px-3 py-2 text-xs font-extrabold text-[#c8f53a] border border-white/15 hover:bg-white/15 transition-all"
              >
                <Receipt size={14} />
                <span>Antrean #{pesananSelesai.no}</span>
              </button>
            )}

            <div className={`flex h-11 min-w-14 flex-col items-center justify-center rounded-xl px-3 ${
              isMochi ? "bg-[#c8f53a] text-[#0b3d2e] shadow-sm font-mono" : "border border-[#c8d4ce] bg-[#f5f8f6]"
            }`}>
              <span className={`text-[8px] font-bold uppercase ${isMochi ? "text-[#0b3d2e]/80" : "text-[#728078]"}`}>Meja</span>
              <span className={`text-sm font-extrabold ${isMochi ? "text-[#0b3d2e]" : "text-[#18392f]"}`}>{tableNo}</span>
            </div>
          </div>
        </div>
      </header>

      <main className="mx-auto grid max-w-6xl gap-5 px-3 py-4 lg:grid-cols-[minmax(0,1fr)_340px] lg:px-6 lg:py-6">
        <div className="min-w-0 space-y-4">
          {/* VIP Member Registration Shortcut Banner */}
          <a
            href={`/loyalty/register?toko=${encodeURIComponent(business?.store_code || "MOCHIKAFE")}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-between gap-3 rounded-2xl bg-gradient-to-r from-[#0b3d2e] via-[#072a1f] to-[#041a13] p-3 text-white shadow-md border border-emerald-500/30 transition-all hover:scale-[1.01] active:scale-[0.99] group"
          >
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-[#c8f53a] text-[#073829] font-black text-xs shadow-xs">
                <Crown size={15} />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="text-xs font-black tracking-tight text-white">Daftar Member Mochi</span>
                  <span className="rounded bg-[#c8f53a] px-1.5 py-0.2 font-mono text-[8.5px] font-black text-[#073829]">VIP</span>
                </div>
                <p className="text-[10.5px] text-emerald-200/80 truncate font-medium">
                  Kumpulkan poin belanja &amp; nikmati traktiran menu spesial!
                </p>
              </div>
            </div>
            <div className="flex items-center gap-1 text-[11px] font-bold text-[#c8f53a] shrink-0 group-hover:translate-x-0.5 transition-transform">
              <span>Daftar</span>
              <ArrowRight size={13} strokeWidth={2.5} />
            </div>
          </a>

          <div className="relative">
            <Search
              size={19}
              aria-hidden="true"
              className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-[#697870]"
            />
            <input
              type="search"
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder="Cari menu atau kategori"
              aria-label="Cari menu atau kategori"
              className="min-h-12 w-full rounded-lg border border-[#cfdad4] bg-white pl-11 pr-11 text-sm outline-none transition-colors placeholder:text-[#929d97] focus:border-[#176c4f]"
            />
            {searchQuery && (
              <button
                type="button"
                aria-label="Hapus pencarian"
                onClick={() => setSearchQuery("")}
                className="absolute right-0 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center text-[#68766f]"
              >
                <X size={18} aria-hidden="true" />
              </button>
            )}
          </div>

          <section aria-labelledby="category-title" className="space-y-2.5">
            <div className="flex items-end justify-between">
              <h2 id="category-title" className="text-sm font-extrabold text-[#20372e]">Kategori</h2>
              <span className="text-[10px] font-medium text-[#7b8881]">Geser untuk melihat lainnya</span>
            </div>
            <nav
              aria-label="Kategori menu"
              className="-mx-3 flex gap-2 overflow-x-auto px-3 pb-1 scrollbar-none lg:mx-0 lg:px-0"
            >
              {categorizedMenu.map(({ category }) => {
                const CategoryIcon = getCategoryIcon(category.name);
                const isActive = activeCategory === category.id && !normalizedSearch;
                return (
                  <button
                    key={category.id}
                    type="button"
                    onClick={() => {
                      setSearchQuery("");
                      selectCategory(category.id);
                    }}
                    className={`flex h-[82px] w-[104px] min-w-[104px] flex-col items-center justify-center gap-1.5 rounded-2xl border px-2 text-center transition-all ${
                      isActive
                        ? isMochi
                          ? "border-[#c8f53a] bg-[#c8f53a] text-[#0b3d2e] font-extrabold shadow-sm scale-102"
                          : "border-[#176c4f] bg-[#e4f4ed] text-[#14523d]"
                        : "border-[#d5ded9] bg-white text-[#526159] hover:border-[#176c4f]"
                    }`}
                  >
                    <CategoryIcon size={22} strokeWidth={1.8} aria-hidden="true" />
                    <span className="line-clamp-2 text-[10px] font-bold leading-tight">{category.name}</span>
                  </button>
                );
              })}
            </nav>
          </section>

          <section id="menu-results" className="scroll-mt-24 space-y-3">
            <div className="flex items-end justify-between border-b border-[#cbd7d1] pb-2">
              <h2 className="min-w-0 pr-3 text-xl font-extrabold leading-tight text-[#18392f]">
                {visibleSectionTitle}
              </h2>
              <span className="shrink-0 text-[10px] font-medium text-[#78857e]">
                {visibleItems.length} pilihan
              </span>
            </div>

            {visibleItems.length > 0 ? (
              <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 xl:grid-cols-4">
                {visibleItems.map((item) => {
                  const inCart = cart[item.id];
                  const categoryName = categories.find((category) => category.id === item.category_id)?.name ?? "Menu";
                  const CategoryIcon = getCategoryIcon(categoryName);
                  const hasPhoto = item.photo_url && item.photo_url !== PLACEHOLDER_MENU;
                  const isAvailable = item.is_available !== false;

                  return (
                    <article
                      key={item.id}
                      className={`group flex min-h-[250px] min-w-0 flex-col overflow-hidden rounded-xl border transition-all ${
                        isAvailable
                          ? "border-[#d7e0db] bg-white shadow-[0_5px_18px_rgba(25,67,52,0.06)] hover:border-[#176c4f]/40 hover:shadow-[0_8px_24px_rgba(25,67,52,0.1)]"
                          : "border-gray-200 bg-gray-50/80 opacity-75"
                      }`}
                    >
                      <button
                        type="button"
                        onClick={() => isAvailable && handleOpenDetailModal(item)}
                        disabled={!isAvailable}
                        aria-label={`Lihat foto dan detail ${item.name}`}
                        className={`relative aspect-[4/3] w-full overflow-hidden border-b border-[#e0e7e3] bg-[#e8f2ed] p-0 text-left block focus:outline-none ${
                          isAvailable ? "cursor-pointer" : "cursor-not-allowed"
                        }`}
                      >
                        {hasPhoto ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={item.photo_url ?? undefined}
                            alt={item.name}
                            loading="lazy"
                            className={`h-full w-full object-cover transition-transform duration-300 ${
                              isAvailable ? "group-hover:scale-105" : "grayscale opacity-60"
                            }`}
                          />
                        ) : (
                          <div className={`flex h-full flex-col items-center justify-center gap-2 ${isAvailable ? "text-[#34745c]" : "text-gray-400"}`}>
                            <CategoryIcon size={36} strokeWidth={1.5} aria-hidden="true" />
                            <span className="max-w-[85%] text-center text-[9px] font-bold uppercase leading-tight text-[#698278]">
                              {categoryName}
                            </span>
                          </div>
                        )}

                        {isAvailable ? (
                          <span className="absolute bottom-2 right-2 flex items-center gap-1 rounded-full bg-black/60 px-2 py-0.5 text-[9px] font-semibold text-white backdrop-blur-xs shadow-xs">
                            <Eye size={11} aria-hidden="true" />
                            <span>Detail</span>
                          </span>
                        ) : (
                          <span className="absolute inset-0 bg-black/45 flex items-center justify-center">
                            <span className="rounded-full bg-rose-600 px-3 py-1 text-[11px] font-black text-white shadow-md uppercase tracking-wider">
                              HABIS
                            </span>
                          </span>
                        )}
                      </button>

                      <div className="flex flex-1 flex-col p-2.5">
                        <button
                          type="button"
                          onClick={() => isAvailable && handleOpenDetailModal(item)}
                          disabled={!isAvailable}
                          className="text-left w-full group/title disabled:cursor-not-allowed"
                        >
                          <h3 className={`break-words text-[14px] font-extrabold leading-tight transition-colors ${
                            isAvailable ? "text-[#18392f] group-hover/title:text-[#0b3d2e]" : "text-gray-500"
                          }`}>
                            {item.name}
                          </h3>
                        </button>
                        {item.description && (
                          <p
                            onClick={() => isAvailable && handleOpenDetailModal(item)}
                            className={`mt-1 line-clamp-2 text-[10px] leading-relaxed transition-colors ${
                              isAvailable ? "cursor-pointer text-[#78857e] hover:text-[#495e54]" : "text-gray-400"
                            }`}
                          >
                            {item.description}
                          </p>
                        )}

                        <div className="mt-auto pt-3">
                          {!isAvailable ? (
                            <div className="flex items-center justify-between gap-2 pt-1">
                              <span className="text-xs font-mono font-bold text-gray-400 line-through">
                                {formatRupiah(item.price)}
                              </span>
                              <span className="rounded-lg bg-rose-100 border border-rose-200 px-2 py-1 text-[10px] font-black text-rose-700 uppercase">
                                Sold Out
                              </span>
                            </div>
                          ) : inCart ? (
                            <>
                              <span className="block text-[13px] font-extrabold text-[#8f5032]">
                                {formatRupiah(item.price)}
                              </span>
                              <div className="mt-2 grid w-full grid-cols-[44px_minmax(0,1fr)_44px] items-center">
                                <button
                                  type="button"
                                  aria-label={`Kurangi ${item.name}`}
                                  onClick={() => handleUpdateQty(item.id, -1)}
                                  className="flex h-11 w-11 items-center justify-center rounded-lg border border-[#b8cdc3] text-[#1b5f47]"
                                >
                                  <Minus size={14} aria-hidden="true" />
                                </button>
                                <span className="text-center text-xs font-extrabold">{inCart.qty}</span>
                                <button
                                  type="button"
                                  aria-label={`Tambah ${item.name}`}
                                  onClick={() => handleUpdateQty(item.id, 1)}
                                  className={`flex h-11 w-11 items-center justify-center rounded-lg font-bold ${
                                    isMochi
                                      ? "bg-[#c8f53a] text-[#0b3d2e] hover:bg-[#d9ff57]"
                                      : "bg-[#0aae6f] text-white"
                                  }`}
                                >
                                  <Plus size={15} aria-hidden="true" />
                                </button>
                              </div>
                            </>
                          ) : (
                            <div className="flex items-end justify-between gap-2">
                              <span className="min-w-0 text-[13px] font-extrabold text-[#8f5032]">
                                {formatRupiah(item.price)}
                              </span>
                              <button
                                type="button"
                                aria-label={`Tambah ${item.name} ke pesanan`}
                                title={`Tambah ${item.name}`}
                                onClick={() => handleAddToCart(item)}
                                className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl transition-all focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 ${
                                  isMochi
                                    ? "bg-[#c8f53a] text-[#0b3d2e] hover:bg-[#d9ff57] shadow-sm active:scale-95 focus-visible:outline-[#c8f53a]"
                                    : "bg-[#0aae6f] text-white hover:bg-[#079760] focus-visible:outline-[#176c4f]"
                                }`}
                              >
                                <Plus size={19} strokeWidth={2.5} aria-hidden="true" />
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    </article>
                  );
                })}
              </div>
            ) : (
              <div className="rounded-lg border border-[#d5ded9] bg-white px-5 py-10 text-center">
                <p className="text-sm font-extrabold text-[#284238]">Menu tidak ditemukan</p>
                <p className="mt-1 text-xs text-[#78857e]">Coba nama menu atau kategori lain.</p>
              </div>
            )}
          </section>
        </div>

        <aside className="hidden self-start rounded-lg border border-[#d5ded9] bg-white p-4 shadow-[0_8px_24px_rgba(25,67,52,0.07)] lg:sticky lg:top-24 lg:block">
          {cartList.length > 0 ? (
            renderCartContent(false)
          ) : (
            <div className="py-12 text-center">
              <ShoppingBag size={28} aria-hidden="true" className="mx-auto text-[#759087]" />
              <h2 className="mt-3 text-sm font-extrabold text-[#284238]">Pesanan masih kosong</h2>
              <p className="mx-auto mt-1 max-w-48 text-xs leading-relaxed text-[#7a8780]">
                Tekan tombol tambah pada menu yang ingin dipesan.
              </p>
            </div>
          )}
        </aside>
      </main>

      {/* MOBILE BOTTOM FLOATING BAR: KERANJANG ATAU STATUS PESANAN */}
      {cartList.length > 0 ? (
        <div className="fixed inset-x-0 bottom-0 z-40 border-t border-[#d1ddd7] bg-white px-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] pt-3 shadow-[0_-8px_24px_rgba(25,67,52,0.12)] lg:hidden">
          <button
            type="button"
            onClick={() => setIsCartOpen(true)}
            className={`mx-auto flex min-h-12 w-full max-w-md items-center justify-between rounded-xl px-4 transition-transform active:scale-[0.99] ${
              isMochi
                ? "bg-[#0b3d2e] text-white border border-emerald-600/40 shadow-xl"
                : "bg-[#176c4f] text-white"
            }`}
          >
            <span className="flex items-center gap-2 text-left">
              <span className={`relative flex h-8 w-8 items-center justify-center rounded-lg ${isMochi ? "bg-white/10" : "bg-white/12"}`}>
                <ShoppingBag size={18} aria-hidden="true" />
                <span className={`absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[9px] font-black ${
                  isMochi ? "bg-[#c8f53a] text-[#0b3d2e]" : "bg-[#d9f52a] text-[#18392f]"
                }`}>
                  {totalItemCount}
                </span>
              </span>
              <span>
                <span className="block text-xs font-extrabold">Lihat pesanan</span>
                <span className={`block text-[10px] ${isMochi ? "text-emerald-200/80" : "text-white/75"}`}>Meja {tableNo}</span>
              </span>
            </span>
            <span className={`text-sm font-extrabold ${isMochi ? "text-[#c8f53a]" : "text-white"}`}>{formatRupiah(cartTotal)}</span>
          </button>
        </div>
      ) : pesananSelesai ? (
        <div className="fixed inset-x-0 bottom-0 z-40 border-t border-[#d1ddd7] bg-white px-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] pt-3 shadow-[0_-8px_24px_rgba(25,67,52,0.12)] lg:hidden">
          <button
            type="button"
            onClick={() => setIsBrowsingMenu(false)}
            className="mx-auto flex min-h-12 w-full max-w-md items-center justify-between rounded-xl bg-[#0b3d2e] text-white px-4 border border-[#c8f53a]/40 shadow-xl active:scale-[0.99]"
          >
            <span className="flex items-center gap-2 text-left">
              <span className="flex h-3 w-3 relative shrink-0">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#c8f53a] opacity-75"></span>
                <span className="relative inline-flex rounded-full h-3 w-3 bg-[#c8f53a]"></span>
              </span>
              <span>
                <span className="block text-xs font-black text-[#c8f53a]">Antrean Meja #{pesananSelesai.no}</span>
                <span className="block text-[10px] text-emerald-200/80">
                  {paymentStatus === "paid" ? "Pembayaran Lunas ✓" : "Menunggu Pembayaran QRIS"}
                </span>
              </span>
            </span>
            <span className="text-xs font-extrabold bg-white/10 px-3 py-1.5 rounded-lg text-white">
              Buka Layar →
            </span>
          </button>
        </div>
      ) : null}

      {/* MOBILE CART DRAWER */}
      {isCartOpen && cartList.length > 0 && (
        <div className="fixed inset-0 z-50 flex items-end bg-black/60 backdrop-blur-xs lg:hidden" role="dialog" aria-modal="true" aria-label="Rincian pesanan">
          <div
            onClick={() => setIsCartOpen(false)}
            className="absolute inset-0 cursor-default"
          />
          <div className="relative z-10 max-h-[88dvh] w-full overflow-y-auto rounded-t-3xl bg-white p-4 pb-[calc(1rem+env(safe-area-inset-bottom))] shadow-[0_-16px_40px_rgba(17,42,33,0.3)] animate-in slide-in-from-bottom duration-200">
            <div className="mx-auto mb-3 h-1.5 w-12 rounded-full bg-[#cbd6d0]" />
            {renderCartContent(true)}
          </div>
        </div>
      )}

      {/* DETAIL MENU POPUP MODAL */}
      {selectedMenuItem && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/70 backdrop-blur-xs animate-in fade-in-50"
          role="dialog"
          aria-modal="true"
          aria-labelledby="modal-menu-title"
        >
          <div
            onClick={() => setSelectedMenuItem(null)}
            className="absolute inset-0 cursor-default"
          />

          <div className="relative z-10 flex max-h-[90vh] w-full max-w-md flex-col overflow-hidden rounded-3xl bg-white shadow-2xl animate-in zoom-in-95 duration-150">
            <button
              type="button"
              aria-label="Tutup detail menu"
              onClick={() => setSelectedMenuItem(null)}
              className="absolute right-3 top-3 z-20 flex h-9 w-9 items-center justify-center rounded-full bg-black/55 text-white backdrop-blur-md transition-transform hover:scale-105 active:scale-95 hover:bg-black/75 shadow-md"
            >
              <X size={18} strokeWidth={2.5} />
            </button>

            <div className="flex-1 overflow-y-auto">
              <div className="relative aspect-[4/3] w-full overflow-hidden bg-[#e8f2ed]">
                {selectedMenuItem.photo_url && selectedMenuItem.photo_url !== PLACEHOLDER_MENU ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={selectedMenuItem.photo_url}
                    alt={selectedMenuItem.name}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <div className="flex h-full flex-col items-center justify-center gap-2 text-[#34745c]">
                    <Package size={48} strokeWidth={1.5} aria-hidden="true" />
                    <span className="text-xs font-bold uppercase tracking-wider text-[#698278]">
                      Foto Menu
                    </span>
                  </div>
                )}
                <div className="absolute bottom-3 left-3 flex items-center gap-1.5 rounded-full bg-[#0b3d2e]/90 px-3 py-1 text-[11px] font-bold text-white backdrop-blur-md shadow-md">
                  <span className="inline-block h-2 w-2 rounded-full bg-[#c8f53a]" />
                  <span>
                    {categories.find((c) => c.id === selectedMenuItem.category_id)?.name ?? "Menu"}
                  </span>
                </div>
              </div>

              <div className="space-y-3.5 p-4 sm:p-5">
                <div>
                  <div className="flex items-start justify-between gap-3">
                    <h2 id="modal-menu-title" className="text-lg sm:text-xl font-extrabold leading-tight text-[#18392f]">
                      {selectedMenuItem.name}
                    </h2>
                    <span className="shrink-0 text-base sm:text-lg font-black text-[#8f5032]">
                      {formatRupiah(selectedMenuItem.price)}
                    </span>
                  </div>
                </div>

                <div className="rounded-2xl border border-[#dce6e1] bg-[#f7faf8] p-3.5">
                  <span className="block text-[10px] font-bold uppercase tracking-wider text-[#497060]">
                    Keterangan Menu
                  </span>
                  <p className="mt-1 text-xs sm:text-sm leading-relaxed text-[#2c4b3f]">
                    {selectedMenuItem.description || "Menu pilihan istimewa dengan bahan-bahan berkualitas khas Mochi Cafe n Resto."}
                  </p>
                </div>

                <div>
                  <label htmlFor="modal-item-note" className="block text-xs font-bold text-[#1e3e33]">
                    Catatan Pesanan <span className="font-normal text-[#78857e]">(opsional)</span>
                  </label>
                  <input
                    id="modal-item-note"
                    type="text"
                    value={modalNote}
                    onChange={(e) => setModalNote(e.target.value)}
                    placeholder="Contoh: pedas sedang, es dipisah, tanpa seledri..."
                    maxLength={150}
                    className="mt-1.5 w-full rounded-xl border border-[#cbd9d2] bg-white px-3 py-2.5 text-xs sm:text-sm text-[#18392f] placeholder:text-[#95a39c] outline-none focus:border-[#0b3d2e] focus:ring-1 focus:ring-[#0b3d2e] transition-all"
                  />
                </div>
              </div>
            </div>

            <div className="border-t border-[#dce6e1] bg-white p-3.5 sm:p-4 shadow-[0_-4px_16px_rgba(0,0,0,0.05)]">
              <div className="flex items-center gap-3">
                <div className="flex h-12 items-center rounded-xl border border-[#bad0c4] bg-[#f6f9f7] px-1 shadow-xs">
                  <button
                    type="button"
                    aria-label="Kurangi jumlah"
                    onClick={() => setModalQty((prev) => Math.max(1, prev - 1))}
                    disabled={modalQty <= 1}
                    className="flex h-10 w-10 items-center justify-center rounded-lg text-[#18392f] disabled:opacity-30 hover:bg-white active:scale-95 transition-all"
                  >
                    <Minus size={15} strokeWidth={2.5} />
                  </button>
                  <span className="w-9 text-center text-sm font-extrabold text-[#18392f]">
                    {modalQty}
                  </span>
                  <button
                    type="button"
                    aria-label="Tambah jumlah"
                    onClick={() => setModalQty((prev) => prev + 1)}
                    className="flex h-10 w-10 items-center justify-center rounded-lg text-[#18392f] hover:bg-white active:scale-95 transition-all"
                  >
                    <Plus size={15} strokeWidth={2.5} />
                  </button>
                </div>

                <button
                  type="button"
                  onClick={handleSaveModalItem}
                  className={`flex h-12 flex-1 items-center justify-center gap-2 rounded-xl px-4 text-xs sm:text-sm font-extrabold shadow-md transition-all active:scale-[0.98] ${
                    isMochi
                      ? "bg-[#c8f53a] text-[#0b3d2e] hover:bg-[#d9ff57] shadow-[#c8f53a]/25"
                      : "bg-[#0aae6f] text-white hover:bg-[#079760]"
                  }`}
                >
                  <ShoppingBag size={17} strokeWidth={2.2} />
                  <span>
                    {cart[selectedMenuItem.id] ? "Simpan Pesanan" : "Tambah ke Keranjang"}
                  </span>
                </button>
              </div>

              {cart[selectedMenuItem.id] && (
                <button
                  type="button"
                  onClick={() => {
                    handleUpdateQty(selectedMenuItem.id, -cart[selectedMenuItem.id].qty);
                    setSelectedMenuItem(null);
                  }}
                  className="mt-2 w-full text-center text-[11px] font-semibold text-rose-600 hover:underline"
                >
                  Hapus menu ini dari pesanan
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
