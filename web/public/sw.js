// KAEL System - Progressive Web App Service Worker
const CACHE_VERSION = "kael-pos-v1";
const STATIC_CACHE = `${CACHE_VERSION}-static`;
const DYNAMIC_CACHE = `${CACHE_VERSION}-dynamic`;

const PRECACHE_ASSETS = [
  "/icon-192.png",
  "/icon-512.png",
  "/icon-maskable-512.png",
  "/apple-touch-icon.png",
  "/favicon.ico",
];

// Install: precache essential shell assets
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE).then((cache) => {
      return cache.addAll(PRECACHE_ASSETS);
    })
  );
  self.skipWaiting();
});

// Activate: clean up old caches
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys
          .filter((key) => key.startsWith("kael-pos-") && key !== STATIC_CACHE && key !== DYNAMIC_CACHE)
          .map((key) => caches.delete(key))
      );
    }).then(() => self.clients.claim())
  );
});

// Fetch: Strategy
self.addEventListener("fetch", (event) => {
  const { request } = event;

  // Only handle GET requests, never intercept mutations/POST/Server Actions
  if (request.method !== "GET") return;

  const url = new URL(request.url);

  // Ignore non-http(s) schemes (e.g. chrome-extension, data)
  if (!url.protocol.startsWith("http")) return;

  // Static assets: cache-first with network fallback
  if (
    url.pathname.startsWith("/_next/static/") ||
    url.pathname.startsWith("/fonts/") ||
    url.pathname.endsWith(".png") ||
    url.pathname.endsWith(".webp") ||
    url.pathname.endsWith(".jpg") ||
    url.pathname.endsWith(".svg") ||
    url.pathname.endsWith(".woff2")
  ) {
    event.respondWith(
      caches.match(request).then((cached) => {
        if (cached) return cached;
        return fetch(request).then((response) => {
          if (response && response.status === 200) {
            const clone = response.clone();
            caches.open(STATIC_CACHE).then((cache) => cache.put(request, clone));
          }
          return response;
        });
      })
    );
    return;
  }

  // HTML and dynamic routes: Network-first with cache fallback
  if (request.headers.get("accept")?.includes("text/html")) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response && response.status === 200) {
            const clone = response.clone();
            caches.open(DYNAMIC_CACHE).then((cache) => cache.put(request, clone));
          }
          return response;
        })
        .catch(() => {
          return caches.match(request).then((cached) => {
            if (cached) return cached;
            // Return cached fallback if available
            return caches.match("/app/pos");
          });
        })
    );
  }
});

/**
 * Notifikasi dorong (push).
 *
 * Dipakai untuk satu hal yang benar-benar tidak boleh terlewat: kabar
 * pengembalian dana ke pemilik usaha, pada detik yang sama kasir menekannya.
 *
 * WhatsApp sengaja tidak dipakai untuk ini. Mendaftarkan nomor ke WhatsApp
 * Cloud API MENGUNCI nomor itu — sesudahnya tidak bisa lagi dibuka di aplikasi
 * WhatsApp biasa, padahal nomor toko itu yang dipakai melayani pelanggan
 * sehari-hari. Push tidak menyentuh WhatsApp sama sekali.
 */
self.addEventListener("push", (event) => {
  // Payload rusak tidak boleh membuat notifikasinya hilang tanpa jejak:
  // lebih baik owner menerima kabar kosong lalu membuka aplikasinya sendiri.
  let isi = {};
  try {
    isi = event.data ? event.data.json() : {};
  } catch (_) {
    isi = {};
  }

  const judul = isi.judul || "KAEL";
  const opsi = {
    body: isi.pesan || "Ada kabar baru di KAEL.",
    icon: "/icon-192.png",
    badge: "/icon-192.png",
    // Notifikasi dengan tag sama saling menimpa, bukan menumpuk — supaya lima
    // refund berturut-turut tidak meninggalkan lima baris di layar kunci.
    tag: isi.tag || "kael",
    renotify: true,
    // Kabar uang keluar tidak boleh hilang sendiri sebelum dibaca.
    requireInteraction: true,
    data: { tautan: isi.tautan || "/app" },
    vibrate: [120, 60, 120],
  };

  event.waitUntil(self.registration.showNotification(judul, opsi));
});

/**
 * Menekan notifikasinya membuka halaman yang bersangkutan.
 *
 * Kalau KAEL sudah terbuka di suatu tab, tab itu yang dipakai — membuka jendela
 * kedua di HP berarti owner melihat dua aplikasi yang sama dan bingung mana
 * yang hidup.
 */
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const tautan = (event.notification.data && event.notification.data.tautan) || "/app";

  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((daftar) => {
      for (const klien of daftar) {
        if (klien.url.includes(tautan) && "focus" in klien) return klien.focus();
      }
      for (const klien of daftar) {
        if ("navigate" in klien && "focus" in klien) {
          return klien.navigate(tautan).then((k) => (k ? k.focus() : null));
        }
      }
      return self.clients.openWindow(tautan);
    })
  );
});
