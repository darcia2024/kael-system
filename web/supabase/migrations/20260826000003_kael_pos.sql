-- ==============================================================================
-- KAEL SYSTEM · 04 KAEL POS & ORDERING SCHEMA
-- Database: PostgreSQL (Supabase)
-- Multi-tenancy: Partitioned via business_id with Row Level Security (RLS)
-- Offline-Ready Client UUIDs & Snapshot Columns for Immutable Past Audits
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. TABLE: categories (Kategori Menu POS)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.categories (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    sort_order INT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE public.categories IS 'Kategori menu produk untuk tampilan kasir dan menu QR.';

-- ------------------------------------------------------------------------------
-- 2. TABLE: menu_items (Daftar Menu Jual)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.menu_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
    category_id UUID REFERENCES public.categories(id) ON DELETE SET NULL,
    name TEXT NOT NULL,
    price BIGINT NOT NULL CHECK (price >= 0),
    photo_url TEXT,
    is_available BOOLEAN NOT NULL DEFAULT TRUE, -- Untuk toggle "Habis Hari Ini" tanpa menghapus riwayat
    recipe_id UUID REFERENCES public.recipes(id) ON DELETE SET NULL, -- Tersambung ke KAEL Finance
    sort_order INT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE public.menu_items IS 'Daftar menu produk yang dijual di kasir dan menu QR.';

-- ------------------------------------------------------------------------------
-- 3. TABLE: shifts (Manajemen Shift Kasir & Laci Uang)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.shifts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
    opened_by UUID NOT NULL REFERENCES public.users(id),
    opened_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    opening_cash BIGINT NOT NULL DEFAULT 0, -- Modal awal laci kasir
    closed_at TIMESTAMPTZ,
    closing_cash BIGINT, -- Uang fisik di laci saat tutup
    expected_cash BIGINT, -- Dihitung sistem: opening_cash + total cash sales
    variance BIGINT, -- Selisih: closing_cash - expected_cash
    notes TEXT
);

COMMENT ON TABLE public.shifts IS 'Rekonsiliasi shift kasir dan audit selisih uang tunai laci kasir.';

-- ------------------------------------------------------------------------------
-- 4. TABLE: orders (Transaksi Penjualan - Immutable)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.orders (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(), -- Client-generated UUID
    business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
    order_no TEXT NOT NULL, -- Nomor antrean harian misal A-014
    channel TEXT NOT NULL DEFAULT 'cashier' CHECK (channel IN ('cashier', 'qr_dinein', 'qr_takeaway')),
    table_no TEXT, -- Nomor meja untuk dine-in
    status TEXT NOT NULL DEFAULT 'paid' CHECK (status IN ('open', 'paid', 'cancelled', 'refunded')),
    subtotal BIGINT NOT NULL CHECK (subtotal >= 0),
    discount BIGINT NOT NULL DEFAULT 0 CHECK (discount >= 0),
    tax BIGINT NOT NULL DEFAULT 0 CHECK (tax >= 0),
    service_charge BIGINT NOT NULL DEFAULT 0 CHECK (service_charge >= 0),
    total BIGINT NOT NULL CHECK (total >= 0),
    payment_method TEXT NOT NULL DEFAULT 'cash' CHECK (payment_method IN ('cash', 'qris', 'transfer')),
    cash_given BIGINT,
    cash_change BIGINT,
    customer_id UUID REFERENCES public.customers(id) ON DELETE SET NULL, -- Tersambung ke KAEL Loyalty
    shift_id UUID REFERENCES public.shifts(id) ON DELETE SET NULL,
    created_by UUID NOT NULL REFERENCES public.users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    synced_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE public.orders IS 'Tabel transaksi penjualan immutable. Nilai subtotal/tax/total tersimpan fix saat checkout.';

-- ------------------------------------------------------------------------------
-- 5. TABLE: order_items (Rincian Item dengan Snapshot Harga)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.order_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
    menu_item_id UUID REFERENCES public.menu_items(id) ON DELETE SET NULL,
    name_snapshot TEXT NOT NULL, -- Nama menu saat transaksi terjadi
    price_snapshot BIGINT NOT NULL, -- Harga menu saat transaksi terjadi
    qty INT NOT NULL CHECK (qty > 0),
    subtotal BIGINT NOT NULL CHECK (subtotal >= 0),
    note TEXT -- Catatan item misal "Es sedikit", "Less sugar"
);

COMMENT ON TABLE public.order_items IS 'Rincian item pesanan dengan snapshot harga untuk menjamin keaslian audit masa lalu.';

-- ------------------------------------------------------------------------------
-- 6. TABLE: refunds (Pengembalian Dana / Pembatalan - Owner Only)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.refunds (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
    amount BIGINT NOT NULL CHECK (amount > 0),
    reason TEXT NOT NULL,
    approved_by UUID NOT NULL REFERENCES public.users(id), -- Wajib role owner
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE public.refunds IS 'Catatan refund resmi yang disetujui owner tanpa menghapus baris transaksi asli.';

-- ------------------------------------------------------------------------------
-- INDEXES
-- ------------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_menu_items_business ON public.menu_items(business_id);
CREATE INDEX IF NOT EXISTS idx_orders_business_created ON public.orders(business_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_orders_shift ON public.orders(shift_id);
CREATE INDEX IF NOT EXISTS idx_order_items_order ON public.order_items(order_id);
CREATE INDEX IF NOT EXISTS idx_shifts_business ON public.shifts(business_id, opened_at DESC);

-- ------------------------------------------------------------------------------
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ------------------------------------------------------------------------------
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.menu_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shifts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.refunds ENABLE ROW LEVEL SECURITY;

-- Public Menu QR (Customer) can read active menu items
-- CATATAN KEAMANAN
-- Policy baca publik dicabut. Dengan USING (true) seluruh menu dan harga milik
-- semua bisnis terbaca oleh siapa pun. Halaman menu QR dirender di server.

-- Staff and Owner can manage categories, menu items, shifts, and orders for their business
CREATE POLICY "Staff and Owner manage POS categories"
ON public.categories FOR ALL
USING (business_id = public.get_auth_business_id());

CREATE POLICY "Owner manage menu items"
ON public.menu_items FOR ALL
USING (business_id = public.get_auth_business_id());

CREATE POLICY "Staff and Owner manage shifts"
ON public.shifts FOR ALL
USING (business_id = public.get_auth_business_id());

CREATE POLICY "Staff and Owner manage orders"
ON public.orders FOR ALL
USING (business_id = public.get_auth_business_id());

CREATE POLICY "Staff and Owner manage order items"
ON public.order_items FOR ALL
USING (
    EXISTS (
        SELECT 1 FROM public.orders
        WHERE orders.id = order_items.order_id
        AND orders.business_id = public.get_auth_business_id()
    )
);

-- Refunds policy: Only owner can approve and view refunds
CREATE POLICY "Owner can approve and view refunds"
ON public.refunds FOR ALL
USING (
    EXISTS (
        SELECT 1 FROM public.orders
        WHERE orders.id = refunds.order_id
        AND orders.business_id = public.get_auth_business_id()
    )
    AND public.get_auth_user_role() = 'owner'
);
