"use client";

import { useState } from "react";
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
  Store
} from "lucide-react";
import type { User } from "@/lib/types";
import { loginOwner, loginStaff } from "@/lib/actions";
import { formatCardCodeDisplay } from "@/lib/card-code";

export default function AppLoginPage({
  businessId,
  staffList,
  nextPath,
}: {
  businessId: string;
  staffList: Pick<User, "id" | "name">[];
  nextPath: string;
}) {
  const router = useRouter();
  const [roleTab, setRoleTab] = useState<"owner" | "staff" | "admin">("owner");

  /**
   * Staf memilih namanya sebelum memasukkan PIN. Ini bukan sekadar kenyamanan:
   * tanpa tahu siapa yang mencoba, kegagalan PIN tidak bisa dihitung ke akun
   * yang benar, dan versi sebelumnya mengunci staf pertama di daftar walaupun
   * dia tidak melakukan apa-apa.
   */
  const [staffId, setStaffId] = useState<string>(staffList[0]?.id ?? "");

  // Owner form state
  const [ownerEmail, setOwnerEmail] = useState("owner@senjacoffee.id");
  const [ownerPassword, setOwnerPassword] = useState("");
  const [ownerLoading, setOwnerLoading] = useState(false);
  const [ownerError, setOwnerError] = useState("");

  // Staff PIN keypad state
  const [staffPin, setStaffPin] = useState("");
  const [staffError, setStaffError] = useState("");
  const [staffLoading, setStaffLoading] = useState(false);

  // Admin state
  const [adminEmail, setAdminEmail] = useState("admin@kael.id");
  const [adminPassword, setAdminPassword] = useState("");
  const [adminError, setAdminError] = useState("");

  const handleOwnerLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setOwnerLoading(true);
    const res = await loginOwner(ownerEmail, ownerPassword);
    setOwnerLoading(false);
    if (!res.ok) {
      setOwnerError(res.error);
      return;
    }
    router.push(nextPath !== "/app" ? nextPath : res.data.next);
    router.refresh();
  };

  const handleStaffPinInput = (num: string) => {
    if (staffPin.length < 6) {
      const nextPin = staffPin + num;
      setStaffPin(nextPin);
      setStaffError("");

      if (nextPin.length === 6) {
        // Otomatis verifikasi saat 6 digit lengkap
        verifyStaffPin(nextPin);
      }
    }
  };

  const handleStaffBackspace = () => {
    setStaffPin((prev) => prev.slice(0, -1));
    setStaffError("");
  };

  const verifyStaffPin = async (pin: string) => {
    if (!staffId) {
      setStaffError("Pilih nama staf dulu.");
      setStaffPin("");
      return;
    }
    setStaffLoading(true);
    const res = await loginStaff(businessId, staffId, pin);
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
        <div className="rounded-3xl border-2 border-[#232331] bg-white p-6 sm:p-8 shadow-ink-lg space-y-6">
          
          {/* Header Title */}
          <div className="text-center space-y-1.5">
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
          {/* TAB 1: OWNER LOGIN (EMAIL) */}
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
                    className="w-full rounded-2xl border-2 border-[#232331] pl-10 pr-4 py-3 text-xs font-bold text-[#232331] focus:outline-none focus:ring-2 focus:ring-[#7958d8]"
                  />
                </div>
              </div>

              {ownerError && (
                <p className="rounded-xl border-2 border-[#ef4444] bg-[#feebee] p-2.5 text-[11px] font-bold text-[#ef4444]">
                  {ownerError}
                </p>
              )}

              <div className="space-y-1.5">
                <div className="flex justify-between items-center">
                  <label className="block font-mono text-xs font-bold text-[#232331]">
                    Kata Sandi:
                  </label>
                  <a href="#" className="text-[11px] font-mono text-[#7958d8] hover:underline">
                    Lupa sandi?
                  </a>
                </div>
                <div className="relative">
                  <Lock className="absolute left-3.5 top-3.5 text-[#7b7b8e]" size={16} />
                  <input
                    type="password"
                    required
                    value={ownerPassword}
                    onChange={(e) => setOwnerPassword(e.target.value)}
                    className="w-full rounded-2xl border-2 border-[#232331] pl-10 pr-4 py-3 text-xs font-bold text-[#232331] focus:outline-none focus:ring-2 focus:ring-[#7958d8]"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={ownerLoading}
                className="btn-tactile flex w-full items-center justify-center gap-2 rounded-2xl border-2 border-[#232331] bg-[#232331] py-3.5 text-xs font-extrabold text-[#d9ff57] shadow-ink-md"
              >
                <span>{ownerLoading ? "Memverifikasi..." : "Masuk ke Dashboard Owner"}</span>
                <ArrowRight size={15} />
              </button>
            </form>
          )}

          {/* ========================================================= */}
          {/* TAB 2: STAFF PIN LOGIN KEYPAD */}
          {/* ========================================================= */}
          {roleTab === "staff" && (
            <div className="space-y-5">
              <div className="text-center space-y-1">
                <span className="font-mono text-[10px] font-bold text-[#7958d8] uppercase">
                  Shift Operasional Kasir / Barista
                </span>
                <h3 className="font-extrabold text-sm text-[#232331]">
                  Pilih nama, lalu masukkan PIN
                </h3>
              </div>

              {/* Pemilih staf. Kegagalan PIN dihitung ke akun yang dipilih di
                  sini, bukan ke staf pertama di daftar. */}
              {staffList.length === 0 ? (
                <p className="rounded-xl border-2 border-[#ef4444] bg-[#feebee] p-3 text-center text-[11px] font-bold text-[#ef4444]">
                  Belum ada akun staf. Pemilik usaha perlu membuatnya lebih dulu.
                </p>
              ) : (
                <div className="flex flex-wrap justify-center gap-2">
                  {staffList.map((s) => (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => {
                        setStaffId(s.id);
                        setStaffPin("");
                        setStaffError("");
                      }}
                      className={`btn-tactile rounded-xl px-3.5 py-2 text-[11px] font-black transition-colors ${
                        staffId === s.id
                          ? "bg-[#d9ff57] text-[#232331]"
                          : "bg-white text-[#7b7b8e]"
                      }`}
                    >
                      {s.name}
                    </button>
                  ))}
                </div>
              )}

              {/* PIN Bubbles Display */}
              <div className="flex justify-center gap-2.5 my-2">
                {Array.from({ length: 6 }).map((_, i) => {
                  const isFilled = i < staffPin.length;
                  return (
                    <div
                      key={i}
                      className={`h-4 w-4 rounded-full border-2 transition-all ${
                        isFilled
                          ? "border-[#232331] bg-[#7958d8] scale-110"
                          : "border-[#dedee8] bg-[#fcfcfe]"
                      }`}
                    />
                  );
                })}
              </div>

              {staffError && (
                <div className="rounded-xl bg-[#feebee] p-2.5 text-center text-xs font-bold text-[#ef4444] flex items-center justify-center gap-1.5 border border-[#ef4444]/30">
                  <AlertCircle size={14} />
                  <span>{staffError}</span>
                </div>
              )}

              {/* 3x4 Number Keypad */}
              <div className="grid grid-cols-3 gap-2 max-w-[280px] mx-auto">
                {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((num) => (
                  <button
                    key={num}
                    type="button"
                    onClick={() => handleStaffPinInput(num)}
                    className="btn-tactile flex h-12 items-center justify-center rounded-2xl border-2 border-[#232331] bg-white font-mono text-lg font-black text-[#232331] shadow-ink-xs hover:bg-[#f0edff]"
                  >
                    {num}
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() => setStaffPin("")}
                  className="flex h-12 items-center justify-center rounded-2xl border border-[#dedee8] bg-[#fcfcfe] font-mono text-xs font-bold text-[#7b7b8e]"
                >
                  C
                </button>
                <button
                  type="button"
                  onClick={() => handleStaffPinInput("0")}
                  className="btn-tactile flex h-12 items-center justify-center rounded-2xl border-2 border-[#232331] bg-white font-mono text-lg font-black text-[#232331] shadow-ink-xs hover:bg-[#f0edff]"
                >
                  0
                </button>
                <button
                  type="button"
                  onClick={handleStaffBackspace}
                  className="btn-tactile flex h-12 items-center justify-center rounded-2xl border-2 border-[#232331] bg-[#fcfcfe] text-[#232331] shadow-ink-xs"
                >
                  <Delete size={18} />
                </button>
              </div>

              {/* Hint Demo PIN */}
              <div className="rounded-xl border border-dashed border-[#7958d8]/40 bg-[#f0edff]/50 p-2.5 text-center text-[10.5px] font-mono text-[#7958d8]">
                <span>Demo PIN Barista: </span>
                <span className="font-extrabold font-mono bg-white px-1.5 py-0.5 rounded border border-[#7958d8]">123456</span>
              </div>
            </div>
          )}

          {/* ========================================================= */}
          {/* TAB 3: KAEL ADMIN */}
          {/* ========================================================= */}
          {roleTab === "admin" && (
            <form onSubmit={handleAdminLogin} className="space-y-4">
              <div className="rounded-2xl border border-[#dedee8] bg-[#fcfcfe] p-3 text-xs text-[#7b7b8e] font-mono">
                <span className="font-bold text-[#232331] block mb-0.5">Otoritas Tim KAEL:</span>
                Panel khusus penerbitan batch kartu NFC &amp; audit aktivasi. Sesuai UU PDP, peran ini tidak dapat melihat data pelanggan bisnis.
              </div>

              <div className="space-y-1.5">
                <label className="block font-mono text-xs font-bold text-[#232331]">
                  Email KAEL Staff / Admin:
                </label>
                <input
                  type="email"
                  required
                  value={adminEmail}
                  onChange={(e) => setAdminEmail(e.target.value)}
                  className="w-full rounded-2xl border-2 border-[#232331] p-3 text-xs font-bold text-[#232331] focus:outline-none"
                />
              </div>

              <div className="space-y-1.5">
                <label className="block font-mono text-xs font-bold text-[#232331]">
                  Kata Sandi:
                </label>
                <input
                  type="password"
                  required
                  value={adminPassword}
                  onChange={(e) => setAdminPassword(e.target.value)}
                  className="w-full rounded-2xl border-2 border-[#232331] p-3 text-xs font-bold text-[#232331] focus:outline-none"
                />
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
                <span>Buka Admin Batch Kartu</span>
                <ArrowRight size={15} />
              </button>
            </form>
          )}

        </div>
      </main>

      {/* Footer */}
      <footer className="text-center py-2 text-xs font-mono text-[#7b7b8e]">
        KAEL System Security · End-to-End Encryption &amp; RLS Protection
      </footer>
    </div>
  );
}
