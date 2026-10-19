import { Heart } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useFavouritesContext } from "@/contexts/FavouritesContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { Track } from "@/lib/tracks";
import { cn } from "@/lib/utils";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Heart button for the song that is playing. Pops when you like a song. */
export function LikeButton({ track, className = "" }: { track: Track | null; className?: string }) {
  const { isFavourite, toggleFavourite } = useFavouritesContext();
  const [pop, setPop] = useState(false);
  const timer = useRef<number>();
  useEffect(() => () => window.clearTimeout(timer.current), []);

  const liked = !!track && isFavourite(track.id);

  const onClick = async () => {
    if (!track) return;
    if (!UUID.test(track.id)) {
      toast({ title: "Cannot like this song yet", description: "Only songs from the online library can be liked." });
      return;
    }
    const { data } = await supabase.auth.getSession();
    if (!data.session) {
      toast({ title: "Sign in to like songs", description: "Your liked songs are saved to your account." });
      return;
    }
    if (!liked) {
      setPop(true);
      timer.current = window.setTimeout(() => setPop(false), 450);
    }
    toggleFavourite(track.id);
  };

  return (
    <button
      onClick={onClick}
      disabled={!track}
      aria-label={liked ? "Remove from liked songs" : "Add to liked songs"}
      aria-pressed={liked}
      className={cn(
        "w-11 h-11 rounded-full flex items-center justify-center transition-colors disabled:opacity-30",
        liked ? "text-primary" : "text-muted-foreground hover:text-foreground",
        className,
      )}
    >
      <Heart size={22} fill={liked ? "currentColor" : "none"} className={cn(pop && "animate-heart-pop", liked && "drop-shadow-[0_0_6px_hsl(var(--primary)/0.7)]")} />
    </button>
  );
}
