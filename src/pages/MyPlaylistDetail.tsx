import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ChevronLeft, Loader2, Pencil, Play, Shuffle, Trash2, X } from "lucide-react";
import { TrackItem } from "@/components/playlist/TrackItem";
import { Input } from "@/components/ui/input";
import { SEO } from "@/components/SEO";
import { toast } from "@/hooks/use-toast";
import { useMusicPlayerContext } from "@/contexts/MusicPlayerContext";
import { supabase as typedClient } from "@/integrations/supabase/client";
import { deletePlaylist, playlistSongIds, removeSongFromPlaylist, renamePlaylist } from "@/hooks/usePlaylists";
import { Track } from "@/lib/tracks";

const supabase = typedClient as any;

const MyPlaylistDetail = () => {
  const { id = "" } = useParams();
  const navigate = useNavigate();
  const { allTracks, currentTrack, isPlaying, playContext, setShuffleValue } = useMusicPlayerContext();
  const [name, setName] = useState("");
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const [songIds, setSongIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [missing, setMissing] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.from("playlists").select("id,name").eq("id", id).maybeSingle();
      if (error) throw new Error(error.message);
      if (!data) {
        setMissing(true);
        return;
      }
      setName(data.name);
      setSongIds(await playlistSongIds(id));
    } catch (e: any) {
      toast({ title: "Could not load playlist", description: e.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  const tracks = useMemo<Track[]>(() => {
    const byId = new Map(allTracks.map((t) => [t.id, t]));
    return songIds.map((sid) => byId.get(sid)).filter(Boolean) as Track[];
  }, [songIds, allTracks]);

  const play = (startIndex: number, shuffle = false) => {
    if (!tracks.length) return;
    if (shuffle) setShuffleValue(true);
    playContext({
      type: "playlist",
      id: `my:${id}`,
      tracks,
      startIndex: shuffle ? Math.floor(Math.random() * tracks.length) : startIndex,
    });
  };

  const saveName = async () => {
    const next = draft.trim();
    setEditing(false);
    if (!next || next === name) return;
    try {
      await renamePlaylist(id, next);
      setName(next);
    } catch (e: any) {
      toast({ title: "Could not rename", description: e.message, variant: "destructive" });
    }
  };

  const remove = async (track: Track) => {
    try {
      await removeSongFromPlaylist(id, track.id);
      setSongIds((s) => s.filter((x) => x !== track.id));
      toast({ title: "Removed from playlist", description: track.title });
    } catch (e: any) {
      toast({ title: "Could not remove", description: e.message, variant: "destructive" });
    }
  };

  const destroy = async () => {
    if (!window.confirm(`Delete the playlist "${name}"? The songs stay in the app.`)) return;
    try {
      await deletePlaylist(id);
      toast({ title: "Playlist deleted", description: name });
      navigate("/playlists", { replace: true });
    } catch (e: any) {
      toast({ title: "Could not delete", description: e.message, variant: "destructive" });
    }
  };

  if (loading) return <div className="min-h-screen flex items-center justify-center"><Loader2 className="animate-spin text-primary" /></div>;
  if (missing)
    return (
      <div className="min-h-screen px-6 pt-24 text-center space-y-4">
        <p className="text-muted-foreground">This playlist was not found.</p>
        <button onClick={() => navigate("/playlists")} className="text-primary underline text-sm">Back to my playlists</button>
      </div>
    );

  return (
    <div className="min-h-screen pb-40">
      <SEO title={`${name} | Sommyart Music`} description={`Your playlist ${name} on Sommyart Music.`} path={`/playlists/${id}`} />
      <div className="px-6 pt-12 pb-3 flex items-center gap-3">
        <button onClick={() => navigate("/playlists")} aria-label="Back to my playlists" className="w-10 h-10 -ml-2 flex items-center justify-center text-muted-foreground hover:text-foreground">
          <ChevronLeft size={24} />
        </button>
        <div className="flex-1 min-w-0">
          {editing ? (
            <Input
              autoFocus
              value={draft}
              maxLength={80}
              onChange={(e) => setDraft(e.target.value)}
              onBlur={saveName}
              onKeyDown={(e) => { if (e.key === "Enter") saveName(); if (e.key === "Escape") setEditing(false); }}
              aria-label="Playlist name"
            />
          ) : (
            <h1 className="text-xl font-display font-bold tracking-wider text-foreground neon-text truncate">{name}</h1>
          )}
          <p className="text-xs text-muted-foreground mt-1">{tracks.length} {tracks.length === 1 ? "song" : "songs"}</p>
        </div>
        <button onClick={() => { setDraft(name); setEditing(true); }} aria-label="Rename playlist" className="w-10 h-10 flex items-center justify-center text-muted-foreground hover:text-primary">
          <Pencil size={18} />
        </button>
        <button onClick={destroy} aria-label="Delete playlist" className="w-10 h-10 flex items-center justify-center text-muted-foreground hover:text-destructive">
          <Trash2 size={18} />
        </button>
      </div>

      <div className="px-6 pb-4 flex items-center gap-3">
        <button
          onClick={() => play(0)}
          disabled={!tracks.length}
          className="h-11 px-5 rounded-full bg-primary text-primary-foreground font-display tracking-wider text-sm flex items-center gap-2 neon-glow disabled:opacity-40"
        >
          <Play size={16} fill="currentColor" /> PLAY
        </button>
        <button
          onClick={() => play(0, true)}
          disabled={!tracks.length}
          aria-label="Shuffle play"
          className="h-11 w-11 rounded-full border border-border/50 text-muted-foreground flex items-center justify-center disabled:opacity-40 hover:text-primary hover:border-primary/50"
        >
          <Shuffle size={18} />
        </button>
      </div>

      <section className="px-4 space-y-1">
        {tracks.length === 0 ? (
          <p className="text-center text-sm text-muted-foreground py-8">
            Empty for now. Use the ⋯ menu on any song and choose "Add to playlist".
          </p>
        ) : (
          tracks.map((t, i) => {
            const active = currentTrack?.id === t.id;
            return (
              <div key={t.id} className="flex items-center gap-1">
                <div className="flex-1 min-w-0">
                  <TrackItem track={t} index={i} isActive={active} isPlaying={active && isPlaying} onPlay={() => play(i)} />
                </div>
                <button onClick={() => remove(t)} aria-label={`Remove ${t.title} from playlist`} className="w-10 h-10 shrink-0 flex items-center justify-center text-muted-foreground hover:text-destructive">
                  <X size={16} />
                </button>
              </div>
            );
          })
        )}
      </section>
    </div>
  );
};

export default MyPlaylistDetail;
