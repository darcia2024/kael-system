"use client";

import Link from "next/link";
import { useState } from "react";
import { ArrowLeft, ClipboardPlus } from "lucide-react";
import type { Business } from "@/lib/types";
import { BusinessMark } from "@/components/business-mark";
import { submitLeaveRequestAction } from "@/lib/actions-operations";

type Request = {
  id: string;
  leave_type: string;
  starts_at: string;
  ends_at: string;
  reason: string;
  status: string;
};

const labels: Record<string, string> = {
  leave: "Cuti",
  sick: "Sakit",
  permission: "Izin",
  overtime: "Lembur",
};

export default function LeaveClient({
  staffName,
  requests,
  business,
  themeClassName = "",
}: {
  staffName: string;
  requests: Request[];
  business?: Business | null;
  themeClassName?: string;
}) {
  const [data, setData] = useState({
    leaveType: "leave" as "leave" | "sick" | "permission" | "overtime",
    startsAt: "",
    endsAt: "",
    reason: "",
  });
  const [notice, setNotice] = useState("");
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    setSaving(true);
    const result = await submitLeaveRequestAction(data);
    setSaving(false);
    setNotice(
      result.ok
        ? "Pengajuan terkirim ke owner untuk diperiksa."
        : result.error || "Pengajuan belum terkirim."
    );
    if (result.ok) window.location.reload();
  };

  return (
    <div
      className={
        "kael-hr " +
        themeClassName +
        " min-h-screen bg-[#f0f5f2] text-[#18392f] font-sans flex flex-col"
      }
    >
      {/* Sticky Emerald Header */}
      <header className="sticky top-0 z-30 border-b border-emerald-800/60 bg-[#0b3d2e] px-4 sm:px-8 py-3 text-white backdrop-blur-md shadow-sm">
        <div className="mx-auto flex max-w-lg items-center gap-3">
          <Link
            href="/app/staff"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-emerald-600/40 bg-white/10 text-white hover:bg-white/15 transition-colors shadow-xs"
            title="Kembali ke Beranda Staf"
          >
            <ArrowLeft size={16} />
          </Link>
          <BusinessMark
            name={business?.name}
            logoUrl={business?.logo_url}
            brandColor={business?.brand_color}
            className="h-9 w-9 shrink-0 rounded-full border border-emerald-400/40 bg-white p-0.5 shadow-xs"
          />
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h1 className="font-extrabold text-sm sm:text-base truncate text-white tracking-tight">
                Pengajuan Izin &amp; Lembur
              </h1>
            </div>
            <span className="text-[10.5px] text-emerald-200/80 font-mono block truncate">
              {staffName} · {business?.name || "Mochi Cafe n Resto"}
            </span>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-lg space-y-5 p-4 sm:p-6 flex-1 pb-20">
        <div>
          <h2 className="text-xl font-black text-[#0b3d2e]">
            Pengajuan Staf {staffName}
          </h2>
          <p className="mt-1 text-xs text-[#527867]">
            Kirim permohonan cuti, sakit, izin, atau lembur agar owner dapat menyetujui dan menghitungnya secara transparan.
          </p>
        </div>

        {notice && (
          <div
            role="status"
            className="rounded-2xl border border-emerald-200 bg-[#eaf6ef] p-3.5 text-xs font-bold text-[#0b3d2e] shadow-xs"
          >
            {notice}
          </div>
        )}

        <section className="rounded-3xl border border-[#d8e3de] bg-white p-5 sm:p-6 shadow-[0_4px_20px_rgba(11,61,46,0.04)]">
          <div className="flex items-center gap-2.5 text-[#0b3d2e] mb-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-[#edf8f3] text-[#0b3d2e] border border-emerald-100">
              <ClipboardPlus size={17} />
            </span>
            <h3 className="font-extrabold text-sm text-[#0b3d2e]">
              Formulir Pengajuan Baru
            </h3>
          </div>

          <label className="mt-3 block text-xs font-bold text-[#18392f]">
            <span className="mb-1 block font-mono text-[10.5px] uppercase tracking-wider text-[#527867]">
              Jenis Pengajuan
            </span>
            <select
              value={data.leaveType}
              onChange={(e) =>
                setData({
                  ...data,
                  leaveType: e.target.value as typeof data.leaveType,
                })
              }
              className="field"
            >
              <option value="leave">Cuti</option>
              <option value="sick">Sakit</option>
              <option value="permission">Izin</option>
              <option value="overtime">Lembur</option>
            </select>
          </label>

          <div className="grid grid-cols-2 gap-2 mt-1">
            <label className="mt-2 block text-xs font-bold text-[#18392f]">
              <span className="mb-1 block font-mono text-[10.5px] uppercase tracking-wider text-[#527867]">
                Mulai
              </span>
              <input
                type="datetime-local"
                value={data.startsAt}
                onChange={(e) =>
                  setData({ ...data, startsAt: e.target.value })
                }
                className="field"
              />
            </label>
            <label className="mt-2 block text-xs font-bold text-[#18392f]">
              <span className="mb-1 block font-mono text-[10.5px] uppercase tracking-wider text-[#527867]">
                Selesai
              </span>
              <input
                type="datetime-local"
                value={data.endsAt}
                onChange={(e) =>
                  setData({ ...data, endsAt: e.target.value })
                }
                className="field"
              />
            </label>
          </div>

          <label className="mt-3 block text-xs font-bold text-[#18392f]">
            <span className="mb-1 block font-mono text-[10.5px] uppercase tracking-wider text-[#527867]">
              Alasan Pengajuan
            </span>
            <textarea
              minLength={5}
              value={data.reason}
              onChange={(e) =>
                setData({ ...data, reason: e.target.value })
              }
              className="field min-h-24"
              placeholder="Tulis alasan singkat dan jelas..."
            />
          </label>

          <button
            onClick={submit}
            disabled={
              saving ||
              !data.startsAt ||
              !data.endsAt ||
              data.reason.length < 5
            }
            className="primary w-full mt-4"
          >
            Kirim Pengajuan
          </button>
        </section>

        <section className="rounded-3xl border border-[#d8e3de] bg-white p-5 sm:p-6 shadow-[0_4px_20px_rgba(11,61,46,0.04)]">
          <h3 className="font-extrabold text-sm text-[#0b3d2e] mb-3">
            Riwayat Pengajuan Saya
          </h3>
          <div className="space-y-2.5">
            {requests.map((x) => (
              <div
                className="rounded-2xl border border-[#d8e3de] bg-[#fbfdfc] p-3.5 text-xs shadow-xs"
                key={x.id}
              >
                <div className="flex justify-between items-center gap-2">
                  <b className="text-[#0b3d2e] text-sm">
                    {labels[x.leave_type] || x.leave_type}
                  </b>
                  <span
                    className={
                      "font-mono text-[10px] font-bold px-2 py-0.5 rounded-full border " +
                      (x.status === "approved"
                        ? "bg-emerald-50 text-emerald-800 border-emerald-200"
                        : x.status === "rejected"
                        ? "bg-red-50 text-red-700 border-red-200"
                        : "bg-amber-50 text-amber-800 border-amber-200")
                    }
                  >
                    {x.status === "approved"
                      ? "DISETUJUI"
                      : x.status === "rejected"
                      ? "DITOLAK"
                      : "MENUNGGU APPROVAL"}
                  </span>
                </div>
                <p className="mt-1 text-[11px] font-mono text-[#527867]">
                  {new Date(x.starts_at).toLocaleString("id-ID")} s/d{" "}
                  {new Date(x.ends_at).toLocaleString("id-ID")}
                </p>
                <p className="mt-2 text-[#18392f] italic">"{x.reason}"</p>
              </div>
            ))}
            {!requests.length && (
              <p className="rounded-2xl border border-dashed border-[#d8e3de] bg-[#f8faf9] p-4 text-center text-xs font-medium text-[#527867]">
                Belum ada pengajuan.
              </p>
            )}
          </div>
        </section>
      </main>
    </div>
  );
}
