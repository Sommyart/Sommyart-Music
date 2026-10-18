import { useCallback, useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import {
  ArrowDown, ArrowUp, Disc3, Pencil, ImagePlus, Loader2, LogOut, Music2, Trash2, UploadCloud, X, CheckCircle2, AlertCircle,
} from "lucide-react";

import {
  supabase, MAX_ALBUM_TRACKS, MAX_FILE_MB, AUDIO_ACCEPT, Artist, TrackDraft,
  titleFromFile, uploadFile, resolveArtist, tooBig,
} from "./lib";
import { EditSongDialog, EditAlbumDialog } from "./Editors";

/* ---------------------------------- Login --------------------------------- */

function Login({ onDone }: { onDone: () => void }) {
  const [username, setUsername] = useState("");
  const [pin, setPin] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      const { data, error } = await supabase.functions.invoke("auth-pin", {
        body: { action: "login", username: username.trim().toLowerCase(), pin },
      });
      if (error) throw new Error(error.message);
      if (data?.error) throw new Error(data.error);
      await supabase.auth.setSession({
        access_token: data.session.access_token,
        refresh_token: data.session.refresh_token,
      });
      onDone();
    } catch (err: any) {
      toast.error("Sign in failed", { description: err.message });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <form onSubmit={submit} className="glass rounded-2xl p-8 w-full max-w-sm space-y-5">
        <div className="text-center space-y-1">
          <img src="/studio/icon-192.png" alt="" className="w-16 h-16 mx-auto rounded-2xl shadow-lg" />
          <h1 className="text-xl font-bold tracking-wider text-primary">SOMMYART STUDIO</h1>
          <p className="text-sm text-muted-foreground">Admin sign in</p>
        </div>
        <div className="space-y-2">
          <Label htmlFor="u">Username</Label>
          <Input id="u" value={username} onChange={(e) => setUsername(e.target.value)} autoComplete="username" required />
        </div>
        <div className="space-y-2">
          <Label htmlFor="p">4-digit PIN</Label>
          <Input
            id="p" type="password" inputMode="numeric" maxLength={4} pattern="\d{4}" value={pin}
            onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))} autoComplete="current-password" required
          />
        </div>
        <Button type="submit" className="w-full" disabled={busy}>
          {busy && <Loader2 className="w-4 h-4 mr-2 animate-spin" />} Sign in
        </Button>
      </form>
    </div>
  );
}

/* ------------------------------ Shared fields ----------------------------- */

function CoverPicker({ file, onChange }: { file: File | null; onChange: (f: File | null) => void }) {
  const preview = useMemo(() => (file ? URL.createObjectURL(file) : null), [file]);
  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview); }, [preview]);
  return (
    <div className="space-y-2">
      <Label>Cover art</Label>
      <label className="flex items-center gap-4 cursor-pointer glass rounded-xl p-3 hover:border-primary/40 transition">
        <div className="w-20 h-20 rounded-lg bg-muted flex items-center justify-center overflow-hidden shrink-0">
          {preview ? <img src={preview} alt="" className="w-full h-full object-cover" /> : <ImagePlus className="w-7 h-7 text-muted-foreground" />}
        </div>
        <div className="text-sm">
          <div className="font-medium">{file ? file.name : "Choose an image"}</div>
          <div className="text-muted-foreground">JPG or PNG, square works best. Optional.</div>
        </div>
        <input type="file" accept="image/*" className="hidden" onChange={(e) => onChange(e.target.files?.[0] ?? null)} />
      </label>
      {file && <button type="button" className="text-xs text-muted-foreground underline" onClick={() => onChange(null)}>Remove cover</button>}
    </div>
  );
}

function ArtistField({ value, onChange, artists }: { value: string; onChange: (v: string) => void; artists: Artist[] }) {
  const isNew = value.trim() && !artists.some((a) => a.name.toLowerCase() === value.trim().toLowerCase());
  return (
    <div className="space-y-2">
      <Label htmlFor="artist">Artist name</Label>
      <Input id="artist" list="artist-list" value={value} onChange={(e) => onChange(e.target.value)} placeholder="Sommyart" required />
      <datalist id="artist-list">{artists.map((a) => <option key={a.id} value={a.name} />)}</datalist>
      {isNew && <p className="text-xs text-primary">New artist. A profile will be created when you publish.</p>}
    </div>
  );
}

