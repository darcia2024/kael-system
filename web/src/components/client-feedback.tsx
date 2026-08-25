"use client";

import { useState } from "react";
import { ArrowLeft, ArrowRight, Sparkles, Star } from "lucide-react";
import { Container } from "@/components/ui/section";
import { Reveal } from "@/components/ui/reveal";

const testimonials = [
  {
    id: 1,
    quote:
      "Kartu tap NFC-nya bener-bener ngaruh banget. Dari yang tadinya sebulan cuma dapet 1–2 review, sekarang tiap minggu puluhan pelanggan langsung kasih bintang 5 di Google Maps pas lagi bayar di meja kasir!",
    author: "Rian Prasetya",
    role: "Owner, Senja Coffee & Eatery",
    avatar: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=120&auto=format&fit=crop&q=80",
    stats: "+480 Review 5★",
  },
  {
    id: 2,
    quote:
      "Gak nyangka semudah ini makenya. Kasir toko saya yang biasanya gaptek aja langsung ngerti dalam 10 menit. Yang paling ngebantu itu kalkulator HPP-nya, jadi tahu persis untung bersih tiap menu makanan.",
    author: "Hendro Wijaya",
    role: "Founder, Capella Barbershop & Spa",
    avatar: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=120&auto=format&fit=crop&q=80",
    stats: "Kasir 3x Lebih Cepat",
  },
  {
    id: 3,
    quote:
      "Poin reward WhatsApp-nya bikin pelanggan rajin balik lagi tiap minggu. Dan yang paling saya suka, gak ada biaya bulanan yang aneh-aneh. Tim KAEL juga super ramah dan fast respon pas diajak ngobrol.",
    author: "Nathalie Kurniawan",
    role: "Managing Director, Artisan Bakery",
    avatar: "https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=120&auto=format&fit=crop&q=80",
    stats: "Member Repeat +45%",
  },
];

export function ClientFeedback() {
  const [current, setCurrent] = useState(0);

  const prev = () => {
    setCurrent((p) => (p === 0 ? testimonials.length - 1 : p - 1));
  };

  const next = () => {
    setCurrent((p) => (p === testimonials.length - 1 ? 0 : p + 1));
  };

  return (
    <section id="reviews" className="py-16 sm:py-24 bg-[#fcfcfe]">
      <Container>
        {/* Section Header */}
        <div className="text-center">
          <Reveal>
            <div className="eyebrow inline-flex items-center gap-1.5">
              <span>✦</span>
              <span>CERITA JUJUR MITRA</span>
            </div>
            <h2 className="mt-3 text-3xl sm:text-5xl font-extrabold tracking-tight text-[#232331] leading-tight">
              Kata mereka <i className="font-serif italic font-normal text-[#7958d8]">yang udah pakai.</i>
            </h2>
            <p className="mt-3 text-xs sm:text-sm font-normal leading-relaxed text-[#7b7b8e]">
              Cerita jujur dari para pemilik kedai, cafe, dan toko yang udah membuktikan sendiri dampaknya.
            </p>
          </Reveal>

          {/* Navigation Controls */}
          <Reveal delay={0.06} className="mt-6 flex items-center justify-center gap-3">
            <button
              type="button"
              onClick={prev}
              aria-label="Ulasan sebelumnya"
              className="btn-tactile flex h-9 w-9 items-center justify-center rounded-lg bg-white text-[#232331]"
            >
              <ArrowLeft size={14} strokeWidth={2.5} />
            </button>
            <button
              type="button"
              onClick={next}
              aria-label="Ulasan selanjutnya"
              className="btn-tactile flex h-9 w-9 items-center justify-center rounded-lg bg-[#d9ff57] text-[#232331]"
            >
              <ArrowRight size={14} strokeWidth={2.5} />
            </button>
          </Reveal>
        </div>

        {/* Testimonial Focus Card (ChatJudge Card Style) */}
        <Reveal delay={0.12} className="mt-10">
          <div className="relative mx-auto max-w-2xl">
            <div className="card-tactile relative rounded-2xl bg-white p-7 sm:p-10 shadow-ink-lg text-[#232331]">
              
              {/* Top Row: Stars + Stats Badge */}
              <div className="flex items-center justify-between border-b border-[#dedee8] pb-4">
                <div className="flex items-center gap-1 text-[#7958d8]">
                  {[...Array(5)].map((_, i) => (
                    <Star key={i} size={15} fill="currentColor" strokeWidth={0} />
                  ))}
                </div>
                <span className="rounded-lg border border-[#232331] bg-[#d9ff57] px-2.5 py-0.5 font-mono text-[10px] font-bold text-[#232331]">
                  {testimonials[current].stats}
                </span>
              </div>

              {/* Quote Body */}
              <p className="mt-6 text-sm sm:text-base font-normal leading-relaxed text-[#232331]">
                &ldquo;{testimonials[current].quote}&rdquo;
              </p>

              {/* Bottom Row: Author Bio */}
              <div className="mt-8 flex items-end justify-between border-t border-[#dedee8] pt-5">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 overflow-hidden rounded-full border-[1.5px] border-[#232331] shadow-ink-xs">
                    <img
                      src={testimonials[current].avatar}
                      alt={testimonials[current].author}
                      className="h-full w-full object-cover"
                    />
                  </div>
                  <div>
                    <h3 className="text-xs font-bold text-[#232331]">
                      {testimonials[current].author}
                    </h3>
                    <p className="text-[11px] font-normal text-[#7b7b8e]">
                      {testimonials[current].role}
                    </p>
                  </div>
                </div>

                <span className="font-mono text-xs font-bold text-[#7958d8]">
                  0{current + 1} / 0{testimonials.length}
                </span>
              </div>

            </div>
          </div>
        </Reveal>
      </Container>
    </section>
  );
}
