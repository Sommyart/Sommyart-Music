import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { AlertTriangle, Loader2, Minus, Pause, Play, Plus, Wand2 } from "lucide-react";
import { supabase } from "./lib";
import type { SongRow } from "./Editors";
import { cleanLyrics } from "./lrc";

type ResultLine = { text: string; t: number; end?: number; conf?: number };
type Job = {
  id: string; status: "pending" | "processing" | "done" | "failed"; created_at: string;
  error: string | null; result: { lines: ResultLine[]; avg_conf?: number; audio_seconds?: number } | null;
};

/** Below this a line probably does not match what is sung. A rough starting value, not tested on real songs yet. */
const CHECK_BELOW = 0.4;

const fmt = (s: number) => {
  const m = Math.floor(s / 60);
  const r = s - m * 60;
  return `${m}:${r.toFixed(1).padStart(4, "0")}`;
};

async function requestJob(songId: string, text: string): Promise<{ started: boolean }> {
  const { data, error } = await supabase.functions.invoke("lyrics-request", { body: { song_id: songId, text } });
  if (error) {
    let msg = error.message as string;
    try { msg = (await error.context.json()).error || msg; } catch { /* keep the generic message */ }
    throw new Error(msg);
  }
  return { started: !!data?.started };
}

export function LyricsDialog({ song, onClose, onSaved }: { song: SongRow | null; onClose: () => void; onSaved: () => void }) {
  const [text, setText] = useState("");
  const [savedCount, setSavedCount] = useState(0);
  const [job, setJob] = useState<Job | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [busy, setBusy] = useState(false);
  const [lines, setLines] = useState<ResultLine[] | null>(null);
  const [time, setTime] = useState(0);
  const [playing, setPlaying] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const loadJob = useCallback(async () => {
    if (!song) return null;
    const { data } = await supabase.from("lyric_jobs").select("id,status,created_at,error,result")
      .eq("song_id", song.id).order("created_at", { ascending: false }).limit(1);
    const j: Job | null = data?.[0] ?? null;
    setJob(j);
    return j;
  }, [song]);

  // First load: current lyrics, latest job.
  useEffect(() => {
    if (!song) return;
    setLoaded(false); setLines(null); setText(""); setJob(null);
    let cancelled = false;
    (async () => {
      const { data } = await supabase.from("songs").select("lyrics").eq("id", song.id).maybeSingle();
      const cur: { text: string }[] = Array.isArray(data?.lyrics) ? data.lyrics : [];
      if (cancelled) return;
      setSavedCount(cur.length);
      setText(cur.map((l) => l.text).join("\n"));
      const j = await loadJob();
      if (cancelled) return;
      if (j?.status === "done" && j.result?.lines?.length) setLines(j.result.lines.map((l) => ({ ...l })));
      setLoaded(true);
    })();
    return () => { cancelled = true; };
  }, [song, loadJob]);

  // While the worker is busy, check on it every few seconds.
  const active = job?.status === "pending" || job?.status === "processing";
  useEffect(() => {
    if (!active) return;
    const id = setInterval(async () => {
      const j = await loadJob();
      if (j?.status === "done" && j.result?.lines?.length) setLines(j.result.lines.map((l) => ({ ...l })));
    }, 6000);
    return () => clearInterval(id);
  }, [active, loadJob]);

  // Preview audio
  useEffect(() => {
    if (!song) return;
    const a = new Audio(song.audio_url);
    a.preload = "metadata";
    a.addEventListener("timeupdate", () => setTime(a.currentTime));
    a.addEventListener("ended", () => setPlaying(false));
    audioRef.current = a;
    return () => { a.pause(); a.src = ""; audioRef.current = null; };
  }, [song]);

  const cleaned = useMemo(() => cleanLyrics(text), [text]);

  if (!song) return null;

  const generate = async () => {
    setBusy(true);
    try {
      const r = await requestJob(song.id, cleaned.cleanText);
      toast.success(r.started ? "Timing started" : "Timing queued", {
        description: r.started ? "This usually takes a few minutes." : "It will be picked up shortly.",
      });
      await loadJob();
    } catch (e: any) {
      toast.error("Could not start", { description: e.message });
    } finally {
      setBusy(false);
    }
  };

  const playFrom = (t: number) => {
    const a = audioRef.current;
    if (!a) return;
    a.currentTime = Math.max(0, t - 0.3);
    a.play().then(() => setPlaying(true)).catch(() => {});
  };
  const toggle = () => {
    const a = audioRef.current;
    if (!a) return;
    if (playing) { a.pause(); setPlaying(false); } else a.play().then(() => setPlaying(true)).catch(() => {});
  };

  const nudge = (i: number | "all", d: number) =>
    setLines((ls) => ls && ls.map((l, k) => (i === "all" || k === i ? { ...l, t: Math.max(0, Math.round((l.t + d) * 10) / 10) } : l)));

  const save = async () => {
    if (!lines) return;
    setBusy(true);
    try {
      const out = lines.map((l) => ({ t: Math.round(l.t * 100) / 100, text: l.text })).sort((a, b) => a.t - b.t);
      const { error } = await supabase.from("songs").update({ lyrics: out }).eq("id", song.id);
      if (error) throw new Error(error.message);
      if (job) await supabase.from("lyric_jobs").delete().eq("id", job.id);
      toast.success("Lyrics saved", { description: `${out.length} lines are now live in the app.` });
      onSaved();
      onClose();
    } catch (e: any) {
      toast.error("Could not save", { description: e.message });
    } finally {
      setBusy(false);
    }
  };

  const discard = async () => {
    if (job) await supabase.from("lyric_jobs").delete().eq("id", job.id);
    setLines(null); setJob(null);
  };

  const activeIdx = lines ? lines.reduce((acc, l, i) => (l.t <= time + 0.05 ? i : acc), -1) : -1;
  const doubtful = lines ? lines.filter((l) => (l.conf ?? 1) < CHECK_BELOW).length : 0;

  return (
    <Dialog open onOpenChange={(o) => !o && !busy && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Lyrics · {song.title}</DialogTitle>
          <DialogDescription>
            Paste the lyrics and the app works out when each line is sung. You check it before it goes live.
          </DialogDescription>
        </DialogHeader>

        {!loaded && <div className="py-8 flex justify-center"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>}

        {loaded && active && (
          <div className="glass rounded-xl p-4 space-y-2 text-sm">
            <div className="flex items-center gap-2 font-medium"><Loader2 className="w-4 h-4 animate-spin text-primary" />
              {job!.status === "pending" ? "Waiting for the timing worker to start…" : "Working out the timing…"}
            </div>
            <p className="text-muted-foreground">
              This can take several minutes. You can close this window and come back; the result will be here.
            </p>
          </div>
        )}

        {loaded && !active && lines && (
          <div className="space-y-3">
            <div className="glass rounded-xl p-3 text-sm space-y-1">
              <div className="font-medium">Check the timing, then save</div>
              <p className="text-muted-foreground text-xs">
                Tap a line to hear it. Use − and + to move a line by a tenth of a second.
                {savedCount > 0 && " Saving replaces the lyrics this song has now."}
              </p>
              {doubtful > 0 && (
                <p className="text-xs flex items-start gap-1 text-amber-500">
                  <AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                  {doubtful} line{doubtful > 1 ? "s" : ""} marked “check” may not match the singing. This marking is a rough guide and has not been tested on real songs yet.
                </p>
              )}
            </div>

            <div className="flex items-center gap-2">
              <Button type="button" size="sm" variant="secondary" onClick={toggle}>
                {playing ? <Pause className="w-4 h-4 mr-1" /> : <Play className="w-4 h-4 mr-1" />}{playing ? "Pause" : "Play"}
              </Button>
              <span className="text-xs tabular-nums text-muted-foreground w-12">{fmt(time)}</span>
              <div className="flex-1" />
              <span className="text-xs text-muted-foreground">Move all</span>
              <Button type="button" size="sm" variant="outline" onClick={() => nudge("all", -0.5)}>−0.5</Button>
              <Button type="button" size="sm" variant="outline" onClick={() => nudge("all", 0.5)}>+0.5</Button>
            </div>

            <div className="max-h-[45vh] overflow-y-auto space-y-1 pr-1">
              {lines.map((l, i) => {
                const doubt = (l.conf ?? 1) < CHECK_BELOW;
                return (
                  <div key={i} className={`flex items-center gap-1 rounded-lg px-2 py-1.5 ${i === activeIdx ? "bg-primary/15" : ""}`}>
                    <span className="text-[11px] tabular-nums text-muted-foreground w-11 shrink-0">{fmt(l.t)}</span>
                    <button type="button" onClick={() => playFrom(l.t)} className="flex-1 min-w-0 text-left text-sm leading-snug break-words">
                      {l.text}{doubt && <span className="ml-2 text-[10px] uppercase tracking-wide text-amber-500">check</span>}
                    </button>
                    <button type="button" onClick={() => nudge(i, -0.1)} className="p-1.5 text-muted-foreground hover:text-primary" aria-label="Earlier"><Minus className="w-3.5 h-3.5" /></button>
                    <button type="button" onClick={() => nudge(i, 0.1)} className="p-1.5 text-muted-foreground hover:text-primary" aria-label="Later"><Plus className="w-3.5 h-3.5" /></button>
                  </div>
                );
              })}
            </div>

            <div className="flex gap-2 pt-1">
              <Button type="button" variant="secondary" className="flex-1" onClick={discard} disabled={busy}>Start over</Button>
              <Button type="button" className="flex-1" onClick={save} disabled={busy}>
                {busy && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}Save lyrics
              </Button>
            </div>
          </div>
        )}

        {loaded && !active && !lines && (
          <div className="space-y-3">
            {job?.status === "failed" && (
              <div className="glass rounded-xl p-3 text-sm text-destructive flex gap-2">
                <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
                <span>The last try did not work: {job.error || "unknown problem"}. You can try again.</span>
              </div>
            )}
            <Textarea
              rows={12} value={text} onChange={(e) => setText(e.target.value)} maxLength={20000}
              placeholder={"Paste the lyrics here, one line per row.\n\nLabels like [Chorus] are ignored."}
              className="text-sm"
            />
            {cleaned.stamped > 0 && (
              <p className="text-xs text-muted-foreground">
                Times like [00:08.06] on {cleaned.stamped} line{cleaned.stamped > 1 ? "s" : ""} are ignored. The timing is always worked out from the song.
              </p>
            )}
            <p className="text-xs text-muted-foreground">
              The text must match what is sung, in the same order. {savedCount > 0 && `This song already has ${savedCount} timed lines; generating makes new timing for the text above.`}
            </p>
            <div className="flex gap-2">
              <Button type="button" variant="secondary" className="flex-1" onClick={onClose} disabled={busy}>Close</Button>
              <Button type="button" className="flex-1" onClick={generate} disabled={busy || cleaned.cleanText.length < 5}>
                {busy ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Wand2 className="w-4 h-4 mr-2" />}
                Generate timing
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
