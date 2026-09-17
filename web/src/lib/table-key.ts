/**
 * Bentuk baku nomor meja.
 *
 * "Meja 1", "meja 01", " 1 ", dan "01" semuanya menunjuk meja yang sama. Yang
 * mengetiknya bukan satu orang: kasir mengetik "1", tautan QR meja membawa
 * "Meja 1", dan daftar meja bawaan memakai "01". Tanpa satu bentuk baku,
 * pesanan dari tiga sumber itu jatuh ke tiga kelompok berbeda dan tagihan satu
 * meja tidak pernah utuh.
 *
 * Versi sebelumnya ada di dalam komponen denah meja dan polanya keliru: yang
 * dicari "meja" diikuti nol atau lebih huruf "s", bukan "meja" diikuti spasi.
 * Jadi "Meja 1" berubah jadi " 1" beserta spasinya, gagal dikenali sebagai
 * angka, dan berakhir di kelompok sendiri yang tidak pernah bertemu "01".
 *
 * Harus sama persis dengan versi SQL di migrasi 20260917000002. Kalau yang satu
 * diubah, yang satunya ikut.
 */
export function normalizeTableKey(raw: string | null | undefined): string {
  if (!raw) return "";
  const tanpaAwalan = raw.trim().toLowerCase().replace(/^meja\s*/, "").trim();
  if (/^\d{1,2}$/.test(tanpaAwalan)) return tanpaAwalan.padStart(2, "0");
  return tanpaAwalan.replace(/\s+/g, " ");
}

/**
 * Label meja untuk ditampilkan, dari nomor apa adanya yang tersimpan.
 *
 * Yang tersimpan dipertahankan apa adanya kalau sudah menyebut dirinya sendiri
 * ("Lesehan 1", "Bar"). Nomor polos diberi awalan supaya layar kasir tidak
 * cuma menampilkan angka tanpa keterangan.
 */
export function tableDisplayName(raw: string | null | undefined): string {
  if (!raw?.trim()) return "Tanpa Meja";
  const bersih = raw.trim();
  if (/^\d{1,2}$/.test(bersih)) return `Meja ${bersih.padStart(2, "0")}`;
  if (/^meja\s/i.test(bersih)) return bersih;
  return bersih;
}
