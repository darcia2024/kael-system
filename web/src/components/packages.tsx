/**
 * Komponen server. Isinya konten pemasaran yang tidak berubah, jadi tidak ada
 * alasan mengirim kodenya ke browser dan menjalankannya ulang di sana.
 *
 * Jangan tambahkan useState, useEffect, atau handler onClick di sini. Kalau
 * suatu bagian memang perlu interaktif, pisahkan bagian itu ke komponen client
 * sendiri, bukan menandai seluruh berkas ini "use client".
 */
import { ArrowRight, Check, Flame, Gift, HelpCircle, Nfc, Palette, Printer, QrCode, ShieldCheck, Sparkles, Star, Zap } from "lucide-react";

import { Container } from "@/components/ui/section";
import { Reveal } from "@/components/ui/reveal";
import { site, waLink } from "@/lib/site";
import { MODULE_BY_KEY } from "@/lib/modules-catalog";

// =========================================================================
// 0. SUMBER ANGKA HARGA
//
// Angkanya TIDAK hidup di sini. Semuanya dibaca dari modules-catalog.ts, yang
// juga dipakai kartu modul terkunci di dashboard dan penjaga lisensi.
//
// Sebelumnya berkas ini menyimpan salinannya sendiri. Kebetulan angkanya masih
// sama, tapi itu justru bentuk paling berbahaya dari duplikasi: tidak ada yang
// memberi tahu saat salah satunya diubah. Calon pembeli akan melihat harga A di
// halaman ini lalu harga B setelah masuk ke dashboard — tepat saat dia sedang
// mempertimbangkan membeli.
//
// Harga coret dan label hemat pada paket DIHITUNG dari angka ini, jadi tidak
// mungkin ada satu kartu yang menampilkan dua klaim hemat berbeda. Aturannya:
// harga coret pada paket adalah total harga modul kalau dibeli satuan hari ini.
// Bukan "harga sebelum diskon" yang tidak pernah ditagih.
// =========================================================================
type ModuleKey = "review" | "finance" | "loyalty" | "pos";

const MODULE_PRICE: Record<ModuleKey, number> = {
  review: MODULE_BY_KEY.review.price,
  finance: MODULE_BY_KEY.finance.price,
  loyalty: MODULE_BY_KEY.loyalty.price,
  pos: MODULE_BY_KEY.pos.price,
};

const MODULE_RENEWAL: Record<ModuleKey, number> = {
  review: MODULE_BY_KEY.review.renewal,
  finance: MODULE_BY_KEY.finance.renewal,
  loyalty: MODULE_BY_KEY.loyalty.renewal,
  pos: MODULE_BY_KEY.pos.renewal,
};

/** Renewal paket lebih murah daripada menjumlahkan renewal tiap modul. */
const BUNDLE_RENEWAL = {
  starter: 49_000,
  growth: 199_000,
  ultimate: 299_000,
};

const rupiah = (value: number) => `Rp ${value.toLocaleString("id-ID")}`;

const sumModules = (keys: ModuleKey[]) =>
  keys.reduce((total, key) => total + MODULE_PRICE[key], 0);

function bundlePricing(modules: ModuleKey[], price: number) {
  const separate = sumModules(modules);
  const saving = separate - price;
  const isBundle = modules.length > 1;
  return {
    price: rupiah(price),
    separatePrice: isBundle ? rupiah(separate) : null,
    savings: isBundle && saving > 0 ? `Hemat ${rupiah(saving)}` : null,
  };
}

