import { useEffect, useMemo, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { ArrowDown, ArrowUp, ImagePlus, Loader2, Music2, Plus, RefreshCw, Undo2, UploadCloud, X } from "lucide-react";
import {
  supabase, Artist, AUDIO_ACCEPT, MAX_ALBUM_TRACKS, MAX_FILE_MB, Owner, resolveArtist, titleFromFile, tooBig, uploadFile,
} from "./lib";
import { CollabPicker, saveCollaborators } from "./Collab";

export type SongRow = {
  id: string; title: string; artist: string; genre: string | null; cover_art_url: string | null;
  audio_url: string; uploaded_at: string; album_id: string | null; track_number: number | null;
  description?: string | null; artist_id?: string | null;
};
export type AlbumRow = {
  id: string; title: string; artist_name: string; cover_art_url: string | null;
  description?: string | null; genre?: string | null; released_at: string;
};

/* --------------------------------- shared --------------------------------- */

function CoverField({ current, file, onFile }: { current: string | null; file: File | null; onFile: (f: File | null) => void }) {
  const preview = useMemo(() => (file ? URL.createObjectURL(file) : null), [file]);
  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview); }, [preview]);
  const shown = preview || current || "/images/logo.png";
  return (
    <div className="space-y-2">
      <Label>Cover art</Label>
      <label className="flex items-center gap-3 cursor-pointer glass rounded-xl p-3 hover:border-primary/40 transition">
        <img src={shown} alt="" className="w-16 h-16 rounded-lg object-cover bg-muted" />
        <div className="text-sm flex-1">
          <div className="font-medium flex items-center gap-1"><ImagePlus className="w-4 h-4" /> {file ? "New cover chosen" : "Change cover"}</div>
          <div className="text-xs text-muted-foreground truncate">{file ? file.name : "Tap to pick a new image"}</div>
        </div>
        <input type="file" accept="image/*" className="hidden" onChange={(e) => onFile(e.target.files?.[0] ?? null)} />
      </label>
      {file && <button type="button" className="text-xs text-muted-foreground underline" onClick={() => onFile(null)}>Keep the old cover</button>}
    </div>
  );
}

function ArtistInput({ value, onChange, artists }: { value: string; onChange: (v: string) => void; artists: Artist[] }) {
  return (
    <>
      <Input list="edit-artist-list" value={value} onChange={(e) => onChange(e.target.value)} required />
      <datalist id="edit-artist-list">{artists.map((a) => <option key={a.id} value={a.name} />)}</datalist>
    </>
  );
}

const pickAudio = (f: File | null | undefined) => {
  if (!f) return null;
  if (tooBig(f)) { toast.error(`${f.name} is over ${MAX_FILE_MB} MB`); return null; }
  return f;
};

/* -------------------------------- Edit song -------------------------------- */

