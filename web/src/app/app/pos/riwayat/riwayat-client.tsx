"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Search, RotateCcw, Receipt, AlertTriangle } from "lucide-react";

import type { Business, MenuItem, Order, OrderItem } from "@/lib/types";
import { formatRupiah } from "@/lib/formatters";
import { serviceTypeLabel, jamStruk, tanggalStruk } from "@/lib/pos-engine";
import { BusinessMark } from "@/components/business-mark";
import PosReplaceRefundModal from "../pos-replace-refund-modal";

type BarisRiwayat = Order & {
  items: OrderItem[];
  refund_total: number;
  cashier_name: string | null;
  member_name: string | null;
};

export default function RiwayatClient({
  business,
  riwayat,
  menuItems,
  themeClassName = "",
  isMochi = false,
}: {
  business: Business | null;
  riwayat: BarisRiwayat[];
  menuItems: MenuItem[];
  themeClassName?: string;
  isMochi?: boolean;
}) {
  const router = useRouter();
  const [cari, setCari] = useState("");
  const [pilihan, setPilihan] = useState<BarisRiwayat | null>(null);
  const tz = business?.timezone || "Asia/Jakarta";

  const terlihat = useMemo(() => {
    const q = cari.trim().toLowerCase();
    if (!q) return riwayat;
    return riwayat.filter(
      (o) =>
        o.order_no.toLowerCase().includes(q) ||
        (o.table_no ?? "").toLowerCase().includes(q) ||
        (o.member_name ?? "").toLowerCase().includes(q) ||
        (o.customer_name ?? "").toLowerCase().includes(q) ||
        String(o.total).includes(q) ||
        o.items.some((i) => i.name_snapshot.toLowerCase().includes(q)),
    );
  }, [riwayat, cari]);

  /** Kelompok per tanggal setempat, supaya kasir membacanya seperti buku harian. */
  const perTanggal = useMemo(() => {
    const peta = new Map<string, BarisRiwayat[]>();
    for (const o of terlihat) {
      const kunci = tanggalStruk(o.created_at, tz);
      if (!peta.has(kunci)) peta.set(kunci, []);
      peta.get(kunci)!.push(o);
    }
    return [...peta.entries()];
  }, [terlihat, tz]);

  return (
    <div className={`${themeClassName} flex min-h-screen flex-col bg-[#f0f5f2] font-sans text-[#1a382d]`}>
      <header className="sticky top-0 z-30 border-b border-emerald-800/60 bg-[#0b3d2e] px-3 py-2.5 text-white shadow-sm sm:px-8 sm:py-3.5">
        <div className="mx-auto flex max-w-4xl items-center gap-2.5">
          <Link
            href="/app/pos"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-emerald-600/40 bg-white/10 text-white hover:bg-white/15"
            title="Kembali ke Kasir"
          >
            <ArrowLeft size={16} />
          </Link>
          <BusinessMark
            name={business?.name}
            logoUrl={business?.logo_url}
            brandColor={business?.brand_color}
            className="h-9 w-9 shrink-0 rounded-full border border-emerald-400/40"
          />
          <div className="min-w-0">
            <h1 className="truncate text-sm font-black sm:text-base">Riwayat Penjualan</h1>
            <p className="font-mono text-[10.5px] text-emerald-200">7 hari terakhir</p>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-4xl flex-1 space-y-3 p-3 sm:p-6">
        <div className="relative">
          <Search size={15} className="absolute left-3.5 top-3.5 text-[#889990]" />
          <input
            type="text"
            value={cari}
            onChange={(e) => setCari(e.target.value)}
            placeholder="Cari nomor nota, meja, menu, member, atau nominal..."
            className="w-full rounded-2xl border border-[#d8e3de] bg-white py-3 pl-10 pr-4 text-xs font-bold text-[#0b3d2e] outline-none focus:border-emerald-600"
          />
        </div>

        {/*
          Tidak ada ringkasan omzet di sini, dan itu disengaja. Kasir perlu
          menemukan transaksinya; berapa untung tokonya bukan urusannya.
        */}
        {perTanggal.length === 0 && (
          <p className="rounded-2xl border border-[#d8e3de] bg-white p-6 text-center text-xs font-bold text-[#5b7a6e]">
            {cari ? "Tidak ada transaksi yang cocok." : "Belum ada transaksi dalam 7 hari terakhir."}
          </p>
        )}

        {perTanggal.map(([tanggal, daftar]) => (
          <section key={tanggal} className="space-y-2">
            <h2 className="px-1 font-mono text-[11px] font-black text-[#5b7a6e]">{tanggal}</h2>

            {daftar.map((o) => {
              const direfund = Number(o.refund_total) > 0;
              const penuh = direfund && Number(o.refund_total) >= Number(o.total);
              return (
                <article
                  key={o.id}
                  className={`rounded-2xl border bg-white p-3.5 ${
                    penuh ? "border-rose-300" : direfund ? "border-amber-300" : "border-[#d8e3de]"
                  }`}
                >
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="font-mono text-sm font-black text-[#0b3d2e]">
                          #{o.order_no}
                        </span>
                        <span className="rounded-md bg-[#edf8f3] px-1.5 py-0.5 font-mono text-[9.5px] font-bold text-[#167052]">
                          {serviceTypeLabel(o.service_type, o.table_no)}
                        </span>
                        {o.payment_status === "pending" && (
                          <span className="rounded-md bg-amber-100 px-1.5 py-0.5 font-mono text-[9.5px] font-black text-amber-900">
                            BELUM DIBAYAR
                          </span>
                        )}
                        {penuh ? (
                          <span className="rounded-md bg-rose-100 px-1.5 py-0.5 font-mono text-[9.5px] font-black text-rose-800">
                            DIKEMBALIKAN PENUH
                          </span>
                        ) : direfund ? (
                          <span className="rounded-md bg-amber-100 px-1.5 py-0.5 font-mono text-[9.5px] font-black text-amber-900">
                            REFUND SEBAGIAN
                          </span>
                        ) : null}
                      </div>
                      <p className="mt-0.5 font-mono text-[10.5px] text-[#5b7a6e]">
                        {jamStruk(o.created_at, tz)} · {o.payment_method.toUpperCase()}
                        {o.cashier_name ? ` · ${o.cashier_name}` : ""}
                        {o.member_name ? ` · member ${o.member_name}` : ""}
                      </p>
                    </div>

                    <div className="text-right">
                      <p className="font-mono text-sm font-black text-[#0b3d2e]">
                        {formatRupiah(Number(o.total))}
                      </p>
                      {direfund && (
                        <p className="font-mono text-[10.5px] font-bold text-rose-700">
                          −{formatRupiah(Number(o.refund_total))} dikembalikan
                        </p>
                      )}
                    </div>
                  </div>

                  <ul className="mt-2 space-y-0.5 border-t border-[#edf2ef] pt-2">
                    {o.items.map((i) => (
                      <li key={i.id} className="flex justify-between font-mono text-[11px] text-[#20372e]">
                        <span className="truncate">
                          {i.qty}× {i.name_snapshot}
                        </span>
                        <span className="shrink-0 text-[#5b7a6e]">{formatRupiah(Number(i.subtotal))}</span>
                      </li>
                    ))}
                  </ul>

                  {o.discount > 0 && (
                    <p className="mt-1.5 rounded-lg bg-[#f7faf9] px-2 py-1 font-mono text-[10px] text-[#5b7a6e]">
                      Diskon {formatRupiah(Number(o.discount))}
                      {o.discount_reason ? ` — ${o.discount_reason}` : ""}
                    </p>
                  )}

                  {/*
                    Refund cuma untuk transaksi yang uangnya memang sudah
                    diterima. Yang belum dibayar tidak dikembalikan, tapi
                    dibatalkan dari antrean.
                  */}
                  {o.payment_status === "paid" && !penuh && (
                    <button
                      type="button"
                      onClick={() => setPilihan(o)}
                      className="mt-2.5 flex w-full items-center justify-center gap-1.5 rounded-xl border border-rose-300 bg-rose-50 py-2 text-[11px] font-black text-rose-800 hover:bg-rose-100"
                    >
                      <RotateCcw size={13} />
                      <span>Kembalikan Dana / Ganti Menu</span>
                    </button>
                  )}
                </article>
              );
            })}
          </section>
        ))}

        <p className="flex items-start gap-2 px-1 pt-1 text-[11px] leading-relaxed text-[#5b7a6e]">
          <AlertTriangle size={13} className="mt-0.5 shrink-0 text-amber-600" />
          <span>
            Transaksi tidak pernah dihapus. Pengembalian dana dicatat sebagai baris
            baru beserta nama yang memprosesnya, dan ikut terhitung saat tutup shift.
          </span>
        </p>
      </main>

      {pilihan && (
        <PosReplaceRefundModal
          isOpen
          onClose={() => setPilihan(null)}
          order={pilihan}
          menuItems={menuItems}
          isMochi={isMochi}
          onSuccess={() => {
            setPilihan(null);
            router.refresh();
          }}
        />
      )}
    </div>
  );
}
