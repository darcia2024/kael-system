"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { db } from "./db";
import type { StaffPermission } from "./types";
import {
  searchPlaces,
  isPlacesSearchConfigured,
  type GooglePlaceResult,
} from "./google-places";
import { moduleLock, requireModuleRead, getModuleView } from "./licensing";
import { MODULE_CATALOG } from "./modules-catalog";
import { parseBrandColor } from "./branding";
import { readQris, buildDynamicQris } from "./qris-engine";
import {
  requireStaff, requireOwner, requireKaelAdmin, requirePermission,
  createSession, destroySession, getSession, verifyPin, isLegacyPinHash,
} from "./auth";

/**
 * Server Action untuk seluruh mutasi.
 *
 * Dokumentasi Next 16 memperingatkan bahwa Server Action bisa dipanggil
 * langsung lewat permintaan POST, bukan hanya lewat tombol di UI. Maka setiap
 * fungsi di bawah memanggil penjaga peran lebih dulu, dan tidak satu pun
 * menerima business_id dari argumen: nilainya selalu diambil dari sesi, supaya
 * pemanggil tidak bisa menunjuk ke bisnis orang lain.
 */

export type ActionResult<T = void> =
  | { ok: true; data: T }
  | { ok: false; error: string };

const fail = (error: string): ActionResult<never> => ({ ok: false, error });
const done = <T,>(data: T): ActionResult<T> => ({ ok: true, data });

// ===========================================================================
// Sesi
// ===========================================================================

export async function loginOwner(
  email: string,
  password: string,
): Promise<ActionResult<{ next: string }>> {
  const result = await db.authenticateOwner(email, password);
  if (!result.success) return fail(result.error);
  const user = result.user;

  await createSession({
    userId: user.id,
    businessId: user.business_id,
    role: user.role,
    name: user.name,
  });
  return done({ next: user.role === "kael_admin" ? "/admin/businesses" : "/app" });
}

export async function loginStaff(
  businessId: string,
  userId: string,
  pin: string,
): Promise<ActionResult<{ next: string }>> {
  const result = await db.authenticateStaffPin(businessId, userId, pin);
  if (!result.success) return fail(result.error);

  const permissions = (result.user.permissions ?? []) as StaffPermission[];
  if (permissions.length === 0) {
    return fail("Akun ini belum diberi akses apa pun oleh pemilik usaha.");
  }

  await createSession({
    userId: result.user.id,
    businessId: result.user.business_id,
    role: "staff",
    name: result.user.name,
    permissions,
  });

  // Mendarat di modul pertama yang boleh dibuka, bukan selalu kasir.
  const landing: Record<StaffPermission, string> = {
    pos: "/app/pos",
    loyalty: "/app/loyalty",
    review: "/app/review",
  };
  const first = (["pos", "loyalty", "review"] as StaffPermission[]).find((m) =>
    permissions.includes(m),
  );
  return done({ next: first ? landing[first] : "/app" });
}

export async function logout() {
  await destroySession();
  redirect("/app/login");
}

export async function currentSession() {
  return getSession();
}

/**
 * Membuka satu toko berdasarkan kode yang dipegang pemiliknya.
 *
 * Menggantikan getStoreStaffAction(businessId) dan getAvailableBusinessesAction.
 * Yang lama bisa dipanggil siapa pun tanpa login: satu mengembalikan SELURUH
 * daftar bisnis yang memakai KAEL, satunya lagi membuka nama staf toko mana pun.
 * Artinya daftar pelanggan KAEL terbuka ke internet, dan tiap UMKM bisa melihat
 * pesaingnya ikut memakai sistem yang sama.
 *
 * Bentuk ini tidak bisa dipakai membuat daftar. Mengetahui satu kode hanya
 * membuka satu toko, dan kode itu hanya diberikan ke pemilik usahanya.
 */
export async function openStoreByCodeAction(code: string): Promise<{
  ok: boolean;
  error?: string;
  business?: {
    id: string;
    name: string;
    category: string;
    brand_color: string;
    logo_url: string | null;
  };
  staffList?: { id: string; name: string }[];
}> {
  const clean = (code || "").trim().toUpperCase();
  if (clean.length < 3) return { ok: false, error: "Kode toko terlalu pendek." };

  const business = await db.getBusinessByStoreCode(clean);
  if (!business) return { ok: false, error: "Kode toko tidak dikenali." };

  const users = await db.getUsers(business.id);
  return {
    ok: true,
    business: {
      id: business.id,
      name: business.name,
      category: business.category,
      brand_color: business.brand_color,
      logo_url: business.logo_url || null,
    },
    staffList: users
      .filter((u) => u.role === "staff" && u.is_active)
      .map((u) => ({ id: u.id, name: u.name })),
  };
}

// ===========================================================================
// Kartu (KAEL Review)
// ===========================================================================

/**
 * Aktivasi terbuka tanpa login: yang membuktikan kepemilikan adalah PIN yang
 * hanya terlihat setelah kemasan dibuka.
 */
