"use client";

import { useState } from "react";
import Link from "next/link";
import { 
  ArrowLeft, 
  Check, 
  ExternalLink, 
  Heart, 
  MapPin, 
  MessageSquare, 
  Nfc, 
  QrCode, 
  Send, 
  Share2, 
  Smartphone, 
  Sparkles, 
  Star, 
  ThumbsUp, 
  Zap 
} from "lucide-react";
import { DemoNavbar } from "@/components/demo-navbar";
import { DEMO_BRANDS, DemoBrand } from "@/lib/demo-config";

export default function DemoReviewPage() {
  const [currentBrand, setCurrentBrand] = useState<DemoBrand>(DEMO_BRANDS[0]);
  const [showWhiteLabelBadge, setShowWhiteLabelBadge] = useState<boolean>(true);
  const [rating, setRating] = useState<number>(5);
  const [hoverRating, setHoverRating] = useState<number>(5);
  const [reviewText, setReviewText] = useState<string>("");
  const [isSubmitted, setIsSubmitted] = useState<boolean>(false);
  const [isTapped, setIsTapped] = useState<boolean>(true);

  const handleSimulateTap = () => {
    setIsTapped(false);
    setTimeout(() => setIsTapped(true), 300);
  };

  const handleSelectStar = (stars: number) => {
    setRating(stars);
    if (stars === 5) {
      setReviewText("Pelayanan sangat ramah, tempatnya nyaman banget, dan produknya memuaskan! Pasti bakal balik lagi ke sini ⭐⭐⭐⭐⭐");
    } else if (stars === 4) {
      setReviewText("Bagus dan nyaman, staf ramah, rekomendasi!");
    } else {
      setReviewText("Perlu ditingkatkan untuk kecepatan pelayanan.");
    }
  };

  const handleSubmitReview = (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitted(true);
  };

  return (
    <div className="min-h-screen bg-[#fcfcfe] text-[#232331] flex flex-col">
      <DemoNavbar
        currentBrand={currentBrand}
        onBrandChange={setCurrentBrand}
        showWhiteLabelBadge={showWhiteLabelBadge}
        onToggleWhiteLabelBadge={setShowWhiteLabelBadge}
      />

      <main className="flex-1 max-w-7xl mx-auto px-4 sm:px-6 py-6 sm:py-10 w-full">
        
        {/* Page Breadcrumb / Heading */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#dedee8] pb-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="flex h-6 w-6 items-center justify-center rounded-md bg-[#7958d8] text-white font-mono text-[10px] font-bold">
                01
              </span>
              <h1 className="text-lg sm:text-2xl font-extrabold text-[#232331]">
                KAEL Review Live Application
              </h1>
            </div>
            <p className="text-xs text-[#7b7b8e] mt-0.5">
              Simulasi alur ulasan Google Maps instan via Tap NFC atau Scan QR meja kasir.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Link
              href="/app/review"
              className="btn-tactile flex items-center gap-1.5 rounded-xl border border-[#7958d8] bg-[#f0edff] px-3.5 py-2 text-xs font-bold text-[#7958d8] shadow-ink-xs hover:bg-[#e4deff]"
            >
              <Nfc size={14} />
              <span>Owner Review Dashboard ➔</span>
            </Link>

            <button
              type="button"
              onClick={handleSimulateTap}
              className="btn-tactile flex items-center gap-1.5 rounded-xl bg-[#232331] px-3.5 py-2 text-xs font-bold text-[#d9ff57] shadow-ink-xs"
            >
              <Zap size={14} />
              <span>Simulasikan Tap NFC</span>
            </button>
          </div>
        </div>

        {/* 2-Column Showcase */}
        <div className="mt-8 grid gap-8 lg:grid-cols-12 items-start">
          
          {/* Left Column: Mobile Customer View Simulator */}
          <div className="lg:col-span-6 flex justify-center">
            <div className="w-full max-w-sm rounded-[36px] border-[3px] border-[#232331] bg-white p-3 shadow-ink-xl">
              
              {/* Phone Bezel Header */}
              <div className="flex items-center justify-between px-3 py-1 text-[11px] font-mono text-[#7b7b8e] border-b border-gray-100">
                <span>09:41</span>
                <div className="flex items-center gap-1">
                  <span className="h-2 w-2 rounded-full bg-[#16a34a]" />
                  <span>NFC Connected</span>
                </div>
              </div>

              {/* Phone Inner Screen */}
              <div className="mt-2 rounded-[28px] bg-[#fcfcfe] p-4 sm:p-5 border border-[#dedee8] text-[#232331] min-h-[520px] flex flex-col justify-between">
                
                {/* Store Header Banner */}
                <div>
                  <div className="rounded-2xl p-4 text-center border-2 border-[#232331] shadow-ink-xs" style={{ backgroundColor: currentBrand.themeColorLight }}>
                    <div 
                      className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl border-2 border-[#232331] text-white font-extrabold text-base shadow-ink-xs"
                      style={{ backgroundColor: currentBrand.themeColor }}
                    >
                      {currentBrand.logoText.slice(0, 2)}
                    </div>
                    <h2 className="mt-2.5 text-base font-extrabold text-[#232331]">
                      {currentBrand.name}
                    </h2>
                    <p className="text-[11px] text-[#7b7b8e] flex items-center justify-center gap-1 mt-0.5">
                      <MapPin size={11} />
                      <span>{currentBrand.address}</span>
                    </p>
                    <div className="mt-2 inline-flex items-center gap-1 rounded-full bg-white px-2.5 py-0.5 text-[10px] font-bold text-[#16a34a] border border-[#dedee8]">
                      <span>★ 4.9 Rating di Google Maps (340+ Ulasan)</span>
                    </div>
                  </div>

                  {/* Review Box */}
                  {!isSubmitted ? (
                    <div className="mt-4 rounded-2xl bg-white p-4 border border-[#dedee8] shadow-ink-xs text-center">
                      <p className="text-xs font-bold text-[#232331]">
                        Beri rating pengalamanmu hari ini:
                      </p>

                      {/* 5 Interactive Stars */}
                      <div className="mt-2.5 flex items-center justify-center gap-1.5">
                        {[1, 2, 3, 4, 5].map((star) => (
                          <button
                            key={star}
                            type="button"
                            onClick={() => handleSelectStar(star)}
                            onMouseEnter={() => setHoverRating(star)}
                            onMouseLeave={() => setHoverRating(rating)}
                            className="p-1 transition-transform hover:scale-125 focus:outline-none"
                          >
                            <Star
                              size={26}
                              className={`transition-colors ${
                                star <= (hoverRating || rating)
                                  ? "fill-[#f59e0b] text-[#f59e0b]"
                                  : "fill-none text-[#dedee8]"
                              }`}
                            />
                          </button>
                        ))}
                      </div>

                      <p className="text-[11px] font-mono font-bold text-[#7958d8] mt-1">
                        {rating === 5 && "⭐ Luar Biasa / Sangat Puas!"}
                        {rating === 4 && "⭐ Puas & Rekomendasi"}
                        {rating === 3 && "⭐ Cukup Baik"}
                        {rating <= 2 && "⭐ Butuh Perbaikan"}
                      </p>

                      <form onSubmit={handleSubmitReview} className="mt-3 text-left">
                        <label className="text-[10px] font-bold text-[#7b7b8e] block mb-1">
                          Tulis ulasan jujurmu:
                        </label>
                        <textarea
                          rows={3}
                          value={reviewText}
                          onChange={(e) => setReviewText(e.target.value)}
                          placeholder="Bagaimana pelayanan & rasa hari ini..."
                          className="w-full rounded-xl border border-[#dedee8] p-2.5 text-xs text-[#232331] focus:outline-none focus:ring-2 focus:ring-[#7958d8]"
                        />

                        <button
                          type="submit"
                          className="btn-tactile mt-3 flex w-full items-center justify-center gap-1.5 rounded-xl bg-[#232331] py-2.5 text-xs font-bold text-[#d9ff57] shadow-ink-xs"
                        >
                          <Send size={12} />
                          <span>Kirim Ulasan ke Google Maps</span>
                        </button>
                      </form>
                    </div>
                  ) : (
                    <div className="mt-4 rounded-2xl bg-[#dcfce7] p-5 border-2 border-[#16a34a] text-center text-[#16a34a] animate-fadeIn">
                      <span className="text-3xl">🎉</span>
                      <h4 className="font-extrabold text-sm text-[#16a34a] mt-2">
                        Terima Kasih Banyak!
                      </h4>
                      <p className="text-xs text-[#232331] mt-1">
                        Ulasan bintang {rating} kamu untuk <strong>{currentBrand.name}</strong> langsung tercatat di Google Maps.
                      </p>
                      <button
                        type="button"
                        onClick={() => setIsSubmitted(false)}
                        className="mt-3 text-[10px] font-bold text-[#16a34a] underline"
                      >
                        Kirim Ulasan Lain
                      </button>
                    </div>
                  )}
                </div>

                {/* Footer in Phone */}
                {showWhiteLabelBadge ? (
                  <div className="mt-4 text-center text-[10px] text-[#7b7b8e] pt-2 border-t border-gray-100">
                    <span>⚡ Powered by <strong>KAEL Review System</strong></span>
                  </div>
                ) : (
                  <div className="mt-4 text-center text-[10px] text-[#7b7b8e] pt-2 border-t border-gray-100">
                    <span>© {currentBrand.name} · Official Guest Review</span>
                  </div>
                )}

              </div>
            </div>
          </div>

          {/* Right Column: Physical Hardware Preview & Explanations */}
          <div className="lg:col-span-6 space-y-6">
            
            {/* Card Standee 3D Mockup */}
            <div className="rounded-3xl border-2 border-[#232331] bg-white p-6 shadow-ink-md">
              <div className="flex items-center justify-between border-b border-[#dedee8] pb-3">
                <span className="font-mono text-[10px] font-bold uppercase text-[#7958d8]">
                  MEDIA FISIK RESMI
                </span>
                <span className="text-xs font-bold text-[#16a34a]">
                  NFC Chip + Dynamic QR Backup
                </span>
              </div>

              {/* Physical Acrylic Card Mockup */}
              <div className="mt-4 flex flex-col sm:flex-row items-center gap-4 bg-[#f0edff] p-5 rounded-2xl border border-[#dedee8]">
                <div 
                  className="relative w-48 h-32 rounded-2xl border-2 border-[#232331] p-3 text-white shadow-ink-md flex flex-col justify-between"
                  style={{ backgroundColor: currentBrand.themeColor }}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-extrabold text-xs tracking-wider">
                      {currentBrand.logoText}
                    </span>
                    <Nfc size={16} />
                  </div>
                  <div className="text-center">
                    <span className="text-[9px] font-mono uppercase tracking-widest opacity-80">
                      TAP HP DISINI
                    </span>
                    <p className="text-xs font-bold">Beri Bintang 5 ⭐</p>
                  </div>
                  <div className="flex items-center justify-between text-[8px] opacity-75 font-mono">
                    <span>GOOGLE REVIEW</span>
                    <span>{showWhiteLabelBadge ? "BY KAEL" : ""}</span>
                  </div>
                </div>

                <div className="text-xs text-[#232331] space-y-1.5">
                  <h4 className="font-extrabold text-sm">Kartu Akrilik Tap Meja</h4>
                  <p className="text-[#7b7b8e] text-[11px] leading-relaxed">
                    Ditaruh di meja kasir atau dibawa staf menyapa tamu. Pelanggan cukup menempelkan HP ke kartu ini, halaman ulasan di sebelah kiri langsung terbuka!
                  </p>
                  <div className="inline-flex items-center gap-1 rounded bg-white px-2 py-0.5 text-[10px] font-mono font-bold text-[#7958d8] border">
                    🔒 Direct Link Permanen Ter-Lock
                  </div>
                </div>
              </div>
            </div>

            {/* Feature Breakdown */}
            <div className="rounded-3xl border-2 border-[#232331] bg-white p-6 shadow-ink-md space-y-3">
              <h3 className="font-extrabold text-base text-[#232331]">
                Kenapa KAEL Review Begitu Efektif?
              </h3>
              
              <div className="space-y-2 text-xs">
                <div className="flex items-start gap-2">
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#d9ff57] text-[#232331]">
                    <Check size={12} strokeWidth={3} />
                  </span>
                  <span><strong>100% Organik &amp; Asli:</strong> Google mendeteksi akun Google asli pelanggan yang sedang berada di lokasimu.</span>
                </div>
                <div className="flex items-start gap-2">
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#d9ff57] text-[#232331]">
                    <Check size={12} strokeWidth={3} />
                  </span>
                  <span><strong>Tanpa Ketik Nama Toko:</strong> Menghilangkan hambatan customer yang malas mencari nama tokomu di maps.</span>
                </div>
                <div className="flex items-start gap-2">
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#d9ff57] text-[#232331]">
                    <Check size={12} strokeWidth={3} />
                  </span>
                  <span><strong>Mendongkrak Ranking SEO Maps:</strong> Toko dengan ulasan bintang 5 terbanyak otomatis diprioritaskan Google saat turis mencari cafe/toko terdekat.</span>
                </div>
              </div>
            </div>

          </div>

        </div>

      </main>

      {/* Footer */}
      {showWhiteLabelBadge && (
        <footer className="border-t border-[#dedee8] py-4 text-center text-xs text-[#7b7b8e] bg-white">
          <p>⚡ Powered by <strong>KAEL Review</strong> · Live Demo Environment</p>
        </footer>
      )}
    </div>
  );
}
