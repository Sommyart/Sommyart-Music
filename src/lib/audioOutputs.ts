import { useCallback, useEffect, useState } from "react";
import { Capacitor, registerPlugin } from "@capacitor/core";

/**
 * Speakers and headphones on THIS device (phone speaker, Bluetooth, wired, USB, PC speakers).
 * - Android app: a native plugin lists them and tells us when Bluetooth connects; moving the
 *   music opens Android's own "play on" picker (Android does not let apps switch it directly).
 * - Browser on a PC: the browser lists outputs and can switch the player straight away.
 */
export type OutputKind = "speaker" | "bluetooth" | "wired" | "usb" | "other";
export type AudioOutput = { id: string; name: string; kind: OutputKind };
type Snapshot = { outputs: AudioOutput[]; active: AudioOutput | null };

interface AudioOutputsPlugin {
  list(): Promise<Snapshot>;
  openPicker(): Promise<{ opened: string }>;
  addListener(
    e: "outputsChanged",
    cb: (s: Snapshot & { connected: boolean; changed: AudioOutput[] }) => void,
  ): Promise<{ remove: () => Promise<void> }>;
}
const Native = registerPlugin<AudioOutputsPlugin>("AudioOutputs");
export const isNativeOutputs = () => Capacitor.isNativePlatform() && Capacitor.getPlatform() === "android";

/* ------------------------------ Browser (PC) ------------------------------ */

let element: HTMLAudioElement | null = null;
const SINK_KEY = "sommyart-audio-sink";

/** The player registers its <audio> element so the chosen PC output can be applied to it. */
export function setPlaybackElement(el: HTMLAudioElement | null) {
  element = el;
  let saved: string | null = null;
  try { saved = localStorage.getItem(SINK_KEY); } catch { /* private mode */ }
  if (el && saved && "setSinkId" in el) (el as any).setSinkId(saved).catch(() => {});
}

export const canPickOutputOnWeb = () => typeof window !== "undefined" && "setSinkId" in HTMLMediaElement.prototype;

function kindFromLabel(label: string): OutputKind {
  if (/bluetooth|airpods|buds|headset|wireless|bt\b/i.test(label)) return "bluetooth";
  if (/usb/i.test(label)) return "usb";
  if (/headphone|earphone/i.test(label)) return "wired";
  return "speaker";
}

async function webSnapshot(): Promise<Snapshot> {
  if (!navigator.mediaDevices?.enumerateDevices) return { outputs: [], active: null };
  const all = await navigator.mediaDevices.enumerateDevices();
  const outs = all.filter((d) => d.kind === "audiooutput" && d.label && d.deviceId !== "communications");
  const outputs: AudioOutput[] = outs
    .filter((d) => d.deviceId !== "default")
    .map((d) => ({ id: d.deviceId, name: d.label.replace(/\s*\([0-9a-f]{4}:[0-9a-f]{4}\)\s*$/i, ""), kind: kindFromLabel(d.label) }));
  const current = (element as any)?.sinkId || "";
  const active = outputs.find((o) => o.id === current) ?? (() => {
    const def = outs.find((d) => d.deviceId === "default");
    return def ? outputs.find((o) => def.label.includes(o.name)) ?? null : null;
  })();
  return { outputs, active: active ?? null };
}

/** Browsers hide device names until the site is allowed to use audio devices once. */
export async function unlockWebOutputNames(): Promise<boolean> {
  try {
    const md = navigator.mediaDevices as any;
    if (md?.selectAudioOutput) {
      const d = await md.selectAudioOutput();
      if (d?.deviceId) await applyWebOutput(d.deviceId);
      return true;
    }
    const s = await navigator.mediaDevices.getUserMedia({ audio: true });
    s.getTracks().forEach((t) => t.stop()); // only needed for the names; nothing is recorded
    return true;
  } catch {
    return false;
  }
}

async function applyWebOutput(id: string) {
  if (!element || !("setSinkId" in element)) throw new Error("This browser cannot switch speakers");
  await (element as any).setSinkId(id);
  try { localStorage.setItem(SINK_KEY, id); } catch { /* ignore */ }
}

/* --------------------------------- Hook --------------------------------- */

/** Fired by the app-wide listener when a Bluetooth/wired output connects or disconnects. */
export type OutputEvent = { connected: boolean; device: AudioOutput };

export function onOutputChange(cb: (e: OutputEvent) => void): () => void {
  if (!isNativeOutputs()) return () => {};
  let handle: { remove: () => Promise<void> } | null = null;
  let gone = false;
  Native.addListener("outputsChanged", (s) => {
    for (const d of s.changed ?? []) cb({ connected: s.connected, device: d });
  }).then((h) => { if (gone) h.remove(); else handle = h; }).catch(() => {});
  return () => { gone = true; handle?.remove(); };
}

export function useAudioOutputs(enabled = true) {
  const [snap, setSnap] = useState<Snapshot>({ outputs: [], active: null });
  const native = isNativeOutputs();

  const refresh = useCallback(async () => {
    try {
      setSnap(native ? await Native.list() : await webSnapshot());
    } catch {
      /* keep the last list */
    }
  }, [native]);

  useEffect(() => {
    if (!enabled) return;
    refresh();
    if (native) {
      let h: { remove: () => Promise<void> } | null = null;
      Native.addListener("outputsChanged", (s) => setSnap({ outputs: s.outputs, active: s.active })).then((x) => (h = x)).catch(() => {});
      // The picker is a system window; when we come back the route may have changed.
      const onVis = () => document.visibilityState === "visible" && refresh();
      document.addEventListener("visibilitychange", onVis);
      const t = setInterval(refresh, 4000);
      return () => { h?.remove(); document.removeEventListener("visibilitychange", onVis); clearInterval(t); };
    }
    const onChange = () => refresh();
    navigator.mediaDevices?.addEventListener?.("devicechange", onChange);
    return () => navigator.mediaDevices?.removeEventListener?.("devicechange", onChange);
  }, [enabled, native, refresh]);

  /** Phone: opens Android's picker. PC: switches straight away. */
  const choose = useCallback(async (o: AudioOutput | null): Promise<"picker" | "bluetooth-settings" | "switched"> => {
    if (native) {
      const r = await Native.openPicker();
      setTimeout(refresh, 1500);
      return r.opened === "bluetooth-settings" ? "bluetooth-settings" : "picker";
    }
    if (o) await applyWebOutput(o.id);
    await refresh();
    return "switched";
  }, [native, refresh]);

  return { ...snap, native, refresh, choose };
}

/** Short label for this device's current output, shown to the user's other devices. */
export async function activeOutputLabel(): Promise<string | null> {
  if (!isNativeOutputs()) return null;
  try {
    const { active } = await Native.list();
    if (!active) return null;
    if (active.kind === "bluetooth") return `Bluetooth: ${active.name}`;
    if (active.kind === "speaker") return "Phone speaker";
    return active.name;
  } catch {
    return null;
  }
}
