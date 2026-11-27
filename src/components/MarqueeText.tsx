import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

/**
 * Shows text on one line. If it is too long to fit, it scrolls slowly from right to left
 * (like the announcement strip) instead of being cut off with "…".
 * Pass active={false} to keep it still (it then truncates as before).
 */
export function MarqueeText({ text, className, active = true }: { text: string; className?: string; active?: boolean }) {
  const box = useRef<HTMLSpanElement>(null);
  const measure = useRef<HTMLSpanElement>(null);
  const [overflow, setOverflow] = useState(false);

  useLayoutEffect(() => {
    const check = () => {
      if (box.current && measure.current) setOverflow(measure.current.scrollWidth > box.current.clientWidth + 2);
    };
    check();
    const ro = typeof ResizeObserver !== "undefined" ? new ResizeObserver(check) : null;
    if (ro && box.current) ro.observe(box.current);
    return () => ro?.disconnect();
  }, [text]);

  // Fonts can load after the first measure.
  useEffect(() => {
    const t = setTimeout(() => {
      if (box.current && measure.current) setOverflow(measure.current.scrollWidth > box.current.clientWidth + 2);
    }, 500);
    return () => clearTimeout(t);
  }, [text]);

  const scrolling = active && overflow;
  // About 30 characters per 10 seconds keeps it readable.
  const seconds = Math.max(8, Math.round(text.length / 3));

  return (
    <span ref={box} className={cn("relative block overflow-hidden whitespace-nowrap", scrolling && "ticker-mask", className)} title={text}>
      {/* Hidden copy used only to measure the full width. */}
      <span ref={measure} aria-hidden className="invisible absolute left-0 top-0 whitespace-nowrap">{text}</span>
      {scrolling ? (
        <>
          <span className="sr-only">{text}</span>
          <span aria-hidden className="ticker-track inline-flex w-max" style={{ animationDuration: `${seconds}s` }}>
            <span className="pr-10">{text}</span>
            <span className="pr-10">{text}</span>
          </span>
        </>
      ) : (
        <span className="block truncate">{text}</span>
      )}
    </span>
  );
}
