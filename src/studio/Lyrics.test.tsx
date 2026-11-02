import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";

const { updates, invoke } = vi.hoisted(() => ({
  updates: [] as any[],
  invoke: vi.fn(async (..._a: any[]) => ({ data: { started: true }, error: null })),
}));

vi.mock("./lib", () => {
  const chain = (result: any) => {
    const c: any = {
      select: () => c, eq: () => c, order: () => c, limit: () => Promise.resolve(result),
      maybeSingle: () => Promise.resolve(result),
      update: (v: any) => { updates.push(v); return { eq: () => Promise.resolve({ error: null }) }; },
      delete: () => ({ eq: () => Promise.resolve({ error: null }) }),
    };
    return c;
  };
  return {
    supabase: {
      from: (table: string) => (table === "songs" ? chain({ data: { lyrics: [] } }) : chain({ data: [] })),
      functions: { invoke },
    },
  };
});

import { LyricsDialog } from "./Lyrics";

const song: any = { id: "00000000-0000-0000-0000-000000000001", title: "Test", audio_url: "http://127.0.0.1/x.mp3" };

beforeEach(() => {
  updates.length = 0; invoke.mockClear();
  HTMLMediaElement.prototype.pause = () => {}; // jsdom does not implement it
});

async function openAndPaste(text: string) {
  const onSaved = vi.fn(); const onClose = vi.fn();
  render(<LyricsDialog song={song} onClose={onClose} onSaved={onSaved} />);
  const box = await screen.findByPlaceholderText(/Paste the lyrics here/);
  fireEvent.change(box, { target: { value: text } });
  return { onSaved, onClose };
}

describe("LyricsDialog with timestamps", () => {
  it("uses pasted times without calling the worker, and saves them", async () => {
    const { onSaved } = await openAndPaste("[00:00.00] (Intro)\n[00:08.06] First line\n[00:11.45] Second line\n[01:00.23] Third line");
    expect(await screen.findByText(/Found times on 3 of 3 lines/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /Use my times/ }));
    expect(await screen.findByText(/Using the times you pasted/)).toBeTruthy();
    expect(invoke).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: /Save lyrics/ }));
    await waitFor(() => expect(onSaved).toHaveBeenCalled());
    expect(updates[0].lyrics).toEqual([
      { t: 8.06, text: "First line" }, { t: 11.45, text: "Second line" }, { t: 60.23, text: "Third line" },
    ]);
  });

  it("sends clean text to the worker when there are no times", async () => {
    await openAndPaste("[Verse 1]\nfirst line here\nsecond line here");
    fireEvent.click(screen.getByRole("button", { name: /Generate timing/ }));
    await waitFor(() => expect(invoke).toHaveBeenCalled());
    expect((invoke.mock.calls[0] as any)[1].body.text).toContain("first line here");
  });

  it("flags lines that had no time in a mixed paste", async () => {
    await openAndPaste("[00:10.00] one\ntwo\n[00:20.00] three");
    fireEvent.click(screen.getByRole("button", { name: /Use my times/ }));
    expect(await screen.findByText(/had no time in your paste/)).toBeTruthy();
  });
});
