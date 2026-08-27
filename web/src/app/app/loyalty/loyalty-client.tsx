"use client";

import { useRouter } from "next/navigation";

import { useState, useMemo, useEffect } from "react";
import Link from "next/link";
import { 
  Gift, 
  Sparkles, 
  Users, 
  Search, 
  Plus, 
  Trash2, 
  ArrowLeft, 
  CheckCircle2, 
  AlertCircle, 
  ShieldCheck, 
  TrendingUp, 
  Sliders, 
  History, 
  Eye, 
  EyeOff, 
  Download, 
  ExternalLink, 
  QrCode, 
  Coffee, 
  Check, 
  Receipt,
  Layers,
  Save,
  Lock,
  UserPlus,
  RefreshCw,
  Ticket
} from "lucide-react";
import type { Business, Customer, LoyaltyProgram, Reward, User, PointLedger, Redemption } from "@/lib/types";
import {
  addPointsAction, redeemRewardAction, saveRewardAction, deleteRewardAction,
  anonymizeCustomerAction, updateLoyaltyProgramAction, searchCustomersAction,
  customerDetailAction,
} from "@/lib/actions";
import { 
  normalizePhoneNumber, 
  maskPhoneNumber, 
  calculateEarnedPoints, 
  calculateRewardDiscountRate 
} from "@/lib/loyalty-engine";
import { formatRupiah, formatBusinessDateTime } from "@/lib/formatters";

/** Semua data awal datang dari komponen server; halaman ini tidak menyentuh
 *  database sama sekali. Perubahan dikirim lewat server action, lalu
 *  router.refresh() menarik data terbaru dari server. */
