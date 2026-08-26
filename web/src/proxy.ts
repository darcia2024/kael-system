import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

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
  // Halaman login sendiri harus tetap terbuka, kalau tidak pengalihannya
  // berputar tanpa henti. /admin adalah pintu masuk tim KAEL, jadi ia juga
  // login, bukan halaman yang dijaga. Yang dijaga adalah isinya, /admin/cards.
  const path = request.nextUrl.pathname;
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
  matcher: ["/app/:path*", "/admin/:path*"],
};
