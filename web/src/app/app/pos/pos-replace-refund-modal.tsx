"use client";

import { useState } from "react";
import {
  X,
  RefreshCw,
  RotateCcw,
  AlertTriangle,
  CheckCircle2,
  UtensilsCrossed,
  DollarSign,
  Ban,
  Check,
  Loader2,
} from "lucide-react";
import type { ItemChangeSettlement, MenuItem, Order, OrderItem, RefundReasonCode } from "@/lib/types";
import { REFUND_REASONS } from "@/lib/types";
import { formatRupiah } from "@/lib/formatters";
import { replaceOrderItemAction, refundOrderAction } from "@/lib/actions";

export interface PosReplaceRefundModalProps {
  isOpen: boolean;
  onClose: () => void;
  order: Order & { items: OrderItem[] };
  selectedItem?: OrderItem | null;
  menuItems: MenuItem[];
  isMochi?: boolean;
  onSuccess?: () => void;
}

/**
 * Daftar alasan diambil dari `@/lib/types`, bukan disalin ke sini.
 *
 * Salinan lokalnya dulu memakai kunci "bahan_habis" sementara server mengenal
 * "stok_habis", jadi tiap kali kasir memilih alasan itu, yang tercatat adalah
 * "lainnya" — dan laporan alasan refund kehilangan justru alasan yang paling
 * sering dipakai di dapur.
 */
const REASON_ICON: Record<RefundReasonCode, string> = {
  lama_datang: "⏳",
  stok_habis: "⚠️",
  salah_input: "✍️",
  keringanan_owner: "🤝",
  komplain_rasa: "👎",
  lainnya: "📝",
};

