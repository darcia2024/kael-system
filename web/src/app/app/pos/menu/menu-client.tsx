"use client";

import { useEffect, useMemo, useRef, useState } from "react";
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
  Camera,
  CheckCircle2,
  AlertCircle,
  TrendingUp,
  Coins,
  Calculator,
} from "lucide-react";

import {
  saveMenuItemAction,
  deleteMenuItemAction,
  saveCategoryAction,
  deleteCategoryAction,
  uploadImageAction,
  setMenuAvailabilityAction,
} from "@/lib/actions";
import { kompresGambar } from "@/lib/kompres-gambar";
import type { Business, Category, MenuItem } from "@/lib/types";
import { PLACEHOLDER_MENU } from "@/lib/types";
import { isMochiBusiness } from "@/lib/mochi-brand";
import { BusinessMark } from "@/components/business-mark";
import PwaInstallBanner from "@/components/pwa-install-banner";

const rupiah = (n: number) => "Rp " + Math.round(n).toLocaleString("id-ID");

/** Format angka dengan pemisah ribuan titik (contoh: 25000 -> 25.000) */
function formatRibuan(input: string | number): string {
  const digits = String(input).replace(/[^\d]/g, "");
  if (!digits) return "";
  return Number(digits).toLocaleString("id-ID");
}

/** Rekomendasi harga populer kafe untuk pengisian cepat 1-klik */
const CHIP_HARGA_CEPAT = [
  { label: "10rb", nilai: 10000 },
  { label: "15rb", nilai: 15000 },
  { label: "18rb", nilai: 18000 },
  { label: "20rb", nilai: 20000 },
  { label: "25rb", nilai: 25000 },
  { label: "30rb", nilai: 30000 },
  { label: "35rb", nilai: 35000 },
  { label: "50rb", nilai: 50000 },
];

/** Bentuk formulir. Harga dan deskripsi disimpan sebagai teks selama diketik. */
type Draf = {
  id?: string;
  name: string;
  price: string;
  costPrice: string;
  categoryId: string;
  description: string;
  photoUrl: string;
  recipeId: string;
  isAvailable: boolean;
};

