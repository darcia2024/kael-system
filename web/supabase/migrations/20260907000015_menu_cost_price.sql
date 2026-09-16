-- ==============================================================================
-- KAEL SYSTEM · MENU COST PRICE (MODAL / HPP PER UNIT)
-- ==============================================================================

ALTER TABLE public.menu_items
  ADD COLUMN IF NOT EXISTS cost_price BIGINT DEFAULT 0 CHECK (cost_price >= 0);

COMMENT ON COLUMN public.menu_items.cost_price IS
  'Modal pokok atau HPP per unit/porsi menu (Rp). Digunakan untuk menghitung estimasi laba kotor penjualan langsung tanpa harus membuat resep terpisah.';
