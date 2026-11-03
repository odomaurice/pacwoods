/**
 * The saved pages and photos the service worker (public/sw.js) keeps for
 * reading offline. They can hold job and client details, so signing out
 * deletes them.
 */
export async function clearSavedPages() {
  navigator.serviceWorker?.controller?.postMessage("clear-pages");
  if (typeof caches === "undefined") return;
  const keys = await caches.keys();
  await Promise.all(keys.filter((k) => k.startsWith("pacwoods-pages-") || k.startsWith("pacwoods-photos-")).map((k) => caches.delete(k)));
}
