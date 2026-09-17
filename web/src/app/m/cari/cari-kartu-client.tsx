"use client";

import { useState } from "react";
import { MessageCircle, ShieldCheck, Loader2 } from "lucide-react";

import { requestMemberLinkAction } from "@/lib/actions";
import { BusinessMark } from "@/components/business-mark";

export default function CariKartuClient({
  storeCode,
  businessName,
  logoUrl,
  brandColor,
}: {
  storeCode: string;
  businessName: string | null;
  logoUrl: string | null;
  brandColor: string;
}) {
  const [telp, setTelp] = useState("");
  const [sedangKirim, setSedangKirim] = useState(false);
  const [galat, setGalat] = useState<string | null>(null);
  const [selesai, setSelesai] = useState<null | { perluDikirimStaf: boolean }>(null);

  const kirim = async (e: React.FormEvent) => {
    e.preventDefault();
    setGalat(null);
    setSedangKirim(true);
    try {
      const res = await requestMemberLinkAction(storeCode, telp);
      if (!res.ok) {
        setGalat(res.error);
        return;
      }
      setSelesai(res.data);
    } catch {
      setGalat("Permintaannya tidak bisa diproses. Coba lagi sebentar lagi.");
    } finally {
      setSedangKirim(false);
    }
  };

  if (!storeCode) {
    return (
      <main className="flex min-h-dvh items-center justify-center bg-[#f0f5f2] p-5 font-sans">
        <div className="w-full max-w-sm space-y-2 rounded-3xl border border-[#d8e3de] bg-white p-7 text-center">
          <h1 className="text-lg font-black text-[#0b3d2e]">Toko belum disebutkan</h1>
          <p className="text-sm leading-relaxed text-[#5b7a6e]">
            Buka halaman ini lewat tautan dari tokonya, atau tanyakan ke kasir.
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="flex min-h-dvh items-center justify-center bg-[#f0f5f2] p-5 font-sans">
      <div className="w-full max-w-sm space-y-5 rounded-3xl border border-[#d8e3de] bg-white p-7 shadow-[0_4px_24px_rgba(11,61,46,0.06)]">
        <header className="space-y-3 text-center">
          <div className="flex justify-center">
            <BusinessMark
              name={businessName ?? storeCode}
              logoUrl={logoUrl}
              brandColor={brandColor}
              size="lg"
            />
          </div>
          <div>
            <h1 className="text-lg font-black text-[#0b3d2e]">Cari Kartu Member</h1>
            <p className="mt-1 text-[13px] leading-relaxed text-[#5b7a6e]">
              {businessName ?? storeCode}
            </p>
          </div>
        </header>

        {selesai ? (
          <div className="space-y-3">
            {/*
              Kalimatnya sama persis, terdaftar maupun tidak. Membedakannya
              berarti halaman ini bisa dipakai memeriksa nomor mana yang jadi
              pelanggan toko ini — daftar itu sendiri tidak boleh bocor.
            */}
            <div className="flex items-start gap-2.5 rounded-2xl border border-emerald-300 bg-emerald-50 p-3.5">
              <MessageCircle size={18} className="mt-0.5 shrink-0 text-emerald-700" />
              <p className="text-[13px] font-bold leading-relaxed text-emerald-900">
                Kalau nomor itu terdaftar sebagai member, tautan kartunya sudah
                dikirim ke WhatsApp nomor tersebut.
              </p>
            </div>

            {selesai.perluDikirimStaf && (
              <p className="rounded-2xl border border-amber-300 bg-amber-50 p-3.5 text-[12px] leading-relaxed text-amber-900">
                Toko ini mengirim tautannya secara manual, jadi mungkin butuh
                beberapa saat. Kalau buru-buru, tunjukkan halaman ini ke kasir.
              </p>
            )}

            <button
              type="button"
              onClick={() => {
                setSelesai(null);
                setTelp("");
              }}
              className="w-full rounded-2xl border border-[#d8e3de] bg-white py-3 text-xs font-bold text-[#5b7a6e]"
            >
              Coba nomor lain
            </button>
          </div>
        ) : (
          <form onSubmit={kirim} className="space-y-3">
            <label className="block text-xs font-bold text-[#1a382d]">
              Nomor WhatsApp yang dipakai daftar
              <input
                type="tel"
                inputMode="numeric"
                required
                value={telp}
                onChange={(e) => setTelp(e.target.value)}
                placeholder="081234567890"
                className="mt-1.5 w-full rounded-2xl border-2 border-[#d8e3de] bg-[#fbfdfc] p-3 text-base font-bold text-[#0b3d2e] outline-none focus:border-emerald-600 focus:bg-white"
              />
            </label>

            {galat && (
              <p className="rounded-xl border border-rose-300 bg-rose-50 p-2.5 text-[12px] font-bold text-rose-800">
                {galat}
              </p>
            )}

            <button
              type="submit"
              disabled={sedangKirim}
              className="flex w-full items-center justify-center gap-2 rounded-2xl bg-[#0b3d2e] py-3.5 text-sm font-black text-white disabled:opacity-60"
            >
              {sedangKirim ? <Loader2 size={16} className="animate-spin" /> : <MessageCircle size={16} />}
              <span>{sedangKirim ? "Mengirim..." : "Kirim Tautan ke WhatsApp"}</span>
            </button>

            {/*
              Alasannya ditulis, bukan cuma aturannya. Pelanggan yang mengerti
              kenapa tautannya tidak muncul di layar tidak akan menganggap
              halaman ini rusak.
            */}
            <p className="flex items-start gap-2 pt-1 text-[11.5px] leading-relaxed text-[#5b7a6e]">
              <ShieldCheck size={14} className="mt-0.5 shrink-0 text-emerald-700" />
              <span>
                Tautannya dikirim ke WhatsApp, bukan ditampilkan di sini. Siapa pun
                yang memegang tautan kartu bisa memakai poinmu — jadi hanya pemilik
                nomornya yang boleh menerimanya.
              </span>
            </p>
          </form>
        )}
      </div>
    </main>
  );
}
