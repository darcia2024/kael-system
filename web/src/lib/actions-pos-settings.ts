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

