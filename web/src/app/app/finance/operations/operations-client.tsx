"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ArrowLeft, BriefcaseBusiness, Calculator, Landmark, Package, Plus, ReceiptText, TrendingDown, TrendingUp, WalletCards } from "lucide-react";
import type { Business, FinanceAsset, FinancePocket, FinanceSummary, FinanceTransaction, InventoryItem } from "@/lib/types";
import { adjustInventoryStockAction, createFinanceTransactionAction, recordInventoryPurchaseAction, saveFinanceAssetAction, saveFinancePocketAction, saveInventoryItemAction } from "@/lib/actions";
import { formatBusinessDate, formatRupiah } from "@/lib/formatters";
import { BusinessMark } from "@/components/business-mark";

const today = () => new Date().toISOString().slice(0, 10);

export default function FinanceOperationsClient({ 
  business, 
  pockets, 
  transactions, 
  assets, 
  inventory, 
  summary,
  themeClassName 
}: { 
  business: Business | null; 
  pockets: FinancePocket[]; 
  transactions: FinanceTransaction[]; 
  assets: FinanceAsset[]; 
  inventory: InventoryItem[]; 
  summary: FinanceSummary;
  themeClassName?: string;
}) {
  const [tab, setTab] = useState<"cash" | "pockets" | "assets" | "stock" | "report">("cash");
  const [busy, setBusy] = useState(false);
  const [cash, setCash] = useState({ type: "expense" as "income" | "expense", category: "Belanja stok", amount: "", occurred_on: today(), note: "", pocket_id: "" });
  const [pocket, setPocket] = useState({ name: "", allocation_pct: "" });
  const [asset, setAsset] = useState({ name: "", category: "Peralatan", acquired_on: today(), purchase_cost: "", salvage_value: "0", useful_life_months: "36" });
  const [item, setItem] = useState({ sku: "", name: "", unit: "pcs", reorder_level: "0" });
  const [purchase, setPurchase] = useState({ supplier_name: "", purchased_on: today(), note: "", inventory_item_id: "", qty: "", unit_cost: "" });
  const [adjustment, setAdjustment] = useState({ inventory_item_id: "", delta_qty: "", reason: "" });
  const allocation = pockets.reduce((sum, value) => sum + Number(value.allocation_pct), 0);
  const lowStock = inventory.filter((value) => Number(value.stock_qty) <= Number(value.reorder_level));
  const monthlyDepreciation = useMemo(() => assets.filter((value) => value.is_active).reduce((sum, value) => sum + (Number(value.purchase_cost) - Number(value.salvage_value)) / Number(value.useful_life_months), 0), [assets]);

  const run = async (action: () => Promise<{ ok: boolean; error?: string }>) => { 
    setBusy(true); 
    const result = await action(); 
    setBusy(false); 
    if (!result.ok) alert(result.error); 
    else window.location.reload(); 
  };
  const submitCash = () => run(() => createFinanceTransactionAction({ ...cash, amount: Number(cash.amount), pocket_id: cash.pocket_id || null }));
  const submitPocket = () => run(() => saveFinancePocketAction({ name: pocket.name, allocation_pct: Number(pocket.allocation_pct) }));
  const submitAsset = () => run(() => saveFinanceAssetAction({ ...asset, purchase_cost: Number(asset.purchase_cost), salvage_value: Number(asset.salvage_value), useful_life_months: Number(asset.useful_life_months), is_active: true }));
  const submitItem = () => run(() => saveInventoryItemAction({ ...item, sku: item.sku || null, reorder_level: Number(item.reorder_level) }));
  const submitPurchase = () => run(() => recordInventoryPurchaseAction({ supplier_name: purchase.supplier_name, purchased_on: purchase.purchased_on, note: purchase.note, items: [{ inventory_item_id: purchase.inventory_item_id, qty: Number(purchase.qty), unit_cost: Number(purchase.unit_cost) }] }));
  const submitAdjustment = () => run(() => adjustInventoryStockAction(adjustment.inventory_item_id, Number(adjustment.delta_qty), adjustment.reason));

  return (
    <div className={`${themeClassName || ""} min-h-screen bg-[#f0f5f2] text-[#1a382d] font-sans`}>
      {/* Sticky Emerald Header */}
      <header className="sticky top-0 z-30 border-b border-emerald-800/60 bg-[#0b3d2e] px-3 py-2.5 sm:py-3.5 text-white backdrop-blur-md sm:px-6 shadow-sm">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-2.5">
            <Link 
              href="/app/finance" 
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-emerald-600/40 bg-white/10 text-white hover:bg-white/15 transition-colors" 
              title="Kembali ke HPP"
            >
              <ArrowLeft size={16} />
            </Link>
            <BusinessMark
              name={business?.name}
              logoUrl={business?.logo_url}
              brandColor={business?.brand_color}
              className="h-8 w-8 shrink-0 rounded-full border border-emerald-400/40 bg-white p-0.5 shadow-xs"
            />
            <div className="min-w-0">
              <h1 className="truncate text-sm font-bold sm:text-base tracking-tight text-white">Keuangan Usaha</h1>
              <p className="truncate font-mono text-[10.5px] text-emerald-200/80">{business?.name || "Mochi Cafe"} · Arus Kas &amp; Buku Kas</p>
            </div>
          </div>
          <Link 
            href="/app/finance" 
            className="flex items-center gap-1.5 rounded-xl bg-[#c8f53a] hover:bg-[#b8e630] px-3 py-1.5 text-xs font-bold text-[#073829] shadow-xs transition-colors"
          >
            HPP &amp; Harga Jual
          </Link>
        </div>
      </header>

      <main className="mx-auto w-full max-w-6xl space-y-5 p-3 sm:p-6">
        {/* Metric Cards */}
        <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Metric label="Omzet POS" value={formatRupiah(summary.posRevenue)} icon={<TrendingUp size={16}/>} color="text-[#167052]"/>
          <Metric label="Kas Masuk Manual" value={formatRupiah(summary.income)} icon={<WalletCards size={16}/>} color="text-emerald-700"/>
          <Metric label="Kas Keluar" value={formatRupiah(summary.expenses)} icon={<TrendingDown size={16}/>} color="text-rose-600"/>
          <Metric label="Hasil Bulan Ini" value={formatRupiah(summary.netProfit)} icon={<Calculator size={16}/>} color={summary.netProfit >= 0 ? "text-[#167052]" : "text-rose-600"}/>
        </section>

        {/* Tab Navigation */}
        <nav className="flex gap-1.5 overflow-x-auto rounded-2xl border border-[#d8e3de] bg-white p-1.5 font-mono text-xs font-bold shadow-xs">
          {([
            ['cash','Kas',<ReceiptText size={14}/>],
            ['pockets','Kantong',<WalletCards size={14}/>],
            ['assets','Aset',<BriefcaseBusiness size={14}/>],
            ['stock','Stok',<Package size={14}/>],
            ['report','Laporan',<Landmark size={14}/>]
          ] as const).map(([key,label,icon]) => (
            <button 
              key={key} 
              onClick={() => setTab(key)} 
              className={`flex min-h-10 shrink-0 items-center gap-1.5 rounded-xl px-3.5 transition-colors ${
                tab === key ? 'bg-[#0b3d2e] text-[#c8f53a] shadow-xs' : 'text-[#527867] hover:bg-[#edf8f3]'
              }`}
            >
              {icon}
              {label}
            </button>
          ))}
        </nav>

        {tab === 'cash' && (
          <section className="grid gap-5 lg:grid-cols-[.85fr_1.15fr]">
            <Panel title="Catat Uang Masuk/Keluar" subtitle="Gunakan untuk transaksi operasional harian di luar kasir POS.">
              <div className="grid grid-cols-2 gap-2.5">
                <Select value={cash.type} onChange={v=>setCash({...cash,type:v as typeof cash.type})} options={[['expense','Uang keluar'],['income','Uang masuk']]}/>
                <Input value={cash.occurred_on} onChange={v=>setCash({...cash,occurred_on:v})} type="date"/>
              </div>
              <Input value={cash.category} onChange={v=>setCash({...cash,category:v})} placeholder="Kategori, misal: Sewa outlet, Beli es batu"/>
              <Input value={cash.amount} onChange={v=>setCash({...cash,amount:v})} type="number" placeholder="Nominal Rupiah"/>
              <Select value={cash.pocket_id} onChange={v=>setCash({...cash,pocket_id:v})} options={[['','Tanpa kantong'],...pockets.map(v=>[v.id,v.name] as [string,string])]}/>
              <Input value={cash.note} onChange={v=>setCash({...cash,note:v})} placeholder="Catatan (opsional)"/>
              <Button onClick={submitCash} busy={busy}>Simpan Transaksi</Button>
            </Panel>
            <Panel title="Buku Kas Terbaru" subtitle="100 transaksi operasional terakhir.">
              <div className="divide-y divide-[#d8e3de]">
                {transactions.map(v => (
                  <div key={v.id} className="flex items-center justify-between gap-3 py-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-bold text-[#0b3d2e]">{v.category}</p>
                      <p className="text-[11px] text-[#527867]">{formatBusinessDate(v.occurred_on)} · {v.note || 'Tanpa catatan'}</p>
                    </div>
                    <b className={`font-mono text-sm ${v.type==='income'?'text-[#167052]':'text-rose-600'}`}>
                      {v.type==='income'?'+':'-'}{formatRupiah(v.amount)}
                    </b>
                  </div>
                ))}
                {!transactions.length && <Empty text="Belum ada transaksi operasional manual."/>}
              </div>
            </Panel>
          </section>
        )}

        {tab === 'pockets' && (
          <section className="grid gap-5 lg:grid-cols-[.85fr_1.15fr]">
            <Panel title="Tambah Kantong Uang" subtitle={`Total alokasi kantong saat ini ${allocation.toFixed(0)}%.`}>
              <Input value={pocket.name} onChange={v=>setPocket({...pocket,name:v})} placeholder="Contoh: Modal belanja bahan, Tabungan sewa"/>
              <Input value={pocket.allocation_pct} onChange={v=>setPocket({...pocket,allocation_pct:v})} type="number" placeholder="Alokasi persen (misal: 30)"/>
              <Button onClick={submitPocket} busy={busy}>Tambah Kantong</Button>
            </Panel>
            <Panel title="Pembagian Uang Masuk" subtitle="Alokasi ideal arus kas untuk menjaga stabilitas bisnis.">
              <div className="grid gap-2.5 sm:grid-cols-2">
                {pockets.map(v => (
                  <div key={v.id} className="rounded-2xl border border-[#d8e3de] bg-[#fbfdfc] p-3.5">
                    <p className="font-bold text-[#0b3d2e]">{v.name}</p>
                    <p className="mt-1 font-mono text-xl font-black text-[#167052]">{Number(v.allocation_pct)}%</p>
                    <p className="mt-1 text-[11px] text-[#527867]">Dari uang masuk manual dan omzet POS yang dialokasikan.</p>
                  </div>
                ))}
                {!pockets.length && <Empty text="Buat kantong untuk modal bahan, gaji, operasional, dan profit owner."/>}
              </div>
            </Panel>
          </section>
        )}

        {tab === 'assets' && (
          <section className="grid gap-5 lg:grid-cols-[.85fr_1.15fr]">
            <Panel title="Catat Aset Bisnis" subtitle="Penyusutan dihitung otomatis memakai metode garis lurus.">
              <Input value={asset.name} onChange={v=>setAsset({...asset,name:v})} placeholder="Nama aset, misal: Mesin Espresso, Freezer"/>
              <Input value={asset.category} onChange={v=>setAsset({...asset,category:v})} placeholder="Kategori aset"/>
              <div className="grid grid-cols-2 gap-2.5">
                <Input value={asset.acquired_on} onChange={v=>setAsset({...asset,acquired_on:v})} type="date"/>
                <Input value={asset.useful_life_months} onChange={v=>setAsset({...asset,useful_life_months:v})} type="number" placeholder="Masa manfaat (bulan)"/>
              </div>
              <div className="grid grid-cols-2 gap-2.5">
                <Input value={asset.purchase_cost} onChange={v=>setAsset({...asset,purchase_cost:v})} type="number" placeholder="Harga beli Rp"/>
                <Input value={asset.salvage_value} onChange={v=>setAsset({...asset,salvage_value:v})} type="number" placeholder="Nilai sisa Rp"/>
              </div>
              <Button onClick={submitAsset} busy={busy}>Simpan Aset</Button>
            </Panel>
            <Panel title="Daftar Aset Aktif" subtitle={`Estimasi beban penyusutan ${formatRupiah(monthlyDepreciation)} / bulan.`}>
              <div className="divide-y divide-[#d8e3de]">
                {assets.map(v => (
                  <div key={v.id} className="flex items-center justify-between gap-3 py-3">
                    <div>
                      <p className="font-bold text-[#0b3d2e]">{v.name}</p>
                      <p className="text-[11px] text-[#527867]">{v.category} · {v.useful_life_months} bulan</p>
                    </div>
                    <b className="font-mono text-xs text-[#167052]">{formatRupiah((Number(v.purchase_cost)-Number(v.salvage_value))/Number(v.useful_life_months))}/bln</b>
                  </div>
                ))}
                {!assets.length && <Empty text="Belum ada aset fisik yang dicatatkan."/>}
              </div>
            </Panel>
          </section>
        )}

        {tab === 'stock' && (
          <section className="grid gap-5 lg:grid-cols-[.85fr_1.15fr]">
            <Panel title="Tambah Barang Stok" subtitle="Untuk retail, kemasan, atau bahan baku yang dibeli ulang.">
              <Input value={item.name} onChange={v=>setItem({...item,name:v})} placeholder="Nama barang stok"/>
              <div className="grid grid-cols-2 gap-2.5">
                <Input value={item.sku} onChange={v=>setItem({...item,sku:v})} placeholder="Kode/SKU (opsional)"/>
                <Input value={item.unit} onChange={v=>setItem({...item,unit:v})} placeholder="Satuan (pcs, pack, kg)"/>
              </div>
              <Input value={item.reorder_level} onChange={v=>setItem({...item,reorder_level:v})} type="number" placeholder="Stok minimum waspada"/>
              <Button onClick={submitItem} busy={busy}>Simpan Master Barang</Button>
              <hr className="border-[#d8e3de] my-2"/>
              <p className="text-xs font-bold text-[#0b3d2e]">Catat Belanja Stok Masuk</p>
              <Select value={purchase.inventory_item_id} onChange={v=>setPurchase({...purchase,inventory_item_id:v})} options={[['','Pilih barang'],...inventory.map(v=>[v.id,v.name] as [string,string])]}/>
              <div className="grid grid-cols-2 gap-2.5">
                <Input value={purchase.qty} onChange={v=>setPurchase({...purchase,qty:v})} type="number" placeholder="Jumlah beli"/>
                <Input value={purchase.unit_cost} onChange={v=>setPurchase({...purchase,unit_cost:v})} type="number" placeholder="Modal per unit"/>
              </div>
              <Input value={purchase.supplier_name} onChange={v=>setPurchase({...purchase,supplier_name:v})} placeholder="Nama supplier (opsional)"/>
              <Input value={purchase.purchased_on} onChange={v=>setPurchase({...purchase,purchased_on:v})} type="date"/>
              <Button onClick={submitPurchase} busy={busy}>Catat Pembelian Stok</Button>
              <hr className="border-[#d8e3de] my-2"/>
              <p className="text-xs font-bold text-[#0b3d2e]">Penyesuaian Stok (Koreksi/Rusak)</p>
              <Select value={adjustment.inventory_item_id} onChange={v=>setAdjustment({...adjustment,inventory_item_id:v})} options={[['','Pilih barang'],...inventory.map(v=>[v.id,v.name] as [string,string])]}/>
              <div className="grid grid-cols-2 gap-2.5">
                <Input value={adjustment.delta_qty} onChange={v=>setAdjustment({...adjustment,delta_qty:v})} type="number" placeholder="Contoh: -2 atau 5"/>
                <Input value={adjustment.reason} onChange={v=>setAdjustment({...adjustment,reason:v})} placeholder="Alasan: Kadaluarsa, rusak"/>
              </div>
              <Button onClick={submitAdjustment} busy={busy}>Simpan Penyesuaian</Button>
            </Panel>
            <Panel title="Stok Saat Ini" subtitle={lowStock.length ? `⚠️ ${lowStock.length} barang di bawah batas minimum.` : 'Semua stok dalam kondisi aman.'}>
              <div className="divide-y divide-[#d8e3de]">
                {inventory.map(v => (
                  <div key={v.id} className="flex items-center justify-between gap-3 py-3">
                    <div>
                      <p className="font-bold text-[#0b3d2e]">{v.name}</p>
                      <p className="text-[11px] text-[#527867]">Modal rata-rata {formatRupiah(v.average_cost)}/{v.unit} · Min. {v.reorder_level}</p>
                    </div>
                    <b className={`font-mono text-xs ${Number(v.stock_qty)<=Number(v.reorder_level)?'text-rose-600 font-black':'text-[#167052]'}`}>
                      {v.stock_qty} {v.unit}
                    </b>
                  </div>
                ))}
                {!inventory.length && <Empty text="Tambahkan barang sebelum mencatat pembelian."/>}
              </div>
            </Panel>
          </section>
        )}

        {tab === 'report' && (
          <section className="grid gap-5 lg:grid-cols-2">
            <Panel title="Laba Rugi Bulan Berjalan" subtitle="Estimasi real-time berdasarkan transaksi kas dan POS terpetakan.">
              <Rows rows={[
                ["Omzet dari POS", summary.posRevenue],
                ["HPP terpetakan", -summary.estimatedCogs],
                ["Laba kotor estimasi", summary.grossProfit],
                ["Pendapatan lain", summary.income],
                ["Beban operasional", -summary.operatingExpenses],
                ["Penyusutan aset", -summary.depreciation],
                ["Laba bersih estimasi", summary.netProfit]
              ]}/>
              <p className="border-t border-[#d8e3de] pt-3 text-[11px] text-[#527867]">
                Cakupan HPP: {formatRupiah(summary.hppCoverageRevenue)} dari total omzet POS.
              </p>
            </Panel>
            <Panel title="Target Balik Modal (BEP)" subtitle="Target minimal untuk menutup seluruh biaya tetap dan penyusutan bulan ini.">
              <p className="font-mono text-3xl font-black text-[#0b3d2e]">{formatRupiah(summary.breakEvenRevenue)}</p>
              <p className="mt-2 text-xs leading-relaxed text-[#527867]">
                Target omzet di atas diperlukan untuk menyeimbangkan pengeluaran tetap. Pastikan menu di POS sudah terhubung ke resep agar perhitungan semakin akurat.
              </p>
              <Link 
                href="/app/pos/reports" 
                className="mt-4 inline-flex min-h-11 items-center justify-center rounded-xl bg-[#0b3d2e] px-4 text-xs font-bold text-[#c8f53a] hover:bg-[#0e4837] transition-colors"
              >
                Buka Laporan POS &amp; Omzet
              </Link>
            </Panel>
          </section>
        )}
      </main>
    </div>
  );
}

