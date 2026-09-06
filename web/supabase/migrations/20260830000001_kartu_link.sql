-- Jenis kartu baru: link.
--
-- Kartu yang mengarah ke tautan apa pun milik pemiliknya sendiri, bukan ke
-- halaman ulasan Google. Portofolio, Instagram, WhatsApp, katalog, atau
-- apa pun yang berupa alamat https.
--
-- Mesinnya sudah ada sejak awal dan tidak perlu diubah: kolom destination_url
-- sudah menyimpan alamat bebas, dan updateCardAction sudah hanya memeriksa
-- bahwa alamatnya sah dan memakai https, bukan bahwa alamatnya milik Google.
-- Yang belum ada cuma jenisnya sendiri, sehingga tidak ada cara membedakan
-- kartu portofolio dari kartu ulasan di layar mana pun.
--
-- Perubahan ini MENAMBAH, tidak mengubah. Tiga jenis lama tetap sah dan
-- perilakunya tidak tersentuh, jadi tidak ada satu pun baris yang perlu
-- dipindahkan.

DO $$
BEGIN
  ALTER TABLE public.cards DROP CONSTRAINT IF EXISTS cards_type_check;

  ALTER TABLE public.cards
    ADD CONSTRAINT cards_type_check
    CHECK (type IN ('review', 'loyalty', 'attendance', 'link'));
END $$;

COMMENT ON COLUMN public.cards.type IS
  'review: ke halaman ulasan Google. loyalty: ke kartu member atau pendaftaran. attendance: absensi staf, belum dipakai. link: ke tautan bebas milik pemiliknya.';
