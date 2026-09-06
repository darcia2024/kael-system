-- Nilai jual dipakai KAEL untuk menghitung biaya program reward.
-- Bisnis lama diberi nilai awal 0 sampai owner melengkapinya dari katalog reward.
ALTER TABLE public.rewards
  ADD COLUMN IF NOT EXISTS market_value BIGINT NOT NULL DEFAULT 0
  CHECK (market_value >= 0);

COMMENT ON COLUMN public.rewards.market_value IS
  'Nilai harga jual normal reward, dipakai untuk menghitung diskon efektif program loyalty.';
