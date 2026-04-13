import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

export function useFavourites() {
  const [favouriteIds, setFavouriteIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);

  const fetchFavourites = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      setFavouriteIds(new Set());
      setLoading(false);
      return;
    }

    const { data } = await supabase
      .from("favourites")
      .select("song_id")
      .eq("user_id", user.id);

    setFavouriteIds(new Set((data || []).map((f) => f.song_id)));
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchFavourites();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(() => {
      fetchFavourites();
    });

    return () => subscription.unsubscribe();
  }, [fetchFavourites]);

  const toggleFavourite = useCallback(async (songId: string) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const isFav = favouriteIds.has(songId);

    // Optimistic update
    setFavouriteIds((prev) => {
      const next = new Set(prev);
      if (isFav) next.delete(songId);
      else next.add(songId);
      return next;
    });

    if (isFav) {
      await supabase
        .from("favourites")
        .delete()
        .eq("user_id", user.id)
        .eq("song_id", songId);
    } else {
      await supabase
        .from("favourites")
        .insert({ user_id: user.id, song_id: songId });
    }
  }, [favouriteIds]);

  const isFavourite = useCallback((songId: string) => favouriteIds.has(songId), [favouriteIds]);

  return { favouriteIds, toggleFavourite, isFavourite, loading };
}
