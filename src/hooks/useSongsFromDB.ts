import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Track, tracks as staticTracks, kosherTracks as staticKosherTracks } from "@/lib/tracks";

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
      const { data, error } = await supabase
        .from("songs")
        .select("*")
        .order("uploaded_at", { ascending: false });

      if (error || !data || data.length === 0) {
        setSongs(staticTracks);
        setNewestTrack(staticTracks[0] || null);
        setNewestTracks(staticTracks.slice(0, 2));
      } else {
        const mapped: Track[] = data.map((s: any) => ({
          id: s.id,
          title: s.title,
          artist: s.artist,
          audioUrl: s.audio_url,
          coverUrl: s.cover_art_url || "/images/logo.png",
          uploadedAt: s.uploaded_at,
          genre: s.genre || undefined,
          lyrics: Array.isArray(s.lyrics) ? s.lyrics : null,
        }));
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
        const newest = mapped[0] || merged[0] || null;
        setSongs(merged);
        setNewestTrack(newest);
        setNewestTracks(mapped.slice(0, 2));
      }
    } catch {
      setSongs(staticTracks);
      setNewestTrack(staticTracks[0] || null);
      setNewestTracks(staticTracks.slice(0, 2));
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

  const allSongs = [...songs, ...staticKosherTracks.filter(kt => !songs.some(s => s.id === kt.id))];

  return { songs, allSongs, kosherTracks: staticKosherTracks, loading, newestTrack, newestTracks, refetch: fetchSongs };
}
