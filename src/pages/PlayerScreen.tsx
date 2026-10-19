import { ChevronDown, Mic2, Volume2, Bluetooth, Cast, ListPlus, ListMusic, Share2 } from "lucide-react";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { HolographicArtwork } from "@/components/player/HolographicArtwork";
import { WaveformVisualizer } from "@/components/player/WaveformVisualizer";
import { ProgressBar } from "@/components/player/ProgressBar";
import { PlayerControls } from "@/components/player/PlayerControls";
import { VolumeControl } from "@/components/player/VolumeControl";
import { LikeButton } from "@/components/player/LikeButton";
import { SleepTimerSheet } from "@/components/player/SleepTimerSheet";
import { LyricsView } from "@/components/player/LyricsView";
import { InlineLyricsTicker } from "@/components/player/InlineLyricsTicker";
import { DeviceSheet } from "@/components/player/DeviceSheet";
import { QueueSheet } from "@/components/player/QueueSheet";
import { useMusicPlayerContext } from "@/contexts/MusicPlayerContext";
import { usePlaylistPicker } from "@/contexts/PlaylistPickerContext";
import { shareTrack } from "@/lib/share";
import { SEO } from "@/components/SEO";
import { cn } from "@/lib/utils";

const SPEEDS = [0.75, 1, 1.25, 1.5];

const CONTEXT_LABEL: Record<string, string> = {
  library: "Library",
  album: "Album",
  playlist: "Playlist",
  artist: "Artist",
  downloads: "Downloads",
  search: "Search results",
  single: "Single track",
};

const iconBtn =
  "w-11 h-11 rounded-full flex items-center justify-center transition-colors text-muted-foreground hover:text-foreground disabled:opacity-30";

const PlayerScreen = () => {
  const navigate = useNavigate();
  const player = useMusicPlayerContext();
  const { openPlaylistPicker } = usePlaylistPicker();
  const [showLyrics, setShowLyrics] = useState(false);

  const track = player.currentTrack;
  const hasLyrics = !!(track?.lyrics && track.lyrics.length);
  const lyricsOn = showLyrics && hasLyrics;

  const trackTitle = track ? `${track.title} — ${track.artist}` : "Now Playing";

  return (
    <div className="min-h-screen flex flex-col relative">
      <SEO
        title={`${trackTitle} | Sommyart Music Player`}
        description={`Holographic full-screen player with lyrics and waveform visualizer. ${track ? `Now playing ${track.title} by ${track.artist}.` : "Stream exclusive neon tracks on Sommyart Music."}`}
        path="/player"
      />
      <div className="absolute inset-0 bg-gradient-to-b from-neon-cyan/5 via-transparent to-neon-purple/5 pointer-events-none" />

      {/* Header */}
      <header className="relative flex items-center justify-between px-3 pt-10 pb-2 animate-in fade-in slide-in-from-top-2 duration-300">
        <button onClick={() => navigate(-1)} aria-label="Close player" className={iconBtn}>
          <ChevronDown size={28} />
        </button>
        <div className="text-center min-w-0">
          <div className="text-xs font-display tracking-widest text-muted-foreground">
            {lyricsOn ? "LYRICS" : "NOW PLAYING"}
          </div>
          <div className="text-[10px] text-muted-foreground/70 truncate">
            {CONTEXT_LABEL[player.contextType] ?? ""}
          </div>
        </div>
        <div className="flex items-center">
          <QueueSheet
            trigger={
              <button aria-label="Open queue" className={cn(iconBtn, "hover:text-primary")}>
                <ListMusic size={22} />
              </button>
            }
          />
          <button
            onClick={() => hasLyrics && setShowLyrics((s) => !s)}
            disabled={!hasLyrics}
            aria-label={lyricsOn ? "Hide lyrics" : "Show lyrics"}
            aria-pressed={lyricsOn}
            className={cn(iconBtn, lyricsOn && "text-primary neon-text")}
          >
            <Mic2 size={22} />
          </button>
        </div>
      </header>

      {/* Connect bar */}
      <div className="relative px-6 pb-2 lg:max-w-5xl lg:mx-auto lg:w-full">
        <DeviceSheet
          trigger={
            <button
              className={cn(
                "w-full flex items-center justify-between gap-2 rounded-lg border px-3 py-2 text-xs transition-all",
                player.isThisDeviceActive
                  ? "border-primary/40 text-primary hover:bg-primary/5"
                  : "border-amber-400/50 text-amber-300 bg-amber-400/5 hover:bg-amber-400/10",
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
                  <span className="font-medium">{player.activeDevice?.name || "this device"}</span>
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

      {/* Body: stacked on phones, two columns on desktop */}
      <div className="relative flex-1 flex flex-col lg:flex-row lg:items-center lg:justify-center lg:gap-12 lg:px-10 lg:max-w-5xl lg:mx-auto lg:w-full min-h-0">
        {/* Artwork or lyrics */}
        <div className="flex-1 lg:flex-none lg:w-1/2 flex flex-col items-center justify-center px-2 min-h-0">
          {lyricsOn ? (
            <div className="w-full flex-1 min-h-0 lg:h-[28rem]">
              <LyricsView lyrics={track!.lyrics!} currentTime={player.currentTime} />
            </div>
          ) : (
            <div key={track?.id ?? "none"} className="animate-in fade-in zoom-in-95 duration-500">
              <HolographicArtwork track={track} isPlaying={player.isPlaying} />
            </div>
          )}
        </div>

        {/* Info and controls */}
        <div className="relative px-6 pb-10 pt-2 space-y-4 lg:flex-none lg:w-1/2 lg:px-0">
          <div className="flex items-center gap-2">
            <div className="flex-1 min-w-0 text-center lg:text-left">
              <h1 className="text-xl font-display font-bold tracking-wide text-foreground neon-text truncate">
                {track?.title || "No Track"}
              </h1>
              <p className="text-sm text-muted-foreground mt-1 truncate">{track?.artist || "—"}</p>
            </div>
            <LikeButton track={track} />
          </div>

          {!lyricsOn &&
            (hasLyrics ? (
              <InlineLyricsTicker lyrics={track!.lyrics!} currentTime={player.currentTime} />
            ) : (
              <WaveformVisualizer isPlaying={player.isPlaying} />
            ))}

          <ProgressBar currentTime={player.currentTime} duration={player.duration} onSeek={player.seek} />

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

          {/* Secondary actions */}
          <div className="flex items-center justify-between">
            <button
              onClick={() => track && openPlaylistPicker(track)}
              disabled={!track}
              aria-label="Add to playlist"
              className={iconBtn}
            >
              <ListPlus size={22} />
            </button>
            <button onClick={() => track && shareTrack(track)} disabled={!track} aria-label="Share song" className={iconBtn}>
              <Share2 size={20} />
            </button>
            <SleepTimerSheet />
            <div className="flex items-center gap-1" role="group" aria-label="Playback speed">
              {SPEEDS.map((r) => (
                <button
                  key={r}
                  onClick={() => player.setPlaybackRate(r)}
                  aria-pressed={player.playbackRate === r}
                  aria-label={`Speed ${r} times`}
                  className={cn(
                    "min-w-11 h-9 px-2 rounded-full text-[10px] font-display tracking-wider border transition-all",
                    player.playbackRate === r
                      ? "border-primary text-primary neon-text neon-glow"
                      : "border-border/40 text-muted-foreground hover:text-foreground hover:border-primary/40",
                  )}
                >
                  {r}×
                </button>
              ))}
            </div>
          </div>

          <VolumeControl />
        </div>
      </div>
    </div>
  );
};

export default PlayerScreen;
