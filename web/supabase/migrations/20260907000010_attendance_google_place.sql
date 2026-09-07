ALTER TABLE public.attendance_sites
  ADD COLUMN IF NOT EXISTS google_place_id TEXT;

CREATE INDEX IF NOT EXISTS idx_attendance_sites_business_place
  ON public.attendance_sites (business_id, google_place_id)
  WHERE google_place_id IS NOT NULL;
