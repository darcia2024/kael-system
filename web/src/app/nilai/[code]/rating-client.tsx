"use client";

import { useState } from "react";
import { Star, Check, ExternalLink, Loader2, MessageSquare } from "lucide-react";

import { BusinessMark } from "@/components/business-mark";
import { brandSurface, normalizeBrandColor } from "@/lib/branding";
import { submitCardFeedbackAction, attachCardFeedbackAction } from "@/lib/actions";
import { FEEDBACK_REASONS, type FeedbackReasonCode } from "@/lib/types";

/**
 * Empat layar dalam satu halaman.
 *
 * `bintang`  - lima bintang, belum ada yang dipilih.
 * `apresiasi` - apresiasi untuk rating 4-5, dengan pilihan Google yang netral.
 * `keluhan`  - masukan privat yang dibaca pemilik usaha.
 * `selesai`  - ucapan terima kasih dan pilihan Google setelah masukan terkirim.
 */
type Layar = "bintang" | "apresiasi" | "keluhan" | "selesai";

export default function RatingClient({
  cardCode,
  businessName,
  logoUrl,
  brandColor,
}: {
  cardCode: string;
  businessName: string;
  logoUrl: string | null;
  brandColor: string | null;
}) {
  const warna = normalizeBrandColor(brandColor);
  const tombolUtama = brandSurface(warna);

  const [layar, setLayar] = useState<Layar>("bintang");
  const [bintang, setBintang] = useState<number | null>(null);
  const [hoverBintang, setHoverBintang] = useState<number | null>(null);
  const [alasan, setAlasan] = useState<FeedbackReasonCode | null>(null);
  const [komentar, setKomentar] = useState("");
  const [urlGoogle, setUrlGoogle] = useState<string | null>(null);
  const [idPenilaian, setIdPenilaian] = useState<string | null>(null);
  const [sedangKirim, setSedangKirim] = useState(false);
  const [galat, setGalat] = useState<string | null>(null);
  const bukaGoogle = () => {
    if (urlGoogle) window.open(urlGoogle, "_blank", "noopener,noreferrer");
  };

  /** Menyimpan rating sebelum pelanggan memilih langkah berikutnya. */
  const pilihBintang = async (nilai: number) => {
    if (sedangKirim) return;
    setBintang(nilai);
    setGalat(null);
    setSedangKirim(true);

    const res = await submitCardFeedbackAction({ cardCode, rating: nilai });
    setSedangKirim(false);

    if (!res.ok) {
      setGalat(res.error);
      setBintang(null);
      return;
    }

    setIdPenilaian(res.data.feedbackId);
    setUrlGoogle(res.data.reviewUrl);
    setLayar(nilai <= 3 ? "keluhan" : "apresiasi");
  };

  /** Melengkapi baris yang sudah tersimpan, bukan menambah baris baru. */
  const kirimKeluhan = async () => {
    if (!idPenilaian) return;
    if (!alasan && !komentar.trim()) {
      setGalat("Pilih bagian yang kurang atau tulis ceritanya.");
      return;
    }
    setSedangKirim(true);
    setGalat(null);
    const res = await attachCardFeedbackAction({
      feedbackId: idPenilaian,
      reasonCode: alasan ?? undefined,
      comment: komentar.trim() || undefined,
    });
    setSedangKirim(false);
    if (!res.ok) {
      setGalat(res.error);
      return;
    }
    setLayar("selesai");
  };

  return (
    <main className="min-h-screen bg-[#f7f6fc] px-4 py-8 text-[#232331]">
      <section className="mx-auto max-w-md">
        <header className="text-center">
          <div className="flex justify-center">
            <BusinessMark name={businessName} logoUrl={logoUrl} brandColor={warna} size="lg" />
          </div>
          <h1 className="mt-4 break-words text-2xl font-black">{businessName}</h1>
        </header>

        {galat && (
          <p className="mt-6 rounded-xl border-2 border-[#c2410c] bg-[#fff7ed] p-3 text-center text-sm font-bold text-[#c2410c]">
            {galat}
          </p>
        )}

        {layar === "bintang" && (
          <div className="mt-8 text-center">
            <p className="text-sm font-bold text-[#66667a]">
              Gimana pengalaman kamu hari ini?
            </p>
            <div className="mt-5 flex justify-center gap-1.5">
              {[1, 2, 3, 4, 5].map((n) => (
                <button
                  key={n}
                  type="button"
                  disabled={sedangKirim}
                  onClick={() => pilihBintang(n)}
                  onMouseEnter={() => setHoverBintang(n)}
                  onMouseLeave={() => setHoverBintang(null)}
                  aria-label={`Beri ${n} bintang`}
                  className="rounded-lg p-1.5 focus-visible:outline-2 focus-visible:outline-offset-2 disabled:opacity-50"
                >
                  <Star
                    size={40}
                    className={
                      (hoverBintang ?? bintang ?? 0) >= n
                        ? "fill-[#facc15] text-[#facc15]"
                        : "text-[#dedee8]"
                    }
                  />
                </button>
              ))}
            </div>
            {sedangKirim && (
              <p className="mt-4 flex items-center justify-center gap-2 text-xs text-[#66667a]">
                <Loader2 size={14} className="animate-spin" /> Menyimpan...
              </p>
            )}
          </div>
        )}

        {layar === "apresiasi" && (
          <div className="mt-8 text-center">
            <p className="text-center text-sm font-bold text-[#66667a]">
              Makasih banyak. Senang pengalamanmu di {businessName} menyenangkan.
            </p>
            <p className="mt-2 text-sm leading-relaxed text-[#66667a]">
              Kamu boleh membagikan pengalamanmu di Google.
            </p>

            {urlGoogle ? (
              <button
                type="button"
                onClick={bukaGoogle}
                style={tombolUtama}
                className="mt-6 flex min-h-12 w-full items-center justify-center gap-2 rounded-xl border-2 border-[#232331] px-4 py-3 text-sm font-black"
              >
                <ExternalLink size={17} /> Tulis ulasan di Google
              </button>
            ) : (
              <p className="mt-3 rounded-xl border border-[#dedee8] bg-white p-4 text-sm">
                Tautan Google untuk tempat ini belum tersedia.
              </p>
            )}
            <button
              type="button"
              onClick={() => setLayar("keluhan")}
              className="mt-3 flex min-h-12 w-full items-center justify-center gap-2 rounded-xl border-2 border-[#232331] bg-white px-4 py-3 text-sm font-black"
            >
              <MessageSquare size={17} /> Kirim masukan ke pemilik
            </button>
            <p className="mt-4 text-[11px] leading-relaxed text-[#7b7b8e]">
              Ulasan Google bersifat publik. Masukan ke pemilik hanya masuk ke dashboard usaha ini.
            </p>
          </div>
        )}

        {layar === "keluhan" && (
          <div className="mt-8">
            <p className="text-center text-sm font-bold text-[#66667a]">
              Wah, kayaknya ada yang belum sesuai.
            </p>
            <p className="mt-2 text-center text-sm leading-relaxed text-[#66667a]">
              Ceritain ke kami supaya tim {businessName} bisa memperbaikinya.
            </p>

            <p className="mt-5 font-mono text-[11px] font-bold uppercase text-[#7b7b8e]">
              Bagian mana
            </p>
            <div className="mt-2 flex flex-wrap gap-2">
              {FEEDBACK_REASONS.map((r) => {
                const aktif = alasan === r.key;
                return (
                  <button
                    key={r.key}
                    type="button"
                    onClick={() => setAlasan(aktif ? null : r.key)}
                    style={aktif ? tombolUtama : undefined}
                    className={`inline-flex items-center gap-1.5 rounded-full border-2 border-[#232331] px-3 py-1.5 text-xs font-bold ${
                      aktif ? "" : "bg-white"
                    }`}
                  >
                    {aktif && <Check size={13} />}
                    {r.label}
                  </button>
                );
              })}
            </div>

            <label className="mt-5 block font-mono text-[11px] font-bold uppercase text-[#7b7b8e]">
              Ceritanya
              <textarea
                value={komentar}
                onChange={(e) => setKomentar(e.target.value.slice(0, 500))}
                rows={4}
                placeholder="Masukan ini hanya masuk ke dashboard pemilik tempat ini."
                className="mt-1.5 w-full rounded-xl border-2 border-[#232331] p-3 font-sans text-sm font-normal normal-case text-[#232331] focus:outline-none"
              />
            </label>

            <button
              type="button"
              onClick={kirimKeluhan}
              disabled={sedangKirim}
              style={tombolUtama}
              className="mt-5 flex min-h-12 w-full items-center justify-center gap-2 rounded-xl border-2 border-[#232331] px-4 py-3 text-sm font-black disabled:opacity-60"
            >
              {sedangKirim && <Loader2 size={16} className="animate-spin" />}
              Kirim ke pemilik
            </button>

            {urlGoogle && (
              <button
                type="button"
                onClick={bukaGoogle}
                className="mt-3 flex min-h-12 w-full items-center justify-center gap-2 rounded-xl border-2 border-[#232331] bg-white px-4 py-3 text-sm font-black"
              >
                <ExternalLink size={17} /> Bagikan pengalaman di Google
              </button>
            )}
            <p className="mt-3 text-center text-[11px] leading-relaxed text-[#7b7b8e]">
              Masukan privat hanya masuk ke dashboard pemilik. Ulasan Google bersifat publik.
            </p>
          </div>
        )}

        {layar === "selesai" && (
          <div className="mt-10 text-center">
            <div
              className="mx-auto flex h-14 w-14 items-center justify-center rounded-full border-2 border-[#232331]"
              style={tombolUtama}
            >
              <Check size={26} />
            </div>
            <p className="mt-4 text-lg font-black">Terima kasih sudah kasih masukan.</p>
            <p className="mt-2 text-sm leading-relaxed text-[#66667a]">
              Tim {businessName} akan menggunakan masukanmu untuk memperbaiki layanan.
            </p>
            {urlGoogle && (
              <button
                type="button"
                onClick={bukaGoogle}
                style={tombolUtama}
                className="mt-6 flex min-h-12 w-full items-center justify-center gap-2 rounded-xl border-2 border-[#232331] px-4 py-3 text-sm font-black"
              >
                <ExternalLink size={17} /> Bagikan pengalaman di Google
              </button>
            )}
            <p className="mt-3 text-[11px] leading-relaxed text-[#7b7b8e]">
              Ulasan Google bersifat publik dan sepenuhnya pilihanmu.
            </p>
          </div>
        )}

        <p className="mt-10 text-center text-xs text-[#7b7b8e]">Powered by KAEL Review</p>
      </section>
    </main>
  );
}
