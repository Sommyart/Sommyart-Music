import { ChevronDown, Mic2 } from "lucide-react";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { HolographicArtwork } from "@/components/player/HolographicArtwork";
import { WaveformVisualizer } from "@/components/player/WaveformVisualizer";
import { ProgressBar } from "@/components/player/ProgressBar";
import { PlayerControls } from "@/components/player/PlayerControls";
import { LyricsView } from "@/components/player/LyricsView";
import { useMusicPlayerContext } from "@/contexts/MusicPlayerContext";
import { cn } from "@/lib/utils";

const PlayerScreen = () => {
  const navigate = useNavigate();
  const player = useMusicPlayerContext();
  const [showLyrics, setShowLyrics] = useState(false);

  const hasLyrics = !!(player.currentTrack?.lyrics && player.currentTrack.lyrics.length);

  return (
    <div className="min-h-screen flex flex-col relative">
      {/* Background glow */}
      <div className="absolute inset-0 bg-gradient-to-b from-neon-cyan/5 via-transparent to-neon-purple/5 pointer-events-none" />

      {/* Header */}
      <div className="relative flex items-center justify-between px-6 pt-12 pb-4">
        <button onClick={() => navigate(-1)} className="text-muted-foreground hover:text-foreground transition-colors">
          <ChevronDown size={28} />
        </button>
        <span className="text-xs font-display tracking-widest text-muted-foreground">
          {showLyrics ? "LYRICS" : "NOW PLAYING"}
        </span>
        <button
          onClick={() => hasLyrics && setShowLyrics((s) => !s)}
          disabled={!hasLyrics}
          aria-label="Toggle lyrics"
          className={cn(
            "transition-colors",
            !hasLyrics && "opacity-30 cursor-not-allowed",
            hasLyrics && (showLyrics ? "text-primary neon-text" : "text-muted-foreground hover:text-foreground")
          )}
        >
          <Mic2 size={22} />
        </button>
      </div>

      {/* Main area: artwork OR lyrics */}
      <div className="flex-1 flex flex-col items-center justify-center px-2 min-h-0">
        {showLyrics && hasLyrics ? (
          <div className="w-full flex-1 min-h-0">
            <LyricsView
              lyrics={player.currentTrack!.lyrics!}
              currentTime={player.currentTime}
            />
          </div>
        ) : (
          <>
            <HolographicArtwork track={player.currentTrack} isPlaying={player.isPlaying} />
            <div className="text-center mt-6 mb-4">
              <h2 className="text-xl font-display font-bold tracking-wide text-foreground neon-text">
                {player.currentTrack?.title || "No Track"}
              </h2>
              <p className="text-sm text-muted-foreground mt-1">{player.currentTrack?.artist || "—"}</p>
            </div>
            <WaveformVisualizer isPlaying={player.isPlaying} />
          </>
        )}
      </div>

      {/* Controls */}
      <div className="relative px-6 pb-12 space-y-6">
        <ProgressBar
          currentTime={player.currentTime}
          duration={player.duration}
          onSeek={player.seek}
        />
        <PlayerControls
          isPlaying={player.isPlaying}
          shuffle={player.shuffle}
          repeat={player.repeat}
          onTogglePlay={player.togglePlay}
          onNext={player.handleNext}
          onPrev={player.handlePrev}
          onShuffle={player.setShuffle}
          onRepeat={player.setRepeat}
        />
      </div>
    </div>
  );
};

export default PlayerScreen;
