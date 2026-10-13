"use client";

import { useMemo, useState } from "react";
import { ChevronDown, ChefHat, CircleCheck, User, UserRound } from "lucide-react";

import { formatRupiah } from "@/lib/formatters";
import { jamStruk, serviceTypeLabel, tanggalStruk } from "@/lib/pos-engine";
import { tableDisplayName } from "@/lib/table-key";
import type { NotaBelumLunas, RingkasanTagihan } from "@/lib/types";

/**
 * Daftar tagihan yang belum dibayar, satu baris per MEJA.
 *
 * Kartu "Belum dibayar" di atas cuma menjawab BERAPA. Panel ini menjawab
 * pertanyaan yang langsung menyusul: meja mana, pesan apa, sudah berapa lama,
 * dan dicatat siapa — tanpa owner harus menelepon kasir atau membuka denah
 * meja di mesin kasir.
 *
 * Diurutkan dari yang PALING LAMA menunggu, karena itu yang paling perlu
 * ditanyakan lebih dulu. Satuannya meja, sama dengan denah kasir: meja yang
 * memesan tiga kali tetap satu baris berisi tiga nota.
 */

/**
 * Status dapur dalam bahasa yang dibaca orang, bukan nama kolom database.
 *
 * "pending" sengaja TIDAK ditulis "menunggu dapur". Angka itu cuma berarti
 * belum ada yang menekan tombol di layar dapur — bukan bahwa makanannya belum
 * keluar. Di toko yang dapurnya tidak memakai layar itu, setiap nota berhenti
 * di "pending" selamanya, dan owner yang membaca "menunggu dapur" pada meja
 * yang sudah dua jam duduk akan mengira dapurnya lambat. Tulisan di sini harus
 * menyebut apa yang sebenarnya dicatat sistem, bukan menyimpulkannya.
 */
const LABEL_DAPUR: Record<string, string> = {
  pending: "Dapur: belum ditandai",
  accepted: "Dapur: diterima",
  preparing: "Dapur: sedang dimasak",
  ready: "Dapur: siap diantar",
  completed: "Dapur: sudah disajikan",
};

/**
 * Meja yang sudah duduk lebih dari ini diberi tanda kuning. Tiga jam bukan
 * tuduhan — tamu kafe memang bisa duduk lama — tapi cukup lama untuk ditanya.
 */
const AMBANG_LAMA_MENIT = 180;

function lamaTunggu(sejakIso: string, sekarangMs: number): { teks: string; menit: number } {
  const menit = Math.max(0, Math.floor((sekarangMs - new Date(sejakIso).getTime()) / 60_000));
  if (menit < 1) return { teks: "baru saja", menit };
  if (menit < 60) return { teks: `${menit} menit`, menit };
  const jam = Math.floor(menit / 60);
  if (jam < 24) {
    const sisa = menit % 60;
    return { teks: sisa ? `${jam} j ${sisa} m` : `${jam} jam`, menit };
  }
  return { teks: `${Math.floor(jam / 24)} hari`, menit };
}

