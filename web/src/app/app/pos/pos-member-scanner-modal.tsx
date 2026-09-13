"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import {
  X,
  Camera,
  QrCode,
  Search,
  UserPlus,
  RefreshCw,
  AlertCircle,
  Sparkles,
  Zap,
} from "lucide-react";
import type { CustomerDirectoryEntry } from "@/lib/types";
import { lookupMemberAction, registerCustomerByStaffAction } from "@/lib/actions";

// Web Audio API Beep helper for scan feedback
function playScanBeep() {
  try {
    const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(880, ctx.currentTime); // A5 note
    osc.frequency.exponentialRampToValueAtTime(1320, ctx.currentTime + 0.12); // E6 note
    gain.gain.setValueAtTime(0.2, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.15);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.15);
  } catch {
    // AudioContext might be blocked if no user gesture yet
  }
}

interface PosMemberScannerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectCustomer: (customer: CustomerDirectoryEntry) => void;
  isMochiPos?: boolean;
}

export default function PosMemberScannerModal({
  isOpen,
  onClose,
  onSelectCustomer,
  isMochiPos = true,
}: PosMemberScannerModalProps) {
  // Tabs: "camera" or "manual"
  const [activeMode, setActiveMode] = useState<"camera" | "manual">("camera");

  // Camera state
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [cameraFacing, setCameraFacing] = useState<"environment" | "user">("environment");
  const [isScanningActive, setIsScanningActive] = useState(false);
  const scanningRafRef = useRef<number | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);

  // Manual / Scanner Gun input
  const [queryInput, setQueryInput] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [searchResults, setSearchResults] = useState<CustomerDirectoryEntry[]>([]);
  const [detectedCustomer, setDetectedCustomer] = useState<CustomerDirectoryEntry | null>(null);

  // New member quick registration
  const [showRegisterForm, setShowRegisterForm] = useState(false);
  const [newName, setNewName] = useState("");
  const [newPhone, setNewPhone] = useState("");
  const [registering, setRegistering] = useState(false);
  const [registerError, setRegisterError] = useState<string | null>(null);

  const inputRef = useRef<HTMLInputElement | null>(null);

  // Stop camera helper
  const stopCamera = useCallback(() => {
    if (scanningRafRef.current) {
      cancelAnimationFrame(scanningRafRef.current);
      scanningRafRef.current = null;
    }
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((t) => t.stop());
      mediaStreamRef.current = null;
    }
    setIsScanningActive(false);
  }, []);

  // Handle scanned/typed text lookup
  const processQuery = useCallback(
    async (rawText: string) => {
      const clean = rawText.trim();
      if (!clean) return;

      setIsSearching(true);
      setSearchError(null);
      setSearchResults([]);
      setDetectedCustomer(null);

      try {
        const res = await lookupMemberAction(clean);
        if (!res.ok) {
          setSearchError(res.error);
          return;
        }

        if (res.data.found && res.data.customer) {
          playScanBeep();
          setDetectedCustomer(res.data.customer);
          // Auto attach immediately after brief pause for pleasant UX
          setTimeout(() => {
            onSelectCustomer(res.data.customer!);
            onClose();
          }, 600);
        } else if (res.data.matches.length > 0) {
          setSearchResults(res.data.matches);
        } else {
          setSearchError("Member tidak ditemukan. Daftarkan nomor ini?");
          setNewPhone(clean.replace(/\D/g, ""));
        }
      } catch {
        setSearchError("Gagal menghubungi server. Coba beberapa saat lagi.");
      } finally {
        setIsSearching(false);
      }
    },
    [onSelectCustomer, onClose],
  );

  // Start camera stream
  const startCamera = useCallback(async () => {
    stopCamera();
    setCameraError(null);

    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setCameraError("Kamera tidak didukung di browser ini. Silakan gunakan input manual.");
      setActiveMode("manual");
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: cameraFacing,
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
        audio: false,
      });

      mediaStreamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
        setIsScanningActive(true);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes("Permission") || msg.includes("NotAllowed")) {
        setCameraError("Izin kamera ditolak. Berikan izin di browser atau gunakan input manual.");
      } else {
        setCameraError("Gagal mengakses kamera. Gunakan input manual atau scanner fisik.");
      }
      setActiveMode("manual");
    }
  }, [cameraFacing, stopCamera]);

  // BarcodeDetector loop
  useEffect(() => {
    if (!isOpen || activeMode !== "camera" || !isScanningActive || !videoRef.current) {
      return;
    }

    // Check BarcodeDetector support
    const hasBarcodeDetector = typeof window !== "undefined" && "BarcodeDetector" in window;
    if (!hasBarcodeDetector) {
      return;
    }

    let isScanning = true;
    let detector: any = null;
    try {
      detector = new (window as any).BarcodeDetector({ formats: ["qr_code", "data_matrix"] });
    } catch {
      detector = null;
    }

    if (!detector) return;

    const detectFrame = async () => {
      if (!isScanning || !videoRef.current) return;

      try {
        if (videoRef.current.readyState >= 2) {
          const barcodes = await detector.detect(videoRef.current);
          if (barcodes && barcodes.length > 0) {
            const rawVal = barcodes[0].rawValue;
            if (rawVal) {
              isScanning = false;
              stopCamera();
              processQuery(rawVal);
              return;
            }
          }
        }
      } catch {
        // Frame detect error, continue next frame
      }

      if (isScanning) {
        scanningRafRef.current = requestAnimationFrame(detectFrame);
      }
    };

    scanningRafRef.current = requestAnimationFrame(detectFrame);

    return () => {
      isScanning = false;
      if (scanningRafRef.current) {
        cancelAnimationFrame(scanningRafRef.current);
      }
    };
  }, [isOpen, activeMode, isScanningActive, processQuery, stopCamera]);

  // Open / Close Lifecycle
  useEffect(() => {
    if (isOpen) {
      setQueryInput("");
      setSearchError(null);
      setSearchResults([]);
      setDetectedCustomer(null);
      setShowRegisterForm(false);

      if (activeMode === "camera") {
        startCamera();
      } else {
        setTimeout(() => inputRef.current?.focus(), 150);
      }
    } else {
      stopCamera();
    }

    return () => {
      stopCamera();
    };
  }, [isOpen, activeMode, startCamera, stopCamera]);

  const handleRegisterNewMember = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim() || !newPhone.trim()) {
      setRegisterError("Nama dan nomor WhatsApp wajib diisi.");
      return;
    }

    setRegistering(true);
    setRegisterError(null);
    try {
      const res = await registerCustomerByStaffAction({
        name: newName.trim(),
        phone: newPhone.trim(),
      });
      if (!res.ok) {
        setRegisterError(res.error);
        return;
      }

      playScanBeep();
      onSelectCustomer(res.data.customer);
      onClose();
    } catch {
      setRegisterError("Gagal mendaftarkan member. Periksa koneksi.");
    } finally {
      setRegistering(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-3 sm:p-4 backdrop-blur-xs animate-in fade-in-50">
      <div
        className={`w-full max-w-md rounded-3xl bg-white shadow-2xl overflow-hidden flex flex-col max-h-[92vh] animate-in zoom-in-95 ${
          isMochiPos ? "border border-emerald-900/20" : "border-2 border-[#232331]"
        }`}
      >
        {/* Header */}
        <div
          className={`flex items-center justify-between px-5 py-4 border-b ${
            isMochiPos
              ? "bg-[#0b3d2e] text-white border-emerald-800/80"
              : "bg-[#232331] text-white border-[#3b3b4f]"
          }`}
        >
          <div className="flex items-center gap-2.5">
            <div
              className={`flex h-9 w-9 items-center justify-center rounded-xl shadow-xs ${
                isMochiPos ? "bg-[#c8f53a] text-[#073829]" : "bg-[#7958d8] text-white"
              }`}
            >
              <QrCode size={20} />
            </div>
            <div>
              <h2 className="text-sm font-black tracking-tight leading-tight">
                Scan QR / Cari Member
              </h2>
              <p className="text-[11px] text-emerald-200/80 font-mono">
                KAEL Loyalty · Mochi Cafe
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors"
          >
            <X size={17} />
          </button>
        </div>

        {/* Mode Selector Tabs: Kamera vs Input Manual / Scanner Gun */}
        <div className="flex border-b border-gray-100 bg-gray-50/80 p-1.5 gap-1 text-xs font-bold">
          <button
            type="button"
            onClick={() => {
              setActiveMode("camera");
              startCamera();
            }}
            className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-xl transition-all ${
              activeMode === "camera"
                ? isMochiPos
                  ? "bg-[#0b3d2e] text-[#c8f53a] shadow-xs"
                  : "bg-[#232331] text-white shadow-xs"
                : "text-gray-600 hover:text-gray-900"
            }`}
          >
            <Camera size={14} />
            <span>Kamera Live</span>
          </button>
          <button
            type="button"
            onClick={() => {
              setActiveMode("manual");
              stopCamera();
              setTimeout(() => inputRef.current?.focus(), 150);
            }}
            className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-xl transition-all ${
              activeMode === "manual"
                ? isMochiPos
                  ? "bg-[#0b3d2e] text-[#c8f53a] shadow-xs"
                  : "bg-[#232331] text-white shadow-xs"
                : "text-gray-600 hover:text-gray-900"
            }`}
          >
            <Search size={14} />
            <span>Ketik WA / Barcode Gun</span>
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {/* CAMERA VIEW */}
          {activeMode === "camera" && (
            <div className="space-y-3">
              <div className="relative aspect-square w-full overflow-hidden rounded-2xl bg-black flex items-center justify-center">
                <video
                  ref={videoRef}
                  playsInline
                  muted
                  autoPlay
                  className="h-full w-full object-cover"
                />

                {/* Scanning Frame Overlay */}
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none p-8">
                  <div className="relative h-48 w-48 rounded-2xl border-2 border-[#c8f53a] shadow-[0_0_0_9999px_rgba(0,0,0,0.5)]">
                    {/* Corner Reticles */}
                    <span className="absolute -top-1 -left-1 h-4 w-4 border-t-4 border-l-4 border-[#c8f53a] rounded-tl-lg" />
                    <span className="absolute -top-1 -right-1 h-4 w-4 border-t-4 border-r-4 border-[#c8f53a] rounded-tr-lg" />
                    <span className="absolute -bottom-1 -left-1 h-4 w-4 border-b-4 border-l-4 border-[#c8f53a] rounded-bl-lg" />
                    <span className="absolute -bottom-1 -right-1 h-4 w-4 border-b-4 border-r-4 border-[#c8f53a] rounded-br-lg" />

                    {/* Animated Scanning Laser Line */}
                    <div className="absolute inset-x-2 h-0.5 bg-[#c8f53a] shadow-[0_0_12px_#c8f53a] animate-pulse top-1/2 -translate-y-1/2" />
                  </div>
                </div>

                {/* Flip Camera Button */}
                <button
                  type="button"
                  onClick={() => {
                    setCameraFacing((prev) => (prev === "environment" ? "user" : "environment"));
                  }}
                  className="absolute bottom-3 right-3 flex items-center gap-1.5 rounded-full bg-black/70 px-3 py-1.5 text-[11px] font-bold text-white backdrop-blur-xs hover:bg-black/90 active:scale-95 transition-transform"
                >
                  <RefreshCw size={12} />
                  <span>Balik Kamera</span>
                </button>
              </div>

              {cameraError ? (
                <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-700 flex items-start gap-2">
                  <AlertCircle size={16} className="shrink-0 mt-0.5" />
                  <span>{cameraError}</span>
                </div>
              ) : (
                <p className="text-center text-xs text-gray-500">
                  Arahkan kamera ke QR Member pelanggan (pada kartu fisik NFC atau HP pelanggan).
                </p>
              )}
            </div>
          )}

          {/* INPUT BAR (Active on both tabs, specially styled for manual/barcode gun) */}
          <div className="space-y-2">
            <label className="block text-[11px] font-bold uppercase tracking-wider text-gray-500 font-mono">
              {activeMode === "camera"
                ? "Atau Ketik / Tembak Scanner Fisik:"
                : "Nomor WhatsApp / Nama / Tembak Barcode Gun:"}
            </label>

            <div className="flex gap-2">
              <div className="relative flex-1">
                <input
                  ref={inputRef}
                  type="text"
                  value={queryInput}
                  onChange={(e) => setQueryInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      processQuery(queryInput);
                    }
                  }}
                  placeholder="Contoh: 08123456789 atau nama..."
                  className={`w-full rounded-xl border px-3.5 py-2.5 text-xs font-mono font-bold outline-none transition-all ${
                    isMochiPos
                      ? "border-[#ccd9d3] bg-[#f8faf9] text-[#0b3d2e] focus:border-[#167052] focus:bg-white"
                      : "border-gray-300 bg-white text-gray-800 focus:border-[#232331]"
                  }`}
                />
              </div>

              <button
                type="button"
                onClick={() => processQuery(queryInput)}
                disabled={isSearching || !queryInput.trim()}
                className={`rounded-xl px-4 py-2.5 text-xs font-black transition-all flex items-center gap-1.5 shrink-0 disabled:opacity-40 disabled:cursor-not-allowed ${
                  isMochiPos
                    ? "bg-[#0b3d2e] text-[#c8f53a] hover:bg-[#134938] active:scale-95"
                    : "bg-[#232331] text-white hover:bg-[#323246] active:scale-95"
                }`}
              >
                {isSearching ? (
                  <RefreshCw size={13} className="animate-spin" />
                ) : (
                  <Search size={13} />
                )}
                <span>Cari</span>
              </button>
            </div>
          </div>

          {/* SUCCESS DETECTED CARD */}
          {detectedCustomer && (
            <div className="rounded-2xl border-2 border-[#16a34a] bg-[#ecfdf5] p-3.5 flex items-center justify-between gap-3 animate-in zoom-in-95">
              <div className="flex items-center gap-3 min-w-0">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#16a34a] text-white font-extrabold text-sm">
                  ✓
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    <h3 className="truncate text-sm font-black text-[#14532d]">
                      {detectedCustomer.name}
                    </h3>
                    <span className="rounded-md bg-[#bbf7d0] px-1.5 py-0.5 text-[9px] font-black text-[#166534]">
                      MEMBER
                    </span>
                  </div>
                  <p className="text-xs font-mono text-[#166534]">
                    {detectedCustomer.phone_masked} · Saldo:{" "}
                    <strong>{detectedCustomer.balance} Pts</strong>
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => {
                  onSelectCustomer(detectedCustomer);
                  onClose();
                }}
                className="shrink-0 rounded-xl bg-[#16a34a] text-white px-3 py-1.5 text-xs font-black hover:bg-[#15803d] active:scale-95 shadow-xs"
              >
                Pasang
              </button>
            </div>
          )}

          {/* SEARCH RESULTS LIST */}
          {searchResults.length > 0 && (
            <div className="space-y-1.5">
              <p className="text-[11px] font-bold text-gray-500">
                Pilih member yang sesuai ({searchResults.length}):
              </p>
              <div className="divide-y divide-gray-100 rounded-2xl border border-gray-200 bg-white max-h-48 overflow-y-auto">
                {searchResults.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => {
                      playScanBeep();
                      onSelectCustomer(c);
                      onClose();
                    }}
                    className="w-full flex items-center justify-between p-2.5 text-left hover:bg-[#edf8f3] transition-colors"
                  >
                    <div>
                      <span className="text-xs font-black text-gray-900 block">{c.name}</span>
                      <span className="text-[10.5px] font-mono text-gray-500">
                        {c.phone_masked}
                      </span>
                    </div>
                    <div className="text-right shrink-0">
                      <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-black text-emerald-800">
                        {c.balance} Pts
                      </span>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* SEARCH ERROR / NOT FOUND PROMPT */}
          {searchError && (
            <div className="rounded-2xl border border-amber-200 bg-amber-50/80 p-3.5 text-xs text-amber-900 space-y-2">
              <div className="flex items-center gap-2">
                <AlertCircle size={15} className="text-amber-600 shrink-0" />
                <span className="font-semibold">{searchError}</span>
              </div>
              {!showRegisterForm && (
                <button
                  type="button"
                  onClick={() => setShowRegisterForm(true)}
                  className="flex items-center gap-1.5 rounded-xl bg-amber-800 text-white px-3 py-1.5 text-xs font-black hover:bg-amber-900 active:scale-95 transition-transform"
                >
                  <UserPlus size={13} />
                  <span>+ Daftarkan Sebagai Member Baru</span>
                </button>
              )}
            </div>
          )}

          {/* INLINE QUICK REGISTER NEW MEMBER FORM */}
          {showRegisterForm && (
            <form
              onSubmit={handleRegisterNewMember}
              className={`rounded-2xl border p-4 space-y-3 animate-in fade-in-50 ${
                isMochiPos
                  ? "border-emerald-700/30 bg-[#edf8f3]"
                  : "border-purple-200 bg-purple-50/50"
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-black text-[#0b3d2e] flex items-center gap-1.5">
                  <Sparkles size={14} className="text-amber-500" />
                  Daftar Member Baru Instan
                </span>
                <button
                  type="button"
                  onClick={() => setShowRegisterForm(false)}
                  className="text-gray-400 hover:text-gray-600 text-xs"
                >
                  Batal
                </button>
              </div>

              <div className="space-y-2">
                <div>
                  <label className="block text-[10px] font-bold text-gray-600">Nama Pelanggan:</label>
                  <input
                    type="text"
                    required
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    placeholder="Contoh: Kak Dinda"
                    className="w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-xs font-bold outline-none focus:border-[#167052]"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-gray-600">Nomor WhatsApp:</label>
                  <input
                    type="tel"
                    required
                    value={newPhone}
                    onChange={(e) => setNewPhone(e.target.value)}
                    placeholder="Contoh: 081234567890"
                    className="w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-xs font-mono font-bold outline-none focus:border-[#167052]"
                  />
                </div>
              </div>

              {registerError && (
                <p className="text-[11px] font-semibold text-red-600">{registerError}</p>
              )}

              <button
                type="submit"
                disabled={registering}
                className="w-full rounded-xl bg-[#0b3d2e] text-[#c8f53a] py-2.5 text-xs font-black hover:bg-[#134938] active:scale-95 transition-all shadow-xs flex items-center justify-center gap-1.5"
              >
                {registering ? (
                  <RefreshCw size={13} className="animate-spin" />
                ) : (
                  <Zap size={13} />
                )}
                <span>Simpan &amp; Pasang ke Pesanan</span>
              </button>
            </form>
          )}

          {!showRegisterForm && !detectedCustomer && searchResults.length === 0 && (
            <button
              type="button"
              onClick={() => {
                setShowRegisterForm(true);
                setNewName("");
                setNewPhone(queryInput.replace(/\D/g, ""));
              }}
              className="w-full flex items-center justify-center gap-1.5 rounded-xl border border-dashed border-gray-300 py-2.5 text-xs font-bold text-gray-600 hover:border-[#167052] hover:text-[#167052] hover:bg-[#edf8f3] transition-colors"
            >
              <UserPlus size={13} />
              <span>+ Daftarkan Member Baru</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
