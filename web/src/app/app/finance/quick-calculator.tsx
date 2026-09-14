"use client";

import { useMemo, useState, useTransition } from "react";
import { Calculator, Coffee, Package, Save, Scissors, Trash2, TrendingUp } from "lucide-react";

import { calculateBusinessPrice, type BusinessCalculatorMode } from "@/lib/business-calculator";
import { deleteFinanceCalculatorPresetAction, saveFinanceCalculatorPresetAction } from "@/lib/actions";
import { formatMarginPercent } from "@/lib/finance-engine";
import { formatRupiah } from "@/lib/formatters";
import type { FinanceCalculatorPreset } from "@/lib/types";

type Field = "direct_cost" | "supporting_cost" | "operational_cost";

const MODES: Record<BusinessCalculatorMode, {
  label: string;
  description: string;
  icon: typeof Coffee;
  fields: Record<Field, { label: string; hint: string }>;
  targetMargin: number;
}> = {
  kuliner: {
    label: "Kuliner", description: "Makanan, minuman, katering", icon: Coffee, targetMargin: 60,
    fields: {
      direct_cost: { label: "Bahan per porsi", hint: "Bahan makanan atau minuman" },
      supporting_cost: { label: "Kemasan per porsi", hint: "Cup, box, stiker, sendok" },
      operational_cost: { label: "Biaya dapur per porsi", hint: "Gas, listrik, tenaga" },
    },
  },
  retail: {
    label: "Retail", description: "Toko, reseller, barang dagang", icon: Package, targetMargin: 40,
    fields: {
      direct_cost: { label: "Harga beli barang", hint: "Modal dari supplier" },
      supporting_cost: { label: "Ongkir masuk per barang", hint: "Ongkir dibagi per unit" },
      operational_cost: { label: "Packing dan handling", hint: "Plastik, bubble wrap, admin" },
    },
  },
  jasa: {
    label: "Jasa", description: "Salon, bengkel, kelas, layanan", icon: Scissors, targetMargin: 50,
    fields: {
      direct_cost: { label: "Upah staf per layanan", hint: "Gaji atau komisi per transaksi" },
      supporting_cost: { label: "Bahan dan perlengkapan", hint: "Material yang terpakai" },
      operational_cost: { label: "Transport dan operasional", hint: "Biaya yang melekat per layanan" },
    },
  },
};

const INITIAL_VALUES = {
  direct_cost: 0, supporting_cost: 0, operational_cost: 0, selling_price: 0,
  discount_pct: 0, payment_fee_pct: 0, channel_fee_pct: 0, tax_reserve_pct: 0,
  target_margin_pct: 60, monthly_fixed_cost: 0, monthly_profit_target: 0,
};

