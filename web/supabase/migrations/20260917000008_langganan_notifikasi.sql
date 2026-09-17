-- Langganan notifikasi push milik owner.
--
-- Kabar refund harus sampai ke pemiliknya SAAT ITU JUGA — itu lapis yang paling
-- berpengaruh, karena kasir yang tahu owner-nya menerima pesan pada detik yang
-- sama tidak akan mencoba.
--
-- Jalur WhatsApp Cloud API tidak dipakai untuk ini, dan alasannya bukan biaya:
-- mendaftarkan sebuah nomor ke Cloud API MENGUNCI nomor itu — sesudahnya tidak
-- bisa lagi dibuka di aplikasi WhatsApp biasa. Untuk kafe yang pelanggannya
-- memesan lewat chat, kehilangan WhatsApp harian demi satu notifikasi adalah
-- pertukaran yang tidak masuk akal.
--
-- Notifikasi push tidak menyentuh WhatsApp sama sekali, gratis selamanya, dan
-- sampai walaupun aplikasinya sedang tertutup.

CREATE TABLE IF NOT EXISTS public.push_subscriptions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,

  /*
   * endpoint adalah alamat unik yang diberikan peramban. Dipakai sebagai
   * penanda unik: satu orang bisa memasang KAEL di HP dan di laptop sekaligus,
   * dan keduanya berhak menerima kabar yang sama.
   */
  endpoint TEXT NOT NULL,
  p256dh TEXT NOT NULL,
  auth TEXT NOT NULL,

  /* Untuk menerangkan "HP mana ini" saat owner mencabut salah satunya. */
  label TEXT,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_used_at TIMESTAMPTZ
);

COMMENT ON TABLE public.push_subscriptions IS
  'Perangkat yang berhak menerima notifikasi KAEL. Dicabut sendiri oleh peramban saat aplikasi dihapus, dan dihapus di sini begitu pengirimannya ditolak permanen.';

-- Peramban memberi endpoint yang unik per perangkat; mendaftar ulang dari
-- perangkat yang sama tidak boleh menambah baris kedua.
CREATE UNIQUE INDEX IF NOT EXISTS idx_push_subscriptions_endpoint
  ON public.push_subscriptions (endpoint);

CREATE INDEX IF NOT EXISTS idx_push_subscriptions_business
  ON public.push_subscriptions (business_id, user_id);

ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;
