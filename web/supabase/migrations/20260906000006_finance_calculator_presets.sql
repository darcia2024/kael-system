CREATE TABLE IF NOT EXISTS public.finance_calculator_presets (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  mode TEXT NOT NULL CHECK (mode IN ('kuliner', 'retail', 'jasa')),
  direct_cost BIGINT NOT NULL DEFAULT 0 CHECK (direct_cost >= 0),
  supporting_cost BIGINT NOT NULL DEFAULT 0 CHECK (supporting_cost >= 0),
  operational_cost BIGINT NOT NULL DEFAULT 0 CHECK (operational_cost >= 0),
  selling_price BIGINT NOT NULL DEFAULT 0 CHECK (selling_price >= 0),
  discount_pct NUMERIC NOT NULL DEFAULT 0 CHECK (discount_pct >= 0 AND discount_pct <= 100),
  payment_fee_pct NUMERIC NOT NULL DEFAULT 0 CHECK (payment_fee_pct >= 0 AND payment_fee_pct <= 100),
  channel_fee_pct NUMERIC NOT NULL DEFAULT 0 CHECK (channel_fee_pct >= 0 AND channel_fee_pct <= 100),
  tax_reserve_pct NUMERIC NOT NULL DEFAULT 0 CHECK (tax_reserve_pct >= 0 AND tax_reserve_pct <= 100),
  target_margin_pct NUMERIC NOT NULL DEFAULT 0 CHECK (target_margin_pct >= 0 AND target_margin_pct <= 100),
  monthly_fixed_cost BIGINT NOT NULL DEFAULT 0 CHECK (monthly_fixed_cost >= 0),
  monthly_profit_target BIGINT NOT NULL DEFAULT 0 CHECK (monthly_profit_target >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_finance_calculator_presets_business
  ON public.finance_calculator_presets(business_id, updated_at DESC);

ALTER TABLE public.finance_calculator_presets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owner can manage own finance calculator presets"
ON public.finance_calculator_presets FOR ALL
USING (business_id = public.get_auth_business_id() AND public.get_auth_user_role() = 'owner');
