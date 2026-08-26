"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Store,
  Plus,
  Nfc,
  ArrowLeft,
  Users,
  KeyRound,
  Check,
  AlertTriangle,
  Search,
  MapPin,
  Sparkles,
  ExternalLink,
  Loader2,
} from "lucide-react";

import { createBusinessAction, setBusinessModuleAction, searchPlacesAction } from "@/lib/actions";
import type { Business, BusinessModule } from "@/lib/types";
import type { GooglePlaceResult } from "@/lib/google-places";
import { MODULE_CATALOG, BUSINESS_TYPES, rupiah } from "@/lib/modules-catalog";

type Row = Business & {
  owner_name: string | null;
  owner_email: string | null;
  staff_count: number;
  modules: BusinessModule[];
};

const TERSEDIA = MODULE_CATALOG.filter((m) => m.available);

/** Setahun dari hari ini, dipakai sebagai jatuh tempo bawaan. */
function setahunLagi(): string {
  const d = new Date();
  d.setFullYear(d.getFullYear() + 1);
  return d.toISOString().slice(0, 10);
}

function isoTanggal(v: string | Date): string {
  return v instanceof Date ? v.toISOString().slice(0, 10) : String(v).slice(0, 10);
}

const STATUS_LABEL: Record<string, string> = {
  active: "Aktif",
  suspended: "Ditangguhkan",
  expired: "Kedaluwarsa",
  none: "Tidak dibeli",
};

