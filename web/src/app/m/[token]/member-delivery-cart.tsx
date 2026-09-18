"use client";

import { useMemo, useState } from "react";
import { CheckCircle2, Loader2, MapPin, Minus, Plus, ShoppingBag, Trash2, X } from "lucide-react";

import { createMemberDeliveryOrderAction } from "@/lib/actions";
import { formatRupiah } from "@/lib/formatters";
import { PLACEHOLDER_MENU, type MenuItem } from "@/lib/types";

/**
 * Keranjang pesan antar di kartu member.
 *
 * Sebelum ini "pesan delivery" cuma membuka WhatsApp dengan templat kosong:
 * pelanggan mengetik sendiri menu dan alamatnya di chat, lalu kasir menyalinnya
 * satu per satu ke layar kasir. Yang lebih dari satu menu repot di dua sisi, dan
 * alamat yang ditulis di tengah obrolan gampang terlewat.
 *
 * Sekarang pesanannya masuk ke antrean kasir sebagai pesanan sungguhan, lengkap
 * dengan alamat. Ongkir SENGAJA tidak dihitung di sini: pelanggan tidak bisa
 * tahu ongkirnya, tokonya yang tahu jarak dan tarif kurir. Kasir mengisinya di
 * antrean, lalu mengirim faktur berisi total plus ongkir lewat WhatsApp.
 *
 * Angka di layar ini PERKIRAAN dari harga menu. Server menghitung ulang dari
 * database saat pesanan dikirim, termasuk pajak dan service dengan tarif yang
 * sama dengan kasir — keranjang di HP tidak pernah menentukan harganya.
 */
