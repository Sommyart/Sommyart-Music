import { Volume1, Volume2, VolumeX } from "lucide-react";
import { Scrubber } from "@/components/player/Scrubber";
import { useMusicPlayerContext } from "@/contexts/MusicPlayerContext";

/**
 * Mute toggle plus one volume slider that goes from 0% to 200%.
 * The first half is the normal volume. The tick in the middle is 100%, the phone's own maximum;
 * past it the sound is boosted (louder than the phone alone can play it).
 */
export function VolumeControl({ className = "" }: { className?: string }) {
  const { volume, muted, setVolume, toggleMute, boost, boostIssue, setBoost } = useMusicPlayerContext();
  // 0 to 2. Only a full volume can carry a boost (a volume set from another device drops it).
  const level = muted ? 0 : volume >= 0.999 ? boost : volume;
  const Icon = level === 0 ? VolumeX : level < 0.5 ? Volume1 : Volume2;
  const pct = Math.round(level * 100);
  const boosted = level > 1;

  const onLevel = (v: number) => {
    let l = Math.min(2, Math.max(0, v * 2));
    if (Math.abs(l - 1) < 0.04) l = 1; // easy to land on exactly 100%
    if (l > 1) {
      setVolume(1);
      setBoost(l);
    } else {
      setVolume(l);
      setBoost(1);
    }
  };

  return (
    <div className={className}>
      <div className="flex items-center gap-1">
        <button
          onClick={toggleMute}
          aria-label={muted || volume === 0 ? "Unmute" : "Mute"}
          aria-pressed={muted}
          className={`w-11 h-11 shrink-0 rounded-full flex items-center justify-center transition-colors ${
            muted || volume === 0 ? "text-primary" : boosted ? "text-amber-400" : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <Icon size={20} />
        </button>
        <Scrubber
          className="flex-1 min-w-24"
          value={level / 2}
          live
          onCommit={onLevel}
          label="Volume"
          valueText={`${pct} percent${boosted ? ", boosted" : ""}${muted ? ", muted" : ""}`}
          keyStep={0.025}
          marker={0.5}
        />
        <span className={`w-11 shrink-0 text-right text-[11px] tabular-nums font-display ${boosted ? "text-amber-400" : "text-muted-foreground"}`}>
          {pct}%
        </span>
      </div>
      {boostIssue ? (
        <p className="pl-12 text-[11px] text-destructive">{boostIssue}</p>
      ) : (
        boosted && (
          <p className="pl-12 text-[11px] text-muted-foreground">
            Boosted past the phone's maximum. Keep it low with headphones to protect your hearing.
          </p>
        )
      )}
    </div>
  );
}
