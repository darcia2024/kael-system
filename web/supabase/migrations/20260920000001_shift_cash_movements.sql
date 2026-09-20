-- Pencatatan kas keluar (uang keluar laci / petty cash) dan kas masuk tambahan selama shift POS.
--
-- Kejadiannya setiap hari di F&B:
-- - Kasir mengambil uang dari laci untuk beli es batu, gas elpiji, galon Aqua, belanja pasar, parkir, dll.
-- - Kasir menerima tambahan uang modal kembalian dari owner di tengah shift (kas masuk).
--
-- Tanpa tabel ini, setiap uang keluar dari laci langsung membuat laci kasir KURANG / MINUS
-- saat tutup shift, karena sistem menganggap uang penjualan masih utuh di laci.

CREATE TABLE IF NOT EXISTS public.shift_cash_movements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  shift_id UUID NOT NULL REFERENCES public.shifts(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('cash_out', 'cash_in')),
  amount BIGINT NOT NULL CHECK (amount > 0),
  category TEXT NOT NULL DEFAULT 'Operasional',
  note TEXT NOT NULL,
  created_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_shift_cash_movements_shift ON public.shift_cash_movements(business_id, shift_id);
