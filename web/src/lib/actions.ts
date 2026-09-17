"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { headers } from "next/headers";

import { db } from "./db";
import type {
  LoyaltyCampaignStatus,
  LoyaltyCampaignSegment,
  StaffPermission,
  FeedbackReasonCode,
  FinanceCalculatorPreset,
  CardService,
  ItemChangeSettlement,
  RefundReasonCode,
  CustomerDirectoryEntry,
  MenuItem,
  Category,
  DeletableTestData,
} from "./types";
import {
  FEEDBACK_REASONS,
  CARD_SERVICE_LABEL,
  CARD_SERVICE_DESTINATION,
} from "./types";
import {
  searchPlaces,
  isPlacesSearchConfigured,
  getGoogleReviewSnapshot,
  buildGoogleReviewUrl,
  extractPlaceIdFromInput,
  type GooglePlaceResult,
} from "./google-places";
import { moduleLock, requireModuleRead, getModuleView } from "./licensing";
import { MODULE_CATALOG } from "./modules-catalog";
import { parseBrandColor } from "./branding";
import { readQris, buildDynamicQris } from "./qris-engine";
import { calculateCartTotals } from "./pos-engine";
import { normalizeLoyaltyCode } from "./loyalty-code";
import {
  isValidIndonesianPhoneNumber,
  normalizePhoneNumber,
} from "./loyalty-engine";
import { hashClientIp } from "./auth-security";
import { normalizeCardCode } from "./card-code";
import { site } from "./site";
import { CAMPAIGN_GOALS, type CampaignGoalKey } from "./campaign-templates";
import {
  requireStaff,
  requireOwner,
  requireKaelAdmin,
  requirePermission,
  AuthError,
  createSession,
  destroySession,
  getSession,
  verifyPin,
  isLegacyPinHash,
  hashPin,
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
const done = <T>(data: T): ActionResult<T> => ({ ok: true, data });

/**
 * Menjalankan penjaga akses dan mengubah PENOLAKANNYA jadi hasil, bukan lemparan.
 *
 * `requirePermission` dan `requireOwner` melempar AuthError, dan sebelum ini
 * tidak ada satu pun aksi yang menangkapnya. Lemparan itu menyeberang ke browser
 * sebagai promise yang ditolak — jadi layar yang menunggu hasilnya tidak pernah
 * menerima apa-apa: tombolnya berhenti di "...", tidak ada pesan, dan kasir
 * mengira sistemnya menggantung.
 *
 * Kasir Mochi memicunya setiap kali: izin `loyalty`-nya belum diberikan, jadi
 * tombol "Daftar & pakai" selalu berakhir menggantung tanpa pernah menjelaskan
 * apa yang kurang.
 *
 * Sekarang penolakan akses berbentuk sama dengan kegagalan lain — layar bisa
 * menampilkannya seperti biasa, dan tombolnya kembali normal.
 */
async function denganAkses<T>(
  penjaga: () => Promise<T>,
): Promise<{ ok: true; sesi: T } | { ok: false; error: string }> {
  try {
    return { ok: true, sesi: await penjaga() };
  } catch (error) {
    if (error instanceof AuthError) return { ok: false, error: error.message };
    throw error;
  }
}

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
  return done({
    next: user.role === "kael_admin" ? "/admin/businesses" : "/app",
  });
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
  if (clean.length < 3)
    return { ok: false, error: "Kode toko terlalu pendek." };

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

  /**
   * Alamat tujuan hanya disimpan kalau layanan kartunya memang membacanya.
   *
   * Layar aktivasi lama melempar setiap kartu selain `link` ke pemilih tempat
   * Google, jadi kartu member pun pulang membawa alamat ulasan Google yang
   * tidak pernah dibuka rute mana pun — tapi tetap tampil di dasbor seolah
   * kartu itu juga melayani ulasan. Yang dikirim browser tidak dipercaya di
   * sini: jenis kartunya yang menentukan.
   */
  let tujuan: string | null = null;
  if (CARD_SERVICE_DESTINATION[card.type]) {
    let url: URL;
    try {
      url = new URL(destinationUrl);
    } catch {
      return fail("Tautan tujuan tidak valid.");
    }
    if (url.protocol !== "https:")
      return fail("Tautan tujuan harus memakai https.");
    tujuan = url.toString();
  }

  const cardLabel = label?.trim() || placeDetails?.name || "Meja Kasir";
  const result = await db.activateCard(
    code,
    pin,
    businessId,
    tujuan,
    cardLabel,
  );
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
export async function checkCardAction(code: string): Promise<
  ActionResult<{
    status: "unactivated" | "active" | "suspended";
    /**
     * Jenis kartu ikut dikembalikan supaya layar aktivasi tahu jalur mana
     * yang harus ditampilkan: memilih lokasi Google, atau mengetik tautan
     * bebas. Tanpa ini layarnya harus menebak, dan menebak berarti kartu
     * tautan dipaksa memilih tempat di Google yang tidak pernah ada.
     */
    type: "review" | "loyalty" | "attendance" | "link" | "smart_touch";
  }>
> {
  const card = await db.getCardByCode(code);
  if (!card) return fail(`Kartu ${code} tidak dikenali.`);
  if (card.status === "active")
    return fail("Kartu ini sudah pernah diaktivasi.");
  if (card.status === "suspended") return fail("Kartu ini tidak aktif.");
  return done({ status: card.status, type: card.type });
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
  updates: {
    destination_url?: string;
    label?: string;
    status?: "active" | "suspended";
  },
): Promise<ActionResult<null>> {
  const { businessId } = await requireOwner();
  const locked = await moduleLock(businessId, "review", "write");
  if (locked) return fail(locked);

  if (updates.destination_url) {
    try {
      const u = new URL(updates.destination_url);
      if (u.protocol !== "https:")
        return fail("Tautan tujuan harus memakai https.");
    } catch {
      return fail("Tautan tujuan tidak valid.");
    }

    /**
     * Hanya layanan yang benar-benar MEMBACA destination_url yang boleh
     * mengisinya. Sebelum ini alamat bisa disimpan ke kartu jenis apa pun —
     * di basis data masih ada kartu member yang menyimpan tautan ulasan
     * Google yang tidak pernah dipakai rute mana pun, tapi tetap tampil di
     * dashboard seolah berarti.
     */
    const existing = (await db.getCards(businessId)).find(
      (c) => c.id === cardId,
    );
    if (!existing) return fail("Kartu tidak ditemukan pada bisnis ini.");
    if (!CARD_SERVICE_DESTINATION[existing.type]) {
      return fail(
        `Kartu ${CARD_SERVICE_LABEL[existing.type]} tidak memakai alamat tujuan, jadi mengisinya tidak akan berpengaruh.`,
      );
    }
  }

  const card = await db.updateCard(cardId, businessId, updates);
  if (!card) return fail("Kartu tidak ditemukan pada bisnis ini.");
  if (card.type === "review" && updates.destination_url) {
    const placeId = extractPlaceIdFromInput(updates.destination_url);
    if (placeId) {
      await db.updateBusiness(businessId, { google_place_id: placeId });
      revalidatePath(`/touch/${card.card_code}`);
    }
  }
  revalidatePath("/app/review");
  return done(null);
}

/**
 * Menentukan satu-satunya layanan yang dijalankan sebuah kartu.
 *
 * Pemilik memang harus memilih: kartu ulasan tidak bisa sekalian jadi kartu
 * member, dan Smart Touch tidak menumpang di kartu tautan. Pemeriksaan sisa
 * data ada di db.setCardService supaya tidak ada yang hilang diam-diam.
 */
export async function setCardServiceAction(
  cardId: string,
  service: CardService,
): Promise<ActionResult<null>> {
  const { businessId } = await requireOwner();
  const locked = await moduleLock(businessId, "review", "write");
  if (locked) return fail(locked);

  if (!CARD_SERVICE_LABEL[service])
    return fail("Layanan kartu tidak dikenali.");

  const res = await db.setCardService(cardId, businessId, service);
  if (!res.ok) return fail(res.error!);

  revalidatePath("/app/review");
  if (res.card) revalidatePath(`/touch/${res.card.card_code}`);
  return done(null);
}

/**
 * Jalur sadar-data untuk pemilik yang ingin memakai ulang kartu Smart Touch.
 * Cadangan konfigurasi dibuat dulu di database, sehingga pindah layanan tidak
 * berubah menjadi penghapusan tombol yang tidak bisa dijelaskan.
 */
export async function archiveSmartTouchAndSetCardServiceAction(
  cardId: string,
  service: Exclude<CardService, "smart_touch">,
): Promise<ActionResult<null>> {
  const session = await requireOwner();
  const locked = await moduleLock(session.businessId, "review", "write");
  if (locked) return fail(locked);
  if (!CARD_SERVICE_LABEL[service])
    return fail("Layanan kartu tidak dikenali.");

  const res = await db.archiveSmartTouchAndSetCardService(
    cardId,
    session.businessId,
    session.userId,
    service,
  );
  if (!res.ok) return fail(res.error!);

  await db.recordAuditEvent({
    businessId: session.businessId,
    actorUserId: session.userId,
    action: "smart_touch.archived_for_service_change",
    entityType: "card",
    entityId: cardId,
    metadata: { nextService: service },
  });
  revalidatePath("/app/review");
  if (res.card) revalidatePath(`/r/${res.card.card_code}`);
  return done(null);
}

/**
 * Alamat yang dicetak sebagai kode QR di struk pelanggan.
 *
 * Dua kemungkinan, dan keduanya berguna:
 *
 *   sudah member  -> halaman kartu miliknya, tempat poinnya terlihat
 *   belum member  -> halaman pendaftaran toko ini
 *
 * Token member TIDAK ikut pada hasil pencarian kasir, dan itu disengaja:
 * token adalah kunci masuk ke halaman member, jadi mencantumkannya di tiap
 * hasil pencarian berarti membagikan kunci seluruh pelanggan ke layar kasir.
 * Di sini pengungkapannya terikat pada satu transaksi yang benar-benar terjadi,
 * dan strukya memang diserahkan ke orang itu juga.
 */
export async function getReceiptQrTargetAction(
  orderId: string,
): Promise<ActionResult<{ url: string; jenis: "member" | "daftar"; label: string }>> {
  const akses = await denganAkses(() => requirePermission("pos"));
  if (!akses.ok) return fail(akses.error);
  const { businessId } = akses.sesi;

  const business = await db.getBusiness(businessId);
  const asal = site.url.replace(/\/$/, "");

  const daftar = {
    url: `${asal}/loyalty/register?toko=${encodeURIComponent(business?.store_code ?? "")}`,
    jenis: "daftar" as const,
    label: "Scan untuk jadi member & kumpulkan poin",
  };

  const hasil = await db.getOrderById(orderId);
  const order = hasil?.order;
  if (!order || order.business_id !== businessId) return done(daftar);
  if (!order.customer_id) return done(daftar);

  const customer = await db.getCustomerById(order.customer_id, businessId);
  if (!customer?.token) return done(daftar);

  return done({
    url: `${asal}/m/${customer.token}`,
    jenis: "member",
    label: "Scan untuk buka kartu member & cek poin",
  });
}

/** Penerbitan batch hanya untuk tim KAEL. */
export async function issueCardsAction(
  count: number,
  type: "review" | "loyalty" | "attendance" | "link" | "smart_touch",
): Promise<ActionResult<{ card_code: string; activation_pin: string }[]>> {
  await requireKaelAdmin();
  if (count < 1 || count > 200)
    return fail("Jumlah kartu harus antara 1 dan 200.");
  const issued = await db.createBatchCards(count, type);
  revalidatePath("/admin/cards");
  return done(issued);
}

/** Cabut akses kartu dan reset ke status unactivated (hanya untuk Admin KAEL) */
export async function adminResetCardAction(
  cardId: string,
): Promise<ActionResult<null>> {
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
export async function adminDeleteCardAction(
  cardId: string,
): Promise<ActionResult<null>> {
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
  marketingOptIn = false,
  referralCode?: string,
): Promise<ActionResult<{ token: string | null; alreadyMember: boolean }>> {
  // UU PDP: persetujuan harus diberikan aktif, bukan kotak yang sudah tercentang.
  if (!consent)
    return fail("Persetujuan penyimpanan data diperlukan untuk mendaftar.");
  const cleanName = name.trim().replace(/\s+/g, " ");
  if (cleanName.length < 2 || cleanName.length > 80)
    return fail("Nama harus berisi 2 sampai 80 karakter.");
  if (!isValidIndonesianPhoneNumber(phone))
    return fail(
      "Nomor WhatsApp tidak valid. Gunakan nomor Indonesia yang aktif.",
    );

  /**
   * Jalur publik: yang memanggil ini pelanggan, bukan staf. Kalau modul
   * Loyalty toko ini belum aktif atau sudah lewat masa aktifnya, pendaftaran
   * ditolak — tapi alasannya TIDAK disebutkan. Pelanggan tidak perlu, dan
   * tidak pantas, tahu bahwa tokonya telat memperpanjang langganan.
   */
  if (await moduleLock(businessId, "loyalty", "write")) {
    return fail("Pendaftaran member sedang tidak tersedia di toko ini.");
  }

  const requestHeaders = await headers();
  const forwarded = requestHeaders.get("x-forwarded-for");
  const clientIp =
    forwarded?.split(",")[0]?.trim() || requestHeaders.get("x-real-ip");
  if (
    clientIp &&
    !(await db.allowPublicLoyaltyRegistration(
      businessId,
      await hashClientIp(clientIp),
    ))
  ) {
    return fail(
      "Terlalu banyak pendaftaran dari jaringan ini. Coba lagi dalam satu jam.",
    );
  }

  /**
   * Kode referral divalidasi di server, tidak sekadar dipercaya dari klien.
   * Kode yang salah ketik, sudah tidak aktif, atau milik bisnis lain dilewati
   * diam-diam — pendaftaran tetap jalan, cuma tanpa mengaitkan siapa pun.
   */
  const referrer = referralCode?.trim()
    ? await db.resolveReferralCode(
        businessId,
        normalizeLoyaltyCode(referralCode),
      )
    : null;

  const result = await db.registerCustomer(
    businessId,
    cleanName,
    phone,
    birthday,
    marketingOptIn,
    referrer?.customerId ?? null,
  );
  if (!result.success) return fail(result.error);
  // Nomor yang sudah terdaftar tidak boleh pernah mengembalikan token kartu.
  return done({
    token: result.alreadyMember ? null : result.customer.token,
    alreadyMember: result.alreadyMember,
  });
}

/** Owner menyimpan snapshot Google sekarang. Cron memakai helper yang sama. */
export async function syncGoogleReviewSnapshotAction(): Promise<
  ActionResult<{ rating: number; reviewCount: number }>
> {
  const { businessId, userId } = await requireOwner();
  const locked = await moduleLock(businessId, "review", "write");
  if (locked) return fail(locked);
  const business = await db.getBusiness(businessId);
  if (!business?.google_place_id)
    return fail("Place ID Google belum diisi pada usaha ini.");
  const snapshot = await getGoogleReviewSnapshot(business.google_place_id);
  if (!snapshot)
    return fail(
      "Google Places belum terhubung atau tidak bisa membaca rating toko ini.",
    );
  await db.createGoogleReviewSnapshot(businessId, {
    googlePlaceId: business.google_place_id,
    rating: snapshot.rating,
    reviewCount: snapshot.reviewCount,
  });
  await db.recordAuditEvent({
    businessId,
    actorUserId: userId,
    action: "review.snapshot_sync",
    entityType: "business",
    entityId: businessId,
    metadata: snapshot,
  });
  revalidatePath("/app/review");
  return done(snapshot);
}

export async function saveReviewStandeeAction(
  cardId: string,
  data: { headline: string; body: string; printSize: "A6" | "A5" | "A4" },
): Promise<ActionResult<null>> {
  const { businessId, userId } = await requireOwner();
  const locked = await moduleLock(businessId, "review", "write");
  if (locked) return fail(locked);
  if (data.headline.trim().length < 3 || data.headline.trim().length > 120)
    return fail("Judul standee harus 3 sampai 120 karakter.");
  if (data.body.trim().length < 3 || data.body.trim().length > 300)
    return fail("Isi standee harus 3 sampai 300 karakter.");
  const saved = await db.saveReviewStandee(cardId, businessId, {
    headline: data.headline.trim(),
    body: data.body.trim(),
    printSize: data.printSize,
  });
  if (!saved) return fail("Kartu review tidak ditemukan.");
  await db.recordAuditEvent({
    businessId,
    actorUserId: userId,
    action: "review.standee_saved",
    entityType: "card",
    entityId: cardId,
  });
  revalidatePath(`/app/review/standee/${cardId}`);
  return done(null);
}

export async function saveSmartTouchAction(
  cardId: string,
  data: {
    title: string;
    subtitle?: string;
    buttons: {
      actionKey:
        | "review"
        | "whatsapp"
        | "menu"
        | "member"
        | "location"
        | "booking"
        | "custom";
      label: string;
      targetUrl: string;
      enabled: boolean;
    }[];
  },
): Promise<ActionResult<null>> {
  const { businessId, userId } = await requireOwner();
  const locked = await moduleLock(businessId, "review", "write");
  if (locked) return fail(locked);

  /**
   * Smart Touch hanya boleh menempel pada kartu yang MEMANG kartu Smart
   * Touch. Tanpa penjaga ini, tombol bisa dipasang ke kartu jenis apa pun —
   * dan dulu itulah yang membuat kartu `link` diam-diam berhenti memakai
   * tautan tujuannya.
   */
  const targetCard = (await db.getCards(businessId)).find(
    (c) => c.id === cardId,
  );
  if (!targetCard) return fail("Kartu tidak ditemukan pada bisnis ini.");
  if (targetCard.type !== "smart_touch") {
    return fail(
      `Kartu ini dipakai untuk layanan ${CARD_SERVICE_LABEL[targetCard.type]}, bukan Smart Touch. Satu kartu hanya melayani satu hal — ubah dulu layanan kartunya kalau memang mau dijadikan Smart Touch.`,
    );
  }

  const business = await db.getBusiness(businessId);
  if (!business) return fail("Usaha tidak ditemukan.");
  if (data.title.trim().length < 2 || data.title.trim().length > 80)
    return fail("Judul halaman harus 2 sampai 80 karakter.");
  if (!data.buttons.length || data.buttons.length > 7)
    return fail("Isi 1 sampai 7 tombol aksi.");
  const seen = new Set<string>();
  for (const button of data.buttons) {
    if (seen.has(button.actionKey))
      return fail("Satu jenis aksi hanya boleh satu tombol.");
    seen.add(button.actionKey);
    if (button.label.trim().length < 2 || button.label.trim().length > 50)
      return fail("Label tombol harus 2 sampai 50 karakter.");
    if (button.enabled && button.actionKey !== "review") {
      try {
        if (new URL(button.targetUrl).protocol !== "https:")
          return fail("Tujuan tombol yang tampil harus memakai https.");
      } catch {
        return fail("Ada tujuan tombol yang tampil tidak valid.");
      }
    }
  }
  const reviewIsEnabled = data.buttons.some(
    (button) => button.actionKey === "review" && button.enabled,
  );
  if (reviewIsEnabled && !business.google_place_id?.trim()) {
    return fail(
      "Isi Place ID Google di pengaturan usaha sebelum menampilkan tombol ulasan Google.",
    );
  }
  const reviewUrl = business.google_place_id
    ? buildGoogleReviewUrl(business.google_place_id)
    : null;
  const saved = await db.saveSmartTouch(cardId, businessId, {
    title: data.title.trim(),
    subtitle: data.subtitle?.trim() || null,
    buttons: data.buttons.map((button, index) => ({
      actionKey: button.actionKey,
      label: button.label.trim(),
      targetUrl:
        button.actionKey === "review" && reviewUrl
          ? reviewUrl
          : button.targetUrl.trim(),
      enabled: button.enabled,
      sortOrder: index,
    })),
  });
  if (!saved)
    return fail(
      "Kartu Smart Touch tidak ditemukan. Gunakan kartu jenis Link yang sudah aktif.",
    );
  await db.recordAuditEvent({
    businessId,
    actorUserId: userId,
    action: "smart_touch.saved",
    entityType: "card",
    entityId: cardId,
  });
  revalidatePath(`/touch/${saved.card_code}`);
  revalidatePath("/app/review");
  return done(null);
}

/** Jalur publik untuk member mengatur izin menerima pesan promo dari kartu mereka. */
export async function updateMarketingPreferenceAction(
  token: string,
  marketingOptIn: boolean,
): Promise<ActionResult<null>> {
  if (!token || token.length < 16) return fail("Kartu member tidak valid.");
  const updated = await db.updateCustomerMarketingPreference(
    token,
    marketingOptIn,
  );
  if (!updated) return fail("Kartu member tidak ditemukan.");
  revalidatePath(`/m/${token}`);
  return done(null);
}

/**
 * Member melengkapi tanggal lahirnya sendiri dari kartu member. Jalur publik,
 * sama seperti updateMarketingPreferenceAction — dijaga token, bukan login.
 */
export async function updateCustomerBirthdayAction(
  token: string,
  birthday: string,
): Promise<ActionResult<null>> {
  if (!token || token.length < 16) return fail("Kartu member tidak valid.");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(birthday))
    return fail("Tanggal lahir tidak valid.");
  const parsed = new Date(birthday);
  /**
   * Kelonggaran 24 jam, bukan Date.now() presis. `birthday` cuma tanggal
   * kalender tanpa zona waktu, sementara Date.now() adalah instan UTC.
   * Tanpa kelonggaran, pelanggan yang harinya sudah berganti di WIB
   * (UTC+7) tapi UTC server belum akan ditolak mengisi tanggal "hari ini".
   */
  if (
    Number.isNaN(parsed.getTime()) ||
    parsed.getTime() > Date.now() + 24 * 60 * 60 * 1000
  ) {
    return fail("Tanggal lahir tidak valid.");
  }
  const updated = await db.updateCustomerBirthday(token, birthday);
  if (!updated)
    return fail(
      "Tanggal lahir sudah tersimpan sebelumnya, atau kartu member tidak ditemukan.",
    );
  revalidatePath(`/m/${token}`);
  return done(null);
}

/**
 * Feedback pascatransaksi dari halaman struk. Jalur publik — dijaga oleh
 * order_id yang sudah ada di tautan struk, sama seperti jalur publik lain di
 * berkas ini. Tidak ada moduleLock: menahan feedback pelanggan karena
 * langganan owner telat bayar cuma merugikan pelanggan, bukan owner.
 */
export async function submitFeedbackAction(input: {
  orderId: string;
  rating: number;
  reasonCode?: FeedbackReasonCode;
  comment?: string;
}): Promise<ActionResult<null>> {
  if (!input.orderId) return fail("Pesanan tidak dikenali.");
  if (!Number.isInteger(input.rating) || input.rating < 1 || input.rating > 5)
    return fail("Rating tidak valid.");
  if (
    input.reasonCode &&
    !FEEDBACK_REASONS.some((r) => r.key === input.reasonCode)
  )
    return fail("Alasan tidak dikenal.");
  const comment = input.comment?.trim() || null;
  if (comment && comment.length > 500)
    return fail("Komentar maksimal 500 karakter.");

  const result = await db.submitFeedback(
    input.orderId,
    input.rating,
    input.reasonCode ?? null,
    comment,
  );
  if (!result.success) return fail(result.error);
  revalidatePath(`/receipt/${input.orderId}`);
  return done(null);
}

/**
 * Rating dari tap kartu NFC. Jalur publik: tidak ada sesi, tidak ada login.
 *
 * Alamat ulasan Google milik kartu selalu dikembalikan dari database, bukan
 * dari apa pun yang dikirim peramban. Dengan begitu semua pelanggan mendapat
 * pilihan Google yang sama, tanpa mengarahkan rating tertentu ke sana.
 */
export async function submitCardFeedbackAction(input: {
  cardCode: string;
  rating: number;
}): Promise<ActionResult<{ feedbackId: string; reviewUrl: string | null }>> {
  const cardCode = normalizeCardCode(input.cardCode);
  if (!cardCode) return fail("Kartu tidak dikenali.");
  if (!Number.isInteger(input.rating) || input.rating < 1 || input.rating > 5) {
    return fail("Rating tidak valid.");
  }

  const card = await db.getRatingCard(cardCode);
  if (!card) return fail("Kartu tidak dikenali.");

  // Alasan penolakan tidak disebutkan ke pelanggan, sama seperti pendaftaran
  // member: dia tidak perlu tahu tokonya telat memperpanjang langganan.
  if (await moduleLock(card.business_id, "review", "write")) {
    return fail("Penilaian sedang tidak tersedia di toko ini.");
  }

  const requestHeaders = await headers();
  const forwarded = requestHeaders.get("x-forwarded-for");
  const clientIp =
    forwarded?.split(",")[0]?.trim() || requestHeaders.get("x-real-ip");
  if (
    clientIp &&
    !(await db.allowCardFeedback(
      card.business_id,
      await hashClientIp(clientIp),
    ))
  ) {
    return fail(
      "Terlalu banyak penilaian dari jaringan ini. Coba lagi dalam satu jam.",
    );
  }

  const result = await db.submitCardFeedback(cardCode, input.rating);
  if (!result.success) return fail(result.error);

  return done({
    feedbackId: result.feedbackId,
    reviewUrl: result.reviewUrl,
  });
}

/** Alasan dan cerita yang menyusul, ditempelkan ke baris rating yang sama. */
export async function attachCardFeedbackAction(input: {
  feedbackId: string;
  reasonCode?: FeedbackReasonCode;
  comment?: string;
}): Promise<ActionResult<null>> {
  if (!input.feedbackId) return fail("Penilaian tidak dikenali.");
  if (
    input.reasonCode &&
    !FEEDBACK_REASONS.some((r) => r.key === input.reasonCode)
  ) {
    return fail("Alasan tidak dikenal.");
  }
  const comment = input.comment?.trim() || null;
  if (comment && comment.length > 500)
    return fail("Komentar maksimal 500 karakter.");
  if (!input.reasonCode && !comment)
    return fail("Pilih bagian yang kurang atau tulis ceritanya.");

  const ok = await db.attachCardFeedbackDetail(
    input.feedbackId,
    input.reasonCode ?? null,
    comment,
  );
  if (!ok) return fail("Penilaian ini sudah dikirim sebelumnya.");
  return done(null);
}

/** Pencarian pelanggan untuk dashboard kasir. */
export async function searchCustomersAction(query: string) {
  const { businessId } = await requireModuleRead("loyalty");
  if (!query.trim()) return [];
  return db.searchCustomers(businessId, query);
}

/**
 * Pencarian dan resolusi scan QR Member untuk kasir POS.
 * Menerima token kartu QR, link kartu (/m/[token]), nomor telepon WA, atau nama.
 */
export async function lookupMemberAction(query: string): Promise<
  ActionResult<{
    found: boolean;
    customer: CustomerDirectoryEntry | null;
    matches: CustomerDirectoryEntry[];
  }>
> {
  const session = await getSession();
  if (!session?.businessId || (session.role !== "owner" && session.role !== "staff")) {
    return fail("Akses tidak diizinkan.");
  }
  const businessId = session.businessId;

  const raw = (query || "").trim();
  if (!raw) return done({ found: false, customer: null, matches: [] });

  // 1. Ekstrak token jika input adalah URL kartu member (misal: https://kaels.site/m/TOKEN atau /m/TOKEN)
  let tokenCandidate = raw;
  const matchUrl = raw.match(/\/m\/([a-zA-Z0-9_\-]+)/);
  if (matchUrl && matchUrl[1]) {
    tokenCandidate = matchUrl[1];
  }

  // 2. Coba lookup langsung berdasarkan token kartu member
  if (tokenCandidate.length >= 8) {
    const custByToken = await db.getCustomerByToken(tokenCandidate);
    if (custByToken && custByToken.business_id === businessId) {
      const balance = await db.getCustomerPointBalance(custByToken.id);
      const last4 = custByToken.phone.slice(-4);
      return done({
        found: true,
        customer: {
          id: custByToken.id,
          name: custByToken.name,
          phone_masked: `+62 ***-***-${last4}`,
          phone_last4: last4,
          balance,
          created_at: custByToken.created_at,
        },
        matches: [],
      });
    }
  }

  // 3. Coba lookup nomor WhatsApp persis
  const normalizedPhone = normalizePhoneNumber(raw);
  if (normalizedPhone) {
    const custByPhone = await db.getCustomerByPhone(businessId, normalizedPhone);
    if (custByPhone) {
      const balance = await db.getCustomerPointBalance(custByPhone.id);
      const last4 = custByPhone.phone.slice(-4);
      return done({
        found: true,
        customer: {
          id: custByPhone.id,
          name: custByPhone.name,
          phone_masked: `+62 ***-***-${last4}`,
          phone_last4: last4,
          balance,
          created_at: custByPhone.created_at,
        },
        matches: [],
      });
    }
  }

  // 4. Pencarian teks / wildcard (nama atau potongan nomor)
  const searchResults = await db.searchCustomers(businessId, raw);
  if (searchResults.length === 1) {
    return done({
      found: true,
      customer: searchResults[0],
      matches: searchResults,
    });
  }

  return done({
    found: searchResults.length > 0,
    customer: null,
    matches: searchResults,
  });
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
  referral_is_active?: boolean;
  referral_referrer_points?: number;
  referral_referee_points?: number;
  referral_monthly_cap?: number;
  birthday_is_active?: boolean;
  birthday_bonus_points?: number;
  birthday_window_days?: number;
  tiers_is_active?: boolean;
  unit_name?: string;
  minimum_purchase?: number;
  max_earn_per_transaction?: number | null;
  rounding_mode?: "floor" | "round";
}): Promise<ActionResult<null>> {
  const { businessId } = await requireOwner();
  const locked = await moduleLock(businessId, "loyalty", "write");
  if (locked) return fail(locked);
  if (updates.earn_rate !== undefined && updates.earn_rate <= 0) {
    return fail("Kurs poin harus lebih dari nol.");
  }
  if (
    updates.unit_name !== undefined &&
    (updates.unit_name.trim().length < 2 ||
      updates.unit_name.trim().length > 30)
  ) {
    return fail("Nama unit loyalty harus 2 sampai 30 karakter.");
  }
  if (
    updates.minimum_purchase !== undefined &&
    (!Number.isInteger(updates.minimum_purchase) ||
      updates.minimum_purchase < 0)
  ) {
    return fail("Minimum belanja tidak valid.");
  }
  if (
    updates.max_earn_per_transaction !== undefined &&
    updates.max_earn_per_transaction !== null &&
    (!Number.isInteger(updates.max_earn_per_transaction) ||
      updates.max_earn_per_transaction < 1)
  ) {
    return fail("Batas poin per transaksi harus bilangan bulat positif.");
  }
  if (
    updates.point_expiry_months !== undefined &&
    updates.point_expiry_months !== null &&
    (!Number.isInteger(updates.point_expiry_months) ||
      updates.point_expiry_months < 1 ||
      updates.point_expiry_months > 120)
  ) {
    return fail("Masa berlaku poin harus 1 sampai 120 bulan.");
  }
  if (
    updates.referral_referrer_points !== undefined &&
    (!Number.isInteger(updates.referral_referrer_points) ||
      updates.referral_referrer_points < 0)
  ) {
    return fail("Poin bonus untuk pengajak tidak valid.");
  }
  if (
    updates.referral_referee_points !== undefined &&
    (!Number.isInteger(updates.referral_referee_points) ||
      updates.referral_referee_points < 0)
  ) {
    return fail("Poin bonus untuk teman baru tidak valid.");
  }
  if (
    updates.referral_monthly_cap !== undefined &&
    (!Number.isInteger(updates.referral_monthly_cap) ||
      updates.referral_monthly_cap < 1 ||
      updates.referral_monthly_cap > 1000)
  ) {
    return fail("Batas bulanan referral harus 1 sampai 1.000.");
  }
  if (
    updates.birthday_bonus_points !== undefined &&
    (!Number.isInteger(updates.birthday_bonus_points) ||
      updates.birthday_bonus_points < 0)
  ) {
    return fail("Poin bonus ulang tahun tidak valid.");
  }
  if (
    updates.birthday_window_days !== undefined &&
    (!Number.isInteger(updates.birthday_window_days) ||
      updates.birthday_window_days < 1 ||
      updates.birthday_window_days > 30)
  ) {
    return fail("Jendela deteksi ulang tahun harus 1 sampai 30 hari.");
  }
  await db.updateLoyaltyProgram(businessId, updates);
  revalidatePath("/app/loyalty");
  // Halaman pendaftaran menampilkan kurs poin, jadi ikut disegarkan.
  revalidatePath("/loyalty/register");
  return done(null);
}

