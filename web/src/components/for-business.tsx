"use client";

import { useState } from "react";
import { ArrowRight, Check, Coffee, Scissors, Shirt, Sparkles, Store, Utensils } from "lucide-react";
import { Container } from "@/components/ui/section";
import { Reveal } from "@/components/ui/reveal";
import { cta } from "@/lib/site";

const sectors = [
  {
    id: "fnb-cafe",
    icon: Coffee,
    name: "Kedai Kopi & Cafe",
    tagline: "Banjir rating 5★ di Google Maps & hitung modal kopi per cup",
    description: "Sangat pas buat coffee shop dan cafe kekinian. Percepat antrean kasir, ajak pelanggan kasih bintang 5 sambil nunggu pesanan, dan tau persis modal susu & beans per cup.",
    modules: [
      { name: "Kartu Tap Review NFC", desc: "Tempel di meja kasir, ulasan bintang 5 langsung masuk dalam 1 detik" },
      { name: "Kasir POS Kilat", desc: "Input pesanan cepet, cetak tiket barista & nota bluetooth" },
      { name: "Hitung HPP Biji & Susu", desc: "Ketahui modal bahan baku presisi tiap resep kopi" },
      { name: "Poin Loyalitas WA", desc: "Stamp digital via WhatsApp (Contoh: Beli 8 Cup Gratis 1)" },
    ],
    highlightQuote: "Ulasan Google Senja Coffee naik dari 42 jadi 520+ review dalam 2 bulan.",
    image: "https://images.unsplash.com/photo-1554118811-1e0d58224f24?w=800&auto=format&fit=crop&q=80",
  },
  {
    id: "resto-kuliner",
    icon: Utensils,
    name: "Resto & Rumah Makan",
    tagline: "Atur pesanan meja & pantau modal resep bahan baku dapur",
    description: "Bikin operasional rumah makan dan resto keluarga jadi tertata rapi. Lacak stok bahan baku dapur, split bill kasir, dan rekap penjualan tanpa nota hilang.",
    modules: [
      { name: "Kasir & Nomor Meja", desc: "Pencatatan meja makan, pisah tagihan (split bill), dan cetak ke dapur" },
      { name: "Standarisasi Resep HPP", desc: "Pantau gramasi bumbu agar margin keuntungan makanan stabil" },
      { name: "Standee Review Meja", desc: "Standee akrilik di meja makan buat ajak tamu review makanan" },
      { name: "Menu Digital QR", desc: "Tamu bisa liat menu dan foto makanan langsung dari meja" },
    ],
    highlightQuote: "Semua bahan dapur tercatat rapi dan gak ada lagi bon kasir yang tercecer.",
    image: "https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=800&auto=format&fit=crop&q=80",
  },
  {
    id: "barber-salon",
    icon: Scissors,
    name: "Barbershop & Salon",
    tagline: "Pelanggan booking mandiri dari rumah & bagi hasil kapster otomatis",
    description: "Pelanggan bisa pilih jam potong dan kapster favorit tanpa antre nunggu 1 jam di toko. Komisi harian staf dan kapster otomatis terhitung rapi.",
    modules: [
      { name: "Booking Online Mandiri", desc: "Pelanggan pilih slot jam & kapster favorit tanpa bentrok" },
      { name: "Kartu Tap Meja Kaca", desc: "Minta review bintang 5 pas selesai potong rambut" },
      { name: "Hitung Komisi Kapster", desc: "Bagi hasil persenan staf harian/bulanan otomatis" },
      { name: "Pengingat Jadwal WA", desc: "Kirim WA otomatis ingetin jadwal potong tiap 3 minggu" },
    ],
    highlightQuote: "Kursi barbershop selalu penuh dan gak ada jadwal pelanggan yang bentrok.",
    image: "https://images.unsplash.com/photo-1503951914875-452162b0f3f1?w=800&auto=format&fit=crop&q=80",
  },
  {
    id: "retail-toko",
    icon: Store,
    name: "Toko Baju & Retail",
    tagline: "Scan barcode cepet & stok barang di gudang selalu akurat",
    description: "Cocok buat butik fashion, toko oleh-oleh, atau minimarket lokal. Transaksi kasir cepet pake scanner barcode dan stok barang gak bakal selisih.",
    modules: [
      { name: "Kasir Barcode Retail", desc: "Support scanner barcode, nota kasir, dan pembayaran QRIS" },
      { name: "Alarm Stok Menipis", desc: "Dapet notifikasi otomatis pas stok barang di etalase mau habis" },
      { name: "Kartu Tap Kasir", desc: "Ajak pembeli kasih bintang 5 sambil nunggu barang dibungkus" },
      { name: "Broadcast Diskon WA", desc: "Kirim info promo dan diskon baru ke pelanggan setia" },
    ],
    highlightQuote: "Stok 1,200 jenis baju tercatat akurat dan antrean kasir jadi super cepet.",
    image: "https://images.unsplash.com/photo-1513694203232-719a280e022f?w=800&auto=format&fit=crop&q=80",
  },
  {
    id: "laundry-jasa",
    icon: Shirt,
    name: "Laundry & Jasa Cuci",
    tagline: "Pelanggan dapet WA otomatis pas cucian selesai & siap diambil",
    description: "Tingkatkan rasa percaya pelanggan laundry kiloan/satuan atau jasa cuci sepatu. Sistem kirim notifikasi WhatsApp otomatis begitu baju selesai disetrika.",
    modules: [
      { name: "Kasir Nomor Rak", desc: "Cetak nota nomor rak cucian & status pengerjaan" },
      { name: "Notifikasi WA Otomatis", desc: "Pesan otomatis ke WA pelanggan: 'Cucian Anda Sudah Selesai!'" },
      { name: "Kartu Tap Ambil Baju", desc: "Minta review Google pas pelanggan ambil cucian bersih" },
      { name: "Laporan Omzet Harian", desc: "Rekap penghasilan harian otomatis masuk ke WA owner" },
    ],
    highlightQuote: "Pelanggan seneng banget dapet WA otomatis pas bajunya udah wangi.",
    image: "https://images.unsplash.com/photo-1497366216548-37526070297c?w=800&auto=format&fit=crop&q=80",
  },
];

