import { useState } from "react";
import { Check, Moon } from "lucide-react";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { useMusicPlayerContext } from "@/contexts/MusicPlayerContext";
import { toast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

const OPTIONS: { label: string; value: number | "track" }[] = [
  { label: "15 minutes", value: 15 },
  { label: "30 minutes", value: 30 },
  { label: "45 minutes", value: 45 },
  { label: "1 hour", value: 60 },
  { label: "End of this song", value: "track" },
];

const clock = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;

/** Moon button that opens the sleep timer choices and shows the time left. */
export function SleepTimerSheet({ className = "" }: { className?: string }) {
  const { sleepTimer, sleepRemaining, setSleepTimer } = useMusicPlayerContext();
  const [open, setOpen] = useState(false);
  const active = !!sleepTimer;
  const badge = sleepTimer?.kind === "track" ? "END" : sleepRemaining != null ? clock(sleepRemaining) : null;

  const choose = (value: number | "track" | null, label?: string) => {
    setSleepTimer(value);
    setOpen(false);
    toast({
      title: value === null ? "Sleep timer off" : `Sleep timer: ${label}`,
      description: value === null ? undefined : "Playback will fade out and stop.",
    });
  };

  const isCurrent = (v: number | "track") =>
    v === "track" ? sleepTimer?.kind === "track" : false;

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <button
          aria-label={active ? `Sleep timer on${badge ? `, ${badge} left` : ""}` : "Sleep timer"}
          className={cn(
            "relative min-w-11 h-11 px-2 rounded-full flex items-center justify-center gap-1 transition-colors",
            active ? "text-primary bg-primary/10" : "text-muted-foreground hover:text-foreground",
            className,
          )}
        >
          <Moon size={20} />
          {badge && <span className="text-[10px] font-display tabular-nums">{badge}</span>}
        </button>
      </SheetTrigger>
      <SheetContent side="bottom" className="rounded-t-2xl">
        <SheetHeader>
          <SheetTitle className="font-display tracking-widest text-primary text-sm">SLEEP TIMER</SheetTitle>
          <SheetDescription>Music fades out and stops by itself.</SheetDescription>
        </SheetHeader>
        <ul className="mt-4 space-y-1 pb-4">
          {OPTIONS.map((o) => (
            <li key={o.label}>
              <button
                onClick={() => choose(o.value, o.label)}
                className="w-full min-h-12 flex items-center justify-between rounded-xl px-4 text-left hover:bg-secondary/50"
              >
                <span>{o.label}</span>
                {isCurrent(o.value) && <Check size={16} className="text-primary" />}
              </button>
            </li>
          ))}
          {active && (
            <li>
              <button onClick={() => choose(null)} className="w-full min-h-12 rounded-xl px-4 text-left text-destructive hover:bg-destructive/10">
                Turn off timer{sleepRemaining != null ? ` (${clock(sleepRemaining)} left)` : ""}
              </button>
            </li>
          )}
        </ul>
      </SheetContent>
    </Sheet>
  );
}
