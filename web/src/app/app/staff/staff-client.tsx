"use client";

import Link from "next/link";
import { LogOut, AlertTriangle, ChevronRight, Lock, ClipboardCheck } from "lucide-react";

import { logout } from "@/lib/actions";
import type { StaffPermission } from "@/lib/types";

export interface StaffModule {
  /**
   * Selalu izin yang bisa didelegasikan. Kasir tidak pernah bisa memegang
   * modul seperti Finance, jadi tipenya dipersempit di sini alih-alih memakai
   * ModuleKey penuh yang mengizinkan nilai yang mustahil muncul.
   */
  key: StaffPermission;
  name: string;
  hint: string;
  href: string | null;
  /** Modul lewat masa aktif: layarnya terbuka, tapi tombol simpan menolak. */
  readOnly: boolean;
}

/**
 * Beranda kasir: sependek mungkin.
 *
 * Kasir membuka layar ini di tengah antrean, sering sambil berdiri. Yang dia
 * butuhkan cuma satu: pintu ke modul yang boleh dia pakai, cukup besar untuk
 * ditekan dengan ibu jari. Tidak ada ringkasan, tidak ada angka penjualan, dan
 * tidak ada apa pun yang perlu dibaca dua kali.
 */
export default function StaffHomeClient({
  businessName,
  staffName,
  modules,
  hrEnabled,
  notice,
}: {
  businessName: string;
  staffName: string;
  modules: StaffModule[];
  hrEnabled: boolean;
  notice: string | null;
}) {
  return (
    <div className="min-h-screen bg-[#f7f6fc] text-[#232331] font-sans flex flex-col">
      <header className="sticky top-0 z-30 border-b-2 border-[#232331] bg-white px-4 sm:px-8 py-3.5">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#232331] text-[#d9ff57] font-black text-sm shadow-ink-xs">
              K
            </span>
            <div className="min-w-0">
              <span className="font-extrabold text-sm sm:text-base block truncate">
                {businessName}
              </span>
              <span className="text-[11px] text-[#7b7b8e] font-mono block truncate">
                Kasir · {staffName}
              </span>
            </div>
          </div>

          <form action={logout}>
            <button
              type="submit"
              className="inline-flex items-center gap-1.5 rounded-2xl border-2 border-[#232331] bg-white px-3 py-2 font-mono text-xs font-extrabold shadow-ink-xs"
            >
              <LogOut size={14} />
              <span className="hidden sm:inline">Keluar</span>
            </button>
          </form>
        </div>
      </header>

      <main className="mx-auto w-full max-w-3xl flex-1 px-4 sm:px-8 py-6 space-y-4">
        {notice && (
          <div className="flex items-start gap-2.5 rounded-2xl border-2 border-[#e5b800] bg-[#fff8e1] px-4 py-3 text-[#8a6d00]">
            <AlertTriangle size={18} className="shrink-0 mt-0.5" />
            <p className="font-mono text-xs font-bold">{notice}</p>
          </div>
        )}

        {hrEnabled && (
          <Link href="/app/hr/attendance" className="btn-tactile flex items-center gap-4 rounded-3xl border-2 border-[#232331] bg-[#d9ff57] p-5 shadow-ink-md">
            <ClipboardCheck size={22} className="shrink-0" />
            <div className="min-w-0 flex-1"><h2 className="font-extrabold text-base">Absensi dan izin saya</h2><p className="mt-0.5 text-xs text-[#4d4d5e]">Masuk, pulang, atau ajukan izin dan lembur.</p></div><ChevronRight size={20} className="shrink-0" />
          </Link>
        )}

        {modules.length === 0 ? (
          <div className="rounded-3xl border-2 border-dashed border-[#c9c9d4] bg-white p-10 text-center space-y-2">
            <Lock size={28} className="mx-auto text-[#c9c9d4]" />
            <p className="font-extrabold text-sm">Belum ada akses</p>
            <p className="text-xs text-[#7b7b8e] font-mono">
              Pemilik usaha belum memberikan akses modul apa pun untuk akunmu.
              Minta beliau membukanya lewat menu Kelola Akun Staf.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {modules.map((m) => (
              <Link
                key={m.key}
                href={m.href ?? "#"}
                className="btn-tactile flex items-center gap-4 rounded-3xl border-2 border-[#232331] bg-white p-5 shadow-ink-md"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="font-extrabold text-base">{m.name}</h2>
                    {m.readOnly && (
                      <span className="rounded-lg border border-[#b45309] bg-[#fef3c7] px-2 py-0.5 font-mono text-[10px] font-bold text-[#b45309]">
                        Baca-saja
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-[#7b7b8e] mt-0.5">{m.hint}</p>
                </div>
                <ChevronRight size={20} className="shrink-0 text-[#7958d8]" />
              </Link>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