export default function BusinessesClient({ initial }: { initial: Row[] }) {
  const router = useRouter();
  const [showForm, setShowForm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [pesan, setPesan] = useState<{ ok: boolean; teks: string } | null>(null);

  // --- Formulir pelanggan baru --------------------------------------------
  const [nama, setNama] = useState("");
  const [jenis, setJenis] = useState<string>("kuliner");
  const [kategori, setKategori] = useState("");
  const [telepon, setTelepon] = useState("");
  const [alamat, setAlamat] = useState("");
  const [kodeToko, setKodeToko] = useState("");
  const [namaOwner, setNamaOwner] = useState("");
  const [emailOwner, setEmailOwner] = useState("");
  const [sandiOwner, setSandiOwner] = useState("");
  const [dibeli, setDibeli] = useState<Record<string, string | null>>({});
  const [googlePlaceId, setGooglePlaceId] = useState<string>("");
  const [placesResults, setPlacesResults] = useState<GooglePlaceResult[]>([]);
  const [isSearchingPlaces, setIsSearchingPlaces] = useState(false);
  const [showPlacesDropdown, setShowPlacesDropdown] = useState(false);

  const resetForm = () => {
    setNama(""); setKategori(""); setTelepon(""); setAlamat(""); setKodeToko("");
    setNamaOwner(""); setEmailOwner(""); setSandiOwner(""); setDibeli({});
    setJenis("kuliner");
    setGooglePlaceId("");
    setPlacesResults([]);
    setShowPlacesDropdown(false);
  };

  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const handleSearchPlaces = (query: string) => {
    setNama(query);
    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);

    if (!query || query.trim().length < 2) {
      setPlacesResults([]);
      setShowPlacesDropdown(false);
      setIsSearchingPlaces(false);
      return;
    }

    setIsSearchingPlaces(true);
    setShowPlacesDropdown(true);

    searchTimeoutRef.current = setTimeout(async () => {
      try {
        const res = await searchPlacesAction(query);
        setPlacesResults(res.results);
      } catch {
        setPlacesResults([]);
      } finally {
        setIsSearchingPlaces(false);
      }
    }, 350);
  };

  const handleSelectPlace = (place: GooglePlaceResult) => {
    setNama(place.name);
    setAlamat(place.address);
    setGooglePlaceId(place.placeId);
    setShowPlacesDropdown(false);

    // Otomatis buat saran kode toko jika belum diisi
    if (!kodeToko) {
      const clean = place.name
        .toUpperCase()
        .replace(/[^A-Z0-9]/g, "")
        .slice(0, 8);
      if (clean.length >= 3) setKodeToko(clean);
    }
  };

  const toggleModul = (key: string) => {
    setDibeli((prev) => {
      const next = { ...prev };
      if (key in next) delete next[key];
      else next[key] = setahunLagi();
      return next;
    });
  };

  const simpanPelanggan = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setPesan(null);
    const res = await createBusinessAction({
      name: nama,
      businessType: jenis,
      category: kategori,
      phone: telepon,
      address: alamat,
      storeCode: kodeToko,
      ownerName: namaOwner,
      ownerEmail: emailOwner,
      ownerPassword: sandiOwner,
      googlePlaceId: googlePlaceId || undefined,
      modules: Object.entries(dibeli).map(([module, expiresAt]) => ({
        module,
        expiresAt: expiresAt ?? setahunLagi(),
      })),
    });
    setBusy(false);

    if (!res.ok) {
      setPesan({ ok: false, teks: res.error });
      return;
    }
    setPesan({
      ok: true,
      teks: `${nama} terdaftar. Kode toko ${res.data.storeCode}. Karyawannya masuk dengan kode itu, pemiliknya dengan email.`,
    });
    resetForm();
    setShowForm(false);
    router.refresh();
  };

  // --- Ubah modul satu pelanggan ------------------------------------------
  const ubahModul = async (
    businessId: string,
    module: string,
    status: "active" | "suspended" | "expired" | "none",
    expiresAt: string | null,
  ) => {
    setBusy(true);
    setPesan(null);
    const res = await setBusinessModuleAction(businessId, module, status, expiresAt);
    setBusy(false);
    if (!res.ok) setPesan({ ok: false, teks: res.error });
    else router.refresh();
  };

  const modulTerpilih = Object.keys(dibeli);
  const totalHarga = TERSEDIA.filter((m) => modulTerpilih.includes(m.key)).reduce(
    (n, m) => n + m.price,
    0,
  );

  return (
    <div className="min-h-screen bg-[#f7f6fc] text-[#232331] font-sans">
      <header className="sticky top-0 z-30 border-b-2 border-[#232331] bg-white px-4 sm:px-8 py-3.5">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#232331] text-[#d9ff57] font-black text-sm">
              K
            </span>
            <div>
              <span className="font-extrabold text-sm sm:text-base block">Pelanggan KAEL</span>
              <span className="text-[11px] text-[#7b7b8e] font-mono">
                {initial.length} usaha terdaftar
              </span>
            </div>
          </div>
          <Link
            href="/admin/cards"
            className="inline-flex items-center gap-1.5 rounded-2xl border-2 border-[#232331] bg-white px-3 py-2 font-mono text-xs font-extrabold shadow-ink-xs"
          >
            <Nfc size={14} />
            <span className="hidden sm:inline">Kartu</span>
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 sm:px-8 py-6 space-y-5">
        {pesan && (
          <div
            className={`rounded-2xl border-2 px-4 py-3 flex items-start gap-2.5 ${
              pesan.ok
                ? "border-[#16a34a] bg-[#dcfce7] text-[#14532d]"
                : "border-[#b91c1c] bg-[#fee2e2] text-[#7f1d1d]"
            }`}
          >
            {pesan.ok ? (
              <Check size={18} className="shrink-0 mt-0.5" />
            ) : (
              <AlertTriangle size={18} className="shrink-0 mt-0.5" />
            )}
            <p className="text-sm">{pesan.teks}</p>
          </div>
        )}

        <div className="flex items-center justify-between gap-3">
          <div>
            <h1 className="text-xl font-black">Daftar Pelanggan</h1>
            <p className="text-xs text-[#7b7b8e]">
              Modul yang dinyalakan di sini menentukan apa yang bisa dibuka pemilik usaha.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setShowForm((v) => !v)}
            className="btn-tactile inline-flex items-center gap-1.5 rounded-2xl border-2 border-[#232331] bg-[#d9ff57] px-4 py-2 font-mono text-xs font-extrabold shadow-ink-xs shrink-0"
          >
            {showForm ? <ArrowLeft size={14} strokeWidth={3} /> : <Plus size={14} strokeWidth={3} />}
            <span>{showForm ? "Batal" : "Tambah Pelanggan"}</span>
          </button>
        </div>

        {/* Formulir pelanggan baru */}
        {showForm && (
          <form
            onSubmit={simpanPelanggan}
            className="rounded-3xl border-2 border-[#232331] bg-white p-5 sm:p-6 shadow-ink-md space-y-5"
          >
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5 relative">
                <div className="flex items-center justify-between">
                  <span className="font-mono text-[11px] font-bold text-[#7b7b8e] block">
                    Nama usaha
                  </span>
                  <span className="text-[10px] font-mono text-[#7958d8] flex items-center gap-1">
                    <Sparkles size={11} /> Auto-Search Google Maps
                  </span>
                </div>
                <div className="relative">
                  <input
                    value={nama}
                    onChange={(e) => handleSearchPlaces(e.target.value)}
                    onFocus={() => {
                      if (placesResults.length > 0) setShowPlacesDropdown(true);
                    }}
                    required
                    placeholder="Ketik nama bisnis (contoh: Senja Coffee)..."
                    className="w-full rounded-2xl border-2 border-[#232331] px-3.5 py-2 text-sm pr-9"
                  />
                  <div className="absolute right-3 top-2.5 text-[#7b7b8e]">
                    {isSearchingPlaces ? (
                      <Loader2 size={16} className="animate-spin text-[#7958d8]" />
                    ) : (
                      <Search size={16} />
                    )}
                  </div>
                </div>

                {/* Live Google Places Dropdown */}
                {showPlacesDropdown && placesResults.length > 0 && (
                  <div className="absolute z-20 top-full left-0 right-0 mt-1 rounded-2xl border-2 border-[#232331] bg-white shadow-ink-md max-h-60 overflow-y-auto divide-y divide-[#dedee8]">
                    <div className="p-2 bg-[#f0edff] text-[10px] font-mono font-bold text-[#7958d8] flex items-center justify-between">
                      <span>Pilih Lokasi Google Maps:</span>
                      <button
                        type="button"
                        onClick={() => setShowPlacesDropdown(false)}
                        className="text-[#232331] hover:underline"
                      >
                        Tutup
                      </button>
                    </div>
                    {placesResults.map((p) => (
                      <button
                        key={p.placeId}
                        type="button"
                        onClick={() => handleSelectPlace(p)}
                        className="w-full text-left p-3 hover:bg-[#f7f6fc] transition-colors flex items-start gap-2.5 cursor-pointer"
                      >
                        <MapPin size={16} className="text-[#7958d8] shrink-0 mt-0.5" />
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center justify-between gap-2">
                            <span className="font-extrabold text-xs text-[#232331] truncate">
                              {p.name}
                            </span>
                            {p.rating && (
                              <span className="text-[10px] font-mono text-[#d97706] shrink-0 font-bold">
                                ★ {p.rating.toFixed(1)} ({p.userRatingsTotal ?? 0})
                              </span>
                            )}
                          </div>
                          <p className="text-[11px] text-[#7b7b8e] truncate mt-0.5">
                            {p.address}
                          </p>
                        </div>
                      </button>
                    ))}
                  </div>
                )}

                {googlePlaceId && (
                  <div className="flex items-center gap-1.5 text-[11px] text-[#16a34a] font-mono font-bold bg-[#dcfce7] px-2.5 py-1 rounded-xl border border-[#16a34a]/30">
                    <Check size={13} />
                    <span className="truncate">Tersambung Google Place ID: {googlePlaceId}</span>
                  </div>
                )}
              </div>

              <label className="space-y-1.5">
                <span className="font-mono text-[11px] font-bold text-[#7b7b8e] block">
                  Kode toko (dipakai karyawan untuk masuk)
                </span>
                <input
                  value={kodeToko}
                  onChange={(e) => setKodeToko(e.target.value.toUpperCase())}
                  required
                  placeholder="MELATI"
                  maxLength={10}
                  className="w-full rounded-2xl border-2 border-[#232331] px-3 py-2 text-sm font-mono uppercase"
                />
              </label>

              <label className="space-y-1.5">
                <span className="font-mono text-[11px] font-bold text-[#7b7b8e] block">
                  Jenis usaha
                </span>
                <select
                  value={jenis}
                  onChange={(e) => setJenis(e.target.value)}
                  className="w-full rounded-2xl border-2 border-[#232331] px-3 py-2 text-sm bg-white"
                >
                  {BUSINESS_TYPES.map((t) => (
                    <option key={t.key} value={t.key}>
                      {t.label} — {t.hint}
                    </option>
                  ))}
                </select>
              </label>

              <label className="space-y-1.5">
                <span className="font-mono text-[11px] font-bold text-[#7b7b8e] block">
                  Kategori (tampil di beranda usaha)
                </span>
                <input
                  value={kategori}
                  onChange={(e) => setKategori(e.target.value)}
                  placeholder="Coffee Shop & Bakery"
                  className="w-full rounded-2xl border-2 border-[#232331] px-3 py-2 text-sm"
                />
              </label>

              <label className="space-y-1.5">
                <span className="font-mono text-[11px] font-bold text-[#7b7b8e] block">
                  Nomor telepon usaha
                </span>
                <input
                  value={telepon}
                  onChange={(e) => setTelepon(e.target.value)}
                  placeholder="081234567890"
                  className="w-full rounded-2xl border-2 border-[#232331] px-3 py-2 text-sm font-mono"
                />
              </label>

              <label className="space-y-1.5">
                <span className="font-mono text-[11px] font-bold text-[#7b7b8e] block">
                  Alamat
                </span>
                <input
                  value={alamat}
                  onChange={(e) => setAlamat(e.target.value)}
                  placeholder="Jl. Melati No. 12, Bandung"
                  className="w-full rounded-2xl border-2 border-[#232331] px-3 py-2 text-sm"
                />
              </label>
            </div>

            <div className="border-t border-[#dedee8] pt-5 space-y-4">
              <div className="flex items-center gap-2">
                <KeyRound size={16} className="text-[#7958d8]" />
                <h3 className="font-extrabold text-sm">Akun pemilik usaha</h3>
              </div>
              <div className="grid gap-4 sm:grid-cols-3">
                <label className="space-y-1.5">
                  <span className="font-mono text-[11px] font-bold text-[#7b7b8e] block">
                    Nama pemilik
                  </span>
                  <input
                    value={namaOwner}
                    onChange={(e) => setNamaOwner(e.target.value)}
                    required
                    className="w-full rounded-2xl border-2 border-[#232331] px-3 py-2 text-sm"
                  />
                </label>
                <label className="space-y-1.5">
                  <span className="font-mono text-[11px] font-bold text-[#7b7b8e] block">
                    Email
                  </span>
                  <input
                    type="email"
                    value={emailOwner}
                    onChange={(e) => setEmailOwner(e.target.value)}
                    required
                    className="w-full rounded-2xl border-2 border-[#232331] px-3 py-2 text-sm font-mono"
                  />
                </label>
                <label className="space-y-1.5">
                  <span className="font-mono text-[11px] font-bold text-[#7b7b8e] block">
                    Kata sandi awal
                  </span>
                  <input
                    value={sandiOwner}
                    onChange={(e) => setSandiOwner(e.target.value)}
                    required
                    minLength={6}
                    className="w-full rounded-2xl border-2 border-[#232331] px-3 py-2 text-sm font-mono"
                  />
                </label>
              </div>
              <p className="text-[11px] text-[#7b7b8e] leading-relaxed">
                Kata sandi disimpan dalam bentuk hash scrypt, jadi tidak bisa dibaca lagi setelah
                disimpan. Catat dan serahkan ke pemiliknya sekarang.
              </p>
            </div>

            <div className="border-t border-[#dedee8] pt-5 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="font-extrabold text-sm">Modul yang dibeli</h3>
                {modulTerpilih.length > 0 && (
                  <span className="font-mono text-xs text-[#7b7b8e]">
                    total {rupiah(totalHarga)}
                  </span>
                )}
              </div>
              <div className="grid gap-2.5 sm:grid-cols-2">
                {TERSEDIA.map((m) => {
                  const dipilih = m.key in dibeli;
                  const cocok = m.fits.includes(jenis as "kuliner" | "jasa" | "retail");
                  return (
                    <div
                      key={m.key}
                      className={`rounded-2xl border-2 p-3 space-y-2 ${
                        dipilih ? "border-[#232331] bg-[#f7fee7]" : "border-[#dedee8] bg-white"
                      }`}
                    >
                      <button
                        type="button"
                        onClick={() => toggleModul(m.key)}
                        className="flex w-full items-start gap-2 text-left"
                      >
                        <span
                          className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded border-2 ${
                            dipilih ? "border-[#232331] bg-[#d9ff57]" : "border-[#c9c9d4]"
                          }`}
                        >
                          {dipilih && <Check size={11} strokeWidth={4} />}
                        </span>
                        <span className="space-y-0.5">
                          <span className="font-extrabold text-xs block">{m.name}</span>
                          <span className="font-mono text-[10px] text-[#7b7b8e] block">
                            {rupiah(m.price)} · perpanjangan {rupiah(m.renewal)}/tahun
                          </span>
                          {!cocok && (
                            <span className="font-mono text-[10px] text-[#b45309] block">
                              tidak lazim untuk jenis usaha ini
                            </span>
                          )}
                        </span>
                      </button>
                      {dipilih && (
                        <label className="flex items-center gap-2 pl-6">
                          <span className="font-mono text-[10px] text-[#7b7b8e]">jatuh tempo</span>
                          <input
                            type="date"
                            value={dibeli[m.key] ?? setahunLagi()}
                            onChange={(e) =>
                              setDibeli((p) => ({ ...p, [m.key]: e.target.value }))
                            }
                            className="rounded-xl border border-[#c9c9d4] px-2 py-1 text-xs font-mono"
                          />
                        </label>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            <button
              type="submit"
              disabled={busy}
              className="btn-tactile w-full rounded-2xl border-2 border-[#232331] bg-[#d9ff57] px-4 py-3 font-mono text-sm font-extrabold shadow-ink-xs disabled:opacity-50"
            >
              {busy ? "Menyimpan..." : "Daftarkan Pelanggan"}
            </button>
          </form>
        )}

        {/* Daftar pelanggan */}
        <div className="space-y-4">
          {initial.length === 0 && (
            <div className="rounded-3xl border-2 border-dashed border-[#c9c9d4] bg-white p-10 text-center">
              <Store size={28} className="mx-auto text-[#c9c9d4]" />
              <p className="text-sm text-[#7b7b8e] mt-2">Belum ada pelanggan terdaftar.</p>
            </div>
          )}

          {initial.map((b) => {
            const byKey = new Map(b.modules.map((m) => [m.module, m]));
            return (
              <div
                key={b.id}
                className="rounded-3xl border-2 border-[#232331] bg-white p-5 shadow-ink-md space-y-4"
              >
                <div className="flex flex-wrap items-start justify-between gap-3 border-b border-[#dedee8] pb-3">
                  <div>
                    <h3 className="font-extrabold text-base">{b.name}</h3>
                    <p className="font-mono text-[11px] text-[#7b7b8e] mt-0.5">
                      kode {b.store_code ?? "—"} · {b.business_type} · {b.category}
                    </p>
                    <p className="font-mono text-[11px] text-[#7b7b8e]">
                      {b.owner_email ?? "belum ada akun pemilik"}
                    </p>
                  </div>
                  <span className="inline-flex items-center gap-1.5 rounded-xl border border-[#dedee8] bg-[#fcfcfe] px-2.5 py-1 font-mono text-[11px] text-[#7b7b8e] shrink-0">
                    <Users size={12} />
                    {b.staff_count} karyawan
                  </span>
                </div>

                <div className="space-y-2">
                  {TERSEDIA.map((m) => {
                    const row = byKey.get(m.key);
                    const status = row?.status ?? "none";
                    const tanggal = row ? isoTanggal(row.expires_at) : setahunLagi();
                    return (
                      <div
                        key={m.key}
                        className="flex flex-wrap items-center gap-2 rounded-2xl border border-[#dedee8] bg-[#fcfcfe] px-3 py-2"
                      >
                        <span className="font-extrabold text-xs w-full sm:w-44 shrink-0">
                          {m.name}
                        </span>

                        <select
                          value={status}
                          onChange={(e) =>
                            ubahModul(
                              b.id,
                              m.key,
                              e.target.value as "active" | "suspended" | "expired" | "none",
                              e.target.value === "none" ? null : tanggal,
                            )
                          }
                          disabled={busy}
                          className="rounded-xl border border-[#c9c9d4] bg-white px-2 py-1 text-xs font-mono"
                        >
                          {Object.entries(STATUS_LABEL).map(([v, label]) => (
                            <option key={v} value={v}>
                              {label}
                            </option>
                          ))}
                        </select>

                        {status !== "none" && (
                          <input
                            type="date"
                            defaultValue={tanggal}
                            onBlur={(e) => {
                              if (e.target.value && e.target.value !== tanggal) {
                                ubahModul(
                                  b.id,
                                  m.key,
                                  status as "active" | "suspended" | "expired",
                                  e.target.value,
                                );
                              }
                            }}
                            disabled={busy}
                            className="rounded-xl border border-[#c9c9d4] px-2 py-1 text-xs font-mono"
                          />
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </main>
    </div>
  );
}
