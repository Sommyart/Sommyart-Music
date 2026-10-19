import { Play, Pause, SkipBack, SkipForward, Shuffle, Repeat, Repeat1 } from "lucide-react";
import { cn } from "@/lib/utils";

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

const REPEAT_LABEL = { off: "Repeat off", all: "Repeat all", one: "Repeat one" } as const;

/** A mode button: clear on/off state through colour, glow and a dot, never colour alone. */
function ModeButton({ active, label, onClick, children }: { active: boolean; label: string; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      aria-label={label}
      aria-pressed={active}
      title={label}
      className={cn(
        "relative w-11 h-11 rounded-full flex items-center justify-center transition-all duration-200 active:scale-90",
        active ? "text-primary bg-primary/10 neon-glow" : "text-muted-foreground hover:text-foreground",
      )}
    >
      {children}
      <span className={cn("absolute bottom-1 w-1 h-1 rounded-full bg-primary transition-opacity", active ? "opacity-100" : "opacity-0")} />
    </button>
  );
}

export function PlayerControls({ isPlaying, shuffle, repeat, onTogglePlay, onNext, onPrev, onShuffle, onRepeat }: Props) {
  const status = [shuffle ? "Shuffle on" : null, repeat !== "off" ? REPEAT_LABEL[repeat] : null].filter(Boolean).join(" · ");

  return (
    <div>
      <div className="flex items-center justify-center gap-3 sm:gap-5">
        <ModeButton active={shuffle} label={shuffle ? "Shuffle on" : "Shuffle off"} onClick={onShuffle}>
          <Shuffle size={20} />
        </ModeButton>
        <button
          onClick={onPrev}
          aria-label="Previous track"
          title="Previous (restarts the song if it has played for more than 3 seconds)"
          className="w-12 h-12 rounded-full flex items-center justify-center text-foreground hover:text-primary transition-all active:scale-90"
        >
          <SkipBack size={26} fill="currentColor" />
        </button>
        <button
          onClick={onTogglePlay}
          aria-label={isPlaying ? "Pause" : "Play"}
          className="w-16 h-16 rounded-full flex items-center justify-center bg-primary text-primary-foreground neon-glow hover:scale-105 active:scale-95 transition-transform duration-150"
        >
          {isPlaying ? <Pause size={28} fill="currentColor" /> : <Play size={28} fill="currentColor" className="ml-1" />}
        </button>
        <button
          onClick={onNext}
          aria-label="Next track"
          className="w-12 h-12 rounded-full flex items-center justify-center text-foreground hover:text-primary transition-all active:scale-90"
        >
          <SkipForward size={26} fill="currentColor" />
        </button>
        <ModeButton active={repeat !== "off"} label={`${REPEAT_LABEL[repeat]}. Tap to change.`} onClick={onRepeat}>
          {repeat === "one" ? <Repeat1 size={20} /> : <Repeat size={20} />}
        </ModeButton>
      </div>
      <p className="h-4 mt-1 text-center text-[10px] tracking-widest uppercase text-primary" aria-live="polite">
        {status}
      </p>
    </div>
  );
}
