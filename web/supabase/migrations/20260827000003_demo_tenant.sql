-- Penanda tenant demo.
--
-- Cara menawarkan KAEL ke calon pembeli adalah menyiapkan satu tenant berisi
-- nama, menu, harga, dan staf usaha itu sendiri, lalu menunjukkannya langsung
-- ke pemiliknya. Artinya tiap calon yang didatangi meninggalkan satu bisnis
-- baru di tabel ini, dan sebagian besar calon tidak jadi membeli.
--
-- Tanpa penanda, tenant demo tidak bisa dibedakan dari pelanggan sungguhan.
-- Akibatnya sudah pernah terjadi sekali di proyek ini dan harus dibereskan
-- dengan skrip sekali pakai yang berisi daftar id yang ditulis tangan
-- (scratch-cleanup-dummy.mjs). Daftar seperti itu tidak punya cara memastikan
-- id yang dihapus benar-benar data demo.
--
-- Dua kolom di bawah membuat pertanyaan "ini demo atau pelanggan?" bisa
-- dijawab oleh basis data, bukan oleh ingatan orang yang menyiapkannya.

ALTER TABLE public.businesses
  ADD COLUMN IF NOT EXISTS is_demo BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE public.businesses
  ADD COLUMN IF NOT EXISTS demo_expires_at DATE;

COMMENT ON COLUMN public.businesses.is_demo IS
  'TRUE untuk tenant peragaan yang disiapkan tim KAEL atas nama calon pembeli. Hanya baris seperti ini yang boleh disentuh skrip pembersih.';

COMMENT ON COLUMN public.businesses.demo_expires_at IS
  'Tanggal tenant demo boleh dihapus. Wajib terisi untuk demo, wajib kosong untuk pelanggan sungguhan.';

-- ---------------------------------------------------------------------------
-- Kedua kolom wajib sepakat
-- ---------------------------------------------------------------------------
--
-- Arah pertama menutup demo abadi: demo tanpa tanggal tidak akan pernah
-- terjaring pembersih, dan justru demo yang tidak jadi dibeli itulah yang
-- paling mungkin dilupakan.
--
-- Arah kedua menutup salah sasaran: pelanggan sungguhan tidak boleh punya
-- tanggal kedaluwarsa yang suatu saat membuat seseorang mengira datanya
-- memang dimaksudkan untuk dihapus.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conrelid = 'public.businesses'::regclass
       AND conname = 'businesses_demo_expiry_check'
  ) THEN
    ALTER TABLE public.businesses
      ADD CONSTRAINT businesses_demo_expiry_check
      CHECK (
        (is_demo = FALSE AND demo_expires_at IS NULL)
        OR
        (is_demo = TRUE AND demo_expires_at IS NOT NULL)
      );
  END IF;
END $$;
