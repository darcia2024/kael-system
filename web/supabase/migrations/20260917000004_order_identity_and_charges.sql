-- Nama pemesan dari menu digital, dan penanda data uji.

-- ---------------------------------------------------------------------------
-- 1. Nama pemesan
-- ---------------------------------------------------------------------------
-- Layar menu digital MEWAJIBKAN pelanggan mengisi namanya, lalu memanggil
-- pembuatan pesanan tanpa membawa nama itu. Jadi nama yang diketik tamu cuma
-- hidup di browsernya sendiri, dan yang sampai ke kasir maupun dapur tetap
-- "Meja 4" tanpa satu pun keterangan siapa yang memesan.
--
-- Terpisah dari delivery_name: yang itu penerima kiriman, yang ini orang yang
-- memesan dari meja. Satu pesanan bisa punya keduanya.
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS customer_name TEXT;

COMMENT ON COLUMN public.orders.customer_name IS
  'Nama yang diketik pemesan di menu digital, dipakai kasir dan dapur memanggil orangnya. Berbeda dari delivery_name yang berarti penerima kiriman.';

-- ---------------------------------------------------------------------------
-- 2. Penanda transaksi uji coba
-- ---------------------------------------------------------------------------
-- "Hapus Data Testing" sebelumnya menjalankan:
--
--     DELETE FROM orders WHERE business_id = <tenant>
--
-- Tanpa satu pun saringan tentang apa itu "testing". Satu klik dari owner
-- menghapus SELURUH riwayat penjualan tokonya, beserta refund, rincian item,
-- dan poin pembelian pelanggannya. Tidak ada yang bisa dikembalikan setelahnya.
--
-- Kolom ini membuat "data uji" jadi sesuatu yang benar-benar ditandai, bukan
-- ditebak. Yang tidak bertanda tidak akan pernah ikut terhapus.
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS is_test BOOLEAN NOT NULL DEFAULT FALSE;

COMMENT ON COLUMN public.orders.is_test IS
  'Transaksi latihan, bukan penjualan sungguhan. HANYA baris bertanda ini yang boleh disentuh pembersihan massal.';

CREATE INDEX IF NOT EXISTS idx_orders_is_test
  ON public.orders (business_id)
  WHERE is_test;

-- Tenant peragaan boleh dibersihkan seluruhnya — seluruh isinya memang karangan
-- yang dibuat tim KAEL. Jadi pesanan miliknya ditandai uji sejak sekarang.
-- Tenant pelanggan sungguhan TIDAK disentuh: tidak ada satu pun barisnya yang
-- berubah oleh migrasi ini.
UPDATE public.orders o
SET is_test = TRUE
FROM public.businesses b
WHERE b.id = o.business_id AND b.is_demo = TRUE;
