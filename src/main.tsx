import { createRoot } from "react-dom/client";
import { HelmetProvider } from "react-helmet-async";
import { lazy, Suspense } from "react";
import App from "./App.tsx";
import "./index.css";
import { registerServiceWorker } from "./lib/registerServiceWorker";
import { Toaster as Sonner } from "@/components/ui/sonner";

// The admin Studio ships from the same codebase but is deployed as its own site
// (VITE_APP=studio), so the listener app never contains the upload dashboard UI.
const isStudio =
  import.meta.env.VITE_APP === "studio" ||
  /^sommyart-studio[.-]/.test(window.location.hostname);
const Studio = lazy(() => import("./studio/Studio"));

if (isStudio) {
  // Give the Studio its own name and icon (browser tab + home-screen launcher).
  document.title = "Sommyart Studio";
  const setHead = (selector: string, attr: string, value: string) => {
    document.querySelectorAll(selector).forEach((el) => el.setAttribute(attr, value));
  };
  setHead('link[rel="manifest"]', "href", "/studio/manifest.json");
  setHead('link[rel="apple-touch-icon"]', "href", "/studio/icon-180.png");
  setHead('link[rel="icon"][sizes="192x192"]', "href", "/studio/icon-192.png");
  setHead('link[rel="icon"][sizes="512x512"]', "href", "/studio/icon-512.png");
  setHead('link[rel="icon"]:not([sizes])', "href", "/studio/icon-32.png");
  setHead('link[rel="shortcut icon"]', "href", "/studio/icon-32.png");
  setHead('meta[name="theme-color"]', "content", "#9d2fbf");
  setHead('meta[name="apple-mobile-web-app-title"]', "content", "Studio");
  setHead('meta[name="application-name"]', "content", "Sommyart Studio");
}

createRoot(document.getElementById("root")!).render(
  isStudio ? (
    <>
      <Sonner />
      <Suspense fallback={null}>
        <Studio />
      </Suspense>
    </>
  ) : (
    <HelmetProvider>
      <App />
    </HelmetProvider>
  ),
);

if (!isStudio) void registerServiceWorker();
