"use client";

import { useMemo } from "react";
import qrcode from "qrcode-generator";

/**
 * Penggambar QR.
 *
 * Digambar sebagai SVG dari modul-modulnya sendiri, bukan lewat layanan
 * gambar dari luar. Mendukung custom colorDark dan centerLogoUrl
 * (otomatis memakai error correction level H agar logo di tengah
 * tidak mengganggu keterbacaan pemindai).
 */
export default function QrCode({
  value,
  size = 240,
  className = "",
  label,
  colorDark = "#000000",
  centerLogoUrl,
  errorCorrectionLevel,
}: {
  value: string;
  size?: number;
  className?: string;
  /** Teks alternatif untuk pembaca layar. */
  label?: string;
  colorDark?: string;
  centerLogoUrl?: string | null;
  errorCorrectionLevel?: "L" | "M" | "Q" | "H";
}) {
  const ecLevel = errorCorrectionLevel ?? (centerLogoUrl ? "H" : "M");

  const hasil = useMemo(() => {
    try {
      const qr = qrcode(0, ecLevel);
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
  }, [value, ecLevel]);

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

  // Zona sunyi 4 modul di tiap sisi, sesuai spesifikasi QR.
  const m = 4;
  const total = hasil.n + m * 2;
  const logoBoxSize = Math.round(size * 0.23);

  return (
    <div
      className={`relative inline-flex items-center justify-center ${className}`}
      style={{ width: size, height: size }}
    >
      <svg
        viewBox={`${-m} ${-m} ${total} ${total}`}
        width={size}
        height={size}
        className="block h-full w-full"
        shapeRendering="crispEdges"
        role="img"
        aria-label={label ?? "Kode QR"}
      >
        <rect x={-m} y={-m} width={total} height={total} fill="#ffffff" />
        <path d={hasil.d} fill={colorDark} />
      </svg>
      {centerLogoUrl && (
        <div
          className="absolute inset-0 m-auto flex items-center justify-center rounded-full bg-white p-1.5 shadow-md border-2 border-[#0b3d2e]"
          style={{ width: logoBoxSize, height: logoBoxSize }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={centerLogoUrl}
            alt="Brand Logo"
            className="h-full w-full rounded-full object-contain"
          />
        </div>
      )}
    </div>
  );
}
