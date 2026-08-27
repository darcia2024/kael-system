"use client";

import { useState, useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { 
  Coffee, 
  ShoppingBag, 
  Plus, 
  Minus, 
  Trash2, 
  Check, 
  CheckCircle2, 
  Sparkles, 
  ArrowRight, 
  Store, 
  Clock, 
  Utensils 
} from "lucide-react";
import type { Business, Category, MenuItem } from "@/lib/types";
import { createQrOrderAction } from "@/lib/actions";
import QrCode from "@/components/qr-code";
import { buildDynamicQris } from "@/lib/qris-engine";
import { formatRupiah } from "@/lib/formatters";

export default function CustomerQrOrderPage({
  tableNo,
  business,
  categories,
  menuItems,
}: {
  tableNo: string;
  business: Business | null;
  categories: Category[];
  menuItems: MenuItem[];
}) {
  const router = useRouter();


  const [activeCategory, setActiveCategory] = useState<string>("all");
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
  const [caraBayar, setCaraBayar] = useState<"qris" | "cash">("qris");
  const [pesananSelesai, setPesananSelesai] = useState<{ no: string; total: number } | null>(null);

  // Filtered menu
  const filteredMenu = useMemo(() => {
    return menuItems.filter((m) => {
      if (activeCategory === "all") return true;
      return m.category_id === activeCategory;
    });
  }, [menuItems, activeCategory]);

  const cartList = Object.values(cart);
  const cartTotal = cartList.reduce((sum, c) => sum + c.item.price * c.qty, 0);
  const totalItemCount = cartList.reduce((sum, c) => sum + c.qty, 0);

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

  const handleCheckout = async (e: React.FormEvent) => {
    e.preventDefault();
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
    setCart({});
  };

  if (pesananSelesai) {
    const qris =
      caraBayar === "qris" && business?.qris_payload
        ? buildDynamicQris(business.qris_payload, Math.round(pesananSelesai.total))
        : null;

    return (
      <div className="min-h-screen bg-[#f7f6fc] text-[#232331] font-sans flex items-center justify-center p-4">
        <div className="w-full max-w-md rounded-3xl border-2 border-[#232331] bg-white p-6 shadow-ink-lg text-center space-y-4 animate-in zoom-in-95">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-[#dcfce7] text-[#16a34a] border-2 border-[#16a34a]">
            <CheckCircle2 size={30} />
          </div>

          <div className="space-y-1">
            <span className="text-[11px] font-mono font-bold text-[#7958d8] uppercase tracking-wider block">
              PESANAN MEJA {tableNo} MASUK
            </span>
            <h1 className="text-3xl font-black font-mono">#{pesananSelesai.no}</h1>
            <p className="text-2xl font-black text-[#232331]">
              {formatRupiah(pesananSelesai.total)}
            </p>
          </div>

          {qris?.ok ? (
            <div className="space-y-3">
              <div className="mx-auto inline-block rounded-2xl border-2 border-[#232331] bg-white p-3 shadow-ink-xs">
                <QrCode
                  value={qris.payload}
                  size={220}
                  label={`QRIS pembayaran ${formatRupiah(pesananSelesai.total)}`}
                />
              </div>

              {/*
                QR-nya muncul di HP yang sama dengan yang dipakai memesan, jadi
                pelanggan tidak bisa memindainya langsung. Semua dompet digital
                di Indonesia bisa membaca QR dari galeri, dan itulah jalannya —
                tapi hanya kalau diberitahukan. Tanpa kalimat ini, pelanggan
                pertama akan berhenti di sini.
              */}
              <div className="rounded-2xl border-2 border-[#232331] bg-[#fff8e1] p-3 text-left space-y-1.5">
                <p className="font-mono text-[11px] font-black text-[#8a6d00]">
                  Cara bayar dari HP ini:
                </p>
                <ol className="font-mono text-[11px] text-[#8a6d00] space-y-0.5 list-decimal list-inside">
                  <li>Screenshot QR di atas</li>
                  <li>Buka GoPay / DANA / OVO / m-banking</li>
                  <li>Pilih Scan, lalu ambil dari Galeri</li>
                </ol>
                <p className="font-mono text-[10px] text-[#8a6d00] pt-1 border-t border-[#e5b800]">
                  Nominalnya sudah terisi otomatis. Tunjukkan bukti bayar ke kasir.
                </p>
              </div>
            </div>
          ) : (
            <div className="rounded-2xl border border-[#dedee8] bg-[#fcfcfe] p-3 font-mono text-xs space-y-1">
              <p className="font-bold text-[#232331]">
                {caraBayar === "qris"
                  ? "Bayar lewat QRIS yang ada di meja."
                  : "Bayar tunai di kasir."}
              </p>
              <p className="text-[11px] text-[#7b7b8e]">
                Sebutkan nomor pesanan #{pesananSelesai.no}.
              </p>
            </div>
          )}

          {/*
            Tidak menjanjikan pesanan sedang dimasak. Dapur baru mulai setelah
            kasir memastikan uangnya masuk, dan menuliskan "sedang disiapkan"
            di sini membuat pelanggan menunggu sesuatu yang belum berjalan.
          */}
          <p className="font-mono text-[11px] text-[#7b7b8e]">
            Pesanan mulai disiapkan setelah pembayaran dipastikan kasir.
          </p>

          <button
            type="button"
            onClick={() => {
              setPesananSelesai(null);
            }}
            className="btn-tactile w-full py-3 rounded-2xl border-2 border-[#232331] bg-[#232331] text-white font-mono text-xs font-black"
          >
            Pesan Menu Tambahan
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f7f6fc] text-[#232331] font-sans flex flex-col justify-between max-w-md mx-auto border-x border-[#dedee8] pb-28">
      
      {/* Top Header */}
      <header className="sticky top-0 z-30 border-b-2 border-[#232331] bg-white/95 backdrop-blur-md px-4 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-[#232331] bg-[#d9ff57] text-[#232331] font-black text-sm">
              <Utensils size={18} />
            </div>
            <div className="min-w-0">
              <h1 className="font-black text-sm text-[#232331] truncate">
                {business?.name || "Toko Kami"}
              </h1>
              <span className="text-[10.5px] text-[#7958d8] font-mono font-bold block">
                Pemesanan Mandiri · Meja {tableNo}
              </span>
            </div>
          </div>

          <div className="rounded-xl border border-[#232331] bg-[#f0edff] px-2.5 py-1 text-center">
            <span className="text-[9px] font-mono text-[#7958d8] font-bold block uppercase">MEJA</span>
            <span className="text-sm font-black font-mono text-[#232331] block">{tableNo}</span>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="flex-1 p-4 space-y-4">
        
        {/* Category Pills Bar */}
        <div className="flex items-center overflow-x-auto scrollbar-none gap-1.5 font-mono text-xs font-bold">
          <button
            type="button"
            onClick={() => setActiveCategory("all")}
            className={`px-3 py-1.5 rounded-xl border transition-all whitespace-nowrap ${
              activeCategory === "all"
                ? "bg-[#232331] text-[#d9ff57] border-[#232331]"
                : "bg-white text-[#7b7b8e] border-[#dedee8]"
            }`}
          >
            Semua Menu
          </button>
          {categories.map((cat) => (
            <button
              key={cat.id}
              type="button"
              onClick={() => setActiveCategory(cat.id)}
              className={`px-3 py-1.5 rounded-xl border transition-all whitespace-nowrap ${
                activeCategory === cat.id
                  ? "bg-[#232331] text-[#d9ff57] border-[#232331]"
                  : "bg-white text-[#7b7b8e] border-[#dedee8]"
              }`}
            >
              {cat.name}
            </button>
          ))}
        </div>

        {/* Menu Items Grid */}
        <div className="grid gap-3">
          {filteredMenu.map((item) => {
            const inCart = cart[item.id];
            return (
              <div
                key={item.id}
                className={`card-tactile rounded-2xl border-2 p-3.5 space-y-2 transition-all ${
                  item.is_available
                    ? "border-[#232331] bg-white shadow-ink-xs"
                    : "border-[#dedee8] bg-[#fcfcfe] opacity-60"
                }`}
              >
                <div className="flex justify-between items-start gap-2">
                  <div className="min-w-0">
                    <h3 className="font-extrabold text-sm text-[#232331] font-sans">
                      {item.name}
                    </h3>
                    <span className="font-black text-sm font-mono text-[#c2410c] block mt-0.5">
                      {formatRupiah(item.price)}
                    </span>
                  </div>

                  {item.is_available ? (
                    inCart ? (
                      <div className="flex items-center gap-1.5 font-mono text-xs">
                        <button
                          type="button"
                          onClick={() => handleUpdateQty(item.id, -1)}
                          className="h-8 w-8 rounded-lg bg-[#f0edff] text-[#7958d8] border border-[#7958d8] font-black flex items-center justify-center"
                        >
                          <Minus size={13} />
                        </button>
                        <span className="w-6 text-center font-black text-sm">{inCart.qty}</span>
                        <button
                          type="button"
                          onClick={() => handleUpdateQty(item.id, 1)}
                          className="h-8 w-8 rounded-lg bg-[#232331] text-[#d9ff57] font-black flex items-center justify-center"
                        >
                          <Plus size={13} />
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => handleAddToCart(item)}
                        className="btn-tactile rounded-xl border border-[#232331] bg-[#d9ff57] px-3 py-1.5 font-mono text-xs font-black text-[#232331] shadow-ink-xs"
                      >
                        + Pesan
                      </button>
                    )
                  ) : (
                    <span className="rounded-lg bg-[#feebee] text-[#ef4444] px-2 py-1 font-mono text-[10px] font-bold">
                      Habis
                    </span>
                  )}
                </div>

                {/* Custom Note input if item in cart */}
                {inCart && (
                  <div className="pt-2 border-t border-[#dedee8]">
                    <input
                      type="text"
                      placeholder="Catatan khusus (misal: less sugar, es sedikit)..."
                      value={inCart.note}
                      onChange={(e) => handleUpdateNote(item.id, e.target.value)}
                      className="w-full rounded-lg border border-[#dedee8] bg-[#fcfcfe] px-2.5 py-1 text-xs text-[#232331] font-sans"
                    />
                  </div>
                )}
              </div>
            );
          })}
        </div>

      </main>

      {/* FIXED BOTTOM CART & CHECKOUT BAR */}
      {cartList.length > 0 && (
        <div className="fixed bottom-0 inset-x-0 z-40 bg-[#232331] text-white border-t-2 border-[#232331] p-3.5 shadow-ink-xl max-w-md mx-auto">
          
          {/* Identity input expandable before submit */}
          <div className="space-y-2 font-mono text-xs mb-2">
            <div className="grid grid-cols-2 gap-2">
              <input
                type="text"
                required
                placeholder="Nama Pemesan"
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                className="rounded-xl border border-white/20 bg-white/10 px-2.5 py-1.5 text-white placeholder-white/50 text-xs font-sans"
              />
              <input
                type="tel"
                placeholder="No. WhatsApp (Loyalty)"
                value={customerPhone}
                onChange={(e) => setCustomerPhone(e.target.value)}
                className="rounded-xl border border-white/20 bg-white/10 px-2.5 py-1.5 text-white placeholder-white/50 text-xs font-sans"
              />
            </div>
          </div>

          {/*
            Cara bayar dipilih di sini, dari HP pelanggan sendiri. Kasir tidak
            menanyakannya lagi: menanyakan ulang berarti meminta orang yang
            sama membayar dua kali.
          */}
          <div className="space-y-1.5 font-mono text-xs">
            <span className="text-[10px] text-[#dedee8] block">Cara bayar:</span>
            <div className="grid grid-cols-2 gap-2">
              {[
                { id: "qris" as const, label: "QRIS", hint: "Scan & bayar sekarang" },
                { id: "cash" as const, label: "Tunai", hint: "Bayar di kasir" },
              ].map((m) => (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => setCaraBayar(m.id)}
                  className={`rounded-xl border-2 p-2 text-left ${
                    caraBayar === m.id
                      ? "border-[#d9ff57] bg-[#d9ff57] text-[#232331]"
                      : "border-white/20 bg-white/10 text-white"
                  }`}
                >
                  <span className="block font-black text-xs">{m.label}</span>
                  <span className="block text-[10px] opacity-80">{m.hint}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center justify-between gap-3 font-mono text-xs">
            <div>
              <span className="text-[10px] text-[#dedee8] block">
                {totalItemCount} Menu di Meja {tableNo}
              </span>
              <span className="text-lg font-black text-[#d9ff57]">
                {formatRupiah(cartTotal)}
              </span>
            </div>

            <button
              type="button"
              onClick={handleCheckout}
              disabled={isSubmitting || !customerName.trim()}
              className="btn-tactile rounded-xl bg-[#d9ff57] px-5 py-2.5 font-mono text-xs font-black text-[#232331] shadow-ink-xs disabled:opacity-50"
            >
              {isSubmitting ? "Mengirim..." : "Kirim Pesanan ➔"}
            </button>
          </div>

        </div>
      )}

    </div>
  );
}
