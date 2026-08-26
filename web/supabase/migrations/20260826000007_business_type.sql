-- Jenis usaha.
--
-- Kolom `category` sudah ada tapi isinya teks bebas ("Coffee Shop & Bakery",
-- "Barbershop & Grooming"), jadi tidak bisa dipakai sebagai kunci pemetaan.
-- Kolom ini terbatas pada tiga nilai supaya kode tidak perlu menebak jenis
-- usaha dari teks yang diketik manusia.
--
-- Dipakai untuk menentukan modul mana yang masuk akal ditawarkan: barbershop
-- tidak butuh kalkulator resep dan menu QR meja, jadi menampilkannya sebagai
-- kartu terkunci hanya jadi kebisingan.

ALTER TABLE businesses
  ADD COLUMN IF NOT EXISTS business_type text NOT NULL DEFAULT 'kuliner';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'businesses'::regclass
      AND conname = 'businesses_business_type_check'
  ) THEN
    ALTER TABLE businesses
      ADD CONSTRAINT businesses_business_type_check
      CHECK (business_type IN ('kuliner', 'jasa', 'retail'));
  END IF;
END $$;

-- Menebak sekali untuk data yang sudah ada. Setelah ini nilainya diisi manusia
-- lewat layar admin, tidak lagi ditebak dari teks.
UPDATE businesses
   SET business_type = 'jasa'
 WHERE category ILIKE ANY (ARRAY['%barber%', '%salon%', '%grooming%', '%laundry%', '%cuci%']);

UPDATE businesses
   SET business_type = 'retail'
 WHERE category ILIKE ANY (ARRAY['%retail%', '%toko%', '%minimarket%', '%kelontong%']);
