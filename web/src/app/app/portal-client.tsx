"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { 
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
  Lock,
  Star,
  Smartphone,
} from "lucide-react";
import type { Business, User, SafeUser } from "@/lib/types";
import type { LicenseState, ModuleStatus } from "@/lib/licensing";
import { rupiah, type ModuleKey } from "@/lib/modules-catalog";
import { waLink } from "@/lib/site";
import {
  createStaffAction, deactivateStaffAction, setStaffActiveAction, setStaffPermissionsAction, resetStaffPinAction, logout,
} from "@/lib/actions";
import { STAFF_PERMISSIONS, type StaffPermission } from "@/lib/types";
import { formatBusinessDate } from "@/lib/formatters";
import { BusinessMark } from "@/components/business-mark";
import { mochiThemeClass } from "@/lib/mochi-theme";
import { isMochiBusiness } from "@/lib/mochi-brand";
import { usePasangAplikasi } from "@/components/pasang-aplikasi";

/**
 * Satu modul sebagaimana ditampilkan di beranda.
 *
 * Seluruh keputusan lisensi sudah diambil di server (app/page.tsx). Klien ini
 * tidak tahu aturannya, hanya menerima keadaan akhirnya. Itu disengaja: aturan
 * siapa boleh apa tidak pernah dikirim ke browser.
 */
export interface PortalModule {
  key: ModuleKey;
  name: string;
  tagline: string;
  /** Null berarti tidak bisa dibuka: belum dibeli, atau ditangguhkan. */
  href: string | null;
  state: LicenseState;
  /**
   * Keadaan yang DITAMPILKAN. Berbeda dari `state` hanya pada satu hal:
   * modul yang lisensinya sehat tapi konfigurasinya belum lengkap tampil
   * "perlu_disiapkan", bukan "aktif". Sebelum pembedaan ini ada, Loyalty
   * tampil Aktif sementara setiap pendaftaran membernya ditolak.
   */
  status: ModuleStatus;
  setupHint: string | null;
  setupHref: string | null;
  expiresAt: string | null;
  daysLeft: number;
  price: number;
  renewal: number;
  /** Kalimat pemicu dari data toko sendiri. Hanya diisi untuk modul terkunci. */
  hook: string | null;
}

