"use client";

import { useState, useMemo } from "react";
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
import { db, Recipe, Ingredient, IngredientPriceHistory, Business } from "@/lib/db";
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

export default function KaelFinanceOwnerDashboard() {
  const [business] = useState<Business | null>(db.getBusiness());
  const [activeTab, setActiveTab] = useState<"catalog" | "editor" | "simulation" | "ingredients" | "onboarding">("catalog");

  // Master Data States
  const [recipesWithCalc, setRecipesWithCalc] = useState(() => db.getAllRecipesWithCalculations());
  const [ingredients, setIngredients] = useState<Ingredient[]>(() => db.getIngredients());
  const ingredientsMap = useMemo(() => db.getIngredientsMap(), [ingredients]);

  // Search & Filter
  const [searchQuery, setSearchQuery] = useState("");
  const [filterCategory, setFilterCategory] = useState("all");

  // ---------------------------------------------------------------------------
  // RECIPE EDITOR STATE (Tab 2)
  // ---------------------------------------------------------------------------
  const [editingRecipeId, setEditingRecipeId] = useState<string | null>(null);
  const [recipeName, setRecipeName] = useState("Iced Caramel Macchiato");
  const [recipeCategory, setRecipeCategory] = useState("Minuman Kopi");
  const [recipeType, setRecipeType] = useState<"olahan" | "kulakan">("olahan");
  const [outputQty, setOutputQty] = useState<number>(1);
  const [operationalCost, setOperationalCost] = useState<number>(600);
  const [sellingPrice, setSellingPrice] = useState<number>(30000);
  const [targetMarginPct, setTargetMarginPct] = useState<number>(65);

  const [recipeIngredients, setRecipeIngredients] = useState<RecipeIngredientItem[]>([
    { ingredient_id: "ing-01", qty: 18 },  // 18 gr Espresso
    { ingredient_id: "ing-02", qty: 130 }, // 130 ml Susu
    { ingredient_id: "ing-04", qty: 20 },  // 20 ml Sirup
  ]);

  const [recipePackaging, setRecipePackaging] = useState<RecipePackagingItem[]>([
    { id: "pack-1", name: "Cup 16oz + Tutup & Sedotan", cost: 1100 },
    { id: "pack-2", name: "Stiker Logo Waterproof", cost: 250 },
  ]);

  const [showMobileBreakdownSheet, setShowMobileBreakdownSheet] = useState(false);

  // Live calculation for the active editor form
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
  }, [
    recipeType,
    outputQty,
    operationalCost,
    sellingPrice,
    targetMarginPct,
    recipeIngredients,
    recipePackaging,
    ingredientsMap,
  ]);

  // ---------------------------------------------------------------------------
  // PRICE SIMULATION STATE (Tab 3)
  // ---------------------------------------------------------------------------
  const [simSelectedRecipeId, setSimSelectedRecipeId] = useState<string>(
    recipesWithCalc[0]?.recipe.id || ""
  );
  const [simTargetMargin, setSimTargetMargin] = useState<number>(70);
  const [simTargetProfitNominal, setSimTargetProfitNominal] = useState<number>(18000);

  const activeSimRecipe = useMemo(() => {
    return recipesWithCalc.find((r) => r.recipe.id === simSelectedRecipeId) || recipesWithCalc[0];
  }, [simSelectedRecipeId, recipesWithCalc]);

  // ---------------------------------------------------------------------------
  // INGREDIENTS MASTER MODAL (Tab 4)
  // ---------------------------------------------------------------------------
  const [editingIngredient, setEditingIngredient] = useState<Ingredient | null>(null);
  const [newPackPriceInput, setNewPackPriceInput] = useState<number>(0);
  const [showAddIngredient, setShowAddIngredient] = useState(false);
  const [newIngName, setNewIngName] = useState("");
  const [newIngPrice, setNewIngPrice] = useState(50000);
  const [newIngSize, setNewIngSize] = useState(1000);
  const [newIngUnit, setNewIngUnit] = useState<"gr" | "ml" | "pcs">("gr");

  // Price History Drawer
  const [historyDrawerIng, setHistoryDrawerIng] = useState<Ingredient | null>(null);

  // ---------------------------------------------------------------------------
  // HANDLERS
  // ---------------------------------------------------------------------------
  const refreshAllCalculations = () => {
    setIngredients(db.getIngredients());
    setRecipesWithCalc(db.getAllRecipesWithCalculations());
  };

  const handleOpenEditRecipe = (recipe: Recipe) => {
    setEditingRecipeId(recipe.id);
    setRecipeName(recipe.name);
    setRecipeCategory(recipe.category);
    setRecipeType(recipe.type);
    setOutputQty(recipe.output_qty);
    setOperationalCost(recipe.operational_cost);
    setSellingPrice(recipe.selling_price);
    setTargetMarginPct(recipe.target_margin_pct);
    setRecipeIngredients([...recipe.ingredients]);
    setRecipePackaging([...recipe.packaging]);
    setActiveTab("editor");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleNewRecipe = () => {
    setEditingRecipeId(null);
    setRecipeName("");
    setRecipeCategory("Minuman Kopi");
    setRecipeType("olahan");
    setOutputQty(1);
    setOperationalCost(500);
    setSellingPrice(25000);
    setTargetMarginPct(60);
    setRecipeIngredients([]);
    setRecipePackaging([{ id: `p-${Date.now()}`, name: "Kemasan Standar", cost: 1000 }]);
    setActiveTab("editor");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleSaveRecipe = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!recipeName.trim()) {
      alert("Nama produk tidak boleh kosong.");
      return;
    }

    db.saveRecipe(business?.id, {
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
    });

    refreshAllCalculations();
    setActiveTab("catalog");
    alert(`Resep "${recipeName}" berhasil disimpan! HPP modal: ${formatRupiah(currentEditorCalc.hpp_per_unit)}.`);
  };

  const handleDeleteRecipe = (id: string, name: string) => {
    if (confirm(`Hapus resep "${name}" dari katalog?`)) {
      db.deleteRecipe(id);
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

  const handleUpdateIngredientPrice = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingIngredient) return;

    const res = db.updateIngredientPrice(editingIngredient.id, newPackPriceInput);
    refreshAllCalculations();
    setEditingIngredient(null);
    alert(
      `Harga ${editingIngredient.name} berhasil diperbarui ke ${formatRupiah(newPackPriceInput)}!\n` +
      `${res.affectedRecipesCount} menu terkait otomatis dihitung ulang HPP & marginnya.`
    );
  };

  const handleCreateIngredient = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newIngName.trim()) return;

    db.createIngredient(business?.id, newIngName.trim(), newIngPrice, newIngSize, newIngUnit);
    refreshAllCalculations();
    setShowAddIngredient(false);
    setNewIngName("");
    setNewIngPrice(50000);
    setNewIngSize(1000);
    alert(`Bahan baku "${newIngName}" berhasil ditambahkan ke master!`);
  };

  // Under-target margin alerts
  const underTargetRecipes = recipesWithCalc.filter((r) => r.calculation.is_under_target);

  // Filtered Catalog
  const filteredRecipes = recipesWithCalc.filter((r) => {
    const matchSearch = r.recipe.name.toLowerCase().includes(searchQuery.toLowerCase());
    const matchCat = filterCategory === "all" || r.recipe.category === filterCategory;
    return matchSearch && matchCat;
  });

  return (
    <div className="min-h-screen bg-[#f7f6fc] text-[#232331] font-sans flex flex-col pb-24 sm:pb-8">
      
      {/* Top Header */}
      <header className="sticky top-0 z-30 border-b-2 border-[#232331] bg-white/95 backdrop-blur-md px-3 sm:px-8 py-2.5 sm:py-3.5">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-2">
          <div className="flex items-center gap-2 sm:gap-3 min-w-0">
            <Link
              href="/app"
              className="flex h-8 w-8 sm:h-9 sm:w-9 shrink-0 items-center justify-center rounded-xl border border-[#232331] bg-[#fcfcfe] text-[#232331] shadow-ink-xs hover:bg-[#f0edff]"
              title="Kembali ke Hub KAEL"
            >
              <ArrowLeft size={15} />
            </Link>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <h1 className="font-extrabold text-xs sm:text-base text-[#232331] truncate">
                  KAEL Finance
                </h1>
                <span className="rounded-md bg-[#ffedd5] px-1.5 py-0.2 font-mono text-[8.5px] sm:text-[9px] font-bold text-[#c2410c] border border-[#c2410c] shrink-0">
                  HPP &amp; Margin
                </span>
              </div>
              <span className="text-[9.5px] sm:text-[11px] text-[#7b7b8e] font-mono block truncate">
                {business?.name} · Food Cost Terpadu
              </span>
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0 font-mono text-xs">
            <button
              type="button"
              onClick={handleNewRecipe}
              className="btn-tactile flex items-center gap-1 sm:gap-1.5 rounded-xl border border-[#232331] sm:border-2 bg-[#d9ff57] px-2.5 sm:px-3.5 py-1.5 font-bold text-[#232331] shadow-ink-xs text-xs"
            >
              <Plus size={13} strokeWidth={3} />
              <span className="hidden xs:inline">Resep Baru</span>
              <span className="xs:hidden">Baru</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="flex-1 mx-auto w-full max-w-6xl p-3 sm:p-6 lg:p-8 space-y-4 sm:space-y-6">
        
        {/* TOP KPI CARDS */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-4">
          
          <div className="card-tactile rounded-2xl sm:rounded-3xl border sm:border-2 border-[#232331] bg-white p-3.5 sm:p-5 shadow-ink-xs sm:shadow-ink-md">
            <div className="flex items-center justify-between border-b border-[#dedee8] pb-1.5 sm:pb-2.5">
              <span className="font-mono text-[9px] sm:text-[10px] font-bold text-[#c2410c] uppercase">FOOD COST HPP</span>
              <span className="flex h-6 w-6 sm:h-7 sm:w-7 items-center justify-center rounded-lg bg-[#ffedd5] text-[#c2410c]">
                <Calculator size={13} />
              </span>
            </div>
            <div className="mt-2 sm:mt-3">
              <h3 className="text-lg sm:text-3xl font-extrabold font-mono text-[#232331]">
                32.5%
              </h3>
              <span className="text-[9.5px] sm:text-[11px] text-[#16a34a] font-mono font-bold block mt-0.5 sm:mt-1 truncate">
                ✓ Margin 67.5%
              </span>
            </div>
          </div>

          <div className="card-tactile rounded-2xl sm:rounded-3xl border sm:border-2 border-[#232331] bg-white p-3.5 sm:p-5 shadow-ink-xs sm:shadow-ink-md">
            <div className="flex items-center justify-between border-b border-[#dedee8] pb-1.5 sm:pb-2.5">
              <span className="font-mono text-[9px] sm:text-[10px] font-bold text-[#7958d8] uppercase">TOTAL RESEP</span>
              <span className="flex h-6 w-6 sm:h-7 sm:w-7 items-center justify-center rounded-lg bg-[#f0edff] text-[#7958d8]">
                <Layers size={13} />
              </span>
            </div>
            <div className="mt-2 sm:mt-3">
              <h3 className="text-lg sm:text-3xl font-extrabold font-mono text-[#232331]">
                {recipesWithCalc.length} Menu
              </h3>
              <span className="text-[9.5px] sm:text-[11px] text-[#7b7b8e] font-mono block mt-0.5 sm:mt-1 truncate">
                {recipesWithCalc.filter((r) => r.recipe.type === "olahan").length} Olahan · {recipesWithCalc.filter((r) => r.recipe.type === "kulakan").length} Reseller
              </span>
            </div>
          </div>

          <div className="card-tactile rounded-2xl sm:rounded-3xl border sm:border-2 border-[#232331] bg-white p-3.5 sm:p-5 shadow-ink-xs sm:shadow-ink-md">
            <div className="flex items-center justify-between border-b border-[#dedee8] pb-1.5 sm:pb-2.5">
              <span className="font-mono text-[9px] sm:text-[10px] font-bold text-[#16a34a] uppercase">BAHAN GUDANG</span>
              <span className="flex h-6 w-6 sm:h-7 sm:w-7 items-center justify-center rounded-lg bg-[#dcfce7] text-[#16a34a]">
                <Package size={13} />
              </span>
            </div>
            <div className="mt-2 sm:mt-3">
              <h3 className="text-lg sm:text-3xl font-extrabold font-mono text-[#232331]">
                {ingredients.length} Bahan
              </h3>
              <span className="text-[9.5px] sm:text-[11px] text-[#7b7b8e] font-mono block mt-0.5 sm:mt-1 truncate">
                gr / ml / pcs
              </span>
            </div>
          </div>

          <div className="card-tactile rounded-2xl sm:rounded-3xl border sm:border-2 border-[#232331] bg-white p-3.5 sm:p-5 shadow-ink-xs sm:shadow-ink-md">
            <div className="flex items-center justify-between border-b border-[#dedee8] pb-1.5 sm:pb-2.5">
              <span className="font-mono text-[9px] sm:text-[10px] font-bold text-[#ef4444] uppercase">MARGIN KRITIS</span>
              <span className="flex h-6 w-6 sm:h-7 sm:w-7 items-center justify-center rounded-lg bg-[#feebee] text-[#ef4444]">
                <AlertTriangle size={13} />
              </span>
            </div>
            <div className="mt-2 sm:mt-3">
              <h3 className="text-lg sm:text-3xl font-extrabold font-mono text-[#ef4444]">
                {underTargetRecipes.length} Menu
              </h3>
              <span className="text-[9.5px] sm:text-[11px] text-[#7b7b8e] font-mono block mt-0.5 sm:mt-1 truncate">
                {underTargetRecipes.length > 0 ? "Margin di bawah target!" : "Aman terproteksi ✓"}
              </span>
            </div>
          </div>

        </div>

        {/* UNDER-TARGET MARGIN ALERT BOX */}
        {underTargetRecipes.length > 0 && (
          <div className="rounded-2xl sm:rounded-3xl border-2 border-[#ef4444] bg-[#feebee] p-3.5 sm:p-5 shadow-ink-xs sm:shadow-ink-md space-y-2.5">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-1.5 text-[#ef4444] font-black text-xs sm:text-sm">
                <AlertTriangle size={16} className="shrink-0" />
                <span className="truncate">Radar Margin Kritis: {underTargetRecipes.length} Menu Butuh Penyesuaian</span>
              </div>
            </div>
            <div className="grid sm:grid-cols-2 gap-2 text-xs font-mono">
              {underTargetRecipes.map((item) => (
                <div key={item.recipe.id} className="rounded-xl bg-white p-2.5 sm:p-3 border border-[#ef4444]/30 flex justify-between items-center gap-2">
                  <div className="min-w-0">
                    <span className="font-bold text-[#232331] font-sans block truncate">{item.recipe.name}</span>
                    <span className="text-[#ef4444] text-[10.5px]">
                      Margin {formatMarginPercent(item.calculation.margin_pct)} (Target {item.recipe.target_margin_pct}%)
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleOpenEditRecipe(item.recipe)}
                    className="btn-tactile rounded-lg bg-[#232331] text-[#d9ff57] px-2.5 py-1 text-[10px] sm:text-[10.5px] font-bold shrink-0"
                  >
                    Ubah ➔
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 5-TAB NAVIGATION BAR (Mobile Scroll-Snap) */}
        <div className="flex items-center overflow-x-auto scrollbar-none rounded-xl sm:rounded-2xl border sm:border-2 border-[#232331] bg-white p-1 font-mono text-xs font-bold gap-1 shadow-ink-xs">
          <button
            type="button"
            onClick={() => setActiveTab("catalog")}
            className={`flex items-center gap-1.5 px-3 sm:px-4 py-2 rounded-lg sm:rounded-xl transition-all whitespace-nowrap text-xs ${
              activeTab === "catalog" ? "bg-[#232331] text-[#d9ff57] shadow-ink-xs" : "text-[#7b7b8e] hover:text-[#232331]"
            }`}
          >
            <Layers size={13} />
            <span>1. Katalog Menu</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("editor")}
            className={`flex items-center gap-1.5 px-3 sm:px-4 py-2 rounded-lg sm:rounded-xl transition-all whitespace-nowrap text-xs ${
              activeTab === "editor" ? "bg-[#232331] text-[#d9ff57] shadow-ink-xs" : "text-[#7b7b8e] hover:text-[#232331]"
            }`}
          >
            <Calculator size={13} />
            <span>2. Editor Resep</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("simulation")}
            className={`flex items-center gap-1.5 px-3 sm:px-4 py-2 rounded-lg sm:rounded-xl transition-all whitespace-nowrap text-xs ${
              activeTab === "simulation" ? "bg-[#232331] text-[#d9ff57] shadow-ink-xs" : "text-[#7b7b8e] hover:text-[#232331]"
            }`}
          >
            <Sliders size={13} />
            <span>3. Simulasi Target</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("ingredients")}
            className={`flex items-center gap-1.5 px-3 sm:px-4 py-2 rounded-lg sm:rounded-xl transition-all whitespace-nowrap text-xs ${
              activeTab === "ingredients" ? "bg-[#232331] text-[#d9ff57] shadow-ink-xs" : "text-[#7b7b8e] hover:text-[#232331]"
            }`}
          >
            <Package size={13} />
            <span>4. Bahan Baku</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("onboarding")}
            className={`flex items-center gap-1.5 px-3 sm:px-4 py-2 rounded-lg sm:rounded-xl transition-all whitespace-nowrap text-xs ${
              activeTab === "onboarding" ? "bg-[#232331] text-[#d9ff57] shadow-ink-xs" : "text-[#7b7b8e] hover:text-[#232331]"
            }`}
          >
            <UploadCloud size={13} />
            <span>5. Impor 10 Menu</span>
          </button>
        </div>

        {/* ============================================================= */}
        {/* TAB 1: RADAR MARGIN & KATALOG MENU */}
        {/* ============================================================= */}
        {activeTab === "catalog" && (
          <div className="rounded-2xl sm:rounded-3xl border sm:border-2 border-[#232331] bg-white p-4 sm:p-6 shadow-ink-md space-y-4">
            
            {/* Header & Search */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#dedee8] pb-3 sm:pb-4">
              <div>
                <h3 className="font-extrabold text-sm sm:text-base text-[#232331]">
                  Katalog Resep &amp; Radar Margin ({filteredRecipes.length} Menu)
                </h3>
                <p className="text-[11px] sm:text-xs text-[#7b7b8e]">
                  HPP terhitung otomatis berdasarkan harga bahan baku terupdate di gudang.
                </p>
              </div>

              <div className="relative">
                <Search className="absolute left-3 top-2.5 text-[#7b7b8e]" size={14} />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Cari nama menu..."
                  className="w-full sm:w-56 rounded-xl border border-[#232331] pl-8 pr-3 py-1.5 font-bold text-xs text-[#232331] focus:outline-none"
                />
              </div>
            </div>

            {/* MOBILE CARD VIEW (Visible on mobile screens < md) */}
            <div className="grid gap-3 md:hidden">
              {filteredRecipes.map(({ recipe, calculation }) => {
                const isUnder = calculation.is_under_target;
                return (
                  <div
                    key={recipe.id}
                    className={`rounded-2xl border p-3.5 space-y-3 transition-all ${
                      isUnder
                        ? "border-[#ef4444] bg-[#fff5f5]"
                        : "border-[#dedee8] bg-[#fcfcfe]"
                    }`}
                  >
                    {/* Card Top: Title & Status */}
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <h4 className="font-extrabold text-sm text-[#232331] font-sans">
                          {recipe.name}
                        </h4>
                        <span className="text-[10px] text-[#7958d8] font-bold font-mono">
                          {recipe.category} · {recipe.type === "olahan" ? "Olahan Sendiri" : "Kulakan"}
                        </span>
                      </div>
                      <span className={`inline-flex items-center gap-1 font-bold text-[9.5px] px-2 py-0.5 rounded-full border font-mono shrink-0 ${
                        isUnder
                          ? "bg-[#feebee] text-[#ef4444] border-[#ef4444]"
                          : calculation.margin_pct >= 65
                          ? "bg-[#dcfce7] text-[#16a34a] border-[#16a34a]"
                          : "bg-[#fef3c7] text-[#d97706] border-[#d97706]"
                      }`}>
                        {isUnder ? "KRITIS" : calculation.margin_pct >= 65 ? "SEHAT" : "AMAN"}
                      </span>
                    </div>

                    {/* 4 Key Numbers Grid */}
                    <div className="grid grid-cols-2 gap-2 bg-white p-2.5 rounded-xl border border-[#dedee8] font-mono text-xs">
                      <div>
                        <span className="text-[9.5px] text-[#7b7b8e] block uppercase">HPP Modal</span>
                        <span className="font-extrabold text-[#c2410c]">
                          {formatRupiah(calculation.hpp_per_unit)}
                        </span>
                      </div>
                      <div>
                        <span className="text-[9.5px] text-[#7b7b8e] block uppercase">Harga Jual</span>
                        <span className="font-extrabold text-[#232331]">
                          {formatRupiah(recipe.selling_price)}
                        </span>
                      </div>
                      <div className="border-t border-[#dedee8] pt-1.5 mt-0.5">
                        <span className="text-[9.5px] text-[#7b7b8e] block uppercase">Laba / Porsi</span>
                        <span className="font-black text-[#16a34a]">
                          +{formatRupiah(calculation.profit_per_unit)}
                        </span>
                      </div>
                      <div className="border-t border-[#dedee8] pt-1.5 mt-0.5">
                        <span className="text-[9.5px] text-[#7b7b8e] block uppercase">Margin %</span>
                        <span className={`font-black text-sm ${isUnder ? "text-[#ef4444]" : "text-[#16a34a]"}`}>
                          {formatMarginPercent(calculation.margin_pct)}
                        </span>
                      </div>
                    </div>

                    {/* Card Actions */}
                    <div className="flex items-center justify-between gap-2 pt-1 font-mono text-xs">
                      <span className="text-[10px] text-[#7b7b8e]">
                        Target: {recipe.target_margin_pct}% · Markup: {formatMarginPercent(calculation.markup_pct)}
                      </span>
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => handleOpenEditRecipe(recipe)}
                          className="btn-tactile rounded-lg border border-[#7958d8] bg-[#f0edff] px-2.5 py-1 text-[11px] font-bold text-[#7958d8]"
                        >
                          Edit Resep
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteRecipe(recipe.id, recipe.name)}
                          className="btn-tactile rounded-lg border border-[#dedee8] bg-white p-1 text-[#7b7b8e] hover:text-[#ef4444]"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* DESKTOP TABLE VIEW (Visible on >= md screens) */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-left font-mono text-xs">
                <thead>
                  <tr className="border-b border-[#dedee8] text-[#7b7b8e] text-[10px] uppercase">
                    <th className="py-2.5 px-3">Nama Menu &amp; Tipe</th>
                    <th className="py-2.5 px-3">HPP Modal / Porsi</th>
                    <th className="py-2.5 px-3">Harga Jual</th>
                    <th className="py-2.5 px-3">Laba Kotor (Rp)</th>
                    <th className="py-2.5 px-3">Margin %</th>
                    <th className="py-2.5 px-3">Markup %</th>
                    <th className="py-2.5 px-3">Status Margin</th>
                    <th className="py-2.5 px-3 text-right">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#dedee8]">
                  {filteredRecipes.map(({ recipe, calculation }) => {
                    const isUnder = calculation.is_under_target;
                    return (
                      <tr key={recipe.id} className={`hover:bg-[#fcfcfe] ${isUnder ? "bg-[#fff5f5]" : ""}`}>
                        <td className="py-3 px-3">
                          <span className="font-extrabold text-sm text-[#232331] font-sans block">
                            {recipe.name}
                          </span>
                          <span className="text-[10px] text-[#7958d8] font-bold">
                            {recipe.category} · {recipe.type === "olahan" ? "Olahan Sendiri" : "Kulakan"}
                          </span>
                        </td>
                        <td className="py-3 px-3 font-extrabold text-[#c2410c]">
                          {formatRupiah(calculation.hpp_per_unit)}
                        </td>
                        <td className="py-3 px-3 font-extrabold text-[#232331]">
                          {formatRupiah(recipe.selling_price)}
                        </td>
                        <td className="py-3 px-3 font-extrabold text-[#16a34a]">
                          +{formatRupiah(calculation.profit_per_unit)}
                        </td>
                        <td className="py-3 px-3">
                          <span className={`font-black text-sm ${isUnder ? "text-[#ef4444]" : "text-[#16a34a]"}`}>
                            {formatMarginPercent(calculation.margin_pct)}
                          </span>
                          <span className="text-[9.5px] text-[#7b7b8e] block">
                            Target: {recipe.target_margin_pct}%
                          </span>
                        </td>
                        <td className="py-3 px-3 text-[#7b7b8e] font-bold">
                          {formatMarginPercent(calculation.markup_pct)}
                        </td>
                        <td className="py-3 px-3">
                          <span className={`inline-flex items-center gap-1 font-bold text-[10px] px-2 py-0.5 rounded-full border ${
                            isUnder
                              ? "bg-[#feebee] text-[#ef4444] border-[#ef4444]"
                              : calculation.margin_pct >= 65
                              ? "bg-[#dcfce7] text-[#16a34a] border-[#16a34a]"
                              : "bg-[#fef3c7] text-[#d97706] border-[#d97706]"
                          }`}>
                            <span className={`h-1.5 w-1.5 rounded-full ${isUnder ? "bg-[#ef4444]" : "bg-[#16a34a]"}`} />
                            {isUnder ? "BONCOS / KRITIS" : calculation.margin_pct >= 65 ? "SANGAT SEHAT" : "AMAN"}
                          </span>
                        </td>
                        <td className="py-3 px-3 text-right space-x-1.5 whitespace-nowrap">
                          <button
                            type="button"
                            onClick={() => handleOpenEditRecipe(recipe)}
                            className="btn-tactile rounded-lg border border-[#7958d8] bg-[#f0edff] px-2.5 py-1 text-[11px] font-bold text-[#7958d8]"
                          >
                            Edit Resep
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteRecipe(recipe.id, recipe.name)}
                            className="btn-tactile rounded-lg border border-[#dedee8] bg-white px-2 py-1 text-[11px] font-bold text-[#7b7b8e] hover:text-[#ef4444]"
                          >
                            <Trash2 size={12} />
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

        {/* ============================================================= */}
        {/* TAB 2: RECIPE EDITOR REALTIME (Mobile-Optimized) */}
        {/* ============================================================= */}
        {activeTab === "editor" && (
          <div className="grid gap-6 lg:grid-cols-12 items-start">
            
            {/* Left Column (7 cols): Recipe Input Form */}
            <form onSubmit={handleSaveRecipe} className="lg:col-span-7 rounded-2xl sm:rounded-3xl border sm:border-2 border-[#232331] bg-white p-4 sm:p-6 shadow-ink-md space-y-4 sm:space-y-5">
              
              <div className="flex items-center justify-between border-b border-[#dedee8] pb-3">
                <div className="flex items-center gap-2">
                  <Calculator size={18} className="text-[#7958d8]" />
                  <h3 className="font-extrabold text-sm sm:text-base text-[#232331]">
                    {editingRecipeId ? "Edit Resep Produk" : "Buat Resep Produk Baru"}
                  </h3>
                </div>
                <span className="text-[10px] sm:text-[11px] font-mono text-[#16a34a] font-bold">
                  ● Live HPP Active
                </span>
              </div>

              {/* Product Basic Info */}
              <div className="grid sm:grid-cols-2 gap-3 font-sans text-xs">
                <div className="space-y-1">
                  <label className="block font-mono font-bold text-[#232331]">Nama Produk / Menu:</label>
                  <input
                    type="text"
                    required
                    value={recipeName}
                    onChange={(e) => setRecipeName(e.target.value)}
                    placeholder="Contoh: Iced Spanish Latte"
                    className="w-full rounded-xl border border-[#232331] p-2.5 font-bold text-xs sm:text-sm text-[#232331] focus:outline-none"
                  />
                </div>

                <div className="space-y-1">
                  <label className="block font-mono font-bold text-[#232331]">Kategori Menu:</label>
                  <select
                    value={recipeCategory}
                    onChange={(e) => setRecipeCategory(e.target.value)}
                    className="w-full rounded-xl border border-[#232331] bg-white p-2.5 font-bold text-xs text-[#232331] focus:outline-none"
                  >
                    <option value="Minuman Kopi">Minuman Kopi</option>
                    <option value="Minuman Non-Kopi">Minuman Non-Kopi</option>
                    <option value="Pastry & Bakery">Pastry &amp; Bakery</option>
                    <option value="Makanan Berat">Makanan Berat</option>
                    <option value="Snack Kulakan">Snack Kulakan / Reseller</option>
                  </select>
                </div>
              </div>

              {/* Production Batch Info */}
              <div className="grid grid-cols-3 gap-2 sm:gap-3 font-mono text-xs">
                <div className="space-y-1">
                  <label className="block font-bold text-[#232331] text-[10.5px] sm:text-xs">Tipe Produk:</label>
                  <select
                    value={recipeType}
                    onChange={(e) => setRecipeType(e.target.value as any)}
                    className="w-full rounded-xl border border-[#232331] bg-white p-2 font-bold text-[#232331] text-xs"
                  >
                    <option value="olahan">Olahan</option>
                    <option value="kulakan">Kulakan</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="block font-bold text-[#232331] text-[10.5px] sm:text-xs">Batch Porsi:</label>
                  <input
                    type="number"
                    min={1}
                    value={outputQty}
                    onChange={(e) => setOutputQty(Number(e.target.value))}
                    className="w-full rounded-xl border border-[#232331] p-2 font-bold text-[#232331] text-xs text-center"
                  />
                </div>

                <div className="space-y-1">
                  <label className="block font-bold text-[#232331] text-[10.5px] sm:text-xs">Operasional (Rp):</label>
                  <input
                    type="number"
                    min={0}
                    step={100}
                    value={operationalCost}
                    onChange={(e) => setOperationalCost(Number(e.target.value))}
                    className="w-full rounded-xl border border-[#232331] p-2 font-bold text-[#232331] text-xs text-center"
                  />
                </div>
              </div>

              {/* Ingredients Composition List */}
              <div className="space-y-2 border-t border-[#dedee8] pt-3">
                <div className="flex items-center justify-between">
                  <span className="font-mono text-xs font-extrabold text-[#7958d8] uppercase">
                    Bahan Baku ({recipeIngredients.length})
                  </span>
                  <button
                    type="button"
                    onClick={handleAddIngredientRow}
                    className="btn-tactile inline-flex items-center gap-1 rounded-lg border border-[#7958d8] bg-[#f0edff] px-2.5 py-1 font-mono text-[10.5px] font-bold text-[#7958d8]"
                  >
                    <Plus size={12} />
                    <span>+ Tambah Bahan</span>
                  </button>
                </div>

                <div className="space-y-2">
                  {recipeIngredients.map((item, idx) => {
                    const ing = ingredientsMap.get(item.ingredient_id);
                    const subtotal = ing ? (ing.pack_price / ing.pack_size) * item.qty : 0;

                    return (
                      <div key={idx} className="rounded-xl border border-[#dedee8] bg-[#fcfcfe] p-2.5 font-mono text-xs space-y-2">
                        <div className="flex items-center justify-between gap-2">
                          <select
                            value={item.ingredient_id}
                            onChange={(e) => {
                              const updated = [...recipeIngredients];
                              updated[idx].ingredient_id = e.target.value;
                              setRecipeIngredients(updated);
                            }}
                            className="flex-1 rounded-lg border border-[#dedee8] bg-white p-1.5 text-[11px] font-bold text-[#232331]"
                          >
                            {ingredients.map((ingItem) => (
                              <option key={ingItem.id} value={ingItem.id}>
                                {ingItem.name} ({formatRupiah(ingItem.pack_price)}/{ingItem.pack_size}{ingItem.base_unit})
                              </option>
                            ))}
                          </select>

                          <button
                            type="button"
                            onClick={() => handleRemoveIngredientRow(idx)}
                            className="text-[#7b7b8e] hover:text-[#ef4444] p-1 shrink-0"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>

                        {/* Mobile Touch Stepper for Qty */}
                        <div className="flex items-center justify-between gap-2 pt-1 border-t border-[#dedee8]">
                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => handleAdjustIngredientQty(idx, -5)}
                              className="h-7 w-7 rounded-lg bg-white border border-[#dedee8] font-bold flex items-center justify-center text-[#7b7b8e]"
                            >
                              -5
                            </button>
                            <input
                              type="number"
                              min={0.1}
                              step={1}
                              value={item.qty}
                              onChange={(e) => {
                                const updated = [...recipeIngredients];
                                updated[idx].qty = Number(e.target.value);
                                setRecipeIngredients(updated);
                              }}
                              className="w-16 rounded-lg border border-[#dedee8] bg-white p-1 text-center font-bold text-[#232331] text-xs"
                            />
                            <span className="text-[10px] text-[#7b7b8e]">{ing?.base_unit || "gr"}</span>
                            <button
                              type="button"
                              onClick={() => handleAdjustIngredientQty(idx, 5)}
                              className="h-7 w-7 rounded-lg bg-white border border-[#dedee8] font-bold flex items-center justify-center text-[#7958d8]"
                            >
                              +5
                            </button>
                          </div>

                          <span className="font-extrabold text-[#c2410c] text-xs">
                            {formatRupiah(subtotal)}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Separate Packaging Items (Melekat per unit jadi) */}
              <div className="space-y-2 border-t border-[#dedee8] pt-3">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="font-mono text-xs font-extrabold text-[#16a34a] uppercase block">
                      Kemasan ({recipePackaging.length} Item)
                    </span>
                    <span className="text-[10px] text-[#7b7b8e]">
                      Melekat per porsi jadi.
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={handleAddPackagingRow}
                    className="btn-tactile inline-flex items-center gap-1 rounded-lg border border-[#16a34a] bg-[#dcfce7] px-2.5 py-1 font-mono text-[10.5px] font-bold text-[#16a34a]"
                  >
                    <Plus size={12} />
                    <span>+ Tambah</span>
                  </button>
                </div>

                <div className="space-y-2">
                  {recipePackaging.map((pack, idx) => (
                    <div key={idx} className="flex items-center gap-2 rounded-xl border border-[#dedee8] bg-[#fcfcfe] p-2 font-mono text-xs">
                      <input
                        type="text"
                        value={pack.name}
                        onChange={(e) => {
                          const updated = [...recipePackaging];
                          updated[idx].name = e.target.value;
                          setRecipePackaging(updated);
                        }}
                        placeholder="Nama kemasan"
                        className="flex-[2] rounded-lg border border-[#dedee8] bg-white p-1.5 text-[11px] font-bold text-[#232331]"
                      />
                      <div className="flex-1 flex items-center gap-1">
                        <input
                          type="number"
                          min={0}
                          step={50}
                          value={pack.cost}
                          onChange={(e) => {
                            const updated = [...recipePackaging];
                            updated[idx].cost = Number(e.target.value);
                            setRecipePackaging(updated);
                          }}
                          className="w-20 rounded-lg border border-[#dedee8] bg-white p-1.5 text-center font-bold text-[#232331] text-xs"
                        />
                        <span className="text-[9px] text-[#7b7b8e]">Rp</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleRemovePackagingRow(idx)}
                        className="text-[#7b7b8e] hover:text-[#ef4444] p-1"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              {/* Selling Price & Target Margin Input */}
              <div className="grid grid-cols-2 gap-2 sm:gap-3 border-t border-[#dedee8] pt-3 font-mono text-xs">
                <div className="space-y-1">
                  <label className="block font-bold text-[#232331] text-[11px] sm:text-xs">Harga Jual (Rp):</label>
                  <input
                    type="number"
                    min={0}
                    step={500}
                    value={sellingPrice}
                    onChange={(e) => setSellingPrice(Number(e.target.value))}
                    className="w-full rounded-xl border-2 border-[#232331] p-2 font-extrabold text-sm sm:text-base text-[#232331]"
                  />
                </div>

                <div className="space-y-1">
                  <label className="block font-bold text-[#232331] text-[11px] sm:text-xs">Target Margin %:</label>
                  <input
                    type="number"
                    min={10}
                    max={95}
                    value={targetMarginPct}
                    onChange={(e) => setTargetMarginPct(Number(e.target.value))}
                    className="w-full rounded-xl border-2 border-[#232331] p-2 font-extrabold text-sm sm:text-base text-[#7958d8]"
                  />
                </div>
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="submit"
                  className="btn-tactile flex-1 flex items-center justify-center gap-2 rounded-2xl border-2 border-[#232331] bg-[#232331] py-3 text-xs sm:text-sm font-extrabold text-white shadow-ink-md"
                >
                  <Save size={15} />
                  <span>Simpan Resep ke Katalog ✓</span>
                </button>
              </div>

            </form>

            {/* Right Column (5 cols): Live HPP & Profit Result Gauge (Sticky on Desktop) */}
            <div className="lg:col-span-5 rounded-2xl sm:rounded-3xl border sm:border-2 border-[#232331] bg-white p-4 sm:p-6 shadow-ink-md space-y-4 sm:space-y-5 sticky top-20">
              
              <div className="border-b border-[#dedee8] pb-2.5 sm:pb-3">
                <span className="font-mono text-[10px] font-bold uppercase text-[#7958d8] block">
                  HASIL KALKULASI REALTIME
                </span>
                <h3 className="font-extrabold text-sm sm:text-base text-[#232331] font-sans mt-0.5 truncate">
                  {recipeName || "Resep Tanpa Nama"}
                </h3>
              </div>

              {/* HPP Main Hero */}
              <div className="rounded-2xl border-2 border-[#232331] bg-[#ffedd5] p-3.5 sm:p-4 text-center space-y-1">
                <span className="text-[10px] font-mono text-[#c2410c] font-bold block uppercase">
                  TOTAL HPP MODAL / PORSI JADI
                </span>
                <div className="text-2xl sm:text-3xl font-black font-mono text-[#c2410c]">
                  {formatRupiah(currentEditorCalc.hpp_per_unit)}
                </div>
                <div className="text-[10.5px] font-mono text-[#7b7b8e]">
                  Bahan: {formatRupiah(currentEditorCalc.biaya_bahan / outputQty)} + Kemasan: {formatRupiah(currentEditorCalc.biaya_kemasan)}
                </div>
              </div>

              {/* Profit & Margin Breakdown */}
              <div className="space-y-2 font-mono text-xs">
                
                <div className="flex justify-between items-center p-2 rounded-xl bg-[#fcfcfe] border border-[#dedee8]">
                  <span className="text-[#7b7b8e]">Harga Jual Toko:</span>
                  <span className="font-extrabold text-[#232331] text-xs sm:text-sm">
                    {formatRupiah(sellingPrice)}
                  </span>
                </div>

                <div className="flex justify-between items-center p-2 rounded-xl bg-[#dcfce7] border border-[#16a34a]/30">
                  <span className="text-[#16a34a] font-bold">Laba per Porsi:</span>
                  <span className="font-black text-[#16a34a] text-xs sm:text-sm">
                    +{formatRupiah(currentEditorCalc.profit_per_unit)}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2 pt-1">
                  <div className="p-2.5 sm:p-3 rounded-xl border border-[#dedee8] bg-[#fcfcfe] text-center">
                    <span className="text-[9.5px] text-[#7b7b8e] block uppercase">MARGIN LABA</span>
                    <span className={`text-base sm:text-lg font-black ${currentEditorCalc.is_under_target ? "text-[#ef4444]" : "text-[#16a34a]"}`}>
                      {formatMarginPercent(currentEditorCalc.margin_pct)}
                    </span>
                  </div>
                  <div className="p-2.5 sm:p-3 rounded-xl border border-[#dedee8] bg-[#fcfcfe] text-center">
                    <span className="text-[9.5px] text-[#7b7b8e] block uppercase">MARKUP MODAL</span>
                    <span className="text-base sm:text-lg font-black text-[#7958d8]">
                      {formatMarginPercent(currentEditorCalc.markup_pct)}
                    </span>
                  </div>
                </div>

              </div>

              {/* Recommended Selling Price Card */}
              <div className="rounded-2xl border-2 border-[#7958d8] bg-[#f0edff] p-3.5 sm:p-4 space-y-2 font-mono text-xs">
                <div className="flex items-center justify-between">
                  <span className="font-extrabold text-[#7958d8]">REKOMENDASI HARGA:</span>
                  <span className="text-[9.5px] bg-white px-1.5 py-0.2 rounded border border-[#7958d8] font-bold">
                    Target {targetMarginPct}%
                  </span>
                </div>
                <div className="text-lg sm:text-xl font-black text-[#232331]">
                  {formatRupiah(currentEditorCalc.recommended_price_target_margin)}
                </div>
                <button
                  type="button"
                  onClick={() => setSellingPrice(currentEditorCalc.recommended_price_target_margin)}
                  className="btn-tactile w-full py-1.5 rounded-lg bg-[#7958d8] text-white font-bold text-[10.5px]"
                >
                  Terapkan Harga Ini
                </button>
              </div>

            </div>

          </div>
        )}

        {/* ============================================================= */}
        {/* TAB 3: SIMULASI TARGET HARGA & CUAN (Touch Friendly) */}
        {/* ============================================================= */}
        {activeTab === "simulation" && activeSimRecipe && (
          <div className="rounded-2xl sm:rounded-3xl border sm:border-2 border-[#232331] bg-white p-4 sm:p-6 shadow-ink-md space-y-5">
            
            <div className="border-b border-[#dedee8] pb-3 sm:pb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h3 className="font-extrabold text-sm sm:text-base text-[#232331]">
                  Simulator Target Harga &amp; Cuan
                </h3>
                <p className="text-[11px] sm:text-xs text-[#7b7b8e]">
                  Uji target margin sebelum menentukan harga jual di kasir.
                </p>
              </div>

              {/* Select recipe to simulate */}
              <div className="flex items-center gap-2 font-mono text-xs">
                <span className="font-bold text-[#7b7b8e] shrink-0">Pilih Menu:</span>
                <select
                  value={simSelectedRecipeId}
                  onChange={(e) => setSimSelectedRecipeId(e.target.value)}
                  className="w-full sm:w-auto rounded-xl border border-[#232331] bg-white px-2.5 py-1.5 font-bold text-xs text-[#232331]"
                >
                  {recipesWithCalc.map((r) => (
                    <option key={r.recipe.id} value={r.recipe.id}>
                      {r.recipe.name} (HPP: {formatRupiah(r.calculation.hpp_per_unit)})
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid gap-4 lg:grid-cols-2 items-start font-mono text-xs">
              
              {/* Left: Interactive Sliders & Quick Touch Pills */}
              <div className="rounded-2xl border border-[#dedee8] bg-[#fcfcfe] p-4 sm:p-5 space-y-4">
                
                {/* Target Margin Slider & Presets */}
                <div className="space-y-2.5">
                  <div className="flex justify-between items-center font-bold">
                    <span>Target Margin Keuntungan:</span>
                    <span className="text-base text-[#7958d8] font-black">{simTargetMargin}%</span>
                  </div>

                  <input
                    type="range"
                    min={35}
                    max={85}
                    step={1}
                    value={simTargetMargin}
                    onChange={(e) => setSimTargetMargin(Number(e.target.value))}
                    className="w-full cursor-pointer accent-[#7958d8] h-2 bg-gray-200 rounded-lg"
                  />

                  {/* 1-Tap Quick Preset Pills */}
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {[50, 60, 65, 70, 75, 80].map((preset) => (
                      <button
                        key={preset}
                        type="button"
                        onClick={() => setSimTargetMargin(preset)}
                        className={`px-2.5 py-1 rounded-lg text-[10.5px] font-bold border transition-all ${
                          simTargetMargin === preset
                            ? "bg-[#7958d8] text-white border-[#7958d8]"
                            : "bg-white text-[#7b7b8e] border-[#dedee8]"
                        }`}
                      >
                        {preset}%
                      </button>
                    ))}
                  </div>
                </div>

                {/* Target Profit Nominal Input */}
                <div className="space-y-2 border-t border-[#dedee8] pt-3">
                  <label className="block font-bold text-[#232331]">
                    Atau Target Laba Bersih Nominal per Porsi:
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      step={500}
                      value={simTargetProfitNominal}
                      onChange={(e) => setSimTargetProfitNominal(Number(e.target.value))}
                      className="flex-1 rounded-xl border border-[#232331] bg-white p-2 font-extrabold text-[#16a34a] text-xs sm:text-sm"
                    />
                    <span className="text-[#7b7b8e] text-[11px]">Rp/Porsi</span>
                  </div>
                </div>

                {/* Current Cost Summary */}
                <div className="rounded-xl border border-[#dedee8] bg-white p-3 space-y-1 text-[11px]">
                  <div className="flex justify-between">
                    <span className="text-[#7b7b8e]">HPP Modal:</span>
                    <span className="font-extrabold text-[#c2410c]">{formatRupiah(activeSimRecipe.calculation.hpp_per_unit)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[#7b7b8e]">Harga Jual Saat Ini:</span>
                    <span className="font-extrabold text-[#232331]">{formatRupiah(activeSimRecipe.recipe.selling_price)}</span>
                  </div>
                </div>

              </div>

              {/* Right: Simulation Output Cards */}
              <div className="space-y-3 sm:space-y-4">
                
                {/* Method 1: Target Margin Result */}
                <div className="rounded-2xl border-2 border-[#7958d8] bg-[#f0edff] p-4 sm:p-5 space-y-1.5">
                  <span className="text-[9.5px] sm:text-[10px] font-bold text-[#7958d8] uppercase">
                    HARGA REKOMENDASI DARI MARGIN ({simTargetMargin}%)
                  </span>
                  <div className="text-2xl sm:text-3xl font-black text-[#232331]">
                    {formatRupiah(
                      roundUpTo500(activeSimRecipe.calculation.hpp_per_unit / (1 - simTargetMargin / 100))
                    )}
                  </div>
                  <p className="text-[10.5px] sm:text-[11px] text-[#7b7b8e] font-sans">
                    Laba kotor per porsi: +{formatRupiah(
                      roundUpTo500(activeSimRecipe.calculation.hpp_per_unit / (1 - simTargetMargin / 100)) - activeSimRecipe.calculation.hpp_per_unit
                    )}
                  </p>
                </div>

                {/* Method 2: Target Profit Result */}
                <div className="rounded-2xl border-2 border-[#16a34a] bg-[#dcfce7] p-4 sm:p-5 space-y-1.5">
                  <span className="text-[9.5px] sm:text-[10px] font-bold text-[#16a34a] uppercase">
                    HARGA REKOMENDASI DARI TARGET PROFIT (+{formatRupiah(simTargetProfitNominal)})
                  </span>
                  <div className="text-2xl sm:text-3xl font-black text-[#232331]">
                    {formatRupiah(
                      calculatePriceFromTargetProfit(activeSimRecipe.calculation.hpp_per_unit, simTargetProfitNominal)
                    )}
                  </div>
                  <p className="text-[10.5px] sm:text-[11px] text-[#7b7b8e] font-sans">
                    Margin yang didapat: {formatMarginPercent(
                      (simTargetProfitNominal / calculatePriceFromTargetProfit(activeSimRecipe.calculation.hpp_per_unit, simTargetProfitNominal)) * 100
                    )}
                  </p>
                </div>

              </div>

            </div>

          </div>
        )}

        {/* ============================================================= */}
        {/* TAB 4: MASTER BAHAN BAKU & LIVING INGREDIENTS */}
        {/* ============================================================= */}
        {activeTab === "ingredients" && (
          <div className="rounded-2xl sm:rounded-3xl border sm:border-2 border-[#232331] bg-white p-4 sm:p-6 shadow-ink-md space-y-4">
            
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#dedee8] pb-3 sm:pb-4">
              <div>
                <h3 className="font-extrabold text-sm sm:text-base text-[#232331]">
                  Master Bahan Baku ({ingredients.length} Bahan)
                </h3>
                <p className="text-[11px] sm:text-xs text-[#7b7b8e]">
                  Ubah satu harga beli di sini $\to$ seluruh resep terkait otomatis terhitung ulang!
                </p>
              </div>

              <button
                type="button"
                onClick={() => setShowAddIngredient(true)}
                className="btn-tactile inline-flex items-center gap-1.5 rounded-xl border sm:border-2 border-[#232331] bg-[#d9ff57] px-3 py-1.5 font-mono text-xs font-bold text-[#232331] shadow-ink-xs"
              >
                <Plus size={13} strokeWidth={3} />
                <span>Tambah Bahan</span>
              </button>
            </div>

            {/* Modal Add Ingredient */}
            {showAddIngredient && (
              <form onSubmit={handleCreateIngredient} className="rounded-2xl border-2 border-[#7958d8] bg-[#f0edff] p-3.5 sm:p-4 space-y-3 font-mono text-xs animate-in fade-in">
                <span className="font-bold text-[#7958d8] block">INPUT BAHAN BAKU BARU:</span>
                <div className="grid sm:grid-cols-4 gap-2 sm:gap-3 font-sans">
                  <input
                    type="text"
                    required
                    placeholder="Nama Bahan"
                    value={newIngName}
                    onChange={(e) => setNewIngName(e.target.value)}
                    className="rounded-xl border border-[#232331] bg-white p-2 text-xs font-bold text-[#232331]"
                  />
                  <input
                    type="number"
                    min={1}
                    required
                    placeholder="Harga Beli Kemasan (Rp)"
                    value={newIngPrice}
                    onChange={(e) => setNewIngPrice(Number(e.target.value))}
                    className="rounded-xl border border-[#232331] bg-white p-2 text-xs font-bold text-[#232331]"
                  />
                  <input
                    type="number"
                    min={1}
                    required
                    placeholder="Isi Kemasan (misal: 1000)"
                    value={newIngSize}
                    onChange={(e) => setNewIngSize(Number(e.target.value))}
                    className="rounded-xl border border-[#232331] bg-white p-2 text-xs font-bold text-[#232331]"
                  />
                  <select
                    value={newIngUnit}
                    onChange={(e) => setNewIngUnit(e.target.value as any)}
                    className="rounded-xl border border-[#232331] bg-white p-2 text-xs font-bold text-[#232331]"
                  >
                    <option value="gr">Gram (gr)</option>
                    <option value="ml">Mililiter (ml)</option>
                    <option value="pcs">Pieces (pcs)</option>
                  </select>
                </div>
                <div className="flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setShowAddIngredient(false)}
                    className="rounded-xl bg-white px-3 py-1.5 font-bold text-[#7b7b8e] border border-[#dedee8]"
                  >
                    Batal
                  </button>
                  <button
                    type="submit"
                    className="rounded-xl bg-[#232331] px-4 py-1.5 font-bold text-[#d9ff57]"
                  >
                    Simpan Bahan ✓
                  </button>
                </div>
              </form>
            )}

            {/* Mobile Cards for Ingredients */}
            <div className="grid gap-2.5 sm:hidden">
              {ingredients.map((ing) => {
                const unitPrice = ing.pack_price / ing.pack_size;
                return (
                  <div key={ing.id} className="rounded-xl border border-[#dedee8] bg-[#fcfcfe] p-3 font-mono text-xs space-y-2">
                    <div className="flex justify-between items-start">
                      <span className="font-extrabold text-sm text-[#232331] font-sans">{ing.name}</span>
                      <span className="font-black text-sm text-[#232331]">{formatRupiah(ing.pack_price)}</span>
                    </div>
                    <div className="flex justify-between text-[11px] text-[#7b7b8e]">
                      <span>Isi: {ing.pack_size} {ing.base_unit}</span>
                      <span className="text-[#c2410c] font-bold">Modal: {formatRupiah(unitPrice)}/{ing.base_unit}</span>
                    </div>
                    <div className="flex justify-end gap-1.5 pt-1 border-t border-[#dedee8]">
                      <button
                        type="button"
                        onClick={() => {
                          setEditingIngredient(ing);
                          setNewPackPriceInput(ing.pack_price);
                        }}
                        className="btn-tactile rounded-lg border border-[#7958d8] bg-[#f0edff] px-2.5 py-1 text-[10.5px] font-bold text-[#7958d8]"
                      >
                        Ubah Harga Beli
                      </button>
                      <button
                        type="button"
                        onClick={() => setHistoryDrawerIng(ing)}
                        className="btn-tactile rounded-lg border border-[#dedee8] bg-white p-1 text-[#7b7b8e]"
                      >
                        <History size={13} />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Desktop Table View */}
            <div className="hidden sm:block overflow-x-auto">
              <table className="w-full text-left font-mono text-xs">
                <thead>
                  <tr className="border-b border-[#dedee8] text-[#7b7b8e] text-[10px] uppercase">
                    <th className="py-2.5 px-3">Nama Bahan Baku</th>
                    <th className="py-2.5 px-3">Harga Beli Kemasan</th>
                    <th className="py-2.5 px-3">Isi &amp; Satuan Dasar</th>
                    <th className="py-2.5 px-3">Harga Satuan (Modal)</th>
                    <th className="py-2.5 px-3">Terakhir Diubah</th>
                    <th className="py-2.5 px-3 text-right">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#dedee8]">
                  {ingredients.map((ing) => {
                    const unitPrice = ing.pack_price / ing.pack_size;
                    return (
                      <tr key={ing.id} className="hover:bg-[#fcfcfe]">
                        <td className="py-3 px-3 font-extrabold text-[#232331] font-sans">
                          {ing.name}
                        </td>
                        <td className="py-3 px-3 font-black text-sm text-[#232331]">
                          {formatRupiah(ing.pack_price)}
                        </td>
                        <td className="py-3 px-3 text-[#7b7b8e] font-bold">
                          {ing.pack_size} {ing.base_unit}
                        </td>
                        <td className="py-3 px-3 text-[#c2410c] font-bold">
                          {formatRupiah(unitPrice)} / {ing.base_unit}
                        </td>
                        <td className="py-3 px-3 text-[#7b7b8e] text-[10.5px]">
                          {formatBusinessDateTime(ing.updated_at)}
                        </td>
                        <td className="py-3 px-3 text-right space-x-1.5 whitespace-nowrap">
                          <button
                            type="button"
                            onClick={() => {
                              setEditingIngredient(ing);
                              setNewPackPriceInput(ing.pack_price);
                            }}
                            className="btn-tactile rounded-lg border border-[#7958d8] bg-[#f0edff] px-2.5 py-1 text-[10.5px] font-bold text-[#7958d8]"
                          >
                            Ubah Harga Beli
                          </button>
                          <button
                            type="button"
                            onClick={() => setHistoryDrawerIng(ing)}
                            className="btn-tactile rounded-lg border border-[#dedee8] bg-white px-2 py-1 text-[10.5px] font-bold text-[#7b7b8e] hover:text-[#232331]"
                          >
                            <History size={13} />
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

        {/* ============================================================= */}
        {/* TAB 5: ONBOARDING IMPOR CEPAT 10 PRODUK */}
        {/* ============================================================= */}
        {activeTab === "onboarding" && (
          <div className="rounded-2xl sm:rounded-3xl border sm:border-2 border-[#232331] bg-white p-4 sm:p-6 shadow-ink-md space-y-4">
            <div className="border-b border-[#dedee8] pb-3">
              <div className="flex items-center gap-2">
                <Sparkles size={18} className="text-[#d97706]" />
                <h3 className="font-extrabold text-sm sm:text-base text-[#232331]">
                  Onboarding Kilat: Input 10 Produk Pertama
                </h3>
              </div>
              <p className="text-[11px] sm:text-xs text-[#7b7b8e] mt-0.5">
                Fasilitas bonus paket KAEL Finance: Tim support kami siap membantu input cepat menu tokomu secara massal.
              </p>
            </div>

            <div className="rounded-xl border border-[#dedee8] bg-[#fcfcfe] p-3.5 text-xs font-mono text-[#7b7b8e] space-y-2">
              <p className="font-bold text-[#232331]">
                ✓ Alur Praktis Setup Awal Toko:
              </p>
              <ol className="list-decimal list-inside space-y-1 text-[11px]">
                <li>Masukkan nama menu dan kisaran modal bahan baku kasar per porsi.</li>
                <li>Sistem otomatis membuat resep awal dengan rasio margin aman 65%.</li>
                <li>Setelah itu, Anda dapat memperhalus rincian gramasi di Tab Editor Resep kapan saja.</li>
              </ol>
            </div>

            <div className="text-center py-3">
              <button
                type="button"
                onClick={() => {
                  alert("Semua 10 contoh menu terlaris sudah ter-load lengkap di database tokomu!");
                  setActiveTab("catalog");
                }}
                className="btn-tactile inline-flex items-center gap-2 rounded-2xl border-2 border-[#232331] bg-[#d9ff57] px-5 py-2.5 font-mono text-xs font-extrabold text-[#232331] shadow-ink-md"
              >
                <span>Buka &amp; Kelola Katalog Menu Sekarang</span>
                <ChevronRight size={14} />
              </button>
            </div>
          </div>
        )}

      </main>

      {/* ============================================================= */}
      {/* MOBILE STICKY FLOATING QUICK GAUGE BAR (Active on Tab 2 Editor) */}
      {/* ============================================================= */}
      {activeTab === "editor" && (
        <div className="fixed bottom-0 inset-x-0 z-40 bg-[#232331] text-white border-t-2 border-[#232331] p-3 shadow-ink-xl lg:hidden">
          <div className="max-w-6xl mx-auto flex items-center justify-between gap-2 font-mono text-xs">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-[#d9ff57] font-black text-sm">
                  HPP: {formatRupiah(currentEditorCalc.hpp_per_unit)}
                </span>
                <span className={`text-[10px] px-1.5 py-0.2 rounded font-bold ${
                  currentEditorCalc.is_under_target ? "bg-[#ef4444] text-white" : "bg-[#16a34a] text-white"
                }`}>
                  {formatMarginPercent(currentEditorCalc.margin_pct)} Margin
                </span>
              </div>
              <span className="text-[10px] text-[#dedee8] block truncate">
                Laba: +{formatRupiah(currentEditorCalc.profit_per_unit)} / porsi
              </span>
            </div>

            <div className="flex items-center gap-1.5 shrink-0">
              <button
                type="button"
                onClick={() => handleSaveRecipe()}
                className="btn-tactile rounded-xl bg-[#d9ff57] px-3.5 py-2 text-xs font-extrabold text-[#232331] shadow-ink-xs"
              >
                Simpan ✓
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: EDIT INGREDIENT PRICE DIALOG */}
      {editingIngredient && (
        <div className="fixed inset-0 z-50 bg-[#232331]/60 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="w-full max-w-md rounded-t-3xl sm:rounded-3xl border-2 border-[#232331] bg-white p-5 sm:p-6 shadow-ink-lg space-y-4 animate-in slide-in-from-bottom sm:zoom-in duration-150">
            <div className="flex items-center justify-between border-b border-[#dedee8] pb-3">
              <h3 className="font-extrabold text-sm sm:text-base text-[#232331]">
                Ubah Harga Beli Bahan Baku
              </h3>
              <button
                type="button"
                onClick={() => setEditingIngredient(null)}
                className="text-[#7b7b8e] hover:text-[#232331] text-xs font-bold p-1"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleUpdateIngredientPrice} className="space-y-3 font-mono text-xs">
              <div className="rounded-xl bg-[#f0edff] p-3 space-y-1">
                <span className="font-bold text-[#7958d8] font-sans block text-sm">{editingIngredient.name}</span>
                <span className="text-[11px] text-[#7b7b8e]">
                  Isi Kemasan: {editingIngredient.pack_size} {editingIngredient.base_unit}
                </span>
              </div>

              <div className="space-y-1">
                <label className="block font-bold text-[#232331]">Harga Beli Baru per Kemasan (Rp):</label>
                <input
                  type="number"
                  required
                  min={1}
                  step={500}
                  value={newPackPriceInput}
                  onChange={(e) => setNewPackPriceInput(Number(e.target.value))}
                  className="w-full rounded-xl border-2 border-[#232331] p-3 text-lg font-black text-[#232331] focus:outline-none"
                  autoFocus
                />
              </div>

              <p className="text-[10.5px] text-[#7b7b8e] font-sans leading-relaxed">
                ⚡ Sistem otomatis mencatat kenaikan harga ini ke histori dan menghitung ulang HPP semua resep yang terikat.
              </p>

              <div className="flex justify-end gap-2 pt-2 border-t border-[#dedee8]">
                <button
                  type="button"
                  onClick={() => setEditingIngredient(null)}
                  className="rounded-xl border border-[#dedee8] bg-white px-4 py-2 font-bold text-[#7b7b8e]"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="btn-tactile rounded-xl bg-[#232331] px-5 py-2 font-extrabold text-[#d9ff57] shadow-ink-xs"
                >
                  Simpan &amp; Update HPP ✓
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* DRAWER: INGREDIENT PRICE HISTORY */}
      {historyDrawerIng && (
        <div className="fixed inset-0 z-50 bg-[#232331]/60 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="w-full max-w-md rounded-t-3xl sm:rounded-3xl border-2 border-[#232331] bg-white p-5 sm:p-6 shadow-ink-lg space-y-4 animate-in slide-in-from-bottom sm:zoom-in">
            <div className="flex items-center justify-between border-b border-[#dedee8] pb-3">
              <div className="flex items-center gap-2">
                <History size={16} className="text-[#7958d8]" />
                <h3 className="font-extrabold text-sm sm:text-base text-[#232331]">
                  Histori Kenaikan Harga
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setHistoryDrawerIng(null)}
                className="text-[#7b7b8e] hover:text-[#232331] text-xs font-bold p-1"
              >
                ✕
              </button>
            </div>

            <div className="space-y-2 font-mono text-xs">
              <span className="font-bold text-[#232331] font-sans block text-sm">{historyDrawerIng.name}</span>
              
              <div className="space-y-1.5 max-h-60 overflow-y-auto pr-1">
                {db.getIngredientPriceHistory(historyDrawerIng.id).map((h) => (
                  <div key={h.id} className="flex justify-between items-center p-2.5 rounded-xl border border-[#dedee8] bg-[#fcfcfe]">
                    <span className="font-black text-sm text-[#232331]">{formatRupiah(h.pack_price)}</span>
                    <span className="text-[10.5px] text-[#7b7b8e]">{formatBusinessDateTime(h.changed_at)}</span>
                  </div>
                ))}
              </div>
            </div>

            <button
              type="button"
              onClick={() => setHistoryDrawerIng(null)}
              className="w-full py-2.5 rounded-xl bg-[#f0edff] text-xs font-bold text-[#7958d8]"
            >
              Tutup Histori
            </button>
          </div>
        </div>
      )}

      {/* Footer */}
      <footer className="border-t border-[#dedee8] bg-white py-4 text-center text-xs font-mono text-[#7b7b8e]">
        KAEL Finance Engine · Pure Recipe HPP &amp; Dynamic Margin Radar
      </footer>
    </div>
  );
}
