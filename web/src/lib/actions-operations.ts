"use server";

import { revalidatePath } from "next/cache";

import { requireOwner, requireStaff } from "./auth";
import { db } from "./db";
import { moduleLock } from "./licensing";
import { getGooglePlaceLocation, isPlacesSearchConfigured, searchPlaces } from "./google-places";
import { CARD_SERVICE_LABEL } from "./types";

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

export async function saveMessagingChannelAction(data: {
  provider: "manual" | "meta_cloud" | "gateway";
  senderPhone?: string;
  /**
   * Nomor yang MENERIMA kabar operasional, terpisah dari nomor PENGIRIM.
   *
   * Owner sering bukan orang yang memegang HP toko. Tanpa pemisahan ini,
   * pesanan masuk dan selisih shift dikirim ke nomor toko dan menumpuk
   * bersama chat pelanggan — yang artinya tidak pernah benar-benar dibaca.
   */
  ownerNotifyPhone?: string;
  phoneNumberId?: string;
  businessAccountId?: string;
  secretRef?: string;
  enabled: boolean;
}): Promise<OperationResult> {
  const { businessId, userId } = await requireOwner();
  if (data.provider === "meta_cloud" && (!data.senderPhone?.trim() || !data.phoneNumberId?.trim() || !data.secretRef?.trim())) return fail("Untuk Meta Cloud, isi nomor pengirim, Phone Number ID, dan nama secret token.");

  // Disimpan dalam bentuk wa.me: kode negara, tanpa "+", tanpa nol di depan.
  // 081311506025 menjadi 6281311506025.
  const notifPhone = data.ownerNotifyPhone?.replace(/[^0-9]/g, "").replace(/^0/, "62") || null;
  if (notifPhone && (notifPhone.length < 9 || notifPhone.length > 15)) {
    return fail("Nomor penerima notifikasi tidak valid. Tulis nomor WhatsApp yang benar-benar aktif.");
  }

  await db.saveMessagingChannel(businessId, { provider: data.provider, sender_phone: data.senderPhone?.trim() || null, owner_notify_phone: notifPhone, phone_number_id: data.phoneNumberId?.trim() || null, business_account_id: data.businessAccountId?.trim() || null, secret_ref: data.secretRef?.trim() || null, is_enabled: data.enabled });
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

export async function deleteDeliveryZoneAction(zoneId: string): Promise<OperationResult> {
  const { businessId } = await requireOwner();
  const locked = await moduleLock(businessId, "pos", "write"); if (locked) return fail(locked);
  if (!await db.deleteDeliveryZone(businessId, zoneId)) return fail("Area delivery tidak ditemukan.");
  revalidatePath("/app/pos/ordering"); return ok(null);
}

export async function saveBookingServiceAction(data: { id?: string; name: string; durationMinutes: number; price: number; depositAmount: number; capacity: number; active: boolean }): Promise<OperationResult> {
  const { businessId } = await requireOwner();
  const locked = await moduleLock(businessId, "booking", "write"); if (locked) return fail(locked);
  if (data.name.trim().length < 2 || data.durationMinutes < 5 || data.price < 0 || data.depositAmount < 0 || data.capacity < 1) return fail("Data layanan belum benar.");
  await db.saveBookingService(businessId, { id: data.id, name: data.name.trim(), duration_minutes: Math.round(data.durationMinutes), price: Math.round(data.price), deposit_amount: Math.round(data.depositAmount), capacity: Math.round(data.capacity), is_active: data.active });
  revalidatePath("/app/booking"); return ok(null);
}

export async function saveBookingScheduleAction(data: { id?: string; userId?: string; dayOfWeek: number; startsAt: string; endsAt: string; intervalMinutes: number; active: boolean }): Promise<OperationResult> {
  const { businessId } = await requireOwner();
  const locked = await moduleLock(businessId, "booking", "write"); if (locked) return fail(locked);
  if (!Number.isInteger(data.dayOfWeek) || data.dayOfWeek < 0 || data.dayOfWeek > 6 || data.startsAt >= data.endsAt || data.intervalMinutes < 5 || data.intervalMinutes > 240) return fail("Jadwal slot belum benar.");
  await db.saveBookingSchedule(businessId, { id: data.id, user_id: data.userId || null, day_of_week: data.dayOfWeek, starts_at: data.startsAt, ends_at: data.endsAt, slot_interval_minutes: data.intervalMinutes, is_active: data.active });
  revalidatePath("/app/booking"); return ok(null);
}

export async function deleteBookingScheduleAction(scheduleId: string): Promise<OperationResult> {
  const { businessId } = await requireOwner();
  const locked = await moduleLock(businessId, "booking", "write"); if (locked) return fail(locked);
  if (!await db.deleteBookingSchedule(businessId, scheduleId)) return fail("Jadwal tidak ditemukan.");
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

export async function createBookingWaitlistAction(businessId: string, data: { serviceId: string; customerName: string; customerPhone: string; preferredStart?: string }): Promise<OperationResult> {
  const locked = await moduleLock(businessId, "booking", "write"); if (locked) return fail("Booking belum tersedia untuk usaha ini.");
  if (!data.serviceId || data.customerName.trim().length < 2 || data.customerPhone.trim().length < 8) return fail("Isi nama dan nomor WhatsApp yang benar.");
  await db.createBookingWaitlist(businessId, { service_id: data.serviceId, customer_name: data.customerName.trim(), customer_phone: data.customerPhone.trim(), preferred_start: data.preferredStart || null });
  return ok(null);
}

export async function updatePublicBookingAction(token: string, input: { cancel?: boolean; startsAt?: string }): Promise<OperationResult<{ publicToken?: string }>> {
  if (!/^[0-9a-f-]{36}$/i.test(token)) return fail("Tautan booking tidak valid.");
  const appointment = await db.updatePublicAppointment(token, input.startsAt ?? null, Boolean(input.cancel)) as { public_token?: string } | null;
  if (!appointment) return fail("Booking tidak dapat diubah. Mungkin slot sudah tidak tersedia atau booking telah selesai.");
  return ok({ publicToken: appointment.public_token });
}

export async function updateBookingStatusAction(id: string, status: "confirmed" | "completed" | "cancelled" | "no_show"): Promise<OperationResult> {
  const { businessId } = await requireOwner();
  const locked = await moduleLock(businessId, "booking", "write"); if (locked) return fail(locked);
  if (!await db.updateAppointmentStatus(businessId, id, status)) return fail("Booking tidak ditemukan.");
  revalidatePath("/app/booking"); return ok(null);
}

export async function saveStaffScheduleAction(data: { userId: string; startsAt: string; endsAt: string; roleLabel?: string; posShiftAllowed: boolean }): Promise<OperationResult> {
  const { businessId } = await requireOwner();
  const locked = await moduleLock(businessId, "hr", "write"); if (locked) return fail(locked);
  if (Date.parse(data.endsAt) <= Date.parse(data.startsAt)) return fail("Jam selesai harus setelah jam mulai.");
  const result = await db.saveStaffSchedule(businessId, { user_id: data.userId, starts_at: data.startsAt, ends_at: data.endsAt, role_label: data.roleLabel?.trim() || null, pos_shift_allowed: data.posShiftAllowed });
  if (result === "conflict") return fail("Jadwal staf ini bertabrakan dengan shift yang sudah ada.");
  if (!result) return fail("Staf tidak ditemukan.");
  revalidatePath("/app/hr"); return ok(null);
}

export async function cancelStaffScheduleAction(scheduleId: string): Promise<OperationResult> {
  const { businessId } = await requireOwner();
  const locked = await moduleLock(businessId, "hr", "write"); if (locked) return fail(locked);
  if (!await db.cancelStaffSchedule(businessId, scheduleId)) return fail("Jadwal tidak ditemukan atau sudah dibatalkan.");
  revalidatePath("/app/hr"); return ok(null);
}

export async function setPosSchedulePolicyAction(required: boolean): Promise<OperationResult> {
  const { businessId } = await requireOwner();
  const locked = await moduleLock(businessId, "hr", "write"); if (locked) return fail(locked);
  await db.setPosSchedulePolicy(businessId, required);
  revalidatePath("/app/hr"); revalidatePath("/app/pos"); return ok(null);
}

type LeaveInput = { leaveType: "leave" | "sick" | "permission" | "overtime"; startsAt: string; endsAt: string; reason: string };
const validLeave = (data: LeaveInput) => data.reason.trim().length >= 5 && Date.parse(data.endsAt) > Date.parse(data.startsAt);

export async function submitLeaveRequestAction(data: LeaveInput): Promise<OperationResult> {
  const session = await requireStaff();
  const locked = await moduleLock(session.businessId, "hr", "write"); if (locked) return fail(locked);
  if (!validLeave(data)) return fail("Isi alasan minimal 5 karakter dan waktu selesai harus setelah mulai.");
  await db.createLeaveRequest(session.businessId, session.userId, { leave_type: data.leaveType, starts_at: data.startsAt, ends_at: data.endsAt, reason: data.reason.trim() });
  revalidatePath("/app/hr"); revalidatePath("/app/hr/leave"); return ok(null);
}

export async function createLeaveForStaffAction(userId: string, data: LeaveInput): Promise<OperationResult> {
  const { businessId } = await requireOwner();
  const locked = await moduleLock(businessId, "hr", "write"); if (locked) return fail(locked);
  if (!validLeave(data)) return fail("Isi alasan minimal 5 karakter dan waktu selesai harus setelah mulai.");
  await db.createLeaveRequest(businessId, userId, { leave_type: data.leaveType, starts_at: data.startsAt, ends_at: data.endsAt, reason: data.reason.trim() });
  revalidatePath("/app/hr"); return ok(null);
}

export async function reviewLeaveRequestAction(requestId: string, approved: boolean): Promise<OperationResult> {
  const { businessId, userId } = await requireOwner();
  const locked = await moduleLock(businessId, "hr", "write"); if (locked) return fail(locked);
  if (!await db.reviewLeaveRequest(businessId, userId, requestId, approved)) return fail("Pengajuan tidak ditemukan atau sudah diproses.");
  revalidatePath("/app/hr"); return ok(null);
}

export async function createPayrollPeriodAction(data: { startsOn: string; endsOn: string }): Promise<OperationResult> {
  const { businessId } = await requireOwner();
  const locked = await moduleLock(businessId, "hr", "write"); if (locked) return fail(locked);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(data.startsOn) || !/^\d{4}-\d{2}-\d{2}$/.test(data.endsOn) || data.endsOn < data.startsOn) return fail("Tanggal periode gaji belum benar.");
  const period = await db.createPayrollPeriod(businessId, { period_start: data.startsOn, period_end: data.endsOn });
  if (period === "exists") return fail("Periode gaji tersebut sudah ada.");
  revalidatePath("/app/hr"); return ok(null);
}

export async function savePayrollLineAction(data: { periodId: string; userId: string; basePay: number; overtimePay: number; incentivePay: number; commissionPay: number; deduction: number; note?: string }): Promise<OperationResult> {
  const { businessId } = await requireOwner();
  const locked = await moduleLock(businessId, "hr", "write"); if (locked) return fail(locked);
  const values = [data.basePay, data.overtimePay, data.incentivePay, data.commissionPay, data.deduction];
  if (values.some((value) => !Number.isSafeInteger(value) || value < 0)) return fail("Semua nominal gaji harus berupa angka bulat nol atau lebih.");
  if (!await db.savePayrollLine(businessId, { payroll_period_id: data.periodId, user_id: data.userId, base_pay: data.basePay, overtime_pay: data.overtimePay, incentive_pay: data.incentivePay, commission_pay: data.commissionPay, deduction: data.deduction, note: data.note?.trim() || null })) return fail("Baris gaji tidak ditemukan atau periode sudah dikunci.");
  revalidatePath("/app/hr"); return ok(null);
}

export async function setPayrollPeriodStatusAction(periodId: string, status: "approved" | "paid"): Promise<OperationResult> {
  const { businessId, userId } = await requireOwner();
  const locked = await moduleLock(businessId, "hr", "write"); if (locked) return fail(locked);
  if (!await db.setPayrollPeriodStatus(businessId, userId, periodId, status)) return fail("Periode belum bisa diubah. Setujui draft terlebih dahulu sebelum menandai lunas.");
  revalidatePath("/app/hr"); return ok(null);
}

export async function saveAttendancePolicyAction(data: { requireSelfie: boolean; requireLocation: boolean }): Promise<OperationResult> {
  const { businessId } = await requireOwner();
  const locked = await moduleLock(businessId, "hr", "write"); if (locked) return fail(locked);
  await db.saveAttendancePolicy(businessId, data);
  revalidatePath("/app/hr"); return ok(null);
}

export async function resolveAttendancePlaceAction(placeId: string): Promise<OperationResult<{ placeId: string; name: string; address: string; latitude: number; longitude: number }>> {
  const { businessId } = await requireOwner();
  const locked = await moduleLock(businessId, "hr", "write"); if (locked) return fail(locked);
  const place = await getGooglePlaceLocation(placeId);
  if (!place) return fail("Place ID tidak ditemukan. Pastikan Google Places API aktif dan Place ID benar.");
  return ok(place);
}

export async function searchAttendancePlacesAction(query: string): Promise<OperationResult<{ placeId: string; name: string; address: string }[]>> {
  const { businessId } = await requireOwner();
  const locked = await moduleLock(businessId, "hr", "write"); if (locked) return fail(locked);
  if (query.trim().length < 3) return fail("Ketik minimal 3 huruf nama atau alamat lokasi.");
  if (!isPlacesSearchConfigured()) return fail("Google Maps API belum dikonfigurasi di server.");
  const places = await searchPlaces(query);
  return ok(places.map((place) => ({ placeId: place.placeId, name: place.name, address: place.address })));
}

export async function saveAttendanceSiteAction(data: { name: string; googlePlaceId?: string; latitude?: number; longitude?: number; radiusMeters: number; nfcCardId?: string }): Promise<OperationResult> {
  const { businessId } = await requireOwner();
  const locked = await moduleLock(businessId, "hr", "write"); if (locked) return fail(locked);
  if (data.name.trim().length < 2 || !Number.isInteger(data.radiusMeters) || data.radiusMeters < 10 || data.radiusMeters > 5000) return fail("Nama titik dan radius absensi belum benar.");
  if ((data.latitude === undefined) !== (data.longitude === undefined)) return fail("Isi latitude dan longitude bersama-sama, atau kosongkan keduanya.");

  /**
   * Kartu yang dipasang di titik absensi harus milik usaha ini DAN memang
   * berlayanan absensi. Tanpa pemeriksaan ini, id kartu apa pun bisa dikirim
   * ke sini — termasuk kartu ulasan milik usaha sebelah — dan satu kartu jadi
   * mengerjakan dua hal sekaligus.
   */
  if (data.nfcCardId) {
    const kartu = (await db.getCards(businessId)).find((c) => c.id === data.nfcCardId);
    if (!kartu) return fail("Kartu absensi tidak ditemukan pada usaha ini.");
    if (kartu.type !== "attendance") {
      return fail(`Kartu itu dipakai untuk ${CARD_SERVICE_LABEL[kartu.type]}. Satu kartu hanya melayani satu hal — ubah dulu layanan kartunya di dasbor kartu.`);
    }
  }

  await db.saveAttendanceSite(businessId, { name: data.name.trim(), google_place_id: data.googlePlaceId?.trim() || null, latitude: data.latitude ?? null, longitude: data.longitude ?? null, allowed_radius_meters: data.radiusMeters, nfc_card_id: data.nfcCardId || null, is_active: true });
  revalidatePath("/app/hr"); return ok(null);
}

const distanceMeters = (aLat: number, aLng: number, bLat: number, bLng: number) => {
  const r = 6_371_000; const rad = Math.PI / 180;
  const dLat = (bLat - aLat) * rad; const dLng = (bLng - aLng) * rad;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(aLat * rad) * Math.cos(bLat * rad) * Math.sin(dLng / 2) ** 2;
  return 2 * r * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
};

export async function recordAttendanceAction(data: { direction: "in" | "out"; siteToken?: string; latitude?: number; longitude?: number; selfieUrl?: string; method: "self" | "qr" | "nfc" | "location" }): Promise<OperationResult> {
  const session = await requireStaff();
  if (!session.businessId) return fail("Akun belum terhubung ke usaha.");
  const locked = await moduleLock(session.businessId, "hr", "write"); if (locked) return fail(locked);
  const dashboard = await db.getHrDashboard(session.businessId);
  const policy = dashboard.policy as { attendance_require_selfie: boolean; attendance_require_location: boolean };
  if (policy.attendance_require_selfie && !data.selfieUrl?.startsWith("data:image/")) return fail("Ambil selfie lebih dulu sebelum absensi.");
  if (policy.attendance_require_location && (!Number.isFinite(data.latitude) || !Number.isFinite(data.longitude))) return fail("Ambil lokasi lebih dulu sebelum absensi.");
  const site = data.siteToken ? await db.getAttendanceSiteByToken(session.businessId, data.siteToken) as { id: string; latitude: string | number | null; longitude: string | number | null; allowed_radius_meters: number } | null : null;
  if (data.siteToken && !site) return fail("QR atau NFC titik absensi tidak aktif.");
  if (site && site.latitude !== null && site.longitude !== null && Number.isFinite(data.latitude) && Number.isFinite(data.longitude)) {
    if (distanceMeters(Number(site.latitude), Number(site.longitude), Number(data.latitude), Number(data.longitude)) > Number(site.allowed_radius_meters)) return fail("Kamu berada di luar radius titik absensi.");
  }
  const entry = await db.createAttendanceRecord(session.businessId, session.userId, { direction: data.direction, attendance_site_id: site?.id ?? null, latitude: data.latitude ?? null, longitude: data.longitude ?? null, selfie_url: data.selfieUrl ?? null, method: site ? data.method : "self" });
  if (!entry) return fail(data.direction === "in" ? "Kamu masih tercatat masuk, selesaikan absensi pulang dulu." : "Belum ada absensi masuk yang bisa ditutup.");
  revalidatePath("/app/hr"); return ok(null);
}
