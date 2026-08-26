/**
 * Komponen server. Isinya konten pemasaran yang tidak berubah, jadi tidak ada
 * alasan mengirim kodenya ke browser dan menjalankannya ulang di sana.
 *
 * Jangan tambahkan useState, useEffect, atau handler onClick di sini. Kalau
 * suatu bagian memang perlu interaktif, pisahkan bagian itu ke komponen client
 * sendiri, bukan menandai seluruh berkas ini "use client".
 */
import Image from "next/image";
import { ArrowRight, Check, Cpu, Layers, Nfc, QrCode, ShieldCheck, Sparkles, Star, Zap } from "lucide-react";
import { Container } from "@/components/ui/section";
import { Reveal } from "@/components/ui/reveal";
import { cta } from "@/lib/site";

const methods = [
  {
    step: "01",
    title: "Pasang Alat di Kasir Toko",
    desc: "Cukup letakkan standee atau kartu tap NFC di meja kasir. Tanpa colokan listrik, tahan tumpahan kopi & air, langsung aktif seketika.",
    badge: "Plug & Play",
  },
  {
    step: "02",
    title: "Pelanggan Tap HP 1 Detik",
    desc: "Pelanggan cukup mendekatkan HP iPhone atau Android. Halaman ulasan bintang 5 Google Maps langsung terbuka tanpa perlu cari nama toko.",
    badge: "1 Detik Respons",
  },
  {
    step: "03",
    title: "Rekap & Omzet Masuk ke WA",
    desc: "Setiap transaksi kasir dan ulasan baru otomatis tercatat. Laporan laba kotor & bersih harian langsung dikirim ke WhatsApp owner tiap malam.",
    badge: "Otomatis WA",
  },
];

