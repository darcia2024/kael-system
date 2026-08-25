"use client";

import { useState } from "react";
import { ArrowRight, Check, Sparkles, Star, Zap } from "lucide-react";
import { Container } from "@/components/ui/section";
import { Reveal } from "@/components/ui/reveal";
import { cta } from "@/lib/site";

const productCategories = [
  {
    id: "review-nfc",
    title: "1. KAEL Review",
    tagline: "Undang ulasan jujur & rating organik Google Maps sekali tap HP",
    description: "1x Kartu akrilik resmi KAEL siap pakai. Skema fleksibel: bisa ditaruh di kasir/meja atau disodorkan ramah oleh staf ke customer untuk mengajak rating jujur organik tanpa repot ketik nama toko.",
    features: [
      "1x KAEL NFC Review Card / Standee + QR backup",
      "Direct link permanen — ter-lock presisi ke link tokomu",
      "Card ID, tap/scan counter & dashboard basic",
      "🎁 GRATIS file desain poster & standee promosi ulasan",
    ],
    ctaText: "Mulai Kumpulkan Review",
    href: cta.orderReview.href,
  },
  {
    id: "pos-kasir",
    title: "2. KAEL POS & Ordering",
    tagline: "Kasir Web Multi-Device & Menu Digital QR Meja Tamu",
    description: "Tamu duduk dan scan QR di meja — otomatis terdaftar nomor meja, pesan menu, dan bayar (QRIS / Tunai / Transfer). Kasir web mendukung pencetakan digital receipt / thermal printer kompatibel lengkap dengan laporan penjualan.",
    features: [
      "Kasir Web (Laptop, Tablet, HP) + Menu Digital QR Meja",
      "Cart, catatan pesanan, cash / QRIS / transfer, diskon & tax",
      "Laporan harian & bulanan, produk terlaris, daily revenue",
      "Support printer thermal kompatibel melalui browser/device",
      "🎁 GRATIS Setup Maksimal 30 Menu & Desain QR Meja",
    ],
    ctaText: "Digitalisasi Kasir Saya",
    href: cta.consult.href,
  },
  {
    id: "finance-hpp",
    title: "3. KAEL Finance",
    tagline: "Kalkulator HPP, Simulasi Profit & Margin Laba Anti Boncos",
    description: "Ketahui modal bahan baku riil resep olahan sendiri atau akumulasi harga beli supplier kulakan + ongkir per pcs + biaya packaging box. Deteksi margin laba sehat agar terbebas dari tekor kas.",
    features: [
      "Dual Mode: Resep Produksi Sendiri vs Produk Kulakan/Reseller",
      "Input bahan baku (gr/kg/ml/liter/pcs), packaging & operasional",
      "Margin, markup, target profit simulation & rekomendasi harga jual",
      "🎁 GRATIS Konsultasi & Input Maksimal 10 Produk Pertama",
    ],
    ctaText: "Hitung Untung Bisnis Saya",
    href: cta.consult.href,
  },
  {
    id: "loyalty-wa",
    title: "4. KAEL Loyalty",
    tagline: "Bikin Pelanggan Punya Alasan untuk Balik Lagi",
    description: "Pelanggan tap kartu NFC / scan QR untuk daftar member instan via nomor WhatsApp. Sistem poin, stamp, dan reward tercatat rapi, dan kasir cukup verifikasi di dashboard saat pelanggan klaim reward.",
    features: [
      "1x KAEL NFC Member Card / Standee + QR membership",
      "Registrasi via nomor WhatsApp & customer database",
      "Sistem poin, stamp, tier membership & customer progress page",
      "Dashboard kasir: cari customer via No WA & redeem reward",
      "🎁 GRATIS Setup Program Loyalty & Desain Member Display",
    ],
    ctaText: "Bikin Customer Balik Lagi",
    href: cta.consult.href,
  },
  {
    id: "custom-system",
    title: "5. Sistem Custom Sesuai Alur Usahamu",
    tagline: "Punya alur kerja khusus? Kami bangun sistem yang pas untuk tokomu",
    description: "Punya alur operasional unik yang tidak terakomodasi di aplikasi pasaran? Tim developer KAEL siap membangun modul khusus yang dirancang presisi sesuai SOP usahamu.",
    features: [
      "Diskusi alur kerja langsung bareng tim developer KAEL",
      "Tampilan antarmuka gampang dipahami oleh staf tokomu",
      "Integrasi perangkat kasir, scanner barcode, atau printer dapur",
      "Pendampingan & pemeliharaan berkala oleh tim teknis KAEL",
    ],
    ctaText: "Diskusikan Sistem Khusus",
    href: cta.consult.href,
  },
];

