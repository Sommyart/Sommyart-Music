import { toast } from "@/hooks/use-toast";
import { Track } from "@/lib/tracks";

/** Share a song with the phone's share sheet, or copy its link where that is not available. */
export async function shareTrack(track: Track) {
  const url = `${window.location.origin}/song/${track.id}`;
  const data = {
    title: `${track.title} — ${track.artist}`,
    text: `Listen to ${track.title} by ${track.artist} on Sommyart Music`,
    url,
  };
  try {
    if (navigator.share) {
      await navigator.share(data);
    } else {
      await navigator.clipboard.writeText(url);
      toast({ title: "Link copied", description: url });
    }
  } catch {
    /* share cancelled */
  }
}
