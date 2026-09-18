"use client";

import { useEffect, useMemo, useState } from "react";
import { Check, Copy, ExternalLink, Loader2, MessageSquare, X } from "lucide-react";

import QrCode from "@/components/qr-code";
import { buatTautanFakturAction } from "@/lib/actions";
import { teksFaktur as rakitTeks, tautanWaFaktur } from "@/lib/faktur-wa";
import { formatRupiah } from "@/lib/formatters";
import { normalizePhoneNumber } from "@/lib/loyalty-engine";
import type { FakturPesanan } from "@/lib/types";

/**
 * Faktur WhatsApp untuk pelanggan, lewat QR yang dipindai kasir.
 *
 * Alurnya sengaja begini, dan bukan karena keterbatasan:
 *
 *   layar kasir menampilkan QR  →  kasir memindainya dengan HP-nya sendiri
 *   →  WhatsApp terbuka, nomor tujuan dan isi fakturnya sudah terisi
 *   →  kasir menekan kirim
 *
 * Yang ditekan kirim tetap manusia, dari WhatsApp biasa milik toko. Itu
 * disengaja: mendaftarkan nomor ke WhatsApp Cloud API akan MENGUNCI nomor itu
 * dari aplikasi WhatsApp biasa, padahal nomor itulah yang dipakai melayani
 * pelanggan sehari-hari. Menukarnya demi pengiriman otomatis tidak sepadan.
 *
 * QR-nya juga menyelesaikan satu hal yang sering luput: mesin kasir biasanya
 * komputer atau tablet yang TIDAK memegang WhatsApp toko. QR ini yang
 * memindahkan fakturnya ke HP yang memang memegangnya, tanpa mengetik ulang.
 *
 * QR-NYA TIDAK MEMBAWA ISI FAKTUR
 * Versi pertama menjejalkan seluruh tautan wa.me ke dalam QR. Pesanan tiga
 * item sudah jadi QR versi 19 — 93x93 modul di kotak 200 piksel, dua piksel
 * per modul — dan tiap menu tambahan membuatnya makin rapat. Kamera HP tidak
 * membacanya andal dari layar laptop, jadi fiturnya gagal persis di depan
 * pelanggan. Sekarang QR cuma membawa kaels.site/f/<token>, dan server yang
 * merakit tautan wa.me saat token itu dibuka.
 */
