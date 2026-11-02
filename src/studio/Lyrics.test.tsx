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

describe("LyricsDialog", () => {
  it("removes pasted times and still asks for automatic timing", async () => {
    await openAndPaste("[00:00.00] (Intro)\n[00:08.06] First line here\n[00:11.45] Second line here");
    expect(await screen.findByText(/are ignored/)).toBeTruthy();
    expect(screen.queryByRole("button", { name: /Use my times/ })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: /Generate timing/ }));
    await waitFor(() => expect(invoke).toHaveBeenCalled());
    const sent = (invoke.mock.calls[0] as any)[1].body.text as string;
    expect(sent).toContain("First line here");
    expect(sent).not.toMatch(/\[00:/);
  });

  it("sends plain lyrics unchanged", async () => {
    await openAndPaste("first line here\nsecond line here");
    fireEvent.click(screen.getByRole("button", { name: /Generate timing/ }));
    await waitFor(() => expect(invoke).toHaveBeenCalled());
    expect((invoke.mock.calls[0] as any)[1].body.text).toBe("first line here\nsecond line here");
  });
});
