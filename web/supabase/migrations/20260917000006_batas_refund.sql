-- Pembatas pengembalian dana.
--
-- KENAPA MENCOCOKKAN LACI TIDAK MENANGKAP APA-APA
--
-- Penipuan yang paling sering terjadi di kasir mana pun: pelanggan membayar
-- tunai, kasir mencatatnya sebagai refund, lalu uangnya masuk kantong sendiri.
-- Rekonsiliasi laci TIDAK melihatnya, dan itu bukan kelemahan hitungannya:
--
--     pelanggan bayar 100.000 tunai  -> laci diharapkan +100.000
--     dicatat refund 100.000 tunai   -> laci diharapkan       0
--     uangnya diambil kasir          -> laci fisik            0
--                                       selisih = 0, "PAS"
--
-- Lacinya cocok sempurna. Yang bisa menangkapnya cuma tiga hal: pemiliknya
-- tahu saat itu juga, jumlahnya dibatasi, dan polanya terlihat.
--
-- Tidak ada satu pun dari ini yang membuat kecurangan mustahil — kasir memegang
-- uang fisiknya sekaligus entrinya. Yang bisa dilakukan perangkat lunak adalah
-- membuatnya terlihat, terbatas, dan selalu bernama.

-- Batas satu kali refund. 0 berarti tanpa batas.
ALTER TABLE public.businesses
  ADD COLUMN IF NOT EXISTS refund_max_per_transaction BIGINT NOT NULL DEFAULT 0
    CHECK (refund_max_per_transaction >= 0);

-- Batas total refund per kasir per hari. 0 berarti tanpa batas.
ALTER TABLE public.businesses
  ADD COLUMN IF NOT EXISTS refund_daily_limit_per_cashier BIGINT NOT NULL DEFAULT 0
    CHECK (refund_daily_limit_per_cashier >= 0);

COMMENT ON COLUMN public.businesses.refund_max_per_transaction IS
  'Batas nominal satu kali pengembalian dana oleh staf. 0 = tanpa batas. Melewatinya harus dilakukan owner.';

COMMENT ON COLUMN public.businesses.refund_daily_limit_per_cashier IS
  'Batas total pengembalian dana seorang kasir dalam satu hari. 0 = tanpa batas. Membatasi kerugian sebelum polanya sempat terbaca.';

-- Pencarian refund per kasir per hari dipakai tiap kali tombol refund ditekan,
-- jadi jalurnya dibuatkan indeks sendiri.
CREATE INDEX IF NOT EXISTS idx_refunds_approved_by_created
  ON public.refunds (approved_by, created_at DESC);