// =========================================================================
// 1. DATA 3 PILIHAN BUNDLING (STARTER, GROWTH, ULTIMATE)
// =========================================================================
const bundles = [
  {
    id: "starter",
    name: "KAEL Starter",
    badge: "MODUL REVIEW",
    tagline: "Untuk usaha yang mau mulai digital dari hal paling simpel. Google Review cukup tap.",
    ...bundlePricing(["review"], MODULE_PRICE.review),
    renewal: `${rupiah(BUNDLE_RENEWAL.starter)} / tahun`,
    includes: [
      "1x KAEL NFC Review Card / Standee",
      "QR Code backup untuk HP non-NFC",
      "Direct link permanen & presisi ke Google Review tokomu",
      "Card ID, tap counter & status aktivasi",
      "Setup Google Review & desain kartu/QR basic",
      "Dashboard monitoring basic",
      "Garansi fisik kartu 6 bulan",
    ],
    cta: "Mulai Kumpulkan Review",
    href: waLink("Halo KAEL, saya mau pesan paket KAEL Starter (Review NFC) seharga Rp149.000."),
    isFeatured: false,
    highlightBadge: null,
  },
  {
    id: "growth",
    name: "KAEL Growth",
    badge: "3 MODUL + 2 NFC",
    tagline: "Cocok buat bisnis yang ingin reputasi naik, customer balik, dan margin lebih jelas.",
    ...bundlePricing(["review", "finance", "loyalty"], 699_000),
    renewal: `${rupiah(BUNDLE_RENEWAL.growth)} / tahun`,
    includes: [
      "KAEL Review (1x NFC Review Card / Standee)",
      "KAEL Finance (Kalkulator HPP & Simulasi Profit)",
      "KAEL Loyalty (1x NFC Member Card / Standee)",
      "🎨 Personalisasi Logo & Warna Tokomu (Powered by KAEL)",
      "Sistem poin, stamp & registrasi pelanggan via No WA",
      "Bantu input maks 10 produk pertama HPP",
      "Bantu struktur reward program loyalty awal",
    ],
    cta: "Pilih Paket Growth",
    href: waLink("Halo KAEL, saya tertarik dengan paket KAEL Growth seharga Rp699.000."),
    isFeatured: false,
    highlightBadge: "PALING COCOK UNTUK UMKM",
  },
  {
    id: "ultimate",
    name: "KAEL Ultimate Ecosystem",
    badge: "4 MODUL LENGKAP + 2 NFC",
    tagline: "Review, loyalty, keuangan, menu digital, dan kasir dalam satu ekosistem yang siap digunakan.",
    ...bundlePricing(["review", "finance", "loyalty", "pos"], 999_000),
    renewal: `${rupiah(BUNDLE_RENEWAL.ultimate)} / tahun (~Rp 25rb/bln)`,
    includes: [
      "KAEL Review (1x NFC Review Card / Standee)",
      "KAEL Finance (Engine HPP Resep & Kulakan Supplier)",
      "KAEL Loyalty (1x NFC Member Card / Standee)",
      "KAEL POS & Ordering (Kasir Web + Menu Digital QR)",
      "🎨 Personalisasi Logo, Banner & Warna Brand Tokomu",
      "🎁 Setup maksimal 30 menu/produk & QR Menu",
      "🎁 Input maksimal 10 produk HPP & racikan",
      "🎁 Setup loyalty rules & template struk toko",
      "🎁 Onboarding penggunaan & Priority Support (1–2 hari kerja)",
    ],
    cta: "Ambil KAEL Ultimate — Rp999rb",
    href: waLink("Halo KAEL, saya mau ambil paket lengkap KAEL Ultimate Ecosystem seharga Rp999.000."),
    isFeatured: true,
    highlightBadge: "🔥 PAKET PALING HEMAT",
  },
];

