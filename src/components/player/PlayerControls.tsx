import { Play, Pause, SkipBack, SkipForward, Shuffle, Repeat, Repeat1 } from "lucide-react";

interface Props {
  isPlaying: boolean;
  shuffle: boolean;
  repeat: "off" | "all" | "one";
  onTogglePlay: () => void;
  onNext: () => void;
  onPrev: () => void;
  onShuffle: () => void;
  onRepeat: () => void;
}

export function PlayerControls({ isPlaying, shuffle, repeat, onTogglePlay, onNext, onPrev, onShuffle, onRepeat }: Props) {
  return (
    <div className="flex items-center justify-center gap-6">
      <button onClick={onShuffle} className={`transition-colors ${shuffle ? "text-primary" : "text-muted-foreground hover:text-foreground"}`}>
        <Shuffle size={20} />
      </button>
      <button onClick={onPrev} className="text-foreground hover:text-primary transition-colors">
        <SkipBack size={24} fill="currentColor" />
      </button>
      <button
        onClick={onTogglePlay}
        className="w-16 h-16 rounded-full flex items-center justify-center bg-primary text-primary-foreground neon-glow hover:scale-105 transition-transform"
      >
        {isPlaying ? <Pause size={28} fill="currentColor" /> : <Play size={28} fill="currentColor" className="ml-1" />}
      </button>
      <button onClick={onNext} className="text-foreground hover:text-primary transition-colors">
        <SkipForward size={24} fill="currentColor" />
      </button>
      <button onClick={onRepeat} className={`transition-colors ${repeat !== "off" ? "text-primary" : "text-muted-foreground hover:text-foreground"}`}>
        {repeat === "one" ? <Repeat1 size={20} /> : <Repeat size={20} />}
      </button>
    </div>
  );
}
