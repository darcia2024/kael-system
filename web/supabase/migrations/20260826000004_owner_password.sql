-- ==============================================================================
-- Kata sandi untuk akun owner dan kael_admin
--
-- Sebelum ini, masuk sebagai owner hanya perlu alamat email. Siapa pun yang
-- tahu email pemilik usaha bisa membuka seluruh laporan dan pengaturannya.
--
-- Staf tetap memakai PIN 6 digit (kolom pin_hash): kasir berbagi perangkat dan
-- harus bisa berganti shift dalam hitungan detik. Owner memakai kata sandi
-- penuh karena aksesnya jauh lebih luas.
--
-- Format kolom sama dengan pin_hash: scrypt$<salt hex>$<hash hex>
-- ==============================================================================

ALTER TABLE public.users ADD COLUMN IF NOT EXISTS password_hash TEXT;

COMMENT ON COLUMN public.users.password_hash IS
  'Hash scrypt kata sandi owner/kael_admin. NULL berarti akun belum menyetel kata sandi dan tidak bisa dipakai masuk.';

-- Batasan lama hanya mensyaratkan email untuk owner. Sekarang email tetap
-- wajib, dan verifikasi kata sandi ditegakkan di lapisan aplikasi supaya akun
-- lama tidak langsung terkunci sebelum sempat menyetel kata sandi.
