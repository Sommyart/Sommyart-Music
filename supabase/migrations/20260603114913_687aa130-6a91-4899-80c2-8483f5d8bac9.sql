-- Add shuffle + repeat to playback_state
ALTER TABLE public.playback_state
  ADD COLUMN IF NOT EXISTS shuffle boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS repeat_mode text NOT NULL DEFAULT 'off';

ALTER TABLE public.playback_state
  ADD CONSTRAINT playback_state_repeat_mode_check
  CHECK (repeat_mode IN ('off','all','one'));

-- Recently played
CREATE TABLE public.recently_played (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  song_id uuid NOT NULL,
  played_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX recently_played_user_time_idx
  ON public.recently_played (user_id, played_at DESC);

GRANT SELECT, INSERT, DELETE ON public.recently_played TO authenticated;
GRANT ALL ON public.recently_played TO service_role;

ALTER TABLE public.recently_played ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own recently played"
  ON public.recently_played FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users insert own recently played"
  ON public.recently_played FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users delete own recently played"
  ON public.recently_played FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);