export async function activateCardAction(
  code: string,
  pin: string,
  destinationUrl: string,
  label: string,
  placeDetails?: { name: string; address?: string; placeId?: string },
): Promise<ActionResult<{ cardCode: string }>> {
  const card = await db.getCardByCode(code);
  if (!card) return fail(`Kartu ${code} tidak dikenali.`);
  if (card.status === "suspended") return fail("Kartu ini tidak aktif.");
  if (card.status === "active") return fail("Kartu sudah pernah diaktivasi.");

  const session = await getSession();
  
  let businessId: string;

  if (session?.role === "owner" && session.businessId) {
    businessId = session.businessId;
  } else if (placeDetails?.placeId && placeDetails?.name) {
    const existing = await db.getBusinessByGooglePlaceId(placeDetails.placeId);
    if (existing) {
      businessId = existing.id;
    } else {
      const created = await db.createBusinessFromPlace({
        name: placeDetails.name,
        address: placeDetails.address || "",
        googlePlaceId: placeDetails.placeId,
      });
      businessId = created.id;
    }
  } else if (card.business_id) {
    businessId = card.business_id;
  } else {
    /**
     * Tidak ada sesi, tidak ada pilihan usaha, dan kartunya belum terhubung ke
     * mana pun. Di titik ini kita memang TIDAK TAHU kartu ini milik siapa.
     *
     * Versi sebelumnya menebak dengan sebuah UUID tetap peninggalan data demo.
     * Baris itu sudah dihapus dari basis data, jadi tebakannya berujung galat
     * kunci asing mentah di layar pelanggan. Bahkan seandainya baris itu masih
     * ada, hasilnya lebih buruk: kartu menempel diam-diam ke usaha orang lain.
     */
    return fail(
      "Kartu ini belum terhubung ke usaha mana pun. Pilih nama usahamu lebih dulu, " +
        "atau masuk sebagai pemilik usaha sebelum mengaktifkan kartu.",
    );
  }

  let url: URL;
  try {
    url = new URL(destinationUrl);
  } catch {
    return fail("Tautan tujuan tidak valid.");
  }
  if (url.protocol !== "https:") return fail("Tautan tujuan harus memakai https.");

  const cardLabel = label?.trim() || placeDetails?.name || "Meja Kasir";
  const result = await db.activateCard(code, pin, businessId, url.toString(), cardLabel);
  if (!result.success) return fail(result.error!);

  revalidatePath("/app/review");
  revalidatePath("/admin/cards");
  revalidatePath("/admin/businesses");
  return done({ cardCode: result.card!.card_code });
}

/**
 * Memeriksa kartu sebelum meminta PIN. Hanya mengembalikan status, bukan isi
 * kartunya: tujuan dan hash PIN tidak pernah ikut ke browser.
 */
export async function checkCardAction(
  code: string,
): Promise<ActionResult<{ status: "unactivated" | "active" | "suspended" }>> {
  const card = await db.getCardByCode(code);
  if (!card) return fail(`Kartu ${code} tidak dikenali.`);
  if (card.status === "active") return fail("Kartu ini sudah pernah diaktivasi.");
  if (card.status === "suspended") return fail("Kartu ini tidak aktif.");
  return done({ status: card.status });
}

/**
 * Pencarian bisnis di Google Places, dijalankan di server supaya kunci API
 * tidak pernah sampai ke browser.
 *
 * Mengembalikan `configured: false` kalau GOOGLE_PLACES_API_KEY belum diisi,
 * sehingga layar bisa mengarahkan owner ke pengisian Place ID manual alih-alih
 * menampilkan kotak pencarian yang tidak pernah menemukan apa pun.
 */
export async function searchPlacesAction(query: string): Promise<{
  configured: boolean;
  results: GooglePlaceResult[];
}> {
  if (!isPlacesSearchConfigured()) return { configured: false, results: [] };
  return { configured: true, results: await searchPlaces(query) };
}

export async function updateCardAction(
  cardId: string,
  updates: { destination_url?: string; label?: string; status?: "active" | "suspended" },
): Promise<ActionResult<null>> {
  const { businessId } = await requireOwner();
  const locked = await moduleLock(businessId, "review", "write");
  if (locked) return fail(locked);

  if (updates.destination_url) {
    try {
      const u = new URL(updates.destination_url);
      if (u.protocol !== "https:") return fail("Tautan tujuan harus memakai https.");
    } catch {
      return fail("Tautan tujuan tidak valid.");
    }
  }

  const card = await db.updateCard(cardId, businessId, updates);
  if (!card) return fail("Kartu tidak ditemukan pada bisnis ini.");
  revalidatePath("/app/review");
  return done(null);
}

/** Penerbitan batch hanya untuk tim KAEL. */
export async function issueCardsAction(
  count: number,
  type: "review" | "loyalty" | "attendance",
): Promise<ActionResult<{ card_code: string; activation_pin: string }[]>> {
  await requireKaelAdmin();
  if (count < 1 || count > 200) return fail("Jumlah kartu harus antara 1 dan 200.");
  const issued = await db.createBatchCards(count, type);
  revalidatePath("/admin/cards");
  return done(issued);
}

/** Cabut akses kartu dan reset ke status unactivated (hanya untuk Admin KAEL) */
export async function adminResetCardAction(cardId: string): Promise<ActionResult<null>> {
  await requireKaelAdmin();
  const res = await db.adminResetCard(cardId);
  if (!res) return fail("Kartu tidak ditemukan.");
  revalidatePath("/admin/cards");
  revalidatePath("/app/review");
  return done(null);
}

/** Ubah status kartu active <-> suspended (hanya untuk Admin KAEL) */
export async function adminSetCardStatusAction(
  cardId: string,
  status: "active" | "suspended",
): Promise<ActionResult<null>> {
  await requireKaelAdmin();
  const res = await db.adminSetCardStatus(cardId, status);
  if (!res) return fail("Kartu tidak ditemukan.");
  revalidatePath("/admin/cards");
  revalidatePath("/app/review");
  return done(null);
}

/** Hapus kartu permanen dari master database (hanya untuk Admin KAEL) */
export async function adminDeleteCardAction(cardId: string): Promise<ActionResult<null>> {
  await requireKaelAdmin();
  const ok = await db.adminDeleteCard(cardId);
  if (!ok) return fail("Gagal menghapus kartu.");
  revalidatePath("/admin/cards");
  return done(null);
}

// ===========================================================================
// Loyalty
// ===========================================================================

/** Pendaftaran member terbuka: dipanggil pelanggan setelah tap kartu meja. */
export async function registerCustomerAction(
  businessId: string,
  name: string,
  phone: string,
  consent: boolean,
  birthday?: string,
): Promise<ActionResult<{ token: string; alreadyMember: boolean }>> {
  // UU PDP: persetujuan harus diberikan aktif, bukan kotak yang sudah tercentang.
  if (!consent) return fail("Persetujuan penyimpanan data diperlukan untuk mendaftar.");
  if (!name.trim()) return fail("Nama belum diisi.");

  /**
   * Jalur publik: yang memanggil ini pelanggan, bukan staf. Kalau modul
   * Loyalty toko ini belum aktif atau sudah lewat masa aktifnya, pendaftaran
   * ditolak — tapi alasannya TIDAK disebutkan. Pelanggan tidak perlu, dan
   * tidak pantas, tahu bahwa tokonya telat memperpanjang langganan.
   */
  if (await moduleLock(businessId, "loyalty", "write")) {
    return fail("Pendaftaran member sedang tidak tersedia di toko ini.");
  }

  const result = await db.registerCustomer(businessId, name.trim(), phone, birthday);
  if (!result.success) return fail(result.error);
  return done({ token: result.customer.token, alreadyMember: result.alreadyMember });
}

