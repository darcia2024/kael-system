"use client";

import { useState } from "react";
import Image from "next/image";
import {
  ArrowRight,
  BarChart3,
  Calculator,
  Check,
  CheckCircle2,
  Coffee,
  CreditCard,
  Crown,
  DollarSign,
  FileText,
  Gift,
  Keyboard,
  Laptop,
  MessageCircle,
  Nfc,
  Plus,
  Printer,
  QrCode,
  RotateCcw,
  Scale,
  Send,
  ShoppingBag,
  Smartphone,
  Sparkles,
  Star,
  Trash2,
  TrendingUp,
  UsersRound,
  Utensils,
  Zap,
} from "lucide-react";
import { Container } from "@/components/ui/section";
import { Reveal } from "@/components/ui/reveal";
import { cta } from "@/lib/site";

export function ServiceMockups() {
  const [activeService, setActiveService] = useState<"review" | "pos" | "hpp" | "wa">("review");

  // -------------------------------------------------------------
  // State for Service 1: NFC Review Simulator
  // -------------------------------------------------------------
  const [reviewState, setReviewState] = useState<"tap" | "rating" | "submitted">("tap");
  const [selectedRating, setSelectedRating] = useState(5);
  const [selectedTags, setSelectedTags] = useState<string[]>(["Kopi Enak Banget ✨", "Pelayanan Kasir Cepat ⚡"]);

  const toggleTag = (tag: string) => {
    setSelectedTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]
    );
  };

  // -------------------------------------------------------------
  // State for Service 2: POS Kasir, Menu QR Meja (Self-Order) & Dashboard
  // -------------------------------------------------------------
  const posMenuItems = [
    { id: "kopi-susu", name: "Kopi Susu Aren", price: 18000, category: "Coffee", desc: "Espresso, susu segar, gula aren organik" },
    { id: "croissant", name: "Butter Croissant", price: 22000, category: "Bakery", desc: "Pastry renyah butter Prancis autentik" },
    { id: "matcha", name: "Matcha Latte Ice", price: 24000, category: "Non-Coffee", desc: "Uji matcha murni & fresh milk" },
    { id: "fries", name: "Truffle Fries", price: 20000, category: "Snack", desc: "Kentang goreng gurih taburan truffle" },
  ];
  const [posViewMode, setPosViewMode] = useState<"menu" | "pos" | "dashboard">("menu");
  const [dashboardPeriod, setDashboardPeriod] = useState<"today" | "month">("month");

  // State Menu QR Meja (Tamu)
  const [selectedTable, setSelectedTable] = useState("Meja 08");
  const [guestCategory, setGuestCategory] = useState<"Semua" | "Coffee" | "Bakery" | "Non-Coffee" | "Snack">("Semua");
  const [guestCart, setGuestCart] = useState<{ [key: string]: number }>({
    "kopi-susu": 2,
    croissant: 1,
  });
  const [guestPaymentState, setGuestPaymentState] = useState<"idle" | "qris_modal" | "qris_paid" | "cashier_ticket">("idle");

  // State Kasir POS
  const [posCart, setPosCart] = useState<{ [key: string]: number }>({
    "kopi-susu": 2,
    croissant: 1,
  });
  const [receiptPrinted, setReceiptPrinted] = useState(false);
  const [cashierActiveTable, setCashierActiveTable] = useState("Meja 08");
  const [cashierPaymentStatus, setCashierPaymentStatus] = useState<"unpaid" | "qris_paid">("unpaid");

  // Helper Tamu Menu QR
  const addGuestToCart = (id: string) => {
    setGuestCart((prev) => ({ ...prev, [id]: (prev[id] || 0) + 1 }));
    setGuestPaymentState("idle");
  };

  const removeGuestFromCart = (id: string) => {
    setGuestCart((prev) => {
      const next = { ...prev };
      if (next[id] > 1) {
        next[id] -= 1;
      } else {
        delete next[id];
      }
      return next;
    });
    setGuestPaymentState("idle");
  };

  const guestTotal = Object.entries(guestCart).reduce((acc, [id, qty]) => {
    const item = posMenuItems.find((m) => m.id === id);
    return acc + (item ? item.price * qty : 0);
  }, 0);

  const guestItemCount = Object.values(guestCart).reduce((acc, q) => acc + q, 0);

  const handleGuestPayQris = () => {
    setGuestPaymentState("qris_paid");
    setPosCart({ ...guestCart });
    setCashierActiveTable(selectedTable);
    setCashierPaymentStatus("qris_paid");
    setReceiptPrinted(false);
  };

  const handleGuestPayAtCashier = () => {
    setGuestPaymentState("cashier_ticket");
    setPosCart({ ...guestCart });
    setCashierActiveTable(selectedTable);
    setCashierPaymentStatus("unpaid");
    setReceiptPrinted(false);
  };

  // Helper Kasir POS
  const addToCart = (id: string) => {
    setPosCart((prev) => ({ ...prev, [id]: (prev[id] || 0) + 1 }));
    setReceiptPrinted(false);
  };

  const removeFromCart = (id: string) => {
    setPosCart((prev) => {
      const next = { ...prev };
      if (next[id] > 1) {
        next[id] -= 1;
      } else {
        delete next[id];
      }
      return next;
    });
    setReceiptPrinted(false);
  };

  const posTotal = Object.entries(posCart).reduce((acc, [id, qty]) => {
    const item = posMenuItems.find((m) => m.id === id);
    return acc + (item ? item.price * qty : 0);
  }, 0);

  // -------------------------------------------------------------
  // State for Service 3: Interactive Real-World HPP & Recipe Costing Engine
  // -------------------------------------------------------------
  type RecipeKey = "kopsu" | "croissant" | "matcha";
  type SupplierPresetKey = "cheesecake" | "dimsum" | "parfum";

  interface IngredientItem {
    id: string;
    name: string;
    unit: string;
    unitPrice: number; // e.g. price per 1g or 1ml
    qty: number;
    packageInfo: string;
  }

  const initialRecipes: Record<
    RecipeKey,
    {
      name: string;
      category: string;
      defaultSellingPrice: number;
      dailySalesEst: number;
      ingredients: IngredientItem[];
    }
  > = {
    kopsu: {
      name: "Kopi Susu Gula Aren (16oz)",
      category: "Coffee Special",
      defaultSellingPrice: 22000,
      dailySalesEst: 45,
      ingredients: [
        { id: "beans", name: "Biji Kopi Espresso Blend", unit: "gram", unitPrice: 160, qty: 18, packageInfo: "Rp 160k/kg" },
        { id: "milk", name: "Fresh Milk UHT", unit: "ml", unitPrice: 19, qty: 120, packageInfo: "Rp 19k/L" },
        { id: "sugar", name: "Gula Aren Cair Organik", unit: "ml", unitPrice: 35, qty: 25, packageInfo: "Rp 35k/L" },
        { id: "cup", name: "Cup 16oz + Sedotan + Seal", unit: "set", unitPrice: 950, qty: 1, packageInfo: "Rp 950/set" },
      ],
    },
    croissant: {
      name: "Butter Croissant Artisan",
      category: "Bakery / Pastry",
      defaultSellingPrice: 28000,
      dailySalesEst: 25,
      ingredients: [
        { id: "flour", name: "Tepung Terigu Protein Tinggi", unit: "gram", unitPrice: 14, qty: 80, packageInfo: "Rp 14k/kg" },
        { id: "butter", name: "French Butter Elle & Vire", unit: "gram", unitPrice: 230, qty: 45, packageInfo: "Rp 115k/500g" },
        { id: "yeast", name: "Telur + Ragi + Gula", unit: "set", unitPrice: 1500, qty: 1, packageInfo: "Adonan dasar" },
        { id: "pack", name: "Paper Bag + Wax Paper", unit: "set", unitPrice: 800, qty: 1, packageInfo: "Rp 800/set" },
      ],
    },
    matcha: {
      name: "Iced Matcha Oat Latte",
      category: "Non-Coffee",
      defaultSellingPrice: 32000,
      dailySalesEst: 30,
      ingredients: [
        { id: "matcha", name: "Pure Uji Matcha Powder", unit: "gram", unitPrice: 1800, qty: 6, packageInfo: "Rp 180k/100g" },
        { id: "oatmilk", name: "Oat Milk Barista Edition", unit: "ml", unitPrice: 42, qty: 150, packageInfo: "Rp 42k/L" },
        { id: "syrup", name: "Simple Syrup", unit: "ml", unitPrice: 15, qty: 20, packageInfo: "Rp 15k/L" },
        { id: "cup", name: "Cup 16oz + Sedotan + Lid", unit: "set", unitPrice: 950, qty: 1, packageInfo: "Rp 950/set" },
      ],
    },
  };

  const initialSupplierPresets: Record<
    SupplierPresetKey,
    {
      name: string;
      category: string;
      buyPrice: number;
      shippingFee: number;
      packagingFee: number;
      sellingPrice: number;
      dailySales: number;
      vendorNote: string;
    }
  > = {
    cheesecake: {
      name: "Basque Burnt Cheesecake Slice",
      category: "Titip Jual / Vendor Bakery",
      buyPrice: 16000,
      shippingFee: 1500,
      packagingFee: 1000,
      sellingPrice: 35000,
      dailySales: 15,
      vendorNote: "Beli per slice dari baker rekanan",
    },
    dimsum: {
      name: "Dimsum Mentai Box (10 pcs)",
      category: "Distributor Frozen Food",
      buyPrice: 12000,
      shippingFee: 1000,
      packagingFee: 1200,
      sellingPrice: 25000,
      dailySales: 25,
      vendorNote: "Ambil grosir dari distributor frozen food",
    },
    parfum: {
      name: "Artisan Room Fragrance 50ml",
      category: "Kulakan Retail / Merch Toko",
      buyPrice: 45000,
      shippingFee: 3000,
      packagingFee: 2500,
      sellingPrice: 95000,
      dailySales: 8,
      vendorNote: "Kulakan grosir untuk display etalase kasir",
    },
  };

  const [hppCalculationMode, setHppCalculationMode] = useState<"recipe" | "supplier">("recipe");
  const [activeRecipeKey, setActiveRecipeKey] = useState<RecipeKey>("kopsu");
  const [recipes, setRecipes] = useState(initialRecipes);
  const [sellingPrice, setSellingPrice] = useState(22000);

  const [activeSupplierKey, setActiveSupplierKey] = useState<SupplierPresetKey>("cheesecake");
  const [supplierBuyPrice, setSupplierBuyPrice] = useState(16000);
  const [supplierShippingFee, setSupplierShippingFee] = useState(1500);
  const [supplierPackagingFee, setSupplierPackagingFee] = useState(1000);
  const [supplierSellingPrice, setSupplierSellingPrice] = useState(35000);
  const [supplierDailySales, setSupplierDailySales] = useState(15);

  const currentRecipe = recipes[activeRecipeKey];
  const currentSupplierPreset = initialSupplierPresets[activeSupplierKey];

  const handleSelectRecipe = (key: RecipeKey) => {
    setActiveRecipeKey(key);
    setSellingPrice(recipes[key].defaultSellingPrice);
  };

  const handleSelectSupplierPreset = (key: SupplierPresetKey) => {
    setActiveSupplierKey(key);
    const item = initialSupplierPresets[key];
    setSupplierBuyPrice(item.buyPrice);
    setSupplierShippingFee(item.shippingFee);
    setSupplierPackagingFee(item.packagingFee);
    setSupplierSellingPrice(item.sellingPrice);
    setSupplierDailySales(item.dailySales);
  };

  const handleUpdateQty = (ingredientId: string, delta: number) => {
    setRecipes((prev) => {
      const currentList = prev[activeRecipeKey].ingredients;
      const updatedList = currentList.map((item) => {
        if (item.id === ingredientId) {
          const newQty = Math.max(1, item.qty + delta);
          return { ...item, qty: newQty };
        }
        return item;
      });
      return {
        ...prev,
        [activeRecipeKey]: {
          ...prev[activeRecipeKey],
          ingredients: updatedList,
        },
      };
    });
  };

  const handleSetIngredientQty = (ingredientId: string, customQty: number) => {
    setRecipes((prev) => {
      const currentList = prev[activeRecipeKey].ingredients;
      const updatedList = currentList.map((item) => {
        if (item.id === ingredientId) {
          return { ...item, qty: Math.max(1, customQty) };
        }
        return item;
      });
      return {
        ...prev,
        [activeRecipeKey]: {
          ...prev[activeRecipeKey],
          ingredients: updatedList,
        },
      };
    });
  };

  // Recipe Mode Calculations
  const totalHpp = currentRecipe.ingredients.reduce(
    (acc, item) => acc + Math.round(item.unitPrice * item.qty),
    0
  );
  const grossProfit = Math.max(0, sellingPrice - totalHpp);
  const profitMargin = sellingPrice > 0 ? Math.round((grossProfit / sellingPrice) * 100) : 0;
  const monthlyProfitEst = grossProfit * currentRecipe.dailySalesEst * 30;

  // Supplier / Reseller Mode Calculations
  const totalSupplierHpp = supplierBuyPrice + supplierShippingFee + supplierPackagingFee;
  const supplierProfitPerPcs = Math.max(0, supplierSellingPrice - totalSupplierHpp);
  const supplierMargin = supplierSellingPrice > 0 ? Math.round((supplierProfitPerPcs / supplierSellingPrice) * 100) : 0;
  const supplierMonthlyProfitEst = supplierProfitPerPcs * supplierDailySales * 30;

  // -------------------------------------------------------------
  // State for Service 4: WhatsApp Loyalty VIP Card Simulator & Merchant Approval Dashboard
  // -------------------------------------------------------------
  const [membershipViewMode, setMembershipViewMode] = useState<"customer" | "merchant">("customer");
  const [membershipStep, setMembershipStep] = useState<"card_tap" | "register" | "card_view">("card_view");
  const [memberName, setMemberName] = useState("Rian Prasetya");
  const [memberPhone, setMemberPhone] = useState("0812-8829-1920");
  const [stampCount, setStampCount] = useState(7);
  const [pointBalance, setPointBalance] = useState(140);
  const [voucherClaimed, setVoucherClaimed] = useState(false);
  const [claimApproved, setClaimApproved] = useState(false);

  // Cashier Point Typing & Customer Claim State
  const [customerPointClaimRequested, setCustomerPointClaimRequested] = useState(true);
  const [cashierAwardAmount, setCashierAwardAmount] = useState(20);
  const [lastAwardedNotification, setLastAwardedNotification] = useState<number | null>(null);

  const [memberDirectory, setMemberDirectory] = useState([
    {
      id: "M-01",
      name: "Rian Prasetya",
      phone: "0812-8829-1920",
      tier: "Gold Member",
      points: 140,
      stamps: 7,
      claimPending: false,
      voucherCode: "SENJA-VIP-88",
      rewardItem: "1x Artisan Coffee Gratis",
    },
    {
      id: "M-02",
      name: "Nabila Putri",
      phone: "0813-7711-2039",
      tier: "Gold Member",
      points: 140,
      stamps: 7,
      claimPending: false,
      voucherCode: null,
      rewardItem: "Kurang 1 stamp lagi",
    },
    {
      id: "M-03",
      name: "Dimas Anggara",
      phone: "0857-1928-3344",
      tier: "Silver Member",
      points: 80,
      stamps: 4,
      claimPending: false,
      voucherCode: null,
      rewardItem: "Kurang 4 stamp lagi",
    },
    {
      id: "M-04",
      name: "Siti Rahma",
      phone: "0821-9988-7766",
      tier: "Bronze Member",
      points: 40,
      stamps: 2,
      claimPending: false,
      voucherCode: null,
      rewardItem: "Kurang 6 stamp lagi",
    },
  ]);

  const handleRegisterMember = (e: React.FormEvent) => {
    e.preventDefault();
    setMembershipStep("card_view");
  };

  const handleCustomerRequestPoints = () => {
    setCustomerPointClaimRequested(true);
    setLastAwardedNotification(null);
  };

  const handleCashierSendPoints = () => {
    const pts = Math.max(1, cashierAwardAmount);
    setPointBalance((prev) => prev + pts);
    setLastAwardedNotification(pts);
    setCustomerPointClaimRequested(false);
    
    // Automatically increments stamp to 8 and enables reward
    const nextStamps = Math.min(8, stampCount + 1);
    setStampCount(nextStamps);
    if (nextStamps === 8) {
      setVoucherClaimed(true);
      setClaimApproved(false);
    }

    setMemberDirectory((prev) =>
      prev.map((m) =>
        m.id === "M-01"
          ? {
              ...m,
              points: m.points + pts,
              stamps: nextStamps,
              claimPending: nextStamps === 8,
            }
          : m
      )
    );
  };

  const handleResetLoyaltyState = () => {
    setStampCount(7);
    setPointBalance(140);
    setVoucherClaimed(false);
    setClaimApproved(false);
    setCustomerPointClaimRequested(true);
    setLastAwardedNotification(null);
    setMemberDirectory((prev) =>
      prev.map((m) =>
        m.id === "M-01"
          ? {
              ...m,
              points: 140,
              stamps: 7,
              claimPending: false,
              rewardItem: "Kurang 1 stamp lagi",
            }
          : m
      )
    );
  };

  const handleApproveReward = (memberId: string) => {
    setClaimApproved(true);
    setMemberDirectory((prev) =>
      prev.map((m) =>
        m.id === memberId
          ? { ...m, claimPending: false, points: 0, stamps: 0, rewardItem: "Reward Telah Ditukar ✓" }
          : m
      )
    );
  };

  return (
    <section id="mockup-showcase" className="py-16 sm:py-24 bg-[#fcfcfe] border-b border-[#dedee8]">
      <Container>
        
        {/* Section Header */}
        <div className="mx-auto max-w-3xl text-center">
          <Reveal>
            <div className="eyebrow inline-flex items-center gap-1.5">
              <span>✦</span>
              <span>INTERACTIVE UI/UX PLAYGROUND</span>
            </div>
            <h2 className="mt-3 text-3xl sm:text-5xl font-extrabold tracking-tight text-[#232331] leading-tight">
              Coba langsung <i className="font-serif italic font-normal text-[#7958d8]">tampilan UI/UX tiap layanan.</i>
            </h2>
            <p className="mt-3 text-xs sm:text-sm font-normal leading-relaxed text-[#7b7b8e]">
              Gak cuma janji di atas kertas. Ini simulasi nyata yang bakal dilihat kasir, owner, dan pelanggan tokomu setiap hari.
            </p>
          </Reveal>
        </div>

        {/* 4 Interactive Service Switcher Buttons (ChatJudge Style) */}
        <Reveal delay={0.08} className="mt-8 sm:mt-10">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-3">
            
            {/* Service Tab 1 */}
            <button
              type="button"
              onClick={() => setActiveService("review")}
              className={`btn-tactile flex flex-col items-start p-3 sm:p-4 rounded-xl text-left transition-all ${
                activeService === "review"
                  ? "bg-[#d9ff57] text-[#232331] shadow-ink-md"
                  : "bg-white text-[#232331] shadow-ink-xs hover:bg-[#f0edff]"
              }`}
            >
              <span className="flex h-6 w-6 sm:h-7 sm:w-7 items-center justify-center rounded-lg border border-[#232331] bg-white text-[#7958d8] font-bold text-xs mb-1.5 sm:mb-2 shadow-ink-xs">
                <Nfc size={13} strokeWidth={2.4} />
              </span>
              <span className="font-mono text-[8.5px] sm:text-[9px] font-bold uppercase tracking-wider text-[#7958d8]">
                MODUL 01
              </span>
              <span className="text-xs sm:text-sm font-bold text-[#232331] leading-tight mt-0.5">
                KAEL Review
              </span>
            </button>

            {/* Service Tab 2 */}
            <button
              type="button"
              onClick={() => setActiveService("pos")}
              className={`btn-tactile flex flex-col items-start p-3 sm:p-4 rounded-xl text-left transition-all ${
                activeService === "pos"
                  ? "bg-[#d9ff57] text-[#232331] shadow-ink-md"
                  : "bg-white text-[#232331] shadow-ink-xs hover:bg-[#f0edff]"
              }`}
            >
              <span className="flex h-6 w-6 sm:h-7 sm:w-7 items-center justify-center rounded-lg border border-[#232331] bg-white text-[#7958d8] font-bold text-xs mb-1.5 sm:mb-2 shadow-ink-xs">
                <Printer size={13} strokeWidth={2.4} />
              </span>
              <span className="font-mono text-[8.5px] sm:text-[9px] font-bold uppercase tracking-wider text-[#7958d8]">
                MODUL 02
              </span>
              <span className="text-xs sm:text-sm font-bold text-[#232331] leading-tight mt-0.5">
                KAEL POS &amp; Ordering
              </span>
            </button>

            {/* Service Tab 3 */}
            <button
              type="button"
              onClick={() => setActiveService("hpp")}
              className={`btn-tactile flex flex-col items-start p-3 sm:p-4 rounded-xl text-left transition-all ${
                activeService === "hpp"
                  ? "bg-[#d9ff57] text-[#232331] shadow-ink-md"
                  : "bg-white text-[#232331] shadow-ink-xs hover:bg-[#f0edff]"
              }`}
            >
              <span className="flex h-6 w-6 sm:h-7 sm:w-7 items-center justify-center rounded-lg border border-[#232331] bg-white text-[#7958d8] font-bold text-xs mb-1.5 sm:mb-2 shadow-ink-xs">
                <Calculator size={13} strokeWidth={2.4} />
              </span>
              <span className="font-mono text-[8.5px] sm:text-[9px] font-bold uppercase tracking-wider text-[#7958d8]">
                MODUL 03
              </span>
              <span className="text-xs sm:text-sm font-bold text-[#232331] leading-tight mt-0.5">
                KAEL Finance
              </span>
            </button>

            {/* Service Tab 4 */}
            <button
              type="button"
              onClick={() => setActiveService("wa")}
              className={`btn-tactile flex flex-col items-start p-3 sm:p-4 rounded-xl text-left transition-all ${
                activeService === "wa"
                  ? "bg-[#d9ff57] text-[#232331] shadow-ink-md"
                  : "bg-white text-[#232331] shadow-ink-xs hover:bg-[#f0edff]"
              }`}
            >
              <span className="flex h-6 w-6 sm:h-7 sm:w-7 items-center justify-center rounded-lg border border-[#232331] bg-white text-[#7958d8] font-bold text-xs mb-1.5 sm:mb-2 shadow-ink-xs">
                <MessageCircle size={13} strokeWidth={2.4} />
              </span>
              <span className="font-mono text-[8.5px] sm:text-[9px] font-bold uppercase tracking-wider text-[#7958d8]">
                MODUL 04
              </span>
              <span className="text-xs sm:text-sm font-bold text-[#232331] leading-tight mt-0.5">
                KAEL Loyalty
              </span>
            </button>

          </div>
        </Reveal>

        {/* ------------------------------------------------------------- */}
        {/* INTERACTIVE STAGE CONTAINER */}
        {/* ------------------------------------------------------------- */}
        <Reveal delay={0.14} className="mt-6 sm:mt-8">
          <div className="rounded-2xl sm:rounded-3xl border-2 border-[#232331] bg-white p-3 sm:p-6 lg:p-10 shadow-ink-lg text-[#232331] overflow-hidden">
            
            {/* ========================================================= */}
            {/* 1. MOCKUP LAYANAN 1: GOOGLE REVIEW NFC & QR FLOW */}
            {/* ========================================================= */}
            {activeService === "review" && (
              <div className="grid gap-8 lg:grid-cols-12 items-center">
                {/* Left Description */}
                <div className="lg:col-span-6 min-w-0 w-full space-y-4">
                  <div className="inline-flex items-center gap-2 rounded-full border border-[#232331] bg-[#d9ff57] px-3 py-1 font-mono text-[10px] font-bold text-[#232331] uppercase">
                    <span>✦ MODUL 01</span>
                    <span>· 1 Detik Tap Ulasan Organik</span>
                  </div>

                  <h3 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-[#232331]">
                    Undang Ulasan Organik & Jujur dari Pelanggan Puas
                  </h3>
                  <p className="text-xs sm:text-sm font-normal text-[#7b7b8e] leading-relaxed">
                    Bukan bot dan bukan ulasan palsu. Kartu standar resmi KAEL mempermudah pelanggan puas untuk langsung memberikan ulasan jujur &amp; bintang 5 di Google Maps hanya dengan 1 tap santai tanpa perlu mengetik nama tokomu.
                  </p>

                  <div className="space-y-2 pt-2 text-xs font-semibold text-[#232331]">
                    <div className="flex items-center gap-2">
                      <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[#d9ff57] text-[#232331]">
                        <Check size={12} strokeWidth={3} />
                      </span>
                      <span><strong>2 Cara Pakai Fleksibel:</strong> Ditempel di kasir atau dibawa staf nyamperin meja pelanggan</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[#d9ff57] text-[#232331]">
                        <Check size={12} strokeWidth={3} />
                      </span>
                      <span><strong>100% Organik:</strong> Mengundang ulasan jujur dari pembeli nyata yang puas dengan pelayanan</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[#d9ff57] text-[#232331]">
                        <Check size={12} strokeWidth={3} />
                      </span>
                      <span>Kompatibel semua HP (NFC instan + QR Code cadangan presisi)</span>
                    </div>
                    <div className="flex items-center gap-2 text-[#7958d8]">
                      <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[#f0edff] border border-[#7958d8] text-[#7958d8] font-bold">
                        🎁
                      </span>
                      <span><strong>BONUS GRATIS:</strong> Tim KAEL sediakan file desain poster &amp; standee meja promo siap cetak!</span>
                    </div>
                  </div>

                  <div className="pt-4 flex flex-wrap gap-3">
                    <button
                      type="button"
                      onClick={() => setReviewState("rating")}
                      className="btn-tactile inline-flex items-center gap-2 rounded-xl bg-[#232331] px-5 py-3 text-xs font-bold text-white"
                    >
                      <Zap size={14} className="text-[#d9ff57]" />
                      <span>Simulasikan Tempel HP (Tap NFC)</span>
                    </button>
                    {reviewState !== "tap" && (
                      <button
                        type="button"
                        onClick={() => setReviewState("tap")}
                        className="btn-tactile inline-flex items-center gap-1.5 rounded-xl bg-white px-3.5 py-3 text-xs font-bold text-[#7b7b8e]"
                      >
                        <RotateCcw size={13} />
                        <span>Reset</span>
                      </button>
                    )}
                  </div>
                </div>

                {/* Right Interactive Phone UI Mockup */}
                <div className="lg:col-span-6 min-w-0 w-full flex justify-center">
                  <div className="w-full max-w-[320px] rounded-[32px] border-[2.5px] border-[#232331] bg-[#232331] p-3 shadow-ink-lg">
                    {/* Phone Screen Canvas */}
                    <div className="relative rounded-[24px] bg-[#fcfcfe] p-4 text-[#232331] overflow-hidden min-h-[460px] flex flex-col justify-between border border-[#dedee8]">
                      
                      {/* Top Phone Status Bar */}
                      <div className="flex items-center justify-between border-b border-[#dedee8] pb-2 text-[10px] font-mono font-bold text-[#7b7b8e]">
                        <span>16:20</span>
                        <div className="flex items-center gap-1.5">
                          <span>NFC ON</span>
                          <span className="h-2 w-2 rounded-full bg-[#d9ff57] border border-[#232331]" />
                        </div>
                      </div>

                      {/* State 1: Idle - Waiting for Tap */}
                      {reviewState === "tap" && (
                        <div className="my-auto text-center py-6">
                          <div
                            onClick={() => setReviewState("rating")}
                            className="mx-auto flex h-32 w-32 cursor-pointer items-center justify-center rounded-full border-2 border-dashed border-[#7958d8] bg-[#f0edff] animate-pulse transition-transform hover:scale-105"
                          >
                            <div className="text-center">
                              <Nfc size={36} className="mx-auto text-[#7958d8]" strokeWidth={2.4} />
                              <span className="mt-1.5 block font-mono text-[9px] font-bold uppercase text-[#7958d8]">
                                TEMPEL DI SINI
                              </span>
                            </div>
                          </div>
                          <h4 className="mt-5 text-sm font-extrabold text-[#232331]">
                            Kartu Tap Standar KAEL
                          </h4>
                          <p className="mt-1 text-[11px] text-[#7b7b8e] px-4 leading-relaxed">
                            Ditempel di kasir atau disodorkan ramah oleh staf saat mengantar makanan ke meja pelanggan.
                          </p>
                          <button
                            type="button"
                            onClick={() => setReviewState("rating")}
                            className="mt-5 btn-tactile inline-flex items-center gap-1.5 rounded-lg bg-[#d9ff57] px-4 py-2 text-[11px] font-bold text-[#232331]"
                          >
                            <span>Sentuh Layar HP</span>
                            <ArrowRight size={12} strokeWidth={2.5} />
                          </button>
                        </div>
                      )}

                      {/* State 2: Google Maps Modal Pop-up */}
                      {reviewState === "rating" && (
                        <div className="my-auto space-y-3 animate-fadeIn">
                          {/* Business Header */}
                          <div className="flex items-center gap-2.5 rounded-xl border border-[#dedee8] bg-[#f0edff] p-2.5">
                            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#232331] text-[#d9ff57] font-bold text-xs">
                              ☕
                            </span>
                            <div className="min-w-0 flex-1 text-left">
                              <p className="text-xs font-bold text-[#232331] truncate">Senja Coffee & Eatery</p>
                              <p className="text-[10px] font-mono text-[#7958d8]">Google Maps Terverifikasi ★ 4.9</p>
                            </div>
                          </div>

                          {/* Star Picker */}
                          <div className="rounded-xl border border-[#dedee8] bg-white p-3 text-center">
                            <p className="text-[10px] font-bold text-[#7b7b8e] uppercase font-mono">
                              Pilih Bintang Ulasan
                            </p>
                            <div className="mt-2 flex items-center justify-center gap-1.5 text-[#ffb36b]">
                              {[1, 2, 3, 4, 5].map((star) => (
                                <button
                                  key={star}
                                  type="button"
                                  onClick={() => setSelectedRating(star)}
                                  className="transition-transform hover:scale-125"
                                >
                                  <Star
                                    size={24}
                                    fill={star <= selectedRating ? "#ffb36b" : "none"}
                                    stroke="#232331"
                                    strokeWidth={1.5}
                                  />
                                </button>
                              ))}
                            </div>
                            <span className="mt-1 block text-[11px] font-bold text-[#232331]">
                              {selectedRating === 5 ? "Sangat Puas! ⭐⭐⭐⭐⭐" : `${selectedRating} Bintang`}
                            </span>
                          </div>

                          {/* Quick Tag Pills */}
                          <div className="space-y-1 text-left">
                            <p className="text-[10px] font-bold text-[#7b7b8e]">Tag Cepat:</p>
                            <div className="flex flex-wrap gap-1.5">
                              {["Kopi Enak Banget ✨", "Pelayanan Kasir Cepat ⚡", "Tempat Cozy 🌿"].map((tag) => (
                                <button
                                  key={tag}
                                  type="button"
                                  onClick={() => toggleTag(tag)}
                                  className={`rounded-md border px-2 py-1 text-[10px] font-bold transition-all ${
                                    selectedTags.includes(tag)
                                      ? "border-[#232331] bg-[#d9ff57] text-[#232331]"
                                      : "border-[#dedee8] bg-white text-[#7b7b8e]"
                                  }`}
                                >
                                  {tag}
                                </button>
                              ))}
                            </div>
                          </div>

                          {/* Submit Button */}
                          <button
                            type="button"
                            onClick={() => setReviewState("submitted")}
                            className="btn-tactile w-full rounded-xl bg-[#232331] py-2.5 text-xs font-bold text-white shadow-ink-xs"
                          >
                            Kirim Ulasan Google Maps
                          </button>
                        </div>
                      )}

                      {/* State 3: Success Confirmation */}
                      {reviewState === "submitted" && (
                        <div className="my-auto text-center py-6 animate-fadeIn space-y-3">
                          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full border-2 border-[#232331] bg-[#d9ff57] text-[#232331]">
                            <Check size={28} strokeWidth={3} />
                          </div>
                          <h4 className="text-base font-extrabold text-[#232331]">
                            Ulasan 5★ Terkirim!
                          </h4>
                          <p className="text-xs text-[#7b7b8e] px-2">
                            Rating <strong>Senja Coffee</strong> di Google Maps langsung meningkat seketika.
                          </p>
                          <div className="rounded-xl border border-[#232331] bg-[#f0edff] p-3 text-[11px] font-bold text-[#7958d8]">
                            🎉 Reward: 1 Kupon Diskon 15% Masuk ke WA Pelanggan
                          </div>
                        </div>
                      )}

                      {/* Phone Bottom Notch */}
                      <div className="mx-auto h-1 w-24 rounded-full bg-[#232331]" />
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* ========================================================= */}
            {/* 2. MOCKUP LAYANAN 2: MENU QR MEJA + KASIR POS + DASHBOARD */}
            {/* ========================================================= */}
            {activeService === "pos" && (
              <div className="grid gap-8 lg:grid-cols-12 items-start">
                {/* Left Description & Mode Switcher */}
                <div className="lg:col-span-5 min-w-0 w-full space-y-4">
                  <div className="inline-flex items-center gap-2 rounded-full border border-[#232331] bg-[#d9ff57] px-3 py-1 font-mono text-[10px] font-bold text-[#232331] uppercase">
                    <span>✦ MODUL 02</span>
                    <span>· Menu QR Meja, Kasir Web &amp; Dashboard</span>
                  </div>

                  <h3 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-[#232331]">
                    Menu QR Meja + Kasir Web &amp; Dashboard Owner
                  </h3>
                  <p className="text-xs sm:text-sm font-normal text-[#7b7b8e] leading-relaxed">
                    Tamu duduk di meja, scan QR menu dengan HP — otomatis terdaftar di nomor meja tersebut, pilih menu, dan bayar. Bisa bayar langsung di tempat lewat QRIS atau bayar di kasir dengan menyebutkan nomor mejanya.
                  </p>

                  {/* Mode View Switcher (3 Modes) */}
                  <div className="pt-1">
                    <p className="text-xs font-mono font-bold uppercase tracking-wider text-[#7958d8] mb-2">
                      PILIH TAMPILAN SIMULASI:
                    </p>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                      <button
                        type="button"
                        onClick={() => setPosViewMode("menu")}
                        className={`btn-tactile rounded-xl p-2.5 sm:p-2 text-center text-xs font-bold transition-all flex sm:flex-col items-center justify-center gap-2 sm:gap-1 ${
                          posViewMode === "menu"
                            ? "bg-[#d9ff57] text-[#232331] shadow-ink-xs border-2 border-[#232331]"
                            : "bg-white text-[#232331] border border-[#dedee8] hover:bg-[#f0edff]"
                        }`}
                      >
                        <Smartphone size={16} strokeWidth={2.4} />
                        <span className="text-xs sm:text-[11px] leading-tight">1. Menu QR Meja</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setPosViewMode("pos")}
                        className={`btn-tactile rounded-xl p-2.5 sm:p-2 text-center text-xs font-bold transition-all flex sm:flex-col items-center justify-center gap-2 sm:gap-1 ${
                          posViewMode === "pos"
                            ? "bg-[#d9ff57] text-[#232331] shadow-ink-xs border-2 border-[#232331]"
                            : "bg-white text-[#232331] border border-[#dedee8] hover:bg-[#f0edff]"
                        }`}
                      >
                        <Printer size={16} strokeWidth={2.4} />
                        <span className="text-xs sm:text-[11px] leading-tight">2. Layar Kasir</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setPosViewMode("dashboard")}
                        className={`btn-tactile rounded-xl p-2.5 sm:p-2 text-center text-xs font-bold transition-all flex sm:flex-col items-center justify-center gap-2 sm:gap-1 ${
                          posViewMode === "dashboard"
                            ? "bg-[#d9ff57] text-[#232331] shadow-ink-xs border-2 border-[#232331]"
                            : "bg-white text-[#232331] border border-[#dedee8] hover:bg-[#f0edff]"
                        }`}
                      >
                        <BarChart3 size={16} strokeWidth={2.4} />
                        <span className="text-xs sm:text-[11px] leading-tight">3. Laporan Owner</span>
                      </button>
                    </div>
                  </div>

                  <div className="space-y-2 pt-2 text-xs font-semibold text-[#232331]">
                    <div className="flex items-center gap-2">
                      <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[#d9ff57] text-[#232331]">
                        <Check size={12} strokeWidth={3} />
                      </span>
                      <span><strong>Scan QR Meja Instan:</strong> Otomatis tercatat nomor meja tanpa antre di kasir</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[#d9ff57] text-[#232331]">
                        <Check size={12} strokeWidth={3} />
                      </span>
                      <span><strong>2 Cara Bayar Fleksibel:</strong> Bayar QRIS di meja atau bayar di kasir sebut no meja</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[#d9ff57] text-[#232331]">
                        <Check size={12} strokeWidth={3} />
                      </span>
                      <span><strong>Web-Based POS:</strong> Buka di iPad/tablet toko &amp; cetak struk bluetooth</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[#d9ff57] text-[#232331]">
                        <Check size={12} strokeWidth={3} />
                      </span>
                      <span><strong>Dashboard Owner:</strong> Pantau menu paling laris vs stok yang jarang kejual</span>
                    </div>
                    <div className="flex items-center gap-2 text-[#7958d8]">
                      <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[#f0edff] border border-[#7958d8] text-[#7958d8] font-bold">
                        <Gift size={12} strokeWidth={2.4} />
                      </span>
                      <span><strong>BONUS GRATIS:</strong> Tim KAEL sediakan file desain QR Meja &amp; Layout Struk tokomu!</span>
                    </div>
                  </div>
                </div>

                {/* Right Interactive Screen (Swappable: Menu QR vs POS Cashier vs Owner Dashboard) */}
                <div className="lg:col-span-7 min-w-0 w-full">
                  
                  {/* VIEW 1: MENU QR SELF-ORDER (HP TAMU DI MEJA) */}
                  {posViewMode === "menu" && (
                    <div className="rounded-2xl border-2 border-[#232331] bg-[#fcfcfe] p-3 sm:p-5 shadow-ink-md animate-fadeIn overflow-hidden">
                      
                      {/* Top Bar HP Tamu */}
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 border-b border-[#dedee8] pb-3">
                        <div className="flex items-center gap-2">
                          <span className="flex h-7 w-7 items-center justify-center rounded-lg border-[1.5px] border-[#232331] bg-[#7958d8] text-white font-bold text-xs shrink-0">
                            <Utensils size={14} strokeWidth={2.4} />
                          </span>
                          <div>
                            <p className="text-xs font-extrabold text-[#232331]">Senja Coffee &amp; Eatery</p>
                            <p className="text-[10px] font-mono text-[#7958d8]">E-Menu Self-Order Web</p>
                          </div>
                        </div>

                        {/* Table Selector Pills */}
                        <div className="flex items-center gap-1 text-[10px] sm:text-[11px] font-mono font-bold flex-wrap">
                          <span className="text-[#7b7b8e] mr-1">Pilih Meja:</span>
                          {["Meja 04", "Meja 08", "Meja 12"].map((table) => (
                            <button
                              key={table}
                              type="button"
                              onClick={() => {
                                setSelectedTable(table);
                                setCashierActiveTable(table);
                                setGuestPaymentState("idle");
                              }}
                              className={`rounded-lg border px-2 py-0.5 transition-all ${
                                selectedTable === table
                                  ? "border-[#232331] bg-[#d9ff57] text-[#232331] shadow-ink-xs font-bold"
                                  : "border-[#dedee8] bg-white text-[#7b7b8e] hover:bg-[#f0edff]"
                              }`}
                            >
                              {table}
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Auto Table Registration Banner */}
                      <div className="mt-3 rounded-xl border-[1.5px] border-[#232331] bg-[#f0edff] p-2.5 flex flex-col sm:flex-row sm:items-center justify-between gap-1.5 text-xs shadow-ink-xs overflow-hidden">
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#7958d8] text-white">
                            <QrCode size={13} strokeWidth={2.4} />
                          </span>
                          <span className="font-semibold text-[#232331] text-[10.5px] sm:text-[11px] truncate">
                            Scan QR: <strong>Tamu di {selectedTable}</strong>
                          </span>
                        </div>
                        <span className="font-mono text-[9px] sm:text-[10px] font-bold text-[#7958d8] bg-white px-2 py-0.5 rounded border border-[#232331] self-start sm:self-auto shrink-0">
                          Dine-In ✓
                        </span>
                      </div>

                      {/* Category Filter Tabs */}
                      <div className="mt-3 flex gap-1.5 overflow-x-auto pb-1 text-xs font-semibold w-full max-w-full">
                        {(["Semua", "Coffee", "Bakery", "Non-Coffee", "Snack"] as const).map((cat) => (
                          <button
                            key={cat}
                            type="button"
                            onClick={() => setGuestCategory(cat)}
                            className={`rounded-lg border px-2.5 py-1 text-[11px] whitespace-nowrap transition-all shrink-0 ${
                              guestCategory === cat
                                ? "border-[#232331] bg-[#232331] text-white font-bold"
                                : "border-[#dedee8] bg-white text-[#7b7b8e] hover:bg-[#f0edff]"
                            }`}
                          >
                            {cat === "Semua" ? "Semua Menu" : cat}
                          </button>
                        ))}
                      </div>

                      {/* Menu Grid (Guest View) */}
                      <div className="mt-3 grid gap-2.5 sm:grid-cols-2">
                        {posMenuItems
                          .filter((item) => guestCategory === "Semua" || item.category === guestCategory)
                          .map((item) => {
                            const count = guestCart[item.id] || 0;
                            return (
                              <div
                                key={item.id}
                                className={`rounded-xl border-[1.5px] p-2.5 sm:p-3 text-left transition-all ${
                                  count > 0
                                    ? "border-[#232331] bg-[#d9ff57]/20 shadow-ink-xs"
                                    : "border-[#dedee8] bg-white hover:border-[#232331]"
                                }`}
                              >
                                <div className="flex items-center justify-between gap-2">
                                  <div className="min-w-0 flex-1 pr-1">
                                    <p className="text-xs font-bold text-[#232331] truncate">{item.name}</p>
                                    <p className="text-[10px] text-[#7b7b8e] line-clamp-1 mt-0.5">{item.desc}</p>
                                    <p className="mt-1 font-mono text-xs font-extrabold text-[#7958d8]">
                                      Rp {item.price.toLocaleString("id-ID")}
                                    </p>
                                  </div>

                                  {/* Quantity Stepper */}
                                  <div className="shrink-0">
                                    {count === 0 ? (
                                      <button
                                        type="button"
                                        onClick={() => addGuestToCart(item.id)}
                                        className="btn-tactile rounded-lg border-[1.5px] border-[#232331] bg-[#d9ff57] px-2 py-1 text-[10.5px] font-bold text-[#232331]"
                                      >
                                        + Tambah
                                      </button>
                                    ) : (
                                      <div className="flex items-center gap-1 rounded-lg border-[1.5px] border-[#232331] bg-white p-0.5 shadow-ink-xs">
                                        <button
                                          type="button"
                                          onClick={() => removeGuestFromCart(item.id)}
                                          className="flex h-5 w-5 items-center justify-center rounded bg-[#feebee] text-[11px] font-bold text-[#ef4444] hover:bg-[#fdd]"
                                        >
                                          −
                                        </button>
                                        <span className="font-mono text-xs font-extrabold text-[#232331] px-1">
                                          {count}
                                        </span>
                                        <button
                                          type="button"
                                          onClick={() => addGuestToCart(item.id)}
                                          className="flex h-5 w-5 items-center justify-center rounded bg-[#d9ff57] text-[11px] font-bold text-[#232331] hover:bg-[#cbf740]"
                                        >
                                          +
                                        </button>
                                      </div>
                                    )}
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                      </div>

                      {/* Guest Order Summary & Dual Payment Drawer */}
                      <div className="mt-4 rounded-xl border-[1.5px] border-[#232331] bg-white p-3 sm:p-4 shadow-ink-sm overflow-hidden">
                        <div className="flex flex-col xs:flex-row xs:items-center justify-between gap-1 border-b border-[#dedee8] pb-2 text-xs">
                          <span className="font-bold text-[#232331] flex items-center gap-1.5 truncate">
                            <ShoppingBag size={14} className="text-[#7958d8] shrink-0" strokeWidth={2.4} />
                            <span className="truncate">Pesanan {selectedTable} ({guestItemCount} Item)</span>
                          </span>
                          <span className="font-mono text-xs sm:text-sm font-extrabold text-[#7958d8] shrink-0">
                            Total: Rp {guestTotal.toLocaleString("id-ID")}
                          </span>
                        </div>

                        {/* State 1: Choose Payment Method */}
                        {guestPaymentState === "idle" && (
                          <div className="mt-3 space-y-2">
                            <p className="text-[10px] font-mono font-bold uppercase tracking-wider text-[#7b7b8e]">
                              PILIH METODE PEMBAYARAN TAMU:
                            </p>
                            <div className="grid sm:grid-cols-2 gap-2">
                              {/* Option A: Pay QRIS at Table */}
                              <button
                                type="button"
                                disabled={guestTotal === 0}
                                onClick={() => setGuestPaymentState("qris_modal")}
                                className="btn-tactile rounded-xl border-[1.5px] border-[#232331] bg-[#d9ff57] p-2.5 text-left text-xs font-bold text-[#232331] disabled:opacity-50 flex items-start gap-2"
                              >
                                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-[#232331] text-[#d9ff57]">
                                  <QrCode size={13} strokeWidth={2.4} />
                                </span>
                                <div>
                                  <span className="block font-bold">1. Bayar di Tempat (QRIS)</span>
                                  <span className="text-[10px] font-normal text-[#232331]/80 block">
                                    Scan QRIS di HP, langsung lunas &amp; dimasak
                                  </span>
                                </div>
                              </button>

                              {/* Option B: Pay at Cashier */}
                              <button
                                type="button"
                                disabled={guestTotal === 0}
                                onClick={handleGuestPayAtCashier}
                                className="btn-tactile rounded-xl border-[1.5px] border-[#232331] bg-[#f0edff] p-2.5 text-left text-xs font-bold text-[#232331] disabled:opacity-50 flex items-start gap-2 hover:bg-[#e4ddff]"
                              >
                                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-[#7958d8] text-white">
                                  <CreditCard size={13} strokeWidth={2.4} />
                                </span>
                                <div>
                                  <span className="block font-bold">2. Bayar di Kasir</span>
                                  <span className="text-[10px] font-normal text-[#7b7b8e] block">
                                    Pesan dulu, sebutkan {selectedTable} di kasir
                                  </span>
                                </div>
                              </button>
                            </div>
                          </div>
                        )}

                        {/* State 2: QRIS Dynamic Modal Simulator */}
                        {guestPaymentState === "qris_modal" && (
                          <div className="mt-3 animate-fadeIn rounded-xl border-[1.5px] border-[#232331] bg-[#fcfcfe] p-3.5 text-center space-y-2.5">
                            <div className="flex items-center justify-between text-xs font-bold text-[#232331]">
                              <span className="flex items-center gap-1 text-[#7958d8]">
                                <QrCode size={14} strokeWidth={2.4} />
                                <span>QRIS DINAMIS • {selectedTable}</span>
                              </span>
                              <span className="font-mono text-xs font-extrabold text-[#16a34a]">
                                Rp {guestTotal.toLocaleString("id-ID")}
                              </span>
                            </div>

                            {/* Simulated QR Box */}
                            <div className="mx-auto w-36 h-36 rounded-xl border-2 border-[#232331] bg-white p-2 flex flex-col items-center justify-center shadow-ink-xs">
                              <QrCode size={90} className="text-[#232331]" strokeWidth={2} />
                              <span className="mt-1 font-mono text-[8px] font-bold text-[#7b7b8e]">NMID: ID1020039281</span>
                            </div>

                            <p className="text-[10px] text-[#7b7b8e]">
                              Buka BCA Mobile, GoPay, OVO, Dana, ShopeePay atau M-Banking apa saja untuk scan.
                            </p>

                            <div className="flex gap-2 justify-center pt-1">
                              <button
                                type="button"
                                onClick={handleGuestPayQris}
                                className="btn-tactile rounded-xl bg-[#232331] px-4 py-2 text-xs font-bold text-white shadow-ink-xs flex items-center gap-1.5"
                              >
                                <Check size={13} strokeWidth={3} className="text-[#d9ff57]" />
                                <span>Simulasikan Pembayaran Selesai</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => setGuestPaymentState("idle")}
                                className="rounded-xl border border-[#dedee8] bg-white px-3 py-2 text-xs font-bold text-[#7b7b8e] hover:bg-[#feebee]"
                              >
                                Batal
                              </button>
                            </div>
                          </div>
                        )}

                        {/* State 3: QRIS Paid Confirmation */}
                        {guestPaymentState === "qris_paid" && (
                          <div className="mt-3 animate-fadeIn rounded-xl border-[1.5px] border-[#232331] bg-[#f0fff4] p-3.5 text-center space-y-2">
                            <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-full border-[1.5px] border-[#232331] bg-[#22c55e] text-white">
                              <Check size={20} strokeWidth={3} />
                            </div>
                            <h4 className="text-sm font-extrabold text-[#232331]">
                              Pembayaran QRIS Lunas! (Rp {guestTotal.toLocaleString("id-ID")})
                            </h4>
                            <p className="text-[11px] text-[#7b7b8e]">
                              Pesanan <strong>{selectedTable}</strong> langsung terkirim otomatis ke kasir &amp; printer dapur. Tamu tinggal santai menunggu makanan diantar!
                            </p>
                            <div className="pt-1">
                              <button
                                type="button"
                                onClick={() => setPosViewMode("pos")}
                                className="btn-tactile inline-flex items-center gap-1.5 rounded-xl bg-[#232331] px-4 py-2 text-xs font-bold text-white shadow-ink-xs"
                              >
                                <span>Lihat Pesanan Masuk di Layar Kasir POS</span>
                                <ArrowRight size={13} strokeWidth={2.5} className="text-[#d9ff57]" />
                              </button>
                            </div>
                          </div>
                        )}

                        {/* State 4: Pay at Cashier Ticket */}
                        {guestPaymentState === "cashier_ticket" && (
                          <div className="mt-3 animate-fadeIn rounded-xl border-[1.5px] border-[#232331] bg-[#f0edff] p-3.5 text-center space-y-2">
                            <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-full border-[1.5px] border-[#232331] bg-[#7958d8] text-white">
                              <FileText size={20} strokeWidth={2.4} />
                            </div>
                            <h4 className="text-sm font-extrabold text-[#232331]">
                              Tiket Pesanan Terkirim ke Kasir!
                            </h4>
                            <p className="text-[11px] text-[#232331] leading-relaxed">
                              Silakan sebutkan <strong>&quot;{selectedTable}&quot;</strong> saat menuju meja kasir untuk pembayaran Tunai, Debit, atau QRIS kasir.
                            </p>
                            <div className="rounded-lg border border-[#232331] bg-white p-2 font-mono text-xs font-bold text-[#7958d8] flex justify-between">
                              <span>NO. MEJA: {selectedTable}</span>
                              <span>TOTAL: Rp {guestTotal.toLocaleString("id-ID")}</span>
                            </div>
                            <div className="pt-1">
                              <button
                                type="button"
                                onClick={() => setPosViewMode("pos")}
                                className="btn-tactile inline-flex items-center gap-1.5 rounded-xl bg-[#d9ff57] px-4 py-2 text-xs font-bold text-[#232331] shadow-ink-xs"
                              >
                                <span>Buka Layar Kasir &amp; Proses Bayar</span>
                                <ArrowRight size={13} strokeWidth={2.5} />
                              </button>
                            </div>
                          </div>
                        )}

                      </div>

                    </div>
                  )}

                  {/* VIEW 2: POS CASHIER & THERMAL RECEIPT */}
                  {posViewMode === "pos" && (
                    <div className="rounded-2xl border-2 border-[#232331] bg-[#fcfcfe] p-4 sm:p-5 shadow-ink-md animate-fadeIn">
                      
                      {/* Top POS Header */}
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5 border-b border-[#dedee8] pb-3">
                        <div className="flex items-center gap-2">
                          <span className="flex h-6 w-6 items-center justify-center rounded-md bg-[#232331] text-[#d9ff57] font-mono text-[10px] font-bold shrink-0">
                            POS
                          </span>
                          <span className="text-xs font-extrabold text-[#232331] truncate">
                            KAEL WEB KASIR • {cashierActiveTable.toUpperCase()}
                          </span>
                        </div>
                        <span className="font-mono text-[9px] sm:text-[10px] font-bold text-[#7958d8] bg-[#f0edff] px-2 py-0.5 rounded border border-[#232331] self-start sm:self-auto">
                          Bluetooth Connected ⚡
                        </span>
                      </div>

                      {/* Live Table Sync Alert Box */}
                      {cashierPaymentStatus === "qris_paid" ? (
                        <div className="mt-3 rounded-xl border-[1.5px] border-[#232331] bg-[#f0fff4] p-2.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs shadow-ink-xs">
                          <div className="flex items-center gap-2">
                            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#22c55e] text-white">
                              <Check size={12} strokeWidth={3} />
                            </span>
                            <span className="text-[11px] font-bold text-[#16a34a]">
                              Pesanan dari {cashierActiveTable} Masuk: <strong>LUNAS QRIS (Rp {posTotal.toLocaleString("id-ID")})</strong>
                            </span>
                          </div>
                          <span className="font-mono text-[9px] font-bold uppercase bg-white px-2 py-0.5 rounded border border-[#232331] self-start sm:self-auto">
                            Siap Cetak Struk ✓
                          </span>
                        </div>
                      ) : cashierPaymentStatus === "unpaid" ? (
                        <div className="mt-3 rounded-xl border-[1.5px] border-[#232331] bg-[#f0edff] p-2.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs shadow-ink-xs">
                          <div className="flex items-center gap-2">
                            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#7958d8] text-white">
                              <CreditCard size={12} strokeWidth={2.4} />
                            </span>
                            <span className="text-[11px] font-bold text-[#7958d8]">
                              Tamu {cashierActiveTable} Menunggu di Kasir: <strong>Total Rp {posTotal.toLocaleString("id-ID")}</strong>
                            </span>
                          </div>
                          <button
                            type="button"
                            onClick={() => {
                              setCashierPaymentStatus("qris_paid");
                              setReceiptPrinted(true);
                            }}
                            className="btn-tactile font-mono text-[10px] font-bold bg-[#d9ff57] px-2.5 py-1 rounded-lg border border-[#232331] text-[#232331] self-start sm:self-auto"
                          >
                            Terima Bayar &amp; Cetak
                          </button>
                        </div>
                      ) : null}

                      {/* Main POS Split: Menu Grid (Left) + Order Cart (Right) */}
                      <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
                        
                        {/* Menu Grid */}
                        <div className="space-y-2">
                          <p className="text-[10px] font-bold text-[#7b7b8e] uppercase font-mono">Pilihan Menu Kasir:</p>
                          {posMenuItems.map((item) => {
                            const inCart = posCart[item.id] || 0;
                            return (
                              <button
                                key={item.id}
                                type="button"
                                onClick={() => addToCart(item.id)}
                                className={`w-full text-left rounded-xl border p-2.5 transition-all ${
                                  inCart > 0
                                    ? "border-[#232331] bg-[#d9ff57]/40 shadow-ink-xs"
                                    : "border-[#dedee8] bg-white hover:bg-[#f0edff]"
                                }`}
                              >
                                <div className="flex items-center justify-between">
                                  <span className="text-xs font-bold text-[#232331] truncate">{item.name}</span>
                                  {inCart > 0 && (
                                    <span className="rounded-full bg-[#232331] text-white px-1.5 py-0.2 text-[9px] font-mono font-bold">
                                      x{inCart}
                                    </span>
                                  )}
                                </div>
                                <span className="text-[10px] font-mono font-semibold text-[#7b7b8e]">
                                  Rp {item.price.toLocaleString("id-ID")}
                                </span>
                              </button>
                            );
                          })}
                        </div>

                        {/* Cart & Receipt Drawer */}
                        <div className="flex flex-col justify-between rounded-xl border border-[#232331] bg-white p-3 shadow-ink-xs">
                          <div>
                            <div className="flex items-center justify-between border-b border-[#dedee8] pb-1">
                              <p className="text-[10px] font-bold text-[#7b7b8e] uppercase font-mono">
                                Pesanan {cashierActiveTable}:
                              </p>
                              <span className="font-mono text-[9px] font-bold text-[#7958d8]">
                                {cashierPaymentStatus === "qris_paid" ? "Lunas (QRIS)" : "Belum Bayar"}
                              </span>
                            </div>

                            <div className="mt-2 space-y-1.5 max-h-[140px] overflow-y-auto">
                              {Object.keys(posCart).length === 0 ? (
                                <p className="text-[10px] text-[#aaa] py-4 text-center">Keranjang kosong</p>
                              ) : (
                                Object.entries(posCart).map(([id, qty]) => {
                                  const item = posMenuItems.find((m) => m.id === id);
                                  if (!item) return null;
                                  return (
                                    <div key={id} className="flex items-center justify-between text-xs border-b border-[#f0f0f0] pb-1">
                                      <div className="min-w-0 flex-1 truncate">
                                        <span className="font-bold text-[#232331]">{qty}x</span> {item.name}
                                      </div>
                                      <button
                                        type="button"
                                        onClick={() => removeFromCart(id)}
                                        className="text-[#ef4444] font-bold px-1"
                                      >
                                        ✕
                                      </button>
                                    </div>
                                  );
                                })
                              )}
                            </div>
                          </div>

                          {/* Total & Checkout */}
                          <div className="mt-3 pt-2 border-t border-[#dedee8]">
                            <div className="flex justify-between text-xs font-bold text-[#232331]">
                              <span>Total:</span>
                              <span className="font-mono text-sm text-[#7958d8]">
                                Rp {posTotal.toLocaleString("id-ID")}
                              </span>
                            </div>

                            <button
                              type="button"
                              disabled={posTotal === 0}
                              onClick={() => setReceiptPrinted(true)}
                              className="mt-2 btn-tactile w-full rounded-lg bg-[#d9ff57] py-2 text-xs font-bold text-[#232331] disabled:opacity-50 flex items-center justify-center gap-1.5"
                            >
                              <Printer size={13} strokeWidth={2.4} />
                              <span>Cetak Struk Thermal Bluetooth</span>
                            </button>
                          </div>
                        </div>

                      </div>

                      {/* ========================================================= */}
                      {/* AESTHETIC REALISTIC ARTISAN THERMAL RECEIPT MODAL / FEED */}
                      {/* ========================================================= */}
                      {receiptPrinted && (
                        <div className="mt-5 animate-fadeIn">
                          {/* Receipt Printer Slot Indicator */}
                          <div className="flex items-center justify-between px-2 pb-1.5 font-mono text-[10px] font-bold text-[#7958d8]">
                            <span className="flex items-center gap-1">
                              <span className="h-2 w-2 rounded-full bg-[#16a34a] animate-pulse" />
                              <span>STRUK TERCETAK DARI BLUETOOTH PRINTER (58mm)</span>
                            </span>
                            <button
                              type="button"
                              onClick={() => setReceiptPrinted(false)}
                              className="text-[#ef4444] hover:underline"
                            >
                              ✕ Tutup Struk
                            </button>
                          </div>

                          {/* The Aesthetic Thermal Paper */}
                          <div className="relative mx-auto max-w-[360px] rounded-t-xl bg-[#ffffff] p-5 font-mono text-[#232331] shadow-ink-lg border-2 border-[#232331] text-xs">
                            
                            {/* Receipt Header */}
                            <div className="text-center pb-3 border-b-2 border-dashed border-[#232331]">
                              <div className="flex items-center justify-center gap-1.5">
                                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[#232331] text-white">
                                  <Coffee size={12} strokeWidth={2.4} />
                                </span>
                                <p className="font-extrabold text-sm tracking-wider uppercase">SENJA COFFEE &amp; EATERY</p>
                              </div>
                              <p className="text-[10px] text-[#7b7b8e] mt-0.5">
                                Jl. R.E. Martadinata No. 42, Bandung
                              </p>
                              <p className="text-[9px] text-[#7b7b8e]">Telp: 0812-3456-7890 • IG: @senjacoffee.id</p>
                            </div>

                            {/* Transaction Details */}
                            <div className="py-2.5 border-b-2 border-dashed border-[#232331] text-[10px] space-y-1 text-[#7b7b8e]">
                              <div className="flex justify-between">
                                <span>NO. STRUK: #KL-88924</span>
                                <span className="font-bold text-[#232331]">{cashierActiveTable.toUpperCase()} (DINE IN)</span>
                              </div>
                              <div className="flex justify-between">
                                <span>WAKTU: 25/08/2026 17:15</span>
                                <span>KASIR: AYU P.</span>
                              </div>
                            </div>

                            {/* Itemized Order List */}
                            <div className="py-3 border-b-2 border-dashed border-[#232331] space-y-2 text-xs">
                              {Object.entries(posCart).map(([id, qty]) => {
                                const item = posMenuItems.find((m) => m.id === id);
                                if (!item) return null;
                                return (
                                  <div key={id}>
                                    <div className="flex justify-between font-bold text-[#232331]">
                                      <span>{item.name}</span>
                                      <span>Rp {(item.price * qty).toLocaleString("id-ID")}</span>
                                    </div>
                                    <div className="flex justify-between text-[10px] text-[#7b7b8e]">
                                      <span>{qty} x Rp {item.price.toLocaleString("id-ID")}</span>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>

                            {/* Calculation Subtotal & Taxes */}
                            <div className="py-2.5 border-b-2 border-dashed border-[#232331] text-xs space-y-1">
                              <div className="flex justify-between text-[#7b7b8e] text-[11px]">
                                <span>Subtotal</span>
                                <span>Rp {posTotal.toLocaleString("id-ID")}</span>
                              </div>
                              <div className="flex justify-between text-[#7b7b8e] text-[11px]">
                                <span>PB1 / Pajak Resto (0%)</span>
                                <span>Rp 0</span>
                              </div>
                              <div className="flex justify-between font-extrabold text-sm text-[#232331] pt-1.5 border-t border-dashed border-[#dedee8]">
                                <span>TOTAL BAYAR</span>
                                <span className="text-[#7958d8]">Rp {posTotal.toLocaleString("id-ID")}</span>
                              </div>
                            </div>

                            {/* Payment Method Status */}
                            <div className="py-2.5 border-b-2 border-dashed border-[#232331] text-[10px] space-y-1">
                              <div className="flex justify-between font-bold text-[#16a34a]">
                                <span>METODE: {cashierPaymentStatus === "qris_paid" ? "QRIS DINAMIS" : "KASIR TUNAI/DEBIT"}</span>
                                <span>[ LUNAS ✓ ]</span>
                              </div>
                              <div className="flex justify-between text-[#7b7b8e]">
                                <span>REF ID: 981273918239</span>
                                <span>NMID: ID1020039281</span>
                              </div>
                            </div>

                            {/* Footer Call to Action (Google Review & Loyalty) */}
                            <div className="pt-3 text-center space-y-1.5">
                              <span className="inline-block rounded border border-[#232331] bg-[#d9ff57] px-2 py-0.5 text-[9px] font-bold text-[#232331]">
                                ★ TAP NFC DI MEJA KASIR UNTUK ULASAN MAPS ★
                              </span>
                              <p className="text-[10px] font-bold text-[#232331]">
                                Terima kasih sudah mampir di Senja Coffee!
                              </p>
                              <p className="text-[9px] text-[#7b7b8e]">
                                Simpan struk ini untuk klaim poin stamp WhatsApp
                              </p>
                              
                              {/* Barcode Strip */}
                              <div className="pt-2 text-[#232331]">
                                <p className="text-base tracking-[0.35em] font-mono leading-none">||||||||||||||||||||||||||||||||||||</p>
                                <p className="text-[8px] text-[#7b7b8e] mt-1">POWERED BY KAEL POS SYSTEM</p>
                              </div>
                            </div>

                            {/* Serrated Tear Cut Edge at Bottom */}
                            <div
                              className="absolute -bottom-2.5 left-0 right-0 h-3 bg-[#ffffff] border-b-2 border-[#232331]"
                              style={{
                                clipPath:
                                  "polygon(0% 0%, 5% 100%, 10% 0%, 15% 100%, 20% 0%, 25% 100%, 30% 0%, 35% 100%, 40% 0%, 45% 100%, 50% 0%, 55% 100%, 60% 0%, 65% 100%, 70% 0%, 75% 100%, 80% 0%, 85% 100%, 90% 0%, 95% 100%, 100% 0%)",
                              }}
                            />

                          </div>
                        </div>
                      )}

                    </div>
                  )}

                  {/* VIEW 3: COMPREHENSIVE OWNER ANALYTICS DASHBOARD */}
                  {posViewMode === "dashboard" && (
                    <div className="w-full rounded-2xl border-2 border-[#232331] bg-white p-3.5 sm:p-6 text-[#232331] shadow-ink-lg animate-fadeIn overflow-hidden">
                      
                      {/* Dashboard Header & Period Filter */}
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#dedee8] pb-4">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="flex h-6 w-6 items-center justify-center rounded-md bg-[#7958d8] text-white font-mono text-[10px] font-bold">
                              <BarChart3 size={14} strokeWidth={2.4} />
                            </span>
                            <h4 className="text-sm font-extrabold text-[#232331]">
                              Dashboard Laporan Pemilik Usaha
                            </h4>
                          </div>
                          <p className="text-[11px] text-[#7b7b8e] mt-0.5">
                            Senja Coffee &amp; Eatery • Data Terupdate Real-Time
                          </p>
                        </div>

                        {/* Period Filter Tabs */}
                        <div className="flex rounded-lg border border-[#232331] bg-[#fcfcfe] p-0.5 shadow-ink-xs text-xs font-mono">
                          <button
                            type="button"
                            onClick={() => setDashboardPeriod("today")}
                            className={`px-3 py-1 rounded-md font-bold transition-all ${
                              dashboardPeriod === "today"
                                ? "bg-[#232331] text-white"
                                : "text-[#7b7b8e] hover:text-[#232331]"
                            }`}
                          >
                            Hari Ini
                          </button>
                          <button
                            type="button"
                            onClick={() => setDashboardPeriod("month")}
                            className={`px-3 py-1 rounded-md font-bold transition-all ${
                              dashboardPeriod === "month"
                                ? "bg-[#232331] text-white"
                                : "text-[#7b7b8e] hover:text-[#232331]"
                            }`}
                          >
                            Bulan Ini (Agu 2026)
                          </button>
                        </div>
                      </div>

                      {/* KPI Summary Cards */}
                      <div className="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-2 sm:gap-2.5 font-mono">
                        <div className="rounded-xl border border-[#232331] bg-[#f0edff] p-3 shadow-ink-xs">
                          <p className="text-[9px] font-bold text-[#7958d8] uppercase">
                            {dashboardPeriod === "today" ? "OMZET HARI INI" : "TOTAL OMZET BULANAN"}
                          </p>
                          <p className="text-sm sm:text-base font-extrabold text-[#232331] mt-0.5">
                            {dashboardPeriod === "today" ? "Rp 2.450.000" : "Rp 58.450.000"}
                          </p>
                          <span className="text-[9px] text-[#16a34a] font-bold">▲ +18.4% vs periode lalu</span>
                        </div>

                        <div className="rounded-xl border border-[#232331] bg-[#fcfcfe] p-3 shadow-ink-xs">
                          <p className="text-[9px] font-bold text-[#7b7b8e] uppercase">TOTAL STRUK / NOTA</p>
                          <p className="text-sm sm:text-base font-extrabold text-[#232331] mt-0.5">
                            {dashboardPeriod === "today" ? "78 Struk" : "1.840 Struk"}
                          </p>
                          <span className="text-[9px] text-[#7b7b8e]">~Rp 31.700 / struk</span>
                        </div>

                        <div className="rounded-xl border border-[#232331] bg-[#fcfcfe] p-3 shadow-ink-xs">
                          <p className="text-[9px] font-bold text-[#7b7b8e] uppercase">METODE BAYAR</p>
                          <p className="text-xs sm:text-sm font-extrabold text-[#232331] mt-0.5">
                            72% QRIS
                          </p>
                          <span className="text-[9px] text-[#7b7b8e]">28% Tunai Kasir</span>
                        </div>
                      </div>

                      {/* Best Sellers (Fast Moving) vs Dead Stock (Slow Moving) */}
                      <div className="mt-4 grid gap-3 sm:grid-cols-2">
                        
                        {/* Box 1: Best Sellers & Customer Favorites */}
                        <div className="rounded-xl border border-[#232331] bg-[#fcfcfe] p-3.5 shadow-ink-xs">
                          <div className="flex items-center justify-between pb-2 border-b border-[#dedee8]">
                            <span className="font-mono text-[10px] font-bold text-[#16a34a] uppercase flex items-center gap-1.5">
                              <span className="flex h-4 w-4 items-center justify-center rounded-full bg-[#d9ff57] text-[#232331] border border-[#232331]">
                                <Sparkles size={10} strokeWidth={2.4} />
                              </span>
                              <span>MENU TERLARIS &amp; FAVORIT</span>
                            </span>
                            <span className="text-[9px] font-mono text-[#7b7b8e]">Fast Moving</span>
                          </div>
                          
                          <div className="mt-2.5 space-y-2 text-xs">
                            <div className="flex items-center justify-between">
                              <div className="truncate pr-2">
                                <span className="font-bold text-[#232331]">1. Iced Spanish Latte</span>
                                <span className="block text-[10px] text-[#7958d8] font-bold">⭐ Menu Favorit Pelanggan</span>
                              </div>
                              <div className="text-right font-mono shrink-0">
                                <span className="font-bold text-[#232331]">620 terjual</span>
                                <span className="block text-[10px] text-[#7b7b8e]">Rp 17,3 Jt</span>
                              </div>
                            </div>

                            <div className="flex items-center justify-between border-t border-[#f0f0f0] pt-1.5">
                              <div className="truncate pr-2">
                                <span className="font-bold text-[#232331]">2. Butter Croissant</span>
                                <span className="block text-[10px] text-[#7b7b8e]">Bakery terlaris</span>
                              </div>
                              <div className="text-right font-mono shrink-0">
                                <span className="font-bold text-[#232331]">410 terjual</span>
                                <span className="block text-[10px] text-[#7b7b8e]">Rp 9,8 Jt</span>
                              </div>
                            </div>

                            <div className="flex items-center justify-between border-t border-[#f0f0f0] pt-1.5">
                              <div className="truncate pr-2">
                                <span className="font-bold text-[#232331]">3. Kopi Susu Aren</span>
                                <span className="block text-[10px] text-[#7b7b8e]">Menu harian</span>
                              </div>
                              <div className="text-right font-mono shrink-0">
                                <span className="font-bold text-[#232331]">385 terjual</span>
                                <span className="block text-[10px] text-[#7b7b8e]">Rp 6,9 Jt</span>
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* Box 2: Slow Moving & Dead Stock Alert */}
                        <div className="rounded-xl border border-[#232331] bg-[#fff5f5] p-3.5 shadow-ink-xs border-[#ef4444]/30">
                          <div className="flex items-center justify-between pb-2 border-b border-[#fdd]">
                            <span className="font-mono text-[10px] font-bold text-[#ef4444] uppercase flex items-center gap-1.5">
                              <span className="flex h-4 w-4 items-center justify-center rounded-full bg-[#feebee] text-[#ef4444] border border-[#ef4444]">
                                !
                              </span>
                              <span>STOK JARANG KEJUAL</span>
                            </span>
                            <span className="text-[9px] font-mono text-[#ef4444]">Slow Moving</span>
                          </div>

                          <div className="mt-2.5 space-y-2 text-xs">
                            <div className="flex items-center justify-between">
                              <div className="truncate pr-2">
                                <span className="font-bold text-[#232331]">1. Earl Grey Scone</span>
                                <span className="block text-[10px] text-[#ef4444]">Bahan rawan kadaluarsa</span>
                              </div>
                              <div className="text-right font-mono shrink-0">
                                <span className="font-bold text-[#ef4444]">Cuma 6 terjual</span>
                                <span className="block text-[10px] text-[#7b7b8e]">Rp 144 Rb</span>
                              </div>
                            </div>

                            <div className="flex items-center justify-between border-t border-[#fee] pt-1.5">
                              <div className="truncate pr-2">
                                <span className="font-bold text-[#232331]">2. Lemon Soda Syrup</span>
                                <span className="block text-[10px] text-[#7b7b8e]">Saran: Bikin paket bundling</span>
                              </div>
                              <div className="text-right font-mono shrink-0">
                                <span className="font-bold text-[#232331]">12 terjual</span>
                                <span className="block text-[10px] text-[#7b7b8e]">Rp 288 Rb</span>
                              </div>
                            </div>

                            <div className="rounded-lg bg-white border border-[#ef4444]/20 p-2 text-[10px] text-[#7b7b8e] leading-snug">
                              💡 <em>Sistem KAEL memberi peringatan dini sebelum modal tokomu mengendap jadi barang kadaluarsa!</em>
                            </div>
                          </div>
                        </div>

                      </div>

                      {/* WhatsApp Bot Sync Notification */}
                      <div className="mt-4 rounded-xl border-2 border-[#232331] bg-[#f0edff] p-3.5 sm:p-4 text-[#232331] shadow-ink-xs overflow-hidden">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 sm:gap-3">
                          <div className="flex items-start gap-2.5 min-w-0 flex-1">
                            <span className="flex h-7 w-7 sm:h-8 sm:w-8 shrink-0 items-center justify-center rounded-lg bg-[#25D366] text-white border border-[#232331] shadow-ink-xs">
                              <MessageCircle size={15} strokeWidth={2.4} fill="currentColor" />
                            </span>
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="font-extrabold text-xs text-[#232331]">
                                  Rekap Otomatis ke WhatsApp Owner
                                </span>
                                <span className="font-mono text-[9px] font-bold text-[#16a34a] bg-[#dcfce7] px-2 py-0.2 rounded border border-[#16a34a] shrink-0">
                                  ● Aktif
                                </span>
                              </div>
                              <p className="text-[11px] text-[#7b7b8e] mt-1 leading-relaxed">
                                Semua data penjualan, omzet harian, dan stok terjual otomatis dikirim ke nomor WhatsApp Owner setiap jam 22:00 saat tutup kasir.
                              </p>
                            </div>
                          </div>

                          <div className="pt-1 sm:pt-0 shrink-0">
                            <span className="font-mono text-[10px] font-bold bg-[#232331] text-[#d9ff57] px-3 py-1.5 rounded-lg border border-[#232331] flex items-center justify-center gap-1">
                              <span>Auto-Sync 22:00</span>
                              <span>✓</span>
                            </span>
                          </div>
                        </div>
                      </div>

                    </div>
                  )}

                </div>
              </div>
            )}

            {/* ========================================================= */}
            {/* 3. MOCKUP LAYANAN 3: KALKULATOR HPP & MARGIN ENGINE */}
            {/* ========================================================= */}
            {activeService === "hpp" && (
              <div className="grid gap-8 lg:grid-cols-12 items-start">
                {/* Left Description & Mode Switcher */}
                <div className="lg:col-span-5 min-w-0 w-full space-y-4">
                  <div className="inline-flex items-center gap-2 rounded-full border border-[#232331] bg-[#d9ff57] px-3 py-1 font-mono text-[10px] font-bold text-[#232331] uppercase">
                    <span>✦ MODUL 03</span>
                    <span>· Kalkulator HPP & Kulakan Anti Boncos</span>
                  </div>

                  <h3 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-[#232331]">
                    Hitung HPP Presisi: Bikin Sendiri atau Kulakan Supplier
                  </h3>
                  <p className="text-xs sm:text-sm font-normal text-[#7b7b8e] leading-relaxed">
                    Mau olah resep menu sendiri atau titip jual barang kulakan dari supplier? Engine HPP KAEL menghitung seluruh modal, ongkir per pcs, kemasan, hingga mengunci margin laba amanmu secara otomatis.
                  </p>

                  {/* Mode Switcher: Bikin Sendiri vs Kulakan Supplier */}
                  <div className="pt-1">
                    <p className="text-xs font-mono font-bold uppercase tracking-wider text-[#7958d8] mb-2">
                      PILIH MODEL BISNIS USAHAMU:
                    </p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => setHppCalculationMode("recipe")}
                        className={`btn-tactile rounded-xl p-2.5 text-center text-xs font-bold transition-all flex sm:flex-col items-center justify-center gap-2 sm:gap-1 ${
                          hppCalculationMode === "recipe"
                            ? "bg-[#d9ff57] text-[#232331] shadow-ink-xs border-2 border-[#232331]"
                            : "bg-white text-[#232331] border border-[#dedee8] hover:bg-[#f0edff]"
                        }`}
                      >
                        <span className="text-base sm:text-sm">🍳</span>
                        <span className="text-xs sm:text-[11px] leading-tight">1. Bikin Sendiri (Resep)</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setHppCalculationMode("supplier")}
                        className={`btn-tactile rounded-xl p-2.5 text-center text-xs font-bold transition-all flex sm:flex-col items-center justify-center gap-2 sm:gap-1 ${
                          hppCalculationMode === "supplier"
                            ? "bg-[#d9ff57] text-[#232331] shadow-ink-xs border-2 border-[#232331]"
                            : "bg-white text-[#232331] border border-[#dedee8] hover:bg-[#f0edff]"
                        }`}
                      >
                        <span className="text-base sm:text-sm">📦</span>
                        <span className="text-xs sm:text-[11px] leading-tight">2. Kulakan / Beli Jadi</span>
                      </button>
                    </div>
                  </div>

                  {/* Mode A: Preset Menu Resep */}
                  {hppCalculationMode === "recipe" && (
                    <div className="pt-1 animate-fadeIn">
                      <p className="text-[11px] font-mono font-bold text-[#7b7b8e] mb-1.5">
                        PILIH CONTOH RESEP MENU:
                      </p>
                      <div className="grid grid-cols-3 gap-2">
                        <button
                          type="button"
                          onClick={() => handleSelectRecipe("kopsu")}
                          className={`btn-tactile rounded-xl p-2 text-center text-xs font-bold transition-all ${
                            activeRecipeKey === "kopsu"
                              ? "bg-[#232331] text-white shadow-ink-xs"
                              : "bg-white text-[#232331] border border-[#dedee8] hover:bg-[#f0edff]"
                          }`}
                        >
                          <span className="block text-sm">☕</span>
                          <span className="text-[11px] font-bold">Kopi Susu</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => handleSelectRecipe("croissant")}
                          className={`btn-tactile rounded-xl p-2 text-center text-xs font-bold transition-all ${
                            activeRecipeKey === "croissant"
                              ? "bg-[#232331] text-white shadow-ink-xs"
                              : "bg-white text-[#232331] border border-[#dedee8] hover:bg-[#f0edff]"
                          }`}
                        >
                          <span className="block text-sm">🥐</span>
                          <span className="text-[11px] font-bold">Croissant</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => handleSelectRecipe("matcha")}
                          className={`btn-tactile rounded-xl p-2 text-center text-xs font-bold transition-all ${
                            activeRecipeKey === "matcha"
                              ? "bg-[#232331] text-white shadow-ink-xs"
                              : "bg-white text-[#232331] border border-[#dedee8] hover:bg-[#f0edff]"
                          }`}
                        >
                          <span className="block text-sm">🍵</span>
                          <span className="text-[11px] font-bold">Matcha Oat</span>
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Mode B: Preset Kulakan Supplier */}
                  {hppCalculationMode === "supplier" && (
                    <div className="pt-1 animate-fadeIn">
                      <p className="text-[11px] font-mono font-bold text-[#7b7b8e] mb-1.5">
                        PILIH CONTOH BARANG KULAKAN / VENDOR:
                      </p>
                      <div className="grid grid-cols-3 gap-2">
                        <button
                          type="button"
                          onClick={() => handleSelectSupplierPreset("cheesecake")}
                          className={`btn-tactile rounded-xl p-2 text-center text-xs font-bold transition-all ${
                            activeSupplierKey === "cheesecake"
                              ? "bg-[#232331] text-white shadow-ink-xs"
                              : "bg-white text-[#232331] border border-[#dedee8] hover:bg-[#f0edff]"
                          }`}
                        >
                          <span className="text-sm block">🍰</span>
                          <span className="truncate block text-[10px]">Cheesecake</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => handleSelectSupplierPreset("dimsum")}
                          className={`btn-tactile rounded-xl p-2 text-center text-xs font-bold transition-all ${
                            activeSupplierKey === "dimsum"
                              ? "bg-[#232331] text-white shadow-ink-xs"
                              : "bg-white text-[#232331] border border-[#dedee8] hover:bg-[#f0edff]"
                          }`}
                        >
                          <span className="text-sm block">🥟</span>
                          <span className="truncate block text-[10px]">Dimsum Box</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => handleSelectSupplierPreset("parfum")}
                          className={`btn-tactile rounded-xl p-2 text-center text-xs font-bold transition-all ${
                            activeSupplierKey === "parfum"
                              ? "bg-[#232331] text-white shadow-ink-xs"
                              : "bg-white text-[#232331] border border-[#dedee8] hover:bg-[#f0edff]"
                          }`}
                        >
                          <span className="text-sm block">🧴</span>
                          <span className="truncate block text-[10px]">Parfum Merch</span>
                        </button>
                      </div>
                    </div>
                  )}

                  <div className="space-y-2 pt-2 text-xs font-semibold text-[#232331]">
                    <div className="flex items-center gap-2">
                      <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[#d9ff57] text-[#232331]">
                        <Check size={12} strokeWidth={3} />
                      </span>
                      <span><strong>Bebas Ketik Angka Custom:</strong> Ubah takaran atau harga modal sesukamu</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[#d9ff57] text-[#232331]">
                        <Check size={12} strokeWidth={3} />
                      </span>
                      <span><strong>Hitung Ongkir & Kemasan:</strong> Modal dihitung detail per pcs agar margin gak bocor</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[#d9ff57] text-[#232331]">
                        <Check size={12} strokeWidth={3} />
                      </span>
                      <span>Alarm pintar deteksi margin laba (Sangat Sehat vs Rawan Boncos)</span>
                    </div>
                  </div>
                </div>

                {/* Right Interactive HPP Formula Engine Mockup */}
                <div className="lg:col-span-7 min-w-0 w-full">
                  
                  {/* ========================================================= */}
                  {/* VIEW A: MODE BIKIN SENDIRI (RESEP MENU & BAHAN BAKU) */}
                  {/* ========================================================= */}
                  {hppCalculationMode === "recipe" && (
                    <div className="rounded-2xl border-2 border-[#232331] bg-white p-3.5 sm:p-6 text-[#232331] shadow-ink-lg animate-fadeIn overflow-hidden">
                      
                      {/* Header */}
                      <div className="flex items-center justify-between border-b border-[#dedee8] pb-3">
                        <div className="min-w-0 flex-1 pr-2">
                          <span className="text-[9.5px] sm:text-[10px] font-mono font-bold uppercase tracking-wider text-[#7958d8] block truncate">
                            {currentRecipe.category} · FORMULA RESEP AKTIF
                          </span>
                          <h4 className="text-xs sm:text-sm font-extrabold text-[#232331] truncate">{currentRecipe.name}</h4>
                        </div>
                        <span
                          className={`rounded-md border border-[#232331] px-2 py-0.5 sm:px-2.5 sm:py-1 font-mono text-[9px] sm:text-[10px] font-bold shadow-ink-xs shrink-0 ${
                            profitMargin >= 65
                              ? "bg-[#d9ff57] text-[#232331]"
                              : profitMargin >= 50
                              ? "bg-[#ffb36b] text-[#232331]"
                              : "bg-[#ffc2bf] text-[#ef4444]"
                          }`}
                        >
                          MARGIN {profitMargin}%
                        </span>
                      </div>

                      {/* Interactive Ingredients Table with Steppers & Custom Input */}
                      <div className="mt-3.5 space-y-2 font-mono text-xs">
                        <div className="flex justify-between text-[9.5px] sm:text-[10px] font-bold text-[#7b7b8e] px-1 pb-1 border-b border-[#dedee8]">
                          <span>RINCIAN BAHAN BAKU</span>
                          <span>TAKARAN &amp; MODAL</span>
                        </div>

                        {currentRecipe.ingredients.map((item) => {
                          const itemCost = Math.round(item.unitPrice * item.qty);
                          const stepDelta = item.unit === "set" ? 1 : item.unit === "gram" && item.qty < 10 ? 1 : item.unit === "gram" ? 5 : 10;

                          return (
                            <div
                              key={item.id}
                              className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 rounded-xl border border-[#232331] bg-[#fcfcfe] p-2.5 sm:p-3 shadow-ink-xs transition-all hover:bg-white"
                            >
                              <div className="min-w-0 flex-1">
                                <p className="text-xs font-bold text-[#232331] truncate font-sans">{item.name}</p>
                                <p className="text-[10px] text-[#7b7b8e]">{item.packageInfo}</p>
                              </div>

                              {/* Stepper Controls & Custom Input */}
                              <div className="flex items-center justify-between sm:justify-end gap-2 pt-1.5 sm:pt-0 border-t sm:border-t-0 border-[#dedee8]/60">
                                <div className="flex items-center rounded-lg border border-[#232331] bg-white overflow-hidden shadow-ink-xs">
                                  <button
                                    type="button"
                                    onClick={() => handleUpdateQty(item.id, -stepDelta)}
                                    className="px-2 py-0.5 sm:py-1 font-bold text-[#232331] hover:bg-[#f0edff] active:bg-[#dedee8]"
                                    title="Kurangi takaran"
                                  >
                                    −
                                  </button>
                                  
                                  <div className="flex items-center bg-[#fcfcfe] border-x border-[#232331] px-1">
                                    <input
                                      type="number"
                                      min={1}
                                      value={item.qty}
                                      onChange={(e) => handleSetIngredientQty(item.id, Number(e.target.value) || 1)}
                                      className="w-9 sm:w-10 bg-transparent text-center text-[11px] font-bold text-[#232331] focus:outline-none"
                                    />
                                    <span className="text-[10px] text-[#7b7b8e] pr-1">{item.unit}</span>
                                  </div>

                                  <button
                                    type="button"
                                    onClick={() => handleUpdateQty(item.id, stepDelta)}
                                    className="px-2 py-0.5 sm:py-1 font-bold text-[#232331] hover:bg-[#f0edff] active:bg-[#dedee8]"
                                    title="Tambah takaran"
                                  >
                                    +
                                  </button>
                                </div>

                                <span className="text-right font-bold text-[#7958d8] text-xs font-mono">
                                  Rp {itemCost.toLocaleString("id-ID")}
                                </span>
                              </div>
                            </div>
                          );
                        })}
                      </div>

                      {/* Interactive Selling Price Adjustment */}
                      <div className="mt-4 rounded-xl border border-[#dedee8] bg-[#f0edff] p-3">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
                          <span className="font-bold text-[#232331]">Atur Harga Jual Menu:</span>
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => setSellingPrice((p) => Math.max(5000, p - 1000))}
                              className="btn-tactile rounded-lg border border-[#232331] bg-white px-2 py-1 font-mono text-[10px] font-bold text-[#232331]"
                            >
                              − 1rb
                            </button>
                            <div className="flex items-center rounded-lg border border-[#232331] bg-white px-2 py-1 shadow-ink-xs">
                              <span className="font-mono text-xs text-[#7b7b8e] mr-1">Rp</span>
                              <input
                                type="number"
                                step={1000}
                                value={sellingPrice}
                                onChange={(e) => setSellingPrice(Number(e.target.value) || 0)}
                                className="w-20 bg-transparent font-mono text-sm font-extrabold text-[#7958d8] focus:outline-none text-right"
                              />
                            </div>
                            <button
                              type="button"
                              onClick={() => setSellingPrice((p) => p + 1000)}
                              className="btn-tactile rounded-lg border border-[#232331] bg-white px-2 py-1 font-mono text-[10px] font-bold text-[#232331]"
                            >
                              + 1rb
                            </button>
                          </div>
                        </div>
                      </div>

                      {/* Summary Outcome Box */}
                      <div className="mt-4 rounded-xl border-2 border-[#232331] bg-white p-3 sm:p-4 shadow-ink-xs">
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 border-b border-[#dedee8] pb-3 text-xs font-mono">
                          <div>
                            <p className="text-[9px] text-[#7b7b8e] font-bold">TOTAL HPP BAHAN</p>
                            <p className="font-bold text-[#ef4444] text-sm mt-0.5">Rp {totalHpp.toLocaleString("id-ID")}</p>
                          </div>
                          <div>
                            <p className="text-[9px] text-[#7b7b8e] font-bold">HARGA JUAL</p>
                            <p className="font-bold text-[#232331] text-sm mt-0.5">Rp {sellingPrice.toLocaleString("id-ID")}</p>
                          </div>
                          <div>
                            <p className="text-[9px] text-[#7b7b8e] font-bold">UNTUNG BERSIH / PORSI</p>
                            <p className="font-bold text-[#16a34a] text-sm mt-0.5">+Rp {grossProfit.toLocaleString("id-ID")}</p>
                          </div>
                        </div>

                        {/* Smart Health Status Bar */}
                        <div className="mt-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <span
                              className={`h-2.5 w-2.5 rounded-full animate-pulse ${
                                profitMargin >= 65 ? "bg-[#16a34a]" : profitMargin >= 50 ? "bg-[#f59e0b]" : "bg-[#ef4444]"
                              }`}
                            />
                            <span className="text-[11px] font-bold text-[#232331]">
                              {profitMargin >= 65
                                ? "Status Menu: SANGAT SEHAT & CUAN TEBAL"
                                : profitMargin >= 50
                                ? "Status Menu: MARGIN STANDAR (Bisa Dioptimalkan)"
                                : "Status Menu: RAWAN BONCOS (Naikkan Harga / Kurangi Takaran)"}
                            </span>
                          </div>
                          <span className="rounded border border-[#232331] bg-[#d9ff57] px-2 py-0.5 font-mono text-[10px] font-bold text-[#232331] text-center">
                            Laba {profitMargin}% per Cup
                          </span>
                        </div>

                        {/* Monthly Simulation Projection */}
                        <div className="mt-3 rounded-lg bg-[#fcfcfe] border border-[#dedee8] p-2.5 text-[11px] text-[#232331] flex items-center justify-between">
                          <span>
                            Jika laku <strong>{currentRecipe.dailySalesEst} porsi/hari</strong> ({currentRecipe.dailySalesEst * 30} porsi/bln):
                          </span>
                          <span className="font-mono font-bold text-[#7958d8]">
                            +Rp {monthlyProfitEst.toLocaleString("id-ID")} <span className="text-[9px] text-[#7b7b8e]">profit/bln</span>
                          </span>
                        </div>

                      </div>

                    </div>
                  )}

                  {/* ========================================================= */}
                  {/* VIEW B: MODE BELI JADI / KULAKAN SUPPLIER (RESELLER & RETAIL) */}
                  {/* ========================================================= */}
                  {hppCalculationMode === "supplier" && (
                    <div className="rounded-2xl border-2 border-[#232331] bg-white p-5 sm:p-6 text-[#232331] shadow-ink-lg animate-fadeIn">
                      
                      {/* Header */}
                      <div className="flex items-center justify-between border-b border-[#dedee8] pb-3">
                        <div>
                          <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-[#7958d8]">
                            {currentSupplierPreset.category} · SIMULASI KULAKAN
                          </span>
                          <h4 className="text-sm font-extrabold text-[#232331]">{currentSupplierPreset.name}</h4>
                          <p className="text-[10px] text-[#7b7b8e] mt-0.5">{currentSupplierPreset.vendorNote}</p>
                        </div>
                        <span
                          className={`rounded-md border border-[#232331] px-2.5 py-1 font-mono text-[10px] font-bold shadow-ink-xs ${
                            supplierMargin >= 40
                              ? "bg-[#d9ff57] text-[#232331]"
                              : supplierMargin >= 25
                              ? "bg-[#ffb36b] text-[#232331]"
                              : "bg-[#ffc2bf] text-[#ef4444]"
                          }`}
                        >
                          MARKUP {supplierMargin}%
                        </span>
                      </div>

                      {/* Interactive Kulakan Cost Inputs */}
                      <div className="mt-4 space-y-2.5 font-mono text-xs">
                        <div className="flex justify-between text-[10px] font-bold text-[#7b7b8e] px-1 pb-1 border-b border-[#dedee8]">
                          <span>KOMPONEN MODAL KULAKAN</span>
                          <span>BISA DIKETIK SESUAI NOTA SUPPLIER</span>
                        </div>

                        {/* 1. Harga Beli dari Supplier */}
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 rounded-xl border border-[#232331] bg-[#fcfcfe] p-2.5 sm:p-3 shadow-ink-xs">
                          <div>
                            <p className="text-xs font-bold text-[#232331] font-sans">1. Harga Beli dari Supplier / Vendor</p>
                            <p className="text-[10px] text-[#7b7b8e]">Harga modal per pcs dari distributor</p>
                          </div>
                          <div className="flex items-center justify-between sm:justify-end gap-2 pt-1 sm:pt-0 border-t sm:border-t-0 border-[#dedee8]/60">
                            <div className="flex items-center rounded-lg border border-[#232331] bg-white px-2 py-1 shadow-ink-xs">
                              <span className="font-mono text-xs text-[#7b7b8e] mr-1">Rp</span>
                              <input
                                type="number"
                                step={500}
                                value={supplierBuyPrice}
                                onChange={(e) => setSupplierBuyPrice(Number(e.target.value) || 0)}
                                className="w-20 bg-transparent font-mono text-xs font-bold text-[#232331] focus:outline-none text-right"
                              />
                            </div>
                          </div>
                        </div>

                        {/* 2. Ongkos Kirim per Pcs */}
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 rounded-xl border border-[#232331] bg-[#fcfcfe] p-2.5 sm:p-3 shadow-ink-xs">
                          <div>
                            <p className="text-xs font-bold text-[#232331] font-sans">2. Ongkir Supplier per Pcs</p>
                            <p className="text-[10px] text-[#7b7b8e]">Total ongkir dibagi jumlah pcs kiriman</p>
                          </div>
                          <div className="flex items-center justify-between sm:justify-end gap-2 pt-1 sm:pt-0 border-t sm:border-t-0 border-[#dedee8]/60">
                            <div className="flex items-center rounded-lg border border-[#232331] bg-white px-2 py-1 shadow-ink-xs">
                              <span className="font-mono text-xs text-[#7b7b8e] mr-1">Rp</span>
                              <input
                                type="number"
                                step={500}
                                value={supplierShippingFee}
                                onChange={(e) => setSupplierShippingFee(Number(e.target.value) || 0)}
                                className="w-20 bg-transparent font-mono text-xs font-bold text-[#232331] focus:outline-none text-right"
                              />
                            </div>
                          </div>
                        </div>

                        {/* 3. Kemasan / Paper Bag / Box */}
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 rounded-xl border border-[#232331] bg-[#fcfcfe] p-2.5 sm:p-3 shadow-ink-xs">
                          <div>
                            <p className="text-xs font-bold text-[#232331] font-sans">3. Kemasan / Box / Paper Bag</p>
                            <p className="text-[10px] text-[#7b7b8e]">Biaya packaging take-away tokomu</p>
                          </div>
                          <div className="flex items-center justify-between sm:justify-end gap-2 pt-1 sm:pt-0 border-t sm:border-t-0 border-[#dedee8]/60">
                            <div className="flex items-center rounded-lg border border-[#232331] bg-white px-2 py-1 shadow-ink-xs">
                              <span className="font-mono text-xs text-[#7b7b8e] mr-1">Rp</span>
                              <input
                                type="number"
                                step={100}
                                value={supplierPackagingFee}
                                onChange={(e) => setSupplierPackagingFee(Number(e.target.value) || 0)}
                                className="w-20 bg-transparent font-mono text-xs font-bold text-[#232331] focus:outline-none text-right"
                              />
                            </div>
                          </div>
                        </div>

                        {/* 4. Atur Harga Jual & Target Harian */}
                        <div className="grid gap-2 sm:grid-cols-2 pt-1">
                          <div className="rounded-xl border border-[#232331] bg-[#f0edff] p-2.5">
                            <span className="text-[10px] font-bold text-[#232331] block font-sans">Harga Jual ke Pelanggan:</span>
                            <div className="mt-1 flex items-center justify-between">
                              <span className="text-xs font-bold text-[#7958d8]">Rp</span>
                              <input
                                type="number"
                                step={1000}
                                value={supplierSellingPrice}
                                onChange={(e) => setSupplierSellingPrice(Number(e.target.value) || 0)}
                                className="w-24 rounded-md border border-[#232331] bg-white px-2 py-1 text-right font-mono text-xs font-extrabold text-[#7958d8] focus:outline-none"
                              />
                            </div>
                          </div>

                          <div className="rounded-xl border border-[#232331] bg-[#f0edff] p-2.5">
                            <span className="text-[10px] font-bold text-[#232331] block font-sans">Target Terjual / Hari:</span>
                            <div className="mt-1 flex items-center justify-between">
                              <span className="text-xs text-[#7b7b8e]">Target:</span>
                              <div className="flex items-center gap-1">
                                <input
                                  type="number"
                                  min={1}
                                  value={supplierDailySales}
                                  onChange={(e) => setSupplierDailySales(Number(e.target.value) || 1)}
                                  className="w-14 rounded-md border border-[#232331] bg-white px-2 py-1 text-center font-mono text-xs font-bold text-[#232331] focus:outline-none"
                                />
                                <span className="text-[10px] font-bold text-[#232331]">pcs/hari</span>
                              </div>
                            </div>
                          </div>
                        </div>

                      </div>

                      {/* Summary Outcome Box for Supplier */}
                      <div className="mt-4 rounded-xl border-2 border-[#232331] bg-white p-3 sm:p-4 shadow-ink-xs">
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 border-b border-[#dedee8] pb-3 text-xs font-mono">
                          <div>
                            <p className="text-[9px] text-[#7b7b8e] font-bold">TOTAL MODAL KULAKAN</p>
                            <p className="font-bold text-[#ef4444] text-sm mt-0.5">Rp {totalSupplierHpp.toLocaleString("id-ID")}</p>
                            <span className="text-[8px] text-[#7b7b8e] block">Beli + Ongkir + Pack</span>
                          </div>
                          <div>
                            <p className="text-[9px] text-[#7b7b8e] font-bold">HARGA JUAL</p>
                            <p className="font-bold text-[#232331] text-sm mt-0.5">Rp {supplierSellingPrice.toLocaleString("id-ID")}</p>
                          </div>
                          <div>
                            <p className="text-[9px] text-[#7b7b8e] font-bold">UNTUNG BERSIH / PCS</p>
                            <p className="font-bold text-[#16a34a] text-sm mt-0.5">+Rp {supplierProfitPerPcs.toLocaleString("id-ID")}</p>
                          </div>
                        </div>

                        {/* Health Status */}
                        <div className="mt-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <span
                              className={`h-2.5 w-2.5 rounded-full animate-pulse ${
                                supplierMargin >= 40 ? "bg-[#16a34a]" : supplierMargin >= 25 ? "bg-[#f59e0b]" : "bg-[#ef4444]"
                              }`}
                            />
                            <span className="text-[11px] font-bold text-[#232331]">
                              {supplierMargin >= 40
                                ? "Status Kulakan: SANGAT SEHAT & CUAN IDEAL"
                                : supplierMargin >= 25
                                ? "Status Kulakan: MARGIN STANDAR (Hati-hati biaya listrik/karyawan)"
                                : "Status Kulakan: RAWAN BONCOS (Naikkan harga jual atau cari supplier lebih murah)"}
                            </span>
                          </div>
                          <span className="rounded border border-[#232331] bg-[#d9ff57] px-2 py-0.5 font-mono text-[10px] font-bold text-[#232331] text-center">
                            Margin {supplierMargin}%
                          </span>
                        </div>

                        {/* Monthly Simulation Projection */}
                        <div className="mt-3 rounded-lg bg-[#fcfcfe] border border-[#dedee8] p-2.5 text-[11px] text-[#232331] flex items-center justify-between">
                          <span>
                            Jika laku <strong>{supplierDailySales} pcs/hari</strong> ({supplierDailySales * 30} pcs/bln):
                          </span>
                          <span className="font-mono font-bold text-[#7958d8]">
                            +Rp {supplierMonthlyProfitEst.toLocaleString("id-ID")} <span className="text-[9px] text-[#7b7b8e]">profit/bln</span>
                          </span>
                        </div>

                      </div>

                    </div>
                  )}

                </div>
              </div>
            )}

            {/* ========================================================= */}
            {/* 4. MOCKUP LAYANAN 4: VIP MEMBERSHIP & CASHIER POINT SEND FLOW */}
            {/* ========================================================= */}
            {activeService === "wa" && (
              <div className="grid gap-8 lg:grid-cols-12 items-start">
                {/* Left Description & View Switcher */}
                <div className="lg:col-span-5 min-w-0 w-full space-y-4">
                  <div className="inline-flex items-center gap-2 rounded-full border border-[#232331] bg-[#d9ff57] px-3 py-1 font-mono text-[10px] font-bold text-[#232331] uppercase">
                    <span>✦ MODUL 04</span>
                    <span>· Pelanggan Pencet Klaim · Kasir Input Poin</span>
                  </div>

                  <h3 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-[#232331]">
                    Customer Pencet Klaim, Kasir Ketik &amp; Kirim Poin
                  </h3>
                  <p className="text-xs sm:text-sm font-normal text-[#7b7b8e] leading-relaxed">
                    Saat belanja, customer cukup pencet tombol <strong>Klaim Poin</strong> di HP mereka. Kasir tinggal mengetik jumlah poin belanja di dashboard kasir, lalu klik kirim—poin <strong>otomatis langsung masuk ke HP pelanggan</strong> dan notifikasi WhatsApp terkirim seketika!
                  </p>

                  {/* Dual View Switcher: Layar Pelanggan vs Dashboard Kasir */}
                  <div className="pt-1">
                    <p className="text-xs font-mono font-bold uppercase tracking-wider text-[#7958d8] mb-2">
                      PILIH TAMPILAN SIMULASI:
                    </p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => setMembershipViewMode("customer")}
                        className={`btn-tactile rounded-xl p-2.5 text-center text-xs font-bold transition-all flex sm:flex-col items-center justify-center gap-2 sm:gap-1 ${
                          membershipViewMode === "customer"
                            ? "bg-[#d9ff57] text-[#232331] shadow-ink-xs border-2 border-[#232331]"
                            : "bg-white text-[#232331] border border-[#dedee8] hover:bg-[#f0edff]"
                        }`}
                      >
                        <Smartphone size={16} strokeWidth={2.4} />
                        <span className="text-xs sm:text-[11px] leading-tight">1. Layar HP Pelanggan</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setMembershipViewMode("merchant")}
                        className={`btn-tactile rounded-xl p-2.5 text-center text-xs font-bold transition-all flex sm:flex-col items-center justify-center gap-2 sm:gap-1 ${
                          membershipViewMode === "merchant"
                            ? "bg-[#d9ff57] text-[#232331] shadow-ink-xs border-2 border-[#232331]"
                            : "bg-white text-[#232331] border border-[#dedee8] hover:bg-[#f0edff]"
                        }`}
                      >
                        <Laptop size={16} strokeWidth={2.4} />
                        <span className="text-xs sm:text-[11px] leading-tight">2. Dashboard Kasir</span>
                      </button>
                    </div>
                  </div>

                  {/* Customer Flow Step Sub-Switcher (Active in Customer View) */}
                  {membershipViewMode === "customer" && (
                    <div className="pt-1 animate-fadeIn">
                      <p className="text-[11px] font-mono font-bold text-[#7b7b8e] mb-1.5">
                        ALUR HP PELANGGAN:
                      </p>
                      <div className="grid grid-cols-3 gap-1.5">
                        <button
                          type="button"
                          onClick={() => setMembershipStep("card_tap")}
                          className={`btn-tactile rounded-xl p-2 text-center text-xs font-bold transition-all flex flex-col items-center justify-center gap-1 ${
                            membershipStep === "card_tap"
                              ? "bg-[#232331] text-white shadow-ink-xs"
                              : "bg-white text-[#232331] border border-[#dedee8] hover:bg-[#f0edff]"
                          }`}
                        >
                          <CreditCard size={14} strokeWidth={2.4} />
                          <span className="truncate block text-[10px]">1. Tap Kartu</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => setMembershipStep("register")}
                          className={`btn-tactile rounded-xl p-2 text-center text-xs font-bold transition-all flex flex-col items-center justify-center gap-1 ${
                            membershipStep === "register"
                              ? "bg-[#232331] text-white shadow-ink-xs"
                              : "bg-white text-[#232331] border border-[#dedee8] hover:bg-[#f0edff]"
                          }`}
                        >
                          <FileText size={14} strokeWidth={2.4} />
                          <span className="truncate block text-[10px]">2. Form WA</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => setMembershipStep("card_view")}
                          className={`btn-tactile rounded-xl p-2 text-center text-xs font-bold transition-all flex flex-col items-center justify-center gap-1 ${
                            membershipStep === "card_view"
                              ? "bg-[#232331] text-white shadow-ink-xs"
                              : "bg-white text-[#232331] border border-[#dedee8] hover:bg-[#f0edff]"
                          }`}
                        >
                          <Crown size={14} strokeWidth={2.4} />
                          <span className="truncate block text-[10px]">3. Kartu &amp; Poin</span>
                        </button>
                      </div>
                    </div>
                  )}

                  <div className="space-y-2 pt-2 text-xs font-semibold text-[#232331]">
                    <div className="flex items-center gap-2">
                      <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[#d9ff57] text-[#232331]">
                        <Check size={12} strokeWidth={3} />
                      </span>
                      <span><strong>Customer Tinggal Pencet Klaim:</strong> HP langsung terhubung ke kasir</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[#d9ff57] text-[#232331]">
                        <Check size={12} strokeWidth={3} />
                      </span>
                      <span><strong>Kasir Ketik Nominal Poin:</strong> Bebas atur poin sesuai nilai belanja</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[#d9ff57] text-[#232331]">
                        <Check size={12} strokeWidth={3} />
                      </span>
                      <span><strong>Poin Otomatis Masuk:</strong> Saldo di HP &amp; WA langsung bertambah seketika</span>
                    </div>
                    <div className="flex items-center gap-2 text-[#7958d8]">
                      <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[#f0edff] border border-[#7958d8] text-[#7958d8]">
                        <Gift size={11} strokeWidth={2.4} />
                      </span>
                      <span><strong>BONUS GRATIS:</strong> Tim KAEL sediakan file desain poster loyalty siap cetak!</span>
                    </div>
                  </div>
                </div>

                {/* Right Interactive Experience: Customer View vs Merchant Dashboard */}
                <div className="lg:col-span-7 min-w-0 w-full flex flex-col items-center">
                  
                  {/* ========================================================= */}
                  {/* VIEW 1: CUSTOMER SCREEN (NFC TAP -> FORM WA -> VIP CARD) */}
                  {/* ========================================================= */}
                  {membershipViewMode === "customer" && (
                    <div className="w-full flex flex-col items-center animate-fadeIn">
                      
                      {/* STEP 1: PHYSICAL NFC & QR STANDEE CARD */}
                      {membershipStep === "card_tap" && (
                        <div className="w-full max-w-[420px] rounded-2xl border-2 border-[#232331] bg-white p-4 sm:p-6 text-[#232331] shadow-ink-lg text-center animate-fadeIn overflow-hidden">
                          <div className="inline-flex items-center gap-1.5 rounded-full border border-[#232331] bg-[#d9ff57] px-3 py-1 font-mono text-[9.5px] sm:text-[10px] font-bold text-[#232331] uppercase">
                            <span>STAND KARTU MEMBER DI KASIR / MEJA</span>
                          </div>

                          <div
                            onClick={() => setMembershipStep("register")}
                            className="mx-auto mt-5 sm:mt-6 flex h-32 w-32 sm:h-36 sm:w-36 cursor-pointer items-center justify-center rounded-full border-2 border-dashed border-[#7958d8] bg-[#f0edff] animate-pulse transition-transform hover:scale-105 shadow-ink-sm"
                          >
                            <div className="text-center">
                              <Nfc size={36} className="mx-auto text-[#7958d8]" strokeWidth={2.4} />
                              <span className="mt-1.5 block font-mono text-[9.5px] sm:text-[10px] font-extrabold uppercase text-[#7958d8]">
                                TEMPEL HP DI SINI
                              </span>
                            </div>
                          </div>

                          <h4 className="mt-4 sm:mt-5 text-sm sm:text-base font-extrabold text-[#232331]">
                            Kartu NFC &amp; QR Membership KAEL
                          </h4>
                          <p className="mt-1 text-xs text-[#7b7b8e] px-2 sm:px-4 leading-relaxed">
                            Pelanggan cukup dekatkan smartphone ke kartu NFC untuk membuka formulir registrasi member tokomu.
                          </p>

                          <button
                            type="button"
                            onClick={() => setMembershipStep("register")}
                            className="mt-4 sm:mt-5 btn-tactile inline-flex items-center justify-center gap-2 rounded-xl bg-[#232331] px-4 sm:px-5 py-2.5 sm:py-3 text-xs font-bold text-white shadow-ink-xs w-full sm:w-auto"
                          >
                            <span>Simulasikan Tempel HP (Buka Form)</span>
                            <ArrowRight size={13} className="text-[#d9ff57]" />
                          </button>
                        </div>
                      )}

                      {/* STEP 2: INSTANT REGISTRATION FORM (NAME & WHATSAPP) */}
                      {membershipStep === "register" && (
                        <div className="w-full max-w-[420px] rounded-2xl border-2 border-[#232331] bg-white p-4 sm:p-6 text-[#232331] shadow-ink-lg animate-fadeIn overflow-hidden">
                          <div className="flex items-center justify-between border-b border-[#dedee8] pb-3">
                            <div className="flex items-center gap-2">
                              <span className="flex h-6 w-6 sm:h-7 sm:w-7 items-center justify-center rounded-lg bg-[#d9ff57] text-[#232331] font-mono text-xs font-bold border border-[#232331]">
                                VIP
                              </span>
                              <div>
                                <h4 className="text-xs font-extrabold text-[#232331] uppercase">FORM PENDAFTARAN MEMBER</h4>
                                <p className="text-[10px] text-[#7b7b8e]">Senja Coffee &amp; Eatery</p>
                              </div>
                            </div>
                            <span className="font-mono text-[9px] text-[#7958d8] font-bold bg-[#f0edff] px-2 py-0.5 rounded border border-[#232331]">
                              1-Detik Terdaftar
                            </span>
                          </div>

                          <form onSubmit={handleRegisterMember} className="mt-4 space-y-3.5 text-xs">
                            <div>
                              <label className="block font-bold text-[#232331] mb-1 font-sans">
                                Nama Lengkap Pelanggan:
                              </label>
                              <input
                                type="text"
                                required
                                value={memberName}
                                onChange={(e) => setMemberName(e.target.value)}
                                placeholder="Contoh: Rian Prasetya"
                                className="w-full rounded-xl border border-[#232331] bg-[#fcfcfe] p-3 text-xs font-bold text-[#232331] shadow-ink-xs focus:outline-none focus:ring-2 focus:ring-[#7958d8]"
                              />
                            </div>

                            <div>
                              <label className="block font-bold text-[#232331] mb-1 font-sans">
                                Nomor WhatsApp Aktif:
                              </label>
                              <div className="flex items-center rounded-xl border border-[#232331] bg-[#fcfcfe] px-3 py-1 shadow-ink-xs">
                                <span className="font-mono font-bold text-[#7b7b8e] mr-2">+62</span>
                                <input
                                  type="tel"
                                  required
                                  value={memberPhone}
                                  onChange={(e) => setMemberPhone(e.target.value)}
                                  placeholder="0812-3456-7890"
                                  className="w-full bg-transparent py-2 text-xs font-bold font-mono text-[#232331] focus:outline-none"
                                />
                              </div>
                              <span className="text-[10px] text-[#7b7b8e] mt-1 block">
                                Nomor WA otomatis tersimpan di database kontak tokomu untuk info promo &amp; laporan poin.
                              </span>
                            </div>

                            <button
                              type="submit"
                              className="mt-2 btn-tactile w-full rounded-xl bg-[#d9ff57] py-3 text-xs font-bold text-[#232331] border-2 border-[#232331] shadow-ink-xs"
                            >
                              Daftar &amp; Terbitkan Kartu VIP Digital ✦
                            </button>
                          </form>
                        </div>
                      )}

                      {/* STEP 3: DIGITAL VIP MEMBERSHIP CARD & LIVE POINT CLAIM BUTTON */}
                      {membershipStep === "card_view" && (
                        <div className="w-full max-w-[440px] flex flex-col items-center animate-fadeIn">
                          
                          {/* The Cool Digital VIP Membership Card in Light Mode */}
                          <div className="w-full rounded-2xl border-2 border-[#232331] bg-white p-5 sm:p-6 text-[#232331] shadow-purple-lg relative overflow-hidden transition-all duration-300 hover:scale-[1.01]">
                            
                            {/* Top Header */}
                            <div className="flex items-center justify-between border-b border-[#dedee8] pb-3.5">
                              <div className="flex items-center gap-2.5">
                                <Image
                                  src="/kael-logo-fix.png"
                                  alt="KAEL Logo"
                                  width={26}
                                  height={26}
                                  className="h-6 w-auto object-contain"
                                />
                                <div>
                                  <span className="text-xs font-extrabold tracking-tight text-[#232331]">
                                    kael<span className="text-[#7958d8]">pass</span>
                                  </span>
                                  <span className="block font-mono text-[9px] text-[#7b7b8e] uppercase">
                                    SENJA COFFEE VIP PASS
                                  </span>
                                </div>
                              </div>

                              <div className="flex items-center gap-1.5 rounded-lg border border-[#232331] bg-[#f0edff] px-2.5 py-1 text-[10px] font-mono font-bold text-[#7958d8] shadow-ink-xs">
                                <Nfc size={13} strokeWidth={2.4} />
                                <span>NFC VIP CHIP</span>
                              </div>
                            </div>

                            {/* Member Profile Info */}
                            <div className="mt-4 flex items-center justify-between">
                              <div className="flex items-center gap-3">
                                <span className="flex h-10 w-10 items-center justify-center rounded-full border-2 border-[#232331] bg-[#d9ff57] text-[#232331] font-mono font-bold text-sm shadow-ink-xs">
                                  {memberName ? memberName.charAt(0).toUpperCase() : "R"}
                                </span>
                                <div>
                                  <h4 className="text-sm font-extrabold text-[#232331] tracking-tight uppercase">
                                    {memberName || "RIAN PRASETYA"}
                                  </h4>
                                  <p className="font-mono text-[10px] text-[#7958d8] font-bold">
                                    WA: {memberPhone}
                                  </p>
                                </div>
                              </div>

                              <span className="rounded-full border border-[#232331] bg-[#d9ff57] px-3 py-1 font-mono text-[10px] font-bold text-[#232331] uppercase shadow-ink-xs">
                                GOLD MEMBER ★★★
                              </span>
                            </div>

                            {/* Point Balance Report Strip */}
                            <div className="mt-4 rounded-xl border border-[#232331] bg-[#f0edff] p-3 shadow-ink-xs flex items-center justify-between">
                              <div>
                                <span className="font-mono text-[9px] font-bold text-[#7958d8] uppercase">
                                  SALDO POIN DI SENJA COFFEE
                                </span>
                                <p className="font-mono text-base font-extrabold text-[#232331] mt-0.5">
                                  {claimApproved ? "0 POIN (Klaim Sukses)" : `${pointBalance} POIN`}
                                </p>
                              </div>
                              <div className="text-right">
                                <span className="font-mono text-[9px] font-bold text-[#7b7b8e] uppercase">
                                  STATUS REWARD
                                </span>
                                <p className="font-mono text-xs font-bold text-[#16a34a] mt-0.5">
                                  {claimApproved
                                    ? "✓ Voucher Sudah Ditukar"
                                    : stampCount === 8
                                    ? "1 Kopi Gratis Siap Klaim!"
                                    : "Kurang 1 Stamp Lagi"}
                                </p>
                              </div>
                            </div>

                            {/* CUSTOMER POINT CLAIM ACTION STRIP */}
                            <div className="mt-3.5 rounded-xl border-2 border-[#232331] bg-[#fcfcfe] p-3 shadow-ink-xs">
                              {customerPointClaimRequested ? (
                                <div className="text-center py-1">
                                  <div className="inline-flex items-center gap-1.5 text-xs font-bold text-[#7958d8] animate-pulse">
                                    <span className="h-2 w-2 rounded-full bg-[#7958d8] animate-ping" />
                                    <span>⏳ Permintaan Klaim Poin Terkirim ke Kasir!</span>
                                  </div>
                                  <p className="text-[10px] text-[#7b7b8e] mt-0.5">
                                    Buka tab <strong>&quot;2. Dashboard Kasir&quot;</strong> di atas untuk melihat kasir mengetik &amp; mengirim poinmu.
                                  </p>
                                </div>
                              ) : lastAwardedNotification ? (
                                <div className="flex items-center justify-between text-xs">
                                  <div className="flex items-center gap-1.5">
                                    <Sparkles size={14} className="text-[#16a34a]" />
                                    <span className="font-bold text-[#16a34a]">
                                      +{lastAwardedNotification} Poin Berhasil Masuk dari Kasir!
                                    </span>
                                  </div>
                                  <button
                                    type="button"
                                    onClick={handleCustomerRequestPoints}
                                    className="btn-tactile text-[10px] font-bold text-[#7958d8] underline"
                                  >
                                    Klaim Lagi
                                  </button>
                                </div>
                              ) : (
                                <button
                                  type="button"
                                  onClick={handleCustomerRequestPoints}
                                  className="btn-tactile w-full py-2 rounded-lg bg-[#232331] text-[#d9ff57] font-bold text-xs flex items-center justify-center gap-1.5 shadow-ink-xs"
                                >
                                  <Zap size={13} className="text-[#d9ff57]" />
                                  <span>Pencet Klaim Poin Belanja di Kasir</span>
                                </button>
                              )}
                            </div>

                            {/* 8-Slot Interactive Stamp Grid (Light Mode) */}
                            <div className="mt-3.5 rounded-xl border-2 border-[#232331] bg-[#fcfcfe] p-4 shadow-ink-xs">
                              <div className="flex items-center justify-between pb-2.5 border-b border-[#dedee8] text-[10px] font-mono font-bold text-[#7b7b8e]">
                                <span>STAMP LOYALITAS KUNJUNGAN</span>
                                <span className="text-[#7958d8] font-bold">
                                  {claimApproved ? "0/8 (Siklus Baru)" : `${stampCount}/8 TERKUMPUL`}
                                </span>
                              </div>

                              {/* 8 Stamp Slots */}
                              <div className="mt-3 grid grid-cols-4 gap-2.5">
                                {[1, 2, 3, 4, 5, 6, 7, 8].map((slot) => {
                                  const isStamped = !claimApproved && slot <= stampCount;
                                  const isTarget = slot === 8;

                                  return (
                                    <div
                                      key={slot}
                                      className={`flex flex-col items-center justify-center rounded-xl p-2.5 transition-all duration-300 ${
                                        isStamped
                                          ? "border-2 border-[#232331] bg-[#d9ff57] text-[#232331] shadow-ink-xs scale-100"
                                          : isTarget && !claimApproved
                                          ? "border-2 border-dashed border-[#7958d8] bg-[#f0edff] text-[#7958d8] animate-pulse cursor-pointer hover:bg-[#e4ddff]"
                                          : "border border-[#dedee8] bg-white text-[#7b7b8e]"
                                      }`}
                                    >
                                      <span className="flex items-center justify-center h-4 w-4">
                                        {isStamped ? (
                                          <Coffee size={14} strokeWidth={2.4} />
                                        ) : isTarget ? (
                                          <Gift size={14} strokeWidth={2.4} />
                                        ) : (
                                          <span className="h-2 w-2 rounded-full border border-[#dedee8]" />
                                        )}
                                      </span>
                                      <span className="mt-1 font-mono text-[9px] font-bold">
                                        {isTarget && !isStamped ? "FREE" : `0${slot}`}
                                      </span>
                                    </div>
                                  );
                                })}
                              </div>

                              {/* Progress Bar */}
                              <div className="mt-3.5">
                                <div className="h-2.5 w-full rounded-full bg-[#dedee8] overflow-hidden border border-[#232331]">
                                  <div
                                    className="h-full bg-[#7958d8] transition-all duration-500"
                                    style={{ width: claimApproved ? "0%" : stampCount === 8 ? "100%" : "87.5%" }}
                                  />
                                </div>
                                <p className="mt-1.5 text-center font-mono text-[10px] font-bold text-[#7958d8]">
                                  {claimApproved
                                    ? "REWARD SUDAH DITUKAR DI KASIR! SIKLUS STAMP BARU DIMULAI."
                                    : stampCount === 8
                                    ? "8/8 STAMP LENGKAP! KODE VOUCHER SIAP DI-APPROVE KASIR!"
                                    : "TINGGAL 1 STAMP LAGI UNTUK DAPAT 1 CUP KOPI GRATIS!"}
                                </p>
                              </div>
                            </div>

                            {/* Reward Voucher Box */}
                            {stampCount === 8 && !claimApproved && (
                              <div className="mt-3.5 rounded-xl border-2 border-[#232331] bg-[#d9ff57] p-3 text-[#232331] animate-fadeIn shadow-ink-xs flex items-center justify-between">
                                <div>
                                  <p className="font-mono text-[9px] font-bold uppercase tracking-wider text-[#232331]">
                                    KODE VOUCHER KLAIM DI KASIR
                                  </p>
                                  <p className="text-xs font-extrabold text-[#232331]">1x Artisan Coffee Gratis</p>
                                </div>
                                <div className="text-right">
                                  <span className="rounded-lg border border-[#232331] bg-white px-2.5 py-1 font-mono text-xs font-bold text-[#7958d8]">
                                    SENJA-VIP-88
                                  </span>
                                  <span className="block text-[8px] text-[#232331]/70 font-mono mt-0.5">Menunggu Approval Kasir</span>
                                </div>
                              </div>
                            )}

                            {/* Card Footer with Digital Barcode */}
                            <div className="mt-4 pt-3 border-t border-[#dedee8] flex items-center justify-between text-[9px] font-mono text-[#7b7b8e]">
                              <span className="tracking-widest">|||| ||| | ||||| || |</span>
                              <span className="text-[#7958d8] font-bold">100% AUTO-SYNC LAPORAN WHATSAPP</span>
                            </div>

                          </div>

                          {/* WhatsApp Live Bot Companion Strip */}
                          <div className="mt-3.5 w-full rounded-xl border border-[#232331] bg-[#f0edff] p-3 shadow-ink-xs text-[#232331]">
                            <div className="flex items-start gap-2.5">
                              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-[#25d366] text-white">
                                <MessageCircle size={15} fill="currentColor" />
                              </span>
                              <div className="min-w-0 flex-1 text-xs">
                                <div className="flex items-center justify-between">
                                  <span className="font-bold text-[#075e54]">Bot WhatsApp KAEL</span>
                                  <span className="font-mono text-[9px] text-[#7b7b8e]">Baru saja</span>
                                </div>
                                <p className="mt-0.5 text-[11px] text-[#232331] leading-relaxed">
                                  {claimApproved
                                    ? `☕ *Senja Coffee:* Selamat ${memberName || "Kak"}! Voucher *SENJA-VIP-88* berhasil di-approve oleh Kasir. Selamat menikmati 1x Artisan Coffee Gratismu! ☕`
                                    : lastAwardedNotification
                                    ? `☕ *Senja Coffee:* Halo ${memberName || "Kak"}! Kasir telah menginput *+${lastAwardedNotification} Poin* ke tokomu. Total saldo poinmu sekarang *${pointBalance} Poin*.`
                                    : stampCount === 8
                                    ? `☕ *Senja Coffee:* Halo ${memberName || "Kak"}! Kamu memiliki total *${pointBalance} Poin*. Voucher *SENJA-VIP-88* aktif! Tunjukkan kode ini ke kasir untuk di-approve.`
                                    : `☕ *Senja Coffee:* Halo ${memberName || "Kak"}! Saldo poin aktif: *${pointBalance} Poin*. Kumpulkan stamp untuk klaim 1 Kopi Gratis!`}
                                </p>
                              </div>
                            </div>
                          </div>

                          {/* Reset Helper Button */}
                          <button
                            type="button"
                            onClick={handleResetLoyaltyState}
                            className="mt-3 btn-tactile text-[11px] font-bold text-[#7b7b8e] hover:text-[#232331] flex items-center gap-1"
                          >
                            <RotateCcw size={12} />
                            <span>Reset Simulasi Poin</span>
                          </button>

                        </div>
                      )}

                    </div>
                  )}

                  {/* ========================================================= */}
                  {/* VIEW 2: MERCHANT DASHBOARD & CASHIER INPUT POINT PANEL */}
                  {/* ========================================================= */}
                  {membershipViewMode === "merchant" && (
                    <div className="w-full rounded-2xl border-2 border-[#232331] bg-white p-3.5 sm:p-6 text-[#232331] shadow-ink-lg animate-fadeIn space-y-4 overflow-hidden">
                      
                      {/* Dashboard Header */}
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#dedee8] pb-3.5">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="flex h-6 w-6 items-center justify-center rounded-md bg-[#232331] text-[#d9ff57] font-mono text-[10px] font-bold shrink-0">
                              POS
                            </span>
                            <h4 className="text-xs sm:text-sm font-extrabold text-[#232331]">
                              Dashboard Kasir · Input Poin &amp; Approval Klaim
                            </h4>
                          </div>
                          <p className="text-[10px] sm:text-[11px] text-[#7b7b8e] mt-0.5">
                            Senja Coffee &amp; Eatery • Real-Time Point Crediting &amp; Rewards
                          </p>
                        </div>

                        <span className="font-mono text-[9px] sm:text-[10px] font-bold text-[#16a34a] bg-[#f0fff4] px-2.5 py-1 rounded-lg border border-[#16a34a] self-start sm:self-auto">
                          ● Kasir Standby
                        </span>
                      </div>

                      {/* FEATURE 1: CASHIER INPUT & SEND POINT SECTION */}
                      <div className="rounded-xl border-2 border-[#232331] bg-[#f0edff] p-3 sm:p-4 shadow-ink-xs">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 border-b border-[#232331]/20 pb-2.5">
                          <div className="flex items-center gap-2">
                            <span className="flex items-center gap-1.5 text-xs font-bold text-[#232331] font-mono uppercase">
                              <Keyboard size={14} className="text-[#7958d8]" strokeWidth={2.4} />
                              <span>1. INPUT POIN UNTUK PELANGGAN</span>
                            </span>
                            {customerPointClaimRequested && (
                              <span className="rounded-full bg-[#ef4444] text-white px-2 py-0.2 text-[9px] font-bold font-mono animate-pulse">
                                1 Permintaan Klaim Aktif
                              </span>
                            )}
                          </div>
                          <span className="font-mono text-[10px] text-[#7958d8] font-bold">
                            Member: Rian Prasetya
                          </span>
                        </div>

                        <div className="mt-3 grid gap-3 sm:grid-cols-12 items-center">
                          <div className="sm:col-span-7">
                            <label className="block text-[11px] font-bold text-[#232331] mb-1">
                              Ketik Jumlah Poin yang Ingin Dikasih:
                            </label>
                            <div className="flex items-center gap-2">
                              <div className="flex items-center rounded-xl border border-[#232331] bg-white px-3 py-1 shadow-ink-xs">
                                <span className="font-mono text-xs font-bold text-[#7958d8] mr-2">+</span>
                                <input
                                  type="number"
                                  min={1}
                                  value={cashierAwardAmount}
                                  onChange={(e) => setCashierAwardAmount(Number(e.target.value) || 1)}
                                  className="w-16 bg-transparent font-mono text-sm font-extrabold text-[#232331] focus:outline-none"
                                />
                                <span className="font-mono text-[10px] text-[#7b7b8e] font-bold">Pts</span>
                              </div>

                              {/* Quick Presets */}
                              <div className="flex gap-1">
                                {[10, 20, 50].map((preset) => (
                                  <button
                                    key={preset}
                                    type="button"
                                    onClick={() => setCashierAwardAmount(preset)}
                                    className={`btn-tactile rounded-lg px-2 py-1 font-mono text-[10px] font-bold border border-[#232331] ${
                                      cashierAwardAmount === preset
                                        ? "bg-[#232331] text-[#d9ff57]"
                                        : "bg-white text-[#232331]"
                                    }`}
                                  >
                                    +{preset}
                                  </button>
                                ))}
                              </div>
                            </div>
                          </div>

                          <div className="sm:col-span-5 pt-1 sm:pt-0">
                            <button
                              type="button"
                              onClick={handleCashierSendPoints}
                              className="btn-tactile w-full rounded-xl bg-[#d9ff57] py-2.5 text-xs font-bold text-[#232331] border-2 border-[#232331] shadow-ink-xs flex items-center justify-center gap-1.5"
                            >
                              <span>✦ Kirim Poin ke Pelanggan</span>
                              <ArrowRight size={13} strokeWidth={2.5} />
                            </button>
                          </div>
                        </div>

                        <p className="mt-2.5 text-[10px] text-[#7b7b8e] leading-snug">
                          Setelah kasir klik <strong>Kirim Poin</strong>, poin otomatis langsung masuk ke saldo HP &amp; bot WhatsApp pelanggan seketika!
                        </p>
                      </div>

                      {/* Summary Metrics */}
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 sm:gap-2.5 font-mono text-xs">
                        <div className="rounded-xl border border-[#232331] bg-[#fcfcfe] p-3 shadow-ink-xs">
                          <p className="text-[9px] font-bold text-[#7b7b8e] uppercase">TOTAL MEMBER</p>
                          <p className="text-sm sm:text-base font-extrabold text-[#232331] mt-0.5">428 Orang</p>
                          <span className="text-[9px] text-[#16a34a] font-bold">+14 minggu ini</span>
                        </div>

                        <div className="rounded-xl border border-[#232331] bg-[#fcfcfe] p-3 shadow-ink-xs">
                          <p className="text-[9px] font-bold text-[#7b7b8e] uppercase">TOTAL POIN BEREDAR</p>
                          <p className="text-sm sm:text-base font-extrabold text-[#7958d8] mt-0.5">12.840 Pts</p>
                          <span className="text-[9px] text-[#7b7b8e]">Saldo loyalitas aktif</span>
                        </div>

                        <div className="rounded-xl border border-[#232331] bg-[#f0edff] p-3 shadow-ink-xs">
                          <p className="text-[9px] font-bold text-[#7958d8] uppercase">ANTREAN REWARD</p>
                          <p className="text-sm sm:text-base font-extrabold text-[#232331] mt-0.5">
                            {claimApproved ? "0 Antrean" : stampCount === 8 ? "1 Siap Klaim" : "0 Antrean"}
                          </p>
                          <span className="text-[9px] text-[#7958d8] font-bold">
                            {claimApproved ? "Semua selesai ✓" : stampCount === 8 ? "Menunggu approval" : "Belum ada antrean"}
                          </span>
                        </div>
                      </div>

                      {/* Interactive Member Directory Table */}
                      <div className="space-y-2 font-mono text-xs">
                        <div className="flex justify-between text-[10px] font-bold text-[#7b7b8e] px-1 pb-1 border-b border-[#dedee8]">
                          <span>DATA MEMBER &amp; WHATSAPP</span>
                          <span>SALDO POIN &amp; APPROVAL REWARD</span>
                        </div>

                        {memberDirectory.map((m) => {
                          const isRewardReady = m.id === "M-01" && stampCount === 8 && !claimApproved;

                          return (
                            <div
                              key={m.id}
                              className={`flex flex-col sm:flex-row sm:items-center justify-between rounded-xl border p-3 shadow-ink-xs transition-all gap-2 ${
                                isRewardReady
                                  ? "border-2 border-[#232331] bg-[#d9ff57]/30 shadow-ink-sm"
                                  : "border-[#dedee8] bg-[#fcfcfe]"
                              }`}
                            >
                              <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-2">
                                  <span className="font-bold text-[#232331] font-sans text-xs">{m.name}</span>
                                  <span className="text-[9px] font-bold text-[#7958d8] bg-[#f0edff] px-1.5 py-0.2 rounded border border-[#232331]">
                                    {m.tier}
                                  </span>
                                </div>
                                <p className="text-[10px] text-[#7b7b8e] mt-0.5">
                                  WA: {m.phone} • ID: #{m.id}
                                </p>
                              </div>

                              {/* Points & Cashier Action Button */}
                              <div className="flex items-center justify-between sm:justify-end gap-3 shrink-0">
                                <div className="text-left sm:text-right">
                                  <span className="font-bold text-xs text-[#232331]">
                                    {m.id === "M-01" ? (claimApproved ? "0 Pts" : `${pointBalance} Pts`) : `${m.points} Pts`}
                                  </span>
                                  <span className="block text-[9px] text-[#7b7b8e]">
                                    {m.id === "M-01" && claimApproved
                                      ? "Reward Di-Approve ✓"
                                      : isRewardReady
                                      ? "Voucher Kopi Siap Tukar"
                                      : m.rewardItem}
                                  </span>
                                </div>

                                {m.id === "M-01" ? (
                                  claimApproved ? (
                                    <span className="rounded-lg border border-[#16a34a] bg-[#f0fff4] px-3 py-1.5 text-[10px] font-bold text-[#16a34a]">
                                      ✓ Sudah Di-Approve
                                    </span>
                                  ) : isRewardReady ? (
                                    <button
                                      type="button"
                                      onClick={() => handleApproveReward("M-01")}
                                      className="btn-tactile rounded-lg bg-[#232331] text-[#d9ff57] px-3 py-1.5 text-[10px] font-bold shadow-ink-xs hover:bg-[#1a1a24] animate-pulse"
                                    >
                                      ✓ Approve Klaim
                                    </button>
                                  ) : (
                                    <span className="rounded-lg border border-[#dedee8] bg-white px-2.5 py-1 text-[10px] text-[#7b7b8e]">
                                      {stampCount}/8 Stamp
                                    </span>
                                  )
                                ) : (
                                  <span className="rounded-lg border border-[#dedee8] bg-white px-2.5 py-1 text-[10px] text-[#7b7b8e]">
                                    Belum Klaim
                                  </span>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>

                      {/* Approval Security Info Note */}
                      <div className="rounded-xl border border-[#232331] bg-[#f0edff] p-3 text-xs text-[#232331] flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-[10px] font-bold text-[#7958d8]">SECURE</span>
                          <p className="text-[11px] leading-relaxed">
                            <strong>Sistem Poin Terkendali:</strong> Customer tidak bisa menambah poin sendiri. Poin hanya masuk setelah kasir mengetik &amp; menyetujui nominal poin di dashboard.
                          </p>
                        </div>
                      </div>

                    </div>
                  )}

                </div>
              </div>
            )}

          </div>
        </Reveal>

      </Container>
    </section>
  );
}
