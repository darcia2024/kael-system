"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowLeft, ExternalLink, Layers, Save, Sparkles } from "lucide-react";
import { saveSmartTouchAction } from "@/lib/actions";
import { site } from "@/lib/site";

type Button = {
  actionKey:
    | "review"
    | "whatsapp"
    | "menu"
    | "member"
    | "location"
    | "booking"
    | "custom";
  label: string;
  targetUrl: string;
  enabled: boolean;
};

const defaults = (googleReviewUrl: string | null): Button[] => [
  {
    actionKey: "review",
    label: "Beri Ulasan Google",
    targetUrl: googleReviewUrl ?? "",
    enabled: false,
  },
  {
    actionKey: "whatsapp",
    label: "Chat WhatsApp",
    targetUrl: "https://wa.me/",
    enabled: false,
  },
  {
    actionKey: "menu",
    label: "Lihat Menu / Katalog",
    targetUrl: "https://",
    enabled: false,
  },
  {
    actionKey: "member",
    label: "Jadi Member",
    targetUrl: "https://",
    enabled: false,
  },
  {
    actionKey: "location",
    label: "Buka Lokasi",
    targetUrl: "https://maps.google.com",
    enabled: false,
  },
  {
    actionKey: "booking",
    label: "Booking Sekarang",
    targetUrl: "https://",
    enabled: false,
  },
];

