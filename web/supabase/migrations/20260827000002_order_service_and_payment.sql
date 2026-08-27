-- Tipe layanan, status pembayaran, dan pengantaran.
--
-- Tiga persoalan yang berakar pada satu kolom yang menjawab dua pertanyaan
-- sekaligus.
--
-- 1. `channel` dulu bernilai cashier / qr_dinein / qr_takeaway, jadi "siapa
--    yang membuat pesanan" dan "bagaimana pesanan disajikan" bercampur di satu
--    tempat. Akibatnya tidak ada cara menyatakan pelanggan yang DUDUK di meja
--    tapi memesan di kasir — keadaan yang paling biasa di warung. Kini
--    `channel` menjawab siapa (cashier / qr) dan `service_type` menjawab
--    bagaimana (dine_in / takeaway / delivery). Takeaway dan "bungkus" yang
--    dulu berdiri sendiri-sendiri memang hal yang sama, jadi menjadi satu.
--
-- 2. Status pembayaran dulu menumpang di `status`, yang juga dipakai laporan
--    dan pengembalian dana. Karena itu pesanan kasir langsung ditandai lunas
--    begitu dibuat — termasuk QRIS, yang uangnya belum tentu masuk saat
--    QR-nya baru muncul di layar. `payment_status` memisahkan sumbu uang dari
--    sumbu laporan, dan menyimpan SIAPA yang memastikan uangnya diterima.
--
-- 3. Pesanan swalayan dari meja tidak punya tempat mencatat pilihan bayar
--    pelanggan maupun kemajuan dapur. `fulfillment_status` mengisinya.
--
-- Semua kolom baru punya nilai bawaan yang cocok dengan perilaku lama, jadi
-- baris yang sudah ada tidak berubah artinya.

-- ---------------------------------------------------------------------------
-- 1. Tipe layanan
-- ---------------------------------------------------------------------------
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS service_type TEXT NOT NULL DEFAULT 'takeaway';

-- Isi dari channel lama SEBELUM channel-nya dipersempit.
UPDATE public.orders SET service_type = 'dine_in'  WHERE channel = 'qr_dinein';
UPDATE public.orders SET service_type = 'takeaway' WHERE channel IN ('qr_takeaway', 'cashier');

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conrelid = 'public.orders'::regclass AND conname = 'orders_service_type_check'
  ) THEN
    ALTER TABLE public.orders
      ADD CONSTRAINT orders_service_type_check
      CHECK (service_type IN ('dine_in', 'takeaway', 'delivery'));
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- 2. Channel: tinggal menjawab SIAPA yang membuat pesanan
-- ---------------------------------------------------------------------------
ALTER TABLE public.orders DROP CONSTRAINT IF EXISTS orders_channel_check;

UPDATE public.orders SET channel = 'qr' WHERE channel IN ('qr_dinein', 'qr_takeaway');

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conrelid = 'public.orders'::regclass AND conname = 'orders_channel_check2'
  ) THEN
    ALTER TABLE public.orders
      ADD CONSTRAINT orders_channel_check2 CHECK (channel IN ('cashier', 'qr'));
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- 3. Pembayaran
-- ---------------------------------------------------------------------------
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS payment_status TEXT NOT NULL DEFAULT 'paid',
  ADD COLUMN IF NOT EXISTS paid_confirmed_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS paid_confirmed_at TIMESTAMPTZ;

-- Baris lama: `status` adalah satu-satunya yang pernah ada, jadi ia yang
-- menentukan. Yang masih 'open' berarti belum dibayar.
UPDATE public.orders SET payment_status = 'pending'   WHERE status = 'open';
UPDATE public.orders SET payment_status = 'paid'      WHERE status IN ('paid', 'refunded');
UPDATE public.orders SET payment_status = 'cancelled' WHERE status = 'cancelled';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conrelid = 'public.orders'::regclass AND conname = 'orders_payment_status_check'
  ) THEN
    ALTER TABLE public.orders
      ADD CONSTRAINT orders_payment_status_check
      CHECK (payment_status IN ('pending', 'paid', 'failed', 'expired', 'cancelled'));
  END IF;
END $$;

COMMENT ON COLUMN public.orders.payment_status IS
  'Sumbu uang, terpisah dari `status` yang dipakai laporan. QRIS dan transfer mulai dari pending sampai kasir memastikan uangnya benar-benar masuk.';

COMMENT ON COLUMN public.orders.paid_confirmed_by IS
  'Siapa yang menyatakan uangnya diterima. Tanpa ini, konfirmasi pembayaran manual tidak bisa ditelusuri ke siapa pun.';

-- ---------------------------------------------------------------------------
-- 4. Kemajuan dapur
-- ---------------------------------------------------------------------------
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS fulfillment_status TEXT NOT NULL DEFAULT 'completed';

-- Pesanan lama tidak punya antrean dapur; yang belum lunas berarti belum jalan.
UPDATE public.orders SET fulfillment_status = 'pending' WHERE status = 'open';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conrelid = 'public.orders'::regclass AND conname = 'orders_fulfillment_status_check'
  ) THEN
    ALTER TABLE public.orders
      ADD CONSTRAINT orders_fulfillment_status_check
      CHECK (fulfillment_status IN ('pending', 'accepted', 'preparing', 'ready', 'completed', 'cancelled'));
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- 5. Pengantaran
-- ---------------------------------------------------------------------------
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS delivery_name TEXT,
  ADD COLUMN IF NOT EXISTS delivery_phone TEXT,
  ADD COLUMN IF NOT EXISTS delivery_address TEXT,
  ADD COLUMN IF NOT EXISTS delivery_fee BIGINT NOT NULL DEFAULT 0 CHECK (delivery_fee >= 0),
  ADD COLUMN IF NOT EXISTS delivery_note TEXT;

COMMENT ON COLUMN public.orders.delivery_fee IS
  'Ongkir dalam rupiah. Ikut dijumlahkan ke total, jadi tersimpan di baris pesanan, bukan dihitung ulang saat laporan.';

-- ---------------------------------------------------------------------------
-- 6. Indeks untuk antrean kasir
-- ---------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_orders_pending_payment
  ON public.orders (business_id, payment_status, created_at)
  WHERE payment_status = 'pending';