// =========================================================================
// 2. DATA 4 MODUL SATUAN (ALA-CARTE)
// =========================================================================
const alaCarteModules = [
  {
    id: "review",
    name: "1. KAEL Review",
    price: rupiah(MODULE_PRICE.review),
    renewal: `${rupiah(MODULE_RENEWAL.review)}/tahun`,
    forWho: "Bisnis yang pengen nambah Google Review dengan cara paling gampang.",
    features: [
      "1x KAEL NFC Review Card / Standee + QR Code backup",
      "Direct link permanen ter-lock langsung ke Google Review",
      "Card ID, activation system, tap/scan counter",
      "Setup link Google Review & desain kartu basic",
      "Dashboard monitoring basic",
      "Garansi fisik kartu 6 bulan untuk kerusakan produksi",
    ],
    cta: "Mulai Kumpulkan Review",
    href: waLink("Halo KAEL, saya mau order KAEL Review (Rp149.000)."),
  },
  {
    id: "finance",
    name: "2. KAEL Finance",
    price: rupiah(MODULE_PRICE.finance),
    renewal: `${rupiah(MODULE_RENEWAL.finance)}/tahun`,
    forWho: "Cafe, resto, bakery, toko kulakan, dan bisnis F&B/retail.",
    features: [
      "Kalkulator HPP per produk (Bahan baku, qty, unit gr/ml/pcs)",
      "Packaging cost, biaya operasional & jumlah hasil produksi",
      "HPP per unit, harga jual, profit per unit, margin & markup",
      "Target profit simulation & rekomendasi harga jual",
      "Kalkulasi resep olahan sendiri & produk kulakan/reseller",
      "🎁 Bonus: Tim KAEL bantu input maks 10 produk pertama",
    ],
    cta: "Hitung Untung Bisnis Saya",
    href: waLink("Halo KAEL, saya mau modul KAEL Finance (Rp249.000)."),
  },
  {
    id: "loyalty",
    name: "3. KAEL Loyalty",
    price: rupiah(MODULE_PRICE.loyalty),
    renewal: `${rupiah(MODULE_RENEWAL.loyalty)}/tahun`,
    forWho: "Bikin Pelanggan Punya Alasan untuk Balik Lagi.",
    features: [
      "1x KAEL NFC Member Card / Standee + QR membership",
      "Registrasi pelanggan via nomor WhatsApp & customer database",
      "Sistem poin, sistem stamp & reward/voucher digital",
      "Point history, reward history & customer progress page",
      "Dashboard kasir: cari customer via No WA, tambah poin & redeem",
      "🎁 Bonus: Setup loyalty program & desain member poster",
    ],
    cta: "Bikin Customer Balik Lagi",
    href: waLink("Halo KAEL, saya mau modul KAEL Loyalty (Rp399.000)."),
  },
  {
    id: "pos",
    name: "4. KAEL POS & Ordering",
    price: rupiah(MODULE_PRICE.pos),
    renewal: `${rupiah(MODULE_RENEWAL.pos)}/tahun`,
    forWho: "Digitalisasi kasir & self-order meja tanpa ribet.",
    features: [
      "Kasir berbasis web: Buka di laptop, tablet, dan HP",
      "Menu digital QR: Dine-in / takeaway & nomor meja",
      "Cart, catatan pesanan, cash / QRIS / transfer, diskon & tax",
      "Digital receipt, order status & transaction history",
      "Laporan harian & bulanan, produk terlaris, daily revenue",
      "Support printer thermal kompatibel melalui browser/device",
      "🎁 Bonus: Tim KAEL bantu input maks 30 menu/produk",
    ],
    cta: "Digitalisasi Kasir Saya",
    href: waLink("Halo KAEL, saya mau modul KAEL POS & Ordering (Rp549.000)."),
  },
];

// =========================================================================
// 3. TABEL RENEWAL CLOUD & SUPPORT TAHUNAN
// =========================================================================
// Tahun pertama ditulis "termasuk harga beli", bukan "gratis". Menyebutnya
// gratis melatih pembeli menganggapnya bonus, lalu tagihan tahun kedua terasa
// seperti biaya yang tiba-tiba muncul.
const renewalList = [
  { product: "KAEL Review", yearOne: "Termasuk harga beli", nextYear: `${rupiah(MODULE_RENEWAL.review)} / tahun` },
  { product: "KAEL Finance", yearOne: "Termasuk harga beli", nextYear: `${rupiah(MODULE_RENEWAL.finance)} / tahun` },
  { product: "KAEL Loyalty", yearOne: "Termasuk harga beli", nextYear: `${rupiah(MODULE_RENEWAL.loyalty)} / tahun` },
  { product: "KAEL POS & Ordering", yearOne: "Termasuk harga beli", nextYear: `${rupiah(MODULE_RENEWAL.pos)} / tahun` },
  { product: "KAEL Ultimate Ecosystem (4 Modul)", yearOne: "Termasuk harga beli", nextYear: `${rupiah(BUNDLE_RENEWAL.ultimate)} / tahun (~Rp 25rb/bulan)` },
];

