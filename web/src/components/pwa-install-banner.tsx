"use client";

import { useEffect, useState } from "react";
import { Download, X, Share, PlusSquare, Sparkles, Smartphone } from "lucide-react";
import { usePwaInstall } from "@/components/pwa-register";

export default function PwaInstallBanner({
  isMochi = true,
  className = "",
}: {
  isMochi?: boolean;
  className?: string;
}) {
  const { isInstallable, isInstalled, triggerInstall } = usePwaInstall();
  const [dismissed, setDismissed] = useState(true);
  const [isIos, setIsIos] = useState(false);
  const [showIosGuide, setShowIosGuide] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;

    // Check if user already dismissed banner in this session
    const isDismissed = sessionStorage.getItem("kael_pwa_banner_dismissed") === "1";
    setDismissed(isDismissed);

    // Detect iOS Safari
    const ua = window.navigator.userAgent;
    const isAppleDevice = /iPad|iPhone|iPod/.test(ua) && !(window as unknown as { MSStream?: unknown }).MSStream;
    const isStandalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      // @ts-expect-error navigator.standalone on iOS Safari
      window.navigator.standalone === true;

    setIsIos(isAppleDevice && !isStandalone);
  }, []);

  // Don't show if already installed or dismissed
  if (isInstalled || dismissed) return null;
  if (!isInstallable && !isIos) return null;

  const handleDismiss = () => {
    setDismissed(true);
    sessionStorage.setItem("kael_pwa_banner_dismissed", "1");
  };

  return (
    <aside
      aria-label="Pasang Aplikasi ke Layar Utama"
      className={`relative overflow-hidden rounded-3xl border transition-all animate-in fade-in-50 slide-in-from-top-2 ${
        isMochi
          ? "border-emerald-600/40 bg-gradient-to-r from-[#0b3d2e] via-[#124d3b] to-[#07281e] text-white shadow-lg"
          : "border-2 border-[#232331] bg-[#232331] text-white shadow-ink-md"
      } p-4 sm:p-5 ${className}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3.5 min-w-0">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-white/10 p-1 border border-white/20 shadow-inner overflow-hidden">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/icon-192.png" alt="KAEL App Icon" className="h-full w-full object-cover rounded-xl" />
          </div>

          <div className="min-w-0">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="inline-flex items-center gap-1 rounded-full bg-[#c8f53a] px-2 py-0.5 text-[9px] font-black text-[#073829] uppercase tracking-wider">
                <Sparkles size={10} /> App PWA Siap
              </span>
              <span className="text-[11px] font-mono text-emerald-200/80">Layar Penuh &amp; Cepat</span>
            </div>
            <h3 className="mt-1 text-sm sm:text-base font-black text-white leading-snug">
              Pasang KAEL di Layar Utama HP
            </h3>
            <p className="mt-0.5 text-xs text-emerald-100/80 leading-relaxed line-clamp-2 sm:line-clamp-none">
              Akses instan seperti aplikasi native tanpa perlu ketik alamat web, layar penuh tanpa bar browser.
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={handleDismiss}
          aria-label="Tutup rekomendasi install"
          className="rounded-xl p-1.5 text-emerald-200/70 hover:bg-white/10 hover:text-white transition-colors shrink-0"
        >
          <X size={18} />
        </button>
      </div>

      {/* Action Area */}
      <div className="mt-3.5 pt-3 border-t border-white/10 flex flex-wrap items-center gap-2.5">
        {isInstallable && (
          <button
            type="button"
            onClick={async () => {
              const installed = await triggerInstall();
              if (installed) handleDismiss();
            }}
            className="flex-1 sm:flex-initial inline-flex items-center justify-center gap-2 rounded-xl bg-[#c8f53a] px-4 py-2.5 text-xs font-black text-[#073829] hover:bg-[#d9ff57] shadow-sm transition-all active:scale-95 cursor-pointer"
          >
            <Download size={15} strokeWidth={2.6} />
            <span>Tambahkan ke Layar Utama</span>
          </button>
        )}

        {isIos && (
          <button
            type="button"
            onClick={() => setShowIosGuide(!showIosGuide)}
            className="flex-1 sm:flex-initial inline-flex items-center justify-center gap-2 rounded-xl bg-white/15 hover:bg-white/25 border border-white/20 px-4 py-2.5 text-xs font-bold text-white transition-all cursor-pointer"
          >
            <Smartphone size={15} />
            <span>{showIosGuide ? "Tutup Panduan iPhone" : "Cara Pasang di iPhone / iPad"}</span>
          </button>
        )}

        <button
          type="button"
          onClick={handleDismiss}
          className="px-3 py-2 text-xs font-semibold text-emerald-200/70 hover:text-white transition-colors"
        >
          Nanti Saja
        </button>
      </div>

      {/* iOS Safari Step-by-Step Guide */}
      {isIos && showIosGuide && (
        <div className="mt-3 rounded-2xl bg-white/10 border border-white/15 p-3.5 text-xs space-y-2 animate-in fade-in-50">
          <p className="font-bold text-white flex items-center gap-1.5">
            <Share size={14} className="text-[#c8f53a]" />
            Langkah Pasang di Safari iPhone / iPad:
          </p>
          <ol className="list-decimal list-inside space-y-1 text-emerald-100/90 text-[11.5px] leading-relaxed">
            <li>Ketuk ikon <strong>Bagikan / Share</strong> (<Share size={12} className="inline mx-0.5" /> di bilah bawah Safari).</li>
            <li>Gulir ke bawah dan pilih menu <strong>&quot;Tambah ke Layar Utama&quot;</strong> (<PlusSquare size={12} className="inline mx-0.5" /> <em>Add to Home Screen</em>).</li>
            <li>Ketuk <strong>&quot;Tambah&quot;</strong> di pojok kanan atas. Ikon aplikasi akan muncul di layar HP Anda!</li>
          </ol>
        </div>
      )}
    </aside>
  );
}
