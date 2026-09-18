/**
 * Uji isi struk: jam, hari, nominal, item.
 *
 * Struk adalah catatan yang dipakai mencocokkan laci saat tutup shift. Angka
 * yang meleset di sini tidak terlihat di layar mana pun — yang menemukannya
 * kasir, berjam-jam kemudian, saat uangnya tidak cocok.
 *
 *     npx tsx test-struk.ts
 */
import {
  generateEscPosReceiptText,
  generateThreePlyReceiptText,
  generateKitchenTicketText,
  calculateCartTotals,
  calculateCashChange,
  jamStruk,
  tanggalStruk,
} from "./src/lib/pos-engine";

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

/** Transaksi 17 Sep 2026 pukul 12:43 WIB = 05:43 UTC. */
const WAKTU = "2026-09-17T05:43:00.000Z";

console.log("\n1. Jam mengikuti zona waktu toko, bukan UTC");
{
  cek("WIB menambah 7 jam dari UTC", jamStruk(WAKTU, "Asia/Jakarta") === "12.43 WIB",
    jamStruk(WAKTU, "Asia/Jakarta"));
  cek("WITA menambah 8 jam", jamStruk(WAKTU, "Asia/Makassar") === "13.43 WITA",
    jamStruk(WAKTU, "Asia/Makassar"));
  cek("WIT menambah 9 jam", jamStruk(WAKTU, "Asia/Jayapura") === "14.43 WIT",
    jamStruk(WAKTU, "Asia/Jayapura"));
  cek("tanpa createdAt tidak meledak", jamStruk(null) === "" && tanggalStruk(undefined) === "");
  cek("tanggal tidak kosong", tanggalStruk(WAKTU, "Asia/Jakarta").includes("2026"),
    tanggalStruk(WAKTU, "Asia/Jakarta"));
  cek("tanggal memuat nama hari", /^\w{3},/.test(tanggalStruk(WAKTU, "Asia/Jakarta")),
    tanggalStruk(WAKTU, "Asia/Jakarta"));
}

console.log("\n2. Pergantian hari tidak menggeser tanggal");
{
  // 18 Sep 01:00 WIB = 17 Sep 18:00 UTC. Tanggal setempat sudah berganti
  // walau tanggal UTC-nya belum — ini yang dulu tergeser.
  const dini = "2026-09-17T18:00:00.000Z";
  cek("transaksi lewat tengah malam pakai tanggal setempat",
    tanggalStruk(dini, "Asia/Jakarta").includes("18 Sep"), tanggalStruk(dini, "Asia/Jakarta"));
  cek("jam dini hari benar", jamStruk(dini, "Asia/Jakarta") === "01.00 WIB",
    jamStruk(dini, "Asia/Jakarta"));

  // Transaksi larut yang masih di tanggal yang sama.
  const malam = "2026-09-17T16:30:00.000Z";
  cek("transaksi malam tidak ikut maju sehari",
    tanggalStruk(malam, "Asia/Jakarta").includes("17 Sep"), tanggalStruk(malam, "Asia/Jakarta"));
  cek("jam malam benar", jamStruk(malam, "Asia/Jakarta") === "23.30 WIB",
    jamStruk(malam, "Asia/Jakarta"));
}

