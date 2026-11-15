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

/** Songs and covers are stored on Cloudflare R2 (it does not charge for downloads). */
const FILE_CACHE_CONTROL = "public, max-age=31536000, immutable";

async function uploadToSupabase(bucket: "music" | "covers", file: File, path: string): Promise<string> {
  const { error } = await supabase.storage.from(bucket).upload(path, file, {
    contentType: file.type || undefined,
    // File names are unique, so phones may keep a copy for a year instead of asking again every hour.
    cacheControl: "31536000",
    upsert: false,
  });
  if (error) throw new Error(error.message);
  return supabase.storage.from(bucket).getPublicUrl(path).data.publicUrl as string;
}

/** Asks the server for a short-lived upload link, then sends the file straight to R2. */
async function uploadToR2(bucket: "music" | "covers", file: File, path: string): Promise<string> {
  const contentType = file.type || "application/octet-stream";
  const { data, error } = await supabase.functions.invoke("r2-upload-url", {
    body: { bucket, path, contentType, size: file.size },
  });
  if (error || !data?.uploadUrl || !data?.publicUrl) {
    throw new Error(data?.error || error?.message || "Could not start the upload");
  }
  const res = await fetch(data.uploadUrl, {
    method: "PUT",
    body: file,
    headers: { "Content-Type": contentType, "Cache-Control": data.cacheControl || FILE_CACHE_CONTROL },
  });
  if (!res.ok) throw new Error(`Upload to storage failed (${res.status})`);
  return data.publicUrl as string;
}

export async function uploadFile(bucket: "music" | "covers", file: File, base: string, folder?: string) {
  const path = `${folder ? folder.replace(/\/+$/, "") + "/" : ""}${slug(base)}_${Date.now()}_${Math.random().toString(36).slice(2, 6)}.${extOf(file)}`;
  // Applicants' profile pictures stay where they were: the storage rules there cap how many a person can send.
  if (folder?.startsWith("applications/")) return uploadToSupabase(bucket, file, path);
  try {
    return await uploadToR2(bucket, file, path);
  } catch (err) {
    // Never lose an upload: if R2 is unreachable or not allowed, use the old storage as before.
    console.warn("R2 upload failed, using the old storage instead:", err);
    return uploadToSupabase(bucket, file, path);
  }
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