export default function QuickCalculator({ initialMode, initialPresets }: { initialMode: BusinessCalculatorMode; initialPresets: FinanceCalculatorPreset[] }) {
  const [mode, setMode] = useState<BusinessCalculatorMode>(initialMode);
  const [values, setValues] = useState(INITIAL_VALUES);
  const [presetName, setPresetName] = useState("");
  const [activePresetId, setActivePresetId] = useState<string | null>(null);
  const [presets, setPresets] = useState(initialPresets);
  const [isPending, startTransition] = useTransition();
  const modeInfo = MODES[mode];
  const result = useMemo(() => calculateBusinessPrice({ mode, ...values }), [mode, values]);
  const setNumber = (key: keyof typeof values, value: string) => {
    setValues((current) => ({ ...current, [key]: Math.max(0, Number(value) || 0) }));
  };
  const chooseMode = (nextMode: BusinessCalculatorMode) => {
    setMode(nextMode);
    setValues((current) => ({ ...current, target_margin_pct: MODES[nextMode].targetMargin }));
  };
  const loadPreset = (preset: FinanceCalculatorPreset) => {
    setMode(preset.mode);
    setPresetName(preset.name);
    setActivePresetId(preset.id);
    setValues({
      direct_cost: Number(preset.direct_cost), supporting_cost: Number(preset.supporting_cost), operational_cost: Number(preset.operational_cost),
      selling_price: Number(preset.selling_price), discount_pct: Number(preset.discount_pct), payment_fee_pct: Number(preset.payment_fee_pct),
      channel_fee_pct: Number(preset.channel_fee_pct), tax_reserve_pct: Number(preset.tax_reserve_pct), target_margin_pct: Number(preset.target_margin_pct),
      monthly_fixed_cost: Number(preset.monthly_fixed_cost), monthly_profit_target: Number(preset.monthly_profit_target),
    });
  };
  const savePreset = () => {
    startTransition(async () => {
      const saved = await saveFinanceCalculatorPresetAction({ id: activePresetId ?? undefined, name: presetName, mode, ...values });
      if (!saved.ok) {
        alert(saved.error);
        return;
      }
      setActivePresetId(saved.data.id);
      setPresets((current) => [saved.data, ...current.filter((preset) => preset.id !== saved.data.id)]);
      alert(`Perhitungan "${saved.data.name}" sudah disimpan.`);
    });
  };
  const deletePreset = () => {
    if (!activePresetId || !confirm("Hapus perhitungan tersimpan ini?")) return;
    startTransition(async () => {
      const deleted = await deleteFinanceCalculatorPresetAction(activePresetId);
      if (!deleted.ok) {
        alert(deleted.error);
        return;
      }
      setPresets((current) => current.filter((preset) => preset.id !== activePresetId));
      setActivePresetId(null);
      setPresetName("");
    });
  };

  return (
    <section className="space-y-4 sm:space-y-6">
      {/* Mochi Hero Banner */}
      <div className="rounded-3xl border border-emerald-800/40 bg-gradient-to-br from-[#0b3d2e] via-[#0e4837] to-[#07281e] p-5 sm:p-6 text-white shadow-sm">
        <div className="flex items-start gap-3.5">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[#c8f53a] text-[#073829] shadow-xs">
            <Calculator size={22} className="stroke-[2.5]" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base sm:text-lg font-bold text-white tracking-tight">Kalkulator Harga Cepat</h2>
              <span className="rounded-full bg-[#c8f53a]/20 border border-[#c8f53a]/30 px-2 py-0.5 text-[10px] font-bold text-[#c8f53a]">HPP &amp; Markup</span>
            </div>
            <p className="mt-1 text-xs sm:text-sm leading-relaxed text-emerald-100/80">
              Isi komponen biaya yang Anda ketahui. KAEL otomatis menghitung harga jual aman, laba bersih per transaksi, potongan fee/pajak, dan target omzet bulanan.
            </p>
          </div>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(320px,.75fr)]">
        <div className="space-y-5 rounded-3xl border border-[#d8e3de] bg-white p-5 sm:p-6 shadow-[0_4px_20px_rgba(11,61,46,0.04)]">
          {/* Preset Name Bar */}
          <div className="rounded-2xl border border-emerald-200/90 bg-[#f4faf6] p-4 sm:flex sm:items-end sm:gap-3">
            <label className="block flex-1">
              <span className="text-xs font-bold text-[#0b3d2e]">Nama Produk atau Layanan</span>
              <span className="mt-0.5 block text-[10.5px] leading-4 text-[#527867]">Beri nama agar rincian kalkulasi ini dapat disimpan dan dibuka kembali sewaktu-waktu.</span>
              <input 
                type="text" 
                value={presetName} 
                onChange={(event) => setPresetName(event.target.value)} 
                placeholder="Contoh: Mochi Daifuku Strawberry / Kopi Aren" 
                className="mt-1.5 min-h-11 w-full rounded-xl border border-[#d8e3de] bg-white px-3.5 text-sm font-semibold text-[#1a382d] placeholder:text-[#527867]/50 focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600 outline-none transition-colors" 
              />
            </label>
            <div className="mt-3 flex gap-2 sm:mt-0">
              <button 
                type="button" 
                onClick={savePreset} 
                disabled={isPending} 
                className="flex min-h-11 flex-1 items-center justify-center gap-2 rounded-xl bg-[#0b3d2e] px-4 text-xs font-bold text-[#c8f53a] hover:bg-[#0e4837] shadow-xs disabled:opacity-50 transition-colors"
              >
                <Save size={15} />
                <span>{isPending ? "Menyimpan..." : activePresetId ? "Perbarui" : "Simpan"}</span>
              </button>
              {activePresetId && (
                <button 
                  type="button" 
                  onClick={deletePreset} 
                  disabled={isPending} 
                  title="Hapus perhitungan" 
                  className="flex h-11 w-11 items-center justify-center rounded-xl border border-rose-200 bg-rose-50 text-rose-600 hover:bg-rose-100 disabled:opacity-50 transition-colors"
                >
                  <Trash2 size={15} />
                </button>
              )}
            </div>
          </div>

          {/* Section 1: Business Mode */}
          <div>
            <h3 className="text-sm font-bold text-[#0b3d2e]">1. Pilih Jenis Usaha</h3>
            <p className="mt-0.5 text-xs text-[#527867]">Mode awal menyesuaikan karakteristik bisnis Anda dan dapat diubah bebas.</p>
          </div>
          <div className="grid gap-2.5 sm:grid-cols-3">
            {(Object.keys(MODES) as BusinessCalculatorMode[]).map((key) => {
              const option = MODES[key];
              const Icon = option.icon;
              const selected = mode === key;
              return (
                <button 
                  key={key} 
                  type="button" 
                  onClick={() => chooseMode(key)} 
                  className={`min-h-24 rounded-2xl p-3.5 text-left transition-all ${
                    selected 
                      ? "border-2 border-emerald-600 bg-[#edf8f3] text-[#0b3d2e] shadow-xs" 
                      : "border border-[#d8e3de] bg-[#fbfdfc] text-[#527867] hover:border-emerald-300 hover:bg-white"
                  }`}
                >
                  <div className={`flex h-8 w-8 items-center justify-center rounded-xl ${selected ? "bg-emerald-600 text-white" : "bg-[#edf8f3] text-emerald-700"}`}>
                    <Icon size={17} />
                  </div>
                  <p className="mt-2.5 text-sm font-bold text-[#0b3d2e]">{option.label}</p>
                  <p className="mt-1 text-[11px] leading-4 text-[#527867]">{option.description}</p>
                </button>
              );
            })}
          </div>

          {/* Section 2: Direct Costs */}
          <div className="border-t border-[#d8e3de] pt-4">
            <h3 className="text-sm font-bold text-[#0b3d2e]">2. Modal Pokok per Transaksi (COGS)</h3>
            <p className="mt-0.5 text-xs text-[#527867]">Masukkan pengeluaran langsung untuk 1 porsi, unit produk, atau layanan.</p>
            <div className="mt-3 grid gap-3 sm:grid-cols-3">
              {(["direct_cost", "supporting_cost", "operational_cost"] as Field[]).map((key) => (
                <MoneyInput 
                  key={key} 
                  label={modeInfo.fields[key].label} 
                  hint={modeInfo.fields[key].hint} 
                  value={values[key]} 
                  onChange={(value) => setNumber(key, value)} 
                />
              ))}
            </div>
          </div>

          {/* Section 3: Selling and Margins */}
          <div className="border-t border-[#d8e3de] pt-4">
            <h3 className="text-sm font-bold text-[#0b3d2e]">3. Cara Anda Menjual &amp; Potongan</h3>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <MoneyInput label="Harga Jual Sekarang" hint="Harga yang tertera di menu / bayar pelanggan" value={values.selling_price} onChange={(value) => setNumber("selling_price", value)} />
              <PercentInput label="Diskon Rata-rata" hint="Jika tidak ada diskon promo, isi 0" value={values.discount_pct} onChange={(value) => setNumber("discount_pct", value)} />
              <PercentInput label="Fee Pembayaran" hint="QRIS (0.7%), EDC kartu debit/kredit, gateway" value={values.payment_fee_pct} onChange={(value) => setNumber("payment_fee_pct", value)} />
              <PercentInput label="Fee Kanal Penjualan" hint="GrabFood, GoFood, ShopeeFood, fee reseller" value={values.channel_fee_pct} onChange={(value) => setNumber("channel_fee_pct", value)} />
              <PercentInput label="Cadangan Pajak (PB1/PPN)" hint="Sisihkan bila pajak sudah include di harga menu" value={values.tax_reserve_pct} onChange={(value) => setNumber("tax_reserve_pct", value)} />
              <PercentInput label="Target Margin Bersih" hint="Persentase laba bersih ideal dibanding harga jual" value={values.target_margin_pct} onChange={(value) => setNumber("target_margin_pct", value)} />
            </div>
          </div>

          {/* Section 4: Target Bulanan */}
          <div className="border-t border-[#d8e3de] pt-4">
            <h3 className="text-sm font-bold text-[#0b3d2e]">4. Target Bulanan &amp; BEP (Opsional)</h3>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <MoneyInput label="Biaya Tetap per Bulan (Fixed Cost)" hint="Sewa outlet, gaji tetap staf, wifi, listrik" value={values.monthly_fixed_cost} onChange={(value) => setNumber("monthly_fixed_cost", value)} />
              <MoneyInput label="Target Laba Bersih Owner" hint="Gaji / dividen yang ingin dibawa pulang owner" value={values.monthly_profit_target} onChange={(value) => setNumber("monthly_profit_target", value)} />
            </div>
          </div>

          {/* Saved presets */}
          {presets.length > 0 && (
            <div className="border-t border-[#d8e3de] pt-4">
              <h3 className="text-sm font-bold text-[#0b3d2e]">Perhitungan yang Tersimpan</h3>
              <p className="mt-0.5 text-xs text-[#527867]">Klik salah satu perhitungan untuk membuka dan melanjutkan rinciannya.</p>
              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                {presets.map((preset) => (
                  <button 
                    key={preset.id} 
                    type="button" 
                    onClick={() => loadPreset(preset)} 
                    className={`rounded-2xl border p-3.5 text-left transition-all ${
                      activePresetId === preset.id 
                        ? "border-2 border-emerald-600 bg-[#edf8f3] text-[#0b3d2e] shadow-xs" 
                        : "border-[#d8e3de] bg-[#fbfdfc] hover:border-emerald-300 hover:bg-white text-[#1a382d]"
                    }`}
                  >
                    <p className="truncate text-xs font-bold text-[#0b3d2e]">{preset.name}</p>
                    <p className="mt-1 text-[10.5px] font-mono text-[#527867]">
                      {MODES[preset.mode].label} · Harga {formatRupiah(Number(preset.selling_price))}
                    </p>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Right Sidebar Result Panel */}
        <aside className="space-y-4 lg:sticky lg:top-20 lg:self-start">
          {/* Card: Hasil per Transaksi */}
          <div className="rounded-3xl border border-[#d8e3de] bg-white p-5 shadow-[0_4px_20px_rgba(11,61,46,0.04)]">
            <div className="flex items-center justify-between border-b border-[#d8e3de] pb-2.5">
              <span className="font-mono text-[10px] font-bold text-emerald-800 tracking-wider uppercase">HASIL PER TRANSAKSI</span>
              <span className="rounded-full bg-[#edf8f3] px-2 py-0.5 font-mono text-[9px] font-bold text-[#167052]">Real Time</span>
            </div>
            <div className="mt-1 space-y-1">
              <ResultRow label="Modal Pokok (COGS)" value={formatRupiah(result.cost_per_sale)} />
              <ResultRow label="Diskon &amp; Total Fee" value={formatRupiah(result.total_deductions)} />
            </div>
            <div className="mt-4 border-t border-[#d8e3de] pt-3">
              <p className="text-xs font-bold text-[#527867]">Estimasi Laba Bersih</p>
              <p className={`mt-1 text-2xl sm:text-3xl font-black font-mono tracking-tight ${result.profit_per_sale >= 0 ? "text-[#167052]" : "text-rose-600"}`}>
                {formatRupiah(result.profit_per_sale)}
              </p>
              <div className="mt-2 flex items-center gap-2 font-mono text-xs">
                <span className="rounded-md bg-[#edf8f3] px-1.5 py-0.5 font-bold text-[#167052]">
                  Margin {formatMarginPercent(result.margin_pct)}
                </span>
                <span className="text-[#527867]">·</span>
                <span className="text-[#527867]">
                  Markup {formatMarginPercent(result.markup_pct)}
                </span>
              </div>
            </div>
          </div>

          {/* Card: Rekomendasi Harga Jual Aman */}
          <div className="rounded-3xl border border-emerald-700/60 bg-gradient-to-br from-[#0b3d2e] via-[#0e4837] to-[#124d3a] p-5 text-white shadow-md">
            <div className="flex items-center justify-between">
              <span className="font-mono text-[10px] font-bold text-[#c8f53a] tracking-wider uppercase">HARGA JUAL AMAN REKOMENDASI</span>
              <span className="rounded-full bg-white/10 px-2 py-0.5 font-mono text-[9.5px] text-emerald-200">Anti Rugi</span>
            </div>
            {result.target_unreachable ? (
              <p className="mt-3 text-xs font-semibold text-rose-200 leading-relaxed">
                Target tidak dapat dihitung. Total persentase diskon, fee, cadangan pajak, dan margin melebihi 100%.
              </p>
            ) : (
              <>
                <p className="mt-2 text-3xl sm:text-4xl font-black font-mono text-[#c8f53a] tracking-tight">
                  {formatRupiah(result.recommended_price)}
                </p>
                <p className="mt-2.5 text-xs leading-relaxed text-emerald-100/90">
                  Harga ini sudah mengompensasi modal dasar, potongan diskon/fee penjualan, cadangan pajak, dan mengunci target margin bersih <b className="text-[#c8f53a]">${values.target_margin_pct}%</b>.
                </p>
              </>
            )}
          </div>

          {/* Card: Target Penjualan Bulanan */}
          <div className="rounded-3xl border border-[#d8e3de] bg-white p-5 shadow-[0_4px_20px_rgba(11,61,46,0.04)]">
            <div className="flex items-center gap-2 text-[#0b3d2e]">
              <TrendingUp size={17} className="text-emerald-700 stroke-[2.5]" />
              <p className="text-sm font-bold">Target Penjualan Bulanan (BEP)</p>
            </div>
            {result.target_units === null ? (
              <p className="mt-3 text-xs leading-relaxed text-rose-600 bg-rose-50 border border-rose-200 rounded-xl p-2.5">
                Silakan isi harga jual di atas modal pokok agar sistem dapat memproyeksikan target unit transaksi.
              </p>
            ) : (
              <div className="mt-3 space-y-2 text-xs">
                <div className="flex items-center justify-between rounded-xl bg-[#fbfdfc] border border-[#d8e3de] p-2.5">
                  <span className="text-[#527867]">Titik Balik Modal (BEP):</span>
                  <b className="font-mono text-sm text-[#0b3d2e]">{result.break_even_units} porsi</b>
                </div>
                <div className="flex items-center justify-between rounded-xl bg-[#edf8f3] border border-emerald-200 p-2.5">
                  <span className="text-[#167052] font-semibold">Target Gaji &amp; Profit Owner:</span>
                  <b className="font-mono text-sm text-[#0b3d2e]">{result.target_units} porsi</b>
                </div>
                <p className="pt-1 text-[11px] text-[#527867] text-center font-mono">
                  Setara omzet kotor minimal <b className="text-[#0b3d2e]">{formatRupiah(result.target_revenue)}</b> / bulan.
                </p>
              </div>
            )}
          </div>

          <div className="rounded-2xl border border-emerald-200/80 bg-[#edf8f3] p-3.5 text-[11px] leading-relaxed text-[#167052]">
            💡 <span className="font-bold">Tips Biaya Efektif:</span> Fee pembayaran, fee kanal ojol, dan cadangan pajak diperhitungkan dari harga jual kotor agar kalkulasi margin Anda aman dan tidak tergerus saat promo.
          </div>
        </aside>
      </div>
    </section>
  );
}

function MoneyInput({ label, hint, value, onChange }: { label: string; hint: string; value: number; onChange: (value: string) => void }) {
  return (
    <label className="block">
      <span className="text-xs font-bold text-[#1a382d]">{label}</span>
      <span className="mt-0.5 block text-[10px] leading-4 text-[#527867]">{hint}</span>
      <div className="mt-1.5 flex min-h-11 items-center rounded-xl border border-[#d8e3de] bg-[#fbfdfc] focus-within:border-emerald-600 focus-within:bg-white focus-within:ring-1 focus-within:ring-emerald-600 transition-all">
        <span className="pl-3.5 text-xs font-bold font-mono text-[#527867]">Rp</span>
        <input 
          type="number" 
          min="0" 
          inputMode="numeric" 
          value={value || ""} 
          onChange={(event) => onChange(event.target.value)} 
          placeholder="0" 
          className="min-w-0 flex-1 bg-transparent px-2.5 py-2 text-right text-sm font-bold font-mono text-[#0b3d2e] outline-none" 
        />
      </div>
    </label>
  );
}

function PercentInput({ label, hint, value, onChange }: { label: string; hint: string; value: number; onChange: (value: string) => void }) {
  return (
    <label className="block">
      <span className="text-xs font-bold text-[#1a382d]">{label}</span>
      <span className="mt-0.5 block text-[10px] leading-4 text-[#527867]">{hint}</span>
      <div className="mt-1.5 flex min-h-11 items-center rounded-xl border border-[#d8e3de] bg-[#fbfdfc] focus-within:border-emerald-600 focus-within:bg-white focus-within:ring-1 focus-within:ring-emerald-600 transition-all">
        <input 
          type="number" 
          min="0" 
          max="100" 
          inputMode="decimal" 
          value={value || ""} 
          onChange={(event) => onChange(event.target.value)} 
          placeholder="0" 
          className="min-w-0 flex-1 bg-transparent px-3 py-2 text-right text-sm font-bold font-mono text-[#0b3d2e] outline-none" 
        />
        <span className="pr-3.5 text-xs font-bold font-mono text-[#527867]">%</span>
      </div>
    </label>
  );
}

function ResultRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3 py-1.5 text-xs">
      <span className="text-[#527867]">{label}</span>
      <span className="font-bold font-mono text-[#1a382d]">{value}</span>
    </div>
  );
}
