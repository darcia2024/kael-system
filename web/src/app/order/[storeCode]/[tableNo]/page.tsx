import type { Metadata, Viewport } from "next";
import { Plus_Jakarta_Sans } from "next/font/google";

import { db } from "@/lib/db";
import { moduleLock } from "@/lib/licensing";
import OrderClient from "./order-client";

const plusJakartaSans = Plus_Jakarta_Sans({
  subsets: ["latin"],
  display: "swap",
});

/**
 * Menu digital per meja. Pelanggan memindai QR di meja, jadi tanpa login.
 *
 * Jalurnya membawa KODE TOKO, bukan cuma nomor meja. Bentuk sebelumnya
 * `/order/[tableNo]` tidak punya penanda toko sama sekali, sehingga halaman
 * terpaksa menebak dengan mengambil bisnis tertua di tabel. Selama pelanggan
 * KAEL baru satu, tebakan itu selalu kebetulan benar; begitu pelanggan kedua
 * mendaftar, SETIAP QR meja menampilkan menu toko yang salah dan pesanannya
 * tercatat di toko yang salah.
 *
 * Menu diambil di server. Sebelumnya seluruh isi database ikut ke bundel
 * halaman ini hanya untuk menampilkan daftar menu satu toko.
 */

export const metadata: Metadata = {
  title: "Pesan dari Meja",
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
};

/** Menu dan ketersediaannya berubah sepanjang hari, jadi tidak dicache. */
export const dynamic = "force-dynamic";

function Pesan({ judul, isi }: { judul: string; isi: string }) {
  return (
    <div className={`${plusJakartaSans.className} min-h-screen bg-[#f7f6fc] text-[#232331] flex items-center justify-center p-5`}>
      <div className="w-full max-w-sm rounded-3xl border-2 border-[#232331] bg-white p-7 shadow-ink-md text-center space-y-3">
        <h1 className="text-lg font-extrabold">{judul}</h1>
        <p className="text-sm text-[#7b7b8e] leading-relaxed">{isi}</p>
      </div>
    </div>
  );
}

export default async function QrOrderPage({
  params,
}: {
  params: Promise<{ storeCode: string; tableNo: string }>;
}) {
  const { storeCode, tableNo } = await params;

  const business = await db.getBusinessByStoreCode(decodeURIComponent(storeCode));
  if (!business) {
    return (
      <Pesan
        judul="Toko belum dikenali"
        isi="QR ini tidak mengarah ke toko mana pun. Coba pindai ulang QR yang ada di meja, atau pesan langsung ke kasir."
      />
    );
  }

  /**
   * Lisensi diperiksa DI SINI, bukan cuma saat pesanan dikirim.
   *
   * createQrOrderAction memang sudah menolak toko yang modul POS-nya tidak
   * aktif, tapi penolakan di sana baru terjadi setelah pelanggan memilih menu
   * dan menekan kirim. Memberi tahu di awal jauh lebih sopan daripada
   * membiarkan orang menyusun keranjang yang sudah pasti ditolak.
   */
  if (await moduleLock(business.id, "pos", "write")) {
    return (
      <Pesan
        judul="Pemesanan lewat QR sedang tutup"
        isi={`${business.name} belum menerima pesanan lewat QR saat ini. Silakan pesan langsung ke kasir.`}
      />
    );
  }

  const [categories, menuItems] = await Promise.all([
    db.getCategories(business.id),
    db.getMenuItems(business.id),
  ]);

  return (
    <OrderClient
      tableNo={decodeURIComponent(tableNo)}
      business={business}
      categories={categories}
      fontClassName={plusJakartaSans.className}
      // Tampilkan seluruh menu; menu yang habis akan diberi penanda 'HABIS' & dinonaktifkan di tampilan klien.
      menuItems={menuItems}
    />
  );
}
