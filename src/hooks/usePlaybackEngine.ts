import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Track } from "@/lib/tracks";
import { extractCoverArt } from "@/lib/extractCoverArt";
import { cachedPlayableUrl, resolvePlayableUrl } from "@/lib/offlineAudio";

import {
  buildShuffleOrder,
  HistoryEntry,
  loadPersisted,
  PlaybackContext,
  PlaybackContextType,
  RepeatMode,
  savePersisted,
} from "@/lib/playback";

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
  const [shuffleOrder, setShuffleOrder] = useState<number[] | null>(null);
  const [extractedCover, setExtractedCover] = useState<string | null>(null);
  const [unavailable, setUnavailable] = useState<Record<string, true>>({});

  // Position to seek to once the next media element is ready (restore/remote).
  const pendingSeekRef = useRef<number | null>(null);
  // Guards against error-driven infinite skipping.
  const errorSkipsRef = useRef(0);
  const restoredRef = useRef(false);

  const contextTracks = context.tracks.length ? context.tracks : library;
  const rawCurrent =
    source === "queue" ? queueTrack : contextTracks[contextIndex] ?? null;

  // ---------- Cover art enrichment ----------
  useEffect(() => {
    if (!rawCurrent) return;
    setExtractedCover(null);
    let cancelled = false;
    extractCoverArt(rawCurrent.audioUrl).then((cover) => {
      if (!cancelled && cover) setExtractedCover(cover);
    });
    return () => {
      cancelled = true;
    };
  }, [rawCurrent?.audioUrl]);

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
        setQueueTrack(head);
        setSource("queue");
        setIsPlaying(true);
        setCurrentTime(0);
        return;
      }

      // 2) Remaining playback context.
      const next = nextContextIndex();
      if (next !== null) {
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
      contextTracks.length,
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
    let endedLock = false;
    const onEnded = () => {
      if (endedLock) return; // race guard: one advance per ended event
      endedLock = true;
      window.setTimeout(() => {
        endedLock = false;
      }, 400);
      advanceRef.current(true);
    };
    const onError = () => {
      const err = audio.error;
      if (!audio.src) return;
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

    audio.addEventListener("timeupdate", onTime);
    audio.addEventListener("loadedmetadata", onMeta);
    audio.addEventListener("ended", onEnded);
    audio.addEventListener("error", onError);
    return () => {
      audio.removeEventListener("timeupdate", onTime);
      audio.removeEventListener("loadedmetadata", onMeta);
      audio.removeEventListener("ended", onEnded);
      audio.removeEventListener("error", onError);
      audio.pause();
      audio.src = "";
    };
  }, []);

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
      if (audio.src !== url) {
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
          /* autoplay blocked — user gesture required */
        });
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
    if (audio) audio.loop = repeat === "one";
  }, [repeat]);

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

  const playSingle = useCallback(
    (track: Track) => playContext({ type: "single", id: track.id, tracks: [track], startIndex: 0 }),
    [playContext],
  );

  // ---------- Queue API ----------
  const addToQueue = useCallback((track: Track) => setQueue((q) => [...q, track]), []);
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
    setVolumeState(clamped);
    if (audioRef.current) audioRef.current.volume = clamped;
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
      if (s.repeat) setRepeatState(s.repeat);
      if (typeof s.contextIndex === "number" && !s.songId) setContextIndex(s.contextIndex);
    },
    [library, contextTracks, contextIndex],
  );

  // ---------- Restore persisted session (never auto-plays) ----------
  useEffect(() => {
    if (restoredRef.current || !library.length) return;
    restoredRef.current = true;
    const saved = loadPersisted();
    if (!saved) return;
    const byId = new Map(library.map((t) => [t.id, t]));
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
    setRepeatState(saved.repeat ?? "off");
    setVolumeState(typeof saved.volume === "number" ? saved.volume : 1);
    setPlaybackRateState(saved.playbackRate || 1);
    if (saved.position > 0) {
      pendingSeekRef.current = saved.position;
      setCurrentTime(saved.position);
    }
    // Deliberately does NOT set isPlaying — browsers block autoplay.
  }, [library.length]);

  // ---------- Persist (throttled: only meaningful changes + position every 5s) ----------
  const lastSaveRef = useRef(0);
  useEffect(() => {
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
    // internals for sync layer
    applyRemoteState,
    setDisplayTime,
    markUnavailable,
  };
}
