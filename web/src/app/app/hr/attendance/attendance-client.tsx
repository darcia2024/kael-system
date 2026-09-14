"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Camera,
  CheckCircle2,
  LayoutDashboard,
  LocateFixed,
  LogIn,
  LogOut,
  MapPin,
  RotateCcw,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import type { Business } from "@/lib/types";
import { recordAttendanceAction } from "@/lib/actions-operations";
import { isMochiBusiness } from "@/lib/mochi-brand";
import { BusinessMark } from "@/components/business-mark";

type Notice = { tone: "success" | "error"; text: string } | null;

export default function AttendanceClient({
  staffName,
  siteToken,
  method,
  business,
  themeClassName = "",
}: {
  staffName: string;
  siteToken: string | null;
  method: "self" | "qr" | "nfc";
  business?: Business | null;
  themeClassName?: string;
}) {
  const isMochi = isMochiBusiness(business);
  const video = useRef<HTMLVideoElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const [selfie, setSelfie] = useState<string | null>(null);
  const [position, setPosition] = useState<{ latitude: number; longitude: number } | null>(null);
  const [cameraOpen, setCameraOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<Notice>(null);

  const openCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user", width: { ideal: 480 }, height: { ideal: 480 } },
        audio: false,
      });
      if (!video.current) return;
      video.current.srcObject = stream;
      await video.current.play();
      setCameraOpen(true);
    } catch {
      setNotice({
        tone: "error",
        text: "Kamera belum bisa dipakai. Izinkan akses kamera di browser Anda, lalu coba lagi.",
      });
    }
  };

  const capture = () => {
    if (!video.current || !canvas.current) return;
    const frame = canvas.current;
    frame.width = 480;
    frame.height = 480;
    const context = frame.getContext("2d");
    if (!context) return;
    context.drawImage(video.current, 0, 0, frame.width, frame.height);
    setSelfie(frame.toDataURL("image/jpeg", 0.7));
    const stream = video.current.srcObject as MediaStream | null;
    stream?.getTracks().forEach((track) => track.stop());
    video.current.srcObject = null;
    setCameraOpen(false);
  };

  const retakeSelfie = () => {
    setSelfie(null);
    openCamera();
  };

  const locate = () =>
    navigator.geolocation.getCurrentPosition(
      (value) =>
        setPosition({
          latitude: value.coords.latitude,
          longitude: value.coords.longitude,
        }),
      () =>
        setNotice({
          tone: "error",
          text: "Lokasi belum terbaca. Izinkan akses lokasi GPS dan coba lagi.",
        }),
      { enableHighAccuracy: true, timeout: 15_000, maximumAge: 30_000 }
    );

  const submit = async (direction: "in" | "out") => {
    if (!selfie || !position) {
      setNotice({
        tone: "error",
        text: "Selfie dan lokasi wajib diisi lengkap sebelum absensi dikirim.",
      });
      return;
    }
    setBusy(true);
    const result = await recordAttendanceAction({
      direction,
      siteToken: siteToken ?? undefined,
      latitude: position.latitude,
      longitude: position.longitude,
      selfieUrl: selfie,
      method,
    });
    setBusy(false);
    setNotice(
      result.ok
        ? {
            tone: "success",
            text:
              direction === "in"
                ? "✓ Absensi masuk kerja berhasil dicatat."
                : "✓ Absensi pulang kerja berhasil dicatat.",
          }
        : { tone: "error", text: result.error }
    );
  };

  const ready = Boolean(selfie && position);

  return (
    <div
      className={`${themeClassName} min-h-screen ${
        isMochi ? "bg-[#f0f5f2] text-[#1a382d]" : "bg-[#f7f6fc] text-[#232331]"
      } font-sans`}
    >
      {/* Sticky Top Header */}
      <header
        className={`sticky top-0 z-30 border-b ${
          isMochi
            ? "border-[#07281e] bg-[#0b3d2e] text-white shadow-md"
            : "border-b-2 border-[#232331] bg-white/95 backdrop-blur-md"
        }`}
      >
        <div className="mx-auto flex max-w-lg items-center justify-between gap-2 px-4 py-2.5 sm:px-6">
          <div className="flex min-w-0 items-center gap-2.5">
            <Link
              href="/app/pos/owner"
              className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-xl transition-colors ${
                isMochi
                  ? "bg-[#144f3d] text-white hover:bg-[#1a5e4a] border border-[#1a5e4a]"
                  : "border border-[#232331] bg-[#fcfcfe] text-[#232331] shadow-ink-xs hover:bg-[#f0edff]"
              }`}
              title="Kembali ke Dashboard Owner"
            >
              <ArrowLeft size={15} />
            </Link>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <BusinessMark
                  name={business?.name}
                  logoUrl={business?.logo_url}
                  brandColor={business?.brand_color}
                  size="sm"
                  className="h-5 w-5 rounded-md object-cover shrink-0"
                />
                <h1
                  className={`truncate text-xs font-black sm:text-base tracking-tight ${
                    isMochi ? "text-white" : "text-[#232331]"
                  }`}
                >
                  Presensi Staf &amp; Owner
                </h1>
              </div>
              <span
                className={`block truncate font-mono text-[10px] ${
                  isMochi ? "text-emerald-200/80" : "text-[#7b7b8e]"
                } sm:text-[11px]`}
              >
                {business?.name ?? "Mochi Cafe"} · Biometrik &amp; Geofence
              </span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Link
              href="/app/pos/owner"
              className={`flex items-center gap-1.5 rounded-xl px-3 py-1.5 font-mono text-xs font-black shadow-sm transition-all ${
                isMochi
                  ? "bg-[#c8f53a] text-[#0b3d2e] hover:brightness-105 active:scale-[0.98]"
                  : "border-2 border-[#232331] bg-[#d9ff57] text-[#232331] shadow-ink-xs"
              }`}
            >
              <LayoutDashboard size={13} />
              <span className="hidden sm:inline">Dashboard Owner</span>
              <span className="sm:hidden">Owner</span>
            </Link>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="mx-auto max-w-lg space-y-4 p-4 pb-20 sm:p-6">
        {/* Header Intro Card */}
        <div
          className={
            isMochi
              ? "rounded-3xl border border-[#d8e3de] bg-white p-5 sm:p-6 shadow-sm"
              : "rounded-2xl border-2 border-[#232331] bg-white p-5 shadow-ink-md"
          }
        >
          <div className="flex items-center gap-2">
            <span
              className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 font-mono text-[10px] font-extrabold uppercase ${
                isMochi
                  ? "border border-[#d8e3de] bg-[#edf8f3] text-[#167052]"
                  : "bg-[#f0edff] text-[#7958d8]"
              }`}
            >
              <Sparkles size={11} />
              KAEL HR · PRESENSI DIGITAL
            </span>
          </div>
          <h2
            className={`mt-2 text-xl font-black sm:text-2xl tracking-tight ${
              isMochi ? "text-[#0b3d2e]" : "text-[#232331]"
            }`}
          >
            Absensi {staffName}
          </h2>
          <p
            className={`mt-1.5 text-xs sm:text-sm leading-relaxed ${
              isMochi ? "text-[#527867]" : "text-[#66667a]"
            }`}
          >
            Ambil foto selfie dan deteksi lokasi GPS saat ini. Sistem otomatis
            memvalidasi koordinat radius kerja {business?.name ?? "toko"}.
          </p>
        </div>

        {/* Notice Alert */}
        {notice && (
          <div
            role="status"
            className={`flex items-start gap-2.5 rounded-2xl border p-3.5 text-xs sm:text-sm font-bold shadow-xs transition-all animate-in fade-in-50 ${
              notice.tone === "success"
                ? isMochi
                  ? "border-emerald-300 bg-[#edf8f3] text-[#0b3d2e]"
                  : "border-[#15803d] bg-[#dcfce7] text-[#166534]"
                : "border-rose-300 bg-rose-50 text-rose-800"
            }`}
          >
            {notice.tone === "success" ? (
              <CheckCircle2 size={18} className="shrink-0 mt-0.5 text-[#16a34a]" />
            ) : (
              <ShieldCheck size={18} className="shrink-0 mt-0.5 text-rose-600" />
            )}
            <span className="leading-snug">{notice.text}</span>
          </div>
        )}

        {/* Bukti Absensi Section */}
        <section
          className={
            isMochi
              ? "rounded-3xl border border-[#d8e3de] bg-white p-5 sm:p-6 shadow-sm space-y-4"
              : "rounded-2xl border-2 border-[#232331] bg-white p-5 shadow-ink-md space-y-4"
          }
        >
          <div className="flex items-center justify-between border-b border-[#edf3f0] pb-3">
            <h3
              className={`text-sm font-extrabold sm:text-base ${
                isMochi ? "text-[#0b3d2e]" : "text-[#232331]"
              }`}
            >
              Bukti Kehadiran
            </h3>
            <span
              className={`rounded-full px-3 py-1 font-mono text-[10px] font-bold ${
                ready
                  ? isMochi
                    ? "border border-[#bbf7d0] bg-[#dcfce7] text-[#15803d]"
                    : "bg-[#dcfce7] text-[#166534]"
                  : isMochi
                  ? "border border-[#fde68a] bg-[#fef3c7] text-[#b45309]"
                  : "bg-[#fff7ed] text-[#9a3412]"
              }`}
            >
              {ready
                ? "✓ 2 Bukti Siap Dikirim"
                : `Lengkapi 2 Bukti (${(selfie ? 1 : 0) + (position ? 1 : 0)}/2)`}
            </span>
          </div>

          {/* Camera Viewport */}
          <div
            className={`aspect-square w-full overflow-hidden rounded-2xl sm:rounded-3xl relative shadow-inner flex items-center justify-center ${
              isMochi
                ? "border-2 border-[#d8e3de] bg-[#07281e]"
                : "border-2 border-[#232331] bg-[#232331]"
            }`}
          >
            {selfie ? (
              <>
                <img
                  src={selfie}
                  alt="Selfie absensi"
                  className="h-full w-full object-cover"
                />
                <div className="absolute top-3 left-3 bg-[#0b3d2e]/90 backdrop-blur-xs text-[#c8f53a] font-mono text-[10px] font-extrabold px-3 py-1 rounded-full shadow-sm flex items-center gap-1.5">
                  <CheckCircle2 size={12} />
                  FOTO TERVERIFIKASI
                </div>
                <button
                  type="button"
                  onClick={retakeSelfie}
                  className="absolute top-3 right-3 bg-white/95 hover:bg-white text-[#0b3d2e] font-mono text-[10px] font-bold px-3 py-1 rounded-full shadow-md flex items-center gap-1 transition-all active:scale-95"
                >
                  <RotateCcw size={11} />
                  Foto Ulang
                </button>
              </>
            ) : cameraOpen ? (
              <>
                <video
                  ref={video}
                  muted
                  playsInline
                  className="h-full w-full object-cover"
                />
                <div className="absolute top-3 left-3 bg-rose-600/90 backdrop-blur-xs text-white font-mono text-[10px] font-bold px-3 py-1 rounded-full shadow-sm flex items-center gap-1.5 animate-pulse">
                  <span className="h-2 w-2 rounded-full bg-white" />
                  KAMERA AKTIF
                </div>
              </>
            ) : (
              <div className="flex flex-col items-center justify-center p-6 text-center space-y-3">
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white/10 text-emerald-300 backdrop-blur-xs">
                  <Camera size={26} />
                </div>
                <div>
                  <p className="text-sm font-bold text-white">Kamera Belum Aktif</p>
                  <p className="mt-1 text-[11px] text-emerald-200/70 max-w-xs leading-relaxed">
                    Tekan tombol &quot;Buka Kamera&quot; di bawah untuk mengaktifkan kamera depan dan mengambil selfie.
                  </p>
                </div>
              </div>
            )}
          </div>
          <canvas ref={canvas} className="hidden" />

          {/* Action Buttons: Camera & Capture */}
          <div className="grid grid-cols-2 gap-2.5">
            <button
              type="button"
              onClick={openCamera}
              disabled={cameraOpen || Boolean(selfie)}
              className={`inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl px-3 text-xs sm:text-sm font-bold transition-all disabled:opacity-40 disabled:cursor-not-allowed ${
                isMochi
                  ? "border border-[#d8e3de] bg-[#f9fbf9] text-[#0b3d2e] hover:bg-[#edf8f3] hover:border-[#167052]/40"
                  : "border-2 border-[#232331] bg-white text-[#232331] disabled:opacity-50"
              }`}
            >
              <Camera size={16} />
              {selfie ? "Foto Siap ✓" : "Buka Kamera"}
            </button>

            <button
              type="button"
              onClick={capture}
              disabled={!cameraOpen}
              className={`min-h-12 rounded-2xl px-3 text-xs sm:text-sm font-black transition-all disabled:opacity-40 disabled:cursor-not-allowed ${
                isMochi
                  ? "bg-[#c8f53a] hover:bg-[#d9ff57] text-[#0b3d2e] shadow-xs active:scale-[0.98]"
                  : "border-2 border-[#232331] bg-[#d9ff57] text-[#232331] disabled:opacity-50"
              }`}
            >
              Ambil Selfie
            </button>
          </div>

          {/* Locate GPS Button */}
          <button
            type="button"
            onClick={locate}
            className={`w-full inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl px-3 text-xs sm:text-sm font-bold transition-all ${
              position
                ? isMochi
                  ? "border border-emerald-300 bg-[#edf8f3] text-[#0b3d2e]"
                  : "border-2 border-[#16a34a] bg-[#dcfce7] text-[#166534]"
                : isMochi
                ? "border border-[#d8e3de] bg-white text-[#0b3d2e] hover:bg-[#edf8f3]"
                : "border-2 border-[#232331] bg-[#f0edff] text-[#232331]"
            }`}
          >
            <LocateFixed
              size={16}
              className={position ? "text-[#16a34a]" : "text-[#527867]"}
            />
            {position ? (
              <span>
                ✓ Lokasi Terkunci ({position.latitude.toFixed(4)},{" "}
                {position.longitude.toFixed(4)})
              </span>
            ) : (
              <span>Ambil Lokasi GPS</span>
            )}
          </button>

          {siteToken && (
            <div
              className={`flex items-center gap-2 rounded-xl p-2.5 text-xs font-mono ${
                isMochi
                  ? "border border-[#d8e3de] bg-[#edf8f3] text-[#167052]"
                  : "text-[#166534]"
              }`}
            >
              <MapPin size={14} className="shrink-0" />
              <span>
                Titik kerja terdeteksi dari {method === "nfc" ? "NFC Tag" : "QR Code"}.
              </span>
            </div>
          )}
        </section>

        {/* Submit Buttons: Masuk / Pulang */}
        <div className="grid grid-cols-2 gap-3">
          <button
            type="button"
            disabled={busy || !ready}
            onClick={() => submit("in")}
            className={`inline-flex min-h-14 items-center justify-center gap-2 rounded-2xl px-3 font-black text-sm sm:text-base transition-all disabled:opacity-40 disabled:cursor-not-allowed ${
              isMochi
                ? "bg-[#0b3d2e] hover:bg-[#144f3d] text-[#c8f53a] shadow-sm active:scale-[0.98]"
                : "border-2 border-[#232331] bg-[#7958d8] text-white disabled:opacity-50"
            }`}
          >
            <LogIn size={18} />
            Masuk Kerja
          </button>

          <button
            type="button"
            disabled={busy || !ready}
            onClick={() => submit("out")}
            className={`inline-flex min-h-14 items-center justify-center gap-2 rounded-2xl px-3 font-black text-sm sm:text-base transition-all disabled:opacity-40 disabled:cursor-not-allowed ${
              isMochi
                ? "border-2 border-[#0b3d2e] bg-white hover:bg-[#edf8f3] text-[#0b3d2e] shadow-sm active:scale-[0.98]"
                : "border-2 border-[#232331] bg-white text-[#232331] disabled:opacity-50"
            }`}
          >
            <LogOut size={18} />
            Pulang Kerja
          </button>
        </div>

        {/* Leave Link */}
        <Link
          href="/app/hr/leave"
          className={`block rounded-2xl p-3 text-center text-xs font-bold transition-all ${
            isMochi
              ? "border border-[#d8e3de] bg-white text-[#527867] hover:border-[#0b3d2e] hover:text-[#0b3d2e] shadow-xs"
              : "secondary w-full"
          }`}
        >
          Ajukan Izin, Cuti, atau Lembur →
        </Link>
      </main>
    </div>
  );
}
