import { Play, Pause } from "lucide-react";
import { Track } from "@/lib/tracks";
import { useNavigate } from "react-router-dom";

interface Props {
  track: Track | null;
  isPlaying: boolean;
  onTogglePlay: () => void;
}

export function MiniPlayer({ track, isPlaying, onTogglePlay }: Props) {
  const navigate = useNavigate();
  if (!track) return null;

  return (
    <div
      className="fixed bottom-16 left-0 right-0 z-40 glass-strong border-t border-border/30 cursor-pointer"
      onClick={() => navigate("/player")}
    >
      <div className="flex items-center gap-3 p-3 max-w-lg mx-auto">
        <div className="w-10 h-10 rounded-lg overflow-hidden flex-shrink-0 neon-glow">
          <img src={track.coverUrl} alt={track.title} className="w-full h-full object-cover" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium truncate text-foreground">{track.title}</p>
          <p className="text-xs text-muted-foreground truncate">{track.artist}</p>
        </div>
        <button
          onClick={(e) => { e.stopPropagation(); onTogglePlay(); }}
          className="w-10 h-10 rounded-full flex items-center justify-center bg-primary text-primary-foreground neon-glow"
        >
          {isPlaying ? <Pause size={18} fill="currentColor" /> : <Play size={18} fill="currentColor" className="ml-0.5" />}
        </button>
      </div>
    </div>
  );
}
