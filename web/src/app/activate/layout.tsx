import type { Metadata } from "next";

/**
 * Halaman aktivasi kartu adalah komponen klien, dan komponen klien tidak bisa
 * mengekspor `metadata`. Layout inilah yang memasang noindex-nya.
 *
 * Tanpa ini, satu-satunya penjaga adalah aturan disallow di robots.ts —
 * padahal robots.txt cuma permintaan sopan yang dipatuhi perayap yang mau
 * mematuhinya, dan tidak berlaku untuk alamat yang ditemukan lewat jalur
 * lain. Alamat aktivasi memuat kode kartu; itu tidak boleh berakhir di
 * hasil pencarian.
 *
 * Diletakkan di /activate, bukan di /activate/[code]: segmen statis tidak
 * membawa `params`, jadi layout-nya tetap sesederhana ini dan cakupannya sama.
 */
export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default function ActivateLayout({ children }: { children: React.ReactNode }) {
  return children;
}
