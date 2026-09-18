import type { FakturPesanan } from "./types";

/**
 * Teks faktur WhatsApp.
 *
 * Satu fungsi, dua pemakai: modal di layar kasir (untuk pratinjau dan tombol
 * "buka di perangkat ini") dan rute /f/[token] (untuk pesan yang benar-benar
 * terkirim dari HP kasir). Kalau keduanya merakit teksnya sendiri-sendiri,
 * suatu hari pasti berbeda — dan kasir akan mengirim sesuatu yang tidak sama
 * dengan yang dia baca di layar.
 *
 * Murni dan tanpa impor server, supaya aman dipakai di peramban.
 */
export function teksFaktur(f: FakturPesanan, caraBayar = f.caraBayar.toUpperCase()): string {
  const rp = (n: number) => `Rp ${Math.round(n).toLocaleString("id-ID")}`;
  // Bintang dan garis bawah dibuang dari isian bebas: WhatsApp memakainya
  // sebagai penanda tebal/miring, dan satu bintang nyasar di nama menu merusak
  // seluruh sisa pesannya.
  const bersih = (t: string) => t.replace(/[*_~`]/g, "").trim();

  const baris = [`*${bersih(f.namaToko)}*`, `Faktur pesanan #${f.orderNo}`, ""];

  if (f.penerima.nama) baris.push(`Untuk: ${bersih(f.penerima.nama)}`);
  if (f.penerima.alamat) baris.push(`Alamat: ${bersih(f.penerima.alamat)}`);
  if (f.penerima.nama || f.penerima.alamat) baris.push("");

  for (const i of f.items) {
    baris.push(`${i.qty}x ${bersih(i.nama)} — ${rp(i.harga * i.qty)}`);
  }

  baris.push("", `Subtotal: ${rp(f.subtotal)}`);
  if (f.diskon > 0) baris.push(`Diskon: -${rp(f.diskon)}`);
  if (f.serviceCharge > 0) baris.push(`Service: ${rp(f.serviceCharge)}`);
  if (f.pajak > 0) baris.push(`Pajak: ${rp(f.pajak)}`);

  /**
   * Ongkir ditulis sebagai barisnya sendiri, tidak dilebur ke total.
   *
   * Pelanggan yang cuma melihat satu angka besar akan menghitung sendiri harga
   * menunya dan merasa ditagih lebih. Ongkir yang terlihat terpisah
   * menghentikan pertanyaan itu sebelum sempat muncul.
   */
  if (f.ongkir > 0) baris.push(`Ongkir: ${rp(f.ongkir)}`);

  baris.push("", `*TOTAL: ${rp(f.total)}*`, `Bayar: ${caraBayar}`, "", "Terima kasih 🙏");
  return baris.join("\n");
}

/** Tautan wa.me lengkap: nomor tujuan dan isi fakturnya sudah terisi. */
export function tautanWaFaktur(nomor: string, f: FakturPesanan): string {
  return `https://wa.me/${nomor}?text=${encodeURIComponent(teksFaktur(f))}`;
}
