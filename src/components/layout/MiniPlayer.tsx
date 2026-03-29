import { Play, Pause, SkipBack, SkipForward } from "lucide-react";
import { Track } from "@/lib/tracks";
import { useNavigate, useLocation } from "react-router-dom";
import { useState } from "react";

interface Props {
  track: Track | null;
  isPlaying: boolean;
  onTogglePlay: () => void;
  onNext: () => void;
  onPrev: () => void;
}

export function MiniPlayer({ track, isPlaying, onTogglePlay, onNext, onPrev }: Props) {
  const navigate = useNavigate();
  const [expanding, setExpanding] = useState(false);

  if (!track) return null;

  const handleExpand = () => {
    setExpanding(true);
    setTimeout(() => {
      navigate("/player");
      setExpanding(false);
    }, 350);
  };

  return (
    <div
      className={`fixed bottom-16 left-0 right-0 z-40 glass-strong border-t border-border/30 cursor-pointer transition-all duration-[450ms] ease-[cubic-bezier(0.16,1,0.3,1)] ${
        expanding ? "opacity-0 translate-y-[-20px] scale-105" : "opacity-100"
      }`}
      onClick={handleExpand}
    >
      <div className="flex items-center gap-3 p-3 max-w-lg mx-auto">
        {/* Holographic thumbnail */}
        <div className="relative w-11 h-11 rounded-lg overflow-hidden flex-shrink-0">
          <div className="absolute inset-0 neon-glow rounded-lg" />
          <img
            src={track.coverUrl}
            alt={track.title}
            className={`w-full h-full object-cover rounded-lg transition-all duration-700 ${
              isPlaying ? "animate-float" : ""
            }`}
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

        <div className="flex items-center gap-1">
          <button
            onClick={(e) => { e.stopPropagation(); onPrev(); }}
            className="w-8 h-8 rounded-full flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors active:scale-95"
          >
            <SkipBack size={16} fill="currentColor" />
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); onTogglePlay(); }}
            className="w-10 h-10 rounded-full flex items-center justify-center bg-primary text-primary-foreground neon-glow transition-all duration-300 hover:scale-105 active:scale-95"
          >
            {isPlaying ? <Pause size={18} fill="currentColor" /> : <Play size={18} fill="currentColor" className="ml-0.5" />}
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); onNext(); }}
            className="w-8 h-8 rounded-full flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors active:scale-95"
          >
            <SkipForward size={16} fill="currentColor" />
          </button>
        </div>
      </div>
    </div>
  );
}