export function WhoWeAre() {
  return (
    <section id="alat-tempur" className="py-12 sm:py-24 bg-[#fcfcfe]">
      <Container>
        
        {/* Section Heading (ChatJudge Section Head) */}
        <div className="mx-auto max-w-2xl text-center">
          <Reveal>
            <div className="eyebrow inline-flex items-center gap-1.5">
              <span>✦</span>
              <span>CARA KERJA KAEL</span>
            </div>
            <h2 className="mt-3 text-2xl sm:text-5xl font-extrabold tracking-tight text-[#232331] leading-tight">
              Sistem praktis <i className="font-serif italic font-normal text-[#7958d8]">yang langsung bekerja.</i>
            </h2>
            <p className="mt-2.5 text-xs sm:text-sm font-normal leading-relaxed text-[#7b7b8e]">
              Gak perlu sewa tim IT atau bayar jutaan tiap bulan. Semua modul KAEL dirancang agar kasir paling awam pun bisa pakai dalam 5 menit.
            </p>
          </Reveal>
        </div>

        {/* 3 Method Cards Grid (ChatJudge Method Cards) */}
        <div className="mt-8 sm:mt-10 grid gap-4 sm:gap-6 sm:grid-cols-3">
          {methods.map((m, i) => (
            <Reveal key={m.step} delay={i * 0.08}>
              <div className="card-tactile flex h-full flex-col justify-between rounded-2xl bg-white p-4 sm:p-7 text-[#232331]">
                <div>
                  {/* Top Bar with Neon Lime Step Pill */}
                  <div className="flex items-center justify-between border-b border-[#dedee8] pb-3 sm:pb-4">
                    <span className="flex h-7 w-7 sm:h-8 sm:w-8 items-center justify-center rounded-lg border-[1.5px] border-[#232331] bg-[#d9ff57] font-mono text-xs sm:text-sm font-bold text-[#232331] shadow-ink-xs">
                      {m.step}
                    </span>
                    <span className="font-mono text-[9.5px] sm:text-[10px] font-bold text-[#7958d8] uppercase tracking-wider">
                      {m.badge}
                    </span>
                  </div>

                  {/* Title & Desc */}
                  <h3 className="mt-4 sm:mt-5 text-base sm:text-lg font-bold tracking-tight text-[#232331]">
                    {m.title}
                  </h3>
                  <p className="mt-1.5 sm:mt-2 text-xs font-normal leading-relaxed text-[#7b7b8e]">
                    {m.desc}
                  </p>
                </div>

                <div className="mt-4 sm:mt-6 pt-3 sm:pt-4 border-t border-[#dedee8] flex items-center gap-2 text-[11px] font-bold text-[#232331]">
                  <span className="flex h-4 w-4 items-center justify-center rounded-full bg-[#d9ff57] text-[#232331]">
                    <Check size={10} strokeWidth={3} />
                  </span>
                  <span>100% Bergaransi Resmi</span>
                </div>
              </div>
            </Reveal>
          ))}
        </div>

        {/* Hardware Acrylic Layer Architecture Banner with Real Card Mockup */}
        <Reveal delay={0.2} className="mt-8 sm:mt-12">
          <div className="relative rounded-2xl sm:rounded-3xl border-2 border-[#232331] bg-[#c5b3f5] p-4 sm:p-8 lg:p-12 text-[#232331] shadow-ink-lg overflow-hidden">
            
            <div className="relative z-10 grid gap-10 lg:grid-cols-12 items-center">
              
              {/* Left Column: Specs & Copy */}
              <div className="lg:col-span-6 space-y-4">
                <span className="eyebrow text-[#232331]">✦ ARSITEKTUR HARDWARE RESMI KAEL</span>
                <h3 className="text-2xl sm:text-4xl font-extrabold tracking-tight text-[#232331] leading-tight">
                  Akrilik Kristal 4 Lapis &amp; Chip NTAG213 Industri
                </h3>
                <p className="text-xs sm:text-sm font-normal leading-relaxed text-[#232331]/85">
                  Desain standar resmi KAEL yang kokoh, anti air, dan mewah. Skema pemakaian sangat fleksibel: bisa diletakkan di kasir, ditempel di meja tamu, atau dibawa staf menyapa pelanggan untuk mengundang ulasan organik &amp; poin member.
                </p>

                {/* 4 Hardware Architecture Specs */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-2">
                  <div className="flex items-center justify-between rounded-xl border-[1.5px] border-[#232331] bg-white p-2.5 shadow-ink-xs">
                    <div className="flex items-center gap-2">
                      <span className="flex h-5 w-5 items-center justify-center rounded-md bg-[#d9ff57] font-mono text-[9px] font-bold text-[#232331]">01</span>
                      <span className="text-[11px] font-bold text-[#232331]">Cast Acrylic 4mm</span>
                    </div>
                    <span className="text-[9px] font-mono font-bold text-[#7958d8]">Anti Air</span>
                  </div>

                  <div className="flex items-center justify-between rounded-xl border-[1.5px] border-[#232331] bg-white p-2.5 shadow-ink-xs">
                    <div className="flex items-center gap-2">
                      <span className="flex h-5 w-5 items-center justify-center rounded-md bg-[#d9ff57] font-mono text-[9px] font-bold text-[#232331]">02</span>
                      <span className="text-[11px] font-bold text-[#232331]">Standar Resmi KAEL</span>
                    </div>
                    <span className="text-[9px] font-mono font-bold text-[#7958d8]">Elegan</span>
                  </div>

                  <div className="flex items-center justify-between rounded-xl border-[1.5px] border-[#232331] bg-white p-2.5 shadow-ink-xs">
                    <div className="flex items-center gap-2">
                      <span className="flex h-5 w-5 items-center justify-center rounded-md bg-[#d9ff57] font-mono text-[9px] font-bold text-[#232331]">03</span>
                      <span className="text-[11px] font-bold text-[#232331]">Chip NTAG213 High-Freq</span>
                    </div>
                    <span className="text-[9px] font-mono font-bold text-[#7958d8]">0.8 Detik</span>
                  </div>

                  <div className="flex items-center justify-between rounded-xl border-[1.5px] border-[#232331] bg-white p-2.5 shadow-ink-xs">
                    <div className="flex items-center gap-2">
                      <span className="flex h-5 w-5 items-center justify-center rounded-md bg-[#d9ff57] font-mono text-[9px] font-bold text-[#232331]">04</span>
                      <span className="text-[11px] font-bold text-[#232331]">Desain Poster Promo</span>
                    </div>
                    <span className="text-[9px] font-mono font-bold text-[#16a34a]">Gratis</span>
                  </div>
                </div>

                <div className="pt-3">
                  <a
                    href={cta.consult.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn-tactile inline-flex items-center gap-2 rounded-xl bg-[#232331] px-5 py-3 text-xs font-bold text-white shadow-ink-sm hover:bg-[#1a1a24]"
                  >
                    <span>Pesan Kartu Resmi KAEL</span>
                    <ArrowRight size={13} strokeWidth={2.5} />
                  </a>
                </div>
              </div>

              {/* Right Column: High-End Realistic Physical Acrylic Smart Card Mockup */}
              <div className="lg:col-span-6 flex flex-col items-center justify-center">
                
                {/* Physical Acrylic Card Mockup Container */}
                <div className="w-full max-w-[380px] select-none">
                  
                  {/* Acrylic Card Layer with Glossy Bevel & Glass Glare */}
                  <div className="group relative rounded-2xl border-[2.5px] border-[#232331] bg-white p-5 text-[#232331] shadow-ink-lg transition-transform duration-300 hover:scale-[1.02]">
                    
                    {/* Gloss Glare Overlay */}
                    <div className="pointer-events-none absolute inset-0 rounded-2xl bg-gradient-to-tr from-transparent via-[#f0edff]/30 to-white/60" />
                    
                    {/* Top Card Header */}
                    <div className="relative z-10 flex items-center justify-between border-b border-[#dedee8] pb-3">
                      <div className="flex items-center gap-2.5">
                        <Image
                          src="/kael-logo-fix.png"
                          alt="KAEL Logo"
                          width={28}
                          height={28}
                          className="h-7 w-auto object-contain"
                        />
                        <div className="flex flex-col text-left leading-none">
                          <span className="font-extrabold text-sm tracking-tight text-[#232331]">KAEL</span>
                          <span className="font-sans text-[8px] font-bold text-[#7958d8] mt-0.5 tracking-tight">
                            Kemudahan Akses, Efisiensi, Layanan
                          </span>
                        </div>
                      </div>

                      {/* Contactless Wave Pill */}
                      <span className="flex items-center gap-1 rounded-full border-[1.5px] border-[#232331] bg-[#d9ff57] px-2 py-0.5 font-mono text-[9px] font-bold text-[#232331] shadow-ink-xs">
                        <Nfc size={11} strokeWidth={2.5} />
                        <span>NFC READY</span>
                      </span>
                    </div>

                    {/* Middle Card Body: Glowing Target Zone */}
                    <div className="relative z-10 my-4 flex items-center justify-between gap-4">
                      
                      {/* Left: NFC Tap Radar & Star Rating */}
                      <div className="flex-1 space-y-1.5">
                        <div className="inline-flex items-center gap-1 rounded-md bg-[#232331] px-2 py-0.5 font-mono text-[9px] font-bold text-[#d9ff57]">
                          <Star size={10} fill="#d9ff57" strokeWidth={0} />
                          <span>GOOGLE REVIEW 5★</span>
                        </div>
                        <p className="text-xs font-extrabold tracking-tight text-[#232331] leading-snug">
                          Tempelkan HP di Sini untuk Ulasan
                        </p>
                        <p className="text-[9px] text-[#7b7b8e]">
                          Buka Google Maps instan tanpa repot ketik
                        </p>
                      </div>

                      {/* Right: Backup Precision QR Code Box */}
                      <div className="flex h-16 w-16 shrink-0 flex-col items-center justify-center rounded-xl border-[1.5px] border-[#232331] bg-[#fcfcfe] p-1.5 shadow-ink-xs text-[#232331]">
                        <QrCode size={40} strokeWidth={2.2} />
                        <span className="mt-0.5 font-mono text-[7px] font-bold text-[#7958d8]">SCAN QR</span>
                      </div>

                    </div>

                    {/* Bottom Card Footer */}
                    <div className="relative z-10 flex items-center justify-between border-t border-[#dedee8] pt-2.5 font-mono text-[8.5px] text-[#7b7b8e]">
                      <div className="flex items-center gap-1.5">
                        <span className="h-1.5 w-1.5 rounded-full bg-[#d9ff57] border border-[#232331] animate-pulse" />
                        <span className="font-bold text-[#7958d8]">NTAG213 • 100% WATERPROOF</span>
                      </div>
                      <span className="rounded border border-[#dedee8] bg-[#f0edff] px-1.5 py-0.5 font-bold text-[#232331]">OFFICIAL CARD</span>
                    </div>

                  </div>

                  {/* Card Stand Base / Pedestal Shadow */}
                  <div className="mx-auto -mt-2 h-3.5 w-[75%] rounded-full bg-[#232331]/30 blur-sm" />
                  
                  {/* Explanatory Caption */}
                  <p className="mt-2 text-center font-mono text-[10px] font-bold text-[#232331]">
                    ✦ Tampilan Fisik Kartu Akrilik Standar Resmi KAEL
                  </p>

                </div>

              </div>

            </div>

          </div>
        </Reveal>

      </Container>
    </section>
  );
}
