-- Satu kali tekan "Simpan Pesanan" = satu nota, walau permintaannya sampai dua kali.
--
-- Kejadian nyatanya di Mochi: dua nota IDENTIK di Meja 14 (menu sama, total
-- Rp80.000 sama), dicatat berselang 0,4 detik. Itu bukan dua pesanan, itu satu
-- tombol yang tertekan dua kali sebelum layarnya sempat berubah — dan tamunya
-- bisa ditagih dua kali lipat.
--
-- Penyebabnya dua, dan keduanya nyata di lapangan:
--
--   1. Dobel-tap. Kasir menekan tombol, jaringan HP lambat, layar belum
--      berganti, jadi ditekan lagi. Ini ditutup di layar kasir.
--
--   2. Jaringan putus SESUDAH server mencatat tapi SEBELUM jawabannya sampai.
--      Kasir melihat layar menggantung, menekan lagi, dan server — yang tidak
--      tahu ini permintaan yang sama — mencatat nota kedua. Layar tidak bisa
--      menutup yang ini sama sekali; hanya server yang bisa.
--
-- Kuncinya dibuat sekali per keranjang di layar kasir, dan dikirim bersama
-- pesanannya. Permintaan kedua dengan kunci yang sama dijawab dengan nota yang
-- sudah ada, bukan dibuatkan nota baru.
--
-- Nullable dan partial: nota lama dan nota dari jalur lain (QR meja, impor)
-- tidak punya kunci, dan tidak boleh ikut terhalang aturan ini.

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS idempotency_key TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS idx_orders_idempotency
  ON public.orders (business_id, idempotency_key)
  WHERE idempotency_key IS NOT NULL;

COMMENT ON COLUMN public.orders.idempotency_key IS
  'Kunci per-keranjang dari layar kasir. Permintaan ulang dengan kunci yang sama mengembalikan nota yang sudah ada, bukan membuat nota baru.';
