import { TrackItem } from "@/components/playlist/TrackItem";
import { HeroSection } from "@/components/hero/HeroSection";
import { useMusicPlayerContext } from "@/contexts/MusicPlayerContext";

const Index = () => {
  const { currentTrackIndex, isPlaying, playTrack, newestTrack, songsLoading } = useMusicPlayerContext();

  // Find the index of the newest track for playback
  const handlePlayNewest = () => {
    if (newestTrack) {
      playTrack(0); // newest is first since sorted by uploaded_at desc
    }
  };

  return (
    <div className="min-h-screen pb-36">
      {/* Header */}
      <div className="relative px-6 pt-12 pb-4">
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

      {/* Hero — Newest Track */}
      {newestTrack && (
        <HeroSection
          track={newestTrack}
          isPlaying={currentTrackIndex === 0 && isPlaying}
          onPlay={handlePlayNewest}
        />
      )}

      {/* Divider */}
      <div className="px-6 py-2">
        <div className="h-px bg-gradient-to-r from-transparent via-primary/20 to-transparent" />
      </div>

      {/* All Tracks */}
      <section className="px-4">
        <h2 className="text-sm font-display tracking-widest text-primary mb-4 px-2">
          ALL TRACKS
        </h2>
        {songsLoading ? (
          <div className="flex justify-center py-8">
            <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          </div>
        ) : (
          <div className="space-y-1">
            {/* We get songs from the context player which uses useSongsFromDB */}
            <TracksListFromContext />
          </div>
        )}
      </section>
    </div>
  );
};

function TracksListFromContext() {
  const { currentTrack, currentTrackIndex, isPlaying, playTrack } = useMusicPlayerContext();

  // Access playlist through currentTrack's parent — we re-derive from context
  // The player hook exposes tracks indirectly. We need the full list.
  // Let's use useSongsFromDB directly here.
  return <TracksListDirect />;
}

function TracksListDirect() {
  const { currentTrackIndex, isPlaying, playTrack } = useMusicPlayerContext();
  const { songs } = require("@/hooks/useSongsFromDB").useSongsFromDB ? { songs: [] } : { songs: [] };

  // We can't call useSongsFromDB again (double fetch). Instead, let's expose playlist from context.
  return null;
}

export default Index;
