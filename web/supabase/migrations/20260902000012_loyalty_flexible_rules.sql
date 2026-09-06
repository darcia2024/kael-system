-- Loyalty varies by tenant. Keep the simple point/stamp default while allowing
-- owners to name the unit and apply a minimum/cap without code forks.
ALTER TABLE public.loyalty_programs
  ADD COLUMN IF NOT EXISTS unit_name TEXT NOT NULL DEFAULT 'Poin' CHECK (char_length(unit_name) BETWEEN 2 AND 30),
  ADD COLUMN IF NOT EXISTS minimum_purchase BIGINT NOT NULL DEFAULT 0 CHECK (minimum_purchase >= 0),
  ADD COLUMN IF NOT EXISTS max_earn_per_transaction INT,
  ADD COLUMN IF NOT EXISTS rounding_mode TEXT NOT NULL DEFAULT 'floor' CHECK (rounding_mode IN ('floor', 'round'));

CREATE TABLE IF NOT EXISTS public.loyalty_earn_rules (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  name TEXT NOT NULL CHECK (char_length(name) BETWEEN 2 AND 80),
  rule_type TEXT NOT NULL CHECK (rule_type IN ('spend_multiplier', 'visit_bonus', 'birthday_bonus')),
  multiplier NUMERIC(8,3) NOT NULL DEFAULT 1 CHECK (multiplier > 0),
  bonus_units INT NOT NULL DEFAULT 0 CHECK (bonus_units >= 0),
  starts_on DATE,
  ends_on DATE,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (ends_on IS NULL OR starts_on IS NULL OR ends_on >= starts_on)
);
CREATE INDEX IF NOT EXISTS idx_loyalty_earn_rules_business ON public.loyalty_earn_rules (business_id, is_active);
ALTER TABLE public.loyalty_earn_rules ENABLE ROW LEVEL SECURITY;
