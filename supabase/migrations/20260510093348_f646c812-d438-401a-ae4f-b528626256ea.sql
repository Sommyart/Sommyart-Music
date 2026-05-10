
-- Devices table
CREATE TABLE public.devices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  client_id text NOT NULL,
  name text NOT NULL,
  kind text NOT NULL DEFAULT 'desktop',
  output_label text,
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, client_id)
);

ALTER TABLE public.devices ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own devices" ON public.devices
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users insert own devices" ON public.devices
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own devices" ON public.devices
  FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users delete own devices" ON public.devices
  FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE INDEX idx_devices_user ON public.devices(user_id);

-- Playback state (one row per user)
CREATE TABLE public.playback_state (
  user_id uuid PRIMARY KEY,
  song_id uuid,
  position_seconds numeric NOT NULL DEFAULT 0,
  is_playing boolean NOT NULL DEFAULT false,
  playback_rate numeric NOT NULL DEFAULT 1,
  active_device_id uuid REFERENCES public.devices(id) ON DELETE SET NULL,
  updated_by_device uuid,
  version bigint NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.playback_state ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own playback" ON public.playback_state
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users insert own playback" ON public.playback_state
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own playback" ON public.playback_state
  FOR UPDATE TO authenticated USING (auth.uid() = user_id);

-- Realtime
ALTER TABLE public.playback_state REPLICA IDENTITY FULL;
ALTER TABLE public.devices REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.playback_state;
ALTER PUBLICATION supabase_realtime ADD TABLE public.devices;
