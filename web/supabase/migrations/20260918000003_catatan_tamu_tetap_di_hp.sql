-- Catatan tamu tetap di HP-nya, tidak pernah dikirim ke kasir.
--
-- Kolom `catatan_pesanan` dibuat dengan anggapan yang keliru: bahwa daftar menu
-- yang ditandai tamu di halaman meja sebaiknya ikut terkirim ke layar kasir,
-- supaya pelayan sampai di meja sudah tahu mau apa.
--
-- Yang diinginkan pemilik Mochi bukan itu. Keranjang di halaman meja gunanya
-- sekadar MENGGANTI PULPEN DAN KERTAS: tamu yang tidak mau menulis tangan bisa
-- menandainya di layar, lalu menunjukkannya ke pelayan. Pelayan yang membaca
-- dan mengetiknya sendiri di kasir.
--
-- Bedanya bukan soal kenyamanan. Daftar yang mendarat di layar kasir akan
-- terbaca sebagai pesanan, dan godaan untuk langsung mengetiknya tanpa
-- memastikan ketersediaannya justru membatalkan satu-satunya alasan alur ini
-- dibuat: menyaring menu yang habis SEBELUM tamunya terlanjur menunggu.
--
-- Kolomnya dibuang, bukan dibiarkan selalu kosong. Kolom yang ada tapi tidak
-- pernah terisi akan dikira terisi oleh siapa pun yang membacanya nanti.

ALTER TABLE public.table_calls
  DROP COLUMN IF EXISTS catatan_pesanan;
