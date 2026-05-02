import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ChevronLeft, Play, Pause, Plus, Trash2, Save, ShieldAlert } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Slider } from "@/components/ui/slider";
import { toast } from "@/hooks/use-toast";
import { LyricLine } from "@/lib/tracks";
import { cn } from "@/lib/utils";

interface DBSong {
  id: string;
  title: string;
  artist: string;
  audio_url: string;
  lyrics: LyricLine[] | null;
}

const fmt = (s: number) => {
  if (!isFinite(s)) return "0:00";
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${sec.toString().padStart(2, "0")}`;
};

export default function AdminLyrics() {
  const navigate = useNavigate();
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [songs, setSongs] = useState<DBSong[]>([]);
  const [selected, setSelected] = useState<DBSong | null>(null);
  const [draft, setDraft] = useState("");
  const [lines, setLines] = useState<LyricLine[]>([]);
  const [time, setTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [saving, setSaving] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Auth + admin check
  useEffect(() => {
    (async () => {
      const { data: sess } = await supabase.auth.getSession();
      const uid = sess.session?.user.id;
      if (!uid) {
        setIsAdmin(false);
        return;
      }
      const { data } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", uid)
        .eq("role", "admin")
        .maybeSingle();
      setIsAdmin(!!data);
    })();
  }, []);

  // Load songs
  useEffect(() => {
    if (!isAdmin) return;
    supabase
      .from("songs")
      .select("id,title,artist,audio_url,lyrics")
      .order("uploaded_at", { ascending: false })
      .then(({ data }) => setSongs((data || []) as any));
  }, [isAdmin]);

  // Audio element lifecycle
  useEffect(() => {
    const a = new Audio();
    audioRef.current = a;
    a.addEventListener("timeupdate", () => setTime(a.currentTime));
    a.addEventListener("loadedmetadata", () => setDuration(a.duration));
    a.addEventListener("ended", () => setPlaying(false));
    return () => {
      a.pause();
      a.src = "";
    };
  }, []);

  const selectSong = (s: DBSong) => {
    setSelected(s);
    setLines(Array.isArray(s.lyrics) ? [...s.lyrics] : []);
    setDraft(
      Array.isArray(s.lyrics) && s.lyrics.length
        ? s.lyrics.map((l) => l.text).join("\n")
        : ""
    );
    const a = audioRef.current;
    if (a) {
      a.src = s.audio_url;
      a.load();
      setPlaying(false);
      setTime(0);
    }
  };

  const togglePlay = () => {
    const a = audioRef.current;
    if (!a) return;
    if (playing) {
      a.pause();
      setPlaying(false);
    } else {
      a.play().then(() => setPlaying(true)).catch(() => {});
    }
  };

  const seek = (v: number) => {
    const a = audioRef.current;
    if (a) {
      a.currentTime = v;
      setTime(v);
    }
  };

  const draftLines = useMemo(
    () => draft.split("\n").map((s) => s.trim()),
    [draft]
  );

  const stamps = useMemo(() => {
    // Build full grid: for each draft line, what timestamp is set (if any)
    const map = new Map<number, number>();
    lines.forEach((l, i) => map.set(i, l.t));
    return map;
  }, [lines]);

  const markCurrent = (i: number) => {
    setLines((prev) => {
      const next = [...prev];
      next[i] = { t: parseFloat(time.toFixed(2)), text: draftLines[i] || "" };
      return next;
    });
  };

  // Keep lines array length in sync with draft lines while preserving stamps
  useEffect(() => {
    setLines((prev) => {
      const next: LyricLine[] = [];
      for (let i = 0; i < draftLines.length; i++) {
        if (prev[i]) next[i] = { ...prev[i], text: draftLines[i] };
      }
      return next.filter((l) => l !== undefined) as LyricLine[];
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draft]);

  const save = async () => {
    if (!selected) return;
    setSaving(true);
    // Pair draft lines with stamps in order; only keep ones with timestamps
    const final: LyricLine[] = [];
    for (let i = 0; i < draftLines.length; i++) {
      const stamp = stamps.get(i);
      if (typeof stamp === "number" && draftLines[i]) {
        final.push({ t: stamp, text: draftLines[i] });
      }
    }
    final.sort((a, b) => a.t - b.t);

    const { error } = await supabase
      .from("songs")
      .update({ lyrics: final.length ? final : null })
      .eq("id", selected.id);
    setSaving(false);
    if (error) {
      toast({ title: "Save failed", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Lyrics saved", description: `${final.length} synced lines` });
    setSongs((prev) =>
      prev.map((s) => (s.id === selected.id ? { ...s, lyrics: final } : s))
    );
    setSelected((s) => (s ? { ...s, lyrics: final } : s));
  };

  if (isAdmin === null) {
    return <div className="min-h-screen flex items-center justify-center text-muted-foreground">Loading…</div>;
  }
  if (!isAdmin) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 px-6 text-center">
        <ShieldAlert className="text-primary" size={40} />
        <h1 className="font-display text-xl neon-text">Admin only</h1>
        <p className="text-sm text-muted-foreground">Sign in with an admin account to manage lyrics.</p>
        <Button onClick={() => navigate("/")}>Back</Button>
      </div>
    );
  }

  return (
    <div className="min-h-screen pb-24">
      <header className="flex items-center justify-between px-4 pt-10 pb-4">
        <button onClick={() => navigate(-1)} className="text-muted-foreground">
          <ChevronLeft size={24} />
        </button>
        <h1 className="font-display tracking-widest text-sm neon-text">LYRICS MANAGER</h1>
        <div className="w-6" />
      </header>

      {!selected ? (
        <div className="px-4 space-y-2">
          <p className="text-xs text-muted-foreground mb-3">Select a track to edit lyrics</p>
          {songs.map((s) => (
            <button
              key={s.id}
              onClick={() => selectSong(s)}
              className="w-full glass-card p-3 rounded-lg flex items-center justify-between text-left hover:border-primary/50 transition-colors"
            >
              <div className="min-w-0">
                <div className="font-medium truncate">{s.title}</div>
                <div className="text-xs text-muted-foreground truncate">{s.artist}</div>
              </div>
              <span
                className={cn(
                  "text-[10px] px-2 py-1 rounded font-display tracking-wider shrink-0 ml-2",
                  s.lyrics && s.lyrics.length
                    ? "bg-primary/20 text-primary"
                    : "bg-muted text-muted-foreground"
                )}
              >
                {s.lyrics && s.lyrics.length ? `${s.lyrics.length} LINES` : "NONE"}
              </span>
            </button>
          ))}
        </div>
      ) : (
        <div className="px-4 space-y-4">
          <button
            onClick={() => {
              audioRef.current?.pause();
              setPlaying(false);
              setSelected(null);
            }}
            className="text-xs text-primary"
          >
            ← All tracks
          </button>

          <div className="glass-card p-4 rounded-lg">
            <div className="font-display tracking-wide truncate">{selected.title}</div>
            <div className="text-xs text-muted-foreground truncate mb-3">{selected.artist}</div>

            <div className="flex items-center gap-3 mb-2">
              <Button size="icon" variant="secondary" onClick={togglePlay}>
                {playing ? <Pause size={18} /> : <Play size={18} />}
              </Button>
              <span className="text-xs tabular-nums text-muted-foreground w-10">{fmt(time)}</span>
              <Slider
                value={[time]}
                max={duration || 0}
                step={0.01}
                onValueChange={(v) => seek(v[0])}
                className="flex-1"
              />
              <span className="text-xs tabular-nums text-muted-foreground w-10 text-right">{fmt(duration)}</span>
            </div>
            <p className="text-[10px] text-muted-foreground">
              Tip: play the track, tap <Plus className="inline" size={10} /> on each line right when it begins.
            </p>
          </div>

          <div className="glass-card p-4 rounded-lg">
            <label className="text-xs text-muted-foreground">Lyrics (one line per row)</label>
            <Textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              rows={8}
              className="mt-2 font-mono text-sm"
              placeholder={"Verse 1 line 1\nVerse 1 line 2\n…"}
            />
          </div>

          <div className="space-y-1">
            {draftLines.map((text, i) => {
              if (!text) return null;
              const stamp = stamps.get(i);
              const isActive =
                typeof stamp === "number" &&
                time >= stamp &&
                (i + 1 >= draftLines.length || (stamps.get(i + 1) ?? Infinity) > time);
              return (
                <div
                  key={i}
                  className={cn(
                    "flex items-center gap-2 p-2 rounded-md border",
                    isActive ? "border-primary bg-primary/10" : "border-border/40"
                  )}
                >
                  <button
                    onClick={() => markCurrent(i)}
                    className="px-2 py-1 rounded bg-primary/20 text-primary text-xs font-display tracking-wider tabular-nums shrink-0 active:scale-95 transition"
                    title="Mark current time for this line"
                  >
                    {typeof stamp === "number" ? fmt(stamp) : <Plus size={12} />}
                  </button>
                  <span className="text-sm flex-1 truncate">{text}</span>
                  {typeof stamp === "number" && (
                    <button
                      onClick={() => {
                        setLines((prev) => prev.filter((_, idx) => idx !== i));
                      }}
                      className="text-muted-foreground hover:text-destructive shrink-0"
                      aria-label="Clear timestamp"
                    >
                      <Trash2 size={14} />
                    </button>
                  )}
                </div>
              );
            })}
          </div>

          <Button onClick={save} disabled={saving} className="w-full">
            <Save size={16} className="mr-2" />
            {saving ? "Saving…" : "Save lyrics"}
          </Button>
        </div>
      )}
    </div>
  );
}
