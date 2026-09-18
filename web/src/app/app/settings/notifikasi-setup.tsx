"use client";

import { useEffect, useState } from "react";
import { Bell, BellOff, Check, Loader2, Smartphone } from "lucide-react";

import {
  ambilKunciPushAction,
  subscribePushAction,
  unsubscribePushAction,
} from "@/lib/actions-notifikasi";

/**
 * Menyalakan kabar langsung ke HP pemilik usaha.
 *
 * Ini lapis yang paling berpengaruh menahan refund fiktif, dan alasannya bukan
 * teknis: kasir yang tahu pemiliknya menerima pesan pada detik yang sama tidak
 * akan mencoba. Rekonsiliasi laci tidak menangkapnya sama sekali — uang
 * pelanggan masuk, dicatat keluar, lacinya tetap cocok.
 *
 * WhatsApp sengaja tidak dipakai untuk ini. Mendaftarkan nomor ke WhatsApp
 * Cloud API MENGUNCI nomor itu: sesudahnya tidak bisa lagi dibuka di aplikasi
 * WhatsApp biasa. Nomor toko dipakai melayani pelanggan tiap hari, jadi
 * menukarnya dengan satu notifikasi tidak masuk akal.
 */

type Keadaan = "memeriksa" | "tidak_didukung" | "perlu_pasang" | "mati" | "ditolak" | "nyala";

/** Kunci VAPID datang sebagai base64url; peramban memintanya sebagai byte. */
function kunciKeByte(base64url: string): Uint8Array {
  const padding = "=".repeat((4 - (base64url.length % 4)) % 4);
  const base64 = (base64url + padding).replace(/-/g, "+").replace(/_/g, "/");
  const mentah = atob(base64);
  const byte = new Uint8Array(mentah.length);
  for (let i = 0; i < mentah.length; i++) byte[i] = mentah.charCodeAt(i);
  return byte;
}

