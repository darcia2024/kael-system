"use server";

import { revalidatePath } from "next/cache";

import { requireOwner } from "./auth";
import { moduleLock } from "./licensing";
import { db } from "./db";
import type { ActionResult } from "./actions";

export async function savePosChargeSettingsAction(
  taxRate: number,
  serviceChargeRate: number,
): Promise<ActionResult<{ taxRate: number; serviceChargeRate: number }>> {
  const { businessId } = await requireOwner();
  const locked = await moduleLock(businessId, "pos", "write");
  if (locked) return { ok: false, error: locked };

  const tax = Number(taxRate);
  const service = Number(serviceChargeRate);
  if (!Number.isFinite(tax) || !Number.isFinite(service) || tax < 0 || tax > 100 || service < 0 || service > 100) {
    return { ok: false, error: "Tarif harus berupa angka antara 0 sampai 100%." };
  }

  const updated = await db.updateBusiness(businessId, {
    pos_tax_rate: Math.round(tax * 100) / 100,
    pos_service_charge_rate: Math.round(service * 100) / 100,
  });
  if (!updated) return { ok: false, error: "Pengaturan usaha tidak ditemukan." };
  revalidatePath("/app/settings");
  revalidatePath("/app/pos");
  return { ok: true, data: { taxRate: Number(updated.pos_tax_rate), serviceChargeRate: Number(updated.pos_service_charge_rate) } };
}

/**
 * Cara toko ini memakai menu digitalnya.
 *
 * Bukan sekadar pilihan tampilan: yang berubah adalah siapa yang mengetik
 * pesanan dan kapan uangnya diterima. Karena itu setelannya di tangan owner,
 * bukan kasir — kasir yang bisa mengubahnya berarti bisa memindahkan waktu
 * pembayaran ke belakang tanpa sepengetahuan pemiliknya.
 */
export async function saveQrMenuModeAction(
  mode: "pesan_bayar" | "lihat_panggil",
): Promise<ActionResult<{ mode: string }>> {
  const { businessId } = await requireOwner();

  if (mode !== "pesan_bayar" && mode !== "lihat_panggil") {
    return { ok: false, error: "Mode menu digital tidak dikenali." };
  }

  const updated = await db.updateBusiness(businessId, { qr_menu_mode: mode });
  if (!updated) return { ok: false, error: "Pengaturan usaha tidak ditemukan." };

  revalidatePath("/app/settings");
  revalidatePath("/app/pos");
  // Halaman menu digital dirender per permintaan, tapi tautannya dibuka tamu
  // dari QR yang sudah tercetak — jadi seluruh cabangnya ikut disegarkan.
  revalidatePath("/order", "layout");

  return { ok: true, data: { mode } };
}

/**
 * Kapan uangnya diterima kasir.
 *
 * Bukan setelan tampilan: yang berubah adalah kapan sebuah nota dinyatakan
 * lunas, dan itu ikut menentukan rekap tutup shift, laporan penjualan, serta
 * kapan poin member dihitung. Karena itu hanya owner yang boleh mengubahnya.
 */
export async function savePaymentTimingAction(
  timing: "di_depan" | "di_akhir",
): Promise<ActionResult<{ timing: string }>> {
  const { businessId } = await requireOwner();

  if (timing !== "di_depan" && timing !== "di_akhir") {
    return { ok: false, error: "Waktu pembayaran tidak dikenali." };
  }

  /**
   * Masih ada meja yang tagihannya menggantung? Perubahannya ditahan.
   *
   * Memindahkan aturan di tengah jalan membuat nota yang sudah telanjur
   * dicatat belum lunas kehilangan layar tempat menagihnya — tombol
   * "Terima Pembayaran" cuma muncul di alur bayar-di-akhir.
   */
  if (timing === "di_depan") {
    const menggantung = await db.getTableSessionSummaries(businessId);
    const belumLunas = menggantung.filter((s) => s.has_unpaid);
    if (belumLunas.length) {
      const daftar = belumLunas.map((s) => `Meja ${s.table_no}`).join(", ");
      return {
        ok: false,
        error: `Masih ada tagihan yang belum dibayar di ${daftar}. Selesaikan dulu pembayarannya, baru ubah setelan ini.`,
      };
    }
  }

  const updated = await db.updateBusiness(businessId, { pos_payment_timing: timing });
  if (!updated) return { ok: false, error: "Pengaturan usaha tidak ditemukan." };

  revalidatePath("/app/settings");
  revalidatePath("/app/pos");

  return { ok: true, data: { timing } };
}

