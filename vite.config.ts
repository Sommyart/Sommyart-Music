import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";
import { mcpPlugin } from "@lovable.dev/mcp-js/stacks/supabase/vite";
import { VitePWA } from "vite-plugin-pwa";


// These exist inside the service worker (the image handler below runs there), not in Node.
declare const caches: any;
declare const self: any;

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
    hmr: {
      overlay: false,
    },
  },
  plugins: [
    react(),
    mode === "development" && componentTagger(),
    mcpPlugin(),
    VitePWA({
      registerType: "autoUpdate",
      injectRegister: null,
      filename: "sw.js",
      devOptions: { enabled: false },
      manifest: false,
      workbox: {
        globPatterns: ["**/*.{js,css,html,ico,png,svg,woff2}"],
        navigateFallback: "/index.html",
        navigateFallbackDenylist: [/^\/~oauth/, /^\/\.lovable\//, /^\/download/],
        maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
        runtimeCaching: [
          {
            urlPattern: ({ request }) => request.mode === "navigate",
            handler: "NetworkFirst",
            options: { cacheName: "sommyart-pages", networkTimeoutSeconds: 4 },
          },
          {
            urlPattern: ({ request, sameOrigin }) =>
              sameOrigin && (request.destination === "script" || request.destination === "style"),
            handler: "StaleWhileRevalidate",
            options: { cacheName: "sommyart-assets" },
          },
          {
            // Cover pictures and artist photos: kept after the first look so they
            // still show with no internet. Pictures from another site are fetched
            // in "cors" mode so a real, small copy can be saved (a plain image
            // request would only give an opaque copy that cannot be reused well).
            urlPattern: ({ request }) => request.destination === "image",
            handler: async ({ request }: { request: Request }) => {
              const cache = await caches.open("sommyart-images");
              const saved = await cache.match(request.url);
              if (saved) return saved;
              const sameSite = request.url.startsWith(self.location.origin);
              let res: Response | null = null;
              try {
                res = await fetch(request.url, sameSite ? undefined : { mode: "cors", credentials: "omit" });
              } catch (e) {
                res = null;
              }
              if (res && res.ok) {
                await cache.put(request.url, res.clone());
                const keys = await cache.keys();
                if (keys.length > 800) await cache.delete(keys[0]);
                return res;
              }
              // A host that refuses "cors" mode: still show the picture, just cannot keep it.
              try {
                return await fetch(request);
              } catch (e) {
                return res || Response.error();
              }
            },
          },
        ],
      },
    }),
  ].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
    dedupe: ["react", "react-dom", "react/jsx-runtime", "react/jsx-dev-runtime"],
  },
}));
