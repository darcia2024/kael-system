import type { Metadata } from "next";

/**
 * Halaman status tap kartu adalah komponen klien, jadi noindex-nya dipasang
 * di sini — sejalan dengan janji di robots.ts bahwa area privat memasang
 * penjaganya sendiri, bukan cuma mengandalkan robots.txt.
 */
export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default function CardStatusLayout({ children }: { children: React.ReactNode }) {
  return children;
}
