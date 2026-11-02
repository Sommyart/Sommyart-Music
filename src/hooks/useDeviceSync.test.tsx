import { describe, expect, it, vi } from "vitest";
import { renderHook, waitFor, act } from "@testing-library/react";

const { upserts, updates, rpcState } = vi.hoisted(() => ({ upserts: [] as any[], updates: [] as any[], rpcState: { serverOffsetMs: 0 } }));

vi.mock("@/integrations/supabase/client", () => {
  const dev = { id: "dev1", user_id: "u", client_id: "c", name: "PC", kind: "desktop", output_label: null, last_seen_at: "", created_at: "" };
  const table = (name: string) => {
    const c: any = {
      select: () => c, eq: () => c, order: () => Promise.resolve({ data: name === "devices" ? [dev] : [] }),
      maybeSingle: () => Promise.resolve({ data: name === "devices" ? dev : null, error: null }),
      upsert: (v: any) => {
        if (name === "playback_state") upserts.push(v);
        const row = { ...v, version: upserts.length, updated_at: new Date().toISOString() };
        return { select: () => ({ maybeSingle: () => Promise.resolve({ data: name === "playback_state" ? row : dev, error: null }) }) };
      },
      update: (v: any) => {
        if (name === "playback_state") updates.push(v);
        const q: any = { eq: () => q, select: () => q, maybeSingle: () => Promise.resolve({ data: null, error: null }), then: (f: any) => f({}) };
        return q;
      },
    };
    return c;
  };
  const channel: any = { on: () => channel, subscribe: () => channel };
  return {
    supabase: {
      auth: { getSession: () => Promise.resolve({ data: { session: { user: { id: "u" } } } }), onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } }) },
      from: table, channel: () => channel, removeChannel: () => {},
      rpc: () => Promise.resolve({ data: new Date(Date.now() + rpcState.serverOffsetMs).toISOString(), error: null }),
    },
  };
});

import { useDeviceSync } from "./useDeviceSync";

describe("useDeviceSync.pushState", () => {
  it("keeps the id of a song bundled with the app in track_id", async () => {
    const { result } = renderHook(() => useDeviceSync());
    await waitFor(() => expect(result.current.device).not.toBeNull());
    await act(async () => { await result.current.pushState({ song_id: "k2", position_seconds: 5 }); });
    expect(upserts.at(-1)).toMatchObject({ song_id: null, track_id: "k2", position_seconds: 5 });
  });

  it("writes a database song id to both columns", async () => {
    const { result } = renderHook(() => useDeviceSync());
    await waitFor(() => expect(result.current.device).not.toBeNull());
    const id = "11111111-1111-4111-8111-111111111111";
    await act(async () => { await result.current.pushState({ song_id: id }); });
    expect(upserts.at(-1)).toMatchObject({ song_id: id, track_id: id });
  });
});


describe("useDeviceSync accuracy", () => {
  it("does not let a check-in from a device that is not playing overwrite the session", async () => {
    updates.length = 0;
    const { result } = renderHook(() => useDeviceSync());
    await waitFor(() => expect(result.current.device).not.toBeNull());
    // This device pushes first, so it owns playback.
    await act(async () => { await result.current.pushState({ song_id: "k2", active_device_id: "dev1" }); });
    await act(async () => { await result.current.pushHeartbeat(() => ({ track_id: "k2", position_seconds: 42, is_playing: true, context_index: 3 })); });
    expect(updates.at(-1)).toMatchObject({ track_id: "k2", position_seconds: 42, context_index: 3 });

    // Another device takes over: our check-in must be dropped, not sent.
    updates.length = 0;
    await act(async () => { await result.current.pushState({ active_device_id: "other" }); });
    await act(async () => { await result.current.pushHeartbeat(() => ({ track_id: "k2", position_seconds: 50, is_playing: true, context_index: 3 })); });
    expect(updates).toHaveLength(0);
  });

  it("builds each push on the one before it, so a quick second action never undoes the first", async () => {
    const { result } = renderHook(() => useDeviceSync());
    await waitFor(() => expect(result.current.device).not.toBeNull());
    await act(async () => {
      const a = result.current.pushState({ shuffle: true });
      const b = result.current.pushState({ position_seconds: 9 });
      await Promise.all([a, b]);
    });
    expect(upserts.at(-1)).toMatchObject({ shuffle: true, position_seconds: 9 });
  });

  it("measures how far this device's clock is from the server's", async () => {
    rpcState.serverOffsetMs = 7000;
    const { result } = renderHook(() => useDeviceSync());
    await waitFor(() => expect(Math.abs(result.current.serverNow() - Date.now() - 7000)).toBeLessThan(500));
    rpcState.serverOffsetMs = 0;
  });
});
