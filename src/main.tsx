import { createRoot } from "react-dom/client";
import { HelmetProvider } from "react-helmet-async";
import { lazy, Suspense } from "react";
import App from "./App.tsx";
import "./index.css";
import { registerServiceWorker } from "./lib/registerServiceWorker";
import { Toaster as Sonner } from "@/components/ui/sonner";

// The admin Studio ships from the same codebase but is deployed as its own site
// (VITE_APP=studio), so the listener app never contains the upload dashboard UI.
const isStudio = import.meta.env.VITE_APP === "studio";
const Studio = lazy(() => import("./studio/Studio"));

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
