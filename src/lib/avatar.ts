import { supabase } from "@/integrations/supabase/client";

const MAX_SIDE = 512;

/** Target size for a picture so its longest side is at most `max`. */
export function fitWithin(width: number, height: number, max = MAX_SIDE) {
  const scale = Math.min(1, max / Math.max(width, height, 1));
  return { width: Math.max(1, Math.round(width * scale)), height: Math.max(1, Math.round(height * scale)) };
}

/** Shrinks a chosen photo to a small JPEG so it is cheap to send and to show. */
export async function shrinkPhoto(file: File): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  const { width, height } = fitWithin(bitmap.width, bitmap.height);
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("This device could not prepare the photo");
  ctx.drawImage(bitmap, 0, 0, width, height);
  bitmap.close?.();
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.85));
  if (!blob) throw new Error("This device could not prepare the photo");
  return blob;
}

/** Sends the photo to storage and returns its public address. */
export async function uploadAvatar(userId: string, file: File): Promise<string> {
  if (!file.type.startsWith("image/")) throw new Error("Please choose a picture");
  const photo = await shrinkPhoto(file);
  const path = `${userId}/${Date.now()}_${Math.random().toString(36).slice(2, 6)}.jpg`;
  const { data, error } = await supabase.functions.invoke("r2-upload-url", {
    body: { bucket: "avatars", path, contentType: "image/jpeg", size: photo.size },
  });
  if (error || !data?.uploadUrl || !data?.publicUrl) {
    throw new Error(data?.error || error?.message || "Could not start the upload");
  }
  const res = await fetch(data.uploadUrl, {
    method: "PUT",
    body: photo,
    headers: { "Content-Type": "image/jpeg", "Cache-Control": data.cacheControl },
  });
  if (!res.ok) throw new Error(`Upload failed (${res.status})`);
  return data.publicUrl as string;
}