export default function AppPortalHub({
  business,
  modules,
  users,
  sessionName,
  sessionRole,
  sessionPermissions,
  notice,
}: {
  business: Business | null;
  modules: PortalModule[];
  /** Tanpa kolom kredensial: bentuk ini yang boleh sampai ke browser. */
  users: SafeUser[];
  sessionName: string;
  sessionRole: User["role"];
  /** Modul yang boleh dibuka. Kosong untuk owner, yang tidak dibatasi. */
  sessionPermissions: StaffPermission[];
  /** Alasan pengguna dilempar balik ke sini, kalau ada. */
  notice: { kind: "terkunci" | "ditolak"; module: string } | null;
}) {
  const router = useRouter();
  const isMochi = isMochiBusiness(business);

  // Beranda ini halaman pertama owner sesudah masuk — tempat paling wajar
  // untuk menawarkan aplikasi KAEL Owner.
  const pasangAplikasi = usePasangAplikasi();

  // Add staff modal state
  const [showAddStaff, setShowAddStaff] = useState(false);
  const [newStaffName, setNewStaffName] = useState("");
  const [newStaffPin, setNewStaffPin] = useState("");

  // Ganti PIN. Null berarti tidak ada yang sedang diganti.
  const [pinUntuk, setPinUntuk] = useState<{ id: string; name: string } | null>(null);
  const [pinBaru, setPinBaru] = useState("");
  const [pinGalat, setPinGalat] = useState<string | null>(null);
  const [pinSedangSimpan, setPinSedangSimpan] = useState(false);

  const handleAddStaff = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newStaffName || newStaffPin.length < 4 || newStaffPin.length > 6) {
      alert("Nama staf wajib diisi, dan PIN antara 4 sampai 6 angka.");
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
    router.refresh();
  };

  /**
   * Owner mencentang modul yang boleh dibuka karyawannya. Perubahan langsung
   * dikirim ke server; daftar yang sah disaring lagi di sana, jadi mencentang
   * lewat devtools tidak menambah akses.
   */
  const togglePermission = async (
    userId: string,
    current: StaffPermission[],
    key: StaffPermission,
  ) => {
    const next = current.includes(key)
      ? current.filter((p) => p !== key)
      : [...current, key];
    const res = await setStaffPermissionsAction(userId, next);
    if (!res.ok) {
      alert(res.error);
      return;
    }
    router.refresh();
  };

  /**
   * Mengganti PIN karyawan yang lupa PIN-nya.
   */
  const gantiPin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pinUntuk) return;
    if (!/^\d{4,6}$/.test(pinBaru)) {
      setPinGalat("PIN harus 4 sampai 6 angka.");
      return;
    }
    setPinSedangSimpan(true);
    setPinGalat(null);
    const res = await resetStaffPinAction(pinUntuk.id, pinBaru);
    setPinSedangSimpan(false);
    if (!res.ok) {
      setPinGalat(res.error);
      return;
    }
    const nama = pinUntuk.name;
    setPinUntuk(null);
    setPinBaru("");
    alert(`PIN ${nama} sudah diganti. Beri tahu langsung ke orangnya, jangan lewat chat grup.`);
    router.refresh();
  };

  const toggleStaffActive = async (userId: string, currentStatus: boolean) => {
    if (!currentStatus) {
      const res = await setStaffActiveAction(userId, true);
      if (!res.ok) alert(res.error);
      else router.refresh();
      return;
    }
    const res = await deactivateStaffAction(userId);
    if (!res.ok) {
      alert(res.error);
      return;
    }
    router.refresh();
  };

  /**
   * Tampilan per modul.
   */
  const LOOK: Record<string, { icon: typeof Nfc; color: string; bg: string }> = {
    review: { icon: Nfc, color: "#167052", bg: "#edf8f3" },
    pos: { icon: Receipt, color: "#167052", bg: "#edf8f3" },
    loyalty: { icon: HeartHandshake, color: "#167052", bg: "#edf8f3" },
    finance: { icon: Calculator, color: "#167052", bg: "#edf8f3" },
  };

  const aktif = modules.filter((m) => m.state !== "tidak_dimiliki");
  const ditawarkan = modules.filter((m) => m.state === "tidak_dimiliki");

  /** Modul berlangganan yang paling dekat jatuh temponya. */
  const terdekat = aktif
    .filter((m) => m.expiresAt)
    .sort((a, b) => a.daysLeft - b.daysLeft)[0];

  const perluDiperhatikan = aktif.filter(
    (m) => m.state === "tenggang" || m.state === "kedaluwarsa" || m.state === "ditangguhkan",
  );
  /** Pengingat H-30. Diam saja kalau masih jauh. */
  const segeraJatuhTempo = aktif.filter((m) => m.state === "aktif" && m.daysLeft <= 30);

  const BADGE: Record<ModuleStatus, { teks: string; warna: string; bg: string; garis: string }> = {
    aktif: { teks: "Aktif", warna: "#15803d", bg: "#dcfce7", garis: "#86efac" },
    perlu_disiapkan: { teks: "Perlu disiapkan", warna: "#92400e", bg: "#fef3c7", garis: "#fde68a" },
    tenggang: { teks: "Masa tenggang", warna: "#92400e", bg: "#fef3c7", garis: "#fde68a" },
    kedaluwarsa: { teks: "Baca-saja", warna: "#b91c1c", bg: "#fee2e2", garis: "#fca5a5" },
    ditangguhkan: { teks: "Ditangguhkan", warna: "#b91c1c", bg: "#fee2e2", garis: "#fca5a5" },
    tidak_dimiliki: { teks: "Belum aktif", warna: "#637970", bg: "#f0f5f2", garis: "#d8e3de" },
  };

  const pesanNotice =
    notice?.kind === "terkunci"
      ? "Modul itu belum aktif untuk usaha ini."
      : notice?.kind === "ditolak"
        ? "Kamu belum diberi akses ke bagian itu oleh pemilik usaha."
        : null;

  return (
    <div className={`${mochiThemeClass(business)} min-h-screen ${isMochi ? "bg-[#f0f5f2] text-[#1a382d]" : "bg-[#f7f6fc] text-[#232331]"} font-sans flex flex-col`}>
      {business?.is_demo && (
        <p className="bg-amber-100 border-b border-amber-300 px-4 py-2 text-center text-xs font-bold text-amber-950 font-mono">
          AKUN DEMO - data simulasi untuk pengujian
        </p>
      )}
      
      {/* Top App Header */}
      <header className={`sticky top-0 z-30 ${
        isMochi
          ? "bg-[#0b3d2e] border-b border-emerald-800/60 text-white shadow-sm"
          : "bg-white border-b border-[#dedee8]"
      } px-4 sm:px-8 py-3.5 backdrop-blur-md`}>
        <div className="mx-auto flex max-w-6xl items-center justify-between">
          <div className="flex items-center gap-3">
            <BusinessMark
              name={business?.name}
              logoUrl={business?.logo_url}
              brandColor={business?.brand_color}
              className="h-10 w-10 rounded-full border border-emerald-400/40 p-0.5 bg-white shadow-xs"
            />
            <div>
              <div className="flex items-center gap-2">
                <span className={`font-black text-sm sm:text-base ${isMochi ? "text-white" : "text-[#232331]"}`}>
                  {business?.name || "Mochi Cafe n Resto"}
                </span>
                {isMochi && (
                  <span className="rounded-full bg-[#c8f53a] px-2 py-0.5 font-mono text-[9px] font-black text-[#073829] shadow-xs">
                    PORTAL
                  </span>
                )}
              </div>
              <span className={`text-[11px] font-mono block ${isMochi ? "text-emerald-200/80" : "text-[#7b7b8e]"}`}>
                {business?.category} · Timezone: {business?.timezone} (WIB)
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Link
              href="/app/settings"
              className={`inline-flex items-center gap-1.5 rounded-xl px-3.5 py-1.5 font-mono text-xs font-bold transition-all ${
                isMochi
                  ? "border border-emerald-600/40 bg-white/10 hover:bg-white/15 text-white"
                  : "border border-[#dedee8] bg-[#fcfcfe] text-[#232331] hover:border-[#232331]"
              }`}
            >
              <Settings size={13} />
              <span className="hidden sm:inline">Pengaturan</span>
            </Link>
            <button
              type="button"
              onClick={() => logout()}
              className={`rounded-xl px-3.5 py-1.5 font-mono text-xs font-bold transition-all ${
                isMochi
                  ? "border border-emerald-600/40 bg-white/10 hover:bg-white/15 text-white"
                  : "border border-[#dedee8] bg-[#fcfcfe] text-[#232331] hover:border-[#232331]"
              }`}
            >
              Ganti Pengguna / Logout
            </button>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 mx-auto w-full max-w-6xl p-4 sm:p-8 space-y-7">

        {/* EXECUTIVE DASHBOARD OWNER UTAMA HERO BANNER */}
        {sessionRole === "owner" && (
          <div className={`rounded-3xl p-5 sm:p-7 text-white shadow-md ${
            isMochi
              ? "border border-emerald-700/50 bg-gradient-to-br from-[#0b3d2e] via-[#0e4837] to-[#07281e]"
              : "border-2 border-[#232331] bg-gradient-to-br from-[#0b3d2e] via-[#0e4837] to-[#07281e] shadow-ink-md"
          }`}>
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="space-y-1.5">
                <div className="flex items-center gap-2">
                  <span className="rounded-full bg-[#c8f53a] px-2.5 py-0.5 font-mono text-[9.5px] font-black text-[#073829] shadow-xs">
                    PUSAT KENDALI OWNER
                  </span>
                  <span className="text-xs font-mono text-emerald-200">· {business?.name ?? "Mochi Cafe"}</span>
                </div>
                <h2 className="text-xl sm:text-2xl font-black text-white">
                  Dashboard Owner Utama
                </h2>
                <p className="text-xs text-emerald-100/85 max-w-xl leading-relaxed">
                  Akses langsung ke ringkasan omzet hari ini, performa menu terlaris, laci kasir, audit kepuasan pelanggan, serta seluruh pilihan laporan bisnis.
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2 shrink-0">
                <Link
                  href="/app/pos/owner"
                  className="inline-flex items-center gap-2 rounded-2xl bg-[#c8f53a] px-5 py-3 font-mono text-xs font-black text-[#073829] shadow-sm hover:bg-[#bbf028] transition-all active:scale-95"
                >
                  <span>Buka Dashboard Owner Utama</span>
                  <ArrowRight size={15} />
                </Link>
                {pasangAplikasi.tampil && (
                  <button
                    type="button"
                    onClick={pasangAplikasi.pasang}
                    className="inline-flex items-center gap-2 rounded-2xl border border-[#c8f53a]/60 bg-white/5 px-4 py-3 font-mono text-xs font-black text-[#c8f53a] hover:bg-white/10 transition-all active:scale-95"
                  >
                    <Smartphone size={15} />
                    <span>Pasang aplikasi</span>
                  </button>
                )}
              </div>
            </div>

            {/* Quick Report Shortcuts inside the hero card */}
            <div className="mt-5 pt-4 border-t border-emerald-700/60 grid grid-cols-2 sm:grid-cols-4 gap-2.5">
              <Link href="/app/pos/reports" className="flex items-center gap-2.5 rounded-2xl bg-white/10 hover:bg-white/15 p-2.5 transition-colors border border-white/10">
                <Receipt size={16} className="text-[#c8f53a] shrink-0" />
                <div className="min-w-0">
                  <p className="text-xs font-bold truncate">Laporan Penjualan</p>
                  <p className="text-[10px] text-emerald-200 truncate">HPP, Laba &amp; Omzet</p>
                </div>
              </Link>
              <Link href="/app/loyalty/analytics" className="flex items-center gap-2.5 rounded-2xl bg-white/10 hover:bg-white/15 p-2.5 transition-colors border border-white/10">
                <HeartHandshake size={16} className="text-[#c8f53a] shrink-0" />
                <div className="min-w-0">
                  <p className="text-xs font-bold truncate">Laporan Loyalty</p>
                  <p className="text-[10px] text-emerald-200 truncate">Retensi &amp; Member</p>
                </div>
              </Link>
              <Link href="/app/review/reports" className="flex items-center gap-2.5 rounded-2xl bg-white/10 hover:bg-white/15 p-2.5 transition-colors border border-white/10">
                <Star size={16} className="text-[#c8f53a] shrink-0" />
                <div className="min-w-0">
                  <p className="text-xs font-bold truncate">Laporan Review</p>
                  <p className="text-[10px] text-emerald-200 truncate">Google &amp; Keluhan</p>
                </div>
              </Link>
              <Link href="/app/finance/reports" className="flex items-center gap-2.5 rounded-2xl bg-white/10 hover:bg-white/15 p-2.5 transition-colors border border-white/10">
                <Calculator size={16} className="text-[#c8f53a] shrink-0" />
                <div className="min-w-0">
                  <p className="text-xs font-bold truncate">Laporan Keuangan</p>
                  <p className="text-[10px] text-emerald-200 truncate">Arus Kas &amp; Biaya</p>
                </div>
              </Link>
            </div>
          </div>
        )}

        {/* Alasan pengguna dilempar balik ke beranda */}
        {pesanNotice && (
          <div className="rounded-2xl border border-amber-300 bg-amber-50 px-4 py-3 flex items-start gap-2.5 text-amber-900 shadow-sm">
            <AlertTriangle size={18} className="text-amber-700 shrink-0 mt-0.5" />
            <p className="text-xs font-bold leading-relaxed">{pesanNotice}</p>
          </div>
        )}

        {/* Status masa aktif langganan */}
        {aktif.length === 0 ? null : perluDiperhatikan.length > 0 ? (
          <div className="rounded-3xl border border-rose-200 bg-rose-50 p-5 sm:p-6 space-y-3 shadow-sm">
            <div className="flex items-start gap-3">
              <AlertTriangle size={22} className="text-rose-600 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <h3 className="font-extrabold text-base text-rose-900">
                  Ada modul yang masa aktifnya sudah lewat
                </h3>
                <p className="text-xs text-rose-800 leading-relaxed">
                  Data lama tetap bisa dilihat dan diekspor. Yang berhenti hanya penyimpanan
                  data baru, sampai langganannya diperpanjang.
                </p>
              </div>
            </div>
            <ul className="space-y-1.5">
              {perluDiperhatikan.map((m) => (
                <li key={m.key} className="flex flex-wrap items-center gap-2 text-xs">
                  <span className="font-extrabold text-rose-950">{m.name}</span>
                  <span className="font-mono text-rose-800">
                    {m.state === "ditangguhkan"
                      ? "ditangguhkan"
                      : m.state === "tenggang"
                        ? `jatuh tempo ${formatBusinessDate(m.expiresAt!)} — sisa tenggang ${14 + m.daysLeft} hari`
                        : `berakhir ${formatBusinessDate(m.expiresAt!)} — sekarang baca-saja`}
                  </span>
                </li>
              ))}
            </ul>
            {sessionRole === "owner" && (
              <a
                href={waLink(
                  `Halo KAEL, saya ${business?.name ?? "pemilik usaha"} mau memperpanjang langganan: ${perluDiperhatikan
                    .map((m) => m.name)
                    .join(", ")}.`,
                )}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 rounded-2xl bg-[#0b3d2e] hover:bg-[#144f3d] px-4 py-2 font-mono text-xs font-black text-[#c8f53a] shadow-sm transition-all"
              >
                <span>Perpanjang lewat WhatsApp</span>
                <ExternalLink size={13} />
              </a>
            )}
          </div>
        ) : (
          <div className={`rounded-3xl p-5 sm:p-6 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 ${
            isMochi
              ? "border border-[#d8e3de] bg-white shadow-[0_4px_20px_rgba(11,61,46,0.04)] text-[#1a382d]"
              : "border border-[#dedee8] bg-white shadow-sm text-[#232331]"
          }`}>
            <div className="flex items-start gap-3.5">
              <div
                className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl ${
                  isMochi
                    ? "bg-[#edf8f3] text-[#167052] border border-[#a3d9be]"
                    : segeraJatuhTempo.length
                      ? "bg-[#fef3c7] text-[#b45309] border-[#b45309]"
                      : "bg-[#f0edff] text-[#7958d8] border-[#7958d8]"
                }`}
              >
                <Calendar size={22} />
              </div>
              <div>
                <h3 className={`font-black text-base ${isMochi ? "text-[#0b3d2e]" : "text-[#232331]"}`}>
                  {segeraJatuhTempo.length
                    ? "Perpanjangan sudah dekat"
                    : "Langganan berjalan normal"}
                </h3>
                <p className={`text-xs mt-0.5 leading-relaxed ${isMochi ? "text-[#637970]" : "text-[#7b7b8e]"}`}>
                  {segeraJatuhTempo.length
                    ? `${segeraJatuhTempo.map((m) => m.name).join(", ")} jatuh tempo dalam ${
                        segeraJatuhTempo[0].daysLeft
                      } hari. Ada masa tenggang 14 hari setelahnya, jadi kasir tidak berhenti mendadak.`
                    : "Semua modul aktif. Saat jatuh tempo nanti masih ada masa tenggang 14 hari sebelum berpindah ke mode baca-saja."}
                </p>
              </div>
            </div>
            {terdekat?.expiresAt && (
              <div className={`font-mono text-xs md:text-right shrink-0 p-3 rounded-2xl ${
                isMochi
                  ? "bg-[#fbfdfc] border border-[#e0ebe5]"
                  : "bg-[#fcfcfe] border border-[#dedee8]"
              }`}>
                <span className={`block text-[10px] ${isMochi ? "text-[#637970]" : "text-[#7b7b8e]"}`}>
                  Jatuh tempo terdekat:
                </span>
                <span
                  className={`font-black text-sm ${
                    isMochi
                      ? "text-[#167052]"
                      : segeraJatuhTempo.length ? "text-[#b45309]" : "text-[#16a34a]"
                  }`}
                >
                  {formatBusinessDate(terdekat.expiresAt)}
                </span>
              </div>
            )}
          </div>
        )}

        {/* Modul yang dimiliki */}
        <div className="space-y-4">
          <div>
            <h2 className={`text-xl sm:text-2xl font-black ${isMochi ? "text-[#0b3d2e]" : "text-[#232331]"}`}>
              Modul Bisnis Kamu
            </h2>
            <p className={`text-xs mt-0.5 ${isMochi ? "text-[#637970]" : "text-[#7b7b8e]"}`}>
              {sessionRole === "owner"
                ? "Semua data tersimpan di satu tempat dan hanya bisa dibuka oleh akun tokomu."
                : "Bagian yang diberikan pemilik usaha untuk kamu kerjakan."}
            </p>
          </div>

          {aktif.length === 0 ? (
            <div className="rounded-3xl border border-dashed border-[#c2d4cb] bg-white p-8 text-center">
              <p className="text-sm text-[#637970]">
                Belum ada modul yang bisa dibuka dari akun ini.
              </p>
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {aktif.map((mod) => {
                const look = LOOK[mod.key] ?? LOOK.review;
                const Icon = look.icon;
                const badge = BADGE[mod.status];
                const bisaDibuka = Boolean(mod.href);

                const isi = (
                  <>
                    <div className="space-y-3">
                      <div className="flex items-center justify-between gap-2">
                        <span
                          className={`flex h-11 w-11 items-center justify-center rounded-2xl ${
                            isMochi
                              ? "bg-[#edf8f3] text-[#167052] border border-[#bbf7d0]"
                              : "border border-[#232331] shadow-ink-xs"
                          }`}
                          style={isMochi ? undefined : { backgroundColor: look.bg, color: look.color }}
                        >
                          <Icon size={20} />
                        </span>
                        <span
                          className={`rounded-full px-2.5 py-0.5 font-mono text-[9.5px] font-black border ${
                            isMochi
                              ? mod.status === "aktif"
                                ? "bg-[#dcfce7] border-[#86efac] text-[#15803d]"
                                : "bg-[#fef3c7] border-[#fde68a] text-[#92400e]"
                              : ""
                          }`}
                          style={isMochi ? undefined : {
                            backgroundColor: badge.bg,
                            color: badge.warna,
                            borderColor: badge.garis,
                          }}
                        >
                          {badge.teks}
                        </span>
                      </div>
                      <div>
                        <h3 className={`font-black text-base transition-colors ${
                          isMochi
                            ? "text-[#0b3d2e] group-hover:text-emerald-700"
                            : "text-[#232331] group-hover:text-[#7958d8]"
                        }`}>
                          {mod.name}
                        </h3>
                        <p className={`text-xs mt-1 line-clamp-2 leading-relaxed ${
                          isMochi ? "text-[#637970]" : "text-[#7b7b8e]"
                        }`}>
                          {mod.tagline}
                        </p>
                      </div>
                    </div>

                    {mod.setupHint && (
                      <p className={`mt-3 rounded-2xl px-3 py-2 font-mono text-[11px] font-bold leading-snug ${
                        isMochi
                          ? "bg-amber-50/90 border border-amber-200 text-amber-900"
                          : "border border-[#e5b800] bg-[#fff8e1] text-[#8a6d00]"
                      }`}>
                        {mod.setupHint}
                      </p>
                    )}

                    <div className={`mt-4 pt-3.5 border-t flex items-center justify-between text-xs font-mono font-bold ${
                      isMochi
                        ? "border-[#edf4f0] text-[#167052] group-hover:text-[#0b3d2e]"
                        : "border-[#dedee8] text-[#7958d8]"
                    }`}>
                      <span>
                        {mod.setupHint ? "Siapkan sekarang" : bisaDibuka ? "Buka Modul" : "Tidak bisa dibuka"}
                      </span>
                      {bisaDibuka && (
                        <ArrowRight size={14} className="group-hover:translate-x-1 transition-transform" />
                      )}
                    </div>
                  </>
                );

                return bisaDibuka ? (
                  <Link
                    key={mod.key}
                    href={mod.href!}
                    className={`group flex flex-col justify-between rounded-3xl p-5 sm:p-6 transition-all ${
                      isMochi
                        ? "border border-[#d8e3de] bg-white shadow-[0_4px_20px_rgba(11,61,46,0.04)] hover:border-emerald-300 hover:shadow-[0_8px_30px_rgba(11,61,46,0.08)]"
                        : "card-tactile border-2 border-[#232331] bg-white shadow-ink-md hover:translate-y-[-2px]"
                    }`}
                  >
                    {isi}
                  </Link>
                ) : (
                  <div
                    key={mod.key}
                    className={`flex flex-col justify-between rounded-3xl p-5 sm:p-6 opacity-70 ${
                      isMochi
                        ? "border border-[#d8e3de] bg-[#fbfdfc]"
                        : "border-2 border-[#c9c9d4] bg-[#fcfcfe]"
                    }`}
                  >
                    {isi}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Modul yang belum dibeli */}
        {sessionRole === "owner" && ditawarkan.length > 0 && (
          <div className="space-y-4">
            <div>
              <h2 className={`text-xl sm:text-2xl font-black ${isMochi ? "text-[#0b3d2e]" : "text-[#232331]"}`}>
                Bisa ditambahkan ke tokomu
              </h2>
              <p className={`text-xs mt-0.5 ${isMochi ? "text-[#637970]" : "text-[#7b7b8e]"}`}>
                Belum aktif di akun ini. Yang ditampilkan hanya yang cocok untuk jenis usahamu.
              </p>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              {ditawarkan.map((mod) => {
                const look = LOOK[mod.key] ?? LOOK.review;
                const Icon = look.icon;
                return (
                  <div
                    key={mod.key}
                    className={`flex flex-col justify-between gap-4 rounded-3xl p-5 sm:p-6 ${
                      isMochi
                        ? "border border-dashed border-[#c2d4cb] bg-white shadow-sm"
                        : "border-2 border-dashed border-[#c9c9d4] bg-white"
                    }`}
                  >
                    <div className="space-y-3">
                      <div className="flex items-center justify-between gap-2">
                        <span
                          className={`flex h-10 w-10 items-center justify-center rounded-2xl ${
                            isMochi
                              ? "bg-[#edf8f3] text-[#167052] border border-[#bbf7d0]"
                              : "border border-[#c9c9d4]"
                          }`}
                          style={isMochi ? undefined : { backgroundColor: look.bg, color: look.color }}
                        >
                          <Icon size={20} />
                        </span>
                        <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 font-mono text-[9.5px] font-bold ${
                          isMochi
                            ? "bg-[#f0f5f2] border border-[#d8e3de] text-[#637970]"
                            : "border border-[#c9c9d4] bg-[#f2f2f7] text-[#7b7b8e]"
                        }`}>
                          <Lock size={9} />
                          Belum aktif
                        </span>
                      </div>

                      <h3 className={`font-black text-base ${isMochi ? "text-[#0b3d2e]" : "text-[#232331]"}`}>
                        {mod.name}
                      </h3>

                      {mod.hook ? (
                        <p className={`text-sm leading-relaxed font-medium ${isMochi ? "text-[#1a382d]" : "text-[#232331]"}`}>
                          {mod.hook}
                        </p>
                      ) : (
                        <p className={`text-xs leading-relaxed ${isMochi ? "text-[#637970]" : "text-[#7b7b8e]"}`}>
                          {mod.tagline}
                        </p>
                      )}
                    </div>

                    <div className={`space-y-3 pt-3 border-t ${isMochi ? "border-[#edf4f0]" : "border-[#dedee8]"}`}>
                      <div className={`font-mono text-xs ${isMochi ? "text-[#637970]" : "text-[#7b7b8e]"}`}>
                        <span className={`font-black text-sm ${isMochi ? "text-[#0b3d2e]" : "text-[#232331]"}`}>
                          {rupiah(mod.price)}
                        </span>
                        <span> tahun pertama, lalu {rupiah(mod.renewal)} / tahun</span>
                      </div>
                      <a
                        href={waLink(
                          `Halo KAEL, saya ${business?.name ?? "pemilik usaha"} mau menambahkan modul ${mod.name} (${rupiah(mod.price)}).`,
                        )}
                        target="_blank"
                        rel="noopener noreferrer"
                        className={`inline-flex w-full items-center justify-center gap-1.5 rounded-2xl px-4 py-2.5 font-mono text-xs font-black transition-all ${
                          isMochi
                            ? "bg-[#0b3d2e] hover:bg-[#144f3d] text-[#c8f53a] shadow-sm active:scale-98"
                            : "btn-tactile border-2 border-[#232331] bg-[#d9ff57] text-[#232331] shadow-ink-xs"
                        }`}
                      >
                        <span>Tanya cara menambahkan</span>
                        <ExternalLink size={13} />
                      </a>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Kelola Akun Staf */}
        {sessionRole === "owner" && (
          <div className={`rounded-3xl p-6 space-y-5 ${
            isMochi
              ? "border border-[#d8e3de] bg-white shadow-[0_4px_20px_rgba(11,61,46,0.04)] text-[#1a382d]"
              : "border-2 border-[#232331] bg-white shadow-ink-md text-[#232331]"
          }`}>
            <div className={`flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b pb-4 ${
              isMochi ? "border-[#edf4f0]" : "border-[#dedee8]"
            }`}>
              <div>
                <div className="flex items-center gap-2">
                  <Users size={20} className={isMochi ? "text-[#167052]" : "text-[#7958d8]"} />
                  <h3 className={`font-black text-base sm:text-lg ${isMochi ? "text-[#0b3d2e]" : "text-[#232331]"}`}>
                    Kelola Akun Staf &amp; PIN Shift Kasir
                  </h3>
                </div>
                <p className={`text-xs mt-0.5 ${isMochi ? "text-[#637970]" : "text-[#7b7b8e]"}`}>
                  Staf login menggunakan PIN 4 sampai 6 angka (hash scrypt). Akun yang dinonaktifkan tetap menjaga riwayat transaksi lama.
                </p>
              </div>

              <button
                type="button"
                onClick={() => setShowAddStaff(true)}
                className={`inline-flex items-center gap-1.5 rounded-2xl px-4 py-2 font-mono text-xs font-black transition-all ${
                  isMochi
                    ? "bg-[#0b3d2e] hover:bg-[#144f3d] text-[#c8f53a] shadow-sm active:scale-95"
                    : "btn-tactile border-2 border-[#232331] bg-[#d9ff57] text-[#232331] shadow-ink-xs"
                }`}
              >
                <Plus size={14} strokeWidth={3} />
                <span>Tambah Staf Baru</span>
              </button>
            </div>

            {/* Add Staff Form Inline Modal */}
            {showAddStaff && (
              <form onSubmit={handleAddStaff} className={`rounded-2xl p-4 space-y-3 font-mono text-xs ${
                isMochi
                  ? "border border-emerald-300 bg-[#edf8f3] text-[#0b3d2e]"
                  : "border-2 border-[#7958d8] bg-[#f0edff]"
              }`}>
                <span className={`font-bold block ${isMochi ? "text-[#167052]" : "text-[#7958d8]"}`}>
                  BUAT AKUN STAF BARU:
                </span>
                <div className="grid sm:grid-cols-2 gap-3">
                  <input
                    type="text"
                    required
                    placeholder="Nama Staf (contoh: Rahmat Barista)"
                    value={newStaffName}
                    onChange={(e) => setNewStaffName(e.target.value)}
                    className={`rounded-xl border p-2.5 font-bold focus:outline-none ${
                      isMochi
                        ? "border-[#d8e3de] bg-white text-[#0b3d2e] focus:border-emerald-600"
                        : "border-[#232331] bg-white text-[#232331]"
                    }`}
                  />
                  <input
                    type="password"
                    required
                    maxLength={6}
                    placeholder="PIN 6 Digit (contoh: 246810)"
                    value={newStaffPin}
                    onChange={(e) => setNewStaffPin(e.target.value.replace(/[^0-9]/g, ""))}
                    className={`rounded-xl border p-2.5 font-bold tracking-widest focus:outline-none ${
                      isMochi
                        ? "border-[#d8e3de] bg-white text-[#0b3d2e] focus:border-emerald-600"
                        : "border-[#232331] bg-white text-[#232331]"
                    }`}
                  />
                </div>
                <div className="flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setShowAddStaff(false)}
                    className="rounded-xl bg-white px-3 py-1.5 font-bold text-[#637970] border border-[#d8e3de] hover:bg-[#fbfdfc]"
                  >
                    Batal
                  </button>
                  <button
                    type="submit"
                    className={`rounded-xl px-4 py-1.5 font-bold ${
                      isMochi
                        ? "bg-[#0b3d2e] text-[#c8f53a] hover:bg-[#144f3d]"
                        : "bg-[#232331] text-[#d9ff57]"
                    }`}
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
                  <tr className={`border-b text-[10px] uppercase ${
                    isMochi ? "border-[#edf4f0] bg-[#edf8f3] text-[#167052] font-black" : "border-[#dedee8] text-[#7b7b8e]"
                  }`}>
                    <th className="py-2.5 px-3 rounded-l-xl">Nama Pengguna</th>
                    <th className="py-2.5 px-3">Peran / Akses</th>
                    <th className="py-2.5 px-3">Metode Autentikasi</th>
                    <th className="py-2.5 px-3">Status</th>
                    <th className="py-2.5 px-3 text-right rounded-r-xl">Aksi</th>
                  </tr>
                </thead>
                <tbody className={`divide-y ${isMochi ? "divide-[#edf4f0]" : "divide-[#dedee8]"}`}>
                  {users.map((u) => (
                    <tr key={u.id} className={isMochi ? "hover:bg-[#f7fcf9] transition-colors" : "hover:bg-[#fcfcfe]"}>
                      <td className={`py-3 px-3 font-extrabold font-sans ${isMochi ? "text-[#0b3d2e]" : "text-[#232331]"}`}>
                        {u.name}
                      </td>
                      <td className="py-3 px-3">
                        <span className={`rounded-full px-2.5 py-0.5 font-bold text-[10px] ${
                          u.role === "owner"
                            ? isMochi ? "bg-[#0b3d2e] text-[#c8f53a]" : "bg-[#f0edff] text-[#7958d8]"
                            : u.role === "kael_admin"
                            ? "bg-[#ffedd5] text-[#c2410c]"
                            : "bg-[#dcfce7] text-[#15803d]"
                        }`}>
                          {u.role.toUpperCase()}
                        </span>
                      </td>
                      <td className="py-3 px-3 text-[#637970]">
                        {u.role !== "staff" ? (
                          <span>{u.email ? `Email: ${u.email}` : "-"}</span>
                        ) : (
                          <div className="flex flex-wrap gap-1">
                            {STAFF_PERMISSIONS.map((p) => {
                              const punya = (u.permissions ?? []).includes(p.key);
                              return (
                                <button
                                  key={p.key}
                                  type="button"
                                  title={p.hint}
                                  onClick={() =>
                                    togglePermission(
                                      u.id,
                                      (u.permissions ?? []) as StaffPermission[],
                                      p.key,
                                    )
                                  }
                                  className={`rounded-lg border px-2 py-0.5 text-[10px] font-bold transition-colors ${
                                    punya
                                      ? "border-[#86efac] bg-[#dcfce7] text-[#15803d]"
                                      : "border-[#d8e3de] bg-white text-[#889990] hover:border-emerald-300"
                                  }`}
                                >
                                  {punya ? "✓ " : ""}
                                  {p.label}
                                </button>
                              );
                            })}
                          </div>
                        )}
                      </td>
                      <td className="py-3 px-3">
                        <span className={`inline-flex items-center gap-1 font-bold text-[10px] ${
                          u.is_active ? "text-[#15803d]" : "text-[#ef4444]"
                        }`}>
                          <span className={`h-1.5 w-1.5 rounded-full ${u.is_active ? "bg-[#15803d]" : "bg-[#ef4444]"}`} />
                          {u.is_active ? "Aktif" : "Nonaktif"}
                        </span>
                      </td>
                      <td className="py-3 px-3 text-right">
                        {u.role === "staff" && (
                          <div className="flex items-center justify-end gap-3">
                            {u.is_active && (
                              <button
                                type="button"
                                onClick={() => {
                                  setPinUntuk({ id: u.id, name: u.name });
                                  setPinBaru("");
                                  setPinGalat(null);
                                }}
                                className={`text-[11px] font-bold hover:underline ${
                                  isMochi ? "text-[#167052] hover:text-[#0b3d2e]" : "text-[#7958d8]"
                                }`}
                              >
                                Ganti PIN
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() => toggleStaffActive(u.id, u.is_active)}
                              className={`text-[11px] font-bold hover:underline ${
                                isMochi ? "text-[#167052] hover:text-[#0b3d2e]" : "text-[#7958d8]"
                              }`}
                            >
                              {u.is_active ? "Nonaktifkan" : "Aktifkan Kembali"}
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

          </div>
        )}

      </main>

      {/* MODAL GANTI PIN */}
      {pinUntuk && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#07281e]/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <form
            onSubmit={gantiPin}
            className={`w-full max-w-sm rounded-3xl p-6 shadow-2xl ${
              isMochi
                ? "border border-emerald-700/60 bg-white text-[#1a382d]"
                : "border-2 border-[#232331] bg-white text-[#232331]"
            }`}
          >
            <h3 className={`text-base sm:text-lg font-black ${isMochi ? "text-[#0b3d2e]" : "text-[#232331]"}`}>
              Ganti PIN {pinUntuk.name}
            </h3>
            <p className={`mt-1 text-[11px] leading-relaxed ${isMochi ? "text-[#637970]" : "text-[#7b7b8e]"}`}>
              PIN lama tidak bisa dilihat siapa pun, termasuk kamu — yang tersimpan
              cuma hash-nya. Yang bisa dilakukan adalah menggantinya dengan yang baru.
            </p>

            <label className={`mt-4 block text-xs font-bold ${isMochi ? "text-[#0b3d2e]" : "text-[#232331]"}`}>
              PIN baru (4-6 angka)
              <input
                value={pinBaru}
                onChange={(e) => setPinBaru(e.target.value.replace(/\D/g, "").slice(0, 6))}
                inputMode="numeric"
                autoComplete="off"
                autoFocus
                placeholder="······"
                className={`mt-1.5 w-full rounded-2xl border px-3 py-2.5 text-center font-mono text-xl font-black tracking-[0.4em] focus:outline-none ${
                  isMochi
                    ? "border-emerald-500 bg-[#fbfdfc] text-[#0b3d2e] focus:border-emerald-600"
                    : "border-2 border-[#232331] text-[#232331]"
                }`}
              />
            </label>

            {pinGalat && (
              <p className="mt-2 rounded-xl border border-rose-200 bg-rose-50 p-2 text-xs font-bold text-rose-700">
                {pinGalat}
              </p>
            )}

            <div className="mt-5 flex gap-2">
              <button
                type="button"
                onClick={() => setPinUntuk(null)}
                className="flex-1 rounded-xl border border-[#d8e3de] bg-white px-4 py-2.5 text-xs font-bold text-[#637970] hover:bg-[#fbfdfc]"
              >
                Batal
              </button>
              <button
                type="submit"
                disabled={pinSedangSimpan}
                className={`flex-1 rounded-xl px-4 py-2.5 text-xs font-black disabled:opacity-60 ${
                  isMochi
                    ? "bg-[#0b3d2e] hover:bg-[#144f3d] text-[#c8f53a]"
                    : "bg-[#d9ff57] text-[#232331] border-2 border-[#232331]"
                }`}
              >
                {pinSedangSimpan ? "Menyimpan..." : "Simpan PIN"}
              </button>
            </div>
          </form>
        </div>
      )}

      {pasangAplikasi.lembar}

      <footer className={`border-t py-4 text-center text-xs font-mono ${
        isMochi ? "border-[#d8e3de] bg-white text-[#637970]" : "border-[#dedee8] bg-white text-[#7b7b8e]"
      }`}>
        Mochi Cafe n Resto · Data tokomu tersimpan terpisah dan aman di akun ini
      </footer>
    </div>
  );
}