export default function MemberDeliveryCart({
  token,
  menuItems,
  keranjang,
  setKeranjang,
  terbuka,
  setTerbuka,
}: {
  token: string;
  menuItems: MenuItem[];
  /** id menu -> jumlah. */
  keranjang: Record<string, number>;
  setKeranjang: (next: Record<string, number>) => void;
  terbuka: boolean;
  setTerbuka: (v: boolean) => void;
}) {
  const [alamat, setAlamat] = useState("");
  const [catatan, setCatatan] = useState("");
  const [caraBayar, setCaraBayar] = useState<"cash" | "transfer">("cash");
  const [mengirim, setMengirim] = useState(false);
  const [galat, setGalat] = useState<string | null>(null);
  const [selesai, setSelesai] = useState<{ orderNo: string; subtotal: number } | null>(null);

  const byId = useMemo(() => new Map(menuItems.map((m) => [m.id, m])), [menuItems]);
  const baris = Object.entries(keranjang)
    .map(([id, qty]) => ({ item: byId.get(id), qty }))
    .filter((b): b is { item: MenuItem; qty: number } => !!b.item && b.qty > 0);
  const jumlahItem = baris.reduce((s, b) => s + b.qty, 0);
  const perkiraan = baris.reduce((s, b) => s + Number(b.item.price) * b.qty, 0);

  const ubah = (id: string, delta: number) => {
    const next = { ...keranjang };
    const qty = (next[id] ?? 0) + delta;
    if (qty <= 0) delete next[id];
    else next[id] = Math.min(99, qty);
    setKeranjang(next);
  };

  const kirim = async () => {
    setGalat(null);
    if (alamat.trim().length < 10) {
      setGalat("Tulis alamat pengantarannya lebih lengkap — jalan, nomor, patokan.");
      return;
    }
    setMengirim(true);
    const res = await createMemberDeliveryOrderAction({
      token,
      items: baris.map((b) => ({ menu_item_id: b.item.id, qty: b.qty })),
      alamat,
      catatan,
      caraBayar,
    });
    setMengirim(false);
    if (!res.ok) {
      setGalat(res.error);
      return;
    }
    setSelesai(res.data);
    setKeranjang({});
    setAlamat("");
    setCatatan("");
  };

  const tutup = () => {
    setTerbuka(false);
    setSelesai(null);
    setGalat(null);
  };

  return (
    <>
      {/* Bilah keranjang: di ATAS navigasi bawah, bukan menimpanya. */}
      {jumlahItem > 0 && !terbuka && (
        <button
          type="button"
          onClick={() => setTerbuka(true)}
          className="fixed bottom-[88px] inset-x-3 z-40 mx-auto flex max-w-sm items-center justify-between gap-3 rounded-2xl bg-[#c8f53a] px-4 py-3 text-[#073829] shadow-[0_10px_30px_rgba(7,56,41,0.35)] active:scale-[0.98] transition-transform"
        >
          <span className="flex items-center gap-2 text-sm font-black">
            <ShoppingBag size={17} />
            {jumlahItem} item · {formatRupiah(perkiraan)}
          </span>
          <span className="text-xs font-black">Pesan antar →</span>
        </button>
      )}

      {terbuka && (
        <div
          className="fixed inset-0 z-[9998] flex items-end justify-center bg-black/60 backdrop-blur-xs sm:items-center sm:p-4"
          onClick={tutup}
        >
          <div
            className="flex max-h-[90dvh] w-full max-w-sm flex-col overflow-hidden rounded-t-[28px] bg-white text-[#1c2d26] shadow-2xl sm:rounded-3xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-[#e3ece7] px-5 py-4">
              <h2 className="flex items-center gap-2 text-base font-black">
                <ShoppingBag size={18} className="text-[#167052]" />
                {selesai ? "Pesanan terkirim" : "Pesan antar"}
              </h2>
              <button
                type="button"
                onClick={tutup}
                aria-label="Tutup"
                className="flex h-9 w-9 items-center justify-center rounded-xl border border-[#d8e3de] text-[#52665e]"
              >
                <X size={16} />
              </button>
            </div>

            {selesai ? (
              <div className="space-y-4 px-5 py-6 text-center">
                <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-[#edf8f3] text-[#167052]">
                  <CheckCircle2 size={30} />
                </div>
                <div>
                  <p className="font-mono text-2xl font-black">#{selesai.orderNo}</p>
                  <p className="mt-1 text-sm font-bold">Subtotal {formatRupiah(selesai.subtotal)}</p>
                </div>
                {/*
                  Yang terjadi berikutnya dijelaskan apa adanya. Pesanan ini
                  belum dikonfirmasi dan ongkirnya belum ada — pelanggan yang
                  mengira urusannya sudah selesai akan menunggu kurir yang
                  tidak pernah diberangkatkan.
                */}
                <p className="rounded-2xl bg-[#f4f8f6] p-4 text-left text-[12px] leading-relaxed text-[#355247]">
                  Pesananmu sudah masuk ke kasir. Kasir akan mengirim <b>total beserta ongkir</b> ke
                  WhatsApp-mu. Pesanan diproses setelah kamu setuju dengan totalnya.
                </p>
                <button
                  type="button"
                  onClick={tutup}
                  className="h-11 w-full rounded-xl bg-[#0b3d2e] text-sm font-black text-[#c8f53a]"
                >
                  Oke
                </button>
              </div>
            ) : baris.length === 0 ? (
              <div className="space-y-2 px-5 py-8 text-center">
                <ShoppingBag size={28} className="mx-auto text-[#a6b8b0]" />
                <p className="text-sm font-bold">Keranjangnya masih kosong</p>
                <p className="text-[12px] text-[#52665e]">
                  Buka menu, pilih yang mau dipesan, lalu tekan &quot;Tambah ke pesanan antar&quot;.
                </p>
              </div>
            ) : (
              <>
                <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-5 py-4">
                  <ul className="space-y-2.5">
                    {baris.map(({ item, qty }) => (
                      <li key={item.id} className="flex items-center gap-3">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={item.photo_url || PLACEHOLDER_MENU}
                          alt=""
                          className="h-12 w-12 shrink-0 rounded-xl border border-[#e3ece7] object-cover"
                        />
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-[13px] font-black">{item.name}</p>
                          <p className="font-mono text-[11px] text-[#52665e]">
                            {formatRupiah(Number(item.price) * qty)}
                          </p>
                        </div>
                        <div className="flex shrink-0 items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => ubah(item.id, -1)}
                            aria-label={qty === 1 ? `Hapus ${item.name}` : `Kurangi ${item.name}`}
                            className="flex h-8 w-8 items-center justify-center rounded-lg border border-[#d8e3de] text-[#355247]"
                          >
                            {qty === 1 ? <Trash2 size={13} /> : <Minus size={13} />}
                          </button>
                          <span className="w-6 text-center font-mono text-sm font-black">{qty}</span>
                          <button
                            type="button"
                            onClick={() => ubah(item.id, 1)}
                            aria-label={`Tambah ${item.name}`}
                            className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#0b3d2e] text-[#c8f53a]"
                          >
                            <Plus size={13} />
                          </button>
                        </div>
                      </li>
                    ))}
                  </ul>

                  <label className="block">
                    <span className="mb-1 flex items-center gap-1.5 text-xs font-black">
                      <MapPin size={13} className="text-[#167052]" /> Alamat pengantaran
                    </span>
                    <textarea
                      value={alamat}
                      onChange={(e) => setAlamat(e.target.value.slice(0, 300))}
                      rows={3}
                      placeholder="Jl. Sutan Syahrir No. 45, Silaing Bawah. Rumah pagar hijau, depan masjid."
                      className="w-full rounded-xl border border-[#d8e3de] px-3 py-2.5 text-[13px] focus:border-[#167052] focus:outline-none"
                    />
                    <span className="mt-0.5 block text-[10.5px] text-[#52665e]">
                      Sertakan patokan — kurir tidak bisa bertanya ke peta.
                    </span>
                  </label>

                  <label className="block">
                    <span className="mb-1 block text-xs font-black">
                      Catatan <span className="font-normal text-[#52665e]">(opsional)</span>
                    </span>
                    <input
                      value={catatan}
                      onChange={(e) => setCatatan(e.target.value.slice(0, 200))}
                      placeholder="Pedasnya sedang, esnya dipisah"
                      className="h-11 w-full rounded-xl border border-[#d8e3de] px-3 text-[13px] focus:border-[#167052] focus:outline-none"
                    />
                  </label>

                  <div>
                    <span className="mb-1.5 block text-xs font-black">Bayar dengan</span>
                    <div className="grid grid-cols-2 gap-2">
                      {([
                        { k: "cash", label: "Tunai", sub: "saat pesanan tiba" },
                        { k: "transfer", label: "Transfer", sub: "setelah total dikirim" },
                      ] as const).map((o) => (
                        <button
                          key={o.k}
                          type="button"
                          onClick={() => setCaraBayar(o.k)}
                          className={`rounded-xl border p-2.5 text-left ${
                            caraBayar === o.k
                              ? "border-[#0b3d2e] bg-[#0b3d2e] text-[#c8f53a]"
                              : "border-[#d8e3de] bg-white text-[#1c2d26]"
                          }`}
                        >
                          <span className="block text-[13px] font-black">{o.label}</span>
                          <span className="block text-[10.5px] opacity-80">{o.sub}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="space-y-2 border-t border-[#e3ece7] bg-[#f8faf9] px-5 py-4">
                  <div className="flex items-baseline justify-between">
                    <span className="text-xs font-bold text-[#52665e]">Perkiraan menu</span>
                    <span className="font-mono text-lg font-black">{formatRupiah(perkiraan)}</span>
                  </div>
                  <p className="text-[10.5px] leading-relaxed text-[#52665e]">
                    Belum termasuk ongkir. Kasir akan mengirim total akhirnya ke WhatsApp-mu.
                  </p>
                  {galat && (
                    <p className="rounded-lg border border-[#f3c9b5] bg-[#fff7f2] px-3 py-2 text-[11.5px] font-bold text-[#b4400f]">
                      {galat}
                    </p>
                  )}
                  <button
                    type="button"
                    onClick={() => void kirim()}
                    disabled={mengirim}
                    className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#0b3d2e] text-sm font-black text-[#c8f53a] disabled:opacity-60"
                  >
                    {mengirim && <Loader2 size={16} className="animate-spin" />}
                    Kirim pesanan ke kasir
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}
