-- Isi kartu member yang diatur pemilik usaha.
--
-- Kartu member sebelumnya cuma menampilkan saldo poin dan katalog hadiah. Itu
-- cukup sebagai catatan, tapi bukan sesuatu yang orang buka lagi minggu depan.
-- Yang membuat orang membukanya lagi adalah isinya: jam buka, alamat, menu,
-- dan kabar dari tokonya.
--
-- Tabel terpisah, bukan kolom tambahan di businesses, karena semua yang di
-- sini dikarang pemilik usaha untuk dibaca pelanggannya — beda urusan dari
-- kolom businesses yang dipegang tim KAEL (logo, warna, kode toko, status
-- demo). Batas kepemilikan itu yang membuat panel admin dan panel pemilik
-- tidak pernah saling menimpa.

CREATE TABLE IF NOT EXISTS public.member_card_settings (
    business_id UUID PRIMARY KEY REFERENCES public.businesses(id) ON DELETE CASCADE,

    -- Sapaan di kepala kartu. NULL berarti pakai bawaan "Kartu Member <toko>".
    headline TEXT CHECK (char_length(headline) <= 60),
    welcome_text TEXT CHECK (char_length(welcome_text) <= 200),

    -- Info toko yang berguna dibuka pelanggan berulang kali.
    opening_hours TEXT CHECK (char_length(opening_hours) <= 120),
    instagram TEXT CHECK (char_length(instagram) <= 100),

    /*
     * Nomor WhatsApp toko untuk tombol "simpan ke WhatsApp". Terpisah dari
     * businesses.phone: yang di businesses itu nomor administratif yang
     * dipegang tim KAEL, sedangkan ini nomor yang benar-benar dijawab orang
     * saat pelanggan mengirim pesan. Sering beda, dan yang salah kirim ke
     * nomor administratif tidak akan pernah dibalas.
     */
    whatsapp TEXT CHECK (char_length(whatsapp) <= 20),

    -- Kabar bebas: promo minggu ini, libur, menu baru.
    announcement TEXT CHECK (char_length(announcement) <= 300),

    -- Menu ikut tampil di kartu. Toko jasa yang tidak punya menu mematikannya.
    show_menu BOOLEAN NOT NULL DEFAULT TRUE,

    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE public.member_card_settings IS
  'Isi kartu member yang dikarang pemilik usaha. Logo dan warna TIDAK di sini: keduanya kolom businesses yang dipegang tim KAEL.';

ALTER TABLE public.member_card_settings ENABLE ROW LEVEL SECURITY;

/*
 * Menandai kunjungan, bukan cuma nominalnya.
 *
 * Mode stempel memberi satu stempel per transaksi yang lolos minimum belanja.
 * Tanpa kolom ini, "sudah berapa kali datang" harus dihitung ulang dari
 * point_ledger setiap kali kartunya dibuka, dan angka yang dilihat pelanggan
 * jadi bergantung pada apakah baris koreksi manual owner ikut terhitung atau
 * tidak. Kunjungan adalah kejadian tersendiri; disimpan tersendiri.
 */
ALTER TABLE public.point_ledger
  ADD COLUMN IF NOT EXISTS is_visit BOOLEAN NOT NULL DEFAULT FALSE;

COMMENT ON COLUMN public.point_ledger.is_visit IS
  'Baris ini mewakili satu kedatangan yang lolos minimum belanja. Dipakai menghitung progres stempel.';

CREATE INDEX IF NOT EXISTS idx_point_ledger_visits
  ON public.point_ledger (business_id, customer_id, created_at DESC) WHERE is_visit;
