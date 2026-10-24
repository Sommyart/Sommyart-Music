import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { Clock, ImagePlus, Loader2, LogOut, Mic2, Pencil, PauseCircle, User, XCircle } from "lucide-react";
import { supabase, Artist, Owner, shrinkImage, uploadFile } from "./lib";
import { AlbumUpload, SingleUpload } from "./Uploads";
import { EditSongDialog, SongRow, AlbumRow } from "./Editors";
import { LyricsDialog } from "./Lyrics";

export type Application = {
  id: string; user_id: string; artist_name: string; genre: string | null; description: string | null; image_url: string | null;
  status: "pending" | "approved" | "rejected" | "suspended"; admin_note: string | null; artist_id: string | null;
};

const PLACEHOLDER = "/images/logo.png";

function Shell({ username, onSignOut, children }: { username: string; onSignOut: () => void; children: React.ReactNode }) {
  return (
    <div className="min-h-screen pb-16">
      <header className="sticky top-0 z-10 glass-strong border-b border-border">
        <div className="max-w-2xl mx-auto px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <img src="/studio/icon-192.png" alt="" className="w-7 h-7 rounded-lg" />
            <span className="font-bold tracking-wider text-primary" style={{ fontFamily: "var(--font-display)" }}>ARTIST STUDIO</span>
          </div>
          <div className="flex items-center gap-3 text-sm text-muted-foreground">
            <span className="hidden sm:inline">{username}</span>
            <button onClick={onSignOut} className="p-2 hover:text-foreground" aria-label="Sign out"><LogOut className="w-4 h-4" /></button>
          </div>
        </div>
      </header>
      <main className="max-w-2xl mx-auto px-4 pt-6">{children}</main>
    </div>
  );
}

/* ------------------------------- Application ------------------------------- */

