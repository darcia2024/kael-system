"use client";

import { useEffect, useState, useSyncExternalStore } from "react";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

let deferredPrompt: BeforeInstallPromptEvent | null = null;
const listeners = new Set<() => void>();

function notify() {
  for (const listener of listeners) {
    listener();
  }
}

export function usePwaInstall() {
  const isInstallable = useSyncExternalStore(
    (onStoreChange) => {
      listeners.add(onStoreChange);
      return () => {
        listeners.delete(onStoreChange);
      };
    },
    () => deferredPrompt !== null,
    () => false
  );

  const [isInstalled, setIsInstalled] = useState(false);

  useEffect(() => {
    // Check if already in standalone mode
    if (
      window.matchMedia("(display-mode: standalone)").matches ||
      // @ts-expect-error navigator.standalone on iOS Safari
      window.navigator.standalone === true
    ) {
      setIsInstalled(true);
    }
  }, []);

  const triggerInstall = async () => {
    if (!deferredPrompt) return false;
    /**
     * Satu event hanya boleh memanggil prompt() sekali. Dulu event yang
     * DITOLAK tetap disimpan: tombol pasangnya tetap tampil, tapi ketukan
     * berikutnya gagal diam-diam. Chrome memberi event baru di kunjungan
     * berikutnya.
     */
    const event = deferredPrompt;
    deferredPrompt = null;
    notify();
    try {
      await event.prompt();
      const choice = await event.userChoice;
      if (choice.outcome === "accepted") {
        setIsInstalled(true);
        return true;
      }
    } catch (err) {
      console.error("Error triggering PWA install:", err);
    }
    return false;
  };

  return { isInstallable, isInstalled, triggerInstall };
}

export default function PwaRegister() {
  useEffect(() => {
    if (typeof window === "undefined") return;

    // 1. Register Service Worker
    if ("serviceWorker" in navigator && process.env.NODE_ENV === "production") {
      navigator.serviceWorker
        .register("/sw.js")
        .then((reg) => {
          console.log("[PWA] Service Worker registered with scope:", reg.scope);
        })
        .catch((err) => {
          console.warn("[PWA] Service Worker registration failed:", err);
        });
    }

    // 2. Capture beforeinstallprompt event
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      deferredPrompt = e as BeforeInstallPromptEvent;
      notify();
    };

    const handleAppInstalled = () => {
      deferredPrompt = null;
      notify();
      console.log("[PWA] Application installed successfully!");
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    window.addEventListener("appinstalled", handleAppInstalled);

    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
      window.removeEventListener("appinstalled", handleAppInstalled);
    };
  }, []);

  return null;
}
