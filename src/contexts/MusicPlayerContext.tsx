import { createContext, useContext, ReactNode, useEffect, useMemo, useRef } from "react";
import { usePlaybackEngine } from "@/hooks/usePlaybackEngine";
import { useSongsFromDB } from "@/hooks/useSongsFromDB";
import { useDeviceSync } from "@/hooks/useDeviceSync";
import { useOnline } from "@/hooks/useOnline";
import { Track } from "@/lib/tracks";

type BaseEngine = ReturnType<typeof usePlaybackEngine>;
type Sync = ReturnType<typeof useDeviceSync>;

type PlayerContextType = Omit<BaseEngine, "applyRemoteState"> & {
  newestTrack: ReturnType<typeof useSongsFromDB>["newestTrack"];
  newestTracks: Track[];
  songsLoading: boolean;
  refetchSongs: () => Promise<void>;
  kosherTracks: Track[];
  mainTracks: Track[];
  allTracks: Track[];
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
  const { songs, allSongs, kosherTracks, loading, newestTrack, newestTracks, refetch } = useSongsFromDB();
  const sync = useDeviceSync();
  const online = useOnline();

  // Only the device that currently owns the session renders audio. Playback is
  // handed over explicitly (device takeover) so two devices never play at once.
  // With no internet nothing can take the session over, so this phone always plays.
  const audioEnabled = sync.isThisDeviceActive || !online;
  const player = usePlaybackEngine(allSongs, audioEnabled);

  // ---------------- Apply incoming remote playback state ----------------
  const lastAppliedVersion = useRef<number>(-1);
  const applyingRemoteRef = useRef<boolean>(false);
  useEffect(() => {
    const pb = sync.playback;
    if (!pb || !sync.device) return;
    if (pb.version <= lastAppliedVersion.current) return;
    lastAppliedVersion.current = pb.version;
    if (pb.updated_by_device === sync.device.id) return; // our own echo

    // Latency compensation so a takeover resumes at the right position.
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
      volume: typeof pb.volume === "number" ? Number(pb.volume) : undefined,
      queueIds: Array.isArray(pb.queue) ? (pb.queue as string[]) : undefined,
      contextType: (pb.context_type as never) ?? undefined,
      contextId: pb.context_id ?? null,
      contextTrackIds: Array.isArray(pb.context_track_ids)
        ? (pb.context_track_ids as string[])
        : undefined,
      contextIndex: pb.context_index ?? undefined,
    });
    queueMicrotask(() => {
      applyingRemoteRef.current = false;
    });
  }, [sync.playback?.version, sync.device?.id]);

  // ---------------- Push meaningful local changes ----------------
  // Position is NOT written on every tick — only on transport/queue changes
  // plus a slow heartbeat while this device owns playback.
  const lastPushKeyRef = useRef<string>("");
  useEffect(() => {
    if (!sync.device) return;
    if (applyingRemoteRef.current) return;
    const songId = player.currentTrack?.id ?? null;
    const key = [
      songId,
      player.isPlaying,
      player.playbackRate,
      player.shuffle,
      player.repeat,
      player.contextType,
      player.contextId,
      player.contextIndex,
      player.queue.map((t) => t.id).join(","),
    ].join("|");
    if (lastPushKeyRef.current === key) return;
    lastPushKeyRef.current = key;
    sync.pushState({
      song_id: songId,
      is_playing: player.isPlaying,
      position_seconds: player.currentTime,
      playback_rate: player.playbackRate,
      shuffle: player.shuffle,
      repeat_mode: player.repeat,
      volume: player.volume,
      queue: player.queue.map((t) => t.id),
      context_type: player.contextType,
      context_id: player.contextId,
      context_track_ids: player.contextTracks.map((t) => t.id),
      context_index: player.contextIndex,
      active_device_id: sync.playback?.active_device_id ?? sync.device.id,
    });
  }, [
    player.currentTrack?.id,
    player.isPlaying,
    player.playbackRate,
    player.shuffle,
    player.repeat,
    player.contextType,
    player.contextId,
    player.contextIndex,
    player.queue,
    sync.device?.id,
  ]);

  // Slow position heartbeat (10s) — enough for takeover accuracy without
  // hammering the database on slow mobile networks.
  useEffect(() => {
    if (!sync.device || !player.isPlaying || !audioEnabled) return;
    const id = window.setInterval(() => {
      sync.pushState({
        position_seconds: player.currentTime,
        is_playing: true,
        song_id: player.currentTrack?.id ?? null,
      });
    }, 10_000);
    return () => window.clearInterval(id);
  }, [player.isPlaying, player.currentTrack?.id, sync.device?.id, audioEnabled]);

  // Remote monitor devices interpolate position locally so the progress bar
  // moves smoothly without extra network traffic.
  useEffect(() => {
    if (audioEnabled) return;
    const pb = sync.playback;
    if (!pb?.is_playing) return;
    let raf = 0;
    const base = Number(pb.position_seconds) || 0;
    const stamp = new Date(pb.updated_at).getTime();
    const rate = Number(pb.playback_rate) || 1;
    const tick = () => {
      player.setDisplayTime(base + ((Date.now() - stamp) / 1000) * rate);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [audioEnabled, sync.playback?.version, sync.playback?.is_playing]);

  // ---------------- Wrapped controls (immediate sync on user intent) ----------------
  const wrappedSeek = useMemo(() => {
    return (time: number) => {
      player.seek(time);
      if (sync.device) {
        sync.pushState({
          position_seconds: time,
          is_playing: player.isPlaying,
          song_id: player.currentTrack?.id ?? null,
        });
      }
    };
  }, [player.seek, player.isPlaying, player.currentTrack?.id, sync.device?.id]);

  /** Transfer playback here, resuming at the shared position. */
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

  // Recently-played logging — only the owning device logs.
  const loggedRef = useRef<string>("");
  useEffect(() => {
    if (!sync.userId || !player.currentTrack?.id || !player.isPlaying || !audioEnabled) return;
    const key = `${sync.userId}|${player.currentTrack.id}`;
    if (loggedRef.current === key) return;
    loggedRef.current = key;
    import("@/integrations/supabase/client").then(({ supabase }) => {
      supabase
        .from("recently_played")
        .insert({ user_id: sync.userId!, song_id: player.currentTrack!.id })
        .then(() => {});
    });
  }, [sync.userId, player.currentTrack?.id, player.isPlaying, audioEnabled]);

  const value: PlayerContextType = {
    ...player,
    seek: wrappedSeek,
    newestTrack,
    newestTracks,
    songsLoading: loading,
    refetchSongs: refetch,
    kosherTracks,
    mainTracks: songs,
    allTracks: allSongs,
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
