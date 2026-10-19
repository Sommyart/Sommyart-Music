import { createContext, ReactNode, useCallback, useContext, useEffect, useState } from "react";
import { Check, ListPlus, Loader2, Plus } from "lucide-react";
import { Link } from "react-router-dom";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { toast } from "@/hooks/use-toast";
import { Track } from "@/lib/tracks";
import {
  addSongToPlaylist, createPlaylist, currentUserId, fetchPlaylists, playlistsContaining,
  removeSongFromPlaylist, PlaylistRow,
} from "@/hooks/usePlaylists";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type Ctx = { openPlaylistPicker: (track: Track) => void };
const PlaylistPickerContext = createContext<Ctx | null>(null);

export function usePlaylistPicker() {
  const ctx = useContext(PlaylistPickerContext);
  if (!ctx) throw new Error("usePlaylistPicker must be inside PlaylistPickerProvider");
  return ctx;
}

/** One shared "Add to playlist" dialog that any screen can open for a song. */
export function PlaylistPickerProvider({ children }: { children: ReactNode }) {
  const [track, setTrack] = useState<Track | null>(null);
  const [lists, setLists] = useState<PlaylistRow[]>([]);
  const [member, setMember] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [signedIn, setSignedIn] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [creating, setCreating] = useState(false);

  const openPlaylistPicker = useCallback((t: Track) => {
    if (!UUID_RE.test(t.id)) {
      toast({ title: "Can't add this song to a playlist", description: "It is built into the app and has no library entry yet." });
      return;
    }
    setTrack(t);
  }, []);

  useEffect(() => {
    if (!track) return;
    let cancelled = false;
    setLoading(true);
    setName("");
    (async () => {
      try {
        const uid = await currentUserId();
        if (cancelled) return;
        setSignedIn(!!uid);
        if (!uid) return;
        const [all, has] = await Promise.all([fetchPlaylists(), playlistsContaining(track.id)]);
        if (cancelled) return;
        setLists(all);
        setMember(has);
      } catch (e: any) {
        toast({ title: "Could not load playlists", description: e.message, variant: "destructive" });
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [track?.id]);

  const toggle = async (p: PlaylistRow) => {
    if (!track || busyId) return;
    setBusyId(p.id);
    const has = member.has(p.id);
    try {
      if (has) await removeSongFromPlaylist(p.id, track.id);
      else await addSongToPlaylist(p.id, track.id);
      setMember((m) => {
        const n = new Set(m);
        if (has) n.delete(p.id);
        else n.add(p.id);
        return n;
      });
      setLists((l) => l.map((x) => (x.id === p.id ? { ...x, count: Math.max(0, x.count + (has ? -1 : 1)) } : x)));
      toast({ title: has ? `Removed from ${p.name}` : `Added to ${p.name}`, description: track.title });
    } catch (e: any) {
      toast({ title: "Could not update playlist", description: e.message, variant: "destructive" });
    } finally {
      setBusyId(null);
    }
  };

  const create = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!track || !name.trim() || creating) return;
    setCreating(true);
    try {
      const p = await createPlaylist(name);
      await addSongToPlaylist(p.id, track.id);
      setLists((l) => [{ ...p, count: 1 }, ...l]);
      setMember((m) => new Set(m).add(p.id));
      setName("");
      toast({ title: `Added to ${p.name}`, description: track.title });
    } catch (err: any) {
      toast({ title: "Could not create playlist", description: err.message, variant: "destructive" });
    } finally {
      setCreating(false);
    }
  };

  return (
    <PlaylistPickerContext.Provider value={{ openPlaylistPicker }}>
      {children}
      <Dialog open={!!track} onOpenChange={(o) => !o && setTrack(null)}>
        <DialogContent className="max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><ListPlus size={18} /> Add to playlist</DialogTitle>
            <DialogDescription className="truncate">{track?.title} · {track?.artist}</DialogDescription>
          </DialogHeader>

          {!signedIn ? (
            <p className="text-sm text-muted-foreground">Sign in to your account to make playlists.</p>
          ) : (
            <div className="space-y-4">
              <form onSubmit={create} className="flex gap-2">
                <Input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="New playlist name"
                  maxLength={80}
                  aria-label="New playlist name"
                />
                <Button type="submit" disabled={!name.trim() || creating} aria-label="Create playlist">
                  {creating ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />}
                </Button>
              </form>

              {loading ? (
                <div className="py-6 flex justify-center"><Loader2 className="animate-spin text-primary" /></div>
              ) : lists.length === 0 ? (
                <p className="text-sm text-muted-foreground">No playlists yet. Name one above to start.</p>
              ) : (
                <ul className="space-y-1" aria-label="Your playlists">
                  {lists.map((p) => {
                    const on = member.has(p.id);
                    return (
                      <li key={p.id}>
                        <button
                          onClick={() => toggle(p)}
                          disabled={busyId === p.id}
                          aria-pressed={on}
                          className={`w-full min-h-12 flex items-center gap-3 rounded-xl px-3 py-2 text-left border transition-colors ${
                            on ? "border-primary/60 bg-primary/10" : "border-border/40 hover:bg-secondary/50"
                          }`}
                        >
                          <span className={`w-6 h-6 rounded-full border flex items-center justify-center shrink-0 ${on ? "bg-primary border-primary text-primary-foreground" : "border-border"}`}>
                            {busyId === p.id ? <Loader2 size={12} className="animate-spin" /> : on ? <Check size={14} /> : null}
                          </span>
                          <span className="flex-1 min-w-0">
                            <span className="block text-sm truncate">{p.name}</span>
                            <span className="block text-xs text-muted-foreground">{p.count} {p.count === 1 ? "song" : "songs"}</span>
                          </span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
              <Link to="/playlists" onClick={() => setTrack(null)} className="block text-center text-xs text-primary underline">
                Open my playlists
              </Link>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </PlaylistPickerContext.Provider>
  );
}