export function ProductSelector() {
  const [selectedId, setSelectedId] = useState("review-nfc");

  return (
    <section id="our-product" className="py-12 sm:py-24 bg-[#fcfcfe] border-b border-[#dedee8]">
      <Container>
        <div className="grid gap-8 lg:grid-cols-12 lg:gap-16 items-start">
          
          {/* Left Column: Heading */}
          <div className="lg:col-span-5">
            <Reveal>
              <div className="eyebrow inline-flex items-center gap-1.5">
                <span>✦</span>
                <span>KATALOG MODUL TEMPUR</span>
              </div>
              <h2 className="mt-3 text-2xl sm:text-5xl font-extrabold tracking-tight text-[#232331] leading-tight">
                Pilih modul <i className="font-serif italic font-normal text-[#7958d8]">yang tokomu butuhkan.</i>
              </h2>

              <p className="mt-2.5 text-xs sm:text-sm font-normal leading-relaxed text-[#7b7b8e] max-w-[420px]">
                Pilih modul yang paling toko kamu butuhin sekarang. Semua alat dirancang simpel,
                tahan banting, dan langsung siap pakai tanpa perlu keahlian teknis.
              </p>

              <div className="mt-6 sm:mt-8">
                <a
                  href={cta.consult.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn-tactile inline-flex items-center gap-2 rounded-xl bg-[#d9ff57] px-5 py-3 text-xs font-bold text-[#232331]"
                >
                  <span>Bingung Pilih Mana? Tanya Kami</span>
                  <ArrowRight size={13} strokeWidth={2.5} />
                </a>
              </div>
            </Reveal>
          </div>

          {/* Right Column: Stack of Selectable Rows */}
          <div className="lg:col-span-7 space-y-3">
            {productCategories.map((item, idx) => {
              const isSelected = selectedId === item.id;
              return (
                <Reveal key={item.id} delay={idx * 0.04}>
                  <div
                    onClick={() => setSelectedId(item.id)}
                    className={`card-tactile cursor-pointer rounded-2xl transition-all ${
                      isSelected
                        ? "bg-[#232331] text-white shadow-purple-lg p-4 sm:p-7"
                        : "bg-white text-[#232331] p-3.5 sm:p-5 shadow-ink-xs hover:bg-[#f0edff]"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <h3
                        className={`text-sm sm:text-lg font-bold tracking-tight transition-colors ${
                          isSelected ? "text-[#d9ff57]" : "text-[#232331]"
                        }`}
                      >
                        {item.title}
                      </h3>
                      <span
                        className={`flex h-7 w-7 items-center justify-center rounded-lg border-[1.5px] border-[#232331] font-mono text-xs font-bold transition-all ${
                          isSelected
                            ? "bg-[#d9ff57] text-[#232331]"
                            : "bg-[#f0edff] text-[#232331]"
                        }`}
                      >
                        {isSelected ? "✕" : "→"}
                      </span>
                    </div>

                    {/* Expanded Detail Box for Active Item */}
                    {isSelected && (
                      <div className="mt-4 border-t border-[#3d3d4e] pt-4 animate-fadeIn">
                        <p className="font-mono text-xs font-bold text-[#c5b3f5]">
                          ✦ {item.tagline}
                        </p>
                        <p className="mt-2 text-xs sm:text-sm font-normal leading-relaxed text-[#dedee8]">
                          {item.description}
                        </p>

                        {/* Features Checklist */}
                        <div className="mt-4 grid gap-2 sm:grid-cols-2">
                          {item.features.map((feat) => (
                            <div key={feat} className="flex items-center gap-2 text-xs font-normal text-white">
                              <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-[#d9ff57] text-[9px] font-bold text-[#232331]">
                                ✓
                              </span>
                              <span>{feat}</span>
                            </div>
                          ))}
                        </div>

                        <div className="mt-6 pt-4 border-t border-[#3d3d4e] flex items-center justify-between">
                          <span className="font-mono text-[10px] font-bold uppercase tracking-wider text-[#7b7b8e]">
                            MODUL • 0{idx + 1}
                          </span>
                          <a
                            href={item.href}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="btn-tactile inline-flex items-center gap-2 rounded-xl bg-[#d9ff57] px-4 py-2 text-xs font-bold text-[#232331]"
                          >
                            <span>{item.ctaText}</span>
                            <ArrowRight size={12} strokeWidth={2.5} />
                          </a>
                        </div>
                      </div>
                    )}
                  </div>
                </Reveal>
              );
            })}
          </div>

        </div>
      </Container>
    </section>
  );
}