/** iPhone baru mengizinkan notifikasi kalau KAEL sudah ditambahkan ke Layar Utama. */
function terpasangKeLayarUtama(): boolean {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    (window.navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

function iniIos(): boolean {
  return /iphone|ipad|ipod/i.test(navigator.userAgent);
}

export default function NotifikasiSetup() {
  const [keadaan, setKeadaan] = useState<Keadaan>("memeriksa");
  const [busy, setBusy] = useState(false);
  const [pesan, setPesan] = useState<string | null>(null);

  useEffect(() => {
    let batal = false;

    (async () => {
      if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) {
        // iPhone yang belum dipasang ke Layar Utama memang belum punya
        // PushManager — jadi ini bukan "peramban tidak mendukung", melainkan
        // "aplikasinya belum dipasang". Bedanya penting supaya owner tidak
        // menyerah padahal tinggal satu langkah.
        if (!batal) setKeadaan(iniIos() && !terpasangKeLayarUtama() ? "perlu_pasang" : "tidak_didukung");
        return;
      }

      if (Notification.permission === "denied") {
        if (!batal) setKeadaan("ditolak");
        return;
      }

      const reg = await navigator.serviceWorker.getRegistration();
      const langganan = await reg?.pushManager.getSubscription();
      if (!batal) setKeadaan(langganan ? "nyala" : "mati");
    })().catch(() => {
      if (!batal) setKeadaan("mati");
    });

    return () => {
      batal = true;
    };
  }, []);

  const nyalakan = async () => {
    setBusy(true);
    setPesan(null);
    try {
      const izin = await Notification.requestPermission();
      if (izin !== "granted") {
        setKeadaan(izin === "denied" ? "ditolak" : "mati");
        setPesan("Izin notifikasi belum diberikan.");
        return;
      }

      const kunci = await ambilKunciPushAction();
      if (!kunci.ok) {
        setPesan(kunci.error);
        return;
      }

      /**
       * Service worker didaftarkan di sini, bukan menunggu `.ready`.
       *
       * PWA KAEL mendaftarkan service worker hanya di mode produksi, jadi
       * `navigator.serviceWorker.ready` bisa menggantung selamanya di
       * lingkungan lain — tombolnya berputar tanpa pernah berhenti, dan tidak
       * ada pesan apa pun yang menjelaskan kenapa.
       */
      const reg = await navigator.serviceWorker.register("/sw.js");

      /**
       * `.ready` tidak pernah menyerah sendiri. Selama precache sw.js memuat
       * /favicon.ico yang tidak ada, pemasangannya gagal di SETIAP perangkat
       * dan tombol ini berputar selamanya. Lima belas detik jauh melebihi
       * waktu pemasangan yang wajar; lewat dari itu owner diberi tahu.
       */
      const siap = await Promise.race([
        navigator.serviceWorker.ready.then(() => true),
        new Promise<false>((selesai) => setTimeout(() => selesai(false), 15_000)),
      ]);
      if (!siap) {
        setPesan("Layanan notifikasi di perangkat ini belum aktif. Muat ulang halaman, lalu coba lagi.");
        return;
      }

      const langgananLama = await reg.pushManager.getSubscription();
      const langganan =
        langgananLama ??
        (await reg.pushManager.subscribe({
          // Wajib true: peramban menolak langganan yang tidak menampilkan
          // apa-apa ke penggunanya.
          userVisibleOnly: true,
          applicationServerKey: kunciKeByte(kunci.data.kunci) as BufferSource,
        }));

      const hasil = await subscribePushAction(
        JSON.parse(JSON.stringify(langganan)) as {
          endpoint: string;
          keys: { p256dh: string; auth: string };
        },
        `${iniIos() ? "iPhone" : "Perangkat"} ${new Date().toLocaleDateString("id-ID")}`,
      );

      if (!hasil.ok) {
        setPesan(hasil.error);
        return;
      }

      setKeadaan("nyala");
      setPesan("Aktif. Satu notifikasi uji barusan dikirim — pastikan masuk.");
    } catch (error) {
      console.error(error);
      setPesan("Gagal menyalakan notifikasi di perangkat ini.");
    } finally {
      setBusy(false);
    }
  };

  const matikan = async () => {
    setBusy(true);
    setPesan(null);
    try {
      const reg = await navigator.serviceWorker.getRegistration();
      const langganan = await reg?.pushManager.getSubscription();
      if (langganan) {
        await unsubscribePushAction(langganan.endpoint);
        await langganan.unsubscribe();
      }
      setKeadaan("mati");
      setPesan("Perangkat ini tidak lagi menerima kabar refund.");
    } catch {
      setPesan("Gagal mencabut notifikasi.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-3">
      <p className="font-mono text-xs leading-relaxed text-[#527867]">
        Tiap kali kasir memproses pengembalian dana, HP ini berbunyi saat itu juga —
        lengkap dengan nomor nota, nominal, siapa yang memproses, dan alasannya.
        Nomor WhatsApp toko <b>tidak dipakai</b> dan tidak ikut terkunci.
      </p>

      {keadaan === "memeriksa" && (
        <p className="font-mono text-xs text-[#527867]">Memeriksa perangkat…</p>
      )}

      {keadaan === "perlu_pasang" && (
        <div className="flex items-start gap-2 rounded-2xl border border-[#d8e3de] bg-[#f4f9f7] p-3">
          <Smartphone size={16} className="mt-0.5 shrink-0 text-[#527867]" />
          <p className="text-[11.5px] leading-relaxed text-[#2f4b3f]">
            iPhone baru mengizinkan notifikasi kalau KAEL sudah dipasang ke Layar
            Utama. Buka lewat Safari, tekan tombol <b>Bagikan</b>, pilih{" "}
            <b>Tambahkan ke Layar Utama</b>, lalu buka KAEL dari ikon itu dan
            kembali ke halaman ini.
          </p>
        </div>
      )}

      {keadaan === "tidak_didukung" && (
        <p className="font-mono text-xs text-amber-800">
          Peramban ini belum mendukung notifikasi. Pakai Chrome di Android, atau
          Safari di iPhone dengan KAEL dipasang ke Layar Utama.
        </p>
      )}

      {keadaan === "ditolak" && (
        <p className="font-mono text-xs text-amber-800">
          Notifikasi diblokir untuk situs ini. Buka setelan peramban → Notifikasi →
          izinkan kaels.site, lalu muat ulang halaman ini.
        </p>
      )}

      {keadaan === "mati" && (
        <button
          type="button"
          onClick={nyalakan}
          disabled={busy}
          className="inline-flex items-center gap-2 rounded-xl bg-[#2f4b3f] px-4 py-2 font-mono text-xs font-bold text-white disabled:opacity-60"
        >
          {busy ? <Loader2 size={14} className="animate-spin" /> : <Bell size={14} />}
          Nyalakan di HP ini
        </button>
      )}

      {keadaan === "nyala" && (
        <div className="flex flex-wrap items-center gap-3">
          <span className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-50 px-3 py-2 font-mono text-xs font-bold text-emerald-800">
            <Check size={14} /> Aktif di HP ini
          </span>
          <button
            type="button"
            onClick={matikan}
            disabled={busy}
            className="inline-flex items-center gap-2 rounded-xl border border-[#d8e3de] px-3 py-2 font-mono text-xs font-bold text-[#527867] disabled:opacity-60"
          >
            {busy ? <Loader2 size={14} className="animate-spin" /> : <BellOff size={14} />}
            Matikan
          </button>
        </div>
      )}

      {pesan && <p className="font-mono text-xs text-[#2f4b3f]">{pesan}</p>}
    </div>
  );
}