export default function SmartTouchClient({
  cardId,
  cardCode,
  businessName,
  googleReviewUrl,
  profile,
}: {
  cardId: string;
  cardCode: string;
  businessName: string;
  googleReviewUrl: string | null;
  profile: {
    title?: string;
    subtitle?: string | null;
    buttons?: {
      action_key: string;
      label: string;
      target_url: string;
      is_enabled: boolean;
    }[];
  } | null;
}) {
  const [title, setTitle] = useState(profile?.title ?? businessName);
  const [subtitle, setSubtitle] = useState(
    profile?.subtitle ?? "Pilih layanan yang kamu butuhkan"
  );
  const [buttons, setButtons] = useState<Button[]>(
    defaults(googleReviewUrl).map((d) => {
      const saved = profile?.buttons?.find((b) => b.action_key === d.actionKey);
      return saved
        ? {
            ...d,
            label: saved.label,
            targetUrl:
              d.actionKey === "review" && googleReviewUrl
                ? googleReviewUrl
                : saved.target_url,
            enabled: saved.is_enabled,
          }
        : d;
    })
  );
  const [saving, setSaving] = useState(false);

  const save = async () => {
    setSaving(true);
    const r = await saveSmartTouchAction(cardId, { title, subtitle, buttons });
    setSaving(false);
    if (!r.ok) alert(r.error);
    else alert("Smart Touch tersimpan.");
  };

  return (
    <div className="min-h-screen bg-[#f0f5f2] text-[#18392f] font-sans flex flex-col">
      {/* Sticky Emerald Header */}
      <header className="sticky top-0 z-30 border-b border-emerald-800/60 bg-[#0b3d2e] px-4 sm:px-8 py-3 text-white backdrop-blur-md shadow-sm">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Link
              href="/app/review"
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-emerald-600/40 bg-white/10 text-white hover:bg-white/15 transition-colors shadow-xs"
              title="Kembali ke KAEL Review"
            >
              <ArrowLeft size={16} />
            </Link>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h1 className="font-extrabold text-sm sm:text-base truncate text-white tracking-tight">
                  Editor Smart Touch
                </h1>
                <span className="rounded-full bg-[#c8f53a] px-2 py-0.5 font-mono text-[9px] font-bold text-[#073829]">
                  Kartu {cardCode}
                </span>
              </div>
              <span className="text-[10.5px] text-emerald-200/80 font-mono block truncate">
                {businessName} · Multi-Action Landing Link
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <a
              href={site.url + "/touch/" + cardCode}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 rounded-xl border border-emerald-600/40 bg-white/10 px-3 py-1.5 text-xs font-mono font-bold text-white hover:bg-white/15 transition-colors shadow-xs"
            >
              <span>Pratinjau Layar</span>
              <ExternalLink size={12} />
            </a>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-3xl space-y-6 p-4 sm:p-8 flex-1 pb-24">
        <div>
          <h2 className="text-xl sm:text-2xl font-black text-[#0b3d2e] tracking-tight">
            Satu Kartu, Banyak Aksi Pelanggan
          </h2>
          <p className="mt-1 text-xs sm:text-sm text-[#527867]">
            Kartu <span className="font-mono font-bold">{cardCode}</span> akan membuka halaman landing link interaktif ini saat di-tap via NFC atau dipindai via QR.
          </p>
        </div>

        {/* Info Header Box */}
        <section className="space-y-3 rounded-3xl border border-[#d8e3de] bg-white p-5 sm:p-6 shadow-[0_4px_20px_rgba(11,61,46,0.04)]">
          <div className="flex items-center gap-2 text-[#0b3d2e] mb-1">
            <Sparkles size={17} />
            <h3 className="font-extrabold text-sm text-[#0b3d2e]">
              Header Halaman Smart Touch
            </h3>
          </div>
          <label className="block text-xs font-bold text-[#18392f]">
            <span className="mb-1 block font-mono text-[10.5px] uppercase tracking-wider text-[#527867]">
              Judul Utama Halaman
            </span>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full rounded-xl border border-[#d8e3de] bg-[#fbfdfc] p-2.5 text-xs font-bold text-[#0b3d2e] outline-none focus:border-emerald-600 focus:bg-white focus:ring-2 focus:ring-emerald-600/20"
            />
          </label>
          <label className="block text-xs font-bold text-[#18392f]">
            <span className="mb-1 block font-mono text-[10.5px] uppercase tracking-wider text-[#527867]">
              Subjudul / Ajakan Bertindak
            </span>
            <input
              value={subtitle}
              onChange={(e) => setSubtitle(e.target.value)}
              className="w-full rounded-xl border border-[#d8e3de] bg-[#fbfdfc] p-2.5 text-xs font-bold text-[#0b3d2e] outline-none focus:border-emerald-600 focus:bg-white focus:ring-2 focus:ring-emerald-600/20"
            />
          </label>
        </section>

        {/* Buttons Box */}
        <section className="space-y-4 rounded-3xl border border-[#d8e3de] bg-white p-5 sm:p-6 shadow-[0_4px_20px_rgba(11,61,46,0.04)]">
          <div className="flex items-center gap-2 text-[#0b3d2e] mb-1">
            <Layers size={17} />
            <h3 className="font-extrabold text-base text-[#0b3d2e]">
              Daftar Tombol Layanan Pelanggan
            </h3>
          </div>
          <div className="divide-y divide-[#e5ede9] space-y-3">
            {buttons.map((button, index) => {
              const isReview = button.actionKey === "review";
              return (
                <div
                  key={button.actionKey}
                  className="grid gap-2 pt-3 sm:grid-cols-[140px_1fr_1.3fr_auto] items-center"
                >
                  <label className="flex items-center gap-2 text-xs font-bold text-[#0b3d2e] cursor-pointer">
                    <input
                      type="checkbox"
                      checked={button.enabled}
                      onChange={(e) =>
                        setButtons((items) =>
                          items.map((item, i) =>
                            i === index
                              ? { ...item, enabled: e.target.checked }
                              : item
                          )
                        )
                      }
                      className="h-4 w-4 rounded-md accent-[#0b3d2e]"
                    />
                    <span className="font-mono uppercase text-[11px] text-[#527867]">
                      {button.actionKey}
                    </span>
                  </label>

                  <input
                    value={button.label}
                    onChange={(e) =>
                      setButtons((items) =>
                        items.map((item, i) =>
                          i === index ? { ...item, label: e.target.value } : item
                        )
                      )
                    }
                    placeholder="Teks tombol..."
                    className="rounded-xl border border-[#d8e3de] bg-[#fbfdfc] p-2 text-xs font-bold text-[#0b3d2e] outline-none focus:border-emerald-600 focus:bg-white"
                  />

                  <input
                    value={isReview ? googleReviewUrl ?? "" : button.targetUrl}
                    onChange={(e) =>
                      setButtons((items) =>
                        items.map((item, i) =>
                          i === index
                            ? { ...item, targetUrl: e.target.value }
                            : item
                        )
                      )
                    }
                    readOnly={isReview}
                    placeholder={
                      isReview
                        ? "Otomatis dari Place ID di pengaturan usaha"
                        : "https://..."
                    }
                    className="rounded-xl border border-[#d8e3de] bg-[#fbfdfc] p-2 text-xs font-mono text-[#0b3d2e] read-only:bg-[#f0f5f2] read-only:text-[#527867] outline-none focus:border-emerald-600 focus:bg-white"
                  />

                  <span
                    className={
                      "py-1 px-2.5 text-center font-mono text-[10px] font-bold rounded-full border " +
                      (button.enabled
                        ? "bg-emerald-50 text-emerald-800 border-emerald-200"
                        : "bg-gray-100 text-gray-500 border-gray-200")
                    }
                  >
                    {button.enabled ? "AKTIF" : "NONAKTIF"}
                  </span>
                </div>
              );
            })}
          </div>
        </section>

        <p className="text-xs leading-5 text-[#527867]">
          Tombol ulasan Google dibuat otomatis dari Place ID di pengaturan usaha agar selalu menuju profil Google yang benar.
        </p>

        <button
          onClick={save}
          disabled={saving}
          className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-[#0b3d2e] hover:bg-[#0e4837] px-6 py-2.5 font-mono text-xs font-bold text-[#c8f53a] shadow-xs transition-colors disabled:opacity-50"
        >
          <Save size={16} />
          {saving ? "Menyimpan..." : "Simpan Pengaturan Smart Touch ✓"}
        </button>
      </main>
    </div>
  );
}
