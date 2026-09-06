-- KAEL POS · Menutup sumber selisih kas dan omzet pada checkout/refund.

ALTER TABLE public.businesses
  ADD COLUMN IF NOT EXISTS pos_tax_rate NUMERIC(5,2) NOT NULL DEFAULT 0
    CHECK (pos_tax_rate >= 0 AND pos_tax_rate <= 100),
  ADD COLUMN IF NOT EXISTS pos_service_charge_rate NUMERIC(5,2) NOT NULL DEFAULT 0
    CHECK (pos_service_charge_rate >= 0 AND pos_service_charge_rate <= 100);

-- Refund tunai keluar dari laci shift SAAT refund disetujui, bukan dari shift
-- ketika penjualan awal terjadi. QRIS/transfer tidak membutuhkan shift_id.
ALTER TABLE public.refunds
  ADD COLUMN IF NOT EXISTS shift_id UUID REFERENCES public.shifts(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_refunds_order ON public.refunds(order_id);
CREATE INDEX IF NOT EXISTS idx_refunds_shift ON public.refunds(shift_id);

-- Versi lama memberi status refunded pada order. Refund sudah memiliki tabel
-- sendiri, jadi order dikembalikan menjadi paid agar nilai jual kotor tetap
-- terlacak dan laporan dapat mengurangkan nominal refund secara presisi.
UPDATE public.orders
SET status = 'paid'
WHERE status = 'refunded'
  AND EXISTS (SELECT 1 FROM public.refunds r WHERE r.order_id = orders.id);
