import { createContext, useContext, ReactNode } from "react";
import { useMusicPlayer } from "@/hooks/useMusicPlayer";
import { useSongsFromDB } from "@/hooks/useSongsFromDB";
import { Track } from "@/lib/tracks";

type PlayerContextType = ReturnType<typeof useMusicPlayer> & {
  newestTrack: ReturnType<typeof useSongsFromDB>["newestTrack"];
  songsLoading: boolean;
  kosherTracks: Track[];
  mainTracks: Track[];
};

const MusicPlayerContext = createContext<PlayerContextType | null>(null);

export function MusicPlayerProvider({ children }: { children: ReactNode }) {
  const { songs, allSongs, kosherTracks, loading, newestTrack } = useSongsFromDB();
  const player = useMusicPlayer(allSongs);

  return (
    <MusicPlayerContext.Provider value={{ ...player, newestTrack, songsLoading: loading, kosherTracks, mainTracks: songs }}>
      {children}
    </MusicPlayerContext.Provider>
  );
}

export function useMusicPlayerContext() {
  const ctx = useContext(MusicPlayerContext);
  if (!ctx) throw new Error("useMusicPlayerContext must be inside MusicPlayerProvider");
  return ctx;
}
