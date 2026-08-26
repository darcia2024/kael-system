"use client";

import { useState, use, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { 
  KeyRound, 
  MapPin, 
  CheckCircle2, 
  Search, 
  ArrowRight, 
  ArrowLeft, 
  Sparkles, 
  ShieldCheck, 
  AlertCircle, 
  Building2, 
  ExternalLink,
  Store,
  Nfc
} from "lucide-react";
import { db } from "@/lib/db";
import { searchPlaces, buildGoogleReviewUrl, GooglePlaceResult, SAMPLE_INDONESIAN_PLACES } from "@/lib/google-places";
import { formatCardCodeDisplay, normalizeCardCode } from "@/lib/card-code";

export default function CardActivationPage({ params }: { params: Promise<{ code: string }> }) {
  const router = useRouter();
  const resolvedParams = use(params);
  const cardCode = normalizeCardCode(resolvedParams.code);

  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);
  const [pin, setPin] = useState<string>("");
  const [pinError, setPinError] = useState<string>("");
  const [label, setLabel] = useState<string>("Meja Kasir");

  // Google Places search
  const [searchQuery, setSearchQuery] = useState<string>("Senja Coffee");
  const [searchResults, setSearchResults] = useState<GooglePlaceResult[]>(SAMPLE_INDONESIAN_PLACES);
  const [selectedPlace, setSelectedPlace] = useState<GooglePlaceResult | null>(SAMPLE_INDONESIAN_PLACES[0]);
  const [customPlaceId, setCustomPlaceId] = useState<string>("");
  const [isManualInput, setIsManualInput] = useState<boolean>(false);
  const [isActivating, setIsActivating] = useState<boolean>(false);
  const [activationSuccess, setActivationSuccess] = useState<boolean>(false);

  // Cari places saat search query berubah
  useEffect(() => {
    if (searchQuery.trim().length >= 2) {
      searchPlaces(searchQuery).then((results) => {
        setSearchResults(results);
      });
    }
  }, [searchQuery]);

  // Handle Step 1: PIN Validation
  const handleVerifyPin = () => {
    setPinError("");
    if (pin.length !== 6) {
      setPinError("Masukkan 6 digit PIN aktivasi dari kemasan kartu Anda.");
      return;
    }

    const card = db.getCardByCode(cardCode);
    if (!card) {
      setPinError(`Kartu ${cardCode} tidak ditemukan di sistem KAEL.`);
      return;
    }

    if (card.status === "active") {
      setPinError("Kartu ini sudah aktif sebelumnya.");
      return;
    }

    // Step 1 lolos
    setStep(2);
  };

  // Handle Final Activation
  const handleConfirmActivation = () => {
    setIsActivating(true);
    const placeIdToUse = isManualInput && customPlaceId ? customPlaceId.trim() : selectedPlace?.placeId;

    if (!placeIdToUse) {
      alert("Pilih lokasi Google Maps bisnis Anda terlebih dahulu.");
      setIsActivating(false);
      return;
    }

    const destinationUrl = buildGoogleReviewUrl(placeIdToUse);
    const business = db.getBusiness();
    const businessId = business ? business.id : "b0000000-0000-0000-0000-000000000001";

    const res = db.activateCard(cardCode, pin, businessId, destinationUrl, label);

    setTimeout(() => {
      setIsActivating(false);
      if (res.success) {
        setActivationSuccess(true);
        setStep(4);
      } else {
        alert(res.error || "Gagal mengaktifkan kartu.");
      }
    }, 600);
  };

  return (
    <div className="min-h-screen bg-[#f7f6fc] text-[#232331] flex flex-col font-sans">
      
      {/* Top Header */}
      <header className="border-b-2 border-[#232331] bg-white py-4 px-4 sm:px-8">
        <div className="mx-auto max-w-4xl flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-[#7958d8] text-white font-black text-xs">
              K
            </span>
            <span className="font-extrabold text-sm tracking-tight text-[#232331]">
              KAEL Review · Aktivasi Kartu
            </span>
          </div>
          <div className="flex items-center gap-1 font-mono text-xs text-[#7b7b8e]">
            <span>Card ID:</span>
            <span className="font-bold text-[#7958d8] bg-[#f0edff] px-2 py-0.5 rounded-md">
              {formatCardCodeDisplay(cardCode)}
            </span>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="flex-1 flex items-center justify-center p-4 sm:p-6">
        <div className="w-full max-w-xl rounded-3xl border-2 border-[#232331] bg-white p-6 sm:p-8 shadow-ink-lg space-y-6">
          
          {/* Progress Steps */}
          <div className="grid grid-cols-3 gap-2 border-b border-[#dedee8] pb-4 font-mono text-xs">
            <div className={`flex items-center gap-1.5 ${step >= 1 ? "text-[#7958d8] font-bold" : "text-[#dedee8]"}`}>
              <span className={`flex h-5 w-5 items-center justify-center rounded-full text-[10px] ${step >= 1 ? "bg-[#7958d8] text-white" : "bg-[#dedee8] text-[#7b7b8e]"}`}>1</span>
              <span>PIN Kemasan</span>
            </div>
            <div className={`flex items-center gap-1.5 ${step >= 2 ? "text-[#7958d8] font-bold" : "text-[#7b7b8e]"}`}>
              <span className={`flex h-5 w-5 items-center justify-center rounded-full text-[10px] ${step >= 2 ? "bg-[#7958d8] text-white" : "bg-[#dedee8] text-[#7b7b8e]"}`}>2</span>
              <span>Pilih Toko</span>
            </div>
            <div className={`flex items-center gap-1.5 ${step >= 3 ? "text-[#7958d8] font-bold" : "text-[#7b7b8e]"}`}>
              <span className={`flex h-5 w-5 items-center justify-center rounded-full text-[10px] ${step >= 3 ? "bg-[#7958d8] text-white" : "bg-[#dedee8] text-[#7b7b8e]"}`}>3</span>
              <span>Konfirmasi</span>
            </div>
          </div>

          {/* ========================================================= */}
          {/* STEP 1: PIN INPUT */}
          {/* ========================================================= */}
          {step === 1 && (
            <div className="space-y-5">
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl border-2 border-[#232331] bg-[#f0edff] text-[#7958d8] shadow-ink-xs">
                  <KeyRound size={24} />
                </div>
                <div>
                  <h2 className="text-lg sm:text-xl font-extrabold text-[#232331]">
                    Masukkan PIN Aktivasi
                  </h2>
                  <p className="text-xs text-[#7b7b8e]">
                    PIN 6-digit tertera pada kemasan atau kartu fisik KAEL Review Anda.
                  </p>
                </div>
              </div>

              {/* Security Alert */}
              <div className="rounded-2xl border border-[#dedee8] bg-[#fcfcfe] p-4 text-xs text-[#7b7b8e] flex items-start gap-2.5">
                <ShieldCheck size={18} className="text-[#16a34a] shrink-0 mt-0.5" />
                <p>
                  Sistem proteksi PIN memastikan kartu baru hanya dapat diaktifkan oleh pemilik resmi setelah paket fisik diterima.
                </p>
              </div>

              {/* PIN Input Form */}
              <div className="space-y-2">
                <label className="block font-mono text-xs font-bold uppercase text-[#232331]">
                  6-Digit Activation PIN:
                </label>
                <input
                  type="password"
                  maxLength={6}
                  value={pin}
                  onChange={(e) => {
                    setPin(e.target.value.replace(/[^0-9]/g, ""));
                    setPinError("");
                  }}
                  placeholder="Contoh: 882341 atau 123456"
                  className="w-full rounded-2xl border-2 border-[#232331] p-3.5 text-center font-mono text-xl font-extrabold tracking-widest text-[#232331] focus:outline-none focus:ring-2 focus:ring-[#7958d8]"
                  autoFocus
                />
                {pinError && (
                  <p className="text-xs font-bold text-[#ef4444] flex items-center gap-1 mt-1">
                    <AlertCircle size={13} />
                    <span>{pinError}</span>
                  </p>
                )}
              </div>

              {/* Sample PIN Hint for Testing */}
              <div className="rounded-xl border border-dashed border-[#7958d8]/40 bg-[#f0edff]/50 p-3 text-[11px] font-mono text-[#7958d8] flex justify-between items-center">
                <span>Hint PIN Demo untuk {cardCode}:</span>
                <span className="font-extrabold bg-white px-2 py-0.5 rounded border border-[#7958d8]">
                  {cardCode === "KAEL9901" ? "123456" : cardCode === "KAEL9902" ? "789012" : "882341"}
                </span>
              </div>

              <button
                type="button"
                onClick={handleVerifyPin}
                className="btn-tactile flex w-full items-center justify-center gap-2 rounded-2xl border-2 border-[#232331] bg-[#7958d8] py-3.5 text-sm font-extrabold text-white shadow-ink-md"
              >
                <span>Verifikasi PIN &amp; Lanjut</span>
                <ArrowRight size={16} />
              </button>
            </div>
          )}

          {/* ========================================================= */}
          {/* STEP 2: GOOGLE PLACE SELECTION */}
          {/* ========================================================= */}
          {step === 2 && (
            <div className="space-y-5">
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl border-2 border-[#232331] bg-[#dcfce7] text-[#16a34a] shadow-ink-xs">
                  <MapPin size={24} />
                </div>
                <div>
                  <h2 className="text-lg sm:text-xl font-extrabold text-[#232331]">
                    Pilih Lokasi Google Maps Usaha Anda
                  </h2>
                  <p className="text-xs text-[#7b7b8e]">
                    KAEL secara otomatis mengunci form ulasan resmi Google Place ID tanpa perlu salin link manual.
                  </p>
                </div>
              </div>

              {/* Search Box */}
              {!isManualInput ? (
                <div className="space-y-3">
                  <div className="relative">
                    <Search className="absolute left-3.5 top-3.5 text-[#7b7b8e]" size={16} />
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="Ketik nama cafe / toko / usaha Anda..."
                      className="w-full rounded-2xl border-2 border-[#232331] pl-10 pr-4 py-3 text-xs sm:text-sm font-bold text-[#232331] focus:outline-none focus:ring-2 focus:ring-[#7958d8]"
                    />
                  </div>

                  {/* Results List */}
                  <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                    {searchResults.map((place) => {
                      const isSelected = selectedPlace?.placeId === place.placeId;
                      return (
                        <div
                          key={place.placeId}
                          onClick={() => setSelectedPlace(place)}
                          className={`cursor-pointer rounded-2xl border-2 p-3 transition-all ${
                            isSelected
                              ? "border-[#7958d8] bg-[#f0edff] shadow-ink-xs"
                              : "border-[#dedee8] bg-white hover:border-[#232331]"
                          }`}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="space-y-0.5">
                              <h4 className="font-extrabold text-xs sm:text-sm text-[#232331]">
                                {place.name}
                              </h4>
                              <p className="text-[11px] text-[#7b7b8e] line-clamp-1">
                                {place.address}
                              </p>
                            </div>
                            {isSelected && (
                              <CheckCircle2 size={18} className="text-[#7958d8] shrink-0" />
                            )}
                          </div>
                          <div className="mt-2 flex items-center gap-2 font-mono text-[10px]">
                            <span className="text-[#f59e0b] font-bold">★ {place.rating || "5.0"}</span>
                            <span className="text-[#7b7b8e]">Place ID: {place.placeId.slice(0, 12)}...</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  <div className="text-right">
                    <button
                      type="button"
                      onClick={() => setIsManualInput(true)}
                      className="text-[11px] font-mono text-[#7958d8] hover:underline font-bold"
                    >
                      Punya Place ID Manual? Klik di sini
                    </button>
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  <label className="block font-mono text-xs font-bold uppercase text-[#232331]">
                    Input Google Place ID Manual:
                  </label>
                  <input
                    type="text"
                    value={customPlaceId}
                    onChange={(e) => setCustomPlaceId(e.target.value)}
                    placeholder="Contoh: ChIJb_e9q17vaS4RH958L031Q2A"
                    className="w-full rounded-2xl border-2 border-[#232331] p-3 text-xs font-mono font-bold text-[#232331] focus:outline-none"
                  />
                  <div className="text-right">
                    <button
                      type="button"
                      onClick={() => setIsManualInput(false)}
                      className="text-[11px] font-mono text-[#7958d8] hover:underline font-bold"
                    >
                      Kembali ke pencarian nama toko
                    </button>
                  </div>
                </div>
              )}

              {/* Label Kartu */}
              <div className="space-y-1.5 border-t border-[#dedee8] pt-3">
                <label className="block font-mono text-xs font-bold text-[#232331]">
                  Beri Label Kartu Ini (Misal: Meja Kasir, Meja 04, Standee Outdoor):
                </label>
                <input
                  type="text"
                  value={label}
                  onChange={(e) => setLabel(e.target.value)}
                  placeholder="Contoh: Meja Kasir Utama"
                  className="w-full rounded-xl border border-[#232331] p-2.5 text-xs font-bold text-[#232331] focus:outline-none"
                />
              </div>

              {/* Actions */}
              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setStep(1)}
                  className="btn-tactile flex-1 rounded-2xl border-2 border-[#232331] bg-white py-3 text-xs font-extrabold text-[#232331]"
                >
                  Kembali
                </button>
                <button
                  type="button"
                  onClick={() => setStep(3)}
                  disabled={!selectedPlace && !customPlaceId}
                  className="btn-tactile flex-[2] rounded-2xl border-2 border-[#232331] bg-[#7958d8] py-3 text-xs font-extrabold text-white shadow-ink-md disabled:opacity-50"
                >
                  Pratinjau &amp; Lanjut
                </button>
              </div>
            </div>
          )}

          {/* ========================================================= */}
          {/* STEP 3: PREVIEW & CONFIRMATION */}
          {/* ========================================================= */}
          {step === 3 && (
            <div className="space-y-5">
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl border-2 border-[#232331] bg-[#ffedd5] text-[#c2410c] shadow-ink-xs">
                  <Sparkles size={24} />
                </div>
                <div>
                  <h2 className="text-lg sm:text-xl font-extrabold text-[#232331]">
                    Pratinjau Aktivasi Kartu
                  </h2>
                  <p className="text-xs text-[#7b7b8e]">
                    Pastikan informasi tujuan Google Review sudah sesuai sebelum mengunci kartu.
                  </p>
                </div>
              </div>

              {/* Preview Card */}
              <div className="rounded-3xl border-2 border-[#232331] bg-[#fcfcfe] p-5 space-y-3 font-mono text-xs shadow-ink-xs">
                <div className="flex items-center justify-between border-b border-[#dedee8] pb-2">
                  <span className="text-[#7b7b8e]">KODE KARTU FISIK:</span>
                  <span className="font-extrabold text-[#7958d8]">{cardCode}</span>
                </div>
                <div className="flex items-center justify-between border-b border-[#dedee8] pb-2">
                  <span className="text-[#7b7b8e]">LABEL PENEMPATAN:</span>
                  <span className="font-extrabold text-[#232331]">{label}</span>
                </div>
                <div className="space-y-1 border-b border-[#dedee8] pb-2">
                  <span className="text-[#7b7b8e] block">TUJUAN GOOGLE MAPS:</span>
                  <p className="font-sans text-sm font-extrabold text-[#232331]">
                    {selectedPlace?.name || customPlaceId}
                  </p>
                  <p className="font-sans text-xs text-[#7b7b8e]">
                    {selectedPlace?.address}
                  </p>
                </div>
                <div className="space-y-1">
                  <span className="text-[#7b7b8e] block">GENERATED DIRECT REVIEW URL:</span>
                  <p className="text-[10.5px] text-[#16a34a] break-all bg-white p-2 rounded-lg border border-[#dedee8]">
                    {buildGoogleReviewUrl(selectedPlace?.placeId || customPlaceId)}
                  </p>
                </div>
              </div>

              {/* Actions */}
              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setStep(2)}
                  className="btn-tactile flex-1 rounded-2xl border-2 border-[#232331] bg-white py-3.5 text-xs font-extrabold text-[#232331]"
                >
                  Ubah Data
                </button>
                <button
                  type="button"
                  onClick={handleConfirmActivation}
                  disabled={isActivating}
                  className="btn-tactile flex-[2] rounded-2xl border-2 border-[#232331] bg-[#16a34a] py-3.5 text-xs font-extrabold text-white shadow-ink-md"
                >
                  {isActivating ? "Mengaktifkan..." : "Aktifkan Kartu Sekarang ✓"}
                </button>
              </div>
            </div>
          )}

          {/* ========================================================= */}
          {/* STEP 4: SUCCESS CONGRATULATIONS */}
          {/* ========================================================= */}
          {step === 4 && (
            <div className="text-center space-y-5 py-4">
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-3xl border-2 border-[#232331] bg-[#dcfce7] text-[#16a34a] shadow-ink-md">
                <CheckCircle2 size={36} />
              </div>
              <div className="space-y-1">
                <h2 className="text-2xl font-black text-[#232331]">
                  Kartu Berhasil Diaktifkan!
                </h2>
                <p className="text-xs sm:text-sm text-[#7b7b8e] max-w-md mx-auto">
                  Kartu NFC &amp; QR <span className="font-mono font-bold text-[#7958d8]">{cardCode}</span> kini aktif mengarah langsung ke form ulasan Google bisnis Anda.
                </p>
              </div>

              <div className="rounded-2xl border-2 border-[#232331] bg-[#f0edff] p-4 text-xs font-mono space-y-2 text-left">
                <div className="flex justify-between">
                  <span className="text-[#7b7b8e]">Status Kartu:</span>
                  <span className="font-extrabold text-[#16a34a]">ACTIVE (Siap Pakai)</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#7b7b8e]">Redirect URL:</span>
                  <span className="font-bold text-[#232331]">https://r.kael.id/{cardCode}</span>
                </div>
              </div>

              <div className="pt-3 flex flex-col sm:flex-row gap-3">
                <Link
                  href={`/r/${cardCode}`}
                  target="_blank"
                  className="btn-tactile flex-1 flex items-center justify-center gap-1.5 rounded-2xl border-2 border-[#232331] bg-white py-3 text-xs font-extrabold text-[#232331] shadow-ink-xs"
                >
                  <ExternalLink size={14} />
                  <span>Uji Coba Tap (302)</span>
                </Link>
                <Link
                  href="/app/review"
                  className="btn-tactile flex-1 flex items-center justify-center gap-1.5 rounded-2xl border-2 border-[#232331] bg-[#232331] py-3 text-xs font-extrabold text-[#d9ff57] shadow-ink-md"
                >
                  <span>Buka Dashboard Review</span>
                  <ArrowRight size={14} />
                </Link>
              </div>
            </div>
          )}

        </div>
      </main>

      <footer className="border-t border-[#dedee8] bg-white py-3 text-center text-xs font-mono text-[#7b7b8e]">
        KAEL Digital System · Standee &amp; Smart Card Activation Engine
      </footer>
    </div>
  );
}
