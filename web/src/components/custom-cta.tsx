import { ArrowRight, ArrowUpRight } from "lucide-react";

import { Container } from "@/components/ui/section";
import { Reveal } from "@/components/ui/reveal";
import { cta } from "@/lib/site";

export function CustomCta() {
  return (
    <section className="py-16 sm:py-24">
      <Container>
        <Reveal>
          <div className="rounded-[32px] border border-[#d2dae2] bg-white p-8 text-center shadow-md sm:p-16">
            <div className="mx-auto max-w-[640px]">
              <span className="text-xs font-normal tracking-widest text-[#8d99ae] uppercase">
                Konsultasi & Pemesanan
              </span>
              <h2 className="mt-3 text-3xl font-normal tracking-[-0.04em] text-[#2b2d42] sm:text-5xl lg:leading-[1.15]">
                Mulai Transformasi <span className="font-serif italic font-light text-[#ef233c]">Digital</span> Bisnis Anda Hari Ini.
              </h2>
              <p className="mx-auto mt-4 max-w-[500px] text-sm font-light leading-relaxed text-[#8d99ae] sm:text-base">
                Diskusikan kendala operasional Anda langsung dengan tim KAEL.
                Kami bantu siapkan sistem yang tepat tanpa membebani biaya.
              </p>

              <div className="mt-8 flex justify-center">
                <a
                  href={cta.consult.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group inline-flex items-center gap-3 rounded-full bg-[#ef233c] px-8 py-4 text-xs font-normal tracking-wider text-white uppercase shadow-md shadow-[#ef233c]/20 transition-all hover:bg-[#d90429]"
                >
                  <span>{cta.consult.label}</span>
                  <span className="flex h-7 w-7 items-center justify-center rounded-full bg-white text-[#ef233c] transition-transform duration-200 group-hover:translate-x-0.5">
                    <ArrowRight size={13} strokeWidth={2} />
                  </span>
                </a>
              </div>
            </div>
          </div>
        </Reveal>
      </Container>
    </section>
  );
}
