"use client";

import { useState, useMemo, useEffect, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { 
  Calculator, 
  TrendingUp, 
  AlertTriangle, 
  Plus, 
  Trash2, 
  Edit3, 
  Layers, 
  CheckCircle2, 
  ArrowLeft, 
  DollarSign, 
  Sparkles, 
  History, 
  HelpCircle, 
  Info, 
  Package, 
  Save, 
  RefreshCw,
  Search,
  Check,
  ChevronRight,
  ChevronDown,
  Sliders,
  Store,
  UploadCloud,
  X,
  Minus
} from "lucide-react";
import type { 
  Recipe, 
  Ingredient, 
  IngredientPriceHistory, 
  FinanceCalculatorPreset,
  Business 
} from "@/lib/types";
import { 
  createIngredientAction,
  updateIngredientPriceAction,
  saveRecipeAction,
  deleteRecipeAction,
  getIngredientPriceHistoryAction
} from "@/lib/actions";
import { 
  calculateRecipeHpp, 
  RecipeIngredientItem, 
  RecipePackagingItem, 
  RecipeHppResult,
  roundUpTo500,
  formatMarginPercent,
  calculatePriceFromTargetProfit
} from "@/lib/finance-engine";
import { formatRupiah, formatBusinessDateTime } from "@/lib/formatters";
import QuickCalculator from "./quick-calculator";
import { BusinessMark } from "@/components/business-mark";

interface FinanceClientProps {
  business: Business | null;
  initialRecipes: Recipe[];
  /**
   * Menu POS milik toko ini. Yang belum punya resep ikut tampil di katalog
   * sebagai pekerjaan yang menunggu, supaya owner tidak perlu mengetik ulang
   * nama dan harga yang sudah ada di sistem.
   */
  menuItems: {
    id: string;
    name: string;
    price: number;
    category: string | null;
    recipe_id: string | null;
    cost_price: number;
  }[];
  initialIngredients: Ingredient[];
  initialCalculatorPresets: FinanceCalculatorPreset[];
  themeClassName?: string;
}

export default function FinanceClient({
  business,
  initialRecipes,
  menuItems,
  initialIngredients,
  initialCalculatorPresets,
  themeClassName,
}: FinanceClientProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [activeTab, setActiveTab] = useState<"quick" | "catalog" | "editor" | "simulation" | "ingredients" | "onboarding">("quick");

  // Master Data States
  const [recipes, setRecipes] = useState<Recipe[]>(initialRecipes);
  const [ingredients, setIngredients] = useState<Ingredient[]>(initialIngredients);

  useEffect(() => {
    setRecipes(initialRecipes);
  }, [initialRecipes]);

  useEffect(() => {
    setIngredients(initialIngredients);
  }, [initialIngredients]);

  const ingredientsMap = useMemo(() => {
    const map = new Map<string, { id: string; name: string; pack_price: number; pack_size: number; base_unit: "gr" | "ml" | "pcs" }>();
    ingredients.forEach((i) => {
      map.set(i.id, {
        id: i.id,
        name: i.name,
        pack_price: Number(i.pack_price),
        pack_size: Number(i.pack_size),
        base_unit: i.base_unit,
      });
    });
    return map;
  }, [ingredients]);

  const recipesWithCalc = useMemo(() => {
    return recipes.map((r) => ({
      recipe: r,
      calculation: calculateRecipeHpp(
        {
          type: r.type,
          ingredients: r.ingredients ?? [],
          packaging: r.packaging ?? [],
          output_qty: Number(r.output_qty),
          operational_cost: Number(r.operational_cost),
          selling_price: Number(r.selling_price),
          target_margin_pct: Number(r.target_margin_pct),
        },
        ingredientsMap
      ),
    }));
  }, [recipes, ingredientsMap]);

  // Search & Filter
  const [searchQuery, setSearchQuery] = useState("");
  const [filterCategory, setFilterCategory] = useState("all");
  const [ingredientQuery, setIngredientQuery] = useState("");

  // ---------------------------------------------------------------------------
  // RECIPE EDITOR STATE (Tab 2)
  // ---------------------------------------------------------------------------
  /**
   * Kalkulator dibuka KOSONG.
   *
   * Dulu berkas ini membuka layar dengan resep contoh lengkap — Iced Caramel
   * Macchiato, harga jual Rp 30.000, dua kemasan bernama Cup 16oz dan Stiker
   * Logo. Untuk penjual bakso, tidak ada satu baris pun yang berhubungan
   * dengan dagangannya, dan kalau tidak dibersihkan sebelum menekan simpan,
   * angka itu masuk ke katalog sebagai data sungguhan.
   *
   * Baris bahannya lebih buruk lagi: dia memakai kode cadangan "ing-01" kalau
   * toko belum punya bahan sama sekali. Kode itu bukan milik siapa pun, jadi
   * pemeriksaan server menolaknya dengan "Ada bahan yang tidak dikenali" —
   * untuk bahan yang tidak pernah ditambahkan penggunanya. Itu berarti resep
   * PERTAMA setiap pengguna baru selalu gagal disimpan.
   *
   * Yang boleh diisi bawaan hanya yang berlaku umum untuk usaha mana pun:
   * jumlah porsi 1 dan target margin 60%. Sisanya kosong, dan contoh
   * pengisian hidup sebagai placeholder di kolomnya — bukan sebagai data
   * yang ikut tersimpan.
   */
  const [editingRecipeId, setEditingRecipeId] = useState<string | null>(null);
  /**
   * Menu POS yang resep ini nanti disambungkan kepadanya. Tanpa penyambungan,
   * resepnya tersimpan tapi laporan laba tetap tidak menemukan modalnya.
   */
  const [linkMenuItemId, setLinkMenuItemId] = useState<string | null>(null);
  const [recipeName, setRecipeName] = useState("");
  const [recipeCategory, setRecipeCategory] = useState("");
  const [recipeType, setRecipeType] = useState<"olahan" | "kulakan">("olahan");
  const [outputQty, setOutputQty] = useState<number>(1);
  const [operationalCost, setOperationalCost] = useState<number>(0);
  const [sellingPrice, setSellingPrice] = useState<number>(0);
  const [targetMarginPct, setTargetMarginPct] = useState<number>(60);

  const [recipeIngredients, setRecipeIngredients] = useState<RecipeIngredientItem[]>([]);

  const [recipePackaging, setRecipePackaging] = useState<RecipePackagingItem[]>([]);

  // Realtime Live Calculation in Editor
  const currentEditorCalc: RecipeHppResult = useMemo(() => {
    return calculateRecipeHpp(
      {
        type: recipeType,
        output_qty: outputQty,
        operational_cost: operationalCost,
        selling_price: sellingPrice,
        target_margin_pct: targetMarginPct,
        ingredients: recipeIngredients,
        packaging: recipePackaging,
      },
      ingredientsMap
    );
  }, [recipeType, outputQty, operationalCost, sellingPrice, targetMarginPct, recipeIngredients, recipePackaging, ingredientsMap]);

  // ---------------------------------------------------------------------------
  // TARGET PROFIT SIMULATION STATE (Tab 3)
  // ---------------------------------------------------------------------------
  const [simSelectedRecipeId, setSimSelectedRecipeId] = useState<string>(recipes[0]?.id || "");
  const [simTargetProfitNominal, setSimTargetProfitNominal] = useState<number>(18000);
  const [simTargetMarginPct, setSimTargetMarginPct] = useState<number>(65);
  const [simUnitsPerDay, setSimUnitsPerDay] = useState<number>(10);
  const [simOperatingDays, setSimOperatingDays] = useState<number>(30);
  const [simMonthlyFixedCost, setSimMonthlyFixedCost] = useState<number>(0);

  const activeSimRecipe = useMemo(() => {
    return recipesWithCalc.find((r) => r.recipe.id === simSelectedRecipeId) || recipesWithCalc[0] || null;
  }, [recipesWithCalc, simSelectedRecipeId]);

  const simResult = useMemo(() => {
    if (!activeSimRecipe) return null;
    const hpp = activeSimRecipe.calculation.hpp_per_unit;
    const priceFromNominal = calculatePriceFromTargetProfit(hpp, simTargetProfitNominal);
    const actualMarginFromNominal = priceFromNominal > 0 ? ((priceFromNominal - hpp) / priceFromNominal) * 100 : 0;
    const actualProfitFromNominal = priceFromNominal - hpp;
    
    // Sama seperti di kalkulator resep: target >=100% tidak punya jawaban
    // berupa angka. Jangan diam-diam mengembalikan modal sebagai "harga".
    const marginFactor = 1 - (simTargetMarginPct / 100);
    const marginUnreachable = marginFactor <= 0;
    const priceFromMargin = marginUnreachable ? 0 : roundUpTo500(hpp / marginFactor);
    const actualProfitFromMargin = marginUnreachable ? 0 : priceFromMargin - hpp;

    return {
      priceFromNominal,
      actualMarginFromNominal,
      actualProfitFromNominal,
      priceFromMargin,
      actualProfitFromMargin,
      marginUnreachable,
    };
  }, [activeSimRecipe, simTargetProfitNominal, simTargetMarginPct]);

  const simProjections = useMemo(() => {
    if (!simResult) return [];
    const unitsPerDay = Math.max(0, simUnitsPerDay);
    const operatingDays = Math.max(0, simOperatingDays);
    const fixedCost = Math.max(0, simMonthlyFixedCost);
    const project = (key: string, label: string, price: number, profitPerUnit: number, color: "purple" | "green") => {
      const dailyRevenue = price * unitsPerDay;
      const dailyProfit = profitPerUnit * unitsPerDay;
      const monthlyRevenue = dailyRevenue * operatingDays;
      const monthlyProfit = dailyProfit * operatingDays;
      return { key, label, price, profitPerUnit, color, dailyRevenue, dailyProfit, monthlyRevenue, monthlyProfit, netAfterFixedCost: monthlyProfit - fixedCost };
    };
    const projections = [project("nominal", "Harga target laba per produk", simResult.priceFromNominal, simResult.actualProfitFromNominal, "purple")];
    if (!simResult.marginUnreachable) {
      projections.push(project("margin", `Harga target margin ${simTargetMarginPct}%`, simResult.priceFromMargin, simResult.actualProfitFromMargin, "green"));
    }
    return projections;
  }, [simResult, simUnitsPerDay, simOperatingDays, simMonthlyFixedCost, simTargetMarginPct]);

  // ---------------------------------------------------------------------------
  // INGREDIENTS MASTER & PRICE CASCADE STATE (Tab 4)
  // ---------------------------------------------------------------------------
  const [editingIngredient, setEditingIngredient] = useState<Ingredient | null>(null);
  const [newPackPriceInput, setNewPackPriceInput] = useState<number>(0);
  const [historyDrawerIng, setHistoryDrawerIng] = useState<Ingredient | null>(null);
  const [priceHistoryList, setPriceHistoryList] = useState<IngredientPriceHistory[]>([]);
  const [showAddIngredient, setShowAddIngredient] = useState(false);
  const [addCreatedIngredientToRecipe, setAddCreatedIngredientToRecipe] = useState(false);

  // New Ingredient Inputs
  const [newIngName, setNewIngName] = useState("");
  const [newIngPrice, setNewIngPrice] = useState<number>(50000);
  const [newIngSize, setNewIngSize] = useState<number>(1000);
  const [newIngUnit, setNewIngUnit] = useState<"gr" | "ml" | "pcs">("gr");
  const [newIngCategory, setNewIngCategory] = useState<"bahan_baku" | "kemasan" | "barang_kulakan" | "lainnya">("bahan_baku");
  const [newIngBrand, setNewIngBrand] = useState("");
  const [newIngSupplier, setNewIngSupplier] = useState("");
  const [newIngNotes, setNewIngNotes] = useState("");

  // Load price history when historyDrawerIng opens
  useEffect(() => {
    if (!historyDrawerIng) {
      setPriceHistoryList([]);
      return;
    }
    getIngredientPriceHistoryAction(historyDrawerIng.id).then((history) => {
      setPriceHistoryList(history as unknown as IngredientPriceHistory[]);
    });
  }, [historyDrawerIng]);

  const refreshAllCalculations = () => {
    startTransition(() => {
      router.refresh();
    });
  };

  // Switch to Editor & Populate Data
  const handleEditRecipe = (recipe: Recipe) => {
    setEditingRecipeId(recipe.id);
    setLinkMenuItemId(null);
    setRecipeName(recipe.name);
    setRecipeCategory(recipe.category || "Menu");
    setRecipeType(recipe.type);
    setOutputQty(recipe.output_qty || 1);
    setOperationalCost(recipe.operational_cost || 0);
    setSellingPrice(recipe.selling_price || 0);
    setTargetMarginPct(recipe.target_margin_pct || 60);
    setRecipeIngredients(recipe.ingredients ? [...recipe.ingredients] : []);
    setRecipePackaging(recipe.packaging ? [...recipe.packaging] : []);
    setActiveTab("editor");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleCreateNewRecipe = () => {
    setEditingRecipeId(null);
    setLinkMenuItemId(null);
    setRecipeName("");
    setRecipeCategory("");
    setRecipeType("olahan");
    setOutputQty(1);
    setOperationalCost(0);
    setSellingPrice(0);
    setTargetMarginPct(60);
    // Kosong, bukan satu baris bawaan: angka bawaan yang tidak diubah akan
    // ikut tersimpan sebagai resep sungguhan.
    setRecipeIngredients([]);
    setRecipePackaging([]);
    setActiveTab("editor");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  /**
   * Membuka editor resep untuk satu menu POS yang belum punya modal.
   *
   * Nama, kategori, dan harga jualnya diambil dari menunya sendiri — ketiganya
   * sudah ada di sistem sejak menu itu dibuat. Yang tersisa buat owner cuma
   * bagian yang memang cuma dia yang tahu: bahannya apa dan berapa banyak.
   */
  const handleBuatResepDariMenu = (menu: {
    id: string;
    name: string;
    price: number;
    category: string | null;
  }) => {
    setEditingRecipeId(null);
    setLinkMenuItemId(menu.id);
    setRecipeName(menu.name);
    setRecipeCategory(menu.category || "Menu");
    setRecipeType("olahan");
    setOutputQty(1);
    setOperationalCost(0);
    setSellingPrice(menu.price);
    setTargetMarginPct(60);
    setRecipeIngredients([]);
    setRecipePackaging([]);
    setActiveTab("editor");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleSaveRecipe = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!recipeName.trim()) {
      alert("Nama produk tidak boleh kosong.");
      return;
    }

    const res = await saveRecipeAction({
      id: editingRecipeId || undefined,
      name: recipeName.trim(),
      category: recipeCategory,
      type: recipeType,
      output_qty: outputQty,
      operational_cost: operationalCost,
      selling_price: sellingPrice,
      target_margin_pct: targetMarginPct,
      ingredients: recipeIngredients,
      packaging: recipePackaging,
      link_menu_item_id: linkMenuItemId,
    });

    if (!res.ok) {
      alert(res.error);
      return;
    }

    refreshAllCalculations();
    setActiveTab("catalog");
    alert(`Resep "${recipeName}" berhasil disimpan! HPP modal: ${formatRupiah(currentEditorCalc.hpp_per_unit)}.`);
  };

  const handleDeleteRecipe = async (id: string, name: string) => {
    if (confirm(`Hapus resep "${name}" dari katalog?`)) {
      const res = await deleteRecipeAction(id);
      if (!res.ok) {
        alert(res.error);
        return;
      }
      refreshAllCalculations();
    }
  };

  const handleAddIngredientRow = () => {
    if (ingredients.length === 0) return;
    setRecipeIngredients([
      ...recipeIngredients,
      { ingredient_id: ingredients[0].id, qty: 10 },
    ]);
  };

  const handleRemoveIngredientRow = (index: number) => {
    const updated = [...recipeIngredients];
    updated.splice(index, 1);
    setRecipeIngredients(updated);
  };

  const handleAdjustIngredientQty = (index: number, delta: number) => {
    const updated = [...recipeIngredients];
    const current = updated[index].qty || 0;
    const nextVal = Math.max(1, current + delta);
    updated[index].qty = nextVal;
    setRecipeIngredients(updated);
  };

  const handleAddPackagingRow = () => {
    setRecipePackaging([
      ...recipePackaging,
      { id: `p-${Date.now()}`, name: "Plastik / Stiker", cost: 500 },
    ]);
  };

  const handleRemovePackagingRow = (index: number) => {
    const updated = [...recipePackaging];
    updated.splice(index, 1);
    setRecipePackaging(updated);
  };

  const handleUpdateIngredientPrice = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingIngredient) return;

    const res = await updateIngredientPriceAction(editingIngredient.id, newPackPriceInput);
    if (!res.ok) {
      alert(res.error);
      return;
    }
    refreshAllCalculations();
    setEditingIngredient(null);
    alert(`Harga ${editingIngredient.name} berhasil diperbarui ke ${formatRupiah(newPackPriceInput)}!`);
  };

  const handleCreateIngredient = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newIngName.trim()) return;

    const ingredientName = newIngName.trim();
    const ingredientPrice = newIngPrice;
    const ingredientSize = newIngSize;
    const ingredientUnit = newIngUnit;
    const shouldAttachToRecipe = addCreatedIngredientToRecipe;
    const res = await createIngredientAction(ingredientName, ingredientPrice, ingredientSize, ingredientUnit, {
      category: newIngCategory, brand: newIngBrand, supplier_name: newIngSupplier, notes: newIngNotes,
    });
    if (!res.ok) {
      alert(res.error);
      return;
    }

    if (shouldAttachToRecipe) {
      setIngredients((current) => [
        ...current,
        {
          id: res.data.id,
          business_id: business?.id ?? "",
          name: ingredientName,
          pack_price: ingredientPrice,
          pack_size: ingredientSize,
          base_unit: ingredientUnit,
          category: newIngCategory,
          brand: newIngBrand || null,
          supplier_name: newIngSupplier || null,
          notes: newIngNotes || null,
          updated_at: new Date().toISOString(),
        },
      ]);
      setRecipeIngredients((current) => [
        ...current,
        { ingredient_id: res.data.id, qty: 1 },
      ]);
    }

    refreshAllCalculations();
    setShowAddIngredient(false);
    setAddCreatedIngredientToRecipe(false);
    setNewIngName("");
    setNewIngPrice(50000);
    setNewIngSize(1000);
    setNewIngCategory("bahan_baku");
    setNewIngBrand("");
    setNewIngSupplier("");
    setNewIngNotes("");
    alert(shouldAttachToRecipe
      ? `"${ingredientName}" sudah ditambahkan dan langsung dipakai di resep ini.`
      : `Bahan baku "${ingredientName}" berhasil ditambahkan ke master!`);
  };

  // Under-target margin alerts
  const underTargetRecipes = recipesWithCalc.filter((r) => r.calculation.is_under_target);

  // Filtered Catalog
  const filteredRecipes = recipesWithCalc.filter((r) => {
    const matchesSearch = r.recipe.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          (r.recipe.category || "").toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = filterCategory === "all" || r.recipe.category === filterCategory;
    return matchesSearch && matchesCategory;
  });

  /**
   * Menu POS yang modalnya belum diketahui.
   *
   * Inilah yang bikin katalog tidak lagi mulai dari nol. Menunya sudah ada di
   * sistem — nama, kategori, harga jual — jadi yang ditampilkan di sini adalah
   * daftar pekerjaan yang tersisa, bukan halaman kosong yang menyuruh owner
   * mengetik ulang semuanya.
   *
   * Yang sudah punya resep TIDAK ikut: modalnya sudah terhitung, dan barisnya
   * sudah tampil sebagai kartu resep biasa di atas.
   */
  const menuTanpaResep = useMemo(() => {
    const q = searchQuery.toLowerCase();
    return menuItems
      .filter((m) => !m.recipe_id)
      .filter((m) => {
        const cocokCari =
          m.name.toLowerCase().includes(q) || (m.category || "").toLowerCase().includes(q);
        const cocokKategori = filterCategory === "all" || m.category === filterCategory;
        return cocokCari && cocokKategori;
      });
  }, [menuItems, searchQuery, filterCategory]);

  /** Kategori digabung dari resep DAN menu, supaya penyaringnya utuh. */
  const categoriesList = Array.from(
    new Set([
      ...recipes.map((r) => r.category || "Lainnya"),
      ...menuItems.filter((m) => !m.recipe_id).map((m) => m.category || "Lainnya"),
    ]),
  );
  const ingredientUsage = useMemo(() => {
    const usage = new Map<string, string[]>();
    recipes.forEach((recipe) => {
      (recipe.ingredients ?? []).forEach((item) => {
        const current = usage.get(item.ingredient_id) ?? [];
        usage.set(item.ingredient_id, [...current, recipe.name]);
      });
    });
    return usage;
  }, [recipes]);
  const filteredIngredients = useMemo(() => ingredients.filter((ingredient) => (
    ingredient.name.toLowerCase().includes(ingredientQuery.trim().toLowerCase())
  )), [ingredients, ingredientQuery]);

  return (
    <div className={`${themeClassName || ""} min-h-screen bg-[#f0f5f2] text-[#1a382d] font-sans flex flex-col justify-between`}>
      
      {/* Top Header */}
      <header className="sticky top-0 z-30 border-b border-emerald-800/60 bg-[#0b3d2e] text-white backdrop-blur-md px-3 sm:px-8 py-2.5 sm:py-3.5 shadow-sm">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-2">
          
          <div className="flex items-center gap-2 sm:gap-3 min-w-0">
            <Link
              href="/app"
              className="flex h-8 w-8 sm:h-9 sm:w-9 shrink-0 items-center justify-center rounded-xl border border-emerald-600/40 bg-white/10 text-white hover:bg-white/15 transition-colors"
              title="Kembali ke Portal KAEL"
            >
              <ArrowLeft size={16} />
            </Link>

            <BusinessMark
              name={business?.name}
              logoUrl={business?.logo_url}
              brandColor={business?.brand_color}
              className="h-8 w-8 sm:h-9 sm:w-9 shrink-0 rounded-full border border-emerald-400/40 bg-white p-0.5 shadow-xs"
            />

            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <h1 className="font-extrabold text-xs sm:text-base text-white truncate tracking-tight">
                  KAEL Finance &amp; HPP
                </h1>
                <span className="rounded-full bg-[#c8f53a] px-2 py-0.5 font-mono text-[8.5px] sm:text-[9.5px] font-bold text-[#073829] shrink-0">
                  F&amp;B Cost Control
                </span>
              </div>
              <span className="text-[9.5px] sm:text-[11px] text-emerald-200/80 font-mono block truncate">
                {business?.name || "Bisnis Anda"} · Kalkulator Resep &amp; Food Cost
              </span>
            </div>
          </div>

          {/* Top Quick Actions */}
          <div className="flex items-center gap-1.5 sm:gap-2">
            <Link
              href="/app/finance/operations"
              className="hidden min-h-9 items-center rounded-xl border border-emerald-600/40 bg-white/10 hover:bg-white/15 px-3 py-2 font-mono text-[11px] font-bold text-white transition-colors sm:inline-flex"
            >
              Keuangan Usaha
            </Link>
            <button
              type="button"
              onClick={handleCreateNewRecipe}
              className="flex items-center gap-1 sm:gap-1.5 rounded-xl bg-[#c8f53a] hover:bg-[#b8e630] px-2.5 sm:px-3.5 py-1.5 sm:py-2 font-mono text-[11px] sm:text-xs font-black text-[#073829] shadow-xs whitespace-nowrap transition-colors"
            >
              <Plus size={13} className="stroke-[3]" />
              <span className="hidden xs:inline">+ Hitung Resep Baru</span>
              <span className="xs:hidden">+ Resep</span>
            </button>
          </div>

        </div>
      </header>

      {/* Main Container */}
      <main className="flex-1 mx-auto w-full max-w-7xl p-3 pb-24 sm:p-6 sm:pb-28 lg:p-8 lg:pb-8 space-y-4 sm:space-y-6">
        
        {/* TAB NAVIGATION PILLS */}
        <div className="hidden md:flex items-center overflow-x-auto scrollbar-none gap-2 border-b border-[#d8e3de] pb-2 font-mono text-xs font-bold">
          <button
            type="button"
            onClick={() => setActiveTab("quick")}
            className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl transition-all whitespace-nowrap ${
              activeTab === "quick"
                ? "bg-[#0b3d2e] text-[#c8f53a] border border-[#0b3d2e] shadow-sm"
                : "bg-white text-[#527867] border border-[#d8e3de] hover:border-emerald-300 hover:bg-[#edf8f3]"
            }`}
          >
            <Calculator size={14} />
            <span>Kalkulator Cepat</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("catalog")}
            className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl transition-all whitespace-nowrap ${
              activeTab === "catalog"
                ? "bg-[#0b3d2e] text-[#c8f53a] border border-[#0b3d2e] shadow-sm"
                : "bg-white text-[#527867] border border-[#d8e3de] hover:border-emerald-300 hover:bg-[#edf8f3]"
            }`}
          >
            <Package size={14} />
            {/*
              Angkanya menghitung resep DAN menu yang menunggu diisi. Menulis
              "(0)" di toko yang menunya 169 bikin owner menyimpulkan katalognya
              memang belum ada isinya, lalu menutup layarnya.
            */}
            <span>
              1. Katalog Resep ({recipes.length}
              {menuItems.filter((m) => !m.recipe_id).length > 0
                ? ` + ${menuItems.filter((m) => !m.recipe_id).length} menunggu`
                : ""}
              )
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("editor")}
            className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl transition-all whitespace-nowrap ${
              activeTab === "editor"
                ? "bg-[#0b3d2e] text-[#c8f53a] border border-[#0b3d2e] shadow-sm"
                : "bg-white text-[#527867] border border-[#d8e3de] hover:border-emerald-300 hover:bg-[#edf8f3]"
            }`}
          >
            <Calculator size={14} />
            <span>2. Kalkulator Resep</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("simulation")}
            className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl transition-all whitespace-nowrap ${
              activeTab === "simulation"
                ? "bg-[#0b3d2e] text-[#c8f53a] border border-[#0b3d2e] shadow-sm"
                : "bg-white text-[#527867] border border-[#d8e3de] hover:border-emerald-300 hover:bg-[#edf8f3]"
            }`}
          >
            <TrendingUp size={14} />
            <span>3. Simulasi Target Profit</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("ingredients")}
            className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl transition-all whitespace-nowrap ${
              activeTab === "ingredients"
                ? "bg-[#0b3d2e] text-[#c8f53a] border border-[#0b3d2e] shadow-sm"
                : "bg-white text-[#527867] border border-[#d8e3de] hover:border-emerald-300 hover:bg-[#edf8f3]"
            }`}
          >
            <Layers size={14} />
            <span>4. Master Bahan Baku ({ingredients.length})</span>
          </button>
        </div>

        {/* ============================================================= */}
        {/* KALKULATOR CEPAT UNTUK KULINER, RETAIL, DAN JASA */}
        {/* ============================================================= */}
        {activeTab === "quick" && (
          <QuickCalculator initialMode={business?.business_type ?? "kuliner"} initialPresets={initialCalculatorPresets} />
        )}

        {/* ============================================================= */}
        {/* TAB 1: KATALOG RESEP & MARGIN RADAR */}
        {/* ============================================================= */}
        {activeTab === "catalog" && (
          <div className="space-y-4 sm:space-y-6">
            
            {/* Margin Danger Radar Alert */}
            {underTargetRecipes.length > 0 && (
              <div className="rounded-3xl border border-rose-200 bg-rose-50/90 p-4 sm:p-5 shadow-sm space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="text-rose-600" size={18} />
                    <h3 className="font-black text-xs sm:text-sm text-rose-600">
                      Radar Margin Bahaya: {underTargetRecipes.length} Menu Berada di Bawah Target Margin!
                    </h3>
                  </div>
                </div>
                <p className="text-[11px] sm:text-xs text-[#1a382d]">
                  Menu berikut menghasilkan margin lebih rendah dari target yang Anda tetapkan. Pertimbangkan untuk menaikkan harga jual atau kurangi porsi bahan.
                </p>
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {underTargetRecipes.map((r) => (
                    <button
                      key={r.recipe.id}
                      type="button"
                      onClick={() => handleEditRecipe(r.recipe)}
                      className="inline-flex items-center gap-1 rounded-xl border border-rose-200 bg-white px-2.5 py-1 text-xs font-mono font-bold text-rose-600 shadow-xs hover:bg-rose-600 hover:text-white transition-all"
                    >
                      <span>{r.recipe.name}</span>
                      <span>({formatMarginPercent(r.calculation.margin_pct)} &lt; {r.recipe.target_margin_pct}%)</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Search & Category Filter Bar */}
            <div className="flex flex-col sm:flex-row gap-2 sm:items-center justify-between">
              <div className="relative flex-1 max-w-md">
                <Search className="absolute left-3 top-2.5 text-[#527867]" size={15} />
                <input
                  type="text"
                  placeholder="Cari resep atau kategori menu..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full rounded-2xl border border-[#d8e3de] bg-white pl-9 pr-4 py-2 text-xs font-sans text-[#1a382d] placeholder-[#527867]/60 focus:outline-none focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600"
                />
              </div>

              <div className="flex items-center gap-1 overflow-x-auto scrollbar-none font-mono text-xs">
                <button
                  type="button"
                  onClick={() => setFilterCategory("all")}
                  className={`px-3 py-1.5 rounded-xl border font-bold ${
                    filterCategory === "all" ? "bg-[#0b3d2e] text-[#c8f53a] border-[#0b3d2e]" : "bg-white text-[#527867] border-[#d8e3de] hover:bg-[#edf8f3]"
                  }`}
                >
                  Semua
                </button>
                {categoriesList.map((cat) => (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => setFilterCategory(cat)}
                    className={`px-3 py-1.5 rounded-xl border font-bold whitespace-nowrap ${
                      filterCategory === cat ? "bg-[#0b3d2e] text-[#c8f53a] border-[#0b3d2e]" : "bg-white text-[#527867] border-[#d8e3de] hover:bg-[#edf8f3]"
                    }`}
                  >
                    {cat}
                  </button>
                ))}
              </div>
            </div>

            {/*
              MENU YANG MODALNYA BELUM DIISI

              Katalog ini dulu cuma membaca tabel resep, jadi toko yang menunya
              sudah lengkap tetap disambut halaman kosong bertuliskan "(0)" —
              seolah belum ada apa-apa, padahal 169 menunya sudah ada di sistem
              beserta nama, kategori, dan harga jualnya.

              Sekarang menunya muncul di sini sebagai daftar pekerjaan. Sekali
              klik, editornya terbuka dengan ketiga hal itu sudah terisi.
            */}
            {menuTanpaResep.length > 0 && (
              <section className="space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-amber-300 bg-amber-50 p-3.5">
                  <div>
                    <p className="font-mono text-xs font-black text-amber-900">
                      {menuTanpaResep.length} menu belum punya modal
                    </p>
                    <p className="mt-0.5 text-[11.5px] leading-relaxed text-amber-800">
                      Selama modalnya kosong, laporan laba menghitung menu ini sebagai untung
                      penuh — jadi angkanya lebih tinggi dari yang sebenarnya. Klik menunya untuk
                      mengisi; nama dan harga jualnya sudah terisi sendiri.
                    </p>
                  </div>
                </div>

                <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
                  {menuTanpaResep.map((menu) => (
                    <button
                      key={menu.id}
                      type="button"
                      onClick={() => handleBuatResepDariMenu(menu)}
                      className="flex flex-col items-start gap-1 rounded-2xl border border-dashed border-amber-400 bg-white p-3.5 text-left transition-all hover:border-amber-600 hover:bg-amber-50"
                    >
                      <span className="text-sm font-bold text-[#1a382d]">{menu.name}</span>
                      <span className="font-mono text-[11px] text-[#527867]">
                        {menu.category || "Tanpa kategori"} · Jual {formatRupiah(menu.price)}
                      </span>
                      <span className="mt-1 rounded-lg bg-amber-100 px-2 py-0.5 font-mono text-[10px] font-black text-amber-900">
                        {menu.cost_price > 0
                          ? `Modal pokok ${formatRupiah(menu.cost_price)} · belum ada resep`
                          : "Belum ada modal · klik untuk isi"}
                      </span>
                    </button>
                  ))}
                </div>
              </section>
            )}

            {/* Recipes Grid */}
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3.5 sm:gap-4">
              {filteredRecipes.map(({ recipe, calculation }) => (
                <div
                  key={recipe.id}
                  className={`rounded-3xl border bg-white p-4 sm:p-5 shadow-[0_4px_20px_rgba(11,61,46,0.04)] flex flex-col justify-between space-y-3 transition-all ${
                    calculation.is_under_target ? "border-rose-300" : "border-[#d8e3de]"
                  }`}
                >
                  <div>
                    <div className="flex justify-between items-start gap-2 border-b border-[#d8e3de] pb-2.5">
                      <div>
                        <span className="text-[10px] font-mono text-[#167052] font-bold uppercase tracking-wider block">
                          {recipe.category || "Menu"} · {recipe.type === "olahan" ? "Olahan Sendiri" : "Kulakan"}
                        </span>
                        <h3 className="font-extrabold text-sm sm:text-base text-[#1a382d] font-sans">
                          {recipe.name}
                        </h3>
                      </div>
                      <span className={`px-2 py-0.5 rounded-full font-mono text-[10px] font-bold border shrink-0 ${
                        calculation.is_under_target
                          ? "bg-rose-50 text-rose-600 border-rose-200"
                          : "bg-[#dcfce7] text-[#16a34a] border-[#16a34a]"
                      }`}>
                        {formatMarginPercent(calculation.margin_pct)}
                      </span>
                    </div>

                    {/* Breakdown Numbers */}
                    <div className="mt-3 space-y-1.5 font-mono text-xs">
                      <div className="flex justify-between text-[#527867]">
                        <span>HPP Modal / unit:</span>
                        <span className="font-black text-[#c2410c]">{formatRupiah(calculation.hpp_per_unit)}</span>
                      </div>
                      <div className="flex justify-between text-[#527867]">
                        <span>Harga Jual Toko:</span>
                        <span className="font-bold text-[#1a382d]">{formatRupiah(recipe.selling_price)}</span>
                      </div>
                      <div className="flex justify-between text-[#527867]">
                        <span>Profit Bersih / pcs:</span>
                        <span className="font-black text-[#16a34a]">+{formatRupiah(calculation.profit_per_unit)}</span>
                      </div>
                      <div className="flex justify-between text-[#527867] text-[11px] pt-1 border-t border-[#d8e3de]">
                        <span>Markup: {Math.round(calculation.markup_pct)}%</span>
                        <span>Target: {recipe.target_margin_pct}%</span>
                      </div>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="pt-2 flex items-center justify-between gap-2 border-t border-[#d8e3de] font-mono text-xs">
                    <button
                      type="button"
                      onClick={() => handleEditRecipe(recipe)}
                      className="flex-1 flex items-center justify-center gap-1 rounded-xl border border-[#d8e3de] bg-[#edf8f3] py-2 font-bold text-[#167052] border border-emerald-200 hover:bg-emerald-100/70"
                    >
                      <Edit3 size={13} />
                      <span>Ubah Resep</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => handleDeleteRecipe(recipe.id, recipe.name)}
                      className="flex h-9 w-9 items-center justify-center rounded-xl border border-[#d8e3de] bg-white text-rose-600 hover:bg-rose-50 hover:border-rose-200"
                      title="Hapus Resep"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>

                </div>
              ))}
            </div>

          </div>
        )}

        {/* ============================================================= */}
        {/* TAB 2: KALKULATOR RESEP DETAIL & PACKAGING SEPARATION */}
        {/* ============================================================= */}
        {activeTab === "editor" && (
          <div className="grid lg:grid-cols-12 gap-5 sm:gap-6">
            
            {/* Left Column: Form Editor (7 cols) */}
            <div className="lg:col-span-7 space-y-4">
              
              <div className="rounded-3xl border border-[#d8e3de] bg-white p-5 sm:p-6 shadow-[0_4px_20px_rgba(11,61,46,0.04)] space-y-4 font-mono text-xs">
                <div className="flex items-center justify-between border-b border-[#d8e3de] pb-3">
                  <h3 className="font-extrabold text-sm sm:text-base text-[#1a382d] font-sans">
                    {editingRecipeId ? "Ubah Resep dan Modal Produk" : "Hitung Modal dan Harga Produk"}
                  </h3>
                  <span className="rounded-md bg-[#edf8f3] text-[#167052] px-2 py-0.5 text-[10px] font-bold">
                    {recipeType === "olahan" ? "Olahan Sendiri" : "Produk Kulakan"}
                  </span>
                </div>

                <div className="rounded-xl border border-[#d8e3de] bg-[#fbfdfc] p-3 font-sans">
                  <p className="font-bold text-[#1a382d]">Cara pakainya</p>
                  <p className="mt-1 text-[10px] leading-relaxed text-[#527867]">
                    Isi produk, masukkan modal yang dipakai, lalu coba harga jual. Hasil di sebelah kanan akan berubah otomatis. Tidak perlu menghitung sendiri.
                  </p>
                  <div className="mt-3 grid grid-cols-3 gap-2 font-mono text-[10px]">
                    <div className="rounded-lg border border-[#d8e3de] bg-white p-2 text-[#1a382d]"><strong>1.</strong> Produk</div>
                    <div className="rounded-lg border border-[#d8e3de] bg-white p-2 text-[#1a382d]"><strong>2.</strong> Modal</div>
                    <div className="rounded-lg border border-[#d8e3de] bg-white p-2 text-[#1a382d]"><strong>3.</strong> Harga jual</div>
                  </div>
                </div>

                {/* Basic Details */}
                <div className="space-y-3 font-sans border-t border-[#d8e3de] pt-4">
                  <div>
                    <p className="font-bold text-[#1a382d]">1. Ceritakan produk yang mau dijual</p>
                    <p className="mt-1 text-[10px] text-[#527867]">Data ini membantu membedakan setiap menu di katalog.</p>
                  </div>
                  <div className="grid sm:grid-cols-2 gap-3 font-mono">
                    <div className="space-y-1">
                      <label className="block font-bold text-[#1a382d]">Nama produk</label>
                      <input
                        type="text"
                        required
                        value={recipeName}
                        onChange={(e) => setRecipeName(e.target.value)}
                        placeholder="Contoh: Iced Spanish Latte 16oz"
                        className="w-full rounded-xl border border-[#d8e3de] p-2 text-xs font-bold text-[#1a382d]"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="block font-bold text-[#1a382d]">Kategori menu</label>
                      <input
                        type="text"
                        value={recipeCategory}
                        onChange={(e) => setRecipeCategory(e.target.value)}
                        placeholder="Contoh: Minuman Kopi / Pastry"
                        className="w-full rounded-xl border border-[#d8e3de] p-2 text-xs font-sans text-[#1a382d]"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3 font-mono">
                    <div className="space-y-1">
                      <label className="block font-bold text-[#1a382d]">Jenis produk</label>
                      <select
                        value={recipeType}
                        onChange={(e) => setRecipeType(e.target.value as any)}
                        className="w-full rounded-xl border border-[#d8e3de] p-2 text-xs font-bold text-[#1a382d] bg-white"
                      >
                        <option value="olahan">Olahan</option>
                        <option value="kulakan">Kulakan</option>
                      </select>
                      <p className="text-[9.5px] leading-relaxed text-[#527867]">Olahan dibuat dari bahan. Kulakan adalah barang jadi dari supplier.</p>
                    </div>

                    <div className="space-y-1">
                      <label className="block font-bold text-[#1a382d]">Dari sekali proses, jadi berapa produk?</label>
                      <input
                        type="number"
                        min={1}
                        value={outputQty}
                        onChange={(e) => setOutputQty(Math.max(1, Number(e.target.value) || 1))}
                        className="w-full rounded-xl border border-[#d8e3de] p-2 text-xs font-bold text-[#1a382d]"
                      />
                      <p className="text-[9.5px] leading-relaxed text-[#527867]">Contoh: satu adonan menghasilkan 10 cup, isi 10.</p>
                    </div>
                  </div>
                </div>

                {/* Section: Raw Ingredients List */}
                <div className="space-y-3 pt-4 border-t border-[#d8e3de]">
                    <div className="flex justify-between items-center">
                      <div>
                        <h4 className="font-extrabold text-xs text-[#1a382d] uppercase tracking-wider font-mono">
                          2. {recipeType === "olahan" ? "Bahan untuk sekali produksi" : "Modal barang dari supplier"} ({recipeIngredients.length})
                        </h4>
                        <p className="mt-1 text-[10px] text-[#527867] font-sans">
                          {recipeType === "olahan"
                            ? "Pilih bahan, lalu isi jumlah yang dipakai untuk satu kali membuat produk."
                            : "Tambahkan barang yang dibeli dari supplier sebagai modal produk yang dijual."}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setAddCreatedIngredientToRecipe(true);
                          setShowAddIngredient(true);
                        }}
                        className="text-[11px] font-bold text-[#167052] hover:underline"
                      >
                        + Tambah Bahan
                      </button>
                    </div>

                    {/*
                      Modul ini punya urutan alami: isi Master Bahan Baku dulu,
                      baru susun resep. Urutannya sudah benar; yang dulu kurang
                      cuma memberitahukannya. Tanpa ini, pengguna baru menekan
                      "+ Tambah Bahan" dan tidak terjadi apa-apa.
                    */}
                    {ingredients.length === 0 && (
                      <div className="rounded-2xl border-2 border-dashed border-emerald-300 bg-[#edf8f3] p-4 text-center">
                        <p className="text-xs font-black text-[#1a382d]">Belum ada daftar modal yang bisa dipilih</p>
                        <p className="mt-1 text-[11px] leading-relaxed text-[#5c5c70]">
                          Catat dulu bahan atau barang kulakan di Master Bahan Baku: nama, harga beli satu pack, dan isi pack. Setelah itu pilih di sini agar modal dihitung otomatis.
                        </p>
                        <button
                          type="button"
                          onClick={() => {
                            setAddCreatedIngredientToRecipe(true);
                            setShowAddIngredient(true);
                          }}
                          className="mt-3 rounded-xl border border-[#d8e3de] bg-[#c8f53a] px-4 py-2 text-[11px] font-black text-[#1a382d] shadow-xs"
                        >
                          Tambah Bahan Pertama →
                        </button>
                      </div>
                    )}

                    <div className="space-y-2">
                      {recipeIngredients.map((row, idx) => {
                        const ing = ingredientsMap.get(row.ingredient_id);
                        const unitCost = ing ? (ing.pack_price / ing.pack_size) * row.qty : 0;

                        return (
                          <div key={idx} className="flex items-center gap-2 p-2.5 rounded-2xl border border-[#d8e3de] bg-[#fbfdfc]">
                            <div className="flex-1">
                              <select
                                value={row.ingredient_id}
                                onChange={(e) => {
                                  const copy = [...recipeIngredients];
                                  copy[idx].ingredient_id = e.target.value;
                                  setRecipeIngredients(copy);
                                }}
                                className="w-full rounded-lg border border-[#d8e3de] p-1.5 text-xs font-bold text-[#1a382d] bg-white font-sans"
                              >
                                {ingredients.map((i) => (
                                  <option key={i.id} value={i.id}>
                                    {i.name} ({formatRupiah(Number(i.pack_price))}/{i.pack_size}{i.base_unit})
                                  </option>
                                ))}
                              </select>
                            </div>

                            <div className="w-24 flex items-center gap-1 font-mono">
                              <input
                                type="number"
                                min={1}
                                value={row.qty}
                                onChange={(e) => {
                                  const copy = [...recipeIngredients];
                                  copy[idx].qty = Number(e.target.value);
                                  setRecipeIngredients(copy);
                                }}
                                className="w-14 rounded-lg border border-[#d8e3de] p-1.5 text-center text-xs font-bold text-[#1a382d]"
                              />
                              <span className="text-[11px] text-[#527867] font-bold">{ing?.base_unit || "gr"}</span>
                            </div>

                            <div className="w-20 text-right font-black text-xs text-[#c2410c] font-mono">
                              {formatRupiah(unitCost)}
                            </div>

                            <button
                              type="button"
                              onClick={() => handleRemoveIngredientRow(idx)}
                              className="text-rose-600 hover:text-[#b91c1c] p-1"
                            >
                              <Trash2 size={13} />
                            </button>
                          </div>
                        );
                      })}
                      {ingredients.length > 0 && (
                        <button
                          type="button"
                          onClick={handleAddIngredientRow}
                          className="w-full rounded-xl border border-dashed border-emerald-300 bg-[#f4faf6] px-3 py-2 text-[11px] font-bold text-[#167052]"
                        >
                          Pilih bahan yang sudah ada
                        </button>
                      )}
                    </div>
                  </div>

                {/* Section: Packaging Separation */}
                <div className="space-y-3 pt-4 border-t border-[#d8e3de]">
                  <div className="flex justify-between items-center">
                    <div>
                      <h4 className="font-extrabold text-xs text-[#1a382d] uppercase tracking-wider font-mono">
                        3. Kemasan per produk ({recipePackaging.length})
                      </h4>
                      <p className="mt-1 text-[10px] text-[#527867] font-sans">Contoh: cup, tutup, sedotan, plastik, atau stiker. Ini dihitung untuk setiap produk terjual.</p>
                    </div>
                    <button
                      type="button"
                      onClick={handleAddPackagingRow}
                      className="text-[11px] font-bold text-[#167052] hover:underline"
                    >
                      + Tambah Kemasan
                    </button>
                  </div>

                  <div className="space-y-2">
                    {recipePackaging.map((pack, idx) => (
                      <div key={pack.id || idx} className="flex items-center gap-2 p-2.5 rounded-2xl border border-[#d8e3de] bg-[#fbfdfc]">
                        <input
                          type="text"
                          value={pack.name}
                          onChange={(e) => {
                            const copy = [...recipePackaging];
                            copy[idx].name = e.target.value;
                            setRecipePackaging(copy);
                          }}
                          placeholder="Nama packaging..."
                          className="flex-1 rounded-lg border border-[#d8e3de] p-1.5 text-xs text-[#1a382d] font-sans"
                        />
                        <div className="w-28 flex items-center gap-1 font-mono">
                          <span className="text-[11px] text-[#527867]">Rp</span>
                          <input
                            type="number"
                            min={0}
                            step={1}
                            value={pack.cost}
                            onChange={(e) => {
                              const copy = [...recipePackaging];
                              copy[idx].cost = Number(e.target.value);
                              setRecipePackaging(copy);
                            }}
                            className="w-full rounded-lg border border-[#d8e3de] p-1.5 text-xs font-bold text-[#1a382d]"
                          />
                        </div>
                        <button
                          type="button"
                          onClick={() => handleRemovePackagingRow(idx)}
                          className="text-rose-600 hover:text-[#b91c1c] p-1"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Section: Operational Overhead */}
                <div className="space-y-2 pt-4 border-t border-[#d8e3de] font-mono">
                  <div className="flex justify-between items-center">
                    <div className="pr-3">
                      <label className="font-bold text-[#1a382d]">4. Biaya proses sekali produksi</label>
                      <p className="mt-1 text-[10px] leading-relaxed text-[#527867] font-sans">Isi gas, listrik, atau ongkos proses yang khusus keluar saat membuat satu batch. Bukan sewa atau gaji bulanan.</p>
                    </div>
                    <input
                      type="number"
                      min={0}
                      step={1}
                      value={operationalCost}
                      onChange={(e) => setOperationalCost(Math.max(0, Number(e.target.value) || 0))}
                      className="w-32 rounded-lg border border-[#d8e3de] p-1.5 text-right text-xs font-bold text-[#1a382d]"
                    />
                  </div>
                </div>

                <div className="space-y-3 pt-4 border-t border-[#d8e3de] font-sans">
                  <div>
                    <p className="font-bold text-[#1a382d]">5. Coba harga jual dan target laba</p>
                    <p className="mt-1 text-[10px] text-[#527867]">Isi harga yang ingin Anda pasang. KAEL akan menunjukkan laba per produk dan apakah targetnya tercapai.</p>
                  </div>
                  <div className="grid sm:grid-cols-2 gap-3 font-mono">
                    <div className="space-y-1">
                      <label className="block font-bold text-[#1a382d]">Harga jual yang ingin dicoba (Rp)</label>
                      <input
                        type="number"
                        min={0}
                        step={1}
                        value={sellingPrice}
                        onChange={(e) => setSellingPrice(Math.max(0, Number(e.target.value) || 0))}
                        className="w-full rounded-xl border border-[#d8e3de] p-2 text-xs font-bold text-[#1a382d]"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="block font-bold text-[#1a382d]">Target laba dari harga jual (%)</label>
                      <input
                        type="number"
                        min={1}
                        max={95}
                        value={targetMarginPct}
                        onChange={(e) => setTargetMarginPct(Math.max(0, Number(e.target.value) || 0))}
                        className="w-full rounded-xl border border-[#d8e3de] p-2 text-xs font-bold text-[#1a382d]"
                      />
                      <p className="text-[9.5px] leading-relaxed text-[#527867]">Contoh 60%: dari harga jual Rp10.000, target laba kotor Rp6.000.</p>
                    </div>
                  </div>
                </div>

                {/* Submit Save Recipe */}
                <div className="pt-4 border-t border-[#d8e3de]">
                  <button
                    type="button"
                    disabled={isPending}
                    onClick={() => handleSaveRecipe()}
                    className="w-full flex items-center justify-center gap-2 rounded-2xl bg-[#0b3d2e] hover:bg-[#0e4837] py-3.5 text-xs font-bold text-[#c8f53a] shadow-xs disabled:opacity-50 transition-colors"
                  >
                    <Save size={15} />
                    <span>{isPending ? "Menyimpan..." : "Simpan Resep & Perbarui HPP"}</span>
                  </button>
                </div>

              </div>

            </div>

            {/* Right Column: Live Calculation Card (5 cols) */}
            <div className="lg:col-span-5 space-y-4">
              <div className="sticky top-20 rounded-3xl border border-[#d8e3de] bg-white p-5 sm:p-6 shadow-[0_4px_20px_rgba(11,61,46,0.04)] space-y-4 font-mono text-xs">
                <div className="flex items-center justify-between border-b border-[#d8e3de] pb-3">
                  <span className="font-bold text-[#167052] uppercase tracking-wider text-[10px]">
                    RINGKASAN ANGKA PRODUK
                  </span>
                  <Sparkles size={16} className="text-[#167052]" />
                </div>

                <div className="rounded-xl border border-[#d8e3de] bg-[#fbfdfc] p-3 font-sans">
                  <p className="font-bold text-[#1a382d]">{recipeName.trim() || "Produk baru Anda"}</p>
                  <p className="mt-1 text-[10px] leading-relaxed text-[#527867]">
                    Angka di bawah adalah untuk <strong>{outputQty} produk</strong> dari satu kali proses, lalu dipecah menjadi biaya per produk.
                  </p>
                </div>

                <div className="space-y-2.5">
                  <div className="flex justify-between text-[#527867]">
                    <span>Modal bahan satu kali proses</span>
                    <span>{formatRupiah(currentEditorCalc.biaya_bahan)}</span>
                  </div>
                  <div className="flex justify-between text-[#527867]">
                    <span>Kemasan per produk</span>
                    <span>{formatRupiah(currentEditorCalc.biaya_kemasan)}</span>
                  </div>
                  <div className="flex justify-between text-[#527867]">
                    <span>Gas/listrik satu kali proses</span>
                    <span>{formatRupiah(currentEditorCalc.operational_cost)}</span>
                  </div>

                  <div className="pt-3 border-t border-[#d8e3de]">
                    <div className="flex justify-between items-baseline">
                      <span className="font-extrabold text-sm text-[#1a382d]">MODAL 1 PRODUK</span>
                      <span className="text-xl font-black text-[#c2410c]">
                        {formatRupiah(currentEditorCalc.hpp_per_unit)}
                      </span>
                    </div>
                    <p className="mt-1 text-[10px] leading-relaxed text-[#527867]">
                      Modal bahan {formatRupiah(currentEditorCalc.total_modal_batch)} dibagi {outputQty} produk, lalu ditambah kemasan {formatRupiah(currentEditorCalc.biaya_kemasan)} per produk.
                    </p>
                  </div>

                  {sellingPrice > 0 ? (
                    <div className={`rounded-xl border p-3 ${currentEditorCalc.profit_per_unit < 0 ? "border-[#dc2626] bg-[#fff5f5]" : "border-[#16a34a] bg-[#f0fff4]"}`}>
                      <div className="flex justify-between items-baseline">
                        <span className={`font-bold ${currentEditorCalc.profit_per_unit < 0 ? "text-[#dc2626]" : "text-[#16a34a]"}`}>LABA DARI HARGA {formatRupiah(sellingPrice)}</span>
                        <span className={`text-base font-black ${currentEditorCalc.profit_per_unit < 0 ? "text-[#dc2626]" : "text-[#16a34a]"}`}>
                          {currentEditorCalc.profit_per_unit >= 0 ? "+" : ""}{formatRupiah(currentEditorCalc.profit_per_unit)}
                        </span>
                      </div>
                      <p className="mt-1 text-[10px] leading-relaxed text-[#527867]">
                        {currentEditorCalc.profit_per_unit < 0
                          ? "Harga ini masih lebih rendah dari modal. Naikkan harga jual atau cek kembali bahan dan porsi."
                          : "Ini adalah laba kotor untuk setiap produk yang terjual, setelah modal bahan, kemasan, dan biaya proses yang diisi."}
                      </p>
                    </div>
                  ) : (
                    <div className="rounded-xl border border-dashed border-emerald-300 bg-[#f4faf6] p-3">
                      <p className="font-bold text-[#167052]">Belum ada harga jual untuk dibandingkan</p>
                      <p className="mt-1 text-[10px] leading-relaxed text-[#527867]">Isi “Harga jual yang ingin dicoba” di sebelah kiri untuk melihat laba per produk.</p>
                    </div>
                  )}

                  {sellingPrice > 0 && (
                    <div className="p-3 rounded-2xl bg-[#edf8f3] border border-emerald-300 space-y-1 text-center">
                      <span className="text-[10px] text-[#167052] font-bold block uppercase">LABA DARI HARGA JUAL</span>
                      <div className="text-2xl font-black text-[#167052]">
                        {formatMarginPercent(currentEditorCalc.margin_pct)}
                      </div>
                      <span className="text-[10.5px] text-[#527867]">
                        Target Anda {targetMarginPct}%. Markup dari modal {Math.round(currentEditorCalc.markup_pct)}%.
                      </span>
                    </div>
                  )}

                  {currentEditorCalc.hpp_per_unit <= 0 && recipeIngredients.length === 0 && recipePackaging.length === 0 && operationalCost <= 0 ? (
                    <div className="p-3 rounded-2xl bg-[#fffbeb] border border-[#d97706] space-y-1">
                      <span className="text-[10px] font-bold text-[#b45309] uppercase block">Modal belum diisi</span>
                      <span className="text-[11px] leading-relaxed text-[#5c5c70] block">Tambahkan minimal satu bahan, barang supplier, kemasan, atau biaya proses. Sebelum itu, HPP Rp0 belum bisa dipakai untuk menentukan harga.</span>
                    </div>
                  ) : null}

                  {/*
                    Rekomendasi harga hanya ditampilkan kalau targetnya memang
                    bisa dicapai. Target >=100% berarti modalnya harus nol
                    rupiah; jawaban jujurnya "tidak bisa dicapai", bukan sebuah
                    angka. Dulu keadaan ini menyarankan harga = modal, alias
                    untung nol, tanpa keterangan apa pun.
                  */}
                  {currentEditorCalc.hpp_per_unit <= 0 && recipeIngredients.length === 0 && recipePackaging.length === 0 && operationalCost <= 0 ? (
                    <div className="p-3 rounded-2xl bg-[#f4faf6] border border-emerald-300 space-y-1">
                      <span className="text-[10px] font-bold text-[#167052] uppercase block">
                        Rekomendasi harga menunggu modal
                      </span>
                      <span className="text-[11px] leading-relaxed text-[#5c5c70] block">
                        Setelah modal produk diisi, KAEL akan menghitung harga jual yang sesuai target laba {targetMarginPct}%.
                      </span>
                    </div>
                  ) : currentEditorCalc.target_margin_unreachable ? (
                    <div className="p-3 rounded-2xl bg-[#fff7f7] border border-[#dc2626] space-y-1">
                      <span className="text-[10px] font-bold text-[#dc2626] uppercase block">
                        Target {targetMarginPct}% tidak bisa dicapai
                      </span>
                      <span className="text-[11px] leading-relaxed text-[#5c5c70] block">
                        Margin {targetMarginPct}% berarti menjual dengan modal nol rupiah. Turunkan targetnya di bawah 100% — misalnya 60% — supaya KAEL bisa menghitung harga jualnya.
                      </span>
                    </div>
                  ) : (
                    <div className="p-3 rounded-2xl bg-[#dcfce7] border border-[#16a34a] space-y-1">
                      <span className="text-[10px] font-bold text-[#16a34a] uppercase block">
                        Rekomendasi Harga Jual (Target {targetMarginPct}%):
                      </span>
                      <span className="text-lg font-black text-[#16a34a] block font-mono">
                        {formatRupiah(currentEditorCalc.recommended_price_target_margin)}
                      </span>
                      <span className="text-[10px] text-[#527867] block">
                        Dibulatkan rapi ke kelipatan Rp 500 untuk kenyamanan kasir.
                      </span>
                    </div>
                  )}

                  {/*
                    Kalkulator boleh menghitung dengan data yang belum lengkap,
                    tapi tidak pernah boleh menampilkan angka setengah jadi
                    seolah angka itu utuh. Bahan yang dilewati membuat modal
                    terlihat lebih murah — arah kesalahan yang paling berbahaya
                    untuk layar yang dipakai memasang harga jual.
                  */}
                  {currentEditorCalc.unknown_ingredient_ids.length > 0 && (
                    <div className="p-3 rounded-2xl bg-[#fffbeb] border border-[#d97706] space-y-1">
                      <span className="text-[10px] font-bold text-[#b45309] uppercase block">
                        ⚠ {currentEditorCalc.unknown_ingredient_ids.length} bahan belum dikenali
                      </span>
                      <span className="text-[11px] leading-relaxed text-[#5c5c70] block">
                        Modal di atas <strong>belum lengkap</strong> — bahan yang tidak dikenali dihitung nol, jadi angkanya lebih murah dari yang sebenarnya. Jangan dipakai memasang harga sebelum bahannya dibereskan.
                      </span>
                    </div>
                  )}
                </div>

              </div>
            </div>

          </div>
        )}

        {/* ============================================================= */}
        {/* TAB 3: SIMULASI TARGET PROFIT */}
        {/* ============================================================= */}
        {activeTab === "simulation" && activeSimRecipe && simResult && (
          <div className="max-w-4xl mx-auto rounded-3xl border border-[#d8e3de] bg-white p-5 sm:p-8 shadow-[0_4px_20px_rgba(11,61,46,0.04)] space-y-6 font-mono text-xs">
            <div className="border-b border-[#d8e3de] pb-4">
              <h3 className="font-extrabold text-base sm:text-lg text-[#1a382d] font-sans">
                Simulasi Jualan Harian &amp; Bulanan
              </h3>
              <p className="text-[11px] sm:text-xs text-[#527867] font-sans">
                Isi rencana jual Anda. KAEL menghitung harga jual, omzet, dan perkiraan laba berdasarkan HPP resep.
              </p>
            </div>

            <div className="space-y-4 font-sans text-xs">
              <div className="space-y-1 font-mono">
                <label className="block font-bold text-[#1a382d]">Pilih Produk Resep:</label>
                <select
                  value={simSelectedRecipeId}
                  onChange={(e) => setSimSelectedRecipeId(e.target.value)}
                  className="w-full rounded-xl border border-[#d8e3de] p-2.5 text-xs font-bold text-[#1a382d] bg-white"
                >
                  {recipes.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.name} (HPP Modal: {formatRupiah(recipesWithCalc.find((rc) => rc.recipe.id === r.id)?.calculation.hpp_per_unit || 0)})
                    </option>
                  ))}
                </select>
              </div>

              <div className="rounded-xl border border-[#d8e3de] bg-[#fbfdfc] p-3 sm:p-4 space-y-3">
                <p className="font-bold text-[#1a382d]">1. Tentukan harga jual yang ingin dicapai</p>
                <p className="text-[10px] leading-relaxed text-[#527867]">
                  Isi salah satu atau keduanya. Target laba berarti keuntungan dari satu produk setelah modal HPP. Target margin adalah persentase laba dari harga jual.
                </p>
                <div className="grid sm:grid-cols-2 gap-4 font-mono">
                <div className="space-y-1">
                  <label className="block font-bold text-[#1a382d]">Laba yang diinginkan per produk (Rp)</label>
                  <input
                    type="number"
                    step={1}
                    value={simTargetProfitNominal}
                    onChange={(e) => setSimTargetProfitNominal(Math.max(0, Number(e.target.value) || 0))}
                    className="w-full rounded-xl border border-[#d8e3de] p-2.5 text-sm font-bold text-[#1a382d]"
                  />
                </div>

                <div className="space-y-1">
                  <label className="block font-bold text-[#1a382d]">Atau target margin (%)</label>
                  <input
                    type="number"
                    min={1}
                    max={95}
                    value={simTargetMarginPct}
                    onChange={(e) => setSimTargetMarginPct(Math.max(0, Number(e.target.value) || 0))}
                    className="w-full rounded-xl border border-[#d8e3de] p-2.5 text-sm font-bold text-[#1a382d]"
                  />
                </div>
                </div>
              </div>

              <div className="rounded-xl border border-[#d8e3de] bg-[#fbfdfc] p-3 sm:p-4 space-y-3">
                <p className="font-bold text-[#1a382d]">2. Isi rencana penjualan</p>
                <div className="grid sm:grid-cols-3 gap-4 font-mono">
                  <div className="space-y-1">
                    <label className="block font-bold text-[#1a382d]">Produk terjual per hari</label>
                    <input
                      type="number"
                      min={0}
                      step={1}
                      value={simUnitsPerDay}
                      onChange={(e) => setSimUnitsPerDay(Math.max(0, Number(e.target.value) || 0))}
                      className="w-full rounded-xl border border-[#d8e3de] p-2.5 text-sm font-bold text-[#1a382d]"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="block font-bold text-[#1a382d]">Hari buka per bulan</label>
                    <input
                      type="number"
                      min={0}
                      max={31}
                      step={1}
                      value={simOperatingDays}
                      onChange={(e) => setSimOperatingDays(Math.max(0, Number(e.target.value) || 0))}
                      className="w-full rounded-xl border border-[#d8e3de] p-2.5 text-sm font-bold text-[#1a382d]"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="block font-bold text-[#1a382d]">Biaya tetap per bulan (Rp)</label>
                    <input
                      type="number"
                      min={0}
                      step={1}
                      value={simMonthlyFixedCost}
                      onChange={(e) => setSimMonthlyFixedCost(Math.max(0, Number(e.target.value) || 0))}
                      className="w-full rounded-xl border border-[#d8e3de] p-2.5 text-sm font-bold text-[#1a382d]"
                    />
                  </div>
                </div>
                <p className="text-[10px] leading-relaxed text-[#527867]">
                  Biaya tetap contohnya sewa, gaji tetap, listrik, dan internet. Isi 0 jika belum ingin memasukkannya ke simulasi.
                </p>
              </div>

              <div className="pt-1 space-y-3">
                <div>
                  <p className="font-bold text-[#1a382d]">3. Pilih harga yang paling masuk akal</p>
                  <p className="mt-1 text-[10px] text-[#527867]">Dua pilihan ini dihitung dari HPP {formatRupiah(activeSimRecipe.calculation.hpp_per_unit)} per produk.</p>
                </div>
                <div className="grid sm:grid-cols-2 gap-4 font-mono">
                <div className="p-4 rounded-2xl bg-[#edf8f3] border border-emerald-300 space-y-1 text-center">
                  <span className="text-[10.5px] text-[#167052] font-bold block uppercase">
                    Harga dengan laba {formatRupiah(simTargetProfitNominal)} per produk
                  </span>
                  <div className="text-2xl font-black text-[#167052]">
                    {formatRupiah(simResult.priceFromNominal)}
                  </div>
                  <span className="text-[10px] text-[#527867]">
                    Margin riil: {formatMarginPercent(simResult.actualMarginFromNominal)}
                  </span>
                </div>

                {simResult.marginUnreachable ? (
                  <div className="p-4 rounded-2xl bg-[#fff7f7] border border-[#dc2626] space-y-1 text-center">
                    <span className="text-[10.5px] text-[#dc2626] font-bold block uppercase">
                      Target {simTargetMarginPct}% tidak bisa dicapai
                    </span>
                    <p className="text-[11px] leading-relaxed text-[#5c5c70]">
                      Margin {simTargetMarginPct}% berarti modalnya harus nol rupiah. Isi target di bawah 100%.
                    </p>
                  </div>
                ) : (
                  <div className="p-4 rounded-2xl bg-[#dcfce7] border border-[#16a34a] space-y-1 text-center">
                    <span className="text-[10.5px] text-[#16a34a] font-bold block uppercase">
                      Harga Jual Target Margin ({simTargetMarginPct}%)
                    </span>
                    <div className="text-2xl font-black text-[#16a34a]">
                      {formatRupiah(simResult.priceFromMargin)}
                    </div>
                    <span className="text-[10px] text-[#527867]">
                      Profit riil: +{formatRupiah(simResult.actualProfitFromMargin)}
                    </span>
                  </div>
                )}
                </div>
              </div>

              <div className="border-t border-[#d8e3de] pt-4 space-y-3">
                <div>
                  <p className="font-bold text-[#1a382d]">
                    4. Perkiraan hasil jika terjual {simUnitsPerDay} produk per hari selama {simOperatingDays} hari
                  </p>
                  <p className="mt-1 text-[10px] leading-relaxed text-[#527867]">
                    Omzet adalah seluruh nilai penjualan. Laba sebelum biaya tetap sudah dikurangi modal HPP. Sisa setelah biaya tetap hanya mengurangi angka biaya yang Anda isi di atas.
                  </p>
                </div>
                <div className="grid md:grid-cols-2 gap-4">
                  {simProjections.map((projection) => {
                    const isGreen = projection.color === "green";
                    const remainingIsNegative = projection.netAfterFixedCost < 0;
                    return (
                      <div
                        key={projection.key}
                        className={`rounded-2xl border p-4 space-y-3 ${isGreen ? "bg-[#f0fff4] border-[#16a34a]" : "bg-[#f4faf6] border-emerald-300"}`}
                      >
                        <div className="flex items-start justify-between gap-3 border-b border-black/10 pb-3">
                          <div>
                            <p className={`font-bold ${isGreen ? "text-[#16a34a]" : "text-[#167052]"}`}>{projection.label}</p>
                            <p className="mt-1 text-[10px] text-[#527867]">Harga jual {formatRupiah(projection.price)}. Laba per produk {formatRupiah(projection.profitPerUnit)}.</p>
                          </div>
                        </div>
                        <dl className="grid grid-cols-2 gap-x-3 gap-y-3 text-[10px] sm:text-[11px]">
                          <div>
                            <dt className="text-[#527867]">Omzet per hari</dt>
                            <dd className="mt-0.5 font-bold text-[#1a382d]">{formatRupiah(projection.dailyRevenue)}</dd>
                          </div>
                          <div>
                            <dt className="text-[#527867]">Laba per hari</dt>
                            <dd className="mt-0.5 font-bold text-[#1a382d]">{formatRupiah(projection.dailyProfit)}</dd>
                          </div>
                          <div>
                            <dt className="text-[#527867]">Omzet per bulan</dt>
                            <dd className="mt-0.5 font-bold text-[#1a382d]">{formatRupiah(projection.monthlyRevenue)}</dd>
                          </div>
                          <div>
                            <dt className="text-[#527867]">Laba sebelum biaya tetap</dt>
                            <dd className="mt-0.5 font-bold text-[#1a382d]">{formatRupiah(projection.monthlyProfit)}</dd>
                          </div>
                        </dl>
                        <div className={`rounded-xl border px-3 py-2 ${remainingIsNegative ? "border-[#dc2626] bg-[#fff5f5]" : isGreen ? "border-[#16a34a] bg-white" : "border-emerald-300 bg-white"}`}>
                          <p className="text-[10px] text-[#527867]">Sisa setelah biaya tetap {formatRupiah(simMonthlyFixedCost)}</p>
                          <p className={`mt-0.5 text-base font-black ${remainingIsNegative ? "text-[#dc2626]" : isGreen ? "text-[#16a34a]" : "text-[#167052]"}`}>{formatRupiah(projection.netAfterFixedCost)}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ============================================================= */}
        {/* TAB 4: MASTER BAHAN BAKU & PRICE CASCADE */}
        {/* ============================================================= */}
        {activeTab === "ingredients" && (
          <div className="space-y-4 sm:space-y-6">
            
            <div className="flex justify-between items-center">
              <div>
                <h3 className="font-extrabold text-sm sm:text-base text-[#1a382d]">
                  Master Harga Bahan Baku &amp; Living Ingredients
                </h3>
                <p className="text-[11px] sm:text-xs text-[#527867]">
                  Ubah harga beli bahan di sini, seluruh resep yang memakai bahan tersebut akan otomatis terhitung ulang secara instan.
                </p>
              </div>

              <button
                type="button"
                onClick={() => {
                  setAddCreatedIngredientToRecipe(false);
                  setShowAddIngredient(true);
                }}
                className="flex items-center gap-1.5 rounded-xl bg-[#0b3d2e] hover:bg-[#0e4837] px-3.5 py-1.5 font-mono text-xs font-bold text-[#c8f53a] shadow-xs transition-colors"
              >
                <Plus size={13} />
                <span>+ Tambah Bahan</span>
              </button>
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              <div className="rounded-xl border border-[#d8e3de] bg-white p-3 shadow-xs"><p className="font-mono text-[10px] font-bold text-[#527867]">BAHAN TERCATAT</p><p className="mt-1 text-xl font-black text-[#1a382d]">{ingredients.length}</p><p className="mt-1 text-[10px] text-[#527867]">Bahan dan barang supplier</p></div>
              <div className="rounded-xl border border-emerald-300 bg-[#f4faf6] p-3 shadow-xs"><p className="font-mono text-[10px] font-bold text-[#167052]">DIPAKAI DI RESEP</p><p className="mt-1 text-xl font-black text-[#1a382d]">{ingredients.filter((ingredient) => (ingredientUsage.get(ingredient.id)?.length ?? 0) > 0).length}</p><p className="mt-1 text-[10px] text-[#527867]">Harga ikut memengaruhi HPP menu</p></div>
              <div className="rounded-xl border border-[#d97706] bg-[#fffbeb] p-3 shadow-xs"><p className="font-mono text-[10px] font-bold text-[#b45309]">BELUM DIPAKAI</p><p className="mt-1 text-xl font-black text-[#1a382d]">{ingredients.filter((ingredient) => (ingredientUsage.get(ingredient.id)?.length ?? 0) === 0).length}</p><p className="mt-1 text-[10px] text-[#527867]">Bahan belum dipasang ke resep</p></div>
            </div>

            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div className="relative w-full sm:max-w-md"><Search className="absolute left-3 top-2.5 text-[#527867]" size={15} /><input type="search" value={ingredientQuery} onChange={(event) => setIngredientQuery(event.target.value)} placeholder="Cari bahan atau barang supplier..." className="w-full rounded-xl border border-[#d8e3de] bg-white py-2 pl-9 pr-3 text-xs font-mono text-[#1a382d] outline-none" /></div>
              <p className="text-[10px] text-[#527867]">Harga per satuan dipakai langsung untuk menghitung HPP.</p>
            </div>

            {/* Ingredients Table */}
            <div className="rounded-3xl border border-[#d8e3de] bg-white shadow-[0_4px_20px_rgba(11,61,46,0.04)] overflow-hidden font-mono text-xs">
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead>
                    <tr className="border-b border-[#d8e3de] bg-[#fbfdfc] text-[#527867] text-[10px] uppercase">
                      <th className="py-3 px-4">Nama Bahan</th>
                      <th className="py-3 px-4">Harga Kemasan</th>
                      <th className="py-3 px-4">Ukuran Kemasan</th>
                      <th className="py-3 px-4">Harga / Satuan</th>
                      <th className="py-3 px-4">Dipakai Di</th>
                      <th className="py-3 px-4">Terakhir Diubah</th>
                      <th className="py-3 px-4 text-right">Aksi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#dedee8]">
                    {filteredIngredients.map((ing) => {
                      const costPerBaseUnit = Number(ing.pack_price) / Number(ing.pack_size);
                      const recipesUsingIngredient = ingredientUsage.get(ing.id) ?? [];
                      const categoryLabel = ({ bahan_baku: "Bahan baku", kemasan: "Kemasan", barang_kulakan: "Barang kulakan", lainnya: "Lainnya" } as const)[ing.category ?? "bahan_baku"];
                      return (
                        <tr key={ing.id} className="hover:bg-[#fbfdfc]">
                          <td className="py-3 px-4 font-bold text-[#1a382d] font-sans">
                            <p>{ing.name}</p>
                            <p className="mt-1 text-[10px] font-normal text-[#527867]">{categoryLabel}{ing.brand ? ` · ${ing.brand}` : ""}</p>
                            {ing.supplier_name && <p className="mt-1 text-[10px] font-normal text-[#167052]">Beli: {ing.supplier_name}</p>}
                          </td>
                          <td className="py-3 px-4 font-black text-[#c2410c]">
                            {formatRupiah(Number(ing.pack_price))}
                          </td>
                          <td className="py-3 px-4 text-[#527867]">
                            {ing.pack_size} {ing.base_unit}
                          </td>
                          <td className="py-3 px-4 font-bold text-[#167052]">
                            Rp {costPerBaseUnit.toLocaleString("id-ID", { maximumFractionDigits: 2 })} / {ing.base_unit}
                            <p className="mt-1 text-[10px] font-normal text-[#527867]">Dipakai sesuai jumlah di resep</p>
                          </td>
                          <td className="py-3 px-4">
                            {recipesUsingIngredient.length > 0 ? <div><p className="font-bold text-[#16a34a]">{recipesUsingIngredient.length} resep</p><p className="mt-1 max-w-44 truncate text-[10px] text-[#527867]" title={recipesUsingIngredient.join(", ")}>{recipesUsingIngredient.join(", ")}</p></div> : <div><p className="font-bold text-[#b45309]">Belum dipakai</p><p className="mt-1 text-[10px] text-[#527867]">Tambahkan ke resep</p></div>}
                          </td>
                          <td className="py-3 px-4 text-[10.5px] text-[#527867]">
                            {formatBusinessDateTime(ing.updated_at)}
                          </td>
                          <td className="py-3 px-4 text-right space-x-1.5 whitespace-nowrap">
                            <button
                              type="button"
                              onClick={() => {
                                setEditingIngredient(ing);
                                setNewPackPriceInput(Number(ing.pack_price));
                              }}
                              className="rounded-lg border border-[#d8e3de] bg-[#edf8f3] px-2.5 py-1 text-[11px] font-bold text-[#167052]"
                            >
                              Update Harga
                            </button>
                            <button
                              type="button"
                              onClick={() => setHistoryDrawerIng(ing)}
                              className="rounded-lg border border-[#d8e3de] bg-white px-2 py-1 text-[11px] text-[#527867] hover:text-[#1a382d]"
                              title="Lihat Histori Harga"
                            >
                              <History size={13} />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                    {filteredIngredients.length === 0 && (
                      <tr><td colSpan={7} className="px-4 py-10 text-center text-[#527867]">Bahan tidak ditemukan. Coba kata kunci lain atau tambahkan bahan baru.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

          </div>
        )}

      </main>

      <nav aria-label="Navigasi Finance" className="fixed inset-x-0 bottom-0 z-40 border-t border-[#d8e3de] bg-white/95 px-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-2 backdrop-blur-md md:hidden shadow-lg">
        <div className="mx-auto grid max-w-lg grid-cols-5 gap-1">
          {([
            { key: "quick", label: "Hitung", icon: Calculator },
            { key: "catalog", label: "Katalog", icon: Package },
            { key: "editor", label: "Resep", icon: Edit3 },
            { key: "simulation", label: "Target", icon: TrendingUp },
            { key: "ingredients", label: "Bahan", icon: Layers },
          ] as const).map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.key;
            return (
              <button
                key={item.key}
                type="button"
                onClick={() => {
                  setActiveTab(item.key);
                  window.scrollTo({ top: 0, behavior: "smooth" });
                }}
                aria-current={isActive ? "page" : undefined}
                className={`flex min-h-14 flex-col items-center justify-center gap-1 rounded-xl text-[10px] font-bold transition-colors ${isActive ? "bg-[#0b3d2e] text-[#c8f53a]" : "text-[#527867] active:bg-[#edf8f3]"}`}
              >
                <Icon size={18} strokeWidth={isActive ? 2.5 : 2} />
                <span>{item.label}</span>
              </button>
            );
          })}
        </div>
      </nav>

      {/* MODAL: UPDATE INGREDIENT PRICE */}
      {editingIngredient && (
        <div className="fixed inset-0 z-50 bg-emerald-950/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="w-full max-w-md rounded-3xl border border-[#d8e3de] bg-white p-6 shadow-md space-y-4 animate-in zoom-in-95 font-mono text-xs">
            <div className="flex items-center justify-between border-b border-[#d8e3de] pb-3">
              <h3 className="font-extrabold text-base text-[#1a382d] font-sans">
                Update Harga Bahan Baku
              </h3>
              <button
                type="button"
                onClick={() => setEditingIngredient(null)}
                className="text-[#527867] hover:text-[#1a382d] font-bold p-1"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleUpdateIngredientPrice} className="space-y-3 font-sans">
              <div className="space-y-1 font-mono">
                <span className="text-[11px] text-[#167052] font-bold block uppercase">{editingIngredient.name}</span>
                <span className="text-xs text-[#527867] block">
                  Ukuran kemasan: {editingIngredient.pack_size} {editingIngredient.base_unit}
                </span>
              </div>

              <div className="space-y-1 font-mono">
                <label className="block font-bold text-[#1a382d]">Harga Kemasan Baru (Rp):</label>
                <input
                  type="number"
                    required
                    min={0}
                    step={1}
                    value={newPackPriceInput}
                  onChange={(e) => setNewPackPriceInput(Math.max(0, Number(e.target.value) || 0))}
                  className="w-full rounded-xl border border-[#d8e3de] p-2.5 text-base font-black text-[#c2410c]"
                  autoFocus
                />
              </div>

              <p className="text-[10.5px] text-[#527867] leading-relaxed">
                ⚡ Semua resep yang menggunakan bahan ini akan otomatis menghitung ulang HPP modal dan margin labanya secara instan.
              </p>

              <div className="flex justify-end gap-2 pt-2 border-t border-[#d8e3de] font-mono">
                <button
                  type="button"
                  onClick={() => setEditingIngredient(null)}
                  className="rounded-xl border border-[#d8e3de] bg-white px-3 py-2 font-bold text-[#527867]"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isPending}
                  className="rounded-xl bg-[#0b3d2e] px-5 py-2 font-black text-[#d9ff57] shadow-xs disabled:opacity-50"
                >
                  Simpan &amp; Cascade HPP ✓
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: CREATE INGREDIENT */}
      {showAddIngredient && (
        <div className="fixed inset-0 z-50 bg-emerald-950/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="w-full max-w-md rounded-3xl border border-[#d8e3de] bg-white p-6 shadow-md space-y-4 animate-in zoom-in-95 font-mono text-xs">
            <div className="flex items-center justify-between border-b border-[#d8e3de] pb-3">
              <h3 className="font-extrabold text-base text-[#1a382d] font-sans">
                {addCreatedIngredientToRecipe ? "Tambah Bahan untuk Resep" : "Tambah Bahan Baku Baru"}
              </h3>
              <button
                type="button"
                onClick={() => {
                  setShowAddIngredient(false);
                  setAddCreatedIngredientToRecipe(false);
                }}
                className="text-[#527867] hover:text-[#1a382d] font-bold p-1"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateIngredient} className="space-y-3 font-sans">
              {addCreatedIngredientToRecipe && (
                <div className="rounded-xl border border-emerald-300 bg-[#f4faf6] p-3 text-[11px] leading-relaxed text-[#5c5c70]">
                  Isi sekali di sini. Setelah disimpan, bahan ini langsung masuk ke resep dan tersimpan di daftar modal untuk dipakai lagi nanti.
                </div>
              )}
              <div className="space-y-1 font-mono">
                <label className="block font-bold text-[#1a382d]">Nama bahan atau barang supplier</label>
                <input
                  type="text"
                  required
                  placeholder="Misal: Sirup Hazelnut Monin"
                  value={newIngName}
                  onChange={(e) => setNewIngName(e.target.value)}
                  className="w-full rounded-xl border border-[#d8e3de] p-2 text-xs font-bold text-[#1a382d]"
                />
              </div>

              <div className="grid grid-cols-2 gap-2 font-mono">
                <label className="block"><span className="block font-bold text-[#1a382d]">Jenis pencatatan</span><select value={newIngCategory} onChange={(event) => setNewIngCategory(event.target.value as typeof newIngCategory)} className="mt-1 w-full rounded-xl border border-[#d8e3de] bg-white p-2 text-xs font-bold text-[#1a382d]"><option value="bahan_baku">Bahan baku</option><option value="kemasan">Kemasan</option><option value="barang_kulakan">Barang kulakan</option><option value="lainnya">Lainnya</option></select></label>
                <label className="block"><span className="block font-bold text-[#1a382d]">Merek atau varian</span><input type="text" value={newIngBrand} onChange={(event) => setNewIngBrand(event.target.value)} placeholder="Contoh: Marjan cocopandan" className="mt-1 w-full rounded-xl border border-[#d8e3de] p-2 text-xs text-[#1a382d]" /></label>
              </div>

              <div className="grid grid-cols-2 gap-2 font-mono">
                <div className="space-y-1">
                <label className="block font-bold text-[#1a382d]">Harga beli satu kemasan (Rp)</label>
                  <input
                    type="number"
                    required
                    min={0}
                    step={1}
                    value={newIngPrice}
                    onChange={(e) => setNewIngPrice(Math.max(0, Number(e.target.value) || 0))}
                    className="w-full rounded-xl border border-[#d8e3de] p-2 text-xs font-bold text-[#1a382d]"
                  />
                </div>

                <div className="space-y-1">
                <label className="block font-bold text-[#1a382d]">Isi satu kemasan</label>
                  <div className="flex gap-1">
                    <input
                      type="number"
                      required
                      min={1}
                      value={newIngSize}
                      onChange={(e) => setNewIngSize(Number(e.target.value))}
                      className="w-full rounded-xl border border-[#d8e3de] p-2 text-xs font-bold text-[#1a382d]"
                    />
                    <select
                      value={newIngUnit}
                      onChange={(e) => setNewIngUnit(e.target.value as any)}
                      className="rounded-xl border border-[#d8e3de] p-2 text-xs font-bold text-[#1a382d] bg-white"
                    >
                      <option value="gr">gr</option>
                      <option value="ml">ml</option>
                      <option value="pcs">pcs</option>
                    </select>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 font-mono">
                <label className="block"><span className="block font-bold text-[#1a382d]">Supplier atau tempat beli</span><input type="text" value={newIngSupplier} onChange={(event) => setNewIngSupplier(event.target.value)} placeholder="Contoh: Toko Sumber Makmur" className="mt-1 w-full rounded-xl border border-[#d8e3de] p-2 text-xs text-[#1a382d]" /></label>
                <label className="block"><span className="block font-bold text-[#1a382d]">Catatan pembelian</span><input type="text" value={newIngNotes} onChange={(event) => setNewIngNotes(event.target.value)} placeholder="Contoh: Harga grosir 6 botol" className="mt-1 w-full rounded-xl border border-[#d8e3de] p-2 text-xs text-[#1a382d]" /></label>
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-[#d8e3de] font-mono">
                <button
                  type="button"
                  onClick={() => {
                    setShowAddIngredient(false);
                    setAddCreatedIngredientToRecipe(false);
                  }}
                  className="rounded-xl border border-[#d8e3de] bg-white px-3 py-2 font-bold text-[#527867]"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isPending}
                  className="rounded-xl bg-[#0b3d2e] px-5 py-2 font-black text-[#d9ff57] shadow-xs disabled:opacity-50"
                >
                  {addCreatedIngredientToRecipe ? "Simpan & Pakai di Resep" : "Tambah Bahan ✓"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* DRAWER: PRICE HISTORY */}
      {historyDrawerIng && (
        <div className="fixed inset-0 z-50 bg-emerald-950/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="w-full max-w-md rounded-3xl border border-[#d8e3de] bg-white p-6 shadow-md space-y-4 animate-in zoom-in-95 font-mono text-xs">
            <div className="flex items-center justify-between border-b border-[#d8e3de] pb-3">
              <div className="flex items-center gap-2">
                <History size={16} className="text-[#167052]" />
                <h3 className="font-extrabold text-base text-[#1a382d] font-sans">
                  Histori Fluktuasi Harga
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setHistoryDrawerIng(null)}
                className="text-[#527867] hover:text-[#1a382d] text-xs font-bold p-1"
              >
                ✕
              </button>
            </div>

            <div className="space-y-2 font-mono text-xs">
              <span className="font-bold text-[#1a382d] font-sans block text-sm">{historyDrawerIng.name}</span>
              
              <div className="space-y-1.5 max-h-60 overflow-y-auto pr-1">
                {priceHistoryList.length === 0 ? (
                  <p className="text-[#527867] text-center py-4">Belum ada catatan perubahan harga.</p>
                ) : (
                  priceHistoryList.map((h) => (
                    <div key={h.id} className="flex justify-between items-center p-2.5 rounded-xl border border-[#d8e3de] bg-[#fbfdfc]">
                      <span className="font-black text-sm text-[#1a382d]">{formatRupiah(Number(h.pack_price))}</span>
                      <span className="text-[10.5px] text-[#527867]">{formatBusinessDateTime(h.changed_at)}</span>
                    </div>
                  ))
                )}
              </div>
            </div>

            <button
              type="button"
              onClick={() => setHistoryDrawerIng(null)}
              className="w-full py-2.5 rounded-xl bg-[#edf8f3] text-xs font-bold text-[#167052]"
            >
              Tutup Histori
            </button>
          </div>
        </div>
      )}

      {/* Footer */}
      <footer className="border-t border-[#d8e3de] bg-white py-4 text-center text-xs font-mono text-[#527867]">
        KAEL HPP &amp; Finance Engine · Pure Computation &amp; Living Ingredient Cascade
      </footer>

    </div>
  );
}
