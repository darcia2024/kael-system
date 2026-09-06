-- Satu member hanya boleh punya SATU kode referral per bisnis.
--
-- getOrCreateReferralCode melakukan baca-lalu-tulis: dia mencari kode yang
-- sudah ada, dan kalau tidak ketemu, membuat yang baru. Di antara dua langkah
-- itu tidak ada penjaga apa pun. Dua permintaan yang datang bersamaan —
-- misalnya member membuka kartunya dari dua perangkat, atau menyegarkan
-- halaman saat yang pertama belum selesai — sama-sama tidak menemukan apa
-- pun, lalu sama-sama menulis. Hasilnya dua kode aktif untuk satu orang, dan
-- getReferralReport (yang LEFT JOIN ke loyalty_codes) akan menggandakan baris
-- pengajak itu di laporan.
--
-- Indeks parsial, bukan constraint tabel penuh: kolom owner_customer_id juga
-- dipakai NULL oleh kode campaign, dan UNIQUE biasa akan salah menghalangi
-- baris-baris itu.

CREATE UNIQUE INDEX IF NOT EXISTS uq_loyalty_codes_referral_owner
    ON public.loyalty_codes (business_id, owner_customer_id)
    WHERE source = 'referral' AND owner_customer_id IS NOT NULL;