export function ForBusiness() {
  const [activeTab, setActiveTab] = useState(0);
  const current = sectors[activeTab];

  return (
    <section id="untuk-bisnis" className="py-12 sm:py-24 bg-[#fcfcfe]">
      <Container>
        {/* Section Header */}
        <div className="mx-auto max-w-2xl text-center">
          <Reveal>
            <div className="eyebrow inline-flex items-center gap-1.5">
              <span>✦</span>
              <span>SEKTOR USAHA & TOKO</span>
            </div>
            <h2 className="mt-3 text-2xl sm:text-5xl font-extrabold tracking-tight text-[#232331] leading-tight">
              Cocok buat <i className="font-serif italic font-normal text-[#7958d8]">sektor tokomu.</i>
            </h2>
            <p className="mt-2.5 text-xs sm:text-sm font-normal leading-relaxed text-[#7b7b8e]">
              Tiap jenis usaha punya alur kerja yang beda. Pilih jenis tokomu di bawah buat liat kombinasi alat KAEL yang paling pas.
            </p>
          </Reveal>
        </div>

        {/* Horizontal Industry Selector Pills */}
        <Reveal delay={0.1} className="mt-8 sm:mt-10">
          <div className="flex flex-wrap items-center justify-center gap-1.5 sm:gap-3">
            {sectors.map((sec, idx) => {
              const Icon = sec.icon;
              const isActive = activeTab === idx;
              return (
                <button
                  key={sec.id}
                  type="button"
                  onClick={() => setActiveTab(idx)}
                  className={`btn-tactile flex items-center gap-1.5 sm:gap-2 rounded-xl px-3 sm:px-4 py-2 sm:py-2.5 text-xs font-bold transition-all ${
                    isActive
                      ? "bg-[#d9ff57] text-[#232331] shadow-ink-md"
                      : "bg-white text-[#232331] shadow-ink-xs hover:bg-[#f0edff]"
                  }`}
                >
                  <Icon size={13} className={isActive ? "text-[#232331]" : "text-[#7958d8]"} strokeWidth={2.4} />
                  <span>{sec.name}</span>
                </button>
              );
            })}
          </div>
        </Reveal>

        {/* Selected Sector Deep-Dive Card (ChatJudge Card Style) */}
        <Reveal delay={0.15} className="mt-6 sm:mt-8">
          <div className="rounded-2xl border-2 border-[#232331] bg-white p-4 sm:p-10 shadow-ink-lg text-[#232331]">
            <div className="grid gap-6 sm:gap-8 lg:grid-cols-12 lg:gap-12 items-center">
              
              {/* Left Column: Sector Story & Recommended Stack */}
              <div className="lg:col-span-7">
                <div className="inline-flex items-center gap-2 rounded-full border border-[#232331] bg-[#f0edff] px-3 py-1 font-mono text-[10px] font-bold text-[#7958d8] uppercase">
                  <span>✦</span>
                  <span>{current.tagline}</span>
                </div>

                <h3 className="mt-3 text-2xl sm:text-3xl font-extrabold tracking-tight text-[#232331]">
                  {current.name}
                </h3>
                <p className="mt-2 text-xs sm:text-sm font-normal leading-relaxed text-[#7b7b8e]">
                  {current.description}
                </p>

                {/* 4 Feature Badges Grid */}
                <div className="mt-6 grid gap-3 sm:grid-cols-2">
                  {current.modules.map((m) => (
                    <div
                      key={m.name}
                      className="rounded-xl border-[1.5px] border-[#232331] bg-[#fcfcfe] p-3.5 shadow-ink-xs"
                    >
                      <div className="flex items-start gap-2.5">
                        <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#d9ff57] text-[#232331]">
                          <Check size={12} strokeWidth={3} />
                        </span>
                        <div>
                          <h4 className="text-xs font-bold text-[#232331]">
                            {m.name}
                          </h4>
                          <p className="mt-0.5 text-[11px] font-normal text-[#7b7b8e] leading-relaxed">
                            {m.desc}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Real-world quote from industry */}
                <div className="mt-5 rounded-xl border border-[#dedee8] bg-[#f0edff] p-3.5 text-xs font-normal text-[#232331]">
                  💬 <strong>Dampak Nyata:</strong> &ldquo;{current.highlightQuote}&rdquo;
                </div>

                <div className="mt-6">
                  <a
                    href={cta.consult.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn-tactile inline-flex items-center gap-2 rounded-xl bg-[#232331] px-5 py-3 text-xs font-bold text-white shadow-ink-sm hover:bg-[#1a1a24]"
                  >
                    <span>Pasang Modul untuk {current.name}</span>
                    <ArrowRight size={13} strokeWidth={2.5} className="text-[#d9ff57]" />
                  </a>
                </div>
              </div>

              {/* Right Column: Visual Business Mood Snapshot */}
              <div className="lg:col-span-5">
                <div className="relative aspect-[4/3] w-full overflow-hidden rounded-2xl border-2 border-[#232331] shadow-ink-md">
                  <img
                    src={current.image}
                    alt={current.name}
                    className="h-full w-full object-cover"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-[#232331]/80 via-transparent to-transparent" />
                  <div className="absolute bottom-3 left-4 right-4 text-white">
                    <span className="font-mono text-[9px] font-bold uppercase tracking-widest text-[#d9ff57]">
                      MITRA KAEL SYSTEM
                    </span>
                    <p className="text-xs font-medium text-white mt-0.5">
                      {current.name} • 100% Siap Pakai
                    </p>
                  </div>
                </div>
              </div>

            </div>
          </div>
        </Reveal>
      </Container>
    </section>
  );
}