export function EditSongDialog({
  song, albums, artists, onClose, onSaved, owner,
}: { song: SongRow | null; albums: AlbumRow[]; artists: Artist[]; onClose: () => void; onSaved: () => void; owner?: Owner }) {
  const [title, setTitle] = useState("");
  const [artist, setArtist] = useState("");
  const [genre, setGenre] = useState("");
  const [description, setDescription] = useState("");
  const [collabs, setCollabs] = useState<string[]>([]);
  const [collabsLoaded, setCollabsLoaded] = useState(false);
  const [albumId, setAlbumId] = useState<string>("");
  const [cover, setCover] = useState<File | null>(null);
  const [audio, setAudio] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!song) return;
    setTitle(song.title); setArtist(song.artist); setGenre(song.genre ?? "");
    setDescription(song.description ?? "");
    setAlbumId(song.album_id ?? ""); setCover(null); setAudio(null);
    setCollabsLoaded(false); setCollabs([]);
    let cancelled = false;
    supabase.from("song_artists").select("artist_id").eq("song_id", song.id).then(({ data }: any) => {
      if (cancelled) return;
      setCollabs((data ?? []).map((r: { artist_id: string }) => r.artist_id));
      setCollabsLoaded(true);
    });
    return () => { cancelled = true; };
  }, [song]);

  if (!song) return null;

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      const artistId = owner ? owner.artistId : await resolveArtist(artist, artists);
      const patch: Record<string, unknown> = {
        title: title.trim(), artist: owner ? owner.artistName : artist.trim(), genre: genre.trim() || null,
        description: description.trim() || null,
        artist_id: artistId,
      };
      if (cover) patch.cover_art_url = await uploadFile("covers", cover, title + "_cover", owner?.folder);
      if (audio) patch.audio_url = await uploadFile("music", audio, title, owner?.folder);
      if ((albumId || null) !== song.album_id) {
        if (albumId) {
          const { count } = await supabase.from("songs").select("id", { count: "exact", head: true }).eq("album_id", albumId);
          if ((count ?? 0) >= MAX_ALBUM_TRACKS) throw new Error(`That album already has ${MAX_ALBUM_TRACKS} songs`);
          patch.album_id = albumId;
          patch.track_number = (count ?? 0) + 1;
        } else {
          patch.album_id = null;
          patch.track_number = null;
        }
      }
      const { error } = await supabase.from("songs").update(patch).eq("id", song.id);
      if (error) throw new Error(error.message);
      if (collabsLoaded) await saveCollaborators([song.id], collabs.filter((c) => c !== artistId));
      toast.success("Song updated", { description: title });
      onSaved();
      onClose();
    } catch (err: any) {
      toast.error("Could not save", { description: err.message });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open onOpenChange={(o) => !o && !busy && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit song</DialogTitle>
          <DialogDescription>Changes show in the app as soon as you save.</DialogDescription>
        </DialogHeader>
        <form onSubmit={save} className="space-y-4">
          <div className="space-y-2"><Label>Title</Label><Input value={title} onChange={(e) => setTitle(e.target.value)} required /></div>
          {!owner && <div className="space-y-2"><Label>Artist</Label><ArtistInput value={artist} onChange={setArtist} artists={artists} /></div>}
          {collabsLoaded && (
            <CollabPicker artists={artists} selected={collabs} onChange={setCollabs} disabled={busy}
              excludeId={owner?.artistId ?? song.artist_id ?? artists.find((a) => a.name.toLowerCase() === artist.trim().toLowerCase())?.id} />
          )}
          <div className="space-y-2"><Label>Genre</Label><Input value={genre} onChange={(e) => setGenre(e.target.value)} placeholder="Afrobeat, Gospel, R&B…" /></div>
          <div className="space-y-2">
            <Label>Song description</Label>
            <Textarea rows={4} maxLength={1500} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="What is this song about?" />
          </div>
          <div className="space-y-2">
            <Label>Album</Label>
            <select
              value={albumId} onChange={(e) => setAlbumId(e.target.value)}
              className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm"
            >
              <option value="">No album (single)</option>
              {albums.map((a) => <option key={a.id} value={a.id}>{a.title}</option>)}
            </select>
          </div>
          <CoverField current={song.cover_art_url} file={cover} onFile={setCover} />
          <div className="space-y-2">
            <Label>Audio file</Label>
            <label className="flex items-center gap-3 cursor-pointer glass rounded-xl p-3 hover:border-primary/40 transition text-sm">
              <RefreshCw className="w-5 h-5 text-primary shrink-0" />
              <span className="truncate">{audio ? audio.name : "Keep current audio (tap to replace with a new file)"}</span>
              <input type="file" accept={AUDIO_ACCEPT} className="hidden" onChange={(e) => setAudio(pickAudio(e.target.files?.[0]))} />
            </label>
          </div>
          <div className="flex gap-2 pt-2">
            <Button type="button" variant="secondary" className="flex-1" onClick={onClose} disabled={busy}>Cancel</Button>
            <Button type="submit" className="flex-1" disabled={busy}>{busy && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}Save</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/* -------------------------------- Edit album ------------------------------- */

type Row =
  | { key: string; kind: "existing"; song: SongRow; title: string; replace: File | null; removed: boolean }
  | { key: string; kind: "attach"; song: SongRow; title: string; replace: File | null; removed: boolean }
  | { key: string; kind: "new"; file: File; title: string; removed: boolean };

export function EditAlbumDialog({
  album, songs, artists, onClose, onSaved,
}: { album: AlbumRow | null; songs: SongRow[]; artists: Artist[]; onClose: () => void; onSaved: () => void }) {
  const [title, setTitle] = useState("");
  const [artist, setArtist] = useState("");
  const [genre, setGenre] = useState("");
  const [description, setDescription] = useState("");
  const [cover, setCover] = useState<File | null>(null);
  const [rows, setRows] = useState<Row[]>([]);
  const [attachId, setAttachId] = useState("");
  const [busy, setBusy] = useState(false);
  const [step, setStep] = useState("");

  useEffect(() => {
    if (!album) return;
    setTitle(album.title); setArtist(album.artist_name); setGenre(album.genre ?? "");
    setDescription(album.description ?? ""); setCover(null); setAttachId("");
    setRows(
      songs
        .filter((s) => s.album_id === album.id)
        .sort((a, b) => (a.track_number ?? 99) - (b.track_number ?? 99))
        .map((s) => ({ key: s.id, kind: "existing" as const, song: s, title: s.title, replace: null, removed: false })),
    );
  }, [album, songs]);

  if (!album) return null;

  const live = rows.filter((r) => !r.removed);
  const slotsLeft = MAX_ALBUM_TRACKS - live.length;
  const singles = songs.filter((s) => !s.album_id && !rows.some((r) => r.kind !== "new" && (r as { song: SongRow }).song.id === s.id));

  const patchRow = (key: string, patch: Partial<Row>) => setRows((rs) => rs.map((r) => (r.key === key ? ({ ...r, ...patch } as Row) : r)));
  const move = (key: string, d: -1 | 1) =>
    setRows((rs) => {
      const i = rs.findIndex((r) => r.key === key);
      let j = i + d;
      while (j >= 0 && j < rs.length && rs[j].removed) j += d;
      if (i < 0 || j < 0 || j >= rs.length) return rs;
      const c = [...rs];
      [c[i], c[j]] = [c[j], c[i]];
      return c;
    });

  const addFiles = (list: FileList | null) => {
    if (!list) return;
    const files = Array.from(list).map(pickAudio).filter(Boolean) as File[];
    if (files.length > slotsLeft) toast.warning(`Only ${slotsLeft} slot(s) left. Added the first ${slotsLeft}.`);
    setRows((rs) => [
      ...rs,
      ...files.slice(0, Math.max(slotsLeft, 0)).map((f) => ({ key: `new-${f.name}-${Math.random()}`, kind: "new" as const, file: f, title: titleFromFile(f.name), removed: false })),
    ]);
  };

  const attach = () => {
    const s = songs.find((x) => x.id === attachId);
    if (!s || slotsLeft <= 0) return;
    setRows((rs) => [...rs, { key: `att-${s.id}`, kind: "attach", song: s, title: s.title, replace: null, removed: false }]);
    setAttachId("");
  };

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (live.some((r) => !r.title.trim())) return toast.error("Every song needs a title");
    setBusy(true);
    try {
      setStep("Saving album…");
      const artistId = await resolveArtist(artist, artists);
      let coverUrl = album.cover_art_url;
      if (cover) {
        setStep("Uploading cover…");
        coverUrl = await uploadFile("covers", cover, title + "_cover");
      }
      const { error: aErr } = await supabase.from("albums").update({
        title: title.trim(), artist_name: artist.trim(), artist_id: artistId,
        genre: genre.trim() || null, description: description.trim() || null, cover_art_url: coverUrl,
      }).eq("id", album.id);
      if (aErr) throw new Error(aErr.message);

      // Songs taken out of the album stay in the library as singles.
      for (const r of rows) {
        if (!r.removed || r.kind !== "existing") continue;
        const { error } = await supabase.from("songs").update({ album_id: null, track_number: null }).eq("id", r.song.id);
        if (error) throw new Error(error.message);
      }

      const now = new Date().toISOString();
      for (let i = 0; i < live.length; i++) {
        const r = live[i];
        const n = i + 1;
        if (r.kind === "new") {
          setStep(`Uploading new song ${r.title}…`);
          const url = await uploadFile("music", r.file, `${title}_${n}_${r.title}`);
          const { error } = await supabase.from("songs").insert({
            title: r.title.trim(), artist: artist.trim(), artist_id: artistId, album_id: album.id, track_number: n,
            genre: genre.trim() || null, audio_url: url, cover_art_url: coverUrl, uploaded_at: now,
          });
          if (error) throw new Error(error.message);
        } else {
          const patch: Record<string, unknown> = { title: r.title.trim(), album_id: album.id, track_number: n, artist: artist.trim(), artist_id: artistId };
          if (r.replace) {
            setStep(`Replacing audio for ${r.title}…`);
            patch.audio_url = await uploadFile("music", r.replace, `${title}_${n}_${r.title}`);
          }
          // Keep album artwork in sync for tracks that used the album cover.
          if (cover && (!r.song.cover_art_url || r.song.cover_art_url === album.cover_art_url || r.song.cover_art_url === "/images/logo.png")) {
            patch.cover_art_url = coverUrl;
          }
          if (genre.trim() && (!r.song.genre || r.song.genre === album.genre)) patch.genre = genre.trim();
          const { error } = await supabase.from("songs").update(patch).eq("id", r.song.id);
          if (error) throw new Error(error.message);
        }
      }
      toast.success("Album updated", { description: `${title} · ${live.length} songs` });
      onSaved();
      onClose();
    } catch (err: any) {
      toast.error("Could not save the album", { description: `${err.message}. Some changes may already be saved; check the Library and try again.` });
      onSaved();
    } finally {
      setBusy(false);
      setStep("");
    }
  };

  let n = 0;
  return (
    <Dialog open onOpenChange={(o) => !o && !busy && onClose()}>
      <DialogContent className="max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit album</DialogTitle>
          <DialogDescription>Reorder, remove, replace or add songs, then press Save.</DialogDescription>
        </DialogHeader>
        <form onSubmit={save} className="space-y-4">
          <div className="space-y-2"><Label>Album title</Label><Input value={title} onChange={(e) => setTitle(e.target.value)} required /></div>
          <div className="space-y-2"><Label>Artist</Label><ArtistInput value={artist} onChange={setArtist} artists={artists} /></div>
          <div className="space-y-2"><Label>Genre</Label><Input value={genre} onChange={(e) => setGenre(e.target.value)} /></div>
          <div className="space-y-2"><Label>Description</Label><Textarea rows={3} value={description} onChange={(e) => setDescription(e.target.value)} /></div>
          <CoverField current={album.cover_art_url} file={cover} onFile={setCover} />

          <div className="space-y-2">
            <Label>Songs ({live.length}/{MAX_ALBUM_TRACKS})</Label>
            {rows.map((r) => {
              if (r.removed) {
                return (
                  <div key={r.key} className="rounded-xl border border-dashed border-border p-2 flex items-center gap-2 text-sm text-muted-foreground">
                    <span className="flex-1 truncate line-through">{r.title}</span>
                    <span className="text-[11px]">{r.kind === "existing" ? "will become a single" : "won't be added"}</span>
                    <button type="button" onClick={() => patchRow(r.key, { removed: false })} className="p-1 hover:text-foreground" aria-label="Undo"><Undo2 className="w-4 h-4" /></button>
                  </div>
                );
              }
              n += 1;
              const replacing = r.kind !== "new" && r.replace;
              return (
                <div key={r.key} className="glass rounded-xl p-2.5 space-y-2">
                  <div className="flex items-center gap-2">
                    <span className="w-6 text-center text-sm font-bold text-primary">{n}</span>
                    <Input value={r.title} onChange={(e) => patchRow(r.key, { title: e.target.value })} className="h-9 flex-1" disabled={busy} />
                    <div className="flex flex-col">
                      <button type="button" onClick={() => move(r.key, -1)} className="p-0.5" aria-label="Move up" disabled={busy}><ArrowUp className="w-4 h-4" /></button>
                      <button type="button" onClick={() => move(r.key, 1)} className="p-0.5" aria-label="Move down" disabled={busy}><ArrowDown className="w-4 h-4" /></button>
                    </div>
                    <button type="button" onClick={() => patchRow(r.key, { removed: true })} className="p-1 text-muted-foreground hover:text-destructive" aria-label="Remove from album" disabled={busy}><X className="w-4 h-4" /></button>
                  </div>
                  <div className="flex items-center gap-2 pl-8 text-[11px] text-muted-foreground">
                    {r.kind === "new" ? (
                      <><UploadCloud className="w-3.5 h-3.5 text-primary" /> New upload: {r.file.name}</>
                    ) : (
                      <>
                        <Music2 className="w-3.5 h-3.5" />
                        <span className="flex-1 truncate">{replacing ? `Replacing with ${r.replace!.name}` : r.kind === "attach" ? "Existing song, joining this album" : "Current audio"}</span>
                        <label className="text-primary cursor-pointer whitespace-nowrap">
                          {replacing ? "Change" : "Replace audio"}
                          <input type="file" accept={AUDIO_ACCEPT} className="hidden" disabled={busy}
                            onChange={(e) => patchRow(r.key, { replace: pickAudio(e.target.files?.[0]) } as Partial<Row>)} />
                        </label>
                        {replacing && <button type="button" className="underline" onClick={() => patchRow(r.key, { replace: null } as Partial<Row>)}>undo</button>}
                      </>
                    )}
                  </div>
                </div>
              );
            })}

            {slotsLeft > 0 && !busy && (
              <div className="grid gap-2 pt-1">
                <label className="flex items-center justify-center gap-2 cursor-pointer glass rounded-xl p-3 text-sm hover:border-primary/40 transition">
                  <UploadCloud className="w-4 h-4 text-primary" /> Upload new songs ({slotsLeft} slot{slotsLeft === 1 ? "" : "s"} left)
                  <input type="file" multiple accept={AUDIO_ACCEPT} className="hidden" onChange={(e) => { addFiles(e.target.files); e.target.value = ""; }} />
                </label>
                {singles.length > 0 && (
                  <div className="flex gap-2">
                    <select value={attachId} onChange={(e) => setAttachId(e.target.value)} className="flex-1 h-10 rounded-md border border-input bg-background px-3 text-sm">
                      <option value="">Add a song you already uploaded…</option>
                      {singles.map((s) => <option key={s.id} value={s.id}>{s.title} · {s.artist}</option>)}
                    </select>
                    <Button type="button" variant="secondary" onClick={attach} disabled={!attachId}><Plus className="w-4 h-4" /></Button>
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="flex gap-2 pt-2 sticky bottom-0 bg-background/95 py-2">
            <Button type="button" variant="secondary" className="flex-1" onClick={onClose} disabled={busy}>Cancel</Button>
            <Button type="submit" className="flex-1" disabled={busy || live.length === 0}>
              {busy ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />{step}</> : "Save album"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
