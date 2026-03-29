import { useState } from "react";
import { Search, X } from "lucide-react";
import { TrackItem } from "@/components/playlist/TrackItem";
import { useMusicPlayerContext } from "@/contexts/MusicPlayerContext";

const PlaylistScreen = () => {
  const { playlist, currentTrackIndex, isPlaying, playTrack } = useMusicPlayerContext();
  const [searchQuery, setSearchQuery] = useState("");

  const filteredTracks = playlist.filter((track) => {
    const q = searchQuery.toLowerCase();
    return track.title.toLowerCase().includes(q) || track.artist.toLowerCase().includes(q);
  });

  return (
    <div className="min-h-screen pb-36">
      <div className="px-6 pt-12 pb-4">
        <h1 className="text-xl font-display font-bold tracking-wider text-foreground neon-text">Playlist</h1>
        <p className="text-xs text-muted-foreground mt-1">{playlist.length} tracks</p>
      </div>

      {/* Search Bar */}
      <div className="px-4 mb-4">
        <div className="relative">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search tracks..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full h-10 pl-9 pr-9 rounded-xl bg-secondary/50 border border-border/50 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary/50 font-body"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              <X size={16} />
            </button>
          )}
        </div>
      </div>

      <div className="px-4 space-y-1">
        {filteredTracks.length === 0 ? (
          <p className="text-center text-sm text-muted-foreground py-8">No tracks found</p>
        ) : (
          filteredTracks.map((track) => {
            const originalIndex = playlist.findIndex((t) => t.id === track.id);
            return (
              <TrackItem
                key={track.id}
                track={track}
                index={originalIndex}
                isActive={currentTrackIndex === originalIndex}
                isPlaying={currentTrackIndex === originalIndex && isPlaying}
                onPlay={() => playTrack(originalIndex)}
              />
            );
          })
        )}
      </div>
    </div>
  );
};

export default PlaylistScreen;
