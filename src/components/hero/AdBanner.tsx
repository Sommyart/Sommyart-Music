import { useEffect, useMemo, useRef, useState } from "react";
import Autoplay from "embla-carousel-autoplay";
import { Play, Sparkles } from "lucide-react";
import { Track } from "@/lib/tracks";
import { extractCoverArt } from "@/lib/extractCoverArt";
import {
  Carousel,
  CarouselContent,
  CarouselItem,
} from "@/components/ui/carousel";

interface Props {
  tracks: Track[];
  onPlay: (track: Track) => void;
}

function PromoSlide({ track, onPlay }: { track: Track; onPlay: () => void }) {
  const [cover, setCover] = useState<string | null>(null);

  useEffect(() => {
    extractCoverArt(track.audioUrl).then((c) => c && setCover(c));
  }, [track.audioUrl]);

  return (
    <button
      onClick={onPlay}
      className="group relative w-full text-left focus:outline-none"
    >
      <div className="relative w-full h-40 rounded-xl overflow-hidden neon-border bg-secondary/40">
        <img
          src={cover || track.coverUrl}
          alt={track.title}
          className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
          loading="lazy"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-background/90 via-background/30 to-transparent" />
        <div className="absolute inset-0 holographic-shimmer opacity-30" />

        <div className="absolute bottom-3 left-3 right-14">
          <p className="text-sm font-display tracking-wide text-foreground line-clamp-1">
            {track.title}
          </p>
          {track.genre && (
            <p className="text-[10px] text-primary/90 mt-0.5 uppercase tracking-widest">
              {track.genre}
            </p>
          )}
        </div>

        <div className="absolute bottom-3 right-3 w-10 h-10 rounded-full bg-primary/90 flex items-center justify-center neon-glow group-hover:scale-110 transition-transform">
          <Play size={16} className="text-primary-foreground ml-0.5" fill="currentColor" />
        </div>
      </div>
    </button>
  );
}

export function AdBanner({ tracks, onPlay }: Props) {
  const autoplay = useRef(
    Autoplay({ delay: 3500, stopOnInteraction: false, stopOnMouseEnter: true })
  );

  // Pick 3 tracks, deterministically rotated once per day so every user
  // sees the same fresh suggestions each calendar day.
  const picks = useMemo(() => {
    if (!tracks || tracks.length === 0) return [];

    // Daily seed: YYYYMMDD as integer
    const now = new Date();
    const seed =
      now.getFullYear() * 10000 +
      (now.getMonth() + 1) * 100 +
      now.getDate();

    // Mulberry32 — small, fast, deterministic PRNG
    let s = seed >>> 0;
    const rand = () => {
      s = (s + 0x6d2b79f5) >>> 0;
      let t = s;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };

    // Seeded Fisher–Yates shuffle
    const arr = [...tracks];
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(rand() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr.slice(0, 3);
  }, [tracks]);

  if (picks.length === 0) return null;

  // Show "Happy New Week" greeting on Mondays (WAT).
  const showGreetings = new Date().getDay() === 1;

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

        <Carousel
          opts={{ loop: true, align: "start" }}
          plugins={[autoplay.current]}
          className="relative"
        >
          <CarouselContent className="-ml-2">
            {showGreetings && (
              <CarouselItem key="greet-new-week" className="pl-2 basis-full">
                <GreetingSlide
                  title="Happy New Week"
                  subtitle="✦ Tune in, level up ✦"
                  emoji="🌠"
                />
              </CarouselItem>
            )}
            {picks.map((t) => (
              <CarouselItem key={t.id} className="pl-2 basis-full">
                <PromoSlide track={t} onPlay={() => onPlay(t)} />
              </CarouselItem>
            ))}
          </CarouselContent>
        </Carousel>
      </div>
    </section>
  );
}

function GreetingSlide({
  title,
  subtitle,
  emoji,
}: {
  title: string;
  subtitle: string;
  emoji: string;
}) {
  return (
    <div className="relative w-full h-40 rounded-xl overflow-hidden neon-border flex items-center justify-center">
      <div
        className="absolute inset-0"
        style={{
          background:
            "linear-gradient(135deg, hsl(var(--neon-cyan) / 0.25), hsl(var(--accent) / 0.25))",
        }}
      />
      <div className="absolute inset-0 holographic-shimmer opacity-40" />
      <div className="absolute -top-8 -right-8 w-32 h-32 rounded-full blur-3xl opacity-40" style={{ background: "hsl(var(--neon-cyan))" }} />
      <div className="absolute -bottom-8 -left-8 w-32 h-32 rounded-full blur-3xl opacity-30" style={{ background: "hsl(var(--accent))" }} />

      <div className="relative z-10 flex flex-col items-center text-center px-4">
        <div className="text-3xl mb-1 animate-float">{emoji}</div>
        <h3 className="text-base font-display font-bold tracking-[0.2em] text-foreground neon-text uppercase">
          {title}
        </h3>
        <p className="text-[10px] text-primary/90 mt-1 tracking-[0.25em] uppercase">
          {subtitle}
        </p>
      </div>
    </div>
  );
}

