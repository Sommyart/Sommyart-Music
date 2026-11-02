import { describe, expect, it, vi, beforeEach } from "vitest";
import { act, render, screen } from "@testing-library/react";
import { kosherTracks } from "@/lib/tracks";

const MID = "11111111-1111-4111-8111-111111111111";
const OTHER = "22222222-2222-4222-8222-222222222222";
const K2 = kosherTracks.find((t) => t.id === "k2")!;
const mk = (id: string, title: string) => ({ id, title, artist: "A", audioUrl: `/music/${title}.mp3`, coverUrl: "/x.png" });
const LIB = [mk(MID, "Midnight on Your Skin"), mk(OTHER, "Other Song"), K2];

const { sync, listState } = vi.hoisted(() => ({ sync: { current: null as any }, listState: { loading: false } }));

vi.mock("@/hooks/useDeviceSync", () => ({ useDeviceSync: () => sync.current }));
vi.mock("@/hooks/useOnline", () => ({ useOnline: () => true }));
vi.mock("@/hooks/useSongsFromDB", () => ({
  useSongsFromDB: () => ({
    songs: LIB, allSongs: LIB, kosherTracks: [], loading: listState.loading, newestTrack: null, newestTracks: [], refetch: async () => {},
  }),
}));
vi.mock("@/integrations/supabase/client", () => ({
  supabase: { from: () => ({ insert: () => ({ then: () => {} }) }) },
}));

import { MusicPlayerProvider, useMusicPlayerContext } from "./MusicPlayerContext";

function Probe() {
  const p = useMusicPlayerContext();
  return (
    <div>
      <span data-testid="title">{p.currentTrack?.title ?? "none"}</span>
      <span data-testid="playing">{String(p.isPlaying)}</span>
      <span data-testid="time">{Math.round(p.currentTime)}</span>
    </div>
  );
}

const phone = { id: "phone" };
const pcId = "pc";

function state(over: Record<string, unknown>) {
  return {
    user_id: "u", song_id: null, track_id: null, position_seconds: 0, is_playing: true, playback_rate: 1,
    shuffle: false, repeat_mode: "off", active_device_id: pcId, updated_by_device: pcId, version: 1,
    updated_at: new Date().toISOString(), queue: [], context_type: "library",
    context_id: null, context_track_ids: [MID, OTHER, "k2"], context_index: 0, volume: 1, ...over,
  };
}

function setSync(playback: any, pushState = vi.fn()) {
  sync.current = {
    userId: "u", device: phone, devices: [phone, { id: pcId, name: "Windows PC" }], playback,
    isThisDeviceActive: playback.active_device_id === phone.id, pushState,
    transferTo: vi.fn(), renameDevice: vi.fn(), removeDevice: vi.fn(),
  };
  return pushState;
}

beforeEach(() => {
  listState.loading = false;
  HTMLMediaElement.prototype.pause = () => {};
  HTMLMediaElement.prototype.play = () => Promise.resolve();
  HTMLMediaElement.prototype.load = () => {};
  localStorage.clear();
});

describe("a phone that only shows what the PC plays", () => {
  it("switches to a song bundled with the app, even when the PC played it from its queue", async () => {
    setSync(state({ version: 1, song_id: MID, track_id: MID, context_index: 0 }));
    const { rerender } = render(<MusicPlayerProvider><Probe /></MusicPlayerProvider>);
    expect(screen.getByTestId("title").textContent).toBe("Midnight on Your Skin");

    // The PC moves on to "Baruch Hashem Adonai" (id "k2", not a database id) from its queue,
    // so its context position is unchanged. The database could not store "k2" in song_id.
    act(() => { setSync(state({ version: 2, song_id: null, track_id: "k2", context_index: 0, position_seconds: 0 })); });
    rerender(<MusicPlayerProvider><Probe /></MusicPlayerProvider>);
    expect(screen.getByTestId("title").textContent).toBe("Baruch Hashem Adonai");
  });

  it("still works with an older state that has no track_id", async () => {
    setSync(state({ version: 1, song_id: MID, track_id: null }));
    const { rerender } = render(<MusicPlayerProvider><Probe /></MusicPlayerProvider>);
    act(() => { setSync(state({ version: 2, song_id: OTHER, track_id: null, context_index: 1 })); });
    rerender(<MusicPlayerProvider><Probe /></MusicPlayerProvider>);
    expect(screen.getByTestId("title").textContent).toBe("Other Song");
  });

  it("does not send back the state it just received", async () => {
    const push = setSync(state({ version: 1, song_id: MID, track_id: MID }));
    const { rerender } = render(<MusicPlayerProvider><Probe /></MusicPlayerProvider>);
    push.mockClear();
    act(() => { setSync(state({ version: 2, song_id: null, track_id: "k2" }), push); });
    rerender(<MusicPlayerProvider><Probe /></MusicPlayerProvider>);
    expect(screen.getByTestId("title").textContent).toBe("Baruch Hashem Adonai");
    expect(push).not.toHaveBeenCalled();
  });
});

describe("opening the app while another device plays", () => {
  it("waits for the song list instead of dropping the update", async () => {
    listState.loading = true;
    setSync(state({ version: 5, song_id: null, track_id: "k2", context_index: 1 }));
    const { rerender } = render(<MusicPlayerProvider><Probe /></MusicPlayerProvider>);
    // List still loading: nothing applied yet.
    expect(screen.getByTestId("title").textContent).not.toBe("Baruch Hashem Adonai");
    listState.loading = false;
    act(() => { setSync(state({ version: 5, song_id: null, track_id: "k2", context_index: 1 })); });
    rerender(<MusicPlayerProvider><Probe /></MusicPlayerProvider>);
    expect(screen.getByTestId("title").textContent).toBe("Baruch Hashem Adonai");
  });
});

describe("launching the app", () => {
  it("does not start music by itself when playback was handed to this device", () => {
    setSync(state({ version: 9, song_id: MID, track_id: MID, active_device_id: phone.id, updated_by_device: pcId, is_playing: true }));
    render(<MusicPlayerProvider><Probe /></MusicPlayerProvider>);
    expect(screen.getByTestId("title").textContent).toBe("Midnight on Your Skin");
    expect(screen.getByTestId("playing").textContent).toBe("false");
  });

  it("still shows another device as playing", () => {
    setSync(state({ version: 9, song_id: MID, track_id: MID, is_playing: true }));
    render(<MusicPlayerProvider><Probe /></MusicPlayerProvider>);
    expect(screen.getByTestId("playing").textContent).toBe("true");
  });
});
