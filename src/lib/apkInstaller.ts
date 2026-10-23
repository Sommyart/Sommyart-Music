import { registerPlugin } from "@capacitor/core";
import type { PluginListenerHandle } from "@capacitor/core";

/** The app's own Android helper (android/.../ApkInstallerPlugin.java) that downloads and installs updates. */
export interface ApkInstallerPlugin {
  canInstall(): Promise<{ allowed: boolean }>;
  openInstallSettings(): Promise<void>;
  download(options: { url: string }): Promise<{ path: string; size: number }>;
  install(options: { path: string }): Promise<void>;
  addListener(
    eventName: "progress",
    listener: (event: { loaded: number; total: number }) => void,
  ): Promise<PluginListenerHandle>;
}

export const ApkInstaller = registerPlugin<ApkInstallerPlugin>("ApkInstaller");
