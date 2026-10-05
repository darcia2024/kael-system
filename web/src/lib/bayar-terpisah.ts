import { calculateCartTotals } from "./pos-engine";

/**
 * Hitungan bayar terpisah: satu tamu membayar menu miliknya sendiri dari
 * tagihan meja yang belum lunas.
 *
 * Dipakai DUA tempat dengan angka yang sama persis: layar kasir, untuk
 * menunjukkan berapa yang harus ditagih, dan server, untuk mencatatnya. Kalau
 * keduanya menghitung sendiri-sendiri, tamu bisa ditagih Rp 45.500 di layar
 * tapi tercatat Rp 45.000 — dan selisih itu muncul di laci saat tutup shift.
 *
 * Aturannya:
 * - Pajak dan service charge dihitung ulang dari menu bagian itu, dengan tarif
 *   toko — sama seperti nota baru. Sisa nota asalnya juga dihitung ulang.
 * - Diskon nota asal ikut terbagi sebanding nilai menu yang dipindah. Menu
 *   senilai separuh nota membawa separuh diskonnya.
 * - Ongkir tidak pernah ikut dipindah; pesanan meja memang tidak punya ongkir.
 */

export interface NotaBayarTerpisah {
  id: string;
  discount: number;
  deliveryFee: number;
  /** Menu yang masih aktif (tidak dibatalkan). */
  items: { id: string; price: number; qty: number }[];
}

export interface PilihanBayarTerpisah {
  itemId: string;
  qty: number;
}

export interface RincianUang {
  subtotal: number;
  discount: number;
  tax: number;
  serviceCharge: number;
  total: number;
}

export type HasilBayarTerpisah =
  | { ok: false; error: string }
  | {
      ok: true;
      /** Yang dibayar tamu ini. */
      bagian: RincianUang;
      /** Sisa tiap nota asal yang tersentuh. `kosong` berarti semua menunya ikut pindah. */
      sisa: Map<string, RincianUang & { kosong: boolean }>;
      /** Diskon yang ikut pindah, per nota asal. */
      diskonPindah: Map<string, number>;
      /** Pilihannya mencakup SELURUH sisa meja — itu bukan bayar terpisah, itu lunas meja. */
      semuaTerpilih: boolean;
    };

const NOL: RincianUang = { subtotal: 0, discount: 0, tax: 0, serviceCharge: 0, total: 0 };

export function hitungBayarTerpisah(
  nota: NotaBayarTerpisah[],
  pilihan: PilihanBayarTerpisah[],
  taxRatePct: number,
  serviceRatePct: number,
): HasilBayarTerpisah {
  if (!pilihan.length) return { ok: false, error: "Pilih dulu menu yang dibayar tamu ini." };

  const itemKe = new Map<string, { notaId: string; price: number; qty: number }>();
  for (const n of nota) {
    for (const i of n.items) itemKe.set(i.id, { notaId: n.id, price: i.price, qty: i.qty });
  }

  const jumlahDipilih = new Map<string, number>();
  for (const p of pilihan) {
    const item = itemKe.get(p.itemId);
    if (!item) {
      return { ok: false, error: "Ada menu yang sudah tidak ada di tagihan meja. Tutup lalu buka lagi." };
    }
    if (jumlahDipilih.has(p.itemId)) return { ok: false, error: "Ada menu yang terpilih dua kali." };
    if (!Number.isInteger(p.qty) || p.qty < 1 || p.qty > item.qty) {
      return { ok: false, error: "Jumlah menu yang dipilih tidak sesuai pesanan." };
    }
    jumlahDipilih.set(p.itemId, p.qty);
  }

  const terpilih: { price: number; qty: number }[] = [];
  const sisa = new Map<string, RincianUang & { kosong: boolean }>();
  const diskonPindah = new Map<string, number>();
  let diskonBagian = 0;

  for (const n of nota) {
    const disentuh = n.items.some((i) => jumlahDipilih.has(i.id));
    if (!disentuh) continue;
    if (n.deliveryFee > 0) {
      return { ok: false, error: "Nota antar tidak bisa dibayar terpisah." };
    }

    const nilaiSemua = n.items.reduce((s, i) => s + i.price * i.qty, 0);
    let nilaiPindah = 0;
    const tinggal: { price: number; qty: number }[] = [];
    for (const i of n.items) {
      const ambil = jumlahDipilih.get(i.id) ?? 0;
      if (ambil > 0) terpilih.push({ price: i.price, qty: ambil });
      nilaiPindah += i.price * ambil;
      if (i.qty - ambil > 0) tinggal.push({ price: i.price, qty: i.qty - ambil });
    }

    const diskon = Math.max(0, n.discount);
    const pindah = !tinggal.length
      ? diskon
      : nilaiSemua > 0
        ? Math.round((diskon * nilaiPindah) / nilaiSemua)
        : 0;
    diskonPindah.set(n.id, pindah);
    diskonBagian += pindah;

    sisa.set(
      n.id,
      tinggal.length
        ? { ...calculateCartTotals(tinggal, diskon - pindah, taxRatePct, serviceRatePct), kosong: false }
        : { ...NOL, kosong: true },
    );
  }

  const bagian = calculateCartTotals(terpilih, diskonBagian, taxRatePct, serviceRatePct);

  const semuaTerpilih = nota.every((n) => n.items.every((i) => (jumlahDipilih.get(i.id) ?? 0) === i.qty));

  return { ok: true, bagian, sisa, diskonPindah, semuaTerpilih };
}
