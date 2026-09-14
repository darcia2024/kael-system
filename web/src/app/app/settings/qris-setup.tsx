"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Upload, Check, AlertTriangle, Trash2, Loader2, ClipboardPaste, ShieldCheck } from "lucide-react";

import QrCode from "@/components/qr-code";
import { readQris, buildDynamicQris, type QrisInfo } from "@/lib/qris-engine";
import { saveQrisAction, clearQrisAction } from "@/lib/actions";

/**
 * Pemasangan QRIS toko. HANYA di halaman pengaturan pemilik usaha.
 *
 * Sebelumnya formulir ini menempel di modal pembayaran kasir. Itu keliru:
 * layar kasir dipakai karyawan, dan yang menentukan ke rekening siapa uang
 * pelanggan mengalir bukan wewenang karyawan. Kasir yang bisa mengganti QRIS
 * tinggal memasang QRIS pribadinya, dan setiap pembayaran masuk ke kantongnya
 * sementara sistem tetap mencatat transaksinya lunas.
 *
 * Penjaganya tidak cuma di sini: saveQrisAction memanggil requireOwner, jadi
 * memanggil action-nya langsung lewat POST pun tetap ditolak.
 */

interface BarcodeDetectorLike {
  new (opts: { formats: string[] }): {
    detect(source: ImageBitmap): Promise<{ rawValue: string }[]>;
  };
  getSupportedFormats?: () => Promise<string[]>;
}

/** Membaca QR dari berkas gambar memakai BarcodeDetector bawaan peramban. */
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

