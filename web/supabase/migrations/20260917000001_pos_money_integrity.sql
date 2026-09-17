-- Menutup empat lubang pencatatan uang di POS.
--
-- Keempatnya punya pola yang sama: layarnya sudah menanyakan hal yang benar,
-- tapi jawabannya tidak pernah sampai ke basis data. Owner melihat kolom
-- terisi di layar kasir dan menyimpulkan datanya tercatat.

-- ---------------------------------------------------------------------------
-- 1. Alasan diskon
-- ---------------------------------------------------------------------------
-- Kasir sudah memilih alasan tiap kali memberi keringanan, dan layarnya bahkan
-- menampilkan alasan itu di tombol. Tapi `createOrderAction` tidak punya
-- parameternya, jadi alasannya berhenti di browser. Yang tersimpan cuma
-- nominal diskonnya.
--
-- Akibatnya owner bisa melihat diskon Rp 500.000 sebulan tanpa satu pun cara
-- tahu itu keringanan buat siapa. Diskon tanpa alasan bukan diskon, itu selisih
-- kas yang tidak bisa dipertanggungjawabkan.
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS discount_reason TEXT;

COMMENT ON COLUMN public.orders.discount_reason IS
  'Alasan diskon diberikan, wajib ada kalau discount > 0. Diisi kasir saat checkout.';

-- ---------------------------------------------------------------------------
-- 2. Metode pengembalian dana
-- ---------------------------------------------------------------------------
-- Metode refund sebelumnya dijejalkan ke dalam kalimat alasan seperti
-- "(Metode: CASH)". Bisa dibaca manusia, tidak bisa dijumlahkan mesin. Jadi
-- pertanyaan "hari ini berapa yang keluar dari laci kas, dan berapa yang balik
-- lewat QRIS" tidak punya jawaban, padahal itu yang dicocokkan owner tiap tutup
-- shift.
ALTER TABLE public.refunds
  ADD COLUMN IF NOT EXISTS method TEXT NOT NULL DEFAULT 'cash';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.refunds'::regclass AND conname = 'refunds_method_check'
  ) THEN
    ALTER TABLE public.refunds
      ADD CONSTRAINT refunds_method_check CHECK (method IN ('cash', 'qris', 'transfer'));
  END IF;
END $$;

-- Kategori alasan sebagai kolom sendiri, bukan awalan "[KATEGORI]" di teks.
ALTER TABLE public.refunds
  ADD COLUMN IF NOT EXISTS reason_code TEXT;

-- ---------------------------------------------------------------------------
-- 3. Refund per item
-- ---------------------------------------------------------------------------
-- Satu menu dari lima yang dikomplain tidak sama dengan membatalkan seluruh
-- nota. Tanpa kolom ini refund selalu terbaca sebagai refund satu pesanan
-- penuh, dan laporan menu mana yang paling sering dikembalikan tidak bisa
-- dibuat sama sekali.
ALTER TABLE public.refunds
  ADD COLUMN IF NOT EXISTS order_item_id UUID REFERENCES public.order_items(id) ON DELETE SET NULL;

COMMENT ON COLUMN public.refunds.order_item_id IS
  'NULL berarti refund seluruh pesanan. Terisi berarti refund satu item saja.';

-- ---------------------------------------------------------------------------
-- 4. HPP dikunci saat transaksi
-- ---------------------------------------------------------------------------
-- `order_items` sudah menyimpan name_snapshot dan price_snapshot supaya harga
-- jual masa lalu tidak ikut berubah. Modalnya tidak. Laporan laba menghitung
-- ulang HPP dari harga bahan HARI INI, jadi menaikkan harga satu bahan
-- mengubah laba transaksi bulan lalu.
--
-- Owner yang mencetak laporan dua kali dengan angka berbeda akan berhenti
-- mempercayai laporannya, dan dia benar.
--
-- NULL punya arti: HPP memang belum diketahui saat penjualan terjadi, karena
-- menunya belum punya resep maupun modal pokok. Itu ditandai "belum lengkap"
-- di laporan, bukan dihitung nol lalu dilaporkan sebagai laba penuh.
ALTER TABLE public.order_items
  ADD COLUMN IF NOT EXISTS cost_snapshot BIGINT;

COMMENT ON COLUMN public.order_items.cost_snapshot IS
  'HPP per satu unit saat transaksi dicatat. NULL = menu belum punya resep/modal pokok waktu itu, jadi labanya tidak dihitung, bukan dianggap nol.';

-- ---------------------------------------------------------------------------
-- 5. Jejak penggantian item
-- ---------------------------------------------------------------------------
-- Penggantian menu yang habis sebelumnya MENIMPA name_snapshot dan
-- price_snapshot pada barisnya. Padahal komentar tabelnya sendiri berbunyi
-- "snapshot harga untuk menjamin keaslian audit masa lalu".
--
-- Jadi setelah penggantian, tidak ada satu pun cara tahu pelanggan sebenarnya
-- memesan apa. Tabel ini menyimpan yang lama supaya barisnya boleh berubah
-- mengikuti apa yang benar-benar disajikan, tanpa riwayatnya ikut hilang.
CREATE TABLE IF NOT EXISTS public.order_item_changes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  order_item_id UUID REFERENCES public.order_items(id) ON DELETE SET NULL,

  -- Apa yang dipesan semula.
  old_menu_item_id UUID REFERENCES public.menu_items(id) ON DELETE SET NULL,
  old_name TEXT NOT NULL,
  old_price BIGINT NOT NULL,

  -- Apa yang akhirnya disajikan.
  new_menu_item_id UUID REFERENCES public.menu_items(id) ON DELETE SET NULL,
  new_name TEXT NOT NULL,
  new_price BIGINT NOT NULL,

  qty INT NOT NULL CHECK (qty > 0),
  price_diff BIGINT NOT NULL,

  -- Selisihnya diselesaikan bagaimana. Tidak boleh menggantung: pesanan yang
  -- totalnya berubah tapi tidak pernah ditagih atau dikembalikan adalah selisih
  -- kas yang muncul lagi saat tutup shift, tanpa ada yang ingat penyebabnya.
  settlement TEXT NOT NULL CHECK (settlement IN ('none', 'collect', 'refund', 'waive')),
  reason TEXT,
  changed_by UUID REFERENCES public.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE public.order_item_changes IS
  'Riwayat penggantian item pesanan. Barisnya permanen: order_items boleh berubah mengikuti yang disajikan, riwayat pesanan aslinya tetap di sini.';

CREATE INDEX IF NOT EXISTS idx_order_item_changes_order
  ON public.order_item_changes (order_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_order_item_changes_business
  ON public.order_item_changes (business_id, created_at DESC);

ALTER TABLE public.order_item_changes ENABLE ROW LEVEL SECURITY;
