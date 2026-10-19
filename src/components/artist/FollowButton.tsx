import { useEffect, useState } from "react";
import { Bell, BellRing, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useFollows } from "@/contexts/FollowsContext";
import { getNotifyPermission, hasAskedForPermission } from "@/lib/notify";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

/** Follow / Following button for an artist, with the follower count. */
export function FollowButton({ artistId, artistName, className = "" }: { artistId: string; artistName: string; className?: string }) {
  const { isFollowing, toggleFollow, loading } = useFollows();
  const [busy, setBusy] = useState(false);
  const [count, setCount] = useState<number | null>(null);
  const following = isFollowing(artistId);

  useEffect(() => {
    let cancelled = false;
    (supabase as any).rpc("artist_follower_count", { p_artist: artistId }).then(({ data }: { data: number | null }) => {
      if (!cancelled && typeof data === "number") setCount(data);
    });
    return () => { cancelled = true; };
  }, [artistId]);

  const onClick = async () => {
    if (busy) return;
    setBusy(true);
    const result = await toggleFollow(artistId);
    setBusy(false);
    if (result === "signin") {
      toast("Sign in to follow artists", { description: "Then you will hear about their new songs." });
    } else if (result === "error") {
      toast.error("Could not update follow", { description: "Check your connection and try again." });
    } else if (result === "followed") {
      setCount((c) => (c ?? 0) + 1);
      const perm = await getNotifyPermission();
      toast.success(`Following ${artistName}`, {
        description:
          perm === "granted"
            ? "You will be notified when they release a new song."
            : hasAskedForPermission()
              ? "Turn on notifications with the bell on Home to hear about new songs."
              : "You will see their new songs when you open the app.",
      });
    } else {
      setCount((c) => Math.max(0, (c ?? 1) - 1));
    }
  };

  return (
    <button
      onClick={onClick}
      disabled={loading}
      aria-pressed={following}
      aria-label={following ? `Unfollow ${artistName}` : `Follow ${artistName}`}
      className={cn(
        "h-11 px-5 rounded-full text-sm font-display tracking-wider flex items-center gap-2 border transition-all",
        following ? "border-primary text-primary bg-primary/10" : "border-border/60 text-foreground hover:border-primary/60",
        className,
      )}
    >
      {busy ? <Loader2 size={16} className="animate-spin" /> : following ? <BellRing size={16} /> : <Bell size={16} />}
      {following ? "FOLLOWING" : "FOLLOW"}
      {count !== null && count > 0 && <span className="text-xs opacity-70 normal-case tracking-normal">{count}</span>}
    </button>
  );
}
