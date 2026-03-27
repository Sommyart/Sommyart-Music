import { tracks } from "@/lib/tracks";
import { TrackItem } from "@/components/playlist/TrackItem";
import { useMusicPlayerContext } from "@/contexts/MusicPlayerContext";

const Index = () => {
  const { currentTrack, currentTrackIndex, isPlaying, playTrack } = useMusicPlayerContext();

  return (
    <div className="min-h-screen pb-36">
      {/* Header */}
      <div className="relative px-6 pt-12 pb-8">
        <div className="absolute inset-0 bg-gradient-to-b from-neon-cyan/5 to-transparent" />
        <div className="relative flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl overflow-hidden neon-glow">
            <img src="/images/logo.png" alt="Sommyart" className="w-full h-full object-cover" />
          </div>
          <div>
            <h1 className="text-xl font-display font-bold tracking-wider text-foreground neon-text">
              Sommyart Music
            </h1>
            <p className="text-xs text-muted-foreground">Feel the frequency</p>
          </div>
        </div>
      </div>

      {/* Latest Uploads */}
      <section className="px-4">
        <h2 className="text-sm font-display tracking-widest text-primary mb-4 px-2">
          LATEST UPLOADS
        </h2>
        <div className="space-y-1">
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
      </section>
    </div>
  );
};

export default Index;
