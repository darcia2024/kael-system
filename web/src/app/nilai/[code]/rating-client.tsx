"use client";

import { useMemo, useState } from "react";
import { Star, Check, Copy, ExternalLink, Loader2 } from "lucide-react";

import { BusinessMark } from "@/components/business-mark";
import { brandSurface, normalizeBrandColor } from "@/lib/branding";
import { submitCardFeedbackAction, attachCardFeedbackAction } from "@/lib/actions";
import {
  FEEDBACK_REASONS,
  PRAISE_TEMPLATES,
  RATING_TINGGI,
  type FeedbackReasonCode,
} from "@/lib/types";

/**
 * Tiga layar dalam satu halaman.
 *
 * `bintang`  - lima bintang, belum ada yang dipilih.
 * `puji`     - rating >= RATING_TINGGI. Menyiapkan kalimat lalu ke Google.
 * `keluhan`  - rating di bawahnya. Tidak pernah menyebut Google sama sekali.
 * `selesai`  - ucapan terima kasih, tetap di KAEL.
 *
 * Percabangannya terjadi SETELAH rating tersimpan, bukan sebelumnya. Bintang
 * satu yang orangnya lalu menutup ponsel tetap terhitung: pemilik kafe justru
 * paling butuh tahu yang seperti itu.
 */
