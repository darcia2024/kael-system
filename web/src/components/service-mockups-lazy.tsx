"use client";

import dynamic from "next/dynamic";
import { useEffect, useRef, useState } from "react";

/**
 * Memuat pratinjau produk hanya ketika pengguna hampir sampai ke sana.
 *
 * ALASAN
 * service-mockups adalah komponen client sepanjang ~2.900 baris dengan lebih
 * dari seratus titik interaktif, dan letaknya jauh di bawah layar pertama.
 * Sebelumnya ia ikut dibangun dan di-hydrate saat halaman pertama dibuka.
 *
 * Yang terukur di produksi: jaringan sebenarnya cepat (TTFB 244 ms, total
 * unduhan 265 KB), tapi halaman baru bisa disentuh pada 2.041 ms karena
 * browser harus menyusun 1.689 elemen DOM lebih dulu. Beban itu ada di
 * perangkat, bukan di koneksi, dan bagian terbesarnya adalah komponen ini.
 *
 * Dengan ssr: false komponennya tidak ikut ke HTML awal, jadi tidak menambah
 * jumlah elemen yang harus disusun sebelum halaman responsif. Ini pratinjau
 * visual, bukan naskah yang perlu terbaca mesin pencari, jadi tidak ada yang
 * hilang dari sisi SEO.
 */
const ServiceMockupsInner = dynamic(
  () => import("./service-mockups").then((m) => m.ServiceMockups),
  { ssr: false },
);

export function ServiceMockupsLazy() {
  const ref = useRef<HTMLDivElement>(null);
  const [tampilkan, setTampilkan] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    // Peramban lama tanpa IntersectionObserver langsung memuat saja, supaya
    // isinya tidak pernah hilang.
    if (typeof IntersectionObserver === "undefined") {
      setTampilkan(true);
      return;
    }

    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setTampilkan(true);
          io.disconnect();
        }
      },
      // Mulai memuat satu layar sebelum sampai, jadi biasanya sudah siap
      // ketika pengguna tiba.
      { rootMargin: "600px 0px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <div ref={ref}>
      {tampilkan ? (
        <ServiceMockupsInner />
      ) : (
        // Ruang penahan supaya halaman tidak melompat saat isinya masuk.
        <div
          aria-hidden
          className="min-h-[420px] border-b border-[#dedee8] bg-[#fcfcfe]"
        />
      )}
    </div>
  );
}
