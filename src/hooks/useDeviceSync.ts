import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
    const load = async () => {
      const [{ data: devs }, { data: pb }] = await Promise.all([
        supabase.from("devices").select("*").eq("user_id", userId).order("last_seen_at", { ascending: false }),
        supabase.from("playback_state").select("*").eq("user_id", userId).maybeSingle(),
      ]);
      if (cancelled) return;
      if (devs) setDevices(devs as DeviceRow[]);
      // Never let an older copy replace a newer one that arrived live in the meantime.
      if (pb) setPlayback((prev) => (!prev || newer(pb as PlaybackStateRow, prev) ? (pb as PlaybackStateRow) : prev));
    };
    load();

    // A phone can miss live updates while the screen is off or the connection drops.
    // Catch up as soon as the app is visible or back online, and whenever the live link reconnects.
    const onVisible = () => { if (document.visibilityState === "visible") load(); };
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("online", load);
    window.addEventListener("focus", load);

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
        if (payload.eventType === "DELETE") setPlayback(null);
        else setPlayback(payload.new as PlaybackStateRow);
      })
      .subscribe((status) => {
        if (status === "SUBSCRIBED") load();
      });

    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("online", load);
      window.removeEventListener("focus", load);
      supabase.removeChannel(channel);
    };
  }, [userId]);

  const isThisDeviceActive = useMemo(() => {
    if (!device || !playback) return true; // No state yet → assume self
    if (!playback.active_device_id) return true;
    return playback.active_device_id === device.id;
  }, [device, playback]);

  // Push partial playback state. Caller provides version-bumped diff.
  const pushState = useCallback(
    async (patch: Partial<Omit<PlaybackStateRow, "user_id" | "version" | "updated_at">>) => {
      if (!userId || !device) return;
      const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      const rawSongId = patch.song_id ?? playback?.track_id ?? playback?.song_id ?? null;
      // playback_state.song_id is uuid, so songs bundled with the app (ids like "2" or "k2")
      // cannot go there (22P02). Their id is kept in track_id so other devices still know the song.
      const song_id = rawSongId && UUID_RE.test(rawSongId) ? rawSongId : null;
      const next = {
        user_id: userId,
        song_id,
        track_id: rawSongId,
        position_seconds: patch.position_seconds ?? playback?.position_seconds ?? 0,
        is_playing: patch.is_playing ?? playback?.is_playing ?? false,
        playback_rate: patch.playback_rate ?? playback?.playback_rate ?? 1,
        shuffle: patch.shuffle ?? playback?.shuffle ?? false,
        repeat_mode: patch.repeat_mode ?? playback?.repeat_mode ?? "off",
        active_device_id: patch.active_device_id ?? playback?.active_device_id ?? device.id,
        queue: patch.queue ?? playback?.queue ?? [],
        context_type: patch.context_type ?? playback?.context_type ?? "library",
        context_id: patch.context_id ?? playback?.context_id ?? null,
        context_track_ids: patch.context_track_ids ?? playback?.context_track_ids ?? [],
        context_index: patch.context_index ?? playback?.context_index ?? 0,
        volume: patch.volume ?? playback?.volume ?? 1,
        updated_by_device: device.id,
        version: (playback?.version ?? 0) + 1,
        updated_at: new Date().toISOString(),
      };

      const { error } = await supabase.from("playback_state").upsert(next, { onConflict: "user_id" });
      if (error) console.error("pushState error", error);
    },
    [userId, device, playback],
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
    transferTo,
    renameDevice,
    removeDevice,
  };
}
