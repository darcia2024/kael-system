-- ==============================================================================
-- KAEL SYSTEM · 02 KAEL FINANCE & HPP RECIPE ENGINE SCHEMA
-- Database: PostgreSQL (Supabase)
-- Multi-tenancy: Partitioned via business_id with Row Level Security (RLS)
-- Money convention: Integer Rupiah (bigint, no decimals)
-- Unit convention: Base units (gr, ml, pcs)
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. TABLE: ingredients (Master Bahan Baku Bersama)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.ingredients (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    pack_price BIGINT NOT NULL CHECK (pack_price >= 0),
    pack_size NUMERIC NOT NULL CHECK (pack_size > 0),
    base_unit TEXT NOT NULL CHECK (base_unit IN ('gr', 'ml', 'pcs')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE public.ingredients IS 'Master bahan baku bersama lintas resep. Perubahan harga di sini otomatis menghitung ulang HPP semua resep.';

-- ------------------------------------------------------------------------------
-- 2. TABLE: ingredient_price_history (Histori Kenaikan Harga Bahan Baku)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.ingredient_price_history (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    ingredient_id UUID NOT NULL REFERENCES public.ingredients(id) ON DELETE CASCADE,
    pack_price BIGINT NOT NULL CHECK (pack_price >= 0),
    changed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE public.ingredient_price_history IS 'Log histori perubahan harga bahan baku untuk menjawab pertanyaan owner kenapa HPP naik.';

-- ------------------------------------------------------------------------------
-- 3. TABLE: recipes (Master Menu / Resep Produk)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.recipes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    type TEXT NOT NULL DEFAULT 'olahan' CHECK (type IN ('olahan', 'kulakan')),
    category TEXT DEFAULT 'Minuman',
    output_qty NUMERIC NOT NULL DEFAULT 1 CHECK (output_qty > 0),
    operational_cost BIGINT NOT NULL DEFAULT 0 CHECK (operational_cost >= 0),
    selling_price BIGINT NOT NULL DEFAULT 0 CHECK (selling_price >= 0),
    target_margin_pct NUMERIC NOT NULL DEFAULT 60 CHECK (target_margin_pct >= 0 AND target_margin_pct <= 100),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE public.recipes IS 'Master resep produk olahan sendiri maupun produk kulakan / reseller.';

-- ------------------------------------------------------------------------------
-- 4. TABLE: recipe_ingredients (Komposisi Bahan per Resep)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.recipe_ingredients (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    recipe_id UUID NOT NULL REFERENCES public.recipes(id) ON DELETE CASCADE,
    ingredient_id UUID NOT NULL REFERENCES public.ingredients(id) ON DELETE RESTRICT,
    qty NUMERIC NOT NULL CHECK (qty > 0),
    CONSTRAINT uq_recipe_ingredient UNIQUE (recipe_id, ingredient_id)
);

COMMENT ON TABLE public.recipe_ingredients IS 'Relasi bahan baku dalam resep. Qty selalu dalam satuan dasar bahan (gr/ml/pcs).';

-- ------------------------------------------------------------------------------
-- 5. TABLE: recipe_packaging (Biaya Kemasan Melekat per Unit Jadi)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.recipe_packaging (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    recipe_id UUID NOT NULL REFERENCES public.recipes(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    cost BIGINT NOT NULL CHECK (cost >= 0)
);

COMMENT ON TABLE public.recipe_packaging IS 'Biaya kemasan (cup, paper bag, sedotan) yang melekat per unit porsi jadi (di luar pembagian output_qty).';

-- ------------------------------------------------------------------------------
-- INDEXES
-- ------------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_ingredients_business ON public.ingredients(business_id);
CREATE INDEX IF NOT EXISTS idx_price_history_ingredient ON public.ingredient_price_history(ingredient_id, changed_at DESC);
CREATE INDEX IF NOT EXISTS idx_recipes_business ON public.recipes(business_id);
CREATE INDEX IF NOT EXISTS idx_recipe_ingredients_recipe ON public.recipe_ingredients(recipe_id);
CREATE INDEX IF NOT EXISTS idx_recipe_packaging_recipe ON public.recipe_packaging(recipe_id);

-- ------------------------------------------------------------------------------
-- TRIGGER: Log ingredient price changes automatically
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.fn_log_ingredient_price()
RETURNS TRIGGER AS $$
BEGIN
    IF (TG_OP = 'UPDATE' AND OLD.pack_price IS DISTINCT FROM NEW.pack_price) THEN
        INSERT INTO public.ingredient_price_history (ingredient_id, pack_price, changed_at)
        VALUES (NEW.id, NEW.pack_price, NOW());
        NEW.updated_at = NOW();
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_ingredient_price_audit ON public.ingredients;
CREATE TRIGGER trg_ingredient_price_audit
BEFORE UPDATE ON public.ingredients
FOR EACH ROW EXECUTE FUNCTION public.fn_log_ingredient_price();

-- ------------------------------------------------------------------------------
-- ROW LEVEL SECURITY (RLS) POLICIES
-- Catatan: Hanya peran 'owner' dan 'kael_admin' yang boleh melihat HPP & resep.
-- Peran 'staff' / kasir TIDAK memiliki akses ke tabel ini.
-- ------------------------------------------------------------------------------
ALTER TABLE public.ingredients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ingredient_price_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.recipes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.recipe_ingredients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.recipe_packaging ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owner can manage own ingredients"
ON public.ingredients FOR ALL
USING (business_id = public.get_auth_business_id() AND public.get_auth_user_role() = 'owner');

CREATE POLICY "Owner can view ingredient price history"
ON public.ingredient_price_history FOR SELECT
USING (
    EXISTS (
        SELECT 1 FROM public.ingredients
        WHERE ingredients.id = ingredient_price_history.ingredient_id
        AND ingredients.business_id = public.get_auth_business_id()
    )
);

CREATE POLICY "Owner can manage own recipes"
ON public.recipes FOR ALL
USING (business_id = public.get_auth_business_id() AND public.get_auth_user_role() = 'owner');

CREATE POLICY "Owner can manage recipe ingredients"
ON public.recipe_ingredients FOR ALL
USING (
    EXISTS (
        SELECT 1 FROM public.recipes
        WHERE recipes.id = recipe_ingredients.recipe_id
        AND recipes.business_id = public.get_auth_business_id()
    )
);

CREATE POLICY "Owner can manage recipe packaging"
ON public.recipe_packaging FOR ALL
USING (
    EXISTS (
        SELECT 1 FROM public.recipes
        WHERE recipes.id = recipe_packaging.recipe_id
        AND recipes.business_id = public.get_auth_business_id()
    )
);
