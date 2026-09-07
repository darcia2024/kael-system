"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { Camera, CheckCircle2, LocateFixed, LogIn, LogOut, MapPin, ShieldCheck } from "lucide-react";
import { recordAttendanceAction } from "@/lib/actions-operations";

type Notice = { tone: "success" | "error"; text: string } | null;

export default function AttendanceClient({ staffName, siteToken, method }: { staffName: string; siteToken: string | null; method: "self" | "qr" | "nfc" }) {
  const video = useRef<HTMLVideoElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const [selfie, setSelfie] = useState<string | null>(null);
  const [position, setPosition] = useState<{ latitude: number; longitude: number } | null>(null);
  const [cameraOpen, setCameraOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<Notice>(null);

  const openCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "user", width: { ideal: 480 }, height: { ideal: 480 } }, audio: false });
      if (!video.current) return;
      video.current.srcObject = stream;
      await video.current.play();
      setCameraOpen(true);
    } catch {
      setNotice({ tone: "error", text: "Kamera belum bisa dipakai. Izinkan akses kamera, lalu coba lagi." });
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

  const locate = () => navigator.geolocation.getCurrentPosition(
    (value) => setPosition({ latitude: value.coords.latitude, longitude: value.coords.longitude }),
    () => setNotice({ tone: "error", text: "Lokasi belum terbaca. Izinkan akses lokasi dan coba lagi." }),
    { enableHighAccuracy: true, timeout: 15_000, maximumAge: 30_000 },
  );

  const submit = async (direction: "in" | "out") => {
    if (!selfie || !position) {
      setNotice({ tone: "error", text: "Selfie dan lokasi wajib diisi sebelum absensi dikirim." });
      return;
    }
    setBusy(true);
    const result = await recordAttendanceAction({ direction, siteToken: siteToken ?? undefined, latitude: position.latitude, longitude: position.longitude, selfieUrl: selfie, method });
    setBusy(false);
    setNotice(result.ok ? { tone: "success", text: direction === "in" ? "Absensi masuk tercatat." : "Absensi pulang tercatat." } : { tone: "error", text: result.error });
  };

  const ready = Boolean(selfie && position);
  return <main className="min-h-screen bg-[#f7f6fc] p-4 text-[#232331] sm:p-8"><div className="mx-auto max-w-md space-y-4">
    <header className="rounded-2xl border-2 border-[#232331] bg-white p-5 shadow-ink-md"><p className="font-mono text-[11px] font-bold text-[#7958d8]">KAEL HR</p><h1 className="mt-1 text-2xl font-black">Absensi {staffName}</h1><p className="mt-2 text-sm leading-6 text-[#66667a]">Ambil selfie dan lokasi. Sistem akan memeriksa radius bila kamu membuka QR atau NFC titik kerja.</p></header>
    {notice && <div role="status" className={`flex gap-2 rounded-xl border p-3 text-sm font-bold ${notice.tone === "success" ? "border-[#15803d] bg-[#dcfce7] text-[#166534]" : "border-[#b91c1c] bg-[#fef2f2] text-[#b91c1c]"}`}>{notice.tone === "success" ? <CheckCircle2 size={17} /> : <ShieldCheck size={17} />}<span>{notice.text}</span></div>}
    <section className="rounded-2xl border-2 border-[#232331] bg-white p-5 shadow-ink-md"><div className="flex items-center justify-between"><h2 className="font-black">Bukti absensi</h2><span className={`rounded-full px-2 py-1 font-mono text-[10px] font-bold ${ready ? "bg-[#dcfce7] text-[#166534]" : "bg-[#fff7ed] text-[#9a3412]"}`}>{ready ? "Siap dikirim" : "Lengkapi 2 bukti"}</span></div>
      <div className="mt-4 aspect-square overflow-hidden rounded-xl bg-[#232331]">{selfie ? <img src={selfie} alt="Selfie absensi" className="h-full w-full object-cover" /> : <video ref={video} muted playsInline className="h-full w-full object-cover" />}</div><canvas ref={canvas} className="hidden" />
      <div className="mt-3 grid grid-cols-2 gap-2"><button type="button" onClick={openCamera} disabled={cameraOpen || Boolean(selfie)} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border-2 border-[#232331] bg-white px-3 text-sm font-bold disabled:opacity-50"><Camera size={16} />{selfie ? "Selfie siap" : "Buka kamera"}</button><button type="button" onClick={capture} disabled={!cameraOpen} className="min-h-11 rounded-lg border-2 border-[#232331] bg-[#d9ff57] px-3 text-sm font-bold disabled:opacity-50">Ambil selfie</button><button type="button" onClick={locate} className="col-span-2 inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border-2 border-[#232331] bg-[#f0edff] px-3 text-sm font-bold"><LocateFixed size={16} />{position ? "Lokasi siap" : "Ambil lokasi"}</button></div>
      {siteToken && <p className="mt-3 inline-flex items-center gap-1.5 text-xs text-[#166534]"><MapPin size={14} />Titik kerja terdeteksi dari {method === "nfc" ? "NFC" : "QR"}.</p>}
    </section>
    <div className="grid grid-cols-2 gap-3"><button disabled={busy || !ready} onClick={() => submit("in")} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl border-2 border-[#232331] bg-[#7958d8] px-3 font-bold text-white disabled:opacity-50"><LogIn size={17} />Masuk</button><button disabled={busy || !ready} onClick={() => submit("out")} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl border-2 border-[#232331] bg-white px-3 font-bold disabled:opacity-50"><LogOut size={17} />Pulang</button></div><Link href="/app/hr/leave" className="secondary w-full">Ajukan izin, cuti, atau lembur</Link>
  </div></main>;
}
