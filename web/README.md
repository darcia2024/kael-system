# KAEL Web

Landing page Phase 1 untuk KAEL. Etalase ekosistem, belum aplikasi.
PRD lengkap ada di [`../docs/PRD.md`](../docs/PRD.md).

## Jalanin

```bash
npm --prefix web run dev
```

Build produksi dan typecheck:

```bash
npm --prefix web run build
```

Stack: Next.js 16 (App Router, Turbopack), React 19, TypeScript, Tailwind v4,
Motion, Lucide. Semua halaman prerender static, tidak ada database dan tidak ada
auth, sesuai PRD bagian 28.

---

## Wajib diganti sebelum launch

| Apa | Di mana | Catatan |
| --- | --- | --- |
| Foto | `src/components/*.tsx` | Enam foto masih pakai `picsum.photos` sebagai placeholder. Lihat daftar di bawah. |
| Logo | `src/components/wordmark.tsx` | Sekarang wordmark tipografi. Ganti kalau logotype final sudah jadi. |
| Domain | `src/lib/site.ts` | `https://kael.id` dipakai untuk canonical, OG, sitemap, dan robots. Pastikan domainnya benar sudah dipegang. |

Sudah terisi: nomor WhatsApp `6281311506025` dan email `daru.fahma@gmail.com`
di `src/lib/site.ts`. Nomor disimpan dalam format wa.me, jadi `0813...` ditulis
`62813...`.

### Slot foto yang perlu diisi foto asli

1. **Hero**, potret 4:5 sekitar 900x1125. Pemilik usaha melayani pelanggan.
2. **KAEL Review (blok crimson)**, 4:3 sekitar 1200x900. Kartu KAEL di meja kasir.
3. **Kartu KAEL Review (grid ekosistem)**, 800x900. Kartu NFC dipegang tangan.
4. **Untuk Bisnis**, tiga foto 800x1000: coffee shop, barbershop, laundry.

Begitu foto asli masuk, taruh di `public/` lalu hapus `picsum.photos` dari
`images.remotePatterns` di `next.config.ts`.

---

## Design system

Satu palet, satu aksen, satu skala radius, satu keluarga font. Jangan campur.

### Warna

Token semantik ada di `src/app/globals.css`, ditukar sekali di
`prefers-color-scheme: dark`. Section tidak pernah menimpa token.

| Peran | Light | Dark |
| --- | --- | --- |
| Background | `#f7f0e6` cream | `#141110` |
| Section alternatif | `#f1e8da` | `#1c1817` |
| Card | `#ffffff` putih | `#201b19` |
| Teks | `#1a1512` | `#f5ede3` cream |
| Aksen | `#b01236` crimson | `#f2647f` |
| Blok crimson | `#b01236` | `#4a0d1e` |

Crimson adalah satu-satunya aksen di seluruh halaman. Status produk dibedakan
lewat teks, bukan warna kedua. Semua pasangan teks dan background sudah dicek
WCAG AA di kedua mode: 152 elemen, nol pelanggaran.

### Tipografi

Plus Jakarta Sans, hanya weight **200, 300, dan 400**. Tidak ada bold di mana
pun. Hierarki datang dari ukuran, warna, dan jarak.

- Display (h1, h2): 200
- Nama produk, label nilai: 300
- Body, tombol, nav, apa pun di bawah 20px: 400

Weight 500 ke atas tidak di-load, jadi `font-bold` dan `font-semibold` tidak
akan berefek. Jangan dipakai.

### Bentuk

- Tombol dan pill kategori: `rounded-full`
- Card, foto, panel: `rounded-2xl`
- Kotak ikon: `rounded-xl`
- Semua ikon Lucide: `strokeWidth={1.5}`

---

## Aturan yang gampang kelanggar

Ini bukan preferensi, ini yang bikin halaman tidak terlihat seperti template.

- **Tidak ada em dash** (`—`) di teks yang terlihat. Pakai tanda hubung biasa
  atau pecah kalimatnya.
