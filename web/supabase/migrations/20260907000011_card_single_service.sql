-- Satu kartu, satu layanan.
--
-- Sebelum ini jenis `link` diam-diam melayani DUA hal sekaligus, dan yang
-- menang ditentukan urutan pemeriksaan di /r/[code]:
--
--     if (punya Smart Touch) -> /touch/{kode}     <- menang duluan
--     else                   -> destination_url
--
-- Jadi pemilik kartu bisa mengisi tautan tujuan, lalu belakangan menambah
-- tombol Smart Touch, dan tautan tadi berhenti dipakai tanpa satu pun
-- keterangan di layar. Kartu yang sama menampilkan dua janji berbeda.
--
-- Perbaikannya memisahkan keduanya jadi jenis sendiri-sendiri, supaya
-- cards.type menjadi satu-satunya jawaban atas "kartu ini buat apa":
--
--     review       -> halaman penilaian bintang, lalu lanjut ke Google
--     link         -> satu tautan tunggal, titik
--     smart_touch  -> daftar tombol pilihan
--     loyalty      -> kartu member
--     attendance   -> absensi staf
--
-- Tidak ada lagi jenis yang punya cadangan ke jenis lain.

ALTER TABLE public.cards DROP CONSTRAINT IF EXISTS cards_type_check;
ALTER TABLE public.cards ADD CONSTRAINT cards_type_check
    CHECK (type IN ('review', 'loyalty', 'attendance', 'link', 'smart_touch'));

-- Kartu `link` yang SUDAH terlanjur punya profil Smart Touch memang sedang
-- dipakai sebagai kartu Smart Touch — itu yang menang di rute lama. Jadi
-- jenisnya disesuaikan dengan perilakunya yang sekarang, bukan sebaliknya:
-- mengubah perilaku kartu yang sudah beredar di meja orang jauh lebih mahal
-- daripada mengubah satu nilai kolom.
UPDATE public.cards c
SET type = 'smart_touch'
WHERE c.type = 'link'
  AND EXISTS (SELECT 1 FROM public.smart_touch_profiles p WHERE p.card_id = c.id);

COMMENT ON COLUMN public.cards.type IS
  'Satu kartu melayani TEPAT satu hal. review: halaman penilaian lalu Google. link: satu tautan tunggal. smart_touch: daftar tombol. loyalty: kartu member. attendance: absensi staf. Tidak ada jenis yang punya jalur cadangan ke jenis lain.';
