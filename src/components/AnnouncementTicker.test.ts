import { describe, expect, it } from "vitest";
import { tickerText } from "./AnnouncementTicker";

describe("announcement strip", () => {
  it("joins announcements into one line and skips empty parts", () => {
    expect(tickerText([
      { id: "1", title: "New: share songs with a link", body: "Friends can listen right away." },
      { id: "2", title: "Share The Love, Share Sommyart Music", body: "" },
    ])).toBe("New: share songs with a link: Friends can listen right away.   •   Share The Love, Share Sommyart Music");
  });
  it("is empty when nothing is running", () => {
    expect(tickerText([])).toBe("");
  });
});
