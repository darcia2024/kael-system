import type { Metadata } from "next";

import { db } from "@/lib/db";

/**
 * Jalur pesan tanpa nomor meja.
 *
 * Ada dua yang mendarat di sini. Pertama, QR meja lama yang masih berbentuk
 * `/order/12` — nomor mejanya terbaca sebagai kode toko dan tidak akan cocok
 * dengan toko mana pun. Kedua, tautan `/order/KODETOKO` tanpa nomor meja.
 *
 * Keduanya dijawab dengan kalimat, bukan 404 dan bukan tebakan. Menebak berarti
 * menampilkan menu toko yang salah, yang persis masalah yang membuat jalur ini
 * diubah.
 */

export const metadata: Metadata = {
  title: "Pesan dari Meja",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function OrderTanpaMeja({
  params,
}: {
  params: Promise<{ storeCode: string }>;
}) {
  const { storeCode } = await params;
  const business = await db.getBusinessByStoreCode(decodeURIComponent(storeCode));

  return (
    <div className="min-h-screen bg-[#f7f6fc] text-[#232331] font-sans flex items-center justify-center p-5">
      <div className="w-full max-w-sm rounded-3xl border-2 border-[#232331] bg-white p-7 shadow-ink-md text-center space-y-3">
        <h1 className="text-lg font-extrabold">
          {business ? "Nomor meja belum ada" : "QR ini sudah tidak berlaku"}
        </h1>
        <p className="text-sm text-[#7b7b8e] leading-relaxed">
          {business
            ? `Pindai QR yang menempel di meja ${business.name} supaya pesanan masuk ke meja yang benar.`
            : "Pindai ulang QR yang ada di meja. Kalau masih begini, tunjukkan layar ini ke karyawan toko."}
        </p>
      </div>
    </div>
  );
}
