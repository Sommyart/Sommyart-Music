import { createContext, useContext, ReactNode } from "react";
import { useMusicPlayer } from "@/hooks/useMusicPlayer";
import { useSongsFromDB } from "@/hooks/useSongsFromDB";

type PlayerContextType = ReturnType<typeof useMusicPlayer> & {
  newestTrack: ReturnType<typeof useSongsFromDB>["newestTrack"];
  songsLoading: boolean;
};

const MusicPlayerContext = createContext<PlayerContextType | null>(null);

export function MusicPlayerProvider({ children }: { children: ReactNode }) {
  const { songs, loading, newestTrack } = useSongsFromDB();
  const player = useMusicPlayer(songs);

  return (
    <MusicPlayerContext.Provider value={{ ...player, newestTrack, songsLoading: loading }}>
      {children}
    </MusicPlayerContext.Provider>
  );
}

export function useMusicPlayerContext() {
  const ctx = useContext(MusicPlayerContext);
  if (!ctx) throw new Error("useMusicPlayerContext must be inside MusicPlayerProvider");
  return ctx;
}
