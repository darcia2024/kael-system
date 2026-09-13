"use client";

import { useState, useMemo, useEffect } from "react";
import {
  CheckCircle2,
  Coffee,
  CupSoda,
  MessageSquare,
  Minus,
  Package,
  Plus,
  Search,
  ShoppingBag,
  Soup,
  UtensilsCrossed,
  X,
  type LucideIcon,
} from "lucide-react";
import type { Business, Category, MenuItem } from "@/lib/types";
import { PLACEHOLDER_MENU } from "@/lib/types";
import { createQrOrderAction } from "@/lib/actions";
import QrCode from "@/components/qr-code";
import { buildDynamicQris } from "@/lib/qris-engine";
import { formatRupiah } from "@/lib/formatters";
import { BusinessMark } from "@/components/business-mark";
import { isMochiBusiness } from "@/lib/mochi-brand";

function getCategoryIcon(categoryName: string): LucideIcon {
  const name = categoryName.toLowerCase();

  if (name.includes("coffee") || name.includes("kopi")) return Coffee;
  if (name.includes("mie") || name.includes("sup") || name.includes("berkuah")) return Soup;
  if (
    name.includes("minuman") ||
    name.includes("dalgona") ||
    name.includes("mojito") ||
    name.includes("milkshake") ||
    name.includes("float") ||
    name.includes("jus")
  ) {
    return CupSoda;
  }
  if (name.includes("cemilan") || name.includes("tambahan")) return Package;

  return UtensilsCrossed;
}

