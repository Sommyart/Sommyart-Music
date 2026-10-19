import { useCallback, useEffect, useState } from "react";
import { Bell, BellOff, BellRing } from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import {
  getNotifyMode,
  getNotifyPermission,
  hasAskedForPermission,
  markAskedForPermission,
  NotifyMode,
  NotifyPermission,
  requestNotifyPermission,
  setNotifyMode,
} from "@/lib/notify";
import { cn } from "@/lib/utils";

/** Asks once, politely, for permission to send new-song notifications (shown to signed-in listeners). */
export function NotificationPrompt() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    let timer: number | undefined;
    let cancelled = false;
    const maybeAsk = async () => {
      if (hasAskedForPermission()) return;
      if ((await getNotifyPermission()) !== "prompt") return;
      const { data } = await supabase.auth.getSession();
      if (!data.session || cancelled) return;
      timer = window.setTimeout(() => !cancelled && setOpen(true), 6000);
    };
    maybeAsk();
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_IN") maybeAsk();
    });
    return () => {
      cancelled = true;
      if (timer) window.clearTimeout(timer);
      sub.subscription.unsubscribe();
    };
  }, []);

  const enable = async () => {
    markAskedForPermission();
    setOpen(false);
    const result = await requestNotifyPermission();
    if (result === "granted") toast.success("Notifications are on", { description: "You will hear about new songs." });
  };
  const notNow = () => {
    markAskedForPermission();
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && notNow()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <BellRing className="w-5 h-5 text-primary" /> Never miss a new song
          </DialogTitle>
          <DialogDescription>
            Allow notifications and Sommyart Music will tell you the moment a new song or album is uploaded, and when an artist you follow releases something.
            You can change this any time with the bell on the Home screen.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="gap-2 sm:gap-2">
          <Button variant="secondary" onClick={notNow}>Not now</Button>
          <Button onClick={enable}>Allow notifications</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

const MODES: { value: NotifyMode; label: string; hint: string }[] = [
  { value: "all", label: "Every new song", hint: "Alerts for all uploads" },
  { value: "following", label: "Artists I follow", hint: "Only when someone you follow releases" },
  { value: "off", label: "Off", hint: "No new-song alerts" },
];

/** Bell button for the Home header that opens the notification settings. */
export function NotificationBell() {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<NotifyMode>(getNotifyMode());
  const [perm, setPerm] = useState<NotifyPermission>("prompt");

  const refresh = useCallback(async () => setPerm(await getNotifyPermission()), []);
  useEffect(() => {
    if (open) {
      setMode(getNotifyMode());
      refresh();
    }
  }, [open, refresh]);

  const allow = async () => {
    markAskedForPermission();
    setPerm(await requestNotifyPermission());
  };
  const pick = (m: NotifyMode) => {
    setMode(m);
    setNotifyMode(m);
  };
  const muted = mode === "off" || perm === "denied";

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        aria-label="Notification settings"
        className="ml-auto w-10 h-10 rounded-full glass flex items-center justify-center text-foreground"
      >
        {muted ? <BellOff size={18} className="text-muted-foreground" /> : <Bell size={18} className="text-primary" />}
      </button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Notifications</DialogTitle>
            <DialogDescription>Choose which new songs you want to hear about.</DialogDescription>
          </DialogHeader>
          {perm !== "granted" && (
            <div className="rounded-xl border border-border/50 p-3 text-sm space-y-2">
              {perm === "denied" ? (
                <p className="text-muted-foreground">
                  Notifications are blocked for this app. Open your phone Settings, find Sommyart Music, and allow notifications.
                </p>
              ) : perm === "unsupported" ? (
                <p className="text-muted-foreground">This device does not support notifications. You will still see alerts inside the app.</p>
              ) : (
                <>
                  <p className="text-muted-foreground">Allow notifications so alerts also appear when you are in another app.</p>
                  <Button size="sm" onClick={allow}>Allow notifications</Button>
                </>
              )}
            </div>
          )}
          <div role="radiogroup" aria-label="New song alerts" className="space-y-2">
            {MODES.map((m) => (
              <button
                key={m.value}
                role="radio"
                aria-checked={mode === m.value}
                onClick={() => pick(m.value)}
                className={cn(
                  "w-full text-left rounded-xl border p-3 transition-colors",
                  mode === m.value ? "border-primary bg-primary/10" : "border-border/50",
                )}
              >
                <p className="text-sm text-foreground">{m.label}</p>
                <p className="text-xs text-muted-foreground">{m.hint}</p>
              </button>
            ))}
          </div>
          <p className="text-[11px] text-muted-foreground">
            Alerts arrive while the app is open or still running in the background. If you swipe the app away completely, you will see the new songs next time you open it.
          </p>
        </DialogContent>
      </Dialog>
    </>
  );
}