export function ApplyForm({
  userId, username, existing, onSaved, onSignOut,
}: { userId: string; username: string; existing: Application | null; onSaved: () => void; onSignOut: () => void }) {
  const [name, setName] = useState(existing?.artist_name ?? "");
  const [genre, setGenre] = useState(existing?.genre ?? "");
  const [description, setDescription] = useState(existing?.description ?? "");
  const [photo, setPhoto] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [taken, setTaken] = useState(false);

  const preview = useMemo(() => (photo ? URL.createObjectURL(photo) : null), [photo]);
  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview); }, [preview]);
  const shown = preview || existing?.image_url || null;

  useEffect(() => {
    const n = name.trim();
    if (n.length < 2) return setTaken(false);
    const t = setTimeout(async () => {
      const { data } = await supabase.from("artists").select("id").ilike("name", n.replace(/[%_]/g, "\\$&")).limit(1);
      setTaken((data ?? []).length > 0);
    }, 400);
    return () => clearTimeout(t);
  }, [name]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!shown) return toast.error("Add an artist profile picture");
    setBusy(true);
    try {
      let imageUrl = existing?.image_url ?? null;
      if (photo) imageUrl = await uploadFile("covers", await shrinkImage(photo), `${name}_photo`, `applications/${userId}`);
      const row = {
        artist_name: name.trim(), genre: genre.trim() || null, description: description.trim() || null,
        image_url: imageUrl, status: "pending",
      };
      const { error } = existing
        ? await supabase.from("artist_applications").update(row).eq("user_id", userId)
        : await supabase.from("artist_applications").insert({ ...row, user_id: userId });
      if (error) throw new Error(error.message);
      toast.success("Request sent", { description: "You will be able to upload once it is approved." });
      onSaved();
    } catch (err: any) {
      toast.error("Could not send your request", { description: err.message });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Shell username={username} onSignOut={onSignOut}>
      <form onSubmit={submit} className="space-y-5">
        <div>
          <h2 className="text-lg font-bold">{existing ? "Update your request" : "Become an artist on Sommyart"}</h2>
          <p className="text-sm text-muted-foreground">Tell us about you. Once the Sommyart team approves you, you can upload your own tracks and albums.</p>
        </div>
        {existing?.status === "rejected" && (
          <div className="rounded-xl border border-destructive/40 bg-destructive/10 p-3 text-sm">
            <div className="font-medium flex items-center gap-1"><XCircle className="w-4 h-4" /> Your last request was not approved</div>
            {existing.admin_note && <p className="mt-1 text-muted-foreground">{existing.admin_note}</p>}
            <p className="mt-1 text-muted-foreground">Update your details and send it again.</p>
          </div>
        )}
        <div className="space-y-2">
          <Label>Artist profile picture</Label>
          <label className="flex items-center gap-4 cursor-pointer glass rounded-xl p-3 hover:border-primary/40 transition">
            {shown ? <img src={shown} alt="" className="w-20 h-20 rounded-full object-cover bg-muted shrink-0" /> :
              <div className="w-20 h-20 rounded-full bg-muted flex items-center justify-center shrink-0"><ImagePlus className="w-7 h-7 text-muted-foreground" /></div>}
            <div className="text-sm">
              <div className="font-medium">{photo ? photo.name : shown ? "Change picture" : "Choose a picture"}</div>
              <div className="text-xs text-muted-foreground">A clear photo or logo of the artist</div>
            </div>
            <input type="file" accept="image/*" className="hidden" onChange={(e) => setPhoto(e.target.files?.[0] ?? null)} />
          </label>
        </div>
        <div className="space-y-2">
          <Label htmlFor="an">Artist name</Label>
          <Input id="an" value={name} onChange={(e) => setName(e.target.value)} minLength={2} maxLength={60} required />
          {taken && !existing?.artist_id && (
            <p className="text-xs text-primary">An artist with this name already exists on Sommyart. If that is you, still send the request and the team can link you to it.</p>
          )}
        </div>
        <div className="space-y-2">
          <Label htmlFor="ag">Genre</Label>
          <Input id="ag" value={genre} onChange={(e) => setGenre(e.target.value)} maxLength={80} placeholder="Afrobeat, Gospel, R&B…" required />
        </div>
        <div className="space-y-2">
          <Label htmlFor="ad">About you and your music</Label>
          <Textarea id="ad" rows={5} maxLength={1500} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Who are you and what kind of songs will you share?" required />
          <div className="text-xs text-muted-foreground text-right">{description.length}/1500</div>
        </div>
        <Button type="submit" className="w-full h-12 text-base" disabled={busy}>
          {busy && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}{existing ? "Send again" : "Send request"}
        </Button>
      </form>
    </Shell>
  );
}

export function WaitingScreen({ app, username, onEdit, onRefresh, onSignOut }: {
  app: Application; username: string; onEdit: () => void; onRefresh: () => void; onSignOut: () => void;
}) {
  const paused = app.status === "suspended";
  return (
    <Shell username={username} onSignOut={onSignOut}>
      <div className="glass rounded-2xl p-6 text-center space-y-4">
        {paused ? <PauseCircle className="w-10 h-10 mx-auto text-orange-400" /> : <Clock className="w-10 h-10 mx-auto text-primary" />}
        <h2 className="text-lg font-bold">{paused ? "Your artist access is paused" : "Waiting for approval"}</h2>
        <p className="text-sm text-muted-foreground">
          {paused
            ? "The Sommyart team has paused uploads on your account. Your songs stay available to listeners. Please contact the team to be restored."
            : `Your request for "${app.artist_name}" has been sent. You can upload tracks and albums as soon as it is approved. Check back here later.`}
        </p>
        <div className="flex gap-2 justify-center flex-wrap">
          <Button variant="secondary" onClick={onRefresh}>Check again</Button>
          {!paused && <Button variant="secondary" onClick={onEdit}><Pencil className="w-4 h-4 mr-1" />Edit request</Button>}
        </div>
      </div>
    </Shell>
  );
}

/* --------------------------------- Portal ---------------------------------- */

