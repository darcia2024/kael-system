"use client";

import { useRef, useState } from "react";
import { ArrowUpRight, ChevronLeft, ChevronRight } from "lucide-react";

import { Container } from "@/components/ui/section";
import { Reveal } from "@/components/ui/reveal";
import { cta } from "@/lib/site";

const projects = [
  {
    id: "kael-review",
    title: "KAEL Review",
    subtitle: "NFC Tap & Google Review",
    desc: "Kartu pintar NFC untuk undang ulasan organik Google Maps secara instan tanpa install aplikasi.",
    image: "https://images.unsplash.com/photo-1554118811-1e0d58224f24?w=800&auto=format&fit=crop&q=80",
    dots: ["NFC", "QR", "Auto"],
    href: cta.orderReview.href,
  },
  {
    id: "kael-pos",
    title: "KAEL POS",
    subtitle: "Kasir & Rekap Transaksi",
    desc: "Pencatatan penjualan kasir realtime, cetak struk bluetooth, dan manajemen shift yang rapi.",
    image: "https://images.unsplash.com/photo-1513694203232-719a280e022f?w=800&auto=format&fit=crop&q=80",
    dots: ["Kasir", "Struk", "Laporan"],
    href: cta.consult.href,
  },
  {
    id: "kael-finance",
    title: "KAEL Finance",
    subtitle: "HPP & Profit Margin",
    desc: "Hitung harga pokok produksi per porsi/item presisi agar keuntungan bisnis tidak bocor.",
    image: "https://images.unsplash.com/photo-1497366216548-37526070297c?w=800&auto=format&fit=crop&q=80",
    dots: ["HPP", "Margin", "Laba"],
    href: cta.consult.href,
  },
  {
    id: "kael-loyalty",
    title: "KAEL Loyalty",
    subtitle: "Poin & Member Rewards",
    desc: "Program loyalitas pelanggan otomatis berbasis nomor WhatsApp untuk tingkatkan repeat order.",
    image: "https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=800&auto=format&fit=crop&q=80",
    dots: ["Poin", "Member", "Promo"],
    href: cta.consult.href,
  },
];

export function ProductSlider() {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [scrollProgress, setScrollProgress] = useState(0);

  const handleScroll = () => {
    if (!scrollRef.current) return;
    const { scrollLeft, scrollWidth, clientWidth } = scrollRef.current;
    const maxScroll = scrollWidth - clientWidth;
    setScrollProgress(maxScroll > 0 ? (scrollLeft / maxScroll) * 100 : 0);
  };

  const scroll = (direction: "left" | "right") => {
    if (!scrollRef.current) return;
    const offset = direction === "left" ? -380 : 380;
    scrollRef.current.scrollBy({ left: offset, behavior: "smooth" });
  };

  return (
    <section className="py-6 sm:py-10">
      <Container>
        <Reveal>
          {/* Large Rounded Container Shell */}
          <div className="relative rounded-[32px] border border-[#d2dae2] bg-white p-4 shadow-sm sm:p-6 lg:p-8">
            {/* Horizontal Scroll Track */}
            <div
              ref={scrollRef}
              onScroll={handleScroll}
              className="no-scrollbar flex gap-4 overflow-x-auto scroll-smooth pb-4 sm:gap-5"
            >
              {projects.map((item) => (
                <div
                  key={item.id}
                  className="group relative h-[440px] w-[280px] shrink-0 overflow-hidden rounded-[26px] bg-[#2b2d42] sm:h-[480px] sm:w-[320px] lg:h-[500px] lg:w-[340px]"
                >
                  {/* Photographic Background */}
                  <img
                    src={item.image}
                    alt={item.title}
                    className="absolute inset-0 h-full w-full object-cover transition-transform duration-700 ease-out group-hover:scale-105"
                  />
                  {/* Subtle Gradient Overlays */}
                  <div className="absolute inset-0 bg-gradient-to-t from-[#2b2d42]/90 via-[#2b2d42]/30 to-[#2b2d42]/50" />

                  {/* Top Bar: Learn Details Pill + Circular Arrow Button */}
                  <div className="absolute inset-x-4 top-4 flex items-center justify-between">
                    <a
                      href={item.href}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="rounded-full bg-white/95 px-3.5 py-1.5 text-[10px] font-medium tracking-wider text-[#2b2d42] uppercase backdrop-blur-md transition-all hover:bg-[#ef233c] hover:text-white"
                    >
                      Pelajari Detail
                    </a>

                    <a
                      href={item.href}
                      target="_blank"
                      rel="noopener noreferrer"
                      aria-label={`Buka detail ${item.title}`}
                      className="flex h-8 w-8 items-center justify-center rounded-full bg-white text-[#2b2d42] shadow-sm transition-all duration-200 hover:bg-[#ef233c] hover:text-white group-hover:scale-105"
                    >
                      <ArrowUpRight size={15} strokeWidth={1.75} />
                    </a>
                  </div>

                  {/* Right Vertical Action Dots */}
                  <div className="absolute right-4 bottom-24 flex flex-col items-center gap-1.5 rounded-full bg-[#2b2d42]/60 p-1.5 backdrop-blur-md">
                    {item.dots.map((dot, idx) => (
                      <span
                        key={idx}
                        className="h-1.5 w-1.5 rounded-full bg-white/70"
                        title={dot}
                      />
                    ))}
                  </div>

                  {/* Bottom Floating White Capsule (Matching Reference) */}
                  <div className="absolute inset-x-4 bottom-4">
                    <div className="rounded-[20px] bg-white/95 p-4 shadow-md backdrop-blur-md">
                      <h3 className="text-base font-semibold tracking-tight text-[#2b2d42]">
                        {item.title}
                      </h3>
                      <p className="mt-0.5 text-xs font-normal text-[#8d99ae]">
                        {item.subtitle}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Floating Drag Controller Button on Right Edge */}
            <div className="absolute top-1/2 right-8 -translate-y-1/2 hidden lg:flex items-center gap-1.5 rounded-full bg-white/95 px-4 py-2 text-xs font-medium text-[#2b2d42] shadow-xl border border-[#d2dae2] backdrop-blur-md pointer-events-none">
              <span>‹</span>
              <span className="tracking-wider uppercase text-[10px]">Drag</span>
              <span>›</span>
            </div>

            {/* Bottom Progress Scrollbar (Matching Reference) */}
            <div className="mt-6 flex items-center justify-between border-t border-[#edf2f4] pt-4">
              <div className="h-1.5 w-36 overflow-hidden rounded-full bg-[#edf2f4]">
                <div
                  className="h-full rounded-full bg-[#ef233c] transition-all duration-150"
                  style={{
                    width: `${Math.max(20, Math.min(100, scrollProgress + 25))}%`,
                  }}
                />
              </div>

              {/* Arrow Nav Buttons */}
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => scroll("left")}
                  aria-label="Geser ke kiri"
                  className="flex h-8 w-8 items-center justify-center rounded-full border border-[#d2dae2] bg-[#edf2f4] text-[#2b2d42] transition-colors hover:bg-[#2b2d42] hover:text-white"
                >
                  <ChevronLeft size={15} />
                </button>
                <button
                  type="button"
                  onClick={() => scroll("right")}
                  aria-label="Geser ke kanan"
                  className="flex h-8 w-8 items-center justify-center rounded-full border border-[#d2dae2] bg-[#edf2f4] text-[#2b2d42] transition-colors hover:bg-[#2b2d42] hover:text-white"
                >
                  <ChevronRight size={15} />
                </button>
              </div>
            </div>
          </div>
        </Reveal>
      </Container>
    </section>
  );
}
