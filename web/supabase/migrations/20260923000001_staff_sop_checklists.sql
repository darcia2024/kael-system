CREATE TABLE IF NOT EXISTS public.staff_sop_checklists (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  sop_type text NOT NULL CHECK (sop_type IN ('opening', 'closing')),
  date date NOT NULL DEFAULT CURRENT_DATE,
  items jsonb NOT NULL DEFAULT '[]'::jsonb,
  completed_at timestamptz,
  notes text,
  created_at timestamptz NOT NULL DEFAULT NOW(),
  updated_at timestamptz NOT NULL DEFAULT NOW(),
  UNIQUE(business_id, user_id, sop_type, date)
);

CREATE INDEX IF NOT EXISTS idx_staff_sop_checklists_date
  ON public.staff_sop_checklists (business_id, date, sop_type);
