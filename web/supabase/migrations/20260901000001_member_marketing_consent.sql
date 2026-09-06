-- Persetujuan program member dan persetujuan menerima promo adalah dua hal
-- berbeda. Member lama tidak otomatis diberi izin promo.
ALTER TABLE public.customers
  ADD COLUMN IF NOT EXISTS marketing_opt_in BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS marketing_opt_in_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_customers_marketing_opt_in
  ON public.customers (business_id, marketing_opt_in)
  WHERE marketing_opt_in = TRUE;

COMMENT ON COLUMN public.customers.marketing_opt_in IS
  'Persetujuan eksplisit member untuk menerima informasi promo melalui WhatsApp.';
