import { useEffect, useState } from "react";
import { extractCoverArt } from "@/lib/extractCoverArt";

const PLACEHOLDER = "/images/logo.png";

/** True when the song has a real cover of its own (for album songs, the album's cover). */
export const hasRealCover = (coverUrl: string | null | undefined) => !!coverUrl && coverUrl !== PLACEHOLDER;

/**
 * The picture to show for a song. Its saved cover always wins (album songs carry the album's cover);
 * the picture built into the audio file is only used when there is no saved cover.
 */
export function useSongCover(track: { audioUrl: string; coverUrl?: string | null }): string {
  const real = hasRealCover(track.coverUrl);
  const [embedded, setEmbedded] = useState<string | null>(null);
  useEffect(() => {
    setEmbedded(null);
    if (real) return;
    let cancelled = false;
    extractCoverArt(track.audioUrl).then((c) => {
      if (!cancelled && c) setEmbedded(c);
    });
    return () => {
      cancelled = true;
    };
  }, [track.audioUrl, real]);
  return real ? (track.coverUrl as string) : embedded || track.coverUrl || PLACEHOLDER;
}
