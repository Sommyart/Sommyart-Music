import { describe, expect, it } from "vitest";
import { cleanLyrics, readStamps } from "./lrc";

describe("readStamps", () => {
  it("reads common forms", () => {
    expect(readStamps("[00:08.06] hi")).toEqual({ times: [8.06], rest: "hi" });
    expect(readStamps("0:08.5 hi").times).toEqual([8.5]);
    expect(readStamps("00:08 hi").times).toEqual([8]);
    expect(readStamps("1:02:03.5 hi").times).toEqual([3723.5]);
  });
  it("drops the end time of a range and word tags", () => {
    expect(readStamps("00:01 - 00:05 hello")).toEqual({ times: [1], rest: "hello" });
    expect(readStamps("[00:01.00] <00:01.00>Hel<00:01.40>lo").rest).toBe("Hello");
  });
  it("leaves ordinary lines alone", () => {
    expect(readStamps("I woke up at 10 o'clock").times).toEqual([]);
  });
});

describe("cleanLyrics", () => {
  it("removes Gemini style times and keeps the words", () => {
    const r = cleanLyrics("[00:00.00] (Intro)\n[00:08.06] Fellas hold the rhythm\n[00:11.45] Lord, standard rules\n[01:00.23] My, oh, my!");
    expect(r.stamped).toBe(4);
    expect(r.cleanText).toBe("(Intro)\nFellas hold the rhythm\nLord, standard rules\nMy, oh, my!");
  });
  it("leaves plain lyrics as they are", () => {
    const r = cleanLyrics("[Verse 1]\nhello there\nsecond line\n\n\n\n[Chorus]\nsing it");
    expect(r.stamped).toBe(0);
    expect(r.cleanText).toBe("[Verse 1]\nhello there\nsecond line\n\n[Chorus]\nsing it");
  });
  it("drops LRC info tags", () => {
    expect(cleanLyrics("[ar:Somebody]\n[ti:Song]\n[00:01.00] a\n[00:02.00] b").cleanText).toBe("a\nb");
  });
});
