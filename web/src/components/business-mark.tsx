"use client";

import { useEffect, useRef, useState } from "react";
import { Store } from "lucide-react";

import { brandSurface, businessInitials } from "@/lib/branding";

/**
 * Kotak identitas toko: logo kalau ada, inisial di atas warna mereknya kalau
 * belum ada.
 *
 * Sebelum komponen ini, tiap kepala halaman memasang ikon tetap dengan warna
 * KAEL: "K" hijau di beranda pemilik, ikon Store di layar login, Utensils di
 * halaman pesan-dari-meja, dan Coffee di struk serta kartu member. Dua yang
 * terakhir ikon makanan, padahal halaman yang sama dipakai barbershop dan
 * laundry, jadi salah untuk sebagian pemakainya sejak awal.
 *
 * Semua tempat itu sekarang memakai satu komponen ini, sehingga menambah
 * halaman baru tidak berarti menambah ikon tetap baru yang harus diingat untuk
 * diganti.
 */

const SIZES = {
  sm: { box: "h-7 w-7", text: "text-[10px]", icon: 14 },
  md: { box: "h-9 w-9", text: "text-xs", icon: 18 },
  lg: { box: "h-10 w-10", text: "text-sm", icon: 20 },
} as const;

export function BusinessMark({
  name,
  logoUrl,
  brandColor,
  size = "md",
  className = "",
}: {
  name: string | null | undefined;
  logoUrl: string | null | undefined;
  brandColor: string | null | undefined;
  size?: keyof typeof SIZES;
  /** Bentuk sudut dan garis tepi diserahkan ke pemanggil, mengikuti halamannya. */
  className?: string;
}) {
  /**
   * URL logo diisi manusia lewat berkas prospek atau panel admin, jadi bisa
   * saja salah ketik atau tautannya mati. Tanpa penangkap ini, yang tampil di
   * depan pemilik usaha adalah ikon gambar rusak, tepat di kotak yang
   * seharusnya menampilkan logonya.
   *
   * Yang disimpan URL-nya, bukan sekadar true/false: begitu logonya diganti,
   * URL baru otomatis tidak cocok lagi dengan yang tercatat gagal, jadi
   * gambarnya dapat kesempatan dimuat ulang tanpa perlu mengatur ulang apa pun.
   */
  const [gagalUntuk, setGagalUntuk] = useState<string | null>(null);
  const imgRef = useRef<HTMLImageElement | null>(null);

  /**
   * Memeriksa keadaan gambar sekali setelah komponen terpasang.
   *
   * onError saja tidak cukup. Halaman ini dirender di server, jadi peramban
   * sudah mulai memuat logonya dari HTML sebelum React sempat memasang
   * penangan apa pun. Kalau tautannya mati, kegagalannya terjadi SEBELUM
   * hidrasi, event-nya lewat begitu saja, dan onError tidak pernah terpanggil —
   * persis pada kasus yang paling perlu ditangani. Gejalanya: kotak identitas
   * menampilkan ikon gambar rusak dan diam di situ.
   *
   * `complete` bernilai true dan `naturalWidth` nol hanya terjadi kalau
   * pemuatan sudah selesai TANPA menghasilkan gambar, yang berarti gagal.
   */
  useEffect(() => {
    const img = imgRef.current;
    if (img && img.complete && img.naturalWidth === 0) {
      setGagalUntuk(logoUrl ?? null);
    }
  }, [logoUrl]);

  const dim = SIZES[size];
  const surface = brandSurface(brandColor);
  const inisial = businessInitials(name);
  const pakaiLogo = !!logoUrl && gagalUntuk !== logoUrl;

  return (
    <span
      className={`inline-flex shrink-0 items-center justify-center overflow-hidden font-black ${dim.box} ${dim.text} ${className}`}
      style={surface}
    >
      {pakaiLogo ? (
        /*
         * Sengaja <img> biasa, bukan next/image. Logo tenant adalah URL
         * sembarang milik tokonya sendiri, sementara next/image menolak host
         * yang tidak terdaftar di images.remotePatterns. Mendaftarkan host tiap
         * pelanggan satu per satu ke berkas konfigurasi bukan sesuatu yang bisa
         * dikerjakan saat menyiapkan demo di lapangan.
         *
         * alt sengaja kosong: nama tokonya selalu tertulis persis di sebelah
         * kotak ini, jadi memberi alt yang sama membuat pembaca layar
         * menyebutkan nama yang sama dua kali.
         */
        <img
          ref={imgRef}
          src={logoUrl ?? ""}
          alt=""
          className="h-full w-full object-cover"
          onError={() => setGagalUntuk(logoUrl ?? null)}
        />
      ) : inisial ? (
        <span className="leading-none tracking-tight">{inisial}</span>
      ) : (
        <Store size={dim.icon} />
      )}
    </span>
  );
}
