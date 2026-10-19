import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { ArrowDown, ArrowUp, ImagePlus, Loader2, Music2, UploadCloud, X, CheckCircle2, AlertCircle } from "lucide-react";
import {
  supabase, MAX_ALBUM_TRACKS, MAX_FILE_MB, AUDIO_ACCEPT, Artist, TrackDraft, Owner,
  titleFromFile, uploadFile, resolveArtist, tooBig,
} from "./lib";
import { CollabPicker, saveCollaborators } from "./Collab";

/* ------------------------------ Shared fields ----------------------------- */

export function CoverPicker({ file, onChange }: { file: File | null; onChange: (f: File | null) => void }) {
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

export function ArtistField({ value, onChange, artists }: { value: string; onChange: (v: string) => void; artists: Artist[] }) {
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

export function SingleUpload({ artists, onPublished, owner }: { artists: Artist[]; onPublished: () => void; owner?: Owner }) {
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState("");
  const [artist, setArtist] = useState(owner?.artistName ?? "Sommyart");
  const [genre, setGenre] = useState("");
  const [description, setDescription] = useState("");
  const [collabs, setCollabs] = useState<string[]>([]);
  const [cover, setCover] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [step, setStep] = useState("");
  const primaryId = owner?.artistId ?? artists.find((a) => a.name.toLowerCase() === artist.trim().toLowerCase())?.id ?? null;

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
      const coverUrl = cover ? await uploadFile("covers", cover, title + "_cover", owner?.folder) : null;
      setStep("Uploading song…");
      const audioUrl = await uploadFile("music", file, title, owner?.folder);
      setStep("Publishing…");
      const artistId = owner ? owner.artistId : await resolveArtist(artist, artists);
      const { data: row, error } = await supabase.from("songs").insert({
        title: title.trim(), artist: owner ? owner.artistName : artist.trim(), artist_id: artistId,
        genre: genre.trim() || null, description: description.trim() || null, audio_url: audioUrl, cover_art_url: coverUrl,
        uploaded_at: new Date().toISOString(),
      }).select("id").single();
      if (error) throw new Error(error.message);
      const featured = collabs.filter((c) => c !== artistId);
      if (featured.length) {
        try {
          await saveCollaborators([row.id], featured);
        } catch (err: any) {
          toast.warning("Song published, but featured artists were not saved", { description: err.message });
        }
      }
      toast.success("Published", { description: `"${title}" is live for all listeners.` });
      setFile(null); setTitle(""); setGenre(""); setDescription(""); setCollabs([]); setCover(null);
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
      {owner ? (
        <p className="text-sm text-muted-foreground">Publishing as <span className="text-foreground font-medium">{owner.artistName}</span></p>
      ) : (
        <ArtistField value={artist} onChange={setArtist} artists={artists} />
      )}
      <CollabPicker artists={artists} selected={collabs} onChange={setCollabs} excludeId={primaryId} disabled={busy} />
      <div className="space-y-2">
        <Label htmlFor="genre">Genre</Label>
        <Input id="genre" value={genre} onChange={(e) => setGenre(e.target.value)} placeholder="Afrobeat, Gospel, R&B…" />
      </div>
      <div className="space-y-2">
        <Label htmlFor="sdesc">Song description</Label>
        <Textarea id="sdesc" rows={3} maxLength={1500} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="What is this song about? (optional)" />
      </div>
      <CoverPicker file={cover} onChange={setCover} />
      <Button type="submit" className="w-full h-12 text-base" disabled={busy || !file}>
        {busy ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />{step}</> : "Publish song"}
      </Button>
    </form>
  );
}

/* ---------------------------------- Album --------------------------------- */

export function AlbumUpload({ artists, onPublished, owner }: { artists: Artist[]; onPublished: () => void; owner?: Owner }) {
  const [albumTitle, setAlbumTitle] = useState("");
  const [artist, setArtist] = useState(owner?.artistName ?? "Sommyart");
  const [genre, setGenre] = useState("");
  const [description, setDescription] = useState("");
  const [collabs, setCollabs] = useState<string[]>([]);
  const [cover, setCover] = useState<File | null>(null);
  const primaryId = owner?.artistId ?? artists.find((a) => a.name.toLowerCase() === artist.trim().toLowerCase())?.id ?? null;
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
      const coverUrl = cover ? await uploadFile("covers", cover, albumTitle + "_cover", owner?.folder) : null;

      for (let i = 0; i < tracks.length; i++) {
        const t = tracks[i];
        setStep(`Uploading song ${i + 1} of ${tracks.length}…`);
        setTrack(t.key, { status: "uploading", error: undefined });
        try {
          const url = await uploadFile("music", t.file, `${albumTitle}_${i + 1}_${t.title}`, owner?.folder);
          uploaded.push({ title: t.title.trim(), url, n: i + 1 });
          setTrack(t.key, { status: "done" });
        } catch (err: any) {
          setTrack(t.key, { status: "error", error: err.message });
          throw new Error(`"${t.title}" failed to upload: ${err.message}`);
        }
      }

      setStep("Publishing album…");
      const artistId = owner ? owner.artistId : await resolveArtist(artist, artists);
      const artistName = owner ? owner.artistName : artist.trim();
      const now = new Date().toISOString();
      const { data: album, error: aErr } = await supabase
        .from("albums")
        .insert({
          title: albumTitle.trim(), artist_name: artistName, artist_id: artistId,
          cover_art_url: coverUrl, description: description.trim() || null, genre: genre.trim() || null, released_at: now,
        })
        .select("id")
        .single();
      if (aErr) throw new Error(aErr.message);

      const { data: inserted, error: sErr } = await supabase.from("songs").insert(
        uploaded.map((u) => ({
          title: u.title, artist: artistName, artist_id: artistId, album_id: album.id, track_number: u.n,
          genre: genre.trim() || null, audio_url: u.url, cover_art_url: coverUrl, uploaded_at: now,
        })),
      ).select("id");
      if (sErr) {
        await supabase.from("albums").delete().eq("id", album.id);
        throw new Error(sErr.message);
      }
      const featured = collabs.filter((c) => c !== artistId);
      if (featured.length) {
        try {
          await saveCollaborators((inserted ?? []).map((r: { id: string }) => r.id), featured);
        } catch (err: any) {
          toast.warning("Album published, but featured artists were not saved", { description: err.message });
        }
      }

      toast.success("Album published", { description: `"${albumTitle}" with ${uploaded.length} songs is live.` });
      setAlbumTitle(""); setGenre(""); setDescription(""); setCollabs([]); setCover(null); setTracks([]);
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
      {owner ? (
        <p className="text-sm text-muted-foreground">Publishing as <span className="text-foreground font-medium">{owner.artistName}</span></p>
      ) : (
        <ArtistField value={artist} onChange={setArtist} artists={artists} />
      )}
      <CollabPicker artists={artists} selected={collabs} onChange={setCollabs} excludeId={primaryId} disabled={busy} />
      <p className="text-xs text-muted-foreground -mt-3">Featured artists are added to every song on the album.</p>
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
