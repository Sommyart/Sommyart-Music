import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Capacitor } from "@capacitor/core";
import { supabase } from "@/integrations/supabase/client";

const CLIENT_ID_KEY = "sommyart.deviceClientId";

export interface DeviceRow {
  id: string;
  user_id: string;
  client_id: string;
  name: string;
  kind: string;
  output_label: string | null;
  last_seen_at: string;
  created_at: string;
}

export type RemoteAction = "play" | "pause" | "next" | "prev" | "seek" | "shuffle" | "repeat";
export interface RemoteCommand {
  id: number;
  target_device_id: string;
  from_device_id: string | null;
  action: RemoteAction;
  value: string | null;
  created_at: string;
}

export interface PlaybackStateRow {
  user_id: string;
  song_id: string | null;
  /** Any track id, including songs bundled with the app (song_id can only hold database ids). */
  track_id: string | null;
  position_seconds: number;
  is_playing: boolean;
  playback_rate: number;
  shuffle: boolean;
  repeat_mode: "off" | "all" | "one";
  active_device_id: string | null;
  updated_by_device: string | null;
  version: number;
  updated_at: string;
  // Session-wide state (queue + playback context + volume)
  queue: string[];
  context_type: string;
  context_id: string | null;
  context_track_ids: string[];
  context_index: number;
  volume: number;
}



/** True when `a` was written after `b` (the version number is only a tie-break, it can restart). */
function newer(a: PlaybackStateRow, b: PlaybackStateRow): boolean {
  const ta = Date.parse(a.updated_at);
  const tb = Date.parse(b.updated_at);
  if (!isNaN(ta) && !isNaN(tb) && ta !== tb) return ta > tb;
  return a.version >= b.version;
}

function detectKind(): string {
  const ua = navigator.userAgent.toLowerCase();
  if (/ipad|tablet/.test(ua)) return "tablet";
  if (/mobi|android|iphone/.test(ua)) return "mobile";
  return "desktop";
}

function defaultDeviceName(): string {
  try {
    if (Capacitor.isNativePlatform() && Capacitor.getPlatform() === "android") return "Android app";
  } catch { /* not running inside the app */ }
  const ua = navigator.userAgent;
  if (/iPhone/i.test(ua)) return "iPhone";
  if (/iPad/i.test(ua)) return "iPad";
  if (/Android/i.test(ua)) return "Android";
  if (/Mac/i.test(ua)) return "Mac";
  if (/Windows/i.test(ua)) return "Windows PC";
  if (/Linux/i.test(ua)) return "Linux";
  return "Web Browser";
}

function getOrCreateClientId(): string {
  let id = localStorage.getItem(CLIENT_ID_KEY);
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem(CLIENT_ID_KEY, id);
  }
  return id;
}

async function detectOutputLabel(): Promise<string> {
  try {
    if (!navigator.mediaDevices?.enumerateDevices) return "This device";
    const devices = await navigator.mediaDevices.enumerateDevices();
    const outputs = devices.filter((d) => d.kind === "audiooutput");
    // Prefer non-default labelled output (often actual hardware)
    const labelled = outputs.find((d) => d.label && d.deviceId !== "default");
    const def = outputs.find((d) => d.deviceId === "default");
    const raw = (labelled?.label || def?.label || "").trim();
    if (!raw) return "This device";
    // Heuristic: detect Bluetooth
    if (/bluetooth|airpods|buds|headset|wireless/i.test(raw)) {
      return `Bluetooth — ${raw.replace(/\s*\(bluetooth\)\s*/i, "").trim()}`;
    }
    return raw;
  } catch {
    return "This device";
  }
}

