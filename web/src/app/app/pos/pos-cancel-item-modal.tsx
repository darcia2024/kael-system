"use client";

import { useState } from "react";
import { Loader2, Trash2, X } from "lucide-react";

import { cancelOrderItemAction } from "@/lib/actions";
import { formatRupiah } from "@/lib/formatters";

/**
 * Tamu membatalkan satu menu sebelum notanya dibayar.
 *
 * Yang dilakukan tombol ini BUKAN menghapus. Barisnya tetap ada di database,
 * ditandai batal beserta alasan dan nama yang membatalkannya — dan itu bukan
 * kerapian arsip, melainkan pengaman:
 *
 *   kasir yang bisa menghapus baris dari nota belum lunas tinggal menerima
 *   uang tunai tamunya, lalu menghapus barisnya. Tidak ada jejak item itu
 *   pernah ada, dan lacinya tetap cocok — karena barisnya memang tidak pernah
 *   ikut dihitung.
 *
 * Yang dibatalkan hilang dari tagihan, struk, tiket dapur, pemotongan stok,
 * dan laporan penjualan. Jadi kekhawatiran "owner tidak perlu lihat menu yang
 * tidak jadi dipesan" tetap terjawab, tanpa membuka celah itu.
 */

const ALASAN = ["Tamu batal pesan", "Salah input kasir", "Menu habis"] as const;

const NASIB = [
  {
    nilai: "belum_dibuat" as const,
    judul: "Belum dibuat",
    isi: "Dapur belum menyentuhnya. Tidak ada bahan yang terpakai.",
  },
  {
    nilai: "sudah_dibuat_dibuang" as const,
    judul: "Sudah dibuat, dibuang",
    isi: "Bahannya sudah habis walau uangnya tidak masuk. Ini kerugian, dan owner perlu melihatnya.",
  },
  {
    nilai: "sudah_dibuat_disajikan" as const,
    judul: "Sudah dibuat, tetap disajikan",
    isi: "Diberikan gratis atau dialihkan ke meja lain.",
  },
];

