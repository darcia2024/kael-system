-- Analitik pertumbuhan member (Fitur 5) menyaring business_id LALU rentang
-- waktu, di dua tabel: point_ledger dan customers. Indeks yang ada sekarang
-- (idx_ledger_business, idx_customers_business_id) cuma satu kolom, jadi
-- filter rentang waktunya tetap memaksa scan semua baris bisnis itu.
--
-- Diperbaiki di sini, sebelum dashboardnya dipakai — bukan nanti setelah ada
-- owner dengan ribuan baris ledger yang mengeluh lambat.

CREATE INDEX IF NOT EXISTS idx_ledger_business_time
    ON public.point_ledger (business_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_customers_business_created
    ON public.customers (business_id, created_at DESC);
