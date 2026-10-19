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

/** When an artist is signed in, files go into their own folder: artists/<user id>/ (the storage rules require it). */
export type Owner = { artistId: string; artistName: string; folder: string };

export async function uploadFile(bucket: "music" | "covers", file: File, base: string, folder?: string) {
  const path = `${folder ? folder.replace(/\/+$/, "") + "/" : ""}${slug(base)}_${Date.now()}_${Math.random().toString(36).slice(2, 6)}.${extOf(file)}`;
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


/** Shrink big phone photos before uploading (max 1000 px, JPEG). Falls back to the original file. */
export async function shrinkImage(file: File): Promise<File> {
  try {
    if (!file.type.startsWith("image/") || file.type === "image/gif" || file.type === "image/svg+xml") return file;
    const bmp = await createImageBitmap(file);
    const scale = Math.min(1, 1000 / Math.max(bmp.width, bmp.height));
    const w = Math.round(bmp.width * scale);
    const h = Math.round(bmp.height * scale);
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) return file;
    ctx.drawImage(bmp, 0, 0, w, h);
    const blob: Blob | null = await new Promise((res) => canvas.toBlob(res, "image/jpeg", 0.86));
    if (!blob || blob.size >= file.size) return file;
    return new File([blob], file.name.replace(/\.[^.]+$/, "") + ".jpg", { type: "image/jpeg" });
  } catch {
    return file;
  }
}
