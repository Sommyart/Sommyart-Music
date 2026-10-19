import { useEffect, useMemo, useState } from "react";
import { Search, X, Star, Music2, ChevronDown, Play, Shuffle, Repeat, Repeat1, ListMusic } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { TrackItem } from "@/components/playlist/TrackItem";
import { DownloadCollectionButton } from "@/components/DownloadCollectionButton";
import { useMusicPlayerContext } from "@/contexts/MusicPlayerContext";
import { SEO } from "@/components/SEO";
import { Track } from "@/lib/tracks";

type SortMode = "genre" | "az" | "newest" | "oldest";

const SORTS: { id: SortMode; label: string }[] = [
  { id: "az", label: "A–Z" },
  { id: "newest", label: "Newest" },
  { id: "oldest", label: "Oldest" },
  { id: "genre", label: "By genre" },
];

const SORT_KEY = "sommyart_playlist_sort";

function loadSort(): SortMode {
  try {
    const v = localStorage.getItem(SORT_KEY) as SortMode | null;
    return v && SORTS.some((s) => s.id === v) ? v : "az";
  } catch {
    return "az";
  }
}

/** "Pop, Rock" counts as two genres. */
const genresOf = (g?: string | null) => (g ?? "").split(",").map((x) => x.trim()).filter(Boolean);

const byTitle = (a: Track, b: Track) => a.title.localeCompare(b.title, undefined, { sensitivity: "base" });
const time = (t: Track) => (t.uploadedAt ? new Date(t.uploadedAt).getTime() || 0 : 0);

/**
 * Sort a list the way the user chose. Songs bundled with the app have no
 * upload date; they count as the oldest (they were the original catalogue).
 * Ties fall back to A–Z so the order is always stable and predictable.
 */
function sortTracks(list: Track[], mode: SortMode): Track[] {
  const c = [...list];
  if (mode === "newest") return c.sort((a, b) => time(b) - time(a) || byTitle(a, b));
  if (mode === "oldest") return c.sort((a, b) => time(a) - time(b) || byTitle(a, b));
  return c.sort(byTitle);
}

