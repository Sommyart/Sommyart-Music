import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, renderHook } from "@testing-library/react";

let inCall: boolean | null = false;
vi.mock("@/lib/callState", async (orig) => {
  const real = await orig<typeof import("@/lib/callState")>();
  return { ...real, watchForCallEnd: (cb: () => void) => real.watchForCallEnd(cb, () => Promise.resolve(inCall)) };
});

import { usePlaybackEngine } from "./usePlaybackEngine";

const mk = (id: string, title: string) => ({ id, title, artist: "A", audioUrl: `/music/${title}.mp3`, coverUrl: "/x.png" });
const LIB = [mk("a", "One"), mk("b", "Two"), mk("c", "Three")];

// A small stand-in for the phone's audio player: keeps a position, ready state and paused flag.
type FakeEl = HTMLMediaElement & { _t: number; _ready: number; _paused: boolean };
let el: FakeEl | null = null;

beforeEach(() => {
  vi.useFakeTimers();
  localStorage.clear();
  inCall = false;
  const proto = HTMLMediaElement.prototype as any;
  Object.defineProperty(proto, "currentTime", {
    configurable: true,
    get() { return this._t ?? 0; },
    set(v: number) { this._t = v; },
  });
  Object.defineProperty(proto, "readyState", { configurable: true, get() { return this._ready ?? 0; } });
  Object.defineProperty(proto, "paused", { configurable: true, get() { return this._paused ?? true; } });
  Object.defineProperty(proto, "duration", { configurable: true, get() { return 240; } });
  proto.load = function () {
    el = this;
    this._ready = 0;
    this._t = 0; // loading a file always starts it at the beginning, as on a real phone
    setTimeout(() => { this._ready = 4; this.dispatchEvent(new Event("loadedmetadata")); }, 50);
  };
  proto.play = function () { el = this; this._paused = false; return Promise.resolve(); };
  proto.pause = function () { this._paused = true; };
});
afterEach(() => vi.useRealTimers());

const tick = async (ms: number) => { await act(async () => { await vi.advanceTimersByTimeAsync(ms); }); };

/** The phone pauses the music by itself (as it does when a call comes in). */
const phonePauses = () => {
  act(() => {
    el!._paused = true;
    el!.dispatchEvent(new Event("pause"));
  });
};

describe("after a phone call", () => {
  it("carries on by itself from the same spot once the call is over", async () => {
    const { result } = renderHook(() => usePlaybackEngine(LIB, true));
    act(() => result.current.playContext({ type: "library", tracks: LIB, startIndex: 1 }));
    await tick(200);
    act(() => { el!.currentTime = 95; el!.dispatchEvent(new Event("timeupdate")); });

    inCall = true;
    phonePauses();
    await tick(3000);
    expect(result.current.isPlaying).toBe(false);

    inCall = false;
    await tick(5000);
    expect(result.current.isPlaying).toBe(true);
    expect(result.current.currentTrack?.title).toBe("Two");
    expect(Math.round(el!.currentTime)).toBe(95);
  });

  it("stays paused when the pause was not a call", async () => {
    const { result } = renderHook(() => usePlaybackEngine(LIB, true));
    act(() => result.current.playContext({ type: "library", tracks: LIB, startIndex: 0 }));
    await tick(200);
    phonePauses();
    await tick(20_000);
    expect(result.current.isPlaying).toBe(false);
  });

  it("does not jump back to the start when the phone dropped the song while paused", async () => {
    const { result } = renderHook(() => usePlaybackEngine(LIB, true));
    act(() => result.current.playContext({ type: "library", tracks: LIB, startIndex: 0 }));
    await tick(200);
    act(() => { el!.currentTime = 61; el!.dispatchEvent(new Event("timeupdate")); });
    phonePauses();
    await tick(1000);
    // The phone resets the player behind the app's back.
    act(() => { el!.currentTime = 0; });
    act(() => result.current.togglePlay());
    await tick(200);
    expect(Math.round(el!.currentTime)).toBe(61);
  });
});

describe("switching devices", () => {
  it("starts the same song at the shared position, not from the beginning", async () => {
    // This device has not loaded anything yet, and already sits on the same song (index 1).
    const { result } = renderHook(({ on }) => usePlaybackEngine(LIB, on), { initialProps: { on: false } });
    act(() => result.current.playContext({ type: "library", tracks: LIB, startIndex: 1, autoplay: false }));
    await tick(200);
    act(() => {
      result.current.applyRemoteState({
        songId: "b", positionSeconds: 132, isPlaying: true, playbackRate: 1,
        contextType: "library", contextId: null, contextTrackIds: LIB.map((t) => t.id), contextIndex: 1,
      });
    });
    await tick(200);
    expect(Math.round(el!.currentTime)).toBe(132);
  });

  it("does not use a position meant for another song", async () => {
    const { result } = renderHook(() => usePlaybackEngine(LIB, true));
    act(() => {
      result.current.applyRemoteState({
        songId: "zzz", positionSeconds: 132, isPlaying: false, playbackRate: 1,
      });
    });
    act(() => result.current.playContext({ type: "library", tracks: LIB, startIndex: 2 }));
    await tick(200);
    expect(Math.round(el!.currentTime)).toBe(0);
  });
});
