import { useEffect } from "react";
import { useMusicPlayerContext } from "@/contexts/MusicPlayerContext";

/**
 * Wires navigator.mediaSession so the track shows up on lock screens,
 * notification shades, and OS media keys. Enables true background playback.
 */
export function useMediaSession() {
  const {
    currentTrack,
    isPlaying,
    currentTime,
    duration,
    togglePlay,
    handleNext,
    handlePrev,
    seek,
  } = useMusicPlayerContext();

  // Metadata + action handlers
  useEffect(() => {
    if (!("mediaSession" in navigator) || !currentTrack) return;
    try {
      navigator.mediaSession.metadata = new MediaMetadata({
        title: currentTrack.title,
        artist: currentTrack.artist,
        album: "Sommyart Music",
        artwork: currentTrack.coverUrl
          ? [
              { src: currentTrack.coverUrl, sizes: "512x512", type: "image/png" },
              { src: currentTrack.coverUrl, sizes: "256x256", type: "image/png" },
              { src: currentTrack.coverUrl, sizes: "96x96", type: "image/png" },
            ]
          : undefined,
      });
    } catch {/* noop */}

    const ms = navigator.mediaSession;
    ms.setActionHandler("play", () => togglePlay());
    ms.setActionHandler("pause", () => togglePlay());
    ms.setActionHandler("previoustrack", () => handlePrev());
    ms.setActionHandler("nexttrack", () => handleNext());
    ms.setActionHandler("seekto", (details) => {
      if (typeof details.seekTime === "number") seek(details.seekTime);
    });
    ms.setActionHandler("seekbackward", (details) => {
      seek(Math.max(0, currentTime - (details.seekOffset ?? 10)));
    });
    ms.setActionHandler("seekforward", (details) => {
      seek(Math.min(duration || 0, currentTime + (details.seekOffset ?? 10)));
    });

    return () => {
      try {
        ms.setActionHandler("play", null);
        ms.setActionHandler("pause", null);
        ms.setActionHandler("previoustrack", null);
        ms.setActionHandler("nexttrack", null);
        ms.setActionHandler("seekto", null);
        ms.setActionHandler("seekbackward", null);
        ms.setActionHandler("seekforward", null);
      } catch {/* noop */}
    };
  }, [currentTrack?.id, currentTime, duration, togglePlay, handleNext, handlePrev, seek]);

  // Playback state
  useEffect(() => {
    if (!("mediaSession" in navigator)) return;
    navigator.mediaSession.playbackState = isPlaying ? "playing" : "paused";
  }, [isPlaying]);

  // Position state for accurate scrubbing on lock screens
  useEffect(() => {
    if (!("mediaSession" in navigator) || !("setPositionState" in navigator.mediaSession)) return;
    if (!duration || !isFinite(duration)) return;
    try {
      navigator.mediaSession.setPositionState({
        duration,
        position: Math.min(currentTime, duration),
        playbackRate: 1,
      });
    } catch {/* noop */}
  }, [currentTime, duration]);
}
