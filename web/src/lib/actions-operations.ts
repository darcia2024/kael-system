"use server";

import { revalidatePath } from "next/cache";

import { requireOwner, requireStaff } from "./auth";
import { db } from "./db";
import { moduleLock } from "./licensing";

export type OperationResult<T = null> = { ok: true; data: T } | { ok: false; error: string };
const ok = <T,>(data: T): OperationResult<T> => ({ ok: true, data });
const fail = (error: string): OperationResult<never> => ({ ok: false, error });

export async function saveBrandSettingsAction(data: { appName: string; accentColor: string; supportEmail?: string; footer?: string; customDomain?: string }): Promise<OperationResult> {
  const { businessId, userId } = await requireOwner();
  if (data.appName.trim().length < 2 || data.appName.trim().length > 80) return fail("Nama tampilan harus 2 sampai 80 karakter.");
  if (!/^#[0-9A-Fa-f]{6}$/.test(data.accentColor)) return fail("Warna utama tidak valid.");
  const domain = data.customDomain?.trim().toLowerCase() || null;
  if (domain && !/^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9-]+)+$/.test(domain)) return fail("Domain harus berupa nama domain tanpa https://.");
  await db.saveBrandSettings(businessId, { app_name: data.appName.trim(), accent_color: data.accentColor, support_email: data.supportEmail?.trim() || null, public_footer_text: data.footer?.trim() || null, custom_domain: domain });
  await db.recordAuditEvent({ businessId, actorUserId: userId, action: "tenant.branding_saved", entityType: "business", entityId: businessId });
  revalidatePath("/app/settings");
  return ok(null);
}

export async function saveMessagingChannelAction(data: { provider: "manual" | "meta_cloud" | "gateway"; senderPhone?: string; phoneNumberId?: string; businessAccountId?: string; secretRef?: string; enabled: boolean }): Promise<OperationResult> {
  const { businessId, userId } = await requireOwner();
  if (data.provider === "meta_cloud" && (!data.senderPhone?.trim() || !data.phoneNumberId?.trim() || !data.secretRef?.trim())) return fail("Untuk Meta Cloud, isi nomor pengirim, Phone Number ID, dan nama secret token.");
  await db.saveMessagingChannel(businessId, { provider: data.provider, sender_phone: data.senderPhone?.trim() || null, phone_number_id: data.phoneNumberId?.trim() || null, business_account_id: data.businessAccountId?.trim() || null, secret_ref: data.secretRef?.trim() || null, is_enabled: data.enabled });
  await db.recordAuditEvent({ businessId, actorUserId: userId, action: "messaging.channel_saved", entityType: "business", entityId: businessId, metadata: { provider: data.provider } });
  revalidatePath("/app/settings");
  return ok(null);
}

export async function saveSupplierAction(data: { id?: string; name: string; phone?: string; email?: string; address?: string; paymentTermsDays?: number; taxNumber?: string }): Promise<OperationResult> {
  const { businessId, userId } = await requireOwner();
  const locked = await moduleLock(businessId, "finance", "write"); if (locked) return fail(locked);
  if (data.name.trim().length < 2) return fail("Nama supplier belum lengkap.");
  const item = await db.saveSupplier(businessId, { id: data.id, name: data.name.trim(), phone: data.phone?.trim() || null, email: data.email?.trim() || null, address: data.address?.trim() || null, payment_terms_days: Number(data.paymentTermsDays ?? 0), tax_number: data.taxNumber?.trim() || null }) as { id?: string } | null;
  await db.recordAuditEvent({ businessId, actorUserId: userId, action: "finance.supplier_saved", entityType: "supplier", entityId: item?.id as string | undefined });
  revalidatePath("/app/finance/operations"); return ok(null);
}

export async function createSupplierBillAction(data: { supplierId: string; billNo: string; issuedOn: string; dueOn?: string; totalAmount: number; note?: string }): Promise<OperationResult> {
  const { businessId, userId } = await requireOwner();
  const locked = await moduleLock(businessId, "finance", "write"); if (locked) return fail(locked);
  if (!data.supplierId || !data.billNo.trim() || !Number.isInteger(data.totalAmount) || data.totalAmount < 1) return fail("Isi supplier, nomor tagihan, dan nominal yang benar.");
  const bill = await db.createSupplierBill(businessId, userId, { supplier_id: data.supplierId, bill_no: data.billNo.trim(), issued_on: data.issuedOn, due_on: data.dueOn || null, total_amount: data.totalAmount, note: data.note?.trim() || null });
  if (!bill) return fail("Supplier tidak ditemukan.");
  revalidatePath("/app/finance/operations"); return ok(null);
}

export async function approveStockOpnameAction(opnameId: string, approve: boolean, note?: string): Promise<OperationResult> {
  const { businessId, userId } = await requireOwner();
  const locked = await moduleLock(businessId, "finance", "write"); if (locked) return fail(locked);
  if (!await db.approveStockOpname(businessId, userId, opnameId, approve, note)) return fail("Stock opname sudah diproses atau tidak ditemukan.");
  await db.recordAuditEvent({ businessId, actorUserId: userId, action: approve ? "inventory.opname_approved" : "inventory.opname_rejected", entityType: "stock_opname", entityId: opnameId });
  revalidatePath("/app/finance/operations"); return ok(null);
}