/** Pencarian pelanggan untuk dashboard kasir. */
export async function searchCustomersAction(query: string) {
  const { businessId } = await requireModuleRead("loyalty");
  if (!query.trim()) return [];
  return db.searchCustomers(businessId, query);
}

/** Detail satu pelanggan beserta riwayat poinnya, untuk modal di dashboard. */
export async function customerDetailAction(customerId: string) {
  const { businessId } = await requireModuleRead("loyalty");
  const customer = await db.getCustomerById(customerId, businessId);
  if (!customer) return null;
  const [balance, ledger, redemptions] = await Promise.all([
    db.getCustomerPointBalance(customerId),
    db.getCustomerLedger(customerId),
    db.getRedemptions(customerId),
  ]);
  return { customer, balance, ledger, redemptions };
}

export async function updateLoyaltyProgramAction(updates: {
  mode?: "point" | "stamp";
  earn_rate?: number;
  stamp_per_visit?: number;
  point_expiry_months?: number | null;
}): Promise<ActionResult<null>> {
  const { businessId } = await requireOwner();
  const locked = await moduleLock(businessId, "loyalty", "write");
  if (locked) return fail(locked);
  if (updates.earn_rate !== undefined && updates.earn_rate <= 0) {
    return fail("Kurs poin harus lebih dari nol.");
  }
  await db.updateLoyaltyProgram(businessId, updates);
  revalidatePath("/app/loyalty");
  // Halaman pendaftaran menampilkan kurs poin, jadi ikut disegarkan.
  revalidatePath("/loyalty/register");
  return done(null);
}

export async function addPointsAction(
  customerId: string,
  amountSpent: number,
): Promise<ActionResult<{ earned: number; balance: number }>> {
  const { businessId, userId } = await requirePermission("loyalty");
  const locked = await moduleLock(businessId, "loyalty", "write");
  if (locked) return fail(locked);
  if (amountSpent <= 0) return fail("Nominal belanja harus lebih dari nol.");
  // Batas kewajaran. Nominal di luar ini hampir pasti salah ketik.
  if (amountSpent > 50_000_000) return fail("Nominal terlalu besar. Periksa kembali.");

  const customer = await db.getCustomerById(customerId, businessId);
  if (!customer) return fail("Pelanggan tidak ditemukan pada bisnis ini.");

  const entry = await db.earnPointsFromPurchase(businessId, customerId, amountSpent, userId);
  const balance = await db.getCustomerPointBalance(customerId);
  revalidatePath("/app/loyalty");
  return done({ earned: entry?.delta ?? 0, balance });
}

/**
 * Penambahan poin manual tanpa nominal belanja. Ditandai terpisah karena inilah
 * jalur yang paling mungkin disalahgunakan, dan laporan owner menyorotinya.
 */
export async function addManualPointsAction(
  customerId: string,
  delta: number,
  note: string,
): Promise<ActionResult<{ balance: number }>> {
  const { businessId, userId } = await requirePermission("loyalty");
  const locked = await moduleLock(businessId, "loyalty", "write");
  if (locked) return fail(locked);
  if (!Number.isInteger(delta) || delta === 0) return fail("Jumlah poin tidak valid.");
  if (Math.abs(delta) > 1000) return fail("Penyesuaian manual dibatasi 1000 poin.");
  if (!note.trim()) return fail("Alasan penyesuaian wajib diisi.");

  const customer = await db.getCustomerById(customerId, businessId);
  if (!customer) return fail("Pelanggan tidak ditemukan pada bisnis ini.");

  await db.addPointTransaction(businessId, customerId, delta, "manual", note.trim(), null, userId);
  const balance = await db.getCustomerPointBalance(customerId);
  revalidatePath("/app/loyalty");
  return done({ balance });
}

export async function redeemRewardAction(
  customerId: string,
  rewardId: string,
): Promise<ActionResult<{ code: string; rewardName: string }>> {
  const { businessId, userId } = await requirePermission("loyalty");
  const locked = await moduleLock(businessId, "loyalty", "write");
  if (locked) return fail(locked);
  const customer = await db.getCustomerById(customerId, businessId);
  if (!customer) return fail("Pelanggan tidak ditemukan pada bisnis ini.");

  const result = await db.issueRedemption(businessId, customerId, rewardId, userId);
  if (!result.success) return fail(result.error);
  revalidatePath("/app/loyalty");
  return done({ code: result.redemption.code, rewardName: result.reward.name });
}

export async function saveRewardAction(data: {
  id?: string; name: string; point_cost: number; stock: number | null; is_active: boolean;
}): Promise<ActionResult<null>> {
  const { businessId } = await requireOwner();
  const locked = await moduleLock(businessId, "loyalty", "write");
  if (locked) return fail(locked);
  if (!data.name.trim()) return fail("Nama reward belum diisi.");
  if (data.point_cost <= 0) return fail("Biaya poin harus lebih dari nol.");
  await db.saveReward(businessId, data);
  revalidatePath("/app/loyalty");
  return done(null);
}

export async function deleteRewardAction(id: string): Promise<ActionResult<null>> {
  const { businessId } = await requireOwner();
  const locked = await moduleLock(businessId, "loyalty", "write");
  if (locked) return fail(locked);
  const ok = await db.deleteReward(id, businessId);
  if (!ok) return fail("Reward tidak ditemukan.");
  revalidatePath("/app/loyalty");
  return done(null);
}

