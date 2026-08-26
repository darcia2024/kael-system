"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { 
  Lock, 
  Mail, 
  KeyRound, 
  ShieldCheck, 
  ArrowRight, 
  Users, 
  Briefcase, 
  Sparkles, 
  AlertCircle, 
  Check, 
  Delete,
  Store,
  RefreshCw,
  Search,
  Building2,
  ChevronRight
} from "lucide-react";
import type { Business, User } from "@/lib/types";
import { loginOwner, loginStaff, getStoreStaffAction } from "@/lib/actions";

interface StoreOption {
  id: string;
  name: string;
  category: string;
  brand_color: string;
}

export default function LoginClient({
  initialBusiness,
  availableStores,
  initialStaffList,
  nextPath,
}: {
  initialBusiness: Business | null;
  availableStores: StoreOption[];
  initialStaffList: Pick<User, "id" | "name">[];
  nextPath: string;
}) {
  const router = useRouter();
  const [roleTab, setRoleTab] = useState<"owner" | "staff" | "admin">("staff");

  // Selected Store State (for Multi-Tenant Staff Selection)
  const [selectedBusiness, setSelectedBusiness] = useState<StoreOption | null>(() => {
    if (initialBusiness) {
      return {
        id: initialBusiness.id,
        name: initialBusiness.name,
        category: initialBusiness.category,
        brand_color: initialBusiness.brand_color,
      };
    }
    return availableStores[0] || null;
  });

  const [staffList, setStaffList] = useState<Pick<User, "id" | "name">[]>(initialStaffList);
  const [staffId, setStaffId] = useState<string>(initialStaffList[0]?.id ?? "");
  const [showStorePicker, setShowStorePicker] = useState(false);
  const [storeSearchQuery, setStoreSearchQuery] = useState("");
  const [isLoadingStore, setIsLoadingStore] = useState(false);

  // Owner form state
  const [ownerEmail, setOwnerEmail] = useState("");
  const [ownerPassword, setOwnerPassword] = useState("");
  const [ownerLoading, setOwnerLoading] = useState(false);
  const [ownerError, setOwnerError] = useState("");

  // Staff PIN keypad state
  const [staffPin, setStaffPin] = useState("");
  const [staffError, setStaffError] = useState("");
  const [staffLoading, setStaffLoading] = useState(false);

  // Admin state
  const [adminEmail, setAdminEmail] = useState("");
  const [adminPassword, setAdminPassword] = useState("");
  const [adminError, setAdminError] = useState("");

  // Load store preference from localStorage on mount
  useEffect(() => {
    try {
      const savedStoreId = localStorage.getItem("kael_selected_store_id");
      if (savedStoreId && savedStoreId !== selectedBusiness?.id) {
        const found = availableStores.find((s) => s.id === savedStoreId);
        if (found) {
          handleSelectStore(found);
        }
      }
    } catch {
      // ignore
    }
  }, []);

  const handleSelectStore = async (store: StoreOption) => {
    setSelectedBusiness(store);
    setShowStorePicker(false);
    setIsLoadingStore(true);
    setStaffPin("");
    setStaffError("");

    try {
      localStorage.setItem("kael_selected_store_id", store.id);
    } catch {
      // ignore
    }

    const res = await getStoreStaffAction(store.id);
    setStaffList(res.staffList);
    setStaffId(res.staffList[0]?.id || "");
    setIsLoadingStore(false);
  };

  const handleOwnerLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setOwnerLoading(true);
    setOwnerError("");
    try {
      const res = await loginOwner(ownerEmail, ownerPassword);
      if (!res.ok) {
        setOwnerError(res.error);
        return;
      }
      router.push(nextPath !== "/app" ? nextPath : res.data.next);
      router.refresh();
    } catch {
      // Tanpa ini, action yang melempar membuat layar diam tanpa penjelasan.
      setOwnerError("Sistem sedang bermasalah. Coba lagi sebentar lagi.");
    } finally {
      setOwnerLoading(false);
    }
  };

  const handleStaffPinInput = (num: string) => {
    if (staffPin.length < 6) {
      const nextPin = staffPin + num;
      setStaffPin(nextPin);
      setStaffError("");

      if (nextPin.length === 6) {
        verifyStaffPin(nextPin);
      }
    }
  };

  const handleStaffBackspace = () => {
    setStaffPin((prev) => prev.slice(0, -1));
    setStaffError("");
  };

  const verifyStaffPin = async (pin: string) => {
    if (!selectedBusiness) {
      setStaffError("Pilih toko terlebih dahulu.");
      setStaffPin("");
      return;
    }
    if (!staffId) {
      setStaffError("Pilih nama staf terlebih dahulu.");
      setStaffPin("");
      return;
    }
    setStaffLoading(true);
    const res = await loginStaff(selectedBusiness.id, staffId, pin);
    setStaffLoading(false);

    if (res.ok) {
      router.push(res.data.next);
      router.refresh();
    } else {
      setStaffError(res.error);
      setStaffPin("");
    }
  };

  const handleAdminLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    const res = await loginOwner(adminEmail, adminPassword);
    if (!res.ok) {
      setAdminError(res.error);
      return;
    }
    router.push(res.data.next);
    router.refresh();
  };

  const filteredStores = availableStores.filter((s) => {
    if (!storeSearchQuery.trim()) return true;
    const q = storeSearchQuery.toLowerCase();
    return s.name.toLowerCase().includes(q) || s.category.toLowerCase().includes(q);
  });

  return (
    <div className="min-h-screen bg-[#f7f6fc] text-[#232331] flex flex-col justify-between font-sans p-4 sm:p-6">
      
      {/* Top Bar */}
      <header className="mx-auto w-full max-w-4xl flex items-center justify-between py-2">
        <Link href="/" className="flex items-center gap-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-[#232331] text-[#d9ff57] font-black text-sm shadow-ink-xs">
            K
          </span>
          <span className="font-extrabold text-sm text-[#232331]">
            KAEL Ecosystem
          </span>
        </Link>
        <Link
          href="/"
          className="text-xs font-mono font-bold text-[#7b7b8e] hover:text-[#232331]"
        >
          ← Kembali ke Landing
        </Link>
      </header>

      {/* Main Login Box */}
      <main className="mx-auto w-full max-w-md my-auto">
        <div className="rounded-3xl border-2 border-[#232331] bg-white p-6 sm:p-8 shadow-ink-lg space-y-5">
          
          {/* Header Title */}
          <div className="text-center space-y-1">
            <h1 className="text-xl sm:text-2xl font-black text-[#232331]">
              Login Portal KAEL
            </h1>
            <p className="text-xs text-[#7b7b8e]">
              Akses cepat satu pintu untuk Owner, Kasir/Staf, dan Tim Admin.
            </p>
          </div>

          {/* Role Tabs */}
          <div className="grid grid-cols-3 rounded-2xl border-2 border-[#232331] bg-[#f0edff] p-1 font-mono text-xs font-bold">
            <button
              type="button"
              onClick={() => {
                setRoleTab("owner");
                setStaffError("");
              }}
              className={`rounded-xl py-2 transition-all ${
                roleTab === "owner"
                  ? "bg-[#232331] text-[#d9ff57] shadow-ink-xs"
                  : "text-[#7b7b8e] hover:text-[#232331]"
              }`}
            >
              Owner
            </button>
            <button
              type="button"
              onClick={() => {
                setRoleTab("staff");
                setStaffPin("");
                setStaffError("");
              }}
              className={`rounded-xl py-2 transition-all ${
                roleTab === "staff"
                  ? "bg-[#232331] text-[#d9ff57] shadow-ink-xs"
                  : "text-[#7b7b8e] hover:text-[#232331]"
              }`}
            >
              Staf / PIN
            </button>
            <button
              type="button"
              onClick={() => {
                setRoleTab("admin");
                setStaffError("");
              }}
              className={`rounded-xl py-2 transition-all ${
                roleTab === "admin"
                  ? "bg-[#232331] text-[#d9ff57] shadow-ink-xs"
                  : "text-[#7b7b8e] hover:text-[#232331]"
              }`}
            >
              KAEL Admin
            </button>
          </div>

          {/* ========================================================= */}
          {/* TAB 1: OWNER LOGIN (EMAIL & PASSWORD) */}
          {/* ========================================================= */}
          {roleTab === "owner" && (
            <form onSubmit={handleOwnerLogin} className="space-y-4">
              <div className="space-y-1.5">
                <label className="block font-mono text-xs font-bold text-[#232331]">
                  Email Pemilik Usaha:
                </label>
                <div className="relative">
                  <Mail className="absolute left-3.5 top-3.5 text-[#7b7b8e]" size={16} />
                  <input
                    type="email"
                    required
                    value={ownerEmail}
                    onChange={(e) => setOwnerEmail(e.target.value)}
                    placeholder="nama@bisnisanda.id"
                    className="w-full rounded-2xl border-2 border-[#232331] pl-10 pr-4 py-3 text-xs font-bold text-[#232331] focus:outline-none focus:ring-2 focus:ring-[#7958d8]"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <div className="flex justify-between items-center">
                  <label className="block font-mono text-xs font-bold text-[#232331]">
                    Kata Sandi:
                  </label>
                </div>
                <div className="relative">
                  <Lock className="absolute left-3.5 top-3.5 text-[#7b7b8e]" size={16} />
                  <input
                    type="password"
                    required
                    value={ownerPassword}
                    onChange={(e) => setOwnerPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full rounded-2xl border-2 border-[#232331] pl-10 pr-4 py-3 text-xs font-bold text-[#232331] focus:outline-none focus:ring-2 focus:ring-[#7958d8]"
                  />
                </div>
              </div>

              {ownerError && (
                <p className="rounded-xl border-2 border-[#ef4444] bg-[#feebee] p-2.5 text-[11px] font-bold text-[#ef4444]">
                  {ownerError}
                </p>
              )}

              <button
                type="submit"
                disabled={ownerLoading}
                className="btn-tactile flex w-full items-center justify-center gap-2 rounded-2xl border-2 border-[#232331] bg-[#232331] py-3.5 text-xs font-extrabold text-[#d9ff57] shadow-ink-md"
              >
                <span>{ownerLoading ? "Memverifikasi..." : "Masuk ke Dashboard Owner ➔"}</span>
              </button>
            </form>
          )}

          {/* ========================================================= */}
          {/* TAB 2: STAFF PIN LOGIN KEYPAD (MULTI-TENANT DYNAMIC) */}
          {/* ========================================================= */}
          {roleTab === "staff" && (
            <div className="space-y-4">
              
              {/* STORE SELECTOR BADGE (DYNAMIC PERSONALISED PER UMKM) */}
              <div className="rounded-2xl border-2 border-[#232331] bg-[#fcfcfe] p-3 space-y-2 font-mono text-xs">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] text-[#7b7b8e] font-bold uppercase tracking-wider">
                    LOKASI / TOKO AKTIF:
                  </span>
                  <button
                    type="button"
                    onClick={() => setShowStorePicker(!showStorePicker)}
                    className="btn-tactile inline-flex items-center gap-1 rounded-lg border border-[#7958d8] bg-[#f0edff] px-2 py-0.5 text-[10.5px] font-bold text-[#7958d8] hover:bg-[#e1dbff]"
                  >
                    <RefreshCw size={11} />
                    <span>Ganti Toko</span>
                  </button>
                </div>

                <div className="flex items-center gap-2">
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-[#232331] text-[#d9ff57]">
                    <Store size={14} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <h3 className="font-extrabold text-xs sm:text-sm text-[#232331] truncate font-sans">
                      {selectedBusiness?.name || "Pilih Toko UMKM"}
                    </h3>
                    <span className="text-[10px] text-[#7b7b8e] block">
                      {selectedBusiness?.category || "Belum dipilih"}
                    </span>
                  </div>
                </div>

                {/* STORE PICKER MODAL / DROPDOWN */}
                {showStorePicker && (
                  <div className="pt-2 border-t border-[#dedee8] space-y-2 animate-in fade-in-50">
                    <div className="relative">
                      <Search className="absolute left-2.5 top-2 text-[#7b7b8e]" size={13} />
                      <input
                        type="text"
                        placeholder="Ketik nama toko / kode toko..."
                        value={storeSearchQuery}
                        onChange={(e) => setStoreSearchQuery(e.target.value)}
                        className="w-full rounded-xl border border-[#dedee8] pl-7 pr-2 py-1 text-xs text-[#232331] font-sans"
                        autoFocus
                      />
                    </div>

                    <div className="space-y-1 max-h-36 overflow-y-auto">
                      {filteredStores.map((store) => (
                        <button
                          key={store.id}
                          type="button"
                          onClick={() => handleSelectStore(store)}
                          className={`w-full flex items-center justify-between p-2 rounded-xl text-left transition-all ${
                            selectedBusiness?.id === store.id
                              ? "bg-[#232331] text-[#d9ff57]"
                              : "bg-white border border-[#dedee8] hover:bg-[#f0edff] text-[#232331]"
                          }`}
                        >
                          <div>
                            <span className="font-bold text-xs font-sans block">{store.name}</span>
                            <span className="text-[9.5px] opacity-75">{store.category}</span>
                          </div>
                          <ChevronRight size={13} />
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* STAFF NAME SELECTOR */}
              <div className="space-y-2">
                <div className="text-center space-y-0.5">
                  <h4 className="font-extrabold text-xs text-[#232331]">
                    Pilih nama staf toko, lalu ketik PIN:
                  </h4>
                </div>

                {isLoadingStore ? (
                  <div className="py-4 text-center text-xs font-mono text-[#7b7b8e]">
                    Memuat daftar staf toko...
                  </div>
                ) : staffList.length === 0 ? (
                  <div className="rounded-xl border-2 border-[#ef4444] bg-[#feebee] p-3 text-center text-[11px] font-bold text-[#ef4444]">
                    Belum ada akun kasir di toko ini. Owner perlu menambahkannya di portal.
                  </div>
                ) : (
                  <div className="flex flex-wrap justify-center gap-1.5">
                    {staffList.map((s) => (
                      <button
                        key={s.id}
                        type="button"
                        onClick={() => {
                          setStaffId(s.id);
                          setStaffPin("");
                          setStaffError("");
                        }}
                        className={`btn-tactile rounded-xl px-3 py-1.5 text-xs font-bold border transition-all ${
                          staffId === s.id
                            ? "bg-[#232331] text-[#d9ff57] border-[#232331] shadow-ink-xs"
                            : "bg-white text-[#7b7b8e] border-[#dedee8] hover:border-[#232331]"
                        }`}
                      >
                        {s.name}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* PIN Bubbles Display */}
              <div className="flex justify-center gap-2.5 my-1">
                {Array.from({ length: 6 }).map((_, i) => {
                  const isFilled = i < staffPin.length;
                  return (
                    <div
                      key={i}
                      className={`h-3.5 w-3.5 rounded-full border-2 transition-all ${
                        isFilled
                          ? "border-[#232331] bg-[#7958d8] scale-110"
                          : "border-[#dedee8] bg-[#fcfcfe]"
                      }`}
                    />
                  );
                })}
              </div>

              {staffError && (
                <div className="rounded-xl bg-[#feebee] p-2 text-center text-xs font-bold text-[#ef4444] flex items-center justify-center gap-1.5 border border-[#ef4444]/30 font-mono">
                  <AlertCircle size={13} />
                  <span>{staffError}</span>
                </div>
              )}

              {/* 3x4 Number Keypad */}
              <div className="grid grid-cols-3 gap-2 max-w-[260px] mx-auto">
                {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((num) => (
                  <button
                    key={num}
                    type="button"
                    onClick={() => handleStaffPinInput(num)}
                    className="btn-tactile flex h-11 items-center justify-center rounded-2xl border-2 border-[#232331] bg-white font-mono text-base font-black text-[#232331] shadow-ink-xs hover:bg-[#f0edff]"
                  >
                    {num}
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() => setStaffPin("")}
                  className="flex h-11 items-center justify-center rounded-2xl border border-[#dedee8] bg-[#fcfcfe] font-mono text-xs font-bold text-[#7b7b8e]"
                >
                  C
                </button>
                <button
                  type="button"
                  onClick={() => handleStaffPinInput("0")}
                  className="btn-tactile flex h-11 items-center justify-center rounded-2xl border-2 border-[#232331] bg-white font-mono text-base font-black text-[#232331] shadow-ink-xs hover:bg-[#f0edff]"
                >
                  0
                </button>
                <button
                  type="button"
                  onClick={handleStaffBackspace}
                  className="btn-tactile flex h-11 items-center justify-center rounded-2xl border-2 border-[#232331] bg-[#fcfcfe] text-[#232331] shadow-ink-xs"
                >
                  <Delete size={16} />
                </button>
              </div>

            </div>
          )}

          {/* ========================================================= */}
          {/* TAB 3: ADMIN KAEL LOGIN */}
          {/* ========================================================= */}
          {roleTab === "admin" && (
            <form onSubmit={handleAdminLogin} className="space-y-4">
              <div className="rounded-2xl border border-[#dedee8] bg-[#fcfcfe] p-3 text-[11px] font-mono text-[#7b7b8e] space-y-1">
                <span className="font-bold text-[#232331] block">Otoritas Tim KAEL:</span>
                <p>Panel khusus penerbitan batch kartu NFC &amp; audit aktivasi.</p>
              </div>

              <div className="space-y-1.5">
                <label className="block font-mono text-xs font-bold text-[#232331]">
                  Email KAEL Staff / Admin:
                </label>
                <div className="relative">
                  <Mail className="absolute left-3.5 top-3.5 text-[#7b7b8e]" size={16} />
                  <input
                    type="email"
                    required
                    value={adminEmail}
                    onChange={(e) => setAdminEmail(e.target.value)}
                    className="w-full rounded-2xl border-2 border-[#232331] pl-10 pr-4 py-3 text-xs font-bold text-[#232331]"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="block font-mono text-xs font-bold text-[#232331]">
                  Kata Sandi:
                </label>
                <div className="relative">
                  <Lock className="absolute left-3.5 top-3.5 text-[#7b7b8e]" size={16} />
                  <input
                    type="password"
                    required
                    value={adminPassword}
                    onChange={(e) => setAdminPassword(e.target.value)}
                    className="w-full rounded-2xl border-2 border-[#232331] pl-10 pr-4 py-3 text-xs font-bold text-[#232331]"
                  />
                </div>
              </div>

              {adminError && (
                <p className="rounded-xl border-2 border-[#ef4444] bg-[#feebee] p-2.5 text-[11px] font-bold text-[#ef4444]">
                  {adminError}
                </p>
              )}

              <button
                type="submit"
                className="btn-tactile flex w-full items-center justify-center gap-2 rounded-2xl border-2 border-[#232331] bg-[#7958d8] py-3.5 text-xs font-extrabold text-white shadow-ink-md"
              >
                <span>Buka Admin Batch Kartu ➔</span>
              </button>
            </form>
          )}

        </div>
      </main>

      {/* Footer */}
      <footer className="mx-auto w-full max-w-4xl text-center py-2 font-mono text-[11px] text-[#7b7b8e]">
        KAEL System Security · End-to-End Encryption &amp; RLS Multi-Tenant Protection
      </footer>

    </div>
  );
}
