/**
 * KAEL — service worker.
 *
 * Sengaja kecil: halaman "tidak ada koneksi" untuk perpindahan halaman yang
 * gagal, dan notifikasi dorong untuk pemilik usaha. Tidak ada HTML yang
 * disimpan.
 *
 * Versi sebelumnya tidak pernah aktif di satu perangkat pun. Daftar precache-
 * nya memuat /favicon.ico — berkas yang tidak pernah ada — dan cache.addAll()
 * menggagalkan SELURUH pemasangan begitu satu berkas 404. Peramban membuang
 * service worker itu diam-diam: "installing", lalu "redundant". Akibatnya:
 *
 * - Tombol "Nyalakan notifikasi" di Pengaturan berputar selamanya, karena
 *   `navigator.serviceWorker.ready` menunggu service worker yang tidak akan
 *   pernah aktif. Kabar refund ke HP owner tidak pernah bisa dinyalakan.
 * - Menaikkan versi cache tidak berpengaruh apa-apa: cache-nya memang tidak
 *   pernah dipakai.
 *
 * Maka aturannya di sini: tidak ada satu berkas pun yang boleh menggagalkan
 * pemasangan.
 *
 * HTML sengaja tidak disimpan. Versi lama menyimpan setiap halaman yang dibuka
 * — termasuk dasbor owner berisi omzet — lalu menyajikannya lagi saat jaringan
 * putus: kasir di tablet yang sama bisa melihat angka owner, dan layar kasir
 * yang sudah basi tampak masih bekerja padahal setiap tombolnya gagal. Untuk
 * aplikasi yang isinya uang, halaman "tidak ada koneksi" yang jujur lebih aman.
 */

const CACHE = "kael-pos-v4";
const HALAMAN_OFFLINE = "/offline.html";

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => cache.add(HALAMAN_OFFLINE))
      // Halaman offline yang gagal disimpan cuma berarti peramban menampilkan
      // layar galatnya sendiri — jauh lebih ringan daripada kehilangan
      // notifikasi. Pemasangan tetap diteruskan.
      .catch(() => undefined)
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      // Sisa versi lama: kael-pos-v1, -v2, -v3, masing-masing -static/-dynamic.
      const semua = await caches.keys();
      await Promise.all(
        semua
          .filter((nama) => nama.startsWith("kael-") && nama !== CACHE)
          .map((nama) => caches.delete(nama))
      );
      // Permintaan halaman berangkat bersamaan dengan service worker bangun,
      // bukan menunggunya, supaya membuka halaman tidak jadi lebih lambat.
      if (self.registration.navigationPreload) {
        await self.registration.navigationPreload.enable();
      }
      await self.clients.claim();
    })()
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;

  // Hanya perpindahan halaman. Gambar, skrip, data, dan Server Action lewat
  // apa adanya tanpa disentuh.
  if (request.mode !== "navigate" || request.method !== "GET") return;

  event.respondWith(
    (async () => {
      try {
        const dimuatDulu = await event.preloadResponse;
        if (dimuatDulu) return dimuatDulu;
        return await fetch(request);
      } catch (_) {
        return (await caches.match(HALAMAN_OFFLINE)) || Response.error();
      }
    })()
  );
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
    // Kabar ini untuk pemilik usaha mana pun, jadi ikonnya ikon KAEL Owner.
    icon: "/owner/icon-192.png",
    // Android menggambar badge di bilah status sebagai siluet satu warna;
    // ikon berwarna penuh berubah jadi kotak putih polos.
    badge: "/owner/badge-96.png",
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