function StatusIcon({ s }: { s: TrackDraft["status"] }) {
  if (s === "uploading") return <Loader2 className="w-4 h-4 animate-spin text-primary" />;
  if (s === "done") return <CheckCircle2 className="w-4 h-4 text-green-400" />;
  if (s === "error") return <AlertCircle className="w-4 h-4 text-destructive" />;
  return <Music2 className="w-4 h-4 text-muted-foreground" />;
}

/* --------------------------------- Single --------------------------------- */

function SingleUpload({ artists, onPublished }: { artists: Artist[]; onPublished: () => void }) {
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState("");
  const [artist, setArtist] = useState("Sommyart");
  const [genre, setGenre] = useState("");
  const [cover, setCover] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [step, setStep] = useState("");

  const pick = (f: File | null) => {
    if (f && tooBig(f)) return toast.error(`File is over ${MAX_FILE_MB} MB`);
    setFile(f);
    if (f && !title) setTitle(titleFromFile(f.name));
  };

  const publish = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) return toast.error("Choose a song file first");
    setBusy(true);
    try {
      setStep("Uploading cover…");
      const coverUrl = cover ? await uploadFile("covers", cover, title + "_cover") : null;
      setStep("Uploading song…");
      const audioUrl = await uploadFile("music", file, title);
      setStep("Publishing…");
      const artistId = await resolveArtist(artist, artists);
      const { error } = await supabase.from("songs").insert({
        title: title.trim(), artist: artist.trim(), artist_id: artistId,
        genre: genre.trim() || null, audio_url: audioUrl, cover_art_url: coverUrl,
        uploaded_at: new Date().toISOString(),
      });
      if (error) throw new Error(error.message);
      toast.success("Published", { description: `"${title}" is live for all listeners.` });
      setFile(null); setTitle(""); setGenre(""); setCover(null);
      onPublished();
    } catch (err: any) {
      toast.error("Publish failed", { description: err.message });
    } finally {
      setBusy(false); setStep("");
    }
  };

  return (
    <form onSubmit={publish} className="space-y-5">
      <div className="space-y-2">
        <Label>Song file</Label>
        <label className="flex flex-col items-center justify-center gap-2 cursor-pointer glass rounded-xl p-6 text-center hover:border-primary/40 transition">
          <UploadCloud className="w-8 h-8 text-primary" />
          <span className="text-sm">{file ? file.name : "Tap to choose an MP3, M4A or WAV"}</span>
          {file && <span className="text-xs text-muted-foreground">{(file.size / 1048576).toFixed(1)} MB</span>}
          <input type="file" accept={AUDIO_ACCEPT} className="hidden" onChange={(e) => pick(e.target.files?.[0] ?? null)} />
        </label>
      </div>
      <div className="space-y-2">
        <Label htmlFor="title">Song title</Label>
        <Input id="title" value={title} onChange={(e) => setTitle(e.target.value)} required />
      </div>
      <ArtistField value={artist} onChange={setArtist} artists={artists} />
      <div className="space-y-2">
        <Label htmlFor="genre">Genre</Label>
        <Input id="genre" value={genre} onChange={(e) => setGenre(e.target.value)} placeholder="Afrobeat, Gospel, R&B…" />
      </div>
      <CoverPicker file={cover} onChange={setCover} />
      <Button type="submit" className="w-full h-12 text-base" disabled={busy || !file}>
        {busy ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />{step}</> : "Publish song"}
      </Button>
    </form>
  );
}

/* ---------------------------------- Album --------------------------------- */

