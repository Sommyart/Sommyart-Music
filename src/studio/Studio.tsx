import { useCallback, useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { Copy, Loader2, LogOut, Mic2, Pencil, Trash2, AlertCircle, KeyRound } from "lucide-react";

import { supabase, Artist, Owner } from "./lib";
import { EditSongDialog, EditAlbumDialog } from "./Editors";
import { LyricsDialog } from "./Lyrics";
import { ArtistsPanel } from "./Artists";
import { SingleUpload, AlbumUpload } from "./Uploads";
import { RequestsPanel, usePendingCount } from "./Requests";
import { ApplyForm, WaitingScreen, ArtistPortal, Application } from "./ArtistAccess";
import { kosherTracks } from "@/lib/tracks";

/** "Pop, Rock" counts as two genres. */
const genresOf = (g?: string | null) =>
  (g ?? "").split(",").map((x) => x.trim()).filter(Boolean);
const NO_GENRE = "__none__";
const isBundled = (s: { audio_url?: string }) => !!s.audio_url && s.audio_url.startsWith("/music/");


/* ---------------------------------- Login --------------------------------- */

type AuthResult = { session: { access_token: string; refresh_token: string }; recoveryCodes?: string[] };

function Login({ onDone }: { onDone: () => void }) {
  const [mode, setMode] = useState<"in" | "up">("in");
  const [username, setUsername] = useState("");
  const [pin, setPin] = useState("");
  const [pin2, setPin2] = useState("");
  const [busy, setBusy] = useState(false);
  const [created, setCreated] = useState<AuthResult | null>(null);
  const [copied, setCopied] = useState(false);

  const activate = async (data: AuthResult) => {
    await supabase.auth.setSession({ access_token: data.session.access_token, refresh_token: data.session.refresh_token });
    onDone();
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (mode === "up" && pin !== pin2) return toast.error("The two PINs do not match");
    setBusy(true);
    try {
      const { data, error } = await supabase.functions.invoke("auth-pin", {
        body: { action: mode === "up" ? "signup" : "login", username: username.trim().toLowerCase(), pin },
      });
      if (error) throw new Error(error.message);
      if (data?.error) throw new Error(data.error);
      if (mode === "up") setCreated(data);
      else await activate(data);
    } catch (err: any) {
      toast.error(mode === "up" ? "Could not create the account" : "Sign in failed", { description: err.message });
    } finally {
      setBusy(false);
    }
  };

  if (created) {
    const codes = created.recoveryCodes ?? [];
    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <div className="glass rounded-2xl p-8 w-full max-w-sm space-y-4">
          <div className="text-center space-y-1">
            <KeyRound className="w-10 h-10 mx-auto text-primary" />
            <h1 className="text-lg font-bold">Save your recovery codes</h1>
            <p className="text-sm text-muted-foreground">If you forget your PIN, one of these codes lets you reset it. Each works once. They are shown only now.</p>
          </div>
          <div className="grid gap-1 font-mono text-sm text-center bg-background/50 rounded-xl p-3" data-testid="recovery-codes">
            {codes.map((c) => <div key={c}>{c}</div>)}
          </div>
          <Button
            variant="secondary" className="w-full"
            onClick={async () => { try { await navigator.clipboard.writeText(codes.join("\n")); setCopied(true); } catch { toast.error("Could not copy. Write them down instead."); } }}
          >
            <Copy className="w-4 h-4 mr-2" />{copied ? "Copied" : "Copy codes"}
          </Button>
          <Button className="w-full" onClick={() => activate(created)}>I saved them, continue</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <form onSubmit={submit} className="glass rounded-2xl p-8 w-full max-w-sm space-y-5">
        <div className="text-center space-y-1">
          <img src="/studio/icon-192.png" alt="" className="w-16 h-16 mx-auto rounded-2xl shadow-lg" />
          <h1 className="text-xl font-bold tracking-wider text-primary">SOMMYART STUDIO</h1>
          <p className="text-sm text-muted-foreground">{mode === "in" ? "Admin and artist sign in" : "Create an artist account"}</p>
        </div>
        <div className="space-y-2">
          <Label htmlFor="u">Username</Label>
          <Input id="u" value={username} onChange={(e) => setUsername(e.target.value)} autoComplete="username" required />
          {mode === "up" && <p className="text-xs text-muted-foreground">3 to 20 letters, numbers or underscores. This is for signing in; your artist name comes next.</p>}
        </div>
        <div className="space-y-2">
          <Label htmlFor="p">4-digit PIN</Label>
          <Input
            id="p" type="password" inputMode="numeric" maxLength={4} pattern="\d{4}" value={pin}
            onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))} autoComplete={mode === "in" ? "current-password" : "new-password"} required
          />
        </div>
        {mode === "up" && (
          <div className="space-y-2">
            <Label htmlFor="p2">Repeat PIN</Label>
            <Input
              id="p2" type="password" inputMode="numeric" maxLength={4} pattern="\d{4}" value={pin2}
              onChange={(e) => setPin2(e.target.value.replace(/\D/g, ""))} autoComplete="new-password" required
            />
          </div>
        )}
        <Button type="submit" className="w-full" disabled={busy}>
          {busy && <Loader2 className="w-4 h-4 mr-2 animate-spin" />} {mode === "in" ? "Sign in" : "Create account"}
        </Button>
        <button type="button" className="w-full text-sm text-muted-foreground underline" onClick={() => { setMode(mode === "in" ? "up" : "in"); setPin(""); setPin2(""); }}>
          {mode === "in" ? "New artist? Create an account" : "Already have an account? Sign in"}
        </button>
      </form>
    </div>
  );
}

