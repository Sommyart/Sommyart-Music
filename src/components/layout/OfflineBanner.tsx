import { WifiOff } from "lucide-react";
import { useOnline } from "@/hooks/useOnline";

/** A slim, tap-through note at the top of the screen while there is no internet. */
export function OfflineBanner() {
  const online = useOnline();
  if (online) return null;
  return (
    <div
      role="status"
      className="pointer-events-none fixed left-0 right-0 top-0 z-30 flex justify-center pt-[max(env(safe-area-inset-top),0.25rem)]"
    >
      <div className="flex items-center gap-1.5 rounded-full border border-border/50 bg-background/90 px-3 py-1 text-[11px] font-display tracking-wider text-muted-foreground backdrop-blur">
        <WifiOff size={12} />
        OFFLINE · YOUR DOWNLOADS PLAY AS NORMAL
      </div>
    </div>
  );
}
