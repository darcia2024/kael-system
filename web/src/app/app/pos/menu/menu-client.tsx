"use client";

import { useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Plus,
  Pencil,
  Trash2,
  ImageOff,
  Loader2,
  X,
  Upload,
  Search,
  Check,
  Sparkles,
  Layers,
  Utensils,
} from "lucide-react";

import {
  saveMenuItemAction,
  deleteMenuItemAction,
  saveCategoryAction,
  deleteCategoryAction,
  uploadImageAction,
} from "@/lib/actions";
import { kompresGambar } from "@/lib/kompres-gambar";
import type { Business, Category, MenuItem } from "@/lib/types";
import { PLACEHOLDER_MENU } from "@/lib/types";
import { isMochiBusiness } from "@/lib/mochi-brand";
import { BusinessMark } from "@/components/business-mark";

const rupiah = (n: number) => "Rp " + Math.round(n).toLocaleString("id-ID");

/** Bentuk formulir. Harga dan deskripsi disimpan sebagai teks selama diketik. */
type Draf = {
  id?: string;
  name: string;
  price: string;
  categoryId: string;
  description: string;
  photoUrl: string;
  recipeId: string;
  isAvailable: boolean;
};

const DRAF_KOSONG: Draf = {
  name: "",
  price: "",
  categoryId: "",
  description: "",
  photoUrl: "",
  recipeId: "",
  isAvailable: true,
};

