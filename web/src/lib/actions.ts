"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { db } from "./db";
import {
  requireStaff, requireOwner, requireKaelAdmin,
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

export async function loginOwner(email: string): Promise<ActionResult<{ next: string }>> {
  const user = await db.getUserByEmail(email.trim().toLowerCase());
  if (!user || !user.is_active) return fail("Email tidak dikenali.");
  if (user.role !== "owner" && user.role !== "kael_admin") {
    return fail("Akun ini bukan akun pemilik usaha.");
  }

  await createSession({
    userId: user.id,
    businessId: user.business_id,
    role: user.role,
    name: user.name,
  });
  return done({ next: user.role === "kael_admin" ? "/admin/cards" : "/app" });
}

export async function loginStaff(
  businessId: string,
  userId: string,
  pin: string,
): Promise<ActionResult<{ next: string }>> {
  const result = await db.authenticateStaffPin(businessId, userId, pin);
  if (!result.success) return fail(result.error);

  await createSession({
    userId: result.user.id,
    businessId: result.user.business_id,
    role: "staff",
    name: result.user.name,
  });
  return done({ next: "/app/pos" });
}

export async function logout() {
  await destroySession();
  redirect("/app/login");
}

export async function currentSession() {
  return getSession();
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
): Promise<ActionResult<{ cardCode: string }>> {
  const session = await getSession();
  const businessId = session?.businessId;
  if (!businessId) {
    return fail("Masuk sebagai pemilik usaha dulu sebelum mengaktifkan kartu.");
  }

  let url: URL;
  try {
    url = new URL(destinationUrl);
  } catch {
    return fail("Tautan tujuan tidak valid.");
  }
  if (url.protocol !== "https:") return fail("Tautan tujuan harus memakai https.");

  const result = await db.activateCard(code, pin, businessId, url.toString(), label);
  if (!result.success) return fail(result.error!);

  revalidatePath("/app/review");
  return done({ cardCode: result.card!.card_code });
}

export async function updateCardAction(
  cardId: string,
  updates: { destination_url?: string; label?: string; status?: "active" | "suspended" },
): Promise<ActionResult<null>> {
  const { businessId } = await requireOwner();

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

  const result = await db.registerCustomer(businessId, name.trim(), phone, birthday);
  if (!result.success) return fail(result.error);
  return done({ token: result.customer.token, alreadyMember: result.alreadyMember });
}

export async function addPointsAction(
  customerId: string,
  amountSpent: number,
): Promise<ActionResult<{ earned: number; balance: number }>> {
  const { businessId, userId } = await requireStaff();
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
  const { businessId, userId } = await requireStaff();
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
  const { businessId, userId } = await requireStaff();
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
  if (!data.name.trim()) return fail("Nama reward belum diisi.");
  if (data.point_cost <= 0) return fail("Biaya poin harus lebih dari nol.");
  await db.saveReward(businessId, data);
  revalidatePath("/app/loyalty");
  return done(null);
}

export async function deleteRewardAction(id: string): Promise<ActionResult<null>> {
  const { businessId } = await requireOwner();
  const ok = await db.deleteReward(id, businessId);
  if (!ok) return fail("Reward tidak ditemukan.");
  revalidatePath("/app/loyalty");
  return done(null);
}

/** Hak penghapusan data menurut UU PDP. Hanya owner. */
export async function anonymizeCustomerAction(customerId: string): Promise<ActionResult<null>> {
  const { businessId } = await requireOwner();
  const ok = await db.anonymizeCustomer(customerId, businessId);
  if (!ok) return fail("Pelanggan tidak ditemukan.");
  revalidatePath("/app/loyalty");
  return done(null);
}

// ===========================================================================
// POS dan Ordering
// ===========================================================================

export async function openShiftAction(openingCash: number, notes?: string): Promise<ActionResult<null>> {
  const { businessId, userId } = await requireStaff();
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
  const { businessId } = await requireStaff();
  if (physicalCash < 0) return fail("Uang laci tidak boleh negatif.");
  const shift = await db.closeShift(shiftId, businessId, physicalCash, notes);
  if (!shift) return fail("Shift tidak ditemukan atau sudah ditutup.");
  revalidatePath("/app/pos");
  return done({ variance: Number(shift.variance ?? 0) });
}

export async function createOrderAction(input: {
  channel: "cashier" | "qr_dinein" | "qr_takeaway";
  table_no?: string | null;
  payment_method: "cash" | "qris" | "transfer";
  discount?: number;
  tax?: number;
  service_charge?: number;
  cash_given?: number | null;
  customer_id?: string | null;
  items: { menu_item_id: string; qty: number; note?: string }[];
}): Promise<ActionResult<{ orderId: string; orderNo: string; total: number; change: number }>> {
  const { businessId, userId } = await requireStaff();
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
      channel: input.channel,
      table_no: input.table_no ?? null,
      status: input.channel === "cashier" ? "paid" : "open",
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
  channel: "qr_dinein" | "qr_takeaway",
  items: { menu_item_id: string; qty: number; note?: string }[],
): Promise<ActionResult<{ orderId: string; orderNo: string }>> {
  if (!items.length) return fail("Keranjang masih kosong.");

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

  const { order } = await db.createOrder(
    businessId,
    {
      channel, table_no: tableNo, status: "open",
      payment_method: "cash", created_by: owner.id,
    },
    lines,
  );
  revalidatePath("/app/pos");
  return done({ orderId: order.id, orderNo: order.order_no });
}

export async function updateOrderStatusAction(
  orderId: string,
  status: "open" | "paid" | "cancelled",
): Promise<ActionResult<null>> {
  const { businessId } = await requireStaff();
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
  const { businessId } = await requireStaff();
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
  if (newPackPrice <= 0) return fail("Harga harus lebih dari nol.");
  const updated = await db.updateIngredientPrice(ingredientId, businessId, newPackPrice);
  if (!updated) return fail("Bahan tidak ditemukan pada bisnis ini.");
  revalidatePath("/app/finance");
  return done(null);
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
  if (!/^\d{6}$/.test(pin)) return fail("PIN harus 6 angka.");
  await db.createStaff(businessId, name.trim(), pin);
  revalidatePath("/app");
  return done(null);
}

export async function resetStaffPinAction(userId: string, pin: string): Promise<ActionResult<null>> {
  const { businessId } = await requireOwner();
  if (!/^\d{6}$/.test(pin)) return fail("PIN harus 6 angka.");
  const ok = await db.setStaffPin(userId, businessId, pin);
  if (!ok) return fail("Staf tidak ditemukan.");
  revalidatePath("/app");
  return done(null);
}

/** Staf yang resign dinonaktifkan, tidak dihapus: transaksi lama menunjuk ke sini. */
export async function deactivateStaffAction(userId: string): Promise<ActionResult<null>> {
  const { businessId } = await requireOwner();
  const ok = await db.deactivateStaff(userId, businessId);
  if (!ok) return fail("Staf tidak ditemukan.");
  revalidatePath("/app");
  return done(null);
}
