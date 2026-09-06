-- Penyimpanan gambar yang diunggah pemilik usaha.
--
-- KENAPA DI POSTGRES, BUKAN OBJECT STORAGE
-- Proyek ini tidak punya kredensial penyimpanan berkas sama sekali: tidak ada
-- SUPABASE_SERVICE_ROLE_KEY, tidak ada BLOB_READ_WRITE_TOKEN. Menambahkannya
-- berarti menyalakan layanan baru, menaruh kunci baru, dan menunggu orangnya
-- sempat melakukan itu — sementara pemilik kafe yang sedang dilayani hari ini
-- cuma ingin memotret menunya.
--
-- Gambarnya sendiri diperkecil di peramban sebelum dikirim: sisi terpanjang
-- 800 piksel, WebP, dan ditolak di atas 400 KB. Empat puluh menu karena itu
-- berukuran beberapa megabita, bukan ratusan.
--
-- Ini keputusan yang sengaja dibuat mudah dibatalkan. Yang disimpan di
-- menu_items tetap sekadar alamat pada kolom photo_url, jadi pindah ke object
-- storage nanti berarti mengganti satu fungsi unggah dan menulis ulang
-- alamatnya — bukan membongkar skema.

CREATE TABLE IF NOT EXISTS public.uploaded_images (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
    -- Daftar tertutup. SVG SENGAJA tidak ada di sini: dia bisa memuat skrip,
    -- dan berkas ini disajikan dari domain yang sama dengan aplikasinya.
    mime TEXT NOT NULL CHECK (mime IN ('image/webp', 'image/jpeg', 'image/png')),
    bytes BYTEA NOT NULL,
    byte_size INT NOT NULL CHECK (byte_size > 0 AND byte_size <= 400 * 1024),
    width INT,
    height INT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE public.uploaded_images IS
  'Gambar yang diunggah pemilik usaha, disajikan lewat /api/gambar/[id]. Barisnya tidak pernah diperbarui: unggahan baru membuat baris baru, sehingga alamatnya boleh di-cache selamanya.';

CREATE INDEX IF NOT EXISTS idx_uploaded_images_business
    ON public.uploaded_images (business_id, created_at DESC);

ALTER TABLE public.uploaded_images ENABLE ROW LEVEL SECURITY;
