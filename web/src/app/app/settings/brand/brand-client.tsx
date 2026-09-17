"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowLeft, MessageCircle, Palette } from "lucide-react";
import { saveBrandSettingsAction, saveMessagingChannelAction } from "@/lib/actions-operations";

export default function BrandClient({
  business,
  brand,
  channel,
  themeClassName,
}: {
  business: { name: string; brandColor: string; customDomain: string | null } | null;
  brand: { app_name: string; accent_color: string; support_email: string | null; public_footer_text: string | null; custom_domain_status: string } | null;
  channel: { provider: "manual" | "meta_cloud" | "gateway"; sender_phone: string | null; owner_notify_phone?: string | null; phone_number_id: string | null; business_account_id: string | null; secret_ref: string | null; is_enabled: boolean } | null;
  themeClassName?: string;
}) {
  const [appName, setAppName] = useState(brand?.app_name ?? business?.name ?? "Mochi Cafe");
  const [color, setColor] = useState(brand?.accent_color ?? business?.brandColor ?? "#0b3d2e");
  const [domain, setDomain] = useState(business?.customDomain ?? "");
  const [provider, setProvider] = useState(channel?.provider ?? "manual");
  const [sender, setSender] = useState(channel?.sender_phone ?? "");
  /**
   * Nomor yang MENERIMA kabar operasional, terpisah dari nomor pengirim.
   * Owner sering bukan orang yang memegang HP toko, dan kabar yang masuk ke
   * HP toko menumpuk bersama chat pelanggan sampai tidak pernah dibaca.
   */
  const [notifPhone, setNotifPhone] = useState(channel?.owner_notify_phone ?? "");
  const [phoneId, setPhoneId] = useState(channel?.phone_number_id ?? "");
  const [secret, setSecret] = useState(channel?.secret_ref ?? "");
  const [enabled, setEnabled] = useState(channel?.is_enabled ?? false);

  const saveBrand = async (e: React.FormEvent) => {
    e.preventDefault();
    const r = await saveBrandSettingsAction({ appName, accentColor: color, customDomain: domain });
    if (!r.ok) alert(r.error);
    else location.reload();
  };

  const saveWa = async (e: React.FormEvent) => {
    e.preventDefault();
    const r = await saveMessagingChannelAction({ provider, senderPhone: sender, ownerNotifyPhone: notifPhone, phoneNumberId: phoneId, secretRef: secret, enabled });
    if (!r.ok) alert(r.error);
    else location.reload();
  };

  return (
    <main className={`${themeClassName || ""} min-h-screen bg-[#f0f5f2] p-4 text-[#1a382d] sm:p-8 font-sans`}>
      <div className="mx-auto max-w-3xl space-y-6">
        <Link
          href="/app/settings"
          className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-[#d8e3de] bg-white text-[#1a382d] hover:bg-[#edf8f3] transition-colors"
        >
          <ArrowLeft size={17} />
        </Link>
        <header>
          <p className="font-mono text-[11px] font-bold text-[#167052]">WHITE LABEL</p>
          <h1 className="text-2xl font-black text-[#0b3d2e]">Brand dan Channel WhatsApp</h1>
        </header>

        <form onSubmit={saveBrand} className="space-y-4 rounded-3xl border border-[#d8e3de] bg-white p-6 shadow-[0_4px_20px_rgba(11,61,46,0.04)]">
          <div className="flex items-center gap-2 font-bold text-[#0b3d2e]">
            <Palette size={18} className="text-[#167052]" />
            <span>Tampilan Tenant</span>
          </div>
          <label className="block text-xs font-bold text-[#1a382d]">
            Nama aplikasi publik
            <input
              value={appName}
              onChange={(e) => setAppName(e.target.value)}
              className="mt-1.5 w-full rounded-xl border border-[#d8e3de] bg-[#fbfdfc] p-2.5 text-sm font-semibold focus:border-emerald-600 focus:bg-white outline-none"
            />
          </label>
          <label className="block text-xs font-bold text-[#1a382d]">
            Warna utama
            <input
              type="color"
              value={color}
              onChange={(e) => setColor(e.target.value)}
              className="mt-1.5 block h-10 w-20 rounded-xl border border-[#d8e3de] p-1 cursor-pointer"
            />
          </label>
          <label className="block text-xs font-bold text-[#1a382d]">
            Domain sendiri
            <input
              value={domain}
              onChange={(e) => setDomain(e.target.value)}
              placeholder="app.tokokamu.com"
              className="mt-1.5 w-full rounded-xl border border-[#d8e3de] bg-[#fbfdfc] p-2.5 text-sm font-semibold focus:border-emerald-600 focus:bg-white outline-none"
            />
          </label>
          <p className="text-xs text-[#527867]">
            Status domain: {brand?.custom_domain_status ?? "belum diajukan"}. Setelah disimpan, arahkan DNS ke konfigurasi domain KAEL untuk verifikasi.
          </p>
          <button className="rounded-xl bg-[#0b3d2e] hover:bg-[#0e4837] px-4 py-2.5 font-mono text-xs font-bold text-[#c8f53a] shadow-xs transition-colors">
            Simpan Brand
          </button>
        </form>

        <form onSubmit={saveWa} className="space-y-4 rounded-3xl border border-[#d8e3de] bg-white p-6 shadow-[0_4px_20px_rgba(11,61,46,0.04)]">
          <div className="flex items-center gap-2 font-bold text-[#0b3d2e]">
            <MessageCircle size={18} className="text-[#167052]" />
            <span>WhatsApp per Tenant</span>
          </div>
          <label className="block text-xs font-bold text-[#1a382d]">
            Provider
            <select
              value={provider}
              onChange={(e) => setProvider(e.target.value as "manual" | "meta_cloud" | "gateway")}
              className="mt-1.5 w-full rounded-xl border border-[#d8e3de] bg-[#fbfdfc] p-2.5 text-sm font-semibold focus:border-emerald-600 focus:bg-white outline-none"
            >
              <option value="manual">Manual wa.me</option>
              <option value="meta_cloud">Meta WhatsApp Cloud API</option>
              <option value="gateway">Gateway pihak ketiga</option>
            </select>
          </label>
          <label className="block text-xs font-bold text-[#1a382d]">
            Nomor pengirim
            <input
              value={sender}
              onChange={(e) => setSender(e.target.value)}
              className="mt-1.5 w-full rounded-xl border border-[#d8e3de] bg-[#fbfdfc] p-2.5 text-sm font-semibold focus:border-emerald-600 focus:bg-white outline-none"
            />
            <span className="mt-1 block text-[11px] font-normal leading-relaxed text-[#5b7a6e]">
              Nomor toko yang MENGIRIM pesan ke pelanggan.
            </span>
          </label>
          <label className="block text-xs font-bold text-[#1a382d]">
            Nomor penerima notifikasi owner
            <input
              value={notifPhone}
              onChange={(e) => setNotifPhone(e.target.value)}
              placeholder="0813xxxxxxx"
              className="mt-1.5 w-full rounded-xl border border-[#d8e3de] bg-[#fbfdfc] p-2.5 text-sm font-semibold focus:border-emerald-600 focus:bg-white outline-none"
            />
            <span className="mt-1 block text-[11px] font-normal leading-relaxed text-[#5b7a6e]">
              Nomor yang MENERIMA kabar operasional: pesanan masuk, stok menipis,
              selisih tutup shift. Boleh beda dari nomor pengirim — kabar yang
              masuk ke HP toko menumpuk bersama chat pelanggan sampai tidak
              pernah terbaca.
            </span>
          </label>
          {provider === "meta_cloud" && (
            <>
              <label className="block text-xs font-bold text-[#1a382d]">
                Phone Number ID
                <input
                  value={phoneId}
                  onChange={(e) => setPhoneId(e.target.value)}
                  className="mt-1.5 w-full rounded-xl border border-[#d8e3de] bg-[#fbfdfc] p-2.5 text-sm font-semibold focus:border-emerald-600 focus:bg-white outline-none"
                />
              </label>
              <label className="block text-xs font-bold text-[#1a382d]">
                Nama secret token
                <input
                  value={secret}
                  onChange={(e) => setSecret(e.target.value)}
                  placeholder="WA_TENANT_x_TOKEN"
                  className="mt-1.5 w-full rounded-xl border border-[#d8e3de] bg-[#fbfdfc] p-2.5 text-sm font-semibold focus:border-emerald-600 focus:bg-white outline-none"
                />
              </label>
            </>
          )}
          <label className="flex items-center gap-2 text-xs font-bold text-[#1a382d]">
            <input
              type="checkbox"
              checked={enabled}
              onChange={(e) => setEnabled(e.target.checked)}
              className="rounded accent-[#0b3d2e]"
            />
            <span>Aktifkan channel ini</span>
          </label>
          <button className="rounded-xl bg-[#0b3d2e] hover:bg-[#0e4837] px-4 py-2.5 font-mono text-xs font-bold text-[#c8f53a] shadow-xs transition-colors">
            Simpan Channel
          </button>
        </form>
      </div>
    </main>
  );
}
