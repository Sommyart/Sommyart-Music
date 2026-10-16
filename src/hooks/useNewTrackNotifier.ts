import { useEffect, useRef } from "react";
import { toast } from "sonner";
import { Track } from "@/lib/tracks";

const LAST_SEEN_KEY = "sommyart_last_seen_upload";

/**
 * Notifies the user (via toast) when new tracks have been uploaded
 * since they last opened the app.
 */
export function useNewTrackNotifier(songs: Track[], loading: boolean, onView?: () => void) {
  const notifiedRef = useRef(false);

  useEffect(() => {
    if (loading || notifiedRef.current || !songs.length) return;

    // Find tracks with upload timestamps (DB tracks)
    const dated = songs
      .filter((t) => t.uploadedAt)
      .sort((a, b) => new Date(b.uploadedAt!).getTime() - new Date(a.uploadedAt!).getTime());

    if (!dated.length) return;

    const latest = new Date(dated[0].uploadedAt!).getTime();
    const lastSeenRaw = localStorage.getItem(LAST_SEEN_KEY);
    const lastSeen = lastSeenRaw ? parseInt(lastSeenRaw, 10) : 0;

    notifiedRef.current = true;

    // First-ever visit: just record and skip notification
    if (!lastSeen) {
      localStorage.setItem(LAST_SEEN_KEY, String(latest));
      return;
    }

    const newOnes = dated.filter(
      (t) => new Date(t.uploadedAt!).getTime() > lastSeen
    );

    if (newOnes.length === 0) return;

    const description =
      newOnes.length === 1
        ? `"${newOnes[0].title}" by ${newOnes[0].artist}`
        : `Including "${newOnes[0].title}"${
            newOnes.length > 1 ? ` and ${newOnes.length - 1} more` : ""
          }`;

    toast.success(
      newOnes.length === 1 ? "New track added" : `${newOnes.length} new tracks added`,
      {
        description,
        duration: 6000,
        action: onView
          ? {
              label: "Listen",
              onClick: onView,
            }
          : undefined,
      }
    );

    localStorage.setItem(LAST_SEEN_KEY, String(latest));
  }, [songs, loading, onView]);
}
