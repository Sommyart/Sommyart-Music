import { Play } from "lucide-react";
import { Track } from "@/lib/tracks";
import { useEffect, useState } from "react";
import { extractCoverArt } from "@/lib/extractCoverArt";

interface Props {
  track: Track;
  isPlaying: boolean;
  onPlay: () => void;
}

export function HeroSection({ track, isPlaying, onPlay }: Props) {
  const [coverArt, setCoverArt] = useState<string | null>(null);

  useEffect(() => {
    extractCoverArt(track.audioUrl).then((cover) => {
      if (cover) setCoverArt(cover);
    });
  }, [track.audioUrl]);

  const displayCover = coverArt || track.coverUrl;

  return (
    <section className="relative px-6 pt-6 pb-8 overflow-hidden">
      {/* Background ambient glow */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-80 h-80 rounded-full blur-3xl opacity-20" style={{ background: "hsl(var(--neon-cyan))" }} />
        <div className="absolute top-1/3 right-0 w-48 h-48 rounded-full blur-3xl opacity-10" style={{ background: "hsl(var(--accent))" }} />
      </div>

      <div className="relative flex flex-col items-center">
        {/* NEW RELEASE badge */}
        <div className="mb-4 px-3 py-1 rounded-full glass border border-primary/30 text-[10px] font-display tracking-[0.3em] text-primary uppercase">
          ✦ New Release
        </div>

        {/* Holographic floating artwork */}
        <div className="relative mb-6">
          {/* Outer glow rings */}
          <div className="absolute inset-[-16px] rounded-3xl border border-primary/15 animate-pulse-neon" />
          <div className="absolute inset-[-8px] rounded-2xl border border-primary/10" />

          {/* Volumetric light beneath */}
          <div className="absolute -bottom-6 left-1/2 -translate-x-1/2 w-3/4 h-8 rounded-full blur-xl opacity-40" style={{ background: "hsl(var(--neon-cyan))" }} />

          {/* Album art */}
          <div className="relative w-52 h-52 rounded-2xl overflow-hidden neon-glow animate-float">
            <img
              src={displayCover}
              alt={track.title}
              className="w-full h-full object-cover"
            />
            <div className="absolute inset-0 holographic-shimmer opacity-60" />

            {/* Playing pulse */}
            {isPlaying && (
              <div
                className="absolute inset-0 animate-pulse-neon"
                style={{
                  background: "radial-gradient(circle, hsla(186,100%,50%,0.1) 0%, transparent 70%)",
                }}
              />
            )}
          </div>
        </div>

        {/* Track info */}
        <h2 className="text-lg font-display font-bold tracking-wide text-foreground neon-text text-center">
          {track.title}
        </h2>
        <p className="text-sm text-muted-foreground mt-1">{track.artist}</p>
        <p className="text-xs text-muted-foreground/70 mt-2 text-center max-w-[260px]">
          Latest release from Sommyart — feel the frequency
        </p>

        {/* Play button */}
        <button
          onClick={onPlay}
          className="mt-5 flex items-center gap-2 px-6 py-2.5 rounded-full bg-primary text-primary-foreground font-display text-sm tracking-wider neon-glow transition-all duration-300 hover:scale-105 active:scale-95"
        >
          <Play size={16} fill="currentColor" />
          PLAY NOW
        </button>
      </div>
    </section>
  );
}
