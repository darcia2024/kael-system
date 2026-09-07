import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { db } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { getLicenses } from "@/lib/licensing";
import { MODULE_BY_KEY } from "@/lib/modules-catalog";
import { STAFF_PERMISSIONS, type StaffPermission } from "@/lib/types";
import StaffHomeClient, { type StaffModule } from "./staff-client";

/**
 * Beranda kasir.
 *
 * Halaman ini ada karena kasir sebelumnya memakai beranda yang SAMA dengan
 * pemilik usaha. Yang bukan haknya disembunyikan satu per satu di dalam
 * komponen kliennya, dan satu blok yang lupa diberi syarat — panel "Kelola Akun
 * Staf" — tetap terlihat olehnya.
 *
 * Memisahkan alamatnya membuat kesalahan seperti itu tidak bisa terulang:
 * tidak ada satu pun data pemilik yang diambil di sini, jadi tidak ada yang
 * bisa bocor karena lupa diberi syarat. Yang tidak diambil tidak bisa tampil.
 *
 * Yang sengaja TIDAK ada di halaman ini: daftar akun staf, harga modul, tanggal
 * jatuh tempo langganan, penawaran pembelian, dan pengaturan usaha.
 */

export const metadata: Metadata = {
  title: "Beranda Kasir",
  robots: { index: false, follow: false },
};

export default async function StaffHomePage({
  searchParams,
}: {
  searchParams: Promise<{ ditolak?: string; terkunci?: string }>;
}) {
  const session = await getSession();
  if (!session) redirect("/app/login?next=/app/staff");
  if (session.role === "kael_admin") redirect("/admin/businesses");
  if (!session.businessId) redirect("/app/login");

  // Pemilik usaha punya berandanya sendiri yang lebih lengkap. Membiarkannya
  // mendarat di sini cuma membuat dia kehilangan setengah aplikasinya.
  if (session.role === "owner") redirect("/app");

  const { ditolak, terkunci } = await searchParams;

  const [business, licenses] = await Promise.all([
    db.getBusiness(session.businessId),
    getLicenses(session.businessId),
  ]);

  const izin = (session.permissions ?? []) as StaffPermission[];

  /**
   * Sebuah modul tampil hanya kalau DUA-DUANYA lulus: usahanya memang
   * memilikinya, dan pemilik usaha memang memberikan aksesnya ke kasir ini.
   * Keduanya diperiksa lagi di halaman modulnya masing-masing lewat
   * guardModulePage, jadi daftar ini menentukan tampilan, bukan keamanan.
   */
  const modules: StaffModule[] = STAFF_PERMISSIONS.filter((p) => izin.includes(p.key))
    .map((p) => {
      const entry = MODULE_BY_KEY[p.key];
      const license = licenses.get(p.key);
      if (!entry || !license?.canRead) return null;
      return {
        key: p.key,
        name: entry.name,
        hint: p.hint,
        href: entry.href,
        // Kasir perlu tahu kalau modul sedang baca-saja, supaya dia tidak
        // menyalahkan dirinya sendiri saat tombol simpan menolak bekerja.
        readOnly: !license.canWrite,
      };
    })
    .filter((m): m is StaffModule => m !== null);

  const pesan =
    ditolak === "area-pemilik"
      ? "Bagian itu khusus pemilik usaha. Kamu sudah kembali ke berandamu."
      : ditolak
        ? "Bagian itu belum diberikan untukmu oleh pemilik usaha."
        : terkunci
          ? "Modul itu sedang tidak aktif untuk usaha ini."
          : null;

  return (
    <StaffHomeClient
      businessName={business?.name ?? "KAEL"}
      staffName={session.name}
      modules={modules}
      hrEnabled={Boolean(licenses.get("hr")?.canRead)}
      notice={pesan}
    />
  );
}
