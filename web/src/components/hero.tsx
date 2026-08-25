"use client";

import { useState } from "react";
import Image from "next/image";
import {
  ArrowRight,
  Calculator,
  Check,
  Coffee,
  CreditCard,
  Laptop,
  MessageCircle,
  Nfc,
  Printer,
  QrCode,
  Smartphone,
  Sparkles,
  Star,
  UsersRound,
  Zap,
} from "lucide-react";

import { Container } from "@/components/ui/section";
import { Reveal } from "@/components/ui/reveal";
import { cta } from "@/lib/site";

export function Hero() {
  const [tapSuccess, setTapSuccess] = useState(false);

  const handleTapSimulation = () => {
    setTapSuccess(true);
    setTimeout(() => setTapSuccess(false), 2400);
  };

  return (
    <section id="top" className="relative pt-4 pb-10 sm:pt-10 sm:pb-20 overflow-hidden">
      <Container>
        <div className="grid gap-8 lg:grid-cols-12 lg:gap-10 items-center">
          
          {/* Left Column: ChatJudge Headline & Copy */}
          <div className="lg:col-span-7">
            <Reveal>
              {/* ChatJudge Pill Badge */}
              <a
                href="#alat-tempur"
                className="group inline-flex items-center gap-2 rounded-full border-[1.5px] border-[#232331] bg-[#d9ff57] px-3 sm:px-3.5 py-1.5 text-[10px] sm:text-[11px] font-bold text-[#232331] shadow-ink-xs transition-transform hover:-translate-y-0.5 hover:shadow-ink-sm"
              >
                <span className="font-mono tracking-wider">✦ ALAT TEMPUR UMKM</span>
                <span className="text-[#232331]/80 font-normal truncate">· Bikin Toko Ramai · Anti Boncos</span>
                <ArrowRight size={12} strokeWidth={2.6} className="transition-transform group-hover:translate-x-0.5 shrink-0" />
              </a>

              {/* ChatJudge Bold Heading with Clean 3-Line Wrap */}
              <h1 className="mt-3.5 text-3xl xs:text-4xl sm:text-5xl lg:text-[3.6rem] xl:text-[4rem] font-extrabold tracking-[-0.04em] text-[#232331] leading-[1.08]">
                Bikin tokomu ramai<br />
                <i className="font-serif italic font-normal text-[#7958d8]">tanpa boncos?</i><br />
                KAEL solusinya.
              </h1>

              <p className="mt-3.5 max-w-[500px] text-xs sm:text-base font-normal leading-relaxed text-[#7b7b8e]">
                Bawa usahamu, pasang alat pintarnya di kasir atau bawa ke meja pelanggan, dan lihat ulasan organik Google Maps &amp; omzet tokomu melesat tanpa sewa server bulanan.
              </p>

              {/* Action Buttons */}
              <div className="mt-6 sm:mt-7 flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 sm:gap-3">
                <a
                  href={cta.consult.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn-tactile inline-flex items-center justify-center gap-2 rounded-xl bg-[#232331] px-5 sm:px-6 py-3 sm:py-3.5 text-xs sm:text-sm font-bold text-white shadow-ink-md hover:bg-[#1a1a24] text-center"
                >
                  <MessageCircle size={15} strokeWidth={2.4} className="text-[#d9ff57]" />
                  <span>Konsultasi Gratis Tokomu</span>
                </a>

                <a
                  href="#alat-tempur"
                  className="btn-tactile inline-flex items-center justify-center gap-2 rounded-xl bg-white px-4 sm:px-5 py-3 sm:py-3.5 text-xs sm:text-sm font-bold text-[#232331] shadow-ink-sm hover:bg-[#fcfcfe] text-center"
                >
                  <Sparkles size={15} strokeWidth={2.4} className="text-[#7958d8]" />
                  <span>Jelajahi Alat Tempur</span>
                </a>
              </div>

              {/* Trust Badge Strip */}
              <div className="mt-5 sm:mt-6 flex items-center gap-2 text-[11px] sm:text-xs font-semibold text-[#7b7b8e]">
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#f0edff] text-[#7958d8]">
                  <Zap size={12} strokeWidth={2.5} />
                </span>
                <span>1 Detik Tap NFC · Bebas Biaya Bulanan · Siap Pakai untuk UMKM Indonesia</span>
              </div>
            </Reveal>
          </div>

          {/* Right Column: High-End Interactive Hardware & Live Ecosystem Terminal Stage (Light Mode) */}
          <div className="lg:col-span-5 flex justify-center">
            <Reveal delay={0.1}>
              <div className="relative w-full max-w-[390px] sm:max-w-[420px] select-none">
                
                {/* Light Mode Tech Stage Container */}
                <div className="relative rounded-2xl sm:rounded-3xl border-2 border-[#232331] bg-[#f7f6fc] p-4 sm:p-6 text-[#232331] shadow-ink-lg overflow-hidden">
                  
                  {/* Subtle Grid Dot Matrix Pattern */}
                  <div
                    className="absolute inset-0 opacity-15"
                    style={{
                      backgroundImage: "radial-gradient(#7958d8 1.2px, transparent 1.2px)",
                      backgroundSize: "16px 16px",
                    }}
                  />
                  
                  {/* Soft Ambient Light Glow Orbs */}
                  <div className="pointer-events-none absolute -top-12 -right-12 h-36 w-36 rounded-full bg-[#7958d8] opacity-15 blur-2xl" />
                  <div className="pointer-events-none absolute -bottom-10 -left-10 h-36 w-36 rounded-full bg-[#d9ff57] opacity-25 blur-2xl" />

                  {/* Stage Header */}
                  <div className="relative z-10 flex items-center justify-between border-b border-[#dedee8] pb-3">
                    <div className="flex items-center gap-2">
                      <span className="flex h-2.5 w-2.5 rounded-full bg-[#d9ff57] border border-[#232331] animate-pulse" />
                      <span className="font-mono text-[10px] font-bold uppercase tracking-wider text-[#232331]">
                        KAEL ECOSYSTEM TERMINAL
                      </span>
                    </div>
                    <span className="font-mono text-[9px] font-bold text-[#7958d8] bg-white px-2.5 py-0.5 rounded-full border-[1.5px] border-[#232331] shadow-ink-xs">
                      LIVE SYSTEM
                    </span>
                  </div>

                  {/* Interactive Acrylic Smart Card Centerpiece (Clickable Light Mode Card) */}
                  <div className="relative z-10 my-4">
                    <div
                      onClick={handleTapSimulation}
                      className="group cursor-pointer rounded-2xl border-2 border-[#232331] bg-white p-4 text-[#232331] shadow-ink-md transition-all duration-300 hover:border-[#7958d8] hover:shadow-purple-lg active:scale-[0.98]"
                    >
                      {/* Card Gloss Glare */}
                      <div className="pointer-events-none absolute inset-0 rounded-2xl bg-gradient-to-tr from-transparent via-[#f0edff]/30 to-white/60" />

                      {/* Card Top: Brand Lockup & NFC Wave */}
                      <div className="flex items-center justify-between border-b border-[#dedee8] pb-2.5">
                        <div className="flex items-center gap-2">
                          <Image
                            src="/kael-logo-fix.png"
                            alt="KAEL Logo"
                            width={24}
                            height={24}
                            className="h-5 w-auto object-contain"
                          />
                          <div className="flex flex-col text-left leading-none">
                            <span className="font-extrabold text-xs tracking-tight text-[#232331]">KAEL</span>
                            <span className="font-sans text-[7px] font-bold text-[#7958d8] mt-0.5">
                              Kemudahan Akses, Efisiensi, Layanan
                            </span>
                          </div>
                        </div>

                        <span className="flex items-center gap-1 rounded-full border-[1.5px] border-[#232331] bg-[#d9ff57] px-2 py-0.5 font-mono text-[8px] font-bold text-[#232331] shadow-ink-xs">
                          <Nfc size={10} strokeWidth={2.6} />
                          <span>NFC TAP</span>
                        </span>
                      </div>

                      {/* Card Body: Interactive Tap Target */}
                      <div className="my-3 flex items-center justify-between gap-3">
                        <div className="flex-1 space-y-1">
                          <div className="inline-flex items-center gap-1 rounded-md bg-[#232331] px-1.5 py-0.5 font-mono text-[8.5px] font-bold text-[#d9ff57]">
                            <Star size={9} fill="#d9ff57" strokeWidth={0} />
                            <span>GOOGLE REVIEW 5★</span>
                          </div>
                          <p className="text-[11px] font-extrabold text-[#232331] tracking-tight leading-snug">
                            {tapSuccess ? "✨ HP TERDETEKSI (0.8s)!" : "Tempelkan HP di Sini"}
                          </p>
                          <p className="text-[8.5px] text-[#7b7b8e]">
                            Buka form ulasan instan tanpa ketik nama toko
                          </p>
                        </div>

                        {/* QR Code Target */}
                        <div className="flex h-14 w-14 shrink-0 flex-col items-center justify-center rounded-xl border-[1.5px] border-[#232331] bg-[#fcfcfe] p-1 text-[#232331] shadow-ink-xs">
                          <QrCode size={34} strokeWidth={2.4} />
                          <span className="font-mono text-[6.5px] font-bold text-[#7958d8]">SCAN QR</span>
                        </div>
                      </div>

                      {/* Card Bottom: Status */}
                      <div className="flex items-center justify-between border-t border-[#dedee8] pt-2 font-mono text-[8px]">
                        <span className="flex items-center gap-1 font-bold text-[#7958d8]">
                          <Zap size={10} strokeWidth={2.6} />
                          <span>CHIP NTAG213 INDUSTRIAL</span>
                        </span>
                        <span className="rounded border border-[#dedee8] bg-[#f0edff] px-1.5 py-0.5 font-bold text-[#232331]">
                          100% WATERPROOF
                        </span>
                      </div>

                    </div>

                    {/* Interactive Prompt Button */}
                    <div className="mt-2.5 text-center">
                      <button
                        type="button"
                        onClick={handleTapSimulation}
                        className="inline-flex items-center gap-1.5 rounded-full border-[1.5px] border-[#232331] bg-white px-3 py-1 font-mono text-[9.5px] font-bold text-[#7958d8] shadow-ink-xs transition-all hover:bg-[#d9ff57] hover:text-[#232331]"
                      >
                        <Zap size={11} strokeWidth={2.4} />
                        <span>{tapSuccess ? "⚡ 1 Detik Tap Berhasil!" : "Klik kartu di atas untuk coba simulasi Tap"}</span>
                      </button>
                    </div>
                  </div>

                  {/* 3 Live Floating Ecosystem Badges (Light Mode) */}
                  <div className="relative z-10 space-y-2 pt-1">
                    
                    {/* Floating Badge 1: Customer Phone Review Ingress */}
                    <div className="flex items-center justify-between rounded-xl border-[1.5px] border-[#232331] bg-white p-2.5 shadow-ink-xs transition-transform hover:translate-x-0.5">
                      <div className="flex items-center gap-2">
                        <span className="flex h-7 w-7 items-center justify-center rounded-lg border border-[#232331] bg-[#d9ff57] text-[#232331] font-bold shadow-ink-xs">
                          <Smartphone size={14} strokeWidth={2.4} />
                        </span>
                        <div>
                          <p className="text-[11px] font-bold text-[#232331]">HP Pelanggan</p>
                          <p className="text-[9px] text-[#7b7b8e]">Ulasan bintang 5 Google Maps terkirim</p>
                        </div>
                      </div>
                      <span className="font-mono text-[9px] font-bold text-[#232331] bg-[#d9ff57] px-2 py-0.5 rounded-md border border-[#232331] shadow-ink-xs">
                        +5★ Organik
                      </span>
                    </div>

                    {/* Floating Badge 2: Bluetooth POS Cashier Receipt */}
                    <div className="flex items-center justify-between rounded-xl border-[1.5px] border-[#232331] bg-white p-2.5 shadow-ink-xs transition-transform hover:translate-x-0.5">
                      <div className="flex items-center gap-2">
                        <span className="flex h-7 w-7 items-center justify-center rounded-lg border border-[#232331] bg-[#c5b3f5] text-[#232331] font-bold shadow-ink-xs">
                          <Printer size={14} strokeWidth={2.4} />
                        </span>
                        <div>
                          <p className="text-[11px] font-bold text-[#232331]">Kasir POS Web &amp; Bluetooth</p>
                          <p className="text-[9px] text-[#7b7b8e]">Meja 08 • Struk thermal cetak kilat</p>
                        </div>
                      </div>
                      <span className="font-mono text-[9px] font-bold text-[#7958d8] bg-[#f0edff] px-2 py-0.5 rounded-md border border-[#7958d8]/40">
                        QRIS Lunas ✓
                      </span>
                    </div>

                    {/* Floating Badge 3: WhatsApp Bot Owner Daily Report */}
                    <div className="flex items-center justify-between rounded-xl border-[1.5px] border-[#232331] bg-white p-2.5 shadow-ink-xs transition-transform hover:translate-x-0.5">
                      <div className="flex items-center gap-2">
                        <span className="flex h-7 w-7 items-center justify-center rounded-lg border border-[#232331] bg-[#dcfce7] text-[#16a34a] font-bold shadow-ink-xs">
                          <MessageCircle size={14} strokeWidth={2.4} />
                        </span>
                        <div>
                          <p className="text-[11px] font-bold text-[#232331]">Bot WhatsApp Owner</p>
                          <p className="text-[9px] text-[#7b7b8e]">Laporan omzet &amp; menu terlaris harian</p>
                        </div>
                      </div>
                      <span className="font-mono text-[9px] font-bold text-[#16a34a] bg-[#dcfce7] px-2 py-0.5 rounded-md border border-[#16a34a]/40">
                        Auto-Rekap ✓
                      </span>
                    </div>

                  </div>

                  {/* Stage Bottom Footnote */}
                  <div className="relative z-10 mt-3 pt-2.5 border-t border-[#dedee8] flex items-center justify-between text-[9.5px] font-mono text-[#7b7b8e]">
                    <span>100% BEBAS BIAYA BULANAN</span>
                    <span className="text-[#7958d8] font-bold">PLUG &amp; PLAY</span>
                  </div>

                </div>

              </div>
            </Reveal>
          </div>

        </div>
      </Container>
    </section>
  );
}
