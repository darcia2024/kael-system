# PRD — KAEL Digital Business Ecosystem

> Status dokumen: v1 (rebrand dari TapTapin → KAEL)
> Tanggal: 2026-08-25

---

## 1. Product Overview

- **Brand Name:** KAEL
- **Meaning:** Kemudahan Akses, Efisiensi, Layanan
- **Product Type:** Digital Business Ecosystem / UMKM Solutions Platform

**Core Idea**

KAEL adalah ekosistem solusi digital untuk membantu bisnis, terutama UMKM, menjalankan operasional dengan lebih mudah, lebih efisien, dan lebih rapi.

KAEL tidak hanya menjual satu aplikasi. Brand ini menaungi berbagai solusi yang bisa dipakai secara modular sesuai kebutuhan bisnis. User tidak harus menggunakan semua layanan sekaligus.

> Mulai dari yang dibutuhkan. Berkembang saat bisnis siap.

---

## 2. Brand Philosophy

| Prinsip | Arti |
| --- | --- |
| **Kemudahan Akses** | Teknologi bisnis harus mudah diakses dan digunakan, termasuk oleh bisnis yang belum punya sistem digital. |
| **Efisiensi** | Mengurangi proses manual, pekerjaan berulang, pencatatan berantakan, dan aktivitas yang membuang waktu. |
| **Layanan** | Tidak hanya menyediakan software, tapi membantu bisnis menemukan solusi yang sesuai dengan masalah mereka. |

---

## 3. Vision

Menjadi ekosistem solusi digital yang membuat teknologi bisnis lebih mudah digunakan oleh UMKM.

---

## 4. Mission

- membantu digitalisasi bisnis secara bertahap
- menyederhanakan operasional
- meningkatkan efisiensi bisnis
- membantu owner mengambil keputusan lebih baik
- meningkatkan pengalaman pelanggan
- menyediakan solusi digital yang fleksibel
- membuat teknologi bisnis lebih approachable bagi UMKM

---

## 5. Primary Target Market

UMKM · bisnis lokal · coffee shop · restoran · bakery · barbershop · salon · laundry · retail · travel · usaha jasa · pendidikan · toko online/offline · bisnis rumahan

**Bukan** target utama: perusahaan enterprise besar.

---

## 6. Primary User Personas

### Persona A — Small Business Owner

Masih mengelola bisnis lewat WhatsApp, Excel, catatan manual, buku kas, Google Sheets.

Pain point:
- tidak punya waktu
- tidak memahami software kompleks
- sistem bisnis tersebar
- tidak tahu harus mulai digitalisasi dari mana

### Persona B — Growing Business Owner

Bisnis sudah berkembang tetapi mulai mengalami: transaksi meningkat, pelanggan makin banyak, karyawan bertambah, pencatatan makin sulit, laporan sulit dipantau.

Butuh sistem sederhana tanpa harus membeli enterprise software mahal.

### Persona C — Service Business

Contoh: barbershop, salon, laundry, travel, clinic, consultant, photography.

Butuh: booking, membership, loyalty, customer management, payments, operational tracking.

---

## 7. Core Value Proposition

**Main:** Solusi digital praktis untuk membuat bisnis lebih mudah, efisien, dan berkembang.

**Alternative:** Teknologi bisnis yang nggak bikin bisnis tambah ribet.

---

## 8. Product Architecture

KAEL bertindak sebagai **umbrella brand**. Di bawahnya:

1. KAEL Review
2. KAEL Loyalty
3. KAEL Finance
4. KAEL Ordering
5. KAEL POS
6. KAEL Booking
7. KAEL HR
8. KAEL Custom

Setiap produk bisa berkembang menjadi aplikasi independen tetapi tetap menggunakan ekosistem KAEL.

---

## 9. KAEL Review

- **Category:** Online Reputation
- **Status:** First Product / Priority Development

**Problem:** Banyak pelanggan puas tetapi tidak meninggalkan review karena prosesnya dianggap ribet.

**Solution:** NFC dan QR untuk mengarahkan customer langsung ke halaman Google Review bisnis.

**Customer Flow**

```text
Tap NFC / Scan QR
   ↓
Google Review terbuka
   ↓
Customer memberikan review
```

