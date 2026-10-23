import { useEffect, useSyncExternalStore } from "react";
import { Capacitor } from "@capacitor/core";
import { ApkInstaller } from "@/lib/apkInstaller";

const RELEASE_API = "https://api.github.com/repos/Sommyart/Sommyart-Music/releases/tags/android-latest";
const LATEST_JSON = "https://github.com/Sommyart/Sommyart-Music/releases/download/android-latest/latest.json";
const APK_FALLBACK = "https://github.com/Sommyart/Sommyart-Music/releases/download/android-latest/SommyartMusic.apk";

/** Build number baked in by the APK workflow. Empty on the website and in local builds. */
const INSTALLED_BUILD = Number(import.meta.env.VITE_BUILD_NUMBER) || 0;

export type AppUpdate = { latest: number; installed: number; url: string; notes?: string };

/** The line after "What's new:" in the release text, if the workflow wrote one. */
function notesFrom(body?: string | null): string | undefined {
  const m = /what'?s new:\s*(.+)/i.exec(body ?? "");
  return m?.[1]?.trim() || undefined;
}

/** Pulls the newest build number out of the release's file names, e.g. SommyartMusic-1.0.27.apk. */
export function parseLatestBuild(release: {
  body?: string | null;
  assets?: { name?: string; browser_download_url?: string }[];
}): AppUpdate | null {
  let latest = 0;
  for (const a of release.assets ?? []) {
    const m = /^SommyartMusic-1\.0\.(\d+)\.apk$/.exec(a.name ?? "");
    if (m) latest = Math.max(latest, Number(m[1]));
  }
  if (!latest) return null;
  const main = (release.assets ?? []).find((a) => a.name === "SommyartMusic.apk");
  return { latest, installed: INSTALLED_BUILD, url: main?.browser_download_url || APK_FALLBACK, notes: notesFrom(release.body) };
}

export type UpdatePhase = "idle" | "needs-permission" | "downloading" | "installing" | "error";

type State = {
  update: AppUpdate | null;
  /** The pop-up was closed with "Later" (the Home card stays until the app is updated). */
  dismissed: boolean;
  phase: UpdatePhase;
  progress: number; // 0..1, or -1 when the size is unknown
  error: string;
};

let state: State = { update: null, dismissed: false, phase: "idle", progress: 0, error: "" };
const listeners = new Set<() => void>();
const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => listeners.delete(l);
};
const getState = () => state;
function patch(p: Partial<State>) {
  state = { ...state, ...p };
  listeners.forEach((l) => l());
}

/** Looks for a newer build. GitHub's page is tried first, then a small file next to the APK (in case GitHub's page limit is hit). */
async function check() {
  if (!INSTALLED_BUILD || !Capacitor.isNativePlatform()) return;
  if (state.phase === "downloading" || state.phase === "installing") return;
  let info: AppUpdate | null = null;
  try {
    const res = await fetch(RELEASE_API, { headers: { Accept: "application/vnd.github+json" }, cache: "no-store" });
    if (res.ok) info = parseLatestBuild(await res.json());
  } catch {
    /* try the second source */
  }
  if (!info) {
    try {
      const res = await fetch(LATEST_JSON, { cache: "no-store" });
      if (res.ok) {
        const j = await res.json();
        if (Number(j.build) > 0) info = { latest: Number(j.build), installed: INSTALLED_BUILD, url: APK_FALLBACK, notes: j.notes || undefined };
      }
    } catch {
      /* offline: try again next time */
    }
  }
  if (info && info.latest > INSTALLED_BUILD) patch({ update: info });
}

let started = false;
function ensureChecking() {
  if (started) return;
  started = true;
  void check();
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState !== "visible") return;
    // Back from Android's "allow installs" screen: carry on where we left off.
    if (state.phase === "needs-permission") void startUpdate();
    else void check();
  });
}

async function startUpdate() {
  const update = state.update;
  if (!update) return;
  try {
    const { allowed } = await ApkInstaller.canInstall();
    if (!allowed) {
      patch({ phase: "needs-permission", error: "" });
      await ApkInstaller.openInstallSettings();
      return;
    }
    patch({ phase: "downloading", progress: 0, error: "" });
    const handle = await ApkInstaller.addListener("progress", (e) =>
      patch({ progress: e.total > 0 ? Math.min(e.loaded / e.total, 1) : -1 }),
    );
    try {
      const file = await ApkInstaller.download({ url: update.url });
      patch({ phase: "installing", progress: 1 });
      await ApkInstaller.install({ path: file.path });
    } finally {
      void handle.remove();
    }
  } catch (err: any) {
    const message = String(err?.message ?? err ?? "");
    if (/not implemented|unimplemented/i.test(message)) {
      // This copy of the app has no installer helper: let the phone's browser download it.
      window.location.href = update.url;
      patch({ phase: "idle" });
      return;
    }
    patch({ phase: "error", error: message || "Something went wrong." });
  }
}

/**
 * Checks GitHub for a newer Android build and runs the update. Only active inside
 * the installed app, and only when the build knows its own number. The website
 * always has the newest version.
 */
export function useAppUpdate() {
  const s = useSyncExternalStore(subscribe, getState);
  useEffect(() => {
    ensureChecking();
  }, []);
  return {
    update: s.update,
    /** True when the pop-up should be open. */
    showDialog: !!s.update && (!s.dismissed || s.phase === "downloading" || s.phase === "installing"),
    phase: s.phase,
    progress: s.progress,
    error: s.error,
    startUpdate,
    later: () => patch({ dismissed: true }),
    openDialog: () => patch({ dismissed: false }),
    browserDownload: () => {
      if (state.update) window.location.href = state.update.url;
    },
  };
}
