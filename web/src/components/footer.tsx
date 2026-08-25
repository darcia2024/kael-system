import Image from "next/image";
import { ArrowRight, Coffee, Heart, MessageCircle, Scale, Sparkles, Zap } from "lucide-react";
import { Container } from "@/components/ui/section";
import { cta } from "@/lib/site";

export function Footer() {
  return (
    <footer className="border-t-[1.5px] border-[#232331] bg-[#fcfcfe] pt-16 pb-12 text-[#232331]">
      <Container>
        
        {/* ChatJudge Bottom Banner Callout */}
        <div className="rounded-2xl border-2 border-[#232331] bg-[#d9ff57] p-8 sm:p-12 text-[#232331] shadow-ink-lg mb-16">
          <div className="flex flex-col md:flex-row items-center justify-between gap-6">
            <div>
              <div className="eyebrow text-[#232331] mb-2">
                <span>✦</span>
                <span>KONSULTASI GRATIS 100%</span>
              </div>
              <h3 className="text-2xl sm:text-4xl font-extrabold tracking-tight text-[#232331]">
                Siap bikin tokomu ramai & bebas boncos?
              </h3>
              <p className="mt-2 text-xs sm:text-sm font-normal text-[#232331]/80 max-w-lg">
                Diskusikan langsung alur tokomu bersama tim KAEL. Tanpa biaya langganan bulanan, setup kilat 24 jam.
              </p>
            </div>

            <a
              href={cta.consult.href}
              target="_blank"
              rel="noopener noreferrer"
              className="btn-tactile inline-flex items-center gap-2.5 rounded-xl bg-[#232331] px-6 py-3.5 text-xs sm:text-sm font-bold text-white shadow-ink-md hover:bg-[#1a1a24] shrink-0"
            >
              <MessageCircle size={16} strokeWidth={2.4} className="text-[#d9ff57]" />
              <span>Mulai Chat WhatsApp</span>
              <ArrowRight size={14} strokeWidth={2.5} />
            </a>
          </div>
        </div>

        <div className="grid gap-12 sm:grid-cols-2 lg:grid-cols-12 lg:gap-16">
          {/* Brand Column */}
          <div className="lg:col-span-5">
            <a href="#top" className="flex items-center gap-2.5 font-bold tracking-tight text-[#232331] group">
              <Image
                src="/kael-logo-fix.png"
                alt="KAEL Logo"
                width={32}
                height={32}
                className="h-8 w-auto object-contain transition-transform group-hover:scale-105"
              />
              <div className="flex flex-col text-left leading-none">
                <span className="font-extrabold text-xl tracking-tight text-[#232331]">
                  KAEL
                </span>
                <span className="font-sans text-[8.5px] sm:text-[9.5px] font-bold text-[#7958d8] tracking-tight mt-0.5 whitespace-nowrap">
                  Kemudahan Akses, Efisiensi, Layanan
                </span>
              </div>
            </a>
            <p className="mt-4 max-w-[360px] text-xs font-normal leading-relaxed text-[#7b7b8e]">
              Satu ekosistem digital praktis buat kedai kopi, resto, barbershop, dan tokomu.
              Undang ulasan jujur &amp; organik Google Maps, kasir POS web-based, kalkulator HPP resep &amp; kulakan, serta loyalitas member WhatsApp.
            </p>
          </div>

          {/* Link Columns */}
          <div className="lg:col-span-7 grid grid-cols-2 sm:grid-cols-3 gap-8">
            <div>
              <p className="eyebrow text-[#7b7b8e]">
                Alat Tempur
              </p>
              <ul className="mt-3.5 space-y-2 text-xs font-bold text-[#232331]">
                <li><a href="#alat-tempur" className="hover:text-[#7958d8] transition-colors">Kartu Review NFC</a></li>
                <li><a href="#alat-tempur" className="hover:text-[#7958d8] transition-colors">Kasir POS Kilat</a></li>
                <li><a href="#alat-tempur" className="hover:text-[#7958d8] transition-colors">Kalkulator HPP</a></li>
                <li><a href="#alat-tempur" className="hover:text-[#7958d8] transition-colors">Poin Reward WA</a></li>
              </ul>
            </div>

            <div>
              <p className="eyebrow text-[#7b7b8e]">
                Jelajahi
              </p>
              <ul className="mt-3.5 space-y-2 text-xs font-bold text-[#232331]">
                <li><a href="#alat-tempur" className="hover:text-[#7958d8] transition-colors">Cara Kerja</a></li>
                <li><a href="#our-product" className="hover:text-[#7958d8] transition-colors">Katalog Modul</a></li>
                <li><a href="#kalkulator" className="hover:text-[#7958d8] transition-colors">Hitung Cuan Toko</a></li>
                <li><a href="#untuk-bisnis" className="hover:text-[#7958d8] transition-colors">Sektor Usaha</a></li>
                <li><a href="#paket" className="hover:text-[#7958d8] transition-colors">Paket Hemat</a></li>
                <li><a href="#faq" className="hover:text-[#7958d8] transition-colors">Tanya Jawab (FAQ)</a></li>
              </ul>
            </div>

            <div>
              <p className="eyebrow text-[#7b7b8e]">
                Konsultasi
              </p>
              <ul className="mt-3.5 space-y-2 text-xs font-bold text-[#232331]">
                <li>
                  <a href={cta.consult.href} target="_blank" rel="noopener noreferrer" className="text-[#7958d8] underline underline-offset-2 hover:text-[#232331] transition-colors">
                    WhatsApp Langsung →
                  </a>
                </li>
                <li><span className="text-xs font-normal text-[#7b7b8e]">Senin – Minggu</span></li>
                <li><span className="text-xs font-normal text-[#7b7b8e]">08:00 – 22:00 WIB</span></li>
              </ul>
            </div>
          </div>
        </div>

        {/* Bottom Copyright */}
        <div className="mt-14 pt-6 border-t border-[#dedee8] flex flex-col sm:flex-row items-center justify-between gap-4 text-xs font-normal text-[#7b7b8e]">
          <p>© {new Date().getFullYear()} KAEL System. All rights reserved.</p>
          <p className="font-mono text-[11px] text-[#7b7b8e]">
            Dibuat untuk kemajuan pengusaha lokal & UMKM Indonesia 🇮🇩
          </p>
        </div>

      </Container>
    </footer>
  );
}