function AlbumUpload({ artists, onPublished }: { artists: Artist[]; onPublished: () => void }) {
  const [albumTitle, setAlbumTitle] = useState("");
  const [artist, setArtist] = useState("Sommyart");
  const [genre, setGenre] = useState("");
  const [description, setDescription] = useState("");
  const [cover, setCover] = useState<File | null>(null);
  const [tracks, setTracks] = useState<TrackDraft[]>([]);
  const [busy, setBusy] = useState(false);
  const [step, setStep] = useState("");

  const addFiles = (list: FileList | null) => {
    if (!list) return;
    const incoming = Array.from(list);
    const room = MAX_ALBUM_TRACKS - tracks.length;
    if (incoming.length > room) toast.warning(`An album can have at most ${MAX_ALBUM_TRACKS} songs. Added the first ${room}.`);
    const accepted = incoming.slice(0, Math.max(room, 0)).filter((f) => {
      if (tooBig(f)) { toast.error(`${f.name} is over ${MAX_FILE_MB} MB, skipped`); return false; }
      return true;
    });
    setTracks((t) => [
      ...t,
      ...accepted.map((f) => ({ key: `${f.name}-${f.size}-${Math.random()}`, file: f, title: titleFromFile(f.name), status: "idle" as const })),
    ]);
  };

  const move = (i: number, d: -1 | 1) =>
    setTracks((t) => {
      const j = i + d;
      if (j < 0 || j >= t.length) return t;
      const c = [...t];
      [c[i], c[j]] = [c[j], c[i]];
      return c;
    });

  const setTrack = (key: string, patch: Partial<TrackDraft>) =>
    setTracks((t) => t.map((x) => (x.key === key ? { ...x, ...patch } : x)));

  const publish = async (e: React.FormEvent) => {
    e.preventDefault();
    if (tracks.length === 0) return toast.error("Add at least one song");
    if (tracks.some((t) => !t.title.trim())) return toast.error("Every song needs a title");
    setBusy(true);
    const uploaded: { title: string; url: string; n: number }[] = [];
    try {
      setStep("Uploading cover…");
      const coverUrl = cover ? await uploadFile("covers", cover, albumTitle + "_cover") : null;

      for (let i = 0; i < tracks.length; i++) {
        const t = tracks[i];
        setStep(`Uploading song ${i + 1} of ${tracks.length}…`);
        setTrack(t.key, { status: "uploading", error: undefined });
        try {
          const url = await uploadFile("music", t.file, `${albumTitle}_${i + 1}_${t.title}`);
          uploaded.push({ title: t.title.trim(), url, n: i + 1 });
          setTrack(t.key, { status: "done" });
        } catch (err: any) {
          setTrack(t.key, { status: "error", error: err.message });
          throw new Error(`"${t.title}" failed to upload: ${err.message}`);
        }
      }

      setStep("Publishing album…");
      const artistId = await resolveArtist(artist, artists);
      const now = new Date().toISOString();
      const { data: album, error: aErr } = await supabase
        .from("albums")
        .insert({
          title: albumTitle.trim(), artist_name: artist.trim(), artist_id: artistId,
          cover_art_url: coverUrl, description: description.trim() || null, genre: genre.trim() || null, released_at: now,
        })
        .select("id")
        .single();
      if (aErr) throw new Error(aErr.message);

      const { error: sErr } = await supabase.from("songs").insert(
        uploaded.map((u) => ({
          title: u.title, artist: artist.trim(), artist_id: artistId, album_id: album.id, track_number: u.n,
          genre: genre.trim() || null, audio_url: u.url, cover_art_url: coverUrl, uploaded_at: now,
        })),
      );
      if (sErr) {
        await supabase.from("albums").delete().eq("id", album.id);
        throw new Error(sErr.message);
      }

      toast.success("Album published", { description: `"${albumTitle}" with ${uploaded.length} songs is live.` });
      setAlbumTitle(""); setGenre(""); setDescription(""); setCover(null); setTracks([]);
      onPublished();
    } catch (err: any) {
      toast.error("Publish failed", { description: `${err.message}. Nothing was published; fix it and press Publish again.` });
    } finally {
      setBusy(false); setStep("");
    }
  };

  return (
    <form onSubmit={publish} className="space-y-5">
      <div className="space-y-2">
        <Label htmlFor="at">Album title</Label>
        <Input id="at" value={albumTitle} onChange={(e) => setAlbumTitle(e.target.value)} required />
      </div>
      <ArtistField value={artist} onChange={setArtist} artists={artists} />
      <div className="space-y-2">
        <Label htmlFor="ag">Genre</Label>
        <Input id="ag" value={genre} onChange={(e) => setGenre(e.target.value)} placeholder="Afro-Hebrew Worship" />
      </div>
      <div className="space-y-2">
        <Label htmlFor="ad">Description</Label>
        <Textarea id="ad" rows={3} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="A few lines about the album (optional)" />
      </div>
      <CoverPicker file={cover} onChange={setCover} />

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <Label>Songs ({tracks.length}/{MAX_ALBUM_TRACKS})</Label>
          {tracks.length > 0 && !busy && (
            <button type="button" className="text-xs text-muted-foreground underline" onClick={() => setTracks([])}>Clear all</button>
          )}
        </div>
        {tracks.map((t, i) => (
          <div key={t.key} className="glass rounded-xl p-3 flex items-center gap-2">
            <span className="w-6 text-center text-sm font-bold text-primary">{i + 1}</span>
            <StatusIcon s={t.status} />
            <div className="flex-1 min-w-0">
              <Input value={t.title} onChange={(e) => setTrack(t.key, { title: e.target.value })} disabled={busy} className="h-9" />
              <div className="text-[11px] text-muted-foreground truncate mt-1">{t.error ?? t.file.name}</div>
            </div>
            <div className="flex flex-col">
              <button type="button" disabled={busy || i === 0} onClick={() => move(i, -1)} className="p-1 disabled:opacity-30" aria-label="Move up"><ArrowUp className="w-4 h-4" /></button>
              <button type="button" disabled={busy || i === tracks.length - 1} onClick={() => move(i, 1)} className="p-1 disabled:opacity-30" aria-label="Move down"><ArrowDown className="w-4 h-4" /></button>
            </div>
            <button type="button" disabled={busy} onClick={() => setTracks((x) => x.filter((y) => y.key !== t.key))} className="p-1 text-muted-foreground hover:text-destructive" aria-label="Remove"><X className="w-4 h-4" /></button>
          </div>
        ))}
        {tracks.length < MAX_ALBUM_TRACKS && !busy && (
          <label className="flex flex-col items-center justify-center gap-2 cursor-pointer glass rounded-xl p-5 text-center hover:border-primary/40 transition">
            <UploadCloud className="w-7 h-7 text-primary" />
            <span className="text-sm">Add songs (you can select several at once)</span>
            <span className="text-xs text-muted-foreground">{MAX_ALBUM_TRACKS - tracks.length} slots left · use the arrows to set the track order</span>
            <input type="file" multiple accept={AUDIO_ACCEPT} className="hidden" onChange={(e) => { addFiles(e.target.files); e.target.value = ""; }} />
          </label>
        )}
      </div>

      <Button type="submit" className="w-full h-12 text-base" disabled={busy || tracks.length === 0}>
        {busy ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />{step}</> : `Publish album (${tracks.length} songs)`}
      </Button>
    </form>
  );
}

