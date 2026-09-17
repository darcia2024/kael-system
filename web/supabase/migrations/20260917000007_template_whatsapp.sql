-- Nama template WhatsApp, tanpanya pengiriman otomatis KAEL tidak akan pernah
-- sampai.
--
-- JENDELA 24 JAM
--
-- WhatsApp Cloud API hanya mengizinkan pesan teks bebas ke nomor yang MENGIRIM
-- pesan ke nomor bisnis dalam 24 jam terakhir. Di luar jendela itu, teks bebas
-- ditolak dengan galat 131047, dan satu-satunya yang boleh dikirim adalah
-- template yang sudah disetujui Meta.
--
-- Dua pemakaian WhatsApp di KAEL justru selalu di luar jendela itu:
--
--   kabar refund ke owner  owner tidak pernah mengirim pesan ke nomor tokonya
--   tautan kartu member    pelanggan memintanya lewat halaman web, bukan chat
--
-- Jadi tanpa template, keduanya hampir selalu gagal terkirim — dan gagalnya
-- diam-diam, karena yang menunggu pesannya tidak tahu harus mengeluh ke siapa.
--
-- Kolom ini menyimpan NAMA template yang sudah disetujui, bukan isinya. Isinya
-- ada di Meta, dan tiap perubahan kalimat harus lewat persetujuan mereka lagi.

ALTER TABLE public.business_messaging_channels
  ADD COLUMN IF NOT EXISTS template_notifikasi TEXT;

ALTER TABLE public.business_messaging_channels
  ADD COLUMN IF NOT EXISTS template_tautan_member TEXT;

-- Bahasa template harus sama persis dengan yang didaftarkan di Meta; "id"
-- untuk Bahasa Indonesia. Template yang benar namanya tapi salah bahasanya
-- tetap ditolak.
ALTER TABLE public.business_messaging_channels
  ADD COLUMN IF NOT EXISTS template_bahasa TEXT NOT NULL DEFAULT 'id';

COMMENT ON COLUMN public.business_messaging_channels.template_notifikasi IS
  'Nama template Meta untuk kabar operasional ke owner. Kosong berarti dicoba sebagai teks bebas, yang cuma berhasil kalau owner mengirim pesan ke nomor toko dalam 24 jam terakhir.';

COMMENT ON COLUMN public.business_messaging_channels.template_tautan_member IS
  'Nama template Meta untuk mengirim ulang tautan kartu member. Kosong berarti teks bebas, dan hampir selalu gagal karena pelanggan memintanya lewat halaman web, bukan chat.';
