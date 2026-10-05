import { jamStruk, tanggalStruk } from "./pos-engine";
import type { ShiftFullDetail } from "./types";

/**
 * Satu lembar rekap shift untuk pembukuan, menggantikan arsip kasir per
 * transaksi.
 *
 * Dulu tiap transaksi mencetak lembar "copy kasir", lalu di akhir hari staf
 * dan pemilik menyortir tumpukan itu jadi tunai, QRIS, dan transfer, dan
 * mencocokkan tiap tumpukan ke laci, mutasi QRIS, dan rekening. Yang mereka
 * butuhkan sebenarnya cuma hasil sortiran itu — dan sistemnya sudah tahu.
 *
 * Isinya: jumlah per cara bayar, daftar QRIS dan transfer satu per satu
 * (untuk dicentang dengan mutasi bank), hitungan laci yang sama persis dengan
 * rekonsiliasi tutup shift, dan pengeluaran kas.
 */

const LEBAR = 32;

const rp = (n: number) => `${n < 0 ? "-" : ""}Rp ${Math.abs(Math.round(n)).toLocaleString("id-ID")}`;

function baris(kiri: string, kanan: string): string {
  const ruang = Math.max(1, LEBAR - kiri.length - kanan.length);
  return kiri + " ".repeat(ruang) + kanan;
}

const tengah = (s: string) => " ".repeat(Math.max(0, Math.floor((LEBAR - s.length) / 2))) + s;
const garis = "-".repeat(LEBAR);
const garisGanda = "=".repeat(LEBAR);

/** Printer thermal cuma kenal ASCII; nama dengan huruf lain dibersihkan. */
const ascii = (s: string) =>
  s.normalize("NFKD").replace(/[–—]/g, "-").replace(/[^\x20-\x7E]/g, "").trim();

export function rekapShiftTeks(
  detail: ShiftFullDetail,
  opsi: { namaToko: string; timezone?: string; dicetakPada?: Date },
): string {
  const tz = opsi.timezone || "Asia/Jakarta";
  const { shift, stats, orders, movements } = detail;
  const L: string[] = [];

  L.push(garisGanda);
  L.push(tengah("REKAP SHIFT KASIR"));
  L.push(tengah(ascii(opsi.namaToko).toUpperCase().slice(0, LEBAR)));
  L.push(garisGanda);
  L.push(baris("Kasir", ascii(shift.staff_name || "Kasir").slice(0, 20)));
  L.push(tanggalStruk(shift.opened_at, tz));
  L.push(baris("Buka", jamStruk(shift.opened_at, tz)));
  L.push(baris("Tutup", shift.closed_at ? jamStruk(shift.closed_at, tz) : "MASIH BUKA"));
  L.push(garis);

  L.push(baris("Nota lunas", String(stats.totalOrders)));
  L.push(baris("PENJUALAN", rp(stats.totalSales)));
  L.push(garis);

  const perCara: [string, number, number][] = [
    ["Tunai", stats.cashCount, stats.cashSales],
    ["QRIS", stats.qrisCount, stats.qrisSales],
    ["Transfer", stats.transferCount, stats.transferSales],
  ];
  for (const [nama, jumlah, nilai] of perCara) {
    L.push(baris(`${nama.padEnd(9)}${String(jumlah).padStart(3)}x`, rp(nilai)));
  }

  // Daftar non-tunai satu per satu: inilah yang dicocokkan dengan mutasi bank.
  for (const [cara, judul] of [["qris", "QRIS"], ["transfer", "TRANSFER"]] as const) {
    const daftar = orders.filter((o) => o.payment_method === cara);
    if (!daftar.length) continue;
    L.push(garis);
    L.push(`CEK ${judul} - cocokkan mutasi`);
    for (const o of daftar) {
      const jam = jamStruk(o.paid_confirmed_at || o.created_at, tz);
      L.push(baris(`${jam} #${o.order_no}`.slice(0, 20), rp(Number(o.total))));
    }
  }

  // Laci: angka yang sama dengan rekonsiliasi tutup shift.
  const tunaiBersih = Number(shift.cash_sales || 0);
  const refundTunai = Math.max(0, stats.cashSales - tunaiBersih);
  const modal = Number(shift.opening_cash || 0);
  const seharusnya =
    shift.expected_cash != null
      ? Number(shift.expected_cash)
      : modal + tunaiBersih - stats.totalCashOut + stats.totalCashIn;

  L.push(garis);
  L.push("LACI KAS");
  L.push(baris("Modal awal", rp(modal)));
  L.push(baris("+ Penjualan tunai", rp(stats.cashSales)));
  if (stats.totalCashIn > 0) L.push(baris("+ Kas masuk", rp(stats.totalCashIn)));
  if (stats.totalCashOut > 0) L.push(baris("- Pengeluaran", rp(stats.totalCashOut)));
  if (refundTunai > 0) L.push(baris("- Refund tunai", rp(refundTunai)));
  L.push(baris("= Seharusnya", rp(seharusnya)));
  if (shift.closed_at && shift.closing_cash != null) {
    const selisih = Number(shift.variance ?? Number(shift.closing_cash) - seharusnya);
    L.push(baris("Dihitung", rp(Number(shift.closing_cash))));
    L.push(baris(selisih === 0 ? "SELISIH (PAS)" : selisih > 0 ? "SELISIH (LEBIH)" : "SELISIH (KURANG)", rp(selisih)));
  }

  const keluarMasuk = movements.filter((m) => Number(m.amount) > 0);
  if (keluarMasuk.length) {
    L.push(garis);
    L.push("KAS KELUAR / MASUK");
    for (const m of keluarMasuk) {
      const tanda = m.type === "cash_out" ? "-" : "+";
      L.push(baris(`${tanda} ${ascii(m.note || m.category || "").slice(0, 18)}`, rp(Number(m.amount))));
    }
  }

  const berdiskon = orders.filter((o) => Number(o.discount) > 0);
  if (berdiskon.length) {
    L.push(garis);
    L.push(baris(`Diskon ${berdiskon.length} nota`, rp(berdiskon.reduce((n, o) => n + Number(o.discount), 0))));
  }

  L.push(garisGanda);
  L.push(tengah(`Dicetak ${jamStruk((opsi.dicetakPada ?? new Date()).toISOString(), tz)}`));
  L.push(tengah("Paraf kasir:        Paraf owner:"));
  L.push("");
  L.push("");
  return L.join("\n") + "\n";
}
