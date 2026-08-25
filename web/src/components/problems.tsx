"use client";

import { Calculator, Check, Receipt, Sparkles, Star, Users2, X } from "lucide-react";
import { Container } from "@/components/ui/section";
import { Reveal } from "@/components/ui/reveal";

const comparisons = [
  {
    icon: Star,
    category: "Rating & Ulasan Google Maps",
    problem: "Tempat usaha keren & makanan enak, tapi ulasan Google sepi karena pelanggan males ngetik nama tokomu di Google Maps.",
    solution: "Cukup tap kartu pintar di meja kasir, form review bintang 5 langsung kebuka di HP pelanggan dalam 1 detik.",
    impact: "+480 Ulasan Bintang 5 Baru",
    accent: "bg-[#d9ff57]",
  },
  {
    icon: Calculator,
    category: "Modal Bahan Baku & Margin HPP",
    problem: "Harga jual cuma kira-kira ikut tetangga. Pas harga susu/bumbu naik, uang kas sering tekor misterius di akhir bulan.",
    solution: "Kalkulator HPP otomatis per porsi/resep. Tahu persis untung bersih riil dan menu mana yang paling banyak ngasih cuan.",
    impact: "100% Margin Laba Terkunci",
    accent: "bg-[#ffc2bf]",
  },
  {
    icon: Receipt,
    category: "Kasir POS & Struk Bluetooth",
    problem: "Nota kertas hilang, antrean kasir menumpuk di jam sibuk, dan pemilik repot ngitung rekap manual tiap malam.",
    solution: "Kasir POS kilat di HP/tablet, cetak struk bluetooth, terima QRIS, dan rekap omzet harian otomatis masuk ke WA owner.",
    impact: "Kasir 3x Lebih Cepat",
    accent: "bg-[#c5b3f5]",
  },
  {
    icon: Users2,
    category: "Pelanggan Beli Sekali Terus Lupa",
    problem: "Pelanggan datang sekali terus gak pernah balik lagi. Gak punya kontak pembeli buat ngabarin promo baru.",
    solution: "Poin reward otomatis terhubung ke nomor WhatsApp tanpa perlu download aplikasi. Bikin pelanggan kangen balik lagi.",
    impact: "+45% Kunjungan Ulang",
    accent: "bg-[#8bc9ff]",
  },
];

export function Problems() {
  return (
    <section className="py-12 sm:py-24 bg-[#fcfcfe] border-b border-[#dedee8]">
      <Container>
        
        {/* Section 1: Problem vs Solution Grid (ChatJudge Style) */}
        <div className="mx-auto max-w-2xl text-center">
          <Reveal>
            <div className="eyebrow inline-flex items-center gap-1.5">
              <span>✦</span>
              <span>MASALAH KLASIK VS SOLUSI KAEL</span>
            </div>
            <h2 className="mt-3 text-2xl sm:text-5xl font-extrabold tracking-tight text-[#232331] leading-tight">
              Pernah ngalamin <i className="font-serif italic font-normal text-[#7958d8]">hal ini di tokomu?</i>
            </h2>
            <p className="mt-2.5 text-xs sm:text-sm font-normal leading-relaxed text-[#7b7b8e]">
              Menjalankan usaha itu gak harus bikin kepala pusing. Liat gimana KAEL mengubah kendala harian jadi sistem otomatis yang rapi.
            </p>
          </Reveal>
        </div>

        {/* 4 Problem vs Solution Grid Cards */}
        <div className="mt-8 sm:mt-12 grid gap-4 sm:gap-6 sm:grid-cols-2">
          {comparisons.map((item, i) => {
            const Icon = item.icon;
            return (
              <Reveal key={item.category} delay={i * 0.06}>
                <div className="card-tactile flex h-full flex-col justify-between rounded-2xl bg-white p-4 sm:p-7 text-[#232331]">
                  <div>
                    {/* Category Top Bar */}
                    <div className="flex items-center justify-between border-b border-[#dedee8] pb-3.5">
                      <div className="flex items-center gap-2.5">
                        <span className={`flex h-8 w-8 items-center justify-center rounded-lg border-[1.5px] border-[#232331] ${item.accent} text-[#232331] shadow-ink-xs`}>
                          <Icon size={16} strokeWidth={2.4} />
                        </span>
                        <span className="text-xs font-bold text-[#232331]">
                          {item.category}
                        </span>
                      </div>
                      <span className="font-mono text-[9px] font-bold text-[#7958d8] uppercase">
                        Solusi 24 Jam
                      </span>
                    </div>

                    {/* Problem Box */}
                    <div className="mt-4 rounded-xl border-[1.5px] border-[#232331] bg-[#feebee] p-3.5 shadow-ink-xs">
                      <div className="flex items-start gap-2.5">
                        <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#ef4444] text-white">
                          <X size={12} strokeWidth={3} />
                        </span>
                        <div>
                          <p className="text-[10px] font-mono font-bold uppercase tracking-wider text-[#dc2626]">
                            Kendala Klasik
                          </p>
                          <p className="mt-0.5 text-xs font-normal text-[#232331] leading-relaxed">
                            {item.problem}
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Solution Box */}
                    <div className="mt-3 rounded-xl border-[1.5px] border-[#232331] bg-[#f7ffd8] p-3.5 shadow-ink-xs">
                      <div className="flex items-start gap-2.5">
                        <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#232331] text-[#d9ff57]">
                          <Check size={12} strokeWidth={3} />
                        </span>
                        <div>
                          <p className="text-[10px] font-mono font-bold uppercase tracking-wider text-[#232331]">
                            Solusi Otomatis KAEL
                          </p>
                          <p className="mt-0.5 text-xs font-normal text-[#232331] leading-relaxed">
                            {item.solution}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Impact Footnote */}
                  <div className="mt-5 flex items-center justify-between border-t border-[#dedee8] pt-3.5 text-xs font-bold text-[#232331]">
                    <span className="flex items-center gap-1.5 text-[#7958d8]">
                      <Sparkles size={13} />
                      <span>Hasil Nyata:</span>
                    </span>
                    <span className="font-mono text-xs font-extrabold text-[#232331] bg-[#d9ff57] px-2 py-0.5 rounded border border-[#232331]">
                      {item.impact}
                    </span>
                  </div>
                </div>
              </Reveal>
            );
          })}
        </div>

      </Container>
    </section>
  );
}
