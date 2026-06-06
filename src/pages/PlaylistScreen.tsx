import { useMemo, useState } from "react";
import { Search, X, Star, Music2, ChevronDown } from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { TrackItem } from "@/components/playlist/TrackItem";
import { useMusicPlayerContext } from "@/contexts/MusicPlayerContext";
import { SEO } from "@/components/SEO";
import { Track } from "@/lib/tracks";

const PlaylistScreen = () => {
  const { playlist, currentTrackIndex, isPlaying, playTrack, kosherTracks, mainTracks } = useMusicPlayerContext();
  const [searchQuery, setSearchQuery] = useState("");

  const q = searchQuery.toLowerCase();

  const filteredKosher = kosherTracks.filter(
    (t) => t.title.toLowerCase().includes(q) || t.artist.toLowerCase().includes(q)
  );

  const filteredMain = mainTracks.filter(
    (t) => t.title.toLowerCase().includes(q) || t.artist.toLowerCase().includes(q)
  );

  // Group main tracks by genre, alphabetized within each group, genres sorted alphabetically
  const tracksByGenre = useMemo(() => {
    const groups = new Map<string, Track[]>();
    for (const t of filteredMain) {
      const g = t.genre || "Other";
      if (!groups.has(g)) groups.set(g, []);
      groups.get(g)!.push(t);
    }
    return Array.from(groups.entries())
      .map(([genre, list]) => ({
        genre,
        tracks: [...list].sort((a, b) => a.title.localeCompare(b.title)),
      }))
      .sort((a, b) => a.genre.localeCompare(b.genre));
  }, [filteredMain]);

  return (
    <div className="min-h-screen pb-36">
      <SEO
        title="Playlist — Browse All Tracks | Sommyart Music"
        description="Browse the full Sommyart Music library by genre, search by title or artist, and explore the Kosher Acapella section. Holographic streaming, made simple."
        path="/playlist"
      />
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

      {/* Kosher Music Section */}
      {filteredKosher.length > 0 && (
        <section className="px-4 mb-4">
          <Collapsible defaultOpen={!!searchQuery}>
            <CollapsibleTrigger className="flex items-center gap-2 px-2 py-2 w-full group rounded-lg hover:bg-secondary/30 transition-colors">
              <Star className="w-4 h-4 text-primary" />
              <h2 className="text-xs font-display tracking-widest text-primary uppercase">
                Kosher Music
              </h2>
              <span className="text-xs text-muted-foreground">({filteredKosher.length})</span>
              <ChevronDown className="w-4 h-4 text-primary ml-auto transition-transform group-data-[state=open]:rotate-180" />
            </CollapsibleTrigger>
            <CollapsibleContent>
              <div className="space-y-1 pt-2">
                {filteredKosher.map((track) => {
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
            </CollapsibleContent>
          </Collapsible>
        </section>
      )}

      {/* Genre groups */}
      <section className="px-4">
        {tracksByGenre.length === 0 && filteredKosher.length === 0 ? (
          <p className="text-center text-sm text-muted-foreground py-8">No tracks found</p>
        ) : (
          <div className="space-y-2">
            {tracksByGenre.map(({ genre, tracks: genreTracks }) => (
              <Collapsible key={genre} defaultOpen={!!searchQuery}>
                <CollapsibleTrigger className="flex items-center gap-2 px-2 py-2 w-full group rounded-lg hover:bg-secondary/30 transition-colors">
                  <Music2 className="w-4 h-4 text-primary" />
                  <h3 className="text-xs font-display tracking-widest text-foreground uppercase">
                    {genre}
                  </h3>
                  <span className="text-xs text-muted-foreground">({genreTracks.length})</span>
                  <ChevronDown className="w-4 h-4 text-primary ml-auto transition-transform group-data-[state=open]:rotate-180" />
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <div className="space-y-1 pt-2">
                    {genreTracks.map((track) => {
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
                </CollapsibleContent>
              </Collapsible>
            ))}
          </div>
        )}
      </section>
    </div>
  );
};

export default PlaylistScreen;
