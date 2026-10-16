import { createContext, useContext, ReactNode } from "react";
import { useOfflineDownloads } from "@/hooks/useOfflineDownloads";

type DownloadContextType = ReturnType<typeof useOfflineDownloads>;

const DownloadContext = createContext<DownloadContextType | null>(null);

export function DownloadProvider({ children }: { children: ReactNode }) {
  const downloads = useOfflineDownloads();
  return (
    <DownloadContext.Provider value={downloads}>
      {children}
    </DownloadContext.Provider>
  );
}

export function useDownloadContext() {
  const ctx = useContext(DownloadContext);
  if (!ctx) throw new Error("useDownloadContext must be inside DownloadProvider");
  return ctx;
}
