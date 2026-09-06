-- Template campaign + kode promo. Owner pilih tujuan siap pakai, KAEL cetak
-- satu kode per campaign lewat mesin loyalty_codes yang sudah berdiri sejak
-- referral (Fitur 1) — bukan sistem pelacakan baru, cuma sumber baru.

ALTER TABLE public.loyalty_campaigns
    ADD COLUMN IF NOT EXISTS goal TEXT CHECK (goal IN (
        'member_baru', 'kembali_lagi', 'naikkan_frekuensi', 'poin_hampir_hangus', 'promo_produk'
    ));

-- 'poin_hampir_hangus' menyasar member berdasarkan tanggal kedaluwarsa poin,
-- bukan perilaku belanja — bukan salah satu dari empat MemberSegment yang
-- ada, jadi jujur diberi nilai sendiri daripada dipaksakan ke 'active'.
ALTER TABLE public.loyalty_campaigns DROP CONSTRAINT IF EXISTS loyalty_campaigns_segment_check;
ALTER TABLE public.loyalty_campaigns ADD CONSTRAINT loyalty_campaigns_segment_check
    CHECK (segment IN ('new', 'active', 'at_risk', 'inactive', 'birthday', 'anniversary', 'expiring_points'));

-- Arah pointer sama seperti referral: loyalty_codes menunjuk ke pemiliknya
-- (owner_customer_id untuk referral, campaign_id untuk campaign promo), bukan
-- sebaliknya. Satu campaign paling banyak satu kode.
ALTER TABLE public.loyalty_codes
    ADD COLUMN IF NOT EXISTS campaign_id UUID REFERENCES public.loyalty_campaigns(id) ON DELETE CASCADE;
ALTER TABLE public.loyalty_codes
    ADD CONSTRAINT uq_loyalty_codes_campaign UNIQUE (campaign_id);

-- point_ledger.reason belum kenal 'campaign'.
ALTER TABLE public.point_ledger DROP CONSTRAINT IF EXISTS point_ledger_reason_check;
ALTER TABLE public.point_ledger ADD CONSTRAINT point_ledger_reason_check
    CHECK (reason IN ('purchase', 'redeem', 'birthday', 'manual', 'correction', 'expiry', 'referral', 'campaign'));
