import { describe, expect, it, vi } from "vitest";
import { render } from "@testing-library/react";
import { LyricsView, lyricScrollTop } from "./LyricsView";

describe("lyrics scrolling", () => {
  it("centres the current line inside the lyrics box", () => {
    expect(lyricScrollTop(500, 20, 400)).toBe(310);
    expect(lyricScrollTop(50, 20, 400)).toBe(0);
  });

  it("moves only the lyrics box, never the page", () => {
    const pageScroll = vi.fn();
    Element.prototype.scrollIntoView = pageScroll;
    const boxScroll = vi.fn();
    Element.prototype.scrollTo = boxScroll as any;
    const lines = Array.from({ length: 30 }, (_, i) => ({ t: i * 2, text: `Line ${i}` }));
    const { rerender } = render(<LyricsView lyrics={lines} currentTime={0} />);
    rerender(<LyricsView lyrics={lines} currentTime={21} />);
    expect(pageScroll).not.toHaveBeenCalled();
    expect(boxScroll).toHaveBeenCalled();
  });
});
