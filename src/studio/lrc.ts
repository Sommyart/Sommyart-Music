// Cleans pasted lyrics: takes off times such as [00:08.06] at the start of a line (AI tools and LRC files add them).
// The times themselves are NOT used. The app always works the timing out from the song.

export type CleanedLyrics = {
  cleanText: string; // the lyrics with times and info tags removed
  stamped: number;   // how many lines had a time that was removed
};

// One time at the start of a line: [00:08.06]  00:08  0:08.5  (1:02:03.4)  <00:08.06>
const STAMP = /^\s*[\[(<]?\s*(?:(\d{1,2}):)?(\d{1,3}):([0-5]\d)(?:[.,](\d{1,3}))?\s*[\])>]?/;
// "00:01 - 00:05" or "00:01 to 00:05": a range, only the first time is the start.
const RANGE_JOIN = /^\s*(?:-|–|—|to)\s*(?=[\[(<]?\s*\d)/i;
// LRC info tags such as [ar:Artist] [ti:Title] [offset:0]
const META = /^\s*\[(?:ti|ar|al|au|by|re|ve|length|offset|la|tool|id):[^\]]*\]\s*$/i;
// Word timing tags inside a line: <00:08.06>
const INLINE_TAG = /<\d{1,3}:[0-5]\d(?:[.,]\d{1,3})?>/g;

function seconds(m: RegExpExecArray): number {
  const h = m[1] ? parseInt(m[1], 10) : 0;
  const min = parseInt(m[2], 10);
  const s = parseInt(m[3], 10);
  const f = m[4] ? parseFloat("0." + m[4]) : 0;
  return h * 3600 + min * 60 + s + f;
}

/** Takes the times off the start of one line. */
export function readStamps(line: string): { times: number[]; rest: string } {
  const times: number[] = [];
  let rest = line;
  for (let guard = 0; guard < 8; guard++) {
    const m = STAMP.exec(rest);
    if (!m) break;
    times.push(seconds(m));
    rest = rest.slice(m[0].length);
    const r = RANGE_JOIN.exec(rest);
    if (r) {
      const after = rest.slice(r[0].length);
      const m2 = STAMP.exec(after);
      if (m2) rest = after.slice(m2[0].length); // drop the end time
    }
  }
  return { times, rest: rest.replace(INLINE_TAG, "").trim() };
}

export function cleanLyrics(raw: string): CleanedLyrics {
  const out: string[] = [];
  let stamped = 0;
  for (const line of raw.replace(/\r\n?/g, "\n").split("\n")) {
    if (!line.trim()) { out.push(""); continue; }
    if (META.test(line)) continue;
    const { times, rest } = readStamps(line);
    if (times.length) { stamped++; out.push(rest); } else out.push(line.trim().replace(INLINE_TAG, ""));
  }
  return { cleanText: out.join("\n").replace(/\n{3,}/g, "\n\n").trim(), stamped };
}
