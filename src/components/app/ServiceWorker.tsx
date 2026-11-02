"use client";

/**
 * Registers the service worker and keeps the page cache warm.
 *
 * The warm-up is the part that is easy to miss. Client-side navigation never
 * issues a document request, so a route reached by tapping a link is not in
 * the page cache -- and reloading it with no network would land on the offline
 * notice even though you had been looking at it a minute earlier. Fetching the
 * document once in the background, online, closes that gap for exactly the
 * routes somebody actually uses.
 *
 * Only in production: in development the cache mostly serves you yesterday's
 * bundle, and the data layer already works offline without any of this.
 */

import { useEffect } from "react";
import { usePathname } from "next/navigation";

const enabled = process.env.NODE_ENV === "production";

export function ServiceWorker() {
  const pathname = usePathname();

  useEffect(() => {
    if (!enabled || !("serviceWorker" in navigator)) return;
    // Registration failing costs offline page loads and nothing else, so it is
    // not worth surfacing.
    navigator.serviceWorker.register("/sw.js").catch(() => {});
  }, []);

  useEffect(() => {
    if (!enabled || !("serviceWorker" in navigator)) return;
    if (!navigator.serviceWorker.controller) return;
    if (!navigator.onLine) return;

    // Let the route settle first, so this never competes with the burst of
    // writes a capture session produces. Short enough that stepping outside
    // moments later still finds the page cached.
    const timer = window.setTimeout(() => {
      void fetch(window.location.href, {
        headers: { accept: "text/html" },
        credentials: "same-origin",
      }).catch(() => {});
    }, 800);

    return () => window.clearTimeout(timer);
  }, [pathname]);

  return null;
}
