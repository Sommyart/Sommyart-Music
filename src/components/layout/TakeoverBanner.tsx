import { Cast, Volume2, Bluetooth } from "lucide-react";
import { useMusicPlayerContext } from "@/contexts/MusicPlayerContext";
import { cn } from "@/lib/utils";

/**
 * Sticky banner shown on every screen when playback is happening on
 * another signed-in device. Tap "Take Over" to move playback here.
 */
export function TakeoverBanner() {
  const { isThisDeviceActive, activeDevice, thisDevice, takeOver, currentTrack, activeTrack } =
    useMusicPlayerContext();
  const shown = activeTrack ?? currentTrack;

  if (isThisDeviceActive || !activeDevice || activeDevice.id === thisDevice?.id) {
    return null;
  }

  const label = activeDevice.output_label || "";
  const Icon = /bluetooth|airpods|buds|headset|wireless/i.test(label) ? Bluetooth : Volume2;

  return (
    <div
      className={cn(
        "fixed top-0 inset-x-0 z-50 mx-auto max-w-md",
        "px-3 pt-[max(env(safe-area-inset-top),0.5rem)]",
      )}
    >
      <div className="rounded-b-xl border border-amber-400/40 bg-amber-400/10 backdrop-blur-md shadow-lg px-3 py-2 flex items-center gap-3">
        <div className="w-8 h-8 rounded-lg bg-amber-400/20 text-amber-300 flex items-center justify-center shrink-0">
          <Icon size={16} />
        </div>
        <div className="flex-1 min-w-0 leading-tight">
          <p className="text-[11px] uppercase tracking-widest text-amber-300/80">
            Listening on
          </p>
          <p className="text-sm text-foreground truncate">
            {activeDevice.name}
            {shown && (
              <span className="text-muted-foreground"> · {shown.title}</span>
            )}
          </p>
        </div>
        <button
          onClick={takeOver}
          className="shrink-0 text-xs font-display tracking-widest px-3 py-1.5 rounded-full bg-primary text-primary-foreground hover:bg-primary/90 transition-colors flex items-center gap-1"
        >
          <Cast size={12} />
          Take Over
        </button>
      </div>
    </div>
  );
}