/** Hak penghapusan data menurut UU PDP. Hanya owner. */
export async function anonymizeCustomerAction(customerId: string): Promise<ActionResult<null>> {
  const { businessId } = await requireOwner();
  const locked = await moduleLock(businessId, "loyalty", "write");
  if (locked) return fail(locked);
  const ok = await db.anonymizeCustomer(customerId, businessId);
  if (!ok) return fail("Pelanggan tidak ditemukan.");
  revalidatePath("/app/loyalty");
  return done(null);
}

// ===========================================================================
// POS dan Ordering
// ===========================================================================

export async function openShiftAction(openingCash: number, notes?: string): Promise<ActionResult<null>> {
  const { businessId, userId } = await requirePermission("pos");
  const locked = await moduleLock(businessId, "pos", "write");
  if (locked) return fail(locked);
  if (openingCash < 0) return fail("Modal awal tidak boleh negatif.");
  const result = await db.openShift(businessId, userId, openingCash, notes);
  if (!result.success) return fail(result.error);
  revalidatePath("/app/pos");
  return done(null);
}

export async function closeShiftAction(
  shiftId: string,
  physicalCash: number,
  notes?: string,
): Promise<ActionResult<{ variance: number }>> {
  const { businessId } = await requirePermission("pos");
  const locked = await moduleLock(businessId, "pos", "write");
  if (locked) return fail(locked);
  if (physicalCash < 0) return fail("Uang laci tidak boleh negatif.");
  const shift = await db.closeShift(shiftId, businessId, physicalCash, notes);
  if (!shift) return fail("Shift tidak ditemukan atau sudah ditutup.");
  revalidatePath("/app/pos");
  return done({ variance: Number(shift.variance ?? 0) });
}

export async function createOrderAction(input: {
  service_type: "dine_in" | "takeaway" | "delivery";
  table_no?: string | null;
  payment_method: "cash" | "qris" | "transfer";
  delivery?: { name: string; phone: string; address: string; fee: number; note?: string } | null;
  discount?: number;
  tax?: number;
  service_charge?: number;
  cash_given?: number | null;
  customer_id?: string | null;
  items: { menu_item_id: string; qty: number; note?: string }[];
}): Promise<ActionResult<{ orderId: string; orderNo: string; total: number; change: number }>> {
  const { businessId, userId } = await requirePermission("pos");
  const locked = await moduleLock(businessId, "pos", "write");
  if (locked) return fail(locked);
  if (!input.items.length) return fail("Keranjang masih kosong.");

  /**
   * Harga diambil ulang dari database, tidak pernah dari yang dikirim klien.
   * Kalau harga ikut dari browser, siapa pun yang memanggil action ini bisa
   * menentukan harganya sendiri.
   */
  const menu = await db.getMenuItems(businessId);
  const byId = new Map(menu.map((m) => [m.id, m]));

  const items = [];
  for (const line of input.items) {
    const item = byId.get(line.menu_item_id);
    if (!item) return fail("Ada item yang tidak dikenali di keranjang.");
    if (!item.is_available) return fail(`${item.name} sedang habis.`);
    if (line.qty < 1 || line.qty > 999) return fail("Jumlah item tidak wajar.");
    items.push({
      menu_item_id: item.id,
      name: item.name,
      price: Number(item.price),
      qty: Math.floor(line.qty),
      note: line.note,
    });
  }

  const shift = await db.getActiveShift(businessId);
  const { order } = await db.createOrder(
    businessId,
    {
      channel: "cashier",
      service_type: input.service_type,
      table_no: input.table_no ?? null,
      /**
       * Tunai lunas seketika: uangnya ada di tangan kasir saat itu juga.
       *
       * QRIS dan transfer TIDAK. QR yang muncul di layar belum berarti uangnya
       * masuk, dan menandainya lunas di detik itu berarti kasir menutup
       * transaksi atas sesuatu yang belum dia lihat. Keduanya menunggu
       * konfirmasi lewat confirmPaymentAction.
       */
      status: input.payment_method === "cash" ? "paid" : "open",
      payment_status: input.payment_method === "cash" ? "paid" : "pending",
      fulfillment_status: input.payment_method === "cash" ? "completed" : "pending",
      delivery: input.delivery ?? null,
      discount: input.discount ?? 0,
      tax: input.tax ?? 0,
      service_charge: input.service_charge ?? 0,
      payment_method: input.payment_method,
      cash_given: input.cash_given ?? null,
      customer_id: input.customer_id ?? null,
      shift_id: shift?.id ?? null,
      created_by: userId,
    },
    items,
  );

  // Sambungan ke Loyalty: poin masuk otomatis supaya kasir tidak memasukkan
  // nominal dua kali.
  if (input.customer_id && order.status === "paid") {
    try {
      await db.earnPointsFromPurchase(businessId, input.customer_id, Number(order.total), userId);
    } catch (err) {
      console.error("[KAEL] gagal menambah poin dari transaksi", err);
    }
  }

  revalidatePath("/app/pos");
  return done({
    orderId: order.id,
    orderNo: order.order_no,
    total: Number(order.total),
    change: Number(order.cash_change ?? 0),
  });
}

