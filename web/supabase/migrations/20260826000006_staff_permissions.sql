-- ==============================================================================
-- Hak akses per karyawan
--
-- Sebelumnya semua staf punya akses yang sama: siapa pun yang bisa masuk sebagai
-- staf bisa membuka kasir DAN loyalty. Pemilik usaha tidak punya cara membatasi
-- karyawan tertentu.
--
-- Sekarang tiap staf punya daftar modul yang boleh dibuka, ditentukan owner.
--
-- Yang TIDAK pernah bisa diberikan ke staf, berapa pun izinnya:
--   - KAEL Finance (HPP, margin, harga modal)
--   - Laporan penjualan dan laba
--   - Pengelolaan akun staf dan pengaturan bisnis
--   - Refund
-- Batas itu ditegakkan di kode lewat requireOwner, bukan lewat kolom ini.
-- ==============================================================================

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS permissions TEXT[] NOT NULL DEFAULT ARRAY['pos']::TEXT[];

COMMENT ON COLUMN public.users.permissions IS
  'Modul yang boleh dibuka staf: pos, loyalty, review. Diabaikan untuk owner dan kael_admin yang aksesnya ditentukan peran.';

-- Staf yang sudah ada tetap seperti sebelumnya: kasir dan loyalty.
UPDATE public.users
SET permissions = ARRAY['pos', 'loyalty']::TEXT[]
WHERE role = 'staff';
