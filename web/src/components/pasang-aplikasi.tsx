"use client";

import { useEffect, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { EllipsisVertical, MonitorDown, Share, SquarePlus, X } from "lucide-react";

import { usePwaInstall } from "@/components/pwa-register";

type Perangkat = "ios" | "android" | "desktop";

function kenaliPerangkat(): Perangkat {
  const ua = navigator.userAgent;
  // iPad sejak iPadOS 13 mengaku Mac; yang membedakannya cuma layar sentuh.
  if (/iphone|ipad|ipod/i.test(ua) || (/macintosh/i.test(ua) && navigator.maxTouchPoints > 1)) {
    return "ios";
  }
  if (/android/i.test(ua)) return "android";
  return "desktop";
}

/**
 * Tombol "pasang aplikasi" untuk KAEL Owner.
 *
 * Chrome dan Edge punya jendela pasang sendiri (beforeinstallprompt, ditangkap
 * di pwa-register.tsx). Safari tidak punya sama sekali — satu-satunya jalan
 * lewat menu Bagikan — dan Chrome pun tidak selalu memberinya: dibuka dari
 * WhatsApp, pernah ditolak, atau belum cukup lama di halaman. Untuk semua itu
 * ketukannya membuka panduan langkah demi langkah, bukan diam tanpa reaksi.
 *
 * Mengembalikan `lembar` alih-alih merendernya sendiri: tombolnya bisa berada
 * di menu yang tertutup begitu diketuk, sedangkan panduannya harus tetap tampil.
 */
export function usePasangAplikasi() {
  const { isInstallable, isInstalled, triggerInstall } = usePwaInstall();
  const [panduan, setPanduan] = useState<Perangkat | null>(null);

  const pasang = () => {
    if (isInstallable) {
      void triggerInstall();
      return;
    }
    setPanduan(kenaliPerangkat());
  };

  const lembar: ReactNode = panduan ? (
    <LembarPanduan perangkat={panduan} onTutup={() => setPanduan(null)} />
  ) : null;

  // Yang sudah berjalan sebagai aplikasi terpasang tidak perlu ditawari lagi.
  return { tampil: !isInstalled, pasang, lembar };
}

/**
 * Ikon di tengah kalimat. Spasi di sekitarnya ditulis eksplisit ({" "}): JSX
 * membuang pindah baris di antara teks dan elemen, dan ikonnya aria-hidden —
 * tanpa spasi, pembaca layar membaca "Ketuk menudi pojok".
 */
const ikonSebaris = "inline-block -translate-y-px align-middle";

function LembarPanduan({ perangkat, onTutup }: { perangkat: Perangkat; onTutup: () => void }) {
  useEffect(() => {
    const tutupDenganEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape") onTutup();
    };
    window.addEventListener("keydown", tutupDenganEsc);
    return () => window.removeEventListener("keydown", tutupDenganEsc);
  }, [onTutup]);

  const langkah: ReactNode[] =
    perangkat === "ios"
      ? [
          <>
            Ketuk tombol <b>Bagikan</b>{" "}
            <Share size={14} className={ikonSebaris} aria-hidden="true" /> — di iPhone ada di bawah
            layar, di iPad di kanan atas.
          </>,
          <>
            Gulir ke bawah, pilih <b>Tambah ke Layar Utama</b>{" "}
            <SquarePlus size={14} className={ikonSebaris} aria-hidden="true" />.
          </>,
          <>
            Ketuk <b>Tambah</b>, lalu buka <b>KAEL Owner</b> dari ikonnya di layar utama.
          </>,
        ]
      : perangkat === "android"
        ? [
            <>
              Ketuk menu{" "}
              <EllipsisVertical size={14} className={ikonSebaris} aria-hidden="true" />{" "}
              di pojok kanan atas Chrome.
            </>,
            <>
              Pilih <b>Instal aplikasi</b> atau <b>Tambahkan ke layar utama</b>.
            </>,
            <>
              Ketuk <b>Instal</b>, lalu buka <b>KAEL Owner</b> dari layar utama.
            </>,
          ]
        : [
            <>
              Klik ikon pasang{" "}
              <MonitorDown size={14} className={ikonSebaris} aria-hidden="true" />{" "}
              di ujung kanan kolom alamat Chrome atau Edge.
            </>,
            <>
              Klik <b>Instal</b>. KAEL Owner terbuka di jendelanya sendiri.
            </>,
          ];

  /**
   * Dua jebakan yang paling sering: tautan dari WhatsApp terbuka di peramban
   * bawaan WhatsApp yang tidak bisa memasang apa pun, dan aplikasi web di
   * iPhone menyimpan login terpisah dari Safari.
   */
  const catatan =
    perangkat === "ios"
      ? "Harus lewat Safari. Kalau halaman ini terbuka dari WhatsApp, ketuk ikon Safari dulu. Di dalam aplikasinya nanti, iPhone meminta kamu masuk sekali lagi."
      : perangkat === "android"
        ? "Kalau halaman ini terbuka dari WhatsApp, ketuk ⋮ lalu Buka di Chrome dulu."
        : null;

  /**
   * Lewat portal ke <body>. Pemanggilnya bisa berada di dalam elemen yang
   * beranimasi transform (banner pasang meluncur dari atas), dan transform
   * membuat `position: fixed` menempel ke elemen itu, bukan ke layar —
   * lembarnya terpotong di dalam banner.
   */
  return createPortal(
    <div
      className="fixed inset-0 z-[60] flex items-end justify-center bg-black/40 sm:items-center sm:p-4"
      onClick={onTutup}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="judul-pasang-aplikasi"
        className="w-full max-w-md rounded-t-3xl bg-white p-5 pb-[calc(1.25rem_+_env(safe-area-inset-bottom))] text-[#232331] shadow-2xl sm:rounded-3xl sm:pb-5"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            {/* eslint-disable-next-line @next/next/no-img-element -- ikon statis 44px */}
            <img src="/owner/icon-192.png" alt="" className="h-11 w-11 rounded-xl" />
            <div>
              <h2 id="judul-pasang-aplikasi" className="text-base font-black">
                Pasang KAEL Owner
              </h2>
              <p className="text-xs text-[#5c5c70]">Dasbor toko langsung dari layar utama HP.</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onTutup}
            aria-label="Tutup"
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#f1f0f6] text-[#5c5c70]"
          >
            <X size={16} />
          </button>
        </div>

        <ol className="mt-4 space-y-2.5">
          {langkah.map((isi, i) => (
            <li key={i} className="flex gap-3 text-[13px] leading-relaxed">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#232331] font-mono text-[11px] font-black text-[#d9ff57]">
                {i + 1}
              </span>
              <span className="pt-0.5">{isi}</span>
            </li>
          ))}
        </ol>

        {catatan && (
          <p className="mt-4 rounded-2xl bg-[#f7f6fc] p-3 text-[11.5px] leading-relaxed text-[#5c5c70]">
            {catatan}
          </p>
        )}

        <button
          type="button"
          onClick={onTutup}
          autoFocus
          className="mt-4 w-full rounded-xl bg-[#232331] py-3 text-sm font-black text-white"
        >
          Mengerti
        </button>
      </div>
    </div>,
    document.body,
  );
}