/** Pesanan dari QR meja. Terbuka, karena pelanggan tidak punya akun. */
export async function createQrOrderAction(
  businessId: string,
  tableNo: string,
  serviceType: "dine_in" | "takeaway",
  paymentMethod: "qris" | "cash",
  items: { menu_item_id: string; qty: number; note?: string }[],
): Promise<ActionResult<{ orderId: string; orderNo: string; total: number }>> {
  if (!items.length) return fail("Keranjang masih kosong.");

  /**
   * Sama seperti pendaftaran member: ini dipanggil pelanggan yang memindai QR
   * di meja, tanpa sesi. Tanpa pemeriksaan ini, usaha yang modul POS-nya sudah
   * lewat masa aktif akan tetap menerima pesanan QR selamanya dan tidak ada
   * satu pun layar yang menghentikannya.
   */
  if (await moduleLock(businessId, "pos", "write")) {
    return fail("Pemesanan lewat QR sedang tidak tersedia. Silakan pesan langsung ke kasir.");
  }

  const menu = await db.getMenuItems(businessId);
  const byId = new Map(menu.map((m) => [m.id, m]));

  const lines = [];
  for (const line of items) {
    const item = byId.get(line.menu_item_id);
    if (!item || !item.is_available) return fail("Ada menu yang sudah tidak tersedia.");
    if (line.qty < 1 || line.qty > 99) return fail("Jumlah item tidak wajar.");
    lines.push({
      menu_item_id: item.id,
      name: item.name,
      price: Number(item.price),
      qty: Math.floor(line.qty),
      note: line.note,
    });
  }

  const owner = (await db.getUsers(businessId)).find((u) => u.role === "owner");
  if (!owner) return fail("Bisnis belum siap menerima pesanan.");

  /**
   * Selalu "pending", apa pun cara bayar yang dipilih pelanggan.
   *
   * Tidak ada gerbang pembayaran di sistem ini, jadi tidak ada satu pun cara
   * teknis untuk mengetahui uangnya sudah masuk. QR yang muncul di layar
   * pelanggan hanya menampilkan tujuan transfer; ia tidak pernah mengabarkan
   * balik. Yang menyatakan pembayaran diterima adalah kasir, dan namanya ikut
   * tersimpan di paid_confirmed_by.
   *
   * Dapur tidak mulai sebelum itu. Kalau mulai lebih dulu, satu orang iseng
   * cukup memesan sepuluh porsi dari meja lalu pergi.
   */
  const { order } = await db.createOrder(
    businessId,
    {
      channel: "qr",
      service_type: serviceType,
      table_no: tableNo,
      status: "open",
      payment_status: "pending",
      fulfillment_status: "pending",
      payment_method: paymentMethod,
      created_by: owner.id,
    },
    lines,
  );
  revalidatePath("/app/pos");
  return done({ orderId: order.id, orderNo: order.order_no, total: Number(order.total) });
}

// ---------------------------------------------------------------------------
// Konfirmasi pembayaran oleh kasir
// ---------------------------------------------------------------------------

/**
 * Kasir menyatakan uangnya benar-benar diterima.
 *
 * Inilah satu-satunya bukti bahwa pembayaran non-tunai itu terjadi: tidak ada
 * gerbang pembayaran yang mengabarkannya. Karena itu yang menekan tombolnya
 * ikut tercatat — konfirmasi yang tidak bisa ditelusuri ke siapa pun sama saja
 * dengan tidak ada konfirmasi.
 */
export async function confirmPaymentAction(
  orderId: string,
): Promise<ActionResult<{ orderNo: string }>> {
  const { businessId, userId } = await requirePermission("pos");
  const locked = await moduleLock(businessId, "pos", "write");
  if (locked) return fail(locked);

  const order = await db.confirmOrderPayment(orderId, businessId, userId);
  if (!order) {
    return fail("Pesanan tidak ditemukan, atau pembayarannya sudah dikonfirmasi sebelumnya.");
  }

  // Poin loyalty baru diberikan di sini, bukan saat pesanan dibuat: sebelum
  // pembayarannya dipastikan, belum ada belanja yang layak dihitung.
  if (order.customer_id) {
    try {
      await db.earnPointsFromPurchase(businessId, order.customer_id, Number(order.total), userId);
    } catch (err) {
      console.error("[KAEL] gagal menambah poin setelah konfirmasi pembayaran", err);
    }
  }

  revalidatePath("/app/pos");
  return done({ orderNo: order.order_no });
}

/** Uangnya tidak pernah masuk. Pesanan ditutup, bukan dibiarkan menggantung. */
export async function markPaymentFailedAction(orderId: string): Promise<ActionResult<null>> {
  const { businessId } = await requirePermission("pos");
  const locked = await moduleLock(businessId, "pos", "write");
  if (locked) return fail(locked);

  const order = await db.markOrderPaymentFailed(orderId, businessId);
  if (!order) return fail("Pesanan tidak ditemukan atau sudah tidak menunggu pembayaran.");
  revalidatePath("/app/pos");
  return done(null);
}

/** Kemajuan dapur. Hanya untuk pesanan yang sudah lunas. */
export async function setFulfillmentAction(
  orderId: string,
  status: "accepted" | "preparing" | "ready" | "completed",
): Promise<ActionResult<null>> {
  const { businessId } = await requirePermission("pos");
  const locked = await moduleLock(businessId, "pos", "write");
  if (locked) return fail(locked);

  const order = await db.setOrderFulfillment(orderId, businessId, status);
  if (!order) return fail("Pesanan tidak ditemukan, atau pembayarannya belum dikonfirmasi.");
  revalidatePath("/app/pos");
  return done(null);
}

export async function updateOrderStatusAction(
  orderId: string,
  status: "open" | "paid" | "cancelled",
): Promise<ActionResult<null>> {
  const { businessId } = await requirePermission("pos");
  const locked = await moduleLock(businessId, "pos", "write");
  if (locked) return fail(locked);
  const order = await db.updateOrderStatus(orderId, businessId, status);
  if (!order) return fail("Transaksi tidak ditemukan.");
  revalidatePath("/app/pos");
  return done(null);
}

/** Refund hanya boleh disetujui owner, tidak pernah oleh kasir. */
export async function refundOrderAction(
  orderId: string,
  amount: number,
  reason: string,
): Promise<ActionResult<null>> {
  const { businessId, userId } = await requireOwner();
  const locked = await moduleLock(businessId, "pos", "write");
  if (locked) return fail(locked);
  if (!reason.trim()) return fail("Alasan refund wajib diisi.");
  const result = await db.refundOrder(orderId, businessId, amount, reason.trim(), userId);
  if (!result.success) return fail(result.error);
  revalidatePath("/app/pos/reports");
  return done(null);
}

export async function setMenuAvailabilityAction(
  menuItemId: string,
  isAvailable: boolean,
): Promise<ActionResult<null>> {
  const { businessId } = await requirePermission("pos");
  const locked = await moduleLock(businessId, "pos", "write");
  if (locked) return fail(locked);
  const ok = await db.updateMenuItemAvailability(menuItemId, businessId, isAvailable);
  if (!ok) return fail("Menu tidak ditemukan.");
  revalidatePath("/app/pos");
  return done(null);
}

