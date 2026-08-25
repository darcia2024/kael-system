"use client";

import { useState } from "react";
import Link from "next/link";
import { 
  ArrowRight, 
  Calculator, 
  Check, 
  ExternalLink, 
  Flame, 
  HeartHandshake, 
  Nfc, 
  Palette, 
  Printer, 
  Sparkles, 
  Star, 
  Zap 
} from "lucide-react";
import { DemoNavbar } from "@/components/demo-navbar";
import { DEMO_BRANDS, DemoBrand } from "@/lib/demo-config";

export default function DemoHubPage() {
  const [currentBrand, setCurrentBrand] = useState<DemoBrand>(DEMO_BRANDS[0]);
  const [showWhiteLabelBadge, setShowWhiteLabelBadge] = useState<boolean>(true);

  const demoApps = [
    {
      id: "review",
      title: "1. KAEL Review",
      badge: "MODUL 01",
      slug: "/demo/review",
      desc: "Simulasi tap NFC & scan QR ulasan Google Maps dari sisi customer. Cepat, instan membuka rating bintang 5 tanpa ketik nama toko.",
      highlights: [
        "Simulasi Tap NFC smartphone customer",
        "Direct redirection ke Google Maps Review",
        "Rating selector & feedback preview",
        "Tampilan ber-logo & brand tokomu",
      ],
      icon: Nfc,
      color: "#7958d8",
      cta: "Buka Live App Review",
    },
    {
      id: "pos",
      title: "2. KAEL POS & Ordering",
      badge: "MODUL 02",
      slug: "/demo/pos",
      desc: "Aplikasi ganda: Menu Digital QR Self-Order Meja untuk tamu + Terminal Web POS Kasir dengan cetak struk thermal bluetooth.",
      highlights: [
        "Self-Order QR Meja Tamu (Pilih Menu & Cart)",
        "Bayar QRIS di Meja vs Bayar di Kasir",
        "Web POS Kasir multi-device (Tablet, HP, Laptop)",
        "Simulator Cetak Struk Thermal Kasir Realtime",
      ],
      icon: Printer,
      color: "#16a34a",
      cta: "Buka Live App Kasir & Menu",
    },
    {
      id: "finance",
      title: "3. KAEL Finance",
      badge: "MODUL 03",
      slug: "/demo/finance",
      desc: "Kalkulator HPP produksi resep sendiri vs kulakan supplier. Hitung gramasi bahan baku, biaya packaging, dan proyeksi profit bersih.",
      highlights: [
        "Dual Mode: Resep Olahan vs Kulakan Reseller",
        "Gramasi gram/kg/ml/liter/pcs bahan baku",
        "Kalkulasi ongkir per pcs & box packaging",
        "Alarm deteksi margin laba sehat vs boncos",
      ],
      icon: Calculator,
      color: "#c2410c",
      cta: "Buka Live App HPP Finance",
    },
    {
      id: "loyalty",
      title: "4. KAEL Loyalty",
      badge: "MODUL 04",
      slug: "/demo/loyalty",
      desc: "Sistem member tap NFC via nomor WhatsApp. Customer melihat paspor stempel poin di HP-nya, kasir mengkonfirmasi reward di terminal kasir.",
      highlights: [
        "Auto-register Member via Nomor WhatsApp",
        "Digital Stamp Passport (10 Stempel Gratis Kopi)",
        "Dashboard Approval Kasir (Tambah Poin / Redeem)",
        "Simulasi Notifikasi Saldo Masuk ke WhatsApp",
      ],
      icon: HeartHandshake,
      color: "#d97706",
      cta: "Buka Live App Loyalty",
    },
  ];

  return (
    <div className="min-h-screen bg-[#fcfcfe] text-[#232331] flex flex-col">
      <DemoNavbar
        currentBrand={currentBrand}
        onBrandChange={setCurrentBrand}
        showWhiteLabelBadge={showWhiteLabelBadge}
        onToggleWhiteLabelBadge={setShowWhiteLabelBadge}
      />

      <main className="flex-1 max-w-7xl mx-auto px-4 sm:px-6 py-8 sm:py-12 w-full">
        
        {/* Hub Header */}
        <div className="text-center max-w-3xl mx-auto">
          <div className="inline-flex items-center gap-1.5 rounded-full border border-[#232331] bg-[#d9ff57] px-3.5 py-1 font-mono text-[10px] sm:text-xs font-bold text-[#232331] uppercase shadow-ink-xs">
            <Sparkles size={13} />
            <span>LIVE INTERACTIVE SHOWCASE</span>
          </div>

          <h1 className="mt-4 text-2xl sm:text-5xl font-extrabold tracking-tight text-[#232331] leading-tight">
            Uji Coba Langsung <br />
            <i className="font-serif italic font-normal text-[#7958d8]">4 Aplikasi Inti KAEL</i>
          </h1>
          <p className="mt-3 text-xs sm:text-base text-[#7b7b8e] leading-relaxed">
            Setiap layanan di bawah ini adalah <strong>aplikasi web mandiri yang siap pakai</strong>. Coba buka masing-masing aplikasi dan lihat bagaimana sistem ini bekerja dalam skenario nyata bisnismu!
          </p>

          {/* Active Brand Card Pill */}
          <div className="mt-5 inline-flex items-center gap-2 rounded-2xl border-2 border-[#232331] bg-[#f0edff] px-4 py-2 text-xs font-mono">
            <span className="text-[#7958d8] font-bold">Brand Aktif:</span>
            <span className="font-extrabold text-[#232331]">{currentBrand.name}</span>
            <span className="text-[#7b7b8e]">({currentBrand.category})</span>
          </div>
        </div>

        {/* ========================================================= */}
        {/* SPECIAL HERO: UNIFIED ALL-IN-ONE MERCHANT DASHBOARD */}
        {/* ========================================================= */}
        <div className="mt-10 sm:mt-12 rounded-3xl border-2 border-[#232331] bg-[#232331] p-6 sm:p-8 text-white shadow-ink-xl flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2 max-w-2xl">
            <div className="inline-flex items-center gap-1.5 rounded-full bg-[#d9ff57] px-3 py-0.5 font-mono text-[10px] font-bold text-[#232331] uppercase">
              <span>🔥 ALL-IN-ONE COMMAND CENTER</span>
            </div>
            <h2 className="text-xl sm:text-3xl font-extrabold text-white">
              KAEL Unified Executive Dashboard
            </h2>
            <p className="text-xs sm:text-sm text-gray-300 leading-relaxed">
              Ingin melihat bagaimana ke-4 layanan KAEL (Review NFC, Web POS Kasir, Kalkulator HPP Finance, &amp; CRM Loyalty) digabung menjadi <strong>1 layar dashboard terintegrasi untuk Owner</strong>?
            </p>
          </div>

          <div className="shrink-0">
            <Link
              href="/dashboard"
              className="btn-tactile inline-flex items-center gap-2 rounded-2xl bg-[#d9ff57] px-6 py-3.5 text-xs sm:text-sm font-extrabold text-[#232331] shadow-ink-md hover:bg-[#c9f143]"
            >
              <span>Buka Dashboard Terpadu</span>
              <ArrowRight size={16} strokeWidth={2.5} />
            </Link>
          </div>
        </div>

        {/* 4 Apps Grid */}
        <div className="mt-8 sm:mt-10 grid gap-6 md:grid-cols-2">
          {demoApps.map((app) => {
            const Icon = app.icon;
            return (
              <div
                key={app.id}
                className="card-tactile flex flex-col justify-between rounded-3xl bg-white p-6 sm:p-8 border-2 border-[#232331] shadow-ink-md transition-all hover:-translate-y-1"
              >
                <div>
                  {/* Top Bar */}
                  <div className="flex items-center justify-between border-b border-[#dedee8] pb-4">
                    <span className="flex h-10 w-10 items-center justify-center rounded-2xl border-2 border-[#232331] bg-[#f0edff] text-[#7958d8] shadow-ink-xs">
                      <Icon size={20} strokeWidth={2.4} />
                    </span>
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-[10px] font-bold uppercase tracking-wider text-[#7958d8] bg-[#f0edff] px-2.5 py-1 rounded-lg border border-[#7958d8]/30">
                        {app.badge}
                      </span>
                      <span className="font-mono text-[9.5px] font-bold text-[#16a34a] bg-[#dcfce7] px-2 py-0.5 rounded border border-[#16a34a]">
                        Slug: {app.slug}
                      </span>
                    </div>
                  </div>

                  <h2 className="mt-4 text-xl sm:text-2xl font-extrabold text-[#232331]">
                    {app.title}
                  </h2>
                  <p className="mt-1.5 text-xs sm:text-sm text-[#7b7b8e] leading-relaxed">
                    {app.desc}
                  </p>

                  {/* Highlights */}
                  <ul className="mt-5 space-y-2 border-t border-[#dedee8] pt-4 text-xs font-normal text-[#232331]">
                    {app.highlights.map((h) => (
                      <li key={h} className="flex items-start gap-2">
                        <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-[#d9ff57] text-[#232331]">
                          <Check size={10} strokeWidth={3} />
                        </span>
                        <span>{h}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="mt-7 border-t border-[#dedee8] pt-4">
                  <Link
                    href={app.slug}
                    className="btn-tactile flex w-full items-center justify-center gap-2 rounded-xl bg-[#232331] py-3 text-xs sm:text-sm font-extrabold text-[#d9ff57] hover:bg-[#1a1a24] shadow-ink-xs"
                  >
                    <span>{app.cta}</span>
                    <ArrowRight size={14} strokeWidth={2.5} />
                  </Link>
                </div>
              </div>
            );
          })}
        </div>

      </main>

      {/* Footer */}
      {showWhiteLabelBadge && (
        <footer className="border-t border-[#dedee8] py-6 text-center text-xs text-[#7b7b8e] bg-white">
          <p>
            ⚡ Powered by <strong className="text-[#232331]">KAEL System</strong> · Ekosistem Solusi Digital UMKM Indonesia
          </p>
        </footer>
      )}
    </div>
  );
}
