interface Props {
  currentTime: number;
  duration: number;
  onSeek: (time: number) => void;
}

function fmt(s: number) {
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${sec.toString().padStart(2, "0")}`;
}

export function ProgressBar({ currentTime, duration, onSeek }: Props) {
  const pct = duration > 0 ? (currentTime / duration) * 100 : 0;

  return (
    <div className="w-full px-2">
      <div
        className="relative w-full h-2 rounded-full bg-secondary cursor-pointer group"
        onClick={(e) => {
          const rect = e.currentTarget.getBoundingClientRect();
          const x = (e.clientX - rect.left) / rect.width;
          onSeek(x * duration);
        }}
      >
        <div
          className="absolute inset-y-0 left-0 rounded-full bg-primary neon-glow transition-all"
          style={{ width: `${pct}%` }}
        />
        <div
          className="absolute top-1/2 -translate-y-1/2 w-4 h-4 rounded-full bg-primary neon-glow opacity-0 group-hover:opacity-100 transition-opacity"
          style={{ left: `${pct}%`, transform: `translateX(-50%) translateY(-50%)` }}
        />
      </div>
      <div className="flex justify-between mt-1 text-xs text-muted-foreground font-body">
        <span>{fmt(currentTime)}</span>
        <span>{fmt(duration)}</span>
      </div>
    </div>
  );
}
