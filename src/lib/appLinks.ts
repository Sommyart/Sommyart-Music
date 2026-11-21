import { Capacitor } from "@capacitor/core";
import { App } from "@capacitor/app";
import { PUBLIC_SITE } from "@/lib/publicLink";

/** The in-app page for a shared web link, or null if the link is not a song or album. */
export function pathFromLink(url: string): string | null {
  try {
    const u = new URL(url);
    if (u.origin !== PUBLIC_SITE) return null;
    const m = u.pathname.match(/^\/(song|album)\/([0-9a-f-]{36})\/?$/i);
    return m ? `/${m[1].toLowerCase()}/${m[2]}` : null;
  } catch {
    return null;
  }
}

/** On the Android app, opens shared song and album links on the right page. */
export function listenForAppLinks(go: (path: string) => void) {
  if (!Capacitor.isNativePlatform()) return () => {};
  const open = (url?: string) => {
    const path = url ? pathFromLink(url) : null;
    if (path) go(`${path}?autoplay=1`);
  };
  App.getLaunchUrl().then((r) => open(r?.url)).catch(() => {});
  const sub = App.addListener("appUrlOpen", (e) => open(e.url));
  return () => {
    void sub.then((s) => s.remove());
  };
}
