import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { db } from "@/lib/db";

import { getModuleViews, guardOwnerPage } from "@/lib/licensing";
import { ownerAppMetadata } from "@/lib/owner-app";
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
  ...ownerAppMetadata,
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

  const session = await guardOwnerPage("/app");

  const [business, views, users] = await Promise.all([
    db.getBusiness(session.businessId),
    getModuleViews(session.businessId),
    // guardOwnerPage sudah memastikan yang sampai di sini pasti pemilik usaha.
    db.getUsers(session.businessId),
  ]);

  const businessType = (business?.business_type ?? "kuliner") as BusinessType;

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
    (m) => views.get(m.key)?.state !== "tidak_dimiliki" || (m.available && cocokUntukUsaha.has(m.key)),
  );

  /**
   * Penawaran modul hanya masuk akal di halaman ini, dan halaman ini hanya
   * untuk pemilik usaha. Kasir punya berandanya sendiri di /app/staff yang
   * memang tidak pernah mengambil data harga maupun penawaran.
   */
  const belumDimiliki = tampil.filter((m) => views.get(m.key)?.state === "tidak_dimiliki");

  const signals = belumDimiliki.length
    ? await db.getUpsellSignals(session.businessId)
    : null;

  const modules: PortalModule[] = tampil
    .map((entry): PortalModule | null => {
      const view = views.get(entry.key);
      const license = view && view.state !== "tidak_dimiliki" ? view : null;

      // Belum dibeli: kartu penawaran.
      if (!license) {
        return {
          key: entry.key,
          name: entry.name,
          tagline: entry.tagline,
          href: null,
          state: "tidak_dimiliki",
          status: "tidak_dimiliki",
          setupHint: null,
          setupHref: null,
          expiresAt: null,
          daysLeft: 0,
          price: entry.price,
          renewal: entry.renewal,
          hook: buildHook(entry.key, signals),
        };
      }

      return {
        key: entry.key,
        name: entry.name,
        tagline: entry.tagline,
        href: license.canRead ? entry.href : null,
        state: license.state,
        status: license.status,
        setupHint: license.setupHint,
        setupHref: license.setupHref,
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
