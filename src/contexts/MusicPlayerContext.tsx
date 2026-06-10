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
  takeOver: () => void;
};

const MusicPlayerContext = createContext<PlayerContextType | null>(null);

export function MusicPlayerProvider({ children }: { children: ReactNode }) {
  const { songs, allSongs, kosherTracks, loading, newestTrack, newestTracks } = useSongsFromDB();
  const sync = useDeviceSync();
  // Auto-mirror mode: every signed-in device plays audio locally and stays
  // in lockstep with playback_state. There is no single "active" device any
  // more — all devices mirror each other (Spotify Group Session style).
  const player = useMusicPlayer(allSongs, true);

  // ---- Apply incoming remote playback state on EVERY device ----
  const lastAppliedVersion = useRef<number>(-1);
  const applyingRemoteRef = useRef<boolean>(false);
  useEffect(() => {
    const pb = sync.playback;
    if (!pb || !sync.device) return;
    if (pb.version <= lastAppliedVersion.current) return;
    lastAppliedVersion.current = pb.version;
    // Skip echoes of our own writes
    if (pb.updated_by_device === sync.device.id) return;

    // Compensate for network latency: advance position by elapsed time
    // since the leader stamped this update, so audio lines up on resume.
    const elapsed = pb.is_playing
      ? Math.max(0, (Date.now() - new Date(pb.updated_at).getTime()) / 1000)
      : 0;
    const rate = Number(pb.playback_rate) || 1;

    applyingRemoteRef.current = true;
    player.applyRemoteState({
      songId: pb.song_id,
      positionSeconds: (Number(pb.position_seconds) || 0) + elapsed * rate,
      isPlaying: pb.is_playing,
      playbackRate: rate,
      shuffle: pb.shuffle,
      repeat: pb.repeat_mode,
    });
    // Release the suppression on next tick so our reactive push effects
    // see the updated player state without triggering an echo write.
    queueMicrotask(() => {
      applyingRemoteRef.current = false;
    });
  }, [sync.playback?.version, sync.device?.id]);

  // ---- Push state changes from this device whenever the local user acts ----
  const lastPushKeyRef = useRef<string>("");
  useEffect(() => {
    if (!sync.device) return;
    if (applyingRemoteRef.current) return;
    const songId = player.currentTrack?.id ?? null;
    const pb = sync.playback;
    // No change vs. what's already in the shared state → don't push
    if (
      pb &&
      pb.song_id === songId &&
      pb.is_playing === player.isPlaying &&
      Number(pb.playback_rate) === player.playbackRate
    ) {
      return;
    }
    const key = `${songId}|${player.isPlaying}|${player.playbackRate}`;
    if (lastPushKeyRef.current === key) return;
    lastPushKeyRef.current = key;
    sync.pushState({
      song_id: songId,
      is_playing: player.isPlaying,
      position_seconds: player.currentTime,
      playback_rate: player.playbackRate,
      active_device_id: sync.device.id,
    });
  }, [player.currentTrack?.id, player.isPlaying, player.playbackRate, sync.device?.id]);

  // Drift-correction heartbeat: only the device that last issued a command
  // (the leader) pushes a periodic position so the others can re-align if
  // they fell behind. Avoids write storms from every device at once.
  useEffect(() => {
    if (!sync.device || !player.isPlaying) return;
    const isLeader = sync.playback?.updated_by_device === sync.device.id;
    if (!isLeader) return;
    const id = window.setInterval(() => {
      sync.pushState({
        position_seconds: player.currentTime,
        is_playing: true,
        song_id: player.currentTrack?.id ?? null,
        active_device_id: sync.device!.id,
      });
    }, 2000);
    return () => window.clearInterval(id);
  }, [player.isPlaying, player.currentTrack?.id, sync.device?.id, sync.playback?.updated_by_device]);

  // ---- Wrapped controls: act locally AND broadcast so every device mirrors ----
  const wrappedTogglePlay = useMemo(() => {
    return () => {
      player.togglePlay();
      // Pushed reactively by the effect above
    };
  }, [player.togglePlay]);

  const wrappedSeek = useMemo(() => {
    return (time: number) => {
      player.seek(time);
      if (sync.device) {
        sync.pushState({
          position_seconds: time,
          is_playing: player.isPlaying,
          song_id: player.currentTrack?.id ?? null,
          active_device_id: sync.device.id,
        });
      }
    };
  }, [player.seek, player.isPlaying, player.currentTrack?.id, sync.device?.id]);

  const wrappedNext = useMemo(() => player.handleNext, [player.handleNext]);
  const wrappedPrev = useMemo(() => player.handlePrev, [player.handlePrev]);
  const wrappedPlayTrack = useMemo(() => player.playTrack, [player.playTrack]);

  const wrappedSetRate = useMemo(() => {
    return (rate: number) => {
      player.setPlaybackRate(rate);
      sync.pushState({ playback_rate: rate });
    };
  }, [player.setPlaybackRate]);

  const wrappedSetShuffle = useMemo(() => {
    return () => {
      const next = !player.shuffle;
      player.setShuffleValue(next);
      sync.pushState({ shuffle: next });
    };
  }, [player.shuffle, player.setShuffleValue]);

  const wrappedSetRepeat = useMemo(() => {
    return () => {
      const next: "off" | "all" | "one" =
        player.repeat === "off" ? "all" : player.repeat === "all" ? "one" : "off";
      player.setRepeatValue(next);
      sync.pushState({ repeat_mode: next });
    };
  }, [player.repeat, player.setRepeatValue]);

  // "Take over" now simply means: become the leader for heartbeat purposes.
  const takeOver = useMemo(() => {
    return () => {
      if (!sync.device) return;
      sync.pushState({ active_device_id: sync.device.id, is_playing: true });
    };
  }, [sync.device, sync.pushState]);

  const activeDevice = useMemo(() => {
    if (!sync.playback?.active_device_id) return sync.device;
    return sync.devices.find((d) => d.id === sync.playback!.active_device_id) ?? null;
  }, [sync.devices, sync.playback?.active_device_id, sync.device]);

  // Recently-played logging — only the leader logs to avoid duplicate rows.
  const loggedRef = useRef<string>("");
  useEffect(() => {
    if (!sync.userId || !player.currentTrack?.id || !player.isPlaying) return;
    const isLeader = !sync.playback?.updated_by_device || sync.playback?.updated_by_device === sync.device?.id;
    if (!isLeader) return;
    const key = `${sync.userId}|${player.currentTrack.id}`;
    if (loggedRef.current === key) return;
    loggedRef.current = key;
    import("@/integrations/supabase/client").then(({ supabase }) => {
      supabase.from("recently_played").insert({ user_id: sync.userId!, song_id: player.currentTrack!.id }).then(() => {});
    });
  }, [sync.userId, player.currentTrack?.id, player.isPlaying, sync.playback?.updated_by_device, sync.device?.id]);

  const value: PlayerContextType = {
    ...player,
    togglePlay: wrappedTogglePlay,
    seek: wrappedSeek,
    handleNext: wrappedNext,
    handlePrev: wrappedPrev,
    playTrack: wrappedPlayTrack,
    setPlaybackRate: wrappedSetRate,
    setShuffle: wrappedSetShuffle,
    setRepeat: wrappedSetRepeat,
    newestTrack,
    newestTracks,
    songsLoading: loading,
    kosherTracks,
    mainTracks: songs,
    thisDevice: sync.device,
    devices: sync.devices,
    isThisDeviceActive: true, // every device is active in auto-mirror mode
    activeDevice,
    transferTo: sync.transferTo,
    renameDevice: sync.renameDevice,
    removeDevice: sync.removeDevice,
    takeOver,
  };

  return <MusicPlayerContext.Provider value={value}>{children}</MusicPlayerContext.Provider>;
}

export function useMusicPlayerContext() {
  const ctx = useContext(MusicPlayerContext);
  if (!ctx) throw new Error("useMusicPlayerContext must be inside MusicPlayerProvider");
  return ctx;
}
