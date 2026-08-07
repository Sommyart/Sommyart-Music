import { Track } from "@/lib/tracks";

export type PlaybackContextType =
  | "library"
  | "album"
  | "playlist"
  | "artist"
  | "downloads"
  | "search"
  | "single";

export interface PlaybackContext {
  type: PlaybackContextType;
  id: string | null;
  tracks: Track[];
}

export type RepeatMode = "off" | "all" | "one";

export interface HistoryEntry {
  trackId: string;
  contextIndex: number;
  source: "context" | "queue";
}

export const PERSIST_KEY = "sommyart.playback.v1";

export interface PersistedPlayback {
  contextType: PlaybackContextType;
  contextId: string | null;
  contextTrackIds: string[];
  contextIndex: number;
  queueIds: string[];
  currentTrackId: string | null;
  source: "context" | "queue";
  position: number;
  shuffle: boolean;
  repeat: RepeatMode;
  volume: number;
  playbackRate: number;
}

/** Fisher–Yates shuffle of context indices, with `first` pinned to the front. */
export function buildShuffleOrder(length: number, first: number): number[] {
  const rest: number[] = [];
  for (let i = 0; i < length; i++) if (i !== first) rest.push(i);
  for (let i = rest.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [rest[i], rest[j]] = [rest[j], rest[i]];
  }
  return first >= 0 && first < length ? [first, ...rest] : rest;
}

export function loadPersisted(): PersistedPlayback | null {
  try {
    const raw = localStorage.getItem(PERSIST_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return null;
    return parsed as PersistedPlayback;
  } catch {
    return null;
  }
}

export function savePersisted(state: PersistedPlayback) {
  try {
    localStorage.setItem(PERSIST_KEY, JSON.stringify(state));
  } catch {
    /* storage full / private mode — non-fatal */
  }
}

export function formatTime(seconds: number): string {
  if (!isFinite(seconds) || seconds < 0) return "0:00";
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}