export async function saveOrderingSettingsAction(data: { isOpen: boolean; minimumOrder: number; opensAt?: string; closesAt?: string; deliveryEnabled: boolean; pickupEnabled: boolean }): Promise<OperationResult> {
  const { businessId } = await requireOwner();
  const locked = await moduleLock(businessId, "pos", "write"); if (locked) return fail(locked);
  if (!Number.isInteger(data.minimumOrder) || data.minimumOrder < 0) return fail("Minimum order tidak valid.");
  await db.saveOrderingSettings(businessId, { is_open: data.isOpen, minimum_order: data.minimumOrder, opens_at: data.opensAt || null, closes_at: data.closesAt || null, delivery_enabled: data.deliveryEnabled, pickup_enabled: data.pickupEnabled });
  revalidatePath("/app/pos"); return ok(null);
}

export async function saveDeliveryZoneAction(data: { id?: string; name: string; postalCodes: string; fee: number; minimumOrder: number; active: boolean }): Promise<OperationResult> {
  const { businessId } = await requireOwner();
  const locked = await moduleLock(businessId, "pos", "write"); if (locked) return fail(locked);
  if (data.name.trim().length < 2 || data.fee < 0 || data.minimumOrder < 0) return fail("Data area delivery belum benar.");
  await db.saveDeliveryZone(businessId, { id: data.id, name: data.name.trim(), postal_codes: data.postalCodes.split(",").map((v) => v.trim()).filter(Boolean), fee: Math.round(data.fee), minimum_order: Math.round(data.minimumOrder), is_active: data.active });
  revalidatePath("/app/pos"); return ok(null);
}

export async function saveBookingServiceAction(data: { id?: string; name: string; durationMinutes: number; price: number; depositAmount: number; capacity: number; active: boolean }): Promise<OperationResult> {
  const { businessId } = await requireOwner();
  const locked = await moduleLock(businessId, "booking", "write"); if (locked) return fail(locked);
  if (data.name.trim().length < 2 || data.durationMinutes < 5 || data.price < 0 || data.depositAmount < 0 || data.capacity < 1) return fail("Data layanan belum benar.");
  await db.saveBookingService(businessId, { id: data.id, name: data.name.trim(), duration_minutes: Math.round(data.durationMinutes), price: Math.round(data.price), deposit_amount: Math.round(data.depositAmount), capacity: Math.round(data.capacity), is_active: data.active });
  revalidatePath("/app/booking"); return ok(null);
}

export async function createPublicBookingAction(businessId: string, data: { serviceId: string; staffUserId?: string; customerName: string; customerPhone: string; startsAt: string; note?: string }): Promise<OperationResult<{ id: string; publicToken: string; depositAmount: number }>> {
  const locked = await moduleLock(businessId, "booking", "write"); if (locked) return fail("Booking belum tersedia untuk usaha ini.");
  if (data.customerName.trim().length < 2 || data.customerPhone.trim().length < 8) return fail("Isi nama dan nomor WhatsApp yang benar.");
  const result = await db.createAppointment(businessId, { service_id: data.serviceId, staff_user_id: data.staffUserId || null, customer_name: data.customerName.trim(), customer_phone: data.customerPhone.trim(), starts_at: data.startsAt, note: data.note?.trim() || null });
  if (!result.appointment) return fail(result.error ?? "Slot tidak tersedia.");
  const appointment = result.appointment as { id: string; public_token: string; deposit_amount: number };
  return ok({ id: appointment.id, publicToken: appointment.public_token, depositAmount: Number(appointment.deposit_amount) });
}

export async function updateBookingStatusAction(id: string, status: "confirmed" | "completed" | "cancelled" | "no_show"): Promise<OperationResult> {
  const { businessId } = await requireOwner();
  const locked = await moduleLock(businessId, "booking", "write"); if (locked) return fail(locked);
  if (!await db.updateAppointmentStatus(businessId, id, status)) return fail("Booking tidak ditemukan.");
  revalidatePath("/app/booking"); return ok(null);
}

export async function saveStaffScheduleAction(data: { userId: string; startsAt: string; endsAt: string; roleLabel?: string; posShiftAllowed: boolean }): Promise<OperationResult> {
  const { businessId } = await requireOwner();
  if (Date.parse(data.endsAt) <= Date.parse(data.startsAt)) return fail("Jam selesai harus setelah jam mulai.");
  if (!await db.saveStaffSchedule(businessId, { user_id: data.userId, starts_at: data.startsAt, ends_at: data.endsAt, role_label: data.roleLabel?.trim() || null, pos_shift_allowed: data.posShiftAllowed })) return fail("Staf tidak ditemukan.");
  revalidatePath("/app/hr"); return ok(null);
}

export async function recordAttendanceAction(data: { direction: "in" | "out"; siteId?: string; latitude?: number; longitude?: number; selfieUrl?: string; method: "self" | "qr" | "nfc" | "location" }): Promise<OperationResult> {
  const session = await requireStaff();
  if (!session.businessId) return fail("Akun belum terhubung ke usaha.");
  const entry = await db.createAttendanceRecord(session.businessId, session.userId, { direction: data.direction, attendance_site_id: data.siteId || null, latitude: data.latitude ?? null, longitude: data.longitude ?? null, selfie_url: data.selfieUrl ?? null, method: data.method });
  if (!entry) return fail(data.direction === "in" ? "Kamu masih tercatat masuk, selesaikan absensi pulang dulu." : "Belum ada absensi masuk yang bisa ditutup.");
  revalidatePath("/app/hr"); return ok(null);
}
