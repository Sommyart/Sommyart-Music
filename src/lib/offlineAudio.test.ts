import { beforeEach, describe, expect, it, vi } from "vitest";

// A tiny in-memory stand-in for the browser's Cache API.
function fakeCaches() {
  const stores = new Map<string, Map<string, Response>>();
  const open = async (name: string) => {
    if (!stores.has(name)) stores.set(name, new Map());
    const m = stores.get(name)!;
    return {
      match: async (u: string) => m.get(u)?.clone(),
      put: async (u: string, r: Response) => { m.set(u, r); },
      keys: async () => [...m.keys()],
      delete: async (u: string) => m.delete(u),
    };
  };
  return { open, stores };
}

const CLOUD = "https://example.supabase.co/storage/v1/object/public/music/";
const okAudio = () => new Response(new Uint8Array(2000), { status: 200, headers: { "Content-Type": "audio/mpeg" } });

let fc: ReturnType<typeof fakeCaches>;
let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(async () => {
  vi.resetModules();
  fc = fakeCaches();
  (window as any).caches = fc;
  (globalThis as any).caches = fc;
  fetchMock = vi.fn(async () => okAudio());
  (globalThis as any).fetch = fetchMock;
  (URL as any).createObjectURL = vi.fn(() => `blob:${Math.random()}`);
  (URL as any).revokeObjectURL = vi.fn();
});

describe("automatic song saving", () => {
  it("saves a cloud song once and then plays it from the device", async () => {
    const m = await import("./offlineAudio");
    const url = CLOUD + "a.mp3";
    expect(await m.autoCacheTrack(url)).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    // A second call does not download again.
    expect(await m.autoCacheTrack(url)).toBe(false);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    // Playing it now resolves to a local copy.
    expect((await m.resolvePlayableUrl(url)).startsWith("blob:")).toBe(true);
  });

  it("leaves songs that ship inside the app alone", async () => {
    const m = await import("./offlineAudio");
    expect(await m.autoCacheTrack("/music/Anointed.mp3")).toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("does nothing when offline or when the server refuses", async () => {
    const m = await import("./offlineAudio");
    fetchMock.mockResolvedValueOnce(new Response("no", { status: 402 }));
    expect(await m.autoCacheTrack(CLOUD + "blocked.mp3")).toBe(false);
    expect([...(fc.stores.get("sommyart-auto-music-v1") ?? new Map()).keys()]).toHaveLength(0);
    Object.defineProperty(navigator, "onLine", { value: false, configurable: true });
    expect(await m.autoCacheTrack(CLOUD + "offline.mp3")).toBe(false);
    Object.defineProperty(navigator, "onLine", { value: true, configurable: true });
  });

  it("drops the oldest saved songs beyond the limit", async () => {
    const m = await import("./offlineAudio");
    for (let i = 0; i < m.AUTO_CACHE_MAX + 3; i++) await m.autoCacheTrack(CLOUD + `s${i}.mp3`);
    const keys = [...fc.stores.get("sommyart-auto-music-v1")!.keys()];
    expect(keys).toHaveLength(m.AUTO_CACHE_MAX);
    expect(keys).not.toContain(CLOUD + "s0.mp3");
    expect(keys).toContain(CLOUD + `s${m.AUTO_CACHE_MAX + 2}.mp3`);
  });

  it("reads cover art from a saved song without downloading", async () => {
    const m = await import("./offlineAudio");
    await m.autoCacheTrack(CLOUD + "c.mp3");
    fetchMock.mockClear();
    const head = await m.readCachedAudioHead(CLOUD + "c.mp3", 100);
    expect(head?.byteLength).toBe(100);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(await m.readCachedAudioHead(CLOUD + "never.mp3", 100)).toBeNull();
  });

  it("releases old in-memory copies so a long listening session does not fill memory", async () => {
    const m = await import("./offlineAudio");
    for (let i = 0; i < 10; i++) {
      await m.autoCacheTrack(CLOUD + `m${i}.mp3`);
      await m.resolvePlayableUrl(CLOUD + `m${i}.mp3`);
    }
    expect((URL as any).revokeObjectURL).toHaveBeenCalled();
  });
});
