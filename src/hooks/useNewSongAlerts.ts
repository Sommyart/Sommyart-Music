import { useEffect, useRef } from "react";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useFollows } from "@/contexts/FollowsContext";
import { useMusicPlayerContext } from "@/contexts/MusicPlayerContext";
import { getNotifyMode, onNotificationTapped, showSystemNotification } from "@/lib/notify";

const db = supabase as any;

type Incoming = { id: string; title: string; album_id: string | null; artist_id: string | null; artist: string };

/**
 * Real-time alerts. Listens for songs being published and tells the listener while the app is open
 * (on screen, or in the background on a phone where the app process is still alive).
 * People who follow the artist get a personal message; everyone else gets a general one unless they chose "followed only".
 */
export function useNewSongAlerts() {
  const navigate = useNavigate();
  const { followedIds, loading: followsLoading } = useFollows();
  const { refetchSongs } = useMusicPlayerContext();
  const followedRef = useRef(followedIds);
  followedRef.current = followedIds;
  const refetchRef = useRef(refetchSongs);
  refetchRef.current = refetchSongs;
  const readyRef = useRef(!followsLoading);
  readyRef.current = !followsLoading;
  const seen = useRef<Set<string>>(new Set());

  useEffect(() => onNotificationTapped((route) => navigate(route)), [navigate]);

  useEffect(() => {
    let batch: Incoming[] = [];
    let timer: number | undefined;

    const flush = async () => {
      timer = undefined;
      const items = batch;
      batch = [];
      if (!items.length) return;

      // Refresh the library first so Listen leads to a song that is really in the list.
      await refetchRef.current().catch(() => {});

      // Collaborators also count as "their" song for followers.
      const ids = items.map((i) => i.id);
      const collab = new Map<string, string[]>();
      const { data } = await db.from("song_artists").select("song_id, artist_id").in("song_id", ids);
      (data ?? []).forEach((r: { song_id: string; artist_id: string }) => {
        collab.set(r.song_id, [...(collab.get(r.song_id) ?? []), r.artist_id]);
      });
      const followed = followedRef.current;
      const mine = items.filter((i) => [i.artist_id, ...(collab.get(i.id) ?? [])].some((a) => a && followed.has(a)));

      const mode = getNotifyMode();
      if (mode === "off") return;
      if (mode === "following" && mine.length === 0) return;

      const pool = mine.length ? mine : items;
      const first = pool[0];
      const personal = mine.length > 0;
      const same = pool.every((p) => p.artist_id === first.artist_id);
      const inAlbum = pool.length > 1 && pool.every((p) => p.album_id && p.album_id === first.album_id);

      let title: string;
      let body: string;
      let route: string;
      if (pool.length === 1) {
        title = personal ? `${first.artist} just released a new song` : "New song on Sommyart Music";
        body = personal ? first.title : `${first.title} by ${first.artist}`;
        route = `/song/${first.id}`;
      } else if (inAlbum) {
        title = personal ? `${first.artist} released a new album` : "New album on Sommyart Music";
        body = `${pool.length} new tracks including "${first.title}"`;
        route = `/album/${first.album_id}`;
      } else {
        title = personal ? "New songs from artists you follow" : "New songs on Sommyart Music";
        body = same ? `${pool.length} new songs from ${first.artist}` : `"${first.title}" and ${pool.length - 1} more`;
        route = "/";
      }

      toast.success(title, {
        description: body,
        duration: 8000,
        action: { label: "Open", onClick: () => navigate(route) },
      });
      // Also raise a system notification when the app is not in front of the listener.
      if (document.visibilityState !== "visible") {
        await showSystemNotification({ title, body, route, tag: "sommyart-new-song" });
      }
    };

    const channel = supabase
      .channel("new-songs-alerts")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "songs" }, (payload) => {
        const row = payload.new as Record<string, any>;
        if (!row?.id || seen.current.has(row.id)) return;
        seen.current.add(row.id);
        batch.push({
          id: row.id,
          title: row.title ?? "New song",
          album_id: row.album_id ?? null,
          artist_id: row.artist_id ?? null,
          artist: row.artist ?? "an artist",
        });
        // Albums arrive track by track; wait a moment so they become one alert.
        if (timer) window.clearTimeout(timer);
        timer = window.setTimeout(flush, 6000);
      })
      .subscribe();

    return () => {
      if (timer) window.clearTimeout(timer);
      supabase.removeChannel(channel);
    };
  }, [navigate]);
}
