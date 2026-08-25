"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { 
  ArrowLeft, 
  Calculator, 
  Check, 
  Crown, 
  ExternalLink, 
  HeartHandshake, 
  LayoutDashboard,
  LayoutGrid, 
  Nfc, 
  Palette, 
  Printer, 
  Settings2, 
  Sparkles,
  SplitSquareVertical 
} from "lucide-react";
import { DEMO_BRANDS, DemoBrand } from "@/lib/demo-config";

interface DemoNavbarProps {
  currentBrand: DemoBrand;
  onBrandChange: (brand: DemoBrand) => void;
  showWhiteLabelBadge: boolean;
  onToggleWhiteLabelBadge: (show: boolean) => void;
}

export function DemoNavbar({
  currentBrand,
  onBrandChange,
  showWhiteLabelBadge,
  onToggleWhiteLabelBadge,
}: DemoNavbarProps) {
  const pathname = usePathname();
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [customName, setCustomName] = useState(currentBrand.name);

  // Clean, high-end, uncluttered labels (No emojis or number prefixes in pills)
  const navItems = [
    { label: "Hub", href: "/demo", icon: LayoutGrid },
    { label: "Dual View", href: "/demo/experience", icon: SplitSquareVertical },
    { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
    { label: "Review", href: "/demo/review", icon: Nfc },
    { label: "POS Kasir", href: "/demo/pos", icon: Printer },
    { label: "Finance HPP", href: "/demo/finance", icon: Calculator },
    { label: "Loyalty CRM", href: "/demo/loyalty", icon: HeartHandshake },
  ];

  const handleApplyCustom = (e: React.FormEvent) => {
    e.preventDefault();
    if (!customName.trim()) return;
    onBrandChange({
      ...currentBrand,
      id: "custom",
      name: customName,
      logoText: customName.slice(0, 8).toUpperCase(),
    });
    setIsSettingsOpen(false);
  };

  return (
    <>
      <header className="sticky top-0 z-50 w-full border-b border-[#dedee8] bg-white/95 backdrop-blur-md">
        <div className="mx-auto flex max-w-[1500px] items-center justify-between px-3.5 sm:px-6 py-2 sm:py-2.5 gap-2 sm:gap-4">
          
          {/* Left: Back to Home & Store Identity */}
          <div className="flex items-center gap-2 sm:gap-3 min-w-0">
            <Link
              href="/"
              className="flex h-8 w-8 sm:h-9 sm:w-9 shrink-0 items-center justify-center rounded-xl border border-[#dedee8] bg-[#fcfcfe] text-[#232331] hover:bg-[#f0edff] hover:border-[#7958d8] transition-all shadow-sm"
              title="Kembali ke Landing Page KAEL"
            >
              <ArrowLeft size={14} strokeWidth={2.4} />
            </Link>

            <div className="flex items-center gap-2 min-w-0">
              <span 
                className="flex h-8 w-8 sm:h-9 sm:w-9 shrink-0 items-center justify-center rounded-xl text-white font-extrabold text-xs shadow-sm border border-black/10"
                style={{ backgroundColor: currentBrand.themeColor }}
              >
                {currentBrand.logoText.slice(0, 2)}
              </span>
              <div className="min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="font-extrabold text-xs sm:text-sm text-[#232331] truncate leading-tight">
                    {currentBrand.name}
                  </span>
                  <span className="hidden sm:inline-flex items-center gap-1 rounded-full bg-[#dcfce7] px-1.5 py-0.2 font-mono text-[8.5px] font-bold text-[#16a34a] border border-[#16a34a]/30 shrink-0">
                    <span className="h-1.5 w-1.5 rounded-full bg-[#16a34a] animate-pulse" />
                    Live
                  </span>
                </div>
                <span className="text-[10px] text-[#7b7b8e] block truncate font-medium">
                  {currentBrand.category}
                </span>
              </div>
            </div>
          </div>

          {/* Center: Sleek Apple/Linear-style Segmented Navigation Control */}
          <nav className="hidden lg:flex items-center gap-0.5 bg-[#f4f4f7] p-1 rounded-2xl border border-[#e5e5eb] shadow-[inset_0_1px_2px_rgba(0,0,0,0.03)]">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = pathname === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[11.5px] font-semibold whitespace-nowrap transition-all ${
                    isActive
                      ? "bg-white text-[#232331] font-extrabold shadow-[0_2px_8px_rgba(0,0,0,0.06)] border border-[#dedee8]"
                      : "text-[#6b6b80] hover:text-[#232331] hover:bg-white/60"
                  }`}
                >
                  <Icon size={13} strokeWidth={isActive ? 2.4 : 1.8} className={isActive ? "text-[#7958d8]" : "text-[#7b7b8e]"} />
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </nav>

          {/* Right: Refined White-Label Brand Customizer Trigger */}
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => setIsSettingsOpen(true)}
              className="flex items-center gap-1.5 rounded-xl border border-[#232331] bg-white hover:bg-[#f7f6fc] px-3 py-1.5 text-xs font-bold text-[#232331] transition-all shadow-ink-xs active:scale-95"
            >
              <Palette size={13} strokeWidth={2.4} className="text-[#7958d8]" />
              <span className="hidden sm:inline">Ubah Brand</span>
              <span className="sm:hidden">Brand</span>
            </button>
          </div>

        </div>

        {/* Mobile / Tablet Horizontal Navigation Strip */}
        <div className="lg:hidden flex items-center overflow-x-auto scrollbar-none border-t border-[#dedee8] px-2.5 py-1.5 gap-1.5 bg-[#fafafc]">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all shrink-0 ${
                  isActive
                    ? "bg-white text-[#232331] shadow-sm border border-[#dedee8]"
                    : "text-[#7b7b8e] hover:text-[#232331] bg-transparent"
                }`}
              >
                <Icon size={12} strokeWidth={isActive ? 2.4 : 1.8} className={isActive ? "text-[#7958d8]" : "text-[#7b7b8e]"} />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </div>
      </header>

      {/* ========================================================= */}
      {/* WHITE-LABEL CUSTOMIZER DRAWER / MODAL */}
      {/* ========================================================= */}
      {isSettingsOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fadeIn">
          <div className="w-full max-w-lg rounded-3xl border-2 border-[#232331] bg-white p-5 sm:p-7 text-[#232331] shadow-ink-xl max-h-[90vh] overflow-y-auto">
            
            {/* Header */}
            <div className="flex items-center justify-between border-b border-[#dedee8] pb-3">
              <div className="flex items-center gap-2">
                <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#7958d8] text-white">
                  <Palette size={15} />
                </span>
                <h3 className="text-base sm:text-lg font-extrabold text-[#232331]">
                  Simulator Brand &amp; White-Label
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsSettingsOpen(false)}
                className="flex h-7 w-7 items-center justify-center rounded-lg border border-[#dedee8] text-[#7b7b8e] hover:bg-gray-100 font-bold text-xs"
              >
                ✕
              </button>
            </div>

            <p className="mt-3 text-xs text-[#7b7b8e] leading-relaxed">
              Coba ganti brand di bawah ini untuk melihat bagaimana aplikasi KAEL otomatis menyesuaikan logo, nama toko, dan warna tema toko klien secara instan!
            </p>

            {/* Presets Grid */}
            <div className="mt-4 space-y-2">
              <label className="text-[11px] font-mono font-bold text-[#7958d8] uppercase block">
                Pilih Contoh Bisnis:
              </label>
              <div className="grid gap-2 sm:grid-cols-3">
                {DEMO_BRANDS.map((brand) => (
                  <button
                    key={brand.id}
                    type="button"
                    onClick={() => {
                      onBrandChange(brand);
                      setCustomName(brand.name);
                      setIsSettingsOpen(false);
                    }}
                    className={`btn-tactile flex flex-col items-start p-3 rounded-xl border text-left transition-all ${
                      currentBrand.id === brand.id
                        ? "border-[#232331] bg-[#f0edff] ring-2 ring-[#7958d8]"
                        : "border-[#dedee8] bg-[#fcfcfe] hover:bg-white"
                    }`}
                  >
                    <span 
                      className="flex h-6 w-6 items-center justify-center rounded-md text-white font-bold text-[10px] mb-1.5"
                      style={{ backgroundColor: brand.themeColor }}
                    >
                      {brand.logoText.slice(0, 2)}
                    </span>
                    <span className="font-extrabold text-xs text-[#232331] leading-tight">
                      {brand.name}
                    </span>
                    <span className="text-[10px] text-[#7b7b8e] mt-0.5">
                      {brand.category}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            {/* Custom Brand Name Input */}
            <form onSubmit={handleApplyCustom} className="mt-5 border-t border-[#dedee8] pt-4">
              <label className="text-[11px] font-mono font-bold text-[#7958d8] uppercase block mb-1">
                Atau Ketik Nama Toko Kamu Sendiri:
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={customName}
                  onChange={(e) => setCustomName(e.target.value)}
                  placeholder="Contoh: Kopi Kenangan Mantan"
                  className="flex-1 rounded-xl border border-[#232331] px-3 py-2 text-xs font-bold text-[#232331] placeholder:text-[#7b7b8e]/50 focus:outline-none focus:ring-2 focus:ring-[#7958d8]"
                />
                <button
                  type="submit"
                  className="btn-tactile rounded-xl bg-[#232331] px-4 py-2 text-xs font-bold text-[#d9ff57]"
                >
                  Terapkan
                </button>
              </div>
            </form>

            {/* Watermark Toggle */}
            <div className="mt-5 rounded-2xl border border-[#dedee8] bg-[#fcfcfe] p-3.5 flex items-center justify-between gap-3">
              <div>
                <span className="font-bold text-xs text-[#232331] block">
                  Badge Footer "Powered by KAEL"
                </span>
                <span className="text-[10.5px] text-[#7b7b8e]">
                  {showWhiteLabelBadge
                    ? "Aktif (Model Co-Branding Standar)"
                    : "Nonaktif (Full 100% White-Label)"}
                </span>
              </div>
              <button
                type="button"
                onClick={() => onToggleWhiteLabelBadge(!showWhiteLabelBadge)}
                className={`btn-tactile px-3 py-1.5 rounded-lg font-mono text-[10px] font-bold border ${
                  showWhiteLabelBadge
                    ? "bg-[#d9ff57] text-[#232331] border-[#232331]"
                    : "bg-[#232331] text-white border-[#232331]"
                }`}
              >
                {showWhiteLabelBadge ? "Co-Branding ✓" : "White-Label"}
              </button>
            </div>

            {/* Close Button */}
            <div className="mt-5 pt-3 border-t border-[#dedee8]">
              <button
                type="button"
                onClick={() => setIsSettingsOpen(false)}
                className="btn-tactile w-full py-2.5 rounded-xl bg-[#f0edff] text-xs font-bold text-[#7958d8] hover:bg-[#e4deff]"
              >
                Tutup Pengaturan
              </button>
            </div>

          </div>
        </div>
      )}
    </>
  );
}
