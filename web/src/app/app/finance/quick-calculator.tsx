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
      <div className="rounded-2xl border-2 border-[#232331] bg-[#232331] p-4 text-white shadow-ink-md sm:p-6">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[#d9ff57] text-[#232331]"><Calculator size={20} /></div>
          <div>
            <h2 className="text-base font-black sm:text-lg">Kalkulator harga cepat</h2>
            <p className="mt-1 text-sm leading-5 text-[#dedee8]">Isi biaya yang kamu tahu. KAEL menghitung harga jual, laba bersih, fee, dan target penjualanmu.</p>
          </div>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(300px,.75fr)]">
        <div className="space-y-4 rounded-2xl border-2 border-[#232331] bg-white p-4 shadow-ink-md sm:p-5">
          <div className="rounded-xl border border-[#7958d8] bg-[#f7f4ff] p-3 sm:flex sm:items-end sm:gap-3">
            <label className="block flex-1"><span className="text-xs font-black text-[#232331]">Nama produk atau layanan</span><span className="mt-0.5 block text-[10px] leading-4 text-[#66667a]">Beri nama agar perhitungan ini bisa dibuka lagi.</span><input type="text" value={presetName} onChange={(event) => setPresetName(event.target.value)} placeholder="Contoh: Cuci motor premium" className="mt-1.5 min-h-11 w-full rounded-lg border border-[#232331] bg-white px-3 text-sm font-bold outline-none" /></label>
            <div className="mt-3 flex gap-2 sm:mt-0">
              <button type="button" onClick={savePreset} disabled={isPending} className="btn-tactile flex min-h-11 flex-1 items-center justify-center gap-2 rounded-xl border-2 border-[#232331] bg-[#d9ff57] px-3 text-xs font-black text-[#232331] shadow-ink-xs disabled:opacity-50"><Save size={15} /><span>{isPending ? "Menyimpan..." : activePresetId ? "Perbarui" : "Simpan"}</span></button>
              {activePresetId && <button type="button" onClick={deletePreset} disabled={isPending} title="Hapus perhitungan" className="btn-tactile flex h-11 w-11 items-center justify-center rounded-xl border-2 border-[#232331] bg-white text-[#dc2626] shadow-ink-xs disabled:opacity-50"><Trash2 size={15} /></button>}
            </div>
          </div>

          <div>
            <h3 className="text-sm font-black">1. Pilih jenis usaha</h3>
            <p className="mt-1 text-xs text-[#66667a]">Mode awal mengikuti profil usaha Anda dan bisa diganti kapan saja.</p>
          </div>
          <div className="grid gap-2 sm:grid-cols-3">
            {(Object.keys(MODES) as BusinessCalculatorMode[]).map((key) => {
              const option = MODES[key];
              const Icon = option.icon;
              const selected = mode === key;
              return <button key={key} type="button" onClick={() => chooseMode(key)} className={`min-h-24 rounded-xl border-2 p-3 text-left ${selected ? "border-[#232331] bg-[#d9ff57]" : "border-[#dedee8] bg-white hover:border-[#232331]"}`}>
                <Icon size={18} />
                <p className="mt-2 text-sm font-black">{option.label}</p>
                <p className="mt-1 text-[11px] leading-4 text-[#5c5c70]">{option.description}</p>
              </button>;
            })}
          </div>

          <div className="border-t border-[#dedee8] pt-4">
            <h3 className="text-sm font-black">2. Modal per transaksi</h3>
            <p className="mt-1 text-xs text-[#66667a]">Masukkan biaya per satu porsi, barang, atau layanan.</p>
            <div className="mt-3 grid gap-3 sm:grid-cols-3">
              {(["direct_cost", "supporting_cost", "operational_cost"] as Field[]).map((key) => <MoneyInput key={key} label={modeInfo.fields[key].label} hint={modeInfo.fields[key].hint} value={values[key]} onChange={(value) => setNumber(key, value)} />)}
            </div>
          </div>

          <div className="border-t border-[#dedee8] pt-4">
            <h3 className="text-sm font-black">3. Cara Anda menjual</h3>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <MoneyInput label="Harga jual sekarang" hint="Harga yang dibayar pelanggan" value={values.selling_price} onChange={(value) => setNumber("selling_price", value)} />
              <PercentInput label="Diskon rata-rata" hint="Jika tidak ada, isi 0" value={values.discount_pct} onChange={(value) => setNumber("discount_pct", value)} />
              <PercentInput label="Fee pembayaran" hint="QRIS, kartu, payment gateway" value={values.payment_fee_pct} onChange={(value) => setNumber("payment_fee_pct", value)} />
              <PercentInput label="Fee kanal penjualan" hint="Marketplace, ojol, reseller" value={values.channel_fee_pct} onChange={(value) => setNumber("channel_fee_pct", value)} />
              <PercentInput label="Cadangan pajak" hint="Sisihkan bila pajak ditanggung usaha" value={values.tax_reserve_pct} onChange={(value) => setNumber("tax_reserve_pct", value)} />
              <PercentInput label="Target margin" hint="Laba bersih dibanding harga jual" value={values.target_margin_pct} onChange={(value) => setNumber("target_margin_pct", value)} />
            </div>
          </div>

          <div className="border-t border-[#dedee8] pt-4">
            <h3 className="text-sm font-black">4. Target bulanan (opsional)</h3>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <MoneyInput label="Biaya tetap per bulan" hint="Sewa, gaji tetap, internet" value={values.monthly_fixed_cost} onChange={(value) => setNumber("monthly_fixed_cost", value)} />
              <MoneyInput label="Target laba owner per bulan" hint="Yang ingin dibawa pulang" value={values.monthly_profit_target} onChange={(value) => setNumber("monthly_profit_target", value)} />
            </div>
          </div>

          {presets.length > 0 && (
            <div className="border-t border-[#dedee8] pt-4">
              <h3 className="text-sm font-black">Perhitungan yang tersimpan</h3>
              <p className="mt-1 text-xs text-[#66667a]">Pilih untuk membuka dan melanjutkan hitungannya.</p>
              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                {presets.map((preset) => (
                  <button key={preset.id} type="button" onClick={() => loadPreset(preset)} className={`rounded-xl border p-3 text-left ${activePresetId === preset.id ? "border-[#232331] bg-[#d9ff57]" : "border-[#dedee8] bg-white hover:border-[#232331]"}`}>
                    <p className="truncate text-xs font-black">{preset.name}</p>
                    <p className="mt-1 text-[10px] text-[#66667a]">{MODES[preset.mode].label} · Harga {formatRupiah(Number(preset.selling_price))}</p>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        <aside className="space-y-3 lg:sticky lg:top-20 lg:self-start">
          <div className="rounded-2xl border-2 border-[#232331] bg-white p-4 shadow-ink-md sm:p-5">
            <p className="font-mono text-[10px] font-bold text-[#7958d8]">HASIL PER TRANSAKSI</p>
            <ResultRow label="Modal total" value={formatRupiah(result.cost_per_sale)} />
            <ResultRow label="Diskon dan fee" value={formatRupiah(result.total_deductions)} />
            <div className="mt-3 border-t-2 border-[#232331] pt-3"><p className="text-xs font-bold">Laba bersih</p><p className={`mt-1 text-2xl font-black ${result.profit_per_sale >= 0 ? "text-[#166534]" : "text-[#b91c1c]"}`}>{formatRupiah(result.profit_per_sale)}</p><p className="mt-1 text-xs text-[#66667a]">Margin {formatMarginPercent(result.margin_pct)} · Markup {formatMarginPercent(result.markup_pct)}</p></div>
          </div>

          <div className="rounded-2xl border-2 border-[#232331] bg-[#d9ff57] p-4 shadow-ink-md sm:p-5">
            <p className="font-mono text-[10px] font-bold">HARGA JUAL AMAN</p>
            {result.target_unreachable ? <p className="mt-2 text-sm font-bold">Target tidak bisa dihitung. Total diskon, fee, pajak cadangan, dan margin harus di bawah 100%.</p> : <><p className="mt-1 text-3xl font-black">{formatRupiah(result.recommended_price)}</p><p className="mt-2 text-xs leading-5">Harga ini sudah memasukkan modal, diskon, fee, cadangan pajak, dan target margin {values.target_margin_pct}%.</p></>}
          </div>

          <div className="rounded-2xl border-2 border-[#232331] bg-white p-4 shadow-ink-md sm:p-5">
            <div className="flex items-center gap-2"><TrendingUp size={16} className="text-[#7958d8]" /><p className="text-sm font-black">Target penjualan bulanan</p></div>
            {result.target_units === null ? <p className="mt-3 text-xs leading-5 text-[#b91c1c]">Isi harga jual di atas modal agar KAEL bisa menghitung target unit.</p> : <><p className="mt-3 text-sm text-[#66667a]">Balik modal: <b className="text-[#232331]">{result.break_even_units} transaksi</b></p><p className="mt-2 text-sm text-[#66667a]">Untuk biaya tetap dan target owner: <b className="text-[#232331]">{result.target_units} transaksi</b></p><p className="mt-2 text-xs text-[#66667a]">Setara omzet {formatRupiah(result.target_revenue)} per bulan.</p></>}
          </div>

          <div className="rounded-xl border border-[#dedee8] bg-[#fcfcfe] p-3 text-[11px] leading-5 text-[#5c5c70]">
            Fee pembayaran, fee kanal, dan cadangan pajak dihitung dari harga jual sebelum diskon agar hasilnya tidak terlalu optimistis. Gunakan angka fee efektif dari laporan provider Anda.
          </div>
        </aside>
      </div>
    </section>
  );
}

function MoneyInput({ label, hint, value, onChange }: { label: string; hint: string; value: number; onChange: (value: string) => void }) {
  return <label className="block"><span className="text-xs font-bold">{label}</span><span className="mt-0.5 block text-[10px] leading-4 text-[#7b7b8e]">{hint}</span><div className="mt-1.5 flex min-h-11 items-center rounded-lg border border-[#232331] bg-white"><span className="pl-3 text-xs font-bold text-[#66667a]">Rp</span><input type="number" min="0" inputMode="numeric" value={value || ""} onChange={(event) => onChange(event.target.value)} placeholder="0" className="min-w-0 flex-1 bg-transparent px-2 py-2 text-right text-sm font-black outline-none" /></div></label>;
}

function PercentInput({ label, hint, value, onChange }: { label: string; hint: string; value: number; onChange: (value: string) => void }) {
  return <label className="block"><span className="text-xs font-bold">{label}</span><span className="mt-0.5 block text-[10px] leading-4 text-[#7b7b8e]">{hint}</span><div className="mt-1.5 flex min-h-11 items-center rounded-lg border border-[#232331] bg-white"><input type="number" min="0" max="100" inputMode="decimal" value={value || ""} onChange={(event) => onChange(event.target.value)} placeholder="0" className="min-w-0 flex-1 bg-transparent px-3 py-2 text-right text-sm font-black outline-none" /><span className="pr-3 text-xs font-bold text-[#66667a]">%</span></div></label>;
}

function ResultRow({ label, value }: { label: string; value: string }) {
  return <div className="mt-3 flex items-center justify-between gap-3 text-sm"><span className="text-[#66667a]">{label}</span><span className="font-bold">{value}</span></div>;
}
