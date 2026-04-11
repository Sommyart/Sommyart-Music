import { useState, useEffect, useCallback } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

interface Ad {
  id: string;
  title: string;
  subtitle: string;
  gradient: string;
  accent: string;
}

const ads: Ad[] = [
  {
    id: "1",
    title: "New Drops Every Week",
    subtitle: "Stay tuned for fresh beats & exclusive releases",
    gradient: "from-primary/20 via-primary/5 to-transparent",
    accent: "primary",
  },
  {
    id: "2",
    title: "Download & Play Offline",
    subtitle: "Take your music anywhere — no internet needed",
    gradient: "from-accent/20 via-accent/5 to-transparent",
    accent: "accent",
  },
  {
    id: "3",
    title: "Kosher Music Collection",
    subtitle: "Sacred sounds for your spiritual journey",
    gradient: "from-neon-cyan/20 via-neon-cyan/5 to-transparent",
    accent: "primary",
  },
];

export function AdBanner() {
  const [current, setCurrent] = useState(0);

  const next = useCallback(() => setCurrent((c) => (c + 1) % ads.length), []);
  const prev = useCallback(() => setCurrent((c) => (c - 1 + ads.length) % ads.length), []);

  useEffect(() => {
    const timer = setInterval(next, 5000);
    return () => clearInterval(timer);
  }, [next]);

  const ad = ads[current];

  return (
    <div className="px-4 pt-2 pb-1">
      <div className={`relative overflow-hidden rounded-2xl border border-border/30 bg-gradient-to-r ${ad.gradient} backdrop-blur-sm`}>
        {/* Content */}
        <div className="relative flex items-center justify-between px-5 py-4">
          <div className="flex-1 min-w-0">
            <p className="text-[10px] font-display tracking-[0.3em] text-muted-foreground uppercase mb-1">
              ✦ Featured
            </p>
            <h3 className="text-sm font-display font-bold tracking-wide text-foreground truncate">
              {ad.title}
            </h3>
            <p className="text-xs text-muted-foreground mt-0.5 truncate">
              {ad.subtitle}
            </p>
          </div>

          {/* Nav arrows */}
          <div className="flex items-center gap-1 ml-3 shrink-0">
            <button onClick={prev} className="p-1 rounded-full hover:bg-secondary/50 text-muted-foreground hover:text-foreground transition-colors">
              <ChevronLeft size={14} />
            </button>
            <button onClick={next} className="p-1 rounded-full hover:bg-secondary/50 text-muted-foreground hover:text-foreground transition-colors">
              <ChevronRight size={14} />
            </button>
          </div>
        </div>

        {/* Dots */}
        <div className="flex justify-center gap-1.5 pb-2.5">
          {ads.map((_, i) => (
            <button
              key={i}
              onClick={() => setCurrent(i)}
              className={`h-1 rounded-full transition-all duration-300 ${i === current ? "w-4 bg-primary" : "w-1.5 bg-muted-foreground/30"}`}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
