// A small JPEG copy of a cover for link previews. WhatsApp (and some other apps) skip preview
// pictures that are too large, and the original covers are full-size PNGs.
import sharp from "sharp";

const ALLOWED = ["https://pub-d871fc1e9c284711846ff7b27f8f8f1b.r2.dev/", "https://sommyart-music.vercel.app/"];
const SIZE = 600;

export default async function handler(req: any, res: any) {
  const src = String(req.query?.src ?? "");
  if (!ALLOWED.some((p) => src.startsWith(p))) {
    res.status(400).send("Unknown picture");
    return;
  }
  try {
    const upstream = await fetch(src);
    if (!upstream.ok) throw new Error(String(upstream.status));
    const input = Buffer.from(await upstream.arrayBuffer());
    const jpeg = await sharp(input)
      .resize(SIZE, SIZE, { fit: "cover" })
      .flatten({ background: "#0b0b14" })
      .jpeg({ quality: 78, mozjpeg: true })
      .toBuffer();
    res.setHeader("Content-Type", "image/jpeg");
    res.setHeader("Cache-Control", "public, max-age=86400, s-maxage=31536000, immutable");
    res.status(200).send(jpeg);
  } catch {
    res.redirect(302, "/icons/icon-512.png");
  }
}
