"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import {
  Gift, QrCode, History, CheckCircle2, AlertCircle, ArrowRight, ShieldCheck,
  Copy, Check, Clock, Ticket, Users, Share2, Cake, Crown, MessageCircle,
  AtSign, MapPin, UtensilsCrossed, Info, Megaphone, Stamp,
} from "lucide-react";

import type {
  Customer, Business, LoyaltyProgram, Reward, PointLedger, Redemption,
  LoyaltyTier, MemberCardSettings, MenuItem,
} from "@/lib/types";
import { PLACEHOLDER_MENU } from "@/lib/types";
import { maskPhoneNumber, resolveTier } from "@/lib/loyalty-engine";
import { formatRupiah, formatBusinessDateTime } from "@/lib/formatters";
import { BusinessMark } from "@/components/business-mark";
import { brandSurface, normalizeBrandColor, readableInkOn } from "@/lib/branding";
import { updateMarketingPreferenceAction, updateCustomerBirthdayAction } from "@/lib/actions";
import { siteHost } from "@/lib/site";

/**
 * Kartu member yang dipegang pelanggan.
 *
 * Seluruh datanya dikirim sebagai props oleh komponen server di page.tsx.
 * Sebelumnya komponen ini memanggil db langsung dari sisi klien, yang berarti
 * token pelanggan ikut masuk ke bundel JavaScript — dan token itu satu-satunya
 * pengaman halaman ini.
 *
 * Bentuknya kartu, bukan daftar. Yang membuka halaman ini orang yang sedang
 * berdiri di depan kasir, dan yang perlu dia lihat dalam dua detik cuma satu:
 * sudah berapa stempel. Sisanya boleh menunggu di bawah.
 */
export interface MemberPageData {
  customer: Customer | null;
  business: Business | null;
  program: LoyaltyProgram | null;
  rewards: Reward[];
  balance: number;
  ledger: PointLedger[];
  redemptions: Redemption[];
  /** Null kalau program referral toko ini belum diaktifkan owner. */
  referralCode: string | null;
  /** Kosong kalau program level toko ini belum diaktifkan owner. */
  tiers: LoyaltyTier[];
  lifetimeSpend: number;
  /** Isi kartu yang dikarang pemilik usaha. Null kalau belum pernah disetel. */
  cardSettings: MemberCardSettings | null;
  menuItems: MenuItem[];
  visitCount: number;
}

type Tab = "hadiah" | "menu" | "info" | "riwayat";