// ===========================================================================
// Finance
// ===========================================================================

export async function createIngredientAction(
  name: string, packPrice: number, packSize: number, baseUnit: "gr" | "ml" | "pcs",
): Promise<ActionResult<{ id: string }>> {
  const { businessId } = await requireOwner();
  const locked = await moduleLock(businessId, "finance", "write");
  if (locked) return fail(locked);
  if (!name.trim()) return fail("Nama bahan belum diisi.");
  if (packPrice <= 0) return fail("Harga kemasan harus lebih dari nol.");
  if (packSize <= 0) return fail("Isi kemasan harus lebih dari nol.");

  const ing = await db.createIngredient(businessId, name.trim(), packPrice, packSize, baseUnit);
  revalidatePath("/app/finance");
  return done({ id: ing.id });
}

/**
 * Mengubah harga bahan ikut menulis riwayat, sehingga pertanyaan "kenapa HPP
 * saya naik" punya jawaban. Semua resep yang memakai bahan ini otomatis ikut
 * berubah karena HPP dihitung, bukan disimpan.
 */
export async function updateIngredientPriceAction(
  ingredientId: string, newPackPrice: number,
): Promise<ActionResult<null>> {
  const { businessId } = await requireOwner();
  const locked = await moduleLock(businessId, "finance", "write");
  if (locked) return fail(locked);
  if (newPackPrice <= 0) return fail("Harga harus lebih dari nol.");
  const updated = await db.updateIngredientPrice(ingredientId, businessId, newPackPrice);
  if (!updated) return fail("Bahan tidak ditemukan pada bisnis ini.");
  revalidatePath("/app/finance");
  return done(null);
}

export async function getIngredientPriceHistoryAction(ingredientId: string) {
  const { businessId } = await requireModuleRead("finance", { ownerOnly: true });
  return db.getIngredientPriceHistory(ingredientId, businessId);
}

export async function saveRecipeAction(data: {
  id?: string;
  name: string;
  type: "olahan" | "kulakan";
  category?: string | null;
  output_qty: number;
  operational_cost: number;
  selling_price: number;
  target_margin_pct: number;
  ingredients: { ingredient_id: string; qty: number }[];
  packaging: { name: string; cost: number }[];
}): Promise<ActionResult<{ id: string }>> {
  const { businessId } = await requireOwner();
  const locked = await moduleLock(businessId, "finance", "write");
  if (locked) return fail(locked);
  if (!data.name.trim()) return fail("Nama produk belum diisi.");
  if (data.output_qty < 1) return fail("Jumlah hasil produksi minimal 1.");

  // Bahan harus milik bisnis yang sama, kalau tidak resep bisa menunjuk ke
  // harga bahan milik toko lain.
  const owned = new Set((await db.getIngredients(businessId)).map((i) => i.id));
  for (const i of data.ingredients) {
    if (!owned.has(i.ingredient_id)) return fail("Ada bahan yang tidak dikenali.");
    if (i.qty <= 0) return fail("Jumlah pemakaian bahan harus lebih dari nol.");
  }

  const recipe = await db.saveRecipe(businessId, data);
  revalidatePath("/app/finance");
  return done({ id: recipe.id });
}

export async function deleteRecipeAction(id: string): Promise<ActionResult<null>> {
  const { businessId } = await requireOwner();
  const locked = await moduleLock(businessId, "finance", "write");
  if (locked) return fail(locked);
  const ok = await db.deleteRecipe(id, businessId);
  if (!ok) return fail("Produk tidak ditemukan.");
  revalidatePath("/app/finance");
  return done(null);
}

// ===========================================================================
// Staf
// ===========================================================================

export async function createStaffAction(name: string, pin: string): Promise<ActionResult<null>> {
  const { businessId } = await requireOwner();
  if (!name.trim()) return fail("Nama staf belum diisi.");
  if (!/^\d{4,6}$/.test(pin)) return fail("PIN harus 4 sampai 6 angka.");
  await db.createStaff(businessId, name.trim(), pin);
  revalidatePath("/app");
  return done(null);
}

export async function resetStaffPinAction(userId: string, pin: string): Promise<ActionResult<null>> {
  const { businessId } = await requireOwner();
  if (!/^\d{4,6}$/.test(pin)) return fail("PIN harus 4 sampai 6 angka.");
  const ok = await db.setStaffPin(userId, businessId, pin);
  if (!ok) return fail("Staf tidak ditemukan.");
  revalidatePath("/app");
  return done(null);
}

/** Staf yang resign dinonaktifkan, tidak dihapus: transaksi lama menunjuk ke sini. */
/**
 * Owner menentukan modul apa saja yang boleh dibuka seorang karyawan.
 *
 * Daftar yang diterima disaring ke tiga nilai yang sah. Finance, laporan laba,
 * refund, dan pengelolaan staf tidak ada di sini dan tidak bisa diberikan lewat
 * jalur mana pun: itu dijaga requireOwner, bukan oleh kolom izin.
 */
export async function setStaffPermissionsAction(
  userId: string,
  permissions: string[],
): Promise<ActionResult<null>> {
  const { businessId } = await requireOwner();

  const allowed: StaffPermission[] = ["pos", "loyalty", "review"];
  const clean = allowed.filter((p) => permissions.includes(p));

  const ok = await db.setStaffPermissions(userId, businessId, clean);
  if (!ok) return fail("Staf tidak ditemukan.");
  revalidatePath("/app");
  return done(null);
}

export async function deactivateStaffAction(userId: string): Promise<ActionResult<null>> {
  const { businessId } = await requireOwner();
  const ok = await db.deactivateStaff(userId, businessId);
  if (!ok) return fail("Staf tidak ditemukan.");
  revalidatePath("/app");
  return done(null);
}

// ===========================================================================
// Panel tim KAEL: pelanggan dan modulnya
// ===========================================================================

/** Modul yang benar-benar bisa dijual. Modul rencana tidak pernah lolos. */
const MODUL_TERSEDIA = new Set(
  MODULE_CATALOG.filter((m) => m.available).map((m) => m.key as string),
);

