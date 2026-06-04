import { useState, useRef, useEffect, useCallback } from "react";
import { Track } from "@/lib/tracks";
import { extractCoverArt } from "@/lib/extractCoverArt";

export function useMusicPlayer(playlist: Track[], audioEnabled: boolean = true) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [currentTrackIndex, setCurrentTrackIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [shuffle, setShuffle] = useState(false);
  const [repeat, setRepeat] = useState<"off" | "all" | "one">("off");
  const [extractedCover, setExtractedCover] = useState<string | null>(null);
  const [playbackRate, setPlaybackRateState] = useState(1);

  const setPlaybackRate = useCallback((rate: number) => {
    const r = Math.min(2, Math.max(0.5, rate));
    setPlaybackRateState(r);
    if (audioRef.current) audioRef.current.playbackRate = r;
  }, []);

  const currentTrack = playlist[currentTrackIndex] || null;

  // Extract embedded cover art when track changes
  useEffect(() => {
    if (!currentTrack) return;
    setExtractedCover(null);
    extractCoverArt(currentTrack.audioUrl).then((cover) => {
      if (cover) setExtractedCover(cover);
    });
  }, [currentTrack?.audioUrl]);

  const enrichedTrack = currentTrack
    ? { ...currentTrack, coverUrl: extractedCover || currentTrack.coverUrl }
    : null;

  useEffect(() => {
    const audio = new Audio();
    audioRef.current = audio;
    audio.addEventListener("timeupdate", () => setCurrentTime(audio.currentTime));
    audio.addEventListener("loadedmetadata", () => setDuration(audio.duration));
    audio.addEventListener("ended", () => handleNext());
    audio.addEventListener("error", () => {
      const err = audio.error;
      console.error("Audio element error:", {
        code: err?.code,
        message: err?.message,
        src: audio.src,
      });
    });
    return () => { audio.pause(); audio.src = ""; };
  }, []);

  // Pause local audio if this device is not the active one
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    if (!audioEnabled) {
      audio.pause();
    } else if (isPlaying && audio.paused) {
      audio.play().catch(() => {});
    }
  }, [audioEnabled, isPlaying]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || !currentTrack) return;
    if (audio.src !== currentTrack.audioUrl) {
      audio.src = currentTrack.audioUrl;
      audio.load();
    }
    audio.playbackRate = playbackRate;
    if (isPlaying && audioEnabled) {
      audio.play().catch((err) => {
        console.error("Playback failed:", err, currentTrack.audioUrl);
      });
    }
  }, [currentTrack?.id, isPlaying, audioEnabled]);

  const togglePlay = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;
    if (isPlaying) { audio.pause(); setIsPlaying(false); }
    else { if (audioEnabled) audio.play().catch(() => {}); setIsPlaying(true); }
  }, [isPlaying, audioEnabled]);

  const handleNext = useCallback(() => {
    if (repeat === "one") {
      const audio = audioRef.current;
      if (audio) { audio.currentTime = 0; if (audioEnabled) audio.play().catch(() => {}); }
      return;
    }
    if (shuffle) {
      let next = Math.floor(Math.random() * playlist.length);
      if (next === currentTrackIndex && playlist.length > 1) next = (next + 1) % playlist.length;
      setCurrentTrackIndex(next);
      return;
    }
    if (currentTrackIndex < playlist.length - 1) {
      setCurrentTrackIndex((i) => i + 1);
    } else if (repeat === "all") {
      setCurrentTrackIndex(0);
    } else {
      // End of playlist, no repeat: stop
      const audio = audioRef.current;
      if (audio) { audio.pause(); audio.currentTime = 0; }
      setIsPlaying(false);
      setCurrentTime(0);
    }
  }, [shuffle, repeat, currentTrackIndex, playlist.length, audioEnabled]);

  const handlePrev = useCallback(() => {
    const audio = audioRef.current;
    if (audio && audio.currentTime > 3) { audio.currentTime = 0; return; }
    setCurrentTrackIndex((i) => (i - 1 + playlist.length) % playlist.length);
  }, [playlist.length]);

  const seek = useCallback((time: number) => {
    const audio = audioRef.current;
    if (audio) { audio.currentTime = time; setCurrentTime(time); }
  }, []);

  const playTrack = useCallback((index: number) => {
    setCurrentTrackIndex(index);
    setIsPlaying(true);
  }, []);

  // Remote-applied state: jump to track by id, seek, set play
  const applyRemoteState = useCallback(
    (s: {
      songId: string | null;
      positionSeconds: number;
      isPlaying: boolean;
      playbackRate: number;
      shuffle?: boolean;
      repeat?: "off" | "all" | "one";
    }) => {
      const audio = audioRef.current;
      if (s.songId) {
        const idx = playlist.findIndex((t) => t.id === s.songId);
        if (idx >= 0 && idx !== currentTrackIndex) {
          setCurrentTrackIndex(idx);
        }
      }
      setPlaybackRateState(s.playbackRate);
      if (audio) {
        audio.playbackRate = s.playbackRate;
        if (Math.abs((audio.currentTime || 0) - s.positionSeconds) > 1.5) {
          audio.currentTime = s.positionSeconds;
        }
      }
      setCurrentTime(s.positionSeconds);
      setIsPlaying(s.isPlaying);
      if (typeof s.shuffle === "boolean") setShuffle(s.shuffle);
      if (s.repeat) setRepeat(s.repeat);
    },
    [playlist, currentTrackIndex],
  );

  const toggleShuffle = useCallback(() => setShuffle((s) => !s), []);
  const cycleRepeat = useCallback(
    () => setRepeat((r) => (r === "off" ? "all" : r === "all" ? "one" : "off")),
    [],
  );

  return {
    playlist,
    currentTrack: enrichedTrack,
    currentTrackIndex,
    isPlaying,
    currentTime,
    duration,
    shuffle,
    repeat,
    togglePlay,
    handleNext,
    handlePrev,
    seek,
    playTrack,
    setShuffle: toggleShuffle,
    setShuffleValue: setShuffle,
    setRepeat: cycleRepeat,
    setRepeatValue: setRepeat,
    playbackRate,
    setPlaybackRate,
    applyRemoteState,
  };
}

