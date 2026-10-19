/**
 * Offline audio resolution.
 *
 * Downloaded tracks live in the Cache API (see useOfflineDownloads). The
 * <audio> element does not read that cache by itself, so before playing we
 * look the file up and hand the element a local blob URL when we have it.
 * Result: downloaded songs play with no network at all, and instantly.
 */

import { offlineCacheKeys } from "@/lib/mediaUrl";

const CACHE_NAME = "sommyart-offline-music-v1";

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
    if (!("caches" in window)) return url;
    const cache = await caches.open(CACHE_NAME);
    let hit: Response | undefined;
    for (const key of offlineCacheKeys(url)) {
      hit = await cache.match(key);
      if (hit) break;
    }
    if (!hit || hit.type === "opaque") return url;
    const blob = await hit.blob();
    if (!blob.size) return url;
    const objectUrl = URL.createObjectURL(blob);
    blobUrls.set(full, objectUrl);
    return objectUrl;
  } catch {
    return url;
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
