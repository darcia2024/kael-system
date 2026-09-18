-- Catatan pesanan dan jeda panggilan.
--
-- CATATAN PESANAN
--
-- Tamu boleh memasukkan menu ke keranjang di halaman meja, tapi keranjang itu
-- TIDAK membuat pesanan dan tidak menagih apa pun. Gunanya cuma satu: menjadi
-- catatan yang ikut terkirim saat tombol panggil ditekan.
--
-- Yang berubah karenanya ada di pihak pelayan, bukan tamu. Sebelumnya pelayan
-- datang tanpa tahu apa-apa, mencatat dari nol di depan meja, lalu baru
-- mengecek satu per satu mana yang habis. Dengan catatan ini dia sudah tahu
-- duluan — dan bisa langsung bilang "yang ini kosong, mau diganti apa?" saat
-- pertama kali sampai di meja, bukan setelah bolak-balik ke dapur.
--
-- Disimpan sebagai JSONB, bukan tabel anak. Isinya bukan transaksi: tidak
-- pernah jadi dasar tagihan, tidak dipakai laporan, dan boleh saja berbeda
-- dengan yang akhirnya benar-benar dipesan. Membuatkannya tabel sendiri justru
-- memberi kesan angka di dalamnya bisa dipertanggungjawabkan.

ALTER TABLE public.table_calls
  ADD COLUMN IF NOT EXISTS catatan_pesanan JSONB;

COMMENT ON COLUMN public.table_calls.catatan_pesanan IS
  'Daftar menu yang ditandai tamu di halaman meja. CATATAN saja — bukan pesanan, bukan tagihan, dan tidak pernah jadi dasar perhitungan uang.';

-- ---------------------------------------------------------------------------
-- JEDA PANGGIL ULANG
-- ---------------------------------------------------------------------------
--
-- Tamu yang merasa lama akan menekan tombolnya berkali-kali. Barisnya memang
-- sudah tidak menggandakan, tapi tanpa jeda tiap tekanan tetap membunyikan
-- kasir — dan kasir yang dibunyikan sepuluh kali oleh meja yang sama akan
-- mulai mengabaikan bunyinya. Saat itu terjadi, meja LAIN yang benar-benar
-- menunggu ikut tidak terdengar.
--
-- Karena itu panggil ulang diberi jeda, dan yang tercatat bukan waktu
-- panggilan awalnya yang tergeser: created_at tetap utuh supaya "sudah
-- menunggu berapa lama" tidak pernah bisa disembunyikan dengan menekan lagi.

ALTER TABLE public.table_calls
  ADD COLUMN IF NOT EXISTS ping_terakhir TIMESTAMPTZ NOT NULL DEFAULT NOW();

ALTER TABLE public.table_calls
  ADD COLUMN IF NOT EXISTS jumlah_ping INT NOT NULL DEFAULT 1;

COMMENT ON COLUMN public.table_calls.ping_terakhir IS
  'Kapan terakhir tamu menekan tombol panggil. created_at sengaja tidak ikut bergeser supaya lama menunggu tetap terbaca apa adanya.';

COMMENT ON COLUMN public.table_calls.jumlah_ping IS
  'Sudah berapa kali tamu menekan. Naik satu tiap panggil ulang, dan inilah yang dipakai layar kasir untuk tahu harus berbunyi lagi.';
