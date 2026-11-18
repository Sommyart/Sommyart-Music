import { useEffect, useState } from "react";
import { Capacitor, registerPlugin } from "@capacitor/core";

/** One song (or picture) shared into the Studio app from a file manager. */
type NativeFile = { path: string; name: string; type: string; size: number };
type NativeBatch = { id?: string; files?: NativeFile[]; skipped?: string[] };

interface SharedFilesPlugin {
  takePending(): Promise<NativeBatch>;
  addListener(event: "filesShared", cb: (batch: NativeBatch) => void): Promise<{ remove: () => Promise<void> }>;
}

const SharedFiles = registerPlugin<SharedFilesPlugin>("SharedFiles");

/** What the upload forms receive: songs ready to be added, and anything that could not be read. */
export type SharedBatch = { id: string; audio: File[]; skipped: string[] };

const AUDIO_EXT = /\.(mp3|m4a|aac|wav|ogg|oga|flac|opus|mp4)$/i;

export const isAudio = (name: string, type: string) => type.startsWith("audio/") || AUDIO_EXT.test(name);

/** Single for one song, Album for several. */
export const tabFor = (batch: SharedBatch) => (batch.audio.length > 1 ? "album" : "single");

let current: SharedBatch | null = null;
const listeners = new Set<(b: SharedBatch | null) => void>();
const seen = new Set<string>();
const set = (b: SharedBatch | null) => {
  current = b;
  listeners.forEach((l) => l(b));
};

async function toFile(f: NativeFile): Promise<File> {
  const res = await fetch(Capacitor.convertFileSrc(f.path));
  if (!res.ok) throw new Error(`Could not read ${f.name}`);
  const blob = await res.blob();
  return new File([blob], f.name, { type: f.type || blob.type || "audio/mpeg" });
}

/** Turns what Android handed over into files. Exported for tests. */
export async function receiveBatch(batch: NativeBatch, read: (f: NativeFile) => Promise<File> = toFile) {
  const id = batch.id || String(Date.now());
  const files = batch.files ?? [];
  if (seen.has(id) || (!files.length && !batch.skipped?.length)) return;
  seen.add(id);
  const audio: File[] = [];
  const skipped = [...(batch.skipped ?? [])];
  for (const f of files) {
    if (!isAudio(f.name, f.type)) {
      skipped.push(f.name);
      continue;
    }
    try {
      audio.push(await read(f));
    } catch {
      skipped.push(f.name);
    }
  }
  set({ id, audio, skipped });
}

let started = false;
/** Starts listening for shared songs (Android app only). Safe to call more than once. */
export function startSharedFiles() {
  if (started || !Capacitor.isNativePlatform()) return;
  started = true;
  void SharedFiles.addListener("filesShared", (b) => void receiveBatch(b)).catch(() => {});
  void SharedFiles.takePending().then((b) => receiveBatch(b)).catch(() => {});
}

/** The latest shared songs not yet placed in a form, and a way to mark them as used. */
export function useSharedFiles() {
  const [batch, setBatch] = useState<SharedBatch | null>(current);
  useEffect(() => {
    startSharedFiles();
    listeners.add(setBatch);
    setBatch(current);
    return () => {
      listeners.delete(setBatch);
    };
  }, []);
  const consume = (id: string) => {
    if (current?.id === id) set(null);
  };
  return { batch, consume };
}

/** The open tab of an upload screen; switches to Single or Album when songs are shared in. */
export function useSharedTab(initial = "single") {
  const [tab, setTab] = useState(initial);
  const { batch } = useSharedFiles();
  useEffect(() => {
    if (batch?.audio.length) setTab(tabFor(batch));
  }, [batch?.id]);
  return [tab, setTab] as const;
}
