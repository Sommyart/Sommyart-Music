import { Capacitor, registerPlugin } from "@capacitor/core";

/** The app's own Android helper (android/.../CallStatePlugin.java). */
interface CallStatePlugin {
  get(): Promise<{ inCall: boolean }>;
}

const CallState = registerPlugin<CallStatePlugin>("CallState");

/** true / false on the Android app; null where it cannot be known (website, or an older app). */
export async function isInCall(): Promise<boolean | null> {
  if (Capacitor.getPlatform() !== "android") return null;
  try {
    const { inCall } = await CallState.get();
    return !!inCall;
  } catch {
    return null;
  }
}

export type ResumeWatch = { cancel: () => void };

/**
 * After the phone paused the music, waits to see whether a call is the reason.
 * If a call (or ringing) shows up within a few seconds, `onCallOver` runs once the
 * call has ended. Anything else (another app taking the sound, headphones pulled
 * out) never triggers a resume. Gives up after an hour.
 */
export function watchForCallEnd(
  onCallOver: () => void,
  check: () => Promise<boolean | null> = isInCall,
  { everyMs = 1500, noticeMs = 6000, giveUpMs = 60 * 60_000 } = {},
): ResumeWatch {
  const started = Date.now();
  let sawCall = false;
  let quietChecks = 0;
  let stopped = false;
  let timer = 0;

  const tick = async () => {
    if (stopped) return;
    const inCall = await check();
    if (stopped) return;
    const age = Date.now() - started;
    if (inCall === null) return; // cannot tell here: do nothing
    if (inCall) {
      sawCall = true;
      quietChecks = 0;
    } else if (sawCall) {
      // Two calm checks in a row, so the gap between a ring and answering does not count as the end.
      if (++quietChecks >= 2) {
        stopped = true;
        onCallOver();
        return;
      }
    } else if (age > noticeMs) {
      stopped = true; // no call showed up: the pause had another reason
      return;
    }
    if (age > giveUpMs) {
      stopped = true;
      return;
    }
    timer = window.setTimeout(tick, everyMs);
  };
  timer = window.setTimeout(tick, 300);

  return {
    cancel: () => {
      stopped = true;
      window.clearTimeout(timer);
    },
  };
}
