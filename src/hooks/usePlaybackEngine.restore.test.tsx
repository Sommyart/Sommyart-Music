import { describe, expect, it, beforeEach, vi } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { usePlaybackEngine } from "./usePlaybackEngine";
import { PERSIST_KEY } from "@/lib/playback";

const mk = (id: string, title: string) => ({ id, title, artist: "A", audioUrl: `/music/${title}.mp3`, coverUrl: "/x.png" });
const BUNDLED = [mk("1", "Anointed"), mk("k2", "Baruch")];
const DB_ID = "11111111-1111-4111-8111-111111111111";
const WITH_DB = [...BUNDLED, mk(DB_ID, "Midnight on Your Skin"), mk("22222222-2222-4222-8222-222222222222", "Zebra")];

const saved = (over: object = {}) => ({
  contextType: "library", contextId: null, contextTrackIds: WITH_DB.map((t) => t.id), contextIndex: 2,
  queueIds: [], currentTrackId: DB_ID, source: "context", position: 131.5, shuffle: false, repeat: "off",
  volume: 0.8, playbackRate: 1, ...over,
});

beforeEach(() => {
  HTMLMediaElement.prototype.pause = () => {};
  HTMLMediaElement.prototype.play = () => Promise.resolve();
  HTMLMediaElement.prototype.load = () => {};
  localStorage.clear();
});

describe("coming back to the app", () => {
  it("shows the last song, paused, once the database songs have loaded", () => {
    localStorage.setItem(PERSIST_KEY, JSON.stringify(saved()));
    const { result, rerender } = renderHook(({ lib }) => usePlaybackEngine(lib, true), { initialProps: { lib: BUNDLED } });

    // Only the bundled songs are known yet: do not show the wrong song, and keep the saved session.
    expect(result.current.currentTrack).toBeNull();
    expect(JSON.parse(localStorage.getItem(PERSIST_KEY)!).currentTrackId).toBe(DB_ID);

    act(() => { rerender({ lib: WITH_DB }); });
    expect(result.current.currentTrack?.title).toBe("Midnight on Your Skin");
    expect(result.current.isPlaying).toBe(false);
    expect(Math.round(result.current.currentTime)).toBe(132);
    expect(result.current.volume).toBeCloseTo(0.8);
  });

  it("still works when the last song is one of the bundled songs", () => {
    localStorage.setItem(PERSIST_KEY, JSON.stringify(saved({ contextTrackIds: ["1", "k2"], contextIndex: 1, currentTrackId: "k2", position: 40 })));
    const { result } = renderHook(() => usePlaybackEngine(BUNDLED, true));
    expect(result.current.currentTrack?.title).toBe("Baruch");
    expect(Math.round(result.current.currentTime)).toBe(40);
  });

  it("does nothing special when there is no saved session", () => {
    const { result } = renderHook(() => usePlaybackEngine(BUNDLED, true));
    expect(result.current.currentTrack).not.toBeNull();
  });

  it("stops waiting if the saved song no longer exists", () => {
    vi.useFakeTimers();
    try {
      localStorage.setItem(PERSIST_KEY, JSON.stringify(saved({ currentTrackId: "gone", contextTrackIds: ["gone"], contextIndex: 0 })));
      const { result } = renderHook(() => usePlaybackEngine(WITH_DB, true));
      expect(result.current.currentTrack).toBeNull();
      act(() => { vi.advanceTimersByTime(10_500); });
      expect(result.current.currentTrack).not.toBeNull();
    } finally {
      vi.useRealTimers();
    }
  });

  it("lets you start another song before the old session is found", () => {
    localStorage.setItem(PERSIST_KEY, JSON.stringify(saved()));
    const { result, rerender } = renderHook(({ lib }) => usePlaybackEngine(lib, true), { initialProps: { lib: BUNDLED } });
    expect(result.current.currentTrack).toBeNull();
    act(() => { result.current.playTrack(1); });
    act(() => { rerender({ lib: WITH_DB }); });
    expect(result.current.currentTrack?.title).toBe("Baruch");
  });
});
