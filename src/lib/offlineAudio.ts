/**
 * Offline audio resolution.
 *
 * Downloaded tracks live in the Cache API (see useOfflineDownloads). The
 * <audio> element does not read that cache by itself, so before playing we
 * look the file up and hand the element a local blob URL when we have it.
 * Result: downloaded songs play with no network at all, and instantly.
 */

const CACHE_NAME = "sommyart-offline-music-v1";
/** Songs kept automatically after you listen to them (separate from the Downloads you choose). */
const AUTO_CACHE_NAME = "sommyart-auto-music-v1";
/** How many automatically kept songs to hold; the oldest are dropped first. */
export const AUTO_CACHE_MAX = 150;
/** Resolved blob URLs held in memory at once; older ones are released and re-resolved when needed. */
const MAX_BLOB_URLS = 6;

/** Remote URL -> object URL for an already-resolved cached file. */
const blobUrls = new Map<string, string>();

function absolute(url: string): string {
  return url.startsWith("http") ? url : `${window.location.origin}${url}`;
}

/**
 * Returns a locally playable URL for `url` when the track is downloaded,
 * otherwise the original URL (streaming path).
 */
export async function resolvePlayableUrl(url: string): Promise<string> {
  if (!url || url.startsWith("blob:")) return url;
  const full = absolute(url);
  const existing = blobUrls.get(full);
  if (existing) return existing;
  try {
    const hit = await findCachedAudio(full);
    if (!hit) return url;
    const blob = await hit.blob();
    if (!blob.size) return url;
    const objectUrl = URL.createObjectURL(blob);
    blobUrls.set(full, objectUrl);
    // Keep memory in check: release the oldest resolved copies (the song playing now is always the newest).
    while (blobUrls.size > MAX_BLOB_URLS) {
      const oldest = blobUrls.keys().next().value as string;
      URL.revokeObjectURL(blobUrls.get(oldest)!);
      blobUrls.delete(oldest);
    }
    return objectUrl;
  } catch {
    return url;
  }
}

/** The saved copy of a song, from the Downloads or from the automatic cache, or null. */
async function findCachedAudio(full: string): Promise<Response | null> {
  if (typeof window === "undefined" || !("caches" in window)) return null;
  for (const name of [CACHE_NAME, AUTO_CACHE_NAME]) {
    const cache = await caches.open(name);
    const hit = await cache.match(full);
    if (hit && hit.type !== "opaque") return hit;
  }
  return null;
}

/** The first bytes of a saved song, so cover art can be read without downloading anything. */
export async function readCachedAudioHead(url: string, bytes: number): Promise<ArrayBuffer | null> {
  try {
    const hit = await findCachedAudio(absolute(url));
    if (!hit) return null;
    return await (await hit.blob()).slice(0, bytes).arrayBuffer();
  } catch {
    return null;
  }
}

const inFlight = new Set<string>();

/**
 * Keeps a copy of a song from the cloud so playing it again uses no data. Does nothing for songs that
 * ship inside the app, songs already saved, or when offline or Data Saver is on.
 */
export async function autoCacheTrack(url: string): Promise<boolean> {
  try {
    if (!url || url.startsWith("blob:") || typeof window === "undefined" || !("caches" in window)) return false;
    if (typeof navigator !== "undefined" && navigator.onLine === false) return false;
    if ((navigator as any).connection?.saveData) return false;
    const full = absolute(url);
    if (new URL(full).origin === window.location.origin) return false; // bundled with the app already
    if (inFlight.has(full)) return false;
    if (await findCachedAudio(full)) return false;
    inFlight.add(full);
    try {
      const res = await fetch(full, { mode: "cors", credentials: "omit" });
      if (!res.ok || res.status !== 200 || res.type === "opaque") return false;
      const cache = await caches.open(AUTO_CACHE_NAME);
      await cache.put(full, res);
      const keys = await cache.keys();
      for (let i = 0; i < keys.length - AUTO_CACHE_MAX; i++) await cache.delete(keys[i]);
      return true;
    } finally {
      inFlight.delete(full);
    }
  } catch {
    return false; // storage full or network trouble: keep streaming as before
  }
}

/** Synchronous lookup for a URL resolved earlier in this session. */
export function cachedPlayableUrl(url: string): string | null {
  return blobUrls.get(absolute(url)) ?? null;
}

/** Drop a resolved blob URL (used when a download is removed). */
export function releasePlayableUrl(url: string): void {
  const full = absolute(url);
  const objectUrl = blobUrls.get(full);
  if (objectUrl) {
    URL.revokeObjectURL(objectUrl);
    blobUrls.delete(full);
  }
}
