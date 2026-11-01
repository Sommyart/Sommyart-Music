import { useState } from "react";
import { Volume1, Volume2, VolumeX, Zap } from "lucide-react";
import { Scrubber } from "@/components/player/Scrubber";
import { useMusicPlayerContext } from "@/contexts/MusicPlayerContext";

/**
 * Mute toggle plus a volume slider. The lightning button opens the volume boost (100% to 200%),
 * which makes the sound louder than the phone's own maximum.
 */
export function VolumeControl({ className = "" }: { className?: string }) {
  const { volume, muted, setVolume, toggleMute, boost, boostIssue, setBoost } = useMusicPlayerContext();
  const [boostOpen, setBoostOpen] = useState(false);
  const level = muted ? 0 : volume;
  const Icon = level === 0 ? VolumeX : level < 0.5 ? Volume1 : Volume2;
  const boosted = boost > 1;
  const pct = Math.round(boost * 100);

  return (
    <div className={className}>
    <div className="flex items-center gap-1">
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
      <button
        onClick={() => setBoostOpen((o) => !o)}
        aria-label="Volume boost"
        aria-expanded={boostOpen}
        className={`h-11 min-w-11 shrink-0 rounded-full px-2 flex items-center justify-center gap-0.5 transition-colors ${
          boosted ? "text-primary" : "text-muted-foreground hover:text-foreground"
        }`}
      >
        <Zap size={18} />
        {boosted && <span className="text-[10px] font-display tabular-nums">{pct}%</span>}
      </button>
    </div>
    {boostOpen && (
      <div className="pl-12 pr-1 pb-1">
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-display tracking-wider text-muted-foreground shrink-0">BOOST</span>
          <Scrubber
            className="flex-1 min-w-24"
            value={boost - 1}
            live
            onCommit={(v) => setBoost(1 + v)}
            label="Volume boost level"
            valueText={`${pct} percent`}
            keyStep={0.05}
          />
          <span className="w-10 text-right text-xs tabular-nums font-display text-muted-foreground">{pct}%</span>
        </div>
        {boostIssue ? (
          <p className="text-[11px] text-destructive">{boostIssue}</p>
        ) : (
          <p className="text-[11px] text-muted-foreground">
            {boosted ? "Louder than the phone's maximum. Keep it low with headphones to protect your hearing." : "Slide right to go up to 200%."}
          </p>
        )}
      </div>
    )}
    </div>
  );
}