function MyTracks({ owner, artists, refreshKey, onChanged }: { owner: Owner; artists: Artist[]; refreshKey: number; onChanged: () => void }) {
  const [songs, setSongs] = useState<SongRow[]>([]);
  const [albums, setAlbums] = useState<AlbumRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [edit, setEdit] = useState<SongRow | null>(null);
  const [lyricsFor, setLyricsFor] = useState<SongRow | null>(null);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const [s, a] = await Promise.all([
        supabase.from("songs").select("id,title,artist,genre,cover_art_url,audio_url,uploaded_at,album_id,track_number,description,artist_id")
          .eq("artist_id", owner.artistId).order("uploaded_at", { ascending: false }),
        supabase.from("albums").select("id,title,artist_name,cover_art_url,description,genre,released_at").eq("artist_id", owner.artistId),
      ]);
      setSongs(s.data ?? []);
      setAlbums(a.data ?? []);
      setLoading(false);
    })();
  }, [owner.artistId, refreshKey]);

  if (loading) return <div className="py-10 flex justify-center"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>;
  const albumName = (id: string | null) => albums.find((a) => a.id === id)?.title;

  return (
    <div className="space-y-2">
      {lyricsFor && <LyricsDialog song={lyricsFor} onClose={() => setLyricsFor(null)} onSaved={onChanged} />}
      {edit && <EditSongDialog song={edit} albums={albums} artists={artists} owner={owner} onClose={() => setEdit(null)} onSaved={onChanged} />}
      <h3 className="text-sm font-semibold tracking-wider">YOUR TRACKS ({songs.length})</h3>
      {songs.length === 0 && <p className="text-sm text-muted-foreground">Nothing uploaded yet. Use Single or Album to publish your first track.</p>}
      {songs.map((s) => (
        <div key={s.id} className="glass rounded-xl p-3 flex items-center gap-3">
          <img src={s.cover_art_url || PLACEHOLDER} alt="" className="w-11 h-11 rounded-lg object-cover" />
          <div className="flex-1 min-w-0">
            <div className="font-medium truncate">{s.title}</div>
            <div className="text-xs text-muted-foreground truncate">
              {s.genre ? `${s.genre} · ` : ""}{s.album_id ? `${albumName(s.album_id) ?? "Album"} #${s.track_number ?? ""} · ` : ""}{new Date(s.uploaded_at).toLocaleDateString()}
            </div>
          </div>
          <button onClick={() => setLyricsFor(s)} className="p-2 text-muted-foreground hover:text-primary" aria-label={`Lyrics for ${s.title}`}><Mic2 className="w-4 h-4" /></button>
          <button onClick={() => setEdit(s)} className="p-2 text-muted-foreground hover:text-primary" aria-label={`Edit ${s.title}`}><Pencil className="w-4 h-4" /></button>
        </div>
      ))}
      <p className="text-xs text-muted-foreground pt-1">Changes show for every listener as soon as you save. To remove a track, contact the Sommyart team.</p>
    </div>
  );
}

