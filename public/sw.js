/*
 * Service worker.
 *
 * Hand-written rather than generated. The usual reason to reach for a build
 * plugin is precaching a manifest of hashed assets, and this app does not need
 * that: the data already lives in IndexedDB, so the only job here is making
 * the app *shell* survive a cold open with no network. Next's asset URLs are
 * content-hashed, which makes a plain runtime cache sufficient — and it avoids
 * coupling to the bundler, which matters because the Next plugin for this does
 * not support Turbopack.
 *
 * Strategies, by what the request is:
 *
 *   /api/*          never cached. Auth and sync must always see the network,
 *                   and a cached 401 or a stale pull cursor would be poison.
 *   documents       network first, falling back to the cached page and then to
 *                   the offline notice. Network first because songs change and
 *                   a stale shell is confusing.
 *   hashed assets   cache first. The URL changes when the content does, so a
 *                   hit is always correct and never needs revalidating.
 *   everything else stale-while-revalidate. This is what covers Next's RSC
 *                   payloads, so a route visited once can be navigated to
 *                   again with no network.
 *
 * Pages are keyed by URL string rather than by Request, and matched with
 * `ignoreVary`. Next varies its responses on RSC headers, so a document cached
 * from one kind of request would otherwise never match another — which is
 * exactly the case that matters here, where a page warmed by a background
 * fetch has to satisfy a later reload.
 */

const VERSION = "v1";
const PAGES = `stablature-pages-${VERSION}`;
const ASSETS = `stablature-assets-${VERSION}`;
const OFFLINE_URL = "/offline";

const CURRENT = new Set([PAGES, ASSETS]);

self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(PAGES);
      // The offline notice has to be there before it is ever needed.
      await cache.add(OFFLINE_URL);
      // Take over straight away; a worker that waits for every tab to close
      // means a fix does not arrive until the phone is restarted.
      await self.skipWaiting();
    })(),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const names = await caches.keys();
      await Promise.all(
        names
          .filter((name) => name.startsWith("stablature-") && !CURRENT.has(name))
          .map((name) => caches.delete(name)),
      );
      await self.clients.claim();
    })(),
  );
});

/** Content-hashed, so a cached copy can never be wrong. */
function isImmutable(url) {
  return url.pathname.startsWith("/_next/static/") || url.pathname.startsWith("/icons/");
}

/**
 * True for real navigations and for the background warm-up the app performs
 * after a client-side route change.
 *
 * The warm-up is why this checks Accept as well as mode: a client-side
 * navigation never issues a document request, so without it a reload of any
 * route reached by tapping a link would find nothing cached.
 */
function isPageRequest(request) {
  if (request.mode === "navigate") return true;
  return (request.headers.get("accept") ?? "").includes("text/html");
}

/** Cache key for a page: path and query only, so headers cannot fragment it. */
function pageKey(url) {
  return url.pathname + url.search;
}

async function networkFirstPage(request, url) {
  const cache = await caches.open(PAGES);
  const key = pageKey(url);

  try {
    const response = await fetch(request);
    if (response.ok && response.type === "basic") {
      await cache.put(key, response.clone());
    }
    return response;
  } catch {
    const cached = await cache.match(key, { ignoreVary: true });
    if (cached) return cached;

    // A page never opened on this device has nothing to fall back to; say so
    // rather than failing with a browser error page.
    const offline = await cache.match(OFFLINE_URL, { ignoreVary: true });
    if (offline) return offline;

    return new Response("Offline", {
      status: 503,
      headers: { "content-type": "text/plain; charset=utf-8" },
    });
  }
}

async function cacheFirst(request) {
  const cache = await caches.open(ASSETS);
  const cached = await cache.match(request, { ignoreVary: true });
  if (cached) return cached;

  const response = await fetch(request);
  if (response.ok) await cache.put(request, response.clone());
  return response;
}

async function staleWhileRevalidate(request) {
  const cache = await caches.open(ASSETS);
  const cached = await cache.match(request, { ignoreVary: true });

  const network = fetch(request)
    .then(async (response) => {
      if (response.ok && response.type === "basic") {
        await cache.put(request, response.clone());
      }
      return response;
    })
    .catch(() => undefined);

  if (cached) {
    // Refresh in the background; the caller gets the cached copy now.
    network.catch(() => {});
    return cached;
  }

  const response = await network;
  if (response) return response;
  throw new Error("offline and not cached");
}

self.addEventListener("fetch", (event) => {
  const { request } = event;

  // Only plain GETs are cacheable, and only our own origin.
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // Sync, auth and the event stream must always reach the server.
  if (url.pathname.startsWith("/api/")) return;

  if (isPageRequest(request)) {
    event.respondWith(networkFirstPage(request, url));
    return;
  }

  if (isImmutable(url)) {
    event.respondWith(cacheFirst(request));
    return;
  }

  event.respondWith(
    staleWhileRevalidate(request).catch(
      () => new Response("", { status: 504, statusText: "Offline" }),
    ),
  );
});