type Layar = "bintang" | "puji" | "keluhan" | "selesai";

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
  const [pujianDipilih, setPujianDipilih] = useState<string[]>([]);
  const [alasan, setAlasan] = useState<FeedbackReasonCode | null>(null);
  const [komentar, setKomentar] = useState("");
  const [tulisSendiri, setTulisSendiri] = useState("");
  const [urlGoogle, setUrlGoogle] = useState<string | null>(null);
  const [idPenilaian, setIdPenilaian] = useState<string | null>(null);
  const [sedangKirim, setSedangKirim] = useState(false);
  const [galat, setGalat] = useState<string | null>(null);
  const [tersalin, setTersalin] = useState(false);

  /**
   * Kalimat yang akan disalin: gabungan template yang dicentang, lalu tambahan
   * yang diketik sendiri. Pelanggan boleh tidak memilih apa pun dan langsung
   * mengetik; boleh juga sebaliknya.
   */
  const kalimatPujian = useMemo(() => {
    const dariTemplate = PRAISE_TEMPLATES.filter((p) => pujianDipilih.includes(p.key)).map(
      (p) => p.text,
    );
    return [...dariTemplate, tulisSendiri.trim()].filter(Boolean).join(" ");
  }, [pujianDipilih, tulisSendiri]);

  /** Menyimpan rating, lalu memutuskan layar berikutnya dari jawaban server. */
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
    if (nilai >= RATING_TINGGI) {
      setUrlGoogle(res.data.reviewUrl);
      setLayar("puji");
      return;
    }
    setLayar("keluhan");
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

  /**
   * Kalimatnya disalin ke papan klip lalu Google dibuka. Google tidak menerima
   * teks ulasan lewat URL — tidak ada parameter untuk itu — jadi menempelkan
   * sendiri adalah satu-satunya cara, dan pelanggan tetap bisa mengubahnya di
   * sana sebelum mengirim.
   */
  const salinLaluBuka = async () => {
    if (kalimatPujian) {
      try {
        await navigator.clipboard.writeText(kalimatPujian);
        setTersalin(true);
      } catch {
        // Peramban yang menolak papan klip tidak menghentikan langkahnya:
        // kalimatnya tetap terlihat di layar dan bisa disalin manual.
        setTersalin(false);
      }
    }
    if (urlGoogle) window.location.href = urlGoogle;
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

        {layar === "puji" && (
          <div className="mt-8">
            <p className="text-center text-sm font-bold text-[#66667a]">
              Makasih banyak! Mau bantu tulis di Google?
            </p>

            <p className="mt-5 font-mono text-[11px] font-bold uppercase text-[#7b7b8e]">
              Pilih yang paling pas
            </p>
            <div className="mt-2 flex flex-wrap gap-2">
              {PRAISE_TEMPLATES.map((p) => {
                const aktif = pujianDipilih.includes(p.key);
                return (
                  <button
                    key={p.key}
                    type="button"
                    onClick={() =>
                      setPujianDipilih((prev) =>
                        aktif ? prev.filter((k) => k !== p.key) : [...prev, p.key],
                      )
                    }
                    style={aktif ? tombolUtama : undefined}
                    className={`inline-flex items-center gap-1.5 rounded-full border-2 border-[#232331] px-3 py-1.5 text-xs font-bold ${
                      aktif ? "" : "bg-white"
                    }`}
                  >
                    {aktif && <Check size={13} />}
                    {p.label}
                  </button>
                );
              })}
            </div>

            <label className="mt-5 block font-mono text-[11px] font-bold uppercase text-[#7b7b8e]">
              Atau tulis sendiri
              <textarea
                value={tulisSendiri}
                onChange={(e) => setTulisSendiri(e.target.value.slice(0, 400))}
                rows={3}
                placeholder="Tambahkan kalimatmu sendiri (opsional)"
                className="mt-1.5 w-full rounded-xl border-2 border-[#232331] p-3 font-sans text-sm font-normal normal-case text-[#232331] focus:outline-none"
              />
            </label>

            {kalimatPujian && (
              <div className="mt-4 rounded-xl border border-[#dedee8] bg-white p-3">
                <p className="font-mono text-[10px] font-bold uppercase text-[#7b7b8e]">
                  Yang akan disalin
                </p>
                <p className="mt-1 break-words text-sm">{kalimatPujian}</p>
              </div>
            )}

            {urlGoogle ? (
              <button
                type="button"
                onClick={salinLaluBuka}
                style={tombolUtama}
                className="mt-5 flex min-h-12 w-full items-center justify-center gap-2 rounded-xl border-2 border-[#232331] px-4 py-3 text-sm font-black"
              >
                {tersalin ? <Check size={17} /> : <Copy size={17} />}
                {kalimatPujian ? "Salin & buka Google" : "Buka Google Review"}
                <ExternalLink size={15} />
              </button>
            ) : (
              /*
               * Kartu yang belum diisi alamat ulasannya tidak boleh membuat
               * halaman ini buntu. Ratingnya sudah tersimpan; yang hilang cuma
               * langkah terakhirnya, dan itu urusan pemilik kafe, bukan
               * pelanggan yang sedang memegang ponselnya.
               */
              <p className="mt-5 rounded-xl border border-[#dedee8] bg-white p-4 text-center text-sm">
                Penilaianmu sudah tersimpan. Makasih banyak!
              </p>
            )}

            <p className="mt-3 text-center text-[11px] leading-relaxed text-[#7b7b8e]">
              Kalimat di atas cuma bahan. Kamu tetap bisa mengubah atau
              menghapusnya di halaman Google sebelum mengirim.
            </p>
          </div>
        )}

        {layar === "keluhan" && (
          <div className="mt-8">
            <p className="text-center text-sm font-bold text-[#66667a]">
              Maaf ya. Boleh cerita apa yang kurang?
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
                placeholder="Yang kamu tulis di sini cuma dibaca pemilik tempat ini."
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

            <p className="mt-3 text-center text-[11px] leading-relaxed text-[#7b7b8e]">
              Tidak dipublikasikan ke mana pun.
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
            <p className="mt-4 text-lg font-black">Makasih udah cerita.</p>
            <p className="mt-2 text-sm leading-relaxed text-[#66667a]">
              Masukanmu langsung masuk ke dashboard pemilik {businessName}.
            </p>
          </div>
        )}

        <p className="mt-10 text-center text-xs text-[#7b7b8e]">Powered by KAEL Review</p>
      </section>
    </main>
  );
}
