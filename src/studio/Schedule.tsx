import { useEffect, useState } from "react";
import { CalendarClock, Loader2, X } from "lucide-react";
import { toast } from "sonner";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { supabase } from "./lib";

const db = supabase as any;

/** "2026-11-28T09:30" for a datetime-local input, in the phone's own time zone. */
function toLocalInput(d: Date) {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export const formatWhen = (iso: string) =>
  new Date(iso).toLocaleString(undefined, { weekday: "short", day: "numeric", month: "short", hour: "numeric", minute: "2-digit" });

/** A "Publish later" switch with a date and time. value is "" when publishing now. */
export function ScheduleField({ value, onChange, disabled }: { value: string; onChange: (v: string) => void; disabled?: boolean }) {
  const on = value !== "";
  return (
    <div className="glass rounded-xl p-3 space-y-3">
      <label className="flex items-center gap-3 cursor-pointer">
        <input
          type="checkbox"
          className="h-4 w-4 accent-[hsl(var(--primary))]"
          checked={on}
          disabled={disabled}
          onChange={(e) => onChange(e.target.checked ? toLocalInput(new Date(Date.now() + 60 * 60 * 1000)) : "")}
        />
        <CalendarClock className="w-4 h-4 text-primary" />
        <span className="text-sm font-medium">Publish later</span>
      </label>
      {on && (
        <div className="space-y-1">
          <Label htmlFor="release-at" className="text-xs text-muted-foreground">Release date and time (your phone's time)</Label>
          <Input
            id="release-at"
            type="datetime-local"
            value={value}
            min={toLocalInput(new Date())}
            disabled={disabled}
            onChange={(e) => onChange(e.target.value)}
          />
          <p className="text-[11px] text-muted-foreground">Files upload now. The music goes live and listeners are notified at this time.</p>
        </div>
      )}
    </div>
  );
}

/** Checks the chosen time and returns it as an ISO string, or throws a friendly error. */
export function releaseTime(value: string): string {
  const d = new Date(value);
  if (isNaN(d.getTime())) throw new Error("Pick a release date and time");
  if (d.getTime() < Date.now() + 60 * 1000) throw new Error("The release time must be at least a minute from now");
  return d.toISOString();
}

export type ScheduledSong = {
  title: string; audio_url: string; cover_art_url: string | null;
  genre: string | null; description?: string | null; track_number?: number | null;
};

export async function createSchedule(row: {
  release_at: string; artist_id: string; artist_name: string;
  album: { title: string; cover_art_url: string | null; description: string | null; genre: string | null } | null;
  songs: ScheduledSong[]; collab_ids: string[];
}) {
  const { error } = await db.from("scheduled_releases").insert(row);
  if (error) throw new Error(error.message);
  window.dispatchEvent(new Event("schedules-changed"));
}

type Row = {
  id: string; release_at: string; artist_name: string; status: string; error: string | null;
  album: { title: string } | null; songs: { title: string }[];
};

/** Upcoming (and recently failed) scheduled releases, with a Cancel button. */
export function ScheduledList() {
  const [rows, setRows] = useState<Row[]>([]);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = async () => {
    const since = new Date(Date.now() - 3 * 24 * 3600 * 1000).toISOString();
    const { data } = await db
      .from("scheduled_releases")
      .select("id,release_at,artist_name,status,error,album,songs")
      .or(`status.eq.pending,and(status.eq.failed,created_at.gt.${since})`)
      .order("release_at");
    setRows(data ?? []);
  };

  useEffect(() => {
    load();
    const on = () => load();
    window.addEventListener("schedules-changed", on);
    const t = setInterval(load, 60 * 1000);
    return () => { window.removeEventListener("schedules-changed", on); clearInterval(t); };
  }, []);

  const cancel = async (id: string) => {
    setBusyId(id);
    const { error } = await db.from("scheduled_releases").update({ status: "cancelled" }).eq("id", id).eq("status", "pending");
    setBusyId(null);
    if (error) return toast.error("Could not cancel", { description: error.message });
    toast.success("Scheduled release cancelled");
    load();
  };

  if (!rows.length) return null;
  return (
    <div className="space-y-2 pt-2">
      <h3 className="text-sm font-display tracking-wider flex items-center gap-2"><CalendarClock className="w-4 h-4 text-primary" /> Scheduled</h3>
      {rows.map((r) => (
        <div key={r.id} className="glass rounded-xl p-3 flex items-center gap-3">
          <div className="flex-1 min-w-0">
            <div className="text-sm font-medium truncate">
              {r.album ? `${r.album.title} (album, ${r.songs.length} songs)` : r.songs[0]?.title}
            </div>
            <div className="text-xs text-muted-foreground truncate">
              {r.artist_name} · {r.status === "failed" ? <span className="text-destructive">Failed: {r.error}</span> : formatWhen(r.release_at)}
            </div>
          </div>
          {r.status === "pending" && (
            <button type="button" onClick={() => cancel(r.id)} disabled={busyId === r.id} className="p-2 text-muted-foreground hover:text-destructive" aria-label="Cancel scheduled release">
              {busyId === r.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <X className="w-4 h-4" />}
            </button>
          )}
        </div>
      ))}
    </div>
  );
}