/** Menerapkan poin kedaluwarsa yang sudah jatuh tempo, setelah owner meninjau daftarnya. */
export async function expireDuePointsAction(): Promise<
  ActionResult<{ points: number }>
> {
  const { businessId, userId } = await requireOwner();
  const locked = await moduleLock(businessId, "loyalty", "write");
  if (locked) return fail(locked);
  const program = await db.getLoyaltyProgram(businessId);
  if (!program?.point_expiry_months)
    return fail("Atur masa berlaku poin terlebih dahulu.");
  const points = await db.expireDuePoints(
    businessId,
    userId,
    program.point_expiry_months,
  );
  revalidatePath("/app/loyalty");
  return done({ points });
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
  if (amountSpent > 50_000_000)
    return fail("Nominal terlalu besar. Periksa kembali.");

  const customer = await db.getCustomerById(customerId, businessId);
  if (!customer) return fail("Pelanggan tidak ditemukan pada bisnis ini.");

  const entry = await db.earnPointsFromPurchase(
    businessId,
    customerId,
    amountSpent,
    userId,
  );
  const balance = await db.getCustomerPointBalance(customerId);
  revalidatePath("/app/loyalty");
  return done({ earned: entry?.delta ?? 0, balance });
}

/**
 * Kasir mendaftarkan member langsung dari layarnya.
 *
 * Jalur ini ada karena jalur yang lain tidak selalu bisa dipakai. Pelanggan
 * yang tangannya penuh, ponselnya lowbat, atau yang memang tidak mau menyentuh
 * kartu di meja tetap bisa jadi member cuma dengan menyebutkan nomornya. Yang
 * mengetik kasirnya.
 *
 * Bedanya dari pendaftaran publik: tidak ada pembatas laju per jaringan, karena
 * yang memanggil sudah masuk dengan PIN dan setiap barisnya tercatat atas nama
 * siapa. Yang tetap sama: nomor yang sudah terdaftar TIDAK membuat baris kedua,
 * dia memulangkan member yang sudah ada — kasir sering mendaftarkan ulang orang
 * yang lupa pernah daftar.
 */
