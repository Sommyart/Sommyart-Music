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
      shuffle: pb.shuffle,
      repeat: pb.repeat_mode,
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

  // Periodic position push (every 1s while playing & active) as a baseline
  // for the remote interpolator. Commands (play/pause/seek/track) push instantly.
  useEffect(() => {
    if (!audioEnabled || !player.isPlaying || !sync.device) return;
    const id = window.setInterval(() => {
      sync.pushState({
        position_seconds: player.currentTime,
        is_playing: true,
        song_id: player.currentTrack?.id ?? null,
        active_device_id: sync.device!.id,
      });
    }, 1000);
    return () => window.clearInterval(id);
  }, [audioEnabled, player.isPlaying, player.currentTrack?.id, sync.device?.id]);

  // Remote (non-active) interpolation: advance the displayed time locally
  // every animation frame so the mobile mirrors the PC in real time.
  useEffect(() => {
    if (audioEnabled) return;
    const pb = sync.playback;
    if (!pb) return;
    const baselinePos = Number(pb.position_seconds) || 0;
    const baselineMs = new Date(pb.updated_at).getTime();
    const rate = Number(pb.playback_rate) || 1;
    if (!pb.is_playing) {
      player.setDisplayTime(Math.max(0, baselinePos));
      return;
    }
    let raf = 0;
    const tick = () => {
      const elapsed = (Date.now() - baselineMs) / 1000;
      player.setDisplayTime(Math.max(0, baselinePos + elapsed * rate));
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [audioEnabled, sync.playback?.version, sync.playback?.is_playing, sync.playback?.updated_at]);


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
      if (audioEnabled) {
        player.seek(time);
        // Immediately broadcast the new position so remote devices stay in lockstep
        if (sync.device) {
          sync.pushState({
            position_seconds: time,
            is_playing: player.isPlaying,
            song_id: player.currentTrack?.id ?? null,
            active_device_id: sync.device.id,
          });
        }
        return;
      }
      sync.pushState({ position_seconds: time });
    };
  }, [audioEnabled, player.seek, player.isPlaying, player.currentTrack?.id, sync.device?.id]);


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

  // Take over playback on this device
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

  // Recently-played logging when active device starts a track
  const loggedRef = useRef<string>("");
  useEffect(() => {
    if (!audioEnabled || !sync.userId || !player.currentTrack?.id || !player.isPlaying) return;
    const key = `${sync.userId}|${player.currentTrack.id}`;
    if (loggedRef.current === key) return;
    loggedRef.current = key;
    import("@/integrations/supabase/client").then(({ supabase }) => {
      supabase.from("recently_played").insert({ user_id: sync.userId!, song_id: player.currentTrack!.id }).then(() => {});
    });
  }, [audioEnabled, sync.userId, player.currentTrack?.id, player.isPlaying]);

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
    isThisDeviceActive: sync.isThisDeviceActive,
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
