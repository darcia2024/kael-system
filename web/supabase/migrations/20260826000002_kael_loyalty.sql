-- ==============================================================================
-- KAEL SYSTEM · 03 KAEL LOYALTY & REWARD CRM SCHEMA
-- Database: PostgreSQL (Supabase)
-- Multi-tenancy: Partitioned via business_id with Row Level Security (RLS)
-- PDP Compliance: UU No. 27/2022 (Data Protection, Consent & Access Control)
-- Ledger Architecture: Append-only immutable point transactions
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. UPDATE TABLE: customers (Add token for unguessable member URL m.kael.id/{token})
-- ------------------------------------------------------------------------------
ALTER TABLE public.customers 
ADD COLUMN IF NOT EXISTS token TEXT UNIQUE DEFAULT encode(gen_random_bytes(16), 'hex');

CREATE INDEX IF NOT EXISTS idx_customers_token ON public.customers(token);

-- ------------------------------------------------------------------------------
-- 2. TABLE: loyalty_programs (Aturan Program per Bisnis)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.loyalty_programs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
    mode TEXT NOT NULL DEFAULT 'point' CHECK (mode IN ('point', 'stamp')),
    earn_rate INT NOT NULL DEFAULT 10000 CHECK (earn_rate > 0), -- Rp per 1 poin
    stamp_per_visit INT NOT NULL DEFAULT 1 CHECK (stamp_per_visit > 0),
    point_expiry_months INT CHECK (point_expiry_months > 0), -- Null = tidak expired
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_business_loyalty_program UNIQUE (business_id)
);

COMMENT ON TABLE public.loyalty_programs IS 'Konfigurasi program loyalitas per bisnis: mode Poin (belanja) vs mode Stamp (kunjungan).';

-- ------------------------------------------------------------------------------
-- 3. TABLE: point_ledger (Append-only Immutable Transaction Log)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.point_ledger (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
    customer_id UUID NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
    delta INT NOT NULL, -- Positif untuk perolehan, negatif untuk penukaran/koreksi
    reason TEXT NOT NULL CHECK (reason IN ('purchase', 'redeem', 'birthday', 'manual', 'correction', 'expiry')),
    note TEXT,
    amount_spent BIGINT,
    created_by UUID NOT NULL REFERENCES public.users(id), -- Wajib ID kasir/staf untuk audit
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE public.point_ledger IS 'Buku besar transaksi poin/stamp append-only. Saldo dihitung dari SUM(delta). Tidak pernah diubah atau dihapus.';

-- ------------------------------------------------------------------------------
-- 4. TABLE: rewards (Katalog Voucher & Hadiah)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.rewards (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    point_cost INT NOT NULL CHECK (point_cost > 0),
    stock INT CHECK (stock >= 0), -- Null = tak terbatas
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE public.rewards IS 'Katalog reward penukaran poin/stamp pelanggan.';

-- ------------------------------------------------------------------------------
-- 5. TABLE: redemptions (Riwayat Penukaran Reward)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.redemptions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    customer_id UUID NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
    reward_id UUID NOT NULL REFERENCES public.rewards(id) ON DELETE CASCADE,
    code TEXT NOT NULL, -- 6-karakter kode verifikasi kasir
    status TEXT NOT NULL DEFAULT 'issued' CHECK (status IN ('issued', 'used', 'expired')),
    redeemed_by UUID REFERENCES public.users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    used_at TIMESTAMPTZ
);

COMMENT ON TABLE public.redemptions IS 'Log penukaran voucher reward yang divalidasi oleh kasir.';

-- ------------------------------------------------------------------------------
-- INDEXES
-- ------------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_loyalty_business ON public.loyalty_programs(business_id);
CREATE INDEX IF NOT EXISTS idx_ledger_customer ON public.point_ledger(customer_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ledger_business ON public.point_ledger(business_id);
CREATE INDEX IF NOT EXISTS idx_rewards_business ON public.rewards(business_id);
CREATE INDEX IF NOT EXISTS idx_redemptions_customer ON public.redemptions(customer_id);
CREATE INDEX IF NOT EXISTS idx_redemptions_code ON public.redemptions(code);

-- ------------------------------------------------------------------------------
-- ROW LEVEL SECURITY (RLS) POLICIES
-- Kepatuhan UU PDP No. 27/2022:
-- - Peran 'kael_admin' DILARANG mengakses data pelanggan.
-- - Pelanggan publik hanya bisa melihat data mereka sendiri via token rahasia m.kael.id/{token}.
-- - Kasir dan owner hanya bisa melihat data di bawah business_id mereka.
-- ------------------------------------------------------------------------------
ALTER TABLE public.loyalty_programs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.point_ledger ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rewards ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.redemptions ENABLE ROW LEVEL SECURITY;

-- Loyalty Program Policies
CREATE POLICY "Owner and Staff can view loyalty program"
ON public.loyalty_programs FOR SELECT
USING (business_id = public.get_auth_business_id());

CREATE POLICY "Owner can update loyalty program"
ON public.loyalty_programs FOR ALL
USING (business_id = public.get_auth_business_id() AND public.get_auth_user_role() = 'owner');

-- Point Ledger Policies (Staff & Owner)
CREATE POLICY "Business Staff and Owner can read and append ledger"
ON public.point_ledger FOR ALL
USING (business_id = public.get_auth_business_id());

-- Rewards Table Policies
-- CATATAN KEAMANAN
-- Policy baca publik dicabut. Dengan USING (true) daftar reward seluruh bisnis
-- terbaca oleh siapa pun yang memegang anon key. Halaman member dirender di
-- server, jadi akses anon tidak dibutuhkan.

CREATE POLICY "Owner can manage rewards"
ON public.rewards FOR ALL
USING (business_id = public.get_auth_business_id() AND public.get_auth_user_role() = 'owner');

-- Redemptions Table Policies
CREATE POLICY "Business Staff and Owner can manage redemptions"
ON public.redemptions FOR ALL
USING (
    EXISTS (
        SELECT 1 FROM public.customers
        WHERE customers.id = redemptions.customer_id
        AND customers.business_id = public.get_auth_business_id()
    )
);
