import { useState, useEffect, useCallback } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

interface Ad {
  id: string;
  image: string;
}

const ads: Ad[] = [
  {
    id: "1",
    image: "/images/ad-banner-1.png",
  },
  {
    id: "2",
    image: "/images/ad-banner-2.png",
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
      <div className="relative overflow-hidden rounded-2xl border border-border/30">
        {/* Image */}
        <img
          src={ad.image}
          alt="Sommyart Academy"
          className="w-full h-auto object-cover"
        />

        {/* Nav arrows overlay */}
        <div className="absolute inset-y-0 left-0 flex items-center pl-1">
          <button onClick={prev} className="p-1 rounded-full bg-background/40 backdrop-blur-sm text-foreground hover:bg-background/60 transition-colors">
            <ChevronLeft size={16} />
          </button>
        </div>
        <div className="absolute inset-y-0 right-0 flex items-center pr-1">
          <button onClick={next} className="p-1 rounded-full bg-background/40 backdrop-blur-sm text-foreground hover:bg-background/60 transition-colors">
            <ChevronRight size={16} />
          </button>
        </div>

        {/* Dots */}
        <div className="absolute bottom-2 left-0 right-0 flex justify-center gap-1.5">
          {ads.map((_, i) => (
            <button
              key={i}
              onClick={() => setCurrent(i)}
              className={`h-1.5 rounded-full transition-all duration-300 ${i === current ? "w-5 bg-primary" : "w-1.5 bg-foreground/40"}`}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