export default function PosReplaceRefundModal({
  isOpen,
  onClose,
  order,
  selectedItem,
  menuItems,
  isMochi = true,
  onSuccess,
}: PosReplaceRefundModalProps) {
  const [mode, setMode] = useState<"replace" | "refund_item" | "refund_order">(
    selectedItem ? "replace" : "refund_order"
  );

  // Replace state
  const [replacementMenuItemId, setReplacementMenuItemId] = useState<string>("");
  const [replaceNote, setReplaceNote] = useState<string>("");

  /**
   * Selisih harga penggantian mau diapakan. Untuk nota yang sudah lunas ini
   * wajib dipilih: selisih yang tidak ditagih maupun dikembalikan akan muncul
   * lagi saat tutup shift tanpa ada yang ingat penyebabnya.
   */
  const [settlement, setSettlement] = useState<ItemChangeSettlement>("none");

  // Refund state
  const [refundReasonKey, setRefundReasonKey] = useState<RefundReasonCode>("stok_habis");
  const [refundReasonCustom, setRefundReasonCustom] = useState<string>("");
  const [refundPaymentMethod, setRefundPaymentMethod] = useState<"cash" | "qris">("cash");
  const [refundAmount, setRefundAmount] = useState<number>(
    selectedItem ? Number(selectedItem.subtotal) : Number(order.total)
  );

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const availableMenuItems = menuItems.filter(
    (m) => m.is_available && (!selectedItem || m.id !== selectedItem.menu_item_id)
  );

  const selectedReplacement = availableMenuItems.find((m) => m.id === replacementMenuItemId);

  const currentItemPrice = selectedItem ? Number(selectedItem.price_snapshot) : 0;
  const currentItemSubtotal = selectedItem ? Number(selectedItem.subtotal) : 0;
  const replacementSubtotal = selectedReplacement
    ? Number(selectedReplacement.price) * (selectedItem?.qty || 1)
    : 0;
  const priceDifference = replacementSubtotal - currentItemSubtotal;

  /**
   * Selisih pada nota yang belum dibayar tidak perlu diselesaikan terpisah —
   * pelanggan tinggal membayar total yang baru. Yang wajib diputuskan adalah
   * selisih pada nota yang uangnya sudah telanjur diterima.
   */
  const needsSettlement = priceDifference !== 0 && order.payment_status === "paid";

  const handleExecuteReplace = async () => {
    if (!selectedItem || !selectedReplacement) {
      setError("Pilih menu pengganti terlebih dahulu.");
      return;
    }

    // Nota lunas dengan harga berbeda tidak boleh lanjut sebelum kasir
    // menentukan nasib selisihnya.
    if (needsSettlement && settlement === "none") {
      setError(
        priceDifference > 0
          ? "Menu penggantinya lebih mahal. Pilih dulu: ditagih ke pelanggan, atau ditanggung toko."
          : "Menu penggantinya lebih murah. Pilih dulu: dikembalikan ke pelanggan, atau ditanggung toko.",
      );
      return;
    }

    setBusy(true);
    setError(null);

    const res = await replaceOrderItemAction(
      order.id,
      selectedItem.id,
      selectedReplacement.id,
      settlement,
      replaceNote.trim() || undefined
    );

    setBusy(false);

    if (!res.ok) {
      setError(res.error || "Gagal mengganti menu.");
      return;
    }

    const kabarSelisih: Record<ItemChangeSettlement, string> = {
      none: "Harga sama pas.",
      collect: `Pelanggan menambah bayar ${formatRupiah(Math.abs(res.data.priceDiff))}.`,
      refund: `Selisih ${formatRupiah(Math.abs(res.data.priceDiff))} dikembalikan ke pelanggan.`,
      waive: `Selisih ${formatRupiah(Math.abs(res.data.priceDiff))} ditanggung toko, tercatat sebagai diskon.`,
    };

    alert(
      `✓ Menu ${selectedItem.name_snapshot} berhasil diganti dengan ${res.data.newName}!\n` +
      kabarSelisih[res.data.settlement] +
      `\nStok bahan kedua menu sudah ikut disesuaikan.`
    );

    if (onSuccess) onSuccess();
    onClose();
  };

  const handleExecuteRefund = async () => {
    if (refundAmount <= 0) {
      setError("Nominal refund harus lebih besar dari Rp 0.");
      return;
    }

    const selectedReasonLabel =
      REFUND_REASONS.find((r) => r.key === refundReasonKey)?.label || refundReasonKey;
    // Kategorinya dikirim sebagai kode tersendiri, jadi teks ini cukup berisi
    // keterangan yang benar-benar diketik kasir.
    const finalReason = refundReasonCustom.trim() || selectedReasonLabel;

    setBusy(true);
    setError(null);

    const res = await refundOrderAction(
      order.id,
      refundAmount,
      finalReason,
      refundReasonKey,
      refundPaymentMethod,
      // Refund satu menu ditandai itemnya, supaya laporan bisa menjawab menu
      // mana yang paling sering dikembalikan.
      mode === "refund_item" ? selectedItem?.id ?? null : null,
    );

    setBusy(false);

    if (!res.ok) {
      setError(res.error || "Gagal memproses refund.");
      return;
    }

    alert(
      `✓ Refund sebesar ${formatRupiah(refundAmount)} berhasil dicatat!\n` +
      `Alasan: ${finalReason}\n` +
      `Metode Pengembalian: ${refundPaymentMethod.toUpperCase()}\n` +
      `Laporan shift & laba telah otomatis dipotong.`
    );

    if (onSuccess) onSuccess();
    onClose();
  };

  return (
    <div
      className={`fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 backdrop-blur-xs ${
        isMochi ? "bg-[#07281e]/65" : "bg-[#232331]/65"
      }`}
    >
      <div
        className={`w-full max-w-lg rounded-3xl bg-white p-5 sm:p-6 space-y-4 animate-in zoom-in-95 font-mono text-xs max-h-[95vh] overflow-y-auto ${
          isMochi ? "border border-[#d8e3de] shadow-2xl" : "border-2 border-[#232331] shadow-ink-lg"
        }`}
      >
        {/* Header */}
        <div className={`flex items-center justify-between border-b pb-3 ${isMochi ? "border-[#e0ebe5]" : "border-[#dedee8]"}`}>
          <div>
            <h3 className={`font-black text-base font-sans ${isMochi ? "text-[#0b3d2e]" : "text-[#232331]"}`}>
              Penyesuaian Pesanan #{order.order_no}
            </h3>
            <p className="text-[11px] text-[#718078]">
              {order.table_no ? `Meja ${order.table_no}` : "Bungkus / Kasir"} · Tagihan Total: {formatRupiah(Number(order.total))}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className={`flex h-8 w-8 items-center justify-center rounded-full transition-colors ${
              isMochi ? "bg-[#edf8f3] text-[#0b3d2e] hover:bg-[#e0f1e8]" : "bg-gray-100 text-gray-700 hover:bg-gray-200"
            }`}
          >
            <X size={16} />
          </button>
        </div>

        {error && (
          <div className="flex items-start gap-2 rounded-xl border border-rose-300 bg-rose-50 p-2.5 text-rose-800">
            <AlertTriangle size={15} className="shrink-0 mt-0.5 text-rose-600" />
            <p className="font-bold text-[11px]">{error}</p>
          </div>
        )}

        {/* Selected Item Banner if passed */}
        {selectedItem && (
          <div className={`p-3 rounded-2xl border flex items-center justify-between gap-3 ${
            isMochi ? "bg-[#f8faf9] border-[#ccd9d3]" : "bg-[#faf9ff] border-[#dedee8]"
          }`}>
            <div>
              <span className="text-[10px] font-bold text-[#718078] uppercase block">Item Terpilih (Stok Habis / Kendala)</span>
              <p className="font-black text-sm font-sans text-[#0b3d2e]">
                {selectedItem.qty}× {selectedItem.name_snapshot}
              </p>
              {selectedItem.note && (
                <span className="text-[10.5px] text-[#526159]">Catatan: {selectedItem.note}</span>
              )}
            </div>
            <span className="font-black text-sm text-[#0b3d2e]">
              {formatRupiah(currentItemSubtotal)}
            </span>
          </div>
        )}

        {/* Action Mode Tabs */}
        <div className="grid grid-cols-3 gap-1.5 p-1 rounded-2xl bg-[#f0f4f2] text-[11px] font-bold">
          {selectedItem && (
            <button
              type="button"
              onClick={() => setMode("replace")}
              className={`py-2 px-2.5 rounded-xl transition-all flex items-center justify-center gap-1.5 ${
                mode === "replace"
                  ? isMochi
                    ? "bg-[#0b3d2e] text-[#c8f53a] shadow-xs"
                    : "bg-[#232331] text-white shadow-xs"
                  : "text-[#526159] hover:text-[#0b3d2e]"
              }`}
            >
              <RefreshCw size={12} />
              <span>Ganti Menu</span>
            </button>
          )}

          {selectedItem && (
            <button
              type="button"
              onClick={() => {
                setMode("refund_item");
                setRefundAmount(currentItemSubtotal);
              }}
              className={`py-2 px-2.5 rounded-xl transition-all flex items-center justify-center gap-1.5 ${
                mode === "refund_item"
                  ? "bg-rose-700 text-white shadow-xs"
                  : "text-[#526159] hover:text-rose-700"
              }`}
            >
              <RotateCcw size={12} />
              <span>Refund Item</span>
            </button>
          )}

          <button
            type="button"
            onClick={() => {
              setMode("refund_order");
              setRefundAmount(Number(order.total));
            }}
            className={`py-2 px-2.5 rounded-xl transition-all flex items-center justify-center gap-1.5 ${
              !selectedItem ? "col-span-3" : ""
            } ${
              mode === "refund_order"
                ? "bg-rose-800 text-white shadow-xs"
                : "text-[#526159] hover:text-rose-800"
            }`}
          >
            <Ban size={12} />
            <span>Refund / Void Order #{order.order_no}</span>
          </button>
        </div>

        {/* MODE 1: GANTI MENU (SUBSTITUTION) */}
        {mode === "replace" && selectedItem && (
          <div className="space-y-3 font-sans text-xs">
            <div className="space-y-1 font-mono">
              <label className="block font-bold text-[#0b3d2e]">
                Pilih Menu Pengganti Yang Masih Ada Stok:
              </label>
              <select
                value={replacementMenuItemId}
                onChange={(e) => setReplacementMenuItemId(e.target.value)}
                className="w-full rounded-xl border-2 border-[#0b3d2e] p-2.5 font-bold text-xs bg-white text-[#0b3d2e]"
              >
                <option value="">-- Pilih Menu Tersedia --</option>
                {availableMenuItems.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name} — {formatRupiah(Number(m.price))}
                  </option>
                ))}
              </select>
            </div>

            {selectedReplacement && (
              <div className="rounded-2xl border border-emerald-300 bg-emerald-50/80 p-3 space-y-2 font-mono text-xs">
                <div className="flex justify-between items-center text-[11px]">
                  <span className="text-emerald-950">Harga Item Pengganti:</span>
                  <span className="font-bold text-emerald-950">
                    {selectedItem.qty}× @{formatRupiah(Number(selectedReplacement.price))} = {formatRupiah(replacementSubtotal)}
                  </span>
                </div>
                <div className="flex justify-between items-center text-[11px] pt-1 border-t border-emerald-200">
                  <span className="font-bold text-emerald-950">Selisih Tagihan:</span>
                  <span className={`font-black ${priceDifference > 0 ? "text-amber-800" : priceDifference < 0 ? "text-rose-700" : "text-emerald-800"}`}>
                    {priceDifference > 0
                      ? `+${formatRupiah(priceDifference)} (Tamu Tambah Bayar)`
                      : priceDifference < 0
                      ? `-${formatRupiah(Math.abs(priceDifference))} (Kembalikan ke Tamu)`
                      : "Rp 0 (Harga Sama Pas)"}
                  </span>
                </div>
              </div>
            )}

            {/*
              Nota yang sudah lunas dan harganya berubah wajib diputuskan di
              sini. Sebelum ini selisihnya cuma ditampilkan sebagai keterangan,
              lalu total notanya diam-diam berubah tanpa ada yang menagih
              maupun mengembalikan — dan selisihnya baru ketahuan saat tutup
              shift, tanpa ada yang ingat penyebabnya.
            */}
            {needsSettlement && (
              <div className="space-y-2 rounded-2xl border-2 border-amber-400 bg-amber-50 p-3 font-mono text-xs">
                <p className="font-black text-amber-900">
                  Nota ini sudah dibayar. Selisihnya mau diapakan?
                </p>
                <div className="space-y-1.5">
                  {(priceDifference > 0
                    ? ([
                        ["collect", `Tagih tambahan ${formatRupiah(priceDifference)} ke pelanggan`],
                        ["waive", `Toko yang menanggung ${formatRupiah(priceDifference)}`],
                      ] as const)
                    : ([
                        ["refund", `Kembalikan ${formatRupiah(Math.abs(priceDifference))} ke pelanggan`],
                        ["waive", `Tidak dikembalikan, jadi keuntungan toko`],
                      ] as const)
                  ).map(([nilai, label]) => (
                    <label
                      key={nilai}
                      className={`flex cursor-pointer items-start gap-2 rounded-xl border-2 p-2.5 transition ${
                        settlement === nilai
                          ? "border-amber-700 bg-white"
                          : "border-amber-200 bg-white/60 hover:border-amber-500"
                      }`}
                    >
                      <input
                        type="radio"
                        name="penyelesaian-selisih"
                        checked={settlement === nilai}
                        onChange={() => setSettlement(nilai)}
                        className="mt-0.5 accent-amber-700"
                      />
                      <span className="font-bold text-amber-950">{label}</span>
                    </label>
                  ))}
                </div>
                <p className="text-[10.5px] leading-relaxed text-amber-800">
                  Yang ditagih akan membuat nota ini kembali berstatus belum
                  lunas sampai pelanggan membayar sisanya. Yang dikembalikan
                  tercatat sebagai refund dan ikut terhitung saat tutup shift.
                </p>
              </div>
            )}

            <div className="space-y-1 font-mono">
              <label className="block font-bold text-[#0b3d2e]">Catatan Tambahan untuk Dapur (Opsional):</label>
              <input
                type="text"
                value={replaceNote}
                onChange={(e) => setReplaceNote(e.target.value)}
                placeholder="Contoh: Pengganti Mochi Cokelat yang habis"
                className="w-full rounded-xl border border-[#ccd9d3] p-2 text-xs font-bold text-[#0b3d2e]"
              />
            </div>

            <button
              type="button"
              disabled={busy || !replacementMenuItemId}
              onClick={handleExecuteReplace}
              className={`w-full flex items-center justify-center gap-2 rounded-2xl py-3 font-mono text-xs font-black transition-all shadow-sm ${
                isMochi
                  ? "bg-[#c8f53a] hover:bg-[#d9ff57] text-[#073829]"
                  : "bg-[#16a34a] hover:bg-[#15803d] text-white"
              } disabled:opacity-50`}
            >
              {busy ? <Loader2 size={14} className="animate-spin" /> : <Check size={15} strokeWidth={2.8} />}
              <span>Konfirmasi Ganti Menu & Perbarui Tagihan ✓</span>
            </button>
          </div>
        )}

        {/* MODE 2 & 3: REFUND ITEM ATAU FULL ORDER */}
        {(mode === "refund_item" || mode === "refund_order") && (
          <div className="space-y-3 font-sans text-xs">
            <div className="space-y-1 font-mono">
              <label className="block font-bold text-rose-900">
                Alasan Pengembalian Dana / Void (Wajib Dipilih):
              </label>
              <select
                value={refundReasonKey}
                onChange={(e) => setRefundReasonKey(e.target.value as RefundReasonCode)}
                className="w-full rounded-xl border-2 border-rose-300 p-2.5 font-bold text-xs bg-white text-rose-950"
              >
                {REFUND_REASONS.map((r) => (
                  <option key={r.key} value={r.key}>
                    {REASON_ICON[r.key]} {r.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1 font-mono">
              <label className="block font-bold text-gray-700">
                Penjelasan / Catatan Khusus (Opsional):
              </label>
              <input
                type="text"
                value={refundReasonCustom}
                onChange={(e) => setRefundReasonCustom(e.target.value)}
                placeholder="Misal: Pelanggan buru-buru, saudara owner, pesanan batal..."
                className="w-full rounded-xl border border-[#ccd9d3] p-2 text-xs font-bold text-[#0b3d2e]"
              />
            </div>

            <div className="grid grid-cols-2 gap-2 font-mono">
              <div className="space-y-1">
                <label className="block font-bold text-gray-700">Nominal Refund (Rp):</label>
                <input
                  type="number"
                  min={1}
                  max={Number(order.total)}
                  step={1}
                  value={refundAmount}
                  onChange={(e) => setRefundAmount(Number(e.target.value))}
                  className="w-full rounded-xl border-2 border-rose-400 p-2 text-xs font-black text-rose-900"
                />
              </div>

              <div className="space-y-1">
                <label className="block font-bold text-gray-700">Metode Pengembalian:</label>
                <div className="flex gap-1">
                  <button
                    type="button"
                    onClick={() => setRefundPaymentMethod("cash")}
                    className={`flex-1 py-2 rounded-xl border text-[11px] font-bold ${
                      refundPaymentMethod === "cash"
                        ? "bg-[#0b3d2e] text-white border-[#0b3d2e]"
                        : "bg-white text-gray-600 border-gray-300"
                    }`}
                  >
                    💵 Tunai
                  </button>
                  <button
                    type="button"
                    onClick={() => setRefundPaymentMethod("qris")}
                    className={`flex-1 py-2 rounded-xl border text-[11px] font-bold ${
                      refundPaymentMethod === "qris"
                        ? "bg-[#0b3d2e] text-white border-[#0b3d2e]"
                        : "bg-white text-gray-600 border-gray-300"
                    }`}
                  >
                    📱 QRIS / Trf
                  </button>
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-rose-200 bg-rose-50 p-3 font-mono text-[11px] text-rose-900 space-y-1">
              <p className="font-bold">⚠️ Efek Akuntansi & Laporan:</p>
              <p>
                Nominal <strong>{formatRupiah(refundAmount)}</strong> akan otomatis dipotong dari Total Penjualan Bersih (Net Sales) shift kasir hari ini.
              </p>
            </div>

            <button
              type="button"
              disabled={busy || refundAmount <= 0}
              onClick={handleExecuteRefund}
              className="w-full flex items-center justify-center gap-2 rounded-2xl py-3 font-mono text-xs font-black bg-rose-700 hover:bg-rose-800 text-white transition-all shadow-sm disabled:opacity-50"
            >
              {busy ? <Loader2 size={14} className="animate-spin" /> : <RotateCcw size={15} strokeWidth={2.8} />}
              <span>Eksekusi Refund {formatRupiah(refundAmount)} & Catat di Laporan ✓</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
