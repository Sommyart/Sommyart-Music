import { Play, Pause, Download, Heart, MoreVertical, ListMusic, ListEnd, ListPlus, CornerDownRight, Share2, Trash2 } from "lucide-react";
import { DownloadedBadge } from "@/components/DownloadCollectionButton";
import { Track } from "@/lib/tracks";
import { useState, useEffect } from "react";
import { extractCoverArt } from "@/lib/extractCoverArt";
import { useDownloadContext } from "@/contexts/DownloadContext";
import { useFavouritesContext } from "@/contexts/FavouritesContext";
import { useMusicPlayerContext } from "@/contexts/MusicPlayerContext";
import { usePlaylistPicker } from "@/contexts/PlaylistPickerContext";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toast } from "@/hooks/use-toast";
import { shareTrack } from "@/lib/share";

interface Props {
  track: Track;
  index: number;
  isActive: boolean;
  isPlaying: boolean;
  onPlay: () => void;
}

export function TrackItem({ track, index, isActive, isPlaying, onPlay }: Props) {
  const [cover, setCover] = useState<string | null>(null);
  const { downloadTrack, removeDownload, isDownloaded, isDownloading } = useDownloadContext();
  const { isFavourite, toggleFavourite } = useFavouritesContext();
  const { playNext, playLast } = useMusicPlayerContext();
  const { openPlaylistPicker } = usePlaylistPicker();

  useEffect(() => {
    extractCoverArt(track.audioUrl).then((c) => {
      if (c) setCover(c);
    });
  }, [track.audioUrl]);

  const displayCover = cover || track.coverUrl;
  const downloaded = isDownloaded(track.id);
  const downloading = isDownloading(track.id);
  const fav = isFavourite(track.id);

  const handleDownload = () => {
    if (!downloaded && !downloading) {
      downloadTrack(track);
      toast({ title: "Downloading", description: track.title });
    }
  };

  const handleFavourite = (e: React.MouseEvent) => {
    e.stopPropagation();
    toggleFavourite(track.id);
  };

  const handleShare = () => shareTrack(track);

  return (
    <div
      className={`w-full flex items-center gap-3 p-3 rounded-xl transition-all ${
        isActive ? "glass neon-border" : "hover:bg-secondary/50"
      }`}
    >
      <button
        onClick={onPlay}
        aria-label={`Play ${track.title}`}
        className="flex items-center gap-3 flex-1 min-w-0 text-left"
      >
        <div className={`w-10 h-10 rounded-lg overflow-hidden flex-shrink-0 ${isActive ? "neon-glow" : ""}`}>
          <img src={displayCover} alt={`${track.title} artwork`} className="w-full h-full object-cover" />
        </div>
        <div className="flex-1 min-w-0">
          <p className={`text-sm font-medium truncate ${isActive ? "text-primary neon-text" : "text-foreground"}`}>
            {track.title}
          </p>
          <div className="flex items-center gap-1.5">
            {(downloaded || downloading) && <DownloadedBadge downloading={downloading} />}
            <p className="text-xs text-muted-foreground truncate">{track.artist}</p>
            {track.genre && (
              <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-primary/10 text-primary shrink-0">
                {track.genre}
              </span>
            )}
          </div>
        </div>
      </button>

      {/* Favourite */}
      <button
        onClick={handleFavourite}
        aria-label={fav ? "Remove from favourites" : "Add to favourites"}
        className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 transition-colors ${
          fav ? "text-red-500" : "text-muted-foreground hover:text-red-400"
        }`}
      >
        <Heart size={14} fill={fav ? "currentColor" : "none"} />
      </button>

      {/* Play state indicator */}
      <div className="w-6 flex items-center justify-center flex-shrink-0 text-primary">
        {isActive && (isPlaying ? <Pause size={14} fill="currentColor" /> : <Play size={14} fill="currentColor" />)}
      </div>

      {/* Track actions */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            aria-label={`More options for ${track.title}`}
            className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 text-muted-foreground hover:text-primary"
          >
            <MoreVertical size={16} />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-52">
          <DropdownMenuItem onClick={() => { playNext(track); toast({ title: "Playing next", description: track.title }); }}>
            <CornerDownRight size={14} className="mr-2" /> Play next
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => { playLast(track); toast({ title: "Added to the end of the queue", description: track.title }); }}>
            <ListEnd size={14} className="mr-2" /> Play last
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => openPlaylistPicker(track)}>
            <ListPlus size={14} className="mr-2" /> Add to playlist
          </DropdownMenuItem>
          {downloaded ? (
            <DropdownMenuItem onClick={() => { removeDownload(track); toast({ title: "Removed from downloads", description: track.title }); }}>
              <Trash2 size={14} className="mr-2" /> Remove download
            </DropdownMenuItem>
          ) : (
            <DropdownMenuItem onClick={handleDownload} disabled={downloading}>
              <Download size={14} className="mr-2" /> {downloading ? "Downloading…" : "Download"}
            </DropdownMenuItem>
          )}
          <DropdownMenuItem onClick={handleShare}>
            <Share2 size={14} className="mr-2" /> Share song
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
