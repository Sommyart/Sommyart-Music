import { afterEach, describe, expect, it, vi } from "vitest";
import { render } from "@testing-library/react";
import { LyricsView, lyricScrollTop } from "./LyricsView";

const lines = Array.from({ length: 30 }, (_, i) => ({ t: i * 2, text: `Line ${i}` }));
const screen = (wide: boolean) => {
  window.matchMedia = ((q: string) => ({ matches: wide, media: q })) as any;
};

const play = () => {
  const page = vi.fn();
  const box = vi.fn();
  Element.prototype.scrollIntoView = page;
  Element.prototype.scrollTo = box as any;
  const { rerender } = render(<LyricsView lyrics={lines} currentTime={0} />);
  rerender(<LyricsView lyrics={lines} currentTime={21} />);
  return { page, box };
};

afterEach(() => vi.restoreAllMocks());

describe("lyrics scrolling", () => {
  it("centres the current line inside the lyrics box", () => {
    expect(lyricScrollTop(500, 20, 400)).toBe(310);
    expect(lyricScrollTop(50, 20, 400)).toBe(0);
  });

  it("on a computer moves only the lyrics box, never the page", () => {
    screen(true);
    const { page, box } = play();
    expect(page).not.toHaveBeenCalled();
    expect(box).toHaveBeenCalled();
  });

  it("on a phone keeps the original scrolling", () => {
    screen(false);
    const { page, box } = play();
    expect(page).toHaveBeenCalled();
    expect(box).not.toHaveBeenCalled();
  });
});
