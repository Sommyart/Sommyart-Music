import { useMemo, useState } from "react";
import { Label } from "@/components/ui/label";
import { Users, X } from "lucide-react";
import { supabase, Artist } from "./lib";

/** Pick existing artists to feature on a song or album ("feat."). */
export function CollabPicker({
  artists, selected, onChange, excludeId, disabled,
}: { artists: Artist[]; selected: string[]; onChange: (ids: string[]) => void; excludeId?: string | null; disabled?: boolean }) {
  const [q, setQ] = useState("");
  const options = useMemo(
    () => artists.filter((a) => a.id !== excludeId && !selected.includes(a.id)),
    [artists, excludeId, selected],
  );
  const matches = q.trim()
    ? options.filter((a) => a.name.toLowerCase().includes(q.trim().toLowerCase())).slice(0, 6)
    : [];
  const chosen = selected.map((id) => artists.find((a) => a.id === id)).filter(Boolean) as Artist[];

  return (
    <div className="space-y-2">
      <Label className="flex items-center gap-1"><Users className="w-4 h-4" /> Featuring (optional)</Label>
      {chosen.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {chosen.map((a) => (
            <span key={a.id} className="inline-flex items-center gap-1 rounded-full bg-primary/15 text-primary text-xs pl-3 pr-1 py-1">
              feat. {a.name}
              <button type="button" disabled={disabled} onClick={() => onChange(selected.filter((x) => x !== a.id))} className="p-1" aria-label={`Remove ${a.name}`}>
                <X className="w-3 h-3" />
              </button>
            </span>
          ))}
        </div>
      )}
      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        disabled={disabled}
        placeholder="Search an artist already on Sommyart"
        aria-label="Search artists to feature"
        className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm"
      />
      {matches.length > 0 && (
        <div className="glass rounded-xl divide-y divide-border/40 overflow-hidden">
          {matches.map((a) => (
            <button
              key={a.id}
              type="button"
              onClick={() => { onChange([...selected, a.id]); setQ(""); }}
              className="w-full text-left px-3 py-2 text-sm hover:bg-primary/10"
            >
              {a.name}
            </button>
          ))}
        </div>
      )}
      {q.trim() && matches.length === 0 && (
        <p className="text-xs text-muted-foreground">No other artist with that name yet. Only existing artists can be featured.</p>
      )}
    </div>
  );
}

/** Replaces the featured artists of the given songs with the chosen ids. */
export async function saveCollaborators(songIds: string[], artistIds: string[]) {
  if (!songIds.length) return;
  const { error: delErr } = await supabase.from("song_artists").delete().in("song_id", songIds);
  if (delErr) throw new Error(`Could not update featured artists: ${delErr.message}`);
  if (!artistIds.length) return;
  const rows = songIds.flatMap((song_id) => artistIds.map((artist_id) => ({ song_id, artist_id })));
  const { error } = await supabase.from("song_artists").insert(rows);
  if (error) throw new Error(`Could not save featured artists: ${error.message}`);
}
