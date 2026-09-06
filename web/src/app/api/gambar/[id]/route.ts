import { NextResponse } from "next/server";

import { db } from "@/lib/db";

/**
 * Penyaji gambar unggahan.
 *
 * Terbuka tanpa login karena yang memakainya halaman pesan dari meja, yang
 * memang dibuka pelanggan tanpa akun. Yang menjaga bukan sesi melainkan id-nya:
 * UUID acak, tidak berurutan, tidak bisa ditebak dari id gambar lain.
 *
 * Barisnya tidak pernah diperbarui — mengganti gambar menu membuat baris baru —
 * jadi jawaban ini boleh disebut `immutable`. Tanpa itu setiap pemuatan halaman
 * menu akan menarik ulang gambarnya dari database lintas benua.
 */

const SATU_TAHUN = 60 * 60 * 24 * 365;

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  // Postgres melempar galat untuk UUID yang bentuknya salah, dan galat itu akan
  // muncul sebagai 500 di log seolah-olah ada yang rusak. Disaring lebih dulu.
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) {
    return new NextResponse("Tidak ditemukan", { status: 404 });
  }

  const gambar = await db.getUploadedImage(id);
  if (!gambar) return new NextResponse("Tidak ditemukan", { status: 404 });

  const body = new Uint8Array(gambar.bytes);
  return new NextResponse(body, {
    headers: {
      "Content-Type": gambar.mime,
      "Content-Length": String(body.byteLength),
      "Cache-Control": `public, max-age=${SATU_TAHUN}, immutable`,
      /**
       * Jenis berkas tidak boleh ditebak ulang peramban. Berkas ini disajikan
       * dari domain yang sama dengan aplikasinya, jadi sesuatu yang tersimpan
       * sebagai gambar tetapi terbaca sebagai HTML akan berjalan dengan hak
       * yang sama seperti halaman KAEL sendiri.
       */
      "X-Content-Type-Options": "nosniff",
      "Content-Disposition": "inline",
    },
  });
}
