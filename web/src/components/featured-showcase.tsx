"use client";

import { ArrowRight, ArrowUpRight } from "lucide-react";

import { Container } from "@/components/ui/section";
import { Reveal } from "@/components/ui/reveal";
import { cta } from "@/lib/site";

const showcases = [
  {
    id: "case-1",
    pills: [
      { label: "Modul", val: "NFC Smart Card" },
      { label: "Sektor", val: "F&B / Coffee Shop" },
      { label: "Hasil", val: "+480 Review 5★" },
    ],
    title: "KOPI SENJA BANDUNG",
    desc: "Otomasi ulasan Google Maps di meja kasir menghasilkan 480+ ulasan bintang 5 dalam 30 hari pertama.",
    image: "https://images.unsplash.com/photo-1554118811-1e0d58224f24?w=1000&auto=format&fit=crop&q=80",
    isMono: true,
    href: cta.orderReview.href,
  },
  {
    id: "case-2",
    pills: [
      { label: "Modul", val: "POS & Booking" },
      { label: "Sektor", val: "Barbershop" },
    ],
    title: "CAPELLA BARBERSHOP",
    desc: "Sistem reservasi mandiri tanpa bentrok jadwal dan pencatatan komisi kapster secara otomatis.",
    image: "https://images.unsplash.com/photo-1503951914875-452162b0f3f1?w=1000&auto=format&fit=crop&q=80",
    isMono: false,
    href: cta.consult.href,
  },
  {
    id: "case-3",
    pills: [
      { label: "Modul", val: "HPP & Inventory" },
      { label: "Sektor", val: "Retail & Bakery" },
    ],
    title: "ARTISAN BAKERY HOUSE",
    desc: "Perhitungan harga pokok bahan baku presisi dan rekap laba kotor harian langsung tanpa spreadsheet.",
    image: "https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=1000&auto=format&fit=crop&q=80",
    isMono: false,
    href: cta.consult.href,
  },
];

export function FeaturedShowcase() {
  return (
    <section className="py-12 sm:py-16">
      <Container>
        <div className="grid gap-6 lg:grid-cols-3">
          {showcases.map((item, i) => (
            <Reveal key={item.id} delay={i * 0.08}>
              <div className="group relative flex h-[520px] flex-col justify-between overflow-hidden rounded-[28px] bg-[#2b2d42] p-6 text-white shadow-md sm:h-[560px] sm:p-7">
                {/* Photographic Background */}
                <img
                  src={item.image}
                  alt={item.title}
                  className={`absolute inset-0 h-full w-full object-cover transition-transform duration-700 ease-out group-hover:scale-105 ${
                    item.isMono ? "grayscale contrast-125" : ""
                  }`}
                />
                {/* Gradient Overlays */}
                <div className="absolute inset-0 bg-gradient-to-t from-[#2b2d42]/95 via-[#2b2d42]/30 to-[#2b2d42]/50" />

                {/* Top Metadata Pills & Top Right Circle Button */}
                <div className="relative z-10 flex items-start justify-between gap-2">
                  <div className="flex flex-wrap gap-1.5">
                    {item.pills.map((pill) => (
                      <span
                        key={pill.val}
                        className="rounded-full bg-white/20 px-3 py-1 text-[10px] font-normal tracking-wider text-white uppercase backdrop-blur-md"
                      >
                        <span className="opacity-70">{pill.label}:</span>{" "}
                        <span className="font-medium">{pill.val}</span>
                      </span>
                    ))}
                  </div>

                  <a
                    href={item.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={`Lihat detail ${item.title}`}
                    className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white text-[#2b2d42] shadow-sm transition-all duration-200 hover:bg-[#ef233c] hover:text-white group-hover:scale-110"
                  >
                    <ArrowUpRight size={15} strokeWidth={1.75} />
                  </a>
                </div>

                {/* Bottom Content & CTA Pill */}
                <div className="relative z-10">
                  <h3 className="text-xl font-normal tracking-tight text-white uppercase sm:text-2xl">
                    {item.title}
                  </h3>
                  <p className="mt-2 text-xs font-light leading-relaxed text-[#edf2f4]/85 line-clamp-2">
                    {item.desc}
                  </p>

                  <a
                    href={item.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-5 inline-flex w-full items-center justify-between rounded-full bg-white px-5 py-3 text-xs font-normal tracking-wider text-[#2b2d42] uppercase shadow-sm transition-all hover:bg-[#ef233c] hover:text-white"
                  >
                    <span>Pelajari Solusi Ini</span>
                    <ArrowRight size={14} strokeWidth={1.75} />
                  </a>
                </div>
              </div>
            </Reveal>
          ))}
        </div>
      </Container>
    </section>
  );
}
