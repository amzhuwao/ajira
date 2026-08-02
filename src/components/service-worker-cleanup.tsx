"use client";

import { useEffect } from "react";

/** Clears any previously registered PWA service workers and caches. */
export function ServiceWorkerCleanup() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;

    void navigator.serviceWorker.getRegistrations().then((regs) => {
      for (const reg of regs) void reg.unregister();
    });

    if ("caches" in window) {
      void caches.keys().then((keys) => {
        for (const key of keys) void caches.delete(key);
      });
    }
  }, []);

  return null;
}
