import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Track, tracks as staticTracks, kosherTracks as staticKosherTracks } from "@/lib/tracks";
import { getAllTrackMeta } from "@/hooks/useOfflineDownloads";
import { mapSong, SONG_SELECT } from "@/hooks/useAlbums";

const CATALOG_KEY = "sommyart_catalog_v1";

function saveCatalog(list: Track[]) {
  try {
    localStorage.setItem(CATALOG_KEY, JSON.stringify(list));
  } catch {
    /* storage full or unavailable */
  }
}

function loadCatalog(): Track[] {
  try {
    const raw = localStorage.getItem(CATALOG_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

/**
 * Offline / error fallback: the last catalogue we saw online, plus every
 * downloaded track (so downloads are always playable), plus bundled tracks.
 */
async function offlineCatalog(): Promise<Track[]> {
  let downloaded: Track[] = [];
  try {
    downloaded = (await getAllTrackMeta()).map(({ downloadedAt, ...t }) => t as Track);
  } catch {
    /* IndexedDB unavailable */
  }
  const seen = new Set<string>();
  const out: Track[] = [];
  for (const t of [...downloaded, ...loadCatalog(), ...staticTracks]) {
    if (!t?.id || seen.has(t.id)) continue;
    seen.add(t.id);
    out.push(t);
  }
  return out.sort((a, b) => a.title.localeCompare(b.title));
}

/**
 * Fetches songs from the database, falling back to static tracks.
 * Auto-refreshes when the browser comes back online.
 */
export function useSongsFromDB() {
  const [songs, setSongs] = useState<Track[]>(staticTracks);
  const [loading, setLoading] = useState(true);
  const [newestTrack, setNewestTrack] = useState<Track | null>(null);
  const [newestTracks, setNewestTracks] = useState<Track[]>([]);

  const fetchSongs = useCallback(async () => {
    setLoading(true);
    try {
      let { data, error } = await supabase
        .from("songs")
        .select(SONG_SELECT)
        .order("title", { ascending: true })
        .abortSignal(AbortSignal.timeout(8000));
      if (error) {
        // Collaborations unavailable: still load the plain song list.
        ({ data, error } = await supabase
          .from("songs")
          .select("*")
          .order("title", { ascending: true })
          .abortSignal(AbortSignal.timeout(8000)) as any);
      }

      if (error || !data || data.length === 0) {
        const fallback = await offlineCatalog();
        setSongs(fallback);
        setNewestTrack(fallback[0] || null);
        setNewestTracks([]);
      } else {
        const mapped: Track[] = data.map((s: any) => mapSong(s));
        const seen = new Set<string>();
        const keyOf = (t: Track) =>
          `${t.title.trim().toLowerCase()}__${t.artist.trim().toLowerCase()}`;
        const merged: Track[] = [];
        for (const t of [...mapped, ...staticTracks]) {
          const k = keyOf(t);
          if (seen.has(t.id) || seen.has(k)) continue;
          seen.add(t.id);
          seen.add(k);
          merged.push(t);
        }
        merged.sort((a, b) => a.title.localeCompare(b.title));
        const newest = [...merged].sort((a, b) =>
          (b.uploadedAt || "").localeCompare(a.uploadedAt || "")
        );
        const ONE_WEEK_MS = 7 * 24 * 60 * 60 * 1000;
        const now = Date.now();
        const withinWeek = newest.filter((t) => {
          if (!t.uploadedAt) return false;
          const ts = new Date(t.uploadedAt).getTime();
          return !isNaN(ts) && now - ts <= ONE_WEEK_MS;
        });
        saveCatalog(mapped);
        setSongs(merged);
        setNewestTrack(newest[0] || merged[0] || null);
        setNewestTracks(withinWeek.slice(0, 5));
      }
    } catch {
      const fallback = await offlineCatalog();
      setSongs(fallback);
      setNewestTrack(fallback[0] || null);
      setNewestTracks([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSongs();
  }, [fetchSongs]);

  useEffect(() => {
    const handleOnline = () => {
      fetchSongs();
    };
    window.addEventListener("online", handleOnline);
    return () => window.removeEventListener("online", handleOnline);
  }, [fetchSongs]);

  const allSongs = [...songs, ...staticKosherTracks.filter(kt => !songs.some(s => s.id === kt.id))]
    .sort((a, b) => a.title.localeCompare(b.title));

  return { songs, allSongs, kosherTracks: staticKosherTracks, loading, newestTrack, newestTracks, refetch: fetchSongs };
}