export default function CustomerQrOrderPage({
  tableNo,
  business,
  categories,
  menuItems,
  fontClassName,
}: {
  tableNo: string;
  business: Business | null;
  categories: Category[];
  menuItems: MenuItem[];
  fontClassName: string;
}) {
  const isMochi = isMochiBusiness(business);
  const [activeCategory, setActiveCategory] = useState<string>(categories[0]?.id ?? "");
  const [searchQuery, setSearchQuery] = useState("");
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [cart, setCart] = useState<Record<string, { item: MenuItem; qty: number; note: string }>>({});
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  /**
   * Cara bayar dipilih pelanggan dari HP-nya, bukan lagi ditanyakan ulang di
   * kasir. Apa pun pilihannya, pesanan tetap masuk sebagai belum dibayar:
   * tidak ada gerbang pembayaran yang bisa mengabarkan uangnya sudah masuk,
   * jadi yang memastikannya tetap kasir.
   */
  const [caraBayar, setCaraBayar] = useState<"qris" | "cash">("cash");
  const [pesananSelesai, setPesananSelesai] = useState<{ no: string; total: number } | null>(null);
  const [lastOrder, setLastOrder] = useState<{ name: string; phone: string; items: { menuId: string; qty: number; note: string }[] } | null>(null);

  useEffect(() => {
    if (!business) return;
    try {
      const saved = localStorage.getItem(`kael-last-order:${business.id}`);
      if (saved) setLastOrder(JSON.parse(saved));
    } catch {
      setLastOrder(null);
    }
  }, [business]);

  useEffect(() => {
    if (!isCartOpen) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [isCartOpen]);

  const categorizedMenu = useMemo(
    () =>
      categories
        .map((category) => ({
          category,
          items: menuItems.filter((item) => item.category_id === category.id),
        }))
        .filter((group) => group.items.length > 0),
    [categories, menuItems],
  );

  const activeMenuGroup =
    categorizedMenu.find((group) => group.category.id === activeCategory) ??
    categorizedMenu[0];

  const normalizedSearch = searchQuery.trim().toLowerCase();
  const visibleItems = normalizedSearch
    ? menuItems.filter((item) => {
        const categoryName = categories.find((category) => category.id === item.category_id)?.name ?? "";
        return `${item.name} ${item.description ?? ""} ${categoryName}`
          .toLowerCase()
          .includes(normalizedSearch);
      })
    : activeMenuGroup?.items ?? [];

  const visibleSectionTitle = normalizedSearch
    ? `Hasil pencarian: ${searchQuery.trim()}`
    : activeMenuGroup?.category.name ?? "Menu";

  const selectCategory = (categoryId: string) => {
    setActiveCategory(categoryId);
    requestAnimationFrame(() => {
      document.getElementById("menu-results")?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    });
  };

  const cartList = Object.values(cart);
  const cartTotal = cartList.reduce((sum, c) => sum + c.item.price * c.qty, 0);
  const totalItemCount = cartList.reduce((sum, c) => sum + c.qty, 0);

  useEffect(() => {
    if (cartList.length === 0 && isCartOpen) setIsCartOpen(false);
  }, [cartList.length, isCartOpen]);

  const handleAddToCart = (item: MenuItem) => {
    if (!item.is_available) return;
    setCart((prev) => {
      const existing = prev[item.id];
      if (existing) {
        return {
          ...prev,
          [item.id]: { ...existing, qty: existing.qty + 1 },
        };
      }
      return {
        ...prev,
        [item.id]: { item, qty: 1, note: "" },
      };
    });
  };

  const handleUpdateQty = (itemId: string, delta: number) => {
    setCart((prev) => {
      const existing = prev[itemId];
      if (!existing) return prev;
      const nextQty = existing.qty + delta;
      if (nextQty <= 0) {
        const copy = { ...prev };
        delete copy[itemId];
        return copy;
      }
      return {
        ...prev,
        [itemId]: { ...existing, qty: nextQty },
      };
    });
  };

  const handleUpdateNote = (itemId: string, note: string) => {
    setCart((prev) => {
      const existing = prev[itemId];
      if (!existing) return prev;
      return {
        ...prev,
        [itemId]: { ...existing, note },
      };
    });
  };

  const handleCheckout = async () => {
    if (cartList.length === 0) return;
    setIsSubmitting(true);

    if (!business) {
      setIsSubmitting(false);
      alert("Toko belum siap menerima pesanan.");
      return;
    }

    // Harga tidak ikut dikirim: server membacanya ulang dari database, supaya
    // pemanggil tidak bisa menentukan harganya sendiri.
    const res = await createQrOrderAction(
      business.id,
      tableNo,
      "dine_in",
      caraBayar,
      cartList.map((c) => ({ menu_item_id: c.item.id, qty: c.qty, note: c.note })),
    );

    setIsSubmitting(false);
    if (!res.ok) {
      alert(res.error);
      return;
    }
    setPesananSelesai({ no: res.data.orderNo, total: res.data.total });
    setIsCartOpen(false);
    try {
      localStorage.setItem(`kael-last-order:${business.id}`, JSON.stringify({ name: customerName, phone: customerPhone, items: cartList.map((line) => ({ menuId: line.item.id, qty: line.qty, note: line.note })) }));
    } catch {
      // Pesanan tetap selesai meski browser menolak penyimpanan lokal.
    }
    setCart({});
  };

  const reorderLast = () => {
    if (!lastOrder) return;
    const next: Record<string, { item: MenuItem; qty: number; note: string }> = {};
    for (const line of lastOrder.items) {
      const item = menuItems.find((menu) => menu.id === line.menuId && menu.is_available);
      if (item) next[item.id] = { item, qty: Math.max(1, line.qty), note: line.note || "" };
    }
    if (!Object.keys(next).length) return alert("Menu pesanan sebelumnya sudah tidak tersedia.");
    setCart(next); setCustomerName(lastOrder.name); setCustomerPhone(lastOrder.phone);
  };

  if (pesananSelesai) {
    const qris =
      caraBayar === "qris" && business?.qris_payload
        ? buildDynamicQris(business.qris_payload, Math.round(pesananSelesai.total))
        : null;

    return (
      <div className={`${fontClassName} flex min-h-screen items-center justify-center bg-[#f3f0e8] p-4 text-[#1d2823]`}>
        <div className="w-full max-w-md space-y-4 rounded-2xl border border-[#d5d0c5] bg-[#fffefb] p-6 text-center shadow-[0_16px_45px_rgba(32,42,36,0.12)] animate-in zoom-in-95">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full border border-[#2f6b55] bg-[#e7f0eb] text-[#2f6b55]">
            <CheckCircle2 size={30} />
          </div>

          <div className="space-y-1">
            <span className="block text-[11px] font-bold uppercase text-[#587064]">
              PESANAN MEJA {tableNo} MASUK
            </span>
            <h1 className="text-3xl font-semibold">#{pesananSelesai.no}</h1>
            <p className="text-2xl font-bold text-[#1d2823]">
              {formatRupiah(pesananSelesai.total)}
            </p>
          </div>

          {qris?.ok ? (
            <div className="space-y-3">
              <div className="mx-auto inline-block rounded-xl border border-[#d5d0c5] bg-white p-3">
                <QrCode
                  value={qris.payload}
                  size={220}
                  label={`QRIS pembayaran ${formatRupiah(pesananSelesai.total)}`}
                />
              </div>

              {/*
                QR-nya muncul di HP yang sama dengan yang dipakai memesan, jadi
                pelanggan tidak bisa memindainya langsung. Semua dompet digital
                di Indonesia bisa membaca QR dari galeri, dan itulah jalannya.
                tapi hanya kalau diberitahukan. Tanpa kalimat ini, pelanggan
                pertama akan berhenti di sini.
              */}
              <div className="space-y-1.5 rounded-xl border border-[#dfc982] bg-[#fff9e8] p-3 text-left">
                <p className="text-[11px] font-bold text-[#725b1d]">
                  Cara bayar dari HP ini:
                </p>
                <ol className="list-inside list-decimal space-y-0.5 text-[11px] text-[#725b1d]">
                  <li>Screenshot QR di atas</li>
                  <li>Buka GoPay / DANA / OVO / m-banking</li>
                  <li>Pilih Scan, lalu ambil dari Galeri</li>
                </ol>
                <p className="border-t border-[#dfc982] pt-1 text-[10px] text-[#725b1d]">
                  Nominalnya sudah terisi otomatis. Tunjukkan bukti bayar ke kasir.
                </p>
              </div>
            </div>
          ) : (
            <div className="space-y-1 rounded-xl border border-[#d5d0c5] bg-[#f8f6f0] p-3 text-xs">
              <p className="font-bold text-[#1d2823]">
                {caraBayar === "qris"
                  ? "Bayar lewat QRIS (Bisa sekarang atau selesai makan)."
                  : "Bayar di kasir saat selesai makan."}
              </p>
              <p className="text-[11px] text-[#68736d]">
                Sebutkan nomor pesanan #{pesananSelesai.no} atau Meja {tableNo} saat pembayaran di kasir.
              </p>
            </div>
          )}

          <p className="text-[11px] text-[#167052] font-bold">
            🍳 Pesanan Anda sudah diteruskan ke dapur/barista untuk disiapkan. Selamat menikmati!
          </p>

          {business?.phone ? (
            <a
              href={`https://wa.me/${business.phone.replace(/[^0-9]/g, "").replace(/^0/, "62")}?text=${encodeURIComponent(
                `Halo ${business.name}, saya baru saja memesan dari Meja ${tableNo} (Pesanan #${pesananSelesai.no}) dengan total ${formatRupiah(pesananSelesai.total)}. Mohon diproses ya!`
              )}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex min-h-11 w-full items-center justify-center gap-2 rounded-lg border border-[#22c55e] bg-[#f0fdf4] px-4 font-mono text-xs font-bold text-[#15803d] hover:bg-[#dcfce7] transition-colors"
            >
              <MessageSquare size={16} />
              Konfirmasi / Bukti ke WhatsApp Toko
            </a>
          ) : null}

          <button
            type="button"
            onClick={() => {
              setPesananSelesai(null);
            }}
            className="min-h-11 w-full rounded-lg bg-[#173d32] px-4 text-xs font-bold text-white transition-colors hover:bg-[#214f41]"
          >
            Pesan Menu Tambahan
          </button>
        </div>
      </div>
    );
  }

  const renderCartContent = (showCloseButton: boolean) => (
    <div className="flex min-h-0 flex-col">
      <div className="flex items-start justify-between border-b border-[#dce5e0] pb-4">
        <div>
          <p className="text-[11px] font-bold uppercase text-[#6b7972]">Pesanan saat ini</p>
          <h2 className="mt-1 text-lg font-extrabold text-[#18392f]">Meja {tableNo}</h2>
          <p className="text-xs text-[#75827b]">{totalItemCount} item dipilih</p>
        </div>
        {showCloseButton && (
          <button
            type="button"
            aria-label="Tutup pesanan"
            onClick={() => setIsCartOpen(false)}
            className="flex h-11 w-11 items-center justify-center rounded-lg border border-[#d5ded9] text-[#53635b]"
          >
            <X size={20} aria-hidden="true" />
          </button>
        )}
      </div>

      <div className="divide-y divide-[#e2e8e5]">
        {cartList.map(({ item, qty, note }) => (
          <div key={item.id} className="space-y-2 py-3">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <h3 className="text-sm font-bold leading-snug text-[#20352d]">{item.name}</h3>
                <p className="mt-0.5 text-xs font-semibold text-[#8c5437]">
                  {formatRupiah(item.price * qty)}
                </p>
              </div>
              <div className="grid shrink-0 grid-cols-[44px_32px_44px] items-center">
                <button
                  type="button"
                  aria-label={`Kurangi ${item.name}`}
                  onClick={() => handleUpdateQty(item.id, -1)}
                  className="flex h-11 w-11 items-center justify-center rounded-lg border border-[#cad6d0] text-[#20483a]"
                >
                  <Minus size={14} aria-hidden="true" />
                </button>
                <span className="text-center text-sm font-extrabold">{qty}</span>
                <button
                  type="button"
                  aria-label={`Tambah ${item.name}`}
                  onClick={() => handleUpdateQty(item.id, 1)}
                  className={`flex h-11 w-11 items-center justify-center rounded-lg font-bold ${
                    isMochi
                      ? "bg-[#c8f53a] text-[#0b3d2e] hover:bg-[#d9ff57]"
                      : "bg-[#176c4f] text-white"
                  }`}
                >
                  <Plus size={14} aria-hidden="true" />
                </button>
              </div>
            </div>
            <input
              type="text"
              placeholder="Tambahkan catatan"
              value={note}
              onChange={(event) => handleUpdateNote(item.id, event.target.value)}
              className="min-h-11 w-full rounded-lg border border-[#d5ded9] bg-[#f8faf9] px-3 text-xs text-[#263b33] outline-none focus:border-[#176c4f]"
            />
          </div>
        ))}
      </div>

      <div className="space-y-3 border-t border-[#dce5e0] pt-4">
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-1">
          <label className="space-y-1 text-xs font-semibold text-[#35483f]">
            <span>Nama pemesan</span>
            <input
              type="text"
              required
              placeholder="Masukkan nama"
              value={customerName}
              onChange={(event) => setCustomerName(event.target.value)}
              className="min-h-11 w-full rounded-lg border border-[#cfd9d4] bg-white px-3 text-sm outline-none focus:border-[#176c4f]"
            />
          </label>
          <label className="space-y-1 text-xs font-semibold text-[#35483f]">
            <span>Nomor WhatsApp <span className="font-normal text-[#849089]">(opsional)</span></span>
            <input
              type="tel"
              placeholder="08xxxxxxxxxx"
              value={customerPhone}
              onChange={(event) => setCustomerPhone(event.target.value)}
              className="min-h-11 w-full rounded-lg border border-[#cfd9d4] bg-white px-3 text-sm outline-none focus:border-[#176c4f]"
            />
          </label>
        </div>

        <fieldset>
          <legend className="mb-1.5 text-xs font-semibold text-[#35483f]">Cara bayar</legend>
          <div className="grid grid-cols-2 gap-2">
            {[
              { id: "cash" as const, label: "Bayar Nanti di Kasir", hint: "Makan dulu, bayar selesai" },
              { id: "qris" as const, label: "QRIS dari HP", hint: "Bayar langsung sekarang" },
            ].map((method) => (
              <button
                key={method.id}
                type="button"
                onClick={() => setCaraBayar(method.id)}
                className={`min-h-11 rounded-lg border px-3 py-2 text-left transition-colors ${
                  caraBayar === method.id
                    ? isMochi
                      ? "border-[#0b3d2e] bg-[#0b3d2e] text-[#c8f53a]"
                      : "border-[#176c4f] bg-[#e7f4ee] text-[#174a38]"
                    : "border-[#d5ded9] bg-white text-[#5e6c65]"
                }`}
              >
                <span className="block text-xs font-extrabold">{method.label}</span>
                <span className="block text-[10px]">{method.hint}</span>
              </button>
            ))}
          </div>
        </fieldset>

        <div className="flex items-center justify-between border-t border-[#dce5e0] pt-3">
          <div>
            <span className="block text-[10px] font-semibold uppercase text-[#78857e]">Total</span>
            <span className="text-xl font-extrabold text-[#18392f]">{formatRupiah(cartTotal)}</span>
          </div>
          <button
            type="button"
            onClick={handleCheckout}
            disabled={isSubmitting || !customerName.trim()}
            className={`min-h-11 rounded-xl px-5 text-sm font-black transition-all disabled:cursor-not-allowed disabled:opacity-45 ${
              isMochi
                ? "bg-[#c8f53a] text-[#0b3d2e] hover:bg-[#d9ff57] shadow-sm"
                : "bg-[#0aae6f] text-white hover:bg-[#079760]"
            }`}
          >
            {isSubmitting ? "Mengirim..." : "Kirim pesanan"}
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <div className={`${fontClassName} ${isMochi ? "mochi-ui mochi-shell" : ""} min-h-screen bg-[#edf4f0] pb-24 text-[#1c2d26] lg:pb-0`}>
      {business?.is_demo && (
        <p className="bg-[#f1e5b9] px-4 py-2 text-center text-[10px] font-bold uppercase text-[#6d5520]">
          Demo, tidak untuk pembayaran sungguhan
        </p>
      )}

      <header className={`sticky top-0 z-30 border-b backdrop-blur-md ${isMochi ? "border-[#07281e] bg-[#0b3d2e] text-white shadow-sm" : "mochi-header border-[#d8e1dc] bg-white/95"}`}>
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3 lg:px-6">
          <div className="flex min-w-0 items-center gap-3">
            <BusinessMark
              name={business?.name}
              logoUrl={business?.logo_url}
              brandColor={business?.brand_color}
              className={`rounded-xl border ${isMochi ? "border-emerald-600/40" : "border-[#cdd8d2]"}`}
            />
            <div className="min-w-0">
              <h1 className={`truncate text-base font-extrabold ${isMochi ? "text-white" : "text-[#18392f]"}`}>
                {business?.name || "Toko Kami"}
              </h1>
              <span className={`block text-[11px] font-medium ${isMochi ? "text-emerald-200/80" : "text-[#718078]"}`}>
                Menu digital · Meja {tableNo}
              </span>
            </div>
          </div>

          <div className={`flex h-11 min-w-14 flex-col items-center justify-center rounded-xl px-3 ${isMochi ? "bg-[#c8f53a] text-[#0b3d2e] shadow-sm font-mono" : "border border-[#c8d4ce] bg-[#f5f8f6]"}`}>
            <span className={`text-[8px] font-bold uppercase ${isMochi ? "text-[#0b3d2e]/80" : "text-[#728078]"}`}>Meja</span>
            <span className={`text-sm font-extrabold ${isMochi ? "text-[#0b3d2e]" : "text-[#18392f]"}`}>{tableNo}</span>
          </div>
        </div>
      </header>

      <main className="mx-auto grid max-w-6xl gap-5 px-3 py-4 lg:grid-cols-[minmax(0,1fr)_340px] lg:px-6 lg:py-6">
        <div className="min-w-0 space-y-5">
          <div className="relative">
            <Search
              size={19}
              aria-hidden="true"
              className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-[#697870]"
            />
            <input
              type="search"
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder="Cari menu atau kategori"
              aria-label="Cari menu atau kategori"
              className="min-h-12 w-full rounded-lg border border-[#cfdad4] bg-white pl-11 pr-11 text-sm outline-none transition-colors placeholder:text-[#929d97] focus:border-[#176c4f]"
            />
            {searchQuery && (
              <button
                type="button"
                aria-label="Hapus pencarian"
                onClick={() => setSearchQuery("")}
                className="absolute right-0 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center text-[#68766f]"
              >
                <X size={18} aria-hidden="true" />
              </button>
            )}
          </div>

          {lastOrder && (
            <button
              type="button"
              onClick={reorderLast}
              className="flex min-h-11 w-full items-center justify-between rounded-lg border border-[#bad0c5] bg-[#e5f2ec] px-3 text-left text-xs font-semibold text-[#24513f]"
            >
              <span>Pesan lagi seperti terakhir kali</span>
              <span className="font-extrabold">Pilih</span>
            </button>
          )}

          <section aria-labelledby="category-title" className="space-y-2.5">
            <div className="flex items-end justify-between">
              <h2 id="category-title" className="text-sm font-extrabold text-[#20372e]">Kategori</h2>
              <span className="text-[10px] font-medium text-[#7b8881]">Geser untuk melihat lainnya</span>
            </div>
            <nav
              aria-label="Kategori menu"
              className="-mx-3 flex gap-2 overflow-x-auto px-3 pb-1 scrollbar-none lg:mx-0 lg:px-0"
            >
              {categorizedMenu.map(({ category }) => {
                const CategoryIcon = getCategoryIcon(category.name);
                const isActive = activeCategory === category.id && !normalizedSearch;
                return (
                  <button
                    key={category.id}
                    type="button"
                    onClick={() => {
                      setSearchQuery("");
                      selectCategory(category.id);
                    }}
                    className={`flex h-[82px] w-[104px] min-w-[104px] flex-col items-center justify-center gap-1.5 rounded-2xl border px-2 text-center transition-all ${
                      isActive
                        ? isMochi
                          ? "border-[#c8f53a] bg-[#c8f53a] text-[#0b3d2e] font-extrabold shadow-sm scale-102"
                          : "border-[#176c4f] bg-[#e4f4ed] text-[#14523d]"
                        : "border-[#d5ded9] bg-white text-[#526159] hover:border-[#176c4f]"
                    }`}
                  >
                    <CategoryIcon size={22} strokeWidth={1.8} aria-hidden="true" />
                    <span className="line-clamp-2 text-[10px] font-bold leading-tight">{category.name}</span>
                  </button>
                );
              })}
            </nav>
          </section>

          <section id="menu-results" className="scroll-mt-24 space-y-3">
            <div className="flex items-end justify-between border-b border-[#cbd7d1] pb-2">
              <h2 className="min-w-0 pr-3 text-xl font-extrabold leading-tight text-[#18392f]">
                {visibleSectionTitle}
              </h2>
              <span className="shrink-0 text-[10px] font-medium text-[#78857e]">
                {visibleItems.length} pilihan
              </span>
            </div>

            {visibleItems.length > 0 ? (
              <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 xl:grid-cols-4">
                {visibleItems.map((item) => {
                  const inCart = cart[item.id];
                  const categoryName = categories.find((category) => category.id === item.category_id)?.name ?? "Menu";
                  const CategoryIcon = getCategoryIcon(categoryName);
                  const hasPhoto = item.photo_url && item.photo_url !== PLACEHOLDER_MENU;

                  return (
                    <article
                      key={item.id}
                      className="flex min-h-[250px] min-w-0 flex-col overflow-hidden rounded-lg border border-[#d7e0db] bg-white shadow-[0_5px_18px_rgba(25,67,52,0.06)]"
                    >
                      <div className="relative aspect-[4/3] w-full overflow-hidden border-b border-[#e0e7e3] bg-[#e8f2ed]">
                        {hasPhoto ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={item.photo_url ?? undefined}
                            alt={item.name}
                            loading="lazy"
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          <div className="flex h-full flex-col items-center justify-center gap-2 text-[#34745c]">
                            <CategoryIcon size={36} strokeWidth={1.5} aria-hidden="true" />
                            <span className="max-w-[85%] text-center text-[9px] font-bold uppercase leading-tight text-[#698278]">
                              {categoryName}
                            </span>
                          </div>
                        )}
                      </div>

                      <div className="flex flex-1 flex-col p-2.5">
                        <h3 className="break-words text-[14px] font-extrabold leading-tight text-[#18392f]">
                          {item.name}
                        </h3>
                        {item.description && (
                          <p className="mt-1 line-clamp-2 text-[10px] leading-relaxed text-[#78857e]">
                            {item.description}
                          </p>
                        )}

                        <div className="mt-auto pt-3">
                          {inCart ? (
                            <>
                              <span className="block text-[13px] font-extrabold text-[#8f5032]">
                                {formatRupiah(item.price)}
                              </span>
                              <div className="mt-2 grid w-full grid-cols-[44px_minmax(0,1fr)_44px] items-center">
                                <button
                                  type="button"
                                  aria-label={`Kurangi ${item.name}`}
                                  onClick={() => handleUpdateQty(item.id, -1)}
                                  className="flex h-11 w-11 items-center justify-center rounded-lg border border-[#b8cdc3] text-[#1b5f47]"
                                >
                                  <Minus size={14} aria-hidden="true" />
                                </button>
                                <span className="text-center text-xs font-extrabold">{inCart.qty}</span>
                                <button
                                  type="button"
                                  aria-label={`Tambah ${item.name}`}
                                  onClick={() => handleUpdateQty(item.id, 1)}
                                  className={`flex h-11 w-11 items-center justify-center rounded-lg font-bold ${
                                    isMochi
                                      ? "bg-[#c8f53a] text-[#0b3d2e] hover:bg-[#d9ff57]"
                                      : "bg-[#0aae6f] text-white"
                                  }`}
                                >
                                  <Plus size={15} aria-hidden="true" />
                                </button>
                              </div>
                            </>
                          ) : (
                            <div className="flex items-end justify-between gap-2">
                              <span className="min-w-0 text-[13px] font-extrabold text-[#8f5032]">
                                {formatRupiah(item.price)}
                              </span>
                              <button
                                type="button"
                                aria-label={`Tambah ${item.name} ke pesanan`}
                                title={`Tambah ${item.name}`}
                                onClick={() => handleAddToCart(item)}
                                className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl transition-all focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 ${
                                  isMochi
                                    ? "bg-[#c8f53a] text-[#0b3d2e] hover:bg-[#d9ff57] shadow-sm active:scale-95 focus-visible:outline-[#c8f53a]"
                                    : "bg-[#0aae6f] text-white hover:bg-[#079760] focus-visible:outline-[#176c4f]"
                                }`}
                              >
                                <Plus size={19} strokeWidth={2.5} aria-hidden="true" />
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    </article>
                  );
                })}
              </div>
            ) : (
              <div className="rounded-lg border border-[#d5ded9] bg-white px-5 py-10 text-center">
                <p className="text-sm font-extrabold text-[#284238]">Menu tidak ditemukan</p>
                <p className="mt-1 text-xs text-[#78857e]">Coba nama menu atau kategori lain.</p>
              </div>
            )}
          </section>
        </div>

        <aside className="hidden self-start rounded-lg border border-[#d5ded9] bg-white p-4 shadow-[0_8px_24px_rgba(25,67,52,0.07)] lg:sticky lg:top-24 lg:block">
          {cartList.length > 0 ? (
            renderCartContent(false)
          ) : (
            <div className="py-12 text-center">
              <ShoppingBag size={28} aria-hidden="true" className="mx-auto text-[#759087]" />
              <h2 className="mt-3 text-sm font-extrabold text-[#284238]">Pesanan masih kosong</h2>
              <p className="mx-auto mt-1 max-w-48 text-xs leading-relaxed text-[#7a8780]">
                Tekan tombol tambah pada menu yang ingin dipesan.
              </p>
            </div>
          )}
        </aside>
      </main>

      {cartList.length > 0 && (
        <div className="fixed inset-x-0 bottom-0 z-40 border-t border-[#d1ddd7] bg-white px-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] pt-3 shadow-[0_-8px_24px_rgba(25,67,52,0.12)] lg:hidden">
          <button
            type="button"
            onClick={() => setIsCartOpen(true)}
            className={`mx-auto flex min-h-12 w-full max-w-md items-center justify-between rounded-xl px-4 transition-transform active:scale-[0.99] ${
              isMochi
                ? "bg-[#0b3d2e] text-white border border-emerald-600/40 shadow-xl"
                : "bg-[#176c4f] text-white"
            }`}
          >
            <span className="flex items-center gap-2 text-left">
              <span className={`relative flex h-8 w-8 items-center justify-center rounded-lg ${isMochi ? "bg-white/10" : "bg-white/12"}`}>
                <ShoppingBag size={18} aria-hidden="true" />
                <span className={`absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[9px] font-black ${
                  isMochi ? "bg-[#c8f53a] text-[#0b3d2e]" : "bg-[#d9f52a] text-[#18392f]"
                }`}>
                  {totalItemCount}
                </span>
              </span>
              <span>
                <span className="block text-xs font-extrabold">Lihat pesanan</span>
                <span className={`block text-[10px] ${isMochi ? "text-emerald-200/80" : "text-white/75"}`}>Meja {tableNo}</span>
              </span>
            </span>
            <span className={`text-sm font-extrabold ${isMochi ? "text-[#c8f53a]" : "text-white"}`}>{formatRupiah(cartTotal)}</span>
          </button>
        </div>
      )}

      {isCartOpen && cartList.length > 0 && (
        <div className="fixed inset-0 z-50 flex items-end bg-[#112a21]/45 lg:hidden" role="dialog" aria-modal="true" aria-label="Rincian pesanan">
          <button
            type="button"
            aria-label="Tutup rincian pesanan"
            onClick={() => setIsCartOpen(false)}
            className="absolute inset-0 cursor-default"
          />
          <div className="relative max-h-[88dvh] w-full overflow-y-auto rounded-t-2xl bg-white p-4 pb-[calc(1rem+env(safe-area-inset-bottom))] shadow-[0_-16px_40px_rgba(17,42,33,0.2)]">
            <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-[#cbd6d0]" />
            {renderCartContent(true)}
          </div>
        </div>
      )}
    </div>
  );
}
