"use client";

import { useState } from "react";
import { BellRing, Check, Loader2, ShoppingBag } from "lucide-react";

import { savePaymentTimingAction, saveQrMenuModeAction } from "@/lib/actions-pos-settings";

/**
 * Memilih cara toko memakai menu digitalnya.
 *
 * Keterangan tiap pilihan sengaja menyebut KONSEKUENSINYA di lapangan, bukan
 * cuma namanya. Owner yang memilih berdasarkan nama akan mengira ini soal
 * tampilan, padahal yang berubah adalah siapa yang mengetik pesanan, kapan
 * uangnya diterima, dan siapa yang menanggung kalau menunya ternyata habis.
 */

const PILIHAN = [
  {
    nilai: "lihat_panggil" as const,
    ikon: BellRing,
    judul: "Menu dilihat, pesan lewat pelayan",
    ringkas: "Cocok untuk kafe dan rumah makan yang tamunya duduk lama",
    rinci: [
      "Tamu memindai QR hanya untuk melihat menu dan harganya.",
      "Tamu menulis pesanan di kertas, lalu menekan tombol panggil.",
      "Kasir berbunyi: “Meja sekian sudah siap memesan.”",
      "Pelayan datang, memastikan menunya ada, lalu menginputnya di kasir.",
      "Semua pembayaran di kasir setelah makan.",
    ],
    kenapa:
      "Menu bisa habis sewaktu-waktu. Kalau tamu memesan sendiri, dia baru tahu pesanannya kosong setelah uangnya masuk — dan itu jadi refund.",
  },
  {
    nilai: "pesan_bayar" as const,
    ikon: ShoppingBag,
    judul: "Tamu pesan & bayar sendiri dari HP",
    ringkas: "Cocok untuk gerai cepat saji dan antrean panjang",
    rinci: [
      "Tamu memilih menu dan mengirim pesanannya sendiri dari HP.",
      "Pembayaran QRIS di depan, sebelum makanan dibuat.",
      "Pesanan langsung masuk antrean dapur tanpa lewat pelayan.",
      "Kasir tinggal mengonfirmasi uangnya masuk.",
    ],
    kenapa:
      "Menghemat tenaga saat antrean panjang, tapi menuntut daftar menu yang ketersediaannya selalu diperbarui.",
  },
];