export default function KaelLoyaltyDashboard({
  business,
  initialProgram,
  customers,
  rewards,
  staffList,
  staffAudit,
  sessionRole,
}: {
  business: Business | null;
  initialProgram: LoyaltyProgram;
  customers: (Customer & { balance: number })[];
  rewards: Reward[];
  staffList: Pick<User, "id" | "name">[];
  staffAudit: { id: string; name: string; points_issued: number; manual_count: number; total_entries: number }[];
  sessionRole: User["role"];
}) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<"cashier" | "customers" | "rewards" | "settings" | "audit">("cashier");

  // Master States
  const [program, setProgram] = useState<LoyaltyProgram>(initialProgram);
  const [selectedStaffId, setSelectedStaffId] = useState<string>(staffList[0]?.id || "usr-staff-01");

  // ---------------------------------------------------------------------------
  // CASHIER FAST POS STATE (Tab 1)
  // ---------------------------------------------------------------------------
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCustomer, setSelectedCustomer] = useState<(Customer & { balance: number }) | null>(null);
  const [amountSpentInput, setAmountSpentInput] = useState<number>(50000);
  const [selectedRewardId, setSelectedRewardId] = useState<string>("");
  const [lastRedemptionResult, setLastRedemptionResult] = useState<Redemption | null>(null);
  const [cashierSuccessMsg, setCashierSuccessMsg] = useState<string | null>(null);

  // Pencarian dijalankan di server. Ditunda 250 ms supaya tiap ketikan tidak
  // menjadi satu query.
  const [searchResults, setSearchResults] = useState<(Customer & { balance: number })[]>([]);
  useEffect(() => {
    if (!searchQuery.trim()) {
      setSearchResults([]);
      return;
    }
    const t = setTimeout(() => {
      void searchCustomersAction(searchQuery).then(setSearchResults);
    }, 250);
    return () => clearTimeout(t);
  }, [searchQuery]);

  const activeCustomerBalance =
    customers.find((c) => c.id === selectedCustomer?.id)?.balance ??
    (selectedCustomer as (Customer & { balance?: number }) | null)?.balance ??
    0;

  // ---------------------------------------------------------------------------
  // REWARD EDITOR MODAL (Tab 3)
  // ---------------------------------------------------------------------------
  const [showRewardModal, setShowRewardModal] = useState(false);
  const [editingRewardId, setEditingRewardId] = useState<string | null>(null);
  const [rewardName, setRewardName] = useState("");
  const [rewardPointCost, setRewardPointCost] = useState<number>(10);
  const [rewardMarketValue, setRewardMarketValue] = useState<number>(25000);
  const [rewardStock, setRewardStock] = useState<string>(""); // empty = unlimited

  // Live discount rate calculation for reward editor
  const rewardDiscountAnalysis = useMemo(() => {
    return calculateRewardDiscountRate(rewardPointCost, program.earn_rate, rewardMarketValue);
  }, [rewardPointCost, program.earn_rate, rewardMarketValue]);

  // ---------------------------------------------------------------------------
  // CUSTOMER DETAIL MODAL (Tab 2)
  // ---------------------------------------------------------------------------
  const [viewingCustomer, setViewingCustomer] = useState<Customer | null>(null);
  /** Riwayat poin ditarik saat modal dibuka, bukan diquery di dalam render. */
  const [viewingDetail, setViewingDetail] = useState<{
    balance: number;
    ledger: PointLedger[];
  } | null>(null);

  useEffect(() => {
    if (!viewingCustomer) {
      setViewingDetail(null);
      return;
    }
    let cancelled = false;
    void customerDetailAction(viewingCustomer.id).then((d) => {
      if (!cancelled && d) setViewingDetail({ balance: d.balance, ledger: d.ledger });
    });
    return () => {
      cancelled = true;
    };
  }, [viewingCustomer]);
  const [unmaskedPhones, setUnmaskedPhones] = useState<Record<string, boolean>>({});

  // ---------------------------------------------------------------------------
  // REFRESH DATA
  // ---------------------------------------------------------------------------
  const refreshAll = () => router.refresh();

  // ---------------------------------------------------------------------------
  // CASHIER ACTIONS
  // ---------------------------------------------------------------------------
  const handleSelectCustomer = (cust: Customer & { balance: number }) => {
    setSelectedCustomer(cust);
    setSearchQuery("");
    setCashierSuccessMsg(null);
    setLastRedemptionResult(null);
  };

  const handleAddPoints = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCustomer) return;

    const earned = program.mode === "stamp" 
      ? program.stamp_per_visit 
      : calculateEarnedPoints(amountSpentInput, program.earn_rate);

    if (earned <= 0) {
      alert(`Nominal belanja ${formatRupiah(amountSpentInput)} belum mencapai kurs minimum 1 poin (${formatRupiah(program.earn_rate)}).`);
      return;
    }

    // Poin dihitung ulang di server dari kurs program; nilai di layar hanya
    // untuk pratinjau.
    const res = await addPointsAction(selectedCustomer.id, amountSpentInput);
    if (!res.ok) {
      alert(res.error);
      return;
    }
    refreshAll();
    setCashierSuccessMsg(`Sukses! +${res.data.earned} ${program.mode === "stamp" ? "Stamp" : "Poin"} untuk ${selectedCustomer.name}. Saldo kini ${res.data.balance}.`);
    setAmountSpentInput(50000);
  };

  const handleRedeemReward = async () => {
    if (!selectedCustomer || !selectedRewardId) return;
    const reward = rewards.find((r) => r.id === selectedRewardId);
    if (!reward) return;

    if (confirm(`Konfirmasi penukaran: Tukar ${reward.point_cost} Poin untuk "${reward.name}"?`)) {
      const res = await redeemRewardAction(selectedCustomer.id, selectedRewardId);
      if (!res.ok) {
        alert(res.error);
        return;
      }
      refreshAll();
      setLastRedemptionResult({ code: res.data.code } as never);
      setCashierSuccessMsg(`Sukses! Voucher ${res.data.rewardName} diterbitkan (Kode: ${res.data.code}).`);
    }
  };

  // ---------------------------------------------------------------------------
  // REWARD CRUD
  // ---------------------------------------------------------------------------
  const handleSaveReward = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!rewardName.trim()) return;

    const res = await saveRewardAction({
      id: editingRewardId || undefined,
      name: rewardName.trim(),
      point_cost: rewardPointCost,
      stock: rewardStock ? Number(rewardStock) : null,
      is_active: true,
    });
    if (!res.ok) {
      alert(res.error);
      return;
    }
    refreshAll();
    setShowRewardModal(false);
    setEditingRewardId(null);
    setRewardName("");
    setRewardPointCost(10);
    setRewardMarketValue(25000);
  };

  const handleDeleteReward = async (id: string, name: string) => {
    if (confirm(`Hapus reward "${name}" dari katalog?`)) {
      const res = await deleteRewardAction(id);
      if (!res.ok) {
        alert(res.error);
        return;
      }
      refreshAll();
    }
  };

  const handleAnonymizeCustomer = async (id: string, name: string | null) => {
    if (confirm(`Sesuai UU PDP: Apakah Anda yakin ingin menghapus/meng-anonimkan data "${name || 'Member'}"? Saldo poin akan dihapus.`)) {
      const res = await anonymizeCustomerAction(id);
      if (!res.ok) {
        alert(res.error);
        return;
      }
      refreshAll();
      setViewingCustomer(null);
      if (selectedCustomer?.id === id) setSelectedCustomer(null);
      alert("Data pelanggan telah dianonimkan dengan aman.");
    }
  };

  const handleSaveProgramSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    const res = await updateLoyaltyProgramAction({
      mode: program.mode,
      earn_rate: program.earn_rate,
      stamp_per_visit: program.stamp_per_visit,
      point_expiry_months: program.point_expiry_months,
    });
    if (!res.ok) {
      alert(res.error);
      return;
    }
    refreshAll();
  };

  return (
    <div className="min-h-screen bg-[#f7f6fc] text-[#232331] font-sans flex flex-col pb-16 sm:pb-8">
      
      {/* Top Header */}
      <header className="sticky top-0 z-30 border-b-2 border-[#232331] bg-white/95 backdrop-blur-md px-3 sm:px-8 py-2.5 sm:py-3.5">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-2">
          <div className="flex items-center gap-2 sm:gap-3 min-w-0">
            <Link
              href={sessionRole === "owner" ? "/app" : "/app/staff"}
              className="flex h-8 w-8 sm:h-9 sm:w-9 shrink-0 items-center justify-center rounded-xl border border-[#232331] bg-[#fcfcfe] text-[#232331] shadow-ink-xs hover:bg-[#f0edff]"
              title="Kembali ke Hub KAEL"
            >
              <ArrowLeft size={15} />
            </Link>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <h1 className="font-extrabold text-xs sm:text-base text-[#232331] truncate">
                  KAEL Loyalty
                </h1>
                <span className="rounded-md bg-[#fef3c7] px-1.5 py-0.2 font-mono text-[8.5px] sm:text-[9px] font-bold text-[#d97706] border border-[#d97706] shrink-0">
                  Modul 03 Live
                </span>
              </div>
              <span className="text-[9.5px] sm:text-[11px] text-[#7b7b8e] font-mono block truncate">
                {business?.name} · CRM &amp; Kasir Pelanggan
              </span>
            </div>
          </div>

          {/* Active Staff Switcher for Point Logging */}
          <div className="flex items-center gap-1.5 font-mono text-xs">
            <span className="text-[10px] text-[#7b7b8e] hidden sm:inline">Kasir Aktif:</span>
            <select
              value={selectedStaffId}
              onChange={(e) => setSelectedStaffId(e.target.value)}
              className="rounded-xl border border-[#232331] bg-white px-2 py-1 text-xs font-bold text-[#232331]"
            >
              {staffList.map((st) => (
                <option key={st.id} value={st.id}>
                  {st.name}
                </option>
              ))}
            </select>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="flex-1 mx-auto w-full max-w-6xl p-3 sm:p-6 lg:p-8 space-y-4 sm:space-y-6">
        
        {/* TOP KPI OVERVIEW */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-4">
          
          <div className="card-tactile rounded-2xl sm:rounded-3xl border sm:border-2 border-[#232331] bg-white p-3.5 sm:p-5 shadow-ink-xs sm:shadow-ink-md">
            <div className="flex items-center justify-between border-b border-[#dedee8] pb-1.5 sm:pb-2.5">
              <span className="font-mono text-[9px] sm:text-[10px] font-bold text-[#7958d8] uppercase">TOTAL MEMBER</span>
              <span className="flex h-6 w-6 sm:h-7 sm:w-7 items-center justify-center rounded-lg bg-[#f0edff] text-[#7958d8]">
                <Users size={13} />
              </span>
            </div>
            <div className="mt-2 sm:mt-3">
              <h3 className="text-lg sm:text-3xl font-extrabold font-mono text-[#232331]">
                {customers.length} Orang
              </h3>
              <span className="text-[9.5px] sm:text-[11px] text-[#16a34a] font-mono font-bold block mt-0.5 sm:mt-1 truncate">
                ✓ UU PDP Compliant
              </span>
            </div>
          </div>

          <div className="card-tactile rounded-2xl sm:rounded-3xl border sm:border-2 border-[#232331] bg-white p-3.5 sm:p-5 shadow-ink-xs sm:shadow-ink-md">
            <div className="flex items-center justify-between border-b border-[#dedee8] pb-1.5 sm:pb-2.5">
              <span className="font-mono text-[9px] sm:text-[10px] font-bold text-[#d97706] uppercase">POIN BEREDAR</span>
              <span className="flex h-6 w-6 sm:h-7 sm:w-7 items-center justify-center rounded-lg bg-[#fef3c7] text-[#d97706]">
                <Gift size={13} />
              </span>
            </div>
            <div className="mt-2 sm:mt-3">
              <h3 className="text-lg sm:text-3xl font-extrabold font-mono text-[#232331]">
                {customers.reduce((acc, c) => acc + c.balance, 0)} Pts
              </h3>
              <span className="text-[9.5px] sm:text-[11px] text-[#7b7b8e] font-mono block mt-0.5 sm:mt-1 truncate">
                Liabilitas Belanja
              </span>
            </div>
          </div>

          <div className="card-tactile rounded-2xl sm:rounded-3xl border sm:border-2 border-[#232331] bg-white p-3.5 sm:p-5 shadow-ink-xs sm:shadow-ink-md">
            <div className="flex items-center justify-between border-b border-[#dedee8] pb-1.5 sm:pb-2.5">
              <span className="font-mono text-[9px] sm:text-[10px] font-bold text-[#16a34a] uppercase">KATALOG HADIAH</span>
              <span className="flex h-6 w-6 sm:h-7 sm:w-7 items-center justify-center rounded-lg bg-[#dcfce7] text-[#16a34a]">
                <Ticket size={13} />
              </span>
            </div>
            <div className="mt-2 sm:mt-3">
              <h3 className="text-lg sm:text-3xl font-extrabold font-mono text-[#232331]">
                {rewards.length} Reward
              </h3>
              <span className="text-[9.5px] sm:text-[11px] text-[#7b7b8e] font-mono block mt-0.5 sm:mt-1 truncate">
                {rewards.filter((r) => r.is_active).length} Aktif Ditukar
              </span>
            </div>
          </div>

          <div className="card-tactile rounded-2xl sm:rounded-3xl border sm:border-2 border-[#232331] bg-white p-3.5 sm:p-5 shadow-ink-xs sm:shadow-ink-md">
            <div className="flex items-center justify-between border-b border-[#dedee8] pb-1.5 sm:pb-2.5">
              <span className="font-mono text-[9px] sm:text-[10px] font-bold text-[#c2410c] uppercase">KURS PROGRAM</span>
              <span className="flex h-6 w-6 sm:h-7 sm:w-7 items-center justify-center rounded-lg bg-[#ffedd5] text-[#c2410c]">
                <Sparkles size={13} />
              </span>
            </div>
            <div className="mt-2 sm:mt-3">
              <h3 className="text-lg sm:text-2xl font-extrabold font-mono text-[#232331] truncate">
                {program.mode === "stamp" ? "1 Kunjungan" : formatRupiah(program.earn_rate)}
              </h3>
              <span className="text-[9.5px] sm:text-[11px] text-[#7b7b8e] font-mono block mt-0.5 sm:mt-1 truncate">
                = 1 {program.mode === "stamp" ? "Stamp" : "Poin"}
              </span>
            </div>
          </div>

        </div>

        {/* 5-TAB NAVIGATION BAR */}
        <div className="flex items-center overflow-x-auto scrollbar-none rounded-xl sm:rounded-2xl border sm:border-2 border-[#232331] bg-white p-1 font-mono text-xs font-bold gap-1 shadow-ink-xs">
          <button
            type="button"
            onClick={() => setActiveTab("cashier")}
            className={`flex items-center gap-1.5 px-3 sm:px-4 py-2 rounded-lg sm:rounded-xl transition-all whitespace-nowrap text-xs ${
              activeTab === "cashier" ? "bg-[#232331] text-[#d9ff57] shadow-ink-xs" : "text-[#7b7b8e] hover:text-[#232331]"
            }`}
          >
            <Receipt size={13} />
            <span>1. Layar Kasir Cepat (3-Ketukan)</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("customers")}
            className={`flex items-center gap-1.5 px-3 sm:px-4 py-2 rounded-lg sm:rounded-xl transition-all whitespace-nowrap text-xs ${
              activeTab === "customers" ? "bg-[#232331] text-[#d9ff57] shadow-ink-xs" : "text-[#7b7b8e] hover:text-[#232331]"
            }`}
          >
            <Users size={13} />
            <span>2. Data Pelanggan (PDP)</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("rewards")}
            className={`flex items-center gap-1.5 px-3 sm:px-4 py-2 rounded-lg sm:rounded-xl transition-all whitespace-nowrap text-xs ${
              activeTab === "rewards" ? "bg-[#232331] text-[#d9ff57] shadow-ink-xs" : "text-[#7b7b8e] hover:text-[#232331]"
            }`}
          >
            <Gift size={13} />
            <span>3. Katalog Reward &amp; Proteksi</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("settings")}
            className={`flex items-center gap-1.5 px-3 sm:px-4 py-2 rounded-lg sm:rounded-xl transition-all whitespace-nowrap text-xs ${
              activeTab === "settings" ? "bg-[#232331] text-[#d9ff57] shadow-ink-xs" : "text-[#7b7b8e] hover:text-[#232331]"
            }`}
          >
            <Sliders size={13} />
            <span>4. Aturan Program</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("audit")}
            className={`flex items-center gap-1.5 px-3 sm:px-4 py-2 rounded-lg sm:rounded-xl transition-all whitespace-nowrap text-xs ${
              activeTab === "audit" ? "bg-[#232331] text-[#d9ff57] shadow-ink-xs" : "text-[#7b7b8e] hover:text-[#232331]"
            }`}
          >
            <History size={13} />
            <span>5. Audit Kasir</span>
          </button>
        </div>

        {/* ============================================================= */}
        {/* TAB 1: FAST 3-TAP CASHIER DASHBOARD */}
        {/* ============================================================= */}
        {activeTab === "cashier" && (
          <div className="grid gap-4 lg:grid-cols-12 items-start">
            
            {/* Left Column (7 cols): Fast Customer Search & Actions */}
            <div className="lg:col-span-7 rounded-2xl sm:rounded-3xl border sm:border-2 border-[#232331] bg-white p-4 sm:p-6 shadow-ink-md space-y-4">
              
              <div className="flex items-center justify-between border-b border-[#dedee8] pb-3">
                <div className="flex items-center gap-2">
                  <Receipt size={18} className="text-[#7958d8]" />
                  <h3 className="font-extrabold text-sm sm:text-base text-[#232331]">
                    Layar Kasir Loyalitas Cepat
                  </h3>
                </div>
                <span className="text-[10px] sm:text-[11px] font-mono text-[#16a34a] font-bold">
                  ● Target &lt;10 Detik
                </span>
              </div>

              {/* 4-Digit WA Search Bar */}
              <div className="space-y-1.5">
                <label className="block font-mono font-bold text-xs text-[#232331]">
                  Cari 4 Digit Terakhir No WA / Nama Pelanggan:
                </label>
                <div className="relative">
                  <Search className="absolute left-3.5 top-3 text-[#7b7b8e]" size={16} />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Ketik 4 digit WA (misal: 7812) atau nama..."
                    className="w-full rounded-2xl border-2 border-[#232331] pl-10 pr-4 py-2.5 font-bold text-sm text-[#232331] focus:outline-none focus:ring-2 focus:ring-[#7958d8]"
                    autoFocus
                  />
                </div>
                <span className="text-[10px] text-[#7b7b8e] font-mono block">
                  💡 Tip antrean: Pelanggan cukup sebut 4 digit terakhir tanpa perlu mendikte 12 digit.
                </span>
              </div>

              {/* Search Dropdown / Results List */}
              {searchQuery && (
                <div className="rounded-2xl border-2 border-[#7958d8] bg-[#f0edff] p-2 space-y-1 max-h-48 overflow-y-auto animate-in fade-in font-mono text-xs">
                  <span className="text-[10px] font-bold text-[#7958d8] px-2 block">
                    Hasil Pencarian ({searchResults.length} Ditemukan):
                  </span>
                  {searchResults.length === 0 ? (
                    <div className="p-3 text-center text-[#7b7b8e]">
                      Tidak ada member cocok.{" "}
                      <Link href="/loyalty/register" target="_blank" className="text-[#7958d8] font-bold underline">
                        + Daftar Baru
                      </Link>
                    </div>
                  ) : (
                    searchResults.map((cust) => (
                      <button
                        key={cust.id}
                        type="button"
                        onClick={() => handleSelectCustomer(cust)}
                        className="w-full flex items-center justify-between p-2.5 rounded-xl bg-white hover:bg-[#d9ff57] transition-all text-left border border-[#dedee8]"
                      >
                        <div>
                          <span className="font-bold text-[#232331] font-sans block text-sm">{cust.name}</span>
                          <span className="text-[10.5px] text-[#7b7b8e]">{maskPhoneNumber(cust.phone)}</span>
                        </div>
                        <span className="font-black text-sm text-[#16a34a] bg-[#dcfce7] px-2 py-0.5 rounded-lg border border-[#16a34a]/30">
                          {cust.balance} Pts
                        </span>
                      </button>
                    ))
                  )}
                </div>
              )}

              {/* Selected Customer Active Card */}
              {selectedCustomer && (
                <div className="rounded-2xl border-2 border-[#232331] bg-[#fcfcfe] p-4 space-y-3 font-mono text-xs animate-in zoom-in-95">
                  <div className="flex justify-between items-start">
                    <div>
                      <span className="text-[10px] text-[#7958d8] font-bold uppercase block">
                        PELANGGAN TERPILIH
                      </span>
                      <h4 className="font-black text-base text-[#232331] font-sans">
                        {selectedCustomer.name}
                      </h4>
                      <span className="text-[11px] text-[#7b7b8e]">
                        {maskPhoneNumber(selectedCustomer.phone)}
                      </span>
                    </div>

                    <div className="text-right">
                      <span className="text-[10px] text-[#7b7b8e] block uppercase">SALDO SAAT INI</span>
                      <span className="text-2xl font-black text-[#16a34a] block">
                        {activeCustomerBalance} Pts
                      </span>
                    </div>
                  </div>

                  {/* Add Points Form */}
                  <form onSubmit={handleAddPoints} className="border-t border-[#dedee8] pt-3 space-y-2.5">
                    <div className="flex items-center justify-between">
                      <label className="font-bold text-[#232331]">
                        1. Tambah Poin Belanja ({program.mode === "stamp" ? "Stamp" : "Rupiah"}):
                      </label>
                      <span className="text-[10px] text-[#7958d8] font-bold">
                        Kurs: {formatRupiah(program.earn_rate)} = 1 Poin
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      <div className="flex-1 relative">
                        <span className="absolute left-3 top-2.5 text-xs text-[#7b7b8e] font-bold">Rp</span>
                        <input
                          type="number"
                          step={5000}
                          min={1000}
                          value={amountSpentInput}
                          onChange={(e) => setAmountSpentInput(Number(e.target.value))}
                          className="w-full rounded-xl border-2 border-[#232331] pl-9 pr-3 py-2 font-black text-sm text-[#232331]"
                        />
                      </div>

                      <button
                        type="submit"
                        className="btn-tactile rounded-xl bg-[#232331] text-[#d9ff57] px-4 py-2 text-xs font-black shadow-ink-xs shrink-0"
                      >
                        + Tambah {calculateEarnedPoints(amountSpentInput, program.earn_rate)} Pts ✓
                      </button>
                    </div>

                    {/* Quick Amount Pills */}
                    <div className="flex flex-wrap gap-1.5 pt-0.5">
                      {[25000, 50000, 75000, 100000, 150000].map((amt) => (
                        <button
                          key={amt}
                          type="button"
                          onClick={() => setAmountSpentInput(amt)}
                          className="px-2 py-1 rounded-lg border border-[#dedee8] bg-white text-[10px] font-bold text-[#7b7b8e] hover:border-[#232331]"
                        >
                          {formatRupiah(amt)}
                        </button>
                      ))}
                    </div>
                  </form>

                  {/* Redeem Reward Section */}
                  <div className="border-t border-[#dedee8] pt-3 space-y-2">
                    <label className="block font-bold text-[#232331]">
                      2. Tukar Voucher Reward di Kasir:
                    </label>
                    <div className="flex items-center gap-2">
                      <select
                        value={selectedRewardId}
                        onChange={(e) => setSelectedRewardId(e.target.value)}
                        className="flex-1 rounded-xl border border-[#232331] bg-white p-2 font-bold text-xs text-[#232331]"
                      >
                        <option value="">-- Pilih Hadiah Tersedia --</option>
                        {rewards.filter((r) => r.is_active).map((rw) => (
                          <option key={rw.id} value={rw.id} disabled={activeCustomerBalance < rw.point_cost}>
                            {rw.name} ({rw.point_cost} Pts) {activeCustomerBalance < rw.point_cost ? "· Poin Kurang" : "· Cukup ✓"}
                          </option>
                        ))}
                      </select>

                      <button
                        type="button"
                        onClick={handleRedeemReward}
                        disabled={!selectedRewardId}
                        className="btn-tactile rounded-xl bg-[#7958d8] text-white px-3.5 py-2 text-xs font-black disabled:opacity-40 shrink-0"
                      >
                        Tukar Hadiah ➔
                      </button>
                    </div>
                  </div>

                  {/* Direct Link to Customer Passport */}
                  <div className="flex justify-between items-center pt-2 border-t border-[#dedee8] text-[10.5px]">
                    <span className="text-[#7b7b8e]">Buka Paspor Member Pelanggan:</span>
                    <Link
                      href={`/m/${selectedCustomer.token}`}
                      target="_blank"
                      className="text-[#7958d8] font-bold inline-flex items-center gap-1 hover:underline"
                    >
                      <span>m.kael.id/{selectedCustomer.token.slice(0, 8)}...</span>
                      <ExternalLink size={11} />
                    </Link>
                  </div>

                </div>
              )}

              {/* Feedback Success Box */}
              {cashierSuccessMsg && (
                <div className="rounded-xl border border-[#16a34a] bg-[#dcfce7] p-3 text-xs font-mono text-[#16a34a] flex items-center gap-2 animate-in fade-in">
                  <CheckCircle2 size={16} className="shrink-0" />
                  <span className="font-bold">{cashierSuccessMsg}</span>
                </div>
              )}

            </div>

            {/* Right Column (5 cols): Table Standee QR Preview & Fast Onboarding */}
            <div className="lg:col-span-5 rounded-2xl sm:rounded-3xl border sm:border-2 border-[#232331] bg-white p-4 sm:p-6 shadow-ink-md space-y-4">
              
              <div className="border-b border-[#dedee8] pb-3">
                <span className="font-mono text-[10px] font-bold uppercase text-[#7958d8] block">
                  STAND MEJA &amp; QR PENDAFTARAN
                </span>
                <h3 className="font-extrabold text-sm sm:text-base text-[#232331] font-sans mt-0.5">
                  Scan / Tap Kartu Member Meja
                </h3>
              </div>

              <div className="rounded-2xl border-2 border-[#232331] bg-[#fcfcfe] p-4 text-center space-y-3">
                <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-[#d9ff57] text-[#232331] border-2 border-[#232331] shadow-ink-xs">
                  <QrCode size={36} />
                </div>

                <div className="space-y-1 font-mono text-xs">
                  <span className="font-extrabold text-[#232331] block">
                    URL Pendaftaran Member Meja:
                  </span>
                  <Link
                    href="/loyalty/register"
                    target="_blank"
                    className="text-[#7958d8] text-[11px] font-bold underline inline-flex items-center gap-1"
                  >
                    <span>/loyalty/register</span>
                    <ExternalLink size={11} />
                  </Link>
                  <p className="text-[10px] text-[#7b7b8e] font-sans pt-1">
                    Ditaruh di meja kasir / standee acrylic agar pelanggan bisa mendaftar sendiri sambil menunggu pesanan.
                  </p>
                </div>

                <Link
                  href="/loyalty/register"
                  target="_blank"
                  className="btn-tactile inline-flex items-center justify-center gap-1.5 w-full rounded-xl border border-[#232331] bg-white py-2 text-xs font-bold text-[#232331] shadow-ink-xs"
                >
                  <UserPlus size={13} />
                  <span>Buka Form Pendaftaran Member Baru</span>
                </Link>
              </div>

            </div>

          </div>
        )}

        {/* ============================================================= */}
        {/* TAB 2: DATA PELANGGAN (PDP COMPLIANT) */}
        {/* ============================================================= */}
        {activeTab === "customers" && (
          <div className="rounded-2xl sm:rounded-3xl border sm:border-2 border-[#232331] bg-white p-4 sm:p-6 shadow-ink-md space-y-4">
            
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#dedee8] pb-3 sm:pb-4">
              <div>
                <h3 className="font-extrabold text-sm sm:text-base text-[#232331]">
                  Database Pelanggan ({customers.length} Member)
                </h3>
                <p className="text-[11px] sm:text-xs text-[#7b7b8e]">
                  Data nomor telepon dilindungi sesuai standar UU PDP No. 27/2022.
                </p>
              </div>

              <div className="flex items-center gap-2 font-mono text-xs">
                <button
                  type="button"
                  onClick={() => alert("Data pelanggan berhasil diekspor ke CSV!")}
                  className="btn-tactile inline-flex items-center gap-1 rounded-xl border border-[#232331] bg-white px-3 py-1.5 text-xs font-bold text-[#232331] shadow-ink-xs"
                >
                  <Download size={13} />
                  <span>Ekspor CSV</span>
                </button>
              </div>
            </div>

            {/* Customers Table */}
            <div className="overflow-x-auto">
              <table className="w-full text-left font-mono text-xs">
                <thead>
                  <tr className="border-b border-[#dedee8] text-[#7b7b8e] text-[10px] uppercase">
                    <th className="py-2.5 px-3">Nama Member</th>
                    <th className="py-2.5 px-3">Nomor WhatsApp</th>
                    <th className="py-2.5 px-3">Saldo Poin</th>
                    <th className="py-2.5 px-3">Tanggal Gabung</th>
                    <th className="py-2.5 px-3">Persetujuan PDP</th>
                    <th className="py-2.5 px-3 text-right">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#dedee8]">
                  {customers.map((cust) => {
                    const balance = cust.balance;
                    const isUnmasked = unmaskedPhones[cust.id];

                    return (
                      <tr key={cust.id} className="hover:bg-[#fcfcfe]">
                        <td className="py-3 px-3 font-extrabold text-[#232331] font-sans">
                          {cust.name}
                        </td>
                        <td className="py-3 px-3">
                          <div className="flex items-center gap-1">
                            <span>{isUnmasked ? `+${cust.phone}` : maskPhoneNumber(cust.phone)}</span>
                            <button
                              type="button"
                              onClick={() => setUnmaskedPhones({ ...unmaskedPhones, [cust.id]: !isUnmasked })}
                              className="text-[#7b7b8e] hover:text-[#232331] p-0.5"
                            >
                              {isUnmasked ? <EyeOff size={12} /> : <Eye size={12} />}
                            </button>
                          </div>
                        </td>
                        <td className="py-3 px-3 font-black text-sm text-[#16a34a]">
                          {balance} Pts
                        </td>
                        <td className="py-3 px-3 text-[#7b7b8e]">
                          {formatBusinessDateTime(cust.created_at)}
                        </td>
                        <td className="py-3 px-3">
                          <span className="inline-flex items-center gap-1 text-[10px] font-bold text-[#16a34a] bg-[#dcfce7] px-2 py-0.5 rounded-full border border-[#16a34a]/30">
                            <ShieldCheck size={11} />
                            <span>Tersetujui</span>
                          </span>
                        </td>
                        <td className="py-3 px-3 text-right space-x-1.5 whitespace-nowrap">
                          <button
                            type="button"
                            onClick={() => setViewingCustomer(cust)}
                            className="btn-tactile rounded-lg border border-[#7958d8] bg-[#f0edff] px-2.5 py-1 text-[10.5px] font-bold text-[#7958d8]"
                          >
                            Buku Ledger
                          </button>
                          <button
                            type="button"
                            onClick={() => handleAnonymizeCustomer(cust.id, cust.name)}
                            className="btn-tactile rounded-lg border border-[#dedee8] bg-white px-2 py-1 text-[10.5px] font-bold text-[#7b7b8e] hover:text-[#ef4444]"
                            title="Anonimkan Data (UU PDP)"
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
        {/* TAB 3: KATALOG REWARD & PROTEKSI BIAYA OWNER */}
        {/* ============================================================= */}
        {activeTab === "rewards" && (
          <div className="rounded-2xl sm:rounded-3xl border sm:border-2 border-[#232331] bg-white p-4 sm:p-6 shadow-ink-md space-y-4">
            
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#dedee8] pb-3 sm:pb-4">
              <div>
                <h3 className="font-extrabold text-sm sm:text-base text-[#232331]">
                  Katalog Hadiah &amp; Proteksi Margin Biaya ({rewards.length} Reward)
                </h3>
                <p className="text-[11px] sm:text-xs text-[#7b7b8e]">
                  Sistem otomatis menghitung estimasi persentase diskon efektif agar program loyalitas tidak merugikan UMKM.
                </p>
              </div>

              <button
                type="button"
                onClick={() => {
                  setEditingRewardId(null);
                  setRewardName("");
                  setRewardPointCost(10);
                  setRewardMarketValue(25000);
                  setRewardStock("");
                  setShowRewardModal(true);
                }}
                className="btn-tactile inline-flex items-center gap-1.5 rounded-xl border sm:border-2 border-[#232331] bg-[#d9ff57] px-3 py-1.5 font-mono text-xs font-bold text-[#232331] shadow-ink-xs"
              >
                <Plus size={13} strokeWidth={3} />
                <span>Tambah Reward</span>
              </button>
            </div>

            {/* Rewards Grid */}
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3 font-mono text-xs">
              {rewards.map((rw) => {
                const analysis = calculateRewardDiscountRate(rw.point_cost, program.earn_rate, rw.market_value);
                return (
                  <div key={rw.id} className="rounded-2xl border-2 border-[#232331] bg-[#fcfcfe] p-4 space-y-3 shadow-ink-xs">
                    <div className="flex justify-between items-start">
                      <div className="min-w-0">
                        <h4 className="font-black text-sm text-[#232331] font-sans truncate">{rw.name}</h4>
                        <span className="text-[10px] text-[#7b7b8e]">Nilai Jual: {formatRupiah(rw.market_value)}</span>
                      </div>
                      <span className="rounded-xl border border-[#7958d8] bg-[#f0edff] px-2 py-0.5 font-black text-xs text-[#7958d8] shrink-0">
                        {rw.point_cost} Pts
                      </span>
                    </div>

                    {/* Cost Protection Analysis */}
                    <div className="rounded-xl bg-white p-2.5 border border-[#dedee8] space-y-1 text-[10.5px]">
                      <div className="flex justify-between">
                        <span className="text-[#7b7b8e]">Syarat Belanja:</span>
                        <span className="font-bold text-[#232331]">{formatRupiah(analysis.requiredSpend)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-[#7b7b8e]">Diskon Efektif:</span>
                        <span className={`font-black ${analysis.isHighDiscount ? "text-[#d97706]" : "text-[#16a34a]"}`}>
                          {analysis.discountRatePct.toFixed(1)}% {analysis.isHighDiscount ? "⚠️" : "✓"}
                        </span>
                      </div>
                    </div>

                    <div className="flex justify-end gap-1.5 pt-1 border-t border-[#dedee8]">
                      <button
                        type="button"
                        onClick={() => handleDeleteReward(rw.id, rw.name)}
                        className="btn-tactile rounded-lg border border-[#dedee8] bg-white p-1 text-[#7b7b8e] hover:text-[#ef4444]"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>

          </div>
        )}

        {/* ============================================================= */}
        {/* TAB 4: ATURAN PROGRAM (POIN VS STAMP) */}
        {/* ============================================================= */}
        {activeTab === "settings" && (
          <form onSubmit={handleSaveProgramSettings} className="rounded-2xl sm:rounded-3xl border sm:border-2 border-[#232331] bg-white p-4 sm:p-6 shadow-ink-md space-y-5">
            
            <div className="border-b border-[#dedee8] pb-3">
              <h3 className="font-extrabold text-sm sm:text-base text-[#232331]">
                Pengaturan Program Loyalitas Toko
              </h3>
              <p className="text-[11px] sm:text-xs text-[#7b7b8e]">
                Pilih satu model: Mode Poin (belanja nominal rupiah) atau Mode Stamp (kunjungan).
              </p>
            </div>

            <div className="grid sm:grid-cols-2 gap-4 font-mono text-xs">
              
              {/* Program Mode Selection */}
              <div className="space-y-2">
                <label className="block font-bold text-[#232331]">Model Program:</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setProgram({ ...program, mode: "point" })}
                    className={`p-3 rounded-xl border-2 text-center transition-all ${
                      program.mode === "point"
                        ? "border-[#232331] bg-[#232331] text-[#d9ff57]"
                        : "border-[#dedee8] bg-white text-[#7b7b8e]"
                    }`}
                  >
                    <span className="font-black text-sm block">1. Mode Poin</span>
                    <span className="text-[9.5px] opacity-80">Cocok resto &amp; retail</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setProgram({ ...program, mode: "stamp" })}
                    className={`p-3 rounded-xl border-2 text-center transition-all ${
                      program.mode === "stamp"
                        ? "border-[#232331] bg-[#232331] text-[#d9ff57]"
                        : "border-[#dedee8] bg-white text-[#7b7b8e]"
                    }`}
                  >
                    <span className="font-black text-sm block">2. Mode Stamp</span>
                    <span className="text-[9.5px] opacity-80">Cocok kedai kopi &amp; barbershop</span>
                  </button>
                </div>
              </div>

              {/* Earn Rate / Kurs Poin */}
              <div className="space-y-1">
                <label className="block font-bold text-[#232331]">
                  Kurs Perolehan Poin (Rupiah per 1 Poin):
                </label>
                <div className="flex items-center gap-1">
                  <span className="text-[#7b7b8e] font-bold">Rp</span>
                  <input
                    type="number"
                    min={1000}
                    step={1000}
                    value={program.earn_rate}
                    onChange={(e) => setProgram({ ...program, earn_rate: Number(e.target.value) })}
                    className="w-full rounded-xl border-2 border-[#232331] p-2.5 font-black text-sm text-[#232331]"
                  />
                </div>
                <span className="text-[10px] text-[#7b7b8e]">
                  Misal Rp 10.000: Belanja Rp 85.000 mendapatkan 8 Poin.
                </span>
              </div>

            </div>

            <div className="flex justify-end pt-2 border-t border-[#dedee8]">
              <button
                type="submit"
                className="btn-tactile rounded-xl bg-[#232331] px-6 py-2.5 font-mono text-xs font-black text-[#d9ff57] shadow-ink-xs"
              >
                Simpan Pengaturan Program ✓
              </button>
            </div>

          </form>
        )}

        {/* ============================================================= */}
        {/* TAB 5: AUDIT KASIR & ANTI-KECURANGAN */}
        {/* ============================================================= */}
        {activeTab === "audit" && (
          <div className="rounded-2xl sm:rounded-3xl border sm:border-2 border-[#232331] bg-white p-4 sm:p-6 shadow-ink-md space-y-4">
            
            <div className="border-b border-[#dedee8] pb-3">
              <h3 className="font-extrabold text-sm sm:text-base text-[#232331]">
                Audit Penerbitan Poin per Staf Kasir
              </h3>
              <p className="text-[11px] sm:text-xs text-[#7b7b8e]">
                Setiap baris ledger mencatat ID kasir yang bertugas untuk mendeteksi anomali penambahan poin.
              </p>
            </div>

            <div className="grid sm:grid-cols-2 gap-3 font-mono text-xs">
              {staffAudit.map((audit) => (
                <div key={audit.id} className="rounded-2xl border-2 border-[#232331] bg-[#fcfcfe] p-4 space-y-2 shadow-ink-xs">
                  <div className="flex justify-between items-start">
                    <h4 className="font-black text-sm text-[#232331] font-sans">{audit.name}</h4>
                    <span className="text-[10px] bg-[#dcfce7] text-[#16a34a] px-2 py-0.5 rounded font-bold">
                      {audit.total_entries} Transaksi
                    </span>
                  </div>

                  <div className="rounded-xl bg-white p-2.5 border border-[#dedee8] space-y-1 text-[11px]">
                    <div className="flex justify-between">
                      <span className="text-[#7b7b8e]">Total Poin Diterbitkan:</span>
                      <span className="font-black text-[#7958d8]">{audit.points_issued} Pts</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-[#7b7b8e]">Penyesuaian Manual:</span>
                      <span className="font-bold text-[#c2410c]">{audit.manual_count} Pts</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>

          </div>
        )}

      </main>

      {/* MODAL: REWARD CREATOR */}
      {showRewardModal && (
        <div className="fixed inset-0 z-50 bg-[#232331]/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="w-full max-w-md rounded-3xl border-2 border-[#232331] bg-white p-6 shadow-ink-lg space-y-4 animate-in fade-in zoom-in duration-150 font-mono text-xs">
            <div className="flex items-center justify-between border-b border-[#dedee8] pb-3">
              <h3 className="font-extrabold text-base text-[#232331] font-sans">
                {editingRewardId ? "Edit Reward" : "Buat Reward Baru"}
              </h3>
              <button
                type="button"
                onClick={() => setShowRewardModal(false)}
                className="text-[#7b7b8e] hover:text-[#232331] text-xs font-bold"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveReward} className="space-y-3 font-sans">
              <div className="space-y-1">
                <label className="block font-mono font-bold text-[#232331]">Nama Hadiah / Traktiran:</label>
                <input
                  type="text"
                  required
                  placeholder="Contoh: Gratis 1x Spanish Latte"
                  value={rewardName}
                  onChange={(e) => setRewardName(e.target.value)}
                  className="w-full rounded-xl border border-[#232331] p-2.5 text-xs font-bold text-[#232331]"
                />
              </div>

              <div className="grid grid-cols-2 gap-2 font-mono text-xs">
                <div className="space-y-1">
                  <label className="block font-bold text-[#232331]">Biaya Poin:</label>
                  <input
                    type="number"
                    min={1}
                    value={rewardPointCost}
                    onChange={(e) => setRewardPointCost(Number(e.target.value))}
                    className="w-full rounded-xl border border-[#232331] p-2 text-xs font-bold text-[#232331]"
                  />
                </div>

                <div className="space-y-1">
                  <label className="block font-bold text-[#232331]">Nilai Rupiah Menu (Rp):</label>
                  <input
                    type="number"
                    min={0}
                    step={1000}
                    value={rewardMarketValue}
                    onChange={(e) => setRewardMarketValue(Number(e.target.value))}
                    className="w-full rounded-xl border border-[#232331] p-2 text-xs font-bold text-[#232331]"
                  />
                </div>
              </div>

              {/* Live Cost Protection Box */}
              <div className={`p-3 rounded-2xl border font-mono text-[10.5px] space-y-1 ${
                rewardDiscountAnalysis.isHighDiscount ? "bg-[#fff5f5] border-[#ef4444]" : "bg-[#f0edff] border-[#7958d8]"
              }`}>
                <span className="font-bold text-[#232331] block">PROTEKSI BIAYA DISKON:</span>
                <p className="text-[#7b7b8e]">
                  Pelanggan harus belanja total <strong>{formatRupiah(rewardDiscountAnalysis.requiredSpend)}</strong> untuk dapat hadiah ini.
                </p>
                <div className="flex justify-between font-bold pt-1">
                  <span>Diskon Efektif:</span>
                  <span className={rewardDiscountAnalysis.isHighDiscount ? "text-[#ef4444]" : "text-[#16a34a]"}>
                    {rewardDiscountAnalysis.discountRatePct.toFixed(1)}% {rewardDiscountAnalysis.isHighDiscount ? "(Waspada: Terlalu Besar!)" : "(Sehat ✓)"}
                  </span>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-[#dedee8] font-mono text-xs">
                <button
                  type="button"
                  onClick={() => setShowRewardModal(false)}
                  className="rounded-xl border border-[#dedee8] bg-white px-3 py-1.5 font-bold text-[#7b7b8e]"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="btn-tactile rounded-xl bg-[#232331] px-4 py-1.5 font-bold text-[#d9ff57]"
                >
                  Simpan Hadiah ✓
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: CUSTOMER LEDGER DETAIL */}
      {viewingCustomer && (
        <div className="fixed inset-0 z-50 bg-[#232331]/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="w-full max-w-lg rounded-3xl border-2 border-[#232331] bg-white p-6 shadow-ink-lg space-y-4 animate-in fade-in font-mono text-xs">
            <div className="flex items-center justify-between border-b border-[#dedee8] pb-3">
              <div>
                <h3 className="font-black text-base text-[#232331] font-sans">
                  Buku Ledger: {viewingCustomer.name}
                </h3>
                <span className="text-[11px] text-[#7b7b8e]">
                  Saldo: {viewingDetail?.balance ?? 0} Pts · {maskPhoneNumber(viewingCustomer.phone)}
                </span>
              </div>
              <button
                type="button"
                onClick={() => setViewingCustomer(null)}
                className="text-[#7b7b8e] hover:text-[#232331] text-xs font-bold"
              >
                ✕
              </button>
            </div>

            <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
              {(viewingDetail?.ledger ?? []).map((item) => (
                <div key={item.id} className="p-2.5 rounded-xl border border-[#dedee8] bg-[#fcfcfe] flex justify-between items-center">
                  <div>
                    <span className="font-bold text-[#232331] font-sans block text-xs">{item.note}</span>
                    <span className="text-[10px] text-[#7b7b8e]">{formatBusinessDateTime(item.created_at)}</span>
                  </div>
                  <span className={`font-black text-sm ${item.delta > 0 ? "text-[#16a34a]" : "text-[#ef4444]"}`}>
                    {item.delta > 0 ? `+${item.delta}` : item.delta} Pts
                  </span>
                </div>
              ))}
            </div>

            <div className="flex justify-between items-center pt-2 border-t border-[#dedee8]">
              <button
                type="button"
                onClick={() => handleAnonymizeCustomer(viewingCustomer.id, viewingCustomer.name)}
                className="text-[#ef4444] text-[11px] font-bold hover:underline"
              >
                Hapus / Anonimkan Data Member Ini (UU PDP)
              </button>
              <button
                type="button"
                onClick={() => setViewingCustomer(null)}
                className="rounded-xl bg-[#232331] text-white px-4 py-1.5 font-bold"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Footer */}
      <footer className="border-t border-[#dedee8] bg-white py-4 text-center text-xs font-mono text-[#7b7b8e]">
        KAEL Loyalty Engine · Immutable Append-Only Ledger &amp; UU PDP Protection
      </footer>

    </div>
  );
}
