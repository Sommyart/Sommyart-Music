import { Capacitor } from "@capacitor/core";
import { LocalNotifications } from "@capacitor/local-notifications";

export type NotifyPermission = "granted" | "denied" | "prompt" | "unsupported";
export type NotifyMode = "all" | "following" | "off";

const MODE_KEY = "sommyart.notify.mode";
const ASKED_KEY = "sommyart.notify.asked";
const MODE_EVENT = "sommyart:notify-mode";

const native = () => Capacitor.isNativePlatform();

/** Which new-song alerts the listener wants. Defaults to everything. */
export function getNotifyMode(): NotifyMode {
  try {
    const v = localStorage.getItem(MODE_KEY);
    return v === "following" || v === "off" ? v : "all";
  } catch {
    return "all";
  }
}

export function setNotifyMode(mode: NotifyMode) {
  try {
    localStorage.setItem(MODE_KEY, mode);
  } catch {
    /* storage unavailable */
  }
  window.dispatchEvent(new Event(MODE_EVENT));
}

export const NOTIFY_MODE_EVENT = MODE_EVENT;

export function hasAskedForPermission(): boolean {
  try {
    return localStorage.getItem(ASKED_KEY) === "1";
  } catch {
    return true;
  }
}

export function markAskedForPermission() {
  try {
    localStorage.setItem(ASKED_KEY, "1");
  } catch {
    /* storage unavailable */
  }
}

export async function getNotifyPermission(): Promise<NotifyPermission> {
  try {
    if (native()) {
      const r = await LocalNotifications.checkPermissions();
      return r.display === "granted" ? "granted" : r.display === "denied" ? "denied" : "prompt";
    }
    if (typeof Notification === "undefined") return "unsupported";
    return Notification.permission === "default" ? "prompt" : Notification.permission;
  } catch {
    return "unsupported";
  }
}

export async function requestNotifyPermission(): Promise<NotifyPermission> {
  try {
    if (native()) {
      const r = await LocalNotifications.requestPermissions();
      return r.display === "granted" ? "granted" : r.display === "denied" ? "denied" : "prompt";
    }
    if (typeof Notification === "undefined") return "unsupported";
    const result = await Notification.requestPermission();
    return result === "default" ? "prompt" : result;
  } catch {
    return "unsupported";
  }
}

/** Shows a system notification (status bar on Android). Resolves false if it could not be shown. */
export async function showSystemNotification(opts: { title: string; body: string; route?: string; tag?: string }): Promise<boolean> {
  try {
    if ((await getNotifyPermission()) !== "granted") return false;
    if (native()) {
      await LocalNotifications.schedule({
        notifications: [
          {
            id: Math.floor(Math.random() * 2_000_000_000),
            title: opts.title,
            body: opts.body,
            extra: { route: opts.route ?? "/" },
          },
        ],
      });
      return true;
    }
    const reg = await navigator.serviceWorker?.getRegistration?.();
    if (reg?.showNotification) {
      await reg.showNotification(opts.title, { body: opts.body, icon: "/icons/icon-192.png", tag: opts.tag, data: { route: opts.route } });
      return true;
    }
    new Notification(opts.title, { body: opts.body, icon: "/icons/icon-192.png", tag: opts.tag });
    return true;
  } catch {
    return false;
  }
}

/** Calls back with the route stored on a notification when the listener taps it (installed app only). */
export function onNotificationTapped(cb: (route: string) => void): () => void {
  if (!native()) return () => {};
  let handle: { remove: () => Promise<void> } | null = null;
  let cancelled = false;
  LocalNotifications.addListener("localNotificationActionPerformed", (e) => {
    const route = e.notification?.extra?.route;
    if (typeof route === "string") cb(route);
  })
    .then((h) => {
      if (cancelled) h.remove();
      else handle = h;
    })
    .catch(() => {});
  return () => {
    cancelled = true;
    handle?.remove().catch(() => {});
  };
}
