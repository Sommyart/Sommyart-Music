import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";

/**
 * Favourites hook. Uses cached session (getSession) instead of getUser() to
 * avoid competing for the Supabase auth navigator-lock — concurrent getUser()
 * calls from multiple hooks trigger "Lock stolen" unhandled rejections.
 */
export function useFavourites() {
  const [favouriteIds, setFavouriteIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const userIdRef = useRef<string | null>(null);

  const loadFor = useCallback(async (uid: string | null) => {
    userIdRef.current = uid;
    if (!uid) {
      setFavouriteIds(new Set());
      setLoading(false);
      return;
    }
    const { data } = await supabase
      .from("favourites")
      .select("song_id")
      .eq("user_id", uid);
    setFavouriteIds(new Set((data || []).map((f) => f.song_id)));
    setLoading(false);
  }, []);

  useEffect(() => {
    let cancelled = false;
    supabase.auth.getSession().then(({ data }) => {
      if (cancelled) return;
      loadFor(data.session?.user.id ?? null);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_evt, session) => {
      loadFor(session?.user.id ?? null);
    });
    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
  }, [loadFor]);

  const toggleFavourite = useCallback(async (songId: string) => {
    const uid = userIdRef.current;
    if (!uid) return;

    const isFav = favouriteIds.has(songId);

    // Optimistic update
    setFavouriteIds((prev) => {
      const next = new Set(prev);
      if (isFav) next.delete(songId);
      else next.add(songId);
      return next;
    });

    if (isFav) {
      await supabase.from("favourites").delete().eq("user_id", uid).eq("song_id", songId);
    } else {
      await supabase.from("favourites").insert({ user_id: uid, song_id: songId });
    }
  }, [favouriteIds]);

  const isFavourite = useCallback((songId: string) => favouriteIds.has(songId), [favouriteIds]);

  return { favouriteIds, toggleFavourite, isFavourite, loading };
}
