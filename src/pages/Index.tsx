import { useState } from "react";
import { Search, X, Star } from "lucide-react";
import { TrackItem } from "@/components/playlist/TrackItem";
import { HeroSection } from "@/components/hero/HeroSection";
import { AdBanner } from "@/components/hero/AdBanner";

import { useMusicPlayerContext } from "@/contexts/MusicPlayerContext";
import { Track } from "@/lib/tracks";

const Index = () => {
  const { playlist, currentTrackIndex, isPlaying, playTrack, newestTracks, songsLoading, kosherTracks, mainTracks } = useMusicPlayerContext();
  const [searchQuery, setSearchQuery] = useState("");

  const handlePlayTrackById = (id: string) => {
    const idx = playlist.findIndex((t) => t.id === id);
    if (idx >= 0) playTrack(idx);
  };

  const handlePlayTrack = (track: Track) => {
    const idx = playlist.findIndex((t) => t.id === track.id);
    if (idx >= 0) playTrack(idx);
  };

  const q = searchQuery.toLowerCase();

  const filteredMainTracks = mainTracks.filter((track) =>
    track.title.toLowerCase().includes(q) || track.artist.toLowerCase().includes(q)
  );

  const filteredKosherTracks = kosherTracks.filter((track) =>
    track.title.toLowerCase().includes(q) || track.artist.toLowerCase().includes(q)
  );

  // Newest releases first; tracks without an upload date fall to the bottom (alpha)
  const sortedMainTracks = [...filteredMainTracks].sort((a, b) => {
    const aTime = a.uploadedAt ? new Date(a.uploadedAt).getTime() : 0;
    const bTime = b.uploadedAt ? new Date(b.uploadedAt).getTime() : 0;
    if (aTime !== bTime) return bTime - aTime;
    return a.title.localeCompare(b.title);
  });

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


      {/* Featured Picks Ad Banner — auto-sliding carousel of 3 random tracks */}
      <AdBanner tracks={mainTracks} onPlay={handlePlayTrack} />

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

      {/* Kosher Music Section — flat */}
      {filteredKosherTracks.length > 0 && (
        <section className="px-4 mb-6">
          <div className="flex items-center gap-2 mb-3 px-2">
            <Star className="w-4 h-4 text-primary" />
            <h2 className="text-sm font-display tracking-widest text-primary">
              KOSHER MUSIC
            </h2>
            <span className="text-xs text-muted-foreground">({filteredKosherTracks.length})</span>
          </div>
          <div className="space-y-1">
            {filteredKosherTracks.map((track) => {
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
            })}
          </div>
          <div className="mt-4">
            <div className="h-px bg-gradient-to-r from-transparent via-primary/20 to-transparent" />
          </div>
        </section>
      )}

      {/* All tracks — flat alphabetical list */}
      <section className="px-4">
        <h2 className="text-sm font-display tracking-widest text-primary mb-4 px-2">
          NEWEST RELEASES {searchQuery && `(${sortedMainTracks.length})`}
        </h2>
        {songsLoading ? (
          <div className="flex justify-center py-8">
            <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          </div>
        ) : sortedMainTracks.length === 0 ? (
          <p className="text-center text-sm text-muted-foreground py-8">No tracks found</p>
        ) : (
          <div className="space-y-1">
            {sortedMainTracks.map((track) => {
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
            })}
          </div>
        )}
      </section>
    </div>
  );
};

export default Index;
