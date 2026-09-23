"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Camera,
  CheckCircle2,
  Delete,
  KeyRound,
  LocateFixed,
  LogIn,
  LogOut,
  MapPin,
  RotateCcw,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  UserCheck,
} from "lucide-react";
import type { Business } from "@/lib/types";
import { BusinessMark } from "@/components/business-mark";
import { loginStaff } from "@/lib/actions";
import { recordAttendanceAction } from "@/lib/actions-operations";
import { isMochiBusiness } from "@/lib/mochi-brand";

interface StaffInfo {
  id: string;
  name: string;
}

interface SiteInfo {
  id: string;
  name: string;
  qr_token: string;
  latitude: number | null;
  longitude: number | null;
  allowed_radius_meters: number;
}

interface PolicyInfo {
  attendance_require_selfie: boolean;
  attendance_require_location: boolean;
}

function calculateDistanceMeters(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371000;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c);
}

export default function PersonalAttendanceClient({
  staff,
  business,
  site,
  policy,
  initialIsAuthenticated,
  todayAttendance = [],
  themeClassName = "",
}: {
  staff: StaffInfo;
  business?: Business | null;
  site: SiteInfo | null;
  policy: PolicyInfo;
  initialIsAuthenticated: boolean;
  todayAttendance?: any[];
  themeClassName?: string;
}) {
  const isMochi = isMochiBusiness(business);
  const [isAuthenticated, setIsAuthenticated] = useState(initialIsAuthenticated);

  // PIN State
  const [pin, setPin] = useState("");
  const [pinLoading, setPinLoading] = useState(false);
  const [pinError, setPinError] = useState("");

  // Attendance State
  const video = useRef<HTMLVideoElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const [selfie, setSelfie] = useState<string | null>(null);
  const [position, setPosition] = useState<{ latitude: number; longitude: number } | null>(null);
  const [gpsDistance, setGpsDistance] = useState<number | null>(null);
  const [cameraOpen, setCameraOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [notice, setNotice] = useState<{ tone: "success" | "error"; text: string } | null>(null);
  const [records, setRecords] = useState<any[]>(todayAttendance);

  // Trigger GPS auto-detect
  const requestLocation = () => {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const coords = {
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
        };
        setPosition(coords);
        if (site && site.latitude !== null && site.longitude !== null) {
          const dist = calculateDistanceMeters(
            coords.latitude,
            coords.longitude,
            Number(site.latitude),
            Number(site.longitude)
          );
          setGpsDistance(dist);
        }
      },
      (err) => {
        console.warn("GPS error:", err);
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 30000 }
    );
  };

  useEffect(() => {
    if (isAuthenticated) {
      requestLocation();
    }
  }, [isAuthenticated]);

  // Handle PIN input
  const handlePinDigit = (digit: string) => {
    if (pin.length >= 6) return;
    const next = pin + digit;
    setPin(next);
    setPinError("");
    // If reached 4 digits, we can verify, or wait for user to press submit
    if (next.length === 4) {
      void verifyPin(next);
    }
  };

  const handleBackspace = () => {
    setPin((prev) => prev.slice(0, -1));
    setPinError("");
  };

  const verifyPin = async (pinToTest: string) => {
    if (!business?.id) return;
    setPinLoading(true);
    setPinError("");
    try {
      const res = await loginStaff(business.id, staff.id, pinToTest);
      if (res.ok) {
        setIsAuthenticated(true);
        setPin("");
      } else {
        setPinError(res.error || "PIN yang dimasukkan belum tepat.");
        setPin("");
      }
    } catch {
      setPinError("Gagal memverifikasi PIN. Silakan coba lagi.");
      setPin("");
    } finally {
      setPinLoading(false);
    }
  };

  // Camera handling
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
    } catch (e) {
      setNotice({
        tone: "error",
        text: "Kamera belum bisa dibuka. Mohon izinkan akses kamera di browser Anda.",
      });
    }
  };

  const captureSelfie = () => {
    if (!video.current || !canvas.current) return;
    const frame = canvas.current;
    frame.width = 480;
    frame.height = 480;
    const ctx = frame.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(video.current, 0, 0, frame.width, frame.height);
    setSelfie(frame.toDataURL("image/jpeg", 0.75));
    const stream = video.current.srcObject as MediaStream | null;
    stream?.getTracks().forEach((track) => track.stop());
    video.current.srcObject = null;
    setCameraOpen(false);
  };

  const retakeSelfie = () => {
    setSelfie(null);
    openCamera();
  };

  // Submit Attendance
  const submitAttendance = async (direction: "in" | "out") => {
    if (policy.attendance_require_selfie && !selfie) {
      setNotice({
        tone: "error",
        text: "Ambil foto selfie wajah terlebih dahulu sebelum mengirim absensi.",
      });
      return;
    }
    if (policy.attendance_require_location && !position) {
      setNotice({
        tone: "error",
        text: "Lokasi GPS belum terdeteksi. Izinkan akses GPS di browser dan coba lagi.",
      });
      requestLocation();
      return;
    }

    setSubmitting(true);
    setNotice(null);

    const res = await recordAttendanceAction({
      direction,
      siteToken: site?.qr_token,
      latitude: position?.latitude,
      longitude: position?.longitude,
      selfieUrl: selfie ?? undefined,
      method: "qr",
    });

    setSubmitting(false);

    if (res.ok) {
      const nowStr = new Date().toLocaleTimeString("id-ID", {
        hour: "2-digit",
        minute: "2-digit",
      });
      setNotice({
        tone: "success",
        text:
          direction === "in"
            ? `✓ Absen Masuk berhasil dicatat pukul ${nowStr} WIB!`
            : `✓ Absen Pulang berhasil dicatat pukul ${nowStr} WIB!`,
      });
      // Add entry to today record preview
      setRecords((prev) => [
        {
          id: String(Date.now()),
          check_in_at: direction === "in" ? new Date().toISOString() : prev[0]?.check_in_at,
          check_out_at: direction === "out" ? new Date().toISOString() : null,
          check_in_selfie_url: selfie,
        },
        ...prev.filter((_, i) => (direction === "out" ? i > 0 : true)),
      ]);
    } else {
      setNotice({
        tone: "error",
        text: res.error || "Gagal mencatat absensi. Silakan coba lagi.",
      });
    }
  };

  const isWithinRadius =
    gpsDistance !== null && site ? gpsDistance <= site.allowed_radius_meters : true;

  return (
    <div
      className={`${themeClassName} min-h-screen ${
        isMochi ? "bg-[#f0f5f2] text-[#1a382d]" : "bg-[#f7f6fc] text-[#232331]"
      } font-sans flex flex-col justify-between`}
    >
      {/* Sticky Top Header */}
      <header
        className={`sticky top-0 z-30 border-b ${
          isMochi
            ? "border-[#07281e] bg-[#0b3d2e] text-white shadow-md"
            : "border-b-2 border-[#232331] bg-white shadow-xs"
        }`}
      >
        <div className="mx-auto flex max-w-lg items-center justify-between px-4 py-3 sm:px-6">
          <div className="flex items-center gap-2.5">
            <BusinessMark
              name={business?.name}
              logoUrl={business?.logo_url}
              brandColor={business?.brand_color}
              size="sm"
              className="h-8 w-8 rounded-full border border-emerald-400/40 shadow-xs shrink-0"
            />
            <div className="min-w-0">
              <h1 className="truncate text-xs font-black sm:text-sm text-white tracking-tight">
                {business?.name ?? "Mochi Cafe n Resto"}
              </h1>
              <span className="block truncate font-mono text-[10.5px] text-emerald-200/90">
                Presensi Staf: <strong>{staff.name}</strong>
              </span>
            </div>
          </div>

          {isAuthenticated && (
            <button
              onClick={() => setIsAuthenticated(false)}
              className="text-[11px] font-mono font-bold text-emerald-200 hover:text-white flex items-center gap-1 transition-colors px-2 py-1 rounded-lg hover:bg-white/10"
              title="Kunci / Ganti Akun"
            >
              <LogOut size={13} />
              <span className="hidden sm:inline">Kunci</span>
            </button>
          )}
        </div>
      </header>

      {/* Main Content */}
      <main className="mx-auto w-full max-w-md p-4 sm:p-6 my-auto space-y-4">
        {!isAuthenticated ? (
          /* ================================================================
             STEP 1: PIN VERIFICATION SCREEN FOR THIS SPECIFIC STAFF
             ================================================================ */
          <div
            className={`rounded-3xl p-6 sm:p-8 space-y-5 text-center shadow-lg ${
              isMochi
                ? "bg-white border border-[#d8e3de]"
                : "bg-white border-2 border-[#232331] shadow-ink-md"
            }`}
          >
            {/* Avatar & Greeting */}
            <div className="space-y-2">
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-[#0b3d2e] text-[#c8f53a] shadow-md text-2xl font-black">
                {staff.name.charAt(0).toUpperCase()}
              </div>
              <div>
                <span className="rounded-full bg-[#edf8f3] px-3 py-0.5 font-mono text-[10px] font-black uppercase text-[#167052] border border-emerald-200">
                  PRESENSI PERSONAL
                </span>
                <h2 className="text-xl sm:text-2xl font-black text-[#0b3d2e] mt-1.5 tracking-tight">
                  Halo, {staff.name}! 👋
                </h2>
                <p className="text-xs text-[#527867] mt-0.5">
                  Ketik PIN Anda untuk membuka kamera presensi
                </p>
              </div>
            </div>

            {/* Error Message */}
            {pinError && (
              <div className="rounded-2xl border border-rose-300 bg-rose-50 p-3 text-xs font-bold text-rose-800 flex items-center justify-center gap-2">
                <ShieldAlert size={15} className="shrink-0" />
                <span>{pinError}</span>
              </div>
            )}

            {/* PIN Dots (4 or 6 dots based on input) */}
            <div className="flex justify-center items-center gap-3 py-2">
              {[0, 1, 2, 3].map((i) => (
                <div
                  key={i}
                  className={`h-4 w-4 rounded-full transition-all duration-150 ${
                    i < pin.length
                      ? "bg-[#0b3d2e] scale-110 shadow-xs"
                      : "border-2 border-[#c2d4cb] bg-transparent"
                  }`}
                />
              ))}
              {pin.length > 4 && (
                <div className="h-4 w-4 rounded-full bg-[#0b3d2e] scale-110 shadow-xs transition-all duration-150" />
              )}
            </div>

            {/* 3x4 Number Keypad */}
            <div className="grid grid-cols-3 gap-2.5 max-w-[260px] mx-auto pt-2">
              {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((num) => (
                <button
                  key={num}
                  type="button"
                  disabled={pinLoading}
                  onClick={() => handlePinDigit(num)}
                  className="flex h-12 items-center justify-center rounded-2xl border border-[#d8e3de] bg-[#fbfdfc] font-mono text-lg font-black text-[#0b3d2e] shadow-xs hover:bg-[#edf8f3] hover:border-emerald-400 active:scale-95 transition-all"
                >
                  {num}
                </button>
              ))}
              <button
                type="button"
                disabled={pinLoading}
                onClick={() => setPin("")}
                className="flex h-12 items-center justify-center rounded-2xl border border-[#d8e3de] bg-[#fbfdfc] font-mono text-xs font-bold text-[#637970] hover:bg-[#f0f5f2] active:scale-95 transition-all"
              >
                C
              </button>
              <button
                type="button"
                disabled={pinLoading}
                onClick={() => handlePinDigit("0")}
                className="flex h-12 items-center justify-center rounded-2xl border border-[#d8e3de] bg-[#fbfdfc] font-mono text-lg font-black text-[#0b3d2e] shadow-xs hover:bg-[#edf8f3] hover:border-emerald-400 active:scale-95 transition-all"
              >
                0
              </button>
              <button
                type="button"
                disabled={pinLoading}
                onClick={handleBackspace}
                className="flex h-12 items-center justify-center rounded-2xl border border-[#d8e3de] bg-[#fbfdfc] text-[#0b3d2e] hover:bg-[#f0f5f2] active:scale-95 transition-all"
                title="Hapus"
              >
                <Delete size={18} />
              </button>
            </div>

            {/* Submit Button */}
            <button
              type="button"
              disabled={pin.length < 4 || pinLoading}
              onClick={() => verifyPin(pin)}
              className="w-full flex items-center justify-center gap-2 rounded-2xl bg-[#c8f53a] hover:bg-[#d9ff57] py-3.5 font-mono text-xs font-black text-[#0b3d2e] shadow-sm hover:brightness-105 active:scale-98 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {pinLoading ? "Memeriksa PIN..." : "Masuk & Lanjut Absen ➔"}
            </button>
          </div>
        ) : (
          /* ================================================================
             STEP 2: ATTENDANCE SCREEN (SELFIE CAMERA + GPS VALIDATION)
             ================================================================ */
          <div className="space-y-4">
            {/* Notice Alert */}
            {notice && (
              <div
                role="status"
                className={`flex items-start gap-2.5 rounded-2xl border p-4 text-xs sm:text-sm font-bold shadow-xs animate-in fade-in-50 ${
                  notice.tone === "success"
                    ? "border-emerald-300 bg-[#edf8f3] text-[#0b3d2e]"
                    : "border-rose-300 bg-rose-50 text-rose-800"
                }`}
              >
                {notice.tone === "success" ? (
                  <CheckCircle2 size={18} className="shrink-0 mt-0.5 text-[#16a34a]" />
                ) : (
                  <ShieldAlert size={18} className="shrink-0 mt-0.5 text-rose-600" />
                )}
                <span className="leading-snug">{notice.text}</span>
              </div>
            )}

            {/* Attendance Camera Box */}
            <div
              className={`rounded-3xl p-5 sm:p-6 space-y-4 shadow-sm ${
                isMochi ? "bg-white border border-[#d8e3de]" : "bg-white border-2 border-[#232331]"
              }`}
            >
              <div className="flex items-center justify-between border-b border-[#edf3f0] pb-3">
                <div className="flex items-center gap-2">
                  <Camera size={18} className="text-[#167052]" />
                  <h3 className="text-sm font-black text-[#0b3d2e]">Foto Selfie Wajah</h3>
                </div>
                <span
                  className={`rounded-full px-2.5 py-0.5 font-mono text-[10px] font-bold ${
                    selfie
                      ? "border border-emerald-300 bg-[#edf8f3] text-[#167052]"
                      : "border border-amber-300 bg-amber-50 text-amber-800"
                  }`}
                >
                  {selfie ? "✓ Foto Siap" : "Wajib Foto"}
                </span>
              </div>

              {/* Viewport */}
              <div className="aspect-square w-full overflow-hidden rounded-2xl relative bg-[#07281e] flex items-center justify-center border-2 border-[#d8e3de]">
                {selfie ? (
                  <>
                    <img
                      src={selfie}
                      alt="Selfie"
                      className="h-full w-full object-cover"
                    />
                    <div className="absolute top-3 left-3 bg-[#0b3d2e]/90 text-[#c8f53a] font-mono text-[10px] font-extrabold px-3 py-1 rounded-full shadow-sm flex items-center gap-1.5">
                      <CheckCircle2 size={12} /> FOTO TERVERIFIKASI
                    </div>
                    <button
                      type="button"
                      onClick={retakeSelfie}
                      className="absolute top-3 right-3 bg-white text-[#0b3d2e] font-mono text-[10px] font-bold px-3 py-1 rounded-full shadow-md flex items-center gap-1 active:scale-95"
                    >
                      <RotateCcw size={11} /> Foto Ulang
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
                    <div className="absolute top-3 left-3 bg-rose-600 text-white font-mono text-[10px] font-bold px-3 py-1 rounded-full shadow-sm flex items-center gap-1.5 animate-pulse">
                      <span className="h-2 w-2 rounded-full bg-white" /> KAMERA AKTIF
                    </div>
                  </>
                ) : (
                  <div className="flex flex-col items-center justify-center p-6 text-center space-y-3">
                    <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white/10 text-emerald-300">
                      <Camera size={26} />
                    </div>
                    <div>
                      <p className="text-sm font-bold text-white">Kamera Belum Aktif</p>
                      <p className="mt-1 text-[11px] text-emerald-200/70">
                        Tekan tombol &quot;Buka Kamera&quot; di bawah untuk selfie
                      </p>
                    </div>
                  </div>
                )}
              </div>
              <canvas ref={canvas} className="hidden" />

              {/* Camera Controls */}
              <div className="grid grid-cols-2 gap-2.5">
                <button
                  type="button"
                  onClick={openCamera}
                  disabled={cameraOpen || Boolean(selfie)}
                  className="inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl border border-[#d8e3de] bg-[#f9fbf9] px-3 text-xs sm:text-sm font-bold text-[#0b3d2e] hover:bg-[#edf8f3] disabled:opacity-40 disabled:cursor-not-allowed transition-all"
                >
                  <Camera size={16} />
                  {selfie ? "Foto Terpilih ✓" : "Buka Kamera"}
                </button>

                <button
                  type="button"
                  onClick={captureSelfie}
                  disabled={!cameraOpen}
                  className="min-h-12 rounded-2xl bg-[#c8f53a] hover:bg-[#d9ff57] px-3 text-xs sm:text-sm font-black text-[#0b3d2e] shadow-xs active:scale-98 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
                >
                  Ambil Foto
                </button>
              </div>

              {/* GPS Geofence Badge */}
              <div className="pt-2 border-t border-[#edf3f0]">
                <button
                  type="button"
                  onClick={requestLocation}
                  className={`w-full flex items-center justify-between p-3 rounded-2xl text-xs font-mono font-bold transition-all border ${
                    position && isWithinRadius
                      ? "border-emerald-300 bg-[#edf8f3] text-[#0b3d2e]"
                      : position && !isWithinRadius
                      ? "border-amber-300 bg-amber-50 text-amber-900"
                      : "border-[#d8e3de] bg-[#fbfdfc] text-[#527867]"
                  }`}
                >
                  <div className="flex items-center gap-2 text-left">
                    <MapPin size={16} className="shrink-0 text-[#167052]" />
                    <div>
                      {position ? (
                        <>
                          <span className="block font-bold">
                            {isWithinRadius
                              ? "✓ Terverifikasi di Area Mochi Cafe"
                              : "⚠️ Di Luar Radius Mochi Cafe"}
                          </span>
                          <span className="text-[10px] opacity-80">
                            {gpsDistance !== null
                              ? `Jarak ke toko: ~${gpsDistance} meter (maks: 100m)`
                              : "Koordinat GPS terkunci"}
                          </span>
                        </>
                      ) : (
                        <span>Mendeteksi lokasi GPS toko...</span>
                      )}
                    </div>
                  </div>
                  <LocateFixed size={14} className="shrink-0 opacity-70" />
                </button>
              </div>
            </div>

            {/* Attendance Actions: Masuk & Pulang */}
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                disabled={submitting || !selfie || !position}
                onClick={() => submitAttendance("in")}
                className="flex min-h-14 flex-col items-center justify-center rounded-3xl bg-[#0b3d2e] text-[#c8f53a] p-3 shadow-md hover:bg-[#144f3d] active:scale-98 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
              >
                <div className="flex items-center gap-1.5 font-black text-sm sm:text-base">
                  <LogIn size={16} />
                  <span>Absen Masuk</span>
                </div>
                <span className="text-[10px] font-mono text-emerald-200/80 mt-0.5">
                  Mulai Shift
                </span>
              </button>

              <button
                type="button"
                disabled={submitting || !selfie || !position}
                onClick={() => submitAttendance("out")}
                className="flex min-h-14 flex-col items-center justify-center rounded-3xl bg-white border-2 border-rose-600 text-rose-700 p-3 shadow-sm hover:bg-rose-50 active:scale-98 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
              >
                <div className="flex items-center gap-1.5 font-black text-sm sm:text-base">
                  <LogOut size={16} />
                  <span>Absen Pulang</span>
                </div>
                <span className="text-[10px] font-mono text-rose-600/80 mt-0.5">
                  Selesai Shift
                </span>
              </button>
            </div>

            {/* Today Records Preview */}
            {records.length > 0 && (
              <div className="rounded-2xl border border-[#d8e3de] bg-white p-4 space-y-2">
                <span className="font-mono text-[10px] font-bold text-[#167052] uppercase tracking-wider block">
                  Riwayat Absensi Hari Ini
                </span>
                <div className="divide-y divide-[#edf3f0]">
                  {records.map((rec) => (
                    <div
                      key={rec.id}
                      className="py-2 flex items-center justify-between text-xs"
                    >
                      <div>
                        <span className="font-bold text-[#0b3d2e] block">
                          Masuk:{" "}
                          {rec.check_in_at
                            ? new Date(rec.check_in_at).toLocaleTimeString("id-ID", {
                                hour: "2-digit",
                                minute: "2-digit",
                              }) + " WIB"
                            : "-"}
                        </span>
                        <span className="text-[11px] text-[#527867]">
                          Pulang:{" "}
                          {rec.check_out_at
                            ? new Date(rec.check_out_at).toLocaleTimeString("id-ID", {
                                hour: "2-digit",
                                minute: "2-digit",
                              }) + " WIB"
                            : "Masih berlangsung"}
                        </span>
                      </div>
                      <span
                        className={`rounded-full px-2 py-0.5 font-mono text-[9px] font-bold ${
                          rec.check_out_at
                            ? "bg-[#edf8f3] text-[#167052]"
                            : "bg-amber-100 text-amber-800"
                        }`}
                      >
                        {rec.check_out_at ? "Selesai" : "Sedang Kerja"}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="py-4 text-center text-[11px] font-mono text-[#637970]">
        <span>KAEL System · Presensi Karyawan Mochi Cafe</span>
      </footer>
    </div>
  );
}