const JENIS_USAHA = new Set(["kuliner", "jasa", "retail"]);

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Mendaftarkan pelanggan baru: bisnisnya, akun pemiliknya, dan modul yang
 * dibelinya, sekaligus.
 *
 * Ini menggantikan menjalankan skrip secara manual tiap ada penjualan. Yang
 * pertama jebol saat penjualan menumpuk biasanya bukan kodenya, tapi waktu
 * orang yang harus mengetik ulang data pelanggan satu per satu.
 */
export async function createBusinessAction(input: {
  name: string;
  businessType: string;
  category: string;
  phone: string;
  address: string;
  storeCode: string;
  ownerName: string;
  ownerEmail: string;
  ownerPassword: string;
  googlePlaceId?: string;
  modules: { module: string; expiresAt: string }[];
}): Promise<ActionResult<{ businessId: string; storeCode: string }>> {
  await requireKaelAdmin();

  if (!input.name.trim()) return fail("Nama usaha belum diisi.");
  if (!input.ownerName.trim()) return fail("Nama pemilik belum diisi.");
  if (!JENIS_USAHA.has(input.businessType)) return fail("Jenis usaha tidak dikenali.");

  const storeCode = input.storeCode.trim().toUpperCase();
  if (!/^[A-Z0-9]{3,10}$/.test(storeCode)) {
    return fail("Kode toko harus 3 sampai 10 huruf atau angka, tanpa spasi.");
  }

  const email = input.ownerEmail.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return fail("Email pemilik tidak valid.");

  // Kata sandi owner boleh angka pendek, dan yang menahan tebakan adalah
  // penguncian 5 percobaan di authenticateOwner, bukan panjangnya. Enam tetap
  // batas bawah yang wajar.
  if (input.ownerPassword.length < 6) return fail("Kata sandi pemilik minimal 6 karakter.");

  const modules = input.modules.filter((m) => MODUL_TERSEDIA.has(m.module));
  if (!modules.length) return fail("Pilih minimal satu modul yang dibeli.");
  for (const m of modules) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(m.expiresAt)) {
      return fail("Tanggal jatuh tempo harus lengkap untuk tiap modul.");
    }
  }

  const result = await db.createBusinessWithOwner({
    name: input.name,
    businessType: input.businessType as "kuliner" | "jasa" | "retail",
    category: input.category,
    phone: input.phone,
    address: input.address,
    timezone: "Asia/Jakarta",
    storeCode,
    ownerName: input.ownerName,
    ownerEmail: email,
    ownerPassword: input.ownerPassword,
    googlePlaceId: input.googlePlaceId,
    modules,
  });

  if (!result.success) return fail(result.error);

  revalidatePath("/admin/businesses");
  return done({ businessId: result.business.id, storeCode });
}

/** Menyalakan, memperpanjang, menangguhkan, atau mencabut satu modul. */
export async function setBusinessModuleAction(
  businessId: string,
  module: string,
  status: "active" | "suspended" | "expired" | "none",
  expiresAt: string | null,
): Promise<ActionResult<null>> {
  await requireKaelAdmin();

  if (!MODUL_TERSEDIA.has(module)) return fail("Modul tidak dikenali.");
  if (!["active", "suspended", "expired", "none"].includes(status)) {
    return fail("Status tidak dikenali.");
  }
  if (status !== "none" && (!expiresAt || !/^\d{4}-\d{2}-\d{2}$/.test(expiresAt))) {
    return fail("Tanggal jatuh tempo belum diisi.");
  }

  await db.setBusinessModule(businessId, module, status, expiresAt);
  revalidatePath("/admin/businesses");
  return done(null);
}

/**
 * Membuat akun pemilik untuk usaha yang sudah ada tapi belum punya.
 *
 * Usaha yang lahir dari aktivasi kartu tidak pernah melewati formulir
 * pendaftaran, jadi barisnya ada di businesses tapi tidak ada seorang pun yang
 * bisa masuk mengelolanya. Tanpa jalur ini satu-satunya cara membetulkannya
 * adalah menjalankan skrip ke database produksi.
 *
 * Kata sandinya diketik tim KAEL lalu disampaikan ke pemiliknya. Sama seperti
 * createBusinessAction: yang menahan tebakan bukan panjang kata sandinya, tapi
 * penguncian 5 percobaan di authenticateOwner.
 */
export async function createOwnerForBusinessAction(
  businessId: string,
  input: { name: string; email: string; password: string },
): Promise<ActionResult<{ email: string }>> {
  await requireKaelAdmin();

  if (!UUID_RE.test(businessId)) return fail("Usaha tidak dikenali.");
  if (!input.name.trim()) return fail("Nama pemilik belum diisi.");

  const email = input.email.trim().toLowerCase();
  if (!EMAIL_RE.test(email)) return fail("Email pemilik tidak valid.");
  if (input.password.length < 6) return fail("Kata sandi pemilik minimal 6 karakter.");

  const res = await db.createOwnerForBusiness(businessId, {
    name: input.name,
    email,
    password: input.password,
  });
  if (!res.success) return fail(res.error);

  revalidatePath("/admin/businesses");
  return done({ email });
}

/**
 * Logo dan warna merek satu usaha.
 *
 * Tim KAEL, bukan pemilik usaha. Penyiapan tenant memang dikerjakan tim
 * KAEL sejak awal — menu, staf, modul, kode toko — dan identitas visual
 * bagian dari penyiapan yang sama. Pemilik usaha memakainya, tidak
 * mengaturnya.
 *
 * Sebelum ini satu-satunya cara mengisi kedua kolom itu adalah lewat skrip
 * seed prospek, sehingga pelanggan yang didaftarkan lewat panel admin sama
 * sekali tidak punya jalan untuk dipasangi logo.
 */
