-- Tablet kasir dapat dipakai bergantian, tetapi setiap pesanan yang sudah
-- lunas tetap harus memiliki satu penanggung jawab yang jelas.
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS claimed_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS claimed_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS orders_station_queue_idx
  ON public.orders (business_id, channel, payment_status, fulfillment_status, created_at);