function Input({ value, onChange, placeholder='', type='text' }: { value: string; onChange: (v: string) => void; placeholder?: string; type?: string }) {
  return (
    <input 
      value={value} 
      onChange={e => onChange(e.target.value)} 
      placeholder={placeholder} 
      type={type} 
      className="min-h-11 w-full rounded-xl border border-[#d8e3de] bg-[#fbfdfc] px-3.5 text-xs font-semibold text-[#1a382d] placeholder:text-[#527867]/50 focus:border-emerald-600 focus:bg-white focus:outline-none focus:ring-1 focus:ring-emerald-600 transition-all"
    />
  );
}

function Select({ value, onChange, options }: { value: string; onChange: (v: string) => void; options: [string, string][] }) {
  return (
    <select 
      value={value} 
      onChange={e => onChange(e.target.value)} 
      className="min-h-11 w-full rounded-xl border border-[#d8e3de] bg-[#fbfdfc] px-3.5 text-xs font-semibold text-[#1a382d] focus:border-emerald-600 focus:bg-white focus:outline-none focus:ring-1 focus:ring-emerald-600 transition-all"
    >
      {options.map(([v, l]) => <option value={v} key={v}>{l}</option>)}
    </select>
  );
}

function Button({ onClick, busy, children }: { onClick: () => void; busy: boolean; children: React.ReactNode }) {
  return (
    <button 
      type="button" 
      onClick={onClick} 
      disabled={busy} 
      className="flex min-h-11 w-full items-center justify-center rounded-xl bg-[#0b3d2e] hover:bg-[#0e4837] px-4 text-xs font-bold text-[#c8f53a] shadow-xs disabled:opacity-50 transition-colors"
    >
      <Plus size={14} className="mr-1 inline stroke-[2.5]" />
      {busy ? 'Menyimpan...' : children}
    </button>
  );
}

