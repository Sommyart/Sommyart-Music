import { Play, Pause, Download, Check, Loader2, Heart } from "lucide-react";
import { Track } from "@/lib/tracks";
import { useState, useEffect } from "react";
import { extractCoverArt } from "@/lib/extractCoverArt";
import { useDownloadContext } from "@/contexts/DownloadContext";
import { useFavouritesContext } from "@/contexts/FavouritesContext";

interface Props {
  track: Track;
  index: number;
  isActive: boolean;
  isPlaying: boolean;
  onPlay: () => void;
}

export function TrackItem({ track, index, isActive, isPlaying, onPlay }: Props) {
  const [cover, setCover] = useState<string | null>(null);
  const { downloadTrack, isDownloaded, isDownloading } = useDownloadContext();
  const { isFavourite, toggleFavourite } = useFavouritesContext();

  useEffect(() => {
    extractCoverArt(track.audioUrl).then((c) => {
      if (c) setCover(c);
    });
  }, [track.audioUrl]);

  const displayCover = cover || track.coverUrl;
  const downloaded = isDownloaded(track.id);
  const downloading = isDownloading(track.id);

  const handleDownload = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!downloaded && !downloading) {
      downloadTrack(track);
    }
  };

  const handleFavourite = (e: React.MouseEvent) => {
    e.stopPropagation();
    toggleFavourite(track.id);
  };

  const fav = isFavourite(track.id);

  return (
    <button
      onClick={onPlay}
      className={`w-full flex items-center gap-3 p-3 rounded-xl transition-all ${
        isActive ? "glass neon-border" : "hover:bg-secondary/50"
      }`}
    >
      <div className={`w-10 h-10 rounded-lg overflow-hidden flex-shrink-0 ${isActive ? "neon-glow" : ""}`}>
        <img src={displayCover} alt={track.title} className="w-full h-full object-cover" />
      </div>
      <div className="flex-1 text-left min-w-0">
        <p className={`text-sm font-medium truncate ${isActive ? "text-primary neon-text" : "text-foreground"}`}>
          {track.title}
        </p>
        <div className="flex items-center gap-2">
          <p className="text-xs text-muted-foreground truncate">{track.artist}</p>
          {track.genre && (
            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-primary/10 text-primary shrink-0">
              {track.genre}
            </span>
          )}
        </div>
      </div>
      {/* Favourite button */}
      <div
        onClick={handleFavourite}
        role="button"
        tabIndex={0}
        aria-label={fav ? "Remove from favourites" : "Add to favourites"}
        className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 transition-colors ${
          fav ? "text-red-500" : "text-muted-foreground hover:text-red-400"
        }`}
      >
        <Heart size={14} fill={fav ? "currentColor" : "none"} />
      </div>
      {/* Download button */}
      <div
        onClick={handleDownload}
        role="button"
        tabIndex={0}
        aria-label={downloaded ? "Downloaded" : downloading ? "Downloading" : "Download for offline"}
        className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 transition-colors ${
          downloaded
            ? "text-green-400"
            : downloading
            ? "text-primary animate-spin"
            : "text-muted-foreground hover:text-primary"
        }`}
      >
        {downloaded ? (
          <Check size={14} />
        ) : downloading ? (
          <Loader2 size={14} />
        ) : (
          <Download size={14} />
        )}
      </div>
      {/* Play/Pause */}
      <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${isActive ? "text-primary" : "text-muted-foreground"}`}>
        {isActive && isPlaying ? <Pause size={16} /> : <Play size={16} className="ml-0.5" />}
      </div>
    </button>
  );
}
