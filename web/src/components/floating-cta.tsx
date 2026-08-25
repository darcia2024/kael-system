"use client";

import { useEffect, useState } from "react";
import { ArrowRight, MessageCircle } from "lucide-react";
import { useMotionValueEvent, useScroll } from "motion/react";
import { cta } from "@/lib/site";

export function FloatingCta() {
  const [visible, setVisible] = useState(false);
  const { scrollY } = useScroll();

  useMotionValueEvent(scrollY, "change", (latest) => {
    setVisible(latest > 300);
  });

  if (!visible) return null;

  return (
    <aside
      aria-label="Aksi Cepat WhatsApp"
      className="fixed bottom-4 inset-x-4 z-40 sm:inset-x-auto sm:right-6 sm:bottom-6 animate-fadeIn"
    >
      <a
        href={cta.consult.href}
        target="_blank"
        rel="noopener noreferrer"
        className="btn-tactile flex items-center justify-between gap-3 rounded-2xl bg-[#d9ff57] px-4 py-3 text-[#232331] shadow-ink-md"
      >
        <div className="flex items-center gap-2.5">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg border border-[#232331] bg-[#232331] text-[#d9ff57]">
            <MessageCircle size={15} fill="currentColor" />
          </span>
          <div className="text-left leading-tight">
            <p className="text-xs font-bold text-[#232331]">Konsultasi Gratis</p>
            <p className="font-mono text-[9px] text-[#7958d8] font-bold">
              Online • Balas Kilat
            </p>
          </div>
        </div>
        <span className="flex h-6 w-6 items-center justify-center rounded-md border border-[#232331] bg-white text-[#232331]">
          <ArrowRight size={12} strokeWidth={2.5} />
        </span>
      </a>
    </aside>
  );
}
