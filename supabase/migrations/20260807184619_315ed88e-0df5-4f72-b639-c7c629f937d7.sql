ALTER TABLE public.playback_state
  ADD COLUMN IF NOT EXISTS queue jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS context_type text NOT NULL DEFAULT 'library',
  ADD COLUMN IF NOT EXISTS context_id text,
  ADD COLUMN IF NOT EXISTS context_track_ids jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS context_index integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS volume numeric NOT NULL DEFAULT 1;