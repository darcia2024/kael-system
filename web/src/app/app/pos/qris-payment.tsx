"use client";

import { useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Upload, Check, AlertTriangle, Trash2, Loader2, ClipboardPaste } from "lucide-react";

import QrCode from "@/components/qr-code";
import { readQris, buildDynamicQris, type QrisInfo } from "@/lib/qris-engine";
import { saveQrisAction, clearQrisAction } from "@/lib/actions";
import { formatRupiah } from "@/lib/formatters";
import type { Business } from "@/lib/types";

/**
 * QRIS di layar kasir.
 *
 * Dua keadaan. Kalau QRIS toko sudah diunggah, kasir melihat QR yang nominalnya
 * sudah tertanam dan pelanggan tinggal memindai. Kalau belum, pemilik usaha bisa
 * mengunggahnya di tempat, dan karyawan diberi tahu untuk memakai QRIS cetak.
 *
 * Yang boleh mengunggah hanya pemilik usaha. Ini menentukan ke rekening siapa
 * uang pelanggan mengalir, dan itu bukan keputusan kasir yang sedang jaga shift.
 * Penjaganya ada di server juga, di saveQrisAction.
 */

/**
 * Membaca QR dari berkas gambar memakai BarcodeDetector bawaan peramban.
 *
 * Tersedia di Chrome dan peramban Android, yang mencakup hampir semua perangkat
 * kasir di Indonesia. Yang tidak punya jatuh ke penempelan manual, bukan ke
 * jalan buntu: pemasangan QRIS cuma terjadi sekali, jadi menempel teks sekali
 * jauh lebih baik daripada menambah pustaka pemindai ke setiap muatan halaman.
 */
async function bacaQrDariGambar(file: File): Promise<string | null> {
  const Detector = (globalThis as unknown as { BarcodeDetector?: BarcodeDetectorLike })
    .BarcodeDetector;
  if (!Detector) return null;

  try {
    const formats = await Detector.getSupportedFormats?.();
    if (formats && !formats.includes("qr_code")) return null;

    const detector = new Detector({ formats: ["qr_code"] });
    const bitmap = await createImageBitmap(file);
    const hasil = await detector.detect(bitmap);
    bitmap.close?.();
    return hasil?.[0]?.rawValue ?? null;
  } catch {
    return null;
  }
}

interface BarcodeDetectorLike {
  new (opts: { formats: string[] }): {
    detect(source: ImageBitmap): Promise<{ rawValue: string }[]>;
  };
  getSupportedFormats?: () => Promise<string[]>;
}

