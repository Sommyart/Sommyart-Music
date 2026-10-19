import { useEffect } from "react";
import { getNotifyMode, showSystemNotification } from "@/lib/notify";

/**
 * Schedules a single daily local notification reminding the user to stream
 * on Sommyart Music. Uses the browser Notification API + setTimeout, with
 * persistence in localStorage so we only fire once per calendar day.
 *
 * Notes:
 * - This is a foreground-only reminder (works while a tab/PWA is open).
 *   True background push would require a Service Worker + Push subscription.
 * - Defaults to 6:00 PM local time.
 */
const STORAGE_KEY = "sommyart:lastNotificationDate";
const NOTIFY_HOUR = 18; // 6 PM local time
const NOTIFY_MINUTE = 0;

const MESSAGES = [
  "🎧 New vibes are waiting — stream now on Sommyart Music",
  "✨ Your daily dose of holographic sound is live",
  "🔊 Press play. Feel the frequency on Sommyart Music",
  "🌌 Tonight's soundtrack is calling — open Sommyart",
  "💫 Fresh tracks. Endless flow. Stream on Sommyart now",
];

function todayKey() {
  const d = new Date();
  return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
}

function pickMessage() {
  return MESSAGES[Math.floor(Math.random() * MESSAGES.length)];
}

async function showNotification() {
  if (getNotifyMode() === "off") return;
  if (localStorage.getItem(STORAGE_KEY) === todayKey()) return;
  const shown = await showSystemNotification({ title: "Sommyart Music", body: pickMessage(), tag: "sommyart-daily" });
  if (shown) localStorage.setItem(STORAGE_KEY, todayKey());
}

function msUntilNextNotification() {
  const now = new Date();
  const next = new Date();
  next.setHours(NOTIFY_HOUR, NOTIFY_MINUTE, 0, 0);
  if (next.getTime() <= now.getTime()) {
    next.setDate(next.getDate() + 1);
  }
  return next.getTime() - now.getTime();
}

export function useDailyNotification() {
  useEffect(() => {
    let dailyTimer: number | undefined;
    let intervalTimer: number | undefined;

    const scheduleNext = () => {
      const delay = msUntilNextNotification();
      dailyTimer = window.setTimeout(() => {
        showNotification();
        scheduleNext();
      }, delay);
    };

    // If we're already past today's notification time and haven't fired
    // today, fire immediately so the user still gets their daily nudge.
    const now = new Date();
    const todayTarget = new Date();
    todayTarget.setHours(NOTIFY_HOUR, NOTIFY_MINUTE, 0, 0);
    if (
      now.getTime() >= todayTarget.getTime() &&
      localStorage.getItem(STORAGE_KEY) !== todayKey() 
    ) {
      // small delay so the app has time to mount
      window.setTimeout(showNotification, 5000);
    }

    scheduleNext();

    // Safety net: every 5 minutes, check whether we missed the slot
    // (e.g. device was asleep or tab was throttled).
    intervalTimer = window.setInterval(() => {
      const n = new Date();
      if (
        n.getHours() >= NOTIFY_HOUR &&
        localStorage.getItem(STORAGE_KEY) !== todayKey()
      ) {
        showNotification();
      }
    }, 5 * 60 * 1000);

    return () => {
      if (dailyTimer) clearTimeout(dailyTimer);
      if (intervalTimer) clearInterval(intervalTimer);
    };
  }, []);
}
