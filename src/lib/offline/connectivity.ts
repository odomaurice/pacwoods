/**
 * Whether the Pacwoods server can be reached. `navigator.onLine` only knows
 * about the phone's own network (Wi-Fi with no internet still reads "online"),
 * so this also probes the server, and any failed request can report in.
 * "back" means the connection returned after a drop and the page on screen
 * may be an old copy.
 */
export type Connectivity = "online" | "offline" | "back";

let status: Connectivity = "online";
let started = false;
let timer: ReturnType<typeof setInterval> | undefined;
const listeners = new Set<() => void>();

function set(next: Connectivity) {
  if (next === status) return;
  status = next;
  // While offline, look again every 15 seconds.
  clearInterval(timer);
  if (status === "offline") timer = setInterval(probe, 15_000);
  listeners.forEach((l) => l());
}

const reachable = () => {
  if (status === "offline") set("back");
};

/** Asks the server for a tiny file the service worker never answers from its cache. */
export async function probe() {
  if (!navigator.onLine) return set("offline");
  try {
    const res = await fetch(`/manifest.webmanifest?probe=${Date.now()}`, { cache: "no-store" });
    if (res.status < 500) reachable();
    else set("offline");
  } catch {
    set("offline");
  }
}

/** A request failed for want of a connection. */
export function reportOffline() {
  set("offline");
}

/** The page has been refreshed since the connection returned. */
export function acknowledgeBack() {
  if (status === "back") set("online");
}

export function subscribeConnectivity(listener: () => void) {
  if (!started && typeof window !== "undefined") {
    started = true;
    window.addEventListener("offline", () => set("offline"));
    window.addEventListener("online", probe);
    probe();
  }
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export const connectivity = () => status;
export const connectivityOnServer = (): Connectivity => "online";
export const isOffline = () => status === "offline";
