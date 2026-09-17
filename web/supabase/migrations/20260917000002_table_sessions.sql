-- Sesi meja: satu kunjungan tamu, dari duduk sampai kasir menutup mejanya.
--
-- Sebelum ini "meja aktif" disimpulkan dari pesanan yang belum selesai:
--
--     meja dianggap terisi  <=>  ada order dengan fulfillment_status != completed
--
-- Artinya begitu dapur menandai semua makanan sudah keluar, mejanya langsung
-- terbaca KOSONG — padahal tamunya masih duduk di situ, makan. Kasir melihat
-- meja hijau, mengarahkan tamu baru ke sana, dan dua rombongan bertemu di satu
-- meja. Status dapur dipakai menjawab pertanyaan yang tidak pernah ditanyakan
-- ke dapur.
--
-- Hal yang sama bikin pesanan tambahan tidak punya induk. Tambahan dari kasir
-- maupun dari QR meja jadi baris order baru yang kebetulan bernomor meja sama.
-- Setelah order pertama selesai, dia lepas dari kelompoknya, dan tagihan meja
-- itu tidak pernah utuh lagi.
--
-- Tiga hal yang selama ini ditumpuk jadi satu sekarang berdiri sendiri:
--
--     table_sessions.status    tamunya masih di meja atau tidak
--     orders.payment_status    tagihannya sudah dibayar atau belum
--     orders.fulfillment_status makanannya sudah keluar dari dapur atau belum

CREATE TABLE IF NOT EXISTS public.table_sessions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,

  -- Nomor meja seperti ditulis dan ditampilkan, misalnya "Lesehan 1".
  table_no TEXT NOT NULL,

  -- Bentuk bakunya, dipakai mencocokkan. "Meja 1", "1", dan "01" adalah meja
  -- yang sama; tanpa kolom ini pesanan dari QR dan dari kasir bisa jatuh ke
  -- kelompok berbeda hanya karena ejaan nomor mejanya beda.
  table_key TEXT NOT NULL,

  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'closed')),
  guest_count INT CHECK (guest_count IS NULL OR guest_count > 0),

  opened_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  opened_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  closed_at TIMESTAMPTZ,
  closed_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  note TEXT
);

COMMENT ON TABLE public.table_sessions IS
  'Satu kunjungan tamu di satu meja. Dibuka saat tamu duduk atau saat pesanan pertama masuk, ditutup kasir setelah tamunya benar-benar pergi.';

-- Satu meja tidak boleh punya dua sesi terbuka sekaligus. Ini ditegakkan di
-- basis data, bukan cuma di layar: dua tablet kasir yang menekan "buka meja"
-- bersamaan tetap hanya menghasilkan satu sesi.
CREATE UNIQUE INDEX IF NOT EXISTS idx_table_sessions_satu_terbuka
  ON public.table_sessions (business_id, table_key)
  WHERE status = 'open';

CREATE INDEX IF NOT EXISTS idx_table_sessions_business_open
  ON public.table_sessions (business_id, status, opened_at DESC);

ALTER TABLE public.table_sessions ENABLE ROW LEVEL SECURITY;

-- ---------------------------------------------------------------------------
-- Pesanan menempel ke sesi
-- ---------------------------------------------------------------------------
-- NULL tetap sah: takeaway, delivery, dan seluruh pesanan lama tidak punya
-- sesi meja, dan memang tidak perlu.
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS table_session_id UUID REFERENCES public.table_sessions(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_orders_table_session
  ON public.orders (table_session_id)
  WHERE table_session_id IS NOT NULL;

COMMENT ON COLUMN public.orders.table_session_id IS
  'Pengikat tagihan awal dan tambahan dalam satu kunjungan. NULL untuk takeaway, delivery, dan pesanan sebelum fitur ini ada.';

-- ---------------------------------------------------------------------------
-- Meja yang sedang terisi sekarang tidak boleh ikut hilang
-- ---------------------------------------------------------------------------
-- Tanpa langkah ini, meja yang tamunya sedang duduk saat migrasi dijalankan
-- akan kehilangan induknya dan terbaca kosong di layar kasir. Jadi tiap meja
-- yang masih punya pesanan berjalan dibuatkan satu sesi terbuka, dan pesanan
-- itu langsung ditempelkan ke sana.
--
-- Bentuk baku nomor meja di sini harus sama persis dengan normalizeTableKey()
-- di src/lib/table-key.ts: buang awalan "meja", rapikan spasi, lalu nomor satu
-- sampai dua digit ditulis dua digit.
WITH aktif AS (
  SELECT
    o.business_id,
    CASE
      WHEN regexp_replace(lower(btrim(o.table_no)), '^meja\s*', '') ~ '^[0-9]{1,2}$'
        THEN lpad(regexp_replace(lower(btrim(o.table_no)), '^meja\s*', ''), 2, '0')
      ELSE btrim(regexp_replace(regexp_replace(lower(btrim(o.table_no)), '^meja\s*', ''), '\s+', ' ', 'g'))
    END AS table_key,
    min(o.table_no) AS table_no,
    min(o.created_at) AS opened_at
  FROM public.orders o
  WHERE o.table_no IS NOT NULL
    AND btrim(o.table_no) <> ''
    AND o.table_session_id IS NULL
    AND o.status <> 'cancelled'
    AND o.payment_status NOT IN ('failed', 'expired', 'cancelled')
    AND o.fulfillment_status NOT IN ('completed', 'cancelled')
  GROUP BY 1, 2
),
dibuat AS (
  INSERT INTO public.table_sessions (business_id, table_no, table_key, status, opened_at, note)
  SELECT business_id, table_no, table_key, 'open', opened_at,
         'Dibuat otomatis saat migrasi sesi meja, dari pesanan yang masih berjalan.'
  FROM aktif
  WHERE table_key <> ''
  RETURNING id, business_id, table_key
)
UPDATE public.orders o
SET table_session_id = d.id
FROM dibuat d
WHERE o.business_id = d.business_id
  AND o.table_session_id IS NULL
  AND o.status <> 'cancelled'
  AND o.payment_status NOT IN ('failed', 'expired', 'cancelled')
  AND o.fulfillment_status NOT IN ('completed', 'cancelled')
  AND CASE
        WHEN regexp_replace(lower(btrim(o.table_no)), '^meja\s*', '') ~ '^[0-9]{1,2}$'
          THEN lpad(regexp_replace(lower(btrim(o.table_no)), '^meja\s*', ''), 2, '0')
        ELSE btrim(regexp_replace(regexp_replace(lower(btrim(o.table_no)), '^meja\s*', ''), '\s+', ' ', 'g'))
      END = d.table_key;
