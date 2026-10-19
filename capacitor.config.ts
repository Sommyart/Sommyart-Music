import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.sommyart.music",
  appName: "Sommyart Music",
  webDir: "dist",
  backgroundColor: "#0A0F1F",
  android: {
    // Keep the WebView (and its audio) alive when the app goes to the background.
    allowMixedContent: false,
    // On Android 15+ the app is drawn behind the phone's back/home buttons.
    // "auto" keeps the web page above those system bars so nothing is covered.
    adjustMarginsForEdgeToEdge: "auto",
  },
  plugins: {
    LocalNotifications: {
      smallIcon: "ic_stat_music",
      iconColor: "#00E5FF",
    },
    PushNotifications: {
      presentationOptions: ["alert", "sound"],
    },
  },
  server: {
    androidScheme: "https",
  },
};

export default config;
