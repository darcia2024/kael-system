"use client";

import { Calculator, MessageCircle, Nfc, Printer, Sparkles, Zap } from "lucide-react";

export function MarqueeStrip() {
  return (
    <div className="w-full border-y border-[#dedee8] bg-[#fcfcfe] py-4">
      <div className="mx-auto flex max-w-[1200px] flex-col sm:flex-row items-center justify-between gap-4 px-5 sm:px-8">
        
        {/* Left Eyebrow Label */}
        <span className="eyebrow flex items-center gap-2 text-[#7b7b8e]">
          <span className="h-1.5 w-1.5 rounded-full bg-[#7958d8]" />
          <span>SATU EKOSISTEM DIGITAL UMKM INDONESIA</span>
        </span>

        {/* Right Proof Chips */}
        <div className="flex flex-wrap items-center justify-center gap-4 sm:gap-6 text-xs font-bold text-[#232331]">
          <span className="inline-flex items-center gap-2">
            <Nfc size={15} className="text-[#7958d8]" strokeWidth={2.4} />
            <span>1 Detik Tap NFC</span>
          </span>

          <span className="inline-flex items-center gap-2">
            <Printer size={15} className="text-[#7958d8]" strokeWidth={2.4} />
            <span>Kasir POS & Thermal Bluetooth</span>
          </span>

          <span className="inline-flex items-center gap-2">
            <Calculator size={15} className="text-[#7958d8]" strokeWidth={2.4} />
            <span>Kalkulator HPP Anti Boncos</span>
          </span>

          <span className="inline-flex items-center gap-2">
            <MessageCircle size={15} className="text-[#7958d8]" strokeWidth={2.4} />
            <span>Poin Loyalitas Bot WA</span>
          </span>
        </div>

      </div>
    </div>
  );
}
