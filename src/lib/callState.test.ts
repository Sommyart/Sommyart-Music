import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { watchForCallEnd } from "./callState";

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

/** Feeds the watcher a script of "in a call?" answers, one per check. */
const scripted = (answers: (boolean | null)[]) => {
  let i = 0;
  return () => Promise.resolve(answers[Math.min(i++, answers.length - 1)]);
};

const run = async (ms: number) => {
  for (let t = 0; t < ms; t += 100) await vi.advanceTimersByTimeAsync(100);
};

describe("carrying on after a phone call", () => {
  it("resumes once the call has ended", async () => {
    const resume = vi.fn();
    watchForCallEnd(resume, scripted([true, true, true, false, false]));
    await run(4000);
    expect(resume).not.toHaveBeenCalled();
    await run(4000);
    expect(resume).toHaveBeenCalledTimes(1);
  });

  it("does not count a single quiet moment between ringing and answering as the end", async () => {
    const resume = vi.fn();
    watchForCallEnd(resume, scripted([true, false, true, true, true, true, true, true]));
    await run(12_000);
    expect(resume).not.toHaveBeenCalled();
  });

  it("never resumes when no call shows up (another app took the sound, headphones out)", async () => {
    const resume = vi.fn();
    watchForCallEnd(resume, scripted([false]));
    await run(30_000);
    expect(resume).not.toHaveBeenCalled();
  });

  it("does nothing where calls cannot be detected (the website)", async () => {
    const resume = vi.fn();
    watchForCallEnd(resume, scripted([null]));
    await run(30_000);
    expect(resume).not.toHaveBeenCalled();
  });

  it("stops when the person presses play or pause themselves", async () => {
    const resume = vi.fn();
    const watch = watchForCallEnd(resume, scripted([true, true, false, false]));
    await run(2000);
    watch.cancel();
    await run(10_000);
    expect(resume).not.toHaveBeenCalled();
  });
});
