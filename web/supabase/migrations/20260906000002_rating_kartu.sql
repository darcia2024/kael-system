-- Rating dari tap kartu, bukan cuma dari struk.
--
-- Sampai sekarang member_feedback selalu menunjuk sebuah pesanan: pintunya
-- satu-satunya adalah halaman struk, yang baru ada setelah orangnya bertransaksi
-- di kasir. Kartu NFC di meja tidak punya pesanan. Orang yang kecewa dan mau
-- bilang sesuatu juga belum tentu pernah sampai ke kasir.
--
-- Jadi order_id turun dari WAJIB menjadi salah satu dari dua asal yang sah,
-- dan card_id menjadi yang satunya. Bentuk lamanya tidak hilang: baris yang
-- sudah ada tetap menunjuk pesanannya, dan aturan "satu pesanan satu feedback"
-- tetap berlaku persis seperti sebelumnya.

DO $$
BEGIN
  -- 1. order_id boleh kosong, tapi hanya kalau asalnya kartu.
  ALTER TABLE public.member_feedback ALTER COLUMN order_id DROP NOT NULL;

  -- 2. Asal yang kedua.
  ALTER TABLE public.member_feedback
    ADD COLUMN IF NOT EXISTS card_id UUID REFERENCES public.cards(id) ON DELETE SET NULL;

  /*
   * 3. UNIQUE(order_id) diganti indeks parsial.
   *
   * Di Postgres, UNIQUE memperlakukan setiap NULL sebagai nilai yang berbeda,
   * jadi constraint lamanya sebenarnya sudah mengizinkan banyak baris tanpa
   * pesanan. Tetap diganti supaya maksudnya tertulis, bukan tergantung pada
   * satu kehalusan Postgres yang mudah dikira bug oleh orang berikutnya.
   */
  ALTER TABLE public.member_feedback DROP CONSTRAINT IF EXISTS uq_feedback_per_order;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS uq_feedback_per_order
  ON public.member_feedback (order_id) WHERE order_id IS NOT NULL;

-- 4. Satu baris harus punya asal. Tanpa ini, feedback bisa masuk tanpa bisa
--    ditelusuri ke pesanan maupun kartu mana pun, dan owner tidak punya cara
--    tahu itu datang dari mana.
DO $$
BEGIN
  ALTER TABLE public.member_feedback DROP CONSTRAINT IF EXISTS ck_feedback_asal;
  ALTER TABLE public.member_feedback
    ADD CONSTRAINT ck_feedback_asal
    CHECK (order_id IS NOT NULL OR card_id IS NOT NULL);
END $$;

CREATE INDEX IF NOT EXISTS idx_member_feedback_card
  ON public.member_feedback (card_id, created_at DESC) WHERE card_id IS NOT NULL;

COMMENT ON TABLE public.member_feedback IS
  'Rating dan alasan singkat. Asalnya halaman struk (order_id) atau tap kartu NFC (card_id); salah satu wajib ada.';
COMMENT ON COLUMN public.member_feedback.card_id IS
  'Kartu yang ditap untuk memberi rating ini. NULL kalau feedback datang dari halaman struk.';

/*
 * Pembatas laju halaman rating publik.
 *
 * Halaman /nilai/[kode] terbuka tanpa login, seperti halaman pendaftaran
 * member — dan seperti halaman itu, tanpa batas siapa pun bisa mengarang
 * ratusan bintang satu untuk sebuah kafe. Polanya sengaja dibuat sama persis
 * dengan loyalty_registration_attempts supaya cuma ada satu cara berpikir
 * tentang pembatasan di basis kode ini.
 *
 * Yang disimpan hash IP, bukan IP. Cukup untuk menghitung, tidak cukup untuk
 * mengenali orangnya.
 */
CREATE TABLE IF NOT EXISTS public.feedback_attempts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
    ip_hash TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_feedback_attempts_lookup
    ON public.feedback_attempts (business_id, ip_hash, created_at DESC);

ALTER TABLE public.feedback_attempts ENABLE ROW LEVEL SECURITY;
