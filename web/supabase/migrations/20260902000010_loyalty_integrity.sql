-- Loyalty: cegah pengambilalihan kartu, pemakaian voucher ganda, dan spam pendaftaran.

CREATE TABLE IF NOT EXISTS public.loyalty_registration_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  ip_hash text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_loyalty_registration_attempts_window
  ON public.loyalty_registration_attempts (business_id, ip_hash, created_at DESC);

ALTER TABLE public.redemptions
  ADD COLUMN IF NOT EXISTS used_by uuid REFERENCES public.users(id) ON DELETE SET NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_redemptions_code ON public.redemptions (code);
CREATE INDEX IF NOT EXISTS idx_redemptions_business_code
  ON public.redemptions (code, status);
