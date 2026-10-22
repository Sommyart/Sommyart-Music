import { useEffect, useRef } from "react";
import { Capacitor } from "@capacitor/core";
import { MediaSession } from "@capgo/capacitor-media-session";
import { useMusicPlayerContext } from "@/contexts/MusicPlayerContext";
import { artworkForNative } from "@/lib/artwork";
import { getNotifyPermission, requestNotifyPermission } from "@/lib/notify";

const isNative = () => {
  try {
    return Capacitor.isNativePlatform();
  } catch {
    return false;
  }
};

/**
 * Shows the player card (title, artist, cover, play/pause, next, previous and a
 * seek bar) in the notification shade and on the lock screen, and lets headset
 * buttons control the music.
 *
 * In a browser this uses the Media Session web API. Android's built-in web view
 * does not support that API, so inside the installed app a native media
 * session is used instead. The native one also keeps the music playing with the
 * screen off.
 */
export function useMediaSession() {
  const {
    currentTrack,
    isPlaying,
    currentTime,
    duration,
    playbackRate,
    togglePlay,
    handleNext,
    handlePrev,
    seek,
  } = useMusicPlayerContext();

  // Handlers read the latest values from a ref so they are registered once
  // instead of on every time tick.
  const live = useRef({ togglePlay, handleNext, handlePrev, seek, currentTime, duration, isPlaying, playbackRate });
  live.current = { togglePlay, handleNext, handlePrev, seek, currentTime, duration, isPlaying, playbackRate };

  /* ------------------------------- Browser ------------------------------- */

  // Metadata + action handlers
  useEffect(() => {
    if (isNative()) return;
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
    ms.setActionHandler("play", () => { if (!live.current.isPlaying) live.current.togglePlay(); });
    ms.setActionHandler("pause", () => { if (live.current.isPlaying) live.current.togglePlay(); });
    ms.setActionHandler("previoustrack", () => live.current.handlePrev());
    ms.setActionHandler("nexttrack", () => live.current.handleNext());
    ms.setActionHandler("seekto", (details) => {
      if (typeof details.seekTime === "number") live.current.seek(details.seekTime);
    });
    ms.setActionHandler("seekbackward", (details) => {
      live.current.seek(Math.max(0, live.current.currentTime - (details.seekOffset ?? 10)));
    });
    ms.setActionHandler("seekforward", (details) => {
      live.current.seek(Math.min(live.current.duration || 0, live.current.currentTime + (details.seekOffset ?? 10)));
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
  }, [currentTrack?.id]);

  // Playback state
  useEffect(() => {
    if (isNative()) return;
    if (!("mediaSession" in navigator)) return;
    navigator.mediaSession.playbackState = isPlaying ? "playing" : "paused";
  }, [isPlaying]);

  // Position state for accurate scrubbing on lock screens
  useEffect(() => {
    if (isNative()) return;
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

  /* --------------------------- Installed Android app --------------------------- */

  // The player card only appears once something has been played, never at launch.
  const startedRef = useRef(false);

  // Buttons: registered once, they always act on the latest player state.
  useEffect(() => {
    if (!isNative()) return;
    const on = (action: "play" | "pause" | "previoustrack" | "nexttrack" | "seekto", fn: (seekTime?: number | null) => void) =>
      MediaSession.setActionHandler({ action }, (d) => fn(d.seekTime)).catch(() => {});
    on("play", () => { if (!live.current.isPlaying) live.current.togglePlay(); });
    on("pause", () => { if (live.current.isPlaying) live.current.togglePlay(); });
    on("previoustrack", () => live.current.handlePrev());
    on("nexttrack", () => live.current.handleNext());
    on("seekto", (t) => {
      if (typeof t !== "number") return;
      live.current.seek(t);
      // Tell the lock screen where the bar landed.
      window.setTimeout(() => {
        const { duration: d, currentTime: c, playbackRate: r } = live.current;
        if (d && isFinite(d)) MediaSession.setPositionState({ duration: d, position: Math.min(c, d), playbackRate: r || 1 }).catch(() => {});
      }, 400);
    });
  }, []);

  // Title, artist and cover.
  useEffect(() => {
    if (!isNative() || !currentTrack) return;
    let cancelled = false;
    (async () => {
      const art = await artworkForNative(currentTrack.coverUrl);
      if (cancelled) return;
      await MediaSession.setMetadata({
        title: currentTrack.title,
        artist: currentTrack.artist,
        album: "Sommyart Music",
        artwork: art ? [{ src: art, sizes: "512x512", type: art.startsWith("data:image/jpeg") ? "image/jpeg" : "image/png" }] : [],
      }).catch(() => {});
    })();
    return () => {
      cancelled = true;
    };
  }, [currentTrack?.id, currentTrack?.title, currentTrack?.artist, currentTrack?.coverUrl]);

  // Play / pause state. The first play also asks for the notification permission,
  // because Android hides the player card without it.
  useEffect(() => {
    if (!isNative()) return;
    if (isPlaying) {
      startedRef.current = true;
      getNotifyPermission()
        .then((p) => (p === "prompt" ? requestNotifyPermission() : p))
        .catch(() => {});
    }
    if (!startedRef.current) return;
    MediaSession.setPlaybackState({ playbackState: isPlaying ? "playing" : "paused" }).catch(() => {});
  }, [isPlaying]);

  // Position and length, so the seek bar on the lock screen is right. Android
  // moves the bar by itself while playing, so this is sent when something
  // changes and then every few seconds to stay in step.
  const sendPosition = () => {
    const { duration: d, currentTime: t, playbackRate: r } = live.current;
    if (!d || !isFinite(d)) return;
    MediaSession.setPositionState({ duration: d, position: Math.min(t, d), playbackRate: r || 1 }).catch(() => {});
  };
  useEffect(() => {
    if (!isNative() || !startedRef.current) return;
    sendPosition();
  }, [isPlaying, duration, currentTrack?.id, playbackRate]);
  useEffect(() => {
    if (!isNative() || !isPlaying) return;
    const id = window.setInterval(sendPosition, 5000);
    return () => window.clearInterval(id);
  }, [isPlaying]);
}
