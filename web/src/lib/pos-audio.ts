/**
 * Modul Audio & Notifikasi Suara POS KAEL
 *
 * Menggunakan Web Audio API untuk mensintesis nada bel lonceng kafe yang jernih,
 * nyaring, dan tanpa bergantung pada file audio eksternal (.mp3).
 * Juga mendukung Voice Announcement (Web Speech API) dalam Bahasa Indonesia
 * dan perintah hardware buzzer printer ESC/POS (port RJ11).
 */

let sharedAudioContext: AudioContext | null = null;

function getAudioContext(): AudioContext | null {
  if (typeof window === "undefined") return null;
  const AudioCtx =
    window.AudioContext ||
    (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
  if (!AudioCtx) return null;

  if (!sharedAudioContext || sharedAudioContext.state === "closed") {
    try {
      sharedAudioContext = new AudioCtx();
    } catch {
      return null;
    }
  }

  if (sharedAudioContext.state === "suspended") {
    sharedAudioContext.resume().catch(() => {});
  }

  return sharedAudioContext;
}

/**
 * Memutar nada lonceng kafe "Ding-Dong!" 2-nada harmonik yang nyaring & elegan.
 */
export function playCafeChime(volume = 0.4): Promise<void> {
  return new Promise((resolve) => {
    const ctx = getAudioContext();
    if (!ctx) return resolve();

    try {
      const now = ctx.currentTime;

      // Note 1: High crisp chime (G5 - 783.99 Hz + harmonik 1568 Hz)
      playChimeNote(ctx, 783.99, now, 0.45, volume);
      playChimeNote(ctx, 1567.98, now, 0.35, volume * 0.35);

      // Note 2: Deep warm resolve (E5 - 659.25 Hz + harmonik) setelah jeda 0.18s
      playChimeNote(ctx, 659.25, now + 0.18, 0.75, volume * 1.15);
      playChimeNote(ctx, 1318.5, now + 0.18, 0.5, volume * 0.4);

      setTimeout(resolve, 900);
    } catch (e) {
      console.warn("[KAEL] Gagal memutar bel audio:", e);
      resolve();
    }
  });
}

/**
 * Memainkan satu nada bel dengan envelope decay lonceng alami
 */
function playChimeNote(
  ctx: AudioContext,
  freq: number,
  startTime: number,
  duration: number,
  targetVolume: number
) {
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();

  osc.type = "sine";
  osc.frequency.setValueAtTime(freq, startTime);

  // Envelope: Fast attack (<10ms) -> Exponential decay
  gain.gain.setValueAtTime(0.0001, startTime);
  gain.gain.exponentialRampToValueAtTime(Math.max(0.001, targetVolume), startTime + 0.015);
  gain.gain.exponentialRampToValueAtTime(0.0001, startTime + duration);

  osc.connect(gain);
  gain.connect(ctx.destination);

  osc.start(startTime);
  osc.stop(startTime + duration + 0.05);
}

/**
 * Mengucapkan teks pesanan dalam Bahasa Indonesia menggunakan Web Speech Synthesis.
 * Contoh: "Pesanan baru masuk, Meja 2"
 */
export function playVoiceAnnouncement(text: string): Promise<void> {
  return new Promise((resolve) => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) {
      return resolve();
    }

    try {
      window.speechSynthesis.cancel(); // batalkan ucapan sebelumnya jika ada
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = "id-ID";
      utterance.pitch = 1.05;
      utterance.rate = 1.0;
      utterance.volume = 1.0;

      // Coba cari suara bahasa Indonesia jika tersedia di OS
      const voices = window.speechSynthesis.getVoices();
      const idVoice = voices.find((v) => v.lang.startsWith("id") || v.lang === "id-ID");
      if (idVoice) utterance.voice = idVoice;

      utterance.onend = () => resolve();
      utterance.onerror = () => resolve();

      window.speechSynthesis.speak(utterance);
    } catch {
      resolve();
    }
  });
}

/**
 * Memainkan bel lonceng kafe diikuti panggilan suara pintar.
 */
export async function alertNewIncomingOrder(options: {
  tableNo?: string | null;
  total?: number;
  withVoice?: boolean;
}) {
  await playCafeChime(0.5);

  if (options.withVoice) {
    const mejaStr = options.tableNo ? `Meja ${options.tableNo}` : "pesanan baru";
    const text = `Pesanan baru masuk, ${mejaStr}.`;
    await playVoiceAnnouncement(text);
  }
}

/**
 * Bel dan panggilan suara saat tamu menekan "panggil pelayan" dari meja.
 *
 * Kalimatnya sengaja menyebut nomor mejanya di depan, bukan di belakang:
 * kasir yang sedang melayani antrean cuma menangkap sepotong kalimat, dan yang
 * harus tertangkap lebih dulu adalah MEJA MANA — bukan bahwa ada panggilan.
 */
export async function alertTableCall(options: {
  tableNo: string;
  withVoice?: boolean;
}) {
  /**
   * Dibunyikan DUA kali, bukan sekali.
   *
   * Sekali bunyi gampang tertelan suara kafe yang ramai, atau lewat begitu saja
   * saat kasir sedang menunduk menghitung uang. Yang kedua yang menangkapnya —
   * dan sesudah itu berhenti, karena bunyi yang terus-menerus justru membuat
   * orang belajar mengabaikannya.
   */
  for (let ke = 0; ke < 2; ke++) {
    await playCafeChime(0.6);

    if (options.withVoice) {
      await playVoiceAnnouncement(`Meja ${options.tableNo} sudah siap memesan.`);
    }

    // Jeda pendek di antara keduanya supaya terdengar sebagai dua panggilan,
    // bukan satu bunyi panjang yang menggema.
    if (ke === 0) await new Promise((r) => setTimeout(r, 600));
  }
}

/**
 * Payload biner ESC/POS untuk membunyikan alarm fisik / kitchen buzzer printer
 * yang terhubung ke port RJ11 atau internal buzzer printer thermal.
 */
export function buildPrinterBuzzerPayload(): Uint8Array {
  // 0x1B 0x40 = ESC @ (Inisialisasi printer)
  // 0x1B 0x42 0x03 0x02 = ESC B 3 2 (Buzzer beep 3 kali durasi 200ms)
  // 0x1B 0x70 0x00 0x19 0xFA = ESC p 0 25 250 (Pulse pin 2 port RJ11 untuk kitchen buzzer box)
  // 0x1B 0x70 0x01 0x19 0xFA = ESC p 1 25 250 (Pulse pin 5 port RJ11)
  // 0x07 = ASCII BEL (Karakter lonceng)
  return new Uint8Array([
    0x1b, 0x40,
    0x1b, 0x42, 0x03, 0x02,
    0x1b, 0x70, 0x00, 0x19, 0xfa,
    0x1b, 0x70, 0x01, 0x19, 0xfa,
    0x07,
  ]);
}