/* --------------------------------- Library -------------------------------- */

function Library({ refreshKey, onChanged, artists }: { refreshKey: number; onChanged: () => void; artists: Artist[] }) {
  const [editSong, setEditSong] = useState<any | null>(null);
  const [editAlbum, setEditAlbum] = useState<any | null>(null);
  const [songs, setSongs] = useState<any[]>([]);
  const [albums, setAlbums] = useState<any[]>([]);
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const [s, a] = await Promise.all([
        supabase.from("songs").select("id,title,artist,genre,cover_art_url,audio_url,uploaded_at,album_id,track_number").order("uploaded_at", { ascending: false }),
        supabase.from("albums").select("id,title,artist_name,cover_art_url,description,genre,released_at").order("released_at", { ascending: false }),
      ]);
      setSongs(s.data ?? []);
      setAlbums(a.data ?? []);
      setLoading(false);
    })();
  }, [refreshKey]);

  const delSong = async (id: string, title: string) => {
    if (!window.confirm(`Remove "${title}" from the app? Listeners will no longer see it.`)) return;
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

  const filtered = songs.filter((s) => `${s.title} ${s.artist} ${s.genre ?? ""}`.toLowerCase().includes(q.toLowerCase()));
  const albumName = (id: string | null) => albums.find((a) => a.id === id)?.title;

  if (loading) return <div className="py-10 flex justify-center"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>;

  return (
    <div className="space-y-6">
      {editSong && <EditSongDialog song={editSong} albums={albums} artists={artists} onClose={() => setEditSong(null)} onSaved={onChanged} />}
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
        {filtered.map((s) => (
          <div key={s.id} className="glass rounded-xl p-3 flex items-center gap-3">
            <img src={s.cover_art_url || "/images/logo.png"} alt="" className="w-11 h-11 rounded-lg object-cover" />
            <div className="flex-1 min-w-0">
              <div className="font-medium truncate">{s.title}</div>
              <div className="text-xs text-muted-foreground truncate">
                {s.artist}{s.genre ? ` · ${s.genre}` : ""}{s.album_id ? ` · ${albumName(s.album_id) ?? "Album"} #${s.track_number ?? ""}` : ""} · {new Date(s.uploaded_at).toLocaleDateString()}
              </div>
            </div>
            <button onClick={() => setEditSong(s)} className="p-2 text-muted-foreground hover:text-primary" aria-label="Edit song"><Pencil className="w-4 h-4" /></button>
            <button onClick={() => delSong(s.id, s.title)} className="p-2 text-muted-foreground hover:text-destructive" aria-label="Remove song"><Trash2 className="w-4 h-4" /></button>
          </div>
        ))}
        <p className="text-xs text-muted-foreground pt-2">
          The songs built into the app itself aren't listed here. Only songs uploaded through the Studio, or imported from Lovable, can be edited here. Tap the pencil to edit a song or album.
        </p>
      </div>
    </div>
  );
}

