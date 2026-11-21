import { useEffect, useState } from "react";
import { Capacitor } from "@capacitor/core";
import { Download, X } from "lucide-react";
import { shouldOfferApp } from "@/lib/installOffer";

const DISMISS_KEY = "sommyart-install-banner-closed";

/**
 * On the website, keeps asking listeners to install the Android app. Closing it hides it only
 * until the next visit. Never shown inside the app itself.
 */
export function InstallAppBanner() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    let closed = false;
    try {
      closed = sessionStorage.getItem(DISMISS_KEY) === "1";
    } catch {
      /* private mode */
    }
    setShow(!closed && shouldOfferApp(Capacitor.isNativePlatform(), navigator.userAgent));
  }, []);

  if (!show) return null;

  const close = () => {
    setShow(false);
    try {
      sessionStorage.setItem(DISMISS_KEY, "1");
    } catch {
      /* private mode */
    }
  };

  return (
    <div
      role="region"
      aria-label="Get the app"
      className="relative z-40 border-b border-primary/30 bg-background/95 backdrop-blur px-3 py-2"
      style={{ paddingTop: "max(0.5rem, env(safe-area-inset-top))" }}
    >
      <div className="max-w-2xl mx-auto flex items-center gap-3">
        <img src="/icons/icon-192.png" alt="" className="w-9 h-9 rounded-lg shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium leading-tight">Get the Sommyart Music app</p>
          <p className="text-xs text-muted-foreground leading-tight">Offline downloads, lock-screen controls and smoother playback.</p>
        </div>
        <a
          href="/download"
          className="shrink-0 inline-flex items-center gap-1.5 rounded-full bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground"
        >
          <Download size={14} /> Install
        </a>
        <button type="button" onClick={close} aria-label="Close" className="shrink-0 p-1 text-muted-foreground hover:text-foreground">
          <X size={16} />
        </button>
      </div>
    </div>
  );
}