const DRAF_KOSONG: Draf = {
  name: "",
  price: "",
  costPrice: "",
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
  recipes: { id: string; name: string; hpp?: number }[];
  themeClassName?: string;
}) {
  const isMochi = isMochiBusiness(business);
  const router = useRouter();

  const recipeMap = useMemo(() => {
    const map = new Map<string, { id: string; name: string; hpp?: number }>();
    for (const r of recipes) {
      map.set(r.id, r);
    }
    return map;
  }, [recipes]);

  // State sinkron lokal untuk responsivitas instan
  const [daftarKategori, setDaftarKategori] = useState<Category[]>(categories);
  const [daftarMenu, setDaftarMenu] = useState<MenuItem[]>(menuItems);

  useEffect(() => {
    setDaftarKategori(categories);
  }, [categories]);

  useEffect(() => {
    setDaftarMenu(menuItems);
  }, [menuItems]);

  const [draf, setDraf] = useState<Draf | null>(null);
  const [sedangSimpan, setSedangSimpan] = useState(false);
  const [galat, setGalat] = useState<string | null>(null);
  const [kabar, setKabar] = useState<string | null>(null);
  const [kategoriBaru, setKategoriBaru] = useState("");
  const [sedangUnggah, setSedangUnggah] = useState(false);
  const [sedangDrag, setSedangDrag] = useState(false);
  const [cari, setCari] = useState("");
  const [filterKategori, setFilterKategori] = useState<string>("all");

  // Inline kategori dalam modal Tambah Menu
  const [bukaTambahKategoriModal, setBukaTambahKategoriModal] = useState(false);
  const [namaKategoriBaruModal, setNamaKategoriBaruModal] = useState("");
  const [sedangSimpanKategoriInline, setSedangSimpanKategoriInline] = useState(false);

  const berkasRef = useRef<HTMLInputElement | null>(null);
  const namaInputRef = useRef<HTMLInputElement | null>(null);

  /**
   * Buka modal Tambah Menu Baru:
   * Otomatis memilih kategori aktif yang sedang dilihat agar owner tidak perlu memilih ulang!
   */
  const bukaTambahMenu = () => {
    const kategoriAwal =
      filterKategori !== "all" && filterKategori !== "none"
        ? filterKategori
        : daftarKategori[0]?.id ?? "";

    setDraf({
      ...DRAF_KOSONG,
      categoryId: kategoriAwal,
    });
    setGalat(null);
    setBukaTambahKategoriModal(false);
    setTimeout(() => namaInputRef.current?.focus(), 150);
  };

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
    daftarKategori.find((c) => c.id === id)?.name ?? "Tanpa kategori";

  /**
   * Simpan menu baru atau perubahan:
   * @param tambahLagi Jika true, simpan dan langsung siapkan form untuk menu berikutnya dengan cepat!
   */
  const simpan = async (tambahLagi = false) => {
    if (!draf) return;
    setGalat(null);

    const namaBersih = draf.name.trim();
    const harga = Number(draf.price.replace(/[^\d]/g, ""));
    const modal = Number(draf.costPrice.replace(/[^\d]/g, "")) || 0;

    if (!namaBersih) {
      setGalat("Nama menu belum diisi.");
      namaInputRef.current?.focus();
      return;
    }
    if (!Number.isFinite(harga) || harga <= 0) {
      setGalat("Harga jual belum diisi atau bernilai nol.");
      return;
    }

    setSedangSimpan(true);
    const res = await saveMenuItemAction({
      id: draf.id,
      name: namaBersih,
      price: harga,
      costPrice: modal,
      categoryId: draf.categoryId || null,
      description: draf.description,
      photoUrl: draf.photoUrl,
      recipeId: draf.recipeId || null,
      isAvailable: draf.isAvailable,
    });
    setSedangSimpan(false);

    if (!res.ok) {
      setGalat(res.error);
      return;
    }

    const savedMenu = res.data;

    // Perbarui state lokal secara responsif
    if (savedMenu) {
      setDaftarMenu((prev) => {
        const ada = prev.some((m) => m.id === savedMenu.id);
        if (ada) {
          return prev.map((m) => (m.id === savedMenu.id ? savedMenu : m));
        }
        return [savedMenu, ...prev];
      });
    }

    if (tambahLagi) {
      // Mode Input Cepat (Bulk): Simpan menu ini, lalu kosongkan kolom untuk menu berikutnya
      setKabar(`✓ Menu "${namaBersih}" berhasil ditambahkan! Silakan isi menu berikutnya.`);
      setDraf({
        ...DRAF_KOSONG,
        categoryId: draf.categoryId, // Pertahankan kategori yang sama!
      });
      setTimeout(() => namaInputRef.current?.focus(), 100);
    } else {
      setDraf(null);
      setKabar(
        draf.id
          ? `✓ Menu "${namaBersih}" berhasil diperbarui.`
          : `✓ Menu baru "${namaBersih}" berhasil ditambahkan.`,
      );
    }

    router.refresh();
  };

  /** Hapus menu dengan konfirmasi jelas */
  const hapus = async (item: MenuItem) => {
    if (!confirm(`Hapus "${item.name}" dari daftar menu?`)) return;
    setGalat(null);
    const res = await deleteMenuItemAction(item.id);
    if (!res.ok) return setGalat(res.error);

    setDaftarMenu((prev) => prev.filter((m) => m.id !== item.id));
    setKabar(
      res.data.hidden
        ? `"${item.name}" pernah terjual, jadi disembunyikan dari layar kasir dan tidak dihapus. Riwayat penjualannya tetap utuh.`
        : `"${item.name}" berhasil dihapus.`,
    );
    router.refresh();
  };

  /** Toggle ketersediaan menu (Tersedia / Habis) langsung dengan 1 klik dari kartu */
  const toggleKetersediaan = async (item: MenuItem) => {
    const statusBaru = !item.is_available;
    // Optimistic UI update
    setDaftarMenu((prev) =>
      prev.map((m) => (m.id === item.id ? { ...m, is_available: statusBaru } : m)),
    );

    const res = await setMenuAvailabilityAction(item.id, statusBaru);
    if (!res.ok) {
      // Rollback jika gagal
      setDaftarMenu((prev) =>
        prev.map((m) => (m.id === item.id ? { ...m, is_available: item.is_available } : m)),
      );
      setGalat(res.error);
    } else {
      setKabar(
        statusBaru
          ? `✓ "${item.name}" sekarang TERSEDIA di kasir & meja.`
          : `⚠️ "${item.name}" ditandai HABIS (tidak dapat dipesan di kasir & meja).`,
      );
    }
  };

  const tambahKategori = async () => {
    if (!kategoriBaru.trim()) return;
    setGalat(null);
    const res = await saveCategoryAction({
      name: kategoriBaru.trim(),
      sortOrder: daftarKategori.length,
    });
    if (!res.ok) return setGalat(res.error);
    const catBaru = res.data;
    if (catBaru) {
      setDaftarKategori((prev) => [...prev, catBaru]);
    }
    const ditambahkan = kategoriBaru.trim();
    setKategoriBaru("");
    setKabar(`Kategori "${ditambahkan}" berhasil ditambahkan.`);
    router.refresh();
  };

  /** Tambah kategori baru langsung dari dalam modal Tambah Menu */
  const simpanKategoriInline = async () => {
    if (!namaKategoriBaruModal.trim()) return;
    setGalat(null);
    setSedangSimpanKategoriInline(true);
    const res = await saveCategoryAction({
      name: namaKategoriBaruModal.trim(),
      sortOrder: daftarKategori.length,
    });
    setSedangSimpanKategoriInline(false);
    if (!res.ok) {
      setGalat(res.error);
      return;
    }
    const catBaru = res.data;
    if (catBaru) {
      setDaftarKategori((prev) => [...prev, catBaru]);
      setDraf((d) => (d ? { ...d, categoryId: catBaru.id } : d));
      setKabar(`Kategori "${catBaru.name}" berhasil dibuat dan otomatis dipilih.`);
    }
    setNamaKategoriBaruModal("");
    setBukaTambahKategoriModal(false);
    router.refresh();
  };

  const hapusKategori = async (id: string, nama: string) => {
    if (!confirm(`Hapus kategori "${nama}"? Menu di dalamnya tidak akan terhapus.`)) return;
    setGalat(null);
    const res = await deleteCategoryAction(id);
    if (!res.ok) return setGalat(res.error);
    setDaftarKategori((prev) => prev.filter((c) => c.id !== id));
    setKabar(`Kategori "${nama}" dihapus.`);
    router.refresh();
  };

  /** Filter menu secara reaktif */
  const menuTerfilter = useMemo(() => {
    return daftarMenu.filter((m) => {
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
  }, [daftarMenu, cari, filterKategori]);

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

        {/* PWA INSTALL RECOMMENDATION BANNER */}
        <PwaInstallBanner isMochi={isMochi} />

        {/* Header Toko */}
        <header
          className={`flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between ${
            isMochi
              ? "rounded-3xl border border-[#d8e3de] bg-white p-4 sm:p-6 shadow-[0_4px_24px_rgba(11,61,46,0.04)]"
              : "rounded-2xl border-2 border-[#232331] bg-white p-4 sm:p-5 shadow-ink-md"
          }`}
        >
          <div className="flex items-center gap-3.5 sm:gap-4">
            {isMochi ? (
              <div className="flex h-12 w-12 sm:h-14 sm:w-14 shrink-0 items-center justify-center rounded-2xl bg-white p-1 border border-emerald-400/40 shadow-xs overflow-hidden">
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
              <h1 className={`text-xl sm:text-3xl font-black tracking-tight ${isMochi ? "text-[#0b3d2e]" : ""}`}>
                Kelola Menu
              </h1>
              <p className={`mt-0.5 text-xs sm:text-sm ${isMochi ? "text-[#4d665a]" : "text-[#7b7b8e]"}`}>
                Menu yang dikelola di sini langsung tampil di POS kasir dan di halaman pemesanan meja.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={bukaTambahMenu}
            className={`hidden sm:inline-flex items-center justify-center gap-2 rounded-2xl px-5 py-3 text-sm font-black transition-all shadow-md active:scale-95 ${
              isMochi
                ? "bg-[#0b3d2e] text-[#c8f53a] hover:bg-[#167052] hover:shadow-lg"
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
            className={`flex items-start justify-between gap-3 p-4 text-sm font-semibold rounded-2xl border animate-in fade-in-50 ${
              isMochi
                ? "border-rose-200 bg-rose-50 text-rose-800 shadow-xs"
                : "border-2 border-[#c2410c] bg-[#fff7ed] text-[#c2410c]"
            }`}
          >
            <div className="flex items-center gap-2">
              <AlertCircle size={17} className="shrink-0 text-rose-600" />
              <span>{galat}</span>
            </div>
            <button type="button" onClick={() => setGalat(null)} aria-label="Tutup" className="opacity-70 hover:opacity-100">
              <X size={16} />
            </button>
          </div>
        )}
        {kabar && (
          <div
            className={`flex items-start justify-between gap-3 p-4 text-sm font-semibold rounded-2xl border animate-in fade-in-50 ${
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
              ? "rounded-3xl border border-[#d8e3de] bg-white p-4 sm:p-6 shadow-[0_4px_24px_rgba(11,61,46,0.04)]"
              : "rounded-2xl border-2 border-[#232331] bg-white p-4 sm:p-5 shadow-ink-md"
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
              {daftarKategori.length} Kategori
            </span>
          </div>

          <div className="flex flex-wrap gap-2 pt-1">
            {daftarKategori.map((c) => (
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
            {!daftarKategori.length && (
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
          className={`space-y-4 sm:space-y-5 ${
            isMochi
              ? "rounded-3xl border border-[#d8e3de] bg-white p-3.5 sm:p-6 shadow-[0_4px_24px_rgba(11,61,46,0.04)]"
              : "rounded-2xl border-2 border-[#232331] bg-white p-3.5 sm:p-5 shadow-ink-md"
          }`}
        >
          {/* Baris Judul & Pencarian */}
          <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-2">
              <Utensils size={18} className={isMochi ? "text-[#167052]" : "text-[#7958d8]"} />
              <h2 className={`text-base sm:text-lg font-black ${isMochi ? "text-[#0b3d2e]" : ""}`}>
                Daftar Menu
              </h2>
              <span
                className={`rounded-full px-2.5 py-0.5 text-xs font-bold font-mono ${
                  isMochi ? "bg-[#f0f5f2] text-[#0b3d2e]" : "bg-neutral-100 text-neutral-600"
                }`}
              >
                {daftarMenu.length} menu
              </span>
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto">
              <div className="relative flex-1 sm:w-64">
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

              <button
                type="button"
                onClick={bukaTambahMenu}
                className="inline-flex items-center gap-1.5 rounded-xl bg-[#0b3d2e] px-3.5 py-2 text-xs font-black text-[#c8f53a] hover:bg-[#167052] transition-all shadow-xs shrink-0 active:scale-95"
              >
                <Plus size={15} />
                <span>Tambah</span>
              </button>
            </div>
          </div>

          {/* Filter Tab Kategori */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
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
              Semua ({daftarMenu.length})
            </button>
            {daftarKategori.map((c) => {
              const count = daftarMenu.filter((m) => m.category_id === c.id).length;
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

          {/* Kartu Grid Daftar Menu (Compact & High-Density) */}
          <div className="grid gap-2 sm:gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
            {menuTerfilter.map((m) => (
              <div
                key={m.id}
                className={`group flex items-center gap-2.5 rounded-xl p-2 sm:p-2.5 transition-all overflow-hidden ${
                  isMochi
                    ? "border border-[#d8e3de] bg-[#fcfcfe] hover:border-emerald-300 hover:bg-white hover:shadow-xs"
                    : "border border-[#dedee8] bg-[#fcfcfe]"
                }`}
              >
                {/* Foto Menu Compact */}
                <div
                  className={`relative flex h-12 w-12 sm:h-13 sm:w-13 shrink-0 items-center justify-center overflow-hidden rounded-xl border ${
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
                      className="absolute bottom-0 right-0 rounded-tl-md bg-[#232331]/80 p-0.5 text-white"
                      title="Belum ada foto"
                    >
                      <ImageOff size={9} />
                    </span>
                  )}
                </div>

                {/* Info Menu Compact */}
                <div className="min-w-0 flex-1">
                  {/* Baris 1: Nama & Kategori */}
                  <div className="flex items-center gap-1.5 min-w-0">
                    <h3 className={`font-black text-xs sm:text-sm truncate leading-tight ${isMochi ? "text-[#0b3d2e]" : "text-[#232331]"}`}>
                      {m.name}
                    </h3>
                    <span
                      className={`inline-block text-[8.5px] font-bold rounded px-1 py-0.2 shrink-0 ${
                        isMochi
                          ? "bg-emerald-50 text-[#167052] border border-emerald-200/60"
                          : "bg-neutral-100 text-[#7b7b8e]"
                      }`}
                    >
                      {namaKategori(m.category_id)}
                    </span>
                  </div>

                  {/* Baris 2: Harga, Status Ketersediaan & HPP */}
                  <div className="flex items-center gap-1.5 flex-wrap mt-0.5">
                    <span className={`font-mono text-xs font-black ${isMochi ? "text-[#167052]" : "text-[#15803d]"}`}>
                      {rupiah(m.price)}
                    </span>

                    {/* Quick 1-Click Availability Toggle */}
                    <button
                      type="button"
                      onClick={() => toggleKetersediaan(m)}
                      title={
                        m.is_available
                          ? "Klik untuk tandai menu HABIS"
                          : "Klik untuk tandai menu TERSEDIA"
                      }
                      className={`inline-flex items-center gap-1 rounded-full px-1.5 py-0.2 text-[8.5px] font-black transition-all cursor-pointer ${
                        m.is_available
                          ? "bg-emerald-100 text-emerald-800 hover:bg-emerald-200 border border-emerald-300/60"
                          : "bg-rose-100 text-rose-800 hover:bg-rose-200 border border-rose-300/60"
                      }`}
                    >
                      <span
                        className={`h-1 w-1 rounded-full ${
                          m.is_available ? "bg-emerald-600" : "bg-rose-600"
                        }`}
                      />
                      <span>{m.is_available ? "Tersedia" : "Habis"}</span>
                    </button>

                    {/* HPP tag compact */}
                    {(() => {
                      const modal =
                        m.cost_price && m.cost_price > 0
                          ? m.cost_price
                          : m.recipe_id
                          ? recipeMap.get(m.recipe_id)?.hpp ?? 0
                          : 0;
                      if (modal > 0 && m.price > 0) {
                        const laba = m.price - modal;
                        const margin = Math.round((laba / m.price) * 100);
                        const isLaba = laba >= 0;
                        return (
                          <span
                            className={`hidden sm:inline-flex items-center gap-0.5 font-mono text-[8.5px] font-bold px-1 py-0.2 rounded ${
                              !isLaba
                                ? "bg-rose-100 text-rose-700"
                                : margin >= 50
                                ? "bg-emerald-50 text-emerald-800"
                                : "bg-amber-50 text-amber-800"
                            }`}
                            title={`Modal: ${rupiah(modal)} | Laba: ${isLaba ? "+" : ""}${rupiah(laba)}`}
                          >
                            <span>HPP {rupiah(modal)}</span>
                            <span>({margin}%)</span>
                          </span>
                        );
                      }
                      return null;
                    })()}
                  </div>
                </div>

                {/* Tombol Aksi Compact (Ubah & Hapus) */}
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    type="button"
                    aria-label={`Ubah ${m.name}`}
                    onClick={() => {
                      setGalat(null);
                      setDraf({
                        id: m.id,
                        name: m.name,
                        price: formatRibuan(m.price),
                        costPrice: m.cost_price ? formatRibuan(m.cost_price) : "",
                        categoryId: m.category_id ?? "",
                        description: m.description ?? "",
                        photoUrl: m.photo_url ?? "",
                        recipeId: m.recipe_id ?? "",
                        isAvailable: m.is_available,
                      });
                      setBukaTambahKategoriModal(false);
                      setTimeout(() => namaInputRef.current?.focus(), 150);
                    }}
                    className={`flex h-7 w-7 sm:h-8 sm:w-8 items-center justify-center rounded-lg transition-all shadow-xs active:scale-95 ${
                      isMochi
                        ? "border border-[#d8e3de] bg-white text-[#0b3d2e] hover:border-[#0b3d2e] hover:bg-[#f0f5f2]"
                        : "border border-[#232331] bg-white"
                    }`}
                    title="Ubah menu"
                  >
                    <Pencil size={12} />
                  </button>
                  <button
                    type="button"
                    aria-label={`Hapus ${m.name}`}
                    onClick={() => hapus(m)}
                    className={`flex h-7 w-7 sm:h-8 sm:w-8 items-center justify-center rounded-lg transition-all shadow-xs active:scale-95 ${
                      isMochi
                        ? "border border-rose-200 bg-rose-50/70 text-[#c2410c] hover:bg-rose-100"
                        : "border border-[#232331] bg-white text-[#c2410c]"
                    }`}
                    title="Hapus menu"
                  >
                    <Trash2 size={12} />
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
                  {cari
                    ? `Tidak ditemukan menu dengan kata kunci "${cari}".`
                    : "Belum ada menu di kategori ini."}
                </p>
                <button
                  type="button"
                  onClick={bukaTambahMenu}
                  className="mt-3 inline-flex items-center gap-1.5 rounded-xl bg-[#0b3d2e] px-4 py-2 text-xs font-bold text-[#c8f53a] hover:bg-[#167052]"
                >
                  <Plus size={14} />
                  <span>Tambah Menu Sekarang</span>
                </button>
              </div>
            )}
          </div>
        </section>
      </div>

      {/* MOBILE FLOATING ACTION BUTTON (FAB) FOR QUICK + MENU */}
      <div className="sm:hidden fixed bottom-6 right-5 z-30">
        <button
          type="button"
          onClick={bukaTambahMenu}
          className={`flex items-center gap-2 rounded-full px-5 py-3.5 shadow-2xl font-black text-xs transition-all active:scale-95 cursor-pointer ${
            isMochi
              ? "bg-[#0b3d2e] text-[#c8f53a] border border-[#c8f53a]/40 shadow-[#0b3d2e]/50"
              : "border-2 border-[#232331] bg-[#d9ff57] text-[#232331] shadow-ink-lg"
          }`}
          aria-label="Tambah Menu Baru"
        >
          <Plus size={18} strokeWidth={2.8} />
          <span>+ Tambah Menu</span>
        </button>
      </div>

      {/* ------------------------------------------------------------ MODAL FORM TAMBAH / UBAH MENU */}
      {draf && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-xs p-0 sm:items-center sm:p-4 animate-in fade-in duration-200">
          <div
            className={`flex max-h-[92vh] w-full max-w-lg flex-col rounded-t-3xl border bg-white sm:rounded-3xl shadow-2xl overflow-hidden ${
              isMochi ? "border-[#d8e3de]" : "border-2 border-[#232331]"
            }`}
          >
            {/* Sticky Header */}
            <div className="sticky top-0 z-20 flex items-center justify-between border-b border-[#edf2ef] bg-white px-6 py-4">
              <div>
                <h3 className={`text-lg font-black ${isMochi ? "text-[#0b3d2e]" : ""}`}>
                  {draf.id ? "Ubah Data Menu" : "Tambah Menu Baru"}
                </h3>
                <p className={`text-xs ${isMochi ? "text-[#637970]" : "text-[#7b7b8e]"}`}>
                  {draf.id
                    ? "Perbarui informasi dan harga menu"
                    : "Isi nama, harga, dan kategori menu yang ingin dijual"}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setDraf(null)}
                aria-label="Tutup formulir"
                className={`rounded-xl p-1.5 transition-colors ${
                  isMochi ? "text-[#637970] hover:bg-[#f0f5f2] hover:text-[#0b3d2e]" : ""
                }`}
              >
                <X size={20} />
              </button>
            </div>

            {/* Scrollable Form Body */}
            <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">
              {/* Nama Menu */}
              <div>
                <label className="block text-xs font-bold text-[#0b3d2e]">
                  Nama Menu <span className="text-rose-600">*</span>
                </label>
                <input
                  ref={namaInputRef}
                  value={draf.name}
                  onChange={(e) => setDraf({ ...draf, name: e.target.value })}
                  placeholder="Contoh: Kopi Es Mochi, Nasi Ayam Kriyuk"
                  className={`mt-1.5 w-full rounded-xl px-3.5 py-2.5 text-sm font-semibold transition-all ${
                    isMochi
                      ? "border border-[#d8e3de] bg-[#f8faf9] text-[#0b3d2e] focus:border-[#0b3d2e] focus:bg-white focus:outline-none"
                      : "border-2 border-[#232331]"
                  }`}
                />
              </div>

              {/* Row 1: Harga Jual (Rp) & Modal / HPP Pokok (Rp) */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* Input Harga Jual */}
                <div>
                  <div className="flex items-center justify-between">
                    <label className="block text-xs font-bold text-[#0b3d2e]">
                      Harga Jual (Rp) <span className="text-rose-600">*</span>
                    </label>
                    {draf.price && (
                      <span className="font-mono text-[10.5px] font-extrabold text-[#167052]">
                        {rupiah(Number(draf.price.replace(/[^\d]/g, "")))}
                      </span>
                    )}
                  </div>
                  <input
                    value={draf.price}
                    onChange={(e) =>
                      setDraf({ ...draf, price: formatRibuan(e.target.value) })
                    }
                    inputMode="numeric"
                    placeholder="Contoh: 25.000"
                    className={`mt-1.5 w-full rounded-xl px-3.5 py-2.5 font-mono text-sm font-bold transition-all ${
                      isMochi
                        ? "border border-[#d8e3de] bg-[#f8faf9] text-[#0b3d2e] focus:border-[#0b3d2e] focus:bg-white focus:outline-none"
                        : "border-2 border-[#232331]"
                    }`}
                  />

                    {/* Chip Rekomendasi Harga Cepat */}
                    <div className="flex items-center gap-1 overflow-x-auto pt-1.5 scrollbar-none">
                      <span className="text-[9px] font-bold text-[#637970] shrink-0">Cepat:</span>
                      {CHIP_HARGA_CEPAT.map((chip) => (
                        <button
                          key={chip.nilai}
                          type="button"
                          onClick={() =>
                            setDraf({ ...draf, price: formatRibuan(chip.nilai) })
                          }
                          className="shrink-0 rounded-md bg-[#edf5f1] hover:bg-emerald-200/80 px-1.5 py-0.5 text-[9.5px] font-mono font-bold text-[#0b3d2e] transition-colors"
                        >
                          {chip.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Input Modal / HPP Pokok */}
                  <div>
                  <div className="flex items-center justify-between">
                    <label className="block text-xs font-bold text-[#0b3d2e]">
                      Modal / HPP per Porsi <span className="font-normal text-[#637970]">(opsional)</span>
                    </label>
                    {draf.costPrice && (
                      <span className="font-mono text-[10.5px] font-extrabold text-[#0b3d2e]">
                        {rupiah(Number(draf.costPrice.replace(/[^\d]/g, "")))}
                      </span>
                    )}
                  </div>
                  <input
                    value={draf.costPrice}
                    onChange={(e) =>
                      setDraf({ ...draf, costPrice: formatRibuan(e.target.value) })
                    }
                    inputMode="numeric"
                    placeholder="Contoh: 9.500"
                    className={`mt-1.5 w-full rounded-xl px-3.5 py-2.5 font-mono text-sm font-bold transition-all ${
                      isMochi
                        ? "border border-[#d8e3de] bg-[#f8faf9] text-[#0b3d2e] focus:border-[#0b3d2e] focus:bg-white focus:outline-none"
                        : "border-2 border-[#232331]"
                    }`}
                  />

                  {/* Helper text / quick sync with linked recipe */}
                  <div className="pt-1.5">
                    {draf.recipeId && recipeMap.get(draf.recipeId)?.hpp ? (
                      <button
                        type="button"
                        onClick={() => {
                          const rHpp = recipeMap.get(draf.recipeId)?.hpp || 0;
                          setDraf({ ...draf, costPrice: formatRibuan(rHpp) });
                        }}
                        className="inline-flex items-center gap-1 text-[9.5px] font-bold text-[#167052] hover:text-[#0b3d2e] underline"
                      >
                        <Sparkles size={11} />
                        <span>Gunakan HPP Resep ({rupiah(recipeMap.get(draf.recipeId)?.hpp || 0)})</span>
                      </button>
                    ) : (
                      <p className="text-[9.5px] text-[#637970] truncate">
                        Biaya modal bahan per porsi
                      </p>
                    )}
                  </div>
                </div>
              </div>

              {/* Realtime Live Profit & Margin Preview Box */}
              {(() => {
                const hargaVal = Number(draf.price.replace(/[^\d]/g, "")) || 0;
                const modalVal = Number(draf.costPrice.replace(/[^\d]/g, "")) || 0;
                if (hargaVal <= 0 && modalVal <= 0) return null;

                const labaKotor = hargaVal - modalVal;
                const marginPct = hargaVal > 0 ? (labaKotor / hargaVal) * 100 : 0;
                const marginRounded = Math.round(marginPct * 10) / 10;

                return (
                  <div className="rounded-2xl border border-emerald-200/90 bg-[#f3f8f5] p-3.5 space-y-2 animate-in fade-in-50">
                    <div className="flex items-center justify-between flex-wrap gap-1">
                      <span className="text-[11px] font-black text-[#0b3d2e] flex items-center gap-1.5">
                        <TrendingUp size={14} className="text-[#167052]" />
                        Kalkulasi Laba & Margin Produk
                      </span>
                      {modalVal > 0 ? (
                        <span
                          className={`text-[9.5px] font-extrabold px-2 py-0.5 rounded-full ${
                            labaKotor < 0
                              ? "bg-rose-100 text-rose-800 border border-rose-200"
                              : marginPct >= 50
                              ? "bg-emerald-200/90 text-emerald-900 border border-emerald-300"
                              : marginPct >= 30
                              ? "bg-teal-100 text-teal-900 border border-teal-200"
                              : "bg-amber-100 text-amber-900 border border-amber-200"
                          }`}
                        >
                          {labaKotor < 0
                            ? "⚠️ Rugi Operasional"
                            : marginPct >= 50
                            ? "✓ Margin Sehat (Ideal)"
                            : marginPct >= 30
                            ? "✓ Margin Standar F&B"
                            : "⚠️ Margin Tipis"}
                        </span>
                      ) : (
                        <span className="text-[9.5px] text-[#637970]">
                          (Modal belum diisi • 100% omzet bruto)
                        </span>
                      )}
                    </div>

                    <div className="grid grid-cols-2 gap-2 pt-1.5 border-t border-emerald-200/60">
                      <div>
                        <p className="text-[10px] text-[#637970]">Estimasi Laba Kotor:</p>
                        <p
                          className={`font-mono text-sm font-black ${
                            labaKotor >= 0 ? "text-[#167052]" : "text-rose-600"
                          }`}
                        >
                          {labaKotor >= 0
                            ? `+${rupiah(labaKotor)}`
                            : `-${rupiah(Math.abs(labaKotor))}`}
                          <span className="text-[10px] font-normal text-[#637970] ml-1">
                            / porsi
                          </span>
                        </p>
                      </div>
                      <div>
                        <p className="text-[10px] text-[#637970]">Margin Keuntungan:</p>
                        <p
                          className={`font-mono text-sm font-black ${
                            modalVal <= 0
                              ? "text-[#637970]"
                              : marginPct >= 30
                              ? "text-[#0b3d2e]"
                              : labaKotor < 0
                              ? "text-rose-600"
                              : "text-amber-700"
                          }`}
                        >
                          {modalVal > 0 ? `${marginRounded}%` : "-"}
                        </p>
                      </div>
                    </div>
                  </div>
                );
              })()}

              {/* Dropdown Kategori + Tombol Inline Tambah Kategori */}
              <div>
                <div className="flex items-center justify-between">
                  <label className="block text-xs font-bold text-[#0b3d2e]">
                    Kategori <span className="text-rose-600">*</span>
                  </label>
                  <button
                    type="button"
                    onClick={() => setBukaTambahKategoriModal(!bukaTambahKategoriModal)}
                    className="text-[10.5px] font-bold text-[#167052] hover:text-[#0b3d2e] underline flex items-center gap-0.5"
                  >
                    <Plus size={12} />
                    <span>{bukaTambahKategoriModal ? "Tutup" : "Kategori Baru"}</span>
                  </button>
                </div>

                {bukaTambahKategoriModal ? (
                  <div className="mt-1.5 rounded-xl border border-emerald-300 bg-emerald-50/70 p-2 space-y-1.5 animate-in fade-in-50">
                    <p className="text-[10px] font-bold text-[#0b3d2e]">Buat Kategori Baru Langsung:</p>
                    <div className="flex gap-1.5">
                      <input
                        value={namaKategoriBaruModal}
                        onChange={(e) => setNamaKategoriBaruModal(e.target.value)}
                        onKeyDown={(e) => e.key === "Enter" && simpanKategoriInline()}
                        placeholder="Nama kategori baru..."
                        className="min-w-0 flex-1 rounded-lg border border-[#d8e3de] bg-white px-2.5 py-1.5 text-xs text-[#0b3d2e] focus:outline-none"
                      />
                      <button
                        type="button"
                        onClick={simpanKategoriInline}
                        disabled={sedangSimpanKategoriInline || !namaKategoriBaruModal.trim()}
                        className="rounded-lg bg-[#0b3d2e] px-2.5 py-1.5 text-xs font-black text-[#c8f53a] hover:bg-[#167052] disabled:opacity-50 transition-all"
                      >
                        {sedangSimpanKategoriInline ? (
                          <Loader2 size={12} className="animate-spin" />
                        ) : (
                          "Simpan"
                        )}
                      </button>
                    </div>
                  </div>
                ) : (
                  <select
                    value={draf.categoryId}
                    onChange={(e) => setDraf({ ...draf, categoryId: e.target.value })}
                    className={`mt-1.5 w-full rounded-xl px-3.5 py-2.5 text-sm font-semibold transition-all ${
                      isMochi
                        ? "border border-[#d8e3de] bg-[#f8faf9] text-[#0b3d2e] focus:border-[#0b3d2e] focus:bg-white focus:outline-none"
                        : "border-2 border-[#232331]"
                    }`}
                  >
                    <option value="">-- Pilih Kategori --</option>
                    {daftarKategori.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                )}
              </div>

              {/* Deskripsi Singkat */}
              <div>
                <label className="block text-xs font-bold text-[#0b3d2e]">
                  Deskripsi Menu <span className="font-normal text-[#637970]">(opsional)</span>
                </label>
                <textarea
                  value={draf.description}
                  onChange={(e) =>
                    setDraf({ ...draf, description: e.target.value.slice(0, 300) })
                  }
                  rows={2}
                  placeholder="Bahan utama, rasa, atau catatan sajian..."
                  className={`mt-1.5 w-full rounded-xl px-3.5 py-2 text-xs font-normal transition-all ${
                    isMochi
                      ? "border border-[#d8e3de] bg-[#f8faf9] text-[#0b3d2e] focus:border-[#0b3d2e] focus:bg-white focus:outline-none"
                      : "border-2 border-[#232331]"
                  }`}
                />
              </div>

              {/* Unggah Foto / Dropzone */}
              <div>
                <div className="flex items-center justify-between">
                  <label className="block text-xs font-bold text-[#0b3d2e]">
                    Foto Menu <span className="font-normal text-[#637970]">(opsional)</span>
                  </label>
                  {draf.photoUrl && (
                    <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
                      ✓ Foto Terpasang
                    </span>
                  )}
                </div>

                <input
                  ref={berkasRef}
                  type="file"
                  accept="image/*"
                  onChange={(e) => pilihFoto(e.target.files?.[0])}
                  className="hidden"
                />

                {/* Dropzone Box */}
                <div
                  onDragOver={(e) => {
                    e.preventDefault();
                    setSedangDrag(true);
                  }}
                  onDragLeave={() => setSedangDrag(false)}
                  onDrop={(e) => {
                    e.preventDefault();
                    setSedangDrag(false);
                    pilihFoto(e.dataTransfer.files?.[0]);
                  }}
                  className={`mt-1.5 relative flex flex-col items-center justify-center rounded-2xl border-2 border-dashed p-3 sm:p-4 text-center transition-all ${
                    sedangDrag
                      ? "border-[#0b3d2e] bg-emerald-50"
                      : draf.photoUrl
                      ? "border-emerald-400 bg-[#f7faf8]"
                      : "border-[#d8e3de] bg-[#fcfcfe] hover:bg-[#f5f8f6] hover:border-[#0b3d2e]/40"
                  }`}
                >
                  {draf.photoUrl ? (
                    <div className="w-full space-y-2">
                      <div className="relative h-36 sm:h-40 w-full overflow-hidden rounded-xl border border-[#d8e3de]">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={draf.photoUrl}
                          alt="Preview Foto"
                          className="h-full w-full object-cover"
                        />
                      </div>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => berkasRef.current?.click()}
                          disabled={sedangUnggah}
                          className="flex-1 flex items-center justify-center gap-1.5 rounded-xl border border-[#d8e3de] bg-white py-2 text-xs font-bold text-[#0b3d2e] hover:bg-[#f0f5f2] transition-colors shadow-2xs"
                        >
                          {sedangUnggah ? (
                            <Loader2 size={13} className="animate-spin" />
                          ) : (
                            <Camera size={13} />
                          )}
                          <span>Ganti Foto</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => setDraf({ ...draf, photoUrl: "" })}
                          className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-bold text-rose-700 hover:bg-rose-100 transition-colors"
                        >
                          Hapus Foto
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div
                      onClick={() => berkasRef.current?.click()}
                      className="cursor-pointer py-2 space-y-1 text-center w-full"
                    >
                      <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-[#f0f5f2] text-[#167052]">
                        {sedangUnggah ? (
                          <Loader2 size={20} className="animate-spin" />
                        ) : (
                          <Camera size={20} />
                        )}
                      </div>
                      <p className="text-xs font-black text-[#0b3d2e]">
                        {sedangUnggah
                          ? "Mengompres & Mengunggah Foto..."
                          : "Klik untuk Pilih Foto / Kamera HP"}
                      </p>
                      <p className="text-[10px] text-[#637970]">
                        Bisa juga seret berkas gambar ke kotak ini (JPG, PNG, WebP)
                      </p>
                    </div>
                  )}
                </div>

                <p className="mt-1 text-[10px] text-[#637970]">
                  💡 Tanpa foto pun tidak masalah — sistem otomatis menampilkan kartu menu berilustrasi cantik.
                </p>
              </div>

              {/* Tautkan Resep (Opsional) */}
              {recipes.length > 0 && (
                <div>
                  <div className="flex items-center justify-between">
                    <label className="block text-xs font-bold text-[#0b3d2e]">
                      Tautkan Resep Bahan{" "}
                      <span className="font-normal text-[#637970]">
                        (opsional — untuk HPP & stok otomatis)
                      </span>
                    </label>
                    {draf.recipeId && recipeMap.get(draf.recipeId)?.hpp ? (
                      <span className="font-mono text-[10.5px] font-bold text-[#167052]">
                        HPP: {rupiah(recipeMap.get(draf.recipeId)?.hpp || 0)}
                      </span>
                    ) : null}
                  </div>
                  <select
                    value={draf.recipeId}
                    onChange={(e) => {
                      const newRecipeId = e.target.value;
                      const selected = newRecipeId ? recipeMap.get(newRecipeId) : null;
                      const autoCost =
                        (!draf.costPrice || draf.costPrice === "0") && selected?.hpp
                          ? formatRibuan(selected.hpp)
                          : draf.costPrice;
                      setDraf({
                        ...draf,
                        recipeId: newRecipeId,
                        costPrice: autoCost,
                      });
                    }}
                    className={`mt-1.5 w-full rounded-xl px-3.5 py-2 text-xs font-normal transition-all ${
                      isMochi
                        ? "border border-[#d8e3de] bg-[#f8faf9] text-[#0b3d2e] focus:border-[#0b3d2e] focus:bg-white focus:outline-none"
                        : "border-2 border-[#232331]"
                    }`}
                  >
                    <option value="">Tanpa resep bahan</option>
                    {recipes.map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.name} {r.hpp ? `(HPP: ${rupiah(r.hpp)})` : ""}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Status Ketersediaan Awal */}
              <label className="flex items-center gap-2.5 text-xs font-bold text-[#0b3d2e] cursor-pointer pt-1">
                <input
                  type="checkbox"
                  checked={draf.isAvailable}
                  onChange={(e) => setDraf({ ...draf, isAvailable: e.target.checked })}
                  className="h-4 w-4 rounded accent-[#0b3d2e]"
                />
                <span>Langsung tersedia untuk dipesan di POS Kasir & Meja</span>
              </label>

              {/* Pesan Galat di dalam modal jika ada */}
              {galat && (
                <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs font-bold text-rose-800 flex items-center gap-2 animate-in fade-in-50">
                  <AlertCircle size={15} className="shrink-0 text-rose-600" />
                  <span>{galat}</span>
                </div>
              )}
            </div>

            {/* Sticky Action Footer */}
            <div className="sticky bottom-0 z-20 border-t border-[#edf2ef] bg-white px-6 py-3.5 flex items-center gap-2">
              <button
                type="button"
                onClick={() => setDraf(null)}
                className={`rounded-xl py-2.5 px-3.5 text-xs font-bold transition-all ${
                  isMochi
                    ? "border border-[#d8e3de] bg-white text-[#637970] hover:bg-[#f0f5f2]"
                    : "border-2 border-[#232331] bg-white"
                }`}
              >
                Batal
              </button>

              {/* Tombol Input Cepat: Simpan & Tambah Menu Lainnya */}
              {!draf.id && (
                <button
                  type="button"
                  onClick={() => simpan(true)}
                  disabled={sedangSimpan}
                  className={`flex-1 flex items-center justify-center gap-1.5 rounded-xl py-2.5 px-3 text-xs font-black transition-all shadow-xs disabled:opacity-60 ${
                    isMochi
                      ? "border-2 border-[#0b3d2e] bg-white text-[#0b3d2e] hover:bg-emerald-50"
                      : "border-2 border-[#232331] bg-white"
                  }`}
                  title="Simpan menu ini dan langsung input menu berikutnya"
                >
                  <Plus size={14} />
                  <span>Simpan & Tambah Lagi</span>
                </button>
              )}

              {/* Tombol Simpan Utama */}
              <button
                type="button"
                onClick={() => simpan(false)}
                disabled={sedangSimpan}
                className={`flex-1 flex items-center justify-center gap-2 rounded-xl py-2.5 px-4 text-xs sm:text-sm font-black transition-all shadow-md active:scale-95 disabled:opacity-60 ${
                  isMochi
                    ? "bg-[#0b3d2e] text-[#c8f53a] hover:bg-[#167052]"
                    : "border-2 border-[#232331] bg-[#d9ff57]"
                }`}
              >
                {sedangSimpan ? (
                  <Loader2 size={16} className="animate-spin" />
                ) : (
                  <Check size={16} />
                )}
                <span>{draf.id ? "Simpan Perubahan" : "Tambahkan Menu"}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