export default function PosInvoiceQrModal({
  faktur,
  onClose,
}: {
  faktur: FakturPesanan;
  onClose: () => void;
}) {
  const [disalin, setDisalin] = useState(false);

  /**
   * Nomornya bisa diketik atau dikoreksi di sini.
   *
   * Tanpa ini, pesanan tanpa nomor berakhir buntu: tidak ada lagi layar untuk
   * mengisinya sesudah transaksi selesai. Pelanggan yang bukan member dan
   * bilang "kirim ke WA saya ya" adalah kasus paling biasa di kasir, bukan
   * pengecualian.
   *
   * Yang diketik tidak menjadi data member. Nomor itu disimpan bersama tautan
   * faktur yang kedaluwarsa dalam 15 menit, dan tidak ke tempat lain;
   * mendaftarkannya sebagai member butuh persetujuan orangnya sendiri.
   */
  const [nomorKetik, setNomorKetik] = useState(faktur.penerima.nomor ?? "");
  const nomor = nomorKetik.trim() ? normalizePhoneNumber(nomorKetik) : "";
  const nomorSah = !!nomor && nomor.length >= 10;

  const [tautanQr, setTautanQr] = useState<string | null>(null);
  const [menit, setMenit] = useState<number | null>(null);
  const [galatQr, setGalatQr] = useState<string | null>(null);

  /**
   * Tautan pendek diminta ulang setiap nomornya berubah, dengan jeda supaya
   * tidak ada satu permintaan per tombol yang ditekan. Hasil permintaan lama
   * yang datang terlambat dibuang — tanpa itu, QR bisa menampilkan tautan
   * untuk nomor yang sudah dihapus kasir.
   */
  useEffect(() => {
    setTautanQr(null);
    setGalatQr(null);
    if (!nomorSah) return;

    let batal = false;
    const jeda = setTimeout(async () => {
      const res = await buatTautanFakturAction(faktur.orderId, nomor);
      if (batal) return;
      if (!res.ok) {
        setGalatQr(res.error);
        return;
      }
      setTautanQr(res.data.url);
      setMenit(res.data.berlakuMenit);
    }, 400);

    return () => {
      batal = true;
      clearTimeout(jeda);
    };
  }, [faktur.orderId, nomor, nomorSah]);

  const teks = useMemo(() => rakitTeks(faktur), [faktur]);
  // Untuk kasir yang membuka KAEL dari HP yang sama: tidak perlu memindai
  // apa pun, jadi tautannya langsung ke wa.me.
  const tautanLangsung = nomorSah ? tautanWaFaktur(nomor, faktur) : null;

  const salin = async () => {
    try {
      await navigator.clipboard.writeText(teks);
      setDisalin(true);
      setTimeout(() => setDisalin(false), 2000);
    } catch {
      // Papan klip bisa diblokir peramban. Teksnya tetap terlihat di layar
      // untuk disalin manual, jadi tidak perlu memunculkan galat.
    }
  };

  return (
    <div className="fixed inset-0 z-[65] flex items-end justify-center bg-[#07281e]/60 p-0 backdrop-blur-xs sm:items-center sm:p-4">
      <div className="flex max-h-[92dvh] w-full max-w-md flex-col overflow-hidden rounded-t-3xl bg-white shadow-2xl sm:rounded-3xl">
        <div className="flex items-start justify-between gap-3 border-b border-[#d8e3de] bg-[#f8faf9] px-4 py-3.5">
          <div className="min-w-0">
            <h2 className="flex items-center gap-1.5 text-base font-black text-[#0b3d2e]">
              <MessageSquare size={17} /> Faktur ke WhatsApp
            </h2>
            <p className="mt-0.5 font-mono text-[11px] text-[#527867]">
              #{faktur.orderNo} · {formatRupiah(faktur.total)}
              {faktur.ongkir > 0 ? ` (termasuk ongkir ${formatRupiah(faktur.ongkir)})` : ""}
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

        <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-4 py-4">
          <label className="block">
            <span className="mb-1 block font-mono text-xs font-bold text-[#0b3d2e]">
              Nomor WhatsApp pelanggan
            </span>
            <input
              type="tel"
              inputMode="numeric"
              value={nomorKetik}
              onChange={(e) => setNomorKetik(e.target.value)}
              placeholder="0812xxxxxxxx"
              autoFocus={!faktur.penerima.nomor}
              className="h-11 w-full rounded-xl border border-[#d8e3de] bg-white px-3 font-mono text-sm font-bold text-[#0b3d2e] focus:border-[#167052] focus:outline-none"
            />
            {!faktur.penerima.nomor && (
              <span className="mt-1 block text-[10.5px] leading-relaxed text-[#527867]">
                Pesanan ini belum punya nomor. Tanya pelanggannya, lalu ketik di sini.
              </span>
            )}
          </label>

          {!nomorSah ? (
            <p className="rounded-xl border border-amber-300 bg-amber-50 px-3 py-2.5 text-[11.5px] font-bold leading-relaxed text-amber-900">
              {nomorKetik.trim()
                ? "Nomornya belum lengkap. Contoh: 081234567890"
                : "Isi nomornya dulu, QR-nya muncul otomatis."}
            </p>
          ) : (
            <>
              <div className="rounded-2xl border border-[#d8e3de] bg-white p-3 text-center">
                <div className="mx-auto flex h-[200px] w-[200px] items-center justify-center">
                  {tautanQr ? (
                    <QrCode value={tautanQr} size={200} className="mx-auto" />
                  ) : galatQr ? (
                    <p className="text-[11px] font-bold leading-relaxed text-[#c2410c]">{galatQr}</p>
                  ) : (
                    <Loader2 size={22} className="animate-spin text-[#527867]" />
                  )}
                </div>
                <p className="mt-2 text-[11.5px] font-bold leading-relaxed text-[#0b3d2e]">
                  Pindai pakai HP yang ada WhatsApp toko
                </p>
                <p className="mt-0.5 text-[10.5px] leading-relaxed text-[#527867]">
                  WhatsApp akan terbuka dengan nomor dan isi fakturnya sudah terisi.
                  Kasir tinggal menekan kirim.
                  {menit ? ` QR berlaku ${menit} menit.` : ""}
                </p>
              </div>

              <div className="rounded-xl bg-[#f4f7f5] px-3 py-2 text-center">
                <p className="font-mono text-[10.5px] text-[#527867]">Dikirim ke</p>
                <p className="font-mono text-sm font-black text-[#0b3d2e]">+{nomor}</p>
              </div>
            </>
          )}

          <div>
            <p className="mb-1 font-mono text-xs font-bold text-[#0b3d2e]">Isi fakturnya</p>
            <pre className="max-h-48 overflow-y-auto whitespace-pre-wrap rounded-xl border border-[#d8e3de] bg-[#fbfdfc] p-3 font-mono text-[10.5px] leading-relaxed text-[#2f4b3f]">
              {teks}
            </pre>
          </div>
        </div>

        <div className="space-y-2 border-t border-[#d8e3de] bg-[#f8faf9] px-4 py-3">
          {tautanLangsung && (
            <a
              href={tautanLangsung}
              target="_blank"
              rel="noopener noreferrer"
              className="flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-[#0b3d2e] text-xs font-black text-[#c8f53a]"
            >
              <ExternalLink size={15} />
              <span>Buka WhatsApp di perangkat ini</span>
            </a>
          )}
          <button
            type="button"
            onClick={() => void salin()}
            className="flex h-10 w-full items-center justify-center gap-2 rounded-xl border border-[#d8e3de] bg-white text-[11px] font-black text-[#0b3d2e]"
          >
            {disalin ? <Check size={14} /> : <Copy size={14} />}
            <span>{disalin ? "Tersalin" : "Salin teks fakturnya"}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
