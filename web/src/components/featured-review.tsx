import { ArrowUpRight, Check, MapPin, QrCode, Smartphone, Star } from "lucide-react";

import { Container, Section } from "@/components/ui/section";
import { Reveal } from "@/components/ui/reveal";
import { cta } from "@/lib/site";

const steps = [
  {
    step: "01",
    icon: Smartphone,
    title: "Tap Kartu NFC Kasir",
    desc: "Pelanggan cukup mendekatkan HP ke kartu pintar KAEL yang ditaruh di meja kasir.",
  },
  {
    step: "02",
    icon: QrCode,
    title: "Google Review Terbuka",
    desc: "Browser HP langsung membuka form rating bintang 5 Google Maps tanpa install aplikasi.",
  },
  {
    step: "03",
    icon: Star,
    title: "Rating Masuk Seketika",
    desc: "Reputasi bisnis meningkat, ranking pencarian Google Maps naik, pelanggan baru berdatangan.",
  },
];

export function FeaturedReview() {
  return (
    <Section className="border-b border-[#dce7e1] py-16 sm:py-24">
      <Container>
        <Reveal>
          <div className="rounded-[28px] border border-[#dce7e1] bg-white p-8 shadow-[0_24px_70px_#18352f12] sm:p-12 lg:p-14">
            <div className="flex flex-col justify-between gap-8 lg:flex-row lg:items-end">
              <div className="max-w-[640px]">
                <p className="text-xs uppercase tracking-widest text-[#6d7e79]">
                  Produk Unggulan: KAEL Review
                </p>
                <h2 className="mt-3 text-3xl font-light tracking-[-0.04em] text-[#18352f] sm:text-5xl lg:leading-[1.15]">
                  Tingkatkan Ulasan Bintang 5 Google Cukup Satu Tap.
                </h2>
                <p className="mt-4 text-sm font-normal leading-relaxed text-[#6d7e79] sm:text-base">
                  Banyak pelanggan puas namun enggan mencari link di Google. Kartu pintar
                  KAEL Review di meja kasir membuat pengumpulan ulasan bintang 5 terjadi secara natural dan instan.
                </p>
              </div>

              <div className="flex shrink-0 items-center gap-4">
                <a
                  href={cta.orderReview.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 rounded-[15px] bg-[#17795d] px-6 py-3.5 text-xs font-normal text-white shadow-[0_10px_22px_#17795d38] transition-all hover:bg-[#12654e]"
                >
                  <span>{cta.orderReview.label}</span>
                  <ArrowUpRight size={15} strokeWidth={1.5} />
                </a>
              </div>
            </div>

            {/* 3 Steps Outline Row */}
            <div className="mt-12 grid gap-6 border-t border-[#dce7e1] pt-10 sm:grid-cols-3">
              {steps.map((item, i) => {
                const Icon = item.icon;
                return (
                  <div
                    key={item.step}
                    className="flex flex-col justify-between rounded-[22px] border border-[#dce7e1] bg-[#fbfaf7] p-6 transition-all hover:border-[#b8dfcf] hover:bg-white hover:shadow-xs"
                  >
                    <div>
                      <div className="flex items-center justify-between">
                        <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#dff3e9] text-[#17795d]">
                          <Icon size={19} strokeWidth={1.5} />
                        </span>
                        <span className="font-mono text-xs font-light text-[#6d7e79]">
                          {item.step}
                        </span>
                      </div>
                      <h3 className="mt-5 text-base font-normal tracking-tight text-[#18352f]">
                        {item.title}
                      </h3>
                      <p className="mt-2 text-xs font-light leading-relaxed text-[#6d7e79]">
                        {item.desc}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </Reveal>
      </Container>
    </Section>
  );
}
