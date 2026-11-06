import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Track } from "@/lib/tracks";
import { extractCoverArt } from "@/lib/extractCoverArt";
import { autoCacheTrack, cachedPlayableUrl, resolvePlayableUrl } from "@/lib/offlineAudio";

import {
  buildShuffleOrder,
  HistoryEntry,
  loadPersisted,
  PlaybackContext,
  PlaybackContextType,
  RepeatMode,
  savePersisted,
} from "@/lib/playback";

/** "time": stop at a clock time. "track": stop when the current song ends. */
export type SleepTimer = { kind: "time"; endsAt: number } | { kind: "track" } | null;

interface PlayContextArgs {
  type: PlaybackContextType;
  id?: string | null;
  tracks: Track[];
  startIndex?: number;
  autoplay?: boolean;
}

/**
 * The single authoritative playback controller.
 * Owns the one and only <audio> element, the playback context, the manual
 * "Up Next" queue, shuffle/repeat modes and the position/duration state.
 */
const BOOST_KEY = "sommyart.boost";
/** Saved volume boost on this device: 1 (off) to 2 (200%). */
function readBoost(): number {
  try {
    const v = parseFloat(localStorage.getItem(BOOST_KEY) || "1");
    return v >= 1 && v <= 2 ? v : 1;
  } catch {
    return 1;
  }
}

