"use client";

import { ArrowRight, CheckCircle2, MessageCircle, Rocket, Settings2 } from "lucide-react";

import { Container } from "@/components/ui/section";
import { Reveal } from "@/components/ui/reveal";
import { cta } from "@/lib/site";

const steps = [
  {
    step: "01",
    icon: MessageCircle,
    title: "1. Konsultasi Kebutuhan Usaha",
    body: "Diskusikan kendala operasional Anda langsung via WhatsApp dengan tim KAEL. Kami bantu rekomendasikan modul yang paling penting tanpa paksaan membeli modul tambahan.",
    badge: "10–15 Menit via WA",
  },
  {
    step: "02",
    icon: Settings2,
    title: "2. Konfigurasi & Kirim Kartu Siap Pakai",
    body: "Tim KAEL mengonfigurasi tautan Google Maps tokomu ke kartu akrilik NFC standar resmi KAEL, menyiapkan bonus file desain poster promosi, serta setup akun tokomu. Dikirim langsung ke tempat usahamu.",
    badge: "1–2 Hari Kerja",
  },
  {
    step: "03",
    icon: Rocket,
    title: "3. Langsung Pakai & Nikmati Hasilnya",
    body: "Letakkan kartu tap di meja kasir/meja tamu atau bawa nyamperin customer. Ulasan organik Google Maps bertambah alami, pembukuan rapi, dan omzet terpantau setiap saat.",
    badge: "Langsung Berjalan",
  },
];

export function HowItWorks() {
  return (
    <section id="cara-kerja" className="py-16 sm:py-24 bg-white border-t border-[#d2dae2]">
      <Container>
        {/* Header */}
        <div className="mx-auto max-w-[760px] text-center">
          <Reveal>
            <span className="text-xs font-normal tracking-widest text-[#8d99ae] uppercase">
              Proses Cepat & Praktis
            </span>
            <h2 className="mt-3 text-3xl font-medium tracking-[-0.03em] text-[#2b2d42] sm:text-5xl">
              3 Langkah Mudah Mulai Pakai KAEL
            </h2>
            <p className="mt-4 text-sm font-light leading-relaxed text-[#8d99ae] sm:text-base">
              Tanpa tim IT khusus, tanpa instalasi server yang membingungkan. Kami rancang
              setiap proses agar pemilik usaha dan staf toko bisa langsung menggunakan sistem.
            </p>
          </Reveal>
        </div>

        {/* 3 Step Cards Grid */}
        <div className="mt-12 grid gap-6 sm:grid-cols-3 lg:mt-16">
          {steps.map((item, i) => {
            const Icon = item.icon;
            return (
              <Reveal key={item.step} delay={i * 0.08}>
                <div className="relative flex h-full flex-col justify-between rounded-[28px] border border-[#d2dae2] bg-[#edf2f4]/50 p-7 sm:p-8 transition-all duration-200 hover:border-[#2b2d42]/30 hover:bg-[#edf2f4] hover:shadow-md">
                  <div>
                    {/* Step Number & Icon */}
                    <div className="flex items-center justify-between border-b border-[#d2dae2] pb-4">
                      <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white text-[#ef233c] shadow-2xs">
                        <Icon size={20} strokeWidth={2} />
                      </span>
                      <span className="rounded-full bg-white px-3 py-1 text-[11px] font-medium text-[#2b2d42] shadow-2xs">
                        {item.badge}
                      </span>
                    </div>

                    <h3 className="mt-6 text-base font-medium text-[#2b2d42] sm:text-lg">
                      {item.title}
                    </h3>
                    <p className="mt-2.5 text-xs font-light leading-relaxed text-[#8d99ae] sm:text-sm">
                      {item.body}
                    </p>
                  </div>

                  <div className="mt-6 pt-4 border-t border-[#d2dae2] flex items-center gap-2 text-xs font-medium text-[#17795d]">
                    <CheckCircle2 size={14} />
                    <span>Didampingi tim teknis KAEL</span>
                  </div>
                </div>
              </Reveal>
            );
          })}
        </div>

        {/* CTA Button */}
        <Reveal delay={0.3} className="mt-12 text-center">
          <a
            href={cta.consult.href}
            target="_blank"
            rel="noopener noreferrer"
            className="group inline-flex items-center gap-3 rounded-full bg-[#2b2d42] px-8 py-4 text-xs font-medium tracking-wider text-white uppercase shadow-sm transition-all hover:bg-[#ef233c]"
          >
            <span>Mulai Konsultasi Gratis Sekarang</span>
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-white text-[#2b2d42] transition-transform duration-200 group-hover:translate-x-0.5">
              <ArrowRight size={12} strokeWidth={2.5} />
            </span>
          </a>
        </Reveal>
      </Container>
    </section>
  );
}
