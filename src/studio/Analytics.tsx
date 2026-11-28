import { useCallback, useEffect, useState } from "react";
import { Loader2, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "./lib";

type Day = { day: string; active: number; signups: number };
type Top = { title: string; artist: string | null; plays: number; listeners: number };
type Report = {
  total_users: number; dau: number; wau: number; mau: number; new_7d: number;
  tracked_since: string | null; daily: Day[]; top_songs: Top[];
};

const RANGES = [7, 30, 90] as const;

function Stat({ label, value, hint }: { label: string; value: number; hint?: string }) {
  return (
    <div className="glass rounded-2xl p-4">
      <p className="text-2xl font-bold text-primary tabular-nums">{value}</p>
      <p className="text-xs font-medium mt-1">{label}</p>
      {hint && <p className="text-[11px] text-muted-foreground">{hint}</p>}
    </div>
  );
}

const shortDay = (d: string) => new Date(d + "T00:00:00").toLocaleDateString(undefined, { day: "numeric", month: "short" });

/** How many people use the app: active users, sign-ups and the most played songs. Admin only. */
export function AnalyticsPanel() {
  const [range, setRange] = useState<number>(30);
  const [data, setData] = useState<Report | null>(null);
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true); setErr("");
    const { data, error } = await (supabase as any).rpc("admin_analytics", { p_days: range });
    if (error) setErr(error.message); else setData(data as Report);
    setLoading(false);
  }, [range]);
  useEffect(() => { load(); }, [load]);

  if (!data) {
    return (
      <div className="glass rounded-2xl p-8 text-center text-sm text-muted-foreground">
        {loading ? <Loader2 className="w-6 h-6 animate-spin text-primary mx-auto" /> : (
          <div className="space-y-3"><p>Could not load the numbers. {err}</p><Button variant="secondary" onClick={load}>Try again</Button></div>
        )}
      </div>
    );
  }

  const max = Math.max(1, ...data.daily.map((d) => d.active));
  const total = data.daily.reduce((n, d) => n + d.signups, 0);
  const topMax = Math.max(1, ...data.top_songs.map((s) => s.plays));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-2">
        <div className="flex gap-1" role="group" aria-label="Time range">
          {RANGES.map((r) => (
            <Button key={r} size="sm" variant={range === r ? "default" : "secondary"} onClick={() => setRange(r)}>{r} days</Button>
          ))}
        </div>
        <Button size="icon" variant="ghost" onClick={load} aria-label="Refresh" disabled={loading}>
          <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
        </Button>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Stat label="Active today" value={data.dau} hint="Opened or played today" />
        <Stat label="Active this week" value={data.wau} hint="Last 7 days" />
        <Stat label="Active this month" value={data.mau} hint="Last 30 days" />
        <Stat label="All accounts" value={data.total_users} hint={`${data.new_7d} new this week`} />
      </div>

      <section className="glass rounded-2xl p-4 space-y-3">
        <h2 className="font-semibold text-sm">Active users each day</h2>
        <div className="flex items-end gap-[2px] h-32" role="img" aria-label="Bar chart of active users per day">
          {data.daily.map((d) => (
            <div key={d.day} className="flex-1 flex flex-col justify-end h-full" title={`${shortDay(d.day)}: ${d.active} active, ${d.signups} new`}>
              <div className="w-full rounded-t bg-primary/80" style={{ height: `${(d.active / max) * 100}%`, minHeight: d.active ? 2 : 0 }} />
            </div>
          ))}
        </div>
        <div className="flex justify-between text-[11px] text-muted-foreground">
          <span>{shortDay(data.daily[0].day)}</span><span>Busiest day: {max} active</span><span>{shortDay(data.daily[data.daily.length - 1].day)}</span>
        </div>
        <p className="text-xs text-muted-foreground">{total} new {total === 1 ? "account" : "accounts"} in this period.</p>
      </section>

      <section className="glass rounded-2xl p-4 space-y-3">
        <h2 className="font-semibold text-sm">Most played songs ({range} days)</h2>
        {data.top_songs.length === 0 && <p className="text-sm text-muted-foreground">No plays recorded yet.</p>}
        <ol className="space-y-2">
          {data.top_songs.map((s, i) => (
            <li key={`${s.title}-${i}`} className="space-y-1">
              <div className="flex justify-between gap-3 text-sm">
                <span className="truncate">{i + 1}. {s.title}{s.artist ? <span className="text-muted-foreground"> · {s.artist}</span> : null}</span>
                <span className="text-muted-foreground tabular-nums shrink-0">{s.plays} {s.plays === 1 ? "play" : "plays"}</span>
              </div>
              <div className="h-1.5 rounded bg-muted overflow-hidden"><div className="h-full bg-primary/70" style={{ width: `${(s.plays / topMax) * 100}%` }} /></div>
            </li>
          ))}
        </ol>
      </section>

      <p className="text-[11px] text-muted-foreground">
        "Active" means the person opened the app or played a song that day (Nigerian time).
        {data.tracked_since ? ` Counting started on ${shortDay(data.tracked_since)}.` : ""}
      </p>
    </div>
  );
}
