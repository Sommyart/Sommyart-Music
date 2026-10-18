import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { ArrowLeft, Play, Disc3, Share2, Lock } from "lucide-react";
import { DownloadCollectionButton } from "@/components/DownloadCollectionButton";
import { supabase } from "@/integrations/supabase/client";
import { setPendingDestination } from "@/lib/pendingDestination";
import { toast } from "@/hooks/use-toast";
import { useAlbum } from "@/hooks/useAlbums";
import { useMusicPlayerContext } from "@/contexts/MusicPlayerContext";
import { TrackItem } from "@/components/playlist/TrackItem";
import { SEO } from "@/components/SEO";

const AlbumDetail = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const { album, tracks, artist, loading } = useAlbum(id);
  const { currentTrack, isPlaying, playContext, contextId } = useMusicPlayerContext();
  const [authed, setAuthed] = useState<boolean | null>(null);
  const [started, setStarted] = useState(false);
  const autoplay = params.get("autoplay") === "1";

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setAuthed(!!data.session));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => setAuthed(!!session));
    return () => sub.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (authed === false && id) setPendingDestination(`/album/${id}?autoplay=1`);
  }, [authed, id]);

  // Album playback is isolated: ONLY this album's tracks form the context.
  const playAlbumFrom = (startIndex: number) => {
    if (!tracks.length) return;
    playContext({ type: "album", id: album?.id ?? id ?? null, tracks, startIndex });
  };

  const handlePlayAlbum = () => playAlbumFrom(0);

  useEffect(() => {
    if (!autoplay || started || authed !== true || !tracks.length) return;
    setStarted(true);
    playAlbumFrom(0);
    navigate("/player", { replace: true });
  }, [autoplay, started, authed, tracks.length]);

  const shareUrl = `${window.location.origin}/album/${id}`;
  const handleShare = async () => {
    if (!album) return;
    try {
      if (navigator.share) {
        await navigator.share({
          title: `${album.title} — ${album.artistName}`,
          text: `Listen to the album ${album.title} by ${album.artistName} on Sommyart Music`,
          url: shareUrl,
        });
      } else {
        await navigator.clipboard.writeText(shareUrl);
        toast({ title: "Link copied", description: shareUrl });
      }
    } catch {
      /* cancelled */
    }
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
        image={album.coverUrl}
        type="music.album"
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

        <div className="mt-5 flex items-center gap-2">
          <button
            onClick={handlePlayAlbum}
            className="h-11 px-6 rounded-full bg-primary text-primary-foreground font-display tracking-wider text-sm flex items-center gap-2 neon-glow"
          >
            <Play size={16} /> PLAY ALBUM
          </button>
          <DownloadCollectionButton tracks={tracks} label={album.title} />
          <button
            onClick={handleShare}
            aria-label="Share album"
            className="h-11 w-11 rounded-full border border-border/50 flex items-center justify-center text-muted-foreground hover:text-primary"
          >
            <Share2 size={16} />
          </button>
        </div>

        {authed === false && (
          <div className="mt-4 glass rounded-2xl p-4 text-center space-y-1">
            <Lock size={18} className="mx-auto text-primary" />
            <p className="text-sm text-foreground">
              Sign in to Sommyart Music to listen to this album.
            </p>
            <p className="text-xs text-muted-foreground">
              After signing up you'll return here and Track 1 starts automatically.
            </p>
          </div>
        )}
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
          {tracks.map((track, position) => {
            const active =
              currentTrack?.id === track.id && contextId === (album?.id ?? id ?? null);
            return (
              <div key={track.id} className="flex items-center gap-1">
                <span className="w-6 text-center text-xs text-muted-foreground font-display">
                  {track.trackNumber ?? "-"}
                </span>
                <div className="flex-1 min-w-0">
                  <TrackItem
                    track={track}
                    index={position}
                    isActive={active}
                    isPlaying={active && isPlaying}
                    onPlay={() => playAlbumFrom(position)}
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
