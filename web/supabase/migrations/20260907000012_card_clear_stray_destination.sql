-- Membersihkan alamat tujuan yang menempel di kartu yang tidak memakainya.
--
-- Layar aktivasi lama cuma punya dua cabang: kartu `link` mengetik alamat
-- sendiri, dan SEMUA jenis lain dilempar ke pemilih tempat Google. Jadi kartu
-- member dan kartu absensi ikut pulang membawa alamat ulasan Google — alamat
-- yang tidak pernah dibaca rute mana pun, tapi tetap tampil di dasbor seolah
-- kartu itu juga melayani ulasan.
--
-- Yang membaca destination_url cuma dua layanan:
--
--     review -> alamat ulasan Google, dipakai setelah pelanggan memberi bintang tinggi
--     link   -> alamat yang dibuka begitu kartu di-tap
--
-- Sisanya menentukan tujuannya dari layanannya sendiri. Alamat yang tersimpan
-- di sana bukan konfigurasi yang tertunda, melainkan sisa dari layar yang
-- memaksa mengisinya. Dihapus supaya isi basis data mengatakan hal yang sama
-- dengan yang dikerjakan kartunya.

UPDATE public.cards
SET destination_url = NULL
WHERE destination_url IS NOT NULL
  AND type NOT IN ('review', 'link');
