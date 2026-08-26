"use client";

import { useState } from "react";
import Link from "next/link";
import { 
  ShieldCheck, 
  Plus, 
  Printer, 
  Copy, 
  Check, 
  QrCode, 
  Nfc, 
  Search, 
  ArrowLeft, 
  Sparkles, 
  ExternalLink,
  Layers,
  KeyRound,
  Download,
  AlertCircle
} from "lucide-react";
import type { Card } from "@/lib/types";
import { issueCardsAction, logout } from "@/lib/actions";
import { formatCardCodeDisplay } from "@/lib/card-code";
import { formatBusinessDateTime } from "@/lib/formatters";

/** Batch yang baru diterbitkan. PIN hanya ada di memori halaman ini sekali,
 *  untuk dicetak; yang tersimpan di database cuma hash-nya. */
type IssuedBatch = { card_code: string; activation_pin: string }[];

export default function KaelAdminCardsPage({ initialCards }: { initialCards: Card[] }) {
  const [cards, setCards] = useState<Card[]>(initialCards);
  const [batchCount, setBatchCount] = useState<number>(5);
  const [batchType, setBatchType] = useState<"review" | "loyalty" | "attendance">("review");
  const [generatedBatchInfo, setGeneratedBatchInfo] = useState<IssuedBatch | null>(null);

  const [searchQuery, setSearchQuery] = useState("");
  const [filterStatus, setFilterStatus] = useState<"all" | "unactivated" | "active" | "suspended">("all");
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const handleGenerateBatch = async (e: React.FormEvent) => {
    e.preventDefault();
    const count = Number(batchCount);
    if (isNaN(count) || count < 1 || count > 50) {
      alert("Jumlah batch kartu antara 1 sampai 50.");
      return;
    }

    const result = await issueCardsAction(count, batchType);
    if (!result.ok) {
      alert(result.error);
      return;
    }
    setGeneratedBatchInfo(result.data);
    // Kartu baru belum punya business_id, jadi cukup ditambahkan di depan.
    setCards((prev) => [
      ...result.data.map((c) => ({
        id: c.card_code, card_code: c.card_code, business_id: null,
        type: batchType, status: "unactivated" as const,
        activation_pin_hash: null, destination_url: null, label: null,
        customer_id: null, tap_count: 0, last_tapped_at: null,
        created_at: new Date().toISOString(),
      })) as unknown as Card[],
      ...prev,
    ]);
  };

  const handleCopyText = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const filteredCards = cards.filter((card) => {
    const matchQuery = 
      card.card_code.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (card.label && card.label.toLowerCase().includes(searchQuery.toLowerCase()));
    const matchStatus = filterStatus === "all" || card.status === filterStatus;
    return matchQuery && matchStatus;
  });

  return (
    <div className="min-h-screen bg-[#f7f6fc] text-[#232331] font-sans flex flex-col">
      
      {/* Admin Top Header */}
      <header className="sticky top-0 z-30 border-b-2 border-[#232331] bg-white px-4 sm:px-8 py-3.5">
        <div className="mx-auto flex max-w-6xl items-center justify-between">
          <div className="flex items-center gap-3">
            <Link
              href="/admin/businesses"
              title="Panel pelanggan"
              className="flex h-9 w-9 items-center justify-center rounded-xl border border-[#232331] bg-[#fcfcfe] text-[#232331] shadow-ink-xs hover:bg-[#f0edff]"
            >
              <ArrowLeft size={16} />
            </Link>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="font-extrabold text-sm sm:text-base text-[#232331]">
                  KAEL Admin · Card Issuance &amp; Logistics
                </h1>
                <span className="rounded-md bg-[#232331] px-2 py-0.5 font-mono text-[9px] font-bold text-[#d9ff57]">
                  ADMIN ACCESS
                </span>
              </div>
              <span className="text-[11px] text-[#7b7b8e] font-mono block">
                Penerbitan Batch Kartu NFC &amp; Slip PIN Kemasan Cetak
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2 font-mono text-xs">
            <Link
              href="/admin/businesses"
              className="btn-tactile rounded-xl border-2 border-[#232331] bg-[#d9ff57] px-3 py-1.5 font-extrabold text-[#232331]"
            >
              Pelanggan
            </Link>
            {/* Sama seperti di portal: harus memanggil logout(), karena
                menautkan ke /app/login saja meninggalkan cookie sesi utuh. */}
            <button
              type="button"
              onClick={() => logout()}
              className="btn-tactile rounded-xl border border-[#232331] bg-white px-3 py-1.5 font-bold text-[#7b7b8e] hover:text-[#232331]"
            >
              Keluar Admin
            </button>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="flex-1 mx-auto w-full max-w-6xl p-4 sm:p-8 space-y-6">
        
        {/* PRIVACY RULE BANNER (Fondasi Bersama Bagian 3) */}
        <div className="rounded-3xl border-2 border-[#232331] bg-white p-5 sm:p-6 shadow-ink-md flex items-start gap-3.5">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-[#f0edff] text-[#7958d8] border border-[#7958d8]">
            <ShieldCheck size={20} />
          </div>
          <div className="space-y-1">
            <h3 className="font-extrabold text-sm text-[#232331]">
              Kepatuhan Batas Akses Tim KAEL (UU PDP No. 27/2022)
            </h3>
            <p className="text-xs text-[#7b7b8e] leading-relaxed">
              Peran <code>kael_admin</code> hanya memiliki wewenang untuk menerbitkan batch kartu fisik, memeriksa status aktivasi chip, dan membantu konfigurasi Place ID. Tim KAEL <strong>tidak memiliki akses melihat data pelanggan, nomor telepon, ataupun riwayat penjualan</strong> milik merchant.
            </p>
          </div>
        </div>

        {/* BATCH CARD GENERATOR FORM */}
        <div className="rounded-3xl border-2 border-[#232331] bg-white p-6 shadow-ink-md space-y-5">
          <div className="flex items-center justify-between border-b border-[#dedee8] pb-3">
            <div className="flex items-center gap-2">
              <Plus size={18} className="text-[#7958d8]" />
              <h3 className="font-extrabold text-base text-[#232331]">
                Terbitkan Batch Kartu NFC Baru
              </h3>
            </div>
            <span className="text-xs font-mono text-[#7b7b8e]">
              Generator Kode 8-Karakter Non-Ambigu
            </span>
          </div>

          <form onSubmit={handleGenerateBatch} className="grid sm:grid-cols-12 gap-3 items-end font-mono text-xs">
            <div className="sm:col-span-4 space-y-1">
              <label className="block font-bold text-[#232331]">
                Tipe Modul Kartu:
              </label>
              <select
                value={batchType}
                onChange={(e) => setBatchType(e.target.value as any)}
                className="w-full rounded-2xl border-2 border-[#232331] bg-white p-3 font-bold text-[#232331] focus:outline-none"
              >
                <option value="review">KAEL Review (Google Maps Form)</option>
                <option value="loyalty">KAEL Loyalty (Kartu Member)</option>
                <option value="attendance">KAEL HR (Absensi Karyawan)</option>
              </select>
            </div>

            <div className="sm:col-span-4 space-y-1">
              <label className="block font-bold text-[#232331]">
                Jumlah Kartu yang Dicetak (Batch):
              </label>
              <input
                type="number"
                min={1}
                max={50}
                value={batchCount}
                onChange={(e) => setBatchCount(Number(e.target.value))}
                className="w-full rounded-2xl border-2 border-[#232331] bg-white p-3 font-bold text-[#232331] focus:outline-none"
              />
            </div>

            <div className="sm:col-span-4">
              <button
                type="submit"
                className="btn-tactile flex w-full items-center justify-center gap-2 rounded-2xl border-2 border-[#232331] bg-[#7958d8] p-3 font-extrabold text-white shadow-ink-md"
              >
                <Sparkles size={16} />
                <span>Generate {batchCount} Kartu Baru</span>
              </button>
            </div>
          </form>

          {/* LATEST GENERATED BATCH PREVIEW (Print Slip) */}
          {generatedBatchInfo && (
            <div className="rounded-2xl border-2 border-[#7958d8] bg-[#f0edff] p-5 space-y-4 font-mono text-xs animate-in fade-in">
              <div className="flex items-center justify-between border-b border-[#7958d8]/30 pb-3">
                <div>
                  <span className="font-extrabold text-sm text-[#7958d8] block">
                    ✓ {generatedBatchInfo.length} KARTU BARU BERHASIL DITERBITKAN
                  </span>
                  <span className="text-[11px] text-[#7b7b8e]">
                    Cetak daftar PIN ini untuk disisipkan ke dalam amplop segel fisik pembeli.
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="btn-tactile inline-flex items-center gap-1.5 rounded-xl border border-[#232331] bg-white px-3 py-1.5 font-bold text-[#232331] shadow-ink-xs"
                >
                  <Printer size={14} />
                  <span>Cetak Lembar Slip</span>
                </button>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left bg-white rounded-xl border border-[#dedee8]">
                  <thead>
                    <tr className="border-b border-[#dedee8] text-[10px] text-[#7b7b8e] bg-[#fcfcfe]">
                      <th className="p-2.5">No</th>
                      <th className="p-2.5">Kode Kartu (Tercetak di Fisik)</th>
                      <th className="p-2.5">URL Chip NFC / QR</th>
                      <th className="p-2.5 font-bold text-[#7958d8]">PIN Aktivasi Kemasan</th>
                      <th className="p-2.5 text-right">Aksi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#dedee8]">
                    {generatedBatchInfo.map((card, idx) => {
                      const pin = card.activation_pin;
                      return (
                        <tr key={card.card_code}>
                          <td className="p-2.5 text-[#7b7b8e]">{idx + 1}</td>
                          <td className="p-2.5 font-extrabold text-[#232331]">
                            {formatCardCodeDisplay(card.card_code)}
                          </td>
                          <td className="p-2.5 font-bold">
                            <Link
                              href={`/r/${card.card_code}`}
                              target="_blank"
                              className="inline-flex items-center gap-1 text-[#16a34a] hover:underline"
                            >
                              <span>/r/{card.card_code}</span>
                              <ExternalLink size={12} />
                            </Link>
                          </td>
                          <td className="p-2.5 font-black text-sm text-[#7958d8] bg-[#f0edff]/50">
                            {pin}
                          </td>
                          <td className="p-2.5 text-right space-x-2">
                            <Link
                              href={`/activate/${card.card_code}`}
                              target="_blank"
                              className="text-[11px] font-bold text-[#16a34a] hover:underline"
                            >
                              Aktivasi ➔
                            </Link>
                            <button
                              type="button"
                              onClick={() => handleCopyText(`Card: ${card.card_code} | PIN: ${pin}`, card.card_code)}
                              className="text-[11px] font-bold text-[#7958d8] hover:underline"
                            >
                              {copiedId === card.card_code ? "Disalin ✓" : "Salin Info"}
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

        </div>

        {/* GLOBAL CARDS MASTER AUDIT LIST */}
        <div className="rounded-3xl border-2 border-[#232331] bg-white p-6 shadow-ink-md space-y-4 font-mono text-xs">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#dedee8] pb-4">
            <div>
              <h3 className="font-extrabold text-base text-[#232331] font-sans">
                Master Database Kartu Global ({cards.length} Total)
              </h3>
              <p className="text-xs text-[#7b7b8e] font-sans">
                Status seluruh kartu fisik di sirkulasi (teraktivasi, belum aktif di gudang, atau ditangguhkan).
              </p>
            </div>

            {/* Filter Pills */}
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Cari kode kartu..."
                className="rounded-xl border border-[#232331] px-2.5 py-1.5 text-xs font-bold text-[#232331] focus:outline-none"
              />
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value as any)}
                className="rounded-xl border border-[#232331] bg-white px-2.5 py-1.5 text-xs font-bold text-[#232331] focus:outline-none cursor-pointer"
              >
                <option value="all">Semua Status</option>
                <option value="unactivated">Belum Aktif</option>
                <option value="active">Aktif</option>
                <option value="suspended">Suspended</option>
              </select>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-[#dedee8] text-[10px] text-[#7b7b8e] uppercase">
                  <th className="py-2.5 px-3">Kode Kartu</th>
                  <th className="py-2.5 px-3">Tipe Modul</th>
                  <th className="py-2.5 px-3">Status Sirkulasi</th>
                  <th className="py-2.5 px-3">Merchant Terkait</th>
                  <th className="py-2.5 px-3">Total Tap</th>
                  <th className="py-2.5 px-3 text-right">Aktivasi Link</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#dedee8]">
                {filteredCards.map((c) => (
                  <tr key={c.id} className="hover:bg-[#fcfcfe]">
                    <td className="py-3 px-3 font-extrabold text-[#232331]">
                      {formatCardCodeDisplay(c.card_code)}
                    </td>
                    <td className="py-3 px-3">
                      <span className="font-bold text-[#7958d8] bg-[#f0edff] px-2 py-0.5 rounded">
                        {c.type.toUpperCase()}
                      </span>
                    </td>
                    <td className="py-3 px-3">
                      <span className={`inline-flex items-center gap-1 font-bold text-[10px] px-2 py-0.5 rounded-full border ${
                        c.status === "active"
                          ? "bg-[#dcfce7] text-[#16a34a] border-[#16a34a]"
                          : c.status === "suspended"
                          ? "bg-[#feebee] text-[#ef4444] border-[#ef4444]"
                          : "bg-[#fef3c7] text-[#d97706] border-[#d97706]"
                      }`}>
                        {c.status.toUpperCase()}
                      </span>
                    </td>
                    <td className="py-3 px-3 font-sans text-xs text-[#232331]">
                      {c.status === "unactivated" ? (
                        <span className="text-[#7b7b8e] font-mono">Belum Diaktivasi</span>
                      ) : (
                        <div className="space-y-0.5">
                          <span className="font-extrabold text-[#232331] block">
                            {c.business_name || "Merchant Mandiri"}
                          </span>
                          {c.label && (
                            <span className="text-[11px] text-[#7b7b8e] font-mono block">
                              📍 {c.label}
                            </span>
                          )}
                        </div>
                      )}
                    </td>
                    <td className="py-3 px-3 font-bold text-[#232331]">
                      {c.tap_count} Tap
                    </td>
                    <td className="py-3 px-3 text-right">
                      <Link
                        href={`/r/${c.card_code}`}
                        target="_blank"
                        className="inline-flex items-center gap-1 text-[11px] font-bold text-[#7958d8] hover:underline"
                      >
                        <span>Test /r/{c.card_code}</span>
                        <ExternalLink size={12} />
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

        </div>

      </main>

      <footer className="border-t border-[#dedee8] bg-white py-4 text-center text-xs font-mono text-[#7b7b8e]">
        KAEL Admin Panel · Standee &amp; Card Logistics Suite
      </footer>
    </div>
  );
}