export default function MenuClient({
  business,
  categories,
  menuItems,
  recipes,
  themeClassName = "",
}: {
  business?: Business | null;
  categories: Category[];
  menuItems: MenuItem[];
  recipes: { id: string; name: string }[];
  themeClassName?: string;
}) {
  const isMochi = isMochiBusiness(business);
  const router = useRouter();
  const [draf, setDraf] = useState<Draf | null>(null);
  const [sedangSimpan, setSedangSimpan] = useState(false);
  const [galat, setGalat] = useState<string | null>(null);
  const [kabar, setKabar] = useState<string | null>(null);
  const [kategoriBaru, setKategoriBaru] = useState("");
  const [sedangUnggah, setSedangUnggah] = useState(false);
  const [cari, setCari] = useState("");
  const [filterKategori, setFilterKategori] = useState<string>("all");
  const berkasRef = useRef<HTMLInputElement | null>(null);

  /**
   * Memilih foto: diperkecil di peramban lebih dulu, baru dikirim.
   */
  const pilihFoto = async (file: File | undefined) => {
    if (!file || !draf) return;
    setGalat(null);
    setSedangUnggah(true);
    try {
      const kecil = await kompresGambar(file);
      const res = await uploadImageAction(kecil.dataUrl, {
        width: kecil.width,
        height: kecil.height,
      });
      if (!res.ok) {
        setGalat(res.error);
        return;
      }
      setDraf((d) => (d ? { ...d, photoUrl: res.data.url } : d));
    } catch (err) {
      setGalat(err instanceof Error ? err.message : "Gambar gagal diproses.");
    } finally {
      setSedangUnggah(false);
      if (berkasRef.current) berkasRef.current.value = "";
    }
  };

  const namaKategori = (id: string | null) =>
    categories.find((c) => c.id === id)?.name ?? "Tanpa kategori";

  const simpan = async () => {
    if (!draf) return;
    setGalat(null);

    const harga = Number(draf.price.replace(/[^\d]/g, ""));
    if (!draf.name.trim()) return setGalat("Nama menu belum diisi.");
    if (!Number.isFinite(harga) || harga <= 0) return setGalat("Harga belum diisi.");

    setSedangSimpan(true);
    const res = await saveMenuItemAction({
      id: draf.id,
      name: draf.name,
      price: harga,
      categoryId: draf.categoryId || null,
      description: draf.description,
      photoUrl: draf.photoUrl,
      recipeId: draf.recipeId || null,
      isAvailable: draf.isAvailable,
    });
    setSedangSimpan(false);

    if (!res.ok) return setGalat(res.error);
    setDraf(null);
    setKabar(draf.id ? "Menu berhasil diperbarui." : "Menu baru berhasil ditambahkan.");
    router.refresh();
  };

  const hapus = async (item: MenuItem) => {
    if (!confirm(`Hapus "${item.name}" dari daftar menu?`)) return;
    setGalat(null);
    const res = await deleteMenuItemAction(item.id);
    if (!res.ok) return setGalat(res.error);
    setKabar(
      res.data.hidden
        ? `"${item.name}" pernah terjual, jadi disembunyikan dari layar kasir dan tidak dihapus. Riwayat penjualannya tetap utuh.`
        : `"${item.name}" berhasil dihapus.`,
    );
    router.refresh();
  };

  const tambahKategori = async () => {
    if (!kategoriBaru.trim()) return;
    setGalat(null);
    const res = await saveCategoryAction({ name: kategoriBaru.trim(), sortOrder: categories.length });
    if (!res.ok) return setGalat(res.error);
    const ditambahkan = kategoriBaru.trim();
    setKategoriBaru("");
    setKabar(`Kategori "${ditambahkan}" ditambahkan.`);
    router.refresh();
  };

  const hapusKategori = async (id: string, nama: string) => {
    if (!confirm(`Hapus kategori "${nama}"? Menu di dalamnya tidak akan terhapus.`)) return;
    setGalat(null);
    const res = await deleteCategoryAction(id);
    if (!res.ok) return setGalat(res.error);
    setKabar(`Kategori "${nama}" dihapus.`);
    router.refresh();
  };

  /** Filter menu secara reaktif */
  const menuTerfilter = useMemo(() => {
    return menuItems.filter((m) => {
      const q = cari.toLowerCase().trim();
      const matchCari =
        !q ||
        m.name.toLowerCase().includes(q) ||
        (m.description && m.description.toLowerCase().includes(q));

      const matchKat =
        filterKategori === "all" ||
        (filterKategori === "none" ? !m.category_id : m.category_id === filterKategori);

      return matchCari && matchKat;
    });
  }, [menuItems, cari, filterKategori]);

  return (
    <main
      className={`${themeClassName} mochi-shell min-h-screen ${
        isMochi ? "bg-[#f0f5f2] text-[#0b3d2e] font-sans" : "bg-[#f7f6fc] text-[#232331]"
      } p-4 sm:p-8 transition-colors`}
    >
      <div className="mx-auto max-w-5xl space-y-6">
        {/* Tombol Kembali */}
        <div className="flex items-center justify-between">
          <Link
            href="/app/pos"
            className={`inline-flex h-11 items-center gap-2 rounded-2xl px-4 text-xs font-bold transition-all shadow-xs ${
              isMochi
                ? "border border-[#d8e3de] bg-white text-[#0b3d2e] hover:bg-[#e4ede8] hover:border-emerald-600/40"
                : "border-2 border-[#232331] bg-white text-[#232331]"
            }`}
            title="Kembali ke terminal kasir"
          >
            <ArrowLeft size={16} />
            <span>Ke Kasir</span>
          </Link>

          <Link
            href="/app/pos/owner"
            className={`inline-flex h-11 items-center gap-2 rounded-2xl px-4 text-xs font-bold transition-all shadow-xs ${
              isMochi
                ? "border border-[#d8e3de] bg-white text-[#0b3d2e] hover:bg-[#e4ede8] hover:border-emerald-600/40"
                : "border-2 border-[#232331] bg-white text-[#232331]"
            }`}
          >
            <span>Dashboard Owner</span>
          </Link>
        </div>

        {/* Header Toko */}
        <header
          className={`flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between ${
            isMochi
              ? "rounded-3xl border border-[#d8e3de] bg-white p-6 shadow-[0_4px_24px_rgba(11,61,46,0.04)]"
              : "rounded-2xl border-2 border-[#232331] bg-white p-5 shadow-ink-md"
          }`}
        >
          <div className="flex items-center gap-4">
            {isMochi ? (
              <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-white p-1 border border-emerald-400/40 shadow-xs overflow-hidden">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="/logo-mochi.png" alt="Mochi Logo" className="h-full w-full object-contain" />
              </div>
            ) : (
              <BusinessMark
                name={business?.name}
                logoUrl={business?.logo_url}
                brandColor={business?.brand_color}
                size="lg"
                className="rounded-2xl border border-black/10 shrink-0"
              />
            )}
            <div>
              <div className="flex items-center gap-2">
                <span
                  className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[10px] font-bold tracking-wider uppercase font-mono ${
                    isMochi ? "bg-[#0b3d2e]/10 text-[#0b3d2e]" : "bg-[#7958d8]/10 text-[#7958d8]"
                  }`}
                >
                  {isMochi ? "Mochi Cafe n Resto · POS" : "KAEL POS"}
                </span>
              </div>
              <h1 className={`text-2xl sm:text-3xl font-black tracking-tight ${isMochi ? "text-[#0b3d2e]" : ""}`}>
                Kelola Menu
              </h1>
              <p className={`mt-0.5 text-xs sm:text-sm ${isMochi ? "text-[#4d665a]" : "text-[#7b7b8e]"}`}>
                Menu yang dikelola di sini langsung tampil di POS kasir dan di halaman pemesanan meja.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => {
              setDraf({ ...DRAF_KOSONG });
              setGalat(null);
            }}
            className={`inline-flex items-center justify-center gap-2 rounded-2xl px-5 py-3 text-sm font-black transition-all shadow-sm ${
              isMochi
                ? "bg-[#0b3d2e] text-[#c8f53a] hover:bg-[#167052] hover:shadow-md"
                : "border-2 border-[#232331] bg-[#d9ff57] text-[#232331]"
            }`}
          >
            <Plus size={18} />
            <span>Tambah Menu Baru</span>
          </button>
        </header>

        {/* Notifikasi Galat / Sukses */}
        {galat && (
          <div
            className={`flex items-start justify-between gap-3 p-4 text-sm font-semibold rounded-2xl border ${
              isMochi
                ? "border-rose-200 bg-rose-50 text-rose-800 shadow-xs"
                : "border-2 border-[#c2410c] bg-[#fff7ed] text-[#c2410c]"
            }`}
          >
            <span>{galat}</span>
            <button type="button" onClick={() => setGalat(null)} aria-label="Tutup" className="opacity-70 hover:opacity-100">
              <X size={16} />
            </button>
          </div>
        )}
        {kabar && (
          <div
            className={`flex items-start justify-between gap-3 p-4 text-sm font-semibold rounded-2xl border ${
              isMochi
                ? "border-emerald-200 bg-[#f0fdf4] text-emerald-800 shadow-xs"
                : "border-2 border-[#15803d] bg-[#f0fdf4] text-[#15803d]"
            }`}
          >
            <div className="flex items-center gap-2">
              <Check size={16} className="text-emerald-600 shrink-0" />
              <span>{kabar}</span>
            </div>
            <button type="button" onClick={() => setKabar(null)} aria-label="Tutup" className="opacity-70 hover:opacity-100">
              <X size={16} />
            </button>
          </div>
        )}

        {/* ------------------------------------------------------- KATEGORI */}
        <section
          className={`space-y-4 ${
            isMochi
              ? "rounded-3xl border border-[#d8e3de] bg-white p-6 shadow-[0_4px_24px_rgba(11,61,46,0.04)]"
              : "rounded-2xl border-2 border-[#232331] bg-white p-5 shadow-ink-md"
          }`}
        >
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2">
                <Layers size={18} className={isMochi ? "text-[#167052]" : "text-[#7958d8]"} />
                <h2 className={`text-base sm:text-lg font-black ${isMochi ? "text-[#0b3d2e]" : ""}`}>
                  Kategori Menu
                </h2>
              </div>
              <p className={`mt-0.5 text-xs ${isMochi ? "text-[#637970]" : "text-[#7b7b8e]"}`}>
                Kategori ini menjadi tab navigasi di terminal POS kasir dan menu digital meja pelanggan.
              </p>
            </div>
            <span
              className={`rounded-full px-3 py-1 font-mono text-xs font-bold ${
                isMochi ? "bg-[#f0f5f2] text-[#0b3d2e]" : "bg-neutral-100 text-neutral-600"
              }`}
            >
              {categories.length} Kategori
            </span>
          </div>

          <div className="flex flex-wrap gap-2 pt-1">
            {categories.map((c) => (
              <span
                key={c.id}
                className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-xs font-bold transition-all shadow-xs ${
                  isMochi
                    ? "border border-emerald-200/80 bg-[#f0f5f2] text-[#0b3d2e] hover:bg-emerald-100/60"
                    : "border-2 border-[#232331] bg-[#f7f6fc]"
                }`}
              >
                <span>{c.name}</span>
                <button
                  type="button"
                  onClick={() => hapusKategori(c.id, c.name)}
                  aria-label={`Hapus kategori ${c.name}`}
                  className={`${isMochi ? "text-[#637970] hover:text-rose-600" : "text-[#7b7b8e] hover:text-[#c2410c]"} transition-colors`}
                >
                  <X size={14} />
                </button>
              </span>
            ))}
            {!categories.length && (
              <p className="text-xs text-[#7b7b8e]">Belum ada kategori terdaftar.</p>
            )}
          </div>

          <div className="flex gap-2 pt-2 border-t border-[#edf2ef]">
            <input
              value={kategoriBaru}
              onChange={(e) => setKategoriBaru(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && tambahKategori()}
              placeholder="Tambah kategori baru (misal: Cemilan, Kopi, Dessert)..."
              className={`min-w-0 flex-1 rounded-xl px-4 py-2.5 text-sm transition-all ${
                isMochi
                  ? "border border-[#d8e3de] bg-[#f8faf9] text-[#0b3d2e] placeholder:text-[#8ba298] focus:border-[#0b3d2e] focus:bg-white focus:outline-none"
                  : "border-2 border-[#232331]"
              }`}
            />
            <button
              type="button"
              onClick={tambahKategori}
              className={`shrink-0 rounded-xl px-5 py-2.5 text-sm font-black transition-all ${
                isMochi
                  ? "bg-[#0b3d2e] text-[#c8f53a] hover:bg-[#167052] shadow-xs"
                  : "border-2 border-[#232331] bg-[#d9ff57]"
              }`}
            >
              Tambah
            </button>
          </div>
        </section>

        {/* ----------------------------------------------------- DAFTAR MENU */}
        <section
          className={`space-y-5 ${
            isMochi
              ? "rounded-3xl border border-[#d8e3de] bg-white p-6 shadow-[0_4px_24px_rgba(11,61,46,0.04)]"
              : "rounded-2xl border-2 border-[#232331] bg-white p-5 shadow-ink-md"
          }`}
        >
          {/* Baris Judul & Pencarian */}
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-2.5">
              <Utensils size={18} className={isMochi ? "text-[#167052]" : "text-[#7958d8]"} />
              <h2 className={`text-base sm:text-lg font-black ${isMochi ? "text-[#0b3d2e]" : ""}`}>
                Daftar Menu
              </h2>
              <span
                className={`rounded-full px-2.5 py-0.5 text-xs font-bold font-mono ${
                  isMochi ? "bg-[#f0f5f2] text-[#0b3d2e]" : "bg-neutral-100 text-neutral-600"
                }`}
              >
                {menuItems.length} menu
              </span>
            </div>

            <div className="relative w-full sm:w-72">
              <Search
                size={16}
                className={`absolute left-3.5 top-1/2 -translate-y-1/2 ${
                  isMochi ? "text-[#637970]" : "text-[#7b7b8e]"
                }`}
              />
              <input
                value={cari}
                onChange={(e) => setCari(e.target.value)}
                placeholder="Cari nama menu..."
                className={`w-full rounded-xl pl-9 pr-4 py-2 text-xs transition-all ${
                  isMochi
                    ? "border border-[#d8e3de] bg-[#f8faf9] text-[#0b3d2e] placeholder:text-[#8ba298] focus:border-[#0b3d2e] focus:bg-white focus:outline-none"
                    : "border-2 border-[#232331]"
                }`}
              />
              {cari && (
                <button
                  type="button"
                  onClick={() => setCari("")}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-700"
                >
                  <X size={13} />
                </button>
              )}
            </div>
          </div>

          {/* Filter Tab Kategori */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
            <button
              type="button"
              onClick={() => setFilterKategori("all")}
              className={`shrink-0 rounded-xl px-3.5 py-1.5 text-xs font-bold transition-all ${
                filterKategori === "all"
                  ? isMochi
                    ? "bg-[#0b3d2e] text-[#c8f53a] shadow-xs"
                    : "bg-[#232331] text-white"
                  : isMochi
                    ? "bg-[#f0f5f2] text-[#4d665a] hover:bg-[#e4ede8]"
                    : "bg-neutral-100 text-neutral-600 hover:bg-neutral-200"
              }`}
            >
              Semua ({menuItems.length})
            </button>
            {categories.map((c) => {
              const count = menuItems.filter((m) => m.category_id === c.id).length;
              return (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => setFilterKategori(c.id)}
                  className={`shrink-0 rounded-xl px-3.5 py-1.5 text-xs font-bold transition-all ${
                    filterKategori === c.id
                      ? isMochi
                        ? "bg-[#0b3d2e] text-[#c8f53a] shadow-xs"
                        : "bg-[#232331] text-white"
                      : isMochi
                        ? "bg-[#f0f5f2] text-[#4d665a] hover:bg-[#e4ede8]"
                        : "bg-neutral-100 text-neutral-600 hover:bg-neutral-200"
                  }`}
                >
                  {c.name} ({count})
                </button>
              );
            })}
          </div>

          {/* Kartu Grid Daftar Menu */}
          <div className="grid gap-3 sm:grid-cols-2">
            {menuTerfilter.map((m) => (
              <div
                key={m.id}
                className={`group flex items-center gap-3.5 rounded-2xl p-3.5 transition-all ${
                  isMochi
                    ? "border border-[#d8e3de] bg-[#fcfcfe] hover:border-emerald-300 hover:bg-white hover:shadow-sm"
                    : "border border-[#dedee8] bg-[#fcfcfe]"
                }`}
              >
                {/* Foto Menu */}
                <div
                  className={`relative flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-2xl border ${
                    isMochi
                      ? "border-[#d8e3de] bg-[#f0f5f2]"
                      : "border-[#dedee8] bg-white"
                  }`}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={m.photo_url || PLACEHOLDER_MENU}
                    alt={m.name}
                    className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                    loading="lazy"
                  />
                  {!m.photo_url && (
                    <span
                      className="absolute bottom-0 right-0 rounded-tl-lg bg-[#232331]/80 p-1 text-white"
                      title="Belum ada foto"
                    >
                      <ImageOff size={11} />
                    </span>
                  )}
                </div>

                {/* Info Menu */}
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <span
                      className={`inline-block text-[10px] font-bold rounded-md px-1.5 py-0.5 ${
                        isMochi
                          ? "bg-emerald-50 text-[#167052] border border-emerald-200/60"
                          : "bg-neutral-100 text-[#7b7b8e]"
                      }`}
                    >
                      {namaKategori(m.category_id)}
                    </span>
                    {!m.is_available && (
                      <span className="rounded-md bg-rose-50 border border-rose-200 px-1.5 py-0.5 font-mono text-[9px] font-bold text-rose-700">
                        HABIS
                      </span>
                    )}
                  </div>
                  <p className={`mt-0.5 truncate text-sm font-black ${isMochi ? "text-[#0b3d2e]" : "text-[#232331]"}`}>
                    {m.name}
                  </p>
                  <p className={`font-mono text-xs font-black ${isMochi ? "text-[#167052]" : "text-[#15803d]"}`}>
                    {rupiah(m.price)}
                  </p>
                  {m.description && (
                    <p className={`truncate text-[11px] ${isMochi ? "text-[#637970]" : "text-[#7b7b8e]"}`}>
                      {m.description}
                    </p>
                  )}
                </div>

                {/* Tombol Aksi */}
                <div className="flex shrink-0 gap-1.5">
                  <button
                    type="button"
                    aria-label={`Ubah ${m.name}`}
                    onClick={() => {
                      setGalat(null);
                      setDraf({
                        id: m.id,
                        name: m.name,
                        price: String(m.price),
                        categoryId: m.category_id ?? "",
                        description: m.description ?? "",
                        photoUrl: m.photo_url ?? "",
                        recipeId: m.recipe_id ?? "",
                        isAvailable: m.is_available,
                      });
                    }}
                    className={`rounded-xl p-2.5 transition-all shadow-xs ${
                      isMochi
                        ? "border border-[#d8e3de] bg-white text-[#0b3d2e] hover:border-[#0b3d2e] hover:bg-[#f0f5f2]"
                        : "border-2 border-[#232331] bg-white"
                    }`}
                  >
                    <Pencil size={15} />
                  </button>
                  <button
                    type="button"
                    aria-label={`Hapus ${m.name}`}
                    onClick={() => hapus(m)}
                    className={`rounded-xl p-2.5 transition-all shadow-xs ${
                      isMochi
                        ? "border border-rose-200 bg-rose-50/50 text-[#c2410c] hover:bg-rose-100"
                        : "border-2 border-[#232331] bg-white text-[#c2410c]"
                    }`}
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              </div>
            ))}

            {!menuTerfilter.length && (
              <div
                className={`col-span-full rounded-2xl border border-dashed p-10 text-center ${
                  isMochi ? "border-[#d8e3de] bg-[#f8faf9]" : "border-[#dedee8]"
                }`}
              >
                <p className={`text-sm font-bold ${isMochi ? "text-[#0b3d2e]" : "text-[#232331]"}`}>
                  Tidak ada menu yang cocok
                </p>
                <p className={`mt-1 text-xs ${isMochi ? "text-[#637970]" : "text-[#7b7b8e]"}`}>
                  {cari ? `Tidak ditemukan menu dengan kata kunci "${cari}".` : "Belum ada menu di kategori ini."}
                </p>
              </div>
            )}
          </div>
        </section>
      </div>

      {/* ------------------------------------------------------------ MODAL FORM */}
      {draf && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 backdrop-blur-xs p-0 sm:items-center sm:p-4 animate-in fade-in duration-200">
          <div
            className={`max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-t-3xl border bg-white p-6 sm:rounded-3xl shadow-2xl ${
              isMochi ? "border-[#d8e3de]" : "border-2 border-[#232331]"
            }`}
          >
            <div className="flex items-center justify-between pb-3 border-b border-[#edf2ef]">
              <div>
                <h3 className={`text-lg font-black ${isMochi ? "text-[#0b3d2e]" : ""}`}>
                  {draf.id ? "Ubah Data Menu" : "Tambah Menu Baru"}
                </h3>
                <p className={`text-xs ${isMochi ? "text-[#637970]" : "text-[#7b7b8e]"}`}>
                  {draf.id ? "Perbarui informasi dan harga menu" : "Isi rincian menu yang ingin dijual"}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setDraf(null)}
                aria-label="Tutup"
                className={`rounded-xl p-1.5 transition-colors ${
                  isMochi ? "text-[#637970] hover:bg-[#f0f5f2] hover:text-[#0b3d2e]" : ""
                }`}
              >
                <X size={18} />
              </button>
            </div>

            <div className="mt-5 space-y-4">
              <label className="block text-xs font-bold text-[#0b3d2e]">
                Nama Menu
                <input
                  value={draf.name}
                  onChange={(e) => setDraf({ ...draf, name: e.target.value })}
                  placeholder="Contoh: Kopi Es Mochi, Nasi Ayam Kriyuk"
                  autoFocus
                  className={`mt-1.5 w-full rounded-xl px-3.5 py-2.5 text-sm font-normal transition-all ${
                    isMochi
                      ? "border border-[#d8e3de] bg-[#f8faf9] text-[#0b3d2e] focus:border-[#0b3d2e] focus:bg-white focus:outline-none"
                      : "border-2 border-[#232331]"
                  }`}
                />
              </label>

              <div className="grid grid-cols-2 gap-3">
                <label className="block text-xs font-bold text-[#0b3d2e]">
                  Harga Jual (Rp)
                  <input
                    value={draf.price}
                    onChange={(e) => setDraf({ ...draf, price: e.target.value })}
                    inputMode="numeric"
                    placeholder="25000"
                    className={`mt-1.5 w-full rounded-xl px-3.5 py-2.5 font-mono text-sm font-bold transition-all ${
                      isMochi
                        ? "border border-[#d8e3de] bg-[#f8faf9] text-[#0b3d2e] focus:border-[#0b3d2e] focus:bg-white focus:outline-none"
                        : "border-2 border-[#232331]"
                    }`}
                  />
                </label>

                <label className="block text-xs font-bold text-[#0b3d2e]">
                  Kategori
                  <select
                    value={draf.categoryId}
                    onChange={(e) => setDraf({ ...draf, categoryId: e.target.value })}
                    className={`mt-1.5 w-full rounded-xl px-3.5 py-2.5 text-sm font-normal transition-all ${
                      isMochi
                        ? "border border-[#d8e3de] bg-[#f8faf9] text-[#0b3d2e] focus:border-[#0b3d2e] focus:bg-white focus:outline-none"
                        : "border-2 border-[#232331]"
                    }`}
                  >
                    <option value="">Tanpa kategori</option>
                    {categories.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              <label className="block text-xs font-bold text-[#0b3d2e]">
                Deskripsi Singkat <span className="font-normal text-[#637970]">(opsional)</span>
                <textarea
                  value={draf.description}
                  onChange={(e) =>
                    setDraf({ ...draf, description: e.target.value.slice(0, 300) })
                  }
                  rows={2}
                  placeholder="Bahan utama, rasa, atau catatan sajian..."
                  className={`mt-1.5 w-full rounded-xl px-3.5 py-2.5 text-sm font-normal transition-all ${
                    isMochi
                      ? "border border-[#d8e3de] bg-[#f8faf9] text-[#0b3d2e] focus:border-[#0b3d2e] focus:bg-white focus:outline-none"
                      : "border-2 border-[#232331]"
                  }`}
                />
              </label>

              {/* Unggah Foto */}
              <div className="text-xs font-bold text-[#0b3d2e]">
                Foto Menu <span className="font-normal text-[#637970]">(disarankan)</span>

                <input
                  ref={berkasRef}
                  type="file"
                  accept="image/*"
                  onChange={(e) => pilihFoto(e.target.files?.[0])}
                  className="hidden"
                />

                <div className="mt-2 flex gap-2">
                  <button
                    type="button"
                    onClick={() => berkasRef.current?.click()}
                    disabled={sedangUnggah}
                    className={`flex flex-1 items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-xs font-bold transition-all shadow-xs disabled:opacity-60 ${
                      isMochi
                        ? "border border-[#d8e3de] bg-[#f0f5f2] text-[#0b3d2e] hover:bg-emerald-100/60"
                        : "border-2 border-[#232331] bg-white"
                    }`}
                  >
                    {sedangUnggah ? (
                      <>
                        <Loader2 size={15} className="animate-spin text-[#167052]" />
                        <span>Mengompres & Mengunggah...</span>
                      </>
                    ) : (
                      <>
                        <Upload size={15} className={isMochi ? "text-[#167052]" : ""} />
                        <span>{draf.photoUrl ? "Ganti Foto" : "Pilih / Ambil Foto"}</span>
                      </>
                    )}
                  </button>
                  {draf.photoUrl && (
                    <button
                      type="button"
                      onClick={() => setDraf({ ...draf, photoUrl: "" })}
                      className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2.5 text-xs font-bold text-rose-700 hover:bg-rose-100 transition-colors"
                    >
                      Hapus Foto
                    </button>
                  )}
                </div>

                {draf.photoUrl.trim() && (
                  <div className="mt-3 overflow-hidden rounded-2xl border border-[#d8e3de] bg-white shadow-xs">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={draf.photoUrl} alt="Preview" className="h-44 w-full object-cover" />
                  </div>
                )}

                <input
                  value={draf.photoUrl}
                  onChange={(e) => setDraf({ ...draf, photoUrl: e.target.value })}
                  type="text"
                  placeholder="Atau tautkan alamat foto /api/gambar/... atau https://..."
                  className={`mt-2 w-full rounded-xl px-3 py-2 font-mono text-[11px] font-normal transition-all ${
                    isMochi
                      ? "border border-[#d8e3de] bg-[#f8faf9] text-[#0b3d2e] placeholder:text-[#8ba298]"
                      : "border border-[#dedee8]"
                  }`}
                />
              </div>

              {/* Resep opsional */}
              {recipes.length > 0 && (
                <label className="block text-xs font-bold text-[#0b3d2e]">
                  Tautkan Resep{" "}
                  <span className="font-normal text-[#637970]">
                    (opsional — untuk hitungan HPP & pemotongan bahan stok otomatis)
                  </span>
                  <select
                    value={draf.recipeId}
                    onChange={(e) => setDraf({ ...draf, recipeId: e.target.value })}
                    className={`mt-1.5 w-full rounded-xl px-3.5 py-2.5 text-sm font-normal transition-all ${
                      isMochi
                        ? "border border-[#d8e3de] bg-[#f8faf9] text-[#0b3d2e] focus:border-[#0b3d2e] focus:bg-white focus:outline-none"
                        : "border-2 border-[#232331]"
                    }`}
                  >
                    <option value="">Tanpa resep bahan</option>
                    {recipes.map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.name}
                      </option>
                    ))}
                  </select>
                </label>
              )}

              {/* Status Ketersediaan */}
              <label className="flex items-center gap-2.5 text-xs font-bold text-[#0b3d2e] cursor-pointer pt-1">
                <input
                  type="checkbox"
                  checked={draf.isAvailable}
                  onChange={(e) => setDraf({ ...draf, isAvailable: e.target.checked })}
                  className="h-4 w-4 rounded accent-[#0b3d2e]"
                />
                <span>Tersedia untuk dijual di POS & Meja</span>
              </label>
            </div>

            {galat && (
              <p className="mt-4 rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs font-bold text-rose-800">
                {galat}
              </p>
            )}

            <div className="mt-6 flex gap-3 border-t border-[#edf2ef] pt-4">
              <button
                type="button"
                onClick={() => setDraf(null)}
                className={`flex-1 rounded-xl py-3 text-sm font-bold transition-all ${
                  isMochi
                    ? "border border-[#d8e3de] bg-white text-[#637970] hover:bg-[#f0f5f2]"
                    : "border-2 border-[#232331] bg-white"
                }`}
              >
                Batal
              </button>
              <button
                type="button"
                onClick={simpan}
                disabled={sedangSimpan}
                className={`flex flex-1 items-center justify-center gap-2 rounded-xl py-3 text-sm font-black transition-all shadow-md disabled:opacity-60 ${
                  isMochi
                    ? "bg-[#0b3d2e] text-[#c8f53a] hover:bg-[#167052]"
                    : "border-2 border-[#232331] bg-[#d9ff57]"
                }`}
              >
                {sedangSimpan && <Loader2 size={16} className="animate-spin" />}
                <span>{draf.id ? "Simpan Perubahan" : "Tambahkan Menu"}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
