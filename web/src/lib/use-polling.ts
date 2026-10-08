"use client";

import { useEffect, useRef } from "react";

type PollingOptions = {
  /** Jeda awal, dan jeda yang dipulihkan begitu ada yang berubah. */
  baseMs: number;
  /** Batas atas jeda saat tidak ada yang berubah. Sama dengan baseMs = tanpa backoff. */
  maxMs?: number;
  /** Matikan polling sepenuhnya (mis. status sudah final). */
  enabled?: boolean;
};

/**
 * Polling yang hemat bandwidth.
 *
 * Tiga hal yang membedakannya dari setInterval biasa:
 *  - Berhenti selama tab tersembunyi, lalu menarik data sekali begitu tab
 *    terlihat lagi. Tablet kasir yang dibiarkan menyala semalaman tidak lagi
 *    menembak server ribuan kali.
 *  - Jeda merenggang (x1.5, sampai maxMs) selama tidak ada yang berubah, dan
 *    kembali ke baseMs begitu `tugas` mengembalikan true.
 *  - Satu permintaan pada satu waktu: putaran berikutnya baru dijadwalkan
 *    setelah yang sekarang selesai.
 *
 * `tugas` mengembalikan true kalau ada data baru yang berarti bagi layar.
 */
export function usePolling(
  tugas: () => Promise<boolean | void> | boolean | void,
  { baseMs, maxMs = baseMs, enabled = true }: PollingOptions,
) {
  const tugasRef = useRef(tugas);
  tugasRef.current = tugas;

  useEffect(() => {
    if (!enabled) return;

    let batal = false;
    let timer: number | undefined;
    let jeda = baseMs;

    const jadwalkan = () => {
      if (batal || document.hidden) return;
      timer = window.setTimeout(jalan, jeda);
    };

    const jalan = async () => {
      let berubah = false;
      try {
        berubah = (await tugasRef.current()) === true;
      } catch {
        // Gagal jaringan: coba lagi di putaran berikutnya.
      }
      if (batal) return;
      jeda = berubah ? baseMs : Math.min(maxMs, Math.round(jeda * 1.5));
      jadwalkan();
    };

    const saatVisibilitasBerubah = () => {
      window.clearTimeout(timer);
      if (document.hidden) return;
      jeda = baseMs;
      void jalan();
    };

    document.addEventListener("visibilitychange", saatVisibilitasBerubah);
    jadwalkan();

    return () => {
      batal = true;
      window.clearTimeout(timer);
      document.removeEventListener("visibilitychange", saatVisibilitasBerubah);
    };
  }, [baseMs, maxMs, enabled]);
}
