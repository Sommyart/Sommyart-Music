import { describe, expect, it } from "vitest";
import { parseLyrics, readStamps } from "./lrc";

const gemini = `[00:00.00] (Intro)
[00:08.06] Fellas hold the rhythm steady now, look who just walked in the door
[00:11.45] Lord, standard rules don't count no more
[00:13.91] Boy, as I promised I would stay real cool
[01:00.23] My, oh, my, oh, my, oh, my!`;

describe("readStamps", () => {
  it("reads common forms", () => {
    expect(readStamps("[00:08.06] hi")).toEqual({ times: [8.06], rest: "hi" });
    expect(readStamps("0:08.5 hi").times).toEqual([8.5]);
    expect(readStamps("00:08 hi").times).toEqual([8]);
    expect(readStamps("1:02:03.5 hi").times).toEqual([3723.5]);
    expect(readStamps("[01:00,25] hi").times).toEqual([60.25]);
  });
  it("uses the start of a range", () => {
    expect(readStamps("00:01 - 00:05 hello")).toEqual({ times: [1], rest: "hello" });
    expect(readStamps("[00:01.00] to [00:05.00] hello")).toEqual({ times: [1], rest: "hello" });
  });
  it("reads repeated tags and drops word tags", () => {
    expect(readStamps("[00:30.00][01:30.00] chorus").times).toEqual([30, 90]);
    expect(readStamps("[00:01.00] <00:01.00>Hel<00:01.40>lo").rest).toBe("Hello");
  });
  it("leaves ordinary lines alone", () => {
    expect(readStamps("I woke up at 10 o'clock").times).toEqual([]);
    expect(readStamps("10:30 in the morning").times).toEqual([630]);
  });
});

describe("parseLyrics", () => {
  it("uses the pasted times and drops the intro label", () => {
    const r = parseLyrics(gemini);
    expect(r.mode).toBe("timestamps");
    expect(r.lines.map((l) => l.t)).toEqual([8.06, 11.45, 13.91, 60.23]);
    expect(r.lines[0].text).toBe("Fellas hold the rhythm steady now, look who just walked in the door");
    expect(r.guessed).toBe(0);
  });
  it("places untimed lines between neighbours and marks them", () => {
    const r = parseLyrics("[00:10.00] one\ntwo\n[00:20.00] three\nfour");
    expect(r.mode).toBe("timestamps");
    expect(r.lines.map((l) => l.t)).toEqual([10, 15, 20, 23]);
    expect(r.lines.map((l) => !!l.guess)).toEqual([false, true, false, true]);
    expect(r.guessed).toBe(2);
  });
  it("goes automatic when there are no times", () => {
    const r = parseLyrics("[Verse 1]\nhello there\nsecond line\n\n[Chorus]\nsing it");
    expect(r.mode).toBe("auto");
    expect(r.total).toBe(3);
  });
  it("goes automatic and cleans times when only a few lines have them", () => {
    const r = parseLyrics("[00:10.00] one\ntwo\nthree\nfour\nfive");
    expect(r.mode).toBe("auto");
    expect(r.cleanText).toBe("one\ntwo\nthree\nfour\nfive");
  });
  it("ignores LRC info tags", () => {
    const r = parseLyrics("[ar:Somebody]\n[ti:Song]\n[00:01.00] a\n[00:02.00] b");
    expect(r.mode).toBe("timestamps");
    expect(r.lines.length).toBe(2);
  });
  it("lists a repeated chorus tag twice", () => {
    const r = parseLyrics("[00:01.00] a\n[00:30.00][01:30.00] chorus");
    expect(r.lines.map((l) => l.t)).toEqual([1, 30, 90]);
  });
});