export function usePlaybackEngine(library: Track[], audioEnabled: boolean = true) {
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const [context, setContext] = useState<PlaybackContext>({ type: "library", id: null, tracks: [] });
  const [contextIndex, setContextIndex] = useState(0);
  const [queue, setQueue] = useState<Track[]>([]);
  const [source, setSource] = useState<"context" | "queue">("context");
  const [queueTrack, setQueueTrack] = useState<Track | null>(null);
  const [history, setHistory] = useState<HistoryEntry[]>([]);

  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [shuffle, setShuffleState] = useState(false);
  const [repeat, setRepeatState] = useState<RepeatMode>("off");
  const [playbackRate, setPlaybackRateState] = useState(1);
  const [volume, setVolumeState] = useState(1);
  // Volume boost above 100% (this device only, never synced to other devices).
  const [boost, setBoostState] = useState(readBoost);
  const [boostIssue, setBoostIssue] = useState<string | null>(null);
  const [graphReady, setGraphReady] = useState(false);
  const [shuffleOrder, setShuffleOrder] = useState<number[] | null>(null);
  const [extractedCover, setExtractedCover] = useState<string | null>(null);
  const [unavailable, setUnavailable] = useState<Record<string, true>>({});
  const [muted, setMuted] = useState(false);
  const [sleep, setSleep] = useState<SleepTimer>(null);
  const [sleepRemaining, setSleepRemaining] = useState<number | null>(null);

  // Latest values for listeners that must never go stale.
  const sleepRef = useRef<SleepTimer>(null);
  sleepRef.current = sleep;
  const isPlayingRef = useRef(false);
  isPlayingRef.current = isPlaying;
  const volumeRef = useRef(1);
  volumeRef.current = volume;
  const boostGraphRef = useRef<{ ctx: AudioContext; gain: GainNode; limiter: DynamicsCompressorNode } | null>(null);
  const boostPendingRef = useRef<Promise<boolean | null> | null>(null);
  const audioEnabledRef = useRef(audioEnabled);
  audioEnabledRef.current = audioEnabled;
  // The first remote state we receive after launch must not switch Repeat One back on.
  const firstRemoteRef = useRef(true);

  // Position to seek to once the next media element is ready (restore/remote).
  const pendingSeekRef = useRef<number | null>(null);
  // The address last given to the audio element. The element reports its own
  // address in a rewritten form (full path, spaces turned into %20), so comparing
  // against that made every pause or interruption look like a new song and
  // restart it from the beginning.
  const loadedUrlRef = useRef("");
  // Guards against error-driven infinite skipping.
  const errorSkipsRef = useRef(0);
  const restoredRef = useRef(false);
  // The song list from the database arrives a moment after launch. Until the song you were last
  // playing can be found, show nothing (rather than the first song of the bundled list) and do not
  // overwrite the saved session.
  const [hadSaved] = useState(() => !!loadPersisted()?.currentTrackId);
  const [restorePending, setRestorePending] = useState(hadSaved);
  const persistReadyRef = useRef(!hadSaved);

  const contextTracks = context.tracks.length ? context.tracks : library;
  const rawCurrent = restorePending
    ? null
    : source === "queue" ? queueTrack : contextTracks[contextIndex] ?? null;

  // ---------- Cover art enrichment ----------
  useEffect(() => {
    if (!rawCurrent) return;
    setExtractedCover(null);
    // A song with its own cover picture does not need the embedded art, so skip the download.
    const placeholder = !rawCurrent.coverUrl || rawCurrent.coverUrl === "/images/logo.png";
    if (!placeholder) return;
    let cancelled = false;
    extractCoverArt(rawCurrent.audioUrl).then((cover) => {
      if (!cancelled && cover) setExtractedCover(cover);
    });
    return () => {
      cancelled = true;
    };
  }, [rawCurrent?.audioUrl, rawCurrent?.coverUrl]);

  // Keep a copy of a song after about 20 seconds of real listening, so replaying it uses no cloud data.
  useEffect(() => {
    if (!rawCurrent || !isPlaying || !audioEnabled) return;
    const url = rawCurrent.audioUrl;
    const id = window.setTimeout(() => { void autoCacheTrack(url); }, 20_000);
    return () => window.clearTimeout(id);
  }, [rawCurrent?.audioUrl, isPlaying, audioEnabled]);

  const currentTrack = rawCurrent
    ? { ...rawCurrent, coverUrl: extractedCover || rawCurrent.coverUrl }
    : null;

  // ---------- Ordering helpers ----------
  const orderOf = useCallback(
    (tracksLength: number) => shuffleOrder ?? Array.from({ length: tracksLength }, (_, i) => i),
    [shuffleOrder],
  );

  const nextContextIndex = useCallback((): number | null => {
    const len = contextTracks.length;
    if (!len) return null;
    const order = orderOf(len).filter((i) => i < len);
    const pos = order.indexOf(contextIndex);
    if (pos >= 0 && pos < order.length - 1) return order[pos + 1];
    return null;
  }, [contextTracks.length, contextIndex, orderOf]);

  // ---------- Core transport (declared via refs so listeners never go stale) ----------
  const advanceRef = useRef<(auto: boolean) => void>(() => {});

  const stopPlayback = useCallback(() => {
    const audio = audioRef.current;
    if (audio) {
      audio.pause();
      audio.currentTime = 0;
    }
    setIsPlaying(false);
    setCurrentTime(0);
  }, []);

  const pushHistory = useCallback(
    (entry: HistoryEntry) => setHistory((h) => [...h.slice(-49), entry]),
    [],
  );

  const advance = useCallback(
    (auto: boolean) => {
      const audio = audioRef.current;

      // Sleep timer set to "end of track": stop here instead of moving on.
      if (auto && sleepRef.current?.kind === "track") {
        setSleep(null);
        stopPlayback();
        return;
      }

      // Starting the very same song again (a one-song list on Repeat All, or the
      // same song queued twice) does not change the source, so restart it by hand.
      const restartSame = (next: Track | null | undefined) => {
        if (!next || !rawCurrent || next.id !== rawCurrent.id) return false;
        if (audio) {
          audio.currentTime = 0;
          if (audioEnabled) audio.play().catch(() => {});
        }
        setCurrentTime(0);
        setIsPlaying(true);
        return true;
      };

      // Repeat One only auto-loops; an explicit Next still moves on.
      if (auto && repeat === "one" && rawCurrent) {
        if (audio) {
          audio.currentTime = 0;
          if (audioEnabled) {
            // If the restart is refused (some phones do this after "ended"),
            // reload the same source and try once more instead of sitting still.
            audio.play().catch(() => {
              try {
                audio.load();
                audio.play().catch(() => {});
              } catch {
                /* noop */
              }
            });
          }
        }
        setCurrentTime(0);
        return;
      }

      if (rawCurrent) {
        pushHistory({ trackId: rawCurrent.id, contextIndex, source });
      }

      // 1) Manual "Up Next" queue has priority.
      if (queue.length > 0) {
        const [head, ...rest] = queue;
        setQueue(rest);
        if (restartSame(head)) return;
        setQueueTrack(head);
        setSource("queue");
        setIsPlaying(true);
        setCurrentTime(0);
        return;
      }

      // 2) Remaining playback context.
      const next = nextContextIndex();
      if (next !== null) {
        if (restartSame(contextTracks[next])) {
          setSource("context");
          setQueueTrack(null);
          setContextIndex(next);
          return;
        }
        setSource("context");
        setQueueTrack(null);
        setContextIndex(next);
        setIsPlaying(true);
        setCurrentTime(0);
        return;
      }

      // 3) End of context.
      if (repeat === "all" && contextTracks.length > 0) {
        const order = orderOf(contextTracks.length);
        if (shuffle) setShuffleOrder(buildShuffleOrder(contextTracks.length, order[0] ?? 0));
        if (restartSame(contextTracks[order[0] ?? 0])) {
          setSource("context");
          setQueueTrack(null);
          setContextIndex(order[0] ?? 0);
          return;
        }
        setSource("context");
        setQueueTrack(null);
        setContextIndex(order[0] ?? 0);
        setIsPlaying(true);
        setCurrentTime(0);
        return;
      }

      stopPlayback();
    },
    [
      repeat,
      rawCurrent,
      audioEnabled,
      queue,
      contextIndex,
      source,
      nextContextIndex,
      contextTracks,
      orderOf,
      shuffle,
      pushHistory,
      stopPlayback,
    ],
  );
  advanceRef.current = advance;

  // ---------- Audio element: created once, one authoritative "ended" listener ----------
  useEffect(() => {
    const audio = new Audio();
    audio.preload = "metadata";
    audioRef.current = audio;

    const onTime = () => setCurrentTime(audio.currentTime);
    const onMeta = () => setDuration(audio.duration);
    // One advance per finished song, however many signals report the end.
    let endedLock = false;
    const fireEnded = () => {
      // Only the device that is playing moves on. A device just showing another
      // device's song must wait for it to say what is next, or the two fight.
      if (!audioEnabledRef.current) return;
      if (endedLock) return;
      endedLock = true;
      window.setTimeout(() => {
        endedLock = false;
      }, 1500);
      advanceRef.current(true);
    };
    const onEnded = fireEnded;
    // Safety net: some phones delay or drop the "ended" event (screen off, app in
    // the background). Check the element itself once a second and when the app
    // comes back to the foreground, so a finished song always moves on.
    const checkFinished = () => {
      if (!isPlayingRef.current || audio.loop || !audio.src) return;
      const d = audio.duration;
      const atEnd =
        audio.ended || (isFinite(d) && d > 1 && audio.paused && audio.currentTime >= d - 0.3);
      if (atEnd) fireEnded();
    };
    const poll = window.setInterval(checkFinished, 1000);
    document.addEventListener("visibilitychange", checkFinished);
    const onError = () => {
      const err = audio.error;
      if (!audio.src || !audioEnabledRef.current) return;
      console.error("Audio error", { code: err?.code, src: audio.src });
      errorSkipsRef.current += 1;
      if (errorSkipsRef.current > 5) {
        errorSkipsRef.current = 0;
        setIsPlaying(false);
        return;
      }
      // Unavailable (e.g. offline & not downloaded) → skip intelligently.
      advanceRef.current(true);
    };

    // The phone (or another app) can pause the audio without telling us, for
    // example when the screen turns off or another app takes over the sound.
    // The play button would then still say "playing" while nothing is heard, and
    // you had to press pause and play to get going. Keep the button honest.
    const onPause = () => {
      if (!isPlayingRef.current || !audioEnabledRef.current) return;
      const d = audio.duration;
      const finished = audio.ended || (isFinite(d) && d > 1 && audio.currentTime >= d - 0.3);
      if (finished) return; // the song simply ended; the "ended" handling moves on
      // Give our own pause/skip logic a moment to run before treating it as outside.
      window.setTimeout(() => {
        if (isPlayingRef.current && audioEnabledRef.current && audio.paused && !audio.ended && audio.readyState >= 2) {
          setIsPlaying(false);
        }
      }, 400);
    };

    audio.addEventListener("timeupdate", onTime);
    audio.addEventListener("loadedmetadata", onMeta);
    audio.addEventListener("ended", onEnded);
    audio.addEventListener("error", onError);
    audio.addEventListener("pause", onPause);
    return () => {
      audio.removeEventListener("timeupdate", onTime);
      audio.removeEventListener("loadedmetadata", onMeta);
      audio.removeEventListener("ended", onEnded);
      audio.removeEventListener("error", onError);
      audio.removeEventListener("pause", onPause);
      window.clearInterval(poll);
      document.removeEventListener("visibilitychange", checkFinished);
      audio.pause();
      audio.src = "";
    };
  }, []);

  // ---------- Volume boost (above 100%) ----------
  // Past 100% the sound has to go through the browser's audio engine, which can only read a streamed song
  // when its server allows it (CORS). We check that first, then reload the song once in that mode.
  // Downloaded songs are local and always work. Once switched on, it stays on until the app restarts;
  // at 100% it passes the sound through untouched.
  const enableBoostGraph = useCallback((): Promise<boolean | null> => {
    if (boostGraphRef.current) return Promise.resolve(true);
    // A second request while the first is still checking waits for the same answer.
    if (boostPendingRef.current) return boostPendingRef.current;
    const run = buildBoostGraph().finally(() => {
      boostPendingRef.current = null;
    });
    boostPendingRef.current = run;
    return run;
  }, []);

  /** true = on, false = not possible here, null = no song loaded yet (try again shortly). */
  const buildBoostGraph = async (): Promise<boolean | null> => {
    const audio = audioRef.current;
    if (!audio) return null;
    const src = audio.currentSrc || audio.src;
    if (!src) return null;
    const AC: typeof AudioContext | undefined = window.AudioContext || (window as any).webkitAudioContext;
    if (!AC) {
      setBoostIssue("This phone does not support volume boost.");
      return false;
    }
    try {
      const crossSite = !/^(blob|data):/.test(src) && new URL(src, location.href).origin !== location.origin;
      if (crossSite) {
        try {
          await fetch(src, { method: "HEAD", mode: "cors" });
        } catch {
          setBoostIssue("Boost is not available for this streamed song. Download it, then boost works.");
          return false;
        }
      }
      const wasPlaying = !audio.paused;
      const at = audio.currentTime;
      audio.crossOrigin = "anonymous";
      if (crossSite) {
        audio.load();
        const resume = () => {
          audio.removeEventListener("loadedmetadata", resume);
          try { audio.currentTime = at; } catch { /* noop */ }
          if (wasPlaying) audio.play().catch(() => {});
        };
        audio.addEventListener("loadedmetadata", resume);
      }
      const ctx = new AC();
      const source = ctx.createMediaElementSource(audio);
      const gain = ctx.createGain();
      const limiter = ctx.createDynamicsCompressor();
      limiter.threshold.value = -2;
      limiter.knee.value = 0;
      limiter.attack.value = 0.002;
      limiter.release.value = 0.12;
      source.connect(gain);
      gain.connect(limiter);
      limiter.connect(ctx.destination);
      audio.addEventListener("play", () => {
        if (ctx.state === "suspended") ctx.resume().catch(() => {});
      });
      ctx.resume().catch(() => {});
      boostGraphRef.current = { ctx, gain, limiter };
      setGraphReady(true);
      setBoostIssue(null);
      return true;
    } catch (e) {
      console.error("Volume boost failed", e);
      setBoostIssue("Volume boost could not start on this phone.");
      return false;
    }
  };

  useEffect(() => {
    const g = boostGraphRef.current;
    if (!g) return;
    // The boost only counts while the volume itself is full (a lower volume set elsewhere wins).
    const b = volume >= 0.999 ? boost : 1;
    g.gain.gain.value = b;
    g.limiter.ratio.value = b > 1 ? 20 : 1;
  }, [boost, volume, graphReady]);

  // Switch the boost on as soon as there is a song playing (also after a restart with boost saved).
  useEffect(() => {
    if (boost <= 1 || !isPlaying || !audioEnabled || boostGraphRef.current) return;
    let tries = 0;
    let timer = 0;
    const attempt = () => {
      void enableBoostGraph().then((ok) => {
        if (ok === null && tries++ < 8) timer = window.setTimeout(attempt, 400);
        else if (ok === false && !boostGraphRef.current) setBoostState(1);
      });
    };
    attempt();
    return () => window.clearTimeout(timer);
  }, [boost, isPlaying, audioEnabled, rawCurrent?.id, enableBoostGraph]);

  // ---------- Load / play the current track ----------
  // Downloaded tracks resolve to a local blob URL first, so playback works
  // with no network and starts instantly.
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || !rawCurrent) return;
    let cancelled = false;
    const remoteUrl = rawCurrent.audioUrl;
    const applySource = (url: string) => {
      if (cancelled || !audio) return;
      if (loadedUrlRef.current !== url || !audio.src) {
        loadedUrlRef.current = url;
        audio.src = url;
        audio.load();
        const seekTo = pendingSeekRef.current;
        if (seekTo != null) {
          const apply = () => {
            try {
              audio.currentTime = seekTo;
            } catch {
              /* noop */
            }
            pendingSeekRef.current = null;
            audio.removeEventListener("loadedmetadata", apply);
          };
          audio.addEventListener("loadedmetadata", apply);
        }
      }
      audio.playbackRate = playbackRate;
      audio.volume = volume;
      if (isPlaying && audioEnabled) {
        errorSkipsRef.current = 0;
        audio.play().catch(() => {
          /* the watchdog below tries again */
        });
        // Watchdog: some phones refuse or drop the play() that follows a source
        // change (the next song loads but sits silent until you press pause then
        // play). Check shortly after, wait while the file is still loading, push
        // play again a few times, and only then show "paused" instead of lying.
        let waits = 0;
        let retries = 0;
        const check = () => {
          window.setTimeout(() => {
            if (cancelled || !isPlayingRef.current || !audioEnabled) return;
            if (!audio.paused || audio.ended) return; // it is playing, all good
            if (audio.readyState < 2 && waits++ < 8) return check(); // still loading
            if (retries++ < 3) {
              audio.play().catch(() => {});
              return check();
            }
            setIsPlaying(false);
          }, 1500);
        };
        check();
      } else if (!isPlaying) {
        audio.pause();
      }
    };

    const known = cachedPlayableUrl(remoteUrl);
    if (known) {
      applySource(known);
    } else {
      // Check the on-device download first (a quick local lookup). Trying the
      // network first made offline playback fail: the remote URL errored and
      // the player skipped the track before the local copy was found.
      resolvePlayableUrl(remoteUrl)
        .then((resolved) => applySource(resolved))
        .catch(() => applySource(remoteUrl));
    }
    return () => {
      cancelled = true;
    };
  }, [rawCurrent?.id, rawCurrent?.audioUrl, isPlaying, audioEnabled]);


  useEffect(() => {
    const audio = audioRef.current;
    if (audio) audio.volume = volume;
  }, [volume]);

  // Repeat One uses the audio element's own looping, so the song restarts
  // inside the media player with no JavaScript needed. This keeps working when
  // the screen is off or the app is in the background, where the "ended"
  // event can be delayed or missed. Next/Previous still move on as usual.
  useEffect(() => {
    const audio = audioRef.current;
    if (audio) audio.loop = repeat === "one" && sleep?.kind !== "track";
  }, [repeat, sleep]);

  // Mute is separate from volume so the slider keeps its position.
  useEffect(() => {
    if (audioRef.current) audioRef.current.muted = muted;
  }, [muted]);

  // Sleep timer: count down, fade out over the last 5 seconds, then pause.
  useEffect(() => {
    if (!sleep || sleep.kind !== "time") {
      setSleepRemaining(null);
      return;
    }
    const tick = () => {
      const left = Math.max(0, Math.ceil((sleep.endsAt - Date.now()) / 1000));
      setSleepRemaining(left);
      const audio = audioRef.current;
      if (left > 0) {
        if (audio && left <= 5) audio.volume = volumeRef.current * (left / 5);
        return;
      }
      if (audio) {
        audio.pause();
        audio.volume = volumeRef.current;
      }
      setIsPlaying(false);
      setSleep(null);
    };
    tick();
    const id = window.setInterval(tick, 1000);
    return () => {
      window.clearInterval(id);
      if (audioRef.current) audioRef.current.volume = volumeRef.current;
    };
  }, [sleep]);

  useEffect(() => {
    if (!audioEnabled) audioRef.current?.pause();
  }, [audioEnabled]);

  // ---------- Public transport API ----------
  const togglePlay = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;
    if (isPlaying) {
      audio.pause();
      setIsPlaying(false);
    } else {
      if (audioEnabled) audio.play().catch(() => {});
      setIsPlaying(true);
    }
  }, [isPlaying, audioEnabled]);

  const handleNext = useCallback(() => advanceRef.current(false), []);

  const handlePrev = useCallback(() => {
    const audio = audioRef.current;
    if (audio && audio.currentTime > 3) {
      audio.currentTime = 0;
      setCurrentTime(0);
      return;
    }
    const prev = history[history.length - 1];
    if (!prev) {
      if (audio) {
        audio.currentTime = 0;
        setCurrentTime(0);
      }
      return;
    }
    setHistory((h) => h.slice(0, -1));
    if (prev.source === "context" && contextTracks[prev.contextIndex]) {
      setSource("context");
      setQueueTrack(null);
      setContextIndex(prev.contextIndex);
    } else {
      const t = library.find((x) => x.id === prev.trackId);
      if (t) {
        setQueueTrack(t);
        setSource("queue");
      }
    }
    setCurrentTime(0);
    setIsPlaying(true);
  }, [history, contextTracks, library]);

  const seek = useCallback((time: number) => {
    const audio = audioRef.current;
    if (audio) {
      try {
        audio.currentTime = time;
      } catch {
        pendingSeekRef.current = time;
      }
    }
    setCurrentTime(time);
  }, []);

  const playContext = useCallback(
    ({ type, id = null, tracks, startIndex = 0, autoplay = true }: PlayContextArgs) => {
      if (!tracks.length) return;
      const start = Math.max(0, Math.min(startIndex, tracks.length - 1));
      setContext({ type, id, tracks });
      setContextIndex(start);
      setSource("context");
      setQueueTrack(null);
      setHistory([]);
      setShuffleOrder(shuffle ? buildShuffleOrder(tracks.length, start) : null);
      setCurrentTime(0);
      pendingSeekRef.current = null;
      if (autoplay) setIsPlaying(true);
    },
    [shuffle],
  );

  /** Backward-compatible: play by index within the global library context. */
  const playTrack = useCallback(
    (index: number) => {
      if (index < 0 || index >= library.length) return;
      playContext({ type: "library", id: null, tracks: library, startIndex: index });
    },
    [library, playContext],
  );

  // A shared/opened song keeps playing into the rest of the library instead of stopping.
  const playSingle = useCallback(
    (track: Track) => {
      const idx = library.findIndex((t) => t.id === track.id);
      if (idx >= 0) playContext({ type: "library", id: null, tracks: library, startIndex: idx });
      else playContext({ type: "single", id: track.id, tracks: [track], startIndex: 0 });
    },
    [library, playContext],
  );

  // ---------- Queue API ----------
  /** Add to the end of the manual queue ("Play last"). */
  const addToQueue = useCallback((track: Track) => setQueue((q) => [...q, track]), []);
  const playLast = addToQueue;
  const toggleMute = useCallback(() => setMuted((m) => !m), []);
  /** minutes, "track" (end of the current song) or null to cancel. */
  const setSleepTimer = useCallback((value: number | "track" | null) => {
    if (value === null) setSleep(null);
    else if (value === "track") setSleep({ kind: "track" });
    else setSleep({ kind: "time", endsAt: Date.now() + value * 60_000 });
  }, []);
  /** Stack behaviour: the most recent "Play Next" plays first. */
  const playNext = useCallback((track: Track) => setQueue((q) => [track, ...q]), []);
  const removeFromQueue = useCallback(
    (index: number) => setQueue((q) => q.filter((_, i) => i !== index)),
    [],
  );
  const reorderQueue = useCallback((from: number, to: number) => {
    setQueue((q) => {
      if (from === to || from < 0 || to < 0 || from >= q.length || to >= q.length) return q;
      const copy = q.slice();
      const [moved] = copy.splice(from, 1);
      copy.splice(to, 0, moved);
      return copy;
    });
  }, []);
  const clearQueue = useCallback(() => setQueue([]), []);
  const playQueueItem = useCallback(
    (index: number) => {
      setQueue((q) => {
        const item = q[index];
        if (!item) return q;
        if (rawCurrent) pushHistory({ trackId: rawCurrent.id, contextIndex, source });
        setQueueTrack(item);
        setSource("queue");
        setCurrentTime(0);
        setIsPlaying(true);
        return q.filter((_, i) => i !== index);
      });
    },
    [rawCurrent, contextIndex, source, pushHistory],
  );

  /** Jump directly to a track inside the current playback context. */
  const playContextIndex = useCallback(
    (index: number) => {
      if (index < 0 || index >= contextTracks.length) return;
      if (rawCurrent) pushHistory({ trackId: rawCurrent.id, contextIndex, source });
      setSource("context");
      setQueueTrack(null);
      setContextIndex(index);
      setCurrentTime(0);
      setIsPlaying(true);
    },
    [contextTracks.length, rawCurrent, contextIndex, source, pushHistory],
  );

  // ---------- Modes ----------
  const setShuffleValue = useCallback(
    (value: boolean) => {
      setShuffleState(value);
      setShuffleOrder(value ? buildShuffleOrder(contextTracks.length, contextIndex) : null);
    },
    [contextTracks.length, contextIndex],
  );
  const toggleShuffle = useCallback(() => setShuffleValue(!shuffle), [shuffle, setShuffleValue]);

  const setRepeatValue = useCallback((value: RepeatMode) => setRepeatState(value), []);
  const cycleRepeat = useCallback(
    () => setRepeatState((r) => (r === "off" ? "all" : r === "all" ? "one" : "off")),
    [],
  );

  const setPlaybackRate = useCallback((rate: number) => {
    const r = Math.min(2, Math.max(0.5, rate));
    setPlaybackRateState(r);
    if (audioRef.current) audioRef.current.playbackRate = r;
  }, []);

  const setVolume = useCallback((v: number) => {
    const clamped = Math.min(1, Math.max(0, v));
    if (clamped > 0) setMuted(false);
    setVolumeState(clamped);
    if (audioRef.current) audioRef.current.volume = clamped;
  }, []);

  const setBoost = useCallback((b: number) => {
    const next = Math.round(Math.min(2, Math.max(1, b)) * 20) / 20;
    setBoostState(next);
    setBoostIssue(null);
    try {
      localStorage.setItem(BOOST_KEY, String(next));
    } catch {
      /* noop */
    }
  }, []);

  const setDisplayTime = useCallback((t: number) => setCurrentTime(t), []);

  const markUnavailable = useCallback(
    (id: string) => setUnavailable((u) => ({ ...u, [id]: true })),
    [],
  );

  // ---------- Remote (cross-device) state application ----------
  const applyRemoteState = useCallback(
    (s: {
      songId: string | null;
      positionSeconds: number;
      isPlaying: boolean;
      playbackRate: number;
      shuffle?: boolean;
      repeat?: RepeatMode;
      volume?: number;
      queueIds?: string[];
      contextType?: PlaybackContextType;
      contextId?: string | null;
      contextTrackIds?: string[];
      contextIndex?: number;
    }) => {
      // Another device's state is newer than anything saved here.
      restoredRef.current = true;
      persistReadyRef.current = true;
      setRestorePending(false);
      const byId = new Map(library.map((t) => [t.id, t]));
      if (s.contextTrackIds && s.contextTrackIds.length) {
        const tracks = s.contextTrackIds.map((id) => byId.get(id)).filter(Boolean) as Track[];
        if (tracks.length) {
          setContext({ type: s.contextType ?? "library", id: s.contextId ?? null, tracks });
        }
      }
      if (s.queueIds) {
        setQueue(s.queueIds.map((id) => byId.get(id)).filter(Boolean) as Track[]);
      }

      const audio = audioRef.current;
      if (s.songId) {
        const tracks = s.contextTrackIds?.length
          ? (s.contextTrackIds.map((id) => byId.get(id)).filter(Boolean) as Track[])
          : contextTracks;
        const idx = tracks.findIndex((t) => t.id === s.songId);
        if (idx >= 0) {
          setSource("context");
          setQueueTrack(null);
          if (idx !== contextIndex) {
            setContextIndex(idx);
            pendingSeekRef.current = s.positionSeconds;
          }
        } else {
          const t = byId.get(s.songId);
          if (t) {
            setQueueTrack(t);
            setSource("queue");
            pendingSeekRef.current = s.positionSeconds;
          }
        }
      }

      setPlaybackRateState(s.playbackRate);
      if (typeof s.volume === "number") setVolumeState(s.volume);
      if (audio) {
        audio.playbackRate = s.playbackRate;
        if (Math.abs((audio.currentTime || 0) - s.positionSeconds) > 1.5) {
          try {
            audio.currentTime = s.positionSeconds;
          } catch {
            pendingSeekRef.current = s.positionSeconds;
          }
        }
      }
      setCurrentTime(s.positionSeconds);
      setIsPlaying(s.isPlaying);
      if (typeof s.shuffle === "boolean") setShuffleState(s.shuffle);
      if (s.repeat) setRepeatState(firstRemoteRef.current && s.repeat === "one" ? "off" : s.repeat);
      firstRemoteRef.current = false;
      if (typeof s.contextIndex === "number" && !s.songId) setContextIndex(s.contextIndex);
    },
    [library, contextTracks, contextIndex],
  );

  // ---------- Restore persisted session (never auto-plays) ----------
  useEffect(() => {
    if (restoredRef.current || !library.length) return;
    const saved = loadPersisted();
    const byId = new Map(library.map((t) => [t.id, t]));
    // Wait for the song that was playing to be in the list (the database list loads after launch).
    if (saved?.currentTrackId && !byId.has(saved.currentTrackId)) return;
    restoredRef.current = true;
    persistReadyRef.current = true;
    setRestorePending(false);
    if (!saved) return;
    const tracks = (saved.contextTrackIds || [])
      .map((id) => byId.get(id))
      .filter(Boolean) as Track[];
    if (tracks.length) {
      setContext({ type: saved.contextType, id: saved.contextId, tracks });
      setContextIndex(Math.max(0, Math.min(saved.contextIndex ?? 0, tracks.length - 1)));
    }
    if (saved.queueIds?.length) {
      setQueue(saved.queueIds.map((id) => byId.get(id)).filter(Boolean) as Track[]);
    }
    if (saved.source === "queue" && saved.currentTrackId) {
      const t = byId.get(saved.currentTrackId);
      if (t) {
        setQueueTrack(t);
        setSource("queue");
      }
    }
    setShuffleState(!!saved.shuffle);
    // Repeat One is a "right now" mode: coming back to the app with it still on
    // looks like the player is stuck on one song, so it is not restored.
    setRepeatState(saved.repeat === "one" ? "off" : saved.repeat ?? "off");
    setVolumeState(typeof saved.volume === "number" ? saved.volume : 1);
    setPlaybackRateState(saved.playbackRate || 1);
    if (saved.position > 0) {
      pendingSeekRef.current = saved.position;
      setCurrentTime(saved.position);
    }
    // Deliberately does NOT set isPlaying — browsers block autoplay.
  }, [library.length]);

  // If the song is never found (for example it was deleted), or you start something else first,
  // stop waiting for the old session.
  useEffect(() => {
    if (!restorePending) return;
    const giveUp = () => {
      restoredRef.current = true;
      persistReadyRef.current = true;
      setRestorePending(false);
    };
    const id = window.setTimeout(giveUp, 10_000);
    if (isPlaying) giveUp();
    return () => window.clearTimeout(id);
  }, [restorePending, isPlaying]);

  // ---------- Persist (throttled: only meaningful changes + position every 5s) ----------
  const lastSaveRef = useRef(0);
  useEffect(() => {
    if (!persistReadyRef.current) return;
    const now = Date.now();
    const meaningful = true;
    if (!meaningful) return;
    if (now - lastSaveRef.current < 4000 && isPlaying) return;
    lastSaveRef.current = now;
    savePersisted({
      contextType: context.type,
      contextId: context.id,
      contextTrackIds: contextTracks.map((t) => t.id),
      contextIndex,
      queueIds: queue.map((t) => t.id),
      currentTrackId: rawCurrent?.id ?? null,
      source,
      position: currentTime,
      shuffle,
      repeat,
      volume,
      playbackRate,
    });
  }, [
    context.type,
    context.id,
    contextIndex,
    queue,
    rawCurrent?.id,
    source,
    shuffle,
    repeat,
    volume,
    playbackRate,
    currentTime,
    isPlaying,
  ]);

  const currentTrackIndex = useMemo(
    () => (rawCurrent ? library.findIndex((t) => t.id === rawCurrent.id) : -1),
    [library, rawCurrent?.id],
  );

  return {
    // state
    playlist: library,
    contextTracks,
    contextType: context.type,
    contextId: context.id,
    contextIndex,
    queue,
    history,
    currentTrack,
    currentTrackIndex,
    isPlaying,
    currentTime,
    duration,
    shuffle,
    repeat,
    playbackRate,
    volume,
    boost,
    boostIssue,
    muted,
    sleepTimer: sleep,
    sleepRemaining,
    unavailable,
    // transport
    togglePlay,
    handleNext,
    handlePrev,
    seek,
    playTrack,
    playContext,
    playContextIndex,
    playSingle,
    // queue
    addToQueue,
    playLast,
    playNext,
    removeFromQueue,
    reorderQueue,
    clearQueue,
    playQueueItem,
    // modes
    setShuffle: toggleShuffle,
    setShuffleValue,
    setRepeat: cycleRepeat,
    setRepeatValue,
    setPlaybackRate,
    setVolume,
    setBoost,
    toggleMute,
    setSleepTimer,
    // internals for sync layer
    applyRemoteState,
    setDisplayTime,
    markUnavailable,
  };
}
