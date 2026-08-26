-- ==============================================================================
-- KAEL SYSTEM · 00 FONDASI BERSAMA & 01 KAEL REVIEW SCHEMA
-- Database: PostgreSQL (Supabase)
-- Multi-tenancy: Partitioned via business_id with Row Level Security (RLS)
-- Money convention: Integer Rupiah (bigint, no decimals)
-- Timestamp convention: TIMESTAMPTZ (stored in UTC, formatted in businesses.timezone)
-- ==============================================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ------------------------------------------------------------------------------
-- 1. TABLE: businesses (Tenant Master)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.businesses (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    category TEXT,
    phone TEXT,
    address TEXT,
    google_place_id TEXT,
    logo_url TEXT,
    brand_color TEXT DEFAULT '#7958d8',
    timezone TEXT DEFAULT 'Asia/Jakarta',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE public.businesses IS 'Master data bisnis / tenant. Setiap data operasional merujuk ke business_id ini.';

-- ------------------------------------------------------------------------------
-- 2. TABLE: business_modules (Active Modules & Renewal Tracker)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.business_modules (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
    module TEXT NOT NULL CHECK (module IN ('review', 'finance', 'loyalty', 'pos', 'hr', 'booking')),
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'expired', 'suspended')),
    activated_at DATE NOT NULL DEFAULT CURRENT_DATE,
    expires_at DATE NOT NULL DEFAULT (CURRENT_DATE + INTERVAL '1 year'),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_business_module UNIQUE (business_id, module)
);

COMMENT ON TABLE public.business_modules IS 'Status aktif tiap modul per bisnis (Review, Finance, Loyalty, POS) dengan tanggal renewal tahunan.';

-- ------------------------------------------------------------------------------
-- 3. TABLE: users (Owner, Staff, and KAEL Admin)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    business_id UUID REFERENCES public.businesses(id) ON DELETE SET NULL,
    role TEXT NOT NULL CHECK (role IN ('owner', 'staff', 'kael_admin')),
    name TEXT NOT NULL,
    email TEXT UNIQUE,
    pin_hash TEXT,
    failed_pin_attempts INT NOT NULL DEFAULT 0,
    locked_until TIMESTAMPTZ,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT check_user_auth CHECK (
        (role = 'owner' AND email IS NOT NULL) OR
        (role = 'staff' AND pin_hash IS NOT NULL) OR
        (role = 'kael_admin' AND email IS NOT NULL)
    )
);

COMMENT ON TABLE public.users IS 'Pengguna sistem. Owner login via email, Staff login via PIN 6-digit (hash) dengan proteksi lockout 15 menit.';

-- ------------------------------------------------------------------------------
-- 4. TABLE: customers (Shared Customer Master across Loyalty & POS)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.customers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
    phone TEXT NOT NULL,
    name TEXT,
    birthday DATE,
    consent_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_business_customer_phone UNIQUE (business_id, phone)
);

COMMENT ON TABLE public.customers IS 'Database pelanggan bersama. Dilengkapi consent_at sesuai UU PDP No. 27/2022. Terisolasi per business_id.';

