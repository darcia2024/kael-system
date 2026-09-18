-- Bayar di akhir: tamu makan dulu, uangnya diterima saat mau pulang.
--
-- KAEL selama ini menganggap satu pesanan = satu pembayaran. Itu benar untuk
-- gerai cepat saji, tapi tidak untuk kafe: satu meja bisa memesan empat kali
-- sepanjang dua jam, lalu membayar SEKALI di kasir saat pulang.
--
-- Karena itu yang dicatat di sini bukan pembayaran per nota, melainkan
-- pembayaran per KUNJUNGAN. Uang yang diterima, kembaliannya, caranya, siapa
-- yang menerimanya, dan kapan — semuanya milik satu peristiwa, bukan dipecah
-- ke empat nota lalu dijumlahkan ulang belakangan.
--
-- Nilai uang di tiap nota TIDAK berubah. Rekonsiliasi laci tetap menjumlahkan
-- `orders.total` seperti biasa, jadi laporan lama tidak perlu ditafsirkan ulang.

ALTER TABLE public.businesses
  ADD COLUMN IF NOT EXISTS pos_payment_timing TEXT NOT NULL DEFAULT 'di_depan';

COMMENT ON COLUMN public.businesses.pos_payment_timing IS
  'di_depan = kasir menerima uang saat pesanan dibuat. di_akhir = pesanan dicatat belum lunas, dan seluruh tagihan meja diselesaikan sekali saat tamunya pulang.';

ALTER TABLE public.businesses
  DROP CONSTRAINT IF EXISTS businesses_pos_payment_timing_check;

ALTER TABLE public.businesses
  ADD CONSTRAINT businesses_pos_payment_timing_check
  CHECK (pos_payment_timing IN ('di_depan', 'di_akhir'));

-- ---------------------------------------------------------------------------
-- Pembayaran satu kunjungan
-- ---------------------------------------------------------------------------

ALTER TABLE public.table_sessions
  ADD COLUMN IF NOT EXISTS dibayar_dengan TEXT;

/*
 * Uang yang benar-benar disodorkan tamu, dan kembaliannya.
 *
 * Disimpan di sini, bukan di salah satu nota. Pembayarannya satu peristiwa
 * untuk seluruh meja; menaruhnya di satu nota berarti tiga nota lain terlihat
 * dibayar nol rupiah, dan yang membaca laporannya kemudian akan menyimpulkan
 * hal yang salah.
 *
 * Rekonsiliasi laci tidak memakai kolom ini — yang dipakai tetap jumlah
 * `orders.total`. Ini untuk struk dan untuk ditelusuri, bukan untuk menghitung.
 */
ALTER TABLE public.table_sessions
  ADD COLUMN IF NOT EXISTS tunai_diterima BIGINT;

ALTER TABLE public.table_sessions
  ADD COLUMN IF NOT EXISTS kembalian BIGINT;

ALTER TABLE public.table_sessions
  ADD COLUMN IF NOT EXISTS dibayar_pada TIMESTAMPTZ;

/* Siapa yang menerima uangnya. Satu-satunya saksi bahwa uang itu masuk. */
ALTER TABLE public.table_sessions
  ADD COLUMN IF NOT EXISTS dibayar_oleh UUID REFERENCES public.users(id) ON DELETE SET NULL;

ALTER TABLE public.table_sessions
  DROP CONSTRAINT IF EXISTS table_sessions_dibayar_dengan_check;

ALTER TABLE public.table_sessions
  ADD CONSTRAINT table_sessions_dibayar_dengan_check
  CHECK (dibayar_dengan IS NULL OR dibayar_dengan IN ('cash', 'qris', 'transfer'));

COMMENT ON COLUMN public.table_sessions.dibayar_pada IS
  'Kapan seluruh tagihan meja ini diselesaikan. Kosong berarti tamunya masih duduk atau tagihannya belum dibayar.';
