import { useCallback, useEffect, useState } from "react";
import { Capacitor } from "@capacitor/core";

const RELEASE_API = "https://api.github.com/repos/Sommyart/Sommyart-Music/releases/tags/android-latest";
const APK_FALLBACK = "https://github.com/Sommyart/Sommyart-Music/releases/download/android-latest/SommyartMusic.apk";

/** Build number baked in by the APK workflow. Empty on the website and in local builds. */
const INSTALLED_BUILD = Number(import.meta.env.VITE_BUILD_NUMBER) || 0;

export type AppUpdate = { latest: number; installed: number; url: string };

/** Pulls the newest build number out of the release's file names, e.g. SommyartMusic-1.0.27.apk. */
export function parseLatestBuild(release: { assets?: { name?: string; browser_download_url?: string }[] }): AppUpdate | null {
  let latest = 0;
  for (const a of release.assets ?? []) {
    const m = /^SommyartMusic-1\.0\.(\d+)\.apk$/.exec(a.name ?? "");
    if (m) latest = Math.max(latest, Number(m[1]));
  }
  if (!latest) return null;
  const main = (release.assets ?? []).find((a) => a.name === "SommyartMusic.apk");
  return { latest, installed: INSTALLED_BUILD, url: main?.browser_download_url || APK_FALLBACK };
}

/**
 * Checks GitHub for a newer Android build. Only runs inside the installed app,
 * and only when the build knows its own number. The website always has the newest version.
 */
export function useAppUpdate() {
  const [update, setUpdate] = useState<AppUpdate | null>(null);
  const [dismissed, setDismissed] = useState(false);

  const check = useCallback(async () => {
    if (!INSTALLED_BUILD || !Capacitor.isNativePlatform()) return;
    try {
      const res = await fetch(RELEASE_API, { headers: { Accept: "application/vnd.github+json" }, cache: "no-store" });
      if (!res.ok) return;
      const info = parseLatestBuild(await res.json());
      if (info && info.latest > INSTALLED_BUILD) setUpdate(info);
    } catch {
      /* offline or rate limited: try again next time */
    }
  }, []);

  useEffect(() => {
    check();
    const onVisible = () => { if (document.visibilityState === "visible") check(); };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [check]);

  const startUpdate = useCallback(() => {
    if (!update) return;
    // Capacitor hands links to other sites to Android, which downloads the file in the browser.
    window.location.href = update.url;
  }, [update]);

  return { update: dismissed ? null : update, startUpdate, later: () => setDismissed(true) };
}
