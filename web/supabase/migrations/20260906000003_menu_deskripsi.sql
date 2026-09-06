-- Deskripsi menu.
--
-- Halaman pesan dari meja selama ini cuma punya nama dan harga. Untuk warung
-- itu cukup — orang sudah tahu bakso itu apa. Untuk kafe tidak: "Manual Brew
-- V60" dan "Kopi Susu Gula Aren" adalah dua hal yang perlu dijelaskan sebelum
-- orang berani memesan, dan yang tidak dijelaskan tidak dipesan.
--
-- Opsional dengan sengaja. Menu yang tidak butuh penjelasan tidak boleh
-- memaksa pemiliknya mengarang satu.

ALTER TABLE public.menu_items
  ADD COLUMN IF NOT EXISTS description TEXT CHECK (char_length(description) <= 300);

COMMENT ON COLUMN public.menu_items.description IS
  'Penjelasan singkat yang tampil di bawah nama menu pada halaman pesan. Opsional.';

COMMENT ON COLUMN public.menu_items.photo_url IS
  'Alamat gambar menu. Ditempel pemiliknya sebagai URL; KAEL belum menyimpan berkas sendiri.';