export async function setBusinessBrandingAction(
  businessId: string,
  input: { logoUrl: string; brandColor: string },
): Promise<ActionResult<{ logoUrl: string | null; brandColor: string }>> {
  await requireKaelAdmin();

  if (!UUID_RE.test(businessId)) return fail("Usaha tidak dikenali.");

  const brandColor = parseBrandColor(input.brandColor);
  if (!brandColor) return fail("Warna harus hex, misal #2f5d50.");

  const raw = (input.logoUrl || "").trim();
  let logoUrl: string | null = null;

  if (raw) {
    /**
     * Dibatasi panjangnya supaya kolomnya tidak dipakai menampung data URI
     * gambar utuh. Nilai ini ikut terbaca di setiap halaman yang menampilkan
     * kepala toko, termasuk struk yang dibuka pelanggan.
     */
    if (raw.length > 500) return fail("Tautan logo terlalu panjang, maksimal 500 karakter.");

    let parsed: URL;
    try {
      parsed = new URL(raw);
    } catch {
      return fail("Tautan logo bukan URL yang sah. Tempel tautan lengkap beserta https://");
    }

    /**
     * Hanya https. Aplikasi ini dilayani lewat https di produksi, dan
     * peramban memblokir gambar http di halaman https tanpa memberi tahu
     * siapa pun. Menolaknya sekarang jauh lebih baik daripada logo yang
     * tampak tersimpan tapi tidak pernah muncul di layar pelanggan.
     */
    if (parsed.protocol !== "https:") {
      return fail("Tautan logo harus diawali https, karena gambar http diblokir peramban.");
    }

    logoUrl = parsed.toString();
  }

  const updated = await db.updateBusiness(businessId, {
    logo_url: logoUrl,
    brand_color: brandColor,
  });
  if (!updated) return fail("Usaha tidak ditemukan.");

  revalidatePath("/admin/businesses");
  return done({ logoUrl, brandColor });
}

// ===========================================================================
// QRIS merchant
// ===========================================================================

/**
 * Menyimpan QRIS statis milik usaha.
 *
 * Hanya owner. Ini menentukan ke rekening siapa uang pelanggan mengalir, dan
 * itu bukan keputusan yang boleh diambil kasir yang sedang jaga shift.
 *
 * Payload diperiksa ULANG di server. Layar sudah memeriksanya sebelum
 * mengirim, tapi Server Action bisa dipanggil lewat POST langsung, dan
 * menyimpan payload yang CRC-nya tidak sah berarti kasir menemukan
 * masalahnya di depan pelanggan pertama yang gagal bayar.
 */
export async function saveQrisAction(
  rawPayload: string,
): Promise<ActionResult<{ merchantName: string; nmid: string | null }>> {
  const { businessId } = await requireOwner();

  const locked = await moduleLock(businessId, "pos", "write");
  if (locked) return fail(locked);

  const read = readQris(rawPayload);
  if (!read.ok) return fail(read.error);

  if (!read.info.isStatic) {
    return fail(
      "Yang diunggah QRIS dinamis sekali pakai, bukan QRIS statis toko. " +
        "Pakai QRIS yang biasa dipajang di meja kasir.",
    );
  }

  // Dicoba sekali di sini supaya kegagalan perakitan ketahuan saat mengunggah,
  // bukan saat kasir sedang menutup transaksi di depan pelanggan.
  const uji = buildDynamicQris(read.info.payload, 10_000);
  if (!uji.ok) return fail(`QRIS ini tidak bisa diberi nominal: ${uji.error}`);

  const ok = await db.saveQris(businessId, {
    payload: read.info.payload,
    merchantName: read.info.merchantName,
    merchantCity: read.info.merchantCity,
    nmid: read.info.nmid,
  });
  if (!ok) return fail("Usaha tidak ditemukan.");

  revalidatePath("/app/pos");
  return done({ merchantName: read.info.merchantName, nmid: read.info.nmid });
}

/** Melepas QRIS tersimpan. Hanya owner. */
export async function clearQrisAction(): Promise<ActionResult<null>> {
  const { businessId } = await requireOwner();
  const ok = await db.clearQris(businessId);
  if (!ok) return fail("Usaha tidak ditemukan.");
  revalidatePath("/app/pos");
  return done(null);
}

/**
 * Membuat program loyalty untuk usaha yang belum punya.
 *
 * Tanpa ini modul Loyalty punya jalan buntu: business_modules bisa berkata
 * "aktif" sementara updateLoyaltyProgramAction hanya berbentuk UPDATE, jadi
 * usaha yang belum punya barisnya tidak akan pernah bisa membuatnya sendiri.
 */
export async function createLoyaltyProgramAction(input: {
  mode: "point" | "stamp";
  earnRate: number;
  stampPerVisit: number;
}): Promise<ActionResult<null>> {
  const { businessId } = await requireOwner();

  // Sengaja TIDAK memakai moduleLock mode "write": modul yang belum disiapkan
  // ditolak oleh penjaga itu, dan action inilah yang menyiapkannya. Yang
  // diperiksa cukup kepemilikan dan masa aktifnya.
  const license = await getModuleView(businessId, "loyalty");
  if (license.state === "tidak_dimiliki") return fail("Modul Loyalty belum aktif untuk usaha ini.");
  if (!license.canWrite) return fail("Masa aktif KAEL Loyalty sudah lewat. Perpanjang lewat tim KAEL.");

  if (input.mode === "point") {
    // Batas bawah 1 rupiah ditegakkan juga oleh CHECK di kolomnya. Diperiksa di
    // sini supaya pesannya kalimat, bukan galat constraint dari Postgres.
    if (!Number.isInteger(input.earnRate) || input.earnRate < 1) {
      return fail("Kurs poin harus lebih dari nol. Contoh: Rp 10.000 untuk 1 poin.");
    }
    if (input.earnRate > 10_000_000) return fail("Kurs poin terlalu besar.");
  } else {
    if (!Number.isInteger(input.stampPerVisit) || input.stampPerVisit < 1) {
      return fail("Stempel per kunjungan harus lebih dari nol.");
    }
  }

  const program = await db.createLoyaltyProgram(businessId, input);
  if (!program) return fail("Gagal membuat program loyalty.");

  revalidatePath("/app/loyalty");
  revalidatePath("/app");
  revalidatePath("/app/settings");
  return done(null);
}
