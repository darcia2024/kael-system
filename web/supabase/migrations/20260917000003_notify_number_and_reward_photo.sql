-- Dua hal kecil yang bikin fitur terlihat ada padahal belum jalan.

-- ---------------------------------------------------------------------------
-- 1. Nomor penerima notifikasi owner
-- ---------------------------------------------------------------------------
-- Selama ini ada tiga nomor WhatsApp yang berbeda peran, tapi cuma dua yang
-- punya tempat:
--
--     businesses.phone                       nomor administratif, dipegang tim KAEL
--     member_card_settings.whatsapp          nomor yang dijawab orang saat pelanggan chat
--     business_messaging_channels.sender_phone nomor PENGIRIM pesan otomatis
--
-- Yang belum ada: ke mana kabar operasional dikirim. Pesanan QR masuk, stok
-- menipis, shift ditutup dengan selisih — semua itu untuk owner, dan owner
-- sering bukan orang yang memegang nomor pengirim. Tanpa kolom ini, satu-satunya
-- cara mengirimnya adalah menembak ke nomor pengirim itu sendiri, yang berarti
-- pesan masuk ke nomor toko dan menumpuk bersama chat pelanggan.
ALTER TABLE public.business_messaging_channels
  ADD COLUMN IF NOT EXISTS owner_notify_phone TEXT;

COMMENT ON COLUMN public.business_messaging_channels.owner_notify_phone IS
  'Nomor WhatsApp yang MENERIMA kabar operasional. Berbeda dari sender_phone yang MENGIRIM pesan ke pelanggan; owner sering bukan orang yang memegang HP toko.';

-- ---------------------------------------------------------------------------
-- 2. Foto hadiah
-- ---------------------------------------------------------------------------
-- Katalog hadiah sudah bisa dikelola owner, tapi hadiahnya cuma berupa nama dan
-- angka poin. Pelanggan yang membuka daftar hadiah melihat daftar teks, dan
-- hadiah yang tidak bisa dibayangkan bentuknya tidak membuat siapa pun ingin
-- mengumpulkan poin.
ALTER TABLE public.rewards
  ADD COLUMN IF NOT EXISTS image_url TEXT;

COMMENT ON COLUMN public.rewards.image_url IS
  'Foto hadiah, https saja. NULL berarti kartu hadiah memakai inisial namanya.';

-- Nilai jual hadiah dipakai laporan untuk menghitung berapa rupiah yang
-- ditukarkan lewat poin. Kolomnya sudah dipakai kode sejak lama; dipastikan ada
-- di sini supaya basis data yang belum sempat menerimanya ikut menyusul.
ALTER TABLE public.rewards
  ADD COLUMN IF NOT EXISTS market_value BIGINT NOT NULL DEFAULT 0;
