"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { 
  Store, 
  Nfc, 
  Receipt, 
  Calculator, 
  HeartHandshake, 
  ShieldCheck, 
  Users, 
  Calendar, 
  Clock, 
  KeyRound, 
  ExternalLink, 
  ArrowRight, 
  Plus, 
  Settings, 
  AlertTriangle,
  CheckCircle2,
  Lock
} from "lucide-react";
import type { Business, BusinessModule, User } from "@/lib/types";
import { createStaffAction, deactivateStaffAction, logout } from "@/lib/actions";
import { formatBusinessDate } from "@/lib/formatters";

export default function AppPortalHub({
  business,
  modules,
  users,
  sessionName,
  sessionRole,
}: {
  business: Business | null;
  modules: BusinessModule[];
  users: User[];
  sessionName: string;
  sessionRole: User["role"];
}) {
  const router = useRouter();

  // Add staff modal state
  const [showAddStaff, setShowAddStaff] = useState(false);
  const [newStaffName, setNewStaffName] = useState("");
  const [newStaffPin, setNewStaffPin] = useState("");

  const handleAddStaff = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newStaffName || newStaffPin.length !== 6) {
      alert("Nama staf dan PIN 6-digit harus diisi lengkap.");
      return;
    }
    const res = await createStaffAction(newStaffName, newStaffPin);
    if (!res.ok) {
      alert(res.error);
      return;
    }
    setShowAddStaff(false);
    setNewStaffName("");
    setNewStaffPin("");
    // router.refresh() menarik ulang daftar staf dari server, bukan menebak
    // hasilnya di sisi klien.
    router.refresh();
  };

  /**
   * Hanya menonaktifkan, tidak pernah menghapus: transaksi lama menunjuk ke
   * user_id staf, dan menghapusnya membuat riwayat kehilangan jejak siapa
   * yang melayani. Mengaktifkan kembali belum tersedia.
   */
  const toggleStaffActive = async (userId: string, currentStatus: boolean) => {
    if (!currentStatus) {
      alert("Mengaktifkan kembali staf belum tersedia. Buat akun baru untuk sementara.");
      return;
    }
    const res = await deactivateStaffAction(userId);
    if (!res.ok) {
      alert(res.error);
      return;
    }
    router.refresh();
  };

  const moduleCards = [
    {
      id: "review",
      title: "KAEL Review",
      description: "Smart NFC Card & Standee Google Maps direct 302 booster, tap analytics & Place ID lock.",
      href: "/app/review",
      icon: Nfc,
      color: "#7958d8",
      bgColor: "#f0edff",
      badge: "Modul Aktif",
    },
    {
      id: "pos",
      title: "KAEL POS & Ordering",
      description: "Kasir layar sentuh tablet, pesanan meja QR realtime, print bluetooth thermal, shift kasir.",
      href: "/app/pos",
      icon: Receipt,
      color: "#16a34a",
      bgColor: "#dcfce7",
      badge: "Modul Aktif",
    },
    {
      id: "finance",
      title: "KAEL Finance & HPP",
      description: "Kalkulator resep & food cost, margin otomatis, laporan laba rugi bersih & HPP terstandar.",
      href: "/app/finance",
      icon: Calculator,
      color: "#c2410c",
      bgColor: "#ffedd5",
      badge: "Modul Aktif",
    },
    {
      id: "loyalty",
      title: "KAEL Loyalty CRM",
      description: "Paspor stempel digital, poin WhatsApp otomatis, UU PDP compliant, repeat order booster.",
      href: "/app/loyalty",
      icon: HeartHandshake,
      color: "#d97706",
      bgColor: "#fef3c7",
      badge: "Modul Aktif",
    },
  ];

  return (
    <div className="min-h-screen bg-[#f7f6fc] text-[#232331] font-sans flex flex-col">
      
      {/* Top App Header */}
      <header className="sticky top-0 z-30 border-b-2 border-[#232331] bg-white px-4 sm:px-8 py-3.5">
        <div className="mx-auto flex max-w-6xl items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#232331] text-[#d9ff57] font-black text-sm shadow-ink-xs">
              K
            </span>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-extrabold text-sm sm:text-base text-[#232331]">
                  {business?.name || "KAEL Merchant"}
                </span>
                <span className="rounded-md bg-[#dcfce7] px-2 py-0.5 font-mono text-[9px] font-bold text-[#16a34a] border border-[#16a34a]">
                  Multi-Tenant Live
                </span>
              </div>
              <span className="text-[11px] text-[#7b7b8e] font-mono block">
                {business?.category} · Timezone: {business?.timezone} (WIB)
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Link
              href="/app/login"
              className="btn-tactile rounded-xl border border-[#232331] bg-[#fcfcfe] px-3 py-1.5 font-mono text-xs font-bold text-[#232331] shadow-ink-xs"
            >
              Ganti Pengguna / Logout
            </Link>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 mx-auto w-full max-w-6xl p-4 sm:p-8 space-y-8">
        
        {/* Banner Renewal Info (Fondasi Bersama 2.1) */}
        <div className="rounded-3xl border-2 border-[#232331] bg-white p-5 sm:p-6 shadow-ink-md flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="flex items-start gap-3.5">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[#f0edff] text-[#7958d8] border border-[#7958d8]">
              <Calendar size={22} />
            </div>
            <div>
              <h3 className="font-extrabold text-base text-[#232331]">
                Status Langganan Cloud &amp; Support KAEL
              </h3>
              <p className="text-xs text-[#7b7b8e] mt-0.5">
                Paket Anda aktif dengan garansi redirect kartu 100% online dan masa tenggang 14 hari saat jatuh tempo renewal tahunan.
              </p>
            </div>
          </div>
          <div className="font-mono text-xs text-right shrink-0 bg-[#fcfcfe] p-3 rounded-2xl border border-[#dedee8]">
            <span className="text-[#7b7b8e] block">Jatuh Tempo Perpanjangan:</span>
            <span className="font-extrabold text-[#16a34a] text-sm">
              {formatBusinessDate(modules[0]?.expires_at || "2027-01-15")}
            </span>
          </div>
        </div>

        {/* Modules Navigation Grid */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-black text-[#232331]">
                Modul Bisnis Terintegrasi
              </h2>
              <p className="text-xs text-[#7b7b8e]">
                Satu database Postgres terpusat melayani seluruh kebutuhan operasional tokomu.
              </p>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {moduleCards.map((mod) => {
              const Icon = mod.icon;
              return (
                <Link
                  key={mod.id}
                  href={mod.href}
                  className="card-tactile group flex flex-col justify-between rounded-3xl border-2 border-[#232331] bg-white p-5 shadow-ink-md transition-all hover:translate-y-[-2px]"
                >
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span
                        className="flex h-10 w-10 items-center justify-center rounded-2xl border border-[#232331] shadow-ink-xs"
                        style={{ backgroundColor: mod.bgColor, color: mod.color }}
                      >
                        <Icon size={20} />
                      </span>
                      <span className="rounded-md bg-[#dcfce7] px-2 py-0.5 font-mono text-[9px] font-bold text-[#16a34a] border border-[#16a34a]">
                        {mod.badge}
                      </span>
                    </div>
                    <div>
                      <h3 className="font-extrabold text-base text-[#232331] group-hover:text-[#7958d8] transition-colors">
                        {mod.title}
                      </h3>
                      <p className="text-xs text-[#7b7b8e] mt-1 line-clamp-2 leading-relaxed">
                        {mod.description}
                      </p>
                    </div>
                  </div>

                  <div className="mt-4 pt-3 border-t border-[#dedee8] flex items-center justify-between text-xs font-mono font-bold text-[#7958d8]">
                    <span>Buka Modul</span>
                    <ArrowRight size={14} className="group-hover:translate-x-1 transition-transform" />
                  </div>
                </Link>
              );
            })}
          </div>
        </div>

        {/* Staff & Shift Keypad PIN Management (Fondasi Bersama 1.4) */}
        <div className="rounded-3xl border-2 border-[#232331] bg-white p-6 shadow-ink-md space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#dedee8] pb-4">
            <div>
              <div className="flex items-center gap-2">
                <Users size={20} className="text-[#7958d8]" />
                <h3 className="font-extrabold text-base text-[#232331]">
                  Kelola Akun Staf &amp; PIN Shift Kasir
                </h3>
              </div>
              <p className="text-xs text-[#7b7b8e] mt-0.5">
                Staf login menggunakan PIN 6-digit (hash terenkripsi). Akun yang dinonaktifkan tetap menjaga riwayat transaksi lama.
              </p>
            </div>

            <button
              type="button"
              onClick={() => setShowAddStaff(true)}
              className="btn-tactile inline-flex items-center gap-1.5 rounded-2xl border-2 border-[#232331] bg-[#d9ff57] px-4 py-2 font-mono text-xs font-extrabold text-[#232331] shadow-ink-xs"
            >
              <Plus size={14} strokeWidth={3} />
              <span>Tambah Staf Baru</span>
            </button>
          </div>

          {/* Add Staff Form Inline Modal */}
          {showAddStaff && (
            <form onSubmit={handleAddStaff} className="rounded-2xl border-2 border-[#7958d8] bg-[#f0edff] p-4 space-y-3 font-mono text-xs">
              <span className="font-bold text-[#7958d8] block">BUAT AKUN STAF BARU:</span>
              <div className="grid sm:grid-cols-2 gap-3">
                <input
                  type="text"
                  required
                  placeholder="Nama Staf (contoh: Rahmat Barista)"
                  value={newStaffName}
                  onChange={(e) => setNewStaffName(e.target.value)}
                  className="rounded-xl border border-[#232331] bg-white p-2.5 font-bold text-[#232331] focus:outline-none"
                />
                <input
                  type="password"
                  required
                  maxLength={6}
                  placeholder="PIN 6 Digit (contoh: 246810)"
                  value={newStaffPin}
                  onChange={(e) => setNewStaffPin(e.target.value.replace(/[^0-9]/g, ""))}
                  className="rounded-xl border border-[#232331] bg-white p-2.5 font-bold text-[#232331] tracking-widest focus:outline-none"
                />
              </div>
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowAddStaff(false)}
                  className="rounded-xl bg-white px-3 py-1.5 font-bold text-[#7b7b8e] border border-[#dedee8]"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="rounded-xl bg-[#232331] px-4 py-1.5 font-bold text-[#d9ff57]"
                >
                  Simpan Staf ✓
                </button>
              </div>
            </form>
          )}

          {/* Staff Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-left font-mono text-xs">
              <thead>
                <tr className="border-b border-[#dedee8] text-[#7b7b8e] text-[10px] uppercase">
                  <th className="py-2.5 px-3">Nama Pengguna</th>
                  <th className="py-2.5 px-3">Peran / Akses</th>
                  <th className="py-2.5 px-3">Metode Autentikasi</th>
                  <th className="py-2.5 px-3">Status</th>
                  <th className="py-2.5 px-3 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#dedee8]">
                {users.map((u) => (
                  <tr key={u.id} className="hover:bg-[#fcfcfe]">
                    <td className="py-3 px-3 font-extrabold text-[#232331] font-sans">
                      {u.name}
                    </td>
                    <td className="py-3 px-3">
                      <span className={`rounded px-2 py-0.5 font-bold text-[10px] ${
                        u.role === "owner"
                          ? "bg-[#f0edff] text-[#7958d8]"
                          : u.role === "kael_admin"
                          ? "bg-[#ffedd5] text-[#c2410c]"
                          : "bg-[#dcfce7] text-[#16a34a]"
                      }`}>
                        {u.role.toUpperCase()}
                      </span>
                    </td>
                    <td className="py-3 px-3 text-[#7b7b8e]">
                      {u.email ? `Email: ${u.email}` : "6-Digit SHA-256 PIN"}
                    </td>
                    <td className="py-3 px-3">
                      <span className={`inline-flex items-center gap-1 font-bold text-[10px] ${
                        u.is_active ? "text-[#16a34a]" : "text-[#ef4444]"
                      }`}>
                        <span className={`h-1.5 w-1.5 rounded-full ${u.is_active ? "bg-[#16a34a]" : "bg-[#ef4444]"}`} />
                        {u.is_active ? "Aktif" : "Nonaktif"}
                      </span>
                    </td>
                    <td className="py-3 px-3 text-right">
                      {u.role === "staff" && (
                        <button
                          type="button"
                          onClick={() => toggleStaffActive(u.id, u.is_active)}
                          className="text-[11px] font-bold text-[#7958d8] hover:underline"
                        >
                          {u.is_active ? "Nonaktifkan" : "Aktifkan Kembali"}
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

        </div>

      </main>

      <footer className="border-t border-[#dedee8] bg-white py-4 text-center text-xs font-mono text-[#7b7b8e]">
        KAEL System v1.0 · Fondasi Bersama &amp; Multi-Tenant Database
      </footer>
    </div>
  );
}