export async function registerCustomerByStaffAction(input: {
  name: string;
  phone: string;
}): Promise<
  ActionResult<{
    /** Bentuknya sama dengan hasil pencarian, supaya layar kasir bisa langsung
     * menempelkannya ke keranjang tanpa memanggil pencarian sekali lagi. */
    customer: import("./types").CustomerDirectoryEntry;
    token: string;
    alreadyMember: boolean;
  }>
> {
  /**
   * Penolakan izin dikembalikan sebagai kegagalan biasa, bukan dilempar.
   * Kalau dilempar, tombol "Daftar & pakai" di layar kasir berhenti di "..."
   * selamanya tanpa satu pun keterangan — dan kasir yang izin loyalty-nya
   * belum diberikan memicunya setiap kali.
   */
  const akses = await denganAkses(() => requirePermission("loyalty"));
  if (!akses.ok) return fail(akses.error);
  const { businessId } = akses.sesi;

  const locked = await moduleLock(businessId, "loyalty", "write");
  if (locked) return fail(locked);

  const name = input.name?.trim();
  if (!name) return fail("Nama pelanggan belum diisi.");
  if (name.length > 80) return fail("Nama terlalu panjang.");
  if (!isValidIndonesianPhoneNumber(input.phone)) {
    return fail("Nomor WhatsApp tidak valid. Contoh: 081234567890");
  }

  /**
   * marketingOptIn sengaja false. Persetujuan menerima promo harus datang dari
   * orangnya sendiri; kasir yang mencentangkannya atas nama pelanggan bukan
   * persetujuan, dan UU PDP tidak membedakan niat baik dari pelanggaran.
   */
  const result = await db.registerCustomer(
    businessId,
    name,
    input.phone,
    undefined,
    false,
  );
  if (!result.success) return fail(result.error);

  /**
   * Saldo dibaca ulang, tidak diasumsikan nol. Nomor yang sudah terdaftar
   * memulangkan member lama beserta poin yang sudah dia kumpulkan, dan kasir
   * yang melihat "0 poin" untuk pelanggan lama akan mengira datanya hilang.
   */
  const balance = await db.getCustomerPointBalance(result.customer.id);
  const last4 = result.customer.phone.slice(-4);

  revalidatePath("/app/loyalty");
  revalidatePath("/app/pos");
  return done({
    customer: {
      id: result.customer.id,
      name: result.customer.name,
      created_at: result.customer.created_at,
      phone_last4: last4,
      phone_masked: `+62 ***-***-${last4}`,
      balance,
    },
    token: result.customer.token,
    alreadyMember: result.alreadyMember,
  });
}

/** Isi kartu member yang dikarang pemilik usaha. Logo dan warna bukan di sini. */
export async function saveMemberCardSettingsAction(input: {
  headline?: string;
  welcomeText?: string;
  openingHours?: string;
  instagram?: string;
  whatsapp?: string;
  announcement?: string;
  showMenu: boolean;
}): Promise<ActionResult<null>> {
  const { businessId } = await requireOwner();
  const locked = await moduleLock(businessId, "loyalty", "write");
  if (locked) return fail(locked);

  const potong = (v: string | undefined, maks: number) => {
    const t = v?.trim();
    return t ? t.slice(0, maks) : null;
  };

  const whatsapp = input.whatsapp?.trim();
  if (whatsapp && !isValidIndonesianPhoneNumber(whatsapp)) {
    return fail("Nomor WhatsApp toko tidak valid. Contoh: 081234567890");
  }

  await db.saveMemberCardSettings(businessId, {
    headline: potong(input.headline, 60),
    welcome_text: potong(input.welcomeText, 200),
    opening_hours: potong(input.openingHours, 120),
    instagram: potong(input.instagram, 100),
    // Disimpan dalam bentuk wa.me: kode negara, tanpa "+", tanpa nol depan.
    whatsapp: whatsapp ? normalizePhoneNumber(whatsapp) : null,
    announcement: potong(input.announcement, 300),
    show_menu: input.showMenu,
  });

  revalidatePath("/app/loyalty");
  return done(null);
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
  if (!Number.isInteger(delta) || delta === 0)
    return fail("Jumlah poin tidak valid.");
  if (Math.abs(delta) > 1000)
    return fail("Penyesuaian manual dibatasi 1000 poin.");
  if (!note.trim()) return fail("Alasan penyesuaian wajib diisi.");

  const customer = await db.getCustomerById(customerId, businessId);
  if (!customer) return fail("Pelanggan tidak ditemukan pada bisnis ini.");

  await db.addPointTransaction(
    businessId,
    customerId,
    delta,
    "manual",
    note.trim(),
    null,
    userId,
  );
  const balance = await db.getCustomerPointBalance(customerId);
  revalidatePath("/app/loyalty");
  return done({ balance });
}

