"use client";

import { useState } from "react";
import { Check, Loader2, Phone, MessageSquare, MapPin, ExternalLink, Sparkles } from "lucide-react";
import { saveBusinessContactSettingsAction } from "@/lib/actions-pos-settings";

export default function DeliveryContactSetup({
  initialPhone,
  initialAddress,
  businessName,
}: {
  initialPhone?: string | null;
  initialAddress?: string | null;
  businessName: string;
}) {
  const [phone, setPhone] = useState(initialPhone || "");
  const [address, setAddress] = useState(initialAddress || "");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [isSuccess, setIsSuccess] = useState(false);

  // Bersihkan format nomor untuk link wa.me
  const cleanDigits = phone.replace(/\D/g, "");
  const waNumber = cleanDigits.startsWith("0")
    ? "62" + cleanDigits.slice(1)
    : cleanDigits.startsWith("62")
      ? cleanDigits
      : cleanDigits
        ? "62" + cleanDigits
        : "";

  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setMessage(null);
    setIsSuccess(false);

    const result = await saveBusinessContactSettingsAction(phone, address);
    setBusy(false);

    if (result.ok) {
      setIsSuccess(true);
      setMessage("Nomor WhatsApp delivery dan alamat usaha berhasil disimpan!");
      setTimeout(() => setMessage(null), 4000);
    } else {
      setIsSuccess(false);
      setMessage(result.error || "Gagal menyimpan kontak.");
    }
  };

  return (
    <form onSubmit={save} className="space-y-4">
      {/* Penjelasan Fitur */}
      <div className="rounded-2xl border border-emerald-200/80 bg-[#f4faf7] p-3.5 space-y-1.5 font-sans">
        <div className="flex items-center gap-1.5 text-xs font-black text-[#0b3d2e]">
          <Sparkles size={14} className="text-[#15803d]" />
          <span>Fungsi Nomor WhatsApp Resmi Toko:</span>
        </div>
        <ul className="text-[11.5px] text-[#2c5243] space-y-1 list-disc list-inside font-medium leading-relaxed">
          <li>
            <strong>Panggil Pelayan &amp; Bantuan QR Meja:</strong> Tombol <em>"Panggil Pelayan / Bantuan"</em> di QR meja pelanggan akan langsung membuka WhatsApp ke nomor ini dengan format nomor meja otomatis.
          </li>
          <li>
            <strong>Pesan Delivery Member:</strong> Menjadi tujuan chat 1-klik saat member menekan tombol <em>"Pesan Delivery via WhatsApp"</em> di katalog menu.
          </li>
          <li>
            <strong>Konfirmasi QRIS Meja:</strong> Pelanggan meja dapat langsung mengirim bukti transfer QRIS ke nomor ini.
          </li>
          <li>
            <strong>Struk Digital &amp; CS:</strong> Tampil sebagai kontak bantuan resmi toko di struk digital.
          </li>
        </ul>
      </div>

      <div className="grid gap-3.5 sm:grid-cols-2">
        {/* Input Nomor WhatsApp */}
        <label className="block space-y-1.5">
          <span className="flex items-center gap-1.5 text-xs font-bold text-[#0b3d2e]">
            <Phone size={13} className="text-[#167052]" />
            <span>Nomor WhatsApp Delivery &amp; Toko</span>
          </span>
          <div className="relative">
            <input
              type="tel"
              placeholder="Contoh: 081234567890"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="w-full rounded-xl border border-[#d8e3de] bg-white px-3.5 py-2.5 text-sm font-medium text-[#18392f] placeholder:text-[#95a39c] outline-none focus:border-[#0b3d2e] focus:ring-1 focus:ring-[#0b3d2e] transition-all"
            />
          </div>
          <span className="block text-[10.5px] text-[#557064]">
            Bisa format <code>08xxxxxxxxxx</code> atau <code>628xxxxxxxxxx</code>
          </span>
        </label>

        {/* Input Alamat Toko */}
        <label className="block space-y-1.5">
          <span className="flex items-center gap-1.5 text-xs font-bold text-[#0b3d2e]">
            <MapPin size={13} className="text-[#167052]" />
            <span>Alamat / Lokasi Toko <span className="font-normal text-[#718078]">(opsional)</span></span>
          </span>
          <input
            type="text"
            placeholder="Contoh: Jl. Sudirman No. 12, Padang Panjang"
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            className="w-full rounded-xl border border-[#d8e3de] bg-white px-3.5 py-2.5 text-sm font-medium text-[#18392f] placeholder:text-[#95a39c] outline-none focus:border-[#0b3d2e] focus:ring-1 focus:ring-[#0b3d2e] transition-all"
          />
          <span className="block text-[10.5px] text-[#557064]">
            Ditampilkan di footer struk dan profil toko
          </span>
        </label>
      </div>

      {/* Live WhatsApp Test Button */}
      {waNumber && (
        <div className="flex items-center justify-between gap-3 rounded-xl border border-[#bde2d1] bg-[#eef8f3] px-3.5 py-2.5">
          <div className="flex items-center gap-2 min-w-0">
            <MessageSquare size={15} className="text-[#25d366] shrink-0" />
            <p className="text-xs font-semibold text-[#0b3d2e] truncate">
              Tautan WhatsApp: <span className="font-mono font-bold text-[#166534]">wa.me/{waNumber}</span>
            </p>
          </div>
          <a
            href={`https://wa.me/${waNumber}?text=${encodeURIComponent(
              `Halo ${businessName}, ini tes pesan WhatsApp dari Pengaturan Toko KAEL.`
            )}`}
            target="_blank"
            rel="noopener noreferrer"
            className="shrink-0 inline-flex items-center gap-1 text-[11px] font-black text-[#166534] bg-white hover:bg-emerald-50 px-2.5 py-1 rounded-lg border border-[#bde2d1] shadow-2xs transition-all active:scale-95"
          >
            <span>Uji Coba WhatsApp</span>
            <ExternalLink size={11} />
          </a>
        </div>
      )}

      {/* Pesan Sukses / Galat */}
      {message && (
        <div
          className={`rounded-xl p-3 text-xs font-bold transition-all ${
            isSuccess
              ? "bg-emerald-100 text-emerald-900 border border-emerald-300"
              : "bg-rose-100 text-rose-900 border border-rose-300"
          }`}
        >
          {message}
        </div>
      )}

      {/* Tombol Simpan */}
      <div className="pt-1">
        <button
          type="submit"
          disabled={busy}
          className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-[#0b3d2e] hover:bg-[#0e4837] px-5 text-xs sm:text-sm font-black text-[#c8f53a] shadow-sm disabled:opacity-50 transition-all active:scale-[0.98]"
        >
          {busy ? (
            <>
              <Loader2 size={15} className="animate-spin" />
              <span>Menyimpan...</span>
            </>
          ) : (
            <>
              <Check size={15} strokeWidth={2.5} />
              <span>Simpan Nomor Delivery &amp; Kontak</span>
            </>
          )}
        </button>
      </div>
    </form>
  );
}