/* ---------------------------------- Shell --------------------------------- */

export default function Studio() {
  const [state, setState] = useState<"loading" | "out" | "denied" | "in">("loading");
  const [username, setUsername] = useState("");
  const [artists, setArtists] = useState<Artist[]>([]);
  const [refreshKey, setRefreshKey] = useState(0);

  const check = useCallback(async () => {
    const { data: sess } = await supabase.auth.getSession();
    const uid = sess.session?.user.id;
    if (!uid) return setState("out");
    const [{ data: role }, { data: prof }] = await Promise.all([
      supabase.from("user_roles").select("role").eq("user_id", uid).eq("role", "admin").maybeSingle(),
      supabase.from("profiles").select("username").eq("user_id", uid).maybeSingle(),
    ]);
    setUsername(prof?.username ?? "");
    setState(role ? "in" : "denied");
  }, []);

  useEffect(() => { check(); }, [check]);

  useEffect(() => {
    if (state !== "in") return;
    supabase.from("artists").select("id,name").order("name").then(({ data }: any) => setArtists(data ?? []));
  }, [state, refreshKey]);

  useEffect(() => { document.title = "Sommyart Studio"; }, []);

  const signOut = async () => { await supabase.auth.signOut(); setState("out"); };
  const bump = () => setRefreshKey((k) => k + 1);

  if (state === "loading") return <div className="min-h-screen flex items-center justify-center"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>;
  if (state === "out") return <Login onDone={check} />;
  if (state === "denied")
    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <div className="glass rounded-2xl p-8 max-w-sm text-center space-y-4">
          <AlertCircle className="w-10 h-10 mx-auto text-destructive" />
          <p>This account doesn't have admin access to the Studio.</p>
          <Button variant="secondary" onClick={signOut}>Sign out</Button>
        </div>
      </div>
    );

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
          <TabsList className="grid grid-cols-3 w-full mb-6">
            <TabsTrigger value="single">Single</TabsTrigger>
            <TabsTrigger value="album">Album</TabsTrigger>
            <TabsTrigger value="library">Library</TabsTrigger>
          </TabsList>
          <TabsContent value="single"><SingleUpload artists={artists} onPublished={bump} /></TabsContent>
          <TabsContent value="album"><AlbumUpload artists={artists} onPublished={bump} /></TabsContent>
          <TabsContent value="library"><Library refreshKey={refreshKey} onChanged={bump} artists={artists} /></TabsContent>
        </Tabs>
        <p className="text-xs text-muted-foreground text-center mt-10">
          Published songs appear in Sommyart Music straight away. Listeners see the "new tracks" announcement the next time they open the app.
        </p>
      </main>
    </div>
  );
}
