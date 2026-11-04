import { useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useMusicPlayerContext } from "@/contexts/MusicPlayerContext";
import { onNotificationTapped } from "@/lib/notify";

/**
 * Keeps the song list fresh when songs are published while the app is open, and opens the right screen when a
 * system notification is tapped. The alerts themselves come from the notifications list (NotificationsContext).
 */
export function useNewSongAlerts() {
  const navigate = useNavigate();
  const { refetchSongs } = useMusicPlayerContext();
  const refetchRef = useRef(refetchSongs);
  refetchRef.current = refetchSongs;

  useEffect(() => onNotificationTapped((route) => navigate(route)), [navigate]);

  useEffect(() => {
    let timer: number | undefined;
    const channel = supabase
      .channel("new-songs-refresh")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "songs" }, () => {
        // Albums arrive track by track; refresh once things settle.
        if (timer) window.clearTimeout(timer);
        timer = window.setTimeout(() => refetchRef.current().catch(() => {}), 6000);
      })
      .subscribe();
    return () => {
      if (timer) window.clearTimeout(timer);
      supabase.removeChannel(channel);
    };
  }, []);
}
