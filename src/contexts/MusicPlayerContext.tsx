import { createContext, useContext, ReactNode, useEffect, useMemo, useRef } from "react";
import { useMusicPlayer } from "@/hooks/useMusicPlayer";
import { useSongsFromDB } from "@/hooks/useSongsFromDB";
import { useDeviceSync } from "@/hooks/useDeviceSync";
import { Track } from "@/lib/tracks";

type BasePlayer = ReturnType<typeof useMusicPlayer>;
type Sync = ReturnType<typeof useDeviceSync>;

type PlayerContextType = Omit<BasePlayer, "applyRemoteState"> & {
  newestTrack: ReturnType<typeof useSongsFromDB>["newestTrack"];
  newestTracks: Track[];
  songsLoading: boolean;
  kosherTracks: Track[];
  mainTracks: Track[];
  // Multi-device
  thisDevice: Sync["device"];
  devices: Sync["devices"];
  isThisDeviceActive: boolean;
  activeDevice: Sync["devices"][number] | null;
  transferTo: Sync["transferTo"];
  renameDevice: Sync["renameDevice"];
  removeDevice: Sync["removeDevice"];
};

const MusicPlayerContext = createContext<PlayerContextType | null>(null);

export function MusicPlayerProvider({ children }: { children: ReactNode }) {
  const { songs, allSongs, kosherTracks, loading, newestTrack, newestTracks } = useSongsFromDB();
  const sync = useDeviceSync();
  const audioEnabled = sync.isThisDeviceActive;
  const player = useMusicPlayer(allSongs, audioEnabled);

  // ---- Apply incoming remote playback state ----
  const lastAppliedVersion = useRef<number>(-1);
  useEffect(() => {
    const pb = sync.playback;
    if (!pb || !sync.device) return;
    if (pb.version <= lastAppliedVersion.current) return;
    // Ignore echoes of our own writes
    if (pb.updated_by_device === sync.device.id) {
      lastAppliedVersion.current = pb.version;
      return;
    }
    lastAppliedVersion.current = pb.version;
    player.applyRemoteState({
      songId: pb.song_id,
      positionSeconds: Number(pb.position_seconds) || 0,
      isPlaying: pb.is_playing && (pb.active_device_id === sync.device.id),
      playbackRate: Number(pb.playback_rate) || 1,
    });
  }, [sync.playback?.version, sync.device?.id]);

  // ---- Push state changes from this device when it's active ----
  // Immediate push on play/pause/track/rate changes
  const lastPushKeyRef = useRef<string>("");
  useEffect(() => {
    if (!sync.device) return;
    const songId = player.currentTrack?.id ?? null;
    const key = `${songId}|${player.isPlaying}|${player.playbackRate}|${audioEnabled}`;
    if (lastPushKeyRef.current === key) return;
    lastPushKeyRef.current = key;
    // Only push if this device is active OR we're transferring (handled via transferTo).
    if (!audioEnabled) return;
    sync.pushState({
      song_id: songId,
      is_playing: player.isPlaying,
      position_seconds: player.currentTime,
      playback_rate: player.playbackRate,
      active_device_id: sync.device.id,
    });
  }, [player.currentTrack?.id, player.isPlaying, player.playbackRate, audioEnabled, sync.device?.id]);

  // Periodic position push (every 4s while playing & active)
  useEffect(() => {
    if (!audioEnabled || !player.isPlaying || !sync.device) return;
    const id = window.setInterval(() => {
      sync.pushState({
        position_seconds: player.currentTime,
        is_playing: true,
        song_id: player.currentTrack?.id ?? null,
        active_device_id: sync.device!.id,
      });
    }, 4000);
    return () => window.clearInterval(id);
  }, [audioEnabled, player.isPlaying, player.currentTrack?.id, sync.device?.id]);

  // ---- Wrap controls so a remote (non-active) device sends commands instead of playing locally ----
  const wrappedTogglePlay = useMemo(() => {
    return () => {
      if (audioEnabled) return player.togglePlay();
      // Remote: flip is_playing on the active device
      if (!sync.playback) return;
      sync.pushState({ is_playing: !sync.playback.is_playing });
    };
  }, [audioEnabled, player.togglePlay, sync.playback?.is_playing]);

  const wrappedSeek = useMemo(() => {
    return (time: number) => {
      if (audioEnabled) return player.seek(time);
      sync.pushState({ position_seconds: time });
    };
  }, [audioEnabled, player.seek]);

  const wrappedNext = useMemo(() => {
    return () => {
      if (audioEnabled) return player.handleNext();
      // Find next from current playback's song id within playlist
      const list = player.playlist;
      const curId = sync.playback?.song_id;
      const idx = list.findIndex((t) => t.id === curId);
      const next = list[(idx + 1 + list.length) % list.length];
      if (next) sync.pushState({ song_id: next.id, position_seconds: 0, is_playing: true });
    };
  }, [audioEnabled, player.handleNext, player.playlist, sync.playback?.song_id]);

  const wrappedPrev = useMemo(() => {
    return () => {
      if (audioEnabled) return player.handlePrev();
      const list = player.playlist;
      const curId = sync.playback?.song_id;
      const idx = list.findIndex((t) => t.id === curId);
      const prev = list[(idx - 1 + list.length) % list.length];
      if (prev) sync.pushState({ song_id: prev.id, position_seconds: 0, is_playing: true });
    };
  }, [audioEnabled, player.handlePrev, player.playlist, sync.playback?.song_id]);

  const wrappedPlayTrack = useMemo(() => {
    return (index: number) => {
      if (audioEnabled) return player.playTrack(index);
      const t = player.playlist[index];
      if (t) sync.pushState({ song_id: t.id, position_seconds: 0, is_playing: true });
    };
  }, [audioEnabled, player.playTrack, player.playlist]);

  const wrappedSetRate = useMemo(() => {
    return (rate: number) => {
      if (audioEnabled) return player.setPlaybackRate(rate);
      sync.pushState({ playback_rate: rate });
    };
  }, [audioEnabled, player.setPlaybackRate]);

  const activeDevice = useMemo(() => {
    if (!sync.playback?.active_device_id) return sync.device;
    return sync.devices.find((d) => d.id === sync.playback!.active_device_id) ?? null;
  }, [sync.devices, sync.playback?.active_device_id, sync.device]);

  const value: PlayerContextType = {
    ...player,
    togglePlay: wrappedTogglePlay,
    seek: wrappedSeek,
    handleNext: wrappedNext,
    handlePrev: wrappedPrev,
    playTrack: wrappedPlayTrack,
    setPlaybackRate: wrappedSetRate,
    newestTrack,
    newestTracks,
    songsLoading: loading,
    kosherTracks,
    mainTracks: songs,
    thisDevice: sync.device,
    devices: sync.devices,
    isThisDeviceActive: sync.isThisDeviceActive,
    activeDevice,
    transferTo: sync.transferTo,
    renameDevice: sync.renameDevice,
    removeDevice: sync.removeDevice,
  };

  return <MusicPlayerContext.Provider value={value}>{children}</MusicPlayerContext.Provider>;
}

export function useMusicPlayerContext() {
  const ctx = useContext(MusicPlayerContext);
  if (!ctx) throw new Error("useMusicPlayerContext must be inside MusicPlayerProvider");
  return ctx;
}
