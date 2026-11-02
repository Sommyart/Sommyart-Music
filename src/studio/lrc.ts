// Reads lyrics pasted with timestamps, such as the [00:08.06] style an AI tool or LRC file gives.
// If most lines carry a time, those times are used as they are. Otherwise the app works the timing out itself.

export type ParsedLine = { text: string; t: number; guess?: boolean };
export type ParsedLyrics = {
  mode: "timestamps" | "auto";
  lines: ParsedLine[];       // timed lines (timestamps mode only)
  stamped: number;           // lyric lines that came with a time
  total: number;             // lyric lines found
  guessed: number;           // lines that had no time and were placed between their neighbours
  cleanText: string;         // the text with times removed (what the automatic timing needs)
};

// One time at the start of a line: [00:08.06]  00:08  0:08.5  (1:02:03.4)  <00:08.06>
const STAMP = /^\s*[\[(<]?\s*(?:(\d{1,2}):)?(\d{1,3}):([0-5]\d)(?:[.,](\d{1,3}))?\s*[\])>]?/;
// "00:01 - 00:05" or "00:01 to 00:05": a range, only the first time is the start.
const RANGE_JOIN = /^\s*(?:-|–|—|to)\s*(?=[\[(<]?\s*\d)/i;
// LRC info tags such as [ar:Artist] [ti:Title] [offset:0]
const META = /^\s*\[(?:ti|ar|al|au|by|re|ve|length|offset|la|tool|id):[^\]]*\]\s*$/i;
// A line that is only a label: (Intro)  [Chorus]  (Verse 1)
const LABEL = /^\s*[\[(][^\])]*[\])]\s*$/;
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

export function parseLyrics(raw: string): ParsedLyrics {
  const src = raw.replace(/\r\n?/g, "\n").split("\n");
  type Row = { text: string; times: number[] };
  const rows: Row[] = [];
  const cleaned: string[] = [];

  for (const line of src) {
    if (!line.trim()) { cleaned.push(""); continue; }
    if (META.test(line)) continue;
    const { times, rest } = readStamps(line);
    if (times.length) {
      cleaned.push(rest);
      if (!rest || LABEL.test(rest)) continue; // a time with no words, or only (Intro)
      rows.push({ text: rest, times });
    } else {
      cleaned.push(line.trim());
      if (LABEL.test(line)) continue; // (Chorus) and the like
      rows.push({ text: line.trim().replace(INLINE_TAG, ""), times: [] });
    }
  }

  const total = rows.length;
  const stamped = rows.filter((r) => r.times.length).length;
  const cleanText = cleaned.join("\n").replace(/\n{3,}/g, "\n\n").trim();
  const useStamps = stamped >= 2 && stamped * 2 >= total;
  if (!useStamps) return { mode: "auto", lines: [], stamped, total, guessed: 0, cleanText };

  // One entry per time, so a chorus tagged [00:30][01:30] shows up twice.
  type Slot = { text: string; t: number | null; guess: boolean };
  const slots: Slot[] = [];
  for (const r of rows) {
    if (r.times.length) for (const t of r.times) slots.push({ text: r.text, t, guess: false });
    else slots.push({ text: r.text, t: null, guess: true });
  }

  // Lines with no time go evenly between the nearest timed lines, and are marked for checking.
  const known = slots.map((s) => s.t);
  let guessed = 0;
  for (let i = 0; i < slots.length; i++) {
    if (known[i] !== null) continue;
    let a = i - 1;
    while (a >= 0 && known[a] === null) a--;
    let b = i + 1;
    while (b < slots.length && known[b] === null) b++;
    const t0 = a >= 0 ? (known[a] as number) : 0;
    slots[i].t = b < slots.length
      ? t0 + (((known[b] as number) - t0) * (i - a)) / (b - a)
      : t0 + 3 * (i - a);
    guessed++;
  }

  const lines: ParsedLine[] = slots.map((s) => ({
    text: s.text,
    t: Math.round((s.t as number) * 100) / 100,
    ...(s.guess ? { guess: true } : {}),
  }));
  return { mode: "timestamps", lines, stamped, total, guessed, cleanText };
}
