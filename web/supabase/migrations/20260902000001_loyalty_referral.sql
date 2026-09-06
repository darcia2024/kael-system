-- Referral member: member ajak teman, teman daftar dan belanja, keduanya
-- dapat poin. Bonus pengajak cair saat teman BELANJA PERTAMA KALI, bukan
-- saat mendaftar — mendaftar gratis dan bisa dipalsukan berkali-kali, belanja
-- yang tercatat di ledger tidak.
--
-- loyalty_codes dirancang generik, bukan referral_codes. Ulang tahun dan
-- campaign promo (dua modul berikutnya di roadmap) juga akan menerbitkan
-- kode ke tabel yang sama lewat `source`, supaya KAEL punya satu mesin
-- pelacakan kode, bukan tiga yang terpisah dan tidak bisa dibandingkan.

CREATE TABLE IF NOT EXISTS public.loyalty_codes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
    code TEXT NOT NULL,
    source TEXT NOT NULL CHECK (source IN ('referral', 'birthday', 'campaign', 'manual')),
    -- Pemilik kode. Untuk referral: member yang mengajak. NULL untuk sumber
    -- yang tidak dimiliki satu member tertentu (mis. kode campaign massal).
    owner_customer_id UUID REFERENCES public.customers(id) ON DELETE CASCADE,
    reward_points INT NOT NULL DEFAULT 0,
    max_uses INT,
    valid_until TIMESTAMPTZ,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_business_loyalty_code UNIQUE (business_id, code)
);

COMMENT ON TABLE public.loyalty_codes IS 'Mesin kode bersama. Referral, ulang tahun, dan campaign promo menerbitkan kode ke sini, dibedakan lewat source.';

CREATE TABLE IF NOT EXISTS public.loyalty_code_uses (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    code_id UUID NOT NULL REFERENCES public.loyalty_codes(id) ON DELETE CASCADE,
    business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
    customer_id UUID NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    -- Satu kode cuma bisa dipakai sekali oleh member yang sama. Ini aturan
    -- database, bukan aturan layar — aturan layar bisa dilewati.
    CONSTRAINT uq_loyalty_code_use_per_customer UNIQUE (code_id, customer_id)
);

CREATE INDEX IF NOT EXISTS idx_loyalty_codes_business ON public.loyalty_codes(business_id);
CREATE INDEX IF NOT EXISTS idx_loyalty_codes_owner ON public.loyalty_codes(owner_customer_id);
CREATE INDEX IF NOT EXISTS idx_loyalty_code_uses_code ON public.loyalty_code_uses(code_id);
CREATE INDEX IF NOT EXISTS idx_loyalty_code_uses_customer ON public.loyalty_code_uses(customer_id);

-- ------------------------------------------------------------------------------
-- Siapa mengajak siapa, dan apakah bonus pengajaknya sudah cair.
-- ------------------------------------------------------------------------------
ALTER TABLE public.customers
    ADD COLUMN IF NOT EXISTS referred_by UUID REFERENCES public.customers(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS referral_rewarded_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_customers_referred_by ON public.customers(referred_by);

-- CHECK lama pada point_ledger.reason belum kenal 'referral'.
ALTER TABLE public.point_ledger DROP CONSTRAINT IF EXISTS point_ledger_reason_check;
ALTER TABLE public.point_ledger ADD CONSTRAINT point_ledger_reason_check
    CHECK (reason IN ('purchase', 'redeem', 'birthday', 'manual', 'correction', 'expiry', 'referral'));

-- ------------------------------------------------------------------------------
-- Aturan program referral. Defaultnya MATI (referral_is_active = FALSE):
-- fitur ini menulis poin sungguhan, dan tidak boleh menyala diam-diam untuk
-- bisnis yang belum sempat mengatur nilainya sendiri.
-- ------------------------------------------------------------------------------
ALTER TABLE public.loyalty_programs
    ADD COLUMN IF NOT EXISTS referral_is_active BOOLEAN NOT NULL DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS referral_referrer_points INT NOT NULL DEFAULT 0 CHECK (referral_referrer_points >= 0),
    ADD COLUMN IF NOT EXISTS referral_referee_points INT NOT NULL DEFAULT 0 CHECK (referral_referee_points >= 0),
    -- Batas wajar per bulan per pengajak. Tanpa ini satu nomor yang bisa
    -- mendaftarkan banyak "teman" bisa memanen poin tanpa batas.
    ADD COLUMN IF NOT EXISTS referral_monthly_cap INT NOT NULL DEFAULT 10 CHECK (referral_monthly_cap > 0);

ALTER TABLE public.loyalty_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.loyalty_code_uses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Business staff and owner can manage loyalty codes"
ON public.loyalty_codes FOR ALL
USING (business_id = public.get_auth_business_id());

CREATE POLICY "Business staff and owner can manage code uses"
ON public.loyalty_code_uses FOR ALL
USING (business_id = public.get_auth_business_id());
