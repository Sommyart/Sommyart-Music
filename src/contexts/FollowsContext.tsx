import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";

// The generated types do not know the follow table yet.
const db = supabase as any;

type FollowResult = "followed" | "unfollowed" | "signin" | "error";

type FollowsContextType = {
  followedIds: Set<string>;
  loading: boolean;
  signedIn: boolean;
  isFollowing: (artistId: string) => boolean;
  toggleFollow: (artistId: string) => Promise<FollowResult>;
};

const FollowsContext = createContext<FollowsContextType | null>(null);

export function FollowsProvider({ children }: { children: ReactNode }) {
  const [followedIds, setFollowedIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [signedIn, setSignedIn] = useState(false);
  const userIdRef = useRef<string | null>(null);

  const loadFor = useCallback(async (uid: string | null) => {
    userIdRef.current = uid;
    setSignedIn(!!uid);
    if (!uid) {
      setFollowedIds(new Set());
      setLoading(false);
      return;
    }
    const { data } = await db.from("artist_follows").select("artist_id").eq("user_id", uid);
    if (userIdRef.current !== uid) return;
    setFollowedIds(new Set((data ?? []).map((r: { artist_id: string }) => r.artist_id)));
    setLoading(false);
  }, []);

  useEffect(() => {
    let cancelled = false;
    supabase.auth.getSession().then(({ data }) => {
      if (!cancelled) loadFor(data.session?.user.id ?? null);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      loadFor(session?.user.id ?? null);
    });
    return () => {
      cancelled = true;
      sub.subscription.unsubscribe();
    };
  }, [loadFor]);

  const toggleFollow = useCallback(async (artistId: string): Promise<FollowResult> => {
    const uid = userIdRef.current;
    if (!uid) return "signin";
    const wasFollowing = followedIds.has(artistId);
    setFollowedIds((prev) => {
      const next = new Set(prev);
      if (wasFollowing) next.delete(artistId);
      else next.add(artistId);
      return next;
    });
    const { error } = wasFollowing
      ? await db.from("artist_follows").delete().eq("user_id", uid).eq("artist_id", artistId)
      : await db.from("artist_follows").insert({ user_id: uid, artist_id: artistId });
    if (error && error.code !== "23505") {
      // Put the button back the way it was.
      setFollowedIds((prev) => {
        const next = new Set(prev);
        if (wasFollowing) next.add(artistId);
        else next.delete(artistId);
        return next;
      });
      return "error";
    }
    return wasFollowing ? "unfollowed" : "followed";
  }, [followedIds]);

  const value = useMemo<FollowsContextType>(
    () => ({ followedIds, loading, signedIn, isFollowing: (id) => followedIds.has(id), toggleFollow }),
    [followedIds, loading, signedIn, toggleFollow],
  );

  return <FollowsContext.Provider value={value}>{children}</FollowsContext.Provider>;
}

export function useFollows() {
  const ctx = useContext(FollowsContext);
  if (!ctx) throw new Error("useFollows must be used inside FollowsProvider");
  return ctx;
}
