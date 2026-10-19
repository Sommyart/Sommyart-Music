import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ChevronLeft, ListMusic, Loader2, Plus } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { SEO } from "@/components/SEO";
import { toast } from "@/hooks/use-toast";
import { createPlaylist, usePlaylists } from "@/hooks/usePlaylists";

const MyPlaylists = () => {
  const navigate = useNavigate();
  const { playlists, loading, signedIn, error, refresh } = usePlaylists();
  const [name, setName] = useState("");
  const [creating, setCreating] = useState(false);

  const create = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || creating) return;
    setCreating(true);
    try {
      const p = await createPlaylist(name);
      setName("");
      navigate(`/playlists/${p.id}`);
    } catch (err: any) {
      toast({ title: "Could not create playlist", description: err.message, variant: "destructive" });
      refresh();
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="min-h-screen pb-36">
      <SEO title="My Playlists | Sommyart Music" description="Your personal playlists on Sommyart Music." path="/playlists" />
      <div className="px-6 pt-12 pb-3 flex items-center gap-3">
        <button onClick={() => navigate(-1)} aria-label="Go back" className="w-10 h-10 -ml-2 flex items-center justify-center text-muted-foreground hover:text-foreground">
          <ChevronLeft size={24} />
        </button>
        <div>
          <h1 className="text-xl font-display font-bold tracking-wider text-foreground neon-text">My Playlists</h1>
          <p className="text-xs text-muted-foreground mt-1">{playlists.length} {playlists.length === 1 ? "playlist" : "playlists"}</p>
        </div>
      </div>

      {!signedIn ? (
        <p className="px-6 pt-6 text-sm text-muted-foreground">Sign in to your account to make playlists.</p>
      ) : (
        <>
          <form onSubmit={create} className="px-6 pb-4 flex gap-2">
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="New playlist name" maxLength={80} aria-label="New playlist name" />
            <Button type="submit" disabled={!name.trim() || creating} className="gap-1">
              {creating ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />} Create
            </Button>
          </form>

          {loading ? (
            <div className="py-10 flex justify-center"><Loader2 className="animate-spin text-primary" /></div>
          ) : error ? (
            <p className="px-6 text-sm text-destructive">{error}</p>
          ) : playlists.length === 0 ? (
            <p className="px-6 text-sm text-muted-foreground">No playlists yet. Name one above, or use the ⋯ menu on any song and choose "Add to playlist".</p>
          ) : (
            <ul className="px-4 space-y-2">
              {playlists.map((p) => (
                <li key={p.id}>
                  <button
                    onClick={() => navigate(`/playlists/${p.id}`)}
                    className="w-full min-h-16 flex items-center gap-3 rounded-xl p-3 text-left glass hover:neon-border transition-all"
                  >
                    <span className="w-11 h-11 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0"><ListMusic size={20} /></span>
                    <span className="flex-1 min-w-0">
                      <span className="block text-sm font-medium truncate">{p.name}</span>
                      <span className="block text-xs text-muted-foreground">{p.count} {p.count === 1 ? "song" : "songs"}</span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </div>
  );
};

export default MyPlaylists;
