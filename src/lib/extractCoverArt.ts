/**
 * Lightweight ID3v2 cover art extractor using fetch + ArrayBuffer.
 * No external dependencies — works natively in the browser.
 */

import { readCachedAudioHead } from "@/lib/offlineAudio";

const coverCache = new Map<string, string | null>();

function readSyncsafeInt(view: DataView, offset: number): number {
  return (
    ((view.getUint8(offset) & 0x7f) << 21) |
    ((view.getUint8(offset + 1) & 0x7f) << 14) |
    ((view.getUint8(offset + 2) & 0x7f) << 7) |
    (view.getUint8(offset + 3) & 0x7f)
  );
}

function findAPICFrame(buffer: ArrayBuffer): string | null {
  const view = new DataView(buffer);
  const bytes = new Uint8Array(buffer);

  // Check for ID3v2 header
  if (
    bytes[0] !== 0x49 || // I
    bytes[1] !== 0x44 || // D
    bytes[2] !== 0x33    // 3
  ) {
    return null;
  }

  const majorVersion = bytes[3];
  const tagSize = readSyncsafeInt(view, 6);
  let offset = 10;
  const end = Math.min(10 + tagSize, buffer.byteLength);

  while (offset + 10 < end) {
    const frameId = String.fromCharCode(bytes[offset], bytes[offset + 1], bytes[offset + 2], bytes[offset + 3]);

    let frameSize: number;
    if (majorVersion === 4) {
      frameSize = readSyncsafeInt(view, offset + 4);
    } else {
      frameSize = view.getUint32(offset + 4);
    }

    if (frameSize <= 0 || offset + 10 + frameSize > end) break;

    if (frameId === "APIC") {
      const frameData = bytes.subarray(offset + 10, offset + 10 + frameSize);

      // Skip encoding byte
      let i = 1;

      // Read MIME type (null-terminated)
      let mime = "";
      while (i < frameData.length && frameData[i] !== 0) {
        mime += String.fromCharCode(frameData[i]);
        i++;
      }
      i++; // skip null terminator

      // Skip picture type byte
      i++;

      // Skip description (null-terminated)
      while (i < frameData.length && frameData[i] !== 0) i++;
      i++; // skip null terminator

      // Rest is image data
      const imageData = frameData.subarray(i);
      if (imageData.length > 0) {
        const blob = new Blob([imageData], { type: mime || "image/jpeg" });
        return URL.createObjectURL(blob);
      }
    }

    offset += 10 + frameSize;
  }

  return null;
}

export async function extractCoverArt(audioUrl: string): Promise<string | null> {
  if (coverCache.has(audioUrl)) {
    return coverCache.get(audioUrl)!;
  }

  try {
    const fullUrl = audioUrl.startsWith("http")
      ? audioUrl
      : `${window.location.origin}${audioUrl}`;

    // A song already saved on this device is read locally, with no download.
    // Otherwise fetch only the first 512KB, which is enough for ID3 tags.
    let buffer = await readCachedAudioHead(fullUrl, 524288);
    if (!buffer) {
      const response = await fetch(fullUrl, {
        headers: { Range: "bytes=0-524287" },
      });
      buffer = await response.arrayBuffer();
    }
    const cover = findAPICFrame(buffer);

    coverCache.set(audioUrl, cover);
    return cover;
  } catch {
    coverCache.set(audioUrl, null);
    return null;
  }
}