const PlaylistScreen = () => {
  const {
    playlist, currentTrack, isPlaying, playContext, kosherTracks, mainTracks,
    shuffle, repeat, setShuffle, setRepeat, contextId,
  } = useMusicPlayerContext();
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState("");
  const [sort, setSort] = useState<SortMode>(loadSort);
  const [genreFilter, setGenreFilter] = useState(""); // lower-case genre, "" = all

  useEffect(() => {
    try { localStorage.setItem(SORT_KEY, sort); } catch { /* noop */ }
  }, [sort]);

  const q = searchQuery.trim().toLowerCase();
  // Search looks at title, artist and genre; the genre chips narrow it further.
  const matches = (t: Track) =>
    (!q || `${t.title} ${t.artist} ${t.genre ?? ""}`.toLowerCase().includes(q)) &&
    (!genreFilter || genresOf(t.genre).some((g) => g.toLowerCase() === genreFilter));

  // Genre chips come from every song, with counts.
  const genreChips = useMemo(() => {
    const m = new Map<string, { label: string; n: number }>();
    for (const t of [...mainTracks, ...kosherTracks]) {
      for (const g of genresOf(t.genre)) {
        const k = g.toLowerCase();
        const cur = m.get(k);
        m.set(k, { label: cur?.label ?? g, n: (cur?.n ?? 0) + 1 });
      }
    }
    return Array.from(m.entries()).map(([key, v]) => ({ key, ...v })).sort((a, b) => a.label.localeCompare(b.label));
  }, [mainTracks, kosherTracks]);

  const filteredKosher = useMemo(() => sortTracks(kosherTracks.filter(matches), sort === "genre" ? "az" : sort), [kosherTracks, q, genreFilter, sort]);
  const filteredMain = useMemo(() => mainTracks.filter(matches), [mainTracks, q, genreFilter]);

  // Genre view: genres A–Z, songs A–Z inside each genre.
  const tracksByGenre = useMemo(() => {
    const groups = new Map<string, Track[]>();
    for (const t of filteredMain) {
      const g = t.genre || "Other";
      if (!groups.has(g)) groups.set(g, []);
      groups.get(g)!.push(t);
    }
    return Array.from(groups.entries())
      .map(([genre, list]) => ({ genre, tracks: [...list].sort(byTitle) }))
      .sort((a, b) => a.genre.localeCompare(b.genre));
  }, [filteredMain]);

  // The exact order on screen. Playback follows this list strictly, song after song.
  const ordered = useMemo(
    () => (sort === "genre" ? tracksByGenre.flatMap((g) => g.tracks) : sortTracks(filteredMain, sort)),
    [sort, tracksByGenre, filteredMain],
  );

  const contextKey = `sort:${sort}${genreFilter ? `:g:${genreFilter}` : ""}${q ? `:q:${q}` : ""}`;

  const playFrom = (list: Track[], track: Track, id: string) => {
    const startIndex = Math.max(0, list.findIndex((t) => t.id === track.id));
    playContext({ type: "playlist", id, tracks: list, startIndex });
  };

  // Play the list from the top in the chosen order (or from a random song when shuffle is on).
  const playAll = () => {
    if (!ordered.length) return;
    const start = shuffle ? Math.floor(Math.random() * ordered.length) : 0;
    playContext({ type: "playlist", id: contextKey, tracks: ordered, startIndex: start });
  };

  const row = (track: Track, list: Track[], id: string, index: number) => {
    const active = currentTrack?.id === track.id;
    return (
      <TrackItem
        key={track.id}
        track={track}
        index={index}
        isActive={active}
        isPlaying={active && isPlaying}
        onPlay={() => playFrom(list, track, id)}
      />
    );
  };

  const repeatLabel = repeat === "one" ? "Repeat one" : repeat === "all" ? "Repeat all" : "Repeat off";

  return (
    <div className="min-h-screen pb-36">
      <SEO
        title="Playlist — Browse All Tracks | Sommyart Music"
        description="Browse the full Sommyart Music library by genre, search by title or artist, and explore the Kosher Acapella section. Holographic streaming, made simple."
        path="/playlist"
      />
      <div className="px-6 pt-12 pb-3 flex items-end justify-between gap-4">
        <div>
          <h1 className="text-xl font-display font-bold tracking-wider text-foreground neon-text">Playlist</h1>
          <p className="text-xs text-muted-foreground mt-1">{playlist.length} tracks</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => navigate("/playlists")}
            aria-label="My playlists"
            className="h-10 px-3 rounded-full border border-border/50 text-xs text-muted-foreground hover:text-primary hover:border-primary/50 flex items-center gap-1.5"
          >
            <ListMusic size={14} /> My playlists
          </button>
          <DownloadCollectionButton tracks={playlist} label="your playlist" size={40} />
        </div>
      </div>

      {/* Play controls: play in order, shuffle, repeat (off → all → one) */}
      <div className="px-6 pb-4 flex items-center gap-3">
        <button
          onClick={playAll}
          className="h-11 px-5 rounded-full bg-primary text-primary-foreground font-display tracking-wider text-sm flex items-center gap-2 neon-glow"
        >
          <Play size={16} fill="currentColor" /> PLAY
        </button>
        <button
          onClick={setShuffle}
          aria-label={shuffle ? "Shuffle on" : "Shuffle off"}
          aria-pressed={shuffle}
          title={shuffle ? "Shuffle on" : "Shuffle off"}
          className={`h-11 w-11 rounded-full border flex items-center justify-center transition-colors ${
            shuffle ? "border-primary text-primary bg-primary/10" : "border-border/50 text-muted-foreground"
          }`}
        >
          <Shuffle size={18} />
        </button>
        <button
          onClick={setRepeat}
          aria-label={repeatLabel}
          title={repeatLabel}
          className={`h-11 w-11 rounded-full border flex items-center justify-center transition-colors ${
            repeat !== "off" ? "border-primary text-primary bg-primary/10" : "border-border/50 text-muted-foreground"
          }`}
        >
          {repeat === "one" ? <Repeat1 size={18} /> : <Repeat size={18} />}
        </button>
        <span className="text-[11px] text-muted-foreground leading-tight">
          {shuffle ? "Shuffle" : "In order"}
          <br />
          {repeatLabel}
        </span>
      </div>

      {/* Sort */}
      <div className="px-4 mb-3 flex gap-2 overflow-x-auto no-scrollbar">
        {SORTS.map((s) => (
          <button
            key={s.id}
            onClick={() => setSort(s.id)}
            aria-pressed={sort === s.id}
            className={`h-8 px-4 rounded-full text-xs font-medium whitespace-nowrap border transition-colors ${
              sort === s.id ? "bg-primary text-primary-foreground border-primary" : "border-border/50 text-muted-foreground hover:text-foreground"
            }`}
          >
            {s.label}
          </button>
        ))}
      </div>

      {/* Genre filter */}
      {genreChips.length > 0 && (
        <div className="px-4 mb-3 flex gap-2 overflow-x-auto no-scrollbar">
          <button
            onClick={() => setGenreFilter("")}
            aria-pressed={!genreFilter}
            className={`h-8 px-4 rounded-full text-xs font-medium whitespace-nowrap border transition-colors ${
              !genreFilter ? "bg-primary text-primary-foreground border-primary" : "border-border/50 text-muted-foreground hover:text-foreground"
            }`}
          >
            All genres
          </button>
          {genreChips.map((g) => (
            <button
              key={g.key}
              onClick={() => setGenreFilter(genreFilter === g.key ? "" : g.key)}
              aria-pressed={genreFilter === g.key}
              className={`h-8 px-4 rounded-full text-xs font-medium whitespace-nowrap border transition-colors ${
                genreFilter === g.key ? "bg-primary text-primary-foreground border-primary" : "border-border/50 text-muted-foreground hover:text-foreground"
              }`}
            >
              {g.label} <span className="opacity-70">{g.n}</span>
            </button>
          ))}
        </div>
      )}

      {/* Search Bar */}
      <div className="px-4 mb-4">
        <div className="relative">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search title, artist or genre..."
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
          <Collapsible defaultOpen={!!searchQuery || !!genreFilter}>
            <CollapsibleTrigger className="flex items-center gap-2 px-2 py-2 w-full group rounded-lg hover:bg-secondary/30 transition-colors">
              <Star className="w-4 h-4 text-primary" />
              <h2 className="text-xs font-display tracking-widest text-primary uppercase">Kosher Music</h2>
              <span className="text-xs text-muted-foreground">({filteredKosher.length})</span>
              <ChevronDown className="w-4 h-4 text-primary ml-auto transition-transform group-data-[state=open]:rotate-180" />
            </CollapsibleTrigger>
            <CollapsibleContent>
              <div className="space-y-1 pt-2">
                {filteredKosher.map((t, i) => row(t, filteredKosher, `kosher:${sort}`, i))}
              </div>
            </CollapsibleContent>
          </Collapsible>
        </section>
      )}

      <section className="px-4">
        {ordered.length === 0 && filteredKosher.length === 0 ? (
          <p className="text-center text-sm text-muted-foreground py-8">No tracks found</p>
        ) : sort === "genre" ? (
          <div className="space-y-2">
            {tracksByGenre.map(({ genre, tracks: genreTracks }) => (
              <Collapsible key={genre} defaultOpen={!!searchQuery || !!genreFilter || genreTracks.some((t) => t.id === currentTrack?.id)}>
                <CollapsibleTrigger className="flex items-center gap-2 px-2 py-2 w-full group rounded-lg hover:bg-secondary/30 transition-colors">
                  <Music2 className="w-4 h-4 text-primary" />
                  <h3 className="text-xs font-display tracking-widest text-foreground uppercase">{genre}</h3>
                  <span className="text-xs text-muted-foreground">({genreTracks.length})</span>
                  <ChevronDown className="w-4 h-4 text-primary ml-auto transition-transform group-data-[state=open]:rotate-180" />
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <div className="space-y-1 pt-2">
                    {/* Playing from a genre continues through the whole genre-ordered list. */}
                    {genreTracks.map((t, i) => row(t, ordered, contextKey, i))}
                  </div>
                </CollapsibleContent>
              </Collapsible>
            ))}
          </div>
        ) : (
          <div className="space-y-1">
            {ordered.map((t, i) => row(t, ordered, contextKey, i))}
          </div>
        )}
        {contextId?.startsWith("sort:") && contextId !== contextKey && (
          <p className="text-[11px] text-muted-foreground text-center pt-4">
            Now playing in the order you had before. Tap a song to play in this order.
          </p>
        )}
      </section>
    </div>
  );
};

export default PlaylistScreen;
