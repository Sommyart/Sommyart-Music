import { useEffect, useMemo, useRef, useState } from "react";
import { LyricLine } from "@/lib/tracks";
import { cn } from "@/lib/utils";

interface Props {
  lyrics: LyricLine[];
  currentTime: number;
}

export function LyricsView({ lyrics, currentTime }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const lineRefs = useRef<(HTMLParagraphElement | null)[]>([]);

  const sorted = useMemo(
    () => [...lyrics].filter((l) => l && typeof l.t === "number").sort((a, b) => a.t - b.t),
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

  const [autoScroll, setAutoScroll] = useState(true);

  useEffect(() => {
    if (!autoScroll) return;
    const el = lineRefs.current[activeIndex];
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }, [activeIndex, autoScroll]);

  if (!sorted.length) return null;

  return (
    <div
      ref={containerRef}
      onWheel={() => setAutoScroll(false)}
      onTouchMove={() => setAutoScroll(false)}
      onClick={() => setAutoScroll(true)}
      className="relative h-full w-full overflow-y-auto px-6 py-24 scrollbar-none"
      style={{
        maskImage:
          "linear-gradient(to bottom, transparent 0%, black 18%, black 82%, transparent 100%)",
        WebkitMaskImage:
          "linear-gradient(to bottom, transparent 0%, black 18%, black 82%, transparent 100%)",
      }}
    >
      <div className="flex flex-col items-center gap-5 text-center">
        {sorted.map((line, i) => {
          const isActive = i === activeIndex;
          const distance = Math.abs(i - activeIndex);
          return (
            <p
              key={i}
              ref={(el) => (lineRefs.current[i] = el)}
              className={cn(
                "transition-all duration-500 font-display tracking-wide leading-snug",
                isActive
                  ? "text-primary text-xl neon-text scale-105"
                  : distance === 1
                  ? "text-foreground/70 text-base"
                  : distance === 2
                  ? "text-foreground/40 text-sm"
                  : "text-foreground/25 text-sm"
              )}
            >
              {line.text || "♪"}
            </p>
          );
        })}
      </div>
    </div>
  );
}
