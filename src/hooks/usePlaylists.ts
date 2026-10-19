import { useCallback, useEffect, useState } from "react";
import { supabase as typedClient } from "@/integrations/supabase/client";

// The generated types do not include the playlist tables yet.
const supabase = typedClient as any;

export type PlaylistRow = { id: string; name: string; created_at: string; count: number };

export async function currentUserId(): Promise<string | null> {
  const { data } = await supabase.auth.getSession();
  return data.session?.user.id ?? null;
}

export async function fetchPlaylists(): Promise<PlaylistRow[]> {
  const { data, error } = await supabase
    .from("playlists")
    .select("id,name,created_at,playlist_songs(count)")
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []).map((p: any) => ({
    id: p.id,
    name: p.name,
    created_at: p.created_at,
    count: p.playlist_songs?.[0]?.count ?? 0,
  }));
}

export async function createPlaylist(name: string): Promise<PlaylistRow> {
  const uid = await currentUserId();
  if (!uid) throw new Error("Sign in to create playlists");
  const clean = name.trim().slice(0, 80);
  if (!clean) throw new Error("Give the playlist a name");
  const { data, error } = await supabase
    .from("playlists")
    .insert({ user_id: uid, name: clean })
    .select("id,name,created_at")
    .single();
  if (error) throw new Error(error.message);
  return { ...data, count: 0 };
}

export async function renamePlaylist(id: string, name: string) {
  const clean = name.trim().slice(0, 80);
  if (!clean) throw new Error("Give the playlist a name");
  const { error } = await supabase
    .from("playlists")
    .update({ name: clean, updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw new Error(error.message);
}

export async function deletePlaylist(id: string) {
  const { error } = await supabase.from("playlists").delete().eq("id", id);
  if (error) throw new Error(error.message);
}

/** Song ids in a playlist, in the order they were arranged. */
export async function playlistSongIds(playlistId: string): Promise<string[]> {
  const { data, error } = await supabase
    .from("playlist_songs")
    .select("song_id,position,added_at")
    .eq("playlist_id", playlistId)
    .order("position", { ascending: true })
    .order("added_at", { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []).map((r: any) => r.song_id);
}

/** Which of the user's playlists already contain this song. */
export async function playlistsContaining(songId: string): Promise<Set<string>> {
  const { data, error } = await supabase.from("playlist_songs").select("playlist_id").eq("song_id", songId);
  if (error) throw new Error(error.message);
  return new Set((data ?? []).map((r: any) => r.playlist_id));
}

export async function addSongToPlaylist(playlistId: string, songId: string) {
  const { data: last } = await supabase
    .from("playlist_songs")
    .select("position")
    .eq("playlist_id", playlistId)
    .order("position", { ascending: false })
    .limit(1);
  const position = (last?.[0]?.position ?? -1) + 1;
  const { error } = await supabase
    .from("playlist_songs")
    .insert({ playlist_id: playlistId, song_id: songId, position });
  // 23505 = already in the playlist; that is fine.
  if (error && error.code !== "23505") throw new Error(error.message);
}

export async function removeSongFromPlaylist(playlistId: string, songId: string) {
  const { error } = await supabase
    .from("playlist_songs")
    .delete()
    .eq("playlist_id", playlistId)
    .eq("song_id", songId);
  if (error) throw new Error(error.message);
}

/** Playlists list with simple create/delete helpers. */
export function usePlaylists() {
  const [playlists, setPlaylists] = useState<PlaylistRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [signedIn, setSignedIn] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const uid = await currentUserId();
      setSignedIn(!!uid);
      setPlaylists(uid ? await fetchPlaylists() : []);
      setError(null);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { playlists, loading, signedIn, error, refresh };
}