export async function redeemRewardAction(
  customerId: string,
  rewardId: string,
): Promise<ActionResult<{ code: string; rewardName: string }>> {
  // Sama seperti pendaftaran member: penolakan izin harus sampai ke layar
  // sebagai kalimat, bukan sebagai tombol yang diam.
  const aksesTukar = await denganAkses(() => requirePermission("loyalty"));
  if (!aksesTukar.ok) return fail(aksesTukar.error);
  const { businessId, userId } = aksesTukar.sesi;
  const locked = await moduleLock(businessId, "loyalty", "write");
  if (locked) return fail(locked);
  const customer = await db.getCustomerById(customerId, businessId);
  if (!customer) return fail("Pelanggan tidak ditemukan pada bisnis ini.");

  const result = await db.issueRedemption(
    businessId,
    customerId,
    rewardId,
    userId,
  );
  if (!result.success) return fail(result.error);
  revalidatePath("/app/loyalty");
  return done({ code: result.redemption.code, rewardName: result.reward.name });
}

const normalizeVoucherCode = (value: string) =>
  value.trim().toUpperCase().replace(/\s+/g, "");

/** Cari voucher sebelum kasir menyerahkan reward fisik. */
export async function lookupRedemptionAction(codeInput: string) {
  const { businessId } = await requirePermission("loyalty");
  const code = normalizeVoucherCode(codeInput);
  if (
    !/^RW-[23456789ABCDEFGHJKLMNPQRSTUVWXYZ]{3}-[23456789ABCDEFGHJKLMNPQRSTUVWXYZ]{3}$/.test(
      code,
    )
  ) {
    return fail("Format voucher belum benar. Contoh: RW-ABC-123.");
  }
  const voucher = await db.lookupRedemptionByCode(businessId, code);
  if (!voucher) return fail("Voucher tidak ditemukan di toko ini.");
  return done(voucher);
}

/** Tandai voucher dipakai. Database mengunci voucher agar tidak dapat dipakai dua kali. */
export async function consumeRedemptionAction(
  codeInput: string,
): Promise<ActionResult<{ rewardName: string; customerName: string | null }>> {
  const { businessId, userId } = await requirePermission("loyalty");
  const code = normalizeVoucherCode(codeInput);
  if (
    !/^RW-[23456789ABCDEFGHJKLMNPQRSTUVWXYZ]{3}-[23456789ABCDEFGHJKLMNPQRSTUVWXYZ]{3}$/.test(
      code,
    )
  ) {
    return fail("Format voucher belum benar.");
  }
  const result = await db.consumeRedemption(businessId, code, userId);
  if (!result.success) return fail(result.error);
  revalidatePath("/app/loyalty");
  return done({
    rewardName: result.voucher.reward_name,
    customerName: result.voucher.customer_name,
  });
}

export async function saveRewardAction(data: {
  id?: string;
  name: string;
  point_cost: number;
  market_value: number;
  stock: number | null;
  is_active: boolean;
  /**
   * Foto hadiah. Daftar hadiah yang cuma berisi nama dan angka poin tidak
   * membuat siapa pun ingin mengumpulkan poin — hadiah harus bisa dibayangkan
   * bentuknya.
   */
  image_url?: string | null;
}): Promise<ActionResult<null>> {
  const { businessId } = await requireOwner();
  const locked = await moduleLock(businessId, "loyalty", "write");
  if (locked) return fail(locked);
  if (!data.name.trim()) return fail("Nama reward belum diisi.");
  if (data.point_cost <= 0) return fail("Biaya poin harus lebih dari nol.");
  if (!Number.isInteger(data.market_value) || data.market_value < 0)
    return fail("Nilai jual reward tidak valid.");

  const foto = data.image_url?.trim() || null;
  if (foto) {
    try {
      // http diblokir peramban saat halaman dibuka lewat https, jadi fotonya
      // tidak akan pernah muncul — lebih baik ditolak sekarang daripada jadi
      // kotak kosong di layar pelanggan.
      if (new URL(foto).protocol !== "https:") return fail("Alamat foto hadiah harus memakai https.");
    } catch {
      return fail("Alamat foto hadiah tidak valid.");
    }
  }

  await db.saveReward(businessId, { ...data, image_url: foto });
  revalidatePath("/app/loyalty");
  return done(null);
}

export async function saveTierAction(data: {
  id?: string;
  name: string;
  min_lifetime_spend: number;
  earn_multiplier: number;
  benefit_note: string;
  sort_order: number;
}): Promise<ActionResult<import("./types").LoyaltyTier>> {
  const { businessId } = await requireOwner();
  const locked = await moduleLock(businessId, "loyalty", "write");
  if (locked) return fail(locked);
  if (!data.name.trim() || data.name.trim().length > 40)
    return fail("Nama level wajib diisi, maksimal 40 karakter.");
  if (!Number.isInteger(data.min_lifetime_spend) || data.min_lifetime_spend < 0)
    return fail("Syarat belanja tidak valid.");
  if (
    !Number.isFinite(data.earn_multiplier) ||
    data.earn_multiplier < 1 ||
    data.earn_multiplier > 5
  ) {
    return fail("Pengali poin harus antara 1x sampai 5x.");
  }
  const benefitNote = data.benefit_note.trim();
  if (benefitNote.length > 200)
    return fail("Catatan manfaat maksimal 200 karakter.");

  const tier = await db.saveTier(businessId, {
    ...data,
    name: data.name.trim(),
    benefit_note: benefitNote || null,
  });
  revalidatePath("/app/loyalty");
  return done(tier);
}

export async function deleteTierAction(
  id: string,
): Promise<ActionResult<null>> {
  const { businessId } = await requireOwner();
  const locked = await moduleLock(businessId, "loyalty", "write");
  if (locked) return fail(locked);
  const ok = await db.deleteTier(id, businessId);
  if (!ok) return fail("Level tidak ditemukan.");
  revalidatePath("/app/loyalty");
  return done(null);
}

/** Membuat daftar target promo. Hanya member yang memberi persetujuan promo yang ikut. */
export async function createLoyaltyCampaignAction(input: {
  name: string;
  segment: LoyaltyCampaignSegment;
  messageTemplate: string;
  customerIds: string[];
  goal?: CampaignGoalKey;
  /** Kalau diisi (termasuk 0), campaign ini mencetak kode promo. Undefined = tidak ada kode. */
  codeRewardPoints?: number;
}): Promise<
  ActionResult<
    NonNullable<Awaited<ReturnType<typeof db.createLoyaltyCampaign>>>
  >
> {
  const { businessId, userId } = await requireOwner();
  const locked = await moduleLock(businessId, "loyalty", "write");
  if (locked) return fail(locked);
  if (!input.name.trim() || input.name.trim().length > 120)
    return fail("Nama campaign wajib diisi, maksimal 120 karakter.");
  if (
    !input.messageTemplate.trim() ||
    input.messageTemplate.trim().length > 2000
  )
    return fail("Pesan campaign wajib diisi, maksimal 2.000 karakter.");
  if (!input.customerIds.length || input.customerIds.length > 5_000)
    return fail("Pilih minimal satu, maksimal 5.000 member.");
  if (input.goal && !CAMPAIGN_GOALS.some((g) => g.key === input.goal))
    return fail("Tujuan campaign tidak dikenal.");
  if (
    input.codeRewardPoints !== undefined &&
    (!Number.isInteger(input.codeRewardPoints) || input.codeRewardPoints < 0)
  ) {
    return fail("Bonus poin kode tidak valid.");
  }

  const result = await db.createLoyaltyCampaign(businessId, userId, {
    ...input,
    name: input.name.trim(),
    messageTemplate: input.messageTemplate.trim(),
    customerIds: [...new Set(input.customerIds)],
  });
  if (!result)
    return fail(
      "Tidak ada member yang menyetujui menerima promo di daftar ini.",
    );
  revalidatePath("/app/loyalty");
  return done(result);
}

/**
 * Kasir menukarkan kode promo campaign. Izin "loyalty", bukan owner-only —
 * ini bagian dari layar kasir cepat, sama seperti tambah poin dan tukar
 * reward.
 */
export async function redeemCodeAction(
  customerId: string,
  rawCode: string,
): Promise<ActionResult<{ pointsAwarded: number; campaignName: string }>> {
  const { businessId, userId } = await requirePermission("loyalty");
  const locked = await moduleLock(businessId, "loyalty", "write");
  if (locked) return fail(locked);
  const code = normalizeLoyaltyCode(rawCode);
  if (!code) return fail("Kode belum diisi.");

  const customer = await db.getCustomerById(customerId, businessId);
  if (!customer) return fail("Pelanggan tidak ditemukan pada bisnis ini.");

  const result = await db.redeemCode(businessId, code, customerId, userId);
  if (!result.success) return fail(result.error);
  revalidatePath("/app/loyalty");
  return done({
    pointsAwarded: result.pointsAwarded,
    campaignName: result.campaignName,
  });
}

/** WhatsApp click-to-chat tidak memberi bukti pengiriman, jadi owner menandainya sendiri. */
export async function updateLoyaltyCampaignRecipientStatusAction(
  recipientId: string,
  status: LoyaltyCampaignStatus,
): Promise<ActionResult<LoyaltyCampaignStatus>> {
  const { businessId, userId } = await requireOwner();
  const locked = await moduleLock(businessId, "loyalty", "write");
  if (locked) return fail(locked);
  if (
    !(["opened", "sent", "skipped"] as LoyaltyCampaignStatus[]).includes(status)
  )
    return fail("Status campaign tidak dikenal.");
  const recipient = await db.updateLoyaltyCampaignRecipientStatus(
    recipientId,
    businessId,
    status,
  );
  if (!recipient) return fail("Target campaign tidak ditemukan.");

  /**
   * Bonus ulang tahun cair persis di sini — saat owner menandai pesannya
   * sudah terkirim, bukan otomatis dan bukan saat tanggal lahirnya cuma
   * didaftarkan. awardBirthdayBonusIfDue sendiri yang menolak kalau
   * program.birthday_is_active mati atau member ini sudah dapat tahun ini.
   */
  if (status === "sent" && recipient.campaign_segment === "birthday") {
    await db.awardBirthdayBonusIfDue(businessId, recipient.customer_id, userId);
  }

  revalidatePath("/app/loyalty");
  return done(recipient.status);
}

/** Membuka kembali target dari campaign lama untuk evaluasi dan tindak lanjut manual. */
export async function getLoyaltyCampaignRecipientsAction(campaignId: string) {
  const { businessId } = await requireOwner();
  const locked = await moduleLock(businessId, "loyalty", "read");
  if (locked) return fail(locked);
  return done(await db.getLoyaltyCampaignRecipients(campaignId, businessId));
}

export async function deleteRewardAction(
  id: string,
): Promise<ActionResult<null>> {
  const { businessId } = await requireOwner();
  const locked = await moduleLock(businessId, "loyalty", "write");
  if (locked) return fail(locked);
  const ok = await db.deleteReward(id, businessId);
  if (!ok) return fail("Reward tidak ditemukan.");
  revalidatePath("/app/loyalty");
  return done(null);
}

/** Hak penghapusan data menurut UU PDP. Hanya owner. */
export async function anonymizeCustomerAction(
  customerId: string,
): Promise<ActionResult<null>> {
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

export async function openShiftAction(
  openingCash: number,
  notes?: string,
): Promise<ActionResult<null>> {
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
  delivery?: {
    name: string;
    phone: string;
    address: string;
    fee: number;
    note?: string;
  } | null;
  discount?: number;
  /** Kenapa diskonnya diberikan. Wajib begitu nominalnya di atas nol. */
  discount_reason?: string | null;
  cash_given?: number | null;
  customer_id?: string | null;
  items: { menu_item_id: string; qty: number; note?: string }[];
}): Promise<
  ActionResult<{
    orderId: string;
    orderNo: string;
    total: number;
    change: number;
    subtotal: number;
    discount: number;
    tax: number;
    serviceCharge: number;
    deliveryFee: number;
  }>
