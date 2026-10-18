import { supabase as typedClient } from "@/integrations/supabase/client";

// The generated types lag behind the schema; use an untyped handle for admin writes.
export const supabase = typedClient as any;

export const MAX_ALBUM_TRACKS = 15;
export const MAX_FILE_MB = 50;
export const AUDIO_ACCEPT = "audio/mpeg,audio/mp3,audio/mp4,audio/x-m4a,audio/aac,audio/wav,audio/x-wav,audio/ogg,.mp3,.m4a,.wav,.ogg,.aac";

export type Artist = { id: string; name: string };
export type TrackDraft = { key: string; file: File; title: string; status: "idle" | "uploading" | "done" | "error"; error?: string };

export const titleFromFile = (name: string) =>
  name.replace(/\.[^.]+$/, "").replace(/[_-]+/g, " ").replace(/\s+/g, " ").trim();

export const slug = (s: string) =>
  s.normalize("NFKD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-zA-Z0-9]+/g, "_").replace(/^_|_$/g, "").slice(0, 60) || "file";

export const extOf = (f: File) => (f.name.match(/\.([a-z0-9]+)$/i)?.[1] || "bin").toLowerCase();

export async function uploadFile(bucket: "music" | "covers", file: File, base: string) {
  const path = `${slug(base)}_${Date.now()}_${Math.random().toString(36).slice(2, 6)}.${extOf(file)}`;
  const { error } = await supabase.storage.from(bucket).upload(path, file, {
    contentType: file.type || undefined,
    upsert: false,
  });
  if (error) throw new Error(error.message);
  return supabase.storage.from(bucket).getPublicUrl(path).data.publicUrl as string;
}

export async function resolveArtist(name: string, artists: Artist[]): Promise<string | null> {
  const clean = name.trim();
  const found = artists.find((a) => a.name.toLowerCase() === clean.toLowerCase());
  if (found) return found.id;
  const { data, error } = await supabase.from("artists").insert({ name: clean }).select("id").single();
  if (error) throw new Error(`Could not create artist: ${error.message}`);
  return data.id;
}

export function tooBig(f: File) {
  return f.size > MAX_FILE_MB * 1024 * 1024;
}

