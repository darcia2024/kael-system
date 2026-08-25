"use client";

import { useState } from "react";
import { ArrowRight, ChevronDown, Sparkles } from "lucide-react";
import { Container } from "@/components/ui/section";
import { Reveal } from "@/components/ui/reveal";
import { faqs } from "@/lib/faq-data";
import { cta } from "@/lib/site";

export { faqs };

export function Faq() {
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  const toggle = (index: number) => {
    setOpenIndex(openIndex === index ? null : index);
  };

  return (
    <section id="faq" className="py-12 sm:py-24 bg-[#fcfcfe] border-t border-[#dedee8]">
      <Container>
        <div className="grid gap-8 lg:grid-cols-12 lg:gap-16 items-start">
          
          {/* Left Column: Section Title & WA prompt */}
          <div className="lg:col-span-5">
            <Reveal>
              <div className="eyebrow inline-flex items-center gap-1.5">
                <span>✦</span>
                <span>PERTANYAAN UMUM</span>
              </div>
              <h2 className="mt-3 text-2xl sm:text-5xl font-extrabold tracking-tight text-[#232331] leading-tight">
                Tanya jawab <i className="font-serif italic font-normal text-[#7958d8]">seputar KAEL.</i>
              </h2>
              <p className="mt-2.5 text-xs sm:text-sm font-normal leading-relaxed text-[#7b7b8e]">
                Pertanyaan yang paling sering ditanyain para pemilik toko & UMKM sebelum mulai pasang perangkat KAEL.
              </p>
              
              <div className="mt-6 sm:mt-8">
                <a
                  href={cta.consult.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn-tactile inline-flex items-center gap-2 rounded-xl bg-[#d9ff57] px-4 py-3 text-xs font-bold text-[#232331]"
                >
                  <span>Tanya Lainnya di WhatsApp</span>
                  <ArrowRight size={13} strokeWidth={2.5} />
                </a>
              </div>
            </Reveal>
          </div>

          {/* Right Column: ChatJudge Tactile Accordion List */}
          <div className="lg:col-span-7 space-y-2.5 sm:space-y-3">
            {faqs.map((faq, i) => {
              const isOpen = openIndex === i;
              return (
                <Reveal key={faq.q} delay={i * 0.04}>
                  <div
                    className={`card-tactile rounded-xl transition-all ${
                      isOpen ? "bg-white shadow-ink-md" : "bg-white shadow-ink-xs"
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => toggle(i)}
                      aria-expanded={isOpen}
                      className="flex w-full items-center justify-between p-3.5 sm:p-5 text-left"
                    >
                      <span className="text-xs sm:text-sm font-bold text-[#232331] pr-3">
                        {faq.q}
                      </span>
                      <span
                        className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-md border-[1.5px] border-[#232331] font-mono text-xs font-bold transition-all ${
                          isOpen
                            ? "bg-[#d9ff57] text-[#232331]"
                            : "bg-[#f0edff] text-[#232331]"
                        }`}
                      >
                        {isOpen ? "−" : "+"}
                      </span>
                    </button>
                    {isOpen && (
                      <div className="border-t border-[#dedee8] px-3.5 sm:px-5 pb-4 sm:pb-5 pt-2.5 sm:pt-3 animate-fadeIn">
                        <p className="text-xs font-normal leading-relaxed text-[#7b7b8e]">
                          {faq.a}
                        </p>
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