function ProfileEditor({ owner, onChanged }: { owner: Owner; onChanged: () => void }) {
  const [loaded, setLoaded] = useState(false);
  const [bio, setBio] = useState("");
  const [origin, setOrigin] = useState("");
  const [genre, setGenre] = useState("");
  const [image, setImage] = useState<string | null>(null);
  const [photo, setPhoto] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    supabase.from("artists").select("bio,origin,genre,image_url").eq("id", owner.artistId).maybeSingle().then(({ data }: any) => {
      setBio(data?.bio ?? ""); setOrigin(data?.origin ?? ""); setGenre(data?.genre ?? ""); setImage(data?.image_url ?? null); setLoaded(true);
    });
  }, [owner.artistId]);

  const preview = useMemo(() => (photo ? URL.createObjectURL(photo) : null), [photo]);
  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview); }, [preview]);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      const patch: Record<string, unknown> = {
        bio: bio.trim() || null, origin: origin.trim() || null, genre: genre.trim() || null, updated_at: new Date().toISOString(),
      };
      if (photo) patch.image_url = await uploadFile("covers", await shrinkImage(photo), `${owner.artistName}_photo`, owner.folder);
      const { error } = await supabase.from("artists").update(patch).eq("id", owner.artistId);
      if (error) throw new Error(error.message);
      if (typeof patch.image_url === "string") setImage(patch.image_url);
      setPhoto(null);
      toast.success("Profile updated");
      onChanged();
    } catch (err: any) {
      toast.error("Could not save", { description: err.message });
    } finally {
      setBusy(false);
    }
  };

  if (!loaded) return <div className="py-10 flex justify-center"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>;
  const shown = preview || image;
  return (
    <form onSubmit={save} className="space-y-5">
      <div className="space-y-2">
        <Label>Profile picture</Label>
        <label className="flex items-center gap-4 cursor-pointer glass rounded-xl p-3 hover:border-primary/40 transition">
          {shown ? <img src={shown} alt="" className="w-20 h-20 rounded-full object-cover bg-muted shrink-0" /> :
            <div className="w-20 h-20 rounded-full bg-muted flex items-center justify-center shrink-0"><User className="w-7 h-7 text-muted-foreground" /></div>}
          <div className="text-sm"><div className="font-medium">{photo ? photo.name : "Change picture"}</div></div>
          <input type="file" accept="image/*" className="hidden" onChange={(e) => setPhoto(e.target.files?.[0] ?? null)} />
        </label>
      </div>
      <div className="space-y-2"><Label>Artist name</Label><Input value={owner.artistName} disabled /><p className="text-xs text-muted-foreground">The name is fixed so your songs keep matching. Ask the Sommyart team to change it.</p></div>
      <div className="space-y-2"><Label>Genre</Label><Input value={genre} onChange={(e) => setGenre(e.target.value)} maxLength={80} /></div>
      <div className="space-y-2">
        <Label>About you</Label>
        <Textarea rows={6} maxLength={1500} value={bio} onChange={(e) => setBio(e.target.value)} />
      </div>
      <div className="space-y-2"><Label>Based in (optional)</Label><Input value={origin} onChange={(e) => setOrigin(e.target.value)} placeholder="Lagos, Nigeria" /></div>
      <Button type="submit" className="w-full h-12" disabled={busy}>{busy && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}Save profile</Button>
    </form>
  );
}

export function ArtistPortal({ owner, username, onSignOut }: { owner: Owner; username: string; onSignOut: () => void }) {
  const [artists, setArtists] = useState<Artist[]>([]);
  const [refreshKey, setRefreshKey] = useState(0);
  const bump = () => setRefreshKey((k) => k + 1);

  useEffect(() => {
    supabase.from("artists").select("id,name").order("name").then(({ data }: any) => setArtists(data ?? []));
  }, [refreshKey]);

  return (
    <Shell username={username} onSignOut={onSignOut}>
      <p className="text-sm text-muted-foreground mb-4">Signed in as <span className="text-foreground font-medium">{owner.artistName}</span></p>
      <Tabs defaultValue="single">
        <TabsList className="grid grid-cols-4 w-full mb-6">
          <TabsTrigger value="single">Single</TabsTrigger>
          <TabsTrigger value="album">Album</TabsTrigger>
          <TabsTrigger value="tracks">My tracks</TabsTrigger>
          <TabsTrigger value="profile">Profile</TabsTrigger>
        </TabsList>
        <TabsContent value="single"><SingleUpload artists={artists} owner={owner} onPublished={bump} /></TabsContent>
        <TabsContent value="album"><AlbumUpload artists={artists} owner={owner} onPublished={bump} /></TabsContent>
        <TabsContent value="tracks"><MyTracks owner={owner} artists={artists} refreshKey={refreshKey} onChanged={bump} /></TabsContent>
        <TabsContent value="profile"><ProfileEditor owner={owner} onChanged={bump} /></TabsContent>
      </Tabs>
      <p className="text-xs text-muted-foreground text-center mt-10">
        Everything you publish appears in Sommyart Music straight away and listeners who follow you are notified.
      </p>
    </Shell>
  );
}
