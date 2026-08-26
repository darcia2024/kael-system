-- ==============================================================================
-- KAEL SYSTEM · 00 FONDASI BERSAMA & 01 KAEL REVIEW SCHEMA
-- Database: PostgreSQL (Supabase)
-- Multi-tenancy: Partitioned via business_id with Row Level Security (RLS)
-- ==============================================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

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

CREATE TABLE IF NOT EXISTS public.card_taps (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    card_id UUID NOT NULL REFERENCES public.cards(id) ON DELETE CASCADE,
    tapped_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    source TEXT NOT NULL DEFAULT 'nfc' CHECK (source IN ('nfc', 'qr')),
    ip_hash TEXT,
    user_agent TEXT
);

CREATE TABLE IF NOT EXISTS public.review_snapshots (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
    captured_at DATE NOT NULL DEFAULT CURRENT_DATE,
    rating NUMERIC(3, 2) NOT NULL,
    review_count INT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_business_review_snapshot UNIQUE (business_id, captured_at)
);