export default function PosCancelItemModal({
  orderId,
  orderNo,
  itemId,
  namaMenu,
  qty,
  subtotal,
  onSelesai,
  onClose,
  isMochi = true,
}: {
  orderId: string;
  orderNo: string;
  itemId: string;
  namaMenu: string;
  qty: number;
  subtotal: number;
  onSelesai: (notaIkutBatal: boolean) => void;
  onClose: () => void;
  isMochi?: boolean;
}) {
  const [alasan, setAlasan] = useState<string>(ALASAN[0]);
  const [alasanLain, setAlasanLain] = useState("");
  const [nasib, setNasib] = useState<(typeof NASIB)[number]["nilai"]>("belum_dibuat");
  const [sibuk, setSibuk] = useState(false);
  const [galat, setGalat] = useState<string | null>(null);

  const alasanAkhir = alasan === "Lainnya" ? alasanLain.trim() : alasan;

  const batalkan = async () => {
    if (!alasanAkhir) {
      setGalat("Isi dulu alasan pembatalannya.");
      return;
    }
    setSibuk(true);
    setGalat(null);
    const res = await cancelOrderItemAction(orderId, itemId, alasanAkhir, nasib);
    setSibuk(false);
    if (!res.ok) {
      setGalat(res.error);
      return;
    }
    onSelesai(res.data.notaIkutBatal);
  };

  return (
    <div className="fixed inset-0 z-[65] flex items-end justify-center bg-[#07281e]/60 p-0 backdrop-blur-xs sm:items-center sm:p-4">
      <div className="flex max-h-[92dvh] w-full max-w-md flex-col overflow-hidden rounded-t-3xl bg-white shadow-2xl sm:rounded-3xl">
        <div className="flex items-start justify-between gap-3 border-b border-[#d8e3de] bg-[#f8faf9] px-4 py-3.5">
          <div className="min-w-0">
            <h2 className="text-base font-black text-[#0b3d2e]">Batalkan Menu</h2>
            <p className="mt-0.5 truncate font-mono text-[11px] text-[#527867]">
              #{orderNo} · {qty}× {namaMenu} · {formatRupiah(subtotal)}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-[#d8e3de] bg-white text-[#527867]"
            aria-label="Tutup"
          >
            <X size={16} />
          </button>
        </div>

        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-4 py-4">
          <div>
            <p className="mb-1.5 font-mono text-xs font-bold text-[#0b3d2e]">Kenapa dibatalkan?</p>
            <div className="grid gap-1.5">
              {[...ALASAN, "Lainnya"].map((a) => (
                <button
                  key={a}
                  type="button"
                  onClick={() => setAlasan(a)}
                  className={`rounded-xl border px-3 py-2.5 text-left text-xs font-bold transition-all ${
                    alasan === a
                      ? "border-[#0b3d2e] bg-[#edf8f3] text-[#0b3d2e]"
                      : "border-[#d8e3de] bg-white text-[#2f4b3f] hover:bg-[#f8faf9]"
                  }`}
                >
                  {a}
                </button>
              ))}
            </div>
            {alasan === "Lainnya" && (
              <input
                type="text"
                value={alasanLain}
                onChange={(e) => setAlasanLain(e.target.value)}
                placeholder="Tulis alasannya"
                className="mt-1.5 h-10 w-full rounded-xl border border-[#d8e3de] px-3 text-xs"
              />
            )}
          </div>

          <div>
            <p className="mb-1 font-mono text-xs font-bold text-[#0b3d2e]">Makanannya bagaimana?</p>
            {/*
              Dibedakan karena bahannya beda nasib. Yang sudah dibuat sudah
              memakan bahan walau uangnya tidak pernah masuk; yang belum dibuat
              tidak memakan apa pun. Tanpa dibedakan, keduanya terbaca sama di
              laporan dan kerugian yang sesungguhnya jadi tidak kelihatan.
            */}
            <div className="grid gap-1.5">
              {NASIB.map((n) => (
                <button
                  key={n.nilai}
                  type="button"
                  onClick={() => setNasib(n.nilai)}
                  className={`rounded-xl border p-2.5 text-left transition-all ${
                    nasib === n.nilai
                      ? "border-[#0b3d2e] bg-[#edf8f3]"
                      : "border-[#d8e3de] bg-white hover:bg-[#f8faf9]"
                  }`}
                >
                  <p className="text-xs font-black text-[#0b3d2e]">{n.judul}</p>
                  <p className="mt-0.5 text-[10.5px] leading-relaxed text-[#527867]">{n.isi}</p>
                </button>
              ))}
            </div>
          </div>

          <p className="rounded-xl bg-[#f4f7f5] px-3 py-2 text-[10.5px] leading-relaxed text-[#527867]">
            Menu ini hilang dari tagihan, struk, tiket dapur, dan laporan penjualan.
            Catatannya tetap tersimpan supaya pembatalan bisa ditelusuri.
          </p>

          {galat && (
            <p className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-[11.5px] font-bold text-rose-800">
              {galat}
            </p>
          )}
        </div>

        <div className="border-t border-[#d8e3de] bg-[#f8faf9] px-4 py-3">
          <button
            type="button"
            disabled={sibuk}
            onClick={() => void batalkan()}
            className={`flex h-12 w-full items-center justify-center gap-2 rounded-xl text-sm font-black transition-all disabled:opacity-50 ${
              isMochi ? "bg-rose-600 text-white hover:bg-rose-700" : "bg-rose-600 text-white"
            }`}
          >
            {sibuk ? <Loader2 size={16} className="animate-spin" /> : <Trash2 size={16} />}
            <span>{sibuk ? "Memproses..." : "Batalkan Menu Ini"}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
