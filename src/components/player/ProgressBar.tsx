import { useState } from "react";
import { Scrubber } from "@/components/player/Scrubber";
import { formatTime } from "@/lib/playback";

interface Props {
  currentTime: number;
  duration: number;
  onSeek: (time: number) => void;
}

/** Seekable progress bar: drag or tap to jump, arrow keys skip 5 seconds. */
export function ProgressBar({ currentTime, duration, onSeek }: Props) {
  const valid = isFinite(duration) && duration > 0;
  const [preview, setPreview] = useState<number | null>(null);
  const shownTime = preview !== null && valid ? preview * duration : currentTime;

  return (
    <div className="w-full">
      <Scrubber
        value={valid ? currentTime / duration : 0}
        onPreview={setPreview}
        onCommit={(v) => valid && onSeek(v * duration)}
        label="Seek"
        valueText={valid ? `${formatTime(shownTime)} of ${formatTime(duration)}` : undefined}
        keyStep={valid ? 5 / duration : 0.02}
        disabled={!valid}
      />
      <div className="flex justify-between -mt-1 text-xs text-muted-foreground font-body tabular-nums">
        <span aria-hidden="true">{formatTime(shownTime)}</span>
        <span aria-hidden="true">{valid ? formatTime(duration) : "0:00"}</span>
      </div>
    </div>
  );
}
