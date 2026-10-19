import { Volume1, Volume2, VolumeX } from "lucide-react";
import { Scrubber } from "@/components/player/Scrubber";
import { useMusicPlayerContext } from "@/contexts/MusicPlayerContext";

/** Mute toggle plus a volume slider. */
export function VolumeControl({ className = "" }: { className?: string }) {
  const { volume, muted, setVolume, toggleMute } = useMusicPlayerContext();
  const level = muted ? 0 : volume;
  const Icon = level === 0 ? VolumeX : level < 0.5 ? Volume1 : Volume2;

  return (
    <div className={`flex items-center gap-1 ${className}`}>
      <button
        onClick={toggleMute}
        aria-label={muted || volume === 0 ? "Unmute" : "Mute"}
        aria-pressed={muted}
        className={`w-11 h-11 shrink-0 rounded-full flex items-center justify-center transition-colors ${
          muted || volume === 0 ? "text-primary" : "text-muted-foreground hover:text-foreground"
        }`}
      >
        <Icon size={20} />
      </button>
      <Scrubber
        className="flex-1 min-w-24"
        value={level}
        live
        onCommit={setVolume}
        label="Volume"
        valueText={`${Math.round(level * 100)} percent${muted ? ", muted" : ""}`}
        keyStep={0.05}
      />
    </div>
  );
}
