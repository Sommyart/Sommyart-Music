import { useMemo } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, MapPin, Play } from "lucide-react";
import { useArtist } from "@/hooks/useAlbums";
import { useMusicPlayerContext } from "@/contexts/MusicPlayerContext";
import { TrackItem } from "@/components/playlist/TrackItem";
import { SEO } from "@/components/SEO";
import { FollowButton } from "@/components/artist/FollowButton";

const ArtistDetail = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { artist, albums, tracks, loading } = useArtist(id);
  const { currentTrack, isPlaying, playContext, contextId } = useMusicPlayerContext();

  const playFrom = (startIndex: number) => {
    if (!tracks.length) return;
    playContext({ type: "artist", id: id ?? null, tracks, startIndex });
  };

  const handlePlayAll = () => playFrom(0);

  const jsonLd = useMemo(() => {
    if (!artist) return undefined;
    return {
      "@context": "https://schema.org",
      "@type": "MusicGroup",
      name: artist.name,
      description: artist.bio ?? undefined,
      foundingLocation: artist.origin ?? undefined,
      album: albums.map((a) => ({ "@type": "MusicAlbum", name: a.title })),
    };
  }, [artist, albums]);

  if (loading) {
    return (
      <div className="min-h-screen flex justify-center pt-32">
        <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!artist) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4">
        <p className="text-sm text-muted-foreground">Artist not found</p>
        <button onClick={() => navigate("/")} className="text-primary text-sm">
          Back home
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen pb-40">
      <SEO
        title={`${artist.name} — Artist on Sommyart Music`}
        description={
          artist.bio?.slice(0, 155) ??
          `Listen to music by ${artist.name} on Sommyart Music.`
        }
        path={`/artist/${artist.id}`}
        jsonLd={jsonLd}
      />

      {/* Hero */}
      <div className="relative">
        <div className="h-56 overflow-hidden">
          <img
            src={artist.imageUrl}
            alt={artist.name}
            className="w-full h-full object-cover opacity-70"
          />
        </div>
        <div className="absolute inset-0 bg-gradient-to-t from-background via-background/50 to-transparent" />
        <button
          onClick={() => navigate(-1)}
          aria-label="Go back"
          className="absolute top-6 left-6 w-9 h-9 rounded-full glass flex items-center justify-center text-foreground"
        >
          <ArrowLeft size={18} />
        </button>
        <div className="absolute bottom-4 left-6 right-6">
          <p className="text-[10px] font-display tracking-widest text-primary">ARTIST</p>
          <h1 className="text-2xl font-display font-bold text-foreground neon-text leading-tight">
            {artist.name}
          </h1>
          {artist.genre && (
            <span className="inline-block mt-1 mr-2 text-[10px] px-2 py-0.5 rounded-full bg-primary/10 text-primary">{artist.genre}</span>
          )}
          {artist.origin && (
            <p className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
              <MapPin size={11} /> {artist.origin}
            </p>
          )}
        </div>
      </div>

      <div className="px-6 pt-4 flex flex-wrap items-center gap-3">
        <button
          onClick={handlePlayAll}
          className="h-11 px-6 rounded-full bg-primary text-primary-foreground font-display tracking-wider text-sm flex items-center gap-2 neon-glow"
        >
          <Play size={16} /> PLAY ALL
        </button>
        <FollowButton artistId={artist.id} artistName={artist.name} />
      </div>

      {/* About the artist */}
      {artist.bio && (
        <section className="px-6 py-5">
          <h2 className="text-sm font-display tracking-widest text-primary mb-2">
            ABOUT THE ARTIST
          </h2>
          <p className="text-sm text-muted-foreground leading-relaxed">{artist.bio}</p>
        </section>
      )}

      {/* Albums */}
      {albums.length > 0 && (
        <section className="px-4 mb-6">
          <h2 className="text-sm font-display tracking-widest text-primary mb-3 px-2">
            ALBUMS
          </h2>
          <div className="flex gap-4 overflow-x-auto pb-2 px-2 no-scrollbar">
            {albums.map((album) => (
              <button
                key={album.id}
                onClick={() => navigate(`/album/${album.id}`)}
                className="w-32 shrink-0 text-left"
              >
                <div className="w-32 h-32 rounded-xl overflow-hidden glass neon-border mb-2">
                  <img
                    src={album.coverUrl}
                    alt={`${album.title} album cover`}
                    loading="lazy"
                    className="w-full h-full object-cover"
                  />
                </div>
                <p className="text-xs font-medium text-foreground truncate">{album.title}</p>
              </button>
            ))}
          </div>
        </section>
      )}

      {/* Songs */}
      <section className="px-4">
        <h2 className="text-sm font-display tracking-widest text-primary mb-3 px-2">
          SONGS ({tracks.length})
        </h2>
        <div className="space-y-1">
          {tracks.map((track, position) => {
            const active = currentTrack?.id === track.id && contextId === (id ?? null);
            return (
              <TrackItem
                key={track.id}
                track={track}
                index={position}
                isActive={active}
                isPlaying={active && isPlaying}
                onPlay={() => playFrom(position)}
              />
            );
          })}
        </div>
      </section>
    </div>
  );
};

export default ArtistDetail;
