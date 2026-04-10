import { Download, Trash2, Play, Pause } from "lucide-react";
import { useDownloadContext } from "@/contexts/DownloadContext";
import { useMusicPlayerContext } from "@/contexts/MusicPlayerContext";
import { useState, useEffect } from "react";
import { extractCoverArt } from "@/lib/extractCoverArt";
import { Track } from "@/lib/tracks";

function DownloadedTrackItem({ track, onRemove }: { track: Track & { downloadedAt: string }; onRemove: () => void }) {
  const { playlist, currentTrackIndex, isPlaying, playTrack } = useMusicPlayerContext();
  const [cover, setCover] = useState<string | null>(null);

  useEffect(() => {
    extractCoverArt(track.audioUrl).then((c) => { if (c) setCover(c); });
  }, [track.audioUrl]);

  const displayCover = cover || track.coverUrl;
  const originalIndex = playlist.findIndex((t) => t.id === track.id);
  const isActive = currentTrackIndex === originalIndex;
  const playing = isActive && isPlaying;

  return (
    <div className={`w-full flex items-center gap-3 p-3 rounded-xl transition-all ${isActive ? "glass neon-border" : "hover:bg-secondary/50"}`}>
      <button onClick={() => originalIndex >= 0 && playTrack(originalIndex)} className="flex items-center gap-3 flex-1 min-w-0">
        <div className={`w-10 h-10 rounded-lg overflow-hidden flex-shrink-0 ${isActive ? "neon-glow" : ""}`}>
          <img src={displayCover} alt={track.title} className="w-full h-full object-cover" />
        </div>
        <div className="flex-1 text-left min-w-0">
          <p className={`text-sm font-medium truncate ${isActive ? "text-primary neon-text" : "text-foreground"}`}>{track.title}</p>
          <p className="text-xs text-muted-foreground truncate">{track.artist}</p>
        </div>
        <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${isActive ? "text-primary" : "text-muted-foreground"}`}>
          {playing ? <Pause size={16} /> : <Play size={16} className="ml-0.5" />}
        </div>
      </button>
      <button onClick={onRemove} className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 text-muted-foreground hover:text-red-400 transition-colors" title="Remove download">
        <Trash2 size={14} />
      </button>
    </div>
  );
}

const DownloadsScreen = () => {
  const { downloadedTracks, loading, removeDownload } = useDownloadContext();

  return (
    <div className="min-h-screen pb-36">
      <div className="px-6 pt-12 pb-6">
        <h1 className="text-xl font-display font-bold tracking-wider text-foreground neon-text">Downloads</h1>
        <p className="text-xs text-muted-foreground mt-1">{downloadedTracks.length} track{downloadedTracks.length !== 1 ? "s" : ""} saved offline</p>
      </div>

      {loading ? (
        <div className="flex justify-center py-8">
          <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      ) : downloadedTracks.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center px-6">
          <div className="w-20 h-20 rounded-full glass neon-border flex items-center justify-center mb-6">
            <Download size={32} className="text-primary" />
          </div>
          <p className="text-foreground font-display text-sm tracking-wide">No downloads yet</p>
          <p className="text-xs text-muted-foreground mt-2 max-w-[240px]">
            Tap the download icon next to any track to save it for offline playback
          </p>
        </div>
      ) : (
        <div className="px-4 space-y-1">
          {downloadedTracks.map((track) => (
            <DownloadedTrackItem key={track.id} track={track} onRemove={() => removeDownload(track)} />
          ))}
        </div>
      )}
    </div>
  );
};

export default DownloadsScreen;
