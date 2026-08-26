-- ==============================================================================
-- Kode toko
--
-- Layar login sebelumnya menampilkan daftar SEMUA bisnis yang memakai KAEL,
-- dan daftar itu bisa diambil tanpa login sama sekali. Akibatnya:
--   1. Daftar pelanggan KAEL terbuka untuk siapa pun di internet.
--   2. Satu UMKM bisa melihat pesaingnya juga memakai KAEL.
--   3. Nama staf toko lain ikut terbaca.
--
-- Penggantinya: tiap bisnis punya kode pendek. Staf memasukkan kodenya sekali
-- di perangkat kasir, lalu perangkat itu mengingatnya. Tidak ada lagi cara
-- membuat daftar: mengetahui satu kode hanya membuka satu toko.
-- ==============================================================================

ALTER TABLE public.businesses ADD COLUMN IF NOT EXISTS store_code TEXT;

-- Kode diisi manual untuk bisnis yang sudah ada (lihat scripts/store-code.mjs).
CREATE UNIQUE INDEX IF NOT EXISTS uq_businesses_store_code
  ON public.businesses (upper(store_code))
  WHERE store_code IS NOT NULL;

COMMENT ON COLUMN public.businesses.store_code IS
  'Kode pendek yang diberikan ke pemilik usaha untuk login staf. Tidak pernah dipakai untuk mendaftar bisnis lain.';
