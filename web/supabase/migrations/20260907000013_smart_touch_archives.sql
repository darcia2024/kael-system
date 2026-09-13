-- Cadangan eksplisit sebelum kartu Smart Touch dipindahkan ke layanan lain.
-- Satu kartu tetap satu layanan aktif, tetapi konfigurasi yang pernah dipakai
-- tidak dihapus diam-diam ketika pemilik berubah kebutuhan.
CREATE TABLE IF NOT EXISTS public.smart_touch_archives (
  card_id UUID PRIMARY KEY REFERENCES public.cards(id) ON DELETE CASCADE,
  business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  profile JSONB NOT NULL,
  buttons JSONB NOT NULL DEFAULT '[]'::jsonb,
  archived_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  archived_by UUID REFERENCES public.users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_smart_touch_archives_business
  ON public.smart_touch_archives (business_id, archived_at DESC);

ALTER TABLE public.smart_touch_archives ENABLE ROW LEVEL SECURITY;
