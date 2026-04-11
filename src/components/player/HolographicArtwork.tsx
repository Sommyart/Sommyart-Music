import { useRef, useEffect } from "react";
import { Track } from "@/lib/tracks";

interface Props {
  track: Track | null;
  isPlaying: boolean;
}

export function HolographicArtwork({ track, isPlaying }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    if (isPlaying) {
      video.play().catch(() => {});
    } else {
      video.pause();
    }
  }, [isPlaying]);

  return (
    <div className="relative flex items-center justify-center py-8" style={{ height: 280 }}>
      {/* Volumetric light rays */}
      <div
        className={`absolute w-56 h-56 rounded-full transition-opacity duration-700 ${
          isPlaying ? "opacity-100" : "opacity-20"
        }`}
        style={{
          background: "radial-gradient(circle, hsla(186,100%,50%,0.12) 0%, transparent 70%)",
        }}
      />

      {/* Outer glow rings */}
      <div
        className={`absolute w-64 h-64 rounded-full border transition-all duration-700 ${
          isPlaying ? "animate-spin-slow border-primary/25" : "border-primary/10"
        }`}
      />
      <div
        className={`absolute w-72 h-72 rounded-full border transition-all duration-700 ${
          isPlaying ? "animate-spin-slow border-accent/15 [animation-direction:reverse]" : "border-accent/5"
        }`}
      />

      {/* Glow backdrop */}
      <div
        className={`absolute w-48 h-48 rounded-full blur-3xl transition-opacity duration-700 ${
          isPlaying ? "opacity-100" : "opacity-30"
        }`}
        style={{ background: "hsla(186,100%,50%,0.1)" }}
      />

      {/* Floating holographic video */}
      <div
        className={`relative rounded-2xl overflow-hidden neon-border transition-all duration-700 ${
          isPlaying ? "animate-float neon-glow scale-100" : "opacity-70 scale-95"
        }`}
        style={{ width: 180, height: 180 }}
      >
        <video
          ref={videoRef}
          src="/videos/player-bg.mp4"
          muted
          loop
          playsInline
          className="w-full h-full object-cover"
        />
        <div className="absolute inset-0 holographic-shimmer" />

        {/* Pulse overlay when playing */}
        <div
          className={`absolute inset-0 transition-opacity duration-500 ${
            isPlaying ? "opacity-100" : "opacity-0"
          }`}
          style={{
            background: "radial-gradient(circle at center, hsla(186,100%,50%,0.08) 0%, transparent 60%)",
            animation: isPlaying ? "pulse-neon 2s ease-in-out infinite" : "none",
          }}
        />
      </div>
    </div>
  );
}
