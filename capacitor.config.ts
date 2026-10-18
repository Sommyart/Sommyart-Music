import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.sommyart.music",
  appName: "Sommyart Music",
  webDir: "dist",
  backgroundColor: "#0A0F1F",
  android: {
    // Keep the WebView (and its audio) alive when the app goes to the background.
    allowMixedContent: false,
  },
  server: {
    androidScheme: "https",
  },
};

export default config;
