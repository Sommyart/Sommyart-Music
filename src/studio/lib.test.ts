import { beforeEach, describe, expect, it, vi } from "vitest";

const invoke = vi.fn();
const upload = vi.fn();
vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    functions: { invoke: (...a: unknown[]) => invoke(...a) },
    storage: {
      from: () => ({
        upload: (...a: unknown[]) => upload(...a),
        getPublicUrl: (p: string) => ({ data: { publicUrl: `https://old.example/${p}` } }),
      }),
    },
  },
}));

const file = () => new File([new Uint8Array(100)], "song.mp3", { type: "audio/mpeg" });
let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  vi.resetModules();
  invoke.mockReset();
  upload.mockReset();
  upload.mockResolvedValue({ error: null });
  fetchMock = vi.fn(async () => new Response("", { status: 200 }));
  (globalThis as any).fetch = fetchMock;
  vi.spyOn(console, "warn").mockImplementation(() => {});
});

describe("uploadFile", () => {
  it("sends a song straight to R2 with a signed link and returns the public R2 address", async () => {
    invoke.mockResolvedValue({ data: { uploadUrl: "https://r2.example/put?sig=1", publicUrl: "https://pub.example/music/x.mp3", cacheControl: "public, max-age=1" }, error: null });
    const { uploadFile } = await import("./lib");
    const url = await uploadFile("music", file(), "My Song");
    expect(url).toBe("https://pub.example/music/x.mp3");
    expect(invoke).toHaveBeenCalledWith("r2-upload-url", { body: expect.objectContaining({ bucket: "music", contentType: "audio/mpeg", size: 100, path: expect.stringMatching(/^My_Song_\d+_[a-z0-9]+\.mp3$/) }) });
    expect(fetchMock).toHaveBeenCalledWith("https://r2.example/put?sig=1", expect.objectContaining({ method: "PUT", headers: expect.objectContaining({ "Content-Type": "audio/mpeg", "Cache-Control": "public, max-age=1" }) }));
    expect(upload).not.toHaveBeenCalled();
  });

  it("keeps an artist's folder in the path", async () => {
    invoke.mockResolvedValue({ data: { uploadUrl: "https://r2.example/put", publicUrl: "https://pub.example/x" }, error: null });
    const { uploadFile } = await import("./lib");
    await uploadFile("covers", new File([new Uint8Array(10)], "c.jpg", { type: "image/jpeg" }), "Cover", "artists/user-1/");
    expect(invoke.mock.calls[0][1].body.path).toMatch(/^artists\/user-1\/Cover_/);
  });

  it("falls back to the old storage when R2 cannot be used, so no upload is lost", async () => {
    invoke.mockResolvedValue({ data: { error: "You are not allowed to upload here" }, error: { message: "403" } });
    const { uploadFile } = await import("./lib");
    const url = await uploadFile("music", file(), "Song");
    expect(upload).toHaveBeenCalledTimes(1);
    expect(url).toMatch(/^https:\/\/old\.example\/Song_/);
  });

  it("falls back when the upload to R2 itself is refused", async () => {
    invoke.mockResolvedValue({ data: { uploadUrl: "https://r2.example/put", publicUrl: "https://pub.example/x" }, error: null });
    fetchMock.mockResolvedValueOnce(new Response("no", { status: 403 }));
    const { uploadFile } = await import("./lib");
    const url = await uploadFile("music", file(), "Song");
    expect(upload).toHaveBeenCalledTimes(1);
    expect(url).toMatch(/^https:\/\/old\.example\//);
  });

  it("keeps applicants' profile pictures on the old storage, where the upload limit is enforced", async () => {
    const { uploadFile } = await import("./lib");
    const url = await uploadFile("covers", new File([new Uint8Array(10)], "p.jpg", { type: "image/jpeg" }), "me_photo", "applications/user-1");
    expect(invoke).not.toHaveBeenCalled();
    expect(url).toMatch(/^https:\/\/old\.example\/applications\/user-1\//);
  });
});