-- ------------------------------------------------------------------------------
-- 5. TABLE: cards (Physical NFC / QR Cards Master)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.cards (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    card_code TEXT UNIQUE NOT NULL,
    business_id UUID REFERENCES public.businesses(id) ON DELETE SET NULL,
    type TEXT NOT NULL DEFAULT 'review' CHECK (type IN ('review', 'loyalty', 'attendance')),
    status TEXT NOT NULL DEFAULT 'unactivated' CHECK (status IN ('unactivated', 'active', 'suspended')),
    activation_pin_hash TEXT,
    destination_url TEXT,
    label TEXT,
    customer_id UUID REFERENCES public.customers(id) ON DELETE SET NULL,
    tap_count INT NOT NULL DEFAULT 0,
    last_tapped_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE public.cards IS 'Master kartu fisik NFC & QR. Kode 8 karakter acak tanpa karakter ambigu. Melayani Review, Loyalty, dan Attendance.';

-- ------------------------------------------------------------------------------
-- 6. TABLE: card_taps (Append-only tap events)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.card_taps (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    card_id UUID NOT NULL REFERENCES public.cards(id) ON DELETE CASCADE,
    tapped_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    source TEXT NOT NULL DEFAULT 'nfc' CHECK (source IN ('nfc', 'qr')),
    ip_hash TEXT,
    user_agent TEXT
);

COMMENT ON TABLE public.card_taps IS 'Log event tap kartu append-only. IP disimpan dalam bentuk SHA-256 hash untuk privasi & deteksi spam.';

-- ------------------------------------------------------------------------------
-- 7. TABLE: review_snapshots (Optional v1.1 rating growth tracker)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.review_snapshots (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
    captured_at DATE NOT NULL DEFAULT CURRENT_DATE,
    rating NUMERIC(3, 2) NOT NULL,
    review_count INT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_business_review_snapshot UNIQUE (business_id, captured_at)
);

-- ------------------------------------------------------------------------------
-- INDEXES FOR MAXIMUM QUERY EFFICIENCY
-- ------------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_businesses_place_id ON public.businesses(google_place_id);
CREATE INDEX IF NOT EXISTS idx_users_business_id ON public.users(business_id);
CREATE INDEX IF NOT EXISTS idx_users_email ON public.users(email);
CREATE INDEX IF NOT EXISTS idx_customers_business_id ON public.customers(business_id);
CREATE INDEX IF NOT EXISTS idx_cards_code ON public.cards(card_code);
CREATE INDEX IF NOT EXISTS idx_cards_business_id ON public.cards(business_id);
CREATE INDEX IF NOT EXISTS idx_card_taps_card_time ON public.card_taps(card_id, tapped_at DESC);
CREATE INDEX IF NOT EXISTS idx_card_taps_ip_hash ON public.card_taps(ip_hash);

-- ------------------------------------------------------------------------------
-- TRIGGER: Update cards.tap_count and last_tapped_at automatically on insert
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.fn_handle_card_tap()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE public.cards
    SET 
        tap_count = tap_count + 1,
        last_tapped_at = NEW.tapped_at
    WHERE id = NEW.card_id;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_card_tap_counter ON public.card_taps;
CREATE TRIGGER trg_card_tap_counter
AFTER INSERT ON public.card_taps
FOR EACH ROW EXECUTE FUNCTION public.fn_handle_card_tap();

-- ------------------------------------------------------------------------------
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ------------------------------------------------------------------------------
ALTER TABLE public.businesses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.business_modules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cards ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.card_taps ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.review_snapshots ENABLE ROW LEVEL SECURITY;

-- Helper function to get current user's business_id and role from session
CREATE OR REPLACE FUNCTION public.get_auth_business_id()
RETURNS UUID AS $$
    SELECT NULLIF(current_setting('app.current_business_id', true), '')::UUID;
$$ LANGUAGE sql STABLE;

CREATE OR REPLACE FUNCTION public.get_auth_user_role()
RETURNS TEXT AS $$
    SELECT current_setting('app.current_user_role', true);
$$ LANGUAGE sql STABLE;

-- Business Table Policies
CREATE POLICY "Owner and Staff can view own business"
ON public.businesses FOR SELECT
USING (id = public.get_auth_business_id() OR public.get_auth_user_role() = 'kael_admin');

CREATE POLICY "Owner can update own business"
ON public.businesses FOR UPDATE
USING (id = public.get_auth_business_id() AND public.get_auth_user_role() = 'owner');

-- Business Modules Policies
CREATE POLICY "Users can view active modules of their business"
ON public.business_modules FOR SELECT
USING (business_id = public.get_auth_business_id() OR public.get_auth_user_role() = 'kael_admin');

-- Users Table Policies
CREATE POLICY "Owner can view and manage staff in their business"
ON public.users FOR ALL
USING (business_id = public.get_auth_business_id() AND public.get_auth_user_role() = 'owner');

CREATE POLICY "Staff can view self profile"
ON public.users FOR SELECT
USING (business_id = public.get_auth_business_id());

-- Customers Table Policies (Protected - KAEL Admin CANNOT view customer PII)
CREATE POLICY "Business owner and staff can view and manage customers"
ON public.customers FOR ALL
USING (business_id = public.get_auth_business_id());

-- Cards Table Policies
CREATE POLICY "Public / Redirect service can view active card by code"
ON public.cards FOR SELECT
USING (true);

CREATE POLICY "Business owner can view and manage their cards"
ON public.cards FOR ALL
USING (business_id = public.get_auth_business_id() OR public.get_auth_user_role() = 'kael_admin');

-- Card Taps Table Policies
CREATE POLICY "Public redirect can insert taps"
ON public.card_taps FOR INSERT
WITH CHECK (true);

CREATE POLICY "Owner can view tap analytics for their cards"
ON public.card_taps FOR SELECT
USING (
    EXISTS (
        SELECT 1 FROM public.cards
        WHERE cards.id = card_taps.card_id
        AND (cards.business_id = public.get_auth_business_id() OR public.get_auth_user_role() = 'kael_admin')
    )
);
