/**
 * KAEL System · Tap Counter & Cleansing Engine (KAEL Review 6.3 & 6.4)
 * 
 * Aturan pembersihan angka tap untuk dashboard:
 * 1. Tap berulang dari perangkat yang sama (ip_hash identik) dalam rentang 10 menit dihitung 1x.
 * 2. Kunjungan bot / crawler otomatis (Googlebot, WhatsApp preview, Twitterbot, curl, dll) disaring.
 * 3. Permintaan HEAD tidak ikut dihitung.
 * 4. Data mentah tetap tersimpan utuh di tabel card_taps.
 */

export interface CardTapRecord {
  id: string;
  card_id: string;
  tapped_at: string | Date;
  source: "nfc" | "qr";
  ip_hash?: string;
  user_agent?: string;
}

const KNOWN_BOT_PATTERNS = [
  /bot/i,
  /crawler/i,
  /spider/i,
  /crawling/i,
  /googlebot/i,
  /bingbot/i,
  /yahoo/i,
  /duckduckbot/i,
  /baiduspider/i,
  /yandexbot/i,
  /whatsapp/i,
  /telegrambot/i,
  /twitterbot/i,
  /facebookexternalhit/i,
  /curl/i,
  /wget/i,
  /python-requests/i,
  /headlesschrome/i,
  /lighthouse/i,
];

/**
 * Memeriksa apakah User-Agent adalah crawler / bot
 */
export function isBotUserAgent(userAgent?: string): boolean {
  if (!userAgent) return false;
  return KNOWN_BOT_PATTERNS.some((pattern) => pattern.test(userAgent));
}

/**
 * Menghitung clean taps dengan jendela deduplikasi 10 menit
 */
export function calculateCleanTaps(rawTaps: CardTapRecord[]): {
  cleanTotal: number;
  nfcCount: number;
  qrCount: number;
  filteredBotCount: number;
  filteredDuplicateCount: number;
  cleanTaps: CardTapRecord[];
} {
  if (!rawTaps || rawTaps.length === 0) {
    return {
      cleanTotal: 0,
      nfcCount: 0,
      qrCount: 0,
      filteredBotCount: 0,
      filteredDuplicateCount: 0,
      cleanTaps: [],
    };
  }

  // Sort kronologis (dari tertua ke terbaru)
  const sorted = [...rawTaps].sort(
    (a, b) => new Date(a.tapped_at).getTime() - new Date(b.tapped_at).getTime()
  );

  let filteredBotCount = 0;
  let filteredDuplicateCount = 0;
  const cleanList: CardTapRecord[] = [];
  const TEN_MINUTES_MS = 10 * 60 * 1000;

  // Lacak tap terakhir per (card_id + ip_hash)
  const lastTapMap = new Map<string, number>();

  for (const tap of sorted) {
    // 1. Filter Bot
    if (tap.user_agent && isBotUserAgent(tap.user_agent)) {
      filteredBotCount++;
      continue;
    }

    const tapTime = new Date(tap.tapped_at).getTime();
    const key = `${tap.card_id}_${tap.ip_hash || "unknown_ip"}`;
    const prevTime = lastTapMap.get(key);

    // 2. Filter tap berulang dalam 10 menit
    if (prevTime !== undefined && tapTime - prevTime < TEN_MINUTES_MS) {
      filteredDuplicateCount++;
      continue;
    }

    // Lolos pembersihan
    lastTapMap.set(key, tapTime);
    cleanList.push(tap);
  }

  let nfcCount = 0;
  let qrCount = 0;
  cleanList.forEach((t) => {
    if (t.source === "qr") qrCount++;
    else nfcCount++;
  });

  return {
    cleanTotal: cleanList.length,
    nfcCount,
    qrCount,
    filteredBotCount,
    filteredDuplicateCount,
    cleanTaps: cleanList,
  };
}

/**
 * Menghasilkan data agregasi harian 30 hari untuk visualisasi grafik
 */
export function generateDailyTapSeries(
  cleanTaps: CardTapRecord[],
  days = 30
): { date: string; displayDate: string; taps: number; nfc: number; qr: number }[] {
  const result: { date: string; displayDate: string; taps: number; nfc: number; qr: number }[] = [];
  const now = new Date();

  // Inisialisasi peta 30 hari ke belakang
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    const isoDate = `${yyyy}-${mm}-${dd}`;
    const displayDate = `${dd}/${mm}`;

    result.push({
      date: isoDate,
      displayDate,
      taps: 0,
      nfc: 0,
      qr: 0,
    });
  }

  const map = new Map(result.map((item) => [item.date, item]));

  cleanTaps.forEach((t) => {
    const tapDate = new Date(t.tapped_at);
    const yyyy = tapDate.getFullYear();
    const mm = String(tapDate.getMonth() + 1).padStart(2, "0");
    const dd = String(tapDate.getDate()).padStart(2, "0");
    const isoDate = `${yyyy}-${mm}-${dd}`;

    const entry = map.get(isoDate);
    if (entry) {
      entry.taps++;
      if (t.source === "qr") {
        entry.qr++;
      } else {
        entry.nfc++;
      }
    }
  });

  return result;
}
