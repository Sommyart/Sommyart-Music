import { useState } from "react";
import { ArrowDown, Check, Loader2 } from "lucide-react";
import { Track } from "@/lib/tracks";
import { useDownloadContext } from "@/contexts/DownloadContext";
import { toast } from "@/hooks/use-toast";

/**
 * Spotify-style round download toggle for a whole album or playlist.
 * - Outline arrow: nothing (or only part) downloaded. Tap to download the rest.
 * - Spinner + count: downloading.
 * - Filled check: everything downloaded. Tap to remove the downloads.
 */
export function DownloadCollectionButton({
  tracks,
  label,
  size = 44,
}: {
  tracks: Track[];
  label: string;
  size?: number;
}) {
  const { downloadTrack, removeDownload, isDownloaded, isDownloading } = useDownloadContext();
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(0);
  const [target, setTarget] = useState(0);

  const total = tracks.length;
  const downloadedCount = tracks.filter((t) => isDownloaded(t.id)).length;
  const all = total > 0 && downloadedCount === total;
  const anyActive = busy || tracks.some((t) => isDownloading(t.id));

  const onClick = async () => {
    if (!total || busy) return;
    if (all) {
      if (!window.confirm(`Remove the downloaded songs from "${label}"? You can download them again any time.`)) return;
      for (const t of tracks) await removeDownload(t);
      toast({ title: "Removed from downloads", description: label });
      return;
    }
    const missing = tracks.filter((t) => !isDownloaded(t.id));
    if (
      missing.length > 15 &&
      !window.confirm(`Download ${missing.length} songs? This uses roughly ${Math.round(missing.length * 5)} MB of data and storage.`)
    )
      return;
    setBusy(true);
    setDone(0);
    setTarget(missing.length);
    toast({ title: "Downloading", description: `${missing.length} song${missing.length === 1 ? "" : "s"} from ${label}` });
    for (const t of missing) {
      await downloadTrack(t);
      setDone((d) => d + 1);
    }
    setBusy(false);
    toast({ title: "Downloaded", description: `${label} is ready to play offline` });
  };

  const iconSize = Math.round(size * 0.42);
  return (
    <button
      onClick={onClick}
      aria-label={all ? `Remove ${label} downloads` : `Download ${label}`}
      title={all ? "Downloaded" : downloadedCount ? `${downloadedCount} of ${total} downloaded` : "Download"}
      style={{ width: size, height: size }}
      className={`relative rounded-full flex items-center justify-center flex-shrink-0 transition-colors ${
        all
          ? "bg-primary text-primary-foreground neon-glow"
          : "border-2 border-muted-foreground/60 text-muted-foreground hover:text-primary hover:border-primary"
      }`}
    >
      {anyActive ? (
        <>
          <Loader2 size={iconSize} className="animate-spin text-primary" />
          {busy && (
            <span className="absolute -bottom-4 text-[9px] text-primary font-display whitespace-nowrap">
              {done}/{target}
            </span>
          )}
        </>
      ) : all ? (
        <Check size={iconSize} strokeWidth={3} />
      ) : (
        <ArrowDown size={iconSize} strokeWidth={2.5} />
      )}
    </button>
  );
}

/** Small green-arrow badge shown next to a downloaded song, like Spotify. */
export function DownloadedBadge({ downloading }: { downloading?: boolean }) {
  if (downloading) return <Loader2 size={12} className="animate-spin text-primary shrink-0" aria-label="Downloading" />;
  return (
    <span
      className="w-3.5 h-3.5 rounded-full bg-primary text-primary-foreground flex items-center justify-center shrink-0"
      aria-label="Downloaded"
      title="Downloaded"
    >
      <ArrowDown size={9} strokeWidth={3.5} />
    </span>
  );
}