export function useDeviceSync() {
  const [userId, setUserId] = useState<string | null>(null);
  const [device, setDevice] = useState<DeviceRow | null>(null);
  const [devices, setDevices] = useState<DeviceRow[]>([]);
  const [playback, setPlayback] = useState<PlaybackStateRow | null>(null);
  const clientIdRef = useRef<string>(getOrCreateClientId());
  // Always the newest row this device knows about, so pushes and check-ins never build on an old copy.
  const playbackRef = useRef<PlaybackStateRow | null>(null);
  // Pushes run one after another so a later push always builds on the result of the earlier one.
  const chainRef = useRef<Promise<unknown>>(Promise.resolve());
  // When this device last wrote, so the self-repair check does not undo a button just pressed.
  const lastPushAtRef = useRef<number>(0);
  // Server clock minus this device's clock, in milliseconds.
  const clockOffsetRef = useRef<number>(0);
  const serverNow = useCallback(() => Date.now() + clockOffsetRef.current, []);
  // The device that is playing registers a function here; commands sent by other devices are handed to it.
  const commandHandlerRef = useRef<((cmd: RemoteCommand) => void) | null>(null);
  const handledCommandsRef = useRef<Set<number>>(new Set());
  const deviceIdRef = useRef<string | null>(null);

  const handleCommand = useCallback((cmd: RemoteCommand) => {
    if (!cmd || cmd.target_device_id !== deviceIdRef.current) return;
    if (handledCommandsRef.current.has(cmd.id)) return;
    handledCommandsRef.current.add(cmd.id);
    // Never replay an old command after a reconnect.
    const age = Date.now() + clockOffsetRef.current - Date.parse(cmd.created_at);
    if (!isNaN(age) && age > 15_000) return;
    commandHandlerRef.current?.(cmd);
  }, []);

  const adopt = useCallback((row: PlaybackStateRow) => {
    if (!playbackRef.current || newer(row, playbackRef.current)) playbackRef.current = row;
    setPlayback((prev) => (!prev || newer(row, prev) ? row : prev));
  }, []);

  // Track auth
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setUserId(data.session?.user.id ?? null));
    const { data: sub } = supabase.auth.onAuthStateChange((_evt, session) => {
      setUserId(session?.user.id ?? null);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  // Register / upsert device
  useEffect(() => {
    if (!userId) {
      setDevice(null);
      setDevices([]);
      setPlayback(null);
      playbackRef.current = null;
      return;
    }
    let cancelled = false;
    (async () => {
      const outputLabel = await detectOutputLabel();
      const payload = {
        user_id: userId,
        client_id: clientIdRef.current,
        name: defaultDeviceName(),
        kind: detectKind(),
        output_label: outputLabel,
        last_seen_at: new Date().toISOString(),
      };
      const { data, error } = await supabase
        .from("devices")
        .upsert(payload, { onConflict: "user_id,client_id" })
        .select()
        .maybeSingle();
      if (!cancelled && !error && data) setDevice(data as DeviceRow);
    })();
    return () => { cancelled = true; };
  }, [userId]);

  useEffect(() => { deviceIdRef.current = device?.id ?? null; }, [device?.id]);

  // Heartbeat + output-device change listener
  useEffect(() => {
    if (!device) return;
    const update = async () => {
      const outputLabel = await detectOutputLabel();
      await supabase
        .from("devices")
        .update({ last_seen_at: new Date().toISOString(), output_label: outputLabel })
        .eq("id", device.id);
    };
    const interval = window.setInterval(update, 30_000);
    const onDeviceChange = () => update();
    navigator.mediaDevices?.addEventListener?.("devicechange", onDeviceChange);
    return () => {
      window.clearInterval(interval);
      navigator.mediaDevices?.removeEventListener?.("devicechange", onDeviceChange);
    };
  }, [device?.id]);

  // Load + subscribe devices and playback_state
  useEffect(() => {
    if (!userId) return;
    let cancelled = false;

    const loadDevices = async () => {
      const { data: devs } = await supabase.from("devices").select("*").eq("user_id", userId).order("last_seen_at", { ascending: false });
      if (!cancelled && devs) setDevices(devs as DeviceRow[]);
    };
    const loadPlayback = async () => {
      const { data: pb } = await supabase.from("playback_state").select("*").eq("user_id", userId).maybeSingle();
      // Never let an older copy replace a newer one that arrived live in the meantime.
      if (!cancelled && pb) adopt(pb as PlaybackStateRow);
    };
    // How far this device's clock is from the server's, so "how long ago was this written" is right
    // even when the phone and the PC disagree about the time.
    const syncClock = async () => {
      try {
        const t0 = Date.now();
        const { data, error } = await supabase.rpc("server_time");
        const t1 = Date.now();
        if (cancelled || error || !data) return;
        const server = Date.parse(data as unknown as string);
        if (isNaN(server) || t1 - t0 > 3000) return;
        clockOffsetRef.current = server - (t0 + t1) / 2;
      } catch { /* the server clock is a nice-to-have */ }
    };
    // Safety net for commands sent to this device whose live delivery was missed.
    const loadCommands = async () => {
      const me = deviceIdRef.current;
      if (!me) return;
      const since = new Date(Date.now() + clockOffsetRef.current - 12_000).toISOString();
      const { data, error } = await (supabase as any)
        .from("playback_commands").select("*").eq("target_device_id", me).gte("created_at", since).order("id", { ascending: true });
      if (cancelled || error || !data) return;
      (data as RemoteCommand[]).forEach(handleCommand);
    };
    const load = () => Promise.all([loadDevices(), loadPlayback(), syncClock()]);
    load();

    // A phone can miss live updates while the screen is off or the connection drops.
    // Catch up as soon as the app is visible or back online, and whenever the live link reconnects.
    const onVisible = () => { if (document.visibilityState === "visible") load(); };
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("online", load);
    window.addEventListener("focus", load);

    // Safety net: even if a live update is lost, every device re-reads the shared state every 5 seconds.
    let ticks = 0;
    const poll = window.setInterval(() => {
      if (document.visibilityState !== "visible") return;
      ticks += 1;
      loadPlayback();
      loadCommands();
      if (ticks % 6 === 0) { loadDevices(); syncClock(); }
    }, 5_000);

    const channel = supabase
      .channel(`sync-${userId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "devices", filter: `user_id=eq.${userId}` }, (payload) => {
        setDevices((prev) => {
          if (payload.eventType === "DELETE") return prev.filter((d) => d.id !== (payload.old as any).id);
          const next = payload.new as DeviceRow;
          const idx = prev.findIndex((d) => d.id === next.id);
          if (idx === -1) return [next, ...prev];
          const copy = prev.slice();
          copy[idx] = next;
          return copy;
        });
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "playback_state", filter: `user_id=eq.${userId}` }, (payload) => {
        if (payload.eventType === "DELETE") { playbackRef.current = null; setPlayback(null); }
        else adopt(payload.new as PlaybackStateRow);
      })
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "playback_commands", filter: `user_id=eq.${userId}` }, (payload) => {
        handleCommand(payload.new as RemoteCommand);
      })
      .subscribe((status) => {
        if (status === "SUBSCRIBED") load();
      });

    return () => {
      cancelled = true;
      window.clearInterval(poll);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("online", load);
      window.removeEventListener("focus", load);
      supabase.removeChannel(channel);
    };
  }, [userId, adopt, handleCommand]);

  const isThisDeviceActive = useMemo(() => {
    if (!device || !playback) return true; // No state yet → assume self
    if (!playback.active_device_id) return true;
    return playback.active_device_id === device.id;
  }, [device, playback]);

  // Push partial playback state. Pushes are queued so each one builds on the result of the one before.
  const pushState = useCallback(
    (patch: Partial<Omit<PlaybackStateRow, "user_id" | "version" | "updated_at">>): Promise<void> => {
      if (!userId || !device) return Promise.resolve();
      lastPushAtRef.current = Date.now();
      const run = async () => {
        const base = playbackRef.current;
        const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
        const rawSongId = patch.song_id ?? base?.track_id ?? base?.song_id ?? null;
        // playback_state.song_id is uuid, so songs bundled with the app (ids like "2" or "k2")
        // cannot go there (22P02). Their id is kept in track_id so other devices still know the song.
        const song_id = rawSongId && UUID_RE.test(rawSongId) ? rawSongId : null;
        const next = {
          user_id: userId,
          song_id,
          track_id: rawSongId,
          position_seconds: patch.position_seconds ?? base?.position_seconds ?? 0,
          is_playing: patch.is_playing ?? base?.is_playing ?? false,
          playback_rate: patch.playback_rate ?? base?.playback_rate ?? 1,
          shuffle: patch.shuffle ?? base?.shuffle ?? false,
          repeat_mode: patch.repeat_mode ?? base?.repeat_mode ?? "off",
          active_device_id: patch.active_device_id ?? base?.active_device_id ?? device.id,
          queue: patch.queue ?? base?.queue ?? [],
          context_type: patch.context_type ?? base?.context_type ?? "library",
          context_id: patch.context_id ?? base?.context_id ?? null,
          context_track_ids: patch.context_track_ids ?? base?.context_track_ids ?? [],
          context_index: patch.context_index ?? base?.context_index ?? 0,
          volume: patch.volume ?? base?.volume ?? 1,
          updated_by_device: device.id,
          // The database overwrites these two with its own order and time; they are only a fallback.
          version: (base?.version ?? 0) + 1,
          updated_at: new Date(serverNow()).toISOString(),
        };
        const { data, error } = await supabase.from("playback_state").upsert(next, { onConflict: "user_id" }).select().maybeSingle();
        lastPushAtRef.current = Date.now();
        if (error) console.error("pushState error", error);
        else if (data && (data as PlaybackStateRow).user_id) adopt(data as PlaybackStateRow);
      };
      const p = chainRef.current.then(run, run);
      chainRef.current = p.catch(() => {});
      return p;
    },
    [userId, device, adopt, serverNow],
  );

  /**
   * Regular check-in from the device that is playing: where the song is right now, and which song of
   * which list. Only succeeds while this device still owns playback, so a device that was just
   * replaced can never take it back by accident.
   */
  const pushHeartbeat = useCallback(
    (getPatch: () => { track_id: string | null; position_seconds: number; is_playing: boolean; context_index: number }): Promise<void> => {
      if (!userId || !device) return Promise.resolve();
      const run = async () => {
        const base = playbackRef.current;
        if (!base || base.active_device_id !== device.id) return;
        const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
        const p = getPatch();
        const patch = {
          track_id: p.track_id,
          song_id: p.track_id && UUID_RE.test(p.track_id) ? p.track_id : null,
          position_seconds: p.position_seconds,
          is_playing: p.is_playing,
          context_index: p.context_index,
          updated_by_device: device.id,
          version: base.version + 1,
          updated_at: new Date(serverNow()).toISOString(),
        };
        const { data, error } = await supabase
          .from("playback_state")
          .update(patch)
          .eq("user_id", userId)
          .eq("active_device_id", device.id)
          .select()
          .maybeSingle();
        if (error) console.error("heartbeat error", error);
        else if (data && (data as PlaybackStateRow).user_id) adopt(data as PlaybackStateRow);
      };
      const p = chainRef.current.then(run, run);
      chainRef.current = p.catch(() => {});
      return p;
    },
    [userId, device, adopt, serverNow],
  );

  /**
   * Remote control: asks the device that is playing to do something (pause, next, seek...).
   * Resolves false when the command could not be sent, so the caller can fall back.
   */
  const sendCommand = useCallback(
    async (action: RemoteAction, value?: string | number | boolean): Promise<boolean> => {
      const target = playbackRef.current?.active_device_id;
      if (!userId || !device || !target || target === device.id) return false;
      lastPushAtRef.current = Date.now();
      const { error } = await (supabase as any).from("playback_commands").insert({
        user_id: userId,
        target_device_id: target,
        from_device_id: device.id,
        action,
        value: value === undefined ? null : String(value),
      });
      if (error) console.error("sendCommand error", error);
      return !error;
    },
    [userId, device],
  );

  const transferTo = useCallback(
    async (deviceId: string) => {
      await pushState({ active_device_id: deviceId });
    },
    [pushState],
  );

  const renameDevice = useCallback(async (id: string, name: string) => {
    await supabase.from("devices").update({ name }).eq("id", id);
  }, []);

  const removeDevice = useCallback(async (id: string) => {
    await supabase.from("devices").delete().eq("id", id);
  }, []);

  return {
    userId,
    device,
    devices,
    playback,
    isThisDeviceActive,
    pushState,
    pushHeartbeat,
    sendCommand,
    commandHandlerRef,
    serverNow,
    lastPushAtRef,
    transferTo,
    renameDevice,
    removeDevice,
  };
}
