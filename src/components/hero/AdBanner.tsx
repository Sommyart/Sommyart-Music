import { useEffect, useMemo, useState } from "react";
import { Play, Sparkles } from "lucide-react";
import { Track } from "@/lib/tracks";
import { extractCoverArt } from "@/lib/extractCoverArt";

interface Props {
  tracks: Track[];
  onPlay: (track: Track) => void;
}

function PromoCard({ track, onPlay }: { track: Track; onPlay: () => void }) {
  const [cover, setCover] = useState<string | null>(null);

  useEffect(() => {
    extractCoverArt(track.audioUrl).then((c) => c && setCover(c));
  }, [track.audioUrl]);

  return (
    <button
      onClick={onPlay}
      className="group relative flex-shrink-0 w-32 snap-start text-left focus:outline-none"
    >
      <div className="relative w-32 h-32 rounded-xl overflow-hidden neon-border bg-secondary/40">
        <img
          src={cover || track.coverUrl}
          alt={track.title}
          className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
          loading="lazy"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-background/80 via-transparent to-transparent" />
        <div className="absolute inset-0 holographic-shimmer opacity-40" />
        <div className="absolute bottom-2 right-2 w-8 h-8 rounded-full bg-primary/90 flex items-center justify-center neon-glow opacity-90 group-hover:scale-110 transition-transform">
          <Play size={14} className="text-primary-foreground ml-0.5" fill="currentColor" />
        </div>
      </div>
      <p className="mt-2 text-xs font-display tracking-wide text-foreground line-clamp-2">
        {track.title}
      </p>
      {track.genre && (
        <p className="text-[10px] text-primary/80 mt-0.5">{track.genre}</p>
      )}
    </button>
  );
}

export function AdBanner({ tracks, onPlay }: Props) {
  // Pick 3 random tracks; reshuffle when the list changes
  const picks = useMemo(() => {
    if (!tracks || tracks.length === 0) return [];
    const shuffled = [...tracks].sort(() => Math.random() - 0.5);
    return shuffled.slice(0, 3);
  }, [tracks]);

  if (picks.length === 0) return null;

  return (
    <section className="relative px-4 mb-4">
      <div className="relative rounded-2xl overflow-hidden glass border border-primary/20 p-4">
        {/* Ambient glow */}
        <div className="absolute -top-10 -right-10 w-40 h-40 rounded-full blur-3xl opacity-20 pointer-events-none" style={{ background: "hsl(var(--neon-cyan))" }} />
        <div className="absolute -bottom-10 -left-10 w-40 h-40 rounded-full blur-3xl opacity-10 pointer-events-none" style={{ background: "hsl(var(--accent))" }} />

        <div className="relative flex items-center gap-2 mb-3">
          <Sparkles className="w-4 h-4 text-primary" />
          <h2 className="text-xs font-display tracking-[0.3em] text-primary uppercase">
            Featured Picks
          </h2>
        </div>

        <div className="relative flex gap-3 overflow-x-auto snap-x snap-mandatory scrollbar-hide pb-1">
          {picks.map((t) => (
            <PromoCard key={t.id} track={t} onPlay={() => onPlay(t)} />
          ))}
        </div>
      </div>
    </section>
  );
}