export default function QrisPayment({
  business,
  amount,
  isOwner,
}: {
  business: Business | null;
  amount: number;
  isOwner: boolean;
}) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);

  const [busy, setBusy] = useState(false);
  const [galat, setGalat] = useState<string | null>(null);
  const [tempel, setTempel] = useState("");
  const [modeTempel, setModeTempel] = useState(false);
  const [pratinjau, setPratinjau] = useState<QrisInfo | null>(null);
  const [gantiMode, setGantiMode] = useState(false);

  const tersimpan = business?.qris_payload ?? null;

  /**
   * QR bernominal dirakit ulang tiap nominalnya berubah, dan tidak pernah
   * disimpan: ini kode sekali pakai yang sudah basi begitu transaksi selesai.
   */
  const dinamis = useMemo(() => {
    if (!tersimpan) return null;
    const bulat = Math.round(amount);
    if (!Number.isFinite(bulat) || bulat <= 0) return null;
    return buildDynamicQris(tersimpan, bulat);
  }, [tersimpan, amount]);

  // -----------------------------------------------------------------------
  // Pengunggahan
  // -----------------------------------------------------------------------

  const periksaPayload = (raw: string) => {
    const hasil = readQris(raw);
    if (!hasil.ok) {
      setPratinjau(null);
      setGalat(hasil.error);
      return;
    }
    if (!hasil.info.isStatic) {
      setPratinjau(null);
      setGalat(
        "Ini QRIS dinamis sekali pakai, bukan QRIS statis toko. Pakai QRIS yang biasa dipajang di meja kasir.",
      );
      return;
    }
    setGalat(null);
    setPratinjau(hasil.info);
  };

  const pilihGambar = async (file: File | undefined) => {
    if (!file) return;
    setBusy(true);
    setGalat(null);
    setPratinjau(null);

    const raw = await bacaQrDariGambar(file);
    setBusy(false);

    if (!raw) {
      setModeTempel(true);
      setGalat(
        "QR tidak terbaca dari gambar itu. Coba foto yang lebih jelas, atau tempel kode QRIS-nya sebagai teks di bawah.",
      );
      return;
    }
    periksaPayload(raw);
  };

  const simpan = async () => {
    if (!pratinjau) return;
    setBusy(true);
    setGalat(null);
    const res = await saveQrisAction(pratinjau.payload);
    setBusy(false);

    if (!res.ok) {
      setGalat(res.error);
      return;
    }
    setPratinjau(null);
    setTempel("");
    setModeTempel(false);
    setGantiMode(false);
    router.refresh();
  };

  const hapus = async () => {
    setBusy(true);
    setGalat(null);
    const res = await clearQrisAction();
    setBusy(false);
    if (!res.ok) {
      setGalat(res.error);
      return;
    }
    setGantiMode(false);
    router.refresh();
  };

  // -----------------------------------------------------------------------
  // QRIS sudah terpasang: tampilkan QR bernominal
  // -----------------------------------------------------------------------

  if (tersimpan && !gantiMode) {
    return (
      <div className="rounded-2xl border border-[#dedee8] bg-[#fcfcfe] p-3 space-y-3 font-mono text-xs">
        {dinamis?.ok ? (
          <>
            <div className="flex flex-col items-center gap-2">
              <div className="rounded-2xl border-2 border-[#232331] bg-white p-2.5 shadow-ink-xs">
                <QrCode
                  value={dinamis.payload}
                  size={200}
                  label={`QRIS pembayaran ${formatRupiah(Math.round(amount))}`}
                />
              </div>
              <p className="text-center text-[11px] text-[#7b7b8e]">
                Pelanggan pindai QR ini. Nominalnya sudah terisi otomatis.
              </p>
            </div>

            <div className="rounded-xl border border-[#dedee8] bg-white px-3 py-2 space-y-0.5">
              <div className="flex items-center justify-between gap-2">
                <span className="text-[#7b7b8e]">Nominal</span>
                <span className="font-black text-sm text-[#232331]">
                  {formatRupiah(Math.round(amount))}
                </span>
              </div>
              <div className="flex items-center justify-between gap-2">
                <span className="text-[#7b7b8e]">Masuk ke</span>
                <span className="font-bold text-[#232331] truncate max-w-[60%] text-right">
                  {business?.qris_merchant_name || "—"}
                </span>
              </div>
              {business?.qris_nmid && (
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[#7b7b8e]">NMID</span>
                  <span className="text-[10.5px] text-[#7b7b8e]">{business.qris_nmid}</span>
                </div>
              )}
            </div>
          </>
        ) : (
          <div className="flex items-start gap-2 rounded-xl border border-[#e5b800] bg-[#fff8e1] px-3 py-2 text-[#8a6d00]">
            <AlertTriangle size={14} className="shrink-0 mt-0.5" />
            <p className="text-[11px] font-bold">
              {dinamis?.ok === false
                ? dinamis.error
                : "Nominal belum bisa dijadikan QR. Pakai QRIS cetak dulu."}
            </p>
          </div>
        )}

        {isOwner && (
          <div className="flex gap-2 border-t border-[#dedee8] pt-2">
            <button
              type="button"
              onClick={() => setGantiMode(true)}
              disabled={busy}
              className="flex-1 rounded-lg border border-[#dedee8] bg-white px-2 py-1.5 text-[11px] font-bold text-[#7b7b8e] hover:border-[#232331] disabled:opacity-50"
            >
              Ganti QRIS
            </button>
            <button
              type="button"
              onClick={hapus}
              disabled={busy}
              className="inline-flex items-center gap-1 rounded-lg border border-[#dedee8] bg-white px-2 py-1.5 text-[11px] font-bold text-[#c0392b] hover:border-[#c0392b] disabled:opacity-50"
            >
              <Trash2 size={12} />
              Hapus
            </button>
          </div>
        )}
      </div>
    );
  }

  // -----------------------------------------------------------------------
  // Belum terpasang, dan yang membuka bukan pemilik usaha
  // -----------------------------------------------------------------------

  if (!isOwner) {
    return (
      <div className="rounded-2xl border border-[#dedee8] bg-[#fcfcfe] p-3 font-mono text-xs space-y-1.5">
        <p className="font-bold text-[#232331]">Pakai QRIS cetak di meja.</p>
        <p className="text-[11px] text-[#7b7b8e]">
          Pelanggan mengetik sendiri nominal {formatRupiah(Math.round(amount))}. Minta pemilik usaha
          mengunggah QRIS toko supaya nominalnya terisi otomatis.
        </p>
      </div>
    );
  }

  // -----------------------------------------------------------------------
  // Pemilik usaha: formulir pemasangan
  // -----------------------------------------------------------------------

  return (
    <div className="rounded-2xl border border-[#dedee8] bg-[#fcfcfe] p-3 space-y-2.5 font-mono text-xs">
      <div>
        <p className="font-bold text-[#232331]">
          {gantiMode ? "Ganti QRIS toko" : "Pasang QRIS toko"}
        </p>
        <p className="text-[11px] text-[#7b7b8e] mt-0.5">
          Unggah QRIS statis yang biasa dipajang di meja. Setelah terpasang, nominal belanja terisi
          otomatis dan pelanggan tidak perlu mengetik angka.
        </p>
      </div>

      {!pratinjau && (
        <>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              void pilihGambar(e.target.files?.[0]);
              e.target.value = "";
            }}
          />
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            disabled={busy}
            className="btn-tactile w-full inline-flex items-center justify-center gap-2 rounded-xl border-2 border-[#232331] bg-[#d9ff57] px-3 py-2.5 font-extrabold shadow-ink-xs disabled:opacity-50"
          >
            {busy ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}
            {busy ? "Membaca QR..." : "Unggah gambar QRIS"}
          </button>

          {!modeTempel ? (
            <button
              type="button"
              onClick={() => setModeTempel(true)}
              className="w-full inline-flex items-center justify-center gap-1.5 text-[11px] font-bold text-[#7958d8] underline"
            >
              <ClipboardPaste size={12} />
              Atau tempel kode QRIS sebagai teks
            </button>
          ) : (
            <div className="space-y-1.5">
              <textarea
                value={tempel}
                onChange={(e) => setTempel(e.target.value)}
                placeholder="Tempel kode QRIS di sini (diawali 00020101...)"
                rows={3}
                className="w-full rounded-xl border border-[#c9c9d4] bg-white px-2.5 py-2 text-[11px] break-all"
              />
              <button
                type="button"
                onClick={() => periksaPayload(tempel)}
                disabled={busy || tempel.trim().length < 20}
                className="w-full rounded-xl border-2 border-[#232331] bg-white px-3 py-2 font-bold disabled:opacity-50"
              >
                Periksa kode
              </button>
            </div>
          )}
        </>
      )}

      {/*
        Konfirmasi sebelum simpan. Pemilik usaha WAJIB melihat nama merchantnya
        lebih dulu: kalau yang terunggah QRIS toko sebelah, setiap pembayaran
        akan masuk ke rekening orang lain dan tidak ada satu pun layar
        setelahnya yang akan menyadarinya.
      */}
      {pratinjau && (
        <div className="space-y-2">
          <div className="rounded-xl border-2 border-[#232331] bg-white p-3 space-y-1.5">
            <p className="text-[11px] font-bold text-[#7b7b8e]">Pastikan ini QRIS toko kamu:</p>
            <p className="font-black text-sm text-[#232331] break-words">
              {pratinjau.merchantName || "(nama tidak terbaca)"}
            </p>
            {pratinjau.merchantCity && (
              <p className="text-[11px] text-[#7b7b8e]">{pratinjau.merchantCity}</p>
            )}
            {pratinjau.nmid && (
              <p className="text-[10.5px] text-[#7b7b8e]">NMID {pratinjau.nmid}</p>
            )}
          </div>

          <div className="flex gap-2">
            <button
              type="button"
              onClick={simpan}
              disabled={busy}
              className="btn-tactile flex-1 inline-flex items-center justify-center gap-1.5 rounded-xl border-2 border-[#232331] bg-[#d9ff57] px-3 py-2.5 font-extrabold shadow-ink-xs disabled:opacity-50"
            >
              {busy ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />}
              Benar, simpan
            </button>
            <button
              type="button"
              onClick={() => {
                setPratinjau(null);
                setTempel("");
              }}
              disabled={busy}
              className="rounded-xl border border-[#c9c9d4] px-3 py-2.5 font-bold text-[#7b7b8e] disabled:opacity-50"
            >
              Batal
            </button>
          </div>
        </div>
      )}

      {galat && (
        <div className="flex items-start gap-2 rounded-xl border border-[#c0392b] bg-[#fdeeec] px-3 py-2 text-[#c0392b]">
          <AlertTriangle size={13} className="shrink-0 mt-0.5" />
          <p className="text-[11px] font-bold">{galat}</p>
        </div>
      )}

      {gantiMode && !pratinjau && (
        <button
          type="button"
          onClick={() => {
            setGantiMode(false);
            setGalat(null);
          }}
          className="w-full text-[11px] font-bold text-[#7b7b8e] underline"
        >
          Kembali
        </button>
      )}
    </div>
  );
}
