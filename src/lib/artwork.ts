/**
 * Cover pictures for the phone's player card (notification shade and lock screen).
 *
 * The Android side can only fetch ordinary web addresses or read an inline
 * picture, so covers that live inside the app (or were pulled out of the song
 * file as a temporary blob address) are redrawn as a small inline JPEG.
 */

const FALLBACK = "/images/logo.png";
const SIZE = 512;
const cache = new Map<string, string>();

function load(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("image failed to load"));
    img.src = src;
  });
}

async function toSmallJpeg(src: string): Promise<string> {
  const img = await load(src);
  const canvas = document.createElement("canvas");
  canvas.width = SIZE;
  canvas.height = SIZE;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("no canvas");
  ctx.fillStyle = "#0A0F1F";
  ctx.fillRect(0, 0, SIZE, SIZE);
  // Fill the square, cropping the long side (like object-fit: cover).
  const side = Math.min(img.naturalWidth, img.naturalHeight) || SIZE;
  const sx = ((img.naturalWidth || side) - side) / 2;
  const sy = ((img.naturalHeight || side) - side) / 2;
  ctx.drawImage(img, sx, sy, side, side, 0, 0, SIZE, SIZE);
  return canvas.toDataURL("image/jpeg", 0.85);
}

/** An address the Android player card can show for this cover. */
export async function artworkForNative(src?: string | null): Promise<string> {
  const url = src || FALLBACK;
  // A real web address from another site (for example the cloud storage) is
  // downloaded by the phone itself, so it can be passed straight through.
  if (/^https?:\/\//.test(url) && !url.startsWith(window.location.origin)) return url;

  const hit = cache.get(url);
  if (hit) return hit;
  try {
    const data = await toSmallJpeg(url);
    if (cache.size >= 20) cache.delete(cache.keys().next().value as string);
    cache.set(url, data);
    return data;
  } catch {
    if (url !== FALLBACK) return artworkForNative(FALLBACK);
    return "";
  }
}
