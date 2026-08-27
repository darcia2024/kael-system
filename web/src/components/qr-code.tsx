"use client";

import { useMemo } from "react";
import qrcode from "qrcode-generator";

/**
 * Penggambar QR.
 *
 * Digambar sebagai SVG dari modul-modulnya sendiri, bukan lewat layanan
 * gambar dari luar. Untuk QR pembayaran itu bukan soal selera: mengirim
 * payload QRIS ke server pihak ketiga hanya untuk digambar berarti isi
 * transaksi tiap toko lewat sana, dan QR-nya berhenti muncul begitu koneksi
 * kasir putus.
 *
 * Warna dipatok hitam di atas putih dan TIDAK ikut tema gelap. Pemindai
 * bergantung pada kontras, dan QR terang di atas latar gelap adalah cara
 * paling umum membuat QR yang benar jadi tidak terbaca.
 */
export default function QrCode({
  value,
  size = 240,
  className = "",
  label,
}: {
  value: string;
  size?: number;
  className?: string;
  /** Teks alternatif untuk pembaca layar. */
  label?: string;
}) {
  const hasil = useMemo(() => {
    try {
      // Tingkat koreksi galat M: cukup tahan terhadap layar tergores dan
      // pantulan cahaya, tanpa memperbesar modul sampai QR-nya jadi rapat.
      const qr = qrcode(0, "M");
      qr.addData(value, "Byte");
      qr.make();

      const n = qr.getModuleCount();
      let d = "";
      for (let baris = 0; baris < n; baris++) {
        for (let kolom = 0; kolom < n; kolom++) {
          if (qr.isDark(baris, kolom)) d += `M${kolom},${baris}h1v1h-1z`;
        }
      }
      return { d, n };
    } catch {
      return null;
    }
  }, [value]);

  if (!hasil) {
    return (
      <div
        className={`flex items-center justify-center rounded-xl border-2 border-dashed border-[#c9c9d4] bg-white p-4 text-center ${className}`}
        style={{ width: size, height: size }}
      >
        <p className="text-xs text-[#7b7b8e]">Kode terlalu panjang untuk digambar jadi QR.</p>
      </div>
    );
  }

  // Zona sunyi 4 modul di tiap sisi, sesuai spesifikasi QR. Tanpa itu sebagian
  // pemindai gagal menemukan batas kodenya.
  const m = 4;
  const total = hasil.n + m * 2;

  return (
    <svg
      viewBox={`${-m} ${-m} ${total} ${total}`}
      width={size}
      height={size}
      className={className}
      shapeRendering="crispEdges"
      role="img"
      aria-label={label ?? "Kode QR"}
    >
      <rect x={-m} y={-m} width={total} height={total} fill="#ffffff" />
      <path d={hasil.d} fill="#000000" />
    </svg>
  );
}