> {
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

  const business = await db.getBusiness(businessId);
  const taxRate = Number(business?.pos_tax_rate ?? 0);
  const serviceRate = Number(business?.pos_service_charge_rate ?? 0);
  const rawDiscount = Number(input.discount ?? 0);
  if (!Number.isFinite(rawDiscount)) return fail("Diskon tidak valid.");

  /**
   * Diskon tanpa alasan ditolak di sini, bukan cuma diingatkan di layar.
   *
   * Layar kasir sudah menanyakan alasannya sejak dulu, tapi jawabannya tidak
   * pernah dikirim ke server, jadi yang tersimpan cuma nominalnya. Owner bisa
   * melihat diskon Rp 500.000 sebulan tanpa satu pun cara tahu itu keringanan
   * buat siapa — dan itu bukan diskon, itu selisih kas.
   */
  const alasanDiskon = input.discount_reason?.trim() || "";
  if (rawDiscount > 0 && alasanDiskon.length < 3) {
    return fail("Isi dulu alasan diskonnya. Diskon tanpa keterangan tidak bisa dipertanggungjawabkan saat tutup shift.");
  }
  const deliveryFee = Math.round(Number(input.delivery?.fee ?? 0));
  if (
    !Number.isFinite(deliveryFee) ||
    deliveryFee < 0 ||
    deliveryFee > 100_000_000
  ) {
    return fail("Ongkir tidak valid.");
  }
  const totals = calculateCartTotals(
    items.map((item) => ({ price: item.price, qty: item.qty })),
    Math.max(0, rawDiscount),
    taxRate,
    serviceRate,
  );
  const totalDue = totals.total + deliveryFee;
  const shift = await db.getActiveShift(businessId);
  if (input.payment_method === "cash") {
    if (!shift)
      return fail("Buka shift kasir sebelum menerima pembayaran tunai.");
    const cashGiven = Number(input.cash_given ?? 0);
    if (!Number.isFinite(cashGiven) || cashGiven < totalDue) {
      return fail("Uang tunai yang diterima kurang dari total tagihan.");
    }
  }
  /**
   * Pesanan meja menempel ke kunjungan yang sedang berjalan di meja itu, dan
   * membuka kunjungan baru kalau belum ada. Inilah yang bikin tambahan pesanan
   * punya induk: tagihan awal dan tambahannya jadi satu, bukan dua baris yang
   * kebetulan bernomor meja sama.
   */
  const tableSession =
    input.service_type === "dine_in" && input.table_no?.trim()
      ? await db.openTableSession(businessId, input.table_no, userId)
      : null;

  const { order } = await db.createOrder(
    businessId,
    {
      channel: "cashier",
      service_type: input.service_type,
      table_no: input.table_no ?? null,
      table_session_id: tableSession?.id ?? null,
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
      /**
       * SELALU masuk antrean dapur, bahkan yang tunai dan lunas seketika.
       *
       * Sebelum ini pesanan tunai langsung ditandai `completed` — artinya
       * pesanan yang diketik kasir tidak pernah sampai ke layar dapur, dan
       * dapur cuma melihat pesanan dari QR meja. Sisanya diteriakkan lewat
       * mulut, dan saat ramai itu berarti ada yang tidak dimasak.
       *
       * Uang dan makanan adalah dua sumbu berbeda: yang satu sudah lunas
       * tidak berarti yang satunya sudah keluar dari dapur.
       */
      fulfillment_status: "pending",
      delivery: input.delivery ? { ...input.delivery, fee: deliveryFee } : null,
      discount: totals.discount,
      discount_reason: alasanDiskon || null,
      tax: totals.tax,
      service_charge: totals.serviceCharge,
      payment_method: input.payment_method,
      cash_given: input.cash_given ?? null,
      customer_id: input.customer_id ?? null,
      shift_id: shift?.id ?? null,
      created_by: userId,
    },
    items,
  );

  if (order.status === "paid") {
    await db.syncPaidOrder(order.id, businessId, userId);
  }

  revalidatePath("/app/pos");
  return done({
    orderId: order.id,
    orderNo: order.order_no,
    total: Number(order.total),
    change: Number(order.cash_change ?? 0),
    subtotal: Number(order.subtotal),
    discount: Number(order.discount),
    tax: Number(order.tax),
    serviceCharge: Number(order.service_charge),
    deliveryFee: Number(order.delivery_fee ?? 0),
  });
}

/** Pesanan dari QR meja. Terbuka, karena pelanggan tidak punya akun. */
export async function createQrOrderAction(
  businessId: string,
  tableNo: string,
  serviceType: "dine_in" | "takeaway",
  paymentMethod: "qris" | "cash",
  items: { menu_item_id: string; qty: number; note?: string }[],
  /**
   * Nama pemesan. Layar menu digital sudah MEWAJIBKAN pelanggan mengisinya,
   * tapi sebelum ini namanya tidak pernah ikut terkirim — jadi berhenti di
   * browser tamu, dan yang sampai ke kasir maupun dapur cuma nomor meja.
   */
  customerName?: string,
): Promise<ActionResult<{ orderId: string; orderNo: string; total: number }>> {
  if (!items.length) return fail("Keranjang masih kosong.");

  /**
   * Sama seperti pendaftaran member: ini dipanggil pelanggan yang memindai QR
   * di meja, tanpa sesi. Tanpa pemeriksaan ini, usaha yang modul POS-nya sudah
   * lewat masa aktif akan tetap menerima pesanan QR selamanya dan tidak ada
   * satu pun layar yang menghentikannya.
   */
  if (await moduleLock(businessId, "pos", "write")) {
    return fail(
      "Pemesanan lewat QR sedang tidak tersedia. Silakan pesan langsung ke kasir.",
    );
  }

  const menu = await db.getMenuItems(businessId);
  const byId = new Map(menu.map((m) => [m.id, m]));

  const lines = [];
  for (const line of items) {
    const item = byId.get(line.menu_item_id);
    if (!item || !item.is_available)
      return fail("Ada menu yang sudah tidak tersedia.");
    if (line.qty < 1 || line.qty > 99) return fail("Jumlah item tidak wajar.");
    lines.push({
      menu_item_id: item.id,
      name: item.name,
      price: Number(item.price),
      qty: Math.floor(line.qty),
      note: line.note,
    });
  }

  /**
   * Pajak dan service charge dihitung dengan tarif toko yang SAMA dengan kasir.
   *
   * Sebelum ini jalur QR cuma menjumlahkan harga menu dan tidak pernah
   * mengirim kedua biaya itu. Jadi begitu Mochi mengaktifkan tarifnya, pesanan
   * yang persis sama menghasilkan dua angka berbeda: yang lewat kasir kena
   * pajak, yang lewat QR meja tidak. Pelanggan di meja sebelah membayar lebih
   * murah untuk menu yang sama, dan yang menjelaskan ke mereka kasirnya.
   */
  const business = await db.getBusiness(businessId);
  const totals = calculateCartTotals(
    lines.map((line) => ({ price: line.price, qty: line.qty })),
    0,
    Number(business?.pos_tax_rate ?? 0),
    Number(business?.pos_service_charge_rate ?? 0),
  );
  const total = totals.total;

  const ordering = await db.checkOrderingAvailability(businessId, total);
  if (!ordering.available) return fail(ordering.error);

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
  /**
   * Pesanan dari QR meja masuk ke kunjungan yang SEDANG berjalan di meja itu,
   * dan membuka kunjungan baru kalau tamunya memesan duluan sebelum kasir
   * sempat membuka mejanya. Inilah yang menyatukan tagihan: tambahan dari HP
   * tamu dan tambahan dari kasir berakhir di satu sesi yang sama.
   */
  const tableSession =
    serviceType === "dine_in" && tableNo?.trim()
      ? await db.openTableSession(businessId, tableNo, null)
      : null;

  const { order } = await db.createOrder(
    businessId,
    {
      channel: "qr",
      service_type: serviceType,
      table_no: tableNo,
      table_session_id: tableSession?.id ?? null,
      customer_name: customerName?.trim() || null,
      status: "open",
      payment_status: "pending",
      fulfillment_status: "pending",
      tax: totals.tax,
      service_charge: totals.serviceCharge,
      payment_method: paymentMethod,
      created_by: owner.id,
    },
    lines,
  );
  revalidatePath("/app/pos");
  return done({
    orderId: order.id,
    orderNo: order.order_no,
    total: Number(order.total),
  });
}

/**
 * Polling status pesanan QR dari meja tamu.
 * Terbuka tanpa sesi staf, membaca status pembayaran dan dapur agar layar HP
 * tamu otomatis berganti menjadi "Lunas & Sedang Dimasak" begitu kasir memverifikasi.
 */
export async function getQrOrderStatusAction(
  orderId: string,
): Promise<
  ActionResult<{
    paymentStatus: string;
    fulfillmentStatus: string;
    orderNo: string;
    total: number;
  }>
> {
  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(orderId);
  if (!isUuid) return fail("ID pesanan tidak valid.");

  const orderData = await db.getOrderById(orderId);
  if (!orderData) return fail("Pesanan tidak ditemukan.");

  return done({
    paymentStatus: orderData.order.payment_status,
    fulfillmentStatus: orderData.order.fulfillment_status,
    orderNo: orderData.order.order_no,
    total: Number(orderData.order.total),
  });
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

  const result = await db.confirmOrderPayment(orderId, businessId, userId);
  if (!result.order) {
    return fail(
      result.error ??
        "Pesanan tidak ditemukan, atau pembayarannya sudah dikonfirmasi sebelumnya.",
    );
  }
  const order = result.order;

  await db.syncPaidOrder(order.id, businessId, userId);

  revalidatePath("/app/pos");
  return done({ orderNo: order.order_no });
}

/** Uangnya tidak pernah masuk. Pesanan ditutup, bukan dibiarkan menggantung. */
export async function retryOrderSyncAction(): Promise<ActionResult<null>> {
  const { businessId, userId } = await requireOwner();
  const locked = await moduleLock(businessId, "pos", "write");
  if (locked) return fail(locked);
  const pending = await db.getPendingOrderSync(businessId);
  for (const order of pending)
    await db.syncPaidOrder(order.id, businessId, userId);
  revalidatePath("/app/pos/owner");
  revalidatePath("/app/loyalty");
  return done(null);
}

export async function markPaymentFailedAction(
  orderId: string,
): Promise<ActionResult<null>> {
  const { businessId } = await requirePermission("pos");
  const locked = await moduleLock(businessId, "pos", "write");
  if (locked) return fail(locked);

  const order = await db.markOrderPaymentFailed(orderId, businessId);
  if (!order)
    return fail(
      "Pesanan tidak ditemukan atau sudah tidak menunggu pembayaran.",
    );
  revalidatePath("/app/pos");
  return done(null);
}

export async function cancelOrderAction(
  orderId: string,
  reason?: string,
): Promise<ActionResult<null>> {
  const { businessId, userId } = await requirePermission("pos");
  const locked = await moduleLock(businessId, "pos", "write");
  if (locked) return fail(locked);

  const res = await db.cancelOrder(orderId, businessId, reason, userId);
  if (!res.ok) return fail(res.error!);

  revalidatePath("/app/pos");
  revalidatePath("/app/pos/station");
  revalidatePath("/app/pos/kitchen");
  return done(null);
}

/**
 * Refund atau Void pesanan yang sudah lunas dengan alasan terstruktur.
 */
export async function refundOrderAction(
  orderId: string,
  amount: number,
  reason: string,
  category: RefundReasonCode = "lainnya",
  refundMethod: "cash" | "qris" | "transfer" = "cash",
  /** Diisi kalau yang dikembalikan cuma satu menu, bukan seluruh nota. */
  orderItemId?: string | null,
): Promise<ActionResult<{ refundId: string; refundAmount: number; orderNo: string }>> {
  /**
   * Refund adalah uang KELUAR, dan itu keputusan pemilik.
   *
   * Aksi ini dulu menerima siapa pun yang berizin POS, padahal kolom
   * `refunds.approved_by` sejak awal berkomentar "Wajib role owner" dan
   * fungsi database-nya menamai parameternya `ownerUserId`. Jadi aturannya
   * sudah tertulis di dua tempat, cuma tidak pernah ditegakkan di pintunya —
   * dan kasir bisa mengeluarkan uang dari laci atas namanya sendiri.
   */
  const { businessId, userId } = await requireOwner();
  const locked = await moduleLock(businessId, "pos", "write");
  if (locked) return fail(locked);

  if (!amount || amount <= 0) return fail("Nominal pengembalian dana (refund) tidak valid.");
  if (!reason.trim()) return fail("Keterangan alasan refund wajib diisi.");

  /**
   * Kategori dan metode dikirim sebagai kolom, bukan lagi ditempel ke dalam
   * kalimat alasan. Yang tersimpan di `reason` sekarang cuma keterangan yang
   * benar-benar diketik kasir, supaya laporan bisa mengelompokkan sendiri
   * alasannya tanpa harus membongkar teks.
   */
  const res = await db.refundOrder(orderId, businessId, amount, reason.trim(), userId, {
    method: refundMethod,
    reasonCode: category,
    orderItemId: orderItemId ?? null,
  });
  if (!res.success) {
    return fail(res.error || "Gagal memproses pengembalian dana.");
  }

  const orderData = await db.getOrderById(orderId);

  revalidatePath("/app/pos");
  revalidatePath("/app/pos/reports");
  revalidatePath("/app/finance/reports");
  revalidatePath("/app/pos/station");
  revalidatePath("/app/pos/kitchen");

  return done({
    refundId: res.refund.id,
    refundAmount: Number(res.refund.amount),
    orderNo: orderData?.order?.order_no || "-",
  });
}

/**
 * Mengganti item yang habis di tengah hari saat pesanan sedang diproses dapur.
 */
export async function replaceOrderItemAction(
  orderId: string,
  orderItemId: string,
  newMenuItemId: string,
  /**
   * Bagaimana selisih harganya diselesaikan. Untuk nota yang sudah lunas dan
   * harganya berbeda, ini WAJIB — selisih yang tidak pernah ditagih maupun
   * dikembalikan akan muncul lagi saat tutup shift tanpa ada yang ingat
   * penyebabnya.
   */
  settlement: ItemChangeSettlement = "none",
  reason?: string,
): Promise<
  ActionResult<{
    ok: boolean;
    newName: string;
    priceDiff: number;
    settlement: ItemChangeSettlement;
  }>