console.log("\n3. Nominal pada struk cocok dengan hitungan mesin kasir");
{
  const items = [
    { name: "Avocado Float", qty: 2, price: 30000 },
    { name: "Jamur Krispi", qty: 1, price: 18000 },
  ];
  const hitung = calculateCartTotals(items, 5000, 10, 5);
  const uang = calculateCashChange(hitung.total, 100000);

  const struk = generateEscPosReceiptText({
    businessName: "Mochi Cafe n Resto", businessAddress: "", businessPhone: "",
    orderNo: "A-001", tableNo: "04", serviceType: "dine_in", cashierName: "Kasir",
    createdAt: WAKTU, timezone: "Asia/Jakarta", items,
    subtotal: hitung.subtotal, discount: hitung.discount, tax: hitung.tax,
    serviceCharge: hitung.serviceCharge, total: hitung.total,
    paymentMethod: "cash", cashGiven: 100000, cashChange: uang.cashChange,
  });

  const rp = (n: number) => n.toLocaleString("id-ID");
  cek("subtotal tercetak", struk.includes(`Rp ${rp(hitung.subtotal)}`), `harusnya ${rp(hitung.subtotal)}`);
  cek("diskon tercetak", struk.includes(`-Rp ${rp(hitung.discount)}`));
  cek("service charge tercetak", struk.includes(`Rp ${rp(hitung.serviceCharge)}`));
  cek("pajak tercetak", struk.includes(`Rp ${rp(hitung.tax)}`));
  cek("total tercetak", struk.includes(`Rp ${rp(hitung.total)}`));
  cek("uang diterima tercetak", struk.includes(`Rp ${rp(100000)}`));
  cek("kembalian tercetak", struk.includes(`Rp ${rp(uang.cashChange)}`), `harusnya ${rp(uang.cashChange)}`);

  // Kembalian harus benar-benar hasil pengurangan, bukan angka lain.
  cek("kembalian = uang diterima - total", uang.cashChange === 100000 - hitung.total,
    `${uang.cashChange} vs ${100000 - hitung.total}`);

  console.log("\n4. Item pada struk cocok dengan keranjang");
  for (const item of items) {
    cek(`"${item.name}" tercetak`, struk.includes(item.name));
    cek(`  jumlah & harga satuan ${item.qty}x @${rp(item.price)}`,
      struk.includes(`${item.qty}x @${rp(item.price)}`));
    cek(`  subtotal baris ${rp(item.price * item.qty)}`,
      struk.includes(`Rp ${rp(item.price * item.qty)}`));
  }

  console.log("\n5. Tidak ada angka yang bocor ke struk");
  // Jumlah baris "Rp" harus sesuai jumlah baris uang yang memang dicetak.
  const barisRp = struk.split("\n").filter((l) => l.includes("Rp ")).length;
  cek("tidak ada baris rupiah liar", barisRp >= 7 && barisRp <= 12, `${barisRp} baris`);
  cek("tidak ada NaN", !struk.includes("NaN"));
  cek("tidak ada undefined", !struk.includes("undefined"));
  cek("tidak ada Invalid Date", !struk.includes("Invalid"));
}

console.log("\n6. Jam yang sama di ketiga rangkap dan tiket dapur");
{
  const dasar = {
    businessName: "Mochi", orderNo: "A-001", tableNo: "04",
    serviceType: "dine_in" as const, cashierName: "Kasir",
    createdAt: WAKTU, timezone: "Asia/Jakarta",
    items: [{ name: "Kopi", qty: 1, price: 20000 }],
    subtotal: 20000, discount: 0, tax: 0, serviceCharge: 0, total: 20000,
    paymentMethod: "cash",
  };
  const jam = "12.43 WIB";
  for (const bagian of ["dapur", "kasir", "pelanggan"] as const) {
    const t = generateThreePlyReceiptText({ ...dasar, bagian });
    cek(`rangkap ${bagian} memakai jam setempat`, t.includes(jam), t.match(/\d\d[.:]\d\d \w+/)?.[0] ?? "tidak ada jam");
  }
  const tiket = generateKitchenTicketText({
    businessName: "Mochi", orderNo: "A-001", tableNo: "04",
    serviceType: "dine_in", createdAt: WAKTU, timezone: "Asia/Jakarta",
    items: [{ name: "Kopi", qty: 1 }],
  });
  cek("tiket dapur memakai jam setempat", tiket.includes(jam),
    tiket.match(/\d\d[.:]\d\d \w+/)?.[0] ?? "tidak ada jam");
}

console.log("\n7. Lebar struk tidak melewati 32 karakter");
{
  const struk = generateThreePlyReceiptText({
    businessName: "Mochi Cafe n Resto", orderNo: "A-001", tableNo: "04",
    serviceType: "dine_in", cashierName: "Kasir", createdAt: WAKTU,
    timezone: "Asia/Jakarta",
    items: [{ name: "Jus Mix Sirsak Pokat Mangga", qty: 2, price: 35000 }],
    subtotal: 70000, discount: 0, tax: 0, serviceCharge: 0, total: 70000,
    paymentMethod: "cash", bagian: "pelanggan",
  });
  const terlalu = struk.split("\n").filter((l) => l.length > 32);
  cek("semua baris muat di kertas 58mm", terlalu.length === 0,
    terlalu.length ? `${terlalu.length} baris kepanjangan: ${JSON.stringify(terlalu[0])}` : "");
}