export function BarisNota({
  nota,
  timezone,
  sekarangMs,
  isMochi,
  tampilkanLayanan,
}: {
  nota: NotaBelumLunas;
  timezone: string;
  sekarangMs: number;
  isMochi: boolean;
  tampilkanLayanan: boolean;
}) {
  const redup = isMochi ? "text-[#637970]" : "text-[#7b7b8e]";

  // Tanggal ikut tercetak hanya kalau notanya BUKAN hari ini: jam saja pada
  // tagihan kemarin menyesatkan, karena terbaca seperti tadi pagi.
  const bukanHariIni =
    tanggalStruk(nota.dibuatPada, timezone) !== tanggalStruk(new Date(sekarangMs).toISOString(), timezone);

  return (
    <li className={`rounded-xl px-3 py-2.5 ${isMochi ? "bg-[#f6faf8]" : "bg-[#f7f6fc]"}`}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="font-mono text-[11px] font-black">
            #{nota.orderNo}
            {tampilkanLayanan && (
              <span className={`ml-1.5 font-normal ${redup}`}>
                {serviceTypeLabel(nota.layanan as "dine_in" | "takeaway" | "delivery", null)}
              </span>
            )}
          </p>
          <p className={`mt-0.5 font-mono text-[10px] leading-relaxed ${redup}`}>
            {bukanHariIni ? `${tanggalStruk(nota.dibuatPada, timezone)} · ` : ""}
            {jamStruk(nota.dibuatPada, timezone)}
          </p>
        </div>
        <span className="shrink-0 font-mono text-[11px] font-black tabular-nums">
          {formatRupiah(nota.total)}
        </span>
      </div>

      {nota.items.length > 0 ? (
        <ul className="mt-1.5 space-y-0.5">
          {nota.items.map((it, i) => (
            // Daftar ini statis per render dan tidak pernah diurut ulang, jadi
            // urutan masuk adalah identitas yang sah untuk baris menu.
            // biome-ignore lint/suspicious/noArrayIndexKey: daftar statis per nota
            <li key={i} className="flex justify-between gap-2 text-[11.5px] leading-snug">
              <span className="min-w-0">
                <span className="font-bold">{it.qty}×</span> {it.nama}
                {it.catatan && (
                  <span className={`block text-[10.5px] italic ${redup}`}>{it.catatan}</span>
                )}
              </span>
              <span className={`shrink-0 font-mono text-[10.5px] tabular-nums ${redup}`}>
                {formatRupiah(it.subtotal)}
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <p className={`mt-1.5 text-[11px] italic ${redup}`}>Isi pesanan tidak tercatat.</p>
      )}

      <div className={`mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 font-mono text-[10px] ${redup}`}>
        <span className="inline-flex items-center gap-1">
          <ChefHat size={11} /> {LABEL_DAPUR[nota.dapur] ?? nota.dapur}
        </span>
        {nota.kasir && (
          <span className="inline-flex items-center gap-1">
            <User size={11} /> dicatat {nota.kasir}
          </span>
        )}
        {nota.pelanggan && (
          <span className="inline-flex items-center gap-1">
            <UserRound size={11} /> {nota.pelanggan}
          </span>
        )}
      </div>
    </li>
  );
}

export default function TagihanMejaPanel({
  unpaid,
  timezone,
  sekarangMs,
  isMochi,
}: {
  unpaid: RingkasanTagihan;
  timezone: string;
  sekarangMs: number;
  isMochi: boolean;
}) {
  const [terbuka, setTerbuka] = useState<Set<string>>(new Set());

  const jumlahBaris = unpaid.perMeja.length + (unpaid.nonMeja.length ? 1 : 0);
  const semuaTerbuka = terbuka.size >= jumlahBaris && jumlahBaris > 0;

  const gantiBuka = (kunci: string) =>
    setTerbuka((lama) => {
      const baru = new Set(lama);
      if (baru.has(kunci)) baru.delete(kunci);
      else baru.add(kunci);
      return baru;
    });

  const bukaSemua = () =>
    setTerbuka(
      semuaTerbuka
        ? new Set()
        : new Set([
            ...unpaid.perMeja.map((m) => `meja:${m.tableNo}`),
            ...(unpaid.nonMeja.length ? ["non-meja"] : []),
          ]),
    );

  const wadah = isMochi
    ? "rounded-3xl border border-[#d8e3de] bg-white p-3.5 shadow-[0_4px_20px_rgba(11,61,46,0.04)] sm:p-6"
    : "border-2 border-[#232331] bg-white p-3 shadow-ink-md sm:p-5";
  const garis = isMochi ? "border-[#e5ece8]" : "border-[#dedee8]";
  const judul = isMochi ? "text-[#0b3d2e]" : "text-[#232331]";
  const redup = isMochi ? "text-[#637970]" : "text-[#7b7b8e]";

  const barisMeja = useMemo(
    () =>
      unpaid.perMeja.map((m) => {
        const tunggu = lamaTunggu(m.sejak, sekarangMs);
        return { meja: m, tunggu, lama: tunggu.menit >= AMBANG_LAMA_MENIT };
      }),
    [unpaid.perMeja, sekarangMs],
  );

  // Tidak ada yang menggantung: satu baris pendek, bukan kartu kosong besar.
  if (jumlahBaris === 0) {
    return (
      <section className={`${wadah} flex items-center gap-2.5`}>
        <CircleCheck size={18} className={isMochi ? "text-[#167052]" : "text-[#15803d]"} />
        <p className={`text-xs font-bold ${judul}`}>
          Semua tagihan sudah lunas. Tidak ada meja yang masih berutang.
        </p>
      </section>
    );
  }

  return (
    <section className={wadah}>
      <div className={`flex items-start justify-between gap-3 border-b pb-3.5 ${garis}`}>
        <div className="min-w-0">
          <h2 className={`text-sm font-black sm:text-base ${judul}`}>Tagihan belum dibayar</h2>
          <p className={`mt-0.5 text-[11px] leading-relaxed ${redup}`}>
            Urut dari yang paling lama menunggu. Ketuk satu meja untuk melihat pesanannya.
          </p>
        </div>
        <div className="shrink-0 text-right">
          <p className={`font-mono text-sm font-black tabular-nums ${judul}`}>
            {formatRupiah(unpaid.totalRupiah)}
          </p>
          <p className={`font-mono text-[10px] ${redup}`}>belum masuk</p>
        </div>
      </div>

      {jumlahBaris > 1 && (
        <div className="flex justify-end pt-2">
          <button
            type="button"
            onClick={bukaSemua}
            className={`font-mono text-[10.5px] font-bold underline ${redup}`}
          >
            {semuaTerbuka ? "Tutup semua" : "Buka semua"}
          </button>
        </div>
      )}

      <ul className="mt-2 space-y-2">
        {barisMeja.map(({ meja, tunggu, lama }) => {
          const kunci = `meja:${meja.tableNo}`;
          const buka = terbuka.has(kunci);
          const bahaya = meja.adaDariHariLain;

          return (
            <li
              key={kunci}
              className={`rounded-2xl border ${
                bahaya
                  ? "border-rose-300 bg-rose-50/60"
                  : lama
                    ? "border-amber-300 bg-amber-50/60"
                    : isMochi
                      ? "border-[#d8e3de]"
                      : "border-[#dedee8]"
              }`}
            >
              <button
                type="button"
                aria-expanded={buka}
                onClick={() => gantiBuka(kunci)}
                className="flex w-full items-center gap-2.5 px-3 py-3 text-left"
              >
                <ChevronDown
                  size={15}
                  className={`shrink-0 transition-transform ${redup} ${buka ? "rotate-180" : ""}`}
                />
                <div className="min-w-0 flex-1">
                  <p className={`text-[13px] font-black ${judul}`}>{tableDisplayName(meja.tableNo)}</p>
                  <p className={`mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 font-mono text-[10.5px] ${redup}`}>
                    <span>{meja.notaCount} nota</span>
                    <span>·</span>
                    <span>menunggu {tunggu.teks}</span>
                    {bahaya && (
                      <span className="rounded bg-rose-600 px-1.5 py-0.5 text-[9px] font-black text-white">
                        DARI HARI SEBELUMNYA
                      </span>
                    )}
                    {!bahaya && lama && (
                      <span className="rounded bg-amber-500 px-1.5 py-0.5 text-[9px] font-black text-white">
                        CUKUP LAMA
                      </span>
                    )}
                  </p>
                </div>
                <span className={`shrink-0 font-mono text-sm font-black tabular-nums ${judul}`}>
                  {formatRupiah(meja.total)}
                </span>
              </button>

              {buka && (
                <ul className="space-y-1.5 px-3 pb-3">
                  {meja.nota.map((n) => (
                    <BarisNota
                      key={n.orderNo}
                      nota={n}
                      timezone={timezone}
                      sekarangMs={sekarangMs}
                      isMochi={isMochi}
                      tampilkanLayanan={false}
                    />
                  ))}
                </ul>
              )}
            </li>
          );
        })}

        {/* Bungkus dan antar: bukan meja, tapi uangnya sama-sama belum masuk. */}
        {unpaid.nonMeja.length > 0 && (
          <li className={`rounded-2xl border ${isMochi ? "border-[#d8e3de]" : "border-[#dedee8]"}`}>
            <button
              type="button"
              aria-expanded={terbuka.has("non-meja")}
              onClick={() => gantiBuka("non-meja")}
              className="flex w-full items-center gap-2.5 px-3 py-3 text-left"
            >
              <ChevronDown
                size={15}
                className={`shrink-0 transition-transform ${redup} ${terbuka.has("non-meja") ? "rotate-180" : ""}`}
              />
              <div className="min-w-0 flex-1">
                <p className={`text-[13px] font-black ${judul}`}>Bungkus &amp; antar</p>
                <p className={`mt-0.5 font-mono text-[10.5px] ${redup}`}>
                  {unpaid.nonMeja.length} pesanan · belum ada meja
                </p>
              </div>
              <span className={`shrink-0 font-mono text-sm font-black tabular-nums ${judul}`}>
                {formatRupiah(unpaid.nonMeja.reduce((n, o) => n + o.total, 0))}
              </span>
            </button>

            {terbuka.has("non-meja") && (
              <ul className="space-y-1.5 px-3 pb-3">
                {unpaid.nonMeja.map((n) => (
                  <BarisNota
                    key={n.orderNo}
                    nota={n}
                    timezone={timezone}
                    sekarangMs={sekarangMs}
                    isMochi={isMochi}
                    tampilkanLayanan
                  />
                ))}
              </ul>
            )}
          </li>
        )}
      </ul>
    </section>
  );
}