> {
  const { businessId, userId } = await requirePermission("pos");
  const locked = await moduleLock(businessId, "pos", "write");
  if (locked) return fail(locked);

  const res = await db.replaceOrderItem(
    orderId,
    orderItemId,
    newMenuItemId,
    businessId,
    userId,
    settlement,
    reason,
  );
  if (!res.ok) return fail(res.error || "Gagal mengganti item menu.");

  revalidatePath("/app/pos");
  revalidatePath("/app/pos/station");
  revalidatePath("/app/pos/kitchen");
  revalidatePath("/app/pos/reports");
  return done({
    ok: true,
    newName: res.newName,
    priceDiff: res.priceDiff,
    settlement: res.settlement,
  });
}

// -----------------------------------------------------------------------------
// SESI MEJA
// -----------------------------------------------------------------------------

/** Membuka meja saat tamu duduk, sebelum pesanan pertama masuk sekalipun. */
export async function openTableSessionAction(
  tableNo: string,
  guestCount?: number | null,
): Promise<ActionResult<{ sessionId: string }>> {
  const { businessId, userId } = await requirePermission("pos");
  const locked = await moduleLock(businessId, "pos", "write");
  if (locked) return fail(locked);
  if (!tableNo.trim()) return fail("Nomor meja belum diisi.");

  const session = await db.openTableSession(businessId, tableNo, userId, guestCount);
  if (!session) return fail("Nomor meja tidak dikenali.");

  revalidatePath("/app/pos");
  return done({ sessionId: session.id });
}

/**
 * Menutup meja setelah tamunya pergi. Menolak selama masih ada tagihan yang
 * belum lunas — versi lama menyelesaikannya dengan diam-diam menandai pesanan
 * itu sudah dibayar.
 */
export async function closeTableSessionAction(
  sessionId: string,
): Promise<ActionResult<null>> {
  const { businessId, userId } = await requirePermission("pos");
  const locked = await moduleLock(businessId, "pos", "write");
  if (locked) return fail(locked);

  const res = await db.closeTableSession(sessionId, businessId, userId);
  if (!res.ok) return fail(res.error!);

  revalidatePath("/app/pos");
  return done(null);
}

/**
 * Simpan ulasan / masukan pelanggan langsung ke tabel member_feedback (Rating 1-5).
 */
export async function saveDirectReviewAction(data: {
  rating: number;
  reason_code?: import("./types").FeedbackReasonCode;
  comment?: string;
  customer_id?: string;
  order_id?: string;
  card_id?: string;
  business_id?: string;
}): Promise<ActionResult<{ id: string }>> {
  if (!data.rating || data.rating < 1 || data.rating > 5) {
    return fail("Rating bintang 1 s/d 5 wajib dipilih.");
  }

  /**
   * Ulasan harus menyebutkan DARI MANA asalnya: pesanan yang benar-benar ada,
   * atau kartu yang benar-benar ada. Keduanya baris di basis data yang tahu
   * tenantnya sendiri, jadi tidak ada yang perlu dipercaya dari pemanggil.
   *
   * Aksi ini memang terbuka tanpa sesi — yang mengisinya pelanggan yang baru
   * menempelkan ponselnya ke kartu di meja, dan dia tidak punya akun. Justru
   * karena itu batas tenantnya harus ditegakkan dari bukti, bukan dari
   * business_id yang ikut dikirim bersama permintaannya.
   */
  if (!data.order_id && !data.card_id) {
    return fail("Ulasan ini tidak bisa disimpan karena tidak menyebutkan pesanan atau kartunya.");
  }

  try {
    const res = await db.saveFeedbackRow(data);
    revalidatePath("/app/review/reports");
    revalidatePath("/app/pos/reports/reviews");
    return done({ id: res.id });
  } catch (err) {
    console.error("[KAEL] ulasan langsung ditolak", err);
    return fail("Ulasan tidak bisa disimpan karena tokonya tidak bisa dipastikan.");
  }
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
  if (!order)
    return fail(
      "Pesanan tidak ditemukan atau statusnya sudah ditutup.",
    );
  revalidatePath("/app/pos");
  revalidatePath("/app/pos/station");
  revalidatePath("/app/pos/kitchen");
  return done(null);
}

/**
 * Catatan cetak dilakukan setelah printer benar-benar menerima data dari
 * perangkat kasir. Ini membuat cetak ulang dan pembukaan laci tetap bisa
 * ditelusuri tanpa memberi browser hak membuka laci secara sembarangan.
 */
export async function recordReceiptPrintAction(
  orderId: string,
  openedCashDrawer: boolean,
  printerName?: string,
): Promise<ActionResult<null>> {
  const { businessId, userId } = await requirePermission("pos");
  const receipt = await db.getOrderById(orderId);
  const order = receipt?.order;
  if (!order || order.business_id !== businessId || order.payment_status !== "paid") {
    return fail("Struk hanya dapat dicetak untuk transaksi lunas di toko ini.");
  }
  await db.recordAuditEvent({
    businessId,
    actorUserId: userId,
    action: openedCashDrawer ? "pos.receipt_printed_cash_drawer_opened" : "pos.receipt_printed",
    entityType: "order",
    entityId: orderId,
    metadata: { orderNo: order.order_no, printerName: printerName?.slice(0, 120) ?? null },
  });
  return done(null);
}

/** Snapshot ringan untuk tablet kasir dan layar dapur. */
export async function getOrderStationSnapshotAction(): Promise<
  ActionResult<{ orders: Awaited<ReturnType<typeof db.getOrderStationOrders>> }>
> {
  const { businessId } = await requirePermission("pos");
  return done({ orders: await db.getOrderStationOrders(businessId) });
}

/** Daftar pesanan QR meja untuk polling bel notifikasi di layar kasir POS. */
export async function getPendingQrOrdersAction(): Promise<
  ActionResult<{ orders: Awaited<ReturnType<typeof db.getPendingQrOrders>> }>
> {
  const { businessId } = await requirePermission("pos");
  return done({ orders: await db.getPendingQrOrders(businessId) });
}

/** Staf yang menekan tombol ini tercatat sebagai penanggung jawab order. */
export async function claimOrderAction(orderId: string): Promise<ActionResult<null>> {
  const { businessId, userId } = await requirePermission("pos");
  const locked = await moduleLock(businessId, "pos", "write");
  if (locked) return fail(locked);
  const result = await db.claimOrder(orderId, businessId, userId);
  if (!result.order) return fail(result.error ?? "Pesanan belum lunas atau sudah tidak tersedia.");
  revalidatePath("/app/pos");
  revalidatePath("/app/pos/station");
  revalidatePath("/app/pos/kitchen");
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


/** Mengambil daftar data testing (transaksi, feedback, shift) yang dapat dipilih dan dihapus oleh owner. */
export async function getDeletableTestDataAction(): Promise<ActionResult<DeletableTestData>> {
  const { businessId } = await requireOwner();
  const data = await db.getDeletableTestData(businessId);
  return done(data);
}

/** Hapus batch transaksi/order testing yang dipilih oleh owner. */
export async function deleteOrdersBatchAction(
  orderIds: string[],
): Promise<ActionResult<{ deletedCount: number }>> {
  const { businessId } = await requireOwner();
  const res = await db.deleteOrdersBatch(orderIds, businessId);
  revalidatePath("/app/pos");
  revalidatePath("/app/pos/reports");
  revalidatePath("/app/pos/owner");
  revalidatePath("/app/loyalty/analytics");
  return done(res);
}

/** Hapus batch feedback/review testing yang dipilih oleh owner. */
export async function deleteFeedbackBatchAction(
  feedbackIds: string[],
): Promise<ActionResult<{ deletedCount: number }>> {
  const { businessId } = await requireOwner();
  const res = await db.deleteFeedbackBatch(feedbackIds, businessId);
  revalidatePath("/app/pos/reports");
  revalidatePath("/app/pos/owner");
  revalidatePath("/app/review/reports");
  return done(res);
}

/** Hapus batch shift kasir testing yang dipilih oleh owner. */
export async function deleteShiftsBatchAction(
  shiftIds: string[],
): Promise<ActionResult<{ deletedCount: number }>> {
  const { businessId } = await requireOwner();
  const res = await db.deleteShiftsBatch(shiftIds, businessId);
  revalidatePath("/app/pos/reports");
  revalidatePath("/app/pos/owner");
  return done(res);
}

/** Hapus transaksi/order testing untuk owner. */
export async function deleteOrderAction(
  orderId: string,
): Promise<ActionResult<null>> {
  const { businessId } = await requireOwner();
  const ok = await db.deleteOrder(orderId, businessId);
  if (!ok) return fail("Transaksi tidak ditemukan.");
  revalidatePath("/app/pos");
  revalidatePath("/app/pos/reports");
  revalidatePath("/app/pos/owner");
  revalidatePath("/app/loyalty/analytics");
  return done(null);
}

/** Hapus feedback/review testing untuk owner. */
export async function deleteFeedbackAction(
  feedbackId: string,
): Promise<ActionResult<null>> {
  const { businessId } = await requireOwner();
  const ok = await db.deleteFeedback(feedbackId, businessId);
  if (!ok) return fail("Feedback tidak ditemukan.");
  revalidatePath("/app/pos/reports");
  revalidatePath("/app/pos/owner");
  revalidatePath("/app/review/reports");
  return done(null);
}

/** Hapus shift testing untuk owner. */
export async function deleteShiftAction(
  shiftId: string,
): Promise<ActionResult<null>> {
  const { businessId } = await requireOwner();
  const ok = await db.deleteShift(shiftId, businessId);
  if (!ok) return fail("Shift tidak ditemukan.");
  revalidatePath("/app/pos/reports");
  revalidatePath("/app/pos/owner");
  return done(null);
}

/**
 * Menandai transaksi sebagai latihan, atau mencabut tandanya.
 *
 * Menandai bisa dibatalkan, menghapus tidak. Jadi inilah langkah yang harus
 * dilewati owner sebelum pembersihan massal boleh menyentuh apa pun.
 */
export async function markOrdersAsTestAction(
  orderIds: string[],
  isTest: boolean,
): Promise<ActionResult<{ updatedCount: number }>> {
  const { businessId } = await requireOwner();
  const res = await db.markOrdersAsTest(orderIds, businessId, isTest);
  revalidatePath("/app/pos");
  revalidatePath("/app/pos/reports");
  revalidatePath("/app/pos/owner");
  return done(res);
}

/** Pembersihan massal data testing (reset pesanan / feedback / shift) khusus owner. */
export async function clearTestDataAction(
  scope: "all_orders" | "all_feedback" | "all_shifts" | "everything",
): Promise<ActionResult<{ deletedCount: number }>> {
  const { businessId } = await requireOwner();
  const res = await db.clearTestData(businessId, scope);
  revalidatePath("/app/pos");
  revalidatePath("/app/pos/reports");
  revalidatePath("/app/pos/owner");
  revalidatePath("/app/loyalty/analytics");
  revalidatePath("/app/review/reports");
  return done({ deletedCount: res.deletedCount });
}


/**
 * Batas alamat gambar menu.
 *
 * Wajib https, dan hanya https. Halaman pesan sendiri dibuka lewat https, dan
 * peramban memblokir gambar http di dalamnya tanpa pesan apa pun — menu yang
 * gambarnya tidak pernah muncul akan terlihat seperti aplikasi yang rusak,
 * bukan seperti alamat yang salah. `data:` dan `javascript:` ditolak di jalur
 * yang sama: keduanya bisa dipakai menitipkan isi sembarangan ke halaman yang
 * terbuka untuk umum.
 */
function bersihkanUrlGambar(
  input: string | undefined | null,
): string | null | "invalid" {
  const nilai = input?.trim();
  if (!nilai) return null;

  /**
   * Gambar yang diunggah lewat KAEL sendiri disimpan sebagai alamat internal
   * `/api/gambar/<uuid>`, bukan alamat lengkap. Bentuk ini diterima lebih dulu
   * dan dicocokkan ketat ke pola id-nya, bukan sekadar "diawali garis miring" —
   * kalau tidak, kolom ini bisa dipakai menitipkan jalur apa pun di domain
   * yang sama ke dalam atribut src halaman publik.
   */
  if (
    /^\/api\/gambar\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
      nilai,
    )
  ) {
    return nilai;
  }

  // Juga menerima berkas statis lokal publik (seperti /logo-mochi.png)
  if (/^\/[a-zA-Z0-9_\-\.\/]+$/.test(nilai) && !nilai.includes("..")) {
    return nilai;
  }

  try {
    const url = new URL(nilai);
    if (url.protocol !== "https:") return "invalid";
    return url.toString();
  } catch {
    return "invalid";
  }
}

/** Jenis berkas yang boleh disimpan. SVG tidak ada di sini, dan itu disengaja. */
const MIME_GAMBAR = new Set(["image/webp", "image/jpeg", "image/png"]);
const BATAS_GAMBAR = 400 * 1024;

/**
 * Menerima satu gambar dari layar kelola menu.
 *
 * Yang dikirim peramban sudah diperkecil dan dikompres di sisi klien. Batas di
 * sini bukan pengulangan yang sopan melainkan penjaga sebenarnya: yang memanggil
 * Server Action tidak harus layar KAEL, dan siapa pun yang sudah masuk sebagai
 * pemilik bisa mengirim apa saja ke sini langsung.
 */