export async function saveBusinessContactSettingsAction(
  phone: string,
  address?: string,
): Promise<ActionResult<{ phone: string; address: string }>> {
  const { businessId } = await requireOwner();

  const cleanPhone = (phone || "").trim();
  const cleanAddress = (address || "").trim();

  // Validasi nomor telepon jika diisi
  if (cleanPhone) {
    const digitsOnly = cleanPhone.replace(/\D/g, "");
    if (digitsOnly.length < 9 || digitsOnly.length > 15) {
      return { ok: false, error: "Nomor WhatsApp tidak valid. Masukkan 9-15 digit angka (contoh: 081234567890)." };
    }
  }

  const updated = await db.updateBusiness(businessId, {
    phone: cleanPhone,
    address: cleanAddress,
  });

  if (!updated) return { ok: false, error: "Data usaha tidak ditemukan." };

  revalidatePath("/app/settings");
  revalidatePath("/app/pos");
  revalidatePath("/m", "layout");
  revalidatePath("/order", "layout");

  return {
    ok: true,
    data: {
      phone: updated.phone || "",
      address: updated.address || "",
    },
  };
}


/**
 * Pembatas pengembalian dana oleh staf.
 *
 * Ada karena rekonsiliasi laci TIDAK pernah menangkap penipuan refund. Uang
 * pelanggan masuk, dicatat keluar, dan selisih lacinya tetap nol — jadi "cocok
 * saat tutup shift" bukan bukti apa-apa untuk jenis kecurangan ini.
 *
 * Batas ini tidak membuatnya mustahil; yang memegang uang fisik sekaligus
 * entrinya tetap kasir. Yang dilakukannya adalah memagari seberapa jauh
 * kerugian bisa berjalan sebelum polanya sempat terbaca, dan memindahkan yang
 * besar ke tangan pemiliknya.
 */
export async function saveRefundLimitsAction(
  maxPerTransaction: number,
  dailyLimitPerCashier: number,
): Promise<ActionResult<{ maxPerTransaction: number; dailyLimitPerCashier: number }>> {
  const { businessId } = await requireOwner();
  const locked = await moduleLock(businessId, "pos", "write");
  if (locked) return { ok: false, error: locked };

  const sekali = Math.round(Number(maxPerTransaction));
  const harian = Math.round(Number(dailyLimitPerCashier));

  if (!Number.isFinite(sekali) || !Number.isFinite(harian) || sekali < 0 || harian < 0) {
    return { ok: false, error: "Batas refund tidak boleh minus." };
  }

  /**
   * Batas harian di bawah batas sekali transaksi tidak pernah bisa terpakai:
   * refund sebesar batas sekali langsung melewati jatah hariannya. Ditolak di
   * sini supaya owner tidak menyetel aturan yang diam-diam saling meniadakan.
   */
  if (sekali > 0 && harian > 0 && harian < sekali) {
    return {
      ok: false,
      error: "Batas harian tidak boleh lebih kecil dari batas sekali refund — aturannya akan saling meniadakan.",
    };
  }

  const updated = await db.updateBusiness(businessId, {
    refund_max_per_transaction: sekali,
    refund_daily_limit_per_cashier: harian,
  });
  if (!updated) return { ok: false, error: "Pengaturan usaha tidak ditemukan." };

  revalidatePath("/app/settings");
  revalidatePath("/app/pos");
  return {
    ok: true,
    data: {
      maxPerTransaction: Number(updated.refund_max_per_transaction),
      dailyLimitPerCashier: Number(updated.refund_daily_limit_per_cashier),
    },
  };
}
