import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { db } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { getLicenses } from "@/lib/licensing";
import {
  MODULE_CATALOG,
  modulesForBusinessType,
  type BusinessType,
  type ModuleKey,
} from "@/lib/modules-catalog";
import PortalClient, { type PortalModule } from "./portal-client";

/**
 * Beranda aplikasi setelah masuk.
 *
 * Penjagaan peran ada di sini, bukan hanya di proxy.ts. Proxy hanya memeriksa
 * keberadaan cookie tanpa memverifikasinya, dan dokumentasi Next menyatakan
 * proxy bukan tempat untuk otorisasi.
 *
 * Halaman ini yang memutuskan modul mana yang tampil, dalam keadaan apa, dan
 * modul mana yang ditawarkan. Semua perhitungannya di server: klien menerima
 * daftar jadi dan tidak pernah melihat aturan lisensinya.
 */

export const metadata: Metadata = {
  title: "Beranda Bisnis",
  robots: { index: false, follow: false },
};

/**
 * Ambang angka yang layak dipamerkan.
 *
 * "3 transaksi bulan ini, mau tahu untungnya?" itu menjual dengan angka yang
 * justru meyakinkan orang untuk tidak membeli. Di bawah ambang ini, kartu
 * memakai kalimat manfaat biasa dan tidak menyebut angka sama sekali.
 */
const CUKUP = { pesanan: 20, item: 10, pelanggan: 10 };

type Signals = Awaited<ReturnType<typeof db.getUpsellSignals>>;

/** Kalimat pemicu dari data toko sendiri. Null kalau datanya belum cukup. */
function buildHook(module: ModuleKey, s: Signals | null): string | null {
  if (!s) return null;

  switch (module) {
    case "finance":
      if (s.topItem && s.topItem.qty >= CUKUP.item) {
        return `${s.topItem.name} terjual ${s.topItem.qty} kali dalam 30 hari terakhir. Sudah tahu untung bersih per porsinya?`;
      }
      if (s.paidOrders30d >= CUKUP.pesanan) {
        return `${s.paidOrders30d} transaksi dalam 30 hari terakhir. Omzetnya sudah kelihatan, untungnya belum.`;
      }
      return null;

    case "loyalty":
      if (s.paidOrders30d >= CUKUP.pesanan) {
        return `${s.paidOrders30d} transaksi dalam 30 hari terakhir. Berapa di antaranya pelanggan yang kembali?`;
      }
      return null;

    case "review":
      if (s.paidOrders30d >= CUKUP.pesanan) {
        return `${s.paidOrders30d} pelanggan dilayani dalam 30 hari terakhir. Berapa yang meninggalkan ulasan Google?`;
      }
      if (s.customers >= CUKUP.pelanggan) {
        return `${s.customers} pelanggan sudah terdaftar. Belum ada yang diajak menulis ulasan.`;
      }
      return null;

    case "pos":
      if (s.customers >= CUKUP.pelanggan) {
        return `${s.customers} pelanggan sudah terdaftar, tapi penjualannya belum tercatat di sistem.`;
      }
      if (s.taps30d >= CUKUP.pelanggan) {
        return `${s.taps30d} tap kartu ulasan bulan ini. Transaksinya masih dicatat di luar sistem.`;
      }
      return null;

    default:
      return null;
  }
}

export default async function AppPortalPage({
  searchParams,
}: {
  searchParams: Promise<{ terkunci?: string; ditolak?: string }>;
}) {
  const { terkunci, ditolak } = await searchParams;

  const session = await getSession();
  if (!session) redirect("/app/login?next=/app");
  if (session.role === "kael_admin") redirect("/admin/cards");
  if (!session.businessId) redirect("/app/login");

  const [business, licenses, users] = await Promise.all([
    db.getBusiness(session.businessId),
    getLicenses(session.businessId),
    // Kasir tidak perlu melihat daftar akun; hanya owner yang mengelolanya.
    session.role === "owner" ? db.getUsers(session.businessId) : Promise.resolve([]),
  ]);

  const businessType = (business?.business_type ?? "kuliner") as BusinessType;
  const isOwner = session.role === "owner";

  /**
   * Penyaringan relevansi hanya menentukan apa yang DITAWARKAN.
   *
   * Modul yang sudah dibeli selalu tampil, apa pun jenis usahanya. Kalau
   * relevansi ikut menyaring yang dimiliki, sebuah barbershop yang terlanjur
   * membeli KAEL Finance akan kehilangan akses ke modul yang sudah dibayarnya
   * hanya karena jenis usahanya diubah di panel admin.
   */
  const cocokUntukUsaha = new Set(modulesForBusinessType(businessType).map((m) => m.key));

  const tampil = MODULE_CATALOG.filter(
    (m) => licenses.has(m.key) || (m.available && isOwner && cocokUntukUsaha.has(m.key)),
  );

  /**
   * Penawaran hanya untuk owner. Kasir yang melihat kartu "beli modul lain"
   * cuma menambah kebisingan di layar yang dia pakai kerja, dan keputusan
   * belanja bukan wewenangnya.
   */
  const belumDimiliki = tampil.filter((m) => !licenses.has(m.key));

  const signals = belumDimiliki.length
    ? await db.getUpsellSignals(session.businessId)
    : null;

  const modules: PortalModule[] = tampil
    .map((entry): PortalModule | null => {
      const license = licenses.get(entry.key);

      // Belum dibeli: kartu penawaran, dan hanya untuk owner.
      if (!license) {
        if (!isOwner) return null;
        return {
          key: entry.key,
          name: entry.name,
          tagline: entry.tagline,
          href: null,
          state: "tidak_dimiliki",
          expiresAt: null,
          daysLeft: 0,
          price: entry.price,
          renewal: entry.renewal,
          hook: buildHook(entry.key, signals),
        };
      }

      // Sudah dibeli: kasir hanya melihat yang diizinkan owner-nya.
      const grantable = entry.key === "pos" || entry.key === "loyalty" || entry.key === "review";
      if (!isOwner) {
        if (!grantable) return null;
        if (!session.permissions?.includes(entry.key as "pos" | "loyalty" | "review")) return null;
      }

      return {
        key: entry.key,
        name: entry.name,
        tagline: entry.tagline,
        href: license.canRead ? entry.href : null,
        state: license.state,
        expiresAt: license.expiresAt,
        daysLeft: license.daysLeft,
        price: entry.price,
        renewal: entry.renewal,
        hook: null,
      };
    })
    .filter((m): m is PortalModule => m !== null);

  return (
    <PortalClient
      business={business}
      modules={modules}
      users={users}
      sessionName={session.name}
      sessionRole={session.role}
      sessionPermissions={session.permissions ?? []}
      notice={
        terkunci
          ? { kind: "terkunci" as const, module: terkunci }
          : ditolak
            ? { kind: "ditolak" as const, module: ditolak }
            : null
      }
    />
  );
}
