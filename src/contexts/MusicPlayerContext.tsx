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
  /** The song the shared session is on right now (what the playing device is playing). */
  activeTrack: Track | null;
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

  // The last state this device sent or received, so a state it just applied is not sent straight back.
  const lastPushKeyRef = useRef<string>("");
  const lastPushedSongRef = useRef<string | null | undefined>(undefined);

  // Newest copy of the player, for timers that must not use an old render's values.
  const playerRef = useRef(player);
  playerRef.current = player;

  // ---------------- Apply incoming remote playback state ----------------
  const lastAppliedVersion = useRef<number>(-1);
  const applyingRemoteRef = useRef<boolean>(false);

  const applyState = (pb: NonNullable<typeof sync.playback>, firstAfterLaunch: boolean) => {
    if (!sync.device) return;
    // Latency compensation so a takeover resumes at the right position (server clock, not this device's clock).
    const elapsed = pb.is_playing
      ? Math.max(0, (sync.serverNow() - new Date(pb.updated_at).getTime()) / 1000)
      : 0;
    const rate = Number(pb.playback_rate) || 1;

    const songId = pb.track_id ?? pb.song_id;
    // What the push effect below would compute for this same state: do not echo it back.
    lastPushKeyRef.current = [
      songId,
      pb.is_playing,
      rate,
      pb.shuffle,
      pb.repeat_mode,
      pb.context_type,
      pb.context_id,
      pb.context_index,
      Array.isArray(pb.queue) ? (pb.queue as string[]).join(",") : "",
    ].join("|");

    applyingRemoteRef.current = true;
    player.applyRemoteState({
      songId,
      positionSeconds: (Number(pb.position_seconds) || 0) + elapsed * rate,
      isPlaying: pb.is_playing && !(firstAfterLaunch && pb.active_device_id === sync.device.id),
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
  };
  const applyStateRef = useRef(applyState);
  applyStateRef.current = applyState;

  useEffect(() => {
    const pb = sync.playback;
    if (!pb || !sync.device) return;
    // The song list loads after launch; a song that is not in it yet cannot be shown, and the
    // state would be marked as applied and never shown. Wait for the list.
    if (loading) return;
    if (pb.version <= lastAppliedVersion.current) return;
    // Opening the app must never start music by itself: the first state seen after launch is shown paused
    // when this device is the one that would play it.
    const firstAfterLaunch = lastAppliedVersion.current === -1;
    lastAppliedVersion.current = pb.version;
    if (pb.updated_by_device === sync.device.id) return; // our own echo
    applyState(pb, firstAfterLaunch);
  }, [sync.playback?.version, sync.device?.id, loading]);

  // Self-repair: a device that is only following (not playing) checks every 3 seconds that it shows the
  // same song and the same play/pause state as the shared session, and fixes itself if it does not.
  // This is what guarantees both devices end up on the same song even if an update was missed or applied wrongly.
  useEffect(() => {
    if (audioEnabled || !sync.device || loading) return;
    const id = window.setInterval(() => {
      const pb = sync.playback;
      if (!pb || !sync.device) return;
      if (pb.updated_by_device === sync.device.id) return; // this device wrote it, nothing to follow
      if (Date.now() - sync.lastPushAtRef.current < 5000) return; // a button was just pressed here
      const wanted = pb.track_id ?? pb.song_id;
      if (!wanted || !allSongs.some((t) => t.id === wanted)) return;
      const p = playerRef.current;
      if (p.currentTrack?.id === wanted && p.isPlaying === pb.is_playing) return;
      applyStateRef.current(pb, false);
    }, 3000);
    return () => window.clearInterval(id);
  }, [audioEnabled, sync.device?.id, sync.playback, loading, allSongs]);

  // ---------------- Push meaningful local changes ----------------
  // Position is NOT written on every tick — only on transport/queue changes
  // plus a slow heartbeat while this device owns playback.
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
    // A new song starts at 0, not at wherever the previous song ended.
    const songChanged = lastPushedSongRef.current !== undefined && lastPushedSongRef.current !== songId;
    lastPushedSongRef.current = songId;
    sync.pushState({
      song_id: songId,
      is_playing: player.isPlaying,
      position_seconds: songChanged && audioEnabled ? 0 : player.currentTime,
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

  // Check-in every 5 seconds from the device that is playing: the song, the place in the list and the exact
  // position. Other devices use it to stay on the same song and the same second.
  useEffect(() => {
    if (!sync.device || !player.isPlaying || !audioEnabled) return;
    const id = window.setInterval(() => {
      sync.pushHeartbeat(() => ({
        track_id: playerRef.current.currentTrack?.id ?? null,
        position_seconds: playerRef.current.currentTime,
        is_playing: playerRef.current.isPlaying,
        context_index: playerRef.current.contextIndex,
      }));
    }, 5_000);
    return () => window.clearInterval(id);
  }, [player.isPlaying, sync.device?.id, sync.pushHeartbeat, audioEnabled]);

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
      player.setDisplayTime(base + ((sync.serverNow() - stamp) / 1000) * rate);
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
      sync.pushState({ active_device_id: sync.device.id, is_playing: true, position_seconds: playerRef.current.currentTime });
    };
  }, [sync.device, sync.pushState]);

  const activeDevice = useMemo(() => {
    if (!sync.playback?.active_device_id) return sync.device;
    return sync.devices.find((d) => d.id === sync.playback!.active_device_id) ?? null;
  }, [sync.devices, sync.playback?.active_device_id, sync.device]);

  const activeTrack = useMemo(() => {
    const id = sync.playback ? (sync.playback.track_id ?? sync.playback.song_id) : null;
    return id ? allSongs.find((t) => t.id === id) ?? null : null;
  }, [sync.playback?.track_id, sync.playback?.song_id, allSongs]);

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
    activeTrack,
  };

  return <MusicPlayerContext.Provider value={value}>{children}</MusicPlayerContext.Provider>;
}

export function useMusicPlayerContext() {
  const ctx = useContext(MusicPlayerContext);
  if (!ctx) throw new Error("useMusicPlayerContext must be inside MusicPlayerProvider");
  return ctx;
}
