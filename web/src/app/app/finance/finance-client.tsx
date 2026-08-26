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

interface FinanceClientProps {
  business: Business | null;
  initialRecipes: Recipe[];
  initialIngredients: Ingredient[];
}

export default function FinanceClient({
  business,
  initialRecipes,
  initialIngredients,
}: FinanceClientProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [activeTab, setActiveTab] = useState<"catalog" | "editor" | "simulation" | "ingredients" | "onboarding">("catalog");

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
    { ingredient_id: ingredients[0]?.id || "ing-01", qty: 18 },
  ]);

  const [recipePackaging, setRecipePackaging] = useState<RecipePackagingItem[]>([
    { id: "pack-1", name: "Cup 16oz + Tutup & Sedotan", cost: 1100 },
    { id: "pack-2", name: "Stiker Logo Waterproof", cost: 250 },
  ]);

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

  const activeSimRecipe = useMemo(() => {
    return recipesWithCalc.find((r) => r.recipe.id === simSelectedRecipeId) || recipesWithCalc[0] || null;
  }, [recipesWithCalc, simSelectedRecipeId]);

  const simResult = useMemo(() => {
    if (!activeSimRecipe) return null;
    const hpp = activeSimRecipe.calculation.hpp_per_unit;
    const priceFromNominal = calculatePriceFromTargetProfit(hpp, simTargetProfitNominal);
    const actualMarginFromNominal = priceFromNominal > 0 ? ((priceFromNominal - hpp) / priceFromNominal) * 100 : 0;
    
    const marginFactor = 1 - (simTargetMarginPct / 100);
    const priceFromMargin = marginFactor > 0 ? roundUpTo500(hpp / marginFactor) : hpp;
    const actualProfitFromMargin = priceFromMargin - hpp;

    return {
      priceFromNominal,
      actualMarginFromNominal,
      priceFromMargin,
      actualProfitFromMargin,
    };
  }, [activeSimRecipe, simTargetProfitNominal, simTargetMarginPct]);

  // ---------------------------------------------------------------------------
  // INGREDIENTS MASTER & PRICE CASCADE STATE (Tab 4)
  // ---------------------------------------------------------------------------
  const [editingIngredient, setEditingIngredient] = useState<Ingredient | null>(null);
  const [newPackPriceInput, setNewPackPriceInput] = useState<number>(0);
  const [historyDrawerIng, setHistoryDrawerIng] = useState<Ingredient | null>(null);
  const [priceHistoryList, setPriceHistoryList] = useState<IngredientPriceHistory[]>([]);
  const [showAddIngredient, setShowAddIngredient] = useState(false);

  // New Ingredient Inputs
  const [newIngName, setNewIngName] = useState("");
  const [newIngPrice, setNewIngPrice] = useState<number>(50000);
  const [newIngSize, setNewIngSize] = useState<number>(1000);
  const [newIngUnit, setNewIngUnit] = useState<"gr" | "ml" | "pcs">("gr");

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
    setRecipeName("");
    setRecipeCategory("Minuman");
    setRecipeType("olahan");
    setOutputQty(1);
    setOperationalCost(500);
    setSellingPrice(25000);
    setTargetMarginPct(60);
    setRecipeIngredients(ingredients[0] ? [{ ingredient_id: ingredients[0].id, qty: 15 }] : []);
    setRecipePackaging([{ id: `p-${Date.now()}`, name: "Cup & Tutup", cost: 1000 }]);
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

    const res = await createIngredientAction(newIngName.trim(), newIngPrice, newIngSize, newIngUnit);
    if (!res.ok) {
      alert(res.error);
      return;
    }
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
    const matchesSearch = r.recipe.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          (r.recipe.category || "").toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = filterCategory === "all" || r.recipe.category === filterCategory;
    return matchesSearch && matchesCategory;
  });

  const categoriesList = Array.from(new Set(recipes.map((r) => r.category || "Lainnya")));

  return (
    <div className="min-h-screen bg-[#f7f6fc] text-[#232331] font-sans flex flex-col justify-between">
      
      {/* Top Header */}
      <header className="sticky top-0 z-30 border-b-2 border-[#232331] bg-white/95 backdrop-blur-md px-3 sm:px-8 py-2.5 sm:py-3.5">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-2">
          
          <div className="flex items-center gap-2 sm:gap-3 min-w-0">
            <Link
              href="/app"
              className="flex h-8 w-8 sm:h-9 sm:w-9 shrink-0 items-center justify-center rounded-xl border border-[#232331] bg-[#fcfcfe] text-[#232331] shadow-ink-xs hover:bg-[#f0edff]"
              title="Kembali ke Portal KAEL"
            >
              <ArrowLeft size={15} />
            </Link>

            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <h1 className="font-extrabold text-xs sm:text-base text-[#232331] truncate">
                  KAEL Finance &amp; HPP
                </h1>
                <span className="rounded-md bg-[#ffedd5] px-1.5 py-0.2 font-mono text-[8.5px] sm:text-[9px] font-bold text-[#c2410c] border border-[#c2410c] shrink-0">
                  Rp 249rb
                </span>
              </div>
              <span className="text-[9.5px] sm:text-[11px] text-[#7b7b8e] font-mono block truncate">
                {business?.name || "Senja Coffee"} · Kalkulator Resep &amp; Food Cost
              </span>
            </div>
          </div>

          {/* Top Quick Actions */}
          <div className="flex items-center gap-1.5 sm:gap-2">
            <button
              type="button"
              onClick={handleCreateNewRecipe}
              className="btn-tactile flex items-center gap-1 sm:gap-1.5 rounded-xl border-2 border-[#232331] bg-[#d9ff57] px-2.5 sm:px-3.5 py-1.5 font-mono text-[11px] sm:text-xs font-black text-[#232331] shadow-ink-xs whitespace-nowrap"
            >
              <Plus size={13} />
              <span className="hidden xs:inline">+ Hitung Resep Baru</span>
              <span className="xs:hidden">+ Resep</span>
            </button>
          </div>

        </div>
      </header>

      {/* Main Container */}
      <main className="flex-1 mx-auto w-full max-w-7xl p-3 sm:p-6 lg:p-8 space-y-4 sm:space-y-6">
        
        {/* TAB NAVIGATION PILLS */}
        <div className="flex items-center overflow-x-auto scrollbar-none gap-1.5 sm:gap-2 border-b border-[#dedee8] pb-2 font-mono text-xs font-bold">
          <button
            type="button"
            onClick={() => setActiveTab("catalog")}
            className={`flex items-center gap-1.5 px-3 sm:px-4 py-2 rounded-xl border transition-all whitespace-nowrap ${
              activeTab === "catalog"
                ? "bg-[#232331] text-[#d9ff57] border-[#232331] shadow-ink-xs"
                : "bg-white text-[#7b7b8e] border-[#dedee8] hover:border-[#232331] hover:text-[#232331]"
            }`}
          >
            <Package size={14} />
            <span>1. Katalog Resep ({recipes.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("editor")}
            className={`flex items-center gap-1.5 px-3 sm:px-4 py-2 rounded-xl border transition-all whitespace-nowrap ${
              activeTab === "editor"
                ? "bg-[#232331] text-[#d9ff57] border-[#232331] shadow-ink-xs"
                : "bg-white text-[#7b7b8e] border-[#dedee8] hover:border-[#232331] hover:text-[#232331]"
            }`}
          >
            <Calculator size={14} />
            <span>2. Kalkulator Resep</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("simulation")}
            className={`flex items-center gap-1.5 px-3 sm:px-4 py-2 rounded-xl border transition-all whitespace-nowrap ${
              activeTab === "simulation"
                ? "bg-[#232331] text-[#d9ff57] border-[#232331] shadow-ink-xs"
                : "bg-white text-[#7b7b8e] border-[#dedee8] hover:border-[#232331] hover:text-[#232331]"
            }`}
          >
            <TrendingUp size={14} />
            <span>3. Simulasi Target Profit</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("ingredients")}
            className={`flex items-center gap-1.5 px-3 sm:px-4 py-2 rounded-xl border transition-all whitespace-nowrap ${
              activeTab === "ingredients"
                ? "bg-[#232331] text-[#d9ff57] border-[#232331] shadow-ink-xs"
                : "bg-white text-[#7b7b8e] border-[#dedee8] hover:border-[#232331] hover:text-[#232331]"
            }`}
          >
            <Layers size={14} />
            <span>4. Master Bahan Baku ({ingredients.length})</span>
          </button>
        </div>

        {/* ============================================================= */}
        {/* TAB 1: KATALOG RESEP & MARGIN RADAR */}
        {/* ============================================================= */}
        {activeTab === "catalog" && (
          <div className="space-y-4 sm:space-y-6">
            
            {/* Margin Danger Radar Alert */}
            {underTargetRecipes.length > 0 && (
              <div className="rounded-2xl sm:rounded-3xl border-2 border-[#ef4444] bg-[#feebee] p-3.5 sm:p-5 shadow-ink-md space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="text-[#ef4444]" size={18} />
                    <h3 className="font-black text-xs sm:text-sm text-[#ef4444]">
                      Radar Margin Bahaya: {underTargetRecipes.length} Menu Berada di Bawah Target Margin!
                    </h3>
                  </div>
                </div>
                <p className="text-[11px] sm:text-xs text-[#232331]">
                  Menu berikut menghasilkan margin lebih rendah dari target yang Anda tetapkan. Pertimbangkan untuk menaikkan harga jual atau kurangi porsi bahan.
                </p>
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {underTargetRecipes.map((r) => (
                    <button
                      key={r.recipe.id}
                      type="button"
                      onClick={() => handleEditRecipe(r.recipe)}
                      className="inline-flex items-center gap-1 rounded-xl border border-[#ef4444] bg-white px-2.5 py-1 text-xs font-mono font-bold text-[#ef4444] shadow-ink-xs hover:bg-[#ef4444] hover:text-white transition-all"
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
                <Search className="absolute left-3 top-2.5 text-[#7b7b8e]" size={15} />
                <input
                  type="text"
                  placeholder="Cari resep atau kategori menu..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full rounded-2xl border-2 border-[#232331] bg-white pl-9 pr-4 py-2 text-xs font-mono text-[#232331] placeholder-[#7b7b8e] focus:outline-none focus:ring-2 focus:ring-[#7958d8]"
                />
              </div>

              <div className="flex items-center gap-1 overflow-x-auto scrollbar-none font-mono text-xs">
                <button
                  type="button"
                  onClick={() => setFilterCategory("all")}
                  className={`px-3 py-1.5 rounded-xl border font-bold ${
                    filterCategory === "all" ? "bg-[#232331] text-white border-[#232331]" : "bg-white text-[#7b7b8e] border-[#dedee8]"
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
                      filterCategory === cat ? "bg-[#232331] text-white border-[#232331]" : "bg-white text-[#7b7b8e] border-[#dedee8]"
                    }`}
                  >
                    {cat}
                  </button>
                ))}
              </div>
            </div>

            {/* Recipes Grid */}
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3.5 sm:gap-4">
              {filteredRecipes.map(({ recipe, calculation }) => (
                <div
                  key={recipe.id}
                  className={`card-tactile rounded-2xl sm:rounded-3xl border-2 bg-white p-4 sm:p-5 shadow-ink-sm flex flex-col justify-between space-y-3 transition-all ${
                    calculation.is_under_target ? "border-[#ef4444]" : "border-[#232331]"
                  }`}
                >
                  <div>
                    <div className="flex justify-between items-start gap-2 border-b border-[#dedee8] pb-2.5">
                      <div>
                        <span className="text-[10px] font-mono text-[#7958d8] font-bold uppercase tracking-wider block">
                          {recipe.category || "Menu"} · {recipe.type === "olahan" ? "Olahan Sendiri" : "Kulakan"}
                        </span>
                        <h3 className="font-extrabold text-sm sm:text-base text-[#232331] font-sans">
                          {recipe.name}
                        </h3>
                      </div>
                      <span className={`px-2 py-0.5 rounded-full font-mono text-[10px] font-bold border shrink-0 ${
                        calculation.is_under_target
                          ? "bg-[#feebee] text-[#ef4444] border-[#ef4444]"
                          : "bg-[#dcfce7] text-[#16a34a] border-[#16a34a]"
                      }`}>
                        {formatMarginPercent(calculation.margin_pct)}
                      </span>
                    </div>

                    {/* Breakdown Numbers */}
                    <div className="mt-3 space-y-1.5 font-mono text-xs">
                      <div className="flex justify-between text-[#7b7b8e]">
                        <span>HPP Modal / unit:</span>
                        <span className="font-black text-[#c2410c]">{formatRupiah(calculation.hpp_per_unit)}</span>
                      </div>
                      <div className="flex justify-between text-[#7b7b8e]">
                        <span>Harga Jual Toko:</span>
                        <span className="font-bold text-[#232331]">{formatRupiah(recipe.selling_price)}</span>
                      </div>
                      <div className="flex justify-between text-[#7b7b8e]">
                        <span>Profit Bersih / pcs:</span>
                        <span className="font-black text-[#16a34a]">+{formatRupiah(calculation.profit_per_unit)}</span>
                      </div>
                      <div className="flex justify-between text-[#7b7b8e] text-[11px] pt-1 border-t border-[#dedee8]">
                        <span>Markup: {Math.round(calculation.markup_pct)}%</span>
                        <span>Target: {recipe.target_margin_pct}%</span>
                      </div>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="pt-2 flex items-center justify-between gap-2 border-t border-[#dedee8] font-mono text-xs">
                    <button
                      type="button"
                      onClick={() => handleEditRecipe(recipe)}
                      className="btn-tactile flex-1 flex items-center justify-center gap-1 rounded-xl border border-[#232331] bg-[#f0edff] py-2 font-bold text-[#7958d8] hover:bg-[#e1dbff]"
                    >
                      <Edit3 size={13} />
                      <span>Ubah Resep</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => handleDeleteRecipe(recipe.id, recipe.name)}
                      className="btn-tactile flex h-9 w-9 items-center justify-center rounded-xl border border-[#dedee8] bg-white text-[#ef4444] hover:bg-[#feebee] hover:border-[#ef4444]"
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
              
              <div className="rounded-2xl sm:rounded-3xl border-2 border-[#232331] bg-white p-4 sm:p-6 shadow-ink-md space-y-4 font-mono text-xs">
                <div className="flex items-center justify-between border-b border-[#dedee8] pb-3">
                  <h3 className="font-extrabold text-sm sm:text-base text-[#232331] font-sans">
                    {editingRecipeId ? "Ubah Resep Produk" : "Hitung Resep Produk Baru"}
                  </h3>
                  <span className="rounded-md bg-[#f0edff] text-[#7958d8] px-2 py-0.5 text-[10px] font-bold">
                    {recipeType === "olahan" ? "Olahan Sendiri" : "Produk Kulakan"}
                  </span>
                </div>

                {/* Basic Details */}
                <div className="space-y-3 font-sans">
                  <div className="grid sm:grid-cols-2 gap-3 font-mono">
                    <div className="space-y-1">
                      <label className="block font-bold text-[#232331]">Nama Produk:</label>
                      <input
                        type="text"
                        required
                        value={recipeName}
                        onChange={(e) => setRecipeName(e.target.value)}
                        placeholder="Contoh: Iced Spanish Latte 16oz"
                        className="w-full rounded-xl border border-[#232331] p-2 text-xs font-bold text-[#232331]"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="block font-bold text-[#232331]">Kategori Menu:</label>
                      <input
                        type="text"
                        value={recipeCategory}
                        onChange={(e) => setRecipeCategory(e.target.value)}
                        placeholder="Contoh: Minuman Kopi / Pastry"
                        className="w-full rounded-xl border border-[#dedee8] p-2 text-xs font-sans text-[#232331]"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 font-mono">
                    <div className="space-y-1">
                      <label className="block font-bold text-[#232331]">Tipe:</label>
                      <select
                        value={recipeType}
                        onChange={(e) => setRecipeType(e.target.value as any)}
                        className="w-full rounded-xl border border-[#dedee8] p-2 text-xs font-bold text-[#232331] bg-white"
                      >
                        <option value="olahan">Olahan</option>
                        <option value="kulakan">Kulakan</option>
                      </select>
                    </div>

                    <div className="space-y-1">
                      <label className="block font-bold text-[#232331]">Hasil Pcs:</label>
                      <input
                        type="number"
                        min={1}
                        value={outputQty}
                        onChange={(e) => setOutputQty(Number(e.target.value))}
                        className="w-full rounded-xl border border-[#dedee8] p-2 text-xs font-bold text-[#232331]"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="block font-bold text-[#232331]">Harga Jual (Rp):</label>
                      <input
                        type="number"
                        step={500}
                        value={sellingPrice}
                        onChange={(e) => setSellingPrice(Number(e.target.value))}
                        className="w-full rounded-xl border border-[#232331] p-2 text-xs font-bold text-[#232331]"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="block font-bold text-[#232331]">Target %:</label>
                      <input
                        type="number"
                        value={targetMarginPct}
                        onChange={(e) => setTargetMarginPct(Number(e.target.value))}
                        className="w-full rounded-xl border border-[#dedee8] p-2 text-xs font-bold text-[#232331]"
                      />
                    </div>
                  </div>
                </div>

                {/* Section: Raw Ingredients List */}
                {recipeType === "olahan" && (
                  <div className="space-y-3 pt-3 border-t border-[#dedee8]">
                    <div className="flex justify-between items-center">
                      <h4 className="font-extrabold text-xs text-[#232331] uppercase tracking-wider font-mono">
                        Bahan Baku Utama ({recipeIngredients.length})
                      </h4>
                      <button
                        type="button"
                        onClick={handleAddIngredientRow}
                        className="btn-tactile text-[11px] font-bold text-[#7958d8] hover:underline"
                      >
                        + Tambah Bahan
                      </button>
                    </div>

                    <div className="space-y-2">
                      {recipeIngredients.map((row, idx) => {
                        const ing = ingredientsMap.get(row.ingredient_id);
                        const unitCost = ing ? (ing.pack_price / ing.pack_size) * row.qty : 0;

                        return (
                          <div key={idx} className="flex items-center gap-2 p-2.5 rounded-2xl border border-[#dedee8] bg-[#fcfcfe]">
                            <div className="flex-1">
                              <select
                                value={row.ingredient_id}
                                onChange={(e) => {
                                  const copy = [...recipeIngredients];
                                  copy[idx].ingredient_id = e.target.value;
                                  setRecipeIngredients(copy);
                                }}
                                className="w-full rounded-lg border border-[#dedee8] p-1.5 text-xs font-bold text-[#232331] bg-white font-sans"
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
                                className="w-14 rounded-lg border border-[#dedee8] p-1.5 text-center text-xs font-bold text-[#232331]"
                              />
                              <span className="text-[11px] text-[#7b7b8e] font-bold">{ing?.base_unit || "gr"}</span>
                            </div>

                            <div className="w-20 text-right font-black text-xs text-[#c2410c] font-mono">
                              {formatRupiah(unitCost)}
                            </div>

                            <button
                              type="button"
                              onClick={() => handleRemoveIngredientRow(idx)}
                              className="text-[#ef4444] hover:text-[#b91c1c] p-1"
                            >
                              <Trash2 size={13} />
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Section: Packaging Separation */}
                <div className="space-y-3 pt-3 border-t border-[#dedee8]">
                  <div className="flex justify-between items-center">
                    <h4 className="font-extrabold text-xs text-[#232331] uppercase tracking-wider font-mono">
                      Packaging &amp; Kemasan ({recipePackaging.length})
                    </h4>
                    <button
                      type="button"
                      onClick={handleAddPackagingRow}
                      className="btn-tactile text-[11px] font-bold text-[#7958d8] hover:underline"
                    >
                      + Tambah Kemasan
                    </button>
                  </div>

                  <div className="space-y-2">
                    {recipePackaging.map((pack, idx) => (
                      <div key={pack.id || idx} className="flex items-center gap-2 p-2.5 rounded-2xl border border-[#dedee8] bg-[#fcfcfe]">
                        <input
                          type="text"
                          value={pack.name}
                          onChange={(e) => {
                            const copy = [...recipePackaging];
                            copy[idx].name = e.target.value;
                            setRecipePackaging(copy);
                          }}
                          placeholder="Nama packaging..."
                          className="flex-1 rounded-lg border border-[#dedee8] p-1.5 text-xs text-[#232331] font-sans"
                        />
                        <div className="w-28 flex items-center gap-1 font-mono">
                          <span className="text-[11px] text-[#7b7b8e]">Rp</span>
                          <input
                            type="number"
                            min={0}
                            step={100}
                            value={pack.cost}
                            onChange={(e) => {
                              const copy = [...recipePackaging];
                              copy[idx].cost = Number(e.target.value);
                              setRecipePackaging(copy);
                            }}
                            className="w-full rounded-lg border border-[#dedee8] p-1.5 text-xs font-bold text-[#232331]"
                          />
                        </div>
                        <button
                          type="button"
                          onClick={() => handleRemovePackagingRow(idx)}
                          className="text-[#ef4444] hover:text-[#b91c1c] p-1"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Section: Operational Overhead */}
                <div className="space-y-1 pt-3 border-t border-[#dedee8] font-mono">
                  <div className="flex justify-between items-center">
                    <label className="font-bold text-[#232331]">Biaya Operasional / Gas / Listrik (Rp):</label>
                    <input
                      type="number"
                      min={0}
                      step={100}
                      value={operationalCost}
                      onChange={(e) => setOperationalCost(Number(e.target.value))}
                      className="w-32 rounded-lg border border-[#dedee8] p-1.5 text-right text-xs font-bold text-[#232331]"
                    />
                  </div>
                </div>

                {/* Submit Save Recipe */}
                <div className="pt-4 border-t border-[#dedee8]">
                  <button
                    type="button"
                    disabled={isPending}
                    onClick={() => handleSaveRecipe()}
                    className="btn-tactile w-full flex items-center justify-center gap-2 rounded-2xl border-2 border-[#232331] bg-[#d9ff57] py-3.5 text-xs font-black text-[#232331] shadow-ink-sm disabled:opacity-50"
                  >
                    <Save size={15} />
                    <span>{isPending ? "Menyimpan..." : "Simpan Resep & Perbarui HPP"}</span>
                  </button>
                </div>

              </div>

            </div>

            {/* Right Column: Live Calculation Card (5 cols) */}
            <div className="lg:col-span-5 space-y-4">
              <div className="sticky top-20 rounded-2xl sm:rounded-3xl border-2 border-[#232331] bg-white p-5 sm:p-6 shadow-ink-lg space-y-4 font-mono text-xs">
                <div className="flex items-center justify-between border-b border-[#dedee8] pb-3">
                  <span className="font-bold text-[#7958d8] uppercase tracking-wider text-[10px]">
                    HASIL KALKULASI REALTIME
                  </span>
                  <Sparkles size={16} className="text-[#7958d8]" />
                </div>

                <div className="space-y-2.5">
                  <div className="flex justify-between text-[#7b7b8e]">
                    <span>Biaya Bahan Baku:</span>
                    <span>{formatRupiah(currentEditorCalc.biaya_bahan)}</span>
                  </div>
                  <div className="flex justify-between text-[#7b7b8e]">
                    <span>Biaya Packaging:</span>
                    <span>{formatRupiah(currentEditorCalc.biaya_kemasan)}</span>
                  </div>
                  <div className="flex justify-between text-[#7b7b8e]">
                    <span>Beban Operasional:</span>
                    <span>{formatRupiah(currentEditorCalc.operational_cost)}</span>
                  </div>

                  <div className="pt-2 border-t border-[#dedee8] flex justify-between items-baseline">
                    <span className="font-extrabold text-sm text-[#232331]">HPP MODAL / UNIT:</span>
                    <span className="text-xl font-black text-[#c2410c]">
                      {formatRupiah(currentEditorCalc.hpp_per_unit)}
                    </span>
                  </div>

                  <div className="flex justify-between items-baseline text-[#16a34a]">
                    <span className="font-bold">PROFIT BERSIH:</span>
                    <span className="text-base font-black">
                      +{formatRupiah(currentEditorCalc.profit_per_unit)}
                    </span>
                  </div>

                  <div className="p-3 rounded-2xl bg-[#f0edff] border border-[#7958d8] space-y-1 text-center">
                    <span className="text-[10px] text-[#7958d8] font-bold block uppercase">MARGIN VS TARGET</span>
                    <div className="text-2xl font-black text-[#7958d8]">
                      {formatMarginPercent(currentEditorCalc.margin_pct)}
                    </div>
                    <span className="text-[10.5px] text-[#7b7b8e]">
                      Markup: {Math.round(currentEditorCalc.markup_pct)}% · Target: {targetMarginPct}%
                    </span>
                  </div>

                  {/* Recommendation Rp 500 */}
                  <div className="p-3 rounded-2xl bg-[#dcfce7] border border-[#16a34a] space-y-1">
                    <span className="text-[10px] font-bold text-[#16a34a] uppercase block">
                      Rekomendasi Harga Jual (Target {targetMarginPct}%):
                    </span>
                    <span className="text-lg font-black text-[#16a34a] block font-mono">
                      {formatRupiah(currentEditorCalc.recommended_price_target_margin)}
                    </span>
                    <span className="text-[10px] text-[#7b7b8e] block">
                      Dibulatkan rapi ke kelipatan Rp 500 untuk kenyamanan kasir.
                    </span>
                  </div>
                </div>

              </div>
            </div>

          </div>
        )}

        {/* ============================================================= */}
        {/* TAB 3: SIMULASI TARGET PROFIT */}
        {/* ============================================================= */}
        {activeTab === "simulation" && activeSimRecipe && simResult && (
          <div className="max-w-3xl mx-auto rounded-2xl sm:rounded-3xl border-2 border-[#232331] bg-white p-5 sm:p-8 shadow-ink-md space-y-6 font-mono text-xs">
            <div className="border-b border-[#dedee8] pb-4">
              <h3 className="font-extrabold text-base sm:text-lg text-[#232331] font-sans">
                Simulator Target Profit &amp; Rekomendasi Harga Jual
              </h3>
              <p className="text-[11px] sm:text-xs text-[#7b7b8e] font-sans">
                Tentukan target keuntungan bersih yang Anda inginkan, sistem akan menghitung harga jual optimal secara otomatis.
              </p>
            </div>

            <div className="space-y-4 font-sans text-xs">
              <div className="space-y-1 font-mono">
                <label className="block font-bold text-[#232331]">Pilih Produk Resep:</label>
                <select
                  value={simSelectedRecipeId}
                  onChange={(e) => setSimSelectedRecipeId(e.target.value)}
                  className="w-full rounded-xl border-2 border-[#232331] p-2.5 text-xs font-bold text-[#232331] bg-white"
                >
                  {recipes.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.name} (HPP Modal: {formatRupiah(recipesWithCalc.find((rc) => rc.recipe.id === r.id)?.calculation.hpp_per_unit || 0)})
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid sm:grid-cols-2 gap-4 font-mono">
                <div className="space-y-1">
                  <label className="block font-bold text-[#232331]">Target Laba Bersih Nominal (Rp):</label>
                  <input
                    type="number"
                    step={1000}
                    value={simTargetProfitNominal}
                    onChange={(e) => setSimTargetProfitNominal(Number(e.target.value))}
                    className="w-full rounded-xl border border-[#dedee8] p-2.5 text-sm font-bold text-[#232331]"
                  />
                </div>

                <div className="space-y-1">
                  <label className="block font-bold text-[#232331]">Target Margin Persentase (%):</label>
                  <input
                    type="number"
                    value={simTargetMarginPct}
                    onChange={(e) => setSimTargetMarginPct(Number(e.target.value))}
                    className="w-full rounded-xl border border-[#dedee8] p-2.5 text-sm font-bold text-[#232331]"
                  />
                </div>
              </div>

              {/* Result Grid */}
              <div className="grid sm:grid-cols-2 gap-4 pt-4 border-t border-[#dedee8] font-mono">
                <div className="p-4 rounded-2xl bg-[#f0edff] border border-[#7958d8] space-y-1 text-center">
                  <span className="text-[10.5px] text-[#7958d8] font-bold block uppercase">
                    Harga Jual Target Nominal (+{formatRupiah(simTargetProfitNominal)})
                  </span>
                  <div className="text-2xl font-black text-[#7958d8]">
                    {formatRupiah(simResult.priceFromNominal)}
                  </div>
                  <span className="text-[10px] text-[#7b7b8e]">
                    Margin riil: {formatMarginPercent(simResult.actualMarginFromNominal)}
                  </span>
                </div>

                <div className="p-4 rounded-2xl bg-[#dcfce7] border border-[#16a34a] space-y-1 text-center">
                  <span className="text-[10.5px] text-[#16a34a] font-bold block uppercase">
                    Harga Jual Target Margin ({simTargetMarginPct}%)
                  </span>
                  <div className="text-2xl font-black text-[#16a34a]">
                    {formatRupiah(simResult.priceFromMargin)}
                  </div>
                  <span className="text-[10px] text-[#7b7b8e]">
                    Profit riil: +{formatRupiah(simResult.actualProfitFromMargin)}
                  </span>
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
                <h3 className="font-extrabold text-sm sm:text-base text-[#232331]">
                  Master Harga Bahan Baku &amp; Living Ingredients
                </h3>
                <p className="text-[11px] sm:text-xs text-[#7b7b8e]">
                  Ubah harga beli bahan di sini, seluruh resep yang memakai bahan tersebut akan otomatis terhitung ulang secara instan.
                </p>
              </div>

              <button
                type="button"
                onClick={() => setShowAddIngredient(true)}
                className="btn-tactile flex items-center gap-1.5 rounded-xl border-2 border-[#232331] bg-[#d9ff57] px-3.5 py-1.5 font-mono text-xs font-black text-[#232331] shadow-ink-xs"
              >
                <Plus size={13} />
                <span>+ Tambah Bahan</span>
              </button>
            </div>

            {/* Ingredients Table */}
            <div className="rounded-2xl sm:rounded-3xl border-2 border-[#232331] bg-white shadow-ink-md overflow-hidden font-mono text-xs">
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead>
                    <tr className="border-b border-[#dedee8] bg-[#fcfcfe] text-[#7b7b8e] text-[10px] uppercase">
                      <th className="py-3 px-4">Nama Bahan</th>
                      <th className="py-3 px-4">Harga Kemasan</th>
                      <th className="py-3 px-4">Ukuran Kemasan</th>
                      <th className="py-3 px-4">Harga / Satuan</th>
                      <th className="py-3 px-4">Terakhir Diubah</th>
                      <th className="py-3 px-4 text-right">Aksi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#dedee8]">
                    {ingredients.map((ing) => {
                      const costPerBaseUnit = Number(ing.pack_price) / Number(ing.pack_size);
                      return (
                        <tr key={ing.id} className="hover:bg-[#fcfcfe]">
                          <td className="py-3 px-4 font-bold text-[#232331] font-sans">
                            {ing.name}
                          </td>
                          <td className="py-3 px-4 font-black text-[#c2410c]">
                            {formatRupiah(Number(ing.pack_price))}
                          </td>
                          <td className="py-3 px-4 text-[#7b7b8e]">
                            {ing.pack_size} {ing.base_unit}
                          </td>
                          <td className="py-3 px-4 font-bold text-[#7958d8]">
                            Rp {costPerBaseUnit.toFixed(1)} / {ing.base_unit}
                          </td>
                          <td className="py-3 px-4 text-[10.5px] text-[#7b7b8e]">
                            {formatBusinessDateTime(ing.updated_at)}
                          </td>
                          <td className="py-3 px-4 text-right space-x-1.5 whitespace-nowrap">
                            <button
                              type="button"
                              onClick={() => {
                                setEditingIngredient(ing);
                                setNewPackPriceInput(Number(ing.pack_price));
                              }}
                              className="btn-tactile rounded-lg border border-[#232331] bg-[#f0edff] px-2.5 py-1 text-[11px] font-bold text-[#7958d8]"
                            >
                              Update Harga
                            </button>
                            <button
                              type="button"
                              onClick={() => setHistoryDrawerIng(ing)}
                              className="btn-tactile rounded-lg border border-[#dedee8] bg-white px-2 py-1 text-[11px] text-[#7b7b8e] hover:text-[#232331]"
                              title="Lihat Histori Harga"
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

          </div>
        )}

      </main>

      {/* MODAL: UPDATE INGREDIENT PRICE */}
      {editingIngredient && (
        <div className="fixed inset-0 z-50 bg-[#232331]/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="w-full max-w-md rounded-3xl border-2 border-[#232331] bg-white p-6 shadow-ink-lg space-y-4 animate-in zoom-in-95 font-mono text-xs">
            <div className="flex items-center justify-between border-b border-[#dedee8] pb-3">
              <h3 className="font-extrabold text-base text-[#232331] font-sans">
                Update Harga Bahan Baku
              </h3>
              <button
                type="button"
                onClick={() => setEditingIngredient(null)}
                className="text-[#7b7b8e] hover:text-[#232331] font-bold p-1"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleUpdateIngredientPrice} className="space-y-3 font-sans">
              <div className="space-y-1 font-mono">
                <span className="text-[11px] text-[#7958d8] font-bold block uppercase">{editingIngredient.name}</span>
                <span className="text-xs text-[#7b7b8e] block">
                  Ukuran kemasan: {editingIngredient.pack_size} {editingIngredient.base_unit}
                </span>
              </div>

              <div className="space-y-1 font-mono">
                <label className="block font-bold text-[#232331]">Harga Kemasan Baru (Rp):</label>
                <input
                  type="number"
                  required
                  min={100}
                  step={500}
                  value={newPackPriceInput}
                  onChange={(e) => setNewPackPriceInput(Number(e.target.value))}
                  className="w-full rounded-xl border-2 border-[#232331] p-2.5 text-base font-black text-[#c2410c]"
                  autoFocus
                />
              </div>

              <p className="text-[10.5px] text-[#7b7b8e] leading-relaxed">
                ⚡ Semua resep yang menggunakan bahan ini akan otomatis menghitung ulang HPP modal dan margin labanya secara instan.
              </p>

              <div className="flex justify-end gap-2 pt-2 border-t border-[#dedee8] font-mono">
                <button
                  type="button"
                  onClick={() => setEditingIngredient(null)}
                  className="rounded-xl border border-[#dedee8] bg-white px-3 py-2 font-bold text-[#7b7b8e]"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isPending}
                  className="btn-tactile rounded-xl bg-[#232331] px-5 py-2 font-black text-[#d9ff57] shadow-ink-xs disabled:opacity-50"
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
        <div className="fixed inset-0 z-50 bg-[#232331]/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="w-full max-w-md rounded-3xl border-2 border-[#232331] bg-white p-6 shadow-ink-lg space-y-4 animate-in zoom-in-95 font-mono text-xs">
            <div className="flex items-center justify-between border-b border-[#dedee8] pb-3">
              <h3 className="font-extrabold text-base text-[#232331] font-sans">
                Tambah Bahan Baku Baru
              </h3>
              <button
                type="button"
                onClick={() => setShowAddIngredient(false)}
                className="text-[#7b7b8e] hover:text-[#232331] font-bold p-1"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateIngredient} className="space-y-3 font-sans">
              <div className="space-y-1 font-mono">
                <label className="block font-bold text-[#232331]">Nama Bahan Baku:</label>
                <input
                  type="text"
                  required
                  placeholder="Misal: Sirup Hazelnut Monin"
                  value={newIngName}
                  onChange={(e) => setNewIngName(e.target.value)}
                  className="w-full rounded-xl border border-[#232331] p-2 text-xs font-bold text-[#232331]"
                />
              </div>

              <div className="grid grid-cols-2 gap-2 font-mono">
                <div className="space-y-1">
                  <label className="block font-bold text-[#232331]">Harga Beli (Rp):</label>
                  <input
                    type="number"
                    required
                    min={100}
                    step={500}
                    value={newIngPrice}
                    onChange={(e) => setNewIngPrice(Number(e.target.value))}
                    className="w-full rounded-xl border border-[#dedee8] p-2 text-xs font-bold text-[#232331]"
                  />
                </div>

                <div className="space-y-1">
                  <label className="block font-bold text-[#232331]">Isi Kemasan:</label>
                  <div className="flex gap-1">
                    <input
                      type="number"
                      required
                      min={1}
                      value={newIngSize}
                      onChange={(e) => setNewIngSize(Number(e.target.value))}
                      className="w-full rounded-xl border border-[#dedee8] p-2 text-xs font-bold text-[#232331]"
                    />
                    <select
                      value={newIngUnit}
                      onChange={(e) => setNewIngUnit(e.target.value as any)}
                      className="rounded-xl border border-[#dedee8] p-2 text-xs font-bold text-[#232331] bg-white"
                    >
                      <option value="gr">gr</option>
                      <option value="ml">ml</option>
                      <option value="pcs">pcs</option>
                    </select>
                  </div>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-[#dedee8] font-mono">
                <button
                  type="button"
                  onClick={() => setShowAddIngredient(false)}
                  className="rounded-xl border border-[#dedee8] bg-white px-3 py-2 font-bold text-[#7b7b8e]"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isPending}
                  className="btn-tactile rounded-xl bg-[#232331] px-5 py-2 font-black text-[#d9ff57] shadow-ink-xs disabled:opacity-50"
                >
                  Tambah Bahan ✓
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* DRAWER: PRICE HISTORY */}
      {historyDrawerIng && (
        <div className="fixed inset-0 z-50 bg-[#232331]/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="w-full max-w-md rounded-3xl border-2 border-[#232331] bg-white p-6 shadow-ink-lg space-y-4 animate-in zoom-in-95 font-mono text-xs">
            <div className="flex items-center justify-between border-b border-[#dedee8] pb-3">
              <div className="flex items-center gap-2">
                <History size={16} className="text-[#7958d8]" />
                <h3 className="font-extrabold text-base text-[#232331] font-sans">
                  Histori Fluktuasi Harga
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
                {priceHistoryList.length === 0 ? (
                  <p className="text-[#7b7b8e] text-center py-4">Belum ada catatan perubahan harga.</p>
                ) : (
                  priceHistoryList.map((h) => (
                    <div key={h.id} className="flex justify-between items-center p-2.5 rounded-xl border border-[#dedee8] bg-[#fcfcfe]">
                      <span className="font-black text-sm text-[#232331]">{formatRupiah(Number(h.pack_price))}</span>
                      <span className="text-[10.5px] text-[#7b7b8e]">{formatBusinessDateTime(h.changed_at)}</span>
                    </div>
                  ))
                )}
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
        KAEL HPP &amp; Finance Engine · Pure Computation &amp; Living Ingredient Cascade
      </footer>

    </div>
  );
}
