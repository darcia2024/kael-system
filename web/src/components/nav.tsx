"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { ArrowRight, Coffee, Menu, Scale, Sparkles, X, Zap } from "lucide-react";
import { cta } from "@/lib/site";

export function Nav() {
  const [open, setOpen] = useState(false);

  return (
    <>
      {/* Top Banner (ChatJudge Saweria/Promo Banner Style) */}
      <div className="z-50 border-b-[1.5px] border-[#232331] bg-[#ffb36b] py-1.5 px-3 text-center overflow-hidden">
        <a
          href={cta.consult.href}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex flex-wrap items-center justify-center gap-1.5 sm:gap-2 text-[11px] sm:text-xs font-semibold text-[#211936] hover:opacity-90 transition-opacity"
        >
          <span className="flex items-center gap-1.5 font-medium">
            <Coffee size={13} strokeWidth={2.5} className="shrink-0" />
            <span className="truncate">Setup Kilat 24 Jam: Modul NFC, Kasir Bluetooth &amp; Bot WA</span>
          </span>
          <b className="inline-flex items-center gap-1 underline underline-offset-2 font-bold shrink-0">
            Konsultasi Gratis <ArrowRight size={11} strokeWidth={2.5} />
          </b>
        </a>
      </div>

      {/* Main Nav Bar */}
      <header className="sticky top-0 z-40 w-full border-b border-[#dedee8] bg-[#fcfcfe]/95 backdrop-blur-md">
        <div className="mx-auto flex h-14 sm:h-16 max-w-[1200px] items-center justify-between px-3.5 sm:px-8">
          
          {/* Brand Logo */}
          <a href="#top" className="flex items-center gap-2 sm:gap-2.5 font-bold tracking-tight text-[#232331] group min-w-0 pr-2">
            <Image
              src="/kael-logo-fix.png"
              alt="KAEL Logo"
              width={32}
              height={32}
              className="h-7 w-auto sm:h-8 object-contain transition-transform group-hover:scale-105 shrink-0"
              priority
            />
            <div className="flex flex-col text-left leading-none min-w-0">
              <span className="tracking-tight text-[#232331] font-extrabold text-base sm:text-xl">
                KAEL
              </span>
              <span className="font-sans text-[7.5px] sm:text-[9px] font-bold text-[#7958d8] tracking-tight mt-0.5 max-w-[165px] xs:max-w-none truncate">
                Kemudahan Akses, Efisiensi, Layanan
              </span>
            </div>
          </a>

          {/* Desktop Links */}
          <nav className="hidden md:flex items-center gap-5 text-xs font-semibold text-[#232331]">
            <Link href="/demo" className="text-[#7958d8] font-bold hover:opacity-80 transition-opacity bg-[#f0edff] px-2.5 py-1 rounded-lg border border-[#7958d8]/30">
              ✦ Live App Demo
            </Link>
            <a href="#alat-tempur" className="transition-colors hover:text-[#7958d8]">Alat Tempur</a>
            <a href="#our-product" className="transition-colors hover:text-[#7958d8]">Katalog Modul</a>
            <a href="#kalkulator" className="transition-colors hover:text-[#7958d8]">Hitung Cuan</a>
            <a href="#untuk-bisnis" className="transition-colors hover:text-[#7958d8]">Sektor Usaha</a>
            <a href="#paket" className="transition-colors hover:text-[#7958d8]">Paket Hemat</a>
            <a href="#faq" className="transition-colors hover:text-[#7958d8]">FAQ</a>
          </nav>

          {/* Right Action Buttons */}
          <div className="flex items-center gap-3">
            <a
              href={cta.consult.href}
              target="_blank"
              rel="noopener noreferrer"
              className="btn-tactile hidden sm:inline-flex items-center gap-2 rounded-[9px] bg-[#d9ff57] px-4 py-2 text-xs font-bold text-[#232331]"
            >
              <span>Konsultasi WA</span>
              <ArrowRight size={13} strokeWidth={2.5} />
            </a>

            <button
              type="button"
              onClick={() => setOpen((v) => !v)}
              aria-expanded={open}
              aria-label={open ? "Tutup menu" : "Buka menu"}
              className="inline-flex h-9 w-9 items-center justify-center rounded-lg border-[1.5px] border-[#232331] bg-[#d9ff57] text-[#232331] shadow-ink-xs md:hidden"
            >
              {open ? <X size={16} strokeWidth={2.5} /> : <Menu size={16} strokeWidth={2.5} />}
            </button>
          </div>

        </div>

        {/* Mobile Dropdown Panel */}
        {open && (
          <div className="border-b-2 border-[#232331] bg-[#fcfcfe] p-6 md:hidden animate-fadeIn">
            <ul className="space-y-3 font-semibold text-sm text-[#232331]">
              <li>
                <Link href="/demo" onClick={() => setOpen(false)} className="block py-1.5 px-3 rounded-xl bg-[#f0edff] text-[#7958d8] font-bold border border-[#7958d8]/30">
                  ✦ Buka Live App Demo (Hub)
                </Link>
              </li>
              <li>
                <a href="#alat-tempur" onClick={() => setOpen(false)} className="block py-1 hover:text-[#7958d8]">
                  Alat Tempur Toko
                </a>
              </li>
              <li>
                <a href="#our-product" onClick={() => setOpen(false)} className="block py-1 hover:text-[#7958d8]">
                  Katalog Modul Tempur
                </a>
              </li>
              <li>
                <a href="#kalkulator" onClick={() => setOpen(false)} className="block py-1 hover:text-[#7958d8]">
                  Hitung Potensi Cuan
                </a>
              </li>
              <li>
                <a href="#untuk-bisnis" onClick={() => setOpen(false)} className="block py-1 hover:text-[#7958d8]">
                  Cocok Buat Sektor Tokomu
                </a>
              </li>
              <li>
                <a href="#paket" onClick={() => setOpen(false)} className="block py-1 hover:text-[#7958d8]">
                  Pilihan Paket Hemat
                </a>
              </li>
              <li>
                <a href="#faq" onClick={() => setOpen(false)} className="block py-1 hover:text-[#7958d8]">
                  Tanya Jawab (FAQ)
                </a>
              </li>
            </ul>

            <div className="mt-5 pt-4 border-t border-[#dedee8]">
              <a
                href={cta.consult.href}
                target="_blank"
                rel="noopener noreferrer"
                className="btn-tactile flex w-full items-center justify-center gap-2 rounded-xl bg-[#d9ff57] py-3 text-xs font-bold text-[#232331]"
              >
                <span>Mulai Konsultasi Toko</span>
                <ArrowRight size={14} strokeWidth={2.5} />
              </a>
            </div>
          </div>
        )}
      </header>
    </>
  );
}
