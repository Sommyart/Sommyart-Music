import { useEffect, useState } from "react";
import { CalendarClock, Check, Loader2, Pencil, Send, X } from "lucide-react";
import { Button } from "@/components/ui/button";
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
  const [editId, setEditId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");

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

  const saveTime = async (id: string) => {
    let when: string;
    try { when = releaseTime(editValue); } catch (err: any) { return toast.error(err.message); }
    setBusyId(id);
    const { error } = await db.from("scheduled_releases").update({ release_at: when }).eq("id", id).eq("status", "pending");
    setBusyId(null);
    if (error) return toast.error("Could not change the time", { description: error.message });
    toast.success("Release time changed", { description: `Goes live ${formatWhen(when)}.` });
    setEditId(null);
    load();
  };

  const publishNow = async (r: Row) => {
    const name = r.album ? r.album.title : r.songs[0]?.title;
    if (!window.confirm(`Publish "${name}" now? Listeners will be notified straight away.`)) return;
    setBusyId(r.id);
    const { error } = await db.rpc("release_schedule_now", { p_id: r.id });
    setBusyId(null);
    if (error) return toast.error("Could not publish", { description: error.message });
    toast.success("Published", { description: `"${name}" is live for all listeners.` });
    load();
  };

  if (!rows.length) return null;
  return (
    <div className="space-y-2 pt-2">
      <h3 className="text-sm font-display tracking-wider flex items-center gap-2"><CalendarClock className="w-4 h-4 text-primary" /> Scheduled</h3>
      {rows.map((r) => (
        <div key={r.id} className="glass rounded-xl">
        <div className="p-3 flex items-center gap-3">
          <div className="flex-1 min-w-0">
            <div className="text-sm font-medium truncate">
              {r.album ? `${r.album.title} (album, ${r.songs.length} songs)` : r.songs[0]?.title}
            </div>
            <div className="text-xs text-muted-foreground truncate">
              {r.artist_name} · {r.status === "failed" ? <span className="text-destructive">Failed: {r.error}</span> : formatWhen(r.release_at)}
            </div>
          </div>
          {r.status === "pending" && (busyId === r.id ? <Loader2 className="w-4 h-4 animate-spin text-primary m-2" /> : (
            <div className="flex items-center">
              <button type="button" onClick={() => { setEditId(editId === r.id ? null : r.id); setEditValue(toLocalInput(new Date(r.release_at))); }} className="p-2 text-muted-foreground hover:text-primary" aria-label="Change release time"><Pencil className="w-4 h-4" /></button>
              <button type="button" onClick={() => publishNow(r)} className="p-2 text-muted-foreground hover:text-primary" aria-label="Publish now"><Send className="w-4 h-4" /></button>
              <button type="button" onClick={() => cancel(r.id)} className="p-2 text-muted-foreground hover:text-destructive" aria-label="Cancel scheduled release"><X className="w-4 h-4" /></button>
            </div>
          ))}
        </div>
        {editId === r.id && r.status === "pending" && (
          <div className="flex gap-2 px-3 pb-3">
            <Input type="datetime-local" value={editValue} min={toLocalInput(new Date())} onChange={(e) => setEditValue(e.target.value)} className="flex-1" aria-label="New release time" />
            <Button type="button" size="sm" onClick={() => saveTime(r.id)} disabled={busyId === r.id}><Check className="w-4 h-4 mr-1" /> Save</Button>
          </div>
        )}
        </div>
      ))}
    </div>
  );
}