export default function QrisSetup({
  payload,
  merchantName,
  merchantCity,
  nmid,
}: {
  payload: string | null;
  merchantName: string | null;
  merchantCity: string | null;
  nmid: string | null;
}) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);

  const [busy, setBusy] = useState(false);
  const [galat, setGalat] = useState<string | null>(null);
  const [tempel, setTempel] = useState("");
  const [modeTempel, setModeTempel] = useState(false);
  const [pratinjau, setPratinjau] = useState<QrisInfo | null>(null);
  const [gantiMode, setGantiMode] = useState(false);

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

  /** Contoh QR bernominal, supaya pemilik usaha melihat hasilnya sebelum dipakai. */
  const contoh = payload ? buildDynamicQris(payload, 47_000) : null;

  // -----------------------------------------------------------------------
  // Sudah terpasang
  // -----------------------------------------------------------------------
  if (payload && !gantiMode) {
    return (
      <div className="space-y-4">
        <div className="flex items-start gap-2.5 rounded-2xl border-2 border-[#16a34a] bg-[#dcfce7] px-4 py-3 text-[#14532d]">
          <ShieldCheck size={18} className="shrink-0 mt-0.5" />
          <div className="font-mono text-xs">
            <p className="font-bold">QRIS toko sudah terpasang.</p>
            <p className="mt-0.5">
              Nominal belanja terisi otomatis di layar kasir. Pelanggan tinggal memindai.
            </p>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-[auto_1fr] sm:items-start">
          {contoh?.ok && (
            <div className="justify-self-center rounded-2xl border border-[#d8e3de] bg-white p-2.5 shadow-xs">
              <QrCode value={contoh.payload} size={150} label="Contoh QRIS bernominal" />
              <p className="mt-1.5 text-center font-mono text-[10px] text-[#527867]">
                contoh Rp 47.000
              </p>
            </div>
          )}

          <div className="rounded-2xl border border-[#d8e3de] bg-[#fbfdfc] px-4 py-3 font-mono text-xs space-y-1">
            <div className="flex justify-between gap-3">
              <span className="text-[#527867]">Merchant</span>
              <span className="font-bold text-right break-words">{merchantName || "—"}</span>
            </div>
            {merchantCity && (
              <div className="flex justify-between gap-3">
                <span className="text-[#527867]">Kota</span>
                <span className="text-right">{merchantCity}</span>
              </div>
            )}
            {nmid && (
              <div className="flex justify-between gap-3">
                <span className="text-[#527867]">NMID</span>
                <span className="text-[10.5px] text-right break-all">{nmid}</span>
              </div>
            )}
          </div>
        </div>

        {galat && (
          <div className="flex items-start gap-2 rounded-xl border border-[#c0392b] bg-[#fdeeec] px-3 py-2 text-[#c0392b]">
            <AlertTriangle size={13} className="shrink-0 mt-0.5" />
            <p className="font-mono text-[11px] font-bold">{galat}</p>
          </div>
        )}

        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setGantiMode(true)}
            disabled={busy}
            className="flex-1 rounded-xl border border-[#d8e3de] bg-white px-3 py-2.5 font-mono text-xs font-extrabold shadow-xs disabled:opacity-50"
          >
            Ganti QRIS
          </button>
          <button
            type="button"
            onClick={hapus}
            disabled={busy}
            className="inline-flex items-center gap-1.5 rounded-xl border border-[#d8e3de] bg-white px-3 py-2.5 font-mono text-xs font-bold text-[#c0392b] hover:border-[#c0392b] disabled:opacity-50"
          >
            <Trash2 size={13} />
            Hapus
          </button>
        </div>
      </div>
    );
  }

  // -----------------------------------------------------------------------
  // Formulir pemasangan
  // -----------------------------------------------------------------------
  return (
    <div className="space-y-3">
      <p className="font-mono text-xs text-[#527867]">
        Unggah QRIS statis yang biasa dipajang di meja kasir. Setelah terpasang, nominal
        belanja terisi otomatis dan pelanggan tidak perlu mengetik angka.
      </p>

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
            className="w-full inline-flex items-center justify-center gap-2 rounded-2xl bg-[#0b3d2e] hover:bg-[#0e4837] px-4 py-3.5 font-mono text-sm font-bold text-[#c8f53a] shadow-xs disabled:opacity-50 transition-colors"
          >
            {busy ? <Loader2 size={15} className="animate-spin" /> : <Upload size={15} />}
            {busy ? "Membaca QR..." : "Unggah gambar QRIS"}
          </button>

          {!modeTempel ? (
            <button
              type="button"
              onClick={() => setModeTempel(true)}
              className="w-full inline-flex items-center justify-center gap-1.5 font-mono text-[11px] font-bold text-[#167052] underline"
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
                className="w-full rounded-xl border border-[#c9c9d4] bg-white px-2.5 py-2 font-mono text-[11px] break-all"
              />
              <button
                type="button"
                onClick={() => periksaPayload(tempel)}
                disabled={busy || tempel.trim().length < 20}
                className="w-full rounded-xl border border-[#d8e3de] bg-white px-3 py-2 font-mono text-xs font-bold disabled:opacity-50"
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
        <div className="space-y-2.5">
          <div className="rounded-2xl border border-[#d8e3de] bg-white p-4 space-y-1.5">
            <p className="font-mono text-[11px] font-bold text-[#527867]">
              Pastikan ini QRIS toko kamu:
            </p>
            <p className="font-black text-base break-words">
              {pratinjau.merchantName || "(nama tidak terbaca)"}
            </p>
            {pratinjau.merchantCity && (
              <p className="font-mono text-[11px] text-[#527867]">{pratinjau.merchantCity}</p>
            )}
            {pratinjau.nmid && (
              <p className="font-mono text-[10.5px] text-[#527867] break-all">
                NMID {pratinjau.nmid}
              </p>
            )}
          </div>

          <div className="flex gap-2">
            <button
              type="button"
              onClick={simpan}
              disabled={busy}
              className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-2xl border border-[#d8e3de] bg-[#d9ff57] px-3 py-3 font-mono text-xs font-extrabold shadow-xs disabled:opacity-50"
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
              className="rounded-2xl border border-[#c9c9d4] px-4 py-3 font-mono text-xs font-bold text-[#527867] disabled:opacity-50"
            >
              Batal
            </button>
          </div>
        </div>
      )}

      {galat && (
        <div className="flex items-start gap-2 rounded-xl border border-[#c0392b] bg-[#fdeeec] px-3 py-2 text-[#c0392b]">
          <AlertTriangle size={13} className="shrink-0 mt-0.5" />
          <p className="font-mono text-[11px] font-bold">{galat}</p>
        </div>
      )}

      {gantiMode && !pratinjau && (
        <button
          type="button"
          onClick={() => {
            setGantiMode(false);
            setGalat(null);
          }}
          className="w-full font-mono text-[11px] font-bold text-[#527867] underline"
        >
          Kembali
        </button>
      )}
    </div>
  );
}
