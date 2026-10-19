import { useEffect, useMemo, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { ImagePlus, Loader2, Pencil, User } from "lucide-react";
import { supabase, uploadFile, shrinkImage } from "./lib";

type ArtistRow = {
  id: string;
  name: string;
  bio: string | null;
  image_url: string | null;
  origin: string | null;
  genre?: string | null;
  owner_user_id?: string | null;
};

const BIO_MAX = 1500;
const PLACEHOLDER = "/images/logo.png";

function EditArtistDialog({
  artist, onClose, onSaved,
}: { artist: ArtistRow; onClose: () => void; onSaved: () => void }) {
  const [bio, setBio] = useState(artist.bio ?? "");
  const [origin, setOrigin] = useState(artist.origin ?? "");
  const [genre, setGenre] = useState(artist.genre ?? "");
  const [photo, setPhoto] = useState<File | null>(null);
  const [removePhoto, setRemovePhoto] = useState(false);
  const [busy, setBusy] = useState(false);

  const preview = useMemo(() => (photo ? URL.createObjectURL(photo) : null), [photo]);
  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview); }, [preview]);

  const shown = preview || (removePhoto ? null : artist.image_url) || PLACEHOLDER;

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      const patch: Record<string, unknown> = {
        bio: bio.trim() || null,
        origin: origin.trim() || null,
        genre: genre.trim() || null,
        updated_at: new Date().toISOString(),
      };
      if (photo) patch.image_url = await uploadFile("covers", await shrinkImage(photo), `${artist.name}_photo`);
      else if (removePhoto) patch.image_url = null;
      const { error } = await supabase.from("artists").update(patch).eq("id", artist.id);
      if (error) throw new Error(error.message);
      toast.success("Artist updated", { description: artist.name });
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
          <DialogTitle>Edit {artist.name}</DialogTitle>
          <DialogDescription>The photo and description show on the artist's page in the app.</DialogDescription>
        </DialogHeader>
        <form onSubmit={save} className="space-y-4">
          <div className="space-y-2">
            <Label>Profile picture</Label>
            <label className="flex items-center gap-4 cursor-pointer glass rounded-xl p-3 hover:border-primary/40 transition">
              <img src={shown} alt="" className="w-20 h-20 rounded-full object-cover bg-muted shrink-0" />
              <div className="text-sm flex-1 min-w-0">
                <div className="font-medium flex items-center gap-1"><ImagePlus className="w-4 h-4" /> {photo ? "New picture chosen" : "Change picture"}</div>
                <div className="text-xs text-muted-foreground truncate">{photo ? photo.name : "Tap to pick a photo from your phone"}</div>
              </div>
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => { setPhoto(e.target.files?.[0] ?? null); setRemovePhoto(false); }}
              />
            </label>
            <div className="flex gap-4 text-xs text-muted-foreground">
              {photo && <button type="button" className="underline" onClick={() => setPhoto(null)}>Keep the old picture</button>}
              {!photo && artist.image_url && !removePhoto && (
                <button type="button" className="underline" onClick={() => setRemovePhoto(true)}>Remove picture</button>
              )}
              {removePhoto && <button type="button" className="underline" onClick={() => setRemovePhoto(false)}>Undo remove</button>}
            </div>
          </div>

          <div className="space-y-2">
            <Label>Description</Label>
            <Textarea
              value={bio}
              onChange={(e) => setBio(e.target.value.slice(0, BIO_MAX))}
              rows={7}
              placeholder="Tell listeners who this artist is…"
            />
            <div className="text-xs text-muted-foreground text-right">{bio.length}/{BIO_MAX}</div>
          </div>

          <div className="space-y-2">
            <Label>Genre (optional)</Label>
            <Input value={genre} onChange={(e) => setGenre(e.target.value)} placeholder="Afrobeat, Gospel…" />
          </div>

          <div className="space-y-2">
            <Label>Based in (optional)</Label>
            <Input value={origin} onChange={(e) => setOrigin(e.target.value)} placeholder="Enugu, Nigeria" />
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

export function ArtistsPanel({ refreshKey, onChanged }: { refreshKey: number; onChanged: () => void }) {
  const [artists, setArtists] = useState<ArtistRow[]>([]);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [edit, setEdit] = useState<ArtistRow | null>(null);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const [a, s] = await Promise.all([
        supabase.from("artists").select("id,name,bio,image_url,origin,genre,owner_user_id").order("name"),
        supabase.from("songs").select("artist_id"),
      ]);
      const c: Record<string, number> = {};
      for (const r of s.data ?? []) if (r.artist_id) c[r.artist_id] = (c[r.artist_id] ?? 0) + 1;
      setArtists(a.data ?? []);
      setCounts(c);
      setLoading(false);
    })();
  }, [refreshKey]);

  if (loading) return <div className="py-10 flex justify-center"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>;

  return (
    <div className="space-y-3">
      {edit && <EditArtistDialog artist={edit} onClose={() => setEdit(null)} onSaved={onChanged} />}
      <h3 className="text-sm font-semibold tracking-wider">ARTISTS</h3>
      {artists.length === 0 && <p className="text-sm text-muted-foreground">No artists yet. They are created automatically when you publish a song.</p>}
      {artists.map((a) => (
        <div key={a.id} className="glass rounded-xl p-3 flex items-center gap-3">
          {a.image_url ? (
            <img src={a.image_url} alt="" className="w-14 h-14 rounded-full object-cover bg-muted shrink-0" />
          ) : (
            <div className="w-14 h-14 rounded-full bg-muted flex items-center justify-center shrink-0"><User className="w-6 h-6 text-muted-foreground" /></div>
          )}
          <div className="flex-1 min-w-0">
            <div className="font-medium truncate">{a.name}</div>
            <div className="text-xs text-muted-foreground truncate">
              {counts[a.id] ?? 0} songs{a.genre ? ` · ${a.genre}` : ""}{a.origin ? ` · ${a.origin}` : ""}{a.owner_user_id ? " · artist account" : ""}
            </div>
            <div className="text-xs text-muted-foreground line-clamp-1">{a.bio ? a.bio : "No description yet"}</div>
          </div>
          <button onClick={() => setEdit(a)} className="p-2 text-muted-foreground hover:text-primary" aria-label={`Edit ${a.name}`}><Pencil className="w-4 h-4" /></button>
        </div>
      ))}
      <p className="text-xs text-muted-foreground pt-1">
        Tap the pencil to change an artist's picture, description or location. Names stay the same so songs keep matching.
      </p>
    </div>
  );
}