export default function QrMenuModeSetup({
  mode,
  timing,
}: {
  mode: "pesan_bayar" | "lihat_panggil";
  timing: "di_depan" | "di_akhir";
}) {
  const [terpilih, setTerpilih] = useState(mode);
  const [waktuBayar, setWaktuBayar] = useState(timing);
  const [busy, setBusy] = useState(false);
  const [pesan, setPesan] = useState<string | null>(null);

  const simpanWaktuBayar = async (nilai: "di_depan" | "di_akhir") => {
    if (nilai === waktuBayar) return;
    const sebelumnya = waktuBayar;
    setWaktuBayar(nilai);
    setBusy(true);
    setPesan(null);

    const hasil = await savePaymentTimingAction(nilai);
    setBusy(false);

    if (!hasil.ok) {
      setWaktuBayar(sebelumnya);
      setPesan(hasil.error);
      return;
    }

    setPesan(
      nilai === "di_akhir"
        ? "Tersimpan. Pesanan makan di tempat sekarang dicatat belum lunas, dan dibayar sekali saat tamunya pulang."
        : "Tersimpan. Kasir menerima uangnya lagi saat pesanan dicatat.",
    );
  };

  const simpan = async (nilai: "pesan_bayar" | "lihat_panggil") => {
    if (nilai === terpilih) return;
    const sebelumnya = terpilih;
    setTerpilih(nilai);
    setBusy(true);
    setPesan(null);

    const hasil = await saveQrMenuModeAction(nilai);
    setBusy(false);

    if (!hasil.ok) {
      // Pilihannya dikembalikan: layar yang tetap menampilkan pilihan baru
      // padahal penyimpanannya gagal akan membuat owner mengira alurnya sudah
      // berubah, dan baru sadar saat tamu pertama kebingungan di meja.
      setTerpilih(sebelumnya);
      setPesan(hasil.error);
      return;
    }

    setPesan(
      nilai === "lihat_panggil"
        ? "Tersimpan. Menu digital sekarang cuma untuk dilihat, dan tombol panggil pelayan sudah aktif di tiap meja."
        : "Tersimpan. Tamu bisa memesan dan membayar sendiri dari HP lagi.",
    );
  };

  return (
    <div className="space-y-3">
      <p className="font-mono text-xs leading-relaxed text-[#527867]">
        QR meja yang sudah tercetak <b>tidak perlu diganti</b>. Yang berubah cuma
        isi halamannya saat dipindai.
      </p>

      <div className="grid gap-2.5">
        {PILIHAN.map((p) => {
          const aktif = terpilih === p.nilai;
          const Ikon = p.ikon;
          return (
            <button
              key={p.nilai}
              type="button"
              disabled={busy}
              onClick={() => void simpan(p.nilai)}
              className={`rounded-2xl border p-3.5 text-left transition-all disabled:opacity-60 ${
                aktif
                  ? "border-[#0b3d2e] bg-[#edf8f3] ring-1 ring-[#0b3d2e]"
                  : "border-[#d8e3de] bg-white hover:bg-[#f8faf9]"
              }`}
            >
              <div className="flex items-start gap-2.5">
                <span
                  className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl ${
                    aktif ? "bg-[#0b3d2e] text-[#c8f53a]" : "bg-[#f0f5f2] text-[#527867]"
                  }`}
                >
                  {busy && aktif ? (
                    <Loader2 size={15} className="animate-spin" />
                  ) : (
                    <Ikon size={15} />
                  )}
                </span>

                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <h4 className="text-xs font-black text-[#0b3d2e]">{p.judul}</h4>
                    {aktif && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-[#0b3d2e] px-2 py-0.5 text-[9px] font-black text-[#c8f53a]">
                        <Check size={9} /> DIPAKAI
                      </span>
                    )}
                  </div>
                  <p className="mt-0.5 font-mono text-[10.5px] text-[#527867]">{p.ringkas}</p>

                  <ul className="mt-2 space-y-1">
                    {p.rinci.map((baris) => (
                      <li key={baris} className="flex gap-1.5 text-[11px] leading-relaxed text-[#2f4b3f]">
                        <span className="text-[#8aa99a]">•</span>
                        <span>{baris}</span>
                      </li>
                    ))}
                  </ul>

                  <p className="mt-2 border-t border-[#dbe7e1] pt-2 text-[10.5px] leading-relaxed text-[#527867]">
                    <b>Kenapa:</b> {p.kenapa}
                  </p>
                </div>
              </div>
            </button>
          );
        })}
      </div>

      {/* --- Kapan uangnya diterima --- */}
      <div className="mt-5 border-t border-[#e3ece8] pt-4">
        <h4 className="mb-1 font-mono text-xs font-black text-[#0b3d2e]">Kapan Uangnya Diterima</h4>
        <p className="mb-2.5 font-mono text-[11px] leading-relaxed text-[#527867]">
          Hanya berlaku untuk <b>makan di tempat</b>. Bungkus dan antar selalu
          dibayar saat itu juga — tidak ada meja yang menahan tamunya sampai selesai.
        </p>

        <div className="grid gap-2 sm:grid-cols-2">
          {([
            {
              nilai: "di_akhir" as const,
              judul: "Bayar di akhir",
              isi: "Pesanan dicatat belum lunas dan menumpuk di mejanya. Kasir menerima seluruh tagihan sekali saat tamunya pulang, lalu struknya dicetak.",
            },
            {
              nilai: "di_depan" as const,
              judul: "Bayar di depan",
              isi: "Kasir menerima uangnya saat pesanan dicatat, seperti gerai cepat saji.",
            },
          ]).map((p) => {
            const aktif = waktuBayar === p.nilai;
            return (
              <button
                key={p.nilai}
                type="button"
                disabled={busy}
                onClick={() => void simpanWaktuBayar(p.nilai)}
                className={`rounded-2xl border p-3 text-left transition-all disabled:opacity-60 ${
                  aktif
                    ? "border-[#0b3d2e] bg-[#edf8f3] ring-1 ring-[#0b3d2e]"
                    : "border-[#d8e3de] bg-white hover:bg-[#f8faf9]"
                }`}
              >
                <div className="flex items-center gap-1.5">
                  <h5 className="text-xs font-black text-[#0b3d2e]">{p.judul}</h5>
                  {aktif && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-[#0b3d2e] px-2 py-0.5 text-[9px] font-black text-[#c8f53a]">
                      <Check size={9} /> DIPAKAI
                    </span>
                  )}
                </div>
                <p className="mt-1 text-[11px] leading-relaxed text-[#2f4b3f]">{p.isi}</p>
              </button>
            );
          })}
        </div>
      </div>

      {pesan && <p className="font-mono text-xs text-[#2f4b3f]">{pesan}</p>}
    </div>
  );
}
