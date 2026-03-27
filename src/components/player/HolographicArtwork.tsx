import { Track } from "@/lib/tracks";

interface Props {
  track: Track | null;
  isPlaying: boolean;
}

export function HolographicArtwork({ track, isPlaying }: Props) {
  return (
    <div className="relative flex items-center justify-center py-8">
      {/* Outer glow rings */}
      <div className={`absolute w-64 h-64 rounded-full border border-neon-cyan/20 ${isPlaying ? "animate-spin-slow" : ""}`} />
      <div className={`absolute w-72 h-72 rounded-full border border-neon-purple/10 ${isPlaying ? "animate-spin-slow" : ""} [animation-direction:reverse]`} />
      
      {/* Glow backdrop */}
      <div className={`absolute w-48 h-48 rounded-full bg-neon-cyan/10 blur-3xl transition-opacity duration-700 ${isPlaying ? "opacity-100" : "opacity-30"}`} />
      <div className={`absolute w-40 h-40 rounded-full bg-neon-purple/10 blur-2xl transition-opacity duration-700 ${isPlaying ? "opacity-80" : "opacity-20"}`} />

      {/* Album art */}
      <div className={`relative w-48 h-48 rounded-2xl overflow-hidden neon-border transition-all duration-700 ${isPlaying ? "animate-float neon-glow" : "opacity-70"}`}>
        <img
          src={track?.coverUrl || "/images/logo.png"}
          alt={track?.title || "Sommyart Music"}
          className="w-full h-full object-cover"
        />
        <div className="absolute inset-0 holographic-shimmer" />
      </div>
    </div>
  );
}
