import { Capacitor } from "@capacitor/core";
import { PushNotifications } from "@capacitor/push-notifications";
import { supabase } from "@/integrations/supabase/client";
import { getNotifyMode } from "@/lib/notify";

// The generated types do not know these functions yet.
const db = supabase as any;

const TOKEN_KEY = "sommyart.push.token";
export const PUSH_PERMISSION_EVENT = "sommyart:notify-permission";

export const pushSupported = () => Capacitor.isNativePlatform();

/** True once this phone has a push token on file, so the app can skip its own duplicate alert. */
export function pushIsActive(): boolean {
  try {
    return pushSupported() && !!localStorage.getItem(TOKEN_KEY);
  } catch {
    return false;
  }
}

const savedToken = () => {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
};

/** Tells the server which phone this is, who is signed in, and which alerts they want. */
export async function saveTokenToServer(token: string): Promise<boolean> {
  const { error } = await db.rpc("register_push_token", { p_token: token, p_mode: getNotifyMode(), p_platform: "android" });
  if (error) return false;
  try {
    localStorage.setItem(TOKEN_KEY, token);
  } catch {
    /* storage unavailable */
  }
  return true;
}

/** Re-sends the saved token, for example after the listener changes their alert choice or signs in. */
export async function syncPushToken(): Promise<void> {
  const token = savedToken();
  if (token) await saveTokenToServer(token);
}

/** Asks Firebase for this phone's token. Safe to call repeatedly; does nothing on the web. */
export async function registerForPush(): Promise<void> {
  if (!pushSupported()) return;
  try {
    const perm = await PushNotifications.checkPermissions();
    if (perm.receive !== "granted") return;
    await PushNotifications.createChannel({
      id: "new_songs",
      name: "New songs",
      description: "Alerts when new songs and albums are published",
      importance: 4,
      visibility: 1,
    });
    await PushNotifications.register();
  } catch {
    /* push is a bonus; the app works without it */
  }
}

/** Removes this phone from the server (used when someone signs out). */
export async function forgetPushToken(): Promise<void> {
  const token = savedToken();
  if (!token) return;
  try {
    await db.rpc("unregister_push_token", { p_token: token });
    localStorage.removeItem(TOKEN_KEY);
  } catch {
    /* try again next time */
  }
}

/** Wires up token and tap listeners. Returns a cleanup function. */
export function listenForPush(onTap: (route: string) => void): () => void {
  if (!pushSupported()) return () => {};
  const handles: { remove: () => Promise<void> }[] = [];
  let cancelled = false;
  const keep = (p: Promise<{ remove: () => Promise<void> }>) =>
    p.then((h) => {
      if (cancelled) h.remove();
      else handles.push(h);
    }).catch(() => {});

  keep(PushNotifications.addListener("registration", (t) => { saveTokenToServer(t.value); }));
  keep(
    PushNotifications.addListener("pushNotificationActionPerformed", (a) => {
      const route = a.notification?.data?.route;
      if (typeof route === "string" && route.startsWith("/")) onTap(route);
    }),
  );
  return () => {
    cancelled = true;
    handles.forEach((h) => h.remove().catch(() => {}));
  };
}
