"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft, Plus, Pencil, Trash2, ImageOff, Loader2, X, Upload,
} from "lucide-react";

import {
  saveMenuItemAction,
  deleteMenuItemAction,
  saveCategoryAction,
  deleteCategoryAction,
  uploadImageAction,
} from "@/lib/actions";
import { kompresGambar } from "@/lib/kompres-gambar";
import type { Category, MenuItem } from "@/lib/types";
import { PLACEHOLDER_MENU } from "@/lib/types";

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
  categories,
  menuItems,
  recipes,
  themeClassName = "",
}: {
  categories: Category[];
  menuItems: MenuItem[];
  recipes: { id: string; name: string }[];
  themeClassName?: string;
}) {
  const router = useRouter();
  const [draf, setDraf] = useState<Draf | null>(null);
  const [sedangSimpan, setSedangSimpan] = useState(false);
  const [galat, setGalat] = useState<string | null>(null);
  const [kabar, setKabar] = useState<string | null>(null);
  const [kategoriBaru, setKategoriBaru] = useState("");
  const [sedangUnggah, setSedangUnggah] = useState(false);
  const berkasRef = useRef<HTMLInputElement | null>(null);

  /**
   * Memilih foto: diperkecil di peramban lebih dulu, baru dikirim.
   *
   * Alamatnya langsung ditulis ke draf, tetapi menunya sendiri BELUM disimpan.
   * Gambar yang terunggah lalu ditinggalkan karena orangnya menekan Batal akan
   * menjadi baris yatim di uploaded_images — tidak berbahaya, cuma memakan
   * tempat, dan itu harga yang lebih murah daripada memaksa orang menyimpan
   * menu setengah jadi hanya supaya bisa melihat fotonya.
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
      // Supaya memilih berkas yang SAMA lagi tetap memicu onChange.
      if (berkasRef.current) berkasRef.current.value = "";
    }
  };

  const namaKategori = (id: string | null) =>
    categories.find((c) => c.id === id)?.name ?? "Tanpa kategori";

  const simpan = async () => {
    if (!draf) return;
    setGalat(null);

    /**
     * Harga diketik manusia, jadi titik dan spasi pemisah ribuan ikut masuk.
     * Dibersihkan di sini supaya "25.000" tidak berubah jadi Rp 25 diam-diam.
     */
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
    setKabar(draf.id ? "Menu diperbarui." : "Menu ditambahkan.");
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
        : `"${item.name}" dihapus.`,
    );
    router.refresh();
  };

  const tambahKategori = async () => {
    if (!kategoriBaru.trim()) return;
    setGalat(null);
    const res = await saveCategoryAction({ name: kategoriBaru, sortOrder: categories.length });
    if (!res.ok) return setGalat(res.error);
    setKategoriBaru("");
    router.refresh();
  };

  const hapusKategori = async (id: string, nama: string) => {
    if (!confirm(`Hapus kategori "${nama}"?`)) return;
    setGalat(null);
    const res = await deleteCategoryAction(id);
    if (!res.ok) return setGalat(res.error);
    router.refresh();
  };

  return (
    <main className={`${themeClassName} mochi-shell min-h-screen bg-[#f7f6fc] p-4 text-[#232331] sm:p-8`}>
      <div className="mx-auto max-w-4xl space-y-5">
        <Link
          href="/app/pos"
          className="inline-flex h-10 w-10 items-center justify-center rounded-lg border-2 border-[#232331] bg-white"
          title="Kembali ke terminal kasir"
        >
          <ArrowLeft size={17} />
        </Link>

        <header className="rounded-lg border border-transparent px-1 py-2">
          <p className="font-mono text-[11px] font-bold text-[#7958d8]">KAEL POS</p>
          <h1 className="text-2xl font-black">Kelola Menu</h1>
          <p className="mt-1 text-xs text-[#7b7b8e]">
            Yang ditambahkan di sini langsung muncul di layar kasir dan di halaman pesan dari meja.
          </p>
        </header>

        {galat && (
          <p className="rounded-xl border-2 border-[#c2410c] bg-[#fff7ed] p-3 text-sm font-bold text-[#c2410c]">
            {galat}
          </p>
        )}
        {kabar && (
          <p className="flex items-start justify-between gap-3 rounded-xl border-2 border-[#15803d] bg-[#f0fdf4] p-3 text-sm font-bold text-[#15803d]">
            <span>{kabar}</span>
            <button type="button" onClick={() => setKabar(null)} aria-label="Tutup">
              <X size={15} />
            </button>
          </p>
        )}

        {/* ------------------------------------------------------- KATEGORI */}
        <section className="mochi-panel rounded-2xl border-2 border-[#232331] bg-white p-5 shadow-ink-md">
          <h2 className="text-sm font-black">Kategori</h2>
          <p className="mt-0.5 text-[11px] text-[#7b7b8e]">
            Dipakai jadi tab di halaman pesan. Boleh kosong kalau menunya sedikit.
          </p>

          <div className="mt-3 flex flex-wrap gap-2">
            {categories.map((c) => (
              <span
                key={c.id}
                className="inline-flex items-center gap-2 rounded-full border-2 border-[#232331] bg-[#f7f6fc] px-3 py-1.5 text-xs font-bold"
              >
                {c.name}
                <button
                  type="button"
                  onClick={() => hapusKategori(c.id, c.name)}
                  aria-label={`Hapus kategori ${c.name}`}
                  className="text-[#7b7b8e] hover:text-[#c2410c]"
                >
                  <X size={13} />
                </button>
              </span>
            ))}
            {!categories.length && (
              <p className="text-xs text-[#7b7b8e]">Belum ada kategori.</p>
            )}
          </div>

          <div className="mt-3 flex gap-2">
            <input
              value={kategoriBaru}
              onChange={(e) => setKategoriBaru(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && tambahKategori()}
              placeholder="Kopi, Non-kopi, Makanan..."
              className="min-w-0 flex-1 rounded-lg border-2 border-[#232331] px-3 py-2 text-sm"
            />
            <button
              type="button"
              onClick={tambahKategori}
              className="mochi-primary shrink-0 rounded-lg border-2 border-[#232331] px-4 py-2 text-sm font-black"
            >
              Tambah
            </button>
          </div>
        </section>

        {/* ----------------------------------------------------- DAFTAR MENU */}
        <section className="mochi-panel rounded-2xl border-2 border-[#232331] bg-white p-5 shadow-ink-md">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-sm font-black">Daftar menu</h2>
              <p className="mt-0.5 text-[11px] text-[#7b7b8e]">{menuItems.length} menu</p>
            </div>
            <button
              type="button"
              onClick={() => {
                setDraf({ ...DRAF_KOSONG });
                setGalat(null);
              }}
              className="mochi-primary inline-flex shrink-0 items-center gap-1.5 rounded-lg border-2 border-[#232331] px-3 py-2 text-sm font-black"
            >
              <Plus size={16} /> Menu baru
            </button>
          </div>

          <div className="mt-4 space-y-2">
            {menuItems.map((m) => (
              <div
                key={m.id}
                className="flex items-center gap-3 rounded-xl border border-[#dedee8] bg-[#fcfcfe] p-3"
              >
                <div className="relative flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-[#dedee8] bg-white">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={m.photo_url || PLACEHOLDER_MENU}
                    alt=""
                    className="h-full w-full object-cover"
                    loading="lazy"
                  />
                  {/*
                    Placeholder terlihat sama persis dengan foto sungguhan di
                    daftar ini, padahal artinya berlawanan. Penanda kecil supaya
                    pemilik usaha tahu menu mana yang belum difoto tanpa harus
                    membuka satu per satu.
                  */}
                  {!m.photo_url && (
                    <span
                      className="absolute bottom-0 right-0 rounded-tl bg-[#232331]/70 p-0.5 text-white"
                      title="Belum ada foto"
                    >
                      <ImageOff size={11} />
                    </span>
                  )}
                </div>

                <div className="min-w-0 flex-1">
                  <p className="flex flex-wrap items-center gap-2 text-sm font-black">
                    <span className="break-words">{m.name}</span>
                    {!m.is_available && (
                      <span className="rounded-full bg-[#fff7ed] px-2 py-0.5 font-mono text-[10px] font-bold text-[#c2410c]">
                        HABIS
                      </span>
                    )}
                  </p>
                  <p className="font-mono text-xs font-bold text-[#15803d]">{rupiah(m.price)}</p>
                  <p className="mt-0.5 truncate text-[11px] text-[#7b7b8e]">
                    {namaKategori(m.category_id)}
                    {m.description ? ` · ${m.description}` : ""}
                  </p>
                </div>

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
                    className="rounded-lg border-2 border-[#232331] bg-white p-2"
                  >
                    <Pencil size={14} />
                  </button>
                  <button
                    type="button"
                    aria-label={`Hapus ${m.name}`}
                    onClick={() => hapus(m)}
                    className="rounded-lg border-2 border-[#232331] bg-white p-2 text-[#c2410c]"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            ))}

            {!menuItems.length && (
              <p className="rounded-xl border border-dashed border-[#dedee8] p-8 text-center text-sm text-[#7b7b8e]">
                Belum ada menu. Tekan &quot;Menu baru&quot; untuk mulai.
              </p>
            )}
          </div>
        </section>
      </div>

      {/* ------------------------------------------------------------ FORM */}
      {draf && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-0 sm:items-center sm:p-4">
          <div className="max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-t-2xl border-2 border-[#232331] bg-white p-5 sm:rounded-2xl">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-black">{draf.id ? "Ubah menu" : "Menu baru"}</h3>
              <button type="button" onClick={() => setDraf(null)} aria-label="Tutup">
                <X size={18} />
              </button>
            </div>

            <div className="mt-4 space-y-3">
              <label className="block text-xs font-bold">
                Nama menu
                <input
                  value={draf.name}
                  onChange={(e) => setDraf({ ...draf, name: e.target.value })}
                  placeholder="Kopi Susu Gula Aren"
                  autoFocus
                  className="mt-1 w-full rounded-lg border-2 border-[#232331] px-3 py-2 text-sm font-normal"
                />
              </label>

              <label className="block text-xs font-bold">
                Harga jual
                <input
                  value={draf.price}
                  onChange={(e) => setDraf({ ...draf, price: e.target.value })}
                  inputMode="numeric"
                  placeholder="25000"
                  className="mt-1 w-full rounded-lg border-2 border-[#232331] px-3 py-2 font-mono text-sm font-bold"
                />
              </label>

              <label className="block text-xs font-bold">
                Kategori
                <select
                  value={draf.categoryId}
                  onChange={(e) => setDraf({ ...draf, categoryId: e.target.value })}
                  className="mt-1 w-full rounded-lg border-2 border-[#232331] px-3 py-2 text-sm font-normal"
                >
                  <option value="">Tanpa kategori</option>
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </label>

              <label className="block text-xs font-bold">
                Deskripsi <span className="font-normal text-[#7b7b8e]">(opsional)</span>
                <textarea
                  value={draf.description}
                  onChange={(e) =>
                    setDraf({ ...draf, description: e.target.value.slice(0, 300) })
                  }
                  rows={2}
                  placeholder="Espresso, susu segar, gula aren asli. Dingin."
                  className="mt-1 w-full rounded-lg border-2 border-[#232331] px-3 py-2 text-sm font-normal"
                />
              </label>

              <div className="text-xs font-bold">
                Foto menu <span className="font-normal text-[#7b7b8e]">(opsional)</span>

                <input
                  ref={berkasRef}
                  type="file"
                  accept="image/*"
                  onChange={(e) => pilihFoto(e.target.files?.[0])}
                  className="hidden"
                />

                <div className="mt-1 flex gap-2">
                  <button
                    type="button"
                    onClick={() => berkasRef.current?.click()}
                    disabled={sedangUnggah}
                    className="flex flex-1 items-center justify-center gap-2 rounded-lg border-2 border-[#232331] bg-white px-3 py-2 text-xs font-black disabled:opacity-60"
                  >
                    {sedangUnggah ? (
                      <>
                        <Loader2 size={14} className="animate-spin" /> Memproses...
                      </>
                    ) : (
                      <>
                        <Upload size={14} /> {draf.photoUrl ? "Ganti foto" : "Ambil / pilih foto"}
                      </>
                    )}
                  </button>
                  {draf.photoUrl && (
                    <button
                      type="button"
                      onClick={() => setDraf({ ...draf, photoUrl: "" })}
                      className="rounded-lg border-2 border-[#232331] bg-white px-3 py-2 text-xs font-black text-[#c2410c]"
                    >
                      Hapus
                    </button>
                  )}
                </div>

                <p className="mt-1 font-normal text-[11px] leading-relaxed text-[#7b7b8e]">
                  Foto dari kamera langsung dikecilkan di HP sebelum dikirim, jadi
                  tidak menghabiskan kuota.
                </p>

                {/*
                  Kolom alamat tetap ada untuk yang gambarnya sudah terlanjur
                  ada di internet. Menghapusnya berarti menu yang alamatnya
                  ditulis sebelum fitur unggah ada jadi tidak bisa diperbaiki.
                */}
                <input
                  value={draf.photoUrl}
                  onChange={(e) => setDraf({ ...draf, photoUrl: e.target.value })}
                  type="text"
                  placeholder="atau tempel alamat gambar https://..."
                  className="mt-2 w-full rounded-lg border border-[#dedee8] px-3 py-2 font-mono text-[11px] font-normal"
                />
              </div>

              {draf.photoUrl.trim() && (
                <div className="overflow-hidden rounded-lg border border-[#dedee8]">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={draf.photoUrl} alt="" className="h-36 w-full object-cover" />
                </div>
              )}

              {recipes.length > 0 && (
                <label className="block text-xs font-bold">
                  Resep{" "}
                  <span className="font-normal text-[#7b7b8e]">
                    (opsional — menyalakan HPP dan potongan stok)
                  </span>
                  <select
                    value={draf.recipeId}
                    onChange={(e) => setDraf({ ...draf, recipeId: e.target.value })}
                    className="mt-1 w-full rounded-lg border-2 border-[#232331] px-3 py-2 text-sm font-normal"
                  >
                    <option value="">Tanpa resep</option>
                    {recipes.map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.name}
                      </option>
                    ))}
                  </select>
                </label>
              )}

              <label className="flex items-center gap-2 text-xs font-bold">
                <input
                  type="checkbox"
                  checked={draf.isAvailable}
                  onChange={(e) => setDraf({ ...draf, isAvailable: e.target.checked })}
                />
                Tersedia untuk dijual
              </label>
            </div>

            {galat && (
              <p className="mt-3 rounded-lg border border-[#c2410c] bg-[#fff7ed] p-2 text-xs font-bold text-[#c2410c]">
                {galat}
              </p>
            )}

            <div className="mt-5 flex gap-2">
              <button
                type="button"
                onClick={() => setDraf(null)}
                className="flex-1 rounded-lg border-2 border-[#232331] bg-white px-4 py-2.5 text-sm font-black"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={simpan}
                disabled={sedangSimpan}
                className="flex flex-1 items-center justify-center gap-2 rounded-lg border-2 border-[#232331] bg-[#d9ff57] px-4 py-2.5 text-sm font-black disabled:opacity-60"
              >
                {sedangSimpan && <Loader2 size={15} className="animate-spin" />}
                Simpan
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
