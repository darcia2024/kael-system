-- Berapa banyak orang yang membuka menu digital.
--
-- Owner yang mencetak QR di tiap meja tidak punya cara tahu apakah QR itu
-- benar-benar dipindai, atau cuma tertempel diam. Tanpa angka ini, "menu
-- digital sepi" dan "menu digital ramai tapi tidak ada yang pesan" terlihat
-- identik dari kasir — padahal dua masalah itu solusinya berbeda total.
--
-- Yang disimpan sengaja SEDIKIT: tidak ada IP, tidak ada user-agent, tidak
-- ada apa pun yang bisa dipakai mengenali orangnya. Ini hitungan kunjungan,
-- bukan pelacakan pengunjung.

CREATE TABLE IF NOT EXISTS public.menu_page_views (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,

  -- Apa adanya seperti QR yang dipindai, untuk ditampilkan per meja.
  table_no TEXT NOT NULL,
  -- Bentuk baku, supaya "Meja 5" dan "meja 05" terhitung sebagai meja yang sama.
  table_key TEXT NOT NULL,

  viewed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE public.menu_page_views IS
  'Kunjungan ke menu digital per meja. Satu baris kira-kira satu tamu membuka menunya — dedup sekali per meja per hari dilakukan di browser, bukan di sini, supaya satu tamu yang membuka-tutup layarnya berkali-kali tidak terhitung berkali-kali.';

-- Laporan selalu membaca satu toko dan satu rentang waktu.
CREATE INDEX IF NOT EXISTS idx_menu_page_views_bisnis_waktu
  ON public.menu_page_views (business_id, viewed_at DESC);

ALTER TABLE public.menu_page_views ENABLE ROW LEVEL SECURITY;
