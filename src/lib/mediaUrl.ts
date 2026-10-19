import { Capacitor } from "@capacitor/core";

/**
 * Songs that used to ship inside the Android app now stream from the website.
 * On the website they are still reached by their short path (/music/Song.mp3);
 * inside the installed app that path is rewritten to the full website address.
 */
export const ONLINE_ORIGIN = "https://sommyart-music.vercel.app";

export function onlineAudioUrl(url: string): string {
  if (!url || !url.startsWith("/music/")) return url;
  try {
    return Capacitor.isNativePlatform() ? `${ONLINE_ORIGIN}${url}` : url;
  } catch {
    return url;
  }
}

/**
 * Cache keys a song's download might be stored under. Downloads made by older
 * app versions were saved under the app's own address (for example
 * https://localhost/music/Song.mp3); newer ones use the website address.
 */
export function offlineCacheKeys(url: string): string[] {
  const full = url.startsWith("http") ? url : `${window.location.origin}${url}`;
  const keys = [full];
  if (full.startsWith(`${ONLINE_ORIGIN}/music/`)) {
    keys.push(`${window.location.origin}${full.slice(ONLINE_ORIGIN.length)}`);
  }
  return keys;
}
