-- Ulang tahun & anniversary member. Dibangun di atas mesin campaign yang
-- sudah ada (loyalty_campaigns): dua segmen baru, bukan sistem terpisah.
-- Anniversary (created_at member) tidak punya bonus poin dan tidak punya
-- saklar aktif — dia selalu tersedia sebagai pesan ucapan, tanpa biaya poin
-- yang perlu diatur owner. Ulang tahun beda: dia bisa membawa bonus poin
-- sungguhan, jadi butuh saklar sendiri yang defaultnya MATI.

ALTER TABLE public.loyalty_campaigns DROP CONSTRAINT IF EXISTS loyalty_campaigns_segment_check;
ALTER TABLE public.loyalty_campaigns ADD CONSTRAINT loyalty_campaigns_segment_check
    CHECK (segment IN ('new', 'active', 'at_risk', 'inactive', 'birthday', 'anniversary'));

-- Pencocokan bulan/tanggal ulang tahun dilakukan di kode (TS), bukan di SQL —
-- sama seperti point-expiry.ts. Indeks ini cuma mempersempit baris yang perlu
-- ditarik: member dengan tanggal lahir terisi DAN sudah setuju promo.
CREATE INDEX IF NOT EXISTS idx_customers_birthday_optin
    ON public.customers (business_id)
    WHERE birthday IS NOT NULL AND marketing_opt_in = TRUE;

ALTER TABLE public.loyalty_programs
    ADD COLUMN IF NOT EXISTS birthday_is_active BOOLEAN NOT NULL DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS birthday_bonus_points INT NOT NULL DEFAULT 0 CHECK (birthday_bonus_points >= 0),
    -- Dipakai bareng untuk jendela deteksi ulang tahun MAUPUN anniversary.
    -- Menambah kolom kedua untuk anniversary saja tidak sepadan dengan
    -- manfaatnya di v1 — keduanya sama-sama "berapa hari ke depan dicek".
    ADD COLUMN IF NOT EXISTS birthday_window_days INT NOT NULL DEFAULT 7 CHECK (birthday_window_days BETWEEN 1 AND 30);
