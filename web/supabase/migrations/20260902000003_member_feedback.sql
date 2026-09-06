-- Feedback pascatransaksi. Pintu masuknya halaman struk (/receipt/[id]),
-- yang sudah terbuka tanpa login dan sudah dibagikan ke pelanggan — tidak ada
-- halaman baru yang perlu dibuat, tidak ada ajakan baru yang perlu dikirim.
--
-- order_id WAJIB, bukan opsional: ini feedback PASCATRANSAKSI, jadi setiap
-- baris harus menunjuk transaksi sungguhan. customer_id tetap boleh kosong —
-- pelanggan non-member yang baru sekali belanja juga berharga didengar.

CREATE TABLE IF NOT EXISTS public.member_feedback (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
    customer_id UUID REFERENCES public.customers(id) ON DELETE SET NULL,
    order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
    rating INT NOT NULL CHECK (rating BETWEEN 1 AND 5),
    -- Diisi kalau rating rendah (≤3): daftar tertutup supaya bisa diringkas
    -- jadi "masalah yang sering muncul", bukan cuma kumpulan teks bebas.
    reason_code TEXT CHECK (reason_code IN ('rasa', 'harga', 'antrean', 'pelayanan', 'kebersihan', 'lainnya')),
    comment TEXT CHECK (char_length(comment) <= 500),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    -- Tautan struk bisa dibuka berkali-kali; satu pesanan cuma boleh
    -- meninggalkan satu feedback.
    CONSTRAINT uq_feedback_per_order UNIQUE (order_id)
);

COMMENT ON TABLE public.member_feedback IS 'Rating dan alasan singkat pascatransaksi, dikirim dari halaman struk. Satu baris per pesanan.';

CREATE INDEX IF NOT EXISTS idx_member_feedback_business_created
    ON public.member_feedback (business_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_member_feedback_reason
    ON public.member_feedback (business_id, reason_code) WHERE reason_code IS NOT NULL;

ALTER TABLE public.member_feedback ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Business staff and owner can view feedback"
ON public.member_feedback FOR SELECT
USING (business_id = public.get_auth_business_id());
