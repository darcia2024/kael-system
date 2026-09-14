import type { Metadata } from "next";

import { db } from "@/lib/db";
import { guardOwnerPage } from "@/lib/licensing";
import { mochiThemeClass } from "@/lib/mochi-theme";
import KartuClient from "./kartu-client";

/**
 * Pengaturan isi kartu member.
 *
 * Khusus pemilik. Yang diatur di sini dibaca pelanggan, bukan staf — jam buka
 * yang salah dan promo yang sudah lewat merugikan tokonya sendiri, jadi
 * penulisnya harus orang yang bertanggung jawab atas keduanya.
 *
 * Logo dan warna TIDAK ada di layar ini. Keduanya kolom `businesses` yang
 * disiapkan tim KAEL saat memasang tenant; pemilik usaha tinggal memakai.
 */

export const metadata: Metadata = {
  title: "Isi Kartu Member",
  robots: { index: false, follow: false },
};

export default async function KartuMemberPage() {
  const session = await guardOwnerPage("/app/loyalty/kartu");

  const [settings, business, program, rewards] = await Promise.all([
    db.getMemberCardSettings(session.businessId),
    db.getBusiness(session.businessId),
    db.getLoyaltyProgram(session.businessId),
    db.getRewards(session.businessId),
  ]);

  return (
    <KartuClient
      themeClassName={mochiThemeClass(business)}
      settings={settings}
      storeCode={business?.store_code ?? null}
      businessName={business?.name ?? "Usaha Anda"}
      minimumPurchase={Number(program?.minimum_purchase ?? 0)}
      mode={program?.mode ?? "point"}
      /** Hadiah termurah menentukan berapa kotak yang digambar di kartu stempel. */
      targetStempel={
        rewards.filter((r) => r.is_active).sort((a, b) => a.point_cost - b.point_cost)[0]
          ?.point_cost ?? null
      }
    />
  );
}
