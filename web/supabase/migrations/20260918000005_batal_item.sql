-- Membatalkan satu menu dari nota yang belum dibayar.
--
-- Kejadiannya biasa sekali di kafe: tamu memesan tiga hal, lalu satu di
-- antaranya dibatalkan sebelum dibuat. Sebelum ini kasir tidak punya jalan
-- untuk itu — yang ada cuma mengganti menunya, atau membatalkan SELURUH tiket.
--
-- KENAPA DIBATALKAN, BUKAN DIHAPUS
--
-- Menghapus barisnya kelihatan paling rapi, dan justru itu bahayanya. Kasir
-- yang bisa menghapus item dari nota belum lunas memegang alat pencurian yang
-- sempurna:
--
--   tamu memesan Mie Goreng Rp23.000, membayar tunai ke kasir
--   kasir menghapus barisnya
--   tidak ada jejak item itu pernah ada, uangnya masuk kantong,
--   dan laci tetap cocok — karena barisnya memang tidak pernah ikut dihitung
--
-- Ini kelas kecurangan yang sama persis dengan refund fiktif. Baris yang tetap
-- ada, bertanda batal, lengkap dengan alasan dan nama yang membatalkannya,
-- menutupnya tanpa menghalangi pembatalan yang jujur.
--
-- Yang batal juga bukan sampah, melainkan keterangan: menu apa yang paling
-- sering dibatalkan, meja mana, dan kasir mana yang jauh lebih sering
-- membatalkan daripada yang lain.

ALTER TABLE public.order_items
  ADD COLUMN IF NOT EXISTS cancelled_at TIMESTAMPTZ;

ALTER TABLE public.order_items
  ADD COLUMN IF NOT EXISTS cancelled_by UUID REFERENCES public.users(id) ON DELETE SET NULL;

ALTER TABLE public.order_items
  ADD COLUMN IF NOT EXISTS cancel_reason TEXT;

/*
 * Apa yang terjadi pada makanannya.
 *
 * Bukan basa-basi: kalau dapur sudah sempat membuatnya, bahannya sudah habis
 * walaupun uangnya tidak pernah masuk. Yang dibatalkan sebelum dibuat tidak
 * memakan apa pun. Tanpa dibedakan, kedua hal itu terbaca sama di laporan —
 * dan kerugian yang sesungguhnya jadi tidak kelihatan.
 */
ALTER TABLE public.order_items
  ADD COLUMN IF NOT EXISTS cancel_disposition TEXT;

ALTER TABLE public.order_items
  DROP CONSTRAINT IF EXISTS order_items_cancel_disposition_check;

ALTER TABLE public.order_items
  ADD CONSTRAINT order_items_cancel_disposition_check
  CHECK (
    cancel_disposition IS NULL
    OR cancel_disposition IN ('belum_dibuat', 'sudah_dibuat_dibuang', 'sudah_dibuat_disajikan')
  );

COMMENT ON COLUMN public.order_items.cancelled_at IS
  'Terisi berarti menu ini dibatalkan sebelum dibayar. Barisnya sengaja tidak dihapus: yang bisa dihapus diam-diam bisa dipakai menyembunyikan uang yang diterima.';

-- Laporan pembatalan selalu dibaca per rentang waktu, bukan per nota.
CREATE INDEX IF NOT EXISTS idx_order_items_dibatalkan
  ON public.order_items (cancelled_at DESC)
  WHERE cancelled_at IS NOT NULL;
