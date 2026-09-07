ALTER TABLE public.ingredients ADD COLUMN IF NOT EXISTS category TEXT;
ALTER TABLE public.ingredients ADD COLUMN IF NOT EXISTS brand TEXT;
ALTER TABLE public.ingredients ADD COLUMN IF NOT EXISTS supplier_name TEXT;
ALTER TABLE public.ingredients ADD COLUMN IF NOT EXISTS notes TEXT;

ALTER TABLE public.ingredients DROP CONSTRAINT IF EXISTS ingredients_category_check;
ALTER TABLE public.ingredients ADD CONSTRAINT ingredients_category_check
  CHECK (category IS NULL OR category IN ('bahan_baku', 'kemasan', 'barang_kulakan', 'lainnya'));

UPDATE public.ingredients SET category = 'bahan_baku' WHERE category IS NULL;
