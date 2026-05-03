import { useEffect, useMemo, useRef } from "react";
import { LyricLine } from "@/lib/tracks";
import { cn } from "@/lib/utils";

interface Props {
  lyrics: LyricLine[];
  currentTime: number;
}

/**
 * Compact karaoke-style lyrics ticker that lives between the artist
 * name and the progress bar on the maximised player. Auto-scrolls
 * vertically in perfect sync with the audio: previous line dims out,
 * the active line glows and centers, the next line waits below.
 */
export function InlineLyricsTicker({ lyrics, currentTime }: Props) {
  const trackRef = useRef<HTMLDivElement>(null);

  const sorted = useMemo(
    () =>
      [...lyrics]
        .filter((l) => l && typeof l.t === "number" && l.text)
        .sort((a, b) => a.t - b.t),
    [lyrics]
  );

  const activeIndex = useMemo(() => {
    if (!sorted.length) return -1;
    let idx = -1;
    for (let i = 0; i < sorted.length; i++) {
      if (currentTime + 0.05 >= sorted[i].t) idx = i;
      else break;
    }
    return idx;
  }, [sorted, currentTime]);

  // Smoothly translate the strip so the active line centers.
  useEffect(() => {
    const el = trackRef.current;
    if (!el) return;
    const active = el.querySelector<HTMLElement>(`[data-i="${activeIndex}"]`);
    if (!active) return;
    const offset = active.offsetTop + active.offsetHeight / 2;
    el.style.transform = `translateY(calc(50% - ${offset}px))`;
  }, [activeIndex, sorted.length]);

  if (!sorted.length) return null;

  return (
    <div
      className="relative w-full h-24 overflow-hidden"
      style={{
        maskImage:
          "linear-gradient(to bottom, transparent 0%, black 30%, black 70%, transparent 100%)",
        WebkitMaskImage:
          "linear-gradient(to bottom, transparent 0%, black 30%, black 70%, transparent 100%)",
      }}
    >
      <div
        ref={trackRef}
        className="absolute inset-x-0 top-1/2 transition-transform duration-500 ease-out will-change-transform"
      >
        {sorted.map((line, i) => {
          const isActive = i === activeIndex;
          const distance = Math.abs(i - activeIndex);
          return (
            <p
              key={i}
              data-i={i}
              className={cn(
                "px-4 text-center font-display tracking-wide leading-snug py-1 transition-all duration-500",
                isActive
                  ? "text-primary text-base neon-text scale-105"
                  : distance === 1
                  ? "text-foreground/55 text-sm"
                  : "text-foreground/25 text-xs"
              )}
            >
              {line.text}
            </p>
          );
        })}
      </div>
    </div>
  );
}