- **Tidak ada badge.** Status produk tampil sebagai teks abu kecil.
- **Tidak ada emoji** di markup maupun copy.
- **Eyebrow maksimal 2** di halaman ini (Produk Pertama, Ekosistem KAEL).
  Sembilan section, jatahnya tiga. Kalau mau nambah, hapus salah satu dulu.
- **Satu marquee** saja, di section Untuk Bisnis.
- **Satu blok warna** saja, di section KAEL Review.
- **Tidak ada screenshot palsu** dari div. Kalau butuh tampilan produk, pakai
  foto asli atau komponen asli.
- Layout tiap section beda keluarga. Jangan tambah section dengan pola
  gambar-kiri-teks-kanan lagi, sudah ada dua.

---

## Struktur

```
src/
  app/
    layout.tsx           metadata, font, JSON-LD Organization
    page.tsx             susunan section, JSON-LD FAQPage
    globals.css          token warna, marquee, base
    opengraph-image.tsx  OG image 1200x630, digenerate saat build
    sitemap.ts robots.ts
    error.tsx not-found.tsx
  components/            satu file per section
    ui/                  button, section, reveal
  lib/
    products.ts          sumber tunggal data produk
    site.ts              kontak, nav, label CTA
```

`src/lib/products.ts` adalah satu-satunya tempat data produk. Grid ekosistem,
status, dan daftar di footer semuanya baca dari sana. Nanti route per produk
(`/review`, `/loyalty`, dan seterusnya) juga ikut dari file yang sama.

### Status produk

PRD awal punya `available-soon` dan `coming-soon`. Pelanggan tidak bisa
membedakan keduanya, jadi dipangkas jadi tiga yang benar-benar dipakai:

| Key | Label | Dipakai oleh |
| --- | --- | --- |
| `soon` | Segera hadir | KAEL Review |
| `roadmap` | Dalam roadmap | Loyalty, Finance, Ordering, POS, Booking, HR |
| `by-request` | Sesuai permintaan | KAEL Custom |

`available` sudah didefinisikan di tipe, dipakai nanti waktu KAEL Review rilis.

---

## Beda dari PRD, dan alasannya

1. **KAEL Review dapat section sendiri sebelum grid ekosistem.** PRD menampilkan
   delapan kartu setara. Delapan kartu dengan tujuh produk yang belum ada
   terbaca seperti janji kosong. Sekarang Review jadi blok crimson penuh, dan
   grid di bawahnya jujur menyebut sisanya masih roadmap.
2. **Status dipangkas jadi tiga.** Alasan di atas.
3. **Nav "Tentang" dihapus.** Tidak ada halaman atau section Tentang di scope
   MVP, jadi link itu akan mengarah ke tempat kosong. Tinggal empat: Solusi,
   Cara Kerja, Untuk Bisnis, FAQ.
4. **CTA "Konsultasikan Kebutuhan Saya" jadi "Konsultasi Gratis".** Satu label
   untuk satu maksud. Dua tombol dengan tujuan sama tapi tulisan beda bikin
   pengunjung mengira itu dua hal berbeda.
5. **Tidak ada logo wall pelanggan.** Belum ada pelanggan. Diganti daftar
   kategori bisnis, yang jujur dan tetap menunjukkan cakupan.
6. **Jawaban FAQ soal integrasi dipertegas.** PRD menulis integrasi sebagai
   tujuan jangka panjang. Di halaman ditulis eksplisit belum berjalan hari ini,
   supaya tidak terbaca seperti fitur yang sudah ada.

---

## Yang belum dan sebaiknya menyusul

- **Sinyal harga.** Pemilik UMKM mundur kalau tidak ada indikasi biaya sama
  sekali. Minimal "mulai dari" untuk KAEL Review.
- **Bukti sosial.** Satu bisnis percontohan saja sudah cukup mengubah halaman
  ini.
- **Analytics.** Belum ada. Tanpa itu tidak ada cara mengukur lead per minggu,
  padahal Phase 3 di PRD bergantung pada angka itu.

---

## Deploy

Vercel, root direktori `web`. Set `NEXT_PUBLIC_KAEL_WHATSAPP` di environment
variables. Tidak ada dependensi lain.
