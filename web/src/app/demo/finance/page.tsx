"use client";

import { useState } from "react";
import Link from "next/link";
import { 
  AlertCircle, 
  ArrowLeft, 
  ArrowRight, 
  Calculator, 
  Check, 
  Coins, 
  Copy, 
  DollarSign, 
  Download, 
  FileSpreadsheet, 
  Flame, 
  HelpCircle, 
  Layers, 
  Percent, 
  PieChart, 
  Plus, 
  Printer, 
  RotateCcw, 
  Save, 
  Sparkles, 
  Target, 
  Trash2, 
  TrendingUp, 
  Zap 
} from "lucide-react";
import { DemoNavbar } from "@/components/demo-navbar";
import { DEMO_BRANDS, DemoBrand } from "@/lib/demo-config";

interface Ingredient {
  id: string;
  name: string;
  packPrice: number;
  packSize: number;
  unit: "gr" | "ml" | "pcs" | "kg" | "liter";
  usedQty: number;
}

interface PackagingItem {
  id: string;
  name: string;
  cost: number;
}

const RECIPE_PRESETS = [
  {
    id: "preset-latte",
    name: "Iced Spanish Latte (16oz)",
    category: "Coffee & Beverage",
    targetPrice: 28000,
    dailyTarget: 45,
    overhead: 1200,
    ingredients: [
      { id: "i1", name: "Biji Kopi House Blend (Espresso)", packPrice: 130000, packSize: 1000, unit: "gr" as const, usedQty: 18 },
      { id: "i2", name: "Fresh Milk Pasteurisasi", packPrice: 24000, packSize: 1000, unit: "ml" as const, usedQty: 120 },
      { id: "i3", name: "Condensed Milk / SKM Kental", packPrice: 16000, packSize: 500, unit: "gr" as const, usedQty: 30 },
      { id: "i4", name: "Es Batu Kristal Higienis", packPrice: 15000, packSize: 10000, unit: "gr" as const, usedQty: 150 },
    ],
    packaging: [
      { id: "p1", name: "Cup Injection 16oz + Sablon Logo", cost: 950 },
      { id: "p2", name: "Tutup Strawless Lid", cost: 250 },
      { id: "p3", name: "Sedotan & Tissue", cost: 150 },
      { id: "p4", name: "Paper Bag / Kantong Takeaway", cost: 350 },
    ],
  },
  {
    id: "preset-croissant",
    name: "Artisan Butter Croissant",
    category: "Bakery & Pastry",
    targetPrice: 24000,
    dailyTarget: 30,
    overhead: 1800,
    ingredients: [
      { id: "i1", name: "Tepung Terigu Protein Tinggi", packPrice: 14000, packSize: 1000, unit: "gr" as const, usedQty: 75 },
      { id: "i2", name: "French Unsalted Butter Sheet", packPrice: 95000, packSize: 500, unit: "gr" as const, usedQty: 45 },
      { id: "i3", name: "Gula Pasir & Ragi Instant", packPrice: 18000, packSize: 1000, unit: "gr" as const, usedQty: 15 },
      { id: "i4", name: "Telur Ayam Fresh (Egg Wash)", packPrice: 28000, packSize: 1000, unit: "gr" as const, usedQty: 12 },
    ],
    packaging: [
      { id: "p1", name: "Pastry Box Kraft dengan Jendela", cost: 1200 },
      { id: "p2", name: "Wax Greaseproof Paper", cost: 200 },
      { id: "p3", name: "Stiker Segel Brand Toko", cost: 150 },
    ],
  },
  {
    id: "preset-bakso",
    name: "Bakso Sapi Urat Komplit",
    category: "Food & Resto",
    targetPrice: 35000,
    dailyTarget: 60,
    overhead: 2500,
    ingredients: [
      { id: "i1", name: "Daging Sapi Segar & Urat", packPrice: 135000, packSize: 1000, unit: "gr" as const, usedQty: 120 },
      { id: "i2", name: "Tepung Tapioka & Bumbu Rempah", packPrice: 15000, packSize: 1000, unit: "gr" as const, usedQty: 30 },
      { id: "i3", name: "Mie Kuning & Bihun Porsi", packPrice: 20000, packSize: 1000, unit: "gr" as const, usedQty: 60 },
      { id: "i4", name: "Kuah Kaldu Sumsum Sapi & Bawang Goreng", packPrice: 35000, packSize: 5000, unit: "ml" as const, usedQty: 350 },
    ],
    packaging: [
      { id: "p1", name: "Paper Bowl Tahan Panas 650ml", cost: 1400 },
      { id: "p2", name: "Tutup Paper Bowl + Sendok Garpu", cost: 500 },
      { id: "p3", name: "Plastik Sambal & Kantong Kresek", cost: 300 },
    ],
  },
];

