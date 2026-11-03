import { probe, reportOffline } from "@/lib/offline/connectivity";

/**
 * Changes made without a connection, kept in IndexedDB on this device until
 * the server takes them. Only two kinds, both safe to send late or twice:
 * cut ticks (the server adds or removes a key) and photos (each carries its
 * own id, and the server keeps one copy per id). Everything else needs a
 * connection, because the server must decide it there and then.
 *
 * Items belong to the user who made them and are only sent while that user
 * is signed in here.
 */
export type CutItem = { id: string; userId: string; type: "cut"; taskId: string; key: string; done: boolean; at: number };
export type PhotoItem = {
  id: string;
  userId: string;
  type: "photo";
  workNumber: string;
  kind: "MATERIAL" | "FINISHED";
  taskId?: string;
  blob: Blob;
  at: number;
};
export type OutboxItem = CutItem | PhotoItem;
export type FlushResult = { sent: number; rejected: string[] };

const DB = "pacwoods-offline";
const STORE = "outbox";

function db(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const open = indexedDB.open(DB, 1);
    open.onupgradeneeded = () => open.result.createObjectStore(STORE, { keyPath: "id" });
    open.onsuccess = () => resolve(open.result);
    open.onerror = () => reject(open.error);
  });
}

async function run<T>(mode: IDBTransactionMode, work: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const conn = await db();
  return new Promise<T>((resolve, reject) => {
    const req = work(conn.transaction(STORE, mode).objectStore(STORE));
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  }).finally(() => conn.close());
}

const readAll = () => run<OutboxItem[]>("readonly", (s) => s.getAll() as IDBRequest<OutboxItem[]>);

// ── This user's items, as a store React can subscribe to ───────────────────

const EMPTY: OutboxItem[] = [];
let userId: string | null = null;
let items: OutboxItem[] = EMPTY;
const listeners = new Set<() => void>();

async function reload() {
  const all = userId ? await readAll().catch(() => EMPTY) : EMPTY;
  items = all.filter((i) => i.userId === userId).sort((a, b) => a.at - b.at);
  listeners.forEach((l) => l());
}

export function subscribeOutbox(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
export const outboxItems = () => items;
export const outboxItemsOnServer = () => EMPTY;

// ── Adding ──────────────────────────────────────────────────────────────────

/** Later ticks of the same cut replace earlier ones: only the last state matters. */
export async function queueCut(taskId: string, key: string, done: boolean) {
  const owner = userId;
  if (!owner) throw new Error("Not signed in.");
  await run("readwrite", (s) => s.put({ id: `cut:${taskId}:${key}`, userId: owner, type: "cut", taskId, key, done, at: Date.now() } satisfies CutItem));
  await reload();
}

/** `id` is the photo's own reference; the server keeps one copy per reference. */
export async function queuePhoto(id: string, photo: Omit<PhotoItem, "id" | "userId" | "type" | "at">) {
  const owner = userId;
  if (!owner) throw new Error("Not signed in.");
  await run("readwrite", (s) => s.put({ ...photo, id, userId: owner, type: "photo", at: Date.now() } satisfies PhotoItem));
  await reload();
}

// ── Sending ─────────────────────────────────────────────────────────────────

type Outcome = { kind: "sent" } | { kind: "rejected"; message: string } | { kind: "wait" };

async function send(item: OutboxItem): Promise<Outcome> {
  let res: Response;
  try {
    if (item.type === "cut") {
      res = await fetch("/api/production/cuts", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ taskId: item.taskId, key: item.key, done: item.done }),
      });
    } else {
      const body = new FormData();
      body.set("file", item.blob, "photo.jpg");
      body.set("workNumber", item.workNumber);
      body.set("kind", item.kind);
      body.set("clientRef", item.id);
      if (item.taskId) body.set("taskId", item.taskId);
      res = await fetch("/api/photos", { method: "POST", body });
    }
  } catch {
    reportOffline();
    return { kind: "wait" };
  }
  if (res.ok) return { kind: "sent" };
  // Signed out, or the server is struggling: keep it and try later.
  if (res.status === 401 || res.status >= 500) return { kind: "wait" };
  const error = ((await res.json().catch(() => ({}))) as { error?: string }).error;
  return { kind: "rejected", message: error ?? "The server would not take it." };
}

let flushing: Promise<FlushResult> | null = null;

/** Sends this user's items, oldest first; stops at the first one that has to wait. */
export function flushOutbox(): Promise<FlushResult> {
  flushing ??= (async () => {
    const result: FlushResult = { sent: 0, rejected: [] };
    try {
      for (const item of [...items]) {
        const outcome = await send(item);
        if (outcome.kind === "wait") break;
        await run("readwrite", (s) => s.delete(item.id));
        if (outcome.kind === "sent") result.sent++;
        else result.rejected.push(`${item.type === "cut" ? "A ticked cut" : "A photo"} could not be saved: ${outcome.message}`);
      }
    } finally {
      await reload();
      flushing = null;
    }
    return result;
  })();
  return flushing;
}

/**
 * Starts sending for the signed-in user: now, when the connection returns,
 * when the app comes back to the screen, and every 30 seconds while anything
 * is waiting. Returns a stop function.
 */
export function startOutbox(id: string, onResult: (result: FlushResult) => void) {
  userId = id;
  const flush = async () => {
    if (items.length === 0) return;
    await probe();
    const result = await flushOutbox();
    if (result.sent || result.rejected.length) onResult(result);
  };
  const onVisible = () => document.visibilityState === "visible" && flush();
  window.addEventListener("online", flush);
  document.addEventListener("visibilitychange", onVisible);
  const timer = setInterval(flush, 30_000);
  reload().then(flush);
  return () => {
    window.removeEventListener("online", flush);
    document.removeEventListener("visibilitychange", onVisible);
    clearInterval(timer);
  };
}
