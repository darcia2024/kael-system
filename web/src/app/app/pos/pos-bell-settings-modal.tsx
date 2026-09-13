"use client";

import { useState } from "react";
import {
  Bell,
  Volume2,
  VolumeX,
  Printer,
  MessageSquare,
  Sparkles,
  Check,
  X,
  Radio,
  ExternalLink,
  Info,
  Play,
  HelpCircle,
} from "lucide-react";
import { playCafeChime, playVoiceAnnouncement, buildPrinterBuzzerPayload } from "@/lib/pos-audio";

interface PosBellSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  isMochi?: boolean;
  soundEnabled: boolean;
  onToggleSound: (enabled: boolean) => void;
  voiceEnabled: boolean;
  onToggleVoice: (enabled: boolean) => void;
  printerBuzzerEnabled: boolean;
  onTogglePrinterBuzzer: (enabled: boolean) => void;
  staffWhatsapp: string;
  onSaveStaffWhatsapp: (phone: string) => void;
}

export default function PosBellSettingsModal({
  isOpen,
  onClose,
  isMochi = false,
  soundEnabled,
  onToggleSound,
  voiceEnabled,
  onToggleVoice,
  printerBuzzerEnabled,
  onTogglePrinterBuzzer,
  staffWhatsapp,
  onSaveStaffWhatsapp,
}: PosBellSettingsModalProps) {
  const [activeTab, setActiveTab] = useState<"audio" | "printer" | "whatsapp">("audio");
  const [waInput, setWaInput] = useState(staffWhatsapp);
  const [waSaved, setWaSaved] = useState(false);
  const [isTestingAudio, setIsTestingAudio] = useState(false);
  const [isTestingPrinter, setIsTestingPrinter] = useState(false);
  const [printerTestStatus, setPrinterTestStatus] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleTestAudio = async () => {
    setIsTestingAudio(true);
    await playCafeChime(0.5);
    if (voiceEnabled) {
      await playVoiceAnnouncement("Pesanan baru masuk, Meja 2.");
    }
    setIsTestingAudio(false);
  };

  const handleTestPrinterBuzzer = async () => {
    if (typeof navigator === "undefined" || !("bluetooth" in navigator)) {
      setPrinterTestStatus("Browser ini belum mendukung Web Bluetooth.");
      return;
    }

    setIsTestingPrinter(true);
    setPrinterTestStatus("Mencari printer Bluetooth...");

    try {
      const device = await (navigator as any).bluetooth.requestDevice({
        acceptAllDevices: true,
        optionalServices: [
          "000018f0-0000-1000-8000-00805f9b34fb",
          "e7810a71-73ae-499d-8c15-faa9aef0c3f2",
          "49535343-fe7d-4ae5-8fa9-9fafd205e455",
        ],
      });

      const server = await device.gatt?.connect();
      if (!server) throw new Error("Gagal menyambung ke Bluetooth printer.");

      const services = await server.getPrimaryServices();
      let targetChar: any = null;

      for (const service of services) {
        try {
          const chars = await service.getCharacteristics();
          for (const ch of chars) {
            if (ch.properties.write || ch.properties.writeWithoutResponse) {
              targetChar = ch;
              break;
            }
          }
        } catch {
          // coba service berikutnya
        }
        if (targetChar) break;
      }

      if (!targetChar) throw new Error("Karakteristik jalur tulis printer tidak ditemukan.");

      const payload = buildPrinterBuzzerPayload();
      if (typeof targetChar.writeValueWithoutResponse === "function") {
        await targetChar.writeValueWithoutResponse(payload);
      } else {
        await targetChar.writeValue(payload);
      }

      device.gatt?.disconnect();
      setPrinterTestStatus("✓ Sinyal buzzer & alarm RJ11 berhasil dikirim ke printer!");
    } catch (e: any) {
      console.warn("[KAEL] Test printer buzzer failed:", e);
      setPrinterTestStatus(e?.message ? `Gagal: ${e.message}` : "Gagal menguji buzzer printer.");
    } finally {
      setIsTestingPrinter(false);
    }
  };

  const handleSaveWa = () => {
    onSaveStaffWhatsapp(waInput);
    setWaSaved(true);
    setTimeout(() => setWaSaved(false), 2000);
  };

  const handleSimulateWa = () => {
    const phoneClean = waInput.replace(/[^0-9]/g, "").replace(/^0/, "62");
    const text = encodeURIComponent(
      `🔔 *PESANAN BARU MASUK!* (Contoh)\n` +
      `━━━━━━━━━━━━━━━━━━━━━━\n` +
      `📍 Layanan: Dine In (Meja 02)\n` +
      `🧾 No. Pesanan: #ORD-TEST\n` +
      `💰 Total: Rp 45.000 (QRIS)\n\n` +
      `📋 *Rincian:* \n` +
      `• 1x Mochi Waffle Choco\n` +
      `• 1x Iced Americano\n\n` +
      `👉 Buka Kasir POS: https://kaels.site/app/pos`
    );

    const url = phoneClean ? `https://wa.me/${phoneClean}?text=${text}` : `https://wa.me/?text=${text}`;
    window.open(url, "_blank");
  };

  return (
    <div className={`fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 backdrop-blur-xs ${
      isMochi ? "bg-[#07281e]/65" : "bg-[#232331]/60"
    }`}>
      <div className={`w-full max-w-lg max-h-[92vh] overflow-y-auto rounded-3xl bg-white shadow-2xl animate-in zoom-in-95 ${
        isMochi ? "border border-[#d8e3de]" : "border-2 border-[#232331]"
      }`}>
        {/* Modal Header */}
        <div className={`sticky top-0 z-10 flex items-center justify-between border-b px-5 py-3.5 bg-white ${
          isMochi ? "border-[#e0ebe5]" : "border-[#dedee8]"
        }`}>
          <div className="flex items-center gap-2.5">
            <span className={`flex h-8 w-8 items-center justify-center rounded-xl ${
              isMochi ? "bg-[#edf8f3] text-[#167052]" : "bg-[#f0edff] text-[#6d4cc4]"
            }`}>
              <Bell size={17} />
            </span>
            <div>
              <h2 className={`font-black text-sm sm:text-base ${isMochi ? "text-[#0b3d2e]" : "text-[#232331]"}`}>
                Pengaturan Bel & Notifikasi Kasir
              </h2>
              <p className="text-[11px] text-[#7b7b8e]">
                Notifikasi pesanan meja masuk saat kasir tidak standby
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className={`flex h-8 w-8 items-center justify-center rounded-xl border transition-colors ${
              isMochi
                ? "border-[#d8e3de] bg-[#f0f5f2] text-[#0b3d2e] hover:bg-[#e2ede7]"
                : "border-[#232331] bg-[#fcfcfe] shadow-ink-xs"
            }`}
          >
            <X size={16} />
          </button>
        </div>

        {/* Tab Switcher */}
        <div className="grid grid-cols-3 border-b border-[#dedee8] bg-[#f9faf9] p-1.5 gap-1 text-xs">
          <button
            type="button"
            onClick={() => setActiveTab("audio")}
            className={`flex items-center justify-center gap-1.5 rounded-xl py-2 px-1 font-bold transition-all ${
              activeTab === "audio"
                ? isMochi
                  ? "bg-[#0b3d2e] text-[#c8f53a] shadow-xs"
                  : "bg-[#232331] text-white shadow-ink-xs"
                : "text-[#627068] hover:bg-white"
            }`}
          >
            <Volume2 size={14} />
            <span>Bel Layar</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("printer")}
            className={`flex items-center justify-center gap-1.5 rounded-xl py-2 px-1 font-bold transition-all ${
              activeTab === "printer"
                ? isMochi
                  ? "bg-[#0b3d2e] text-[#c8f53a] shadow-xs"
                  : "bg-[#232331] text-white shadow-ink-xs"
                : "text-[#627068] hover:bg-white"
            }`}
          >
            <Printer size={14} />
            <span>Buzzer Printer</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("whatsapp")}
            className={`flex items-center justify-center gap-1.5 rounded-xl py-2 px-1 font-bold transition-all ${
              activeTab === "whatsapp"
                ? isMochi
                  ? "bg-[#0b3d2e] text-[#c8f53a] shadow-xs"
                  : "bg-[#232331] text-white shadow-ink-xs"
                : "text-[#627068] hover:bg-white"
            }`}
          >
            <MessageSquare size={14} />
            <span>WhatsApp</span>
          </button>
        </div>

        {/* Tab Content */}
        <div className="p-5 space-y-4">
          {/* TAB 1: AUDIO CHIME */}
          {activeTab === "audio" && (
            <div className="space-y-4">
              <div className="rounded-2xl border border-[#bbf7d0] bg-[#f0fdf4]/70 p-3.5">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <h3 className="text-xs font-black text-[#15803d]">🔔 Bel Lonceng Kafe Otomatis</h3>
                    <p className="text-[11px] text-[#166534] mt-0.5">
                      Berbunyi &quot;Ding-Dong!&quot; otomatis setiap ada pesanan QR meja masuk.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => onToggleSound(!soundEnabled)}
                    className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out ${
                      soundEnabled ? (isMochi ? "bg-[#16a34a]" : "bg-[#232331]") : "bg-gray-300"
                    }`}
                  >
                    <span
                      className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-md ring-0 transition duration-200 ease-in-out ${
                        soundEnabled ? "translate-x-5" : "translate-x-0"
                      }`}
                    />
                  </button>
                </div>
              </div>

              <div className="rounded-2xl border border-[#e0ebe5] bg-[#fcfdfe] p-3.5">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <h3 className="text-xs font-black text-[#232331]">🗣️ Panggilan Suara Pintar (Voice)</h3>
                    <p className="text-[11px] text-[#7b7b8e] mt-0.5">
                      Menyebutkan nomor meja otomatis: &quot;Pesanan baru masuk, Meja 2.&quot;
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => onToggleVoice(!voiceEnabled)}
                    className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out ${
                      voiceEnabled ? (isMochi ? "bg-[#16a34a]" : "bg-[#232331]") : "bg-gray-300"
                    }`}
                  >
                    <span
                      className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-md ring-0 transition duration-200 ease-in-out ${
                        voiceEnabled ? "translate-x-5" : "translate-x-0"
                      }`}
                    />
                  </button>
                </div>
              </div>

              {/* Action Button: Test Audio */}
              <button
                type="button"
                disabled={isTestingAudio}
                onClick={handleTestAudio}
                className={`w-full flex items-center justify-center gap-2 rounded-xl py-2.5 font-mono text-xs font-black transition-all ${
                  isMochi
                    ? "bg-[#c8f53a] text-[#073829] hover:bg-[#d9ff57] shadow-xs"
                    : "btn-tactile border-2 border-[#232331] bg-[#d9ff57] text-[#232331] shadow-ink-xs"
                }`}
              >
                <Play size={14} className={isTestingAudio ? "animate-pulse" : ""} />
                {isTestingAudio ? "Sedang Membunyikan Bel..." : "Tes Bunyi Bel Sekarang 🔔"}
              </button>

              {/* Pro Tip Box: Speaker Bluetooth */}
              <div className="flex items-start gap-2.5 rounded-2xl border border-dashed border-[#a3d9be] bg-[#edf8f3] p-3 text-xs text-[#0b3d2e]">
                <Radio size={16} className="shrink-0 mt-0.5 text-[#167052]" />
                <div className="space-y-1">
                  <p className="font-bold">Tips Agar Suara Kencang Terdengar ke Seluruh Kafe / Dapur:</p>
                  <p className="text-[11px] leading-relaxed text-[#1e5342]">
                    Sambungkan tablet atau HP kasir ke <strong>Speaker Bluetooth Kafe</strong> atau speaker mini di area counter/barista. Bel lonceng akan berbunyi nyaring di speaker utama toko setiap ada pesanan meja masuk.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: PRINTER BUZZER */}
          {activeTab === "printer" && (
            <div className="space-y-4">
              <div className="rounded-2xl border border-[#fed7aa] bg-[#fffaf5] p-3.5">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <h3 className="text-xs font-black text-[#c2410c]">🖨️ Buzzer & Alarm Port RJ11 Printer</h3>
                    <p className="text-[11px] text-[#9a3412] mt-0.5">
                      Kirim sinyal lonceng ke internal buzzer dan port RJ11 printer thermal.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => onTogglePrinterBuzzer(!printerBuzzerEnabled)}
                    className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out ${
                      printerBuzzerEnabled ? (isMochi ? "bg-[#16a34a]" : "bg-[#232331]") : "bg-gray-300"
                    }`}
                  >
                    <span
                      className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-md ring-0 transition duration-200 ease-in-out ${
                        printerBuzzerEnabled ? "translate-x-5" : "translate-x-0"
                      }`}
                    />
                  </button>
                </div>
              </div>

              {/* Test Printer Buzzer Button */}
              <button
                type="button"
                disabled={isTestingPrinter}
                onClick={handleTestPrinterBuzzer}
                className={`w-full flex items-center justify-center gap-2 rounded-xl py-2.5 font-mono text-xs font-black transition-all ${
                  isMochi
                    ? "bg-[#0b3d2e] text-[#c8f53a] hover:bg-[#167052] shadow-xs"
                    : "btn-tactile border-2 border-[#232331] bg-[#232331] text-white shadow-ink-xs"
                }`}
              >
                <Printer size={14} />
                {isTestingPrinter ? "Mengirim ke Printer..." : "Tes Buzzer Printer (Bluetooth / RJ11)"}
              </button>

              {printerTestStatus && (
                <p className="rounded-xl border border-[#dedee8] bg-gray-50 p-2.5 text-center font-mono text-[11px] text-[#232331]">
                  {printerTestStatus}
                </p>
              )}

              {/* How Hardware Buzzer Works */}
              <div className="rounded-2xl border border-[#e0ebe5] bg-[#fcfdfe] p-3.5 text-xs space-y-2 text-[#4b5563]">
                <p className="font-bold text-[#0b3d2e] flex items-center gap-1.5">
                  <HelpCircle size={14} className="text-[#167052]" />
                  Cara Memasang Bel Fisik Tambahan ke Printer:
                </p>
                <ol className="list-decimal pl-4 space-y-1.5 text-[11px] leading-relaxed">
                  <li>
                    Beli alat bernama <strong>&quot;Kitchen Bell / External Buzzer Printer Thermal&quot;</strong> di Tokopedia/Shopee (kisaran Rp40.000 – Rp80.000).
                  </li>
                  <li>
                    Colokkan kabel modul buzzer ke <strong>port RJ11</strong> (colokan kabel mirip telepon di belakang printer struk).
                  </li>
                  <li>
                    Setiap struk dicetak atau tombol tes ditekan, printer akan mengirim sinyal pulse listrik dan bel fisik akan berbunyi nyaring <em>&quot;BEEP BEEP BEEP&quot;</em> dengan lampu kelap-kelip.
                  </li>
                </ol>
              </div>
            </div>
          )}

          {/* TAB 3: WHATSAPP NOTIFICATION */}
          {activeTab === "whatsapp" && (
            <div className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-[#232331]">
                  Nomor WhatsApp Kasir / Staf Dapur (Penerima Notif):
                </label>
                <div className="flex gap-2">
                  <input
                    type="tel"
                    placeholder="Contoh: 081234567890"
                    value={waInput}
                    onChange={(e) => setWaInput(e.target.value)}
                    className="flex-1 rounded-xl border border-[#ccd9d3] bg-white px-3 py-2 font-mono text-xs focus:border-[#167052] focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={handleSaveWa}
                    className={`rounded-xl px-4 py-2 font-mono text-xs font-bold transition-all ${
                      isMochi
                        ? "bg-[#0b3d2e] text-[#c8f53a] hover:bg-[#167052]"
                        : "border-2 border-[#232331] bg-[#232331] text-white"
                    }`}
                  >
                    {waSaved ? "Tersimpan ✓" : "Simpan"}
                  </button>
                </div>
                <p className="text-[10.5px] text-[#7b7b8e]">
                  Nomor ini akan dipakai untuk tombol cepat teruskan pesanan ke WhatsApp.
                </p>
              </div>

              {/* Preview Message Box */}
              <div className="rounded-2xl border border-[#e0ebe5] bg-[#f8faf9] p-3 text-xs space-y-1.5 font-mono">
                <p className="text-[10px] font-bold uppercase text-[#7b8882]">Pratinjau Format Chat WhatsApp:</p>
                <div className="rounded-xl border border-[#d8e3de] bg-white p-3 text-[11px] text-[#1e293b] leading-relaxed">
                  <p className="font-bold text-[#15803d]">🔔 *PESANAN BARU MASUK - MOCHI CAFE*</p>
                  <p>━━━━━━━━━━━━━━━━━━━━━━</p>
                  <p>📍 Layanan: Dine In (Meja 02)</p>
                  <p>🧾 No. Pesanan: #ORD-XXXX</p>
                  <p>💰 Total: Rp 45.000 (QRIS)</p>
                  <p className="mt-1">📋 *Rincian:*</p>
                  <p>• 1x Mochi Waffle Choco</p>
                  <p>• 1x Iced Americano</p>
                  <p className="mt-1 text-[#2563eb]">👉 Cek Kasir: https://kaels.site/app/pos</p>
                </div>
              </div>

              {/* Test Send Button */}
              <button
                type="button"
                onClick={handleSimulateWa}
                className="w-full flex items-center justify-center gap-2 rounded-xl border border-[#22c55e] bg-[#f0fdf4] py-2.5 font-mono text-xs font-black text-[#15803d] hover:bg-[#dcfce7] transition-colors"
              >
                <ExternalLink size={14} />
                Tes Kirim Simulasi ke WhatsApp
              </button>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className={`flex items-center justify-end border-t px-5 py-3 bg-[#fcfcfe] ${
          isMochi ? "border-[#e0ebe5]" : "border-[#dedee8]"
        }`}>
          <button
            type="button"
            onClick={onClose}
            className={`rounded-xl px-4 py-2 font-mono text-xs font-bold transition-all ${
              isMochi
                ? "bg-[#0b3d2e] text-[#c8f53a] hover:bg-[#167052]"
                : "border-2 border-[#232331] bg-[#232331] text-white"
            }`}
          >
            Selesai & Simpan
          </button>
        </div>
      </div>
    </div>
  );
}