export async function uploadImageAction(
  dataUrl: string,
  dimensi?: { width: number; height: number },
): Promise<ActionResult<{ url: string }>> {
  const { businessId } = await requireOwner();

  const cocok = /^data:([a-z/+.-]+);base64,([A-Za-z0-9+/=]+)$/i.exec(
    dataUrl?.trim() ?? "",
  );
  if (!cocok) return fail("Berkas gambar tidak terbaca.");

  const [, mime, base64] = cocok;
  if (!MIME_GAMBAR.has(mime.toLowerCase())) {
    return fail("Format gambar harus WebP, JPG, atau PNG.");
  }

  let bytes: Buffer;
  try {
    bytes = Buffer.from(base64, "base64");
  } catch {
    return fail("Berkas gambar tidak terbaca.");
  }
  if (!bytes.byteLength) return fail("Berkas gambar kosong.");
  if (bytes.byteLength > BATAS_GAMBAR) {
    return fail("Gambar terlalu besar. Coba foto lain atau potong dulu.");
  }

  const id = await db.saveUploadedImage(businessId, {
    mime: mime.toLowerCase(),
    bytes,
    width: dimensi?.width ?? null,
    height: dimensi?.height ?? null,
  });
  return done({ url: `/api/gambar/${id}` });
}

export async function saveMenuItemAction(input: {
  id?: string;
  name: string;
  price: number;
  costPrice?: number;
  categoryId?: string | null;
  description?: string;
  photoUrl?: string;
  recipeId?: string | null;
  isAvailable?: boolean;
  sortOrder?: number;
}): Promise<ActionResult<MenuItem>> {
  // Menyusun daftar menu dan harganya adalah keputusan pemilik usaha, bukan
  // kasir. Kasir cuma boleh menandai menu habis lewat setMenuAvailabilityAction.
  const { businessId } = await requireOwner();
  const locked = await moduleLock(businessId, "pos", "write");
  if (locked) return fail(locked);

  const name = input.name?.trim();
  if (!name) return fail("Nama menu belum diisi.");
  if (name.length > 80) return fail("Nama menu maksimal 80 karakter.");
  if (!Number.isFinite(input.price) || input.price < 0)
    return fail("Harga tidak valid.");
  if (input.price > 100_000_000) return fail("Harga terlalu besar.");

  const costPrice =
    input.costPrice !== undefined && input.costPrice !== null
      ? Math.max(0, Math.round(Number(input.costPrice) || 0))
      : 0;
  if (costPrice > 100_000_000) return fail("Modal / HPP terlalu besar.");

  const description = input.description?.trim() || null;
  if (description && description.length > 300)
    return fail("Deskripsi maksimal 300 karakter.");

  const photoUrl = bersihkanUrlGambar(input.photoUrl);
  if (photoUrl === "invalid") {
    return fail("Alamat gambar harus diawali dengan https:// atau tautan lokal /api/gambar/...");
  }

  const saved = await db.saveMenuItem(businessId, {
    id: input.id,
    name,
    price: Math.round(input.price),
    cost_price: costPrice,
    category_id: input.categoryId ?? null,
    description,
    photo_url: photoUrl,
    recipe_id: input.recipeId ?? null,
    is_available: input.isAvailable ?? true,
    sort_order: input.sortOrder ?? 0,
  });
  if (!saved) return fail("Menu tidak ditemukan.");

  revalidatePath("/app/pos");
  revalidatePath("/app/pos/menu");
  return done(saved);
}

export async function deleteMenuItemAction(
  menuItemId: string,
): Promise<ActionResult<{ hidden: boolean }>> {
  const { businessId } = await requireOwner();
  const locked = await moduleLock(businessId, "pos", "write");
  if (locked) return fail(locked);

  const hasil = await db.deleteMenuItem(menuItemId, businessId);
  if (hasil === "not_found") return fail("Menu tidak ditemukan.");

  revalidatePath("/app/pos");
  revalidatePath("/app/pos/menu");
  return done({ hidden: hasil === "hidden" });
}

export async function saveCategoryAction(input: {
  id?: string;
  name: string;
  sortOrder?: number;
}): Promise<ActionResult<Category>> {
  const { businessId } = await requireOwner();
  const locked = await moduleLock(businessId, "pos", "write");
  if (locked) return fail(locked);

  const name = input.name?.trim();
  if (!name) return fail("Nama kategori belum diisi.");
  if (name.length > 60) return fail("Nama kategori maksimal 60 karakter.");

  const saved = await db.saveCategory(businessId, {
    id: input.id,
    name,
    sort_order: input.sortOrder ?? 0,
  });
  if (!saved) return fail("Kategori tidak ditemukan.");

  revalidatePath("/app/pos");
  revalidatePath("/app/pos/menu");
  return done(saved);
}

export async function deleteCategoryAction(
  categoryId: string,
): Promise<ActionResult<null>> {
  const { businessId } = await requireOwner();
  const locked = await moduleLock(businessId, "pos", "write");
  if (locked) return fail(locked);

  const ok = await db.deleteCategory(categoryId, businessId);
  if (!ok) {
    return fail(
      "Kategori tidak bisa dihapus karena masih ada menu di dalamnya. Pindahkan atau hapus menunya lebih dulu.",
    );
  }

  revalidatePath("/app/pos");
  revalidatePath("/app/pos/menu");
  return done(null);
}

export async function setMenuAvailabilityAction(
  menuItemId: string,
  isAvailable: boolean,
): Promise<ActionResult<null>> {
  const { businessId } = await requirePermission("pos");
  const locked = await moduleLock(businessId, "pos", "write");
  if (locked) return fail(locked);
  const ok = await db.updateMenuItemAvailability(
    menuItemId,
    businessId,
    isAvailable,
  );
  if (!ok) return fail("Menu tidak ditemukan.");
  revalidatePath("/app/pos");
  revalidatePath("/app/pos/menu");
  return done(null);
}

// ===========================================================================
// Finance
// ===========================================================================

export async function createIngredientAction(
  name: string,
  packPrice: number,
  packSize: number,
  baseUnit: "gr" | "ml" | "pcs",
  metadata: {
    category?: "bahan_baku" | "kemasan" | "barang_kulakan" | "lainnya";
    brand?: string;
    supplier_name?: string;
    notes?: string;
  } = {},
): Promise<ActionResult<{ id: string }>> {
  const { businessId } = await requireOwner();
  const locked = await moduleLock(businessId, "finance", "write");
  if (locked) return fail(locked);
  if (!name.trim()) return fail("Nama bahan belum diisi.");
  if (packPrice <= 0) return fail("Harga kemasan harus lebih dari nol.");
  if (packSize <= 0) return fail("Isi kemasan harus lebih dari nol.");

  const ing = await db.createIngredient(
    businessId,
    name.trim(),
    packPrice,
    packSize,
    baseUnit,
    {
      category: metadata.category ?? "bahan_baku",
      brand: metadata.brand?.trim() || null,
      supplier_name: metadata.supplier_name?.trim() || null,
      notes: metadata.notes?.trim() || null,
    },
  );
  revalidatePath("/app/finance");
  return done({ id: ing.id });
}

/**
 * Mengubah harga bahan ikut menulis riwayat, sehingga pertanyaan "kenapa HPP
 * saya naik" punya jawaban. Semua resep yang memakai bahan ini otomatis ikut
 * berubah karena HPP dihitung, bukan disimpan.
 */
export async function updateIngredientPriceAction(
  ingredientId: string,
  newPackPrice: number,
): Promise<ActionResult<null>> {
  const { businessId } = await requireOwner();
  const locked = await moduleLock(businessId, "finance", "write");
  if (locked) return fail(locked);
  if (newPackPrice <= 0) return fail("Harga harus lebih dari nol.");
  const updated = await db.updateIngredientPrice(
    ingredientId,
    businessId,
    newPackPrice,
  );
  if (!updated) return fail("Bahan tidak ditemukan pada bisnis ini.");
  revalidatePath("/app/finance");
  return done(null);
}

export async function getIngredientPriceHistoryAction(ingredientId: string) {
  const { businessId } = await requireModuleRead("finance", {
    ownerOnly: true,
  });
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
  /**
   * Menu POS yang resep ini hitungkan modalnya.
   *
   * Tanpa penyambungan ini, resep yang sudah susah payah diisi tetap tidak
   * terbaca laporan laba: laporan mencari modal lewat menu_items.recipe_id,
   * bukan lewat kemiripan nama. Owner melihat resepnya ada, tapi labanya tetap
   * kosong, dan tidak ada satu pun layar yang menjelaskan kenapa.
   */
  link_menu_item_id?: string | null;
}): Promise<ActionResult<{ id: string }>> {
  const { businessId } = await requireOwner();
  const locked = await moduleLock(businessId, "finance", "write");
  if (locked) return fail(locked);
  if (!data.name.trim()) return fail("Nama produk belum diisi.");
  if (data.output_qty < 1) return fail("Jumlah hasil produksi minimal 1.");

  /**
   * Tiga kolom ini dulu hanya dijaga CHECK di basis data. Penolakan dari sana
   * datang sebagai galat mentah, bukan kalimat yang ditulis untuk dibaca
   * orang — dan layar tidak menyiapkan tempat menampungnya, jadi tombol simpan
   * tampak diam saja: tidak ada pesan, tidak tersimpan juga.
   *
   * Aturan basis data tetap dipertahankan sebagai lapis terakhir. Yang di sini
   * melindungi orang yang mengisinya; yang di sana melindungi datanya.
   */
  if (!Number.isFinite(data.operational_cost) || data.operational_cost < 0) {
    return fail("Biaya operasional tidak boleh minus.");
  }
  if (!Number.isFinite(data.selling_price) || data.selling_price < 0) {
    return fail("Harga jual tidak boleh minus.");
  }
  if (
    !Number.isFinite(data.target_margin_pct) ||
    data.target_margin_pct < 1 ||
    data.target_margin_pct > 95
  ) {
    return fail(
      "Target margin harus antara 1% sampai 95%. Margin 100% berarti menjual dengan modal nol rupiah.",
    );
  }

  // Bahan harus milik bisnis yang sama, kalau tidak resep bisa menunjuk ke
  // harga bahan milik toko lain.
  const owned = new Set((await db.getIngredients(businessId)).map((i) => i.id));
  for (const i of data.ingredients) {
    if (!owned.has(i.ingredient_id))
      return fail("Ada bahan yang tidak dikenali.");
    if (i.qty <= 0) return fail("Jumlah pemakaian bahan harus lebih dari nol.");
  }

  const recipe = await db.saveRecipe(businessId, data);

  // Menu langsung disambungkan ke resepnya, supaya modalnya ikut terkunci pada
  // penjualan berikutnya tanpa owner perlu membuka layar menu lagi.
  if (data.link_menu_item_id) {
    await db.linkMenuItemToRecipe(data.link_menu_item_id, recipe.id, businessId);
  }

  revalidatePath("/app/finance");
  revalidatePath("/app/pos");
  revalidatePath("/app/pos/reports");
  return done({ id: recipe.id });
}

/** CSV berisi data kontak hanya untuk owner, bukan untuk kasir atau staf loyalty. */
export async function exportLoyaltyCustomersAction() {
  const { businessId } = await requireOwner();
  const locked = await moduleLock(businessId, "loyalty", "read");
  if (locked) return fail(locked);
  return done(await db.getCustomerExport(businessId));
}

export async function saveFinanceCalculatorPresetAction(data: {
  id?: string;
  name: string;
  mode: "kuliner" | "retail" | "jasa";
  direct_cost: number;
  supporting_cost: number;
  operational_cost: number;
  selling_price: number;
  discount_pct: number;
  payment_fee_pct: number;
  channel_fee_pct: number;
  tax_reserve_pct: number;
  target_margin_pct: number;
  monthly_fixed_cost: number;
  monthly_profit_target: number;
}): Promise<ActionResult<FinanceCalculatorPreset>> {
  const { businessId } = await requireOwner();
  const locked = await moduleLock(businessId, "finance", "write");
  if (locked) return fail(locked);
  if (!data.name.trim()) return fail("Nama produk atau layanan belum diisi.");

  const numericValues = [
    data.direct_cost,
    data.supporting_cost,
    data.operational_cost,
    data.selling_price,
    data.discount_pct,
    data.payment_fee_pct,
    data.channel_fee_pct,
    data.tax_reserve_pct,
    data.target_margin_pct,
    data.monthly_fixed_cost,
    data.monthly_profit_target,
  ];
  if (numericValues.some((value) => !Number.isFinite(value) || value < 0)) {
    return fail("Angka perhitungan tidak boleh kosong atau minus.");
  }
  if (data.selling_price <= 0)
    return fail("Isi harga jual sebelum menyimpan perhitungan.");
  if (data.direct_cost + data.supporting_cost + data.operational_cost <= 0) {
    return fail("Isi minimal satu modal per transaksi sebelum menyimpan.");
  }
  if (
    [
      data.discount_pct,
      data.payment_fee_pct,
      data.channel_fee_pct,
      data.tax_reserve_pct,
      data.target_margin_pct,
    ].some((value) => value > 100)
  ) {
    return fail("Persentase tidak boleh lebih dari 100%.");
  }

  const preset = await db.saveFinanceCalculatorPreset(businessId, {
    ...data,
    name: data.name.trim(),
  });
  revalidatePath("/app/finance");
  return done(preset);
}

