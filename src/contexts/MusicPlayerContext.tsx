import { createContext, useContext, ReactNode } from "react";
import { useMusicPlayer } from "@/hooks/useMusicPlayer";
import { tracks } from "@/lib/tracks";

type PlayerContextType = ReturnType<typeof useMusicPlayer>;

const MusicPlayerContext = createContext<PlayerContextType | null>(null);

export function MusicPlayerProvider({ children }: { children: ReactNode }) {
  const player = useMusicPlayer(tracks);
  return (
    <MusicPlayerContext.Provider value={player}>
      {children}
    </MusicPlayerContext.Provider>
  );
}

export function useMusicPlayerContext() {
  const ctx = useContext(MusicPlayerContext);
  if (!ctx) throw new Error("useMusicPlayerContext must be inside MusicPlayerProvider");
  return ctx;
}