**Core Features**
- NFC card
- QR code backup
- Card ID
- activation PIN
- dynamic redirect
- Google Review destination
- tap/scan tracking
- active/inactive card
- edit destination
- suspend card
- reset PIN

**Admin Features** — card list, business, customer, card status, tap count, last activity, destination URL, activation status.

---

## 10. KAEL Loyalty

- **Category:** Customer Retention

**Problem:** Customer datang sekali tetapi tidak punya alasan untuk kembali.

**Solution:** Program loyalty sederhana yang memberikan poin atau reward kepada pelanggan.

**Features** — customer membership, points, stamps, rewards, membership tiers, point history, reward history, customer dashboard, NFC/QR membership, optional point expiry, birthday reward.

**Basic Flow**

```text
Customer melakukan transaksi
   ↓
Kasir memasukkan transaksi
   ↓
Points otomatis bertambah
   ↓
Customer melihat progress reward
   ↓
Reward bisa diredeem
```

---

## 11. KAEL Finance

- **Internal name:** KAEL HPP & Finance
- **Public name:** KAEL Finance
- **Category:** Business Finance

**Problem:** Banyak UMKM menentukan harga jual tanpa mengetahui HPP, margin, dan keuntungan sebenarnya.

**Solution:** Tools sederhana untuk memahami biaya dan profit bisnis.

**HPP** — ingredient cost, quantity, unit conversion, packaging, operational cost, output quantity, total capital, HPP/unit.

**Pricing** — selling price, profit/unit, markup, margin, target profit, recommended price.

**Basic Finance** — income, expenses, category, daily profit, monthly profit, cost summary, revenue target, financial report.

---

## 12. KAEL Ordering

- **Category:** Digital Ordering

**Problem:** Order melalui WhatsApp atau pencatatan manual rawan terlewat dan sulit dilacak.

**Solution:** Digital menu dan ordering system.

**Features** — menu, product categories, photos, prices, availability, cart, quantity, notes, table number, dine-in, takeaway, order dashboard, order status, order history.

**Possible future:** kitchen display, WhatsApp notification, payment integration.

---

## 13. KAEL POS

- **Category:** Transaction Management

**Problem:** Bisnis membutuhkan pencatatan transaksi yang mudah tanpa sistem kasir rumit.

**Solution:** Simple POS untuk UMKM.

**Features** — product management, categories, transaction, cash, QRIS, transfer, discounts, tax, service charge, digital receipts, sales history, daily report, monthly report, best-selling products, refunds, shift.

**Future Integration:** KAEL Loyalty, KAEL Finance, inventory, customer database.

---

## 14. KAEL Booking

- **Category:** Scheduling
- **Target:** barber, salon, clinic, consultant, photography, rental, service business

**Features** — service catalog, date selection, available time, staff, booking confirmation, reschedule, cancellation, customer history, optional deposit, reminder, membership integration.

---

## 15. KAEL HR

- **Category:** Employee Management

**Problem:** UMKM yang memiliki beberapa karyawan mulai kesulitan mengelola absensi, shift, dan payroll.

**Features** — employee database, attendance, NFC attendance, QR attendance, shifts, schedule, leave, overtime, lateness, salary, bonus, deduction, payroll, payslip, payment history, employee roles.

---

## 16. KAEL Custom

- **Category:** Custom Business System

Jika kebutuhan bisnis tidak bisa diselesaikan oleh produk KAEL existing, KAEL dapat membuat custom system.

**Possible products** — inventory, CRM, reseller, agent management, rental, project management, school management, LMS, approval systems, customer portal, franchise, multi-branch system, ticketing, custom dashboard, workflow automation.

---

## 17. Landing Page Objective

Tahap pertama KAEL adalah membangun website utama sebagai **etalase seluruh ecosystem KAEL**. Website belum berfungsi sebagai aplikasi utama.

Tujuan:
- memperkenalkan KAEL
- menjelaskan value proposition
- menunjukkan solusi
- menghasilkan leads
- mengarahkan user ke WhatsApp
- menjadi home untuk seluruh produk KAEL

---

## 18. Landing Page Structure

### Navbar
Logo KAEL · Solusi · Cara Kerja · Untuk Bisnis · Tentang · FAQ
CTA: **Konsultasi Gratis**