export async function deleteFinanceCalculatorPresetAction(
  id: string,
): Promise<ActionResult<null>> {
  const { businessId } = await requireOwner();
  const locked = await moduleLock(businessId, "finance", "write");
  if (locked) return fail(locked);
  const deleted = await db.deleteFinanceCalculatorPreset(id, businessId);
  if (!deleted) return fail("Perhitungan tersimpan tidak ditemukan.");
  revalidatePath("/app/finance");
  return done(null);
}

export async function deleteRecipeAction(
  id: string,
): Promise<ActionResult<null>> {
  const { businessId } = await requireOwner();
  const locked = await moduleLock(businessId, "finance", "write");
  if (locked) return fail(locked);
  const ok = await db.deleteRecipe(id, businessId);
  if (!ok) return fail("Produk tidak ditemukan.");
  revalidatePath("/app/finance");
  return done(null);
}

export async function saveFinancePocketAction(data: {
  id?: string;
  name: string;
  allocation_pct: number;
}): Promise<ActionResult<null>> {
  const { businessId } = await requireOwner();
  const locked = await moduleLock(businessId, "finance", "write");
  if (locked) return fail(locked);
  if (!data.name.trim() || data.name.trim().length > 50)
    return fail("Nama kantong wajib diisi, maksimal 50 karakter.");
  if (
    !Number.isFinite(data.allocation_pct) ||
    data.allocation_pct < 0 ||
    data.allocation_pct > 100
  )
    return fail("Alokasi kantong harus 0 sampai 100%.");
  const existing = await db.getFinancePockets(businessId);
  const otherTotal = existing
    .filter((pocket) => pocket.id !== data.id)
    .reduce((sum, pocket) => sum + Number(pocket.allocation_pct), 0);
  if (otherTotal + data.allocation_pct > 100)
    return fail("Total alokasi semua kantong tidak boleh lebih dari 100%.");
  const pocket = await db.saveFinancePocket(businessId, {
    ...data,
    name: data.name.trim(),
  });
  if (!pocket) return fail("Kantong uang tidak ditemukan.");
  revalidatePath("/app/finance/operations");
  return done(null);
}

export async function deleteFinancePocketAction(
  id: string,
): Promise<ActionResult<null>> {
  const { businessId } = await requireOwner();
  if (!(await db.deleteFinancePocket(id, businessId)))
    return fail("Kantong uang tidak ditemukan.");
  revalidatePath("/app/finance/operations");
  return done(null);
}

export async function createFinanceTransactionAction(data: {
  type: "income" | "expense";
  category: string;
  amount: number;
  occurred_on: string;
  note?: string;
  pocket_id?: string | null;
}): Promise<ActionResult<null>> {
  const { businessId, userId } = await requireOwner();
  const locked = await moduleLock(businessId, "finance", "write");
  if (locked) return fail(locked);
  if (!data.category.trim() || data.category.trim().length > 60)
    return fail("Kategori wajib diisi, maksimal 60 karakter.");
  if (!Number.isInteger(data.amount) || data.amount < 1)
    return fail("Nominal harus berupa Rupiah bulat lebih dari nol.");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(data.occurred_on))
    return fail("Tanggal transaksi tidak valid.");
  await db.createFinanceTransaction(businessId, userId, {
    ...data,
    category: data.category.trim(),
    note: data.note?.trim() || null,
    pocket_id: data.pocket_id || null,
  });
  revalidatePath("/app/finance/operations");
  return done(null);
}

export async function saveFinanceAssetAction(data: {
  id?: string;
  name: string;
  category: string;
  acquired_on: string;
  purchase_cost: number;
  salvage_value: number;
  useful_life_months: number;
  is_active: boolean;
}): Promise<ActionResult<null>> {
  const { businessId } = await requireOwner();
  const locked = await moduleLock(businessId, "finance", "write");
  if (locked) return fail(locked);
  if (!data.name.trim() || !data.category.trim())
    return fail("Nama dan kategori aset wajib diisi.");
  if (
    !Number.isInteger(data.purchase_cost) ||
    data.purchase_cost < 1 ||
    !Number.isInteger(data.salvage_value) ||
    data.salvage_value < 0 ||
    data.salvage_value > data.purchase_cost
  )
    return fail("Nilai aset tidak valid.");
  if (
    !Number.isInteger(data.useful_life_months) ||
    data.useful_life_months < 1 ||
    data.useful_life_months > 240
  )
    return fail("Masa manfaat aset harus 1 sampai 240 bulan.");
  const asset = await db.saveFinanceAsset(businessId, {
    ...data,
    name: data.name.trim(),
    category: data.category.trim(),
  });
  if (!asset) return fail("Aset tidak ditemukan.");
  revalidatePath("/app/finance/operations");
  return done(null);
}

export async function saveInventoryItemAction(data: {
  id?: string;
  sku?: string | null;
  name: string;
  unit: string;
  reorder_level: number;
}): Promise<ActionResult<null>> {
  const { businessId } = await requireOwner();
  const locked = await moduleLock(businessId, "finance", "write");
  if (locked) return fail(locked);
  if (!data.name.trim() || !data.unit.trim())
    return fail("Nama barang dan satuan wajib diisi.");
  if (!Number.isFinite(data.reorder_level) || data.reorder_level < 0)
    return fail("Stok minimum tidak valid.");
  const item = await db.saveInventoryItem(businessId, {
    ...data,
    name: data.name.trim(),
    unit: data.unit.trim(),
    sku: data.sku?.trim() || null,
  });
  if (!item) return fail("Barang tidak ditemukan.");
  revalidatePath("/app/finance/operations");
  return done(null);
}

export async function recordInventoryPurchaseAction(data: {
  supplier_name?: string;
  purchased_on: string;
  note?: string;
  items: { inventory_item_id: string; qty: number; unit_cost: number }[];
}): Promise<ActionResult<null>> {
  const { businessId, userId } = await requireOwner();
  const locked = await moduleLock(businessId, "finance", "write");
  if (locked) return fail(locked);
  if (!data.items.length || data.items.length > 100)
    return fail("Masukkan minimal satu, maksimal 100 barang.");
  if (
    data.items.some(
      (item) =>
        !item.inventory_item_id ||
        !Number.isFinite(item.qty) ||
        item.qty <= 0 ||
        !Number.isInteger(item.unit_cost) ||
        item.unit_cost < 0,
    )
  )
    return fail("Isi barang belanja tidak valid.");
  const ok = await db.recordInventoryPurchase(businessId, userId, data);
  if (!ok) return fail("Ada barang stok yang tidak ditemukan.");
  revalidatePath("/app/finance/operations");
  return done(null);
}

export async function adjustInventoryStockAction(
  inventoryItemId: string,
  deltaQty: number,
  reason: string,
): Promise<ActionResult<null>> {
  const { businessId, userId } = await requireOwner();
  const locked = await moduleLock(businessId, "finance", "write");
  if (locked) return fail(locked);
  if (!Number.isFinite(deltaQty) || deltaQty === 0)
    return fail("Jumlah penyesuaian stok tidak valid.");
  if (!reason.trim() || reason.trim().length > 120)
    return fail("Alasan penyesuaian wajib diisi, maksimal 120 karakter.");
  const ok = await db.adjustInventoryStock(
    businessId,
    userId,
    inventoryItemId,
    deltaQty,
    reason.trim(),
  );
  if (!ok) return fail("Stok tidak cukup atau barang tidak ditemukan.");
  revalidatePath("/app/finance/operations");
  return done(null);
}

// ===========================================================================
// Staf
// ===========================================================================

export async function createStaffAction(
  name: string,
  pin: string,
): Promise<ActionResult<null>> {
  const { businessId } = await requireOwner();
  if (!name.trim()) return fail("Nama staf belum diisi.");
  if (!/^\d{4,6}$/.test(pin)) return fail("PIN harus 4 sampai 6 angka.");
  await db.createStaff(businessId, name.trim(), pin);
  revalidatePath("/app");
  return done(null);
}

export async function resetStaffPinAction(
  userId: string,
  pin: string,
): Promise<ActionResult<null>> {
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

export async function deactivateStaffAction(
  userId: string,
): Promise<ActionResult<null>> {
  const { businessId } = await requireOwner();
  const ok = await db.deactivateStaff(userId, businessId);
  if (!ok) return fail("Staf tidak ditemukan.");
  revalidatePath("/app");
  return done(null);
}

export async function setStaffActiveAction(
  userId: string,
  isActive: boolean,
): Promise<ActionResult<null>> {
  const { businessId } = await requireOwner();
  const updated = await db.setStaffActive(userId, businessId, isActive);
  if (!updated) return fail("Staf tidak ditemukan.");
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

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

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
  if (!JENIS_USAHA.has(input.businessType))
    return fail("Jenis usaha tidak dikenali.");

  const storeCode = input.storeCode.trim().toUpperCase();
  if (!/^[A-Z0-9]{3,10}$/.test(storeCode)) {
    return fail("Kode toko harus 3 sampai 10 huruf atau angka, tanpa spasi.");
  }

  const email = input.ownerEmail.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
    return fail("Email pemilik tidak valid.");

  // Kata sandi owner boleh angka pendek, dan yang menahan tebakan adalah
  // penguncian 5 percobaan di authenticateOwner, bukan panjangnya. Enam tetap
  // batas bawah yang wajar.
  if (input.ownerPassword.length < 6)
    return fail("Kata sandi pemilik minimal 6 karakter.");

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
  if (
    status !== "none" &&
    (!expiresAt || !/^\d{4}-\d{2}-\d{2}$/.test(expiresAt))
  ) {
    return fail("Tanggal jatuh tempo belum diisi.");
  }

  await db.setBusinessModule(businessId, module, status, expiresAt);
  revalidatePath("/admin/businesses");
  return done(null);
}

/** Control center: reset owner tanpa pernah membaca kata sandi lama. */
export async function adminResetOwnerPasswordAction(
  businessId: string,
  password: string,
): Promise<ActionResult<{ email: string }>> {
  const admin = await requireKaelAdmin();
  if (!UUID_RE.test(businessId)) return fail("Tenant tidak dikenali.");
  if (password.length < 10)
    return fail("Kata sandi sementara minimal 10 karakter.");
  const owner = await db.resetOwnerPasswordByAdmin(
    businessId,
    hashPin(password),
  );
  if (!owner) return fail("Owner tenant tidak ditemukan.");
  await db.recordAuditEvent({
    actorUserId: admin.userId,
    businessId,
    action: "admin.owner_password_reset",
    entityType: "user",
    entityId: owner.id,
  });
  revalidatePath("/admin/control");
  return done({ email: owner.email });
}

export async function adminSetDemoExpiryAction(
  businessId: string,
  expiresAt: string | null,
): Promise<ActionResult<null>> {
  const admin = await requireKaelAdmin();
  if (!UUID_RE.test(businessId)) return fail("Tenant tidak dikenali.");
  if (expiresAt && !/^\d{4}-\d{2}-\d{2}$/.test(expiresAt))
    return fail("Tanggal demo tidak valid.");
  const updated = await db.setAdminDemoExpiry(businessId, expiresAt);
  if (!updated) return fail("Tenant tidak ditemukan.");
  await db.recordAuditEvent({
    actorUserId: admin.userId,
    businessId,
    action: expiresAt ? "admin.demo_extended" : "admin.demo_promoted",
    entityType: "business",
    entityId: businessId,
    metadata: { expiresAt },
  });
  revalidatePath("/admin/control");
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
  if (input.password.length < 6)
    return fail("Kata sandi pemilik minimal 6 karakter.");

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
    if (raw.length > 500)
      return fail("Tautan logo terlalu panjang, maksimal 500 karakter.");

    /**
     * Aturan yang sama persis dengan foto menu, dan sengaja lewat fungsi yang
     * sama. Sebelumnya di sini ada pemeriksaan `new URL()` tersendiri yang
     * hanya menerima https — sehingga logo yang diunggah lewat KAEL, yang
     * alamatnya berbentuk /api/gambar/<uuid>, ditolak oleh panel yang justru
     * dipakai untuk menggantinya. Satu aturan di satu tempat menutup jenis
     * ketimpangan itu.
     */
    const bersih = bersihkanUrlGambar(raw);
    if (bersih === "invalid") {
      return fail(
        "Tautan logo harus lengkap dan diawali https, atau gambar yang diunggah lewat KAEL.",
      );
    }
    logoUrl = bersih;
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
  if (license.state === "tidak_dimiliki")
    return fail("Modul Loyalty belum aktif untuk usaha ini.");
  if (!license.canWrite)
    return fail(
      "Masa aktif KAEL Loyalty sudah lewat. Perpanjang lewat tim KAEL.",
    );

  if (input.mode === "point") {
    // Batas bawah 1 rupiah ditegakkan juga oleh CHECK di kolomnya. Diperiksa di
    // sini supaya pesannya kalimat, bukan galat constraint dari Postgres.
    if (!Number.isInteger(input.earnRate) || input.earnRate < 1) {
      return fail(
        "Kurs poin harus lebih dari nol. Contoh: Rp 10.000 untuk 1 poin.",
      );
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
