-- Operasional keuangan KAEL: arus kas, kantong uang, aset, dan stok retail.
-- Semua nominal Rupiah bulat dan seluruh tabel dibatasi business_id.

CREATE TABLE IF NOT EXISTS public.finance_pockets (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  name TEXT NOT NULL CHECK (char_length(name) BETWEEN 1 AND 50),
  allocation_pct NUMERIC(5,2) NOT NULL DEFAULT 0 CHECK (allocation_pct >= 0 AND allocation_pct <= 100),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_finance_pocket_name UNIQUE (business_id, name)
);

CREATE TABLE IF NOT EXISTS public.finance_transactions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('income', 'expense')),
  category TEXT NOT NULL CHECK (char_length(category) BETWEEN 1 AND 60),
  amount BIGINT NOT NULL CHECK (amount > 0),
  occurred_on DATE NOT NULL DEFAULT CURRENT_DATE,
  note TEXT CHECK (char_length(note) <= 500),
  pocket_id UUID REFERENCES public.finance_pockets(id) ON DELETE SET NULL,
  source TEXT NOT NULL DEFAULT 'manual' CHECK (source IN ('manual', 'pos', 'inventory', 'asset')),
  created_by UUID NOT NULL REFERENCES public.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.finance_assets (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  name TEXT NOT NULL CHECK (char_length(name) BETWEEN 1 AND 100),
  category TEXT NOT NULL DEFAULT 'Peralatan',
  acquired_on DATE NOT NULL,
  purchase_cost BIGINT NOT NULL CHECK (purchase_cost > 0),
  salvage_value BIGINT NOT NULL DEFAULT 0 CHECK (salvage_value >= 0),
  useful_life_months INT NOT NULL CHECK (useful_life_months BETWEEN 1 AND 240),
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (salvage_value <= purchase_cost)
);

CREATE TABLE IF NOT EXISTS public.inventory_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  sku TEXT,
  name TEXT NOT NULL CHECK (char_length(name) BETWEEN 1 AND 120),
  unit TEXT NOT NULL DEFAULT 'pcs' CHECK (char_length(unit) BETWEEN 1 AND 20),
  stock_qty NUMERIC NOT NULL DEFAULT 0 CHECK (stock_qty >= 0),
  average_cost BIGINT NOT NULL DEFAULT 0 CHECK (average_cost >= 0),
  reorder_level NUMERIC NOT NULL DEFAULT 0 CHECK (reorder_level >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_inventory_sku UNIQUE (business_id, sku)
);

CREATE TABLE IF NOT EXISTS public.inventory_purchases (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  supplier_name TEXT,
  purchased_on DATE NOT NULL DEFAULT CURRENT_DATE,
  total_amount BIGINT NOT NULL CHECK (total_amount > 0),
  note TEXT CHECK (char_length(note) <= 500),
  created_by UUID NOT NULL REFERENCES public.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.inventory_purchase_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  purchase_id UUID NOT NULL REFERENCES public.inventory_purchases(id) ON DELETE CASCADE,
  inventory_item_id UUID NOT NULL REFERENCES public.inventory_items(id) ON DELETE RESTRICT,
  qty NUMERIC NOT NULL CHECK (qty > 0),
  unit_cost BIGINT NOT NULL CHECK (unit_cost >= 0)
);

CREATE INDEX IF NOT EXISTS idx_finance_transactions_business_date ON public.finance_transactions (business_id, occurred_on DESC);
CREATE INDEX IF NOT EXISTS idx_finance_assets_business ON public.finance_assets (business_id, is_active);
CREATE INDEX IF NOT EXISTS idx_inventory_items_business ON public.inventory_items (business_id, name);
CREATE INDEX IF NOT EXISTS idx_inventory_purchases_business_date ON public.inventory_purchases (business_id, purchased_on DESC);

ALTER TABLE public.finance_pockets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.finance_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.finance_assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_purchases ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_purchase_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owner manages finance pockets" ON public.finance_pockets FOR ALL
USING (business_id = public.get_auth_business_id() AND public.get_auth_user_role() = 'owner');
CREATE POLICY "Owner manages finance transactions" ON public.finance_transactions FOR ALL
USING (business_id = public.get_auth_business_id() AND public.get_auth_user_role() = 'owner');
CREATE POLICY "Owner manages finance assets" ON public.finance_assets FOR ALL
USING (business_id = public.get_auth_business_id() AND public.get_auth_user_role() = 'owner');
CREATE POLICY "Owner manages inventory items" ON public.inventory_items FOR ALL
USING (business_id = public.get_auth_business_id() AND public.get_auth_user_role() = 'owner');
CREATE POLICY "Owner manages inventory purchases" ON public.inventory_purchases FOR ALL
USING (business_id = public.get_auth_business_id() AND public.get_auth_user_role() = 'owner');
CREATE POLICY "Owner manages inventory purchase items" ON public.inventory_purchase_items FOR ALL
USING (EXISTS (SELECT 1 FROM public.inventory_purchases p WHERE p.id = inventory_purchase_items.purchase_id AND p.business_id = public.get_auth_business_id() AND public.get_auth_user_role() = 'owner'));
