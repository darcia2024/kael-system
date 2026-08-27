import type { Metadata } from "next";

import { db } from "@/lib/db";
import { normalizeCardCode } from "@/lib/card-code";
import { moduleLock } from "@/lib/licensing";
import RegisterClient from "./register-client";

/**
 * Pendaftaran member. Dibuka pelanggan setelah tap kartu meja, jadi tanpa
 * login. Yang dikirim ke browser hanya identitas bisnis dan aturan program;
 * pendaftarannya sendiri lewat server action.
 */

export const metadata: Metadata = {
  title: "Daftar Member",
  robots: { index: false, follow: false },
};

/**
 * Tidak boleh dicache lintas pengunjung.
 *
 * Halaman ini melayani SEMUA toko dari satu jalur, dan isinya bergantung pada
 * kartu yang barusan di-tap. Versi sebelumnya memakai `revalidate = 300`, yang
 * berarti satu salinan halaman dipakai bersama oleh seluruh toko selama lima
 * menit: pelanggan toko kedua melihat nama dan aturan poin toko pertama.
 */
export const dynamic = "force-dynamic";

/**
 * Menentukan toko mana yang sedang membuka halaman ini.
 *
 * Dua jalur, dan tidak ada jalur ketiga berupa tebakan:
 *
 *   ?card=KODE  kartu yang di-tap pelanggan. Ini jalur utama, dikirim oleh
 *               /r/[code] setelah membaca kartunya.
 *   ?toko=KODE  kode toko, untuk tautan yang dicetak atau dibagikan manual.
 *
 * Sebelum ini keduanya diabaikan dan halaman memanggil db.getBusiness() tanpa
 * argumen, yang menjawab dengan bisnis TERTUA di tabel. Jadi /r/[code] sudah
 * benar menuliskan kartunya di tautan, lalu halaman tujuannya membuang
 * keterangan itu dan menebak sendiri.
 */
async function bisnisDariTautan(card?: string, toko?: string) {
  if (card?.trim()) {
    const kartu = await db.getCardByCode(normalizeCardCode(card));
    if (kartu?.business_id) return db.getBusiness(kartu.business_id);
  }
  if (toko?.trim()) {
    return db.getBusinessByStoreCode(toko.trim());
  }
  return null;
}

function Pesan({ judul, isi }: { judul: string; isi: string }) {
  return (
    <div className="min-h-screen bg-[#f7f6fc] text-[#232331] font-sans flex items-center justify-center p-5">
      <div className="w-full max-w-sm rounded-3xl border-2 border-[#232331] bg-white p-7 shadow-ink-md text-center space-y-3">
        <h1 className="text-lg font-extrabold">{judul}</h1>
        <p className="text-sm text-[#7b7b8e] leading-relaxed">{isi}</p>
      </div>
    </div>
  );
}

export default async function RegisterPage({
  searchParams,
}: {
  searchParams: Promise<{ card?: string; toko?: string }>;
}) {
  const { card, toko } = await searchParams;
  const business = await bisnisDariTautan(card, toko);

  /**
   * Tidak tahu tokonya = tidak menampilkan formulir.
   *
   * Menebak berarti mendaftarkan nomor telepon pelanggan ke basis data
   * pelanggan milik usaha lain. Pelanggannya tidak akan pernah tahu, dan
   * pemilik usaha yang menerimanya juga tidak.
   */
  if (!business) {
    return (
      <Pesan
        judul="Toko belum dikenali"
        isi="Halaman ini dibuka tanpa keterangan toko, jadi pendaftaran belum bisa dimulai. Coba tap ulang kartu yang ada di meja, atau tunjukkan layar ini ke karyawan toko."
      />
    );
  }

  /**
   * Lisensi diperiksa di sini, bukan cuma saat formulir dikirim.
   *
   * registerCustomerAction memang sudah menolak, tapi penolakannya baru muncul
   * setelah pelanggan mengetik nama dan nomor WhatsApp-nya. Memberi tahu di awal
   * lebih sopan daripada memintanya mengisi formulir yang sudah pasti ditolak.
   *
   * Alasannya sengaja TIDAK disebutkan, sama seperti di action-nya: pelanggan
   * tidak perlu, dan tidak pantas, tahu bahwa tokonya telat memperpanjang.
   */
  if (await moduleLock(business.id, "loyalty", "write")) {
    return (
      <Pesan
        judul="Pendaftaran member sedang tutup"
        isi={`${business.name} belum menerima pendaftaran member saat ini. Tanyakan ke karyawan toko untuk info lebih lanjut.`}
      />
    );
  }

  const program = await db.getLoyaltyProgram(business.id);
  return <RegisterClient business={business} program={program} />;
}
