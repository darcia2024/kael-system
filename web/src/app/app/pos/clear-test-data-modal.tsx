"use client";

import { useState } from "react";
import {
  X,
  Trash2,
  AlertTriangle,
  Receipt,
  MessageSquare,
  Clock,
  Sparkles,
  CheckCircle2,
  Loader2,
  ShieldAlert,
} from "lucide-react";
import { clearTestDataAction } from "@/lib/actions";

interface ClearTestDataModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  isMochi?: boolean;
}

type CleanScope = "all_orders" | "all_feedback" | "all_shifts" | "everything";

export default function ClearTestDataModal({
  isOpen,
  onClose,
  onSuccess,
  isMochi = false,
}: ClearTestDataModalProps) {
  const [selectedScope, setSelectedScope] = useState<CleanScope>("all_orders");
  const [confirmationInput, setConfirmationInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [resultMessage, setResultMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleExecute = async () => {
    setError(null);
    setResultMessage(null);
    setLoading(true);

    try {
      const res = await clearTestDataAction(selectedScope);
      setLoading(false);
      if (!res.ok) {
        setError(res.error || "Gagal menghapus data testing.");
        return;
      }

      setResultMessage(
        `Berhasil menghapus data testing (${res.data.deletedCount} data dibersihkan).`
      );
      setTimeout(() => {
        onSuccess();
        onClose();
      }, 1500);
    } catch (err: any) {
      setLoading(false);
      setError(err?.message || "Terjadi kendala saat menghapus data.");
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-3 sm:p-5 backdrop-blur-xs animate-in fade-in-50">
      <div className="w-full max-w-lg rounded-3xl bg-white text-[#1c2d26] shadow-2xl overflow-hidden flex flex-col my-auto border border-[#d8e3de] animate-in zoom-in-95">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-rose-200 bg-[#b91c1c] px-5 py-4 text-white">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/20 text-white shadow-xs">
              <Trash2 size={19} />
            </div>
            <div>
              <h2 className="text-sm sm:text-base font-black tracking-tight">
                Pembersih Data Laporan &amp; Testing
              </h2>
              <p className="text-[10.5px] text-rose-100">
                Fitur khusus Owner untuk menghapus transaksi dan ulasan testing
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Tutup"
            className="flex h-8 w-8 items-center justify-center rounded-full bg-white/10 text-white/80 hover:bg-white/20 hover:text-white transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        <div className="p-5 sm:p-6 space-y-5 max-h-[80vh] overflow-y-auto font-sans text-xs">
          {/* Warning Banner */}
          <div className="rounded-2xl border border-amber-300 bg-amber-50 p-3.5 text-amber-900 flex items-start gap-3">
            <ShieldAlert size={18} className="text-amber-600 shrink-0 mt-0.5" />
            <div className="space-y-0.5">
              <h4 className="font-black text-xs text-amber-950">
                Perhatian: Tindakan Ini Tidak Dapat Dibatalkan
              </h4>
              <p className="text-[11px] text-amber-800 leading-relaxed">
                Gunakan fitur ini hanya untuk membersihkan data pesanan simulasi atau transaksi uji coba agar laporan omzet dan rating toko Anda akurat.
              </p>
            </div>
          </div>

          {/* Scope Selector */}
          <div className="space-y-2">
            <label className="font-bold text-xs text-[#0b3d2e] uppercase font-mono tracking-wider">
              Pilih Data yang Ingin Dihapus:
            </label>

            <div className="grid gap-2">
              {/* Option 1: All Orders */}
              <label
                className={`flex items-start gap-3 rounded-2xl border p-3.5 cursor-pointer transition-all ${
                  selectedScope === "all_orders"
                    ? "border-rose-500 bg-rose-50/50 shadow-xs ring-1 ring-rose-500"
                    : "border-[#d8e3de] bg-white hover:bg-[#f9fbf9]"
                }`}
              >
                <input
                  type="radio"
                  name="cleanScope"
                  checked={selectedScope === "all_orders"}
                  onChange={() => setSelectedScope("all_orders")}
                  className="mt-1 text-rose-600 focus:ring-rose-500"
                />
                <div className="space-y-0.5">
                  <div className="flex items-center gap-1.5 font-black text-xs text-[#1c2d26]">
                    <Receipt size={14} className="text-rose-600" />
                    <span>Hapus Seluruh Pesanan &amp; Transaksi Testing</span>
                  </div>
                  <p className="text-[11px] text-[#556b62]">
                    Mereset riwayat transaksi kasir, item pesanan, dan laporan omzet/penjualan menjadi Rp 0.
                  </p>
                </div>
              </label>

              {/* Option 2: All Feedback */}
              <label
                className={`flex items-start gap-3 rounded-2xl border p-3.5 cursor-pointer transition-all ${
                  selectedScope === "all_feedback"
                    ? "border-rose-500 bg-rose-50/50 shadow-xs ring-1 ring-rose-500"
                    : "border-[#d8e3de] bg-white hover:bg-[#f9fbf9]"
                }`}
              >
                <input
                  type="radio"
                  name="cleanScope"
                  checked={selectedScope === "all_feedback"}
                  onChange={() => setSelectedScope("all_feedback")}
                  className="mt-1 text-rose-600 focus:ring-rose-500"
                />
                <div className="space-y-0.5">
                  <div className="flex items-center gap-1.5 font-black text-xs text-[#1c2d26]">
                    <MessageSquare size={14} className="text-rose-600" />
                    <span>Hapus Seluruh Review &amp; Keluhan Testing</span>
                  </div>
                  <p className="text-[11px] text-[#556b62]">
                    Membersihkan daftar feedback pelanggan dan mereset audit skor rating toko.
                  </p>
                </div>
              </label>

              {/* Option 3: All Shifts */}
              <label
                className={`flex items-start gap-3 rounded-2xl border p-3.5 cursor-pointer transition-all ${
                  selectedScope === "all_shifts"
                    ? "border-rose-500 bg-rose-50/50 shadow-xs ring-1 ring-rose-500"
                    : "border-[#d8e3de] bg-white hover:bg-[#f9fbf9]"
                }`}
              >
                <input
                  type="radio"
                  name="cleanScope"
                  checked={selectedScope === "all_shifts"}
                  onChange={() => setSelectedScope("all_shifts")}
                  className="mt-1 text-rose-600 focus:ring-rose-500"
                />
                <div className="space-y-0.5">
                  <div className="flex items-center gap-1.5 font-black text-xs text-[#1c2d26]">
                    <Clock size={14} className="text-rose-600" />
                    <span>Hapus Riwayat Shift Kasir Testing</span>
                  </div>
                  <p className="text-[11px] text-[#556b62]">
                    Mereset riwayat pembukaan/penutupan laci kas dan audit selisih kasir testing.
                  </p>
                </div>
              </label>

              {/* Option 4: Full Clean */}
              <label
                className={`flex items-start gap-3 rounded-2xl border p-3.5 cursor-pointer transition-all ${
                  selectedScope === "everything"
                    ? "border-rose-600 bg-rose-100/60 shadow-xs ring-2 ring-rose-600"
                    : "border-[#d8e3de] bg-white hover:bg-[#f9fbf9]"
                }`}
              >
                <input
                  type="radio"
                  name="cleanScope"
                  checked={selectedScope === "everything"}
                  onChange={() => setSelectedScope("everything")}
                  className="mt-1 text-rose-600 focus:ring-rose-500"
                />
                <div className="space-y-0.5">
                  <div className="flex items-center gap-1.5 font-black text-xs text-rose-900">
                    <Sparkles size={14} className="text-rose-700" />
                    <span>Reset Seluruh Data Testing (Transaksi, Feedback &amp; Shift)</span>
                  </div>
                  <p className="text-[11px] text-rose-800">
                    Pembersihan total semua data laporan simulasi agar toko siap beroperasi penuh secara bersih.
                  </p>
                </div>
              </label>
            </div>
          </div>

          {/* Feedback messages */}
          {error && (
            <div className="rounded-xl border border-rose-300 bg-rose-50 p-3 text-xs font-bold text-rose-700">
              {error}
            </div>
          )}

          {resultMessage && (
            <div className="rounded-xl border border-emerald-300 bg-[#edf8f3] p-3 text-xs font-bold text-[#167052] flex items-center gap-2">
              <CheckCircle2 size={16} />
              <span>{resultMessage}</span>
            </div>
          )}

          {/* Action buttons */}
          <div className="flex items-center justify-end gap-2 pt-3 border-t border-[#edf3f0]">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="rounded-xl border border-[#d8e3de] bg-white px-4 py-2.5 text-xs font-bold text-[#556b62] hover:bg-[#edf3f0] transition-colors"
            >
              Batal
            </button>
            <button
              type="button"
              onClick={handleExecute}
              disabled={loading}
              className="inline-flex items-center gap-1.5 rounded-xl bg-[#b91c1c] px-5 py-2.5 text-xs font-black text-white hover:bg-[#991b1b] active:scale-95 shadow-md transition-all disabled:opacity-50"
            >
              {loading ? (
                <>
                  <Loader2 size={14} className="animate-spin" />
                  <span>Sedang Menghapus...</span>
                </>
              ) : (
                <>
                  <Trash2 size={14} />
                  <span>Konfirmasi Hapus Data</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
