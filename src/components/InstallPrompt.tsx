import { useState, useEffect } from "react";
import { Download, X } from "lucide-react";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

const InstallPrompt = () => {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (localStorage.getItem("install-dismissed")) return;

    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };

    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  if (!deferredPrompt || dismissed) return null;

  const handleInstall = async () => {
    await deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === "accepted") setDeferredPrompt(null);
  };

  const handleDismiss = () => {
    setDismissed(true);
    localStorage.setItem("install-dismissed", "1");
  };

  return (
    <div className="fixed top-4 left-4 right-4 z-50 glass-strong rounded-xl p-4 flex items-center gap-3 neon-border animate-fade-in">
      <Download className="w-6 h-6 text-primary shrink-0" />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-foreground">Install Sommyart Music</p>
        <p className="text-xs text-muted-foreground">Add to home screen for the best experience</p>
      </div>
      <button
        onClick={handleInstall}
        className="px-3 py-1.5 rounded-lg bg-primary text-primary-foreground text-xs font-bold shrink-0"
      >
        Install
      </button>
      <button onClick={handleDismiss} className="text-muted-foreground">
        <X className="w-4 h-4" />
      </button>
    </div>
  );
};

export default InstallPrompt;
