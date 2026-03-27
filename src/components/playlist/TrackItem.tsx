import { Play, Pause } from "lucide-react";
import { Track } from "@/lib/tracks";

interface Props {
  track: Track;
  index: number;
  isActive: boolean;
  isPlaying: boolean;
  onPlay: () => void;
}

export function TrackItem({ track, index, isActive, isPlaying, onPlay }: Props) {
  return (
    <button
      onClick={onPlay}
      className={`w-full flex items-center gap-4 p-3 rounded-xl transition-all ${
        isActive ? "glass neon-border" : "hover:bg-secondary/50"
      }`}
    >
      <div className={`w-10 h-10 rounded-lg overflow-hidden flex-shrink-0 ${isActive ? "neon-glow" : ""}`}>
        <img src={track.coverUrl} alt={track.title} className="w-full h-full object-cover" />
      </div>
      <div className="flex-1 text-left min-w-0">
        <p className={`text-sm font-medium truncate ${isActive ? "text-primary neon-text" : "text-foreground"}`}>
          {track.title}
        </p>
        <p className="text-xs text-muted-foreground truncate">{track.artist}</p>
      </div>
      <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${isActive ? "text-primary" : "text-muted-foreground"}`}>
        {isActive && isPlaying ? <Pause size={16} /> : <Play size={16} className="ml-0.5" />}
      </div>
    </button>
  );
}
