-- QRIS merchant.
--
-- Menyimpan payload QRIS STATIS milik usaha, apa adanya. Saat kasir menutup
-- transaksi, payload ini disalin dan diberi satu tag berisi nominal belanja,
-- lalu digambar ulang jadi QR di layar. Pelanggan tidak perlu mengetik angka,
-- dan salah ketik nominal — kesalahan paling mahal di kasir — hilang.
--
-- KAEL tidak pernah berada di jalur dana. Yang disimpan di sini adalah kode
-- yang memang dicetak merchant dan ditempel di mejanya untuk dilihat umum,
-- bukan kredensial. Dana mengalir langsung dari pelanggan ke rekening merchant
-- lewat penyelenggara yang menerbitkan QRIS-nya.

ALTER TABLE public.businesses
  ADD COLUMN IF NOT EXISTS qris_payload TEXT,
  ADD COLUMN IF NOT EXISTS qris_merchant_name TEXT,
  ADD COLUMN IF NOT EXISTS qris_merchant_city TEXT,
  ADD COLUMN IF NOT EXISTS qris_nmid TEXT,
  ADD COLUMN IF NOT EXISTS qris_uploaded_at TIMESTAMPTZ;

COMMENT ON COLUMN public.businesses.qris_payload IS
  'Payload EMVCo QRIS statis milik merchant, apa adanya. NULL berarti belum diunggah dan kasir jatuh kembali ke QRIS statis cetak.';

COMMENT ON COLUMN public.businesses.qris_merchant_name IS
  'Nama merchant hasil baca tag 59. Ditampilkan ke pemilik usaha untuk memastikan yang diunggah benar QRIS miliknya, bukan milik toko sebelah.';

COMMENT ON COLUMN public.businesses.qris_nmid IS
  'National Merchant ID hasil baca tag 51/26 sub-02. Dipakai pemilik usaha mencocokkan dengan yang tertera di QRIS cetaknya.';
