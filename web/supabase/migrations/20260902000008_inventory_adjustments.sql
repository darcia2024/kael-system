CREATE TABLE IF NOT EXISTS public.inventory_adjustments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  inventory_item_id UUID NOT NULL REFERENCES public.inventory_items(id) ON DELETE RESTRICT,
  delta_qty NUMERIC NOT NULL CHECK (delta_qty <> 0),
  reason TEXT NOT NULL CHECK (char_length(reason) BETWEEN 1 AND 120),
  created_by UUID NOT NULL REFERENCES public.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_inventory_adjustments_item_time ON public.inventory_adjustments (inventory_item_id, created_at DESC);
ALTER TABLE public.inventory_adjustments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Owner manages inventory adjustments" ON public.inventory_adjustments FOR ALL
USING (business_id = public.get_auth_business_id() AND public.get_auth_user_role() = 'owner');
