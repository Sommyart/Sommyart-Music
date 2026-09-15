import { useState, useEffect, useCallback } from "react";
import { Track } from "@/lib/tracks";
import { releasePlayableUrl, resolvePlayableUrl } from "@/lib/offlineAudio";


const CACHE_NAME = "sommyart-offline-music-v1";
const DB_NAME = "sommyart-downloads";
const STORE_NAME = "tracks";

/**
 * Opens (or creates) the IndexedDB database for storing download metadata.
 */
function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: "id" });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

/** Save track metadata to IndexedDB */
async function saveTrackMeta(track: Track & { downloadedAt: string }) {
  const db = await openDB();
  return new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    tx.objectStore(STORE_NAME).put(track);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

/** Remove track metadata from IndexedDB */
async function removeTrackMeta(id: string) {
  const db = await openDB();
  return new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    tx.objectStore(STORE_NAME).delete(id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

/** Get all downloaded track metadata */
async function getAllTrackMeta(): Promise<(Track & { downloadedAt: string })[]> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readonly");
    const req = tx.objectStore(STORE_NAME).getAll();
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

/** Check if a single track is downloaded */
async function isTrackDownloaded(id: string): Promise<boolean> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readonly");
    const req = tx.objectStore(STORE_NAME).get(id);
    req.onsuccess = () => resolve(!!req.result);
    req.onerror = () => reject(req.error);
  });
}

/**
 * Download an audio file into the Cache API (app-only, not accessible externally).
 * Reports progress via callback (0..1).
 */
async function cacheAudio(
  url: string,
  onProgress?: (loaded: number, total: number) => void,
): Promise<number> {
  const cache = await caches.open(CACHE_NAME);
  const fullUrl = url.startsWith("http") ? url : `${window.location.origin}${url}`;

  // Stream the response so we can show progress.
  const res = await fetch(fullUrl);
  if (!res.ok || !res.body) {
    // Fallback: opaque cache.add
    await cache.add(fullUrl);
    return 0;
  }
  const totalHeader = res.headers.get("Content-Length");
  const total = totalHeader ? parseInt(totalHeader, 10) : 0;
  const reader = res.body.getReader();
  const chunks: Uint8Array[] = [];
  let loaded = 0;
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    if (value) {
      chunks.push(value);
      loaded += value.byteLength;
      onProgress?.(loaded, total);
    }
  }
  const blob = new Blob(chunks as BlobPart[], {
    type: res.headers.get("Content-Type") || "audio/mpeg",
  });
  const headers = new Headers(res.headers);
  if (!headers.has("Content-Length")) headers.set("Content-Length", String(blob.size));
  await cache.put(fullUrl, new Response(blob, { headers, status: 200 }));
  return blob.size;
}


/** Remove an audio file from Cache API */
async function removeCachedAudio(url: string): Promise<void> {
  const cache = await caches.open(CACHE_NAME);
  const fullUrl = url.startsWith("http") ? url : `${window.location.origin}${url}`;
  await cache.delete(fullUrl);
}

/**
 * Hook to manage offline downloads.
 */
export interface StorageStats {
  usedBytes: number;
  quotaBytes: number;
}

export function useOfflineDownloads() {
  const [downloadedTracks, setDownloadedTracks] = useState<(Track & { downloadedAt: string })[]>([]);
  const [downloadingIds, setDownloadingIds] = useState<Set<string>>(new Set());
  const [downloadedIds, setDownloadedIds] = useState<Set<string>>(new Set());
  const [progress, setProgress] = useState<Record<string, number>>({});
  const [storage, setStorage] = useState<StorageStats>({ usedBytes: 0, quotaBytes: 0 });
  const [loading, setLoading] = useState(true);

  const refreshStorage = useCallback(async () => {
    try {
      if (navigator.storage?.estimate) {
        const est = await navigator.storage.estimate();
        setStorage({ usedBytes: est.usage ?? 0, quotaBytes: est.quota ?? 0 });
      }
    } catch { /* noop */ }
  }, []);

  const refresh = useCallback(async () => {
    try {
      const tracks = await getAllTrackMeta();
      setDownloadedTracks(tracks);
      setDownloadedIds(new Set(tracks.map((t) => t.id)));
    } catch {
      // IndexedDB not available
    } finally {
      setLoading(false);
      refreshStorage();
    }
  }, [refreshStorage]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const downloadTrack = useCallback(async (track: Track) => {
    if (downloadingIds.has(track.id)) return;
    setDownloadingIds((prev) => new Set(prev).add(track.id));
    setProgress((p) => ({ ...p, [track.id]: 0 }));
    try {
      await cacheAudio(track.audioUrl, (loaded, total) => {
        const pct = total > 0 ? loaded / total : 0;
        setProgress((p) => ({ ...p, [track.id]: pct }));
      });
      if (track.coverUrl) {
        try { await cacheAudio(track.coverUrl); } catch { /* optional */ }
      }
      await saveTrackMeta({ ...track, downloadedAt: new Date().toISOString() });
      // Warm the local playable copy so offline playback starts instantly.
      await resolvePlayableUrl(track.audioUrl);
      await refresh();

    } catch (err) {
      console.error("Download failed:", err);
    } finally {
      setDownloadingIds((prev) => {
        const next = new Set(prev);
        next.delete(track.id);
        return next;
      });
      setProgress((p) => {
        const next = { ...p };
        delete next[track.id];
        return next;
      });
    }
  }, [downloadingIds, refresh]);

  const removeDownload = useCallback(async (track: Track) => {
    try {
      releasePlayableUrl(track.audioUrl);
      await removeCachedAudio(track.audioUrl);
      await removeTrackMeta(track.id);
      await refresh();
    } catch (err) {
      console.error("Remove failed:", err);
    }
  }, [refresh]);


  const isDownloaded = useCallback((id: string) => downloadedIds.has(id), [downloadedIds]);
  const isDownloading = useCallback((id: string) => downloadingIds.has(id), [downloadingIds]);
  const getProgress = useCallback((id: string) => progress[id] ?? 0, [progress]);

  return {
    downloadedTracks,
    loading,
    downloadTrack,
    removeDownload,
    isDownloaded,
    isDownloading,
    getProgress,
    storage,
    refresh,
  };
}