export default function CustomerMemberProgressPage({
  customer, business, program, rewards, balance, ledger, redemptions,
  referralCode, tiers, lifetimeSpend, cardSettings, menuItems, visitCount,
}: MemberPageData) {
  const [tab, setTab] = useState<Tab>("hadiah");
  const [copiedCode, setCopiedCode] = useState<string | null>(null);
  const [copiedReferralLink, setCopiedReferralLink] = useState(false);
  const [marketingOptIn, setMarketingOptIn] = useState(customer?.marketing_opt_in ?? false);
  const [savingMarketingOptIn, setSavingMarketingOptIn] = useState(false);
  const [marketingPreferenceError, setMarketingPreferenceError] = useState<string | null>(null);
  const [birthdayInput, setBirthdayInput] = useState("");
  const [savingBirthday, setSavingBirthday] = useState(false);
  const [birthdayError, setBirthdayError] = useState<string | null>(null);
  const [birthdaySaved, setBirthdaySaved] = useState(false);

  const activeVoucher = useMemo(
    () => redemptions.find((r) => r.status === "issued") ?? null,
    [redemptions],
  );

  /**
   * Hadiah terdekat yang belum terjangkau. Kalau semuanya sudah terjangkau,
   * yang dipakai yang paling mahal — supaya kartunya tidak pernah kehabisan
   * target dan berhenti terasa berjalan.
   */
  const targetHadiah = useMemo(() => {
    const urut = [...rewards].sort((a, b) => a.point_cost - b.point_cost);
    return urut.find((r) => r.point_cost > balance) ?? urut[urut.length - 1] ?? null;
  }, [rewards, balance]);

  /**
   * Berapa kotak yang digambar di kartu stempel.
   *
   * Diambil dari harga hadiah terdekat, bukan dari kolom tersendiri. Kalau
   * jumlah kotaknya disimpan terpisah dari harga hadiahnya, keduanya pasti
   * akan berbeda suatu hari — pemilik mengubah harga hadiah lewat layar
   * hadiah, kartunya tetap menggambar sepuluh kotak, dan pelanggan yang
   * kotaknya penuh diberi tahu bahwa poinnya masih kurang.
   */
  const totalKotak = Math.min(20, Math.max(1, targetHadiah?.point_cost ?? 10));
  const kotakTerisi = Math.min(balance, totalKotak);
  const stempelKurang = Math.max(0, totalKotak - balance);

  const sortedTiers = useMemo(
    () => [...tiers].sort((a, b) => a.min_lifetime_spend - b.min_lifetime_spend),
    [tiers],
  );
  const currentTier = useMemo(() => resolveTier(lifetimeSpend, tiers), [lifetimeSpend, tiers]);
  const nextTier = currentTier
    ? sortedTiers.find((t) => t.min_lifetime_spend > currentTier.min_lifetime_spend) ?? null
    : sortedTiers[0] ?? null;

  const referralLink = useMemo(() => {
    if (!referralCode || !business?.store_code) return null;
    return `https://${siteHost}/loyalty/register?toko=${encodeURIComponent(business.store_code)}&ref=${encodeURIComponent(referralCode)}`;
  }, [referralCode, business?.store_code]);

  const referralMessage = useMemo(() => {
    if (!referralLink || !business) return "";
    const firstName = customer?.name?.trim().split(/\s+/)[0] || "";
    return `Halo! ${firstName ? firstName + " ajak kamu " : "Aku ajak kamu "}jadi member ${business.name}. Daftar lewat tautan ini, kita berdua dapat bonus di belanja pertamamu ya:\n${referralLink}`;
  }, [referralLink, business, customer?.name]);

  /**
   * Tombol simpan ke WhatsApp.
   *
   * Yang mengirim pesannya PELANGGAN, ke nomor tokonya. Arahnya sengaja begitu:
   * tautan kartu jadi tersimpan di riwayat chat orangnya sendiri, tempat yang
   * dia buka setiap hari — bukan di bookmark peramban yang tidak pernah dibuka
   * lagi. Tokonya sekalian punya percakapan yang sudah terbuka kalau nanti
   * perlu mengabari sesuatu.
   *
   * Tanpa nomor toko, tombolnya tidak digambar sama sekali. wa.me tanpa nomor
   * membuka pemilih kontak, dan pelanggan yang mengirim kartunya ke orang acak
   * lebih buruk daripada tidak ada tombolnya.
   */
  const nomorToko = cardSettings?.whatsapp?.trim() || null;
  const linkKartu = customer ? `https://${siteHost}/m/${customer.token}` : "";
  const simpanKeWa = useMemo(() => {
    if (!nomorToko || !business || !customer) return null;
    const pesan =
      `Halo ${business.name}! Ini kartu member saya atas nama ${customer.name ?? "-"}.\n` +
      `${linkKartu}\n\n` +
      `(Disimpan di sini biar gampang dibuka lagi pas belanja.)`;
    return `https://wa.me/${nomorToko}?text=${encodeURIComponent(pesan)}`;
  }, [nomorToko, business, customer, linkKartu]);

  const handleCopyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    setCopiedCode(code);
    setTimeout(() => setCopiedCode(null), 2000);
  };

  const handleCopyReferralLink = () => {
    if (!referralLink) return;
    navigator.clipboard.writeText(referralLink);
    setCopiedReferralLink(true);
    setTimeout(() => setCopiedReferralLink(false), 2000);
  };

  const handleMarketingPreference = async (nextValue: boolean) => {
    if (!customer) return;
    setMarketingPreferenceError(null);
    setSavingMarketingOptIn(true);
    const result = await updateMarketingPreferenceAction(customer.token, nextValue);
    setSavingMarketingOptIn(false);
    if (!result.ok) {
      setMarketingPreferenceError(result.error);
      return;
    }
    setMarketingOptIn(nextValue);
  };

  const handleSaveBirthday = async () => {
    if (!customer || !birthdayInput) return;
    setBirthdayError(null);
    setSavingBirthday(true);
    const result = await updateCustomerBirthdayAction(customer.token, birthdayInput);
    setSavingBirthday(false);
    if (!result.ok) {
      setBirthdayError(result.error);
      return;
    }
    setBirthdaySaved(true);
  };

  if (!customer || !business || !program) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#f7f6fc] p-4 font-sans text-[#232331]">
        <div className="w-full max-w-sm space-y-4 rounded-3xl border-2 border-[#232331] bg-white p-6 text-center shadow-ink-lg">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl border-2 border-[#ef4444] bg-[#feebee] text-[#ef4444]">
            <AlertCircle size={28} />
          </div>
          <div className="space-y-1">
            <h1 className="text-lg font-black">Kartu Member Tidak Ditemukan</h1>
            <p className="text-xs text-[#5c5c70]">
              Tautan kartu member ini tidak valid atau telah diperbarui oleh pihak toko.
            </p>
          </div>
          <Link
            href="/loyalty/register"
            className="btn-tactile inline-flex w-full items-center justify-center gap-2 rounded-2xl border-2 border-[#232331] bg-[#d9ff57] py-3 text-xs font-black text-[#232331] shadow-ink-xs"
          >
            <span>Daftar Member Baru</span>
            <ArrowRight size={14} />
          </Link>
        </div>
      </div>
    );
  }

  const warna = normalizeBrandColor(business.brand_color);
  const kartu = brandSurface(warna);
  const tinta = readableInkOn(warna);
  /** Warna transparan di atas warna merek, supaya kontrasnya ikut apa pun mereknya. */
  const kabut = tinta === "#232331" ? "rgba(35,35,49,0.10)" : "rgba(255,255,255,0.16)";
  const garis = tinta === "#232331" ? "rgba(35,35,49,0.22)" : "rgba(255,255,255,0.28)";
  const isStempel = program.mode === "stamp";
  const unit = isStempel ? "stempel" : "poin";

  const TABS: { key: Tab; label: string; icon: typeof Gift; tampil: boolean }[] = [
    { key: "hadiah", label: "Hadiah", icon: Gift, tampil: true },
    { key: "menu", label: "Menu", icon: UtensilsCrossed, tampil: menuItems.length > 0 },
    { key: "info", label: "Info", icon: Info, tampil: true },
    { key: "riwayat", label: "Riwayat", icon: History, tampil: true },
  ];
  const tabTampil = TABS.filter((t) => t.tampil);

  return (
    <div className="mx-auto flex min-h-screen max-w-md flex-col border-x border-[#dedee8] bg-[#f7f6fc] font-sans text-[#232331]">

      {/* ---------------------------------------------------------- KEPALA */}
      <header className="sticky top-0 z-30 border-b-2 border-[#232331] bg-white/95 px-4 py-3 backdrop-blur-md">
        <div className="flex items-center justify-between gap-2">
          <div className="flex min-w-0 items-center gap-2.5">
            <BusinessMark
              name={business.name}
              logoUrl={business.logo_url}
              brandColor={business.brand_color}
              className="rounded-xl border border-[#232331]"
            />
            <div className="min-w-0">
              <h1 className="truncate text-sm font-black">{business.name}</h1>
              <span className="block truncate font-mono text-[10px] text-[#5c5c70]">
                {cardSettings?.headline?.trim() || "Kartu Member Digital"}
              </span>
            </div>
          </div>
          <span className="inline-flex shrink-0 items-center gap-1 rounded-full border border-[#16a34a] bg-[#dcfce7] px-2 py-0.5 font-mono text-[9px] font-bold text-[#16a34a]">
            <ShieldCheck size={11} />
            <span>PDP Safe</span>
          </span>
        </div>
      </header>

      <main className="flex-1 space-y-4 p-4">

        {/* ------------------------------------------------ KARTU UTAMA */}
        <div
          className="card-tactile relative overflow-hidden rounded-3xl border-2 border-[#232331] p-5 shadow-ink-lg"
          style={kartu}
        >
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <span className="block font-mono text-[10px] font-bold uppercase tracking-wider opacity-85">
                {isStempel ? "Kartu Stempel" : "Kartu Poin"}
              </span>
              <h2 className="mt-0.5 truncate text-xl font-black">{customer.name}</h2>
              <span className="font-mono text-[11px] opacity-85">
                {maskPhoneNumber(customer.phone)}
              </span>
            </div>
            <span
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl"
              style={{ backgroundColor: kabut, border: `1px solid ${garis}` }}
            >
              {isStempel ? <Stamp size={19} /> : <Ticket size={19} />}
            </span>
          </div>

          {isStempel ? (
            <>
              {/*
                Kartu stempel digambar sebagai kotak, bukan angka. Orang mengerti
                "tinggal dua kotak lagi" tanpa membaca apa pun; "8 dari 10 poin"
                harus dibaca dan dihitung dulu.
              */}
              <div className="mt-4 grid grid-cols-5 gap-2">
                {Array.from({ length: totalKotak }, (_, i) => {
                  const terisi = i < kotakTerisi;
                  return (
                    <span
                      key={i}
                      aria-hidden
                      className="flex aspect-square items-center justify-center rounded-xl text-xs font-black"
                      /*
                       * Kotak kosong TIDAK diredupkan dengan opacity.
                       * Sebelumnya 0.75, dan angkanya jatuh ke kontras 3,83 —
                       * di bawah ambang 4,5 yang dibaca orang di bawah lampu
                       * kafe sambil berdiri. Yang membedakan terisi dari kosong
                       * sudah cukup dari warna latarnya sendiri.
                       */
                      style={{
                        backgroundColor: terisi ? tinta : kabut,
                        color: terisi ? warna : "inherit",
                        border: `1px solid ${garis}`,
                      }}
                    >
                      {terisi ? <Check size={15} strokeWidth={3.5} /> : i + 1}
                    </span>
                  );
                })}
              </div>
              <p className="sr-only">
                {kotakTerisi} dari {totalKotak} stempel terkumpul.
              </p>

              <div
                className="mt-4 flex items-center justify-between gap-3 rounded-2xl px-4 py-3"
                style={{ backgroundColor: kabut, border: `1px solid ${garis}` }}
              >
                <div className="min-w-0">
                  <span className="block font-mono text-[10px] uppercase opacity-95">
                    Terkumpul
                  </span>
                  <span className="font-mono text-2xl font-black">
                    {kotakTerisi}
                    <span className="text-sm opacity-95">/{totalKotak}</span>
                  </span>
                </div>
                <p className="min-w-0 text-right text-[11px] font-bold leading-snug">
                  {stempelKurang === 0
                    ? "Penuh! Tunjukkan ke kasir."
                    : `Kurang ${stempelKurang} kali datang lagi`}
                </p>
              </div>
            </>
          ) : (
            <div
              className="mt-4 flex items-center justify-between gap-3 rounded-2xl px-4 py-3"
              style={{ backgroundColor: kabut, border: `1px solid ${garis}` }}
            >
              <div>
                <span className="block font-mono text-[10px] uppercase opacity-95">
                  Poin terkumpul
                </span>
                <span className="font-mono text-3xl font-black">{balance}</span>
              </div>
              <div className="text-right font-mono text-[11px] opacity-80">
                <span className="block text-[10px] opacity-85">Kurs belanja</span>
                <span className="font-bold">{formatRupiah(program.earn_rate)} = 1</span>
              </div>
            </div>
          )}

          {targetHadiah && (
            <p className="mt-3 text-[11px] leading-snug opacity-80">
              Target: <span className="font-bold">{targetHadiah.name}</span>
              {balance >= targetHadiah.point_cost
                ? " — sudah bisa ditukar."
                : ` — kurang ${targetHadiah.point_cost - balance} ${unit}.`}
            </p>
          )}

          <div className="mt-3 flex items-center justify-between gap-2 font-mono text-[10px] opacity-85">
            <span>Member sejak {formatBusinessDateTime(customer.created_at).split(",")[0]}</span>
            <span>{visitCount}x datang</span>
          </div>
        </div>

        {/* -------------------------------------------- SIMPAN KE WHATSAPP */}
        {simpanKeWa && (
          <a
            href={simpanKeWa}
            target="_blank"
            rel="noopener noreferrer"
            className="btn-tactile flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl border-2 border-[#232331] bg-[#25D366] px-4 py-3 text-sm font-black text-white shadow-ink-xs"
          >
            <MessageCircle size={17} />
            Simpan kartu ke WhatsApp
          </a>
        )}
        {simpanKeWa && (
          <p className="-mt-2 px-1 text-center text-[10.5px] leading-relaxed text-[#5c5c70]">
            Kartunya terkirim sebagai chat ke {business.name}, jadi gampang dibuka lagi
            kapan pun tanpa perlu mencari tautannya.
          </p>
        )}

        {/* ------------------------------------------------- KABAR DARI TOKO */}
        {cardSettings?.announcement?.trim() && (
          <div className="flex items-start gap-2.5 rounded-2xl border-2 border-[#232331] bg-[#fff8e1] p-3.5">
            <Megaphone size={16} className="mt-0.5 shrink-0 text-[#8a6d00]" />
            <p className="min-w-0 text-[11.5px] leading-relaxed font-medium text-[#5c4a00]">
              {cardSettings.announcement}
            </p>
          </div>
        )}

        {/* -------------------------------------------------------- VOUCHER */}
        {activeVoucher && (
          <div className="space-y-2 rounded-2xl border-2 border-[#16a34a] bg-[#f0fdf4] p-4">
            <div className="flex items-center gap-2 text-[#15803d]">
              <QrCode size={16} />
              <span className="text-xs font-black">Voucher siap dipakai</span>
            </div>
            <div className="flex items-center gap-2">
              <code className="min-w-0 flex-1 truncate rounded-xl border border-[#16a34a] bg-white px-3 py-2.5 text-center font-mono text-lg font-black tracking-widest text-[#15803d]">
                {activeVoucher.code}
              </code>
              <button
                type="button"
                onClick={() => handleCopyCode(activeVoucher.code)}
                aria-label="Salin kode voucher"
                className="shrink-0 rounded-xl border-2 border-[#232331] bg-white p-2.5"
              >
                {copiedCode === activeVoucher.code ? <Check size={16} /> : <Copy size={16} />}
              </button>
            </div>
            <p className="text-[10.5px] text-[#15803d]">
              Tunjukkan kode ini ke kasir. Berlaku sekali pakai.
            </p>
          </div>
        )}

        {/* ----------------------------------------------------------- LEVEL */}
        {program.tiers_is_active && currentTier && (
          <div className="space-y-2 rounded-2xl border-2 border-[#232331] bg-gradient-to-br from-[#fef9c3] to-white p-4 shadow-ink-xs">
            <div className="flex items-center gap-2">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-[#d97706] bg-[#fef3c7] text-[#d97706]">
                <Crown size={16} />
              </span>
              <div className="min-w-0">
                <p className="text-xs font-black">Level {currentTier.name}</p>
                <p className="text-[10.5px] text-[#5c5c70]">
                  {currentTier.earn_multiplier > 1
                    ? `Dapat ${currentTier.earn_multiplier}x ${unit} tiap belanja.`
                    : currentTier.benefit_note || "Terima kasih sudah jadi langganan."}
                </p>
              </div>
            </div>
            {nextTier && (
              <p className="text-[10.5px] text-[#5c5c70]">
                Belanja {formatRupiah(Math.max(0, nextTier.min_lifetime_spend - lifetimeSpend))} lagi
                untuk naik ke {nextTier.name}.
              </p>
            )}
          </div>
        )}

        {/* ------------------------------------------------------------ TAB */}
        <div className="flex gap-1.5 rounded-2xl border-2 border-[#232331] bg-white p-1.5">
          {tabTampil.map((t) => {
            const Icon = t.icon;
            const aktif = tab === t.key;
            return (
              <button
                key={t.key}
                type="button"
                onClick={() => setTab(t.key)}
                className={`flex min-h-10 flex-1 items-center justify-center gap-1 rounded-xl text-[11px] font-black ${
                  aktif ? "bg-[#232331] text-[#d9ff57]" : "text-[#5c5c70]"
                }`}
              >
                <Icon size={13} />
                <span>{t.label}</span>
              </button>
            );
          })}
        </div>

        {tab === "hadiah" && (
          <div className="space-y-2">
            {rewards.length === 0 ? (
              <Kosong teks="Belum ada hadiah yang disiapkan toko ini." />
            ) : (
              rewards.map((r) => {
                const cukup = balance >= r.point_cost;
                return (
                  <div
                    key={r.id}
                    className="flex items-center gap-3 rounded-2xl border-2 border-[#232331] bg-white p-3.5 shadow-ink-xs"
                  >
                    <span
                      className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl font-mono text-sm font-black"
                      style={cukup ? kartu : { backgroundColor: "#f2f1f7", color: "#4a4a5c" }}
                    >
                      {r.point_cost}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-black">{r.name}</p>
                      <p className="text-[10.5px] text-[#5c5c70]">
                        {cukup
                          ? "Sudah bisa ditukar di kasir."
                          : `Kurang ${r.point_cost - balance} ${unit} lagi.`}
                      </p>
                    </div>
                    {cukup && (
                      <CheckCircle2 size={18} className="shrink-0 text-[#16a34a]" />
                    )}
                  </div>
                );
              })
            )}
            <p className="px-1 text-[10.5px] leading-relaxed text-[#5c5c70]">
              Penukaran dilakukan kasir dari layarnya. Tunjukkan kartu ini saat membayar.
            </p>
          </div>
        )}

        {tab === "menu" && (
          <div className="space-y-2">
            {menuItems.map((m) => (
              <div
                key={m.id}
                className="flex items-center gap-3 rounded-2xl border-2 border-[#232331] bg-white p-3 shadow-ink-xs"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={m.photo_url || PLACEHOLDER_MENU}
                  alt=""
                  loading="lazy"
                  className="h-16 w-16 shrink-0 rounded-xl border border-[#dedee8] object-cover"
                />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-black">{m.name}</p>
                  {m.description && (
                    <p className="mt-0.5 text-[11px] leading-relaxed text-[#5c5c70]">
                      {m.description}
                    </p>
                  )}
                  <p className="mt-0.5 font-mono text-xs font-black text-[#c2410c]">
                    {formatRupiah(m.price)}
                  </p>
                </div>
              </div>
            ))}
            <p className="px-1 text-[10.5px] text-[#5c5c70]">
              Harga bisa berubah. Yang berlaku harga di kasir.
            </p>
          </div>
        )}

        {tab === "info" && (
          <div className="space-y-3">
            {cardSettings?.welcome_text?.trim() && (
              <p className="rounded-2xl border-2 border-[#232331] bg-white p-4 text-[12px] leading-relaxed shadow-ink-xs">
                {cardSettings.welcome_text}
              </p>
            )}

            <div className="divide-y divide-[#dedee8] rounded-2xl border-2 border-[#232331] bg-white shadow-ink-xs">
              {business.address?.trim() && (
                <BarisInfo icon={MapPin} label="Alamat" nilai={business.address} />
              )}
              {cardSettings?.opening_hours?.trim() && (
                <BarisInfo icon={Clock} label="Jam buka" nilai={cardSettings.opening_hours} />
              )}
              {nomorToko && (
                <BarisInfo
                  icon={MessageCircle}
                  label="WhatsApp"
                  nilai={nomorToko}
                  href={`https://wa.me/${nomorToko}`}
                />
              )}
              {cardSettings?.instagram?.trim() && (
                <BarisInfo
                  icon={AtSign}
                  label="Instagram"
                  nilai={cardSettings.instagram.replace(/^@/, "@")}
                  href={`https://instagram.com/${cardSettings.instagram.replace(/^@/, "")}`}
                />
              )}
              {!business.address?.trim() &&
                !cardSettings?.opening_hours?.trim() &&
                !nomorToko &&
                !cardSettings?.instagram?.trim() && (
                  <div className="p-4">
                    <Kosong teks="Toko ini belum mengisi info kontaknya." />
                  </div>
                )}
            </div>

            {/* AJAK TEMAN */}
            {referralLink && (
              <div className="space-y-2.5 rounded-2xl border-2 border-[#232331] bg-white p-4 shadow-ink-xs">
                <div className="flex items-center gap-2">
                  <Users size={15} className="text-[#7958d8]" />
                  <p className="text-xs font-black">Ajak teman, dua-duanya dapat bonus</p>
                </div>
                <div className="flex items-center gap-2">
                  <code className="min-w-0 flex-1 truncate rounded-xl border border-[#dedee8] bg-[#fcfcfe] px-3 py-2 font-mono text-xs font-bold">
                    {referralCode}
                  </code>
                  <button
                    type="button"
                    onClick={handleCopyReferralLink}
                    aria-label="Salin tautan ajakan"
                    className="shrink-0 rounded-xl border-2 border-[#232331] bg-white p-2"
                  >
                    {copiedReferralLink ? <Check size={15} /> : <Copy size={15} />}
                  </button>
                </div>
                <a
                  href={`https://wa.me/?text=${encodeURIComponent(referralMessage)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn-tactile flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border-2 border-[#232331] bg-[#d9ff57] text-xs font-black"
                >
                  <Share2 size={14} /> Bagikan lewat WhatsApp
                </a>
              </div>
            )}

            {/* ULANG TAHUN */}
            {program.birthday_is_active && !customer.birthday && (
              <div className="space-y-2.5 rounded-2xl border-2 border-[#232331] bg-white p-4 shadow-ink-xs">
                <div className="flex items-center gap-2">
                  <Cake size={15} className="text-[#c2410c]" />
                  <div className="min-w-0">
                    <p className="text-xs font-black">Lengkapi tanggal lahir</p>
                    <p className="text-[10.5px] text-[#5c5c70]">
                      {program.birthday_bonus_points > 0
                        ? `Dapat bonus ${program.birthday_bonus_points} ${unit} di hari ulang tahunmu.`
                        : "Biar toko ini bisa kirim ucapan spesial."}
                    </p>
                  </div>
                </div>
                {birthdaySaved ? (
                  <p className="flex items-center gap-1.5 text-[10.5px] font-bold text-[#16a34a]">
                    <CheckCircle2 size={13} /> Tersimpan. Sampai jumpa di hari spesialmu!
                  </p>
                ) : (
                  <div className="flex items-center gap-2">
                    <input
                      type="date"
                      value={birthdayInput}
                      max={new Date().toISOString().slice(0, 10)}
                      onChange={(e) => setBirthdayInput(e.target.value)}
                      className="min-h-11 flex-1 rounded-xl border border-[#dedee8] bg-[#fcfcfe] p-2.5 text-xs font-bold"
                    />
                    <button
                      type="button"
                      onClick={() => void handleSaveBirthday()}
                      disabled={!birthdayInput || savingBirthday}
                      className="btn-tactile min-h-11 shrink-0 rounded-xl border-2 border-[#232331] bg-[#232331] px-3 text-xs font-black text-[#d9ff57] disabled:opacity-50"
                    >
                      {savingBirthday ? "..." : "Simpan"}
                    </button>
                  </div>
                )}
                {birthdayError && (
                  <p className="text-[10.5px] font-bold text-[#c2410c]">{birthdayError}</p>
                )}
              </div>
            )}

            {/* PERSETUJUAN PROMO */}
            <div className="rounded-2xl border-2 border-[#232331] bg-white p-3.5">
              <label className="flex min-h-11 cursor-pointer items-start gap-3">
                <input
                  type="checkbox"
                  checked={marketingOptIn}
                  disabled={savingMarketingOptIn}
                  onChange={(e) => void handleMarketingPreference(e.target.checked)}
                  className="mt-1 h-4 w-4 rounded accent-[#232331]"
                />
                <span className="min-w-0">
                  <span className="block text-xs font-bold">Info promo lewat WhatsApp</span>
                  <span className="mt-0.5 block text-[10.5px] leading-relaxed text-[#5c5c70]">
                    {marketingOptIn
                      ? "Kamu setuju menerima info promo dan pengingat dari toko ini."
                      : "Centang kalau mau menerima info promo dan pengingat dari toko ini."}
                  </span>
                </span>
              </label>
              {marketingPreferenceError && (
                <p className="mt-2 text-[10.5px] font-bold text-[#c2410c]">
                  {marketingPreferenceError}
                </p>
              )}
            </div>

            <p className="px-1 text-[10.5px] leading-relaxed text-[#5c5c70]">
              Nama dan nomormu disimpan hanya untuk program member toko ini, sesuai
              UU PDP No. 27/2022. Tidak dibagikan ke pihak lain.
            </p>
          </div>
        )}

        {tab === "riwayat" && (
          <div className="space-y-2">
            {ledger.length === 0 ? (
              <Kosong teks="Belum ada aktivitas." />
            ) : (
              ledger.slice(0, 30).map((e) => (
                <div
                  key={e.id}
                  className="flex items-center justify-between gap-3 rounded-2xl border border-[#dedee8] bg-white p-3"
                >
                  <div className="min-w-0">
                    <p className="truncate text-xs font-bold">{e.note}</p>
                    <p className="font-mono text-[10px] text-[#5c5c70]">
                      {formatBusinessDateTime(e.created_at)}
                    </p>
                  </div>
                  <span
                    className={`shrink-0 font-mono text-sm font-black ${
                      e.delta >= 0 ? "text-[#15803d]" : "text-[#c2410c]"
                    }`}
                  >
                    {e.delta >= 0 ? "+" : ""}
                    {e.delta}
                  </span>
                </div>
              ))
            )}
          </div>
        )}
      </main>

      <footer className="border-t border-[#dedee8] bg-white py-3 text-center font-mono text-[10.5px] text-[#5c5c70]">
        Powered by KAEL Loyalty
      </footer>
    </div>
  );
}

function Kosong({ teks }: { teks: string }) {
  return (
    <p className="rounded-2xl border border-dashed border-[#dedee8] p-6 text-center text-xs text-[#5c5c70]">
      {teks}
    </p>
  );
}

function BarisInfo({
  icon: Icon,
  label,
  nilai,
  href,
}: {
  icon: typeof MapPin;
  label: string;
  nilai: string;
  href?: string;
}) {
  const isi = (
    <>
      <Icon size={15} className="mt-0.5 shrink-0 text-[#7958d8]" />
      <span className="min-w-0">
        <span className="block font-mono text-[10px] uppercase text-[#5c5c70]">{label}</span>
        <span className="block break-words text-xs font-bold">{nilai}</span>
      </span>
    </>
  );
  if (href) {
    return (
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className="flex min-h-12 items-start gap-2.5 p-3.5"
      >
        {isi}
      </a>
    );
  }
  return <div className="flex items-start gap-2.5 p-3.5">{isi}</div>;
}
