import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

import { legacyHosts, siteHost } from "@/lib/site";

/**
 * Mengarahkan host lama ke domain resmi.
 *
 * Kartu NFC yang sudah beredar membawa alamat host lama, dan alamat itu tidak
 * bisa diubah setelah kartunya ada di meja toko orang. Jadi host lama tetap
 * dilayani, tapi seluruh permintaannya dibelokkan ke domain resmi supaya cuma
 * ada satu alamat yang benar-benar melayani.
 *
 * Memakai 307, bukan 308. Alasannya sama dengan yang dipakai rute kartu di
 * app/r/[code]: peramban dan operator seluler menyimpan pengalihan permanen
 * dan tidak melepasnya lagi. Kalau suatu saat domain barunya bermasalah,
 * pengalihan permanen membuat kartu lama ikut mati padahal host lamanya masih
 * hidup.
 */
function pengalihanDomain(request: NextRequest) {
  const host = (request.headers.get("host") ?? "").toLowerCase();
  if (!host || host === siteHost) return null;
  if (!legacyHosts.includes(host)) return null;

  const url = request.nextUrl.clone();
  url.protocol = "https:";
  url.host = siteHost;
  url.port = "";
  return NextResponse.redirect(url, 307);
}

/**
 * Pengalihan optimistis untuk area yang butuh login.
 *
 * Di Next 16 berkas ini menggantikan `middleware.ts`. Fungsinya sama.
 *
 * PENTING: ini BUKAN penjaga keamanan. Dokumentasi Next menyatakan proxy tidak
 * dimaksudkan sebagai solusi manajemen sesi atau otorisasi, dan Server Action
 * tetap bisa dipanggil langsung lewat POST tanpa melewati navigasi halaman.
 * Karena itu pemeriksaan yang sebenarnya ada di requireStaff/requireOwner/
 * requireKaelAdmin di dalam setiap komponen server dan setiap action.
 *
 * Yang dikerjakan di sini hanya satu: mencegah pengguna tanpa cookie sesi
 * melihat kerangka halaman kosong sebelum dilempar balik ke login.
 */
export function proxy(request: NextRequest) {
  const dialihkan = pengalihanDomain(request);
  if (dialihkan) return dialihkan;

  const path = request.nextUrl.pathname;

  /**
   * Penjagaan sesi hanya berlaku untuk /app dan /admin.
   *
   * Matcher di bawah sengaja mencakup SELURUH jalur, karena pengalihan domain
   * di atas harus ikut melayani tautan kartu di /r/ dan halaman pelanggan di
   * /order, /m, serta /receipt. Karena itu batasnya ditegaskan di sini.
   * Tanpa baris ini, setiap halaman publik ikut dilempar ke layar masuk.
   */
  if (!path.startsWith("/app") && !path.startsWith("/admin")) {
    return NextResponse.next();
  }

  // Halaman login sendiri harus tetap terbuka, kalau tidak pengalihannya
  // berputar tanpa henti. /admin adalah pintu masuk tim KAEL, jadi ia juga
  // login, bukan halaman yang dijaga. Yang dijaga adalah isinya, /admin/cards.
  if (path.startsWith("/app/login") || path === "/admin" || path === "/admin/") {
    return NextResponse.next();
  }

  const hasSession = request.cookies.has("kael_session");
  if (hasSession) return NextResponse.next();

  /**
   * Area admin dilempar ke /admin, bukan ke login publik. Login publik sudah
   * tidak punya tab admin, jadi mengarahkan tim ke sana berarti mendaratkan
   * mereka di layar yang tidak bisa dipakai masuk.
   */
  if (path.startsWith("/admin")) {
    return NextResponse.redirect(new URL("/admin", request.url));
  }

  const login = new URL("/app/login", request.url);
  login.searchParams.set("next", path);
  return NextResponse.redirect(login);
}

export const config = {
  /**
   * Seluruh jalur, kecuali berkas bawaan Next.
   *
   * Sebelumnya hanya /app dan /admin, dan itu berarti pengalihan domain tidak
   * pernah menyentuh /r/ — justru satu-satunya jalur yang alamatnya tercetak
   * permanen di kartu fisik.
   */
  matcher: ["/((?!_next/static|_next/image).*)"],
};
