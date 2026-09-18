/**
 * Uji integritas pencatatan uang, sesi meja, dan penguncian HPP.
 *
 * Dijalankan lewat kode aslinya (db.ts), bukan lewat SQL tiruan — supaya yang
 * diuji benar-benar jalur yang dipakai kasir, termasuk validasinya.
 *
 * SELALU memakai tenant demo. Baris yang dibuat dihapus lagi di akhir, dan
 * tenant pelanggan sungguhan tidak pernah disentuh.
 *
 *     npx tsx test-pos-integritas.ts
 */
import { config } from "dotenv";
config({ path: ".env.local" });

// Import dinamis: modul database membaca DATABASE_URL saat dimuat, dan import
// statis di ESM dijalankan SEBELUM config() di atas sempat mengisinya.
const { db } = await import("./src/lib/db");
const { sql } = await import("./src/lib/postgres");

const DEMO_STORE = "KAELCAFE";

let lulus = 0;
let gagal = 0;

function cek(nama: string, syarat: boolean, keterangan = "") {
  if (syarat) {
    lulus++;
    console.log(`  LULUS  ${nama}`);
  } else {
    gagal++;
    console.log(`  GAGAL  ${nama}${keterangan ? " — " + keterangan : ""}`);
  }
}

async function main() {
  const business = await db.getBusinessByStoreCode(DEMO_STORE);
  if (!business) throw new Error(`Tenant demo ${DEMO_STORE} tidak ditemukan.`);
  if (!business.is_demo) throw new Error("Berhenti: tenant ini bukan tenant demo.");

  const businessId = business.id;
  const users = await db.getUsers(businessId);
  const owner = users.find((u) => u.role === "owner");
  if (!owner) throw new Error("Tenant demo tidak punya owner.");

  const menu = (await db.getMenuItems(businessId)).filter((m) => m.is_available);
  if (menu.length < 2) throw new Error("Tenant demo butuh minimal 2 menu tersedia.");

  const menuA = menu[0];
  const menuB = menu.find((m) => Number(m.price) !== Number(menuA.price)) ?? menu[1];

  const MEJA = "UJI-INTEGRITAS";
  const dibuat: string[] = [];

  console.log(`\nTenant uji: ${business.name} (${DEMO_STORE})`);
  console.log(`Menu: ${menuA.name} vs ${menuB.name}\n`);

  // -------------------------------------------------------------------------
  console.log("1. Alasan diskon tersimpan bersama transaksinya");
  // -------------------------------------------------------------------------
  const sesi = await db.openTableSession(businessId, MEJA, owner.id);
  cek("sesi meja terbuka", !!sesi);

  const { order: order1 } = await db.createOrder(
    businessId,
    {
      channel: "cashier",
      service_type: "dine_in",
      table_no: MEJA,
      table_session_id: sesi!.id,
      status: "paid",
      payment_status: "paid",
      fulfillment_status: "completed",
      discount: 5000,
      discount_reason: "Keringanan saudara owner — uji integritas",
      payment_method: "qris",
      created_by: owner.id,
    },
    [{ menu_item_id: menuA.id, name: menuA.name, price: Number(menuA.price), qty: 2 }],
  );
  dibuat.push(order1.id);

  const tersimpan = await sql`SELECT discount, discount_reason, table_session_id FROM orders WHERE id = ${order1.id}`;
  cek("alasan diskon ikut tersimpan", tersimpan[0].discount_reason?.includes("Keringanan saudara owner"), String(tersimpan[0].discount_reason));
  cek("pesanan menempel ke sesi meja", tersimpan[0].table_session_id === sesi!.id);

  // -------------------------------------------------------------------------
  console.log("\n2. HPP dikunci saat transaksi");
  // -------------------------------------------------------------------------
  const modalSekarang = (await db.getMenuUnitCosts(businessId)).get(menuA.id);
  const baris = await sql`SELECT cost_snapshot, price_snapshot FROM order_items WHERE order_id = ${order1.id}`;
  cek(
    "cost_snapshot ikut tertulis di baris pesanan",
    modalSekarang == null ? baris[0].cost_snapshot === null : Number(baris[0].cost_snapshot) === modalSekarang,
    `modal sekarang=${modalSekarang}, tersimpan=${baris[0].cost_snapshot}`,
  );

  // Harga bahan naik setelah transaksi. Yang terkunci tidak boleh ikut berubah.
  const sebelum = baris[0].cost_snapshot;
  await sql`UPDATE menu_items SET cost_price = COALESCE(cost_price, 0) + 9999 WHERE id = ${menuA.id}`;
  const sesudah = await sql`SELECT cost_snapshot FROM order_items WHERE order_id = ${order1.id}`;
  cek(
    "modal transaksi lama TIDAK ikut berubah saat harga naik",
    String(sesudah[0].cost_snapshot) === String(sebelum),
    `sebelum=${sebelum}, sesudah=${sesudah[0].cost_snapshot}`,
  );
  await sql`UPDATE menu_items SET cost_price = GREATEST(COALESCE(cost_price, 0) - 9999, 0) WHERE id = ${menuA.id}`;

  // -------------------------------------------------------------------------
  console.log("\n3. Void ditolak untuk pesanan yang sudah dibayar");
  // -------------------------------------------------------------------------
  const batal = await db.cancelOrder(order1.id, businessId, "uji", owner.id);
  cek("pesanan lunas tidak bisa di-void", !batal.ok);
  cek("pesannya mengarahkan ke refund", (batal.error ?? "").toLowerCase().includes("refund"), batal.error);

  // -------------------------------------------------------------------------
  console.log("\n4. Penggantian menu: riwayat, selisih, dan stok");
  // -------------------------------------------------------------------------
  const itemId = (await db.getOrderItems(order1.id))[0].id;

  const tanpaPenyelesaian = await db.replaceOrderItem(order1.id, itemId, menuB.id, businessId, owner.id, "none");
  cek("selisih pada nota lunas tidak boleh menggantung", !tanpaPenyelesaian.ok, tanpaPenyelesaian.error);

  const namaLama = (await db.getOrderItems(order1.id))[0].name_snapshot;
  const hasil = await db.replaceOrderItem(order1.id, itemId, menuB.id, businessId, owner.id, "waive", "uji integritas");
  cek("penggantian dengan penyelesaian selisih diterima", hasil.ok, hasil.error);

  const jejak = await sql`SELECT * FROM order_item_changes WHERE order_id = ${order1.id}`;
  cek("riwayat pesanan asli tersimpan", jejak.length === 1 && jejak[0].old_name === namaLama, `tercatat: ${jejak[0]?.old_name}`);
  cek("selisih dicatat angkanya", jejak.length === 1 && Number(jejak[0].price_diff) !== 0);
  cek("cara penyelesaian selisih tercatat", jejak[0]?.settlement === "waive");

  const setelahGanti = await sql`SELECT name_snapshot, cost_snapshot FROM order_items WHERE id = ${itemId}`;
  cek("baris pesanan mengikuti yang benar-benar disajikan", setelahGanti[0].name_snapshot === menuB.name);

  // -------------------------------------------------------------------------
  console.log("\n5. Meja tidak bisa ditutup kalau masih ada tagihan");
  // -------------------------------------------------------------------------
  const { order: order2 } = await db.createOrder(
    businessId,
    {
      channel: "qr",
      service_type: "dine_in",
      table_no: MEJA,
      table_session_id: sesi!.id,
      status: "open",
      payment_status: "pending",
      fulfillment_status: "pending",
      payment_method: "qris",
      created_by: owner.id,
    },
    [{ menu_item_id: menuB.id, name: menuB.name, price: Number(menuB.price), qty: 1 }],
  );
  dibuat.push(order2.id);

  const tutupGagal = await db.closeTableSession(sesi!.id, businessId, owner.id);
  cek("meja dengan tagihan belum lunas tidak bisa ditutup", !tutupGagal.ok, tutupGagal.error);
  cek("pesannya menyebut nomor notanya", (tutupGagal.error ?? "").includes(order2.order_no), tutupGagal.error);

  const masihPending = await sql`SELECT payment_status FROM orders WHERE id = ${order2.id}`;
  cek("tagihan yang belum lunas TIDAK diam-diam ditandai lunas", masihPending[0].payment_status === "pending");

  // -------------------------------------------------------------------------
  console.log("\n6. Tambahan pesanan masuk ke kunjungan yang sama");
  // -------------------------------------------------------------------------
  const sesiLagi = await db.openTableSession(businessId, "meja uji-integritas", owner.id);
  cek("membuka meja yang sama tidak bikin kunjungan kedua", sesiLagi?.id === sesi!.id, `${sesiLagi?.id} vs ${sesi!.id}`);

  const ringkas = (await db.getTableSessionSummaries(businessId)).find((s) => s.id === sesi!.id);
  cek("tagihan awal dan tambahan terkumpul jadi satu", ringkas?.order_count === 2, `order_count=${ringkas?.order_count}`);
  cek("meja ditandai masih ada tagihan", ringkas?.has_unpaid === true);

  // -------------------------------------------------------------------------
  console.log("\n7. Pembersihan massal tidak menyentuh transaksi sungguhan");
  // -------------------------------------------------------------------------
  const { order: nyata } = await db.createOrder(
    businessId,
    {
      channel: "cashier",
      service_type: "takeaway",
      status: "paid",
      payment_status: "paid",
      fulfillment_status: "completed",
      payment_method: "cash",
      created_by: owner.id,
    },
    [{ menu_item_id: menuA.id, name: menuA.name, price: Number(menuA.price), qty: 1 }],
  );
  dibuat.push(nyata.id);

  /**
   * Tanda latihan pada SELURUH pesanan tenant demo dicabut sementara.
   *
   * Tanpa langkah ini, uji di bawah benar-benar menjalankan pembersihan
   * tenant-lebar dan ikut menghapus data contoh yang sudah ada — persis
   * kerusakan yang sedang diuji pencegahannya. Tandanya dipasang lagi begitu
   * pemeriksaannya selesai.
   */
  const bertandaSemula = (
    await sql`SELECT id FROM orders WHERE business_id = ${businessId} AND is_test AND id <> ${nyata.id}`
  ).map((r) => r.id as string);
  if (bertandaSemula.length) {
    await sql`UPDATE orders SET is_test = FALSE WHERE id = ANY(${bertandaSemula})`;
  }
  await sql`UPDATE orders SET is_test = FALSE WHERE id = ${nyata.id}`;

  await db.clearTestData(businessId, "all_orders");
  const selamat = await sql`SELECT id FROM orders WHERE id = ${nyata.id}`;
  cek("transaksi tanpa tanda latihan TIDAK ikut terhapus", selamat.length === 1);

  await db.markOrdersAsTest([nyata.id], businessId, true);
  await db.clearTestData(businessId, "all_orders");
  const hilang = await sql`SELECT id FROM orders WHERE id = ${nyata.id}`;
  cek("yang sudah ditandai latihan baru boleh terhapus", hilang.length === 0);

  if (bertandaSemula.length) {
    await sql`UPDATE orders SET is_test = TRUE WHERE id = ANY(${bertandaSemula})`;
  }

  // -------------------------------------------------------------------------
  console.log("\n8. Ulasan tidak bisa nyasar ke tenant lain");
  // -------------------------------------------------------------------------
  let ditolak = false;
  try {
    await db.saveFeedbackRow({ rating: 5, comment: "tanpa asal-usul" });
  } catch {
    ditolak = true;
  }
  cek("ulasan tanpa pesanan/kartu ditolak, bukan jatuh ke tenant tertua", ditolak);

  const lain = (await sql`SELECT id FROM businesses WHERE id <> ${businessId} LIMIT 1`)[0];
  if (lain) {
    let bentrok = false;
    try {
      await db.saveFeedbackRow({ rating: 5, order_id: order2.id, business_id: lain.id as string });
    } catch {
      bentrok = true;
    }
    cek("business_id yang tidak cocok dengan pesanannya ditolak", bentrok);
  }

  // -------------------------------------------------------------------------
  console.log("\n9. Pesanan kasir ikut masuk antrean dapur");
  // -------------------------------------------------------------------------
  const { order: pesananKasir } = await db.createOrder(
    businessId,
    {
      channel: "cashier",
      service_type: "dine_in",
      table_no: MEJA,
      table_session_id: sesi!.id,
      status: "paid",
      payment_status: "paid",
      fulfillment_status: "pending",
      payment_method: "cash",
      created_by: owner.id,
    },
    [{ menu_item_id: menuA.id, name: menuA.name, price: Number(menuA.price), qty: 1 }],
  );
  dibuat.push(pesananKasir.id);

  const antrean = await db.getOrderStationOrders(businessId);
  cek(
    "pesanan yang diketik kasir muncul di antrean dapur",
    antrean.some((o) => o.id === pesananKasir.id),
    `antrean berisi ${antrean.length} pesanan`,
  );

  // -------------------------------------------------------------------------
  console.log("\n10. Nota yang belum dibayar tidak hilang saat dapur selesai");
  // -------------------------------------------------------------------------
  /**
   * Pembayaran dan dapur berjalan sendiri-sendiri, dan dulu keduanya dianggap
   * satu: begitu dapur menandai makanan sudah disajikan, notanya keluar dari
   * antrean kasir walaupun uangnya belum masuk sama sekali.
   *
   * Yang kejadian di Mochi: lonceng pesanan masuk tetap menghitungnya, tapi
   * popup-nya terbuka kosong saat ditekan, dan di riwayat statusnya "belum
   * bayar" tanpa satu pun tombol yang bisa menagihnya. Uangnya hilang
   * diam-diam, dan mejanya ikut tidak bisa ditutup.
   */
  const { order: belumBayar } = await db.createOrder(
    businessId,
    {
      channel: "qr",
      service_type: "dine_in",
      table_no: MEJA,
      table_session_id: sesi!.id,
      status: "open",
      payment_status: "pending",
      fulfillment_status: "completed",
      payment_method: "qris",
      created_by: owner.id,
    },
    [{ menu_item_id: menuB.id, name: menuB.name, price: Number(menuB.price), qty: 1 }],
  );
  dibuat.push(belumBayar.id);

  const antreanKasir = await db.getOrderStationOrders(businessId);
  cek(
    "nota belum lunas tetap di antrean walau dapur sudah selesai",
    antreanKasir.some((o) => o.id === belumBayar.id),
    "kasir kehilangan satu-satunya tombol untuk menagihnya",
  );

  /** Sebaliknya: yang sudah lunas DAN sudah disajikan memang harus keluar. */
  const { order: selesaiLunas } = await db.createOrder(
    businessId,
    {
      channel: "qr",
      service_type: "dine_in",
      table_no: MEJA,
      table_session_id: sesi!.id,
      status: "paid",
      payment_status: "paid",
      fulfillment_status: "completed",
      payment_method: "qris",
      created_by: owner.id,
    },
    [{ menu_item_id: menuB.id, name: menuB.name, price: Number(menuB.price), qty: 1 }],
  );
  dibuat.push(selesaiLunas.id);

  const antreanLagi = await db.getOrderStationOrders(businessId);
  cek(
    "nota lunas dan sudah disajikan keluar dari antrean",
    !antreanLagi.some((o) => o.id === selesaiLunas.id),
    "antrean kasir akan menumpuk terus tanpa pernah kosong",
  );

  // -------------------------------------------------------------------------
  console.log("\n11. Menghapus pesanan tidak meninggalkan meja 'Disajikan' selamanya");
  // -------------------------------------------------------------------------
  /**
   * Denah meja menandai meja bersesi terbuka sebagai "Disajikan" walaupun belum
   * ada pesanan — tamu yang baru duduk memang harus terlihat. Tapi dulu
   * penghapusan pesanan tidak menyentuh sesinya sama sekali, jadi sesudah owner
   * membersihkan data latihan, mejanya menyala "Disajikan" tanpa satu pun nota
   * yang bisa ditutup untuk mematikannya.
   */
  /**
   * Sisa dari jalannya uji yang sempat gagal dibuang dulu.
   *
   * Tanpa ini, satu run yang berhenti di tengah meninggalkan nota yang masih
   * menempel ke sesi mejanya — dan run berikutnya memakai ulang sesi itu, lalu
   * GAGAL karena sesinya memang masih punya pesanan. Kegagalannya menuding
   * kode yang sebenarnya benar, dan itu jenis kegagalan yang paling mahal:
   * yang membuat orang membongkar bagian yang tidak rusak.
   */
  const MEJA_UJI = ["uji-yatim", "uji-tamubaru", "uji-lain"];
  const sisaLama = await sql`
    SELECT id FROM orders WHERE business_id = ${businessId} AND table_no ILIKE 'meja uji-%'
  `;
  if (sisaLama.length) {
    const ids = sisaLama.map((r) => r.id as string);
    await sql`DELETE FROM order_item_changes WHERE order_id = ANY(${ids})`;
    await sql`DELETE FROM refunds WHERE order_id = ANY(${ids})`;
    await sql`DELETE FROM point_ledger WHERE order_id = ANY(${ids})`;
    await sql`DELETE FROM order_items WHERE order_id = ANY(${ids})`;
    await sql`DELETE FROM orders WHERE id = ANY(${ids})`;
  }
  await sql`
    DELETE FROM table_sessions
    WHERE business_id = ${businessId} AND table_key = ANY(${MEJA_UJI})
  `;

  const sesiYatim = await db.openTableSession(businessId, "meja uji-yatim", owner.id);
  const { order: notaYatim } = await db.createOrder(
    businessId,
    {
      channel: "cashier",
      table_no: "meja uji-yatim",
      service_type: "dine_in",
      table_session_id: sesiYatim!.id,
      status: "paid",
      payment_status: "paid",
      fulfillment_status: "completed",
      payment_method: "cash",
      created_by: owner.id,
    },
    [{ menu_item_id: menuA.id, name: menuA.name, price: Number(menuA.price), qty: 1 }],
  );

  await db.deleteOrdersBatch([notaYatim.id], businessId);

  const sisaYatim = await sql`SELECT id FROM table_sessions WHERE id = ${sesiYatim!.id}`;
  cek(
    "sesi meja ikut hilang saat seluruh notanya dihapus",
    sisaYatim.length === 0,
    "mejanya akan tersangkut 'Disajikan' di denah",
  );

  /**
   * Sisi sebaliknya, dan ini yang gampang rusak saat memperbaiki yang di atas:
   * meja yang tamunya baru duduk dan belum memesan TIDAK boleh ikut terbuang.
   */
  const sesiTamuBaru = await db.openTableSession(businessId, "meja uji-tamubaru", owner.id);
  const { order: notaLain } = await db.createOrder(
    businessId,
    {
      channel: "cashier",
      table_no: "meja uji-lain",
      service_type: "dine_in",
      status: "paid",
      payment_status: "paid",
      fulfillment_status: "completed",
      payment_method: "cash",
      created_by: owner.id,
    },
    [{ menu_item_id: menuA.id, name: menuA.name, price: Number(menuA.price), qty: 1 }],
  );
  await db.deleteOrdersBatch([notaLain.id], businessId);

  const tamuBaruMasihAda = await sql`SELECT id FROM table_sessions WHERE id = ${sesiTamuBaru!.id}`;
  cek(
    "meja yang tamunya belum memesan tetap terisi",
    tamuBaruMasihAda.length === 1,
    "tamu yang sudah duduk jadi hilang dari denah",
  );
  await sql`DELETE FROM table_sessions WHERE id = ${sesiTamuBaru!.id}`;

  // -------------------------------------------------------------------------
  console.log("\n12. Panggilan meja: satu meja, satu panggilan menunggu");
  // -------------------------------------------------------------------------
  /**
   * Tamu yang merasa lama akan menekan tombol panggil berkali-kali. Itu wajar,
   * dan bukan alasan untuk membanjiri layar kasir dengan lima baris meja yang
   * sama sampai panggilan meja LAIN tenggelam di bawahnya.
   */
  await sql`DELETE FROM table_calls WHERE business_id = ${businessId}`;

  const panggilPertama = await db.createTableCall(businessId, "Meja uji-panggil");
  cek("panggilan pertama tercatat", panggilPertama.ok && panggilPertama.sudahAda === false);

  const panggilLagi = await db.createTableCall(businessId, "meja UJI-PANGGIL");
  cek(
    "tekan lagi tidak menggandakan barisnya",
    panggilLagi.ok && panggilLagi.sudahAda === true,
    "layar kasir akan penuh satu meja yang sama",
  );
  cek(
    "tekan lagi TIDAK dianggap gagal",
    panggilLagi.ok === true,
    "memberi galat berarti menghukum tamu yang sedang menunggu",
  );

  const daftarPanggilan = await db.getOpenTableCalls(businessId);
  cek("cuma satu panggilan menunggu untuk meja itu", daftarPanggilan.length === 1,
    `dapat ${daftarPanggilan.length}`);

  const ditutup = await db.resolveTableCall(daftarPanggilan[0].id, businessId, owner.id);
  cek("pelayan bisa menutup panggilan", ditutup);
  cek("menutup dua kali ditolak",
    !(await db.resolveTableCall(daftarPanggilan[0].id, businessId, owner.id)),
    "dua pelayan bisa sama-sama mengira dialah yang melayani");

  const panggilSetelahDilayani = await db.createTableCall(businessId, "Meja uji-panggil");
  cek("meja yang sudah dilayani boleh memanggil lagi",
    panggilSetelahDilayani.ok && panggilSetelahDilayani.sudahAda === false,
    "tamu tidak bisa minta tambah pesanan");

  await sql`DELETE FROM table_calls WHERE business_id = ${businessId}`;

  // -------------------------------------------------------------------------
  console.log("\n13. Jeda panggil ulang supaya bunyinya tetap berarti");
  // -------------------------------------------------------------------------
  /**
   * Kasir yang dibunyikan sepuluh kali oleh meja yang sama akan mulai
   * mengabaikan bunyinya — dan saat itu terjadi, meja LAIN yang benar-benar
   * menunggu ikut tidak terdengar. Jeda ini yang menjaga bunyinya tetap berarti.
   */
  const panggilBercatatan = await db.createTableCall(businessId, "Meja uji-jeda");
  cek("panggilan tercatat", panggilBercatatan.ok);

  const daftarBercatatan = await db.getOpenTableCalls(businessId);
  const catatanTersimpan = daftarBercatatan.find((c) => c.table_key === "uji-jeda");
  cek("panggilannya terbaca di daftar kasir", Boolean(catatanTersimpan));

  const dalamJeda = await db.createTableCall(businessId, "meja UJI-JEDA");
  cek("panggil ulang dalam jeda tidak membunyikan kasir",
    (dalamJeda.jedaDetik ?? 0) > 0, `sisa ${dalamJeda.jedaDetik} detik`);
  cek("tapi tetap dijawab berhasil, bukan galat", dalamJeda.ok === true,
    "memberi galat berarti menghukum tamu yang sedang menunggu");

  const waktuAwal = catatanTersimpan!.created_at;
  await sql`
    UPDATE table_calls SET ping_terakhir = NOW() - INTERVAL '3 minutes'
    WHERE business_id = ${businessId} AND table_key = 'uji-jeda'
  `;
  const sesudahJeda = await db.createTableCall(businessId, "meja UJI-JEDA");
  cek("sesudah jedanya lewat, boleh memanggil lagi", (sesudahJeda.jedaDetik ?? 99) === 0);

  const setelahPingKedua = (await db.getOpenTableCalls(businessId))
    .find((c) => c.table_key === "uji-jeda");
  cek("jumlah panggilan naik jadi 2", setelahPingKedua?.jumlah_ping === 2,
    String(setelahPingKedua?.jumlah_ping));
  cek(
    "lama menunggu TIDAK ikut ter-reset saat panggil ulang",
    new Date(setelahPingKedua!.created_at).getTime() === new Date(waktuAwal).getTime(),
    "meja yang sudah lama diabaikan akan terlihat seperti baru memanggil",
  );

  await sql`DELETE FROM table_calls WHERE business_id = ${businessId}`;

  // -------------------------------------------------------------------------
  console.log("\nMembersihkan data uji...");
  // -------------------------------------------------------------------------
  await sql`DELETE FROM order_item_changes WHERE order_id = ANY(${dibuat})`;
  await sql`DELETE FROM refunds WHERE order_id = ANY(${dibuat})`;
  await sql`DELETE FROM inventory_movements WHERE reference_id = ANY(${dibuat})`;
  await sql`DELETE FROM point_ledger WHERE order_id = ANY(${dibuat})`;
  await sql`DELETE FROM order_items WHERE order_id = ANY(${dibuat})`;
  await sql`DELETE FROM orders WHERE id = ANY(${dibuat})`;
  await sql`DELETE FROM table_sessions WHERE id = ${sesi!.id}`;
  console.log("  bersih.");

  console.log(`\n=== ${lulus} LULUS, ${gagal} GAGAL ===\n`);
  await sql.end();
  process.exit(gagal > 0 ? 1 : 0);
}

main().catch(async (e) => {
  console.error(e);
  await sql.end();
  process.exit(1);
});
