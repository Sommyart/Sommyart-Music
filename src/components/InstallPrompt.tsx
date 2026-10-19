import { useState, useEffect } from "react";
import { Download, X, Share, Plus } from "lucide-react";
import { toast } from "sonner";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

const SNOOZE_KEY = "sommyart.install.snoozedUntil";
const SNOOZE_MS = 7 * 24 * 60 * 60 * 1000;

function isStandalone() {
  return (
    window.matchMedia?.("(display-mode: standalone)").matches ||
    // iOS Safari
    (window.navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

function isIos() {
  const ua = window.navigator.userAgent;
  return /iPad|iPhone|iPod/.test(ua) || (/Macintosh/.test(ua) && "ontouchend" in document);
}

function snoozed() {
  const until = Number(localStorage.getItem(SNOOZE_KEY) || 0);
  return Date.now() < until;
}

const InstallPrompt = () => {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [showIosHelp, setShowIosHelp] = useState(false);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (isStandalone() || snoozed()) return;

    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      setVisible(true);
    };
    window.addEventListener("beforeinstallprompt", handler);

    const onInstalled = () => {
      setVisible(false);
      setDeferredPrompt(null);
      toast.success("Sommyart Music installed", {
        description: "Open it any time from your home screen.",
      });
    };
    window.addEventListener("appinstalled", onInstalled);

    // iOS never fires beforeinstallprompt — offer the manual steps instead.
    let timer: number | undefined;
    if (isIos()) {
      timer = window.setTimeout(() => setVisible(true), 4000);
    }

    return () => {
      window.removeEventListener("beforeinstallprompt", handler);
      window.removeEventListener("appinstalled", onInstalled);
      if (timer) window.clearTimeout(timer);
    };
  }, []);

  const dismiss = () => {
    setVisible(false);
    setShowIosHelp(false);
    localStorage.setItem(SNOOZE_KEY, String(Date.now() + SNOOZE_MS));
  };

  const handleInstall = async () => {
    if (deferredPrompt) {
      await deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      setDeferredPrompt(null);
      if (outcome === "accepted") {
        setVisible(false);
      } else {
        dismiss();
      }
      return;
    }
    setShowIosHelp(true);
  };

  if (!visible) return null;

  return (
    <div className="fixed bottom-[calc(6rem+max(env(safe-area-inset-bottom),0.5rem))] left-4 right-4 z-50 max-w-lg mx-auto glass-strong rounded-2xl p-4 neon-border animate-fade-in">
      <div className="flex items-center gap-3">
        <img
          src="/icons/icon-192.png"
          alt="Sommyart Music app icon"
          className="w-11 h-11 rounded-xl shrink-0"
          loading="lazy"
        />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-foreground">Install Sommyart Music</p>
          <p className="text-xs text-muted-foreground">
            Full-screen player, offline songs, launches from your home screen.
          </p>
        </div>
        <button
          onClick={handleInstall}
          aria-label="Install Sommyart Music"
          className="px-3 py-1.5 rounded-lg bg-primary text-primary-foreground text-xs font-bold shrink-0 flex items-center gap-1 active:scale-95 transition-transform"
        >
          <Download className="w-3.5 h-3.5" />
          Install
        </button>
        <button onClick={dismiss} aria-label="Dismiss install prompt" className="text-muted-foreground">
          <X className="w-4 h-4" />
        </button>
      </div>

      {showIosHelp && (
        <ol className="mt-3 space-y-2 border-t border-border/40 pt-3 text-xs text-muted-foreground">
          <li className="flex items-center gap-2">
            <Share className="w-4 h-4 text-primary shrink-0" />
            <span>
              Tap <span className="text-foreground font-medium">Share</span> at the bottom of Safari
            </span>
          </li>
          <li className="flex items-center gap-2">
            <Plus className="w-4 h-4 text-primary shrink-0" />
            <span>
              Choose <span className="text-foreground font-medium">Add to Home Screen</span>
            </span>
          </li>
        </ol>
      )}
    </div>
  );
};

export default InstallPrompt;