// =========================================================================
// 4. DATA ADD-ON OPSIONAL (PRINTER THERMAL, SETTING QRIS, EXTRA NFC)
// =========================================================================
const optionalAddOns = [
  {
    id: "thermal-printer",
    title: "Mesin Printer Thermal Bluetooth 58mm",
    badge: "HARDWARE RESMI",
    price: "Rp 349.000",
    period: "Sekali Beli • Unit Baru",
    description: "Hardware printer struk kasir nirkabel (bluetooth) 58mm hemat listrik + FREE 5 roll kertas thermal. Plug & play langsung cetak struk dari tablet / HP tokomu.",
    cta: "Tambah Printer Thermal",
    href: waLink("Halo KAEL, saya mau pesan Add-on Mesin Printer Thermal Bluetooth 58mm seharga Rp349.000."),
    icon: Printer,
  },
  {
    id: "setup-qris",
    title: "Jasa Setting & Integrasi QRIS Usaha",
    badge: "BANTUAN SETUP",
    price: "Rp 30.000",
    period: "Sekali Bayar",
    description: "Tim KAEL bantu pandu registrasi, verifikasi dokumen, dan setup QRIS tokomu sampai 100% aktif dan siap terima pembayaran BCA, GoPay, OVO, ShopeePay & DANA.",
    cta: "Tambah Jasa Setting QRIS",
    href: waLink("Halo KAEL, saya mau tambah Add-on Jasa Setting QRIS seharga Rp30.000."),
    icon: QrCode,
  },
  {
    id: "extra-nfc",
    title: "Ekstra Kartu / Standee NFC Tambahan",
    badge: "MEDIA FISIK",
    price: "Rp 69.000 / pcs",
    period: "Per Kartu Fisik",
    description: "Kartu akrilik tap NFC tambahan untuk ditaruh di setiap meja makan tamu, meja kasir kedua, atau cabang baru usahamu.",
    cta: "Tambah Kartu Ekstra",
    href: waLink("Halo KAEL, saya mau pesan Ekstra Kartu / Standee NFC Tambahan seharga Rp69.000/pcs."),
    icon: Nfc,
  },
];