/* --------------------------------- Library -------------------------------- */

function Library({ refreshKey, onChanged, artists }: { refreshKey: number; onChanged: () => void; artists: Artist[] }) {
  const [editSong, setEditSong] = useState<any | null>(null);
  const [editAlbum, setEditAlbum] = useState<any | null>(null);
  const [lyricsSong, setLyricsSong] = useState<any | null>(null);
  const [songs, setSongs] = useState<any[]>([]);
  const [albums, setAlbums] = useState<any[]>([]);
  const [q, setQ] = useState("");
  const [genre, setGenre] = useState<string>("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const [s, a] = await Promise.all([
        supabase.from("songs").select("id,title,artist,genre,cover_art_url,audio_url,uploaded_at,album_id,track_number,description,artist_id").order("uploaded_at", { ascending: false }),
        supabase.from("albums").select("id,title,artist_name,cover_art_url,description,genre,released_at").order("released_at", { ascending: false }),
      ]);
      setSongs(s.data ?? []);
      setAlbums(a.data ?? []);
      setLoading(false);
    })();
  }, [refreshKey]);

  const delSong = async (id: string, title: string, bundled = false) => {
    const msg = bundled
      ? `"${title}" is built into the app. Removing it here will not remove it from apps that are already installed, and it may come back. Remove anyway?`
      : `Remove "${title}" from the app? Listeners will no longer see it.`;
    if (!window.confirm(msg)) return;
    const { error } = await supabase.from("songs").delete().eq("id", id);
    if (error) return toast.error("Could not remove", { description: error.message });
    toast.success(`Removed "${title}"`);
    onChanged();
  };

  const delAlbum = async (id: string, title: string) => {
    if (!window.confirm(`Remove the album "${title}" and all its songs from the app?`)) return;
    const { error: e1 } = await supabase.from("songs").delete().eq("album_id", id);
    const { error: e2 } = await supabase.from("albums").delete().eq("id", id);
    if (e1 || e2) return toast.error("Could not remove", { description: (e1 || e2).message });
    toast.success(`Removed album "${title}"`);
    onChanged();
  };

  // Genre chips, built from every song (comma separated genres count separately).
  const genreCounts = useMemo(() => {
    const m = new Map<string, { label: string; n: number }>();
    let none = 0;
    for (const s of songs) {
      const gs = genresOf(s.genre);
      if (!gs.length) none++;
      for (const g of gs) {
        const k = g.toLowerCase();
        const cur = m.get(k);
        m.set(k, { label: cur?.label ?? g, n: (cur?.n ?? 0) + 1 });
      }
    }
    const list = Array.from(m.entries()).map(([key, v]) => ({ key, ...v })).sort((a, b) => a.label.localeCompare(b.label));
    return { list, none };
  }, [songs]);

  const matchesGenre = (g?: string | null) => {
    if (!genre) return true;
    const gs = genresOf(g).map((x) => x.toLowerCase());
    return genre === NO_GENRE ? gs.length === 0 : gs.includes(genre);
  };
  const needle = q.trim().toLowerCase();
  const matchesText = (t: { title: string; artist: string; genre?: string | null }) =>
    !needle || `${t.title} ${t.artist} ${t.genre ?? ""}`.toLowerCase().includes(needle);

  const filtered = songs.filter((s) => matchesText(s) && matchesGenre(s.genre));
  const filteredKosher = kosherTracks.filter((t) => matchesText(t) && matchesGenre(t.genre));
  const albumName = (id: string | null) => albums.find((a) => a.id === id)?.title;

  if (loading) return <div className="py-10 flex justify-center"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>;

  return (
    <div className="space-y-6">
      {editSong && <EditSongDialog song={editSong} albums={albums} artists={artists} onClose={() => setEditSong(null)} onSaved={onChanged} />}
      {lyricsSong && <LyricsDialog song={lyricsSong} onClose={() => setLyricsSong(null)} onSaved={onChanged} />}
      {editAlbum && <EditAlbumDialog album={editAlbum} songs={songs} artists={artists} onClose={() => setEditAlbum(null)} onSaved={onChanged} />}
      <div className="grid grid-cols-2 gap-3">
        <div className="glass rounded-xl p-4"><div className="text-2xl font-bold text-primary">{songs.length}</div><div className="text-xs text-muted-foreground">songs in the app's library</div></div>
        <div className="glass rounded-xl p-4"><div className="text-2xl font-bold text-primary">{albums.length}</div><div className="text-xs text-muted-foreground">albums</div></div>
      </div>

      {albums.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-sm font-semibold tracking-wider">ALBUMS</h3>
          {albums.map((a) => (
            <div key={a.id} className="glass rounded-xl p-3 flex items-center gap-3">
              <img src={a.cover_art_url || "/images/logo.png"} alt="" className="w-12 h-12 rounded-lg object-cover" />
              <div className="flex-1 min-w-0">
                <div className="font-medium truncate">{a.title}</div>
                <div className="text-xs text-muted-foreground">{a.artist_name} · {songs.filter((s) => s.album_id === a.id).length} songs</div>
              </div>
              <button onClick={() => setEditAlbum(a)} className="p-2 text-muted-foreground hover:text-primary" aria-label="Edit album"><Pencil className="w-4 h-4" /></button>
              <button onClick={() => delAlbum(a.id, a.title)} className="p-2 text-muted-foreground hover:text-destructive" aria-label="Remove album"><Trash2 className="w-4 h-4" /></button>
            </div>
          ))}
        </div>
      )}

      <div className="space-y-2">
        <h3 className="text-sm font-semibold tracking-wider">SONGS · NEWEST FIRST</h3>
        <Input placeholder="Search title, artist or genre" value={q} onChange={(e) => setQ(e.target.value)} />
        <div className="flex gap-2 overflow-x-auto no-scrollbar py-1">
          {[
            { key: "", label: "All", n: songs.length },
            ...genreCounts.list,
            ...(genreCounts.none ? [{ key: NO_GENRE, label: "No genre", n: genreCounts.none }] : []),
          ].map((g) => (
            <button
              key={g.key || "all"}
              type="button"
              onClick={() => setGenre(g.key)}
              aria-pressed={genre === g.key}
              className={`h-8 px-3 rounded-full text-xs whitespace-nowrap border transition-colors ${
                genre === g.key ? "bg-primary text-primary-foreground border-primary" : "border-border/50 text-muted-foreground hover:text-foreground"
              }`}
            >
              {g.label} <span className="opacity-70">{g.n}</span>
            </button>
          ))}
        </div>
        <p className="text-xs text-muted-foreground">
          Showing {filtered.length + filteredKosher.length} of {songs.length + kosherTracks.length} songs
        </p>
        {filtered.map((s) => (
          <div key={s.id} className="glass rounded-xl p-3 flex items-center gap-3">
            <img src={s.cover_art_url || "/images/logo.png"} alt="" className="w-11 h-11 rounded-lg object-cover" />
            <div className="flex-1 min-w-0">
              <div className="font-medium truncate">{s.title}</div>
              <div className="text-xs text-muted-foreground truncate">
                {s.artist}{s.genre ? ` · ${s.genre}` : ""}{isBundled(s) ? " · built in" : ""}{s.album_id ? ` · ${albumName(s.album_id) ?? "Album"} #${s.track_number ?? ""}` : ""} · {new Date(s.uploaded_at).toLocaleDateString()}
              </div>
            </div>
            <button onClick={() => setLyricsSong(s)} className="p-2 text-muted-foreground hover:text-primary" aria-label="Lyrics"><Mic2 className="w-4 h-4" /></button>
            <button onClick={() => setEditSong(s)} className="p-2 text-muted-foreground hover:text-primary" aria-label="Edit song"><Pencil className="w-4 h-4" /></button>
            <button onClick={() => delSong(s.id, s.title, isBundled(s))} className="p-2 text-muted-foreground hover:text-destructive" aria-label="Remove song"><Trash2 className="w-4 h-4" /></button>
          </div>
        ))}
        {filteredKosher.length > 0 && (
          <div className="space-y-2 pt-3">
            <h3 className="text-sm font-semibold tracking-wider">KOSHER MUSIC · BUILT INTO THE APP</h3>
            {filteredKosher.map((t) => (
              <div key={t.id} className="glass rounded-xl p-3 flex items-center gap-3">
                <img src={t.coverUrl} alt="" className="w-11 h-11 rounded-lg object-cover" />
                <div className="flex-1 min-w-0">
                  <div className="font-medium truncate">{t.title}</div>
                  <div className="text-xs text-muted-foreground truncate">{t.artist}{t.genre ? ` · ${t.genre}` : ""} · Kosher section</div>
                </div>
              </div>
            ))}
            <p className="text-xs text-muted-foreground">
              These five live in the app's Kosher Music section and are shown here for reference only. To change them, tell Claude.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}


/* ---------------------------------- Shell --------------------------------- */

type View =
  | { kind: "loading" }
  | { kind: "out" }
  | { kind: "admin" }
  | { kind: "apply"; existing: Application | null }
  | { kind: "waiting"; app: Application }
  | { kind: "artist"; owner: Owner };

export default function Studio() {
  const [view, setView] = useState<View>({ kind: "loading" });
  const [userId, setUserId] = useState("");
  const [username, setUsername] = useState("");
  const [artists, setArtists] = useState<Artist[]>([]);
  const [refreshKey, setRefreshKey] = useState(0);

  const check = useCallback(async () => {
    const { data: sess } = await supabase.auth.getSession();
    const uid = sess.session?.user.id;
    if (!uid) return setView({ kind: "out" });
    setUserId(uid);
    const [{ data: role }, { data: prof }] = await Promise.all([
      supabase.from("user_roles").select("role").eq("user_id", uid).eq("role", "admin").maybeSingle(),
      supabase.from("profiles").select("username").eq("user_id", uid).maybeSingle(),
    ]);
    setUsername(prof?.username ?? "");
    if (role) return setView({ kind: "admin" });

    const { data: app } = await supabase.from("artist_applications").select("*").eq("user_id", uid).maybeSingle();
    if (!app) return setView({ kind: "apply", existing: null });
    if (app.status === "rejected") return setView({ kind: "apply", existing: app });
    if (app.status === "approved") {
      const { data: artist } = await supabase.from("artists").select("id,name").eq("owner_user_id", uid).maybeSingle();
      if (artist) return setView({ kind: "artist", owner: { artistId: artist.id, artistName: artist.name, folder: `artists/${uid}` } });
    }
    setView({ kind: "waiting", app });
  }, []);

  useEffect(() => { check(); }, [check]);

  const isAdmin = view.kind === "admin";
  useEffect(() => {
    if (!isAdmin) return;
    supabase.from("artists").select("id,name").order("name").then(({ data }: any) => setArtists(data ?? []));
  }, [isAdmin, refreshKey]);
  const pending = usePendingCount(refreshKey, isAdmin);

  useEffect(() => { document.title = "Sommyart Studio"; }, []);

  const signOut = async () => { await supabase.auth.signOut(); setView({ kind: "out" }); };
  const bump = () => setRefreshKey((k) => k + 1);

  if (view.kind === "loading") return <div className="min-h-screen flex items-center justify-center"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>;
  if (view.kind === "out") return <Login onDone={check} />;
  if (view.kind === "apply")
    return <ApplyForm userId={userId} username={username} existing={view.existing} onSaved={check} onSignOut={signOut} />;
  if (view.kind === "waiting")
    return (
      <WaitingScreen
        app={view.app} username={username} onSignOut={signOut} onRefresh={check}
        onEdit={() => setView({ kind: "apply", existing: view.app })}
      />
    );
  if (view.kind === "artist") return <ArtistPortal owner={view.owner} username={username} onSignOut={signOut} />;

  return (
    <div className="min-h-screen pb-16">
      <header className="sticky top-0 z-10 glass-strong border-b border-border">
        <div className="max-w-2xl mx-auto px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <img src="/studio/icon-192.png" alt="" className="w-7 h-7 rounded-lg" />
            <span className="font-bold tracking-wider text-primary" style={{ fontFamily: "var(--font-display)" }}>STUDIO</span>
          </div>
          <div className="flex items-center gap-3 text-sm text-muted-foreground">
            <span className="hidden sm:inline">{username}</span>
            <button onClick={signOut} className="p-2 hover:text-foreground" aria-label="Sign out"><LogOut className="w-4 h-4" /></button>
          </div>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 pt-6">
        <Tabs defaultValue="single">
          <TabsList className="grid grid-cols-5 w-full mb-6">
            <TabsTrigger value="single">Single</TabsTrigger>
            <TabsTrigger value="album">Album</TabsTrigger>
            <TabsTrigger value="library">Library</TabsTrigger>
            <TabsTrigger value="artists">Artists</TabsTrigger>
            <TabsTrigger value="requests" className="relative">
              Requests
              {pending > 0 && (
                <span aria-label={`${pending} waiting`} className="absolute -top-1 -right-1 min-w-4 h-4 px-1 rounded-full bg-primary text-primary-foreground text-[10px] leading-4 text-center">{pending}</span>
              )}
            </TabsTrigger>
          </TabsList>
          <TabsContent value="single"><SingleUpload artists={artists} onPublished={bump} /></TabsContent>
          <TabsContent value="album"><AlbumUpload artists={artists} onPublished={bump} /></TabsContent>
          <TabsContent value="library"><Library refreshKey={refreshKey} onChanged={bump} artists={artists} /></TabsContent>
          <TabsContent value="artists"><ArtistsPanel refreshKey={refreshKey} onChanged={bump} /></TabsContent>
          <TabsContent value="requests"><RequestsPanel refreshKey={refreshKey} onChanged={bump} /></TabsContent>
        </Tabs>
        <p className="text-xs text-muted-foreground text-center mt-10">
          Published songs appear in Sommyart Music straight away, and listeners are notified in real time.
        </p>
      </main>
    </div>
  );
}
