import { useMemo } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Play, Disc3 } from "lucide-react";
import { useAlbum } from "@/hooks/useAlbums";
import { useMusicPlayerContext } from "@/contexts/MusicPlayerContext";
import { TrackItem } from "@/components/playlist/TrackItem";
import { SEO } from "@/components/SEO";

const AlbumDetail = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { album, tracks, artist, loading } = useAlbum(id);
  const { playlist, currentTrackIndex, isPlaying, playTrack } = useMusicPlayerContext();

  const indexOf = (trackId: string) => playlist.findIndex((t) => t.id === trackId);

  const handlePlayAlbum = () => {
    const first = tracks[0];
    if (!first) return;
    const idx = indexOf(first.id);
    if (idx >= 0) playTrack(idx);
  };

  const jsonLd = useMemo(() => {
    if (!album) return undefined;
    return {
      "@context": "https://schema.org",
      "@type": "MusicAlbum",
      name: album.title,
      byArtist: { "@type": "MusicGroup", name: album.artistName },
      numTracks: tracks.length,
      genre: album.genre ?? undefined,
      description: album.description ?? undefined,
    };
  }, [album, tracks.length]);

  if (loading) {
    return (
      <div className="min-h-screen flex justify-center pt-32">
        <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!album) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4">
        <p className="text-sm text-muted-foreground">Album not found</p>
        <button onClick={() => navigate("/albums")} className="text-primary text-sm">
          Back to albums
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen pb-36">
      <SEO
        title={`${album.title} — ${album.artistName}`}
        description={
          album.description ??
          `Stream ${album.title} by ${album.artistName} on Sommyart Music.`
        }
        path={`/album/${album.id}`}
        jsonLd={jsonLd}
      />

      {/* Cover header */}
      <div className="relative px-6 pt-6 pb-4">
        <button
          onClick={() => navigate(-1)}
          aria-label="Go back"
          className="mb-4 w-9 h-9 rounded-full glass flex items-center justify-center text-foreground"
        >
          <ArrowLeft size={18} />
        </button>
        <div className="flex gap-4 items-end">
          <div className="w-32 h-32 rounded-2xl overflow-hidden neon-glow shrink-0">
            <img
              src={album.coverUrl}
              alt={`${album.title} album cover`}
              width={512}
              height={512}
              className="w-full h-full object-cover"
            />
          </div>
          <div className="min-w-0">
            <p className="text-[10px] font-display tracking-widest text-primary">ALBUM</p>
            <h1 className="text-xl font-display font-bold text-foreground leading-tight">
              {album.title}
            </h1>
            <button
              onClick={() => album.artistId && navigate(`/artist/${album.artistId}`)}
              className="text-sm text-muted-foreground hover:text-primary transition-colors text-left"
            >
              {album.artistName}
            </button>
            <p className="text-[10px] text-muted-foreground flex items-center gap-1 mt-1">
              <Disc3 size={10} /> {tracks.length} tracks
              {album.genre ? ` · ${album.genre}` : ""}
            </p>
          </div>
        </div>

        <button
          onClick={handlePlayAlbum}
          className="mt-5 h-11 px-6 rounded-full bg-primary text-primary-foreground font-display tracking-wider text-sm flex items-center gap-2 neon-glow"
        >
          <Play size={16} /> PLAY ALBUM
        </button>
      </div>

      {/* About the artist */}
      {artist?.bio && (
        <section className="px-6 py-4">
          <h2 className="text-sm font-display tracking-widest text-primary mb-2">
            ABOUT THE ARTIST
          </h2>
          <p className="text-sm text-muted-foreground leading-relaxed">{artist.bio}</p>
          <button
            onClick={() => navigate(`/artist/${artist.id}`)}
            className="mt-3 text-xs text-primary font-display tracking-wider"
          >
            VIEW ARTIST →
          </button>
        </section>
      )}

      {/* Tracklist */}
      <section className="px-4 mt-2">
        <h2 className="text-sm font-display tracking-widest text-primary mb-3 px-2">
          TRACKLIST
        </h2>
        <div className="space-y-1">
          {tracks.map((track) => {
            const idx = indexOf(track.id);
            return (
              <div key={track.id} className="flex items-center gap-1">
                <span className="w-6 text-center text-xs text-muted-foreground font-display">
                  {track.trackNumber ?? "-"}
                </span>
                <div className="flex-1 min-w-0">
                  <TrackItem
                    track={track}
                    index={idx}
                    isActive={currentTrackIndex === idx}
                    isPlaying={currentTrackIndex === idx && isPlaying}
                    onPlay={() => idx >= 0 && playTrack(idx)}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
};

export default AlbumDetail;
