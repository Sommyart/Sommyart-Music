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
      } else {
        const mapped: Track[] = data.map((s: any) => ({
          id: s.id,
          title: s.title,
          artist: s.artist,
          audioUrl: s.audio_url,
          coverUrl: s.cover_art_url || "/images/logo.png",
          uploadedAt: s.uploaded_at,
          genre: s.genre || undefined,
        }));
        mapped.sort((a, b) => a.title.localeCompare(b.title, undefined, { sensitivity: "base" }));
        setSongs(mapped);
        setNewestTrack(mapped[0] || null);
      }
    } catch {
      setSongs(staticTracks);
      setNewestTrack(staticTracks[0] || null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSongs();
  }, [fetchSongs]);

  // Auto-refresh when browser comes back online
  useEffect(() => {
    const handleOnline = () => {
      fetchSongs();
    };
    window.addEventListener("online", handleOnline);
    return () => window.removeEventListener("online", handleOnline);
  }, [fetchSongs]);

  const allSongs = [...songs, ...staticKosherTracks.filter(kt => !songs.some(s => s.id === kt.id))];

  return { songs, allSongs, kosherTracks: staticKosherTracks, loading, newestTrack, refetch: fetchSongs };
}