### Hero
**Headline:** Bikin Bisnis Lebih Mudah dengan KAEL

**Subheadline:** Solusi digital praktis untuk membantu bisnis mengelola pelanggan, transaksi, keuangan, operasional, dan tim.

**CTA:** Lihat Solusi — *secondary:* Konsultasi Gratis

---

## 19. Problem Section

**Headline:** Bisnis Jalan, Tapi Semuanya Masih Manual?

- review Google sedikit
- pelanggan jarang kembali
- HPP tidak jelas
- order berantakan
- kasir manual
- booking lewat chat
- absensi manual
- data bisnis tersebar

**CTA:** KAEL bantu beresin satu per satu.

---

## 20. Product Ecosystem Section

**Headline:** Pilih Solusi yang Bisnis Anda Butuhkan

| Produk | Deskripsi kartu |
| --- | --- |
| KAEL Review | Google Review dengan NFC & QR. |
| KAEL Loyalty | Poin dan reward pelanggan. |
| KAEL Finance | HPP, profit, dan keuangan bisnis. |
| KAEL Ordering | Menu dan pemesanan digital. |
| KAEL POS | Kasir dan laporan penjualan. |
| KAEL Booking | Booking dan jadwal pelanggan. |
| KAEL HR | Karyawan, absensi, dan payroll. |
| KAEL Custom | Sistem bisnis sesuai kebutuhan. |

---

## 21. Product Status

| Status | Arti |
| --- | --- |
| `available` | Sudah bisa digunakan. |
| `available-soon` | Produk hampir tersedia. |
| `coming-soon` | Produk sedang dalam roadmap. |
| `by-request` | Bisa dibuat berdasarkan kebutuhan. |

Status disimpan dalam configuration:

```ts
{
  name: "KAEL Review",
  status: "available-soon"
}
```

---

## 22. Featured Product

Tahap awal homepage menonjolkan **KAEL Review**.

**Headline:** Review Google Cukup Satu Tap

```text
Tap KAEL Card → Google Review terbuka → Pelanggan kasih review
```

**CTA:** Pesan KAEL Review

---

## 23. How KAEL Works

| Step | Judul | Deskripsi |
| --- | --- | --- |
| 01 | Ceritakan Masalah | Apa yang masih ribet dalam bisnis? |
| 02 | Pilih Solusi | KAEL membantu menentukan produk yang sesuai. |
| 03 | Setup | Solusi disiapkan untuk bisnis. |
| 04 | Mulai Gunakan | Bisnis mulai menggunakan sistem. |
| 05 | Tambah Saat Dibutuhkan | Produk KAEL lain bisa ditambahkan ketika bisnis berkembang. |

---

## 24. Why KAEL

**Headline:** Teknologi Harus Membantu, Bukan Menambah Ribet

- **Mudah** — tidak perlu memahami teknologi kompleks
- **Modular** — tidak perlu membeli semua produk
- **Flexible** — bisa disesuaikan dengan bisnis
- **Practical** — fokus menyelesaikan masalah nyata
- **Scalable** — bisa berkembang bersama bisnis

---

## 25. Custom Solution Section

**Headline:** Bisnis Anda Punya Kebutuhan yang Berbeda?

**Description:** Ceritakan bagaimana bisnis Anda bekerja. KAEL dapat membantu membangun sistem yang sesuai dengan kebutuhan tersebut.

**CTA:** Konsultasikan Kebutuhan Saya → WhatsApp

---

## 26. FAQ

**Apa itu KAEL?**
KAEL adalah ekosistem solusi digital untuk membantu bisnis menjalankan operasional dengan lebih mudah dan efisien.

**Apakah harus menggunakan semua produk?**
Tidak. Produk KAEL bersifat modular.

**Bisakah digunakan usaha kecil?**
Ya. KAEL dirancang agar bisa digunakan mulai dari UMKM.

**Apakah harus install aplikasi?**
Tidak selalu. Sebagian besar sistem KAEL dapat berjalan melalui browser.

**Bagaimana jika kebutuhan saya belum tersedia?**
Gunakan KAEL Custom.

**Apakah produk bisa saling terhubung?**
Tujuan jangka panjang KAEL adalah membuat produk dapat saling terintegrasi.

