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
    // router.refresh() menarik ulang daftar staf dari server, bukan menebak
    // hasilnya di sisi klien.
    router.refresh();
  };

  /**
   * Hanya menonaktifkan, tidak pernah menghapus: transaksi lama menunjuk ke
   * user_id staf, dan menghapusnya membuat riwayat kehilangan jejak siapa
   * yang melayani. Mengaktifkan kembali belum tersedia.
   */
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
   *
   * Diganti, bukan ditampilkan: PIN tersimpan sebagai hash satu arah, jadi
   * tidak ada yang bisa membacanya kembali — termasuk pemilik usaha dan
   * termasuk tim KAEL. Sebelum ini, kasir yang lupa PIN berarti akunnya harus
   * dinonaktifkan dan dibuat ulang, dan riwayat transaksinya kehilangan
   * jejak siapa yang melayani.
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
   * Tampilan per modul. Ikon dan warna urusan layar, jadi tinggal di sini dan
   * tidak ikut dikirim server bersama data lisensi.
   */
  const LOOK: Record<string, { icon: typeof Nfc; color: string; bg: string }> = {
    review: { icon: Nfc, color: "#7958d8", bg: "#f0edff" },
    pos: { icon: Receipt, color: "#16a34a", bg: "#dcfce7" },
    loyalty: { icon: HeartHandshake, color: "#d97706", bg: "#fef3c7" },
    finance: { icon: Calculator, color: "#c2410c", bg: "#ffedd5" },
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
    aktif: { teks: "Aktif", warna: "#16a34a", bg: "#dcfce7", garis: "#16a34a" },
    perlu_disiapkan: { teks: "Perlu disiapkan", warna: "#b45309", bg: "#fef3c7", garis: "#b45309" },
    tenggang: { teks: "Masa tenggang", warna: "#b45309", bg: "#fef3c7", garis: "#b45309" },
    kedaluwarsa: { teks: "Baca-saja", warna: "#b91c1c", bg: "#fee2e2", garis: "#b91c1c" },
    ditangguhkan: { teks: "Ditangguhkan", warna: "#b91c1c", bg: "#fee2e2", garis: "#b91c1c" },
    tidak_dimiliki: { teks: "Belum aktif", warna: "#7b7b8e", bg: "#f2f2f7", garis: "#c9c9d4" },
  };

  const pesanNotice =
    notice?.kind === "terkunci"
      ? "Modul itu belum aktif untuk usaha ini."
      : notice?.kind === "ditolak"
        ? "Kamu belum diberi akses ke bagian itu oleh pemilik usaha."
        : null;

  return (
    <div className={`${mochiThemeClass(business)} min-h-screen bg-[#f7f6fc] text-[#232331] font-sans flex flex-col`}>
      {business?.is_demo && <p className="bg-amber-100 px-4 py-2 text-center text-xs font-bold text-amber-950">AKUN DEMO - data simulasi untuk pengujian</p>}
      
      {/* Top App Header */}
      <header className="sticky top-0 z-30 border-b-2 border-[#232331] bg-white px-4 sm:px-8 py-3.5">
        <div className="mx-auto flex max-w-6xl items-center justify-between">
          <div className="flex items-center gap-3">
            <BusinessMark
              name={business?.name}
              logoUrl={business?.logo_url}
              brandColor={business?.brand_color}
              className="rounded-full shadow-ink-xs border border-emerald-400/40"
            />
            <div>
              <div className="flex items-center gap-2">
                <span className="font-extrabold text-sm sm:text-base text-[#232331]">
                  {business?.name || "KAEL Merchant"}
                </span>
              </div>
              <span className="text-[11px] text-[#7b7b8e] font-mono block">
                {business?.category} · Timezone: {business?.timezone} (WIB)
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Link
              href="/app/settings"
              className="btn-tactile inline-flex items-center gap-1.5 rounded-xl border border-[#232331] bg-[#fcfcfe] px-3 py-1.5 font-mono text-xs font-bold shadow-ink-xs"
            >
              <Settings size={13} />
              <span className="hidden sm:inline">Pengaturan</span>
            </Link>
            {/*
              Harus memanggil logout(), bukan sekadar menautkan ke /app/login.
              Versi sebelumnya hanya berpindah halaman dan meninggalkan cookie
              sesi utuh, jadi di tablet kasir yang dipakai bergantian, orang
              berikutnya tinggal mengetik /app dan masih menjadi pengguna
              sebelumnya.
            */}
            <button
              type="button"
              onClick={() => logout()}
              className="btn-tactile rounded-xl border border-[#232331] bg-[#fcfcfe] px-3 py-1.5 font-mono text-xs font-bold text-[#232331] shadow-ink-xs"
            >
              Ganti Pengguna / Logout
            </button>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 mx-auto w-full max-w-6xl p-4 sm:p-8 space-y-8">

        {/* EXECUTIVE DASHBOARD OWNER UTAMA HERO BANNER */}
        {sessionRole === "owner" && (
          <div className="rounded-3xl border-2 border-[#232331] bg-gradient-to-br from-[#0b3d2e] via-[#0e4837] to-[#07281e] p-5 sm:p-7 text-white shadow-ink-md">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="space-y-1.5">
                <div className="flex items-center gap-2">
                  <span className="rounded-full bg-[#c8f53a] px-2.5 py-0.5 font-mono text-[9.5px] font-black text-[#073829]">
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
              <div className="flex items-center gap-2 shrink-0">
                <Link
                  href="/app/pos/owner"
                  className="btn-tactile inline-flex items-center gap-2 rounded-2xl bg-[#c8f53a] px-5 py-3 font-mono text-xs font-black text-[#073829] shadow-sm hover:bg-[#bbf028] transition-all active:scale-95"
                >
                  <span>Buka Dashboard Owner Utama</span>
                  <ArrowRight size={15} />
                </Link>
              </div>
            </div>

            {/* Quick Report Shortcuts inside the hero card */}
            <div className="mt-5 pt-4 border-t border-emerald-700/60 grid grid-cols-2 sm:grid-cols-4 gap-2.5">
              <Link href="/app/pos/reports" className="flex items-center gap-2.5 rounded-xl bg-white/10 hover:bg-white/15 p-2.5 transition-colors">
                <Receipt size={16} className="text-[#c8f53a] shrink-0" />
                <div className="min-w-0">
                  <p className="text-xs font-bold truncate">Laporan Penjualan</p>
                  <p className="text-[10px] text-emerald-200 truncate">HPP, Laba &amp; Omzet</p>
                </div>
              </Link>
              <Link href="/app/loyalty/analytics" className="flex items-center gap-2.5 rounded-xl bg-white/10 hover:bg-white/15 p-2.5 transition-colors">
                <HeartHandshake size={16} className="text-[#c8f53a] shrink-0" />
                <div className="min-w-0">
                  <p className="text-xs font-bold truncate">Laporan Loyalty</p>
                  <p className="text-[10px] text-emerald-200 truncate">Retensi &amp; Member</p>
                </div>
              </Link>
              <Link href="/app/review/reports" className="flex items-center gap-2.5 rounded-xl bg-white/10 hover:bg-white/15 p-2.5 transition-colors">
                <Star size={16} className="text-[#c8f53a] shrink-0" />
                <div className="min-w-0">
                  <p className="text-xs font-bold truncate">Laporan Review</p>
                  <p className="text-[10px] text-emerald-200 truncate">Google &amp; Keluhan</p>
                </div>
              </Link>
              <Link href="/app/finance/reports" className="flex items-center gap-2.5 rounded-xl bg-white/10 hover:bg-white/15 p-2.5 transition-colors">
                <Calculator size={16} className="text-[#c8f53a] shrink-0" />
                <div className="min-w-0">
                  <p className="text-xs font-bold truncate">Laporan Keuangan</p>
                  <p className="text-[10px] text-emerald-200 truncate">Arus Kas &amp; Biaya</p>
                </div>
              </Link>
            </div>
          </div>
        )}

        
        {/* Banner Renewal Info (Fondasi Bersama 2.1) */}
        {/* Alasan pengguna dilempar balik ke beranda */}
        {pesanNotice && (
          <div className="rounded-2xl border-2 border-[#b45309] bg-[#fef3c7] px-4 py-3 flex items-start gap-2.5">
            <AlertTriangle size={18} className="text-[#b45309] shrink-0 mt-0.5" />
            <p className="text-sm text-[#78350f]">{pesanNotice}</p>
          </div>
        )}

        {/*
          Status masa aktif langganan.

          Tidak ditampilkan sama sekali kalau belum ada modul apa pun, karena
          "Langganan berjalan normal" di atas daftar yang kosong itu saling
          bertentangan. Keadaan ini nyata: admin bisa mematikan semua modul
          sebuah usaha dari panel.
        */}
        {aktif.length === 0 ? null : perluDiperhatikan.length > 0 ? (
          <div className="rounded-3xl border-2 border-[#b91c1c] bg-[#fee2e2] p-5 sm:p-6 space-y-3">
            <div className="flex items-start gap-3">
              <AlertTriangle size={22} className="text-[#b91c1c] shrink-0 mt-0.5" />
              <div className="space-y-1">
                <h3 className="font-extrabold text-base text-[#7f1d1d]">
                  Ada modul yang masa aktifnya sudah lewat
                </h3>
                <p className="text-xs text-[#7f1d1d] leading-relaxed">
                  Data lama tetap bisa dilihat dan diekspor. Yang berhenti hanya penyimpanan
                  data baru, sampai langganannya diperpanjang.
                </p>
              </div>
            </div>
            <ul className="space-y-1.5">
              {perluDiperhatikan.map((m) => (
                <li key={m.key} className="flex flex-wrap items-center gap-2 text-xs">
                  <span className="font-extrabold text-[#7f1d1d]">{m.name}</span>
                  <span className="font-mono text-[#991b1b]">
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
                className="btn-tactile inline-flex items-center gap-1.5 rounded-2xl border-2 border-[#232331] bg-[#d9ff57] px-4 py-2 font-mono text-xs font-extrabold text-[#232331] shadow-ink-xs"
              >
                <span>Perpanjang lewat WhatsApp</span>
                <ExternalLink size={13} />
              </a>
            )}
          </div>
        ) : (
          <div className="rounded-3xl border-2 border-[#232331] bg-white p-5 sm:p-6 shadow-ink-md flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            <div className="flex items-start gap-3.5">
              <div
                className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border ${
                  segeraJatuhTempo.length
                    ? "bg-[#fef3c7] text-[#b45309] border-[#b45309]"
                    : "bg-[#f0edff] text-[#7958d8] border-[#7958d8]"
                }`}
              >
                <Calendar size={22} />
              </div>
              <div>
                <h3 className="font-extrabold text-base text-[#232331]">
                  {segeraJatuhTempo.length
                    ? "Perpanjangan sudah dekat"
                    : "Langganan berjalan normal"}
                </h3>
                <p className="text-xs text-[#7b7b8e] mt-0.5 leading-relaxed">
                  {segeraJatuhTempo.length
                    ? `${segeraJatuhTempo.map((m) => m.name).join(", ")} jatuh tempo dalam ${
                        segeraJatuhTempo[0].daysLeft
                      } hari. Ada masa tenggang 14 hari setelahnya, jadi kasir tidak berhenti mendadak.`
                    : "Semua modul aktif. Saat jatuh tempo nanti masih ada masa tenggang 14 hari sebelum berpindah ke mode baca-saja."}
                </p>
              </div>
            </div>
            {terdekat?.expiresAt && (
              <div className="font-mono text-xs md:text-right shrink-0 bg-[#fcfcfe] p-3 rounded-2xl border border-[#dedee8]">
                <span className="text-[#7b7b8e] block">Jatuh tempo terdekat:</span>
                <span
                  className={`font-extrabold text-sm ${
                    segeraJatuhTempo.length ? "text-[#b45309]" : "text-[#16a34a]"
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
            <h2 className="text-xl font-black text-[#232331]">Modul Bisnis Kamu</h2>
            <p className="text-xs text-[#7b7b8e]">
              {sessionRole === "owner"
                ? "Semua data tersimpan di satu tempat dan hanya bisa dibuka oleh akun tokomu."
                : "Bagian yang diberikan pemilik usaha untuk kamu kerjakan."}
            </p>
          </div>

          {aktif.length === 0 ? (
            <div className="rounded-3xl border-2 border-dashed border-[#c9c9d4] bg-white p-8 text-center">
              <p className="text-sm text-[#7b7b8e]">
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
                          className="flex h-10 w-10 items-center justify-center rounded-2xl border border-[#232331] shadow-ink-xs"
                          style={{ backgroundColor: look.bg, color: look.color }}
                        >
                          <Icon size={20} />
                        </span>
                        <span
                          className="rounded-md px-2 py-0.5 font-mono text-[9px] font-bold border"
                          style={{
                            backgroundColor: badge.bg,
                            color: badge.warna,
                            borderColor: badge.garis,
                          }}
                        >
                          {badge.teks}
                        </span>
                      </div>
                      <div>
                        <h3 className="font-extrabold text-base text-[#232331] group-hover:text-[#7958d8] transition-colors">
                          {mod.name}
                        </h3>
                        <p className="text-xs text-[#7b7b8e] mt-1 line-clamp-2 leading-relaxed">
                          {mod.tagline}
                        </p>
                      </div>
                    </div>
                    {/*
                      Apa yang kurang, bukan cuma bahwa ada yang kurang.
                      Pemilik usaha yang membaca "Perlu disiapkan" tanpa
                      kalimat ini tetap tidak tahu harus ke mana.
                    */}
                    {mod.setupHint && (
                      <p className="mt-3 rounded-xl border border-[#e5b800] bg-[#fff8e1] px-2.5 py-1.5 font-mono text-[10.5px] font-bold text-[#8a6d00]">
                        {mod.setupHint}
                      </p>
                    )}
                    <div className="mt-4 pt-3 border-t border-[#dedee8] flex items-center justify-between text-xs font-mono font-bold text-[#7958d8]">
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
                    className="card-tactile group flex flex-col justify-between rounded-3xl border-2 border-[#232331] bg-white p-5 shadow-ink-md transition-all hover:translate-y-[-2px]"
                  >
                    {isi}
                  </Link>
                ) : (
                  <div
                    key={mod.key}
                    className="flex flex-col justify-between rounded-3xl border-2 border-[#c9c9d4] bg-[#fcfcfe] p-5 opacity-70"
                  >
                    {isi}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/*
          Modul yang belum dibeli.

          Hanya tampil untuk owner, dan hanya yang masuk akal untuk jenis
          usahanya: barbershop tidak pernah melihat kalkulator resep. Kartu
          memakai angka dari tokonya sendiri kalau angkanya sudah cukup
          berarti, karena gembok kosong terbaca "aplikasi ini belum jadi",
          bukan "menarik, saya mau".
        */}
        {sessionRole === "owner" && ditawarkan.length > 0 && (
          <div className="space-y-4">
            <div>
              <h2 className="text-xl font-black text-[#232331]">Bisa ditambahkan ke tokomu</h2>
              <p className="text-xs text-[#7b7b8e]">
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
                    className="flex flex-col justify-between gap-4 rounded-3xl border-2 border-dashed border-[#c9c9d4] bg-white p-5"
                  >
                    <div className="space-y-3">
                      <div className="flex items-center justify-between gap-2">
                        <span
                          className="flex h-10 w-10 items-center justify-center rounded-2xl border border-[#c9c9d4]"
                          style={{ backgroundColor: look.bg, color: look.color }}
                        >
                          <Icon size={20} />
                        </span>
                        <span className="inline-flex items-center gap-1 rounded-md border border-[#c9c9d4] bg-[#f2f2f7] px-2 py-0.5 font-mono text-[9px] font-bold text-[#7b7b8e]">
                          <Lock size={9} />
                          Belum aktif
                        </span>
                      </div>

                      <h3 className="font-extrabold text-base text-[#232331]">{mod.name}</h3>

                      {mod.hook ? (
                        <p className="text-sm text-[#232331] leading-relaxed font-medium">
                          {mod.hook}
                        </p>
                      ) : (
                        <p className="text-xs text-[#7b7b8e] leading-relaxed">{mod.tagline}</p>
                      )}
                    </div>

                    <div className="space-y-3 border-t border-[#dedee8] pt-3">
                      <div className="font-mono text-xs text-[#7b7b8e]">
                        <span className="font-extrabold text-sm text-[#232331]">
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
                        className="btn-tactile inline-flex w-full items-center justify-center gap-1.5 rounded-2xl border-2 border-[#232331] bg-[#d9ff57] px-4 py-2 font-mono text-xs font-extrabold text-[#232331] shadow-ink-xs"
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

        {/*
          Kelola Akun Staf. Syarat peran di sini adalah lapis KEDUA, bukan
          satu-satunya: /app sudah dijaga guardOwnerPage di server. Lapis ini
          ada karena panel inilah yang dulu lolos justru karena syaratnya lupa
          dipasang, sementara blok-blok tetangganya punya.
        */}
        {sessionRole === "owner" && (
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
                Staf login menggunakan PIN 4 sampai 6 angka (hash scrypt). Akun yang dinonaktifkan tetap menjaga riwayat transaksi lama.
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
                                    ? "border-[#16a34a] bg-[#dcfce7] text-[#16a34a]"
                                    : "border-[#dedee8] bg-white text-[#b8b8c4]"
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
                        u.is_active ? "text-[#16a34a]" : "text-[#ef4444]"
                      }`}>
                        <span className={`h-1.5 w-1.5 rounded-full ${u.is_active ? "bg-[#16a34a]" : "bg-[#ef4444]"}`} />
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
                              className="text-[11px] font-bold text-[#7958d8] hover:underline"
                            >
                              Ganti PIN
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => toggleStaffActive(u.id, u.is_active)}
                            className="text-[11px] font-bold text-[#7958d8] hover:underline"
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

      {pinUntuk && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <form
            onSubmit={gantiPin}
            className="w-full max-w-sm rounded-2xl border-2 border-[#232331] bg-white p-5"
          >
            <h3 className="text-base font-black text-[#232331]">Ganti PIN {pinUntuk.name}</h3>
            <p className="mt-1 text-[11px] leading-relaxed text-[#7b7b8e]">
              PIN lama tidak bisa dilihat siapa pun, termasuk kamu — yang tersimpan
              cuma hash-nya. Yang bisa dilakukan adalah menggantinya dengan yang baru.
            </p>

            <label className="mt-4 block text-xs font-bold text-[#232331]">
              PIN baru (4-6 angka)
              <input
                value={pinBaru}
                onChange={(e) => setPinBaru(e.target.value.replace(/\D/g, "").slice(0, 6))}
                inputMode="numeric"
                autoComplete="off"
                autoFocus
                placeholder="······"
                className="mt-1 w-full rounded-lg border-2 border-[#232331] px-3 py-2 text-center font-mono text-lg font-black tracking-[0.4em]"
              />
            </label>

            {pinGalat && (
              <p className="mt-2 rounded-lg border border-[#c2410c] bg-[#fff7ed] p-2 text-xs font-bold text-[#c2410c]">
                {pinGalat}
              </p>
            )}

            <div className="mt-5 flex gap-2">
              <button
                type="button"
                onClick={() => setPinUntuk(null)}
                className="flex-1 rounded-lg border-2 border-[#232331] bg-white px-4 py-2.5 text-sm font-black"
              >
                Batal
              </button>
              <button
                type="submit"
                disabled={pinSedangSimpan}
                className="flex-1 rounded-lg border-2 border-[#232331] bg-[#d9ff57] px-4 py-2.5 text-sm font-black disabled:opacity-60"
              >
                {pinSedangSimpan ? "Menyimpan..." : "Simpan PIN"}
              </button>
            </div>
          </form>
        </div>
      )}

      <footer className="border-t border-[#dedee8] bg-white py-4 text-center text-xs font-mono text-[#7b7b8e]">
        KAEL System · Data tokomu tersimpan terpisah dan hanya bisa dibuka dari akun ini
      </footer>
    </div>
  );
}