export function Packages() {
  return (
    <section id="paket" className="py-12 sm:py-24 bg-[#fcfcfe] border-b border-[#dedee8]">
      <Container>
        
        {/* ========================================================= */}
        {/* 1. SECTION HEADER (COPY RESMI FINAL) */}
        {/* ========================================================= */}
        <div className="mx-auto max-w-3xl text-center">
          <Reveal>
            <div className="eyebrow inline-flex items-center gap-1.5">
              <span>✦</span>
              <span>STRUKTUR HARGA RESMI</span>
            </div>
            <h2 className="mt-3 text-2xl sm:text-5xl font-extrabold tracking-tight text-[#232331] leading-tight">
              Mulai dari yang <i className="font-serif italic font-normal text-[#7958d8]">Bisnis Kamu Butuhkan</i>
            </h2>
            <p className="mt-3 text-xs sm:text-base font-normal leading-relaxed text-[#7b7b8e]">
              Pilih satu modul atau gunakan <strong>KAEL Ultimate</strong> untuk mendapatkan seluruh sistem inti dalam satu paket terpadu.
            </p>
          </Reveal>
        </div>

        {/* ========================================================= */}
        {/* 2. 3 PILIHAN PAKET BUNDLING (STARTER, GROWTH, ULTIMATE) */}
        {/* ========================================================= */}
        <div className="mt-10 sm:mt-14 grid gap-6 lg:grid-cols-3 items-stretch">
          {bundles.map((b, i) => (
            <Reveal key={b.id} delay={i * 0.08}>
              <div
                className={`card-tactile flex h-full flex-col justify-between rounded-3xl p-5 sm:p-7 transition-all border-2 ${
                  b.isFeatured
                    ? "bg-[#232331] text-white shadow-purple-lg border-[#232331] lg:-translate-y-2 ring-2 ring-[#d9ff57]/50"
                    : "bg-white text-[#232331] border-[#232331]"
                }`}
              >
                <div>
                  {/* Top Badge */}
                  <div className="flex items-center justify-between gap-2 border-b pb-3.5" style={{ borderColor: b.isFeatured ? "#3d3d4e" : "#dedee8" }}>
                    <span
                      className={`font-mono text-[10px] font-bold uppercase tracking-wider ${
                        b.isFeatured ? "text-[#d9ff57]" : "text-[#7958d8]"
                      }`}
                    >
                      {b.badge}
                    </span>
                    {b.highlightBadge && (
                      <span
                        className={`rounded-full px-2.5 py-0.5 font-mono text-[9px] font-bold uppercase ${
                          b.isFeatured
                            ? "bg-[#d9ff57] text-[#232331]"
                            : "bg-[#f0edff] text-[#7958d8] border border-[#7958d8]"
                        }`}
                      >
                        {b.highlightBadge}
                      </span>
                    )}
                  </div>

                  {/* Title & Tagline */}
                  <h3 className="mt-4 text-xl sm:text-2xl font-extrabold tracking-tight">
                    {b.name}
                  </h3>
                  <p
                    className={`mt-1.5 text-xs leading-relaxed ${
                      b.isFeatured ? "text-[#dedee8]" : "text-[#7b7b8e]"
                    }`}
                  >
                    {b.tagline}
                  </p>

                  {/* Price Box */}
                  <div
                    className={`mt-5 rounded-2xl p-4 text-left border ${
                      b.isFeatured
                        ? "bg-[#2b2b3b] border-[#3d3d4e]"
                        : "bg-[#fcfcfe] border-[#dedee8]"
                    }`}
                  >
                    {/* Pembanding harga hanya muncul untuk paket berisi lebih
                        dari satu modul, dan yang dicoret adalah total harga
                        satuan yang benar-benar berlaku di halaman ini. */}
                    {b.separatePrice && (
                      <div className="flex flex-wrap items-center gap-2 font-mono">
                        <span className="text-[10px] text-[#7b7b8e]">
                          Beli satuan{" "}
                          <span className="line-through">{b.separatePrice}</span>
                        </span>
                        {b.savings && (
                          <span className="rounded bg-[#ef4444] px-1.5 py-0.5 text-[9.5px] font-bold text-white">
                            {b.savings}
                          </span>
                        )}
                      </div>
                    )}

                    <div className="mt-1">
                      <span
                        className={`font-mono text-2xl sm:text-3xl font-extrabold ${
                          b.isFeatured ? "text-[#d9ff57]" : "text-[#232331]"
                        }`}
                      >
                        {b.price}
                      </span>
                      <span className="text-[10px] font-mono block text-[#7b7b8e] mt-0.5">
                        Sekali bayar · sudah termasuk 1 tahun cloud &amp; support
                      </span>
                    </div>

                    {/* Renewal ditulis sebagai biaya lanjutan, bukan sebagai
                        bonus gratis. Menyebutnya "gratis" di tahun pertama
                        bikin penagihan tahun kedua jadi kejutan. */}
                    <p className="mt-2 text-[10px] text-[#7958d8] font-bold border-t pt-2" style={{ borderColor: b.isFeatured ? "#3d3d4e" : "#dedee8" }}>
                      Setelah 1 tahun: <span className={b.isFeatured ? "text-white font-normal" : "text-[#232331] font-normal"}>{b.renewal}</span> untuk perpanjangan
                    </p>
                  </div>

                  {/* Feature Checkmarks */}
                  <ul className="mt-5 space-y-2.5 text-xs">
                    {b.includes.map((item) => (
                      <li key={item} className="flex items-start gap-2">
                        <span
                          className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full ${
                            b.isFeatured
                              ? "bg-[#d9ff57] text-[#232331]"
                              : "bg-[#f0edff] text-[#7958d8]"
                          }`}
                        >
                          <Check size={10} strokeWidth={3} />
                        </span>
                        <span className={b.isFeatured ? "text-[#dedee8]" : "text-[#232331]"}>
                          {item}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>

                {/* Bottom CTA */}
                <div className="mt-7 border-t pt-4" style={{ borderColor: b.isFeatured ? "#3d3d4e" : "#dedee8" }}>
                  <a
                    href={b.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={`btn-tactile flex w-full items-center justify-center gap-2 rounded-xl py-3 text-xs sm:text-sm font-extrabold transition-all ${
                      b.isFeatured
                        ? "bg-[#d9ff57] text-[#232331] hover:bg-[#cbf740] shadow-ink-md"
                        : "bg-[#232331] text-white hover:bg-[#1a1a24]"
                    }`}
                  >
                    {b.isFeatured && <Sparkles size={14} />}
                    <span>{b.cta}</span>
                    <ArrowRight size={13} strokeWidth={2.5} />
                  </a>
                  <p className="mt-2 text-center text-[10px] text-[#7b7b8e]">
                    {b.isFeatured ? "⚡ Target setup 1–2 hari kerja setelah data lengkap" : "Setup awal dibantu oleh tim teknis KAEL"}
                  </p>
                </div>
              </div>
            </Reveal>
          ))}
        </div>

        {/* ========================================================= */}
        {/* BRAND PERSONALIZATION CALLOUT BANNER */}
        {/* ========================================================= */}
        <div className="mt-8 sm:mt-10">
          <Reveal>
            <div className="rounded-2xl border-2 border-[#232331] bg-[#f0edff] p-4 sm:p-5 text-[#232331] shadow-ink-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-start gap-3 min-w-0 flex-1">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-[#7958d8] text-white font-bold border border-[#232331] shadow-ink-xs">
                  <Palette size={16} strokeWidth={2.4} />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h4 className="text-xs sm:text-sm font-extrabold text-[#232331]">
                      🎨 Otomatis Dipersonalisasi dengan Logo &amp; Brand Tokomu!
                    </h4>
                    <span className="font-mono text-[9px] font-bold text-[#16a34a] bg-[#dcfce7] px-2 py-0.5 rounded border border-[#16a34a] shrink-0">
                      Co-Branding Model
                    </span>
                  </div>
                  <p className="text-[11px] text-[#7b7b8e] mt-0.5 leading-relaxed">
                    Setiap tampilan yang dilihat pembeli (Menu QR Meja, Struk Kasir, Kartu Standee, dan Halaman Member WhatsApp) otomatis dipasang <strong>Logo tokomu, Nama Usaha, Foto Banner, dan Warna Brand tokomu</strong> dengan sentuhan resmi <em>Powered by KAEL</em>.
                  </p>
                </div>
              </div>
              <span className="font-mono text-[10px] font-bold bg-[#232331] text-[#d9ff57] px-3 py-1.5 rounded-lg shrink-0 self-start sm:self-center">
                ✓ Termasuk di Semua Paket
              </span>
            </div>
          </Reveal>
        </div>

        {/* ========================================================= */}
        {/* 3. PILIHAN MODUL SATUAN (ALA CARTE) */}
        {/* ========================================================= */}
        <div className="mt-16 sm:mt-24">
          <div className="text-center max-w-2xl mx-auto mb-8">
            <h3 className="text-xl sm:text-3xl font-extrabold tracking-tight text-[#232331]">
              Pilihan Modul Satuan <span className="text-[#7958d8]">(Ala Carte)</span>
            </h3>
            <p className="mt-1.5 text-xs sm:text-sm text-[#7b7b8e]">
              Beli modul spesifik yang paling bisnismu butuhkan saat ini tanpa harus ambil paket lengkap.
            </p>
          </div>

          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {alaCarteModules.map((m, i) => (
              <Reveal key={m.id} delay={i * 0.05}>
                <div className="card-tactile flex h-full flex-col justify-between rounded-2xl bg-white p-4 sm:p-5 text-[#232331] border-2 border-[#232331]">
                  <div>
                    {/* Header */}
                    <div className="border-b border-[#dedee8] pb-2.5">
                      <span className="font-mono text-[9px] font-bold text-[#7958d8] uppercase">
                        MODUL SATUAN
                      </span>
                      <h4 className="text-base font-extrabold text-[#232331] mt-0.5">
                        {m.name}
                      </h4>
                    </div>

                    {/* Price */}
                    <div className="mt-3 rounded-xl bg-[#fcfcfe] border border-[#dedee8] p-3 text-left">
                      <p className="text-xl font-mono font-extrabold text-[#232331]">
                        {m.price}
                      </p>
                      <span className="text-[9.5px] font-mono text-[#7b7b8e] block mt-0.5">
                        Sekali bayar · termasuk 1 tahun
                      </span>
                      <span className="text-[9.5px] font-mono text-[#7b7b8e] block mt-0.5">
                        Setelah itu <strong className="text-[#7958d8]">{m.renewal}</strong>
                      </span>
                    </div>

                    <p className="mt-2.5 text-[11px] text-[#7b7b8e] leading-snug">
                      <strong>Untuk siapa:</strong> {m.forWho}
                    </p>

                    {/* Features List */}
                    <ul className="mt-3.5 space-y-2 border-t border-[#dedee8] pt-3 text-xs">
                      {m.features.map((f) => (
                        <li key={f} className="flex items-start gap-1.5 text-[11.5px] text-[#232331] leading-tight">
                          <span className="mt-0.5 flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-full bg-[#f0edff] text-[#7958d8]">
                            <Check size={8} strokeWidth={3} />
                          </span>
                          <span>{f}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div className="mt-5 border-t border-[#dedee8] pt-3">
                    <a
                      href={m.href}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="btn-tactile flex w-full items-center justify-center gap-1.5 rounded-xl bg-[#232331] py-2.5 text-xs font-bold text-white hover:bg-[#1a1a24] transition-all"
                    >
                      <span>{m.cta}</span>
                      <ArrowRight size={11} strokeWidth={2.5} />
                    </a>
                  </div>
                </div>
              </Reveal>
            ))}
          </div>
        </div>

        {/* ========================================================= */}
        {/* 4. PILIHAN ADD-ON OPSIONAL (PRINTER, QRIS, EXTRA NFC) */}
        {/* ========================================================= */}
        <div className="mt-14 sm:mt-20">
          <div className="text-center max-w-2xl mx-auto mb-8">
            <span className="font-mono text-[10px] font-bold uppercase tracking-wider text-[#7958d8]">
              PELENGKAP BISNIS
            </span>
            <h3 className="text-xl sm:text-3xl font-extrabold tracking-tight text-[#232331] mt-0.5">
              Add-On Opsional <span className="text-[#7958d8]">&amp; Hardware</span>
            </h3>
            <p className="mt-1 text-xs sm:text-sm text-[#7b7b8e]">
              Dukungan perangkat keras resmi &amp; jasa setting tambahan untuk maksimalkan operasional usahamu.
            </p>
          </div>

          <div className="grid gap-5 sm:grid-cols-3">
            {optionalAddOns.map((addon, i) => {
              const IconComp = addon.icon;
              return (
                <Reveal key={addon.id} delay={i * 0.06}>
                  <div className="card-tactile flex h-full flex-col justify-between rounded-2xl bg-white p-4 sm:p-6 text-[#232331] border-2 border-[#232331]">
                    <div>
                      {/* Header */}
                      <div className="flex items-center justify-between border-b border-[#dedee8] pb-3">
                        <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#f0edff] text-[#7958d8] border border-[#232331]">
                          <IconComp size={15} strokeWidth={2.4} />
                        </span>
                        <span className="font-mono text-[9px] font-bold text-[#7958d8] bg-[#f0edff] px-2 py-0.5 rounded border border-[#7958d8]">
                          {addon.badge}
                        </span>
                      </div>

                      <h4 className="text-base font-extrabold text-[#232331] mt-3.5">
                        {addon.title}
                      </h4>

                      {/* Price Box */}
                      <div className="mt-3 rounded-xl bg-[#fcfcfe] border border-[#dedee8] p-3 text-left">
                        <p className="text-xl font-mono font-extrabold text-[#232331]">
                          {addon.price}
                        </p>
                        <span className="text-[9.5px] font-mono text-[#7b7b8e] block mt-0.5">
                          {addon.period}
                        </span>
                      </div>

                      <p className="mt-3 text-xs text-[#7b7b8e] leading-relaxed">
                        {addon.description}
                      </p>
                    </div>

                    <div className="mt-5 border-t border-[#dedee8] pt-3.5">
                      <a
                        href={addon.href}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="btn-tactile flex w-full items-center justify-center gap-1.5 rounded-xl bg-[#232331] py-2.5 text-xs font-bold text-[#d9ff57] hover:bg-[#1a1a24] transition-all"
                      >
                        <span>{addon.cta}</span>
                        <ArrowRight size={11} strokeWidth={2.5} />
                      </a>
                    </div>
                  </div>
                </Reveal>
              );
            })}
          </div>
        </div>

        {/* ========================================================= */}
        {/* 5. TABEL RENEWAL CLOUD & SUPPORT TAHUNAN */}
        {/* ========================================================= */}
        <div className="mt-14 sm:mt-20">
          <Reveal>
            <div className="rounded-2xl sm:rounded-3xl border-2 border-[#232331] bg-white p-5 sm:p-8 shadow-ink-md">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#dedee8] pb-4">
                <div>
                  <span className="font-mono text-[10px] font-bold text-[#7958d8] uppercase tracking-wider">
                    TRANSPARANSI BIAYA PERAWATAN SISTEM
                  </span>
                  <h4 className="text-lg sm:text-xl font-extrabold text-[#232331] mt-0.5">
                    Cloud &amp; Support Tahunan (Renewal)
                  </h4>
                  <p className="text-xs text-[#7b7b8e] mt-0.5">
                    Tahun pertama sudah termasuk dalam harga beli. Mulai tahun kedua ada biaya perawatan server dan support yang ditagih setahun sekali.
                  </p>
                </div>
                <div className="rounded-xl bg-[#f0edff] border border-[#7958d8]/30 px-3.5 py-2 font-mono text-xs text-[#7958d8] font-bold shrink-0 self-start sm:self-auto">
                  Ditagih per tahun, bukan per bulan
                </div>
              </div>

              {/* Table */}
              <div className="mt-4 overflow-x-auto">
                <table className="w-full text-left font-mono text-xs">
                  <thead>
                    <tr className="border-b border-[#dedee8] text-[#7b7b8e] text-[10px] uppercase">
                      <th className="py-2.5 px-3">Produk / Paket</th>
                      <th className="py-2.5 px-3">Tahun Pertama</th>
                      <th className="py-2.5 px-3">Tahun Berikutnya</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#dedee8]">
                    {renewalList.map((row, idx) => (
                      <tr key={row.product} className={idx === 4 ? "bg-[#d9ff57]/20 font-bold" : ""}>
                        <td className="py-3 px-3 font-sans font-extrabold text-[#232331]">
                          {row.product}
                        </td>
                        <td className="py-3 px-3 text-[#16a34a] font-bold">
                          ✓ {row.yearOne}
                        </td>
                        <td className="py-3 px-3 text-[#7958d8] font-bold">
                          {row.nextYear}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="mt-4 rounded-xl bg-[#fcfcfe] border border-[#dedee8] p-3 text-[11px] text-[#7b7b8e] leading-relaxed">
ℹ️ <strong>Catatan:</strong> Pemilik paket <strong>KAEL Ultimate</strong> membayar <strong>{rupiah(BUNDLE_RENEWAL.ultimate)} / tahun</strong> (setara ~Rp 25.000 / bulan) mulai tahun kedua, untuk perawatan server, backup database, dan customer priority support.
              </div>
            </div>
          </Reveal>
        </div>

        {/* ========================================================= */}
        {/* 5. KETENTUAN LAYANAN & BATASAN SCOPE (DISCLAIMER RESMI) */}
        {/* ========================================================= */}
        <div className="mt-8 rounded-2xl border border-[#dedee8] bg-[#fcfcfe] p-4 sm:p-6 text-[#7b7b8e] text-[11px] leading-relaxed space-y-2">
          <div className="flex items-center gap-1.5 text-xs font-bold text-[#232331]">
            <ShieldCheck size={14} className="text-[#7958d8]" />
            <span>Ketentuan &amp; Cakupan Layanan KAEL:</span>
          </div>
          <p>
            1. <strong>Cakupan Setup Awal:</strong> Harga paket sudah termasuk setup awal sesuai batas kuota yang tercantum pada masing-masing paket. Perubahan fitur custom di luar standar, integrasi pihak ketiga, penambahan hardware, domain khusus (.com/.id berbayar), atau kebutuhan di luar scope dihitung terpisah secara profesional.
          </p>
          <p>
            2. <strong>Layanan Eksternal Pihak Ketiga:</strong> Biaya operasional layanan pihak ketiga seperti WhatsApp Business API resmi, payment gateway transaction fee per transaksi, hardware printer kasir, atau langganan domain berbayar tidak termasuk di dalam paket kecuali dinyatakan secara tertulis.
          </p>
          <p>
            3. <strong>Hardware Thermal Printer:</strong> Sistem POS KAEL mendukung pencetakan ke printer thermal yang kompatibel melalui web browser / device jika konfigurasi Bluetooth / USB perangkat mendukung.
          </p>
          <p>
            4. <strong>Personalisasi Brand Toko:</strong> Seluruh paket sudah termasuk pemasangan identitas tokomu (Logo, Nama Usaha, Kontak &amp; Warna Aksen) pada Menu QR Meja, Layout Struk Kasir, dan Desain Standee dengan watermark resmi <em>Powered by KAEL</em>. Opsi Full White-Label (tanpa watermark KAEL) tersedia sebagai add-on khusus.
          </p>
        </div>

      </Container>
    </section>
  );
}
