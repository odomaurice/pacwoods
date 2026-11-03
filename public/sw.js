/*
 * Pacwoods service worker: keeps the pages people open, so they can still be
 * read when the connection drops. It never handles changes (POSTs, Server
 * Actions); those go to the network, and the app's outbox
 * (src/lib/offline/outbox.ts) keeps cut ticks and photos until it is back.
 *
 * Saved pages can hold job and client details, so they are deleted on sign
 * out (the app posts "clear-pages") and whenever a page bounces to sign-in.
 */
const VERSION = "v1";
const STATIC = `pacwoods-static-${VERSION}`;
const PAGES = `pacwoods-pages-${VERSION}`;
const PHOTOS = `pacwoods-photos-${VERSION}`;
const OFFLINE_URL = "/offline";

// The offline page and the build files it loads, so it can start with no connection.
async function saveOfflinePage() {
  const cache = await caches.open(STATIC);
  const response = await fetch(new Request(OFFLINE_URL, { cache: "reload" }));
  const html = await response.clone().text();
  await cache.put(OFFLINE_URL, response);
  const assets = [...new Set(html.match(/\/_next\/static\/[^"'\s)\\]+/g) ?? [])];
  await Promise.all(assets.map((path) => cache.add(path).catch(() => {})));
}

self.addEventListener("install", (event) => {
  event.waitUntil(saveOfflinePage().then(() => self.skipWaiting()));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith("pacwoods-") && ![STATIC, PAGES, PHOTOS].includes(k)).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("message", (event) => {
  if (event.data === "clear-pages") event.waitUntil(clearPrivate());
});

function clearPrivate() {
  return Promise.all([caches.delete(PAGES), caches.delete(PHOTOS)]);
}

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // Pages: the network first; the saved copy only when it cannot be reached.
  if (request.mode === "navigate") {
    event.respondWith(page(event));
    return;
  }
  // Build files are content-hashed and never change: the saved copy first.
  if (url.pathname.startsWith("/_next/static/") || url.pathname.startsWith("/icons/")) {
    event.respondWith(cacheFirst(STATIC, request));
    return;
  }
  // A photo's bytes never change for its id.
  if (url.pathname.startsWith("/api/photos/")) {
    event.respondWith(cacheFirst(PHOTOS, request));
  }
  // Everything else (RSC data, auth, exports) goes straight to the network.
});

async function page(event) {
  const request = event.request;
  try {
    const response = await fetch(request);
    const landed = new URL(response.url || request.url);
    if (landed.pathname === "/login" && new URL(request.url).pathname !== "/login") {
      // Signed out or the session ended: nothing private stays on the device.
      event.waitUntil(clearPrivate());
    } else if (response.ok && !response.redirected) {
      const copy = response.clone();
      event.waitUntil(caches.open(PAGES).then((cache) => cache.put(request.url, copy)));
    }
    return response;
  } catch {
    const saved = await caches.match(request.url, { cacheName: PAGES });
    if (saved) return saved;
    const url = new URL(request.url);
    if (url.pathname === OFFLINE_URL) return (await caches.match(OFFLINE_URL, { cacheName: STATIC, ignoreSearch: true })) ?? Response.error();
    // Redirect rather than answer with /offline here: the app's router needs
    // the address to match the page it is showing.
    return Response.redirect(`${OFFLINE_URL}?from=${encodeURIComponent(url.pathname + url.search)}`, 302);
  }
}

async function cacheFirst(name, request) {
  const saved = await caches.match(request, { cacheName: name });
  if (saved) return saved;
  const response = await fetch(request);
  if (response.ok) {
    const copy = response.clone();
    caches.open(name).then((cache) => cache.put(request, copy));
  }
  return response;
}
