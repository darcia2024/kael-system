-- Alur "menu digital untuk dilihat, pesan lewat pelayan".
--
-- KAEL selama ini menganggap satu alur sebagai satu-satunya alur: tamu memindai
-- QR meja, memesan sendiri dari HP-nya, lalu membayar di depan. Itu cocok untuk
-- gerai cepat saji, tapi TIDAK cocok untuk kafe seperti Mochi, dan bukan karena
-- soal teknis:
--
--   * Tamu kafe datang untuk duduk lama. Memaksa mereka mengetik pesanan di HP
--     sambil ngobrol justru memperlambat, dan yang gaptek menyerah di tengah.
--   * Menu bisa habis sewaktu-waktu. Tamu yang memesan sendiri baru tahu
--     pesanannya kosong SETELAH uangnya masuk — dan itu jadi refund.
--   * Membayar di depan berarti tamu yang mau menambah pesanan harus antre lagi
--     ke kasir tiap kali. Di kafe, tambahan pesanan itu justru sumber omzetnya.
--
-- Alur yang diminta pemilik Mochi: menu digital cuma untuk DILIHAT, tamu menulis
-- pesanannya di kertas, lalu menekan satu tombol untuk memanggil pelayan. Pelayan
-- datang, memastikan menunya benar-benar tersedia, lalu memasukkannya di kasir.
-- Semua pembayaran di akhir, setelah makan.
--
-- Dua-duanya tetap didukung. Yang menentukan adalah setelan per toko, bukan
-- kode yang ditulis ulang: KAEL punya banyak penyewa, dan gerai yang memang
-- ingin tamunya memesan sendiri tidak boleh ikut kehilangan fiturnya.

ALTER TABLE public.businesses
  ADD COLUMN IF NOT EXISTS qr_menu_mode TEXT NOT NULL DEFAULT 'pesan_bayar';

COMMENT ON COLUMN public.businesses.qr_menu_mode IS
  'pesan_bayar = tamu memesan dan membayar sendiri dari HP. lihat_panggil = menu digital cuma untuk dilihat, tamu menekan tombol panggil pelayan dan pesanannya diinput kasir.';

ALTER TABLE public.businesses
  DROP CONSTRAINT IF EXISTS businesses_qr_menu_mode_check;

ALTER TABLE public.businesses
  ADD CONSTRAINT businesses_qr_menu_mode_check
  CHECK (qr_menu_mode IN ('pesan_bayar', 'lihat_panggil'));

-- ---------------------------------------------------------------------------
-- Panggilan meja
-- ---------------------------------------------------------------------------
--
-- Satu baris = satu kali tamu menekan "panggil pelayan".
--
-- Disimpan sebagai tabel, bukan sekadar pesan yang lewat. Panggilan yang cuma
-- berupa bunyi akan hilang begitu kasir tidak sedang melihat layarnya, dan tamu
-- yang merasa sudah memanggil akan menunggu tanpa ada yang tahu. Yang tersimpan
-- bisa ditampilkan lagi, dihitung berapa lama menunggunya, dan ditutup oleh
-- orang yang benar-benar mendatangi mejanya.

CREATE TABLE IF NOT EXISTS public.table_calls (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,

  /* Apa adanya seperti yang dipindai tamu, untuk ditampilkan. */
  table_no TEXT NOT NULL,
  /* Bentuk baku untuk dicocokkan; "Meja 1", "meja 01", dan "1" adalah meja yang sama. */
  table_key TEXT NOT NULL,

  /*
   * menunggu  tamu sudah menekan, belum ada yang mendatangi
   * dilayani   pelayan sudah ke mejanya
   * kedaluwarsa  ditutup sendiri karena sudah terlalu lama, bukan karena dilayani
   */
  status TEXT NOT NULL DEFAULT 'menunggu',

  /* Keperluan panggilannya, supaya pelayan tahu harus bawa apa. */
  jenis TEXT NOT NULL DEFAULT 'siap_memesan',

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  handled_at TIMESTAMPTZ,
  handled_by UUID REFERENCES public.users(id) ON DELETE SET NULL
);

ALTER TABLE public.table_calls
  DROP CONSTRAINT IF EXISTS table_calls_status_check;

ALTER TABLE public.table_calls
  ADD CONSTRAINT table_calls_status_check
  CHECK (status IN ('menunggu', 'dilayani', 'kedaluwarsa'));

ALTER TABLE public.table_calls
  DROP CONSTRAINT IF EXISTS table_calls_jenis_check;

ALTER TABLE public.table_calls
  ADD CONSTRAINT table_calls_jenis_check
  CHECK (jenis IN ('siap_memesan', 'tambah_pesanan', 'minta_bill', 'bantuan'));

COMMENT ON TABLE public.table_calls IS
  'Panggilan pelayan dari meja. Satu baris = satu kali tombol ditekan oleh tamu.';

-- Kasir membaca daftar ini berulang kali selama jam ramai, dan yang dibacanya
-- selalu "panggilan yang belum dilayani di toko ini".
CREATE INDEX IF NOT EXISTS idx_table_calls_menunggu
  ON public.table_calls (business_id, status, created_at DESC);

/*
 * Satu meja tidak boleh punya dua panggilan menunggu sekaligus.
 *
 * Tamu yang merasa lama akan menekan tombolnya berkali-kali — itu wajar, dan
 * bukan alasan untuk membanjiri layar kasir dengan lima baris meja yang sama
 * sampai panggilan meja lain tenggelam.
 */
CREATE UNIQUE INDEX IF NOT EXISTS idx_table_calls_satu_per_meja
  ON public.table_calls (business_id, table_key)
  WHERE status = 'menunggu';

ALTER TABLE public.table_calls ENABLE ROW LEVEL SECURITY;
