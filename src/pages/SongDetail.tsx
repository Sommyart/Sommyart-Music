import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { ArrowLeft, Play, Share2, ListMusic, CornerDownRight, Lock } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useMusicPlayerContext } from "@/contexts/MusicPlayerContext";
import { SEO } from "@/components/SEO";
import { setPendingDestination } from "@/lib/pendingDestination";
import { toast } from "@/hooks/use-toast";
import { Track } from "@/lib/tracks";

const SongDetail = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const { allTracks, songsLoading, playSingle, playNext, addToQueue } = useMusicPlayerContext();
  const [authed, setAuthed] = useState<boolean | null>(null);
  const autoplay = params.get("autoplay") === "1";

  const track: Track | null = useMemo(
    () => allTracks.find((t) => t.id === id) ?? null,
    [allTracks, id],
  );

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setAuthed(!!data.session));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => setAuthed(!!session));
    return () => sub.subscription.unsubscribe();
  }, []);

  // Keep the shared destination so the user lands back here after signing up.
  useEffect(() => {
    if (authed === false && id) setPendingDestination(`/song/${id}?autoplay=1`);
  }, [authed, id]);

  // The shared song becomes the first item of the session — nothing else autoplays.
  const [started, setStarted] = useState(false);
  useEffect(() => {
    if (!autoplay || started || !track || authed !== true) return;
    setStarted(true);
    playSingle(track);
    navigate(`/player`, { replace: true });
  }, [autoplay, started, track, authed, playSingle, navigate]);

  const shareUrl = `${window.location.origin}/song/${id}`;

  const handleShare = async () => {
    if (!track) return;
    try {
      if (navigator.share) {
        await navigator.share({
          title: `${track.title} — ${track.artist}`,
          text: `Listen to ${track.title} by ${track.artist} on Sommyart Music`,
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

  if (songsLoading) {
    return (
      <div className="min-h-screen flex justify-center pt-32">
        <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!track) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 px-6 text-center">
        <p className="text-sm text-muted-foreground">This song is no longer available.</p>
        <button onClick={() => navigate("/")} className="text-primary text-sm">
          Back home
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen pb-36">
      <SEO
        title={`${track.title} — ${track.artist} | Sommyart Music`}
        description={`Listen to ${track.title} by ${track.artist}${
          track.genre ? ` (${track.genre})` : ""
        } on Sommyart Music.`}
        path={`/song/${track.id}`}
        image={track.coverUrl}
        type="music.song"
        jsonLd={{
          "@context": "https://schema.org",
          "@type": "MusicRecording",
          name: track.title,
          byArtist: { "@type": "MusicGroup", name: track.artist },
          genre: track.genre ?? undefined,
        }}
      />

      <div className="px-6 pt-6">
        <button
          onClick={() => navigate(-1)}
          aria-label="Go back"
          className="mb-5 w-9 h-9 rounded-full glass flex items-center justify-center text-foreground"
        >
          <ArrowLeft size={18} />
        </button>

        <div className="flex flex-col items-center text-center">
          <div className="w-52 h-52 rounded-3xl overflow-hidden neon-glow">
            <img
              src={track.coverUrl}
              alt={`${track.title} artwork`}
              className="w-full h-full object-cover"
            />
          </div>
          <p className="mt-5 text-[10px] font-display tracking-widest text-primary">SONG</p>
          <h1 className="text-2xl font-display font-bold text-foreground neon-text leading-tight">
            {track.title}
          </h1>
          <p className="text-sm text-muted-foreground mt-1">{track.artist}</p>
          {track.genre && (
            <span className="mt-2 text-[10px] px-2 py-0.5 rounded-full bg-primary/10 text-primary">
              {track.genre}
            </span>
          )}
        </div>

        {authed === false ? (
          <div className="mt-8 glass rounded-2xl p-5 text-center space-y-3">
            <Lock size={20} className="mx-auto text-primary" />
            <p className="text-sm text-foreground">
              Sign in to Sommyart Music to listen to this song.
            </p>
            <p className="text-xs text-muted-foreground">
              Create an account or sign in — you'll come straight back here and playback starts
              automatically.
            </p>
          </div>
        ) : (
          <div className="mt-8 space-y-3">
            <button
              onClick={() => {
                playSingle(track);
                navigate("/player");
              }}
              className="w-full h-12 rounded-full bg-primary text-primary-foreground font-display tracking-wider text-sm flex items-center justify-center gap-2 neon-glow"
            >
              <Play size={16} /> PLAY NOW
            </button>
            <div className="grid grid-cols-3 gap-2">
              <button
                onClick={() => {
                  playNext(track);
                  toast({ title: "Playing next", description: track.title });
                }}
                className="h-11 rounded-xl border border-border/50 text-xs text-muted-foreground hover:text-primary flex items-center justify-center gap-1"
              >
                <CornerDownRight size={14} /> Play next
              </button>
              <button
                onClick={() => {
                  addToQueue(track);
                  toast({ title: "Added to queue", description: track.title });
                }}
                className="h-11 rounded-xl border border-border/50 text-xs text-muted-foreground hover:text-primary flex items-center justify-center gap-1"
              >
                <ListMusic size={14} /> Queue
              </button>
              <button
                onClick={handleShare}
                className="h-11 rounded-xl border border-border/50 text-xs text-muted-foreground hover:text-primary flex items-center justify-center gap-1"
              >
                <Share2 size={14} /> Share
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default SongDetail;