console.log("\n8. Bagi tagihan: struk sebagian tidak boleh terbaca sebagai tagihan penuh");
{
  const dasarBagi = {
    businessName: "Mochi Cafe n Resto",
    orderNo: "MEJA-07",
    tableNo: "07",
    serviceType: "dine_in" as const,
    cashierName: "Kasir",
    createdAt: WAKTU,
    timezone: "Asia/Jakarta",
    subtotal: 32000,
    discount: 0,
    tax: 0,
    serviceCharge: 0,
    total: 32000,
    paymentMethod: "cash",
    bagian: "pelanggan" as const,
  };

  const bagian = generateThreePlyReceiptText({
    ...dasarBagi,
    items: [{ name: "Dalgona Coklat", qty: 1, price: 32000 }],
    bagiTagihan: { bagianKe: 2, dariBagian: 5, totalMeja: 187000 },
  });

  cek("struk menyebut dirinya bagi tagihan", bagian.includes("BAGI TAGIHAN"));
  cek("nomor bagiannya tercetak", bagian.includes("BAGIAN 2 DARI 5"));
  cek(
    "total seluruh meja ikut tercetak",
    bagian.includes("187.000"),
    "tanpa ini, satu bagian gampang disangka tagihan penuh",
  );
  cek(
    "totalnya diberi label bagian, bukan TOTAL BAYAR",
    bagian.includes("BAYAR BAGIAN INI") && !bagian.includes("TOTAL BAYAR"),
  );
  cek(
    "keterangan bagian muncul SEBELUM angka totalnya",
    bagian.indexOf("BAGI TAGIHAN") < bagian.indexOf("BAYAR BAGIAN INI"),
    "yang baca struk berhenti di angka total; keterangan setelahnya sudah telat",
  );
  cek(
    "bagian tagihan tetap muat di kertas 58mm",
    bagian.split("\n").every((l) => l.length <= 32),
  );

  // Tanpa bagiTagihan, struk biasa TIDAK boleh berubah sedikit pun.
  const biasa = generateThreePlyReceiptText({
    ...dasarBagi,
    items: [{ name: "Dalgona Coklat", qty: 1, price: 32000 }],
  });
  cek("struk biasa tidak ikut berubah", biasa.includes("TOTAL BAYAR") && !biasa.includes("BAGI TAGIHAN"));
  cek("struk biasa tidak mencantumkan total meja", !biasa.includes("Total meja"));
}

console.log("\n9. Cara bayar tercetak, supaya struknya bisa dibukukan");
{
  const dasarBayar = {
    businessName: "Mochi Cafe n Resto",
    orderNo: "MEJA-24", tableNo: "24", serviceType: "dine_in" as const,
    cashierName: "Rizka", createdAt: WAKTU, timezone: "Asia/Jakarta",
    items: [{ name: "Coffee Susu Aren Dingin", qty: 1, price: 20000 }],
    subtotal: 65000, discount: 0, tax: 0, serviceCharge: 0, total: 65000,
  };

  /**
   * Struk ini disortir jadi tumpukan tunai, QRIS, dan transfer saat staf dan
   * pemilik membukukan bersama. Lembar tanpa keterangan cara bayar tidak bisa
   * masuk tumpukan mana pun, dan berakhir sebagai selisih yang tidak ada yang
   * bisa jelaskan.
   */
  for (const [metode, tertulis] of [
    ["cash", "TUNAI"],
    ["qris", "QRIS"],
    ["transfer", "TRANSFER BANK"],
  ] as const) {
    for (const bagian of ["pelanggan", "kasir"] as const) {
      const t = generateThreePlyReceiptText({ ...dasarBayar, paymentMethod: metode, bagian });
      cek(
        `rangkap ${bagian} menyebut cara bayar ${tertulis}`,
        t.includes("CARA BAYAR") && t.includes(tertulis),
        "struknya tidak bisa disortir saat pembukuan",
      );
    }
  }

  const tunai = generateThreePlyReceiptText({
    ...dasarBayar, paymentMethod: "cash", cashGiven: 100000, cashChange: 35000,
    bagian: "pelanggan",
  });
  cek("tunai menampilkan uang diterima dan kembalian",
    tunai.includes("Uang diterima") && tunai.includes("35.000"));

  const qris = generateThreePlyReceiptText({ ...dasarBayar, paymentMethod: "qris", bagian: "pelanggan" });
  cek("non-tunai tidak menampilkan kembalian palsu",
    !qris.includes("Kembalian"),
    "QRIS tidak punya kembalian; menampilkannya bikin kasir ragu");

  for (const bagian of ["pelanggan", "kasir"] as const) {
    const t = generateThreePlyReceiptText({ ...dasarBayar, paymentMethod: "cash", bagian });
    cek(`rangkap ${bagian} tetap muat di kertas 58mm`,
      t.split("\n").every((l) => l.length <= 32));
  }
}

console.log(`\n=== ${lulus} LULUS, ${gagal} GAGAL ===\n`);
process.exit(gagal > 0 ? 1 : 0);