---

## 27. Recommended Website Architecture

Initial:

```txt
kael.id/
```

Future:

```txt
kael.id/review
kael.id/loyalty
kael.id/finance
kael.id/ordering
kael.id/pos
kael.id/booking
kael.id/hr
kael.id/custom
```

Later possible app structure:

```txt
app.kael.id
```

atau:

```txt
review.kael.id
loyalty.kael.id
pos.kael.id
```

Keputusan final dibuat setelah produk bertambah.

---

## 28. MVP Landing Page Scope

**Build sekarang:** Navbar · Hero · Business problems · Product ecosystem · Product status · Featured KAEL Review · How It Works · Why KAEL · Business categories · Custom solution CTA · FAQ · Footer · WhatsApp CTA · Mobile responsive · SEO · Metadata

**Tidak perlu:** database · login · checkout · payment gateway · CMS · admin · authentication

---

## 29. Tech Stack

| Layer | Pilihan |
| --- | --- |
| Framework | Next.js |
| Language | TypeScript |
| Styling | Tailwind CSS |
| Components | shadcn/ui (optional) |
| Icons | Lucide |
| Deployment | Vercel |

Landing page product data disimpan static:

```ts
const products = [
  {
    name: "KAEL Review",
    slug: "review",
    status: "available-soon",
  },
  {
    name: "KAEL Loyalty",
    slug: "loyalty",
    status: "coming-soon",
  }
];
```

Tidak perlu Supabase pada tahap landing page.

---

## 30. Design Direction

KAEL harus terasa: **modern + approachable + business-oriented**

**Visual:** clean · whitespace luas · rounded UI · typography jelas · product mockups · real dashboard previews · subtle gradients · strong CTA · minimal illustration

**Hindari:** neon · crypto aesthetic · terlalu futuristic · excessive glassmorphism · generic AI artwork · random decorative blobs · template SaaS generik

---

## 31. Brand Architecture

**Master brand:** KAEL

Turunan: KAEL Review · KAEL Loyalty · KAEL Finance · KAEL Ordering · KAEL POS · KAEL Booking · KAEL HR · KAEL Custom

Jangan buat logo berbeda total untuk setiap produk. Gunakan **KAEL identity + product descriptor** supaya ecosystem tetap terasa satu brand.

---

## 32. Development Roadmap

| Phase | Fokus |
| --- | --- |
| 1 | KAEL Brand + Landing Page — membangun positioning dan etalase produk |
| 2 | KAEL Review — produk pertama yang benar-benar usable |
| 3 | Validate Market — lihat kebutuhan user nyata, jangan langsung build semua |
| 4 | Build produk dengan demand terbesar (likely: Loyalty / Finance) |
| 5 | Integrasi antar produk |
| 6 | Unified KAEL Account — satu business account mengakses seluruh ecosystem |

Phase 5 contoh integrasi:

```text
KAEL POS
   ↓
KAEL Loyalty
   ↓
KAEL Finance
```

---

## 33. Long-Term Vision

Target akhir bukan kumpulan aplikasi terpisah, tapi **satu ecosystem bisnis modular**.

Owner login ke **KAEL Business** dan melihat: sales, customers, reviews, loyalty, finance, orders, bookings, employees — lalu hanya mengaktifkan module yang dibutuhkan.

```text
KAEL BUSINESS

Review      ON
Loyalty     ON
Finance     ON
POS         OFF
Booking     OFF
HR          OFF
```

Ini bisa menjadi dasar SaaS kalau market validation-nya bagus.

---

## 34. Core Product Principle

> **Jangan build karena fiturnya keren. Build karena bisnis benar-benar membutuhkannya.**

Setelah Landing Page → KAEL Review, jangan otomatis bikin 7 produk lainnya secara berurutan. Lihat dulu apa yang ditanyakan customer.

- Kalau 10 bisnis tanya "bisa sekalian poin pelanggan?" → **KAEL Loyalty** jadi next priority.
- Kalau yang paling sering ditanya "bisa bantu hitung modal dan keuntungan?" → **KAEL Finance** yang dibangun.

KAEL tumbuh berdasarkan demand nyata, bukan asumsi.
