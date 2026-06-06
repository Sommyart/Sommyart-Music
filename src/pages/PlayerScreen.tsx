import { ChevronDown, Mic2, Volume2, Bluetooth, Cast } from "lucide-react";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { HolographicArtwork } from "@/components/player/HolographicArtwork";
import { WaveformVisualizer } from "@/components/player/WaveformVisualizer";
import { ProgressBar } from "@/components/player/ProgressBar";
import { PlayerControls } from "@/components/player/PlayerControls";
import { LyricsView } from "@/components/player/LyricsView";
import { InlineLyricsTicker } from "@/components/player/InlineLyricsTicker";
import { DeviceSheet } from "@/components/player/DeviceSheet";
import { useMusicPlayerContext } from "@/contexts/MusicPlayerContext";
import { SEO } from "@/components/SEO";
import { cn } from "@/lib/utils";

const PlayerScreen = () => {
  const navigate = useNavigate();
  const player = useMusicPlayerContext();
  const [showLyrics, setShowLyrics] = useState(false);

  const hasLyrics = !!(player.currentTrack?.lyrics && player.currentTrack.lyrics.length);

  const trackTitle = player.currentTrack
    ? `${player.currentTrack.title} — ${player.currentTrack.artist}`
    : "Now Playing";

  return (
    <div className="min-h-screen flex flex-col relative">
      <SEO
        title={`${trackTitle} | Sommyart Music Player`}
        description={`Holographic full-screen player with lyrics and waveform visualizer. ${player.currentTrack ? `Now playing ${player.currentTrack.title} by ${player.currentTrack.artist}.` : "Stream exclusive neon tracks on Sommyart Music."}`}
        path="/player"
      />
      {/* Background glow */}
      <div className="absolute inset-0 bg-gradient-to-b from-neon-cyan/5 via-transparent to-neon-purple/5 pointer-events-none" />

      {/* Header */}
      <div className="relative flex items-center justify-between px-6 pt-12 pb-2">
        <button onClick={() => navigate(-1)} aria-label="Go back" className="text-muted-foreground hover:text-foreground transition-colors">
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

      {/* Connect bar — output device + transfer */}
      <div className="relative px-6 pb-2">
        <DeviceSheet
          trigger={
            <button
              className={cn(
                "w-full flex items-center justify-between gap-2 rounded-lg border px-3 py-2 text-xs transition-all",
                player.isThisDeviceActive
                  ? "border-primary/40 text-primary hover:bg-primary/5"
                  : "border-amber-400/50 text-amber-300 bg-amber-400/5 hover:bg-amber-400/10"
              )}
              aria-label="Connect to a device"
            >
              <span className="flex items-center gap-2 min-w-0">
                {(() => {
                  const label = player.activeDevice?.output_label || "";
                  const Icon = /bluetooth|airpods|buds|headset|wireless/i.test(label) ? Bluetooth : Volume2;
                  return <Icon size={14} className="shrink-0" />;
                })()}
                <span className="truncate">
                  {player.isThisDeviceActive ? "Playing on " : "Listening on "}
                  <span className="font-medium">
                    {player.activeDevice?.name || "this device"}
                  </span>
                  {player.activeDevice?.output_label && (
                    <span className="text-muted-foreground"> · {player.activeDevice.output_label}</span>
                  )}
                </span>
              </span>
              <Cast size={14} className="shrink-0 opacity-70" />
            </button>
          }
        />
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
              <h1 className="text-xl font-display font-bold tracking-wide text-foreground neon-text">
                {player.currentTrack?.title || "No Track"}
              </h1>
              <p className="text-sm text-muted-foreground mt-1">{player.currentTrack?.artist || "—"}</p>
            </div>
            {hasLyrics ? (
              <InlineLyricsTicker
                lyrics={player.currentTrack!.lyrics!}
                currentTime={player.currentTime}
              />
            ) : (
              <WaveformVisualizer isPlaying={player.isPlaying} />
            )}
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
        <div className="flex items-center justify-center gap-2">
          {[0.75, 1, 1.25, 1.5].map((r) => (
            <button
              key={r}
              onClick={() => player.setPlaybackRate(r)}
              className={cn(
                "px-3 py-1 rounded-full text-[10px] font-display tracking-widest border transition-all",
                player.playbackRate === r
                  ? "border-primary text-primary neon-text neon-glow"
                  : "border-border/40 text-muted-foreground hover:text-foreground hover:border-primary/40"
              )}
            >
              {r}×
            </button>
          ))}
        </div>
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
