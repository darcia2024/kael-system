import type { Metadata } from "next";

/**
 * KAEL Owner — aplikasi yang dipasang pemilik usaha ke layar utama HP-nya.
 *
 * Satu domain melayani dua aplikasi terpasang, dibedakan lewat `id` di
 * manifestnya:
 *
 *   KAEL POS    /manifest.webmanifest   mulai di /app/pos     tablet kasir
 *   KAEL Owner  /owner.webmanifest      mulai di /app/owner   HP pemilik
 *
 * Sebelumnya cuma ada KAEL POS, dan manifestnya berlaku untuk seluruh situs:
 * owner yang memasang aplikasi dari dasbornya mendapat aplikasi yang terbuka
 * di layar kasir.
 *
 * Manifest owner sengaja di LUAR /app. Peramban mengambil manifest tanpa
 * cookie, dan proxy.ts melempar setiap permintaan /app tanpa cookie sesi ke
 * halaman masuk — manifest di bawah /app akan terbaca sebagai halaman login,
 * dan aplikasinya tidak bisa dipasang.
 */
export const OWNER_APP = {
  id: "/app/owner",
  startUrl: "/app/owner",
  manifest: "/owner.webmanifest",
  nama: "KAEL Owner",
} as const;

/**
 * Dipasang di halaman tempat owner memasang aplikasinya: beranda bisnis dan
 * dasbor owner. Halaman lain tetap menautkan manifest KAEL POS.
 *
 * `appleWebApp` dan `icons` ditulis lengkap karena metadata antar-segmen
 * digabung dangkal: objek milik halaman MENGGANTI milik layout akar, bukan
 * menambahinya.
 */
export const ownerAppMetadata = {
  manifest: OWNER_APP.manifest,
  appleWebApp: {
    capable: true,
    // Sama dengan layout akar; alasannya ditulis di sana.
    statusBarStyle: "default",
    title: OWNER_APP.nama,
  },
  icons: {
    icon: "/icon-192.png",
    // iPhone memakai ikon ini, bukan ikon di manifest, saat "Tambah ke Layar Utama".
    apple: "/owner/apple-touch-icon.png",
  },
} satisfies Metadata;
