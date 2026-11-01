import { KeyboardEvent, PointerEvent, useRef, useState } from "react";
import { cn } from "@/lib/utils";

interface Props {
  /** 0 to 1 */
  value: number;
  /** Called with 0 to 1. With `live` it fires on every move, otherwise once on release. */
  onCommit: (v: number) => void;
  /** Called while dragging so the caller can show a preview (for example the time). */
  onPreview?: (v: number | null) => void;
  live?: boolean;
  label: string;
  valueText?: string;
  /** Arrow key step as a fraction of the full range. */
  keyStep?: number;
  disabled?: boolean;
  /** Optional tick mark on the track, 0 to 1 (for example where "100%" sits on a boost slider). */
  marker?: number;
  className?: string;
}

/**
 * Touch, mouse and keyboard friendly slider used for the seek bar and the volume.
 * Drag anywhere on it, arrow keys nudge it, and screen readers hear a real slider.
 */
export function Scrubber({ value, onCommit, onPreview, live, label, valueText, keyStep = 0.05, disabled, marker, className }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const [drag, setDrag] = useState<number | null>(null);
  const shown = drag ?? Math.min(1, Math.max(0, value || 0));

  const fromX = (x: number) => {
    const r = ref.current!.getBoundingClientRect();
    return r.width ? Math.min(1, Math.max(0, (x - r.left) / r.width)) : 0;
  };

  const down = (e: PointerEvent<HTMLDivElement>) => {
    if (disabled) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    const v = fromX(e.clientX);
    setDrag(v);
    onPreview?.(v);
    if (live) onCommit(v);
  };
  const move = (e: PointerEvent<HTMLDivElement>) => {
    if (drag === null) return;
    const v = fromX(e.clientX);
    setDrag(v);
    onPreview?.(v);
    if (live) onCommit(v);
  };
  const up = (e: PointerEvent<HTMLDivElement>) => {
    if (drag === null) return;
    const v = fromX(e.clientX);
    setDrag(null);
    onPreview?.(null);
    onCommit(v);
  };
  const cancel = () => {
    setDrag(null);
    onPreview?.(null);
  };

  const key = (e: KeyboardEvent<HTMLDivElement>) => {
    if (disabled) return;
    const step = keyStep;
    let next: number | null = null;
    if (e.key === "ArrowRight" || e.key === "ArrowUp") next = shown + step;
    else if (e.key === "ArrowLeft" || e.key === "ArrowDown") next = shown - step;
    else if (e.key === "PageUp") next = shown + step * 3;
    else if (e.key === "PageDown") next = shown - step * 3;
    else if (e.key === "Home") next = 0;
    else if (e.key === "End") next = 1;
    if (next === null) return;
    e.preventDefault();
    onCommit(Math.min(1, Math.max(0, next)));
  };

  return (
    <div
      ref={ref}
      role="slider"
      tabIndex={disabled ? -1 : 0}
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(shown * 100)}
      aria-valuetext={valueText}
      aria-disabled={disabled}
      onPointerDown={down}
      onPointerMove={move}
      onPointerUp={up}
      onPointerCancel={cancel}
      onKeyDown={key}
      className={cn(
        "group relative h-9 flex items-center touch-none select-none cursor-pointer outline-none",
        "focus-visible:ring-2 focus-visible:ring-primary/60 rounded-full",
        disabled && "opacity-40 cursor-not-allowed",
        className,
      )}
    >
      <div className={cn("relative w-full rounded-full bg-secondary transition-[height] duration-150", drag !== null ? "h-2" : "h-1.5 group-hover:h-2")}>
        <div className="absolute inset-y-0 left-0 rounded-full bg-primary neon-glow" style={{ width: `${shown * 100}%` }} />
        {marker != null && (
          <div className="absolute top-1/2 w-0.5 h-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-foreground/60" style={{ left: `${marker * 100}%` }} aria-hidden="true" />
        )}
        <div
          className={cn(
            "absolute top-1/2 w-4 h-4 rounded-full bg-primary neon-glow transition-transform duration-150",
            drag !== null ? "scale-125" : "scale-100",
          )}
          style={{ left: `${shown * 100}%`, transform: `translate(-50%, -50%) scale(${drag !== null ? 1.25 : 1})` }}
        />
      </div>
    </div>
  );
}
