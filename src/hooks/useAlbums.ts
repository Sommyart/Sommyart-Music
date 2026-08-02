import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Track } from "@/lib/tracks";

export interface Album {
  id: string;
  title: string;
  artistId: string | null;
  artistName: string;
  coverUrl: string;
  description: string | null;
  genre: string | null;
  releasedAt: string;
  trackCount?: number;
}

export interface Artist {
  id: string;
  name: string;
  bio: string | null;
  imageUrl: string;
  origin: string | null;
}

const FALLBACK_COVER = "/images/logo.png";

export function mapAlbum(a: any): Album {
  return {
    id: a.id,
    title: a.title,
    artistId: a.artist_id ?? null,
    artistName: a.artist_name,
    coverUrl: a.cover_art_url || FALLBACK_COVER,
    description: a.description ?? null,
    genre: a.genre ?? null,
    releasedAt: a.released_at,
  };
}

export function mapArtist(a: any): Artist {
  return {
    id: a.id,
    name: a.name,
    bio: a.bio ?? null,
    imageUrl: a.image_url || FALLBACK_COVER,
    origin: a.origin ?? null,
  };
}

export function mapSong(s: any): Track {
  return {
    id: s.id,
    title: s.title,
    artist: s.artist,
    audioUrl: s.audio_url,
    coverUrl: s.cover_art_url || FALLBACK_COVER,
    uploadedAt: s.uploaded_at,
    genre: s.genre || undefined,
    lyrics: Array.isArray(s.lyrics) ? s.lyrics : null,
    albumId: s.album_id ?? null,
    artistId: s.artist_id ?? null,
    trackNumber: s.track_number ?? null,
  };
}

/** All albums, newest release first, with track counts. */
export function useAlbums() {
  const [albums, setAlbums] = useState<Album[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchAlbums = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from("albums")
      .select("*, songs(id)")
      .order("released_at", { ascending: false });
    setAlbums(
      (data ?? []).map((a: any) => ({
        ...mapAlbum(a),
        trackCount: Array.isArray(a.songs) ? a.songs.length : 0,
      }))
    );
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchAlbums();
  }, [fetchAlbums]);

  return { albums, loading, refetch: fetchAlbums };
}

/** A single album with its ordered tracks and its artist profile. */
export function useAlbum(albumId?: string) {
  const [album, setAlbum] = useState<Album | null>(null);
  const [tracks, setTracks] = useState<Track[]>([]);
  const [artist, setArtist] = useState<Artist | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!albumId) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      const [{ data: albumRow }, { data: songRows }] = await Promise.all([
        supabase.from("albums").select("*").eq("id", albumId).maybeSingle(),
        supabase
          .from("songs")
          .select("*")
          .eq("album_id", albumId)
          .order("track_number", { ascending: true }),
      ]);
      if (cancelled) return;
      const mapped = albumRow ? mapAlbum(albumRow) : null;
      setAlbum(mapped);
      setTracks((songRows ?? []).map(mapSong));
      if (mapped?.artistId) {
        const { data: artistRow } = await supabase
          .from("artists")
          .select("*")
          .eq("id", mapped.artistId)
          .maybeSingle();
        if (!cancelled) setArtist(artistRow ? mapArtist(artistRow) : null);
      }
      if (!cancelled) setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [albumId]);

  return { album, tracks, artist, loading };
}

/** A single artist with their albums and songs. */
export function useArtist(artistId?: string) {
  const [artist, setArtist] = useState<Artist | null>(null);
  const [albums, setAlbums] = useState<Album[]>([]);
  const [tracks, setTracks] = useState<Track[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!artistId) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      const [{ data: artistRow }, { data: albumRows }, { data: songRows }] = await Promise.all([
        supabase.from("artists").select("*").eq("id", artistId).maybeSingle(),
        supabase
          .from("albums")
          .select("*")
          .eq("artist_id", artistId)
          .order("released_at", { ascending: false }),
        supabase
          .from("songs")
          .select("*")
          .eq("artist_id", artistId)
          .order("title", { ascending: true }),
      ]);
      if (cancelled) return;
      setArtist(artistRow ? mapArtist(artistRow) : null);
      setAlbums((albumRows ?? []).map(mapAlbum));
      setTracks((songRows ?? []).map(mapSong));
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [artistId]);

  return { artist, albums, tracks, loading };
}

/** All artists, alphabetical. */
export function useArtists() {
  const [artists, setArtists] = useState<Artist[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from("artists")
        .select("*")
        .order("name", { ascending: true });
      if (cancelled) return;
      setArtists((data ?? []).map(mapArtist));
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return { artists, loading };
}