function Panel({ title, subtitle, children }: { title: string; subtitle: string; children: React.ReactNode }) {
  return (
    <div className="rounded-3xl border border-[#d8e3de] bg-white p-5 sm:p-6 shadow-[0_4px_20px_rgba(11,61,46,0.04)]">
      <div className="border-b border-[#d8e3de] pb-3">
        <h2 className="text-sm font-bold text-[#0b3d2e]">{title}</h2>
        <p className="mt-1 text-xs text-[#527867]">{subtitle}</p>
      </div>
      <div className="mt-4 space-y-3.5">{children}</div>
    </div>
  );
}

function Metric({ label, value, icon, color }: { label: string; value: string; icon: React.ReactNode; color: string }) {
  return (
    <div className="rounded-2xl border border-[#d8e3de] bg-white p-3.5 sm:p-4 shadow-[0_4px_20px_rgba(11,61,46,0.04)]">
      <div className={`flex items-center justify-between ${color}`}>
        <span className="font-mono text-[9.5px] font-bold tracking-wider uppercase text-[#527867]">{label}</span>
        {icon}
      </div>
      <p className="mt-2.5 truncate font-mono text-base sm:text-lg font-black text-[#0b3d2e]">{value}</p>
    </div>
  );
}

function Rows({ rows }: { rows: [string, number][] }) {
  return (
    <div className="space-y-3 font-mono text-xs">
      {rows.map(([label, value], i) => (
        <div key={label} className={`flex justify-between items-center py-1 ${i === rows.length - 1 ? 'border-t border-[#d8e3de] pt-3 font-black text-sm text-[#0b3d2e]' : 'text-[#527867]'}`}>
          <span>{label}</span>
          <span className={value < 0 ? 'text-rose-600 font-bold' : 'text-[#167052] font-bold'}>
            {value < 0 ? '-' : ''}{formatRupiah(Math.abs(value))}
          </span>
        </div>
      ))}
    </div>
  );
}

function Empty({ text }: { text: string }) {
  return <p className="py-8 text-center text-xs text-[#527867]">{text}</p>;
}
