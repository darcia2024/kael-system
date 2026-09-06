-- Level member: Basic, Silver, Gold. Level DIHITUNG dari lifetime_spend,
-- sama seperti saldo poin dihitung dari SUM(delta) — bukan kolom tersimpan
-- di customers yang bisa tertinggal dari transaksi sebenarnya.
--
-- Tidak ada kolom "turun level". v1 sengaja begitu: menurunkan level member
-- adalah percakapan yang harus dilayani owner sendiri di depan kasir sambil
-- antre, dan itu tidak sepadan untuk versi pertama.

CREATE TABLE IF NOT EXISTS public.loyalty_tiers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
    name TEXT NOT NULL CHECK (char_length(name) BETWEEN 1 AND 40),
    min_lifetime_spend BIGINT NOT NULL DEFAULT 0 CHECK (min_lifetime_spend >= 0),
    earn_multiplier NUMERIC(3, 2) NOT NULL DEFAULT 1.00 CHECK (earn_multiplier BETWEEN 1.00 AND 5.00),
    benefit_note TEXT CHECK (char_length(benefit_note) <= 200),
    sort_order INT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_business_tier_name UNIQUE (business_id, name)
);

COMMENT ON TABLE public.loyalty_tiers IS 'Level member per bisnis. Level dihitung saat baca dari lifetime_spend, tidak pernah disimpan di baris customers.';

CREATE INDEX IF NOT EXISTS idx_loyalty_tiers_business ON public.loyalty_tiers (business_id, sort_order);

ALTER TABLE public.loyalty_programs
    ADD COLUMN IF NOT EXISTS tiers_is_active BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE public.loyalty_tiers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owner can manage loyalty tiers"
ON public.loyalty_tiers FOR ALL
USING (business_id = public.get_auth_business_id() AND public.get_auth_user_role() = 'owner');
