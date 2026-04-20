import { useState, useRef, useEffect, useCallback } from "react";
import { Track } from "@/lib/tracks";
import { extractCoverArt } from "@/lib/extractCoverArt";

export function useMusicPlayer(playlist: Track[]) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [currentTrackIndex, setCurrentTrackIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [shuffle, setShuffle] = useState(false);
  const [repeat, setRepeat] = useState<"off" | "all" | "one">("off");
  const [extractedCover, setExtractedCover] = useState<string | null>(null);

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

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || !currentTrack) return;
    if (audio.src !== currentTrack.audioUrl) {
      audio.src = currentTrack.audioUrl;
      audio.load();
    }
    if (isPlaying) {
      audio.play().catch((err) => {
        console.error("Playback failed:", err, currentTrack.audioUrl);
      });
    }
  }, [currentTrack?.id, isPlaying]);

  const togglePlay = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;
    if (isPlaying) { audio.pause(); setIsPlaying(false); }
    else { audio.play().catch(() => {}); setIsPlaying(true); }
  }, [isPlaying]);

  const handleNext = useCallback(() => {
    if (repeat === "one") {
      const audio = audioRef.current;
      if (audio) { audio.currentTime = 0; audio.play().catch(() => {}); }
      return;
    }
    if (shuffle) {
      let next = Math.floor(Math.random() * playlist.length);
      if (next === currentTrackIndex && playlist.length > 1) next = (next + 1) % playlist.length;
      setCurrentTrackIndex(next);
    } else {
      setCurrentTrackIndex((i) => (i + 1) % playlist.length);
    }
  }, [shuffle, repeat, currentTrackIndex, playlist.length]);

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
    setShuffle: () => setShuffle((s) => !s),
    setRepeat: () => setRepeat((r) => r === "off" ? "all" : r === "all" ? "one" : "off"),
  };
}
