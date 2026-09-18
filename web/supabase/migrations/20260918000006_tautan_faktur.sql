-- Tautan pendek untuk QR faktur WhatsApp.
--
-- QR faktur tadinya membawa seluruh isi fakturnya: nomor, daftar menu, ongkir,
-- dan total, semuanya di-URL-encode ke dalam tautan wa.me. Pesanan tiga item
-- saja sudah menghasilkan QR versi 19 — 93x93 modul di kotak 200 piksel, dua
-- piksel per modul. Pesanan lima belas item jadi versi 28. QR serapat itu
-- tidak terbaca andal oleh kamera HP dari layar laptop, dan fitur ini gagal
-- persis di depan pelanggannya.
--
-- Sekarang QR-nya cuma membawa /f/<token>. Isinya dibangun server saat token
-- itu dibuka, lalu dialihkan ke wa.me. QR-nya jadi versi kecil berapa pun
-- panjang pesanannya.
--
-- Sekalian menutup satu kebocoran: QR lama memuat nomor WhatsApp pelanggan
-- secara utuh dan berlaku selamanya — siapa pun yang memotret layar kasir
-- menyimpan nomor itu. Token ini kedaluwarsa dalam hitungan menit.

CREATE TABLE IF NOT EXISTS public.invoice_links (
    token TEXT PRIMARY KEY CHECK (char_length(token) BETWEEN 10 AND 40),
    business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
    order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
    /*
     * Nomor tujuan disimpan di sini, bukan diambil ulang dari pesanan saat
     * token dibuka. Kasir boleh mengetik nomor yang tidak ada di pesanan mana
     * pun — pelanggan walk-in yang bilang "kirim ke WA saya" — dan nomor itu
     * tidak disimpan ke tempat lain.
     */
    nomor TEXT NOT NULL CHECK (nomor ~ '^[0-9]{10,15}$'),
    created_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at TIMESTAMPTZ NOT NULL
);

COMMENT ON TABLE public.invoice_links IS
  'Tautan pendek /f/<token> untuk QR faktur WhatsApp. Berumur pendek; dibersihkan saat tautan baru dibuat.';

CREATE INDEX IF NOT EXISTS idx_invoice_links_expires ON public.invoice_links (expires_at);

ALTER TABLE public.invoice_links ENABLE ROW LEVEL SECURITY;
