-- Refund boleh dilakukan kasir, bukan cuma pemilik.
--
-- Kolom approved_by sejak awal berkomentar "Wajib role owner". Aturan itu
-- sempat ditegakkan di kode, lalu dicabut lagi karena tidak cocok dengan cara
-- warung bekerja: yang berhadapan dengan pelanggan yang membatalkan pesanan
-- adalah kasir, dan owner sering tidak di tempat.
--
-- Refund yang harus menunggu owner berarti pelanggan menunggu — atau kasir
-- mencari jalan lain di luar sistem, dan yang di luar sistem tidak meninggalkan
-- catatan sama sekali. Uang yang keluar diam-diam jauh lebih sulit ditelusuri
-- daripada uang yang keluar dengan nama kasirnya tercatat.
--
-- Komentarnya diperbaiki supaya basis data tidak lagi menyatakan aturan yang
-- tidak berlaku. Kolomnya sendiri tidak berubah: yang tersimpan tetap SIAPA
-- yang melakukannya, dan itu yang dibaca owner saat menelusuri selisih laci.

COMMENT ON COLUMN public.refunds.approved_by IS
  'Siapa yang melakukan pengembalian dana — kasir maupun owner. Bukan penanda persetujuan owner, melainkan jejak pertanggungjawaban: setiap rupiah yang keluar punya nama.';

COMMENT ON TABLE public.refunds IS
  'Catatan pengembalian dana. Transaksi asli tidak pernah dihapus; refund adalah baris baru yang menunjuk kepadanya, lengkap dengan nominal, alasan, kategori, metode, pelakunya, dan shift tempat uangnya keluar.';
