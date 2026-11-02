import { describe, expect, it, vi } from "vitest";
import { renderHook, waitFor, act } from "@testing-library/react";

const { upserts } = vi.hoisted(() => ({ upserts: [] as any[] }));

vi.mock("@/integrations/supabase/client", () => {
  const dev = { id: "dev1", user_id: "u", client_id: "c", name: "PC", kind: "desktop", output_label: null, last_seen_at: "", created_at: "" };
  const table = (name: string) => {
    const c: any = {
      select: () => c, eq: () => c, order: () => Promise.resolve({ data: name === "devices" ? [dev] : [] }),
      maybeSingle: () => Promise.resolve({ data: name === "devices" ? dev : null, error: null }),
      upsert: (v: any) => { if (name === "playback_state") upserts.push(v); return { select: () => ({ maybeSingle: () => Promise.resolve({ data: dev, error: null }) }), then: (f: any) => f({ error: null }) }; },
      update: () => ({ eq: () => Promise.resolve({}) }),
    };
    return c;
  };
  const channel: any = { on: () => channel, subscribe: () => channel };
  return {
    supabase: {
      auth: { getSession: () => Promise.resolve({ data: { session: { user: { id: "u" } } } }), onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } }) },
      from: table, channel: () => channel, removeChannel: () => {},
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
