import { ChevronDown } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { HolographicArtwork } from "@/components/player/HolographicArtwork";
import { WaveformVisualizer } from "@/components/player/WaveformVisualizer";
import { ProgressBar } from "@/components/player/ProgressBar";
import { PlayerControls } from "@/components/player/PlayerControls";
import { useMusicPlayerContext } from "@/contexts/MusicPlayerContext";

const PlayerScreen = () => {
  const navigate = useNavigate();
  const player = useMusicPlayerContext();

  return (
    <div className="min-h-screen flex flex-col relative">
      {/* Background glow */}
      <div className="absolute inset-0 bg-gradient-to-b from-neon-cyan/5 via-transparent to-neon-purple/5 pointer-events-none" />

      {/* Header */}
      <div className="relative flex items-center justify-between px-6 pt-12 pb-4">
        <button onClick={() => navigate(-1)} className="text-muted-foreground hover:text-foreground transition-colors">
          <ChevronDown size={28} />
        </button>
        <span className="text-xs font-display tracking-widest text-muted-foreground">NOW PLAYING</span>
        <div className="w-7" />
      </div>

      {/* Artwork */}
      <div className="flex-1 flex flex-col items-center justify-center px-6">
        <HolographicArtwork track={player.currentTrack} isPlaying={player.isPlaying} />

        {/* Track Info */}
        <div className="text-center mt-6 mb-4">
          <h2 className="text-xl font-display font-bold tracking-wide text-foreground neon-text">
            {player.currentTrack?.title || "No Track"}
          </h2>
          <p className="text-sm text-muted-foreground mt-1">{player.currentTrack?.artist || "—"}</p>
        </div>

        {/* Waveform */}
        <WaveformVisualizer isPlaying={player.isPlaying} />
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
