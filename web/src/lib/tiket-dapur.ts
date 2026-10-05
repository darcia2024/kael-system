import { barisKosong, gabung, rataKiri, rataTengah, tebal, teks, terbalik, ukuranHuruf } from "./escpos";
import { jamStruk } from "./pos-engine";

/**
 * Tiket dapur.
 *
 * Bentuknya sengaja tidak mirip struk pelanggan, supaya di tumpukan kertas
 * dapur tidak pernah tertukar: kepala hitam bertuliskan DAPUR, nomor meja
 * besar yang terbaca dari jarak satu lengan, nama menu setinggi dua baris,
 * tanpa logo dan tanpa harga. Yang dibutuhkan koki cuma tiga hal — untuk meja
 * mana, apa saja, dan catatannya.
 *
 * Pesanan kedua dan seterusnya dari meja yang sama diberi tanda PESANAN
 * TAMBAHAN. Tanpa itu, dapur yang melihat "MEJA 03" dua kali mengira tiket
 * pertama tercetak ulang, dan tambahannya tidak dimasak.
 */
export interface DataTiketDapur {
  orderNo: string;
  tableNo?: string | null;
  serviceType: "dine_in" | "takeaway" | "delivery";
  createdAt: string;
  timezone?: string;
  cashierName?: string | null;
  /** Nama yang diketik tamu di menu digital, kalau ada. */
  customerName?: string | null;
  items: { name: string; qty: number; note?: string | null }[];
  /** Pesanan kedua dan seterusnya dari kunjungan meja yang sama. */
  tambahan?: boolean;
}

const LEBAR = 32;

/**
 * Printer thermal membaca huruf satu bait (CP437), bukan UTF-8. Huruf di luar
 * ASCII — é, tanda kutip miring, emoji — tercetak sebagai sampah yang bisa
 * mengaburkan nama menu, jadi dibuang di sini.
 */
function ascii(s: string): string {
  return s
    .normalize("NFKD")
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/[–—]/g, "-")
    .replace(/[^\x20-\x7E]/g, "")
    .trim();
}

/** Memecah teks per kata supaya tidak terpotong di tengah kata. */
function bungkus(isi: string, lebar: number): string[] {
  const kata = isi.split(/\s+/).filter(Boolean);
  const baris: string[] = [];
  let kini = "";
  for (const k of kata) {
    const potongan = k.length > lebar ? k.match(new RegExp(`.{1,${lebar}}`, "g")) ?? [k] : [k];
    for (const p of potongan) {
      if (!kini) kini = p;
      else if (kini.length + 1 + p.length <= lebar) kini += ` ${p}`;
      else {
        baris.push(kini);
        kini = p;
      }
    }
  }
  if (kini) baris.push(kini);
  return baris.length ? baris : [""];
}

function tempat(d: DataTiketDapur): string {
  if (d.serviceType === "takeaway") return "BUNGKUS";
  if (d.serviceType === "delivery") return "ANTAR";
  return `MEJA ${ascii(d.tableNo || "-").toUpperCase()}`;
}

function barisInfo(d: DataTiketDapur): string {
  const bagian = [`#${d.orderNo}`, jamStruk(d.createdAt, d.timezone)];
  if (d.cashierName) bagian.push(ascii(d.cashierName).slice(0, 12));
  return bagian.join("  ");
}

const tengah = (s: string, lebar = LEBAR) =>
  " ".repeat(Math.max(0, Math.floor((lebar - s.length) / 2))) + s;

/**
 * Versi teks polos. Dipakai saat Bluetooth tidak tersedia dan tiket dicetak
 * lewat dialog cetak peramban, dan untuk pengujian.
 */
export function tiketDapurTeks(d: DataTiketDapur): string {
  const baris: string[] = [];
  baris.push("#".repeat(LEBAR));
  baris.push(tengah("D A P U R"));
  baris.push("#".repeat(LEBAR));
  baris.push(tengah(`>>> ${tempat(d)} <<<`));
  if (d.tambahan) baris.push(tengah("** PESANAN TAMBAHAN **"));
  baris.push(tengah(barisInfo(d)));
  if (d.customerName) baris.push(tengah(`a.n. ${ascii(d.customerName).slice(0, 24)}`));
  baris.push("-".repeat(LEBAR));
  for (const item of d.items) {
    baris.push(...bungkus(`${item.qty}x ${ascii(item.name).toUpperCase()}`, LEBAR));
    if (item.note) {
      for (const b of bungkus(ascii(item.note), LEBAR - 5)) baris.push(`   > ${b}`);
    }
  }
  baris.push("-".repeat(LEBAR));
  const jumlah = d.items.reduce((n, i) => n + i.qty, 0);
  baris.push(tengah(`${jumlah} item`));
  return baris.join("\n") + "\n";
}

/** Versi ESC/POS: kepala terbalik, meja dan menu berhuruf besar. */
export function tiketDapurEscPos(d: DataTiketDapur): Uint8Array {
  const potongan: Uint8Array[] = [];
  const garis = () => potongan.push(rataKiri(), teks(`${"-".repeat(LEBAR)}\n`));

  // Kepala hitam: pembeda paling cepat dari struk pelanggan.
  potongan.push(
    rataTengah(),
    tebal(true),
    terbalik(true),
    ukuranHuruf(2, 1),
    teks(" DAPUR \n"),
    ukuranHuruf(1, 1),
    terbalik(false),
  );

  // Nomor meja: lebar dan tinggi ganda.
  potongan.push(barisKosong(1), ukuranHuruf(2, 2), teks(`${tempat(d)}\n`), ukuranHuruf(1, 1));
  if (d.tambahan) potongan.push(teks("** PESANAN TAMBAHAN **\n"));
  potongan.push(tebal(false), teks(`${barisInfo(d)}\n`));
  if (d.customerName) potongan.push(teks(`a.n. ${ascii(d.customerName).slice(0, 24)}\n`));
  garis();

  // Menu: tinggi ganda dan tebal, catatan di bawahnya dengan huruf biasa.
  for (const item of d.items) {
    potongan.push(rataKiri(), tebal(true), ukuranHuruf(1, 2));
    for (const b of bungkus(`${item.qty}x ${ascii(item.name).toUpperCase()}`, LEBAR)) {
      potongan.push(teks(`${b}\n`));
    }
    potongan.push(ukuranHuruf(1, 1), tebal(false));
    if (item.note) {
      for (const b of bungkus(ascii(item.note), LEBAR - 5)) potongan.push(teks(`   > ${b}\n`));
    }
  }

  garis();
  const jumlah = d.items.reduce((n, i) => n + i.qty, 0);
  potongan.push(rataTengah(), teks(`${jumlah} item\n`), rataKiri());
  return gabung(...potongan);
}
