import { describe, expect, it } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { isAudio, receiveBatch, tabFor, useSharedFiles, useSharedTab } from "./sharedFiles";

const fakeRead = async (f: { name: string; type: string }) => new File(["x"], f.name, { type: f.type });

describe("songs shared from the file manager", () => {
  it("recognises songs by type or by file name", () => {
    expect(isAudio("a.mp3", "")).toBe(true);
    expect(isAudio("a.bin", "audio/mpeg")).toBe(true);
    expect(isAudio("photo.jpg", "image/jpeg")).toBe(false);
  });

  it("opens Single for one song and Album for several", async () => {
    const { result } = renderHook(() => useSharedTab());
    expect(result.current[0]).toBe("single");
    await act(async () => {
      await receiveBatch({ id: "b1", files: [
        { path: "file:///x/1.mp3", name: "One.mp3", type: "audio/mpeg", size: 1 },
        { path: "file:///x/2.mp3", name: "Two.mp3", type: "audio/mpeg", size: 1 },
      ] }, fakeRead);
    });
    expect(result.current[0]).toBe("album");
  });

  it("hands each batch out once, and lists files it could not use", async () => {
    const { result } = renderHook(() => useSharedFiles());
    await act(async () => {
      await receiveBatch({ id: "b2", files: [
        { path: "file:///x/s.mp3", name: "Song.mp3", type: "audio/mpeg", size: 1 },
        { path: "file:///x/p.jpg", name: "Photo.jpg", type: "image/jpeg", size: 1 },
      ] }, fakeRead);
    });
    const b = result.current.batch!;
    expect(b.audio.map((f) => f.name)).toEqual(["Song.mp3"]);
    expect(b.skipped).toEqual(["Photo.jpg"]);
    expect(tabFor(b)).toBe("single");
    act(() => result.current.consume(b.id));
    expect(result.current.batch).toBeNull();
    // The same batch arriving again (the app was reopened) is ignored.
    await act(async () => {
      await receiveBatch({ id: "b2", files: [{ path: "file:///x/s.mp3", name: "Song.mp3", type: "audio/mpeg", size: 1 }] }, fakeRead);
    });
    expect(result.current.batch).toBeNull();
  });
});
