import { Play, Pause, SkipBack, SkipForward } from "lucide-react";
import { Track } from "@/lib/tracks";
import { useNavigate, useLocation } from "react-router-dom";
import { useState } from "react";
import { useMusicPlayerContext } from "@/contexts/MusicPlayerContext";

interface Props {
  track: Track | null;
  isPlaying: boolean;
  onTogglePlay: () => void;
  onNext: () => void;
  onPrev: () => void;
}

const btn = "w-11 h-11 rounded-full flex items-center justify-center transition-colors active:scale-95";

export function MiniPlayer({ track, isPlaying, onTogglePlay, onNext, onPrev }: Props) {
  const navigate = useNavigate();
  const location = useLocation();
  const { currentTime, duration } = useMusicPlayerContext();
  const [expanding, setExpanding] = useState(false);

  if (!track || location.pathname === "/player") return null;

  const progress = duration > 0 && isFinite(duration) ? Math.min(1, currentTime / duration) : 0;

  const handleExpand = () => {
    if (expanding) return;
    setExpanding(true);
    setTimeout(() => {
      navigate("/player");
      setExpanding(false);
    }, 300);
  };

  const stop = (fn: () => void) => (e: React.SyntheticEvent) => {
    e.stopPropagation();
    fn();
  };

  return (
    <div
      role="button"
      tabIndex={0}
      aria-label={`Now playing ${track.title} by ${track.artist}. Open full player`}
      className={`fixed bottom-16 left-0 right-0 z-40 glass-strong border-t border-border/30 cursor-pointer transition-all duration-[450ms] ease-[cubic-bezier(0.16,1,0.3,1)] animate-in slide-in-from-bottom-4 fade-in focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${
        expanding ? "opacity-0 -translate-y-5 scale-105" : "opacity-100"
      }`}
      onClick={handleExpand}
      onKeyDown={(e) => {
        if (e.target !== e.currentTarget) return;
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          handleExpand();
        }
      }}
    >
      {/* Thin progress strip */}
      <div className="absolute top-0 left-0 right-0 h-0.5 bg-border/30" aria-hidden="true">
        <div className="h-full bg-primary" style={{ width: `${progress * 100}%`, boxShadow: "0 0 6px hsl(var(--primary) / 0.8)" }} />
      </div>

      <div className="flex items-center gap-3 px-3 py-2 max-w-lg mx-auto">
        <div className="relative w-11 h-11 rounded-lg overflow-hidden flex-shrink-0">
          <div className="absolute inset-0 neon-glow rounded-lg" />
          <img
            src={track.coverUrl}
            alt=""
            className={`w-full h-full object-cover rounded-lg transition-all duration-700 ${isPlaying ? "animate-float" : ""}`}
            style={{
              filter: isPlaying
                ? "drop-shadow(0 0 6px hsla(186, 100%, 50%, 0.5))"
                : "drop-shadow(0 0 3px hsla(186, 100%, 50%, 0.25))",
            }}
          />
          <div className="absolute inset-0 holographic-shimmer rounded-lg opacity-40" />
        </div>

        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium truncate text-foreground">{track.title}</p>
          <p className="text-xs text-muted-foreground truncate">{track.artist}</p>
        </div>

        <div className="flex items-center">
          <button onClick={stop(onPrev)} aria-label="Previous song" className={`${btn} text-muted-foreground hover:text-foreground`}>
            <SkipBack size={18} fill="currentColor" />
          </button>
          <button
            onClick={stop(onTogglePlay)}
            aria-label={isPlaying ? "Pause" : "Play"}
            className={`${btn} bg-primary text-primary-foreground neon-glow hover:scale-105`}
          >
            {isPlaying ? <Pause size={20} fill="currentColor" /> : <Play size={20} fill="currentColor" className="ml-0.5" />}
          </button>
          <button onClick={stop(onNext)} aria-label="Next song" className={`${btn} text-muted-foreground hover:text-foreground`}>
            <SkipForward size={18} fill="currentColor" />
          </button>
        </div>
      </div>
    </div>
  );
}