export default function DemoFinancePage() {
  const [currentBrand, setCurrentBrand] = useState<DemoBrand>(DEMO_BRANDS[0]);
  const [showWhiteLabelBadge, setShowWhiteLabelBadge] = useState<boolean>(true);
  const [calcMode, setCalcMode] = useState<"recipe" | "supplier">("recipe");

  // ==========================================
  // 1. RECIPE MODE STATE
  // ==========================================
  const [productName, setProductName] = useState<string>(RECIPE_PRESETS[0].name);
  const [targetSellingPrice, setTargetSellingPrice] = useState<number>(RECIPE_PRESETS[0].targetPrice);
  const [dailySalesTarget, setDailySalesTarget] = useState<number>(RECIPE_PRESETS[0].dailyTarget);
  const [overheadPerPortion, setOverheadPerPortion] = useState<number>(RECIPE_PRESETS[0].overhead);
  const [ingredients, setIngredients] = useState<Ingredient[]>(RECIPE_PRESETS[0].ingredients);
  const [packagingCosts, setPackagingCosts] = useState<PackagingItem[]>(RECIPE_PRESETS[0].packaging);

  // Fixed Monthly Operating Costs (For BEP Break-Even Calculation)
  const [rentAndUtilities, setRentAndUtilities] = useState<number>(6000000); // 6 Jt sewa + listrik
  const [staffSalaries, setStaffSalaries] = useState<number>(7500000); // 7.5 Jt gaji staf

  // ==========================================
  // 2. SUPPLIER / RESELLER MODE STATE
  // ==========================================
  const [supplierProductName, setSupplierProductName] = useState<string>("Frozen Pastry Box (Grosir)");
  const [boxBuyPrice, setBoxBuyPrice] = useState<number>(180000);
  const [boxQty, setBoxQty] = useState<number>(12);
  const [shippingPerBox, setShippingPerBox] = useState<number>(24000);
  const [supplierPackaging, setSupplierPackaging] = useState<number>(1200);
  const [supplierSellingPrice, setSupplierSellingPrice] = useState<number>(24000);
  const [supplierDailyTarget, setSupplierDailyTarget] = useState<number>(25);

  // ==========================================
  // INGREDIENT HANDLERS (FULL WORKING CRUD)
  // ==========================================
  const handleAddIngredient = () => {
    const newId = `i-${Date.now()}`;
    setIngredients((prev) => [
      ...prev,
      { id: newId, name: "Bahan Baku Baru", packPrice: 20000, packSize: 1000, unit: "gr", usedQty: 50 },
    ]);
  };

  const handleUpdateIngredient = (id: string, field: keyof Ingredient, value: any) => {
    setIngredients((prev) =>
      prev.map((item) => (item.id === id ? { ...item, [field]: value } : item))
    );
  };

  const handleDeleteIngredient = (id: string) => {
    if (ingredients.length <= 1) {
      alert("Resep minimal harus memiliki 1 bahan baku!");
      return;
    }
    setIngredients((prev) => prev.filter((item) => item.id !== id));
  };

  // Packaging Handlers
  const handleAddPackaging = () => {
    const newId = `p-${Date.now()}`;
    setPackagingCosts((prev) => [...prev, { id: newId, name: "Kemasan / Stiker Baru", cost: 250 }]);
  };

  const handleUpdatePackaging = (id: string, field: keyof PackagingItem, value: any) => {
    setPackagingCosts((prev) =>
      prev.map((item) => (item.id === id ? { ...item, [field]: value } : item))
    );
  };

  const handleDeletePackaging = (id: string) => {
    setPackagingCosts((prev) => prev.filter((item) => item.id !== id));
  };

  const loadPreset = (preset: typeof RECIPE_PRESETS[0]) => {
    setProductName(preset.name);
    setTargetSellingPrice(preset.targetPrice);
    setDailySalesTarget(preset.dailyTarget);
    setOverheadPerPortion(preset.overhead);
    setIngredients(preset.ingredients);
    setPackagingCosts(preset.packaging);
  };

  // ==========================================
  // REAL-TIME MATHEMATICAL ENGINE
  // ==========================================
  const calculateItemCost = (ing: Ingredient) => {
    const divisor = ing.packSize <= 0 ? 1 : ing.packSize;
    return (ing.packPrice / divisor) * ing.usedQty;
  };

  const rawCost = ingredients.reduce((acc, curr) => acc + calculateItemCost(curr), 0);
  const packCost = packagingCosts.reduce((acc, curr) => acc + Number(curr.cost || 0), 0);
  const totalHppRecipe = Math.round(rawCost + packCost + Number(overheadPerPortion || 0));
  
  const profitPerPortion = targetSellingPrice - totalHppRecipe;
  const marginPercent = targetSellingPrice > 0 ? Math.round((profitPerPortion / targetSellingPrice) * 100) : 0;
  const markupPercent = totalHppRecipe > 0 ? Math.round((profitPerPortion / totalHppRecipe) * 100) : 0;

  // Monthly Estimates
  const monthlyPortions = dailySalesTarget * 30;
  const monthlyRevenue = targetSellingPrice * monthlyPortions;
  const monthlyHppTotal = totalHppRecipe * monthlyPortions;
  const monthlyGrossProfit = monthlyRevenue - monthlyHppTotal;
  
  // Fixed Cost & BEP Break-Even Point
  const totalFixedCosts = Number(rentAndUtilities) + Number(staffSalaries);
  const monthlyNetProfit = monthlyGrossProfit - totalFixedCosts;
  const bepPortionsMonthly = profitPerPortion > 0 ? Math.ceil(totalFixedCosts / profitPerPortion) : 0;
  const bepPortionsDaily = Math.ceil(bepPortionsMonthly / 30);

  // Supplier Calculations
  const qtySafe = boxQty <= 0 ? 1 : boxQty;
  const buyCostPerPcs = Math.round(boxBuyPrice / qtySafe);
  const shippingPerPcs = Math.round(shippingPerBox / qtySafe);
  const totalHppSupplier = buyCostPerPcs + shippingPerPcs + Number(supplierPackaging || 0);
  const profitSupplier = supplierSellingPrice - totalHppSupplier;
  const marginSupplierPercent = supplierSellingPrice > 0 ? Math.round((profitSupplier / supplierSellingPrice) * 100) : 0;
  const supplierMonthlyPortions = supplierDailyTarget * 30;
  const supplierMonthlyGross = profitSupplier * supplierMonthlyPortions;

  return (
    <div className="min-h-screen bg-[#fcfcfe] text-[#232331] flex flex-col">
      <DemoNavbar
        currentBrand={currentBrand}
        onBrandChange={setCurrentBrand}
        showWhiteLabelBadge={showWhiteLabelBadge}
        onToggleWhiteLabelBadge={setShowWhiteLabelBadge}
      />

      <main className="flex-1 max-w-7xl mx-auto px-3 sm:px-6 py-4 sm:py-8 w-full">
        
        {/* Header Bar */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-[#dedee8] pb-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="flex h-6 w-6 items-center justify-center rounded-md bg-[#c2410c] text-white font-mono text-[10px] font-bold">
                03
              </span>
              <h1 className="text-lg sm:text-2xl font-extrabold text-[#232331]">
                KAEL Finance Live Engine (Kalkulator HPP Penuh)
              </h1>
            </div>
            <p className="text-xs text-[#7b7b8e] mt-0.5">
              Input bebas gramasi bahan baku, biaya packaging, hitung margin laba riil, dan simulasi BEP balik modal.
            </p>
          </div>

          {/* Actions & Mode Selector */}
          <div className="flex flex-wrap items-center gap-2">
            <Link
              href="/app/finance"
              className="btn-tactile flex items-center gap-1.5 rounded-xl border border-[#c2410c] bg-[#ffedd5] px-3 py-1.5 text-xs font-bold text-[#c2410c] shadow-ink-xs hover:bg-[#fed7aa]"
            >
              <Calculator size={13} />
              <span>Owner Command Center ➔</span>
            </Link>

            <div className="flex items-center rounded-2xl border-2 border-[#232331] bg-white p-1 shadow-ink-xs font-mono text-xs">
              <button
                type="button"
                onClick={() => setCalcMode("recipe")}
                className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl font-bold transition-all ${
                  calcMode === "recipe"
                    ? "bg-[#232331] text-[#d9ff57] shadow-ink-xs"
                    : "text-[#7b7b8e] hover:text-[#232331]"
                }`}
              >
                <Calculator size={14} />
                <span>1. Resep Olahan</span>
              </button>
              <button
                type="button"
                onClick={() => setCalcMode("supplier")}
                className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl font-bold transition-all ${
                  calcMode === "supplier"
                    ? "bg-[#232331] text-[#d9ff57] shadow-ink-xs"
                    : "text-[#7b7b8e] hover:text-[#232331]"
                }`}
              >
                <Layers size={14} />
                <span>2. Kulakan / Supplier</span>
              </button>
            </div>
          </div>
        </div>

        {/* ========================================================= */}
        {/* MODE 1: RECIPE PRODUCTION (LIVE SPREADSHEET ENGINE) */}
        {/* ========================================================= */}
        {calcMode === "recipe" && (
          <div className="mt-6 space-y-6">
            
            {/* Quick Preset Selector Bar */}
            <div className="rounded-2xl border border-[#dedee8] bg-white p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-ink-xs">
              <div className="flex items-center gap-2">
                <Sparkles size={14} className="text-[#7958d8]" />
                <span className="font-mono text-xs font-bold text-[#232331]">
                  Pilih Preset Resep Cepat:
                </span>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {RECIPE_PRESETS.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => loadPreset(p)}
                    className={`btn-tactile px-3 py-1.5 rounded-xl text-xs font-bold border transition-all ${
                      productName === p.name
                        ? "bg-[#232331] text-[#d9ff57] border-[#232331]"
                        : "bg-[#fcfcfe] text-[#232331] border-[#dedee8] hover:bg-[#f0edff]"
                    }`}
                  >
                    {p.name}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid gap-6 lg:grid-cols-12 items-start">
              
              {/* Left Column: Interactive Ingredient & Packaging Tables */}
              <div className="lg:col-span-7 min-w-0 space-y-6">
                
                {/* 1. Recipe & Ingredients Table Card */}
                <div className="rounded-3xl border-2 border-[#232331] bg-white p-4 sm:p-6 shadow-ink-md">
                  
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-[#dedee8] pb-3">
                    <div className="flex-1">
                      <label className="text-[10px] font-mono font-bold text-[#7958d8] uppercase block">
                        NAMA MENU / PRODUK:
                      </label>
                      <input
                        type="text"
                        value={productName}
                        onChange={(e) => setProductName(e.target.value)}
                        className="mt-0.5 w-full rounded-xl border border-[#232331] px-3 py-1.5 text-sm font-extrabold text-[#232331] focus:outline-none focus:ring-2 focus:ring-[#7958d8]"
                      />
                    </div>
                  </div>

                  {/* Ingredients Table */}
                  <div className="mt-4">
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-extrabold text-xs text-[#232331]">
                        1. Bahan Baku Resep (Raw Ingredients)
                      </span>
                      <span className="font-mono text-xs font-extrabold text-[#7958d8]">
                        Subtotal: Rp {Math.round(rawCost).toLocaleString("id-ID")}
                      </span>
                    </div>

                    <div className="overflow-x-auto">
                      <table className="w-full text-left font-mono text-xs">
                        <thead>
                          <tr className="border-b border-[#dedee8] text-[#7b7b8e] text-[9.5px] uppercase">
                            <th className="py-2 px-2">Nama Bahan</th>
                            <th className="py-2 px-2">Harga Beli Kemasan</th>
                            <th className="py-2 px-2">Isi Kemasan</th>
                            <th className="py-2 px-2">Pakai / Porsi</th>
                            <th className="py-2 px-2 text-right">Biaya Riil</th>
                            <th className="py-2 px-1 text-center">Hapus</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-[#dedee8]">
                          {ingredients.map((ing) => {
                            const cost = Math.round(calculateItemCost(ing));
                            return (
                              <tr key={ing.id} className="hover:bg-[#fcfcfe]">
                                <td className="py-2 px-2 font-sans font-bold text-[#232331] min-w-[120px]">
                                  <input
                                    type="text"
                                    value={ing.name}
                                    onChange={(e) => handleUpdateIngredient(ing.id, "name", e.target.value)}
                                    className="w-full rounded-lg border border-transparent hover:border-[#dedee8] focus:border-[#232331] px-1.5 py-0.5 text-xs font-bold"
                                  />
                                </td>
                                <td className="py-2 px-2 min-w-[100px]">
                                  <div className="flex items-center gap-0.5">
                                    <span className="text-[10px] text-[#7b7b8e]">Rp</span>
                                    <input
                                      type="number"
                                      value={ing.packPrice}
                                      onChange={(e) => handleUpdateIngredient(ing.id, "packPrice", Number(e.target.value))}
                                      className="w-full rounded-lg border border-gray-200 px-1.5 py-0.5 text-xs font-bold"
                                    />
                                  </div>
                                </td>
                                <td className="py-2 px-2 min-w-[85px]">
                                  <div className="flex items-center gap-1">
                                    <input
                                      type="number"
                                      value={ing.packSize}
                                      onChange={(e) => handleUpdateIngredient(ing.id, "packSize", Number(e.target.value))}
                                      className="w-14 rounded-lg border border-gray-200 px-1.5 py-0.5 text-xs"
                                    />
                                    <span className="text-[10px] text-[#7b7b8e]">{ing.unit}</span>
                                  </div>
                                </td>
                                <td className="py-2 px-2 min-w-[85px]">
                                  <div className="flex items-center gap-1">
                                    <input
                                      type="number"
                                      value={ing.usedQty}
                                      onChange={(e) => handleUpdateIngredient(ing.id, "usedQty", Number(e.target.value))}
                                      className="w-14 rounded-lg border border-[#7958d8] bg-[#f0edff] text-[#7958d8] font-bold px-1.5 py-0.5 text-xs"
                                    />
                                    <span className="text-[10px] text-[#7958d8] font-bold">{ing.unit}</span>
                                  </div>
                                </td>
                                <td className="py-2 px-2 text-right font-extrabold text-[#232331]">
                                  Rp {cost.toLocaleString("id-ID")}
                                </td>
                                <td className="py-2 px-1 text-center">
                                  <button
                                    type="button"
                                    onClick={() => handleDeleteIngredient(ing.id)}
                                    className="text-[#ef4444] hover:bg-[#feebee] p-1 rounded-md"
                                    title="Hapus baris bahan"
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

                    <button
                      type="button"
                      onClick={handleAddIngredient}
                      className="btn-tactile mt-3 inline-flex items-center gap-1.5 rounded-xl border border-[#232331] bg-[#f0edff] px-3 py-1.5 text-xs font-bold text-[#7958d8] hover:bg-[#e6dfff]"
                    >
                      <Plus size={13} />
                      <span>+ Tambah Bahan Baku Baru</span>
                    </button>
                  </div>

                  {/* 2. Packaging & Utilities Table */}
                  <div className="mt-6 border-t border-[#dedee8] pt-4">
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-extrabold text-xs text-[#232331]">
                        2. Kemasan &amp; Biaya Tambahan (Packaging &amp; Overhead)
                      </span>
                      <span className="font-mono text-xs font-extrabold text-[#7958d8]">
                        Subtotal: Rp {(packCost + Number(overheadPerPortion || 0)).toLocaleString("id-ID")}
                      </span>
                    </div>

                    <div className="grid gap-2 sm:grid-cols-2">
                      {packagingCosts.map((pkg) => (
                        <div key={pkg.id} className="flex items-center justify-between rounded-xl bg-[#fcfcfe] border border-[#dedee8] p-2 text-xs font-mono">
                          <input
                            type="text"
                            value={pkg.name}
                            onChange={(e) => handleUpdatePackaging(pkg.id, "name", e.target.value)}
                            className="flex-1 font-sans text-xs font-bold bg-transparent focus:outline-none pr-1 truncate"
                          />
                          <div className="flex items-center gap-1">
                            <span className="text-[10px] text-[#7b7b8e]">Rp</span>
                            <input
                              type="number"
                              value={pkg.cost}
                              onChange={(e) => handleUpdatePackaging(pkg.id, "cost", Number(e.target.value))}
                              className="w-16 rounded-md border border-gray-200 px-1 py-0.5 text-xs font-bold text-right"
                            />
                            <button
                              type="button"
                              onClick={() => handleDeletePackaging(pkg.id)}
                              className="text-[#ef4444] hover:bg-red-50 p-0.5 rounded"
                            >
                              <Trash2 size={11} />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>

                    <div className="mt-3 flex flex-wrap items-center justify-between gap-3 pt-2">
                      <button
                        type="button"
                        onClick={handleAddPackaging}
                        className="btn-tactile inline-flex items-center gap-1 rounded-lg border border-[#dedee8] bg-white px-2.5 py-1 text-[11px] font-bold text-[#232331]"
                      >
                        <Plus size={11} />
                        <span>Tambah Item Kemasan</span>
                      </button>

                      <div className="flex items-center gap-2 font-mono text-xs">
                        <span className="text-[11px] font-bold text-[#7b7b8e]">Biaya Listrik/Gas/Staf per Porsi:</span>
                        <div className="flex items-center gap-0.5">
                          <span className="text-[10px] text-[#7b7b8e]">Rp</span>
                          <input
                            type="number"
                            value={overheadPerPortion}
                            onChange={(e) => setOverheadPerPortion(Number(e.target.value))}
                            className="w-20 rounded-lg border border-[#232331] px-2 py-0.5 text-xs font-extrabold text-right"
                          />
                        </div>
                      </div>
                    </div>

                  </div>

                </div>

              </div>

              {/* Right Column: Pricing & Margin Assistant + BEP Breakdown */}
              <div className="lg:col-span-5 min-w-0 space-y-6">
                
                {/* Result Card */}
                <div className="rounded-3xl border-2 border-[#232331] bg-white p-5 sm:p-6 shadow-ink-md">
                  
                  <span className="font-mono text-[10px] font-bold text-[#7958d8] uppercase tracking-wider block">
                    RINGKASAN TOTAL HPP &amp; MARGIN
                  </span>

                  <div className="mt-3 grid grid-cols-2 gap-3 font-mono">
                    <div className="rounded-2xl border-2 border-[#232331] bg-[#f0edff] p-3 text-center">
                      <span className="text-[10px] text-[#7b7b8e] uppercase block">TOTAL HPP / PORSI</span>
                      <span className="text-xl sm:text-2xl font-extrabold text-[#232331] mt-0.5 block">
                        Rp {totalHppRecipe.toLocaleString("id-ID")}
                      </span>
                      <span className="text-[9.5px] text-[#7958d8] mt-0.5 block">
                        Bahan + Kemasan + Overhead
                      </span>
                    </div>

                    <div className="rounded-2xl border-2 border-[#232331] bg-[#d9ff57] p-3 text-center">
                      <span className="text-[10px] text-[#232331] uppercase block font-bold">LABA BERSIH / PORSI</span>
                      <span className="text-xl sm:text-2xl font-extrabold text-[#232331] mt-0.5 block">
                        {profitPerPortion >= 0 ? `+Rp ${profitPerPortion.toLocaleString("id-ID")}` : `-Rp ${Math.abs(profitPerPortion).toLocaleString("id-ID")}`}
                      </span>
                      <span className="text-[9.5px] text-[#232331] font-bold mt-0.5 block">
                        Margin: {marginPercent}% (Markup: {markupPercent}%)
                      </span>
                    </div>
                  </div>

                  {/* Target Selling Price Input & Smart Margin Recommendations */}
                  <div className="mt-4 border-t border-[#dedee8] pt-3.5 space-y-3 font-mono text-xs">
                    <div>
                      <label className="text-[10.5px] font-bold text-[#7b7b8e] block">
                        Harga Jual Tokomu (Bisa Diedit):
                      </label>
                      <div className="mt-1 flex items-center gap-2">
                        <span className="font-bold text-sm">Rp</span>
                        <input
                          type="number"
                          value={targetSellingPrice}
                          onChange={(e) => setTargetSellingPrice(Number(e.target.value))}
                          className="w-full rounded-xl border-2 border-[#232331] px-3.5 py-2 text-base font-extrabold text-[#232331] focus:outline-none"
                        />
                      </div>
                    </div>

                    {/* Automatic Margin Suggestion Buttons */}
                    <div className="rounded-xl bg-[#fcfcfe] border border-[#dedee8] p-3 space-y-1.5">
                      <span className="font-bold text-[10.5px] text-[#7958d8] block">
                        💡 Rekomendasi Harga Jual Otomatis:
                      </span>
                      <div className="grid grid-cols-3 gap-1.5 text-center">
                        {[
                          { label: "Margin 50%", margin: 0.5 },
                          { label: "Margin 65% (Ideal)", margin: 0.65 },
                          { label: "Margin 75%", margin: 0.75 },
                        ].map((s) => {
                          const suggested = Math.ceil((totalHppRecipe / (1 - s.margin)) / 1000) * 1000;
                          return (
                            <button
                              key={s.label}
                              type="button"
                              onClick={() => setTargetSellingPrice(suggested)}
                              className="btn-tactile rounded-lg border border-[#dedee8] bg-white p-1.5 text-[10px] hover:border-[#232331]"
                            >
                              <span className="block text-[#7b7b8e]">{s.label}</span>
                              <strong className="text-[#232331] font-extrabold">Rp {suggested.toLocaleString("id-ID")}</strong>
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* Daily Sales Target Slider */}
                    <div className="border-t border-[#dedee8] pt-3">
                      <div className="flex justify-between text-[11px] font-bold text-[#232331]">
                        <span>Simulasi Penjualan:</span>
                        <span className="text-[#7958d8]">{dailySalesTarget} porsi / hari ({monthlyPortions} porsi/bln)</span>
                      </div>
                      <input
                        type="range"
                        min="10"
                        max="200"
                        value={dailySalesTarget}
                        onChange={(e) => setDailySalesTarget(Number(e.target.value))}
                        className="mt-2 w-full accent-[#7958d8] cursor-pointer"
                      />
                    </div>

                    {/* Monthly Gross Profit Result */}
                    <div className="rounded-2xl border-2 border-[#16a34a] bg-[#dcfce7] p-3.5 text-center text-[#16a34a]">
                      <span className="text-[10px] font-bold uppercase block">PROYEKSI LABA KOTOR BULANAN</span>
                      <span className="text-xl sm:text-2xl font-extrabold text-[#16a34a] mt-0.5 block">
                        +Rp {monthlyGrossProfit.toLocaleString("id-ID")}
                      </span>
                      <span className="text-[10px] text-[#232331]/80 block mt-0.5">
                        Omzet: Rp {monthlyRevenue.toLocaleString("id-ID")} • Modal Bahan: Rp {monthlyHppTotal.toLocaleString("id-ID")}
                      </span>
                    </div>

                  </div>

                </div>

                {/* 3. Break-Even Point (BEP) Simulator */}
                <div className="rounded-3xl border-2 border-[#232331] bg-white p-5 shadow-ink-md font-mono text-xs space-y-3">
                  <div className="flex items-center gap-2 border-b border-[#dedee8] pb-2.5">
                    <Target size={15} className="text-[#7958d8]" />
                    <h4 className="font-extrabold text-xs text-[#232331]">
                      Simulasi BEP (Balik Modal Operasional Toko)
                    </h4>
                  </div>

                  <div className="grid gap-2 sm:grid-cols-2">
                    <div>
                      <label className="text-[10px] text-[#7b7b8e] block">Sewa Ruko &amp; Listrik (Bln):</label>
                      <input
                        type="number"
                        value={rentAndUtilities}
                        onChange={(e) => setRentAndUtilities(Number(e.target.value))}
                        className="mt-0.5 w-full rounded-lg border border-gray-200 px-2 py-1 text-xs font-bold"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] text-[#7b7b8e] block">Total Gaji Staf (Bln):</label>
                      <input
                        type="number"
                        value={staffSalaries}
                        onChange={(e) => setStaffSalaries(Number(e.target.value))}
                        className="mt-0.5 w-full rounded-lg border border-gray-200 px-2 py-1 text-xs font-bold"
                      />
                    </div>
                  </div>

                  <div className="rounded-xl bg-[#f0edff] border border-[#7958d8]/30 p-3 text-[11px] space-y-1">
                    <div className="flex justify-between">
                      <span className="text-[#7b7b8e]">Total Beban Operasional:</span>
                      <strong className="text-[#232331]">Rp {totalFixedCosts.toLocaleString("id-ID")}/bln</strong>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-[#7b7b8e]">Target Jual Minimal Balik Modal:</span>
                      <strong className="text-[#7958d8]">{bepPortionsDaily} porsi / hari ({bepPortionsMonthly} porsi/bln)</strong>
                    </div>
                    <div className="flex justify-between border-t border-[#7958d8]/20 pt-1">
                      <span className="text-[#7b7b8e]">Estimasi Laba Bersih Bersih (Net):</span>
                      <strong className={monthlyNetProfit >= 0 ? "text-[#16a34a]" : "text-[#ef4444]"}>
                        Rp {monthlyNetProfit.toLocaleString("id-ID")}/bln
                      </strong>
                    </div>
                  </div>
                </div>

              </div>

            </div>

          </div>
        )}

        {/* ========================================================= */}
        {/* MODE 2: SUPPLIER / RESELLER KULAKAN */}
        {/* ========================================================= */}
        {calcMode === "supplier" && (
          <div className="mt-6 grid gap-6 lg:grid-cols-12 items-start">
            
            <div className="lg:col-span-7 min-w-0">
              <div className="rounded-3xl border-2 border-[#232331] bg-white p-5 sm:p-6 shadow-ink-md space-y-4">
                
                <div>
                  <label className="text-[10.5px] font-mono font-bold text-[#7958d8] uppercase block">
                    Nama Produk Kulakan / Reseller:
                  </label>
                  <input
                    type="text"
                    value={supplierProductName}
                    onChange={(e) => setSupplierProductName(e.target.value)}
                    className="mt-1 w-full rounded-xl border border-[#232331] px-3.5 py-2 text-sm font-extrabold text-[#232331] focus:outline-none"
                  />
                </div>

                <div className="grid gap-3 sm:grid-cols-2 font-mono text-xs">
                  <div>
                    <label className="text-[10.5px] font-bold text-[#7b7b8e] block">Harga Beli Supplier (per Dus/Koli):</label>
                    <div className="mt-1 flex items-center gap-1">
                      <span className="text-xs font-bold text-[#7b7b8e]">Rp</span>
                      <input
                        type="number"
                        value={boxBuyPrice}
                        onChange={(e) => setBoxBuyPrice(Number(e.target.value))}
                        className="w-full rounded-xl border border-[#dedee8] px-3 py-1.5 font-extrabold text-[#232331]"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="text-[10.5px] font-bold text-[#7b7b8e] block">Isi per Dus/Koli (Pcs):</label>
                    <input
                      type="number"
                      value={boxQty}
                      onChange={(e) => setBoxQty(Number(e.target.value))}
                      className="mt-1 w-full rounded-xl border border-[#dedee8] px-3 py-1.5 font-extrabold text-[#232331]"
                    />
                  </div>
                </div>

                <div className="grid gap-3 sm:grid-cols-2 font-mono text-xs">
                  <div>
                    <label className="text-[10.5px] font-bold text-[#7b7b8e] block">Ongkir Ekspedisi per Dus/Koli:</label>
                    <div className="mt-1 flex items-center gap-1">
                      <span className="text-xs font-bold text-[#7b7b8e]">Rp</span>
                      <input
                        type="number"
                        value={shippingPerBox}
                        onChange={(e) => setShippingPerBox(Number(e.target.value))}
                        className="w-full rounded-xl border border-[#dedee8] px-3 py-1.5 font-extrabold text-[#232331]"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="text-[10.5px] font-bold text-[#7b7b8e] block">Packaging &amp; Stiker per Pcs:</label>
                    <div className="mt-1 flex items-center gap-1">
                      <span className="text-xs font-bold text-[#7b7b8e]">Rp</span>
                      <input
                        type="number"
                        value={supplierPackaging}
                        onChange={(e) => setSupplierPackaging(Number(e.target.value))}
                        className="w-full rounded-xl border border-[#dedee8] px-3 py-1.5 font-extrabold text-[#232331]"
                      />
                    </div>
                  </div>
                </div>

              </div>
            </div>

            <div className="lg:col-span-5 min-w-0">
              <div className="rounded-3xl border-2 border-[#232331] bg-white p-5 sm:p-6 shadow-ink-md font-mono text-xs space-y-3">
                <span className="font-mono text-[10px] font-bold text-[#7958d8] uppercase tracking-wider block">
                  ANALISA HPP KULAKAN REALISTIS
                </span>

                <div className="rounded-xl bg-[#fcfcfe] border border-[#dedee8] p-3 space-y-1.5">
                  <div className="flex justify-between text-[#7b7b8e]">
                    <span>Modal Beli Pokok / pcs</span>
                    <span>Rp {buyCostPerPcs.toLocaleString("id-ID")}</span>
                  </div>
                  <div className="flex justify-between text-[#7b7b8e]">
                    <span>Beban Ongkir / pcs</span>
                    <span>Rp {shippingPerPcs.toLocaleString("id-ID")}</span>
                  </div>
                  <div className="flex justify-between text-[#7b7b8e]">
                    <span>Beban Kemasan / pcs</span>
                    <span>Rp {Number(supplierPackaging || 0).toLocaleString("id-ID")}</span>
                  </div>
                  <div className="flex justify-between font-extrabold text-sm text-[#232331] pt-1 border-t">
                    <span>HPP Riil per Pcs</span>
                    <span className="text-[#c2410c]">Rp {totalHppSupplier.toLocaleString("id-ID")}</span>
                  </div>
                </div>

                <div>
                  <label className="text-[10.5px] font-bold text-[#7b7b8e] block">Harga Jual ke Customer:</label>
                  <div className="mt-1 flex items-center gap-1">
                    <span className="text-xs font-bold text-[#7b7b8e]">Rp</span>
                    <input
                      type="number"
                      value={supplierSellingPrice}
                      onChange={(e) => setSupplierSellingPrice(Number(e.target.value))}
                      className="w-full rounded-xl border-2 border-[#232331] px-3 py-2 text-sm font-extrabold text-[#232331]"
                    />
                  </div>
                </div>

                <div className="rounded-2xl border-2 border-[#16a34a] bg-[#dcfce7] p-3 text-center text-[#16a34a]">
                  <span className="text-[10px] font-bold uppercase block">PROFIT BERSIH PER PCS</span>
                  <span className="font-mono text-xl sm:text-2xl font-extrabold text-[#16a34a] mt-0.5 block">
                    +Rp {profitSupplier.toLocaleString("id-ID")}
                  </span>
                  <span className="text-[10px] text-[#232331]/80 block mt-0.5">
                    Margin: {marginSupplierPercent}% • Proyeksi Bulanan ({supplierMonthlyPortions} pcs): <strong>+Rp {supplierMonthlyGross.toLocaleString("id-ID")}</strong>
                  </span>
                </div>
              </div>
            </div>

          </div>
        )}

      {/* Mobile Floating Sticky Quick Bar */}
      <div className="fixed bottom-0 inset-x-0 z-40 bg-[#232331] text-white border-t-2 border-[#232331] p-3 shadow-ink-xl lg:hidden">
        <div className="max-w-6xl mx-auto flex items-center justify-between gap-2 font-mono text-xs">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-[#d9ff57] font-black text-sm">
                HPP: Rp {calcMode === "recipe" ? totalHppRecipe.toLocaleString("id-ID") : totalHppSupplier.toLocaleString("id-ID")}
              </span>
              <span className="text-[10px] px-1.5 py-0.2 rounded font-bold bg-[#16a34a] text-white">
                {calcMode === "recipe" ? marginPercent : marginSupplierPercent}% Margin
              </span>
            </div>
            <span className="text-[10px] text-[#dedee8] block truncate">
              Laba: +Rp {calcMode === "recipe" ? Math.round(profitPerPortion).toLocaleString("id-ID") : profitSupplier.toLocaleString("id-ID")} / porsi
            </span>
          </div>

          <Link
            href="/app/finance"
            className="btn-tactile rounded-xl bg-[#d9ff57] px-3.5 py-2 text-xs font-extrabold text-[#232331] shadow-ink-xs shrink-0"
          >
            Dashboard ➔
          </Link>
        </div>
      </div>

      </main>

      {/* Footer */}
      {showWhiteLabelBadge && (
        <footer className="border-t border-[#dedee8] py-4 text-center text-xs text-[#7b7b8e] bg-white pb-20 lg:pb-4">
          <p>⚡ Powered by <strong>KAEL Finance</strong> · Live Production-Grade HPP Engine</p>
        </footer>
      )}
    </div>
  );
}
