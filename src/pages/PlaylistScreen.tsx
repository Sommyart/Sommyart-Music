import { tracks } from "@/lib/tracks";
import { TrackItem } from "@/components/playlist/TrackItem";
import { useMusicPlayerContext } from "@/contexts/MusicPlayerContext";

const PlaylistScreen = () => {
  const { currentTrackIndex, isPlaying, playTrack } = useMusicPlayerContext();

  return (
    <div className="min-h-screen pb-36">
      <div className="px-6 pt-12 pb-6">
        <h1 className="text-xl font-display font-bold tracking-wider text-foreground neon-text">Playlist</h1>
        <p className="text-xs text-muted-foreground mt-1">{tracks.length} tracks</p>
      </div>
      <div className="px-4 space-y-1">
        {tracks.map((track, i) => (
          <TrackItem
            key={track.id}
            track={track}
            index={i}
            isActive={currentTrackIndex === i}
            isPlaying={currentTrackIndex === i && isPlaying}
            onPlay={() => playTrack(i)}
          />
        ))}
      </div>
    </div>
  );
};

export default PlaylistScreen;
