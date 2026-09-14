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
  RefreshCw,
  Search,
  Building2,
  ChevronRight
} from "lucide-react";
import type { Business, User } from "@/lib/types";
import { loginOwner, loginStaff, openStoreByCodeAction } from "@/lib/actions";
import { BusinessMark } from "@/components/business-mark";

interface StoreOption {
  id: string;
  name: string;
  category: string;
  brand_color: string;
  logo_url: string | null;
}

export default function LoginClient({
  nextPath,
  presetStoreCode = null,
  adminMode = false,
}: {
  nextPath: string;
  /** Kode toko dari tautan yang dibagikan ke pemilik usaha, misal ?toko=SENJA. */
  presetStoreCode?: string | null;
  /**
   * Layar admin tidak muncul di login publik. Halaman /admin merender komponen
   * yang sama dengan tanda ini, sehingga pintunya tetap ada tanpa dipajang.
   *
   * Ini menyembunyikan, bukan mengamankan. Yang menahan tetap kata sandi dan
   * penguncian 5x percobaan; requireKaelAdmin di server tetap memeriksa peran
   * pada tiap halaman dan tiap action.
   */
  adminMode?: boolean;
}) {
  const router = useRouter();
  const [roleTab, setRoleTab] = useState<"owner" | "staff" | "admin">(
    adminMode ? "admin" : "staff",
  );

  /**
   * Toko dibuka lewat kode, bukan dipilih dari daftar. Tidak ada satu pun
   * jalur di halaman ini yang bisa menyebutkan toko mana saja yang ada.
   */
  const [selectedBusiness, setSelectedBusiness] = useState<StoreOption | null>(null);
  const [staffList, setStaffList] = useState<{ id: string; name: string }[]>([]);
  const [staffId, setStaffId] = useState<string>("");
  const [storeCodeInput, setStoreCodeInput] = useState("");
  const [storeError, setStoreError] = useState("");
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
  const [adminLoading, setAdminLoading] = useState(false);


  /**
   * Membuka toko dari kode. Kode yang berhasil disimpan di perangkat, sehingga
   * kasir cukup memasukkannya sekali saat tablet toko disiapkan.
   */
  const openStore = async (code: string) => {
    setIsLoadingStore(true);
    setStoreError("");
    const res = await openStoreByCodeAction(code);
    setIsLoadingStore(false);

    if (!res.ok || !res.business) {
      setStoreError(res.error ?? "Kode toko tidak dikenali.");
      return false;
    }
    setSelectedBusiness(res.business);
    setStaffList(res.staffList ?? []);
    setStaffId(res.staffList?.[0]?.id ?? "");
    setStaffPin("");
    setStaffError("");
    try {
      localStorage.setItem("kael_store_code", code.trim().toUpperCase());
    } catch {
      // Peramban bisa menolak localStorage; kodenya tinggal diketik ulang.
    }
    return true;
  };

  // Kode dari tautan lebih dulu, lalu kode yang diingat perangkat.
  useEffect(() => {
    let code = presetStoreCode;
    if (!code) {
      try {
        code = localStorage.getItem("kael_store_code");
      } catch {
        code = null;
      }
    }
    if (code) void openStore(code);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleForgetStore = () => {
    try {
      localStorage.removeItem("kael_store_code");
    } catch {
      // ignore
    }
    setSelectedBusiness(null);
    setStaffList([]);
    setStaffId("");
    setStoreCodeInput("");
    setStaffPin("");
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
      const target = nextPath !== "/app" ? nextPath : res.data.next;
      window.location.href = target;
    } catch {
      setOwnerError("Sistem sedang bermasalah. Coba lagi sebentar lagi.");
    } finally {
      setOwnerLoading(false);
    }
  };

  /**
   * PIN staf boleh 4 sampai 6 angka, jadi panjangnya tidak bisa dipakai sebagai
   * penanda "sudah selesai mengetik". Yang 6 angka tetap terkirim otomatis
   * seperti sebelumnya; yang lebih pendek dikirim lewat tombol konfirmasi.
   */
  const handleStaffPinInput = (num: string) => {
    if (staffPin.length >= 6) return;
    const nextPin = staffPin + num;
    setStaffPin(nextPin);
    setStaffError("");
    if (nextPin.length === 6) verifyStaffPin(nextPin);
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
    try {
      const res = await loginStaff(selectedBusiness.id, staffId, pin);
      if (res.ok) {
        window.location.href = res.data.next;
      } else {
        setStaffError(res.error);
        setStaffPin("");
      }
    } catch {
      setStaffError("Sistem sedang bermasalah. Coba lagi sebentar lagi.");
      setStaffPin("");
    } finally {
      setStaffLoading(false);
    }
  };

  const handleAdminLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setAdminLoading(true);
    setAdminError("");
    try {
      const res = await loginOwner(adminEmail, adminPassword);
      if (!res.ok) {
        setAdminError(res.error);
        return;
      }
      window.location.href = res.data.next;
    } catch {
      setAdminError("Sistem sedang bermasalah. Coba lagi sebentar lagi.");
    } finally {
      setAdminLoading(false);
    }
  };

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

          {/* Role Tabs. Di /admin hanya ada satu peran, jadi pemilihnya tidak
              perlu ditampilkan sama sekali. */}
          {!adminMode && (
          <div className="grid grid-cols-2 rounded-2xl border-2 border-[#232331] bg-[#f0edff] p-1 font-mono text-xs font-bold">
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
          </div>
          )}

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
              
              {/*
                Toko dibuka lewat kode, bukan dipilih dari daftar.

                Daftar toko yang lama membuat setiap UMKM bisa melihat siapa
                saja yang memakai KAEL, dan daftarnya terbaca tanpa login sama
                sekali. Dengan kode, mengetahui satu kode hanya membuka satu
                toko, dan tidak ada cara menyebutkan sisanya.
              */}
              {!selectedBusiness ? (
                <div className="rounded-2xl border-2 border-[#232331] bg-[#fcfcfe] p-4 space-y-3">
                  <div className="space-y-1">
                    <h4 className="font-extrabold text-xs text-[#232331]">
                      Masukkan Kode Toko
                    </h4>
                    <p className="text-[11px] text-[#7b7b8e] leading-relaxed">
                      Kode ini diberikan tim KAEL ke pemilik usaha. Cukup diisi
                      sekali, perangkat kasir akan mengingatnya.
                    </p>
                  </div>

                  <form
                    onSubmit={async (e) => {
                      e.preventDefault();
                      await openStore(storeCodeInput);
                    }}
                    className="space-y-2"
                  >
                    <input
                      type="text"
                      value={storeCodeInput}
                      onChange={(e) => {
                        setStoreCodeInput(e.target.value.toUpperCase());
                        setStoreError("");
                      }}
                      placeholder="Contoh: KODETOKO"
                      autoCapitalize="characters"
                      className="w-full rounded-xl border-2 border-[#232331] px-3 py-2.5 text-center font-mono text-sm font-black tracking-[0.2em] text-[#232331] focus:outline-none focus:ring-2 focus:ring-[#7958d8]"
                    />
                    {storeError && (
                      <p className="rounded-xl border-2 border-[#ef4444] bg-[#feebee] p-2 text-center text-[11px] font-bold text-[#ef4444]">
                        {storeError}
                      </p>
                    )}
                    <button
                      type="submit"
                      disabled={isLoadingStore || storeCodeInput.trim().length < 3}
                      className="btn-tactile w-full rounded-xl border-2 border-[#232331] bg-[#d9ff57] py-2.5 text-xs font-extrabold text-[#232331] shadow-ink-xs disabled:opacity-40"
                    >
                      {isLoadingStore ? "Memeriksa..." : "Buka Toko"}
                    </button>
                  </form>
                </div>
              ) : (
                <div className="rounded-2xl border-2 border-[#232331] bg-[#fcfcfe] p-3 font-mono text-xs">
                  <div className="flex items-center gap-2">
                    <BusinessMark
                      name={selectedBusiness.name}
                      logoUrl={selectedBusiness.logo_url}
                      brandColor={selectedBusiness.brand_color}
                      size="sm"
                      className="rounded-full border border-emerald-400/40 shadow-xs"
                    />
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-sans text-xs font-extrabold text-[#232331]">
                        {selectedBusiness.name}
                      </p>
                      <p className="truncate text-[10.5px] text-[#7b7b8e]">
                        {selectedBusiness.category}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={handleForgetStore}
                      className="shrink-0 text-[10.5px] font-bold text-[#7b7b8e] underline hover:text-[#232331]"
                    >
                      Ganti
                    </button>
                  </div>
                </div>
              )}

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

              {/* PIN 6 angka terkirim otomatis. Yang lebih pendek butuh tombol
                  ini, karena panjangnya tidak bisa dipakai sebagai penanda
                  selesai mengetik. */}
              <button
                type="button"
                disabled={staffPin.length < 4 || staffLoading}
                onClick={() => verifyStaffPin(staffPin)}
                className="btn-tactile flex w-full items-center justify-center gap-2 rounded-2xl border-2 border-[#232331] bg-[#d9ff57] py-3 text-xs font-extrabold text-[#232331] shadow-ink-sm disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {staffLoading ? "Memeriksa..." : "Masuk"}
              </button>

            </div>
          )}

          {/* ========================================================= */}
          {/* TAB 3: ADMIN KAEL LOGIN */}
          {/* ========================================================= */}
          {roleTab === "admin" && (
            <form onSubmit={handleAdminLogin} className="space-y-4">
              <div className="rounded-2xl border border-[#dedee8] bg-[#fcfcfe] p-3 text-[11px] font-mono text-[#7b7b8e] space-y-1">
                <span className="font-bold text-[#232331] block">Otoritas Tim KAEL:</span>
                <p>Panel pendaftaran pelanggan, pengaturan modul, dan penerbitan kartu NFC.</p>
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
                disabled={adminLoading}
                className="btn-tactile flex w-full items-center justify-center gap-2 rounded-2xl border-2 border-[#232331] bg-[#7958d8] py-3.5 text-xs font-extrabold text-white shadow-ink-md disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {adminLoading ? (
                  <>
                    <RefreshCw className="animate-spin" size={16} />
                    <span>Membuka Panel...</span>
                  </>
                ) : (
                  <span>Buka Panel KAEL ➔</span>
                )}
              </button>
            </form>
          )}

        </div>
      </main>

      {/* Footer */}
      <footer className="mx-auto w-full max-w-4xl text-center py-2 font-mono text-[11px] text-[#7b7b8e]">
        KAEL System · Kata sandi dan PIN disimpan terenkripsi
      </footer>

    </div>
  );
}